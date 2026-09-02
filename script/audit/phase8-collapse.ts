// ─── AUDIT PHASE 8 (2026-09-01): why did the bot collapse after the Aug 14 reset? ──
// Parameterized fork of the ENGINE-CURRENT portfolio simulation (script/audit/lib.ts,
// itself parity-checked against script/validate-pipeline.ts) that lets one run test
// the hypotheses raised by the realized paper/live trades WITHOUT touching server/:
//   • LS confidence floor applied post-hoc (candidates carry confidence)
//   • pool-quality requirement (EQL/EQH pool, wick, vol — parsed from the signal reason)
//   • guard grid: daily / rolling-7d / kill-switch thresholds, and the R unit the
//     guards are measured in (base risk% like the engine, or the actual trade risk)
//   • entry-drift models: adverse fill drift in bps (SL/TP stay at signal levels and
//     the position is right-sized to the planned $risk, exactly like liveScan), or
//     a limit order at the signal close that only fills if the next bar trades there
//   • strategy subset, LONG-in-BTC-up block, capital/risk/leverage (margin gate)
//   • per-window metrics: ALL · 2026 · last-90d · Aug14→Sep1 (the reset window)
//   • per-trade dump of any arm for a window (to match against the paper journal)
//
// Run:  npx tsx script/audit/phase8-collapse.ts [--candles=8000] [--capital=500] [--risk=2]
//       [--suite=core|guards|drift|all] [--dump=script/.cache/phase8-engine-recent.json]
// Parity: arm "ENGINE floor60" must reproduce the official report's ENGINE-CURRENT row
// (same day-keyed candle cache): T / WR / PF / sumR / exp identical.

import { writeFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import { liquiditySweepSignal, type OHLCV } from "../../server/analysis";
import type { Strategy } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause } from "../../server/portfolio-guards";
import {
  loadMarketData, dailyTrendAt, weeklyTrendAt, intervalSec, stats, bootstrapCI, maxDrawdownR,
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
const TOTAL_CANDLES = parseInt(argv.candles ?? "8000");
const START_CAPITAL = parseFloat(argv.capital ?? "500");
const BASE_RISK_PCT = parseFloat(argv.risk ?? "2");
const SUITE = argv.suite ?? "core";
const DUMP_PATH = argv.dump ?? "";
const RESET_TS = Date.UTC(2026, 7, 14, 0, 0, 0) / 1000;   // 2026-08-14 — journal reset ("day 0")
const END_TS = Date.UTC(2026, 8, 2, 0, 0, 0) / 1000;      // 2026-09-02 — export date + 1
const LAST90_TS = END_TS - 90 * 86_400;

// ── Candidates (with parsed signal quality) ────────────────────────────────
interface Cand {
  stratId: string; interval: string; symbol: string;
  tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number;
  eqPool: boolean; wick: number; vol: number; rsi: number; macroBull: boolean;
  /** Close of the SIGNAL candle — the price actually available when the engine decides. */
  sigClose: number;
  /** How many bars before the signal candle the sweep candle (whose close the strategy
   *  reports as `entry`) closed: 0 = same bar (premium sweep), 1–2 = confirmation-bar
   *  signals, −1 = other strategy / not identifiable. */
  barsAfter: number;
  /** Adverse gap between the reported entry and the real decision price, bps (+ = worse). */
  gapBps: number;
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
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;      // engine gate (not toggleable)
    if (risk <= 0 || reward / risk < MIN_RR) continue;  // engine gate (not toggleable)
    const q = parseReason(sig.reason ?? "");
    const sigClose = candles[i].close;
    const eq = (a: number, b: number) => Math.abs(a - b) <= Math.abs(b) * 1e-9;
    let barsAfter = -1;
    if (strat.id === "liquidity-sweep") {
      // Fixed strategy tags the sweep bar in the reason; fall back to matching the
      // reported entry against recent closes for the pre-fix (stale-entry) code.
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

// ── Research pool: sweep-bar signals WITHOUT the confirmation-bar rule ──────
// liquiditySweepSignal(candles, {requireConfirmation:false}) returns the sweep
// as soon as the sweep candle closes (barsAfter=0 → entry = that close = the
// price available right now → no look-ahead by construction). These are the
// signals the confirmation rule waits on; testing them directly (market entry,
// or a resting limit at the close) asks whether the edge lives in the sweep
// itself or was manufactured by the stale entry price.
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

// ── Exit resolution under an entry model ────────────────────────────────────
// "close"  → enter at the signal candle close (harness/paper behaviour)
// "drift"  → adverse market fill: entry moved AGAINST the trade by `driftBps`;
//            SL/TP stay at the signal levels; the position is right-sized so the
//            planned $risk is kept (what liveScan does) → netR is per planned risk
// "limit"  → resting limit at the signal close for ONE bar: fills only if the
//            next bar trades through the close (LONG: low ≤ close; SHORT: high ≥
//            close); unfilled → no trade. Filled trades are then managed from
//            that same bar (SL-first convention inside the bar, like the sim)
// "honest" → enter at the SIGNAL candle close (the price the engine can actually act
//            on) plus an optional extra adverse `driftBps` for venue slippage; SL/TP stay
//            structural; the trade is re-gated on the REAL entry: stop distance ≥ 0.6%
//            and R:R ≥ `minRR` (2.0 = the strategy's own floor, 1.5 = engine floor only).
//            Signals whose real R:R no longer qualifies are skipped (counted as unfilled).
// "limitK" → resting limit at the reported entry for up to `bars` bars after the
//            signal: fills when a later bar trades through it (LONG: low ≤ entry);
//            unfilled → no trade. Exits are simulated from the FILL bar onward
//            (SL-first convention inside that bar, like the production simulator).
interface EntryModel { kind: "close" | "drift" | "limit" | "honest" | "limitK"; driftBps?: number; minRR?: number; bars?: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number }

const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = JSON.stringify({ model, exitCfg });
  const hit = exitCache.get(key);
  if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    let entry = c.entry;
    let startIdx = c.entryIdx + 1;
    let filled = true;
    if (model.kind === "drift") {
      const d = (model.driftBps ?? 0) / 10_000;
      entry = c.dir === "LONG" ? c.entry * (1 + d) : c.entry * (1 - d);
    } else if (model.kind === "limit") {
      const next = candles[c.entryIdx + 1];
      if (!next) filled = false;
      else if (c.dir === "LONG" ? next.low > c.entry : next.high < c.entry) filled = false;
      // filled at the close price; manage from the same bar (startIdx unchanged)
    } else if (model.kind === "limitK") {
      const K = model.bars ?? 2;
      filled = false;
      for (let k = 1; k <= K; k++) {
        const bar = candles[c.entryIdx + k];
        if (!bar) break;
        const touched = c.dir === "LONG" ? bar.low <= c.entry : bar.high >= c.entry;
        if (touched) { filled = true; startIdx = c.entryIdx + k; break; }
      }
    } else if (model.kind === "honest") {
      const d = (model.driftBps ?? 0) / 10_000;
      entry = c.dir === "LONG" ? c.sigClose * (1 + d) : c.sigClose * (1 - d);
      const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
      const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
      const minRR = model.minRR ?? 1.5;
      if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < minRR) filled = false;
    }
    if (!filled) { out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", tp1Hit: false, filled: false, entryUsed: entry }; continue; }
    // A drifted entry can sit beyond the stop or the TP → degenerate; treat as an
    // immediate stop-out at −1R (the venue stop would be hit at once) / skip TP side.
    const riskNow = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    if (riskNow <= 0) { out[c.idx] = { netR: -1, exitTsSec: c.tsSec + c.ivSec, barsHeld: 1, outcome: "loss", tp1Hit: false, filled: true, entryUsed: entry }; continue; }
    const tp1Ok = c.dir === "LONG" ? c.takeProfit1 > entry : c.takeProfit1 < entry;
    const tp1 = tp1Ok ? c.takeProfit1 : (c.dir === "LONG" ? entry + riskNow * 1.5 : entry - riskNow * 1.5);
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > tp1 : tp2raw < tp1) ? tp2raw : tp1;
    const future = candles.slice(startIdx, startIdx + c.maxBars);
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: tp1, takeProfit2: tp2 }, future, exitCfg);
    const heldFromSignal = (startIdx - (c.entryIdx + 1)) + ex.barsHeld;
    out[c.idx] = { netR: ex.netR, exitTsSec: c.tsSec + heldFromSignal * c.ivSec, barsHeld: heldFromSignal, outcome: ex.outcome, tp1Hit: ex.tp1Hit, filled: true, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

// ── Portfolio simulation (parameterized ENGINE-CURRENT) ─────────────────────
interface Arm {
  label: string;
  /** Use the research candidate pool (sweep-bar signals, no confirmation rule) instead of the registry strategies.
   *  combo68 = sweep-bar LS (floor 68) merged with the registry's non-LS strategies (B&R, RSI). */
  pool?: "registry" | "sweepBar60" | "sweepBar68" | "combo68";
  floor?: Record<string, number>;          // per-strategy confidence floor override (LS default 60 = code)
  requireEqBelow?: number;                 // LS: below this confidence, require an EQL/EQH pool
  minWick?: number; minVol?: number;       // LS quality gates
  minBarsAfterZero?: boolean;              // LS: only same-bar (premium) sweeps
  strategies?: string[];
  blockLongBtcUp?: boolean;
  daily?: number | null; rolling?: number | null; ksMin?: number; ksMax?: number | null; // guards (null = off)
  rUnit?: "base" | "trade";                // R unit for guards: balance×base% (engine) or ×riskMultiplier
  maxOpen?: number; marginLeverage?: number;
  entry?: EntryModel;
  exit?: ManagedExitConfig;
  capital?: number; riskPct?: number;
}
interface SimTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT"; confidence: number; eqPool: boolean; barsAfter: number;
  netR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number;
  btcD: Trend; outcome: string; tp1Hit: boolean; barsHeld: number; entry: number; entryUsed: number; stopLoss: number; tp1: number; slDistPct: number;
}
interface SimOut { label: string; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number }

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const exitCfg = arm.exit ?? ENGINE_EXIT;
  const exits = resolveExits(allCands, streams, arm.entry ?? { kind: "close" }, exitCfg);
  const active = new Set(arm.strategies ?? strategies.map(s => s.id));
  const cands = allCands
    .filter(c => active.has(c.stratId))
    .filter(c => {
      const fl = arm.floor?.[c.stratId];
      if (fl != null && c.confidence < fl) return false;
      if (c.stratId === "liquidity-sweep") {
        if (arm.requireEqBelow != null && c.confidence < arm.requireEqBelow && !c.eqPool) return false;
        if (arm.minWick != null && !(c.wick >= arm.minWick)) return false;
        if (arm.minVol != null && !(c.vol >= arm.minVol)) return false;
        if (arm.minBarsAfterZero && c.barsAfter !== 0) return false;
      }
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
    const oneR = balance * baseRiskPct / 100 * (arm.rUnit === "trade" ? riskMultiplier : 1);

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
    if (arm.blockLongBtcUp && c.dir === "LONG" && btcDailyTrend === "up") { block("longBtcUp"); continue; }

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
      symbol: c.symbol, strategy: c.stratId, dir: c.dir, confidence: c.confidence, eqPool: c.eqPool, barsAfter: c.barsAfter,
      netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, outcome: ex.outcome, tp1Hit: ex.tp1Hit, barsHeld: ex.barsHeld,
      entry: c.entry, entryUsed: ex.entryUsed, stopLoss: c.stopLoss, tp1: c.takeProfit1, slDistPct: c.slDistPct,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, notionalUsd, trade });
    openBySymbol.set(c.symbol, list);
    openNotional += notionalUsd;
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { label: arm.label, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100 };
}

// ── Reporting ───────────────────────────────────────────────────────────────
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
function row(trades: SimTrade[], fromSec: number, toSec = Number.MAX_SAFE_INTEGER): string {
  const t = trades.filter(x => x.openedSec >= fromSec && x.openedSec < toSec);
  const rs = t.map(x => x.netR);
  const s = stats(rs);
  const dd = maxDrawdownR(rs);
  return `T=${String(s.n).padStart(4)} WR=${f(s.wr, 0).padStart(3)}% PF=${f(s.pf).padStart(5)} sumR=${(s.sumR >= 0 ? "+" : "") + f(s.sumR, 1).padStart(6)} exp=${(s.exp >= 0 ? "+" : "") + f(s.exp, 3)} maxDD=${f(dd, 1)}R`;
}
function report(out: SimOut, lines: string[]) {
  const L = (s: string) => { console.log(s); lines.push(s); };
  L(`## ${out.label}`);
  L(`  ALL     ${row(out.trades, 0)}  balDD=${f(out.maxDDpct, 1)}%`);
  L(`  2026    ${row(out.trades, YEAR_2026_TS)}`);
  L(`  last90d ${row(out.trades, LAST90_TS)}`);
  L(`  Aug14→  ${row(out.trades, RESET_TS, END_TS)}`);
  const blocked = Object.entries(out.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ");
  L(`  blocks: ${blocked || "none"}`);
  L("");
}

async function main() {
  const strategies = getAllStrategies();
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 8 — collapse diagnosis — ${new Date().toISOString().slice(0, 10)}`);
  L(`candles ${TOTAL_CANDLES} · capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · suite ${SUITE}`);
  const { streams, md } = await loadMarketData(strategies, TOTAL_CANDLES);
  const cands: Cand[] = [];
  for (const strat of strategies) for (const sym of strat.preferredSymbols ?? []) {
    const c = streams.get(`${sym}:${strat.interval}`);
    if (c) cands.push(...buildCandidates(strat, sym, c));
  }
  cands.forEach((c, i) => { c.idx = i; });
  L(`candidates (post minSL+RR): ${cands.length}`);
  const ls = cands.filter(c => c.stratId === "liquidity-sweep");
  L(`LS candidates by confidence: ` + [60, 65, 70, 75, 80, 85].map(b => `${b}:${ls.filter(c => c.confidence === b).length}`).join(" ") + ` | eqPool ${ls.filter(c => c.eqPool).length}/${ls.length}`);
  L("");

  const ENGINE: Arm = { label: "ENGINE floor60 (parity with official report)" };
  const arms: Arm[] = [ENGINE];
  if (SUITE === "core" || SUITE === "all") {
    arms.push(
      { label: "FLOOR 68 (pre-Aug-14 code)", floor: { "liquidity-sweep": 68 } },
      { label: "FLOOR 65", floor: { "liquidity-sweep": 65 } },
      { label: "FLOOR 70", floor: { "liquidity-sweep": 70 } },
      { label: "FLOOR 60 + EQ pool required below 70", requireEqBelow: 70 },
      { label: "FLOOR 60 + EQ pool required below 68", requireEqBelow: 68 },
      { label: "FLOOR 68 − RSI", floor: { "liquidity-sweep": 68 }, strategies: ["liquidity-sweep", "break-retest"] },
      { label: "FLOOR 68 LS only", floor: { "liquidity-sweep": 68 }, strategies: ["liquidity-sweep"] },
      { label: "FLOOR 68 − RSI + block LONG when BTC daily up", floor: { "liquidity-sweep": 68 }, strategies: ["liquidity-sweep", "break-retest"], blockLongBtcUp: true },
      { label: "FLOOR 60 − RSI", strategies: ["liquidity-sweep", "break-retest"] },
      { label: "FLOOR 60 wick≥1.5", minWick: 1.5 },
      { label: "FLOOR 60 vol≥1.5", minVol: 1.5 },
      { label: "PAPER params: floor60 $1000 1% margin10x", capital: 1000, riskPct: 1, marginLeverage: 10 },
      { label: "PAPER params: floor68 $1000 1% margin10x", capital: 1000, riskPct: 1, marginLeverage: 10, floor: { "liquidity-sweep": 68 } },
    );
  }
  if (SUITE === "guards" || SUITE === "all") {
    for (const fl of [60, 68]) {
      const base: Arm = { label: "", floor: { "liquidity-sweep": fl } };
      arms.push(
        { ...base, label: `GUARDS floor${fl}: engine (daily4 rolling6 ks-3/4, R=base)` },
        { ...base, label: `GUARDS floor${fl}: R unit = trade risk`, rUnit: "trade" },
        { ...base, label: `GUARDS floor${fl}: rolling 8`, rolling: 8 },
        { ...base, label: `GUARDS floor${fl}: rolling 10`, rolling: 10 },
        { ...base, label: `GUARDS floor${fl}: rolling off`, rolling: null },
        { ...base, label: `GUARDS floor${fl}: kill-switch off`, ksMax: null },
        { ...base, label: `GUARDS floor${fl}: kill-switch -5R/8 trades`, ksMin: 8, ksMax: -5 },
        { ...base, label: `GUARDS floor${fl}: daily off`, daily: null },
        { ...base, label: `GUARDS floor${fl}: daily 6`, daily: 6 },
        { ...base, label: `GUARDS floor${fl}: rolling 10 + ks -5/8`, rolling: 10, ksMin: 8, ksMax: -5 },
        { ...base, label: `GUARDS floor${fl}: all portfolio guards off`, daily: null, rolling: null, ksMax: null },
      );
    }
  }
  if (SUITE === "honest" || SUITE === "all") {
    const H = (minRR: number, driftBps = 0): EntryModel => ({ kind: "honest", minRR, driftBps });
    arms.push(
      { label: "HONEST floor60 minRR1.5 (engine gate only)", entry: H(1.5) },
      { label: "HONEST floor60 minRR2.0 (strategy floor re-applied)", entry: H(2.0) },
      { label: "HONEST floor68 minRR2.0", floor: { "liquidity-sweep": 68 }, entry: H(2.0) },
      { label: "HONEST floor60 minRR2.0 +15bps venue slip", entry: H(2.0, 15) },
      { label: "HONEST floor60 minRR2.0 +30bps venue slip", entry: H(2.0, 30) },
      { label: "HONEST floor60 minRR2.0 − RSI", entry: H(2.0), strategies: ["liquidity-sweep", "break-retest"] },
      { label: "HONEST floor60 minRR2.0 LS only", entry: H(2.0), strategies: ["liquidity-sweep"] },
      { label: "HONEST floor60 minRR2.0 − RSI + block LONG BTC up", entry: H(2.0), strategies: ["liquidity-sweep", "break-retest"], blockLongBtcUp: true },
      { label: "HONEST floor68 minRR2.0 − RSI + block LONG BTC up", floor: { "liquidity-sweep": 68 }, entry: H(2.0), strategies: ["liquidity-sweep", "break-retest"], blockLongBtcUp: true },
      { label: "HONEST floor60 minRR2.0 EQ pool only", entry: H(2.0), requireEqBelow: 100 },
      { label: "HONEST floor60 minRR2.0 wick≥1.5", entry: H(2.0), minWick: 1.5 },
      { label: "HONEST floor60 minRR2.0 guards off", entry: H(2.0), daily: null, rolling: null, ksMax: null },
      { label: "HONEST floor60 minRR2.0 rolling10 ks-5/8", entry: H(2.0), rolling: 10, ksMin: 8, ksMax: -5 },
      { label: "HONEST floor60 minRR2.0 paper params $1000 1% 10x", entry: H(2.0), capital: 1000, riskPct: 1, marginLeverage: 10 },
    );
  }
  if (SUITE === "drift" || SUITE === "all") {
    for (const fl of [60, 68]) {
      for (const bps of [25, 57, 84, 120]) {
        arms.push({ label: `DRIFT floor${fl}: adverse fill +${bps}bps (SL/TP fixed, right-sized)`, floor: { "liquidity-sweep": fl }, entry: { kind: "drift", driftBps: bps } });
      }
      arms.push({ label: `LIMIT floor${fl}: rest at signal close for 1 bar`, floor: { "liquidity-sweep": fl }, entry: { kind: "limit" } });
      arms.push({ label: `DRIFT floor${fl} −RSI +57bps`, floor: { "liquidity-sweep": fl }, strategies: ["liquidity-sweep", "break-retest"], entry: { kind: "drift", driftBps: 57 } });
    }
  }

  // research pools (built lazily — only when a research arm asks for them)
  const pools = new Map<string, Cand[]>();
  const poolFor = (name: "sweepBar60" | "sweepBar68" | "combo68"): Cand[] => {
    let p = pools.get(name);
    if (!p) {
      p = [];
      if (name === "combo68") {
        const sb = poolFor("sweepBar68").map(c => ({ ...c }));
        const others = cands.filter(c => c.stratId !== "liquidity-sweep").map(c => ({ ...c }));
        p = [...sb, ...others];
      } else {
        const floor = name === "sweepBar60" ? 60 : 68;
        const ls = strategies.find(s => s.id === "liquidity-sweep")!;
        for (const sym of ls.preferredSymbols ?? []) {
          const c = streams.get(`${sym}:1h`);
          if (c) p.push(...buildSweepBarCandidates(sym, c, floor));
        }
      }
      p.forEach((c, i) => { c.idx = i; });
      pools.set(name, p);
      exitCache.clear(); // exit cache is keyed by model only — pools index candidates differently
      L(`research pool ${name}: ${p.length} candidates`);
    }
    return p;
  };
  if (SUITE === "sweepbar" || SUITE === "all") {
    // Deep dive on the "enter at the sweep-bar close, no confirmation rule" family.
    const SB = (extra: Partial<Arm>, label: string): Arm => ({ label, pool: "sweepBar60", strategies: ["liquidity-sweep"], ...extra });
    for (const fl of [60, 65, 68, 70, 75, 80]) arms.push(SB({ floor: { "liquidity-sweep": fl } }, `SWEEP-BAR floor${fl}: market at sweep close`));
    arms.push(
      SB({ floor: { "liquidity-sweep": 68 }, entry: { kind: "honest", minRR: 2.0, driftBps: 15 } }, "SWEEP-BAR floor68 +15bps venue slip"),
      SB({ floor: { "liquidity-sweep": 68 }, entry: { kind: "honest", minRR: 2.0, driftBps: 30 } }, "SWEEP-BAR floor68 +30bps venue slip"),
      SB({ floor: { "liquidity-sweep": 68 }, requireEqBelow: 100 }, "SWEEP-BAR floor68 EQ pool only"),
      SB({ floor: { "liquidity-sweep": 68 }, blockLongBtcUp: true }, "SWEEP-BAR floor68 + block LONG BTC up"),
      SB({ floor: { "liquidity-sweep": 68 }, daily: null, rolling: null, ksMax: null }, "SWEEP-BAR floor68 guards off"),
      SB({ floor: { "liquidity-sweep": 68 }, rolling: 10, ksMin: 8, ksMax: -5 }, "SWEEP-BAR floor68 rolling10 ks-5/8"),
      SB({ floor: { "liquidity-sweep": 68 }, maxOpen: 6 }, "SWEEP-BAR floor68 maxOpen 6"),
      SB({ floor: { "liquidity-sweep": 68 }, capital: 1000, riskPct: 1, marginLeverage: 10 }, "SWEEP-BAR floor68 paper params $1000 1% 10x"),
      SB({ floor: { "liquidity-sweep": 68 }, capital: 110, riskPct: 0.5, marginLeverage: 7 }, "SWEEP-BAR floor68 live params $110 0.5% 7x"),
      { label: "COMBO: sweep-bar68 LS + registry B&R + RSI", pool: "combo68" },
      { label: "COMBO: sweep-bar68 LS + registry B&R (no RSI)", pool: "combo68", strategies: ["liquidity-sweep", "break-retest"] },
      { label: "COMBO: sweep-bar68 LS + B&R, +15bps slip", pool: "combo68", strategies: ["liquidity-sweep", "break-retest"], entry: { kind: "honest", minRR: 1.5, driftBps: 15 } },
    );
  }
  if (SUITE === "research" || SUITE === "all") {
    arms.push(
      { label: "SWEEP-BAR floor60: market at sweep close (no confirmation rule)", pool: "sweepBar60", strategies: ["liquidity-sweep"] },
      { label: "SWEEP-BAR floor68: market at sweep close (no confirmation rule)", pool: "sweepBar68", strategies: ["liquidity-sweep"] },
      { label: "SWEEP-BAR floor60: limit at sweep close, TTL 1 bar", pool: "sweepBar60", strategies: ["liquidity-sweep"], entry: { kind: "limitK", bars: 1 } },
      { label: "SWEEP-BAR floor60: limit at sweep close, TTL 2 bars", pool: "sweepBar60", strategies: ["liquidity-sweep"], entry: { kind: "limitK", bars: 2 } },
      { label: "SWEEP-BAR floor60: limit TTL 2 bars, EQ pool only", pool: "sweepBar60", strategies: ["liquidity-sweep"], entry: { kind: "limitK", bars: 2 }, requireEqBelow: 100 },
      { label: "SWEEP-BAR floor60: market, EQ pool only", pool: "sweepBar60", strategies: ["liquidity-sweep"], requireEqBelow: 100 },
      { label: "SWEEP-BAR floor60: market, wick≥1.5 vol≥1.5", pool: "sweepBar60", strategies: ["liquidity-sweep"], minWick: 1.5, minVol: 1.5 },
      { label: "SWEEP-BAR floor60: market + block LONG BTC up", pool: "sweepBar60", strategies: ["liquidity-sweep"], blockLongBtcUp: true },
      { label: "SWEEP-BAR floor60: market, guards off", pool: "sweepBar60", strategies: ["liquidity-sweep"], daily: null, rolling: null, ksMax: null },
      { label: "FIXED-STRATEGY floor60 − RSI (registry pool, honest by construction)", strategies: ["liquidity-sweep", "break-retest"] },
      { label: "FIXED-STRATEGY floor60 − RSI + block LONG BTC up", strategies: ["liquidity-sweep", "break-retest"], blockLongBtcUp: true },
      { label: "FIXED-STRATEGY floor60 EQ pool only", requireEqBelow: 100 },
      { label: "FIXED-STRATEGY floor60 same-bar sweeps only (barsAfter=0)", minBarsAfterZero: true },
    );
  }

  const results: SimOut[] = [];
  let lastPoolName = "registry";
  for (const arm of arms) {
    const poolName = arm.pool ?? "registry";
    if (poolName !== lastPoolName) { exitCache.clear(); lastPoolName = poolName; }
    const pool = poolName !== "registry" ? poolFor(poolName as "sweepBar60" | "sweepBar68" | "combo68") : cands;
    const r = simulate(arm, pool, streams, md, strategies);
    results.push(r);
    report(r, lines);
  }

  // ── Deep dive on the candidate configuration ─────────────────────────────
  const dive = results.find(r => r.label === "SWEEP-BAR floor68: market at sweep close");
  if (dive) {
    const T = dive.trades.filter(t => t.strategy === "liquidity-sweep");
    const rs = T.map(t => t.netR);
    const ci = bootstrapCI(rs, 10_000);
    const sorted = [...rs].sort((a, b) => b - a);
    const top5 = sorted.slice(0, 5).reduce((a, b) => a + b, 0);
    const sumR = rs.reduce((a, b) => a + b, 0);
    L(`## DEEP DIVE — ${dive.label}`);
    L(`  n=${T.length} exp=${f(sumR / T.length, 3)} CI95=[${f(ci.lo)}, ${f(ci.hi)}] top5 share of sumR=${f(100 * top5 / sumR, 0)}% expWithoutTop5=${f((sumR - top5) / (T.length - 5), 3)} maxDD=${f(maxDrawdownR(rs), 1)}R`);
    for (const pen of [0.12, 0.25]) L(`  with −${pen}R/trade execution penalty: exp=${f(sumR / T.length - pen, 3)} sumR=${f(sumR - pen * T.length, 1)}`);
    // halves
    const t0 = Math.min(...T.map(t => t.openedSec)), t1 = Math.max(...T.map(t => t.openedSec)), mid = (t0 + t1) / 2;
    for (const [lbl, pred] of [["H1", (t: SimTrade) => t.openedSec < mid], ["H2", (t: SimTrade) => t.openedSec >= mid]] as Array<[string, (t: SimTrade) => boolean]>) {
      const s = stats(T.filter(pred).map(t => t.netR));
      L(`  ${lbl}: T=${s.n} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${f(s.sumR, 1)} exp=${f(s.exp, 3)}`);
    }
    // monthly
    const byMonth = new Map<string, number[]>();
    for (const t of T) { const m = new Date(t.openedSec * 1000).toISOString().slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), t.netR]); }
    L(`  monthly: ` + [...byMonth.entries()].sort().map(([m, r]) => `${m}:${(r.reduce((a, b) => a + b, 0) >= 0 ? "+" : "") + f(r.reduce((a, b) => a + b, 0), 1)}R/${r.length}`).join("  "));
    // per band / pool / direction / regime
    for (const b of [68, 70, 75, 80, 85]) { const s = stats(T.filter(t => t.confidence === b).map(t => t.netR)); if (s.n) L(`  conf ${b}: T=${s.n} WR=${f(s.wr, 0)}% PF=${f(s.pf)} exp=${f(s.exp, 3)} sumR=${f(s.sumR, 1)}`); }
    for (const [lbl, pred] of [["EQ pool", (t: SimTrade) => t.eqPool], ["swing pool", (t: SimTrade) => !t.eqPool], ["LONG", (t: SimTrade) => t.dir === "LONG"], ["SHORT", (t: SimTrade) => t.dir === "SHORT"]] as Array<[string, (t: SimTrade) => boolean]>) {
      const s = stats(T.filter(pred).map(t => t.netR)); L(`  ${lbl}: T=${s.n} WR=${f(s.wr, 0)}% PF=${f(s.pf)} exp=${f(s.exp, 3)} sumR=${f(s.sumR, 1)}`);
    }
    for (const dir of ["LONG", "SHORT"]) for (const tr of ["up", "neutral", "down"]) { const s = stats(T.filter(t => t.dir === dir && t.btcD === tr).map(t => t.netR)); if (s.n) L(`  ${dir} · BTC ${tr}: T=${s.n} WR=${f(s.wr, 0)}% PF=${f(s.pf)} exp=${f(s.exp, 3)} sumR=${f(s.sumR, 1)}`); }
    // exits
    const byExit = new Map<string, number[]>();
    for (const t of T) byExit.set(t.outcome, [...(byExit.get(t.outcome) ?? []), t.netR]);
    L(`  exits: ` + [...byExit.entries()].map(([k, r]) => `${k}=${r.length} (avg ${f(r.reduce((a, b) => a + b, 0) / r.length, 2)}R)`).join("  "));
    // per coin
    const byCoin = new Map<string, number[]>();
    for (const t of T) byCoin.set(t.symbol, [...(byCoin.get(t.symbol) ?? []), t.netR]);
    const coins = [...byCoin.entries()].map(([sym, r]) => ({ sym, n: r.length, sumR: r.reduce((a, b) => a + b, 0) })).sort((a, b) => b.sumR - a.sumR);
    L(`  coins positive: ${coins.filter(c => c.sumR > 0).length}/${coins.length}; top: ${coins.slice(0, 6).map(c => `${c.sym} +${f(c.sumR, 1)}/${c.n}`).join(" ")}; bottom: ${coins.slice(-6).map(c => `${c.sym} ${f(c.sumR, 1)}/${c.n}`).join(" ")}`);
    L("");
  }

  // ── by sweep-bar offset for the first arm (honest by construction after the fix) ──
  {
    L(`## ${results[0].label} — LS trades by sweep-bar offset`);
    for (const ba of [0, 1, 2]) {
      const t = results[0].trades.filter(x => x.strategy === "liquidity-sweep" && x.barsAfter === ba);
      if (!t.length) continue;
      const rs = t.map(x => x.netR); const s = stats(rs); const ci = bootstrapCI(rs, 4000);
      L(`  barsAfter=${ba}: T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${f(s.sumR, 1)} exp=${f(s.exp, 3)} CI95=[${f(ci.lo)}, ${f(ci.hi)}]`);
    }
    L("");
  }

  // ── Stale-entry anatomy: how far is the reported entry from the decision price? ──
  const lsC = cands.filter(c => c.stratId === "liquidity-sweep");
  const q = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
  L(`## LS candidates — sweep-bar offset and stale-entry gap (bps, + = real price is WORSE than reported entry)`);
  for (const ba of [0, 1, 2, -1]) {
    const g = lsC.filter(c => c.barsAfter === ba).map(c => c.gapBps);
    if (!g.length) continue;
    L(`  barsAfter=${ba}: n=${g.length} (${f(100 * g.length / lsC.length, 0)}%) gap median=${f(q(g, 0.5), 0)} mean=${f(g.reduce((a, b) => a + b, 0) / g.length, 0)} p75=${f(q(g, 0.75), 0)} p90=${f(q(g, 0.9), 0)} adverse=${f(100 * g.filter(x => x > 0).length / g.length, 0)}%`);
  }
  for (const b of [60, 65, 70, 75, 80, 85]) {
    const cs = lsC.filter(c => c.confidence === b);
    const g = cs.map(c => c.gapBps);
    if (!g.length) continue;
    const stale = cs.filter(c => c.barsAfter > 0).length;
    L(`  conf ${b}: n=${g.length} stale(barsAfter>0)=${f(100 * stale / g.length, 0)}% gap median=${f(q(g, 0.5), 0)} mean=${f(g.reduce((a, b) => a + b, 0) / g.length, 0)} | median stop dist=${f(q(cs.map(c => c.slDistPct * 1e4), 0.5), 0)}bps`);
  }
  {
    const g = lsC.map(c => c.gapBps);
    L(`  ALL LS: n=${g.length} gap median=${f(q(g, 0.5), 0)} mean=${f(g.reduce((a, b) => a + b, 0) / g.length, 0)} p90=${f(q(g, 0.9), 0)} | gap/stopDist median=${f(q(lsC.map(c => c.gapBps / (c.slDistPct * 1e4)), 0.5), 2)}`);
  }
  L("");

  // ── Confidence-band table for the ENGINE arm (what does each band contribute?) ──
  const eng = results[0];
  L(`## ENGINE arm — LS trades by confidence band`);
  for (const win of [["ALL", 0, Number.MAX_SAFE_INTEGER], ["2026", YEAR_2026_TS, Number.MAX_SAFE_INTEGER], ["last90d", LAST90_TS, Number.MAX_SAFE_INTEGER], ["Aug14→", RESET_TS, END_TS]] as Array<[string, number, number]>) {
    L(`  [${win[0]}]`);
    for (const b of [60, 65, 70, 75, 80, 85]) {
      const t = eng.trades.filter(x => x.strategy === "liquidity-sweep" && x.confidence === b && x.openedSec >= win[1] && x.openedSec < win[2]);
      if (!t.length) continue;
      const rs = t.map(x => x.netR); const s = stats(rs); const ci = bootstrapCI(rs, 4000);
      L(`    conf ${b}: T=${String(s.n).padStart(4)} WR=${f(s.wr, 0).padStart(3)}% PF=${f(s.pf).padStart(5)} sumR=${(s.sumR >= 0 ? "+" : "") + f(s.sumR, 1)} exp=${(s.exp >= 0 ? "+" : "") + f(s.exp, 3)} CI95=[${f(ci.lo, 2)}, ${f(ci.hi, 2)}]`);
    }
    const sw = eng.trades.filter(x => x.strategy === "liquidity-sweep" && !x.eqPool && x.openedSec >= win[1] && x.openedSec < win[2]).map(x => x.netR);
    const eq = eng.trades.filter(x => x.strategy === "liquidity-sweep" && x.eqPool && x.openedSec >= win[1] && x.openedSec < win[2]).map(x => x.netR);
    const ss = stats(sw), se = stats(eq);
    L(`    swing pool: T=${ss.n} exp=${f(ss.exp, 3)} PF=${f(ss.pf)} | EQ pool: T=${se.n} exp=${f(se.exp, 3)} PF=${f(se.pf)}`);
  }
  L("");
  // Direction × BTC daily — ENGINE arm, recent windows
  L(`## ENGINE arm — direction × BTC daily`);
  for (const win of [["ALL", 0, Number.MAX_SAFE_INTEGER], ["last90d", LAST90_TS, Number.MAX_SAFE_INTEGER], ["Aug14→", RESET_TS, END_TS]] as Array<[string, number, number]>) {
    for (const dir of ["LONG", "SHORT"]) for (const tr of ["up", "neutral", "down"]) {
      const t = eng.trades.filter(x => x.dir === dir && x.btcD === tr && x.openedSec >= win[1] && x.openedSec < win[2]);
      if (!t.length) continue;
      const s = stats(t.map(x => x.netR));
      L(`  [${win[0].padEnd(7)}] ${dir.padEnd(5)} BTC ${tr.padEnd(7)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${f(s.sumR, 1)} exp=${f(s.exp, 3)}`);
    }
  }
  L("");

  if (DUMP_PATH) {
    const recent = eng.trades.filter(t => t.openedSec >= RESET_TS - 2 * 86_400);
    writeFileSync(DUMP_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), arm: eng.label, trades: recent }, null, 0));
    L(`[dumped ${recent.length} ENGINE-arm trades since Aug 12 to ${DUMP_PATH}]`);
  }
  const outPath = `script/audit/phase8-report-${SUITE}-${TOTAL_CANDLES}.md`;
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[report written to ${outPath}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
