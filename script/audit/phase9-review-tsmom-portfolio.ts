// ─── AUDIT PHASE 9 — ADVERSARIAL REVIEW (statistics lens) of the phase9-tsmom.ts
// T2b verdict: "Portfolio B&R + RSI + TSMOM, no LS → PAPER-CANDIDATE".
//
// Pipeline (candidates, honest exits, portfolio sim, metrics, verdict) is copied from
// script/audit/phase9-tsmom.ts so that any difference is attributable to the review arms,
// not to the machinery. Data is pinned to the researcher's snapshot (day key 20260902 in
// script/.cache) so the headline numbers must reproduce exactly; anything not cached under
// that key falls back to lib.fetchPaginated (today's key) and is logged.
//
// REVIEW ARMS (all diagnostics of the verdict under review; nothing is promoted here):
//   R0  T2a reproduce (B&R+RSI preferred lists, A→Z tie-break)   → expect T=266 exp +0.149
//   R1  T2b reproduce (B&R+RSI+TSMOM, A→Z)                         → expect T=499 exp +0.192 PF 1.33 CI [+0.061,+0.327]
//   R2  T2c reproduce (+15 bps + funding, all strategies)          → expect T=491 exp +0.125
//   R3  T2b with the ENGINE tie-break order (paperScan: coins in SCANNER_COINS order = registry
//       flatMap(preferredSymbols) → B&R list, RSI list, LS list; strategies in registry order)
//   R4  T2b with Z→A order (another arbitrary order)
//   R5  T2b over 20 random tie-break seeds — the literal PAPER / ACCEPT verdict per seed
//       (each seed also gets its own +15 bps + funding arm for the slippage criterion)
//   R6  SELECTION-BIAS RULE applied literally: B&R ×40 alone and RSI ×40 alone (same params,
//       engine gates) — must reach exp ≥ +0.15 or the preferred-coin result is an artefact
//   R7  Portfolio with the core on the 40-coin universe: B&R×40 + RSI×40 + TSMOM (and core40 alone)
//   R8  T2b restricted to the window in which all three sleeves exist (from the first RSI 1h candle)
//   R9  Cluster bootstrap CI95 (entry-day and entry-ISO-week clusters, 10k) for R1 — same-day
//       breakouts across 40 coins are not i.i.d., so the trade-level bootstrap understates variance
//   R10 Sleeve decomposition of R1 and the count-median halves split (sensitivity of the halves test)
//
// Run: npx tsx script/audit/phase9-review-tsmom-portfolio.ts

import { writeFileSync, existsSync, readFileSync } from "fs";
import { breakRetestStrategy } from "../../server/strategies/break-retest";
import { rsiDivergenceStrategy } from "../../server/strategies/rsi-divergence";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
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
const SNAPSHOT_DAY_KEY = "20260902";   // the researcher's data snapshot
const UNIVERSE: string[] = [...(liquiditySweepStrategy.preferredSymbols ?? [])];

// ── Data pinned to the researcher's snapshot ────────────────────────────────
const fetchLog: string[] = [];
async function loadSeries(sym: string, iv: string, total: number): Promise<OHLCV[]> {
  const p = `script/.cache/pl_${sym}_${iv}_${total}_${SNAPSHOT_DAY_KEY}.json`;
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) as OHLCV[];
  fetchLog.push(`${sym}:${iv}×${total} (not in ${SNAPSHOT_DAY_KEY} cache → live fetch)`);
  return fetchPaginated(sym, iv, total);
}

// ── TSMOM prototype (verbatim from phase9-tsmom.ts / phase6-tsmom.ts) ───────
function makeTsmom(id: string, donchianN: number, stopK: number): Strategy {
  return {
    id,
    name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`,
    description: "Time-series momentum prototype — daily Donchian close breakout, ATR stop.",
    interval: "1d",
    minCandles: Math.max(donchianN + 25, 80),
    preferredSymbols: [...UNIVERSE],
    cooldownHours: 72,
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
      const entry = last.close;
      const stopDist = stopK * atr;
      const stopLoss = dir === "LONG" ? entry - stopDist : entry + stopDist;
      const takeProfit1 = dir === "LONG" ? entry + 1.75 * stopDist : entry - 1.75 * stopDist;
      const takeProfit2 = dir === "LONG" ? entry + 3.5 * stopDist : entry - 3.5 * stopDist;
      if (stopLoss <= 0 || takeProfit1 <= 0) return null;
      return {
        direction: dir, entry, stopLoss, takeProfit1, takeProfit2,
        confidence: 70, confluenceScore: 70,
        reason: `TSMOM ${dir} — close ${dir === "LONG" ? ">" : "<"} Donchian${donchianN} ${dir === "LONG" ? "high" : "low"} | stop ${stopK}×ATR20`,
      };
    },
  };
}

// ── Candidates (verbatim) ───────────────────────────────────────────────────
interface Cand {
  stratId: string; interval: string; symbol: string;
  tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number;
  sigClose: number;
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
    const risk = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit1 - sig.entry);
    const slDistPct = sig.entry > 0 ? risk / sig.entry : 0;
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;
    if (risk <= 0 || reward / risk < MIN_RR) continue;
    out.push({
      stratId: strat.id, interval: strat.interval, symbol,
      tsSec: candles[i].time + ivSec, dir: sig.direction,
      entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2,
      confidence: sig.confidence, slDistPct, rr: reward / risk, sigClose: candles[i].close,
      streamKey: `${symbol}:${strat.interval}`, entryIdx: i, maxBars, ivSec, idx: -1,
    });
  }
  return out;
}

// ── Exit resolution — honest entry model (verbatim) ─────────────────────────
interface EntryModel { driftBps: number; minRR: number; fundingPctPerDay: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number; fundingR: number }

const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = JSON.stringify({ poolName, model, exitCfg });
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
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + c.maxBars);
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: tp2 }, future, exitCfg);
    const holdDays = ex.barsHeld * c.ivSec / 86_400;
    const fundingR = model.fundingPctPerDay > 0 ? (model.fundingPctPerDay * holdDays) / (riskH / entry) : 0;
    out[c.idx] = { netR: ex.netR - fundingR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, tp1Hit: ex.tp1Hit, filled: true, entryUsed: entry, fundingR };
  }
  exitCache.set(key, out);
  return out;
}

// ── Portfolio simulation (verbatim + explicit tie-break order) ──────────────
interface Arm {
  label: string; tag: string; pool: string;
  strategies?: string[];
  daily?: number | null; rolling?: number | null; ksMin?: number; ksMax?: number | null;
  maxOpen?: number;
  entry?: Partial<EntryModel>;
  /** REVIEW: shuffle same-timestamp candidates (same as phase9-tsmom.ts POST-HOC seeds). */
  seed?: number;
  /** REVIEW: explicit same-timestamp order (lower first). Default = symbol A→Z, as in phase9-tsmom.ts. */
  orderKey?: (c: Cand) => number;
}
interface SimTrade {
  symbol: string; strategy: string; interval: string; dir: "LONG" | "SHORT";
  netR: number; fundingR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number;
  btcD: Trend; outcome: string; tp1Hit: boolean; barsHeld: number; holdDays: number; entryUsed: number; stopLoss: number; slDistPct: number;
}
interface SimOut { arm: Arm; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number; candidates: number }

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const model: EntryModel = { driftBps: 0, minRR: MIN_RR, fundingPctPerDay: 0, ...(arm.entry ?? {}) };
  const exits = resolveExits(arm.pool, allCands, streams, model, ENGINE_EXIT);
  const active = new Set(arm.strategies ?? strategies.map(s => s.id));
  const cands = allCands
    .filter(c => active.has(c.stratId))
    .sort((a, b) => a.tsSec - b.tsSec || (arm.orderKey ? arm.orderKey(a) - arm.orderKey(b) : 0) || a.symbol.localeCompare(b.symbol));
  if (arm.seed != null) {
    const rnd = mulberry32(arm.seed);
    const keyed = cands.map(c => ({ c, k: rnd() }));
    keyed.sort((a, b) => a.c.tsSec - b.c.tsSec || a.k - b.k);
    cands.splice(0, cands.length, ...keyed.map(x => x.c));
  }
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));
  const dailyR = arm.daily === undefined ? 4 : arm.daily;
  const rollingR = arm.rolling === undefined ? 6 : arm.rolling;
  const ksMin = arm.ksMin ?? 4;
  const ksMax = arm.ksMax === undefined ? -3 : arm.ksMax;
  const maxOpen = arm.maxOpen ?? FIXED_MAX_OPEN;

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
    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }

    const btcDailyTrend = dTrend("BTC", nowSec);
    let riskMultiplier = 1.0;
    if (btcDailyTrend === "up") riskMultiplier = 1.25; else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    const oneR = balance * BASE_RISK_PCT / 100;

    if (dailyR != null) {
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -dailyR * oneR) { block("ddDaily"); continue; }
    }
    if (rollingR != null && isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: rollingR, now: nowMs })) { block("ddRolling7d"); continue; }

    if (totalOpen() >= maxOpen) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const p of list) if (p.group === group) inGroup++;
      if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; }
    }
    if (ksMax != null) {
      const paused = strategiesToPause(closedLog, [c.stratId], { windowMs: ROLLING_WINDOW_MS, minTrades: ksMin, maxNetR: ksMax, now: nowMs });
      if (paused.has(c.stratId)) { block("killSwitch"); continue; }
    }
    if (c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }

    const riskUsd = balance * BASE_RISK_PCT * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const slNow = Math.abs(ex.entryUsed - c.stopLoss) / ex.entryUsed;
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, interval: c.interval, dir: c.dir,
      netR: ex.netR, fundingR: ex.fundingR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, outcome: ex.outcome, tp1Hit: ex.tp1Hit, barsHeld: ex.barsHeld, holdDays: ex.barsHeld * c.ivSec / 86_400,
      entryUsed: ex.entryUsed, stopLoss: c.stopLoss, slDistPct: slNow,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, candidates: cands.length };
}

// ── Metrics (verbatim) + review extras ──────────────────────────────────────
interface Metrics {
  n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; maxDD: number;
  top5Share: number; h1: { n: number; exp: number; sumR: number; pf: number }; h2: { n: number; exp: number; sumR: number; pf: number };
  coinsPos: number; coinsTotal: number; coinsPosPct: number; spanYrs: number; tradesPerYr: number; rPerYr: number; avgHoldDays: number; medHoldDays: number;
  fundingRTotal: number; longN: number; shortN: number;
}
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 2) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
function median(xs: number[]): number { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function metrics(trades: SimTrade[]): Metrics {
  const rs = trades.map(t => t.netR);
  const s = stats(rs);
  const ci = bootstrapCI(rs, 10_000);
  const sortedDesc = [...rs].sort((a, b) => b - a);
  const top5 = sortedDesc.slice(0, 5).reduce((a, b) => a + b, 0);
  const top5Share = s.sumR > 0 ? 100 * top5 / s.sumR : NaN;
  let h1 = { n: 0, exp: NaN, sumR: 0, pf: NaN }, h2 = { n: 0, exp: NaN, sumR: 0, pf: NaN };
  let spanYrs = 0;
  if (trades.length) {
    const t0 = Math.min(...trades.map(t => t.openedSec)), t1 = Math.max(...trades.map(t => t.closedSec));
    const mid = (t0 + Math.max(...trades.map(t => t.openedSec))) / 2;
    const a = stats(trades.filter(t => t.openedSec < mid).map(t => t.netR));
    const b = stats(trades.filter(t => t.openedSec >= mid).map(t => t.netR));
    h1 = { n: a.n, exp: a.exp, sumR: a.sumR, pf: a.pf }; h2 = { n: b.n, exp: b.exp, sumR: b.sumR, pf: b.pf };
    spanYrs = (t1 - t0) / (365.25 * 86_400);
  }
  const byCoin = new Map<string, number>();
  for (const t of trades) byCoin.set(t.symbol, (byCoin.get(t.symbol) ?? 0) + t.netR);
  const coinsTotal = byCoin.size, coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  const holds = trades.map(t => t.holdDays);
  return {
    n: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi, maxDD: maxDrawdownR(rs),
    top5Share, h1, h2, coinsPos, coinsTotal, coinsPosPct: coinsTotal ? 100 * coinsPos / coinsTotal : NaN,
    spanYrs, tradesPerYr: spanYrs > 0 ? s.n / spanYrs : NaN, rPerYr: spanYrs > 0 ? s.sumR / spanYrs : NaN,
    avgHoldDays: holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : NaN, medHoldDays: median(holds),
    fundingRTotal: trades.reduce((a, t) => a + t.fundingR, 0),
    longN: trades.filter(t => t.dir === "LONG").length, shortN: trades.filter(t => t.dir === "SHORT").length,
  };
}

/** Cluster bootstrap: resample whole clusters (e.g. all trades opened in the same day/week) with replacement. */
function clusterBootstrapCI(trades: SimTrade[], keyFn: (t: SimTrade) => string, iters = 10_000, seed = 42): { lo: number; hi: number; clusters: number } {
  const groups = new Map<string, number[]>();
  for (const t of trades) { const k = keyFn(t); groups.set(k, [...(groups.get(k) ?? []), t.netR]); }
  const cl = [...groups.values()];
  if (cl.length < 2) return { lo: NaN, hi: NaN, clusters: cl.length };
  const rnd = mulberry32(seed);
  const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0, n = 0;
    for (let j = 0; j < cl.length; j++) { const g = cl[(rnd() * cl.length) | 0]; for (const r of g) { s += r; n++; } }
    means.push(n ? s / n : 0);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * 0.025)], hi: means[Math.min(iters - 1, Math.floor(iters * 0.975))], clusters: cl.length };
}
const isoWeek = (sec: number) => { const d = new Date(sec * 1000); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); const wk = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7); return `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`; };
const isoDay = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

// ── Pre-registered acceptance (verbatim from phase9-tsmom.ts) ───────────────
type Verdict = "ACCEPT-LIVE-CANDIDATE" | "PAPER-CANDIDATE" | "REJECT" | "INSUFFICIENT-DATA";
function verdict(m: Metrics, expSlip15: number, opts: { multiCoin: boolean; lowFreq: boolean; minTotalOverride?: number }): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  const minTotal = opts.minTotalOverride ?? 100;
  if (m.n < 30) return { verdict: "INSUFFICIENT-DATA", reasons: [`T=${m.n} < 30`] };
  const acc: Array<[boolean, string]> = [
    [m.exp >= 0.25, `exp ${sgn(m.exp, 3)} ≥ +0.25`],
    [m.pf >= 1.30, `PF ${f(m.pf)} ≥ 1.30`],
    [m.ciLo > 0, `CI95 lo ${sgn(m.ciLo, 3)} > 0`],
    [opts.lowFreq ? (m.n >= minTotal || m.tradesPerYr >= 50) : m.tradesPerYr >= 50, opts.lowFreq ? `T ${m.n} ≥ ${minTotal} (daily/4h) or ${f(m.tradesPerYr, 0)}/yr ≥ 50` : `${f(m.tradesPerYr, 0)}/yr ≥ 50`],
    [Math.sign(m.h1.exp) === Math.sign(m.h2.exp) && m.h1.exp >= 0.10 && m.h2.exp >= 0.10, `halves ${sgn(m.h1.exp, 3)} / ${sgn(m.h2.exp, 3)} same sign, each ≥ +0.10`],
    [Number.isFinite(m.top5Share) && m.top5Share <= 30, `top-5 share ${f(m.top5Share, 0)}% ≤ 30%`],
    [!opts.multiCoin || m.coinsPosPct >= 55, `coins positive ${m.coinsPos}/${m.coinsTotal} (${f(m.coinsPosPct, 0)}%) ≥ 55%`],
    [expSlip15 >= 0.10, `exp @ +15 bps ${sgn(expSlip15, 3)} ≥ +0.10`],
  ];
  const accFail = acc.filter(([ok]) => !ok).map(([, why]) => `✗ ${why}`);
  if (!accFail.length) return { verdict: "ACCEPT-LIVE-CANDIDATE", reasons: acc.map(([, why]) => `✓ ${why}`) };
  reasons.push(`ACCEPT failed: ${accFail.join("; ")}`);
  const pap: Array<[boolean, string]> = [
    [m.exp >= 0.15, `exp ${sgn(m.exp, 3)} ≥ +0.15`],
    [m.pf >= 1.15, `PF ${f(m.pf)} ≥ 1.15`],
    [m.ciLo > -0.05, `CI95 lo ${sgn(m.ciLo, 3)} > −0.05`],
    [m.h1.exp > 0 && m.h2.exp > 0, `halves ${sgn(m.h1.exp, 3)} / ${sgn(m.h2.exp, 3)} both > 0`],
    [m.tradesPerYr >= 30, `${f(m.tradesPerYr, 0)}/yr ≥ 30`],
  ];
  const papFail = pap.filter(([ok]) => !ok).map(([, why]) => `✗ ${why}`);
  if (!papFail.length) { reasons.push("PAPER criteria all met"); return { verdict: "PAPER-CANDIDATE", reasons }; }
  reasons.push(`PAPER failed: ${papFail.join("; ")}`);
  return { verdict: "REJECT", reasons };
}

// ── Reporting ───────────────────────────────────────────────────────────────
function rowStr(m: Metrics): string {
  return `T=${String(m.n).padStart(4)} WR=${f(m.wr, 0).padStart(3)}% PF=${f(m.pf).padStart(5)} sumR=${sgn(m.sumR, 1).padStart(7)} exp=${sgn(m.exp, 3)} CI95=[${sgn(m.ciLo, 3)}, ${sgn(m.ciHi, 3)}] maxDD=${f(m.maxDD, 1)}R`;
}
function detailStr(m: Metrics): string {
  return `H1 T=${m.h1.n} exp=${sgn(m.h1.exp, 3)} PF=${f(m.h1.pf)} | H2 T=${m.h2.n} exp=${sgn(m.h2.exp, 3)} PF=${f(m.h2.pf)} | top5=${f(m.top5Share, 0)}% | coins+ ${m.coinsPos}/${m.coinsTotal} (${f(m.coinsPosPct, 0)}%) | ${f(m.tradesPerYr, 0)} tr/yr, ${sgn(m.rPerYr, 1)} R/yr over ${f(m.spanYrs, 1)}y | hold avg ${f(m.avgHoldDays, 1)}d med ${f(m.medHoldDays, 1)}d | L/S ${m.longN}/${m.shortN}${m.fundingRTotal ? ` | funding −${f(m.fundingRTotal, 1)}R` : ""}`;
}
const pack = (m: Metrics) => ({ trades: m.n, exp: +m.exp.toFixed(4), pf: +m.pf.toFixed(3), sumR: +m.sumR.toFixed(1), ci_low: +m.ciLo.toFixed(4), ci_high: +m.ciHi.toFixed(4), maxDD: +m.maxDD.toFixed(1), half1_exp: +m.h1.exp.toFixed(4), half1_n: m.h1.n, half2_exp: +m.h2.exp.toFixed(4), half2_n: m.h2.n, top5_share_pct: +m.top5Share.toFixed(1), coins_positive_pct: +m.coinsPosPct.toFixed(1), coins_pos: m.coinsPos, coins_total: m.coinsTotal, trades_per_yr: +m.tradesPerYr.toFixed(1), r_per_yr: +m.rPerYr.toFixed(1), span_yrs: +m.spanYrs.toFixed(2), wr: +m.wr.toFixed(1), long: m.longN, short: m.shortN });
function windowed(trades: SimTrade[], from: number, to = Number.MAX_SAFE_INTEGER): SimTrade[] { return trades.filter(t => t.openedSec >= from && t.openedSec < to); }

async function main() {
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — ADVERSARIAL REVIEW (statistics) of the T2b verdict in phase9-report-tsmom.md — ${new Date().toISOString().slice(0, 10)}`);
  L(`pipeline copied from phase9-tsmom.ts · data pinned to snapshot ${SNAPSHOT_DAY_KEY} · capital $${START_CAPITAL} @ ${BASE_RISK_PCT}% · exits ${JSON.stringify(ENGINE_EXIT)} · honest entry · fees 0.05% + slip 0.05%/side`);
  L("");

  // ── Data ──────────────────────────────────────────────────────────────────
  // NOTE: the working-tree registry was changed by the lead after the run under review (B&R/RSI retired,
  // tsmom added) — import the two strategies directly so the review replays the researcher's registry.
  const br: Strategy = breakRetestStrategy, rsi: Strategy = rsiDivergenceStrategy;
  const nonLS: Strategy[] = [br, rsi];
  const br40: Strategy = { ...br, preferredSymbols: [...UNIVERSE] };
  const rsi40: Strategy = { ...rsi, preferredSymbols: [...UNIVERSE] };
  const streams = new Map<string, OHLCV[]>();
  const dailyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) {
    try { const c = await loadSeries(sym, "1d", DAILY_CANDLES); streams.set(`${sym}:1d`, c); dailyBySym.set(sym, c); } catch (e: any) { console.error(`1d ${sym}: ${e?.message ?? e}`); }
    try { streams.set(`${sym}:4h`, await loadSeries(sym, "4h", FOURH_CANDLES)); } catch (e: any) { console.error(`4h ${sym}: ${e?.message ?? e}`); }
    try { streams.set(`${sym}:1h`, await loadSeries(sym, "1h", ONEH_CANDLES)); } catch (e: any) { console.error(`1h ${sym}: ${e?.message ?? e}`); }
  }
  const btcDaily = await loadSeries("BTC", "1d", DAILY_CANDLES);
  const btcWeekly = await loadSeries("BTC", "1w", 400);
  const weeklyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) { try { weeklyBySym.set(sym, await loadSeries(sym, "1w", 400)); } catch (e: any) { console.error(`1w ${sym}: ${e?.message ?? e}`); } }
  const md: MarketData = { btcDaily, btcWeekly, dailyBySym, weeklyBySym };
  L(`## Data`);
  L(`  ${fetchLog.length ? `NOT in snapshot cache (fetched live, numbers may drift): ${fetchLog.join(", ")}` : `all series read from the ${SNAPSHOT_DAY_KEY} snapshot cache`}`);
  const dSpan = (k: string) => { const c = streams.get(k); return c ? `${new Date(c[0].time * 1000).toISOString().slice(0, 10)}→${new Date(c[c.length - 1].time * 1000).toISOString().slice(0, 10)} (${c.length})` : "—"; };
  L(`  BTC:1d ${dSpan("BTC:1d")} · SOL:4h ${dSpan("SOL:4h")} · ATOM:1h ${dSpan("ATOM:1h")}`);
  L("");

  // ── Pools ─────────────────────────────────────────────────────────────────
  const TS = makeTsmom("tsmom", 55, 2.0);
  const buildPool = (strats: Strategy[]): Cand[] => {
    const out: Cand[] = [];
    for (const s of strats) for (const sym of s.preferredSymbols ?? []) { const c = streams.get(`${sym}:${s.interval}`); if (c) out.push(...buildCandidates(s, sym, c)); }
    out.forEach((c, i) => { c.idx = i; });
    return out;
  };
  const pools = new Map<string, Cand[]>();
  pools.set("core", buildPool(nonLS));
  pools.set("core+tsmom", buildPool([...nonLS, TS]));
  pools.set("br40", buildPool([br40]));
  pools.set("rsi40", buildPool([rsi40]));
  pools.set("core40", buildPool([br40, rsi40]));
  pools.set("core40+tsmom", buildPool([br40, rsi40, TS]));
  L(`## Candidate pools (post minSL 0.6% + R:R 1.5 gates)`);
  for (const [k, v] of pools) {
    const byStrat = new Map<string, number>();
    for (const c of v) byStrat.set(c.stratId, (byStrat.get(c.stratId) ?? 0) + 1);
    L(`  ${k.padEnd(14)} ${String(v.length).padStart(6)}  ${[...byStrat.entries()].map(([s, n]) => `${s}=${n}`).join(" ")}`);
  }
  L("");

  // engine tie-break order: paperScan iterates coins in SCANNER_COINS order (registry flatMap of preferredSymbols:
  // B&R list, RSI list, LS list — TSMOM's list is the LS list) and, within a coin, strategies in registry order.
  const scannerOrder: string[] = [];
  for (const s of [...nonLS, liquiditySweepStrategy]) for (const sym of s.preferredSymbols ?? []) if (!scannerOrder.includes(sym)) scannerOrder.push(sym);
  const coinIdx = new Map(scannerOrder.map((s, i) => [s, i]));
  const stratIdx = new Map<string, number>([["break-retest", 0], ["rsi-divergence", 1], ["tsmom", 2]]);
  const engineKey = (c: Cand) => (coinIdx.get(c.symbol) ?? 999) * 10 + (stratIdx.get(c.stratId) ?? 9);
  const reverseKey = (c: Cand) => -(UNIVERSE.slice().sort().indexOf(c.symbol));

  const allStrats: Strategy[] = [...nonLS, TS];
  const SLIP: Partial<EntryModel> = { driftBps: 15, fundingPctPerDay: FUNDING_PCT_PER_DAY };
  const arms: Arm[] = [
    { tag: "R0", label: "R0 reproduce T2a — B&R + RSI (preferred lists), A→Z", pool: "core" },
    { tag: "R1", label: "R1 reproduce T2b — B&R + RSI + TSMOM, A→Z", pool: "core+tsmom" },
    { tag: "R2", label: "R2 reproduce T2c — T2b + 15 bps + funding (all strategies)", pool: "core+tsmom", entry: SLIP },
    { tag: "R3", label: "R3 T2b with ENGINE tie-break order (SCANNER_COINS, then registry strategy order)", pool: "core+tsmom", orderKey: engineKey },
    { tag: "R3", label: "R3 T2b ENGINE order + 15 bps + funding", pool: "core+tsmom", orderKey: engineKey, entry: SLIP },
    { tag: "R4", label: "R4 T2b with Z→A order", pool: "core+tsmom", orderKey: reverseKey },
    { tag: "R4", label: "R4 T2b Z→A + 15 bps + funding", pool: "core+tsmom", orderKey: reverseKey, entry: SLIP },
    { tag: "R6", label: "R6 SELECTION-BIAS RULE — B&R ×40 alone (same params, engine gates)", pool: "br40" },
    { tag: "R6", label: "R6 SELECTION-BIAS RULE — B&R ×40 + 15 bps", pool: "br40", entry: { driftBps: 15 } },
    { tag: "R6", label: "R6 SELECTION-BIAS RULE — RSI ×40 alone (same params, engine gates)", pool: "rsi40" },
    { tag: "R6", label: "R6 SELECTION-BIAS RULE — RSI ×40 + 15 bps", pool: "rsi40", entry: { driftBps: 15 } },
    { tag: "R7", label: "R7 portfolio core40 — B&R ×40 + RSI ×40 (no TSMOM)", pool: "core40" },
    { tag: "R7", label: "R7 portfolio core40 + TSMOM — B&R ×40 + RSI ×40 + TSMOM", pool: "core40+tsmom" },
    { tag: "R7", label: "R7 portfolio core40 + TSMOM + 15 bps + funding", pool: "core40+tsmom", entry: SLIP },
  ];
  const results = new Map<string, SimOut>();
  const report = (arm: Arm, r: SimOut, sleeves = true) => {
    const mAll = metrics(r.trades);
    L(`## ${arm.label}`);
    L(`  ALL   ${rowStr(mAll)}  balDD=${f(r.maxDDpct, 1)}%  candidates=${r.candidates}`);
    L(`        ${detailStr(mAll)}`);
    L(`  2026  ${rowStr(metrics(windowed(r.trades, YEAR_2026_TS)))}`);
    if (sleeves) for (const sid of [...new Set(r.trades.map(t => t.strategy))].sort()) {
      const ms = metrics(r.trades.filter(t => t.strategy === sid));
      L(`  sleeve ${sid.padEnd(14)} ${rowStr(ms)}`);
      L(`        ${detailStr(ms)}`);
    }
    L(`  blocks: ${Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ") || "none"}`);
    L("");
    return mAll;
  };
  const M = new Map<string, Metrics>();
  for (const arm of arms) {
    const r = simulate(arm, pools.get(arm.pool)!, streams, md, allStrats);
    results.set(arm.label, r);
    M.set(arm.label, report(arm, r));
  }

  // ── Reproduction check against the report under review ──────────────────
  const claimed = { trades: 499, exp: 0.192, pf: 1.33, ci_low: 0.061, ci_high: 0.327, half1_exp: 0.202, half2_exp: 0.181, top5_share_pct: 23, coins_positive_pct: 68, exp_slip15: 0.125, maxDD: 23.8 };
  const r1 = M.get(arms[1].label)!, r2 = M.get(arms[2].label)!, r0 = M.get(arms[0].label)!;
  L(`## Reproduction of the T2b headline (claimed → recomputed)`);
  const cmp = (name: string, a: number, b: number, tol: number) => L(`  ${name.padEnd(18)} ${String(a).padStart(8)} → ${f(b, 3).padStart(8)}  ${Math.abs(a - b) <= tol ? "OK" : "MISMATCH"}`);
  cmp("trades", claimed.trades, r1.n, 0);
  cmp("exp", claimed.exp, r1.exp, 0.001);
  cmp("PF", claimed.pf, r1.pf, 0.006);
  cmp("CI lo", claimed.ci_low, r1.ciLo, 0.001);
  cmp("CI hi", claimed.ci_high, r1.ciHi, 0.001);
  cmp("half1 exp", claimed.half1_exp, r1.h1.exp, 0.001);
  cmp("half2 exp", claimed.half2_exp, r1.h2.exp, 0.001);
  cmp("top5 %", claimed.top5_share_pct, r1.top5Share, 0.6);
  cmp("coins+ %", claimed.coins_positive_pct, r1.coinsPosPct, 0.6);
  cmp("maxDD R", claimed.maxDD, r1.maxDD, 0.06);
  cmp("exp @15bps+fund", claimed.exp_slip15, r2.exp, 0.001);
  const vB = verdict(r1, r2.exp, { multiCoin: true, lowFreq: false });
  L(`  literal verdict recomputed: **${vB.verdict}** — ${vB.reasons.join(" | ")}`);
  L(`  H2 (sumR up AND maxDD(R) down vs T2a): sumR ${sgn(r0.sumR, 1)} → ${sgn(r1.sumR, 1)}, maxDD ${f(r0.maxDD, 1)}R → ${f(r1.maxDD, 1)}R → ${r1.sumR > r0.sumR && r1.maxDD < r0.maxDD ? "SUPPORTED" : "NOT SUPPORTED"}`);
  L("");

  // ── R5: tie-break seeds with the FULL literal verdict per seed ───────────
  L(`## R5 — T2b over 20 random same-timestamp orders: literal verdict per seed (each seed's +15 bps + funding arm supplies the slip criterion)`);
  const seedRows: Array<{ seed: number; m: ReturnType<typeof pack>; slip15: number; verdict: Verdict }> = [];
  const base = arms[1];
  for (let seed = 1; seed <= 20; seed++) {
    const r = simulate({ ...base, label: `${base.label} seed${seed}`, seed }, pools.get("core+tsmom")!, streams, md, allStrats);
    const rs = simulate({ ...base, label: `${base.label} seed${seed} slip`, seed, entry: SLIP }, pools.get("core+tsmom")!, streams, md, allStrats);
    const m = metrics(r.trades), ms = metrics(rs.trades);
    const v = verdict(m, ms.exp, { multiCoin: true, lowFreq: false });
    seedRows.push({ seed, m: pack(m), slip15: +ms.exp.toFixed(4), verdict: v.verdict });
    L(`  seed ${String(seed).padStart(2)}: ${rowStr(m)} H1/H2 ${sgn(m.h1.exp, 3)}/${sgn(m.h2.exp, 3)} top5=${f(m.top5Share, 0)}% coins+ ${f(m.coinsPosPct, 0)}% slip15=${sgn(ms.exp, 3)} → ${v.verdict}`);
  }
  const nPaper = seedRows.filter(x => x.verdict === "PAPER-CANDIDATE").length, nAccept = seedRows.filter(x => x.verdict === "ACCEPT-LIVE-CANDIDATE").length, nReject = seedRows.filter(x => x.verdict === "REJECT").length;
  const seedExp = seedRows.map(x => x.m.exp).sort((a, b) => a - b);
  L(`  summary: PAPER-CANDIDATE ${nPaper}/20 · ACCEPT ${nAccept}/20 · REJECT ${nReject}/20 · exp min/med/max ${sgn(seedExp[0], 3)}/${sgn(median(seedExp), 3)}/${sgn(seedExp[19], 3)} · exp ≥ 0.15 in ${seedExp.filter(e => e >= 0.15).length}/20 · PF ≥ 1.15 in ${seedRows.filter(x => x.m.pf >= 1.15).length}/20 · CI lo > −0.05 in ${seedRows.filter(x => x.m.ci_low > -0.05).length}/20 · default A→Z exp ${sgn(r1.exp, 3)} sits at percentile ${f(100 * seedExp.filter(e => e < r1.exp).length / 20, 0)} of the seed distribution`);
  const eng = M.get(arms[3].label)!, engS = M.get(arms[4].label)!, rev = M.get(arms[5].label)!, revS = M.get(arms[6].label)!;
  const vEng = verdict(eng, engS.exp, { multiCoin: true, lowFreq: false }), vRev = verdict(rev, revS.exp, { multiCoin: true, lowFreq: false });
  L(`  ENGINE order: exp ${sgn(eng.exp, 3)} PF ${f(eng.pf)} CI [${sgn(eng.ciLo, 3)}, ${sgn(eng.ciHi, 3)}] halves ${sgn(eng.h1.exp, 3)}/${sgn(eng.h2.exp, 3)} slip15+fund ${sgn(engS.exp, 3)} → **${vEng.verdict}** (${vEng.reasons.join(" | ")})`);
  L(`  Z→A order:    exp ${sgn(rev.exp, 3)} PF ${f(rev.pf)} CI [${sgn(rev.ciLo, 3)}, ${sgn(rev.ciHi, 3)}] halves ${sgn(rev.h1.exp, 3)}/${sgn(rev.h2.exp, 3)} slip15+fund ${sgn(revS.exp, 3)} → **${vRev.verdict}** (${vRev.reasons.join(" | ")})`);
  L("");

  // ── R6/R7: selection-bias rule ────────────────────────────────────────────
  const b40 = M.get(arms[7].label)!, b40s = M.get(arms[8].label)!, s40 = M.get(arms[9].label)!, s40s = M.get(arms[10].label)!;
  const c40 = M.get(arms[11].label)!, c40t = M.get(arms[12].label)!, c40ts = M.get(arms[13].label)!;
  L(`## R6 — SELECTION-BIAS RULE (pre-registered: hand-picked list must ALSO reach exp ≥ +0.15 on the 40-coin universe, else the preferred-coin result is an artefact → REJECT)`);
  L(`  B&R ×40: exp ${sgn(b40.exp, 3)} PF ${f(b40.pf)} T=${b40.n} CI [${sgn(b40.ciLo, 3)}, ${sgn(b40.ciHi, 3)}] coins+ ${b40.coinsPos}/${b40.coinsTotal} · +15 bps ${sgn(b40s.exp, 3)} → ${b40.exp >= 0.15 ? "PASSES" : "**FAILS** the rule"}`);
  L(`  RSI ×40: exp ${sgn(s40.exp, 3)} PF ${f(s40.pf)} T=${s40.n} CI [${sgn(s40.ciLo, 3)}, ${sgn(s40.ciHi, 3)}] coins+ ${s40.coinsPos}/${s40.coinsTotal} · +15 bps ${sgn(s40s.exp, 3)} → ${s40.exp >= 0.15 ? "PASSES" : "**FAILS** the rule"}`);
  const vC40t = verdict(c40t, c40ts.exp, { multiCoin: true, lowFreq: false });
  L(`## R7 — the same portfolio with the core on the 40-coin universe (what T2b looks like without the hand-pick)`);
  L(`  core40 alone:        ${rowStr(c40)}`);
  L(`  core40 + TSMOM:      ${rowStr(c40t)}  halves ${sgn(c40t.h1.exp, 3)}/${sgn(c40t.h2.exp, 3)} top5 ${f(c40t.top5Share, 0)}% coins+ ${f(c40t.coinsPosPct, 0)}% slip15+fund ${sgn(c40ts.exp, 3)} → **${vC40t.verdict}** (${vC40t.reasons.join(" | ")})`);
  L("");

  // ── R8: common window (all three sleeves exist) ──────────────────────────
  const rsiStart = streams.get("ATOM:1h")![0].time;
  const b = results.get(arms[1].label)!, bS = results.get(arms[2].label)!, a = results.get(arms[0].label)!;
  const mbR = metrics(windowed(b.trades, rsiStart)), mbRS = metrics(windowed(bS.trades, rsiStart)), maR = metrics(windowed(a.trades, rsiStart));
  const vR8 = verdict(mbR, mbRS.exp, { multiCoin: true, lowFreq: false });
  L(`## R8 — T2b restricted to the window where all three sleeves exist (entries ≥ ${isoDay(rsiStart)}, first RSI 1h candle)`);
  L(`  T2b   ${rowStr(mbR)}`);
  L(`        ${detailStr(mbR)}`);
  L(`  T2a   ${rowStr(maR)}  (H2 in this window: sumR ${sgn(maR.sumR, 1)} → ${sgn(mbR.sumR, 1)}, maxDD ${f(maR.maxDD, 1)}R → ${f(mbR.maxDD, 1)}R)`);
  L(`  +15 bps + funding: exp ${sgn(mbRS.exp, 3)} CI [${sgn(mbRS.ciLo, 3)}, ${sgn(mbRS.ciHi, 3)}]`);
  L(`  literal verdict on this window: **${vR8.verdict}** — ${vR8.reasons.join(" | ")}`);
  L("");

  // ── R9: cluster bootstrap ────────────────────────────────────────────────
  const cbDay = clusterBootstrapCI(b.trades, t => isoDay(t.openedSec)), cbWeek = clusterBootstrapCI(b.trades, t => isoWeek(t.openedSec));
  const cbDayS = clusterBootstrapCI(bS.trades, t => isoDay(t.openedSec)), cbWeekS = clusterBootstrapCI(bS.trades, t => isoWeek(t.openedSec));
  const cbDayR = clusterBootstrapCI(windowed(b.trades, rsiStart), t => isoDay(t.openedSec)), cbWeekR = clusterBootstrapCI(windowed(b.trades, rsiStart), t => isoWeek(t.openedSec));
  // same-day sign agreement as a rough dependence check
  let pairs = 0, agree = 0;
  { const byDay = new Map<string, number[]>(); for (const t of b.trades) byDay.set(isoDay(t.openedSec), [...(byDay.get(isoDay(t.openedSec)) ?? []), t.netR]);
    for (const rs of byDay.values()) for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { pairs++; if (Math.sign(rs[i]) === Math.sign(rs[j])) agree++; } }
  L(`## R9 — cluster bootstrap CI95 (10k) for T2b: trades are not i.i.d. (same-day pairs agree in sign ${f(100 * agree / Math.max(1, pairs), 0)}% of ${pairs} pairs; independent trades at WR ${f(r1.wr, 0)}% would agree ${f(100 * ((r1.wr / 100) ** 2 + (1 - r1.wr / 100) ** 2), 0)}%)`);
  L(`  trade-level (as reported):  [${sgn(r1.ciLo, 3)}, ${sgn(r1.ciHi, 3)}]`);
  L(`  entry-day clusters (${cbDay.clusters}):   [${sgn(cbDay.lo, 3)}, ${sgn(cbDay.hi, 3)}]   PAPER bar (lo > −0.05): ${cbDay.lo > -0.05 ? "met" : "NOT met"} · ACCEPT bar (lo > 0): ${cbDay.lo > 0 ? "met" : "NOT met"}`);
  L(`  entry-week clusters (${cbWeek.clusters}):  [${sgn(cbWeek.lo, 3)}, ${sgn(cbWeek.hi, 3)}]   PAPER bar: ${cbWeek.lo > -0.05 ? "met" : "NOT met"} · ACCEPT bar: ${cbWeek.lo > 0 ? "met" : "NOT met"}`);
  L(`  +15 bps + funding — day clusters [${sgn(cbDayS.lo, 3)}, ${sgn(cbDayS.hi, 3)}] · week clusters [${sgn(cbWeekS.lo, 3)}, ${sgn(cbWeekS.hi, 3)}]`);
  L(`  common window (R8) — day clusters [${sgn(cbDayR.lo, 3)}, ${sgn(cbDayR.hi, 3)}] · week clusters [${sgn(cbWeekR.lo, 3)}, ${sgn(cbWeekR.hi, 3)}]`);
  L("");

  // ── R10: sleeve decomposition + halves sensitivity + per-year ────────────
  const bTs = b.trades.filter(t => t.strategy === "tsmom"), bCore = b.trades.filter(t => t.strategy !== "tsmom");
  const mTs = metrics(bTs), mCore = metrics(bCore);
  L(`## R10 — where the T2b expectancy comes from`);
  L(`  TSMOM sleeve in-book: T=${mTs.n} sumR ${sgn(mTs.sumR, 1)} exp ${sgn(mTs.exp, 3)} PF ${f(mTs.pf)} CI [${sgn(mTs.ciLo, 3)}, ${sgn(mTs.ciHi, 3)}] halves ${sgn(mTs.h1.exp, 3)}/${sgn(mTs.h2.exp, 3)}`);
  L(`  core sleeve in-book (B&R+RSI, hand-picked coins): T=${mCore.n} sumR ${sgn(mCore.sumR, 1)} exp ${sgn(mCore.exp, 3)} PF ${f(mCore.pf)} CI [${sgn(mCore.ciLo, 3)}, ${sgn(mCore.ciHi, 3)}]`);
  L(`  portfolio exp ${sgn(r1.exp, 3)} = (${sgn(mTs.sumR, 1)} + ${sgn(mCore.sumR, 1)}) / ${r1.n}; the core sleeve lifts the book from the TSMOM-only ${sgn(mTs.exp, 3)} by ${sgn(r1.exp - mTs.exp, 3)}R/trade`);
  L(`  POST-HOC hypothetical: if the hand-picked core has zero true expectancy (R6), the book's exp is ≈ ${sgn(mTs.sumR / r1.n, 3)} (TSMOM sumR over all ${r1.n} slots) — ${mTs.sumR / r1.n >= 0.15 ? "still ≥ +0.15" : "BELOW the +0.15 PAPER bar"}`);
  // count-median halves
  const sorted = [...b.trades].sort((x, y) => x.openedSec - y.openedSec);
  const hA = stats(sorted.slice(0, Math.floor(sorted.length / 2)).map(t => t.netR)), hB = stats(sorted.slice(Math.floor(sorted.length / 2)).map(t => t.netR));
  L(`  halves by TIME midpoint (as reported): H1 T=${r1.h1.n} ${sgn(r1.h1.exp, 3)} / H2 T=${r1.h2.n} ${sgn(r1.h2.exp, 3)} · by TRADE-COUNT median: H1 T=${hA.n} ${sgn(hA.exp, 3)} / H2 T=${hB.n} ${sgn(hB.exp, 3)}`);
  const byYear = new Map<string, SimTrade[]>();
  for (const t of b.trades) { const y = isoDay(t.openedSec).slice(0, 4); byYear.set(y, [...(byYear.get(y) ?? []), t]); }
  L(`  by year: ` + [...byYear.entries()].sort().map(([y, ts]) => { const s = stats(ts.map(t => t.netR)); const st = stats(ts.filter(t => t.strategy === "tsmom").map(t => t.netR)); const sc = stats(ts.filter(t => t.strategy !== "tsmom").map(t => t.netR)); return `${y}: T=${s.n} ${sgn(s.sumR, 1)}R exp ${sgn(s.exp, 2)} (tsmom ${sgn(st.sumR, 1)}/${st.n}, core ${sgn(sc.sumR, 1)}/${sc.n})`; }).join(" | "));
  const top = [...b.trades].sort((x, y) => y.netR - x.netR).slice(0, 5);
  L(`  top-5 trades: ${top.map(t => `${t.symbol} ${t.strategy} ${t.dir} ${isoDay(t.openedSec)} ${sgn(t.netR, 2)}R`).join("  ")} = ${f(100 * top.reduce((s, t) => s + t.netR, 0) / r1.sumR, 0)}% of sumR`);
  L("");

  // ── Review verdict ────────────────────────────────────────────────────────
  L(`## Review findings (statistics lens)`);
  L(`1. Reproduction: the T2b headline numbers ${[r1.n === claimed.trades, Math.abs(r1.exp - claimed.exp) <= 0.001, Math.abs(r1.ciLo - claimed.ci_low) <= 0.001].every(Boolean) ? "reproduce exactly" : "do NOT reproduce"} from the same pipeline and data snapshot; the literal verdict function returns ${vB.verdict}.`);
  L(`2. Criterion waived: the pre-registered SELECTION-BIAS RULE applies to "every component and portfolio"; the report states it was "NOT tested here" for B&R/RSI and issued the PAPER verdict anyway. Applied here: B&R ×40 exp ${sgn(b40.exp, 3)}, RSI ×40 exp ${sgn(s40.exp, 3)} — both ${b40.exp < 0.15 && s40.exp < 0.15 ? "FAIL" : "do not both fail"} the ≥ +0.15 bar, so the core sleeve's in-book +${f(mCore.sumR, 1)}R (exp ${sgn(mCore.exp, 3)}) is a selection artefact by the pre-registered definition. With the core on the 40-coin universe the same book is exp ${sgn(c40t.exp, 3)} (${vC40t.verdict}); without the core's contribution TSMOM's ${sgn(mTs.sumR, 1)}R over ${r1.n} slots is ${sgn(mTs.sumR / r1.n, 3)}R/trade.`);
  L(`3. Tie-break fragility: the A→Z order is not the engine's order. Engine order gives ${vEng.verdict} (exp ${sgn(eng.exp, 3)}); across 20 random orders the literal verdict is PAPER-CANDIDATE in ${nPaper}/20 and REJECT in ${nReject}/20 (exp median ${sgn(median(seedExp), 3)}); the reported +0.192 is at the ${f(100 * seedExp.filter(e => e < r1.exp).length / 20, 0)}th percentile of that distribution.`);
  L(`4. CI: the trade-level bootstrap treats ${r1.n} trades as i.i.d.; same-day entries across 40 coins agree in sign ${f(100 * agree / Math.max(1, pairs), 0)}% of the time. Entry-week cluster bootstrap CI95 = [${sgn(cbWeek.lo, 3)}, ${sgn(cbWeek.hi, 3)}] (${cbWeek.lo > -0.05 ? "PAPER bar still met" : "PAPER bar NOT met"}; ACCEPT bar ${cbWeek.lo > 0 ? "met" : "not met"}).`);
  L(`5. Halves: time-midpoint halves ${sgn(r1.h1.exp, 3)}/${sgn(r1.h2.exp, 3)}; count-median halves ${sgn(hA.exp, 3)}/${sgn(hB.exp, 3)}. In the only window where all three sleeves exist (${isoDay(rsiStart)}→) the book is exp ${sgn(mbR.exp, 3)} CI [${sgn(mbR.ciLo, 3)}, ${sgn(mbR.ciHi, 3)}] halves ${sgn(mbR.h1.exp, 3)}/${sgn(mbR.h2.exp, 3)} → ${vR8.verdict}.`);
  L(`6. H2 was correctly reported NOT SUPPORTED (maxDD(R) rises ${f(r0.maxDD, 1)} → ${f(r1.maxDD, 1)}); the top-5 (${f(r1.top5Share, 0)}%) and breadth (${r1.coinsPos}/${r1.coinsTotal}) figures reproduce and are not at issue.`);
  L("");

  const out = {
    reproduction: { claimed, recomputed: { ...pack(r1), exp_slip15_fund: +r2.exp.toFixed(4) }, verdict: vB },
    R0_T2a: pack(r0), R1_T2b: pack(r1), R2_T2c: pack(r2),
    R3_engine_order: { ...pack(eng), slip15_fund: +engS.exp.toFixed(4), verdict: vEng.verdict },
    R4_reverse_order: { ...pack(rev), slip15_fund: +revS.exp.toFixed(4), verdict: vRev.verdict },
    R5_seeds: { rows: seedRows, paper: nPaper, accept: nAccept, reject: nReject, exp_median: +median(seedExp).toFixed(4), exp_min: +seedExp[0].toFixed(4), exp_max: +seedExp[19].toFixed(4) },
    R6_selection_bias: { br40: { ...pack(b40), slip15: +b40s.exp.toFixed(4), passes: b40.exp >= 0.15 }, rsi40: { ...pack(s40), slip15: +s40s.exp.toFixed(4), passes: s40.exp >= 0.15 } },
    R7_core40: { core40: pack(c40), core40_tsmom: { ...pack(c40t), slip15_fund: +c40ts.exp.toFixed(4), verdict: vC40t.verdict } },
    R8_common_window: { from: isoDay(rsiStart), T2b: pack(mbR), T2a: pack(maR), slip15_fund: +mbRS.exp.toFixed(4), verdict: vR8.verdict },
    R9_cluster_ci: { trade_level: [r1.ciLo, r1.ciHi], day: cbDay, week: cbWeek, slip_day: cbDayS, slip_week: cbWeekS, common_day: cbDayR, common_week: cbWeekR, same_day_sign_agreement_pct: +(100 * agree / Math.max(1, pairs)).toFixed(1), pairs },
    R10_decomposition: { tsmom_sleeve: pack(mTs), core_sleeve: pack(mCore), tsmom_over_all_slots: +(mTs.sumR / r1.n).toFixed(4), halves_count_median: [+hA.exp.toFixed(4), +hB.exp.toFixed(4)] },
  };
  writeFileSync("script/.cache/phase9-review-tsmom-portfolio-summary.json", JSON.stringify(out, null, 1));
  writeFileSync("script/.cache/phase9-review-tsmom-portfolio-trades.json", JSON.stringify({ T2a: a.trades, T2b: b.trades, T2c: bS.trades, core40_tsmom: results.get(arms[12].label)!.trades }));
  const outPath = "script/audit/phase9-report-review-tsmom-portfolio.md";
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[report written to ${outPath}; summary in script/.cache/phase9-review-tsmom-portfolio-summary.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
