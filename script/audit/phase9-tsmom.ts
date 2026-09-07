// ─── AUDIT PHASE 9 — TSMOM daily, re-evaluated WITHOUT the Liquidity Sweep ──
// The Jul/Aug-2026 rejection of the TSMOM prototype (phase6-tsmom.ts) was slot
// starvation of LS (multi-week holds ate the one-position-per-symbol / maxOpen 10
// slots of a book that generated ~10× more R per slot-day). LS has since been shown
// to have no honest edge (AUDIT-NOTES Fase 8), so that objection may be moot.
//
// PRE-REGISTERED (fixed before any run — see the task brief / phase9-report-tsmom.md):
//   H1  TSMOM standalone exp ≥ +0.25R with CI95 > 0 over 1d × 1500 and both halves
//   H2  B&R + RSI + TSMOM (no LS) has higher sumR AND lower maxDD(R) than B&R + RSI
//   H3  TSMOM survives funding drag (−0.03%/day of hold) and +15 bps entry slippage
// ARMS: T0 standalone primary spec · T1 plateau (N 40/70, stopK 1.5/2.5, one-at-a-time)
//       T2 portfolio B&R+RSI vs B&R+RSI+TSMOM · T3 T0 + funding / +15 bps / +30 bps
//       T4 LONG-only vs SHORT-only (diagnostic)
// Everything else printed under "DIAGNOSTIC" / "POST-HOC" is not used for promotion.
//
// Run:  npx tsx script/audit/phase9-tsmom.ts [--capital=1000] [--risk=1]
// Data: Binance spot klines, day-keyed cache in script/.cache (lib.fetchPaginated):
//       1d × 1500 for the 40 LS-universe coins, 4h × 8000 for the 6 B&R coins,
//       1h × 20000 for the 2 RSI coins, BTC 1d × 1500 (trend multiplier), 1w × 400.

import { writeFileSync } from "fs";
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
    .sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
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

async function main() {
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — TSMOM daily without the Liquidity Sweep — ${new Date().toISOString().slice(0, 10)}`);
  L(`capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · exits ${JSON.stringify(ENGINE_EXIT)} · honest entry (signal close) · fees 0.05% + slip 0.05%/side inside simulateManagedExit`);
  L(`data: 1d×${DAILY_CANDLES} (${UNIVERSE.length} coins) · 4h×${FOURH_CANDLES} (B&R coins) · 1h×${ONEH_CANDLES} (RSI coins) · BTC 1d×${DAILY_CANDLES} for the trend multiplier`);
  L("");
  L("## Pre-registered hypotheses & arms (fixed before the run)");
  L("- H1 TSMOM standalone (primary spec N=55, stop 2.0×ATR20, TP 1.75/3.5×, conf 70, cooldown 72h, 40 coins): exp ≥ +0.25R, CI95 lower > 0, both halves positive");
  L("- H2 portfolio B&R + RSI + TSMOM (no LS) has HIGHER sumR AND LOWER maxDD(R) than B&R + RSI alone (same gates: maxOpen 10, group cap 3, guards, weekly gate for 4h only)");
  L("- H3 TSMOM survives funding drag (−0.03%/day of hold, full position, converted to R via the real stop distance) and +15 bps adverse entry (SL/TP fixed, right-sized)");
  L("- T1 plateau N∈{40,70}, stopK∈{1.5,2.5} one-at-a-time — plateau check only; T4 LONG-only / SHORT-only — diagnostic only");
  L("- Acceptance applied literally (ACCEPT-LIVE-CANDIDATE / PAPER-CANDIDATE / REJECT), see task brief. TSMOM already runs on the full 40-coin universe → selection-bias rule not applicable to it.");
  L("");

  // ── Data ──────────────────────────────────────────────────────────────────
  const registry = getAllStrategies();
  const nonLS = registry.filter(s => s.id !== "liquidity-sweep");
  const streams = new Map<string, OHLCV[]>();
  const dailyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) {
    try { const c = await fetchPaginated(sym, "1d", DAILY_CANDLES); streams.set(`${sym}:1d`, c); dailyBySym.set(sym, c); }
    catch (e: any) { console.error(`1d fetch failed ${sym}: ${e?.message ?? e}`); }
  }
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
  const dSpan = (k: string) => { const c = streams.get(k); return c ? `${new Date(c[0].time * 1000).toISOString().slice(0, 10)}→${new Date(c[c.length - 1].time * 1000).toISOString().slice(0, 10)} (${c.length})` : "—"; };
  L(`## Data spans`);
  L(`  BTC:1d ${dSpan("BTC:1d")} · SOL:4h ${dSpan("SOL:4h")} · ATOM:1h ${dSpan("ATOM:1h")}`);
  const short = UNIVERSE.filter(s => (streams.get(`${s}:1d`)?.length ?? 0) < DAILY_CANDLES).map(s => `${s}:${streams.get(`${s}:1d`)?.length ?? 0}`);
  L(`  coins with < ${DAILY_CANDLES} daily candles (newer listings): ${short.join(" ") || "none"}`);
  L("");

  // ── Pools ─────────────────────────────────────────────────────────────────
  const TS = { primary: makeTsmom("tsmom", 55, 2.0), n40: makeTsmom("tsmom", 40, 2.0), n70: makeTsmom("tsmom", 70, 2.0), k15: makeTsmom("tsmom", 55, 1.5), k25: makeTsmom("tsmom", 55, 2.5) };
  const buildPool = (strats: Strategy[]): Cand[] => {
    const out: Cand[] = [];
    for (const s of strats) for (const sym of s.preferredSymbols ?? []) { const c = streams.get(`${sym}:${s.interval}`); if (c) out.push(...buildCandidates(s, sym, c)); }
    out.forEach((c, i) => { c.idx = i; });
    return out;
  };
  const pools = new Map<string, Cand[]>();
  pools.set("tsmom", buildPool([TS.primary]));
  pools.set("tsmom-n40", buildPool([TS.n40]));
  pools.set("tsmom-n70", buildPool([TS.n70]));
  pools.set("tsmom-k15", buildPool([TS.k15]));
  pools.set("tsmom-k25", buildPool([TS.k25]));
  pools.set("core", buildPool(nonLS));                       // B&R + RSI (registry minus LS)
  pools.set("core+tsmom", buildPool([...nonLS, TS.primary]));
  L(`## Candidate pools (post minSL 0.6% + R:R 1.5 gates)`);
  for (const [k, v] of pools) {
    const byStrat = new Map<string, number>();
    for (const c of v) byStrat.set(c.stratId, (byStrat.get(c.stratId) ?? 0) + 1);
    L(`  ${k.padEnd(12)} ${String(v.length).padStart(5)}  ${[...byStrat.entries()].map(([s, n]) => `${s}=${n}`).join(" ")}`);
  }
  L("");

  // ── Arms (fixed list) ─────────────────────────────────────────────────────
  const arms: Arm[] = [
    { tag: "T0", label: "T0 TSMOM standalone — primary N=55 stop 2.0×ATR20 (engine gates)", pool: "tsmom" },
    { tag: "T1", label: "T1 plateau — N=40", pool: "tsmom-n40" },
    { tag: "T1", label: "T1 plateau — N=70", pool: "tsmom-n70" },
    { tag: "T1", label: "T1 plateau — stop 1.5×ATR", pool: "tsmom-k15" },
    { tag: "T1", label: "T1 plateau — stop 2.5×ATR", pool: "tsmom-k25" },
    { tag: "T2a", label: "T2a portfolio — B&R + RSI alone (registry minus LS)", pool: "core" },
    { tag: "T2b", label: "T2b portfolio — B&R + RSI + TSMOM (no LS)", pool: "core+tsmom" },
    { tag: "T2c", label: "T2c portfolio — B&R + RSI + TSMOM, +15 bps slip + funding drag on ALL strategies", pool: "core+tsmom", entry: { driftBps: 15, fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "T2d", label: "T2d portfolio — B&R + RSI alone, +15 bps slip + funding drag", pool: "core", entry: { driftBps: 15, fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "T3", label: "T3 TSMOM standalone + funding −0.03%/day", pool: "tsmom", entry: { fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "T3", label: "T3 TSMOM standalone + 15 bps adverse entry", pool: "tsmom", entry: { driftBps: 15 } },
    { tag: "T3", label: "T3 TSMOM standalone + 15 bps + funding (H3 arm)", pool: "tsmom", entry: { driftBps: 15, fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "T3", label: "T3 TSMOM standalone + 30 bps adverse entry", pool: "tsmom", entry: { driftBps: 30 } },
    { tag: "T3", label: "T3 TSMOM standalone + 30 bps + funding", pool: "tsmom", entry: { driftBps: 30, fundingPctPerDay: FUNDING_PCT_PER_DAY } },
    { tag: "T4", label: "T4 diagnostic — TSMOM LONG only", pool: "tsmom", dirOnly: "LONG" },
    { tag: "T4", label: "T4 diagnostic — TSMOM SHORT only", pool: "tsmom", dirOnly: "SHORT" },
    { tag: "DIAG", label: "DIAG TSMOM standalone — portfolio guards OFF (daily/rolling/kill-switch)", pool: "tsmom", daily: null, rolling: null, ksMax: null },
    { tag: "DIAG", label: "DIAG TSMOM standalone — margin gate 10× ($1000 @ 1%)", pool: "tsmom", marginLeverage: 10 },
    { tag: "DIAG", label: "DIAG TSMOM standalone — live params $110 @ 0.5% margin 7×", pool: "tsmom", capital: 110, riskPct: 0.5, marginLeverage: 7 },
  ];

  const results = new Map<string, SimOut>();
  const allStrats = [...nonLS, TS.primary];
  for (const arm of arms) {
    const pool = pools.get(arm.pool)!;
    const r = simulate(arm, pool, streams, md, allStrats);
    results.set(arm.label, r);
    const mAll = metrics(r.trades);
    const m26 = metrics(windowed(r.trades, YEAR_2026_TS));
    L(`## ${arm.label}`);
    L(`  ALL   ${rowStr(mAll)}  balDD=${f(r.maxDDpct, 1)}%  candidates=${r.candidates}`);
    L(`        ${detailStr(mAll)}`);
    L(`  2026  ${rowStr(m26)}`);
    if (arm.pool.startsWith("core")) {
      for (const sid of [...new Set(r.trades.map(t => t.strategy))]) {
        const ms = metrics(r.trades.filter(t => t.strategy === sid));
        L(`  sleeve ${sid.padEnd(14)} ${rowStr(ms)}`);
        L(`        ${detailStr(ms)}`);
      }
    }
    L(`  blocks: ${Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ") || "none"}`);
    L("");
  }

  // ── Ungated signal-level diagnostic (all candidates, exits only, no portfolio) ──
  {
    const pool = pools.get("tsmom")!;
    const ex = resolveExits("tsmom", pool, streams, { driftBps: 0, minRR: MIN_RR, fundingPctPerDay: 0 }, ENGINE_EXIT);
    const pseudo: SimTrade[] = pool.map(c => {
      const e = ex[c.idx];
      return { symbol: c.symbol, strategy: c.stratId, interval: c.interval, dir: c.dir, netR: e.netR, fundingR: 0, riskUsd: 1, pnlUsd: e.netR, openedSec: c.tsSec, closedSec: e.exitTsSec, btcD: "neutral" as Trend, outcome: e.outcome, tp1Hit: e.tp1Hit, barsHeld: e.barsHeld, holdDays: e.barsHeld * c.ivSec / 86_400, entryUsed: e.entryUsed, stopLoss: c.stopLoss, slDistPct: c.slDistPct };
    }).filter(t => t.outcome !== "unfilled");
    const m = metrics(pseudo);
    L(`## DIAGNOSTIC — TSMOM primary, UNGATED signal level (every candidate taken, no portfolio gates; overlapping same-symbol signals included)`);
    L(`  ALL   ${rowStr(m)}`);
    L(`        ${detailStr(m)}`);
    L("");
  }

  // ── Deep dive on T0 ───────────────────────────────────────────────────────
  const t0 = results.get(arms[0].label)!;
  const t0m = metrics(t0.trades);
  {
    const T = t0.trades;
    L(`## T0 deep dive`);
    const byYear = new Map<string, number[]>();
    for (const t of T) { const y = new Date(t.openedSec * 1000).toISOString().slice(0, 4); byYear.set(y, [...(byYear.get(y) ?? []), t.netR]); }
    L(`  by year: ` + [...byYear.entries()].sort().map(([y, r]) => { const s = stats(r); return `${y}: T=${s.n} ${sgn(s.sumR, 1)}R exp=${sgn(s.exp, 2)} PF=${f(s.pf)}`; }).join(" | "));
    const byExit = new Map<string, number[]>();
    for (const t of T) byExit.set(t.outcome, [...(byExit.get(t.outcome) ?? []), t.netR]);
    L(`  exits: ` + [...byExit.entries()].map(([k, r]) => `${k}=${r.length} (avg ${sgn(r.reduce((a, b) => a + b, 0) / r.length, 2)}R)`).join("  "));
    for (const dir of ["LONG", "SHORT"] as const) for (const tr of ["up", "neutral", "down"] as const) {
      const s = stats(T.filter(t => t.dir === dir && t.btcD === tr).map(t => t.netR));
      if (s.n) L(`  ${dir.padEnd(5)} · BTC daily ${tr.padEnd(7)} T=${String(s.n).padStart(3)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} exp=${sgn(s.exp, 3)} sumR=${sgn(s.sumR, 1)}`);
    }
    const byCoin = new Map<string, number[]>();
    for (const t of T) byCoin.set(t.symbol, [...(byCoin.get(t.symbol) ?? []), t.netR]);
    const coins = [...byCoin.entries()].map(([sym, r]) => ({ sym, n: r.length, sumR: r.reduce((a, b) => a + b, 0) })).sort((a, b) => b.sumR - a.sumR);
    L(`  coins: ${coins.map(c => `${c.sym} ${sgn(c.sumR, 1)}/${c.n}`).join("  ")}`);
    const top = [...T].sort((a, b) => b.netR - a.netR).slice(0, 5);
    L(`  top-5 trades: ${top.map(t => `${t.symbol} ${t.dir} ${new Date(t.openedSec * 1000).toISOString().slice(0, 10)} ${sgn(t.netR, 2)}R/${f(t.holdDays, 0)}d`).join("  ")}`);
    const holds = T.map(t => t.holdDays);
    L(`  hold days: avg ${f(t0m.avgHoldDays, 1)} median ${f(t0m.medHoldDays, 1)} p90 ${f([...holds].sort((a, b) => a - b)[Math.floor(holds.length * 0.9)], 0)} · timeouts ${T.filter(t => t.outcome === "timeout").length}`);
    L(`  concurrency: mean open positions per day (approx) = ${f(T.reduce((a, t) => a + t.holdDays, 0) / Math.max(1, t0m.spanYrs * 365.25), 2)}`);
    L("");
  }

  // ── H2: portfolio comparison + correlations ───────────────────────────────
  const a = results.get(arms.find(x => x.tag === "T2a")!.label)!;
  const b = results.get(arms.find(x => x.tag === "T2b")!.label)!;
  const ma = metrics(a.trades), mb = metrics(b.trades);
  const bTs = b.trades.filter(t => t.strategy === "tsmom"), bCore = b.trades.filter(t => t.strategy !== "tsmom");
  const corrIn = pearson(dailyPnl(bTs), dailyPnl(bCore));
  const corrStandalone = pearson(dailyPnl(t0.trades), dailyPnl(a.trades));
  // common window: both sleeves active (RSI 1h data starts ≈2024-05, so the core is only fully populated from then)
  const coreStart = new Date(Math.min(...a.trades.map(t => t.openedSec)) * 1000).toISOString().slice(0, 10);
  const corrCommon = pearson(dailyPnl(t0.trades), dailyPnl(a.trades), coreStart);
  const rsiStart = streams.get("ATOM:1h")![0].time;
  const maR = metrics(windowed(a.trades, rsiStart)), mbR = metrics(windowed(b.trades, rsiStart));
  L(`## H2 — portfolio B&R+RSI vs B&R+RSI+TSMOM`);
  L(`  ALL              sumR ${sgn(ma.sumR, 1)} → ${sgn(mb.sumR, 1)} (Δ ${sgn(mb.sumR - ma.sumR, 1)})   maxDD ${f(ma.maxDD, 1)}R → ${f(mb.maxDD, 1)}R (Δ ${sgn(mb.maxDD - ma.maxDD, 1)})   T ${ma.n} → ${mb.n}   exp ${sgn(ma.exp, 3)} → ${sgn(mb.exp, 3)}   balDD ${f(a.maxDDpct, 1)}% → ${f(b.maxDDpct, 1)}%   final $${f(a.finalBalance, 0)} → $${f(b.finalBalance, 0)}`);
  L(`  since RSI data   sumR ${sgn(maR.sumR, 1)} → ${sgn(mbR.sumR, 1)} (Δ ${sgn(mbR.sumR - maR.sumR, 1)})   maxDD ${f(maR.maxDD, 1)}R → ${f(mbR.maxDD, 1)}R   T ${maR.n} → ${mbR.n}`);
  const coreInA = metrics(a.trades), coreInB = metrics(bCore);
  L(`  core sleeve (B&R+RSI) inside the combined book: T ${coreInA.n} → ${coreInB.n}, sumR ${sgn(coreInA.sumR, 1)} → ${sgn(coreInB.sumR, 1)} (slot interaction)`);
  L(`  TSMOM sleeve inside combined book: T=${bTs.length} sumR ${sgn(stats(bTs.map(t => t.netR)).sumR, 1)} exp ${sgn(stats(bTs.map(t => t.netR)).exp, 3)}  vs standalone T=${t0m.n} sumR ${sgn(t0m.sumR, 1)}`);
  L(`  daily P&L corr TSMOM↔core inside combined book: r=${f(corrIn.r, 3)} (n=${corrIn.n} days)`);
  L(`  daily P&L corr T0 standalone ↔ T2a standalone: r=${f(corrStandalone.r, 3)} (n=${corrStandalone.n}); from ${coreStart}: r=${f(corrCommon.r, 3)} (n=${corrCommon.n})`);
  const h2 = mb.sumR > ma.sumR && mb.maxDD < ma.maxDD;
  L(`  H2 verdict: ${h2 ? "SUPPORTED" : "NOT SUPPORTED"} (needs higher sumR AND lower maxDD(R))`);
  L("");

  // ── Verdicts ──────────────────────────────────────────────────────────────
  const slip15 = metrics(results.get("T3 TSMOM standalone + 15 bps adverse entry")!.trades);
  const slip15f = metrics(results.get("T3 TSMOM standalone + 15 bps + funding (H3 arm)")!.trades);
  const fund = metrics(results.get("T3 TSMOM standalone + funding −0.03%/day")!.trades);
  const slip30 = metrics(results.get("T3 TSMOM standalone + 30 bps adverse entry")!.trades);
  const slip30f = metrics(results.get("T3 TSMOM standalone + 30 bps + funding")!.trades);
  const c15 = metrics(results.get(arms.find(x => x.tag === "T2c")!.label)!.trades);
  const a15 = metrics(results.get(arms.find(x => x.tag === "T2d")!.label)!.trades);
  const vT0 = verdict(t0m, slip15.exp, { multiCoin: true, lowFreq: true });
  const vT3 = verdict(slip15f, slip15f.exp, { multiCoin: true, lowFreq: true });
  const vA = verdict(ma, a15.exp, { multiCoin: true, lowFreq: false });
  const vB = verdict(mb, c15.exp, { multiCoin: true, lowFreq: false });
  L(`## H1 — TSMOM standalone: exp ${sgn(t0m.exp, 3)} CI95 [${sgn(t0m.ciLo, 3)}, ${sgn(t0m.ciHi, 3)}] halves ${sgn(t0m.h1.exp, 3)} / ${sgn(t0m.h2.exp, 3)} → ${t0m.exp >= 0.25 && t0m.ciLo > 0 && t0m.h1.exp > 0 && t0m.h2.exp > 0 ? "SUPPORTED" : "NOT SUPPORTED"}`);
  L(`## H3 — funding only: exp ${sgn(fund.exp, 3)} (funding total −${f(fund.fundingRTotal, 1)}R, ${sgn(-fund.fundingRTotal / Math.max(1, fund.n), 3)}R/trade) · +15 bps: ${sgn(slip15.exp, 3)} · +15 bps + funding: ${sgn(slip15f.exp, 3)} CI95 [${sgn(slip15f.ciLo, 3)}, ${sgn(slip15f.ciHi, 3)}] · +30 bps: ${sgn(slip30.exp, 3)} · +30 bps + funding: ${sgn(slip30f.exp, 3)} → ${slip15f.exp >= 0.10 && slip15f.ciLo > 0 ? "SUPPORTED (exp ≥ +0.10 & CI>0 under +15 bps + funding)" : "NOT SUPPORTED"}`);
  L("");
  L(`## Verdicts (pre-registered criteria applied literally)`);
  const V = (name: string, v: { verdict: Verdict; reasons: string[] }) => { L(`  ${name}: **${v.verdict}**`); for (const r of v.reasons) L(`    ${r}`); };
  V("TSMOM standalone T0 (honest, no venue slip; slip criterion from T3 +15 bps)", vT0);
  V("TSMOM standalone under +15 bps + funding (H3 arm, as a component)", vT3);
  V("Portfolio B&R + RSI alone (T2a; selection-bias rule for B&R/RSI coin lists NOT tested here)", vA);
  V("Portfolio B&R + RSI + TSMOM (T2b; same caveat)", vB);
  L("");
  L(`## Plateau (T1, one-at-a-time; no promotion)`);
  for (const arm of arms.filter(x => x.tag === "T1" || x.tag === "T0")) { const m = metrics(results.get(arm.label)!.trades); L(`  ${arm.label.padEnd(40)} T=${m.n} exp=${sgn(m.exp, 3)} PF=${f(m.pf)} CI95=[${sgn(m.ciLo, 3)}, ${sgn(m.ciHi, 3)}] H1/H2 ${sgn(m.h1.exp, 2)}/${sgn(m.h2.exp, 2)} maxDD=${f(m.maxDD, 1)}R`); }
  L("");

  const pack = (m: Metrics) => ({ trades: m.n, exp: +m.exp.toFixed(4), pf: +m.pf.toFixed(3), sumR: +m.sumR.toFixed(1), ci_low: +m.ciLo.toFixed(4), ci_high: +m.ciHi.toFixed(4), maxDD: +m.maxDD.toFixed(1), half1_exp: +m.h1.exp.toFixed(4), half2_exp: +m.h2.exp.toFixed(4), top5_share_pct: +m.top5Share.toFixed(1), coins_positive_pct: +m.coinsPosPct.toFixed(1), trades_per_yr: +m.tradesPerYr.toFixed(1), r_per_yr: +m.rPerYr.toFixed(1), avg_hold_days: +m.avgHoldDays.toFixed(1), span_yrs: +m.spanYrs.toFixed(2), wr: +m.wr.toFixed(1), long: m.longN, short: m.shortN });
  // ── POST-HOC diagnostics (run after seeing the pre-registered results; NOT used for promotion) ──
  L(`## POST-HOC — tie-break sensitivity: all 1d candidates of a day share one timestamp; maxOpen blocked ${t0.blocks.maxOpen ?? 0} T0 candidates, so WHICH breakouts get the slots depends on an arbitrary order (symbol A→Z by default). 20 random orders:`);
  const seedRuns = (base: Arm, pool: Cand[]) => {
    const out: Metrics[] = [];
    for (let seed = 1; seed <= 20; seed++) out.push(metrics(simulate({ ...base, label: `${base.label} seed${seed}`, seed }, pool, streams, md, allStrats).trades));
    return out;
  };
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const seedSummary = (name: string, ms: Metrics[]) => {
    const e = ms.map(m => m.exp), sr = ms.map(m => m.sumR), dd = ms.map(m => m.maxDD), lo = ms.map(m => m.ciLo), h1 = ms.map(m => m.h1.exp), h2 = ms.map(m => m.h2.exp);
    L(`  ${name}: exp min/med/max ${sgn(Math.min(...e), 3)}/${sgn(q(e, 0.5), 3)}/${sgn(Math.max(...e), 3)} · sumR ${sgn(Math.min(...sr), 1)}/${sgn(q(sr, 0.5), 1)}/${sgn(Math.max(...sr), 1)} · maxDD ${f(Math.min(...dd), 1)}/${f(q(dd, 0.5), 1)}/${f(Math.max(...dd), 1)}R · CI lo>0 in ${lo.filter(x => x > 0).length}/20 · both halves>0 in ${ms.filter(m => m.h1.exp > 0 && m.h2.exp > 0).length}/20 · exp≥0.15 in ${e.filter(x => x >= 0.15).length}/20 · min H1 ${sgn(Math.min(...h1), 3)} min H2 ${sgn(Math.min(...h2), 3)}`);
    return { exp: e, sumR: sr, maxDD: dd, ciLo: lo };
  };
  const seedT0 = seedSummary("T0 standalone (20 seeds)", seedRuns(arms[0], pools.get("tsmom")!));
  const seedT0s = seedSummary("T3 +15 bps + funding (20 seeds)", seedRuns(arms.find(x => x.label.includes("H3 arm"))!, pools.get("tsmom")!));
  const seedT2b = seedSummary("T2b B&R+RSI+TSMOM (20 seeds)", seedRuns(arms.find(x => x.tag === "T2b")!, pools.get("core+tsmom")!));
  const seedK25 = seedSummary("T1 stop 2.5×ATR (20 seeds)", seedRuns(arms.find(x => x.label.endsWith("stop 2.5×ATR"))!, pools.get("tsmom-k25")!));
  L("");
  L(`## POST-HOC — slot interaction: TSMOM sleeve cap inside the B&R+RSI book (design question for the lead, not a promotion)`);
  const capRows: Record<string, unknown> = {};
  for (const cap of [3, 5, 7]) {
    const r = simulate({ tag: "PH", label: `T2b + TSMOM cap ${cap}`, pool: "core+tsmom", sleeveCap: { tsmom: cap } }, pools.get("core+tsmom")!, streams, md, allStrats);
    const m = metrics(r.trades), mt = metrics(r.trades.filter(t => t.strategy === "tsmom")), mc = metrics(r.trades.filter(t => t.strategy !== "tsmom"));
    L(`  cap ${cap}: book ${rowStr(m)} | tsmom T=${mt.n} sumR ${sgn(mt.sumR, 1)} exp ${sgn(mt.exp, 3)} | core T=${mc.n} sumR ${sgn(mc.sumR, 1)} exp ${sgn(mc.exp, 3)} | vs T2a core alone T=${ma.n} sumR ${sgn(ma.sumR, 1)} maxDD ${f(ma.maxDD, 1)}R`);
    capRows[`cap${cap}`] = { book: pack(m), tsmom: pack(mt), core: pack(mc) };
  }
  L("");

  // machine-readable summary for the orchestrator
  const summary = {
    T0: pack(t0m), T0_verdict: vT0, T3_fund: pack(fund), T3_slip15: pack(slip15), T3_slip15_fund: pack(slip15f), T3_slip30: pack(slip30), T3_slip30_fund: pack(slip30f), T3_verdict: vT3,
    T2a: pack(ma), T2a_verdict: vA, T2b: pack(mb), T2b_verdict: vB, T2c_slip15_fund: pack(c15), T2d_core_slip15_fund: pack(a15), H2_supported: h2,
    T2b_tsmom_sleeve: pack(metrics(bTs)), T2b_core_sleeve: pack(metrics(bCore)),
    corr_in_book: corrIn, corr_standalone: corrStandalone, corr_common: corrCommon,
    T1: Object.fromEntries(arms.filter(x => x.tag === "T1").map(x => [x.label, pack(metrics(results.get(x.label)!.trades))])),
    T4: Object.fromEntries(arms.filter(x => x.tag === "T4").map(x => [x.label, pack(metrics(results.get(x.label)!.trades))])),
    DIAG: Object.fromEntries(arms.filter(x => x.tag === "DIAG").map(x => [x.label, pack(metrics(results.get(x.label)!.trades))])),
    POST_HOC: { seeds_T0: seedT0, seeds_T3: seedT0s, seeds_T2b: seedT2b, seeds_k25: seedK25, sleeve_caps: capRows },
  };
  writeFileSync("script/.cache/phase9-tsmom-summary.json", JSON.stringify(summary, null, 1));
  writeFileSync("script/.cache/phase9-tsmom-t0-trades.json", JSON.stringify(t0.trades));
  const outPath = "script/audit/phase9-report-tsmom.md";
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[report written to ${outPath}; summary in script/.cache/phase9-tsmom-summary.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
