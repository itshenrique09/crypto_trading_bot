// ─── AUDIT PHASE 9 (2026-09-02) — component "regime": Liquidity Sweep conditioned on
// direction × BTC daily regime. Fork of script/audit/phase8-collapse.ts (same
// candidate builder, exit models and parameterized ENGINE-CURRENT portfolio simulate),
// restricted to strategies: ["liquidity-sweep"] on the registry pool (fixed strategy,
// floor 68, entry = signal-candle close → honest by construction).
//
// PRE-REGISTERED HYPOTHESES (fixed before any run — see phase9-report-regime.md):
//   H1  LS SHORT taken only when BTC daily trend is UP has positive expectancy over the
//       full 2.3-year window AND in both halves.
//   H2  LS SHORT-only (all regimes) is better than LS both-directions
//       (better = higher exp AND higher PF AND higher sumR on FULL and in both halves).
//   H3  Blocking LS LONGs when BTC daily is UP improves the LS book (same "better" rule).
//   Diagnostic (recorded, no hypothesis): the LONG-only book.
// ARMS: A0 both dirs · A1 SHORT-only · A2 SHORT-only & BTC daily up · A3 SHORT-only & BTC
//   daily not down · A4 both dirs, LONG blocked when BTC daily up · A5 = A2 +15/+30 bps
//   adverse entry slippage (SL/TP fixed, right-sized, R:R re-gated ≥1.5 like the engine)
//   · A6 = A2 with portfolio guards off. Slip15 is also run for A1/A3/A4 because the
//   acceptance rule needs it for every candidate.
// BTC TAG: lib.dailyTrendAt on CLOSED daily candles only — a daily candle is used only when
//   candle.time + 86400 ≤ decision time, i.e. the tag at hour h of day D is computed from
//   closes up to D−1. NO same-day close is used (identical to the engine / harness).
//   The BTC daily series is 1d × 1500 (from 2022-07) so the EMA50 is defined for the whole
//   2.3-year window; phase8's 20000-candle runs used 1d × 600 (from 2025-01-10), which
//   made the tag "neutral" (EMA undefined) for every decision before 2025-03-03.
// POST-HOC (labelled, never used for promotion): same arms with the BTC WEEKLY tag; same
//   arms on the sweep-bar pool (LS without the confirmation rule); direction×regime table.
//
// Run:  npx tsx script/audit/phase9-regime.ts [--candles=20000] [--capital=1000] [--risk=1] [--lev=10]
// Type-check: npx tsc --noEmit --module esnext --moduleResolution bundler --target esnext --strict
//   --skipLibCheck --esModuleInterop --allowImportingTsExtensions --types node script/audit/phase9-regime.ts

import { writeFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import { liquiditySweepSignal, type OHLCV } from "../../server/analysis";
import type { Strategy } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause } from "../../server/portfolio-guards";
import {
  fetchPaginated, dailyTrendAt, weeklyTrendAt, intervalSec, stats, bootstrapCI, maxDrawdownR,
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
const TOTAL_CANDLES = parseInt(argv.candles ?? "20000");
const START_CAPITAL = parseFloat(argv.capital ?? "1000");   // paper engine parameters
const BASE_RISK_PCT = parseFloat(argv.risk ?? "1");
const MARGIN_LEV = argv.lev === "off" ? undefined : parseFloat(argv.lev ?? "10");
const RESET_TS = Date.UTC(2026, 7, 14, 0, 0, 0) / 1000;   // 2026-08-14 — journal reset ("day 0")
const END_TS = Date.UTC(2026, 8, 2, 0, 0, 0) / 1000;      // 2026-09-02 — export date + 1
const LAST90_TS = END_TS - 90 * 86_400;
const YEAR_SEC = 365.25 * 86_400;

// ── Candidates (copied from phase8 — parsed signal quality) ────────────────
interface Cand {
  stratId: string; interval: string; symbol: string;
  tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number;
  eqPool: boolean; wick: number; vol: number; rsi: number; macroBull: boolean;
  sigClose: number; barsAfter: number; gapBps: number;
  streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
}

function parseReason(reason: string) {
  const eqPool = /EQL\/EQH/.test(reason);
  const wick = Number((reason.match(/wick ([\d.]+)× body/) ?? [])[1] ?? NaN);
  const vol = Number((reason.match(/vol ([\d.]+)× avg/) ?? [])[1] ?? NaN);
  const rsi = Number((reason.match(/RSI (\d+)/) ?? [])[1] ?? NaN);
  const macroBull = /macro bull/.test(reason);
  return { eqPool, wick, vol, rsi, macroBull };
}

function buildCandidates(strat: Strategy, symbol: string, candles: OHLCV[]): Cand[] {
  const out: Cand[] = [];
  const window = Math.max(strat.minCandles, 60);
  const maxBars = strat.interval === "4h" ? 60 : 200;
  const ivSec = intervalSec(strat.interval);
  if (candles.length < window + maxBars + 10) return out;
  for (let i = window; i < candles.length - 1; i++) {
    const slice = candles.slice(i - window, i + 1);
    let sig;
    try { sig = strat.analyze(slice); } catch { continue; }
    if (!sig) continue;
    const risk = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit1 - sig.entry);
    const slDistPct = sig.entry > 0 ? risk / sig.entry : 0;
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;
    if (risk <= 0 || reward / risk < MIN_RR) continue;
    const q = parseReason(sig.reason ?? "");
    const sigClose = candles[i].close;
    const eq = (a: number, b: number) => Math.abs(a - b) <= Math.abs(b) * 1e-9;
    let barsAfter = -1;
    if (strat.id === "liquidity-sweep") {
      const tagged = (sig.reason ?? "").match(/sweep bar -(\d)/);
      barsAfter = tagged ? Number(tagged[1])
        : eq(sig.entry, candles[i].close) ? 0 : eq(sig.entry, candles[i - 1].close) ? 1 : eq(sig.entry, candles[i - 2].close) ? 2 : -1;
    }
    const gapBps = (sig.direction === "LONG" ? (sigClose - sig.entry) : (sig.entry - sigClose)) / sig.entry * 10_000;
    out.push({
      stratId: strat.id, interval: strat.interval, symbol,
      tsSec: candles[i].time + ivSec, dir: sig.direction,
      entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2,
      confidence: sig.confidence, slDistPct, rr: reward / risk,
      ...q, sigClose, barsAfter, gapBps,
      streamKey: `${symbol}:${strat.interval}`, entryIdx: i, maxBars, ivSec, idx: -1,
    });
  }
  return out;
}

// POST-HOC pool: sweep-bar signals without the confirmation rule (copied from phase8)
function buildSweepBarCandidates(symbol: string, candles: OHLCV[], floor: number): Cand[] {
  const out: Cand[] = [];
  const window = 220, maxBars = 200, ivSec = 3600;
  if (candles.length < window + maxBars + 10) return out;
  for (let i = window; i < candles.length - 1; i++) {
    const slice = candles.slice(i - window, i + 1);
    let sig: ReturnType<typeof liquiditySweepSignal>;
    try { sig = liquiditySweepSignal(slice, { requireConfirmation: false }); } catch { continue; }
    if (sig.type === "NONE" || sig.confidence < floor) continue;
    const tagged = sig.reason.match(/sweep bar -(\d)/);
    const barsAfter = tagged ? Number(tagged[1]) : -1;
    if (barsAfter !== 0) continue;
    const risk = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit - sig.entry);
    const slDistPct = sig.entry > 0 ? risk / sig.entry : 0;
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;
    if (risk <= 0 || reward / risk < MIN_RR) continue;
    out.push({
      stratId: "liquidity-sweep", interval: "1h", symbol,
      tsSec: candles[i].time + ivSec, dir: sig.type,
      entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit, takeProfit2: sig.takeProfit2,
      confidence: sig.confidence, slDistPct, rr: reward / risk,
      ...parseReason(sig.reason), sigClose: candles[i].close, barsAfter: 0, gapBps: 0,
      streamKey: `${symbol}:1h`, entryIdx: i, maxBars, ivSec, idx: -1,
    });
  }
  return out;
}

// ── Exit resolution under an entry model (copied from phase8; cache keyed by pool too) ──
interface EntryModel { kind: "close" | "honest"; driftBps?: number; minRR?: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number }

const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = poolName + "|" + JSON.stringify({ model, exitCfg });
  const hit = exitCache.get(key);
  if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    let entry = c.entry;
    const startIdx = c.entryIdx + 1;
    let filled = true;
    if (model.kind === "honest") {
      const d = (model.driftBps ?? 0) / 10_000;
      entry = c.dir === "LONG" ? c.sigClose * (1 + d) : c.sigClose * (1 - d);
      const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
      const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
      const minRR = model.minRR ?? 1.5;
      if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < minRR) filled = false;
    }
    if (!filled) { out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", tp1Hit: false, filled: false, entryUsed: entry }; continue; }
    const riskNow = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    if (riskNow <= 0) { out[c.idx] = { netR: -1, exitTsSec: c.tsSec + c.ivSec, barsHeld: 1, outcome: "loss", tp1Hit: false, filled: true, entryUsed: entry }; continue; }
    const tp1Ok = c.dir === "LONG" ? c.takeProfit1 > entry : c.takeProfit1 < entry;
    const tp1 = tp1Ok ? c.takeProfit1 : (c.dir === "LONG" ? entry + riskNow * 1.5 : entry - riskNow * 1.5);
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > tp1 : tp2raw < tp1) ? tp2raw : tp1;
    const future = candles.slice(startIdx, startIdx + c.maxBars);
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: tp1, takeProfit2: tp2 }, future, exitCfg);
    out[c.idx] = { netR: ex.netR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, tp1Hit: ex.tp1Hit, filled: true, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

// ── Portfolio simulation (parameterized ENGINE-CURRENT, phase8) + regime/direction arms ──
interface Arm {
  label: string;
  id: string;
  pool?: "registry" | "sweepBar68";
  floor?: Record<string, number>;
  strategies?: string[];
  /** NEW (phase 9): take only this direction (strategy-level filter). */
  onlyDirection?: "LONG" | "SHORT";
  /** NEW (phase 9): take a candidate only when the BTC DAILY tag (closed candles) is in this set. */
  requireBtcDaily?: Trend[];
  /** POST-HOC: same, on the BTC WEEKLY tag. */
  requireBtcWeekly?: Trend[];
  blockLongBtcUp?: boolean;
  daily?: number | null; rolling?: number | null; ksMin?: number; ksMax?: number | null;
  /** POST-HOC: block LONG when the BTC WEEKLY tag is up. */
  blockLongBtcWeeklyUp?: boolean;
  maxOpen?: number; marginLeverage?: number | null;
  entry?: EntryModel;
  exit?: ManagedExitConfig;
  capital?: number; riskPct?: number;
  /** parity check only: use the 1d×600 BTC series phase8 used */
  btcDaily600?: boolean;
  postHoc?: boolean;
}
interface SimTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT"; confidence: number; eqPool: boolean; barsAfter: number;
  netR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number;
  btcD: Trend; btcW: Trend; outcome: string; tp1Hit: boolean; barsHeld: number; entry: number; entryUsed: number; stopLoss: number; tp1: number; slDistPct: number;
}
interface SimOut { arm: Arm; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number; candidatesIn: number }

function simulate(arm: Arm, poolName: string, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, btcDaily600: OHLCV[], strategies: Strategy[]): SimOut {
  const exitCfg = arm.exit ?? ENGINE_EXIT;
  const exits = resolveExits(poolName, allCands, streams, arm.entry ?? { kind: "close" }, exitCfg);
  const active = new Set(arm.strategies ?? strategies.map(s => s.id));
  const cands = allCands
    .filter(c => active.has(c.stratId))
    .filter(c => {
      const fl = arm.floor?.[c.stratId];
      if (fl != null && c.confidence < fl) return false;
      if (arm.onlyDirection && c.dir !== arm.onlyDirection) return false;
      return true;
    })
    .sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));
  const dailyR = arm.daily === undefined ? 4 : arm.daily;
  const rollingR = arm.rolling === undefined ? 6 : arm.rolling;
  const ksMin = arm.ksMin ?? 4;
  const ksMax = arm.ksMax === undefined ? -3 : arm.ksMax;
  const maxOpen = arm.maxOpen ?? FIXED_MAX_OPEN;
  const startCapital = arm.capital ?? START_CAPITAL;
  const baseRiskPct = arm.riskPct ?? BASE_RISK_PCT;
  const marginLev = arm.marginLeverage === undefined ? MARGIN_LEV : arm.marginLeverage;
  const btcDailySeries = arm.btcDaily600 ? btcDaily600 : md.btcDaily;

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
  // BTC daily tag: dailyTrendAt drops every daily candle whose close (time + 86400) is after
  // nowSec → only CLOSED daily candles feed the EMA; the tag is constant within a UTC day.
  const dTrend = (sym: string, nowSec: number): Trend => {
    const key = `d:${sym}:${Math.floor(nowSec / 86_400)}`;
    let t = trendCache.get(key);
    if (t === undefined) { const s = sym === "BTC" ? btcDailySeries : md.dailyBySym.get(sym); t = s ? dailyTrendAt(s, nowSec) : "neutral"; trendCache.set(key, t); }
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
    const btcDailyTrend = dTrend("BTC", nowSec);
    const btcWeeklyTrend = wTrend("BTC", nowSec);
    // regime filters (phase 9) — applied first so they never consume a slot or a cooldown
    if (arm.requireBtcDaily && !arm.requireBtcDaily.includes(btcDailyTrend)) { block("btcDailyRegime"); continue; }
    if (arm.requireBtcWeekly && !arm.requireBtcWeekly.includes(btcWeeklyTrend)) { block("btcWeeklyRegime"); continue; }
    if (arm.blockLongBtcUp && c.dir === "LONG" && btcDailyTrend === "up") { block("longBtcUp"); continue; }
    if (arm.blockLongBtcWeeklyUp && c.dir === "LONG" && btcWeeklyTrend === "up") { block("longBtcWeeklyUp"); continue; }

    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }

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

    const riskUsd = balance * baseRiskPct * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const slNow = Math.abs(ex.entryUsed - c.stopLoss) / ex.entryUsed;
    const notionalUsd = slNow > 0 ? riskUsd / slNow : 0;
    if (marginLev != null) {
      const capacity = Math.max(0, balance) * Math.max(1, marginLev);
      if (openNotional + notionalUsd > capacity) { block("margin"); continue; }
    }
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, dir: c.dir, confidence: c.confidence, eqPool: c.eqPool, barsAfter: c.barsAfter,
      netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, btcW: btcWeeklyTrend, outcome: ex.outcome, tp1Hit: ex.tp1Hit, barsHeld: ex.barsHeld,
      entry: c.entry, entryUsed: ex.entryUsed, stopLoss: c.stopLoss, tp1: c.takeProfit1, slDistPct: c.slDistPct,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, notionalUsd, trade });
    openBySymbol.set(c.symbol, list);
    openNotional += notionalUsd;
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, candidatesIn: cands.length };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 3) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");

interface Win { name: string; from: number; to: number }
interface WinStats {
  T: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; maxDD: number;
  h1: { T: number; exp: number; pf: number; sumR: number }; h2: { T: number; exp: number; pf: number; sumR: number };
  top5Share: number; coinsPos: number; coinsTot: number; tradesPerYr: number; spanYrs: number;
}
function inWin(t: SimTrade, w: Win) { return t.openedSec >= w.from && t.openedSec < w.to; }
function winStats(trades: SimTrade[], w: Win, dataFrom: number, dataTo: number, boot = 10_000): WinStats {
  const t = trades.filter(x => inWin(x, w));
  const rs = t.map(x => x.netR);
  const s = stats(rs);
  const ci = bootstrapCI(rs, boot);
  const from = Math.max(w.from, dataFrom), to = Math.min(w.to, dataTo);
  const spanYrs = Math.max(1e-9, (to - from) / YEAR_SEC);
  const mid = (from + to) / 2;
  const half = (pred: (x: SimTrade) => boolean) => { const q = stats(t.filter(pred).map(x => x.netR)); return { T: q.n, exp: q.exp, pf: q.pf, sumR: q.sumR }; };
  const sorted = [...rs].sort((a, b) => b - a);
  const top5 = sorted.slice(0, 5).reduce((a, b) => a + b, 0);
  const byCoin = new Map<string, number>();
  for (const x of t) byCoin.set(x.symbol, (byCoin.get(x.symbol) ?? 0) + x.netR);
  const coinsTot = byCoin.size, coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  return {
    T: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi, maxDD: maxDrawdownR(rs),
    h1: half(x => x.openedSec < mid), h2: half(x => x.openedSec >= mid),
    top5Share: s.sumR > 0 ? 100 * top5 / s.sumR : NaN, coinsPos, coinsTot, tradesPerYr: s.n / spanYrs, spanYrs,
  };
}
function fmtWin(name: string, s: WinStats): string {
  return `  ${name.padEnd(9)} T=${String(s.T).padStart(4)} WR=${f(s.wr, 0).padStart(3)}% PF=${f(s.pf).padStart(5)} sumR=${sgn(s.sumR, 1).padStart(7)} exp=${sgn(s.exp)} CI95=[${sgn(s.ciLo, 3)}, ${sgn(s.ciHi, 3)}] maxDD=${f(s.maxDD, 1)}R ` +
    `| H1 T=${s.h1.T} exp=${sgn(s.h1.exp)} PF=${f(s.h1.pf)} · H2 T=${s.h2.T} exp=${sgn(s.h2.exp)} PF=${f(s.h2.pf)} | top5=${f(s.top5Share, 0)}% coins+=${s.coinsPos}/${s.coinsTot} T/yr=${f(s.tradesPerYr, 0)}`;
}

// ── Pre-registered acceptance (literal) ─────────────────────────────────────
type Verdict = "ACCEPT-LIVE-CANDIDATE" | "PAPER-CANDIDATE" | "REJECT" | "INSUFFICIENT-DATA";
function verdict(full: WinStats, slip15Exp: number, isMultiCoin = true): { v: Verdict; reasons: string[] } {
  const r: string[] = [];
  if (full.T < 30) return { v: "INSUFFICIENT-DATA", reasons: [`T=${full.T} < 30`] };
  const bothHalvesPos = full.h1.exp > 0 && full.h2.exp > 0;
  const acc: Array<[boolean, string]> = [
    [full.exp >= 0.25, `exp ${sgn(full.exp)} ≥ +0.25`],
    [full.pf >= 1.30, `PF ${f(full.pf)} ≥ 1.30`],
    [full.ciLo > 0, `CI95 lower ${sgn(full.ciLo)} > 0`],
    [full.tradesPerYr >= 50, `trades/yr ${f(full.tradesPerYr, 0)} ≥ 50`],
    [full.h1.exp >= 0.10 && full.h2.exp >= 0.10, `both halves exp ≥ +0.10 (H1 ${sgn(full.h1.exp)}, H2 ${sgn(full.h2.exp)})`],
    [Number.isFinite(full.top5Share) && full.top5Share <= 30, `top-5 share ${f(full.top5Share, 0)}% ≤ 30%`],
    [!isMultiCoin || full.coinsPos / Math.max(1, full.coinsTot) >= 0.55, `coins positive ${full.coinsPos}/${full.coinsTot} ≥ 55%`],
    [slip15Exp >= 0.10, `exp @+15bps ${sgn(slip15Exp)} ≥ +0.10`],
  ];
  const accFail = acc.filter(([ok]) => !ok).map(([, s]) => s);
  if (accFail.length === 0) return { v: "ACCEPT-LIVE-CANDIDATE", reasons: ["all ACCEPT criteria met"] };
  const pap: Array<[boolean, string]> = [
    [full.exp >= 0.15, `exp ${sgn(full.exp)} ≥ +0.15`],
    [full.pf >= 1.15, `PF ${f(full.pf)} ≥ 1.15`],
    [full.ciLo > -0.05, `CI95 lower ${sgn(full.ciLo)} > −0.05`],
    [bothHalvesPos, `both halves positive (H1 ${sgn(full.h1.exp)}, H2 ${sgn(full.h2.exp)})`],
    [full.tradesPerYr >= 30, `trades/yr ${f(full.tradesPerYr, 0)} ≥ 30`],
  ];
  const papFail = pap.filter(([ok]) => !ok).map(([, s]) => s);
  r.push(`ACCEPT fails: ${accFail.join("; ")}`);
  if (papFail.length === 0) return { v: "PAPER-CANDIDATE", reasons: r };
  r.push(`PAPER fails: ${papFail.join("; ")}`);
  return { v: "REJECT", reasons: r };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const strategies = getAllStrategies();
  const ls = strategies.find(s => s.id === "liquidity-sweep")!;
  const coins = ls.preferredSymbols ?? [];
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — component "regime": Liquidity Sweep × direction × BTC daily regime — ${new Date().toISOString().slice(0, 10)}`);
  L(`candles ${TOTAL_CANDLES}×1h · ${coins.length} LS coins · capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · margin ${MARGIN_LEV ?? "off"}× · strategies: liquidity-sweep only (floor 68, fixed entry = signal-candle close)`);
  L(`BTC daily tag: lib.dailyTrendAt over CLOSED daily candles only (candle.time+86400 ≤ decision time) — no same-day close is used. Series 1d×1500 (EMA50 defined for the whole window).`);
  L();
  L(`## Pre-registered hypotheses (fixed before any run)`);
  L(`- H1: LS SHORT taken only when BTC daily trend is UP has positive expectancy over the full 2.3-year window AND in both halves (alt rallies fade against BTC strength).`);
  L(`- H2: LS SHORT-only (all regimes) is better than LS both-directions. "Better" = higher exp AND higher PF AND higher sumR on FULL and in both halves.`);
  L(`- H3: Blocking LS LONGs when BTC daily is UP improves the LS book (same rule).`);
  L(`- Diagnostic only (no hypothesis): the LONG-only book.`);
  L(`## Acceptance (pre-registered, applied literally to A1–A4 on FULL)`);
  L(`- ACCEPT-LIVE-CANDIDATE: exp ≥ +0.25R; PF ≥ 1.30; bootstrap CI95 lower > 0 (10k, FULL); ≥ 50 trades/yr; both halves exp ≥ +0.10R (same sign); top-5 trades ≤ 30% of sumR; ≥ 55% of traded coins with positive sumR; exp under +15 bps entry slippage ≥ +0.10R.`);
  L(`- PAPER-CANDIDATE: exp ≥ +0.15R; PF ≥ 1.15; CI95 lower > −0.05R; both halves positive; ≥ 30 trades/yr. Otherwise REJECT (T < 30 → INSUFFICIENT-DATA).`);
  L(`- Selection-bias rule: not applicable here — all arms run on the full 40-coin LS universe.`);
  L(`- Caveat declared up front: the direction×regime pattern behind H1 was first seen in the 8000-candle window (≈ last 11 months). FULL therefore partly overlaps the data that generated the hypothesis; the PRE-8000 window is the only clean out-of-sample test and is reported for every arm.`);
  L();

  // data
  const streams = new Map<string, OHLCV[]>();
  for (const sym of coins) {
    try { streams.set(`${sym}:1h`, await fetchPaginated(sym, "1h", TOTAL_CANDLES)); }
    catch (e: any) { console.error(`fetch failed ${sym}: ${e?.message ?? e}`); }
  }
  const btcDaily = await fetchPaginated("BTC", "1d", 1500);
  const btcDaily600 = await fetchPaginated("BTC", "1d", 600);
  const btcWeekly = await fetchPaginated("BTC", "1w", 400);
  const md: MarketData = { btcDaily, btcWeekly, dailyBySym: new Map(), weeklyBySym: new Map() };
  const btc1h = streams.get("BTC:1h")!;
  const dataFrom = btc1h[Math.max(ls.minCandles, 60)].time + 3600;   // first possible candidate decision time
  const dataTo = btc1h[btc1h.length - 1].time + 3600;
  const mid = (dataFrom + dataTo) / 2;
  const pre8000 = btc1h[btc1h.length - 8000].time + 3600;            // start of the 8000-candle window where the H1 idea was first seen
  L(`data: 1h ${new Date(btc1h[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(dataTo * 1000).toISOString().slice(0, 10)}; first decision ${new Date(dataFrom * 1000).toISOString().slice(0, 10)}; halves split at ${new Date(mid * 1000).toISOString().slice(0, 10)}; 8000-candle window starts ${new Date(pre8000 * 1000).toISOString().slice(0, 10)}`);
  L(`BTC 1d×1500 from ${new Date(btcDaily[0].time * 1000).toISOString().slice(0, 10)}; phase8's 1d×600 from ${new Date(btcDaily600[0].time * 1000).toISOString().slice(0, 10)} (tag undefined→"neutral" before ${new Date((btcDaily600[51].time + 86400) * 1000).toISOString().slice(0, 10)})`);

  // regime coverage of the window (share of decision-hours per BTC daily tag)
  {
    const cnt: Record<Trend, number> = { up: 0, neutral: 0, down: 0 };
    const cnt600: Record<Trend, number> = { up: 0, neutral: 0, down: 0 };
    for (let d = Math.floor(dataFrom / 86400) * 86400; d < dataTo; d += 86400) { cnt[dailyTrendAt(btcDaily, d + 3600)]++; cnt600[dailyTrendAt(btcDaily600, d + 3600)]++; }
    const tot = cnt.up + cnt.neutral + cnt.down;
    L(`BTC daily regime coverage (days): up ${cnt.up} (${f(100 * cnt.up / tot, 0)}%) · neutral ${cnt.neutral} (${f(100 * cnt.neutral / tot, 0)}%) · down ${cnt.down} (${f(100 * cnt.down / tot, 0)}%)  [with 1d×600: up ${cnt600.up} neutral ${cnt600.neutral} down ${cnt600.down}]`);
  }
  L();

  const WINDOWS: Win[] = [
    { name: "FULL", from: 0, to: Number.MAX_SAFE_INTEGER },
    { name: "H1", from: 0, to: mid },
    { name: "H2", from: mid, to: Number.MAX_SAFE_INTEGER },
    { name: "PRE-8000", from: 0, to: pre8000 },
    { name: "2026", from: YEAR_2026_TS, to: Number.MAX_SAFE_INTEGER },
    { name: "last90d", from: LAST90_TS, to: Number.MAX_SAFE_INTEGER },
    { name: "Aug14→", from: RESET_TS, to: END_TS },
  ];

  // candidates
  const t0 = Date.now();
  const cands: Cand[] = [];
  for (const sym of coins) { const c = streams.get(`${sym}:1h`); if (c) cands.push(...buildCandidates(ls, sym, c)); }
  cands.forEach((c, i) => { c.idx = i; });
  L(`registry pool (LS, post minSL+RR): ${cands.length} candidates (${((Date.now() - t0) / 1000).toFixed(0)}s) · LONG ${cands.filter(c => c.dir === "LONG").length} · SHORT ${cands.filter(c => c.dir === "SHORT").length} · by confidence ` + [68, 70, 75, 80, 85].map(b => `${b}:${cands.filter(c => c.confidence === b).length}`).join(" "));
  {
    // candidate count by direction × BTC daily (before any portfolio gate)
    const tag = (c: Cand) => dailyTrendAt(btcDaily, c.tsSec);
    for (const dir of ["LONG", "SHORT"] as const) L(`  candidates ${dir}: ` + (["up", "neutral", "down"] as Trend[]).map(t => `BTC ${t}=${cands.filter(c => c.dir === dir && tag(c) === t).length}`).join(" · "));
  }
  L();

  const LSONLY = ["liquidity-sweep"];
  const F68 = { "liquidity-sweep": 68 };
  const base = (id: string, label: string, extra: Partial<Arm>): Arm => ({ id, label, strategies: LSONLY, floor: F68, ...extra });
  const slip = (bps: number): EntryModel => ({ kind: "honest", minRR: 1.5, driftBps: bps });
  const arms: Arm[] = [
    base("PARITY", "PARITY: A0 at phase8 params ($500 2% no margin, BTC 1d×600) — must equal phase8-report-core-20000 'FLOOR 68 LS only'", { capital: 500, riskPct: 2, marginLeverage: null, btcDaily600: true }),
    base("A0", "A0 LS both directions (baseline)", {}),
    base("A1", "A1 LS SHORT-only (all regimes)", { onlyDirection: "SHORT" }),
    base("A2", "A2 LS SHORT-only AND BTC daily UP", { onlyDirection: "SHORT", requireBtcDaily: ["up"] }),
    base("A3", "A3 LS SHORT-only AND BTC daily NOT DOWN", { onlyDirection: "SHORT", requireBtcDaily: ["up", "neutral"] }),
    base("A4", "A4 LS both directions, LONG blocked when BTC daily UP", { blockLongBtcUp: true }),
    base("A5a", "A5a = A2 +15 bps adverse entry slippage (SL/TP fixed, right-sized, R:R re-gated ≥1.5)", { onlyDirection: "SHORT", requireBtcDaily: ["up"], entry: slip(15) }),
    base("A5b", "A5b = A2 +30 bps adverse entry slippage", { onlyDirection: "SHORT", requireBtcDaily: ["up"], entry: slip(30) }),
    base("A6", "A6 = A2 with portfolio guards off (daily / rolling-7d / kill-switch) — guard-interaction diagnostic", { onlyDirection: "SHORT", requireBtcDaily: ["up"], daily: null, rolling: null, ksMax: null }),
    base("A1s15", "A1 +15 bps slippage (for the acceptance rule)", { onlyDirection: "SHORT", entry: slip(15) }),
    base("A3s15", "A3 +15 bps slippage (for the acceptance rule)", { onlyDirection: "SHORT", requireBtcDaily: ["up", "neutral"], entry: slip(15) }),
    base("A4s15", "A4 +15 bps slippage (for the acceptance rule)", { blockLongBtcUp: true, entry: slip(15) }),
    base("D1", "DIAG D1 LS LONG-only (all regimes)", { onlyDirection: "LONG" }),
    base("D2", "DIAG D2 LS LONG-only AND BTC daily NOT UP", { onlyDirection: "LONG", requireBtcDaily: ["neutral", "down"] }),
    base("D3", "DIAG D3 LS SHORT-only AND BTC daily DOWN (complement of A3)", { onlyDirection: "SHORT", requireBtcDaily: ["down"] }),
    base("D4", "DIAG D4 = A0 with guards off (to pair with A6)", { daily: null, rolling: null, ksMax: null }),
    base("D5", "DIAG D5 = A1 with guards off", { onlyDirection: "SHORT", daily: null, rolling: null, ksMax: null }),
  ];
  const postHoc: Arm[] = [
    base("P-W1", "POST-HOC W1: SHORT-only AND BTC WEEKLY up", { onlyDirection: "SHORT", requireBtcWeekly: ["up"], postHoc: true }),
    base("P-W2", "POST-HOC W2: SHORT-only AND BTC WEEKLY not down", { onlyDirection: "SHORT", requireBtcWeekly: ["up", "neutral"], postHoc: true }),
    base("P-W3", "POST-HOC W3: SHORT-only AND BTC daily up AND weekly up", { onlyDirection: "SHORT", requireBtcDaily: ["up"], requireBtcWeekly: ["up"], postHoc: true }),
    base("P-W4", "POST-HOC W4: both dirs, LONG blocked when BTC WEEKLY up", { blockLongBtcWeeklyUp: true, postHoc: true }),
    base("P-S0", "POST-HOC S0: sweep-bar pool (no confirmation rule) both directions", { pool: "sweepBar68", postHoc: true }),
    base("P-S1", "POST-HOC S1: sweep-bar pool SHORT-only", { pool: "sweepBar68", onlyDirection: "SHORT", postHoc: true }),
    base("P-S2", "POST-HOC S2: sweep-bar pool SHORT-only AND BTC daily up", { pool: "sweepBar68", onlyDirection: "SHORT", requireBtcDaily: ["up"], postHoc: true }),
    base("P-S3", "POST-HOC S3: sweep-bar pool SHORT-only AND BTC daily not down", { pool: "sweepBar68", onlyDirection: "SHORT", requireBtcDaily: ["up", "neutral"], postHoc: true }),
    base("P-S4", "POST-HOC S4: sweep-bar pool both dirs, LONG blocked when BTC daily up", { pool: "sweepBar68", blockLongBtcUp: true, postHoc: true }),
  ];

  const pools = new Map<string, Cand[]>([["registry", cands]]);
  const poolFor = (name: string): Cand[] => {
    let p = pools.get(name);
    if (!p) {
      p = [];
      for (const sym of coins) { const c = streams.get(`${sym}:1h`); if (c) p.push(...buildSweepBarCandidates(sym, c, 68)); }
      p.forEach((c, i) => { c.idx = i; });
      pools.set(name, p);
      L(`research pool ${name}: ${p.length} candidates · LONG ${p.filter(c => c.dir === "LONG").length} · SHORT ${p.filter(c => c.dir === "SHORT").length}`);
    }
    return p;
  };

  const results = new Map<string, SimOut>();
  const statsBy = new Map<string, Map<string, WinStats>>();
  const runArm = (arm: Arm) => {
    const poolName = arm.pool ?? "registry";
    const r = simulate(arm, poolName, poolFor(poolName), streams, md, btcDaily600, strategies);
    results.set(arm.id, r);
    const m = new Map<string, WinStats>();
    for (const w of WINDOWS) m.set(w.name, winStats(r.trades, w, dataFrom, dataTo, w.name === "FULL" ? 10_000 : 4_000));
    statsBy.set(arm.id, m);
    L(`## ${arm.label}`);
    L(`  candidates in: ${r.candidatesIn} · balDD=${f(r.maxDDpct, 1)}% · final $${f(r.finalBalance, 0)}`);
    for (const w of WINDOWS) L(fmtWin(w.name, m.get(w.name)!));
    const blocked = Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ");
    L(`  blocks: ${blocked || "none"}`);
    L();
  };

  L(`# PRE-REGISTERED ARMS (registry pool, honest by construction)`);
  L(`Windows: FULL · H1/H2 (time halves of the decision range) · PRE-8000 (before the 8000-candle window in which the direction×regime pattern was first observed — the only part of the data not seen when H1 was formed) · 2026 · last90d · Aug14→Sep1 (parity only). Each row also splits its own window in halves (H1/H2 columns).`);
  L();
  for (const arm of arms) runArm(arm);

  // ── Hypothesis tests & verdicts ────────────────────────────────────────────
  const S = (id: string, w = "FULL") => statsBy.get(id)!.get(w)!;
  const better = (a: WinStats, b: WinStats) => a.exp > b.exp && a.pf > b.pf && a.sumR > b.sumR;
  L(`# HYPOTHESIS TESTS (pre-registered rules)`);
  {
    const a2 = S("A2");
    const ok = a2.exp > 0 && a2.h1.exp > 0 && a2.h2.exp > 0;
    L(`H1 (A2 exp > 0 on FULL and in both halves): FULL exp ${sgn(a2.exp)} CI95 [${sgn(a2.ciLo)}, ${sgn(a2.ciHi)}] · H1 ${sgn(a2.h1.exp)} (T=${a2.h1.T}) · H2 ${sgn(a2.h2.exp)} (T=${a2.h2.T}) · PRE-8000 ${sgn(S("A2", "PRE-8000").exp)} (T=${S("A2", "PRE-8000").T}) → ${ok ? "SUPPORTED" : "NOT SUPPORTED"}`);
  }
  for (const [h, id, desc] of [["H2", "A1", "SHORT-only better than both-directions"], ["H3", "A4", "LONG blocked when BTC up better than both-directions"]] as const) {
    const a = S(id), b = S("A0");
    const full = better(a, b), h1 = better(S(id, "H1"), S("A0", "H1")), h2 = better(S(id, "H2"), S("A0", "H2"));
    L(`${h} (${id} ${desc}; better = higher exp AND PF AND sumR): FULL ${full ? "yes" : "no"} (exp ${sgn(a.exp)} vs ${sgn(b.exp)}, PF ${f(a.pf)} vs ${f(b.pf)}, sumR ${sgn(a.sumR, 1)} vs ${sgn(b.sumR, 1)}) · H1 ${h1 ? "yes" : "no"} · H2 ${h2 ? "yes" : "no"} → ${full && h1 && h2 ? "SUPPORTED" : full ? "PARTIALLY (FULL only)" : "NOT SUPPORTED"}`);
  }
  L();
  L(`# VERDICTS (acceptance criteria applied literally to A1–A4 on FULL; slip15 from the matching +15 bps arm)`);
  const verdicts: Array<{ id: string; v: Verdict; reasons: string[] }> = [];
  for (const [id, slipId] of [["A1", "A1s15"], ["A2", "A5a"], ["A3", "A3s15"], ["A4", "A4s15"]] as const) {
    const vv = verdict(S(id), S(slipId).exp);
    verdicts.push({ id, ...vv });
    L(`${id}: ${vv.v} — ${vv.reasons.join(" | ")}`);
  }
  L();

  // ── Direction × BTC daily table for A0 (diagnostic, pre-declared) ─────────
  L(`# A0 — direction × BTC daily regime (portfolio trades; the 8000-candle table in the brief was LONG·up −0.46R, SHORT·up +0.61R)`);
  for (const w of WINDOWS.filter(x => ["FULL", "H1", "H2", "PRE-8000", "2026"].includes(x.name))) {
    for (const dir of ["LONG", "SHORT"]) for (const tr of ["up", "neutral", "down"] as Trend[]) {
      const t = results.get("A0")!.trades.filter(x => x.dir === dir && x.btcD === tr && inWin(x, w));
      if (!t.length) continue;
      const rs = t.map(x => x.netR); const s = stats(rs); const ci = bootstrapCI(rs, 4000);
      L(`  [${w.name.padEnd(8)}] ${dir.padEnd(5)} BTC ${tr.padEnd(7)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} exp=${sgn(s.exp)} CI95=[${sgn(ci.lo)}, ${sgn(ci.hi)}]`);
    }
  }
  L();
  // per-coin breadth and monthly for A2
  {
    const T = results.get("A2")!.trades;
    const byCoin = new Map<string, number[]>();
    for (const t of T) byCoin.set(t.symbol, [...(byCoin.get(t.symbol) ?? []), t.netR]);
    const coinsArr = [...byCoin.entries()].map(([sym, r]) => ({ sym, n: r.length, sumR: r.reduce((a, b) => a + b, 0) })).sort((a, b) => b.sumR - a.sumR);
    L(`# A2 — per-coin sumR/T (${coinsArr.filter(c => c.sumR > 0).length}/${coinsArr.length} positive)`);
    L(`  ` + coinsArr.map(c => `${c.sym} ${sgn(c.sumR, 1)}/${c.n}`).join("  "));
    const byMonth = new Map<string, number[]>();
    for (const t of T) { const m = new Date(t.openedSec * 1000).toISOString().slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), t.netR]); }
    L(`  monthly: ` + [...byMonth.entries()].sort().map(([m, r]) => `${m}:${sgn(r.reduce((a, b) => a + b, 0), 1)}R/${r.length}`).join("  "));
    const byExit = new Map<string, number[]>();
    for (const t of T) byExit.set(t.outcome, [...(byExit.get(t.outcome) ?? []), t.netR]);
    L(`  exits: ` + [...byExit.entries()].map(([k, r]) => `${k}=${r.length} (avg ${f(r.reduce((a, b) => a + b, 0) / r.length, 2)}R)`).join("  "));
    const top = [...T].sort((a, b) => b.netR - a.netR).slice(0, 5);
    L(`  top-5 trades: ` + top.map(t => `${t.symbol} ${new Date(t.openedSec * 1000).toISOString().slice(0, 10)} ${sgn(t.netR, 2)}R`).join("  "));
    L();
  }

  // ── POST-HOC ──────────────────────────────────────────────────────────────
  L(`# POST-HOC DIAGNOSTICS — labelled post-hoc; NOT used for any verdict`);
  L(`BTC WEEKLY tag = lib.weeklyTrendAt on closed weekly candles (EMA20, ±2%). Sweep-bar pool = liquiditySweepSignal({requireConfirmation:false}), barsAfter=0, floor 68 — the LS family without the confirmation rule.`);
  L();
  for (const arm of postHoc) runArm(arm);
  {
    const weekly: Record<Trend, number> = { up: 0, neutral: 0, down: 0 };
    for (let d = Math.floor(dataFrom / 86400) * 86400; d < dataTo; d += 86400) weekly[weeklyTrendAt(btcWeekly, d + 3600)]++;
    L(`BTC weekly regime coverage (days): up ${weekly.up} · neutral ${weekly.neutral} · down ${weekly.down}`);
    L(`A0 — direction × BTC WEEKLY (FULL):`);
    for (const dir of ["LONG", "SHORT"]) for (const tr of ["up", "neutral", "down"] as Trend[]) {
      const t = results.get("A0")!.trades.filter(x => x.dir === dir && x.btcW === tr);
      if (!t.length) continue;
      const s = stats(t.map(x => x.netR));
      L(`  ${dir.padEnd(5)} BTCw ${tr.padEnd(7)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} exp=${sgn(s.exp)}`);
    }
    L(`A0 — SHORT × BTC daily × BTC weekly (FULL):`);
    for (const d of ["up", "neutral", "down"] as Trend[]) for (const w of ["up", "neutral", "down"] as Trend[]) {
      const t = results.get("A0")!.trades.filter(x => x.dir === "SHORT" && x.btcD === d && x.btcW === w);
      if (!t.length) continue;
      const s = stats(t.map(x => x.netR));
      L(`  SHORT BTCd ${d.padEnd(7)} BTCw ${w.padEnd(7)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} exp=${sgn(s.exp)}`);
    }
    L();
  }

  // ── Dumps ─────────────────────────────────────────────────────────────────
  const dumpPath = `script/.cache/phase9-regime-trades-${TOTAL_CANDLES}.json`;
  writeFileSync(dumpPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    params: { TOTAL_CANDLES, START_CAPITAL, BASE_RISK_PCT, MARGIN_LEV },
    arms: [...results.entries()].map(([id, r]) => ({ id, label: r.arm.label, trades: r.trades })),
  }));
  L(`[trade dump: ${dumpPath}]`);
  const summary = {
    verdicts: verdicts.map(v => ({ ...v, full: S(v.id), slip15: S(v.id === "A2" ? "A5a" : `${v.id}s15`).exp })),
    arms: [...statsBy.entries()].map(([id, m]) => ({ id, label: results.get(id)!.arm.label, windows: Object.fromEntries([...m.entries()]) })),
  };
  writeFileSync(`script/.cache/phase9-regime-summary.json`, JSON.stringify(summary, null, 1));
  const outPath = `script/audit/phase9-report-regime.md`;
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[report written to ${outPath}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
