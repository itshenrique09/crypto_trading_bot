// ─── AUDIT PHASE 9 — ADVERSARIAL REVIEW (statistics lens) of phase9-tsmom.ts T0 verdict ──
// Reviewer script. Lines up to main() are copied from script/audit/phase9-tsmom.ts (same
// candidates / exits / portfolio sim) with ONE addition: Arm.orderIdx lets the same-timestamp
// tie-break follow an explicit symbol order (engine scan order, Z→A) instead of A→Z.
// Everything here is diagnostic of the T0 verdict; nothing is promoted.
// Run: npx tsx script/audit/phase9-review-tsmom-stats.ts   (uses today's 1d cache only)
//
import { writeFileSync, readFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
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

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const START_CAPITAL = parseFloat(argv.capital ?? "1000");   // paper params ($1000 @ 1%)
const BASE_RISK_PCT = parseFloat(argv.risk ?? "1");
const DAILY_CANDLES = 1500;
const FOURH_CANDLES = 8000;
const ONEH_CANDLES = 20000;
const FUNDING_PCT_PER_DAY = 0.03 / 100;   // H3 cost arm: perp funding on multi-week holds
const UNIVERSE: string[] = [...(liquiditySweepStrategy.preferredSymbols ?? [])];

// ── TSMOM prototype (verbatim from phase6-tsmom.ts) ─────────────────────────
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
      const lookback = candles.slice(n - 1 - donchianN, n - 1); // prior N days, excludes signal day
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

// ── Candidates ──────────────────────────────────────────────────────────────
interface Cand {
  stratId: string; interval: string; symbol: string;
  tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number;
  /** Close of the SIGNAL candle — the price the engine can actually act on. */
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
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;      // engine gate
    if (risk <= 0 || reward / risk < MIN_RR) continue;  // engine gate
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

// ── Exit resolution — HONEST entry model (phase8 "honest") + optional cost arms ─
// entry = SIGNAL candle close × (1 ± driftBps) — SL/TP stay structural; the trade is
// re-gated on the real entry (stop ≥ 0.6%, R:R ≥ minRR); position right-sized so the
// planned $risk is kept → netR is per planned risk (what liveScan does).
// fundingPctPerDay: perp funding drag charged on the FULL position for the whole hold
// (conservative: ignores the 60% TP1 reduction), converted to R via the real stop distance.
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

// ── Portfolio simulation (parameterized ENGINE-CURRENT, from phase8-collapse.ts) ─
interface Arm {
  label: string; tag: string;
  pool: string;                                  // named candidate pool
  strategies?: string[];
  dirOnly?: "LONG" | "SHORT";
  daily?: number | null; rolling?: number | null; ksMin?: number; ksMax?: number | null; // guards (null = off)
  maxOpen?: number; marginLeverage?: number;
  entry?: Partial<EntryModel>;
  capital?: number; riskPct?: number;
  /** POST-HOC: shuffle the order of same-timestamp candidates (default = symbol order, like the engine's scan order is arbitrary). */
  seed?: number;
  /** REVIEW: explicit same-timestamp tie-break order (symbol → rank); default A→Z. */
  orderIdx?: Map<string, number>;
  /** POST-HOC: per-strategy cap on simultaneously open positions (sleeve slot cap). */
  sleeveCap?: Record<string, number>;
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
    .filter(c => !arm.dirOnly || c.dir === arm.dirOnly)
    .sort((a, b) => a.tsSec - b.tsSec || (arm.orderIdx ? (arm.orderIdx.get(a.symbol) ?? 999) - (arm.orderIdx.get(b.symbol) ?? 999) : a.symbol.localeCompare(b.symbol)));
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
  const startCapital = arm.capital ?? START_CAPITAL;
  const baseRiskPct = arm.riskPct ?? BASE_RISK_PCT;

  let balance = startCapital, peak = startCapital, maxDD = 0, openNotional = 0;
  interface OpenPos { strategy: string; group?: string; exitTsSec: number; notionalUsd: number; trade: SimTrade }
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
        openNotional = Math.max(0, openNotional - pos.notionalUsd);
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
    const oneR = balance * baseRiskPct / 100;

    if (dailyR != null) {
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -dailyR * oneR) { block("ddDaily"); continue; }
    }
    if (rollingR != null && isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: rollingR, now: nowMs })) { block("ddRolling7d"); continue; }

    if (totalOpen() >= maxOpen) { block("maxOpen"); continue; }
    const cap = arm.sleeveCap?.[c.stratId];
    if (cap != null) {
      let inSleeve = 0;
      for (const list of openBySymbol.values()) for (const p of list) if (p.strategy === c.stratId) inSleeve++;
      if (inSleeve >= cap) { block("sleeveCap"); continue; }
    }
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
    if (c.interval === "4h") {   // weekly-trend alignment gate exists for 4h only (1d exempt, as in phase6)
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }

    const riskUsd = balance * baseRiskPct * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const slNow = Math.abs(ex.entryUsed - c.stopLoss) / ex.entryUsed;
    const notionalUsd = slNow > 0 ? riskUsd / slNow : 0;
    if (arm.marginLeverage != null) {
      const capacity = Math.max(0, balance) * Math.max(1, arm.marginLeverage);
      if (openNotional + notionalUsd > capacity) { block("margin"); continue; }
    }
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, interval: c.interval, dir: c.dir,
      netR: ex.netR, fundingR: ex.fundingR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, outcome: ex.outcome, tp1Hit: ex.tp1Hit, barsHeld: ex.barsHeld, holdDays: ex.barsHeld * c.ivSec / 86_400,
      entryUsed: ex.entryUsed, stopLoss: c.stopLoss, slDistPct: slNow,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, notionalUsd, trade });
    openBySymbol.set(c.symbol, list);
    openNotional += notionalUsd;
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, candidates: cands.length };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
interface Metrics {
  n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; maxDD: number;
  top5Share: number; h1: { n: number; exp: number; sumR: number; pf: number }; h2: { n: number; exp: number; sumR: number; pf: number };
  coinsPos: number; coinsTotal: number; coinsPosPct: number; spanYrs: number; tradesPerYr: number; rPerYr: number; avgHoldDays: number; medHoldDays: number;
  fundingRTotal: number; longN: number; shortN: number;
}
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 2) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
function median(xs: number[]): number { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function metrics(trades: SimTrade[], spanOverrideYrs?: number): Metrics {
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
    const mid = (t0 + Math.max(...trades.map(t => t.openedSec))) / 2;   // time midpoint of the ENTRY range
    const a = stats(trades.filter(t => t.openedSec < mid).map(t => t.netR));
    const b = stats(trades.filter(t => t.openedSec >= mid).map(t => t.netR));
    h1 = { n: a.n, exp: a.exp, sumR: a.sumR, pf: a.pf }; h2 = { n: b.n, exp: b.exp, sumR: b.sumR, pf: b.pf };
    spanYrs = (t1 - t0) / (365.25 * 86_400);
  }
  if (spanOverrideYrs != null) spanYrs = spanOverrideYrs;
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

// ── Pre-registered acceptance (applied literally) ───────────────────────────
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

// ── Daily P&L correlation (from phase6) ─────────────────────────────────────
function dailyPnl(trades: SimTrade[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of trades) { const d = new Date(t.closedSec * 1000).toISOString().slice(0, 10); m.set(d, (m.get(d) ?? 0) + t.netR); }
  return m;
}
function pearson(a: Map<string, number>, b: Map<string, number>, from?: string, to?: string): { r: number; n: number } {
  const days = [...new Set([...a.keys(), ...b.keys()])].filter(d => (!from || d >= from) && (!to || d <= to));
  const xs: number[] = [], ys: number[] = [];
  for (const d of days) { xs.push(a.get(d) ?? 0); ys.push(b.get(d) ?? 0); }
  const n = xs.length;
  if (n < 10) return { r: NaN, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const u = xs[i] - mx, v = ys[i] - my; num += u * v; dx += u * u; dy += v * v; }
  return { r: dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : NaN, n };
}

// ── Reporting ───────────────────────────────────────────────────────────────
function rowStr(m: Metrics): string {
  return `T=${String(m.n).padStart(4)} WR=${f(m.wr, 0).padStart(3)}% PF=${f(m.pf).padStart(5)} sumR=${sgn(m.sumR, 1).padStart(7)} exp=${sgn(m.exp, 3)} CI95=[${sgn(m.ciLo, 3)}, ${sgn(m.ciHi, 3)}] maxDD=${f(m.maxDD, 1)}R`;
}
function detailStr(m: Metrics): string {
  return `H1 T=${m.h1.n} exp=${sgn(m.h1.exp, 3)} PF=${f(m.h1.pf)} | H2 T=${m.h2.n} exp=${sgn(m.h2.exp, 3)} PF=${f(m.h2.pf)} | top5=${f(m.top5Share, 0)}% | coins+ ${m.coinsPos}/${m.coinsTotal} (${f(m.coinsPosPct, 0)}%) | ${f(m.tradesPerYr, 0)} tr/yr, ${sgn(m.rPerYr, 1)} R/yr over ${f(m.spanYrs, 1)}y | hold avg ${f(m.avgHoldDays, 1)}d med ${f(m.medHoldDays, 1)}d | L/S ${m.longN}/${m.shortN}${m.fundingRTotal ? ` | funding −${f(m.fundingRTotal, 1)}R` : ""}`;
}
function windowed(trades: SimTrade[], from: number, to = Number.MAX_SAFE_INTEGER): SimTrade[] { return trades.filter(t => t.openedSec >= from && t.openedSec < to); }


// ── Cluster bootstrap (trades entered in the same day/week/month are one block) ──
function clusterBootstrapCI(trades: SimTrade[], clusterSec: number, iters = 10_000, seed = 7): { lo: number; hi: number; clusters: number } {
  const byC = new Map<number, number[]>();
  for (const t of trades) { const k = Math.floor(t.openedSec / clusterSec); byC.set(k, [...(byC.get(k) ?? []), t.netR]); }
  const clusters = [...byC.values()]; const K = clusters.length;
  const rnd = mulberry32(seed); const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0, n = 0;
    for (let j = 0; j < K; j++) { const c = clusters[(rnd() * K) | 0]; for (const r of c) { s += r; n++; } }
    means.push(n ? s / n : 0);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * 0.025)], hi: means[Math.floor(iters * 0.975)], clusters: K };
}
/** sign agreement between pairs of trades entered on the same day (i.i.d. would give ≈ WR²+(1−WR)²) */
function sameDayAgreement(trades: SimTrade[]): { pairs: number; agree: number; iidExpected: number } {
  const byDay = new Map<number, number[]>();
  for (const t of trades) { const k = Math.floor(t.openedSec / 86_400); byDay.set(k, [...(byDay.get(k) ?? []), t.netR]); }
  let pairs = 0, agree = 0;
  for (const rs of byDay.values()) for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { pairs++; if ((rs[i] >= 0) === (rs[j] >= 0)) agree++; }
  const wr = trades.filter(t => t.netR >= 0).length / Math.max(1, trades.length);
  return { pairs, agree: pairs ? agree / pairs : NaN, iidExpected: wr * wr + (1 - wr) * (1 - wr) };
}

async function main() {
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — ADVERSARIAL REVIEW (statistics lens) of the TSMOM T0 verdict — ${new Date().toISOString().slice(0, 10)}`);
  L(`Same pipeline as phase9-tsmom.ts ($${START_CAPITAL} @ ${BASE_RISK_PCT}%, honest signal-close entry, engine gates, 200-bar hold cap as in the original). Review arms only — nothing here promotes anything.`);
  L("");
  const streams = new Map<string, OHLCV[]>();
  const dailyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) { try { const c = await fetchPaginated(sym, "1d", DAILY_CANDLES); streams.set(`${sym}:1d`, c); dailyBySym.set(sym, c); } catch (e: any) { console.error(`1d fetch failed ${sym}: ${e?.message ?? e}`); } }
  const btcDaily = await fetchPaginated("BTC", "1d", DAILY_CANDLES);
  const md: MarketData = { btcDaily, btcWeekly: [], dailyBySym, weeklyBySym: new Map() };
  const strat = makeTsmom("tsmom", 55, 2.0);
  const pool: Cand[] = [];
  for (const sym of UNIVERSE) { const c = streams.get(`${sym}:1d`); if (c) pool.push(...buildCandidates(strat, sym, c)); }
  pool.forEach((c, i) => { c.idx = i; });
  L(`candidates=${pool.length} (phase9-tsmom.ts reported 2481)`);
  L("");

  // Engine scan order: routes.ts SCANNER_COINS = Array.from(new Set(getAllStrategies().flatMap(s => s.preferredSymbols))) —
  // with TSMOM.preferredSymbols = [...LS list] that is the LS list order, NOT A→Z.
  const engineOrder = new Map(UNIVERSE.map((s, i) => [s, i]));
  const zaOrder = new Map([...UNIVERSE].sort((a, b) => b.localeCompare(a)).map((s, i) => [s, i]));
  L(`engine scan order (first 10): ${UNIVERSE.slice(0, 10).join(" ")} …`);
  L("");

  const arms: Arm[] = [
    { tag: "S0", label: "S0 reproduce T0 — default A→Z tie-break", pool: "tsmom" },
    { tag: "S1", label: "S1 ENGINE tie-break order (SCANNER_COINS = preferredSymbols list)", pool: "tsmom", orderIdx: engineOrder },
    { tag: "S2", label: "S2 reverse Z→A tie-break", pool: "tsmom", orderIdx: zaOrder },
    { tag: "S3", label: "S3 ENGINE order + 15 bps adverse entry (ACCEPT slip criterion under engine order)", pool: "tsmom", orderIdx: engineOrder, entry: { driftBps: 15 } },
  ];
  const summary: Record<string, unknown> = {};
  const rows: Array<{ label: string; m: Metrics; v: ReturnType<typeof verdict> }> = [];
  for (const arm of arms) {
    const r = simulate(arm, pool, streams, md, [strat]);
    const m = metrics(r.trades);
    const v = verdict(m, NaN, { multiCoin: true, lowFreq: true });   // slip15 not available per arm → ACCEPT slip check reads as fail; only PAPER matters here
    const cd = clusterBootstrapCI(r.trades, 86_400), cw = clusterBootstrapCI(r.trades, 7 * 86_400), cm = clusterBootstrapCI(r.trades, 30 * 86_400);
    const ag = sameDayAgreement(r.trades);
    const m26 = metrics(windowed(r.trades, YEAR_2026_TS));
    L(`## ${arm.label}`);
    L(`  ALL   ${rowStr(m)}  balDD=${f(r.maxDDpct, 1)}%`);
    L(`        ${detailStr(m)}`);
    L(`        cluster CI95 — by entry-day [${sgn(cd.lo, 3)}, ${sgn(cd.hi, 3)}] (K=${cd.clusters}) · by entry-week [${sgn(cw.lo, 3)}, ${sgn(cw.hi, 3)}] (K=${cw.clusters}) · by entry-month [${sgn(cm.lo, 3)}, ${sgn(cm.hi, 3)}] (K=${cm.clusters})`);
    L(`        same-day pair sign agreement ${f(100 * ag.agree, 0)}% over ${ag.pairs} pairs (i.i.d. expectation ${f(100 * ag.iidExpected, 0)}%)`);
    L(`  2026  ${rowStr(m26)}`);
    L(`  literal verdict: **${v.verdict}** — ${v.reasons.join(" | ")}`);
    L(`  blocks: ${Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")}`);
    L("");
    rows.push({ label: arm.label, m, v });
    summary[arm.tag] = { trades: m.n, exp: +m.exp.toFixed(4), pf: +m.pf.toFixed(3), sumR: +m.sumR.toFixed(1), ci_low: +m.ciLo.toFixed(4), ci_high: +m.ciHi.toFixed(4), cluster_day_lo: +cd.lo.toFixed(4), cluster_week_lo: +cw.lo.toFixed(4), cluster_month_lo: +cm.lo.toFixed(4), half1_exp: +m.h1.exp.toFixed(4), half2_exp: +m.h2.exp.toFixed(4), top5_share_pct: +m.top5Share.toFixed(1), coins_positive_pct: +m.coinsPosPct.toFixed(1), trades_per_yr: +m.tradesPerYr.toFixed(1), maxDD: +m.maxDD.toFixed(1), exp_2026: +m26.exp.toFixed(4), verdict: v.verdict, same_day_agreement: +ag.agree.toFixed(3), same_day_iid: +ag.iidExpected.toFixed(3) };
  }

  // Ordering ensemble: A→Z, engine, Z→A + 20 random seeds → how often does the literal PAPER verdict hold?
  L(`## Ordering ensemble — literal PAPER criteria (exp ≥ 0.15, PF ≥ 1.15, CI lo > −0.05, both halves > 0, ≥ 30 tr/yr) across tie-break orders`);
  const ens: Array<{ name: string; m: Metrics; paper: boolean; cwLo: number }> = [];
  const isPaper = (m: Metrics) => m.exp >= 0.15 && m.pf >= 1.15 && m.ciLo > -0.05 && m.h1.exp > 0 && m.h2.exp > 0 && m.tradesPerYr >= 30;
  for (const r of rows.slice(0, 3)) ens.push({ name: r.label.slice(0, 2), m: r.m, paper: isPaper(r.m), cwLo: NaN });
  for (let seed = 1; seed <= 20; seed++) {
    const r = simulate({ tag: "seed", label: `seed${seed}`, pool: "tsmom", seed }, pool, streams, md, [strat]);
    const m = metrics(r.trades);
    ens.push({ name: `seed${seed}`, m, paper: isPaper(m), cwLo: clusterBootstrapCI(r.trades, 7 * 86_400, 2_000).lo });
  }
  const e = ens.map(x => x.m.exp).sort((a, b) => a - b);
  L(`  ${ens.length} orderings: exp min/med/max ${sgn(e[0], 3)}/${sgn(e[Math.floor(e.length / 2)], 3)}/${sgn(e[e.length - 1], 3)} · PAPER literal in ${ens.filter(x => x.paper).length}/${ens.length} · iid CI lo>0 in ${ens.filter(x => x.m.ciLo > 0).length}/${ens.length} · week-cluster CI lo>0 in ${ens.filter(x => x.cwLo > 0).length}/${ens.filter(x => Number.isFinite(x.cwLo)).length} (seeds only)`);
  L(`  per ordering: ${ens.map(x => `${x.name}=${sgn(x.m.exp, 3)}${x.paper ? "✓" : "✗"}`).join(" ")}`);
  const seedExp = ens.slice(3).map(x => x.m.exp);
  const mu = seedExp.reduce((a, b) => a + b, 0) / seedExp.length, sd = Math.sqrt(seedExp.reduce((a, x) => a + (x - mu) ** 2, 0) / (seedExp.length - 1));
  L(`  random-seed exp mean ${sgn(mu, 4)} sd ${f(sd, 4)} → default A→Z (+${f(rows[0].m.exp, 3)}) is z=${f((rows[0].m.exp - mu) / sd, 2)} above the random-order mean; engine order z=${f((rows[1].m.exp - mu) / sd, 2)}`);
  L("");
  summary.ensemble = { n: ens.length, paper_pass: ens.filter(x => x.paper).length, exp: ens.map(x => +x.m.exp.toFixed(4)), names: ens.map(x => x.name), seed_mean: +mu.toFixed(4), seed_sd: +sd.toFixed(4) };

  // Independent sanity checks on the ORIGINAL T0 dump written by phase9-tsmom.ts
  try {
    const T: SimTrade[] = JSON.parse(readFileSync("script/.cache/phase9-tsmom-t0-trades.json", "utf8"));
    const m = metrics(T); const cw = clusterBootstrapCI(T, 7 * 86_400), cm = clusterBootstrapCI(T, 30 * 86_400), cd = clusterBootstrapCI(T, 86_400);
    const byOpen = [...T].sort((a, b) => a.openedSec - b.openedSec); const h = Math.floor(T.length / 2), th = Math.floor(T.length / 3);
    const s = (x: SimTrade[]) => { const z = stats(x.map(t => t.netR)); return `T=${z.n} exp=${sgn(z.exp, 3)} PF=${f(z.pf)}`; };
    L(`## Original T0 dump (script/.cache/phase9-tsmom-t0-trades.json) — recomputed`);
    L(`  ${rowStr(m)}`);
    L(`  ${detailStr(m)}`);
    L(`  cluster CI95 — day [${sgn(cd.lo, 3)}, ${sgn(cd.hi, 3)}] · week [${sgn(cw.lo, 3)}, ${sgn(cw.hi, 3)}] · month [${sgn(cm.lo, 3)}, ${sgn(cm.hi, 3)}]`);
    L(`  halves by COUNT: ${s(byOpen.slice(0, h))} / ${s(byOpen.slice(h))} · thirds: ${s(byOpen.slice(0, th))} / ${s(byOpen.slice(th, 2 * th))} / ${s(byOpen.slice(2 * th))}`);
    summary.T0_dump = { exp: +m.exp.toFixed(4), pf: +m.pf.toFixed(3), ci_low: +m.ciLo.toFixed(4), cluster_day_lo: +cd.lo.toFixed(4), cluster_week_lo: +cw.lo.toFixed(4), cluster_month_lo: +cm.lo.toFixed(4) };
    L("");
  } catch (e: any) { L(`  (T0 dump not readable: ${e?.message ?? e})`); }

  writeFileSync("script/audit/phase9-report-review-tsmom-stats.md", lines.join("\n"));
  writeFileSync("script/.cache/phase9-review-tsmom-stats-summary.json", JSON.stringify(summary, null, 1));
  console.log(`\n[review report written to script/audit/phase9-report-review-tsmom-stats.md]`);
}

main().catch(e => { console.error(e); process.exit(1); });
