// ─── AUDIT PHASE 9 — ADVERSARIAL REVIEW (leakage lens) of the T2b portfolio verdict ──
// Component under review: "Portfolio B&R + RSI + TSMOM, no LS (T2b)" → PAPER-CANDIDATE, exp +0.192.
// Pipeline below (buildCandidates / resolveExits / simulate / metrics) is copied from
// script/audit/phase9-tsmom.ts unchanged, with THREE review knobs added to Arm:
//   order        — same-timestamp tie-break: "az" (researcher default), "za", "engine"
//                  (routes.ts SCANNER_COINS = flatMap(preferredSymbols) insertion order = LS list), or seed
//   holdCap1dBars — cap on the 1d future window: routes.ts MAX_HOLD_HOURS_BY_INTERVAL has no "1d" key,
//                  maxHoldHoursForStrategy() falls back to 240h = 10 daily bars (sim used 200)
//   cluster bootstrap (entry-week / entry-month clusters) next to the i.i.d. one
// Also applies the AUDIT-NOTES "Portfólio para PAPER" bar (exp ≥ +0.20, PF ≥ 1.30, CI lo > 0,
// halves ≥ +0.10, ≥ 80 tr/yr, maxDD ≤ 25R, +15 bps ≥ +0.10) which phase9-tsmom.ts never applied.
// Everything here is REVIEW diagnostics; nothing promotes anything.
// Run: npx tsx script/audit/phase9-review-tsmom-t2b.ts   (today's caches only)

// NOTE 2026-09-03 00:17: the lead retired break-retest / rsi-divergence from the registry and added
// tsmom-daily, so getAllStrategies() no longer yields the researcher's core. The core is rebuilt here
// from the retired strategy files directly (same objects the researcher's run used at 19:24).
import { writeFileSync } from "fs";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import { breakRetestStrategy } from "../../server/strategies/break-retest";
import { rsiDivergenceStrategy } from "../../server/strategies/rsi-divergence";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import type { OHLCV } from "../../server/analysis";
import type { Strategy, StrategySignal } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause } from "../../server/portfolio-guards";
import {
  fetchPaginated, dailyTrendAt, weeklyTrendAt, intervalSec, stats, bootstrapCI, maxDrawdownR, calcATRLocal, mulberry32,
  COIN_GROUP, MAX_PER_GROUP, FIXED_MAX_OPEN, ROLLING_WINDOW_MS, MIN_SL_DISTANCE_PCT, MIN_RR,
  YEAR_2026_TS, ENGINE_EXIT, type MarketData, type Trend,
} from "./lib";

const START_CAPITAL = 1000;
const BASE_RISK_PCT = 1;
const DAILY_CANDLES = 1500;
const FOURH_CANDLES = 8000;
const ONEH_CANDLES = 20000;
const FUNDING_PCT_PER_DAY = 0.03 / 100;
const UNIVERSE: string[] = [...(liquiditySweepStrategy.preferredSymbols ?? [])];
const ENGINE_MAX_HOLD_BARS_1D = 10; // 240h fallback / 24h

// engine scan order at the researcher's run = Array.from(new Set([LS, B&R, RSI].flatMap(preferredSymbols)))
const RESEARCH_REGISTRY: Strategy[] = [liquiditySweepStrategy, breakRetestStrategy, rsiDivergenceStrategy];
const ENGINE_ORDER = new Map<string, number>();
{
  const seq = Array.from(new Set(RESEARCH_REGISTRY.flatMap(s => s.preferredSymbols ?? [])));
  seq.forEach((s, i) => ENGINE_ORDER.set(s, i));
}

// ── TSMOM prototype (verbatim) ──────────────────────────────────────────────
function makeTsmom(id: string, donchianN: number, stopK: number): Strategy {
  return {
    id, name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`, description: "TSMOM", interval: "1d",
    minCandles: Math.max(donchianN + 25, 80), preferredSymbols: [...UNIVERSE], cooldownHours: 72,
    analyze(candles: OHLCV[]): StrategySignal | null {
      const n = candles.length;
      if (n < donchianN + 22) return null;
      const last = candles[n - 1];
      const lookback = candles.slice(n - 1 - donchianN, n - 1);
      let hi = -Infinity, lo = Infinity;
      for (const c of lookback) { if (c.high > hi) hi = c.high; if (c.low < lo) lo = c.low; }
      const dir: "LONG" | "SHORT" | null = last.close > hi ? "LONG" : last.close < lo ? "SHORT" : null;
      if (!dir) return null;
      const atr = calcATRLocal(candles.slice(-42), 20);
      if (!(atr > 0)) return null;
      const entry = last.close, stopDist = stopK * atr;
      const stopLoss = dir === "LONG" ? entry - stopDist : entry + stopDist;
      const takeProfit1 = dir === "LONG" ? entry + 1.75 * stopDist : entry - 1.75 * stopDist;
      const takeProfit2 = dir === "LONG" ? entry + 3.5 * stopDist : entry - 3.5 * stopDist;
      if (stopLoss <= 0 || takeProfit1 <= 0) return null;
      return { direction: dir, entry, stopLoss, takeProfit1, takeProfit2, confidence: 70, confluenceScore: 70, reason: "TSMOM" };
    },
  };
}

// ── Candidates (verbatim) ───────────────────────────────────────────────────
interface Cand {
  stratId: string; interval: string; symbol: string; tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number; sigClose: number;
  streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
}
const MAX_BARS: Record<string, number> = { "1h": 200, "4h": 60, "1d": 200 };
function buildCandidates(strat: Strategy, symbol: string, candles: OHLCV[]): Cand[] {
  const out: Cand[] = [];
  const window = Math.max(strat.minCandles, 60);
  const maxBars = MAX_BARS[strat.interval] ?? 200;
  const ivSec = intervalSec(strat.interval);
  if (candles.length < window + maxBars + 10) return out;
  for (let i = window; i < candles.length - 1; i++) {
    const slice = candles.slice(i - window, i + 1);
    let sig: StrategySignal | null;
    try { sig = strat.analyze(slice); } catch { continue; }
    if (!sig) continue;
    const risk = Math.abs(sig.entry - sig.stopLoss), reward = Math.abs(sig.takeProfit1 - sig.entry);
    const slDistPct = sig.entry > 0 ? risk / sig.entry : 0;
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;
    if (risk <= 0 || reward / risk < MIN_RR) continue;
    out.push({
      stratId: strat.id, interval: strat.interval, symbol, tsSec: candles[i].time + ivSec, dir: sig.direction,
      entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2,
      confidence: sig.confidence, slDistPct, rr: reward / risk, sigClose: candles[i].close,
      streamKey: `${symbol}:${strat.interval}`, entryIdx: i, maxBars, ivSec, idx: -1,
    });
  }
  return out;
}

// ── Exits (verbatim + holdCap1dBars) ────────────────────────────────────────
interface EntryModel { driftBps: number; minRR: number; fundingPctPerDay: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number; fundingR: number }
const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig, holdCap1dBars: number): ResolvedExit[] {
  const key = JSON.stringify({ poolName, model, exitCfg, holdCap1dBars });
  const hit = exitCache.get(key);
  if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    const d = model.driftBps / 10_000;
    const entry = c.dir === "LONG" ? c.sigClose * (1 + d) : c.sigClose * (1 - d);
    const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
    if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < model.minRR) {
      out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", tp1Hit: false, filled: false, entryUsed: entry, fundingR: 0 };
      continue;
    }
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > c.takeProfit1 : tp2raw < c.takeProfit1) ? tp2raw : c.takeProfit1;
    const bars = c.interval === "1d" ? Math.min(c.maxBars, holdCap1dBars) : c.maxBars;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + bars);
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: tp2 }, future, exitCfg);
    const holdDays = ex.barsHeld * c.ivSec / 86_400;
    const fundingR = model.fundingPctPerDay > 0 ? (model.fundingPctPerDay * holdDays) / (riskH / entry) : 0;
    out[c.idx] = { netR: ex.netR - fundingR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, tp1Hit: ex.tp1Hit, filled: true, entryUsed: entry, fundingR };
  }
  exitCache.set(key, out);
  return out;
}

// ── Portfolio sim (verbatim + order/holdCap knobs) ──────────────────────────
type Order = "az" | "za" | "engine" | "seed";
interface Arm {
  label: string; tag: string; pool: string; strategies?: string[];
  entry?: Partial<EntryModel>; seed?: number; order?: Order; holdCap1dBars?: number;
}
interface SimTrade {
  symbol: string; strategy: string; interval: string; dir: "LONG" | "SHORT";
  netR: number; fundingR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number;
  btcD: Trend; outcome: string; barsHeld: number; holdDays: number;
}
interface SimOut { arm: Arm; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number; candidates: number }

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const model: EntryModel = { driftBps: 0, minRR: MIN_RR, fundingPctPerDay: 0, ...(arm.entry ?? {}) };
  const holdCap = arm.holdCap1dBars ?? 200;
  const exits = resolveExits(arm.pool, allCands, streams, model, ENGINE_EXIT, holdCap);
  const active = new Set(arm.strategies ?? strategies.map(s => s.id));
  const order: Order = arm.order ?? (arm.seed != null ? "seed" : "az");
  const rnd = mulberry32(arm.seed ?? 1);
  const rank = new Map<Cand, number>();
  for (const c of allCands) rank.set(c, order === "seed" ? rnd() : order === "engine" ? (ENGINE_ORDER.get(c.symbol) ?? 999) : 0);
  const cands = allCands
    .filter(c => active.has(c.stratId))
    .sort((a, b) => a.tsSec - b.tsSec
      || (order === "az" ? a.symbol.localeCompare(b.symbol) : order === "za" ? b.symbol.localeCompare(a.symbol) : rank.get(a)! - rank.get(b)!));
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));
  const dailyR = 4, rollingR = 6, ksMin = 4, ksMax = -3, maxOpen = FIXED_MAX_OPEN;

  let balance = START_CAPITAL, peak = START_CAPITAL, maxDD = 0;
  interface OpenPos { strategy: string; group?: string; exitTsSec: number; trade: SimTrade }
  const openBySymbol = new Map<string, OpenPos[]>();
  const totalOpen = () => { let n = 0; for (const v of openBySymbol.values()) n += v.length; return n; };
  const lastClosedAt = new Map<string, number>();
  const closedLog: Array<{ strategy: string; closed_at: string; pnl_usd: number; risk_usd: number; outcome: string }> = [];
  const trades: SimTrade[] = [];
  const blocks: Record<string, number> = {};
  const block = (k: string) => { blocks[k] = (blocks[k] ?? 0) + 1; };
  const trendCache = new Map<string, Trend>();
  const dTrend = (sym: string, nowSec: number): Trend => {
    const key = `d:${sym}:${Math.floor(nowSec / 86_400)}`;
    let t = trendCache.get(key);
    if (t === undefined) { const s = sym === "BTC" ? md.btcDaily : md.dailyBySym.get(sym); t = s ? dailyTrendAt(s, nowSec) : "neutral"; trendCache.set(key, t); }
    return t;
  };
  const wTrend = (sym: string, nowSec: number): Trend => {
    const key = `w:${sym}:${Math.floor(nowSec / (7 * 86_400))}`;
    let t = trendCache.get(key);
    if (t === undefined) { const s = sym === "BTC" ? md.btcWeekly : md.weeklyBySym.get(sym); t = s ? weeklyTrendAt(s, nowSec) : "neutral"; trendCache.set(key, t); }
    return t;
  };
  const closeDue = (nowSec: number) => {
    for (const [sym, list] of Array.from(openBySymbol.entries())) {
      const due = list.filter(p => p.exitTsSec <= nowSec);
      if (!due.length) continue;
      const remaining = list.filter(p => p.exitTsSec > nowSec);
      if (remaining.length) openBySymbol.set(sym, remaining); else openBySymbol.delete(sym);
      for (const pos of due) {
        balance += pos.trade.pnlUsd;
        peak = Math.max(peak, balance);
        maxDD = Math.max(maxDD, peak > 0 ? (peak - balance) / peak : 0);
        lastClosedAt.set(`${sym}:${pos.strategy}`, pos.exitTsSec * 1000);
        closedLog.push({ strategy: pos.strategy, closed_at: new Date(pos.exitTsSec * 1000).toISOString(), pnl_usd: pos.trade.pnlUsd, risk_usd: pos.trade.riskUsd, outcome: pos.trade.netR >= 0 ? "win" : "loss" });
        trades.push(pos.trade);
      }
    }
  };

  for (const c of cands) {
    const nowSec = c.tsSec, nowMs = nowSec * 1000;
    closeDue(nowSec);
    if ((openBySymbol.get(c.symbol) ?? []).length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }
    const btcDailyTrend = dTrend("BTC", nowSec);
    let riskMultiplier = 1.0;
    if (btcDailyTrend === "up") riskMultiplier = 1.25; else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    const oneR = balance * BASE_RISK_PCT / 100;
    const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
    const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
    if (dayPnl < -dailyR * oneR) { block("ddDaily"); continue; }
    if (isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: rollingR, now: nowMs })) { block("ddRolling7d"); continue; }
    if (totalOpen() >= maxOpen) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const p of list) if (p.group === group) inGroup++;
      if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; }
    }
    const paused = strategiesToPause(closedLog, [c.stratId], { windowMs: ROLLING_WINDOW_MS, minTrades: ksMin, maxNetR: ksMax, now: nowMs });
    if (paused.has(c.stratId)) { block("killSwitch"); continue; }
    if (c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }
    const riskUsd = balance * BASE_RISK_PCT * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, interval: c.interval, dir: c.dir,
      netR: ex.netR, fundingR: ex.fundingR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, outcome: ex.outcome, barsHeld: ex.barsHeld, holdDays: ex.barsHeld * c.ivSec / 86_400,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, candidates: cands.length };
}

// ── Metrics (verbatim + cluster bootstrap) ──────────────────────────────────
function clusterBootstrapCI(trades: SimTrade[], clusterSec: number, iters = 10_000, seed = 7): { lo: number; hi: number; k: number } {
  const byC = new Map<number, number[]>();
  for (const t of trades) { const k = Math.floor(t.openedSec / clusterSec); byC.set(k, [...(byC.get(k) ?? []), t.netR]); }
  const clusters = [...byC.values()]; const K = clusters.length;
  if (K < 2) return { lo: NaN, hi: NaN, k: K };
  const rnd = mulberry32(seed); const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0, n = 0;
    for (let j = 0; j < K; j++) { const c = clusters[(rnd() * K) | 0]; for (const r of c) { s += r; n++; } }
    means.push(n ? s / n : 0);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * 0.025)], hi: means[Math.floor(iters * 0.975)], k: K };
}
interface Metrics {
  n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; cwLo: number; cwHi: number; cwK: number; cmLo: number; cmHi: number; cmK: number; maxDD: number;
  top5Share: number; h1: { n: number; exp: number }; h2: { n: number; exp: number };
  coinsPos: number; coinsTotal: number; coinsPosPct: number; spanYrs: number; tradesPerYr: number; fundingRTotal: number;
  byYear: Record<string, { n: number; sumR: number; exp: number }>;
}
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 2) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
function metrics(trades: SimTrade[]): Metrics {
  const rs = trades.map(t => t.netR);
  const s = stats(rs);
  const ci = bootstrapCI(rs, 10_000);
  const cw = clusterBootstrapCI(trades, 7 * 86_400), cm = clusterBootstrapCI(trades, 30 * 86_400);
  const sortedDesc = [...rs].sort((a, b) => b - a);
  const top5 = sortedDesc.slice(0, 5).reduce((a, b) => a + b, 0);
  let h1 = { n: 0, exp: NaN }, h2 = { n: 0, exp: NaN }, spanYrs = 0;
  if (trades.length) {
    const t0 = Math.min(...trades.map(t => t.openedSec)), t1 = Math.max(...trades.map(t => t.closedSec));
    const mid = (t0 + Math.max(...trades.map(t => t.openedSec))) / 2;
    const a = stats(trades.filter(t => t.openedSec < mid).map(t => t.netR)), b = stats(trades.filter(t => t.openedSec >= mid).map(t => t.netR));
    h1 = { n: a.n, exp: a.exp }; h2 = { n: b.n, exp: b.exp };
    spanYrs = (t1 - t0) / (365.25 * 86_400);
  }
  const byCoin = new Map<string, number>();
  for (const t of trades) byCoin.set(t.symbol, (byCoin.get(t.symbol) ?? 0) + t.netR);
  const coinsTotal = byCoin.size, coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  const byYearM = new Map<string, number[]>();
  for (const t of trades) { const y = new Date(t.openedSec * 1000).toISOString().slice(0, 4); byYearM.set(y, [...(byYearM.get(y) ?? []), t.netR]); }
  const byYear: Metrics["byYear"] = {};
  for (const [y, r] of [...byYearM.entries()].sort()) { const st = stats(r); byYear[y] = { n: st.n, sumR: +st.sumR.toFixed(1), exp: +st.exp.toFixed(3) }; }
  return {
    n: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi, cwLo: cw.lo, cwHi: cw.hi, cwK: cw.k, cmLo: cm.lo, cmHi: cm.hi, cmK: cm.k, maxDD: maxDrawdownR(rs),
    top5Share: s.sumR > 0 ? 100 * top5 / s.sumR : NaN, h1, h2, coinsPos, coinsTotal, coinsPosPct: coinsTotal ? 100 * coinsPos / coinsTotal : NaN,
    spanYrs, tradesPerYr: spanYrs > 0 ? s.n / spanYrs : NaN, fundingRTotal: trades.reduce((a, t) => a + t.fundingR, 0), byYear,
  };
}
function rowStr(m: Metrics): string {
  return `T=${String(m.n).padStart(4)} PF=${f(m.pf).padStart(5)} sumR=${sgn(m.sumR, 1).padStart(7)} exp=${sgn(m.exp, 3)} iidCI=[${sgn(m.ciLo, 3)}, ${sgn(m.ciHi, 3)}] wkClusterCI=[${sgn(m.cwLo, 3)}, ${sgn(m.cwHi, 3)}](K=${m.cwK}) moClusterCI=[${sgn(m.cmLo, 3)}, ${sgn(m.cmHi, 3)}](K=${m.cmK}) maxDD=${f(m.maxDD, 1)}R halves ${sgn(m.h1.exp, 3)}/${sgn(m.h2.exp, 3)} top5=${f(m.top5Share, 0)}% coins+ ${m.coinsPos}/${m.coinsTotal} ${f(m.tradesPerYr, 0)}tr/yr`;
}
function yearStr(m: Metrics): string { return Object.entries(m.byYear).map(([y, v]) => `${y}: T=${v.n} ${sgn(v.sumR, 1)}R exp=${sgn(v.exp, 2)}`).join(" | "); }

// Component PAPER bar (task brief) and Portfolio PAPER bar (AUDIT-NOTES Fase 9 header)
function paperComponent(m: Metrics): string[] {
  const fails: string[] = [];
  if (!(m.exp >= 0.15)) fails.push(`exp ${sgn(m.exp, 3)} < +0.15`);
  if (!(m.pf >= 1.15)) fails.push(`PF ${f(m.pf)} < 1.15`);
  if (!(m.ciLo > -0.05)) fails.push(`CI lo ${sgn(m.ciLo, 3)} ≤ −0.05`);
  if (!(m.h1.exp > 0 && m.h2.exp > 0)) fails.push(`halves ${sgn(m.h1.exp, 3)}/${sgn(m.h2.exp, 3)} not both > 0`);
  if (!(m.tradesPerYr >= 30)) fails.push(`${f(m.tradesPerYr, 0)}/yr < 30`);
  return fails;
}
function paperPortfolio(m: Metrics, expSlip15: number): string[] {
  const fails: string[] = [];
  if (!(m.exp >= 0.20)) fails.push(`exp ${sgn(m.exp, 3)} < +0.20`);
  if (!(m.pf >= 1.30)) fails.push(`PF ${f(m.pf)} < 1.30`);
  if (!(m.ciLo > 0)) fails.push(`CI lo ${sgn(m.ciLo, 3)} ≤ 0`);
  if (!(m.h1.exp >= 0.10 && m.h2.exp >= 0.10)) fails.push(`halves ${sgn(m.h1.exp, 3)}/${sgn(m.h2.exp, 3)} not both ≥ +0.10`);
  if (!(m.tradesPerYr >= 80)) fails.push(`${f(m.tradesPerYr, 0)}/yr < 80`);
  if (!(m.maxDD <= 25)) fails.push(`maxDD ${f(m.maxDD, 1)}R > 25R`);
  if (!(expSlip15 >= 0.10)) fails.push(`+15 bps exp ${sgn(expSlip15, 3)} < +0.10`);
  return fails;
}

async function main() {
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — ADVERSARIAL REVIEW (leakage lens) of the T2b portfolio verdict — ${new Date().toISOString().slice(0, 10)}`);
  L(`Pipeline = phase9-tsmom.ts verbatim ($1000 @ 1%, honest signal-close entry, engine gates, fees 0.05%+0.05%/side). Review knobs: tie-break order, 1d hold cap, cluster bootstrap, portfolio PAPER bar.`);
  L(`engine scan order (first 12): ${[...ENGINE_ORDER.entries()].sort((a, b) => a[1] - b[1]).slice(0, 12).map(e => e[0]).join(" ")} …`);
  L("");

  const nonLS: Strategy[] = [breakRetestStrategy, rsiDivergenceStrategy];   // researcher-time registry minus LS
  const streams = new Map<string, OHLCV[]>();
  const dailyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) { try { const c = await fetchPaginated(sym, "1d", DAILY_CANDLES); streams.set(`${sym}:1d`, c); dailyBySym.set(sym, c); } catch (e: any) { console.error(`1d fetch failed ${sym}: ${e?.message ?? e}`); } }
  for (const s of nonLS) for (const sym of s.preferredSymbols ?? []) {
    const key = `${sym}:${s.interval}`;
    if (streams.has(key)) continue;
    const total = s.interval === "4h" ? FOURH_CANDLES : ONEH_CANDLES;
    try { streams.set(key, await fetchPaginated(sym, s.interval, total)); } catch (e: any) { console.error(`fetch failed ${key}: ${e?.message ?? e}`); }
  }
  const btcDaily = await fetchPaginated("BTC", "1d", DAILY_CANDLES);
  const btcWeekly = await fetchPaginated("BTC", "1w", 400);
  const weeklyBySym = new Map<string, OHLCV[]>();
  for (const s of nonLS.filter(s => s.interval === "4h")) for (const sym of s.preferredSymbols ?? []) {
    if (!weeklyBySym.has(sym)) { try { weeklyBySym.set(sym, await fetchPaginated(sym, "1w", 400)); } catch (e: any) { console.error(`weekly fetch failed ${sym}: ${e?.message ?? e}`); } }
  }
  const md: MarketData = { btcDaily, btcWeekly, dailyBySym, weeklyBySym };

  const TS = makeTsmom("tsmom", 55, 2.0);
  const buildPool = (strats: Strategy[]): Cand[] => {
    const out: Cand[] = [];
    for (const s of strats) for (const sym of s.preferredSymbols ?? []) { const c = streams.get(`${sym}:${s.interval}`); if (c) out.push(...buildCandidates(s, sym, c)); }
    out.forEach((c, i) => { c.idx = i; });
    return out;
  };
  const pools = new Map<string, Cand[]>();
  pools.set("tsmom", buildPool([TS]));
  pools.set("core", buildPool(nonLS));
  pools.set("core+tsmom", buildPool([...nonLS, TS]));
  L(`pools: tsmom=${pools.get("tsmom")!.length} core=${pools.get("core")!.length} core+tsmom=${pools.get("core+tsmom")!.length} (phase9-tsmom.ts: 2481 / 1182 / 3663)`);
  L("");
  const allStrats = [...nonLS, TS];

  const arms: Arm[] = [
    { tag: "V0", label: "V0 reproduce T2b — A→Z tie-break, 200d hold cap (must be T=499 exp +0.192)", pool: "core+tsmom", order: "az" },
    { tag: "V0a", label: "V0a reproduce T2a — B&R+RSI alone (must be T=266 exp +0.149)", pool: "core", order: "az" },
    { tag: "V0b", label: "V0b reproduce T0 — TSMOM alone (must be T=403 exp +0.183)", pool: "tsmom", order: "az" },
    { tag: "V1", label: "V1 T2b — ENGINE scan order tie-break, 200d cap", pool: "core+tsmom", order: "engine" },
    { tag: "V2", label: "V2 T2b — Z→A tie-break, 200d cap", pool: "core+tsmom", order: "za" },
    { tag: "V3", label: `V3 T2b — A→Z, ENGINE max-hold parity (1d → 240h fallback = ${ENGINE_MAX_HOLD_BARS_1D} bars)`, pool: "core+tsmom", order: "az", holdCap1dBars: ENGINE_MAX_HOLD_BARS_1D },
    { tag: "V4", label: `V4 T2b — ENGINE order + ENGINE max-hold ${ENGINE_MAX_HOLD_BARS_1D} bars`, pool: "core+tsmom", order: "engine", holdCap1dBars: ENGINE_MAX_HOLD_BARS_1D },
    { tag: "V5", label: "V5 T2b — ENGINE order, 200d cap, +15 bps + funding (T2c under engine order)", pool: "core+tsmom", order: "engine", entry: { driftBps: 15, fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "V5a", label: "V5a T2b — A→Z, 200d cap, +15 bps + funding (reproduce T2c: T=491 exp +0.125)", pool: "core+tsmom", order: "az", entry: { driftBps: 15, fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "V6", label: "V6 T2b — A→Z, 200d cap, funding only (no venue slip) — the realistic perp headline", pool: "core+tsmom", order: "az", entry: { fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "V7", label: `V7 T0 TSMOM alone — ENGINE max-hold ${ENGINE_MAX_HOLD_BARS_1D} bars, A→Z`, pool: "tsmom", order: "az", holdCap1dBars: ENGINE_MAX_HOLD_BARS_1D },
    { tag: "V8", label: "V8 T0 TSMOM alone — ENGINE order, 200d cap", pool: "tsmom", order: "engine" },
  ];
  const results = new Map<string, SimOut>();
  const M = new Map<string, Metrics>();
  for (const arm of arms) {
    const r = simulate(arm, pools.get(arm.pool)!, streams, md, allStrats);
    results.set(arm.tag, r); const m = metrics(r.trades); M.set(arm.tag, m);
    L(`## ${arm.label}`);
    L(`  ${rowStr(m)}  balDD=${f(r.maxDDpct, 1)}%${m.fundingRTotal ? ` funding −${f(m.fundingRTotal, 1)}R` : ""}`);
    L(`  years: ${yearStr(m)}`);
    if (arm.pool === "core+tsmom") {
      for (const sid of ["tsmom", "break-retest", "rsi-divergence"]) {
        const ms = metrics(r.trades.filter(t => t.strategy === sid));
        L(`  sleeve ${sid.padEnd(14)} T=${ms.n} sumR=${sgn(ms.sumR, 1)} exp=${sgn(ms.exp, 3)} PF=${f(ms.pf)} halves ${sgn(ms.h1.exp, 3)}/${sgn(ms.h2.exp, 3)}`);
      }
    }
    L(`  blocks: ${Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    L("");
  }

  // Seeds: T2b under 200d cap (A→Z baseline vs 20 random) and under the engine 10-bar cap
  L(`## Tie-break seeds (20 random same-timestamp orders)`);
  const seedSummary: Record<string, unknown> = {};
  for (const [name, pool, cap, entry] of [
    ["T2b 200d cap", "core+tsmom", 200, undefined],
    [`T2b engine ${ENGINE_MAX_HOLD_BARS_1D}-bar cap`, "core+tsmom", ENGINE_MAX_HOLD_BARS_1D, undefined],
    ["T2b 200d cap + funding only", "core+tsmom", 200, { fundingPctPerDay: FUNDING_PCT_PER_DAY }],
  ] as Array<[string, string, number, Partial<EntryModel> | undefined]>) {
    const ms: Metrics[] = [];
    for (let seed = 1; seed <= 20; seed++) ms.push(metrics(simulate({ tag: "S", label: "", pool, order: "seed", seed, holdCap1dBars: cap, entry }, pools.get(pool)!, streams, md, allStrats).trades));
    const e = ms.map(m => m.exp).sort((a, b) => a - b), dd = ms.map(m => m.maxDD).sort((a, b) => a - b), pf = ms.map(m => m.pf).sort((a, b) => a - b);
    L(`  ${name}: exp min/med/max ${sgn(e[0], 3)}/${sgn(e[10], 3)}/${sgn(e[19], 3)} · PF med ${f(pf[10])} · maxDD min/med/max ${f(dd[0], 1)}/${f(dd[10], 1)}/${f(dd[19], 1)}R · component-PAPER pass ${ms.filter(m => !paperComponent(m).length).length}/20 · exp≥0.20 in ${e.filter(x => x >= 0.20).length}/20 · iid CI lo>0 in ${ms.filter(m => m.ciLo > 0).length}/20 · wk-cluster CI lo>0 in ${ms.filter(m => m.cwLo > 0).length}/20 · both halves ≥0.10 in ${ms.filter(m => m.h1.exp >= 0.10 && m.h2.exp >= 0.10).length}/20`);
    seedSummary[name] = { exp: e, maxDD: dd, pf };
  }
  L("");

  // Verdict re-application
  const v0 = M.get("V0")!, v1 = M.get("V1")!, v3 = M.get("V3")!, v4 = M.get("V4")!, v5 = M.get("V5")!, v5a = M.get("V5a")!, v6 = M.get("V6")!;
  L(`## Verdict re-application`);
  const show = (name: string, m: Metrics, slip: number) => {
    const pc = paperComponent(m), pp = paperPortfolio(m, slip);
    L(`  ${name}: component-PAPER ${pc.length ? "FAIL (" + pc.join("; ") + ")" : "pass"} · portfolio-PAPER (AUDIT-NOTES) ${pp.length ? "FAIL (" + pp.join("; ") + ")" : "pass"}`);
  };
  show("V0 T2b as reported (A→Z, 200d)", v0, v5a.exp);
  show("V1 T2b engine order", v1, v5.exp);
  show("V3 T2b engine 10-bar hold", v3, NaN);
  show("V4 T2b engine order + engine hold", v4, NaN);
  show("V6 T2b funding only (perp reality, no venue slip)", v6, v5a.exp);
  L("");
  L(`## Selection-bias rule (task brief): B&R ×40 universe exp −0.016 / RSI ×40 −0.125 (phase9-report-brrsi.md) → both core sleeves are REJECT components; T2b core sleeve contributes ${sgn(metrics(results.get("V0")!.trades.filter(t => t.strategy !== "tsmom")).sumR, 1)}R of ${sgn(v0.sumR, 1)}R.`);
  L("");

  writeFileSync("script/audit/phase9-report-review-tsmom-t2b.md", lines.join("\n"));
  const pack = (m: Metrics) => ({ n: m.n, exp: +m.exp.toFixed(4), pf: +m.pf.toFixed(3), sumR: +m.sumR.toFixed(1), ciLo: +m.ciLo.toFixed(4), ciHi: +m.ciHi.toFixed(4), cwLo: +m.cwLo.toFixed(4), cmLo: +m.cmLo.toFixed(4), maxDD: +m.maxDD.toFixed(1), h1: +m.h1.exp.toFixed(4), h2: +m.h2.exp.toFixed(4), top5: +m.top5Share.toFixed(1), coinsPosPct: +m.coinsPosPct.toFixed(1), tradesPerYr: +m.tradesPerYr.toFixed(1), byYear: m.byYear });
  writeFileSync("script/.cache/phase9-review-tsmom-t2b-summary.json", JSON.stringify({ arms: Object.fromEntries([...M.entries()].map(([k, m]) => [k, pack(m)])), seeds: seedSummary }, null, 1));
  console.log("\n[written script/audit/phase9-report-review-tsmom-t2b.md]");
}
main().catch(e => { console.error(e); process.exit(1); });
