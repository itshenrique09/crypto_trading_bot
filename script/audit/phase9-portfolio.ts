// ─── AUDIT PHASE 9 (2026-09-02) — PORTFOLIO stage ────────────────────────────
// Fork of script/audit/phase8-collapse.ts (candidate builder, honest exit resolution,
// parameterized ENGINE-CURRENT portfolio simulate) that merges the candidate pools of
// the phase-9 components into one book and runs the PRE-REGISTERED portfolio grid.
// server/ and client/ are NOT touched.
//
// COMPONENT VERDICTS RECEIVED (inputs, not re-derived here):
//   regime  → A2 "LS SHORT-only AND BTC daily UP" = literal ACCEPT-LIVE-CANDIDATE (fragile)
//   brrsi   → break-retest REJECT, rsi-divergence REJECT (selection-bias rule failed)
//   tsmom   → T0 TSMOM daily standalone = literal PAPER-CANDIDATE (order-fragile)
//
// PRE-REGISTERED PORTFOLIOS (from the brief):
//   P0 = LS floor 68 both directions + B&R + RSI   (current honest engine — baseline)
//   P1 = B&R + RSI (no LS)                         (baseline)
//   P2 = P1 + LS SHORT-only when BTC daily UP      (regime filter passed)
//   P3 = P1 + TSMOM                                (TSMOM passed as PAPER-CANDIDATE)
//   P4 = P2 + TSMOM
// RULE APPLIED: "build only from components that reached PAPER-CANDIDATE or better; a
//   portfolio containing a REJECTED component is not run except P0/P1 baselines". B&R and
//   RSI were REJECTED by the brrsi stage, so P2–P4 AS WRITTEN contain rejected components.
//   Decision (taken before any run): P2–P4 are still simulated because they were named in
//   the brief, but they are labelled REFERENCE and are NOT eligible for a recommendation.
//   The promotable set is built from the eligible components only:
//   E2 = LS SHORT-only & BTC daily UP (alone) · E3 = TSMOM (alone) · E4 = E2 + TSMOM.
//
// GRID PER PORTFOLIO (fixed): guards ∈ {engine trio (daily −4R / rolling-7d −6R / kill-switch
//   −3R over ≥4 trades), OFF, DESIGN dd-guard X ∈ {8,12,16}R (peak-to-valley in trade-R, 30d
//   peak window, resume X/2, bounded halt 24h with re-base)} × maxOpen ∈ {6,10} × entry
//   slippage ∈ {0, +15 bps adverse (SL/TP fixed, right-sized, R:R re-gated ≥ 1.5)}.
// VERDICT OF RECORD per portfolio = the engine-default cell (trio guards, maxOpen 10, 0 bps),
//   with exp@+15bps taken from the paired slippage cell. The other cells are the grid.
// GUARD-GRID RULE (fixed): for each portfolio × maxOpen, the recommended X is the one with the
//   lowest maxDD(R) among {8,12,16} whose sumR ≥ 90 % of the guards-OFF sumR (only defined when
//   guards-OFF sumR > 0); ties → larger X (less intervention).
// WINDOWS: FULL = the 20000×1h decision span (≈ 2024-05-31 → 2026-09-02; the acceptance
//   window; 4h/1d components trade from their own longer histories and positions opened before
//   FULL_START occupy slots realistically) · H1/H2 = time halves of FULL · 2026 · Aug14→Sep1
//   (parity with the realized paper/live only) · EXT = every trade (own histories).
// ACCEPTANCE FOR PAPER (portfolio, applied literally on FULL): exp ≥ +0.20R; PF ≥ 1.30; CI95
//   lower > 0; both halves ≥ +0.10R; ≥ 80 trades/yr; maxDD(R) ≤ 25R (at 2 % risk); exp under
//   +15 bps ≥ +0.10R. The general ACCEPT-LIVE-CANDIDATE rule is also evaluated and reported.
// POST-HOC (labelled, never used for a verdict): same-timestamp order shuffles (10 seeds) for
//   the eligible portfolios; funding drag −0.03 %/day on every position (matters for TSMOM's
//   multi-week holds); per-strategy sleeve breakdown inside each book.
//
// Run:  npx tsx script/audit/phase9-portfolio.ts [--capital=500] [--risk=2] [--quick] [--seeds=10]
// Type-check: npx tsc --noEmit --module esnext --moduleResolution bundler --target esnext --strict
//   --skipLibCheck --esModuleInterop --allowImportingTsExtensions --types node script/audit/phase9-portfolio.ts

import { existsSync, readFileSync, writeFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import type { OHLCV } from "../../server/analysis";
import type { Strategy, StrategySignal } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause, type ClosedTradeLite } from "../../server/portfolio-guards";
import {
  fetchPaginated, dailyTrendAt, weeklyTrendAt, intervalSec, stats, bootstrapCI, maxDrawdownR, calcATRLocal, mulberry32,
  COIN_GROUP, MAX_PER_GROUP, ROLLING_WINDOW_MS, MIN_SL_DISTANCE_PCT, MIN_RR,
  YEAR_2026_TS, ENGINE_EXIT, type MarketData, type Trend,
} from "./lib";

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const START_CAPITAL = parseFloat(argv.capital ?? "500");
const BASE_RISK_PCT = parseFloat(argv.risk ?? "2");
const QUICK = argv.quick === "true";
const SEEDS = parseInt(argv.seeds ?? "10");
const C1H = 20000, C4H = 8000, C4H_PARITY = 20000, C1D = 1500;
const FUNDING_PCT_PER_DAY = 0.03 / 100;
const RESET_TS = Date.UTC(2026, 7, 14) / 1000;       // 2026-08-14 journal reset
const END_TS = Date.UTC(2026, 8, 2) / 1000;          // 2026-09-02 export date + 1
const YEAR_SEC = 365.25 * 86_400;
const CACHE_DIR = "script/.cache";
const DAY_KEY = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 2) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const lines: string[] = [];
const L = (s = "") => { console.log(s); lines.push(s); };

// ── TSMOM prototype (verbatim from phase6/phase9-tsmom: Donchian-55 close breakout, 2×ATR20) ──
function makeTsmom(universe: string[], donchianN = 55, stopK = 2.0): Strategy {
  return {
    id: "tsmom",
    name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`,
    description: "Time-series momentum prototype — daily Donchian close breakout, ATR stop.",
    interval: "1d",
    minCandles: Math.max(donchianN + 25, 80),
    preferredSymbols: [...universe],
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
      return { direction: dir, entry, stopLoss, takeProfit1, takeProfit2, confidence: 70, confluenceScore: 70, reason: `TSMOM ${dir} Donchian${donchianN} stop ${stopK}×ATR20` };
    },
  };
}

// ── Candidates ──────────────────────────────────────────────────────────────
interface Cand {
  stratId: string; interval: string; symbol: string;
  tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number;
  /** Close of the SIGNAL candle — the price the engine can act on (fixed LS: entry === sigClose). */
  sigClose: number;
  streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
}
const MAX_BARS: Record<string, number> = { "1h": 200, "4h": 60, "1d": 200 };

function buildCandidates(strat: Strategy, symbol: string, candles: OHLCV[], streamKey: string): Cand[] {
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
      streamKey, entryIdx: i, maxBars, ivSec, idx: -1,
    });
  }
  return out;
}

// ── Exit resolution — HONEST entry (signal-candle close ± adverse drift) ────
// SL/TP stay structural; the trade is re-gated on the real entry (stop ≥ 0.6 %, R:R ≥ 1.5 = the
// engine's fill re-gate) and right-sized to the planned $risk, so netR is per planned risk.
// fundingPctPerDay (POST-HOC arms only): perp funding drag on the full position for the whole
// hold, converted to R via the real stop distance (conservative: ignores the 60 % TP1 reduction).
interface EntryModel { driftBps: number; fundingPctPerDay: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number }
const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = poolName + "|" + JSON.stringify({ model, exitCfg });
  const hit = exitCache.get(key);
  if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    const d = model.driftBps / 10_000;
    const entry = c.dir === "LONG" ? c.sigClose * (1 + d) : c.sigClose * (1 - d);
    const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
    if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < MIN_RR) {
      out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", tp1Hit: false, filled: false, entryUsed: entry };
      continue;
    }
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > c.takeProfit1 : tp2raw < c.takeProfit1) ? tp2raw : c.takeProfit1;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + c.maxBars);
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: tp2 }, future, exitCfg);
    const holdDays = ex.barsHeld * c.ivSec / 86_400;
    const fundingR = model.fundingPctPerDay > 0 ? (model.fundingPctPerDay * holdDays) / (riskH / entry) : 0;
    out[c.idx] = { netR: ex.netR - fundingR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, tp1Hit: ex.tp1Hit, filled: true, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

// ── DESIGN guard (GUARD-1) — copied verbatim from phase9-design.ts ──────────
// Peak-to-valley drawdown of the realized equity curve in TRADE-R (Σ pnl_usd / risk_usd),
// against the highest cumulative-R point among trades closed within peakWindowMs; hysteresis
// (halt at ≥ haltR, resume at ≤ resumeR); a halt cannot outlive maxHaltMs — on expiry the peak is
// re-based to the current cumulative R so the guard re-arms fresh.
interface DrawdownGuardOpts { peakWindowMs: number; haltR: number; resumeR: number; maxHaltMs: number; now?: number }
interface DrawdownGuardState { halted: boolean; haltedSinceMs: number | null; rebasedAtCumR: number | null; rebasedAtMs: number | null }
const INITIAL_GUARD_STATE: DrawdownGuardState = { halted: false, haltedSinceMs: null, rebasedAtCumR: null, rebasedAtMs: null };
interface DrawdownGuardEval { state: DrawdownGuardState; cumR: number; peakR: number; ddR: number; transition: "none" | "halt" | "resume" | "expire" }
function evaluateDrawdownGuard(trades: ClosedTradeLite[], prev: DrawdownGuardState, opts: DrawdownGuardOpts): DrawdownGuardEval {
  const now = opts.now ?? Date.now();
  const closed = trades
    .filter(e => e.closed_at && e.risk_usd && e.risk_usd > 0)
    .map(e => ({ t: new Date(e.closed_at as string).getTime(), r: (e.pnl_usd ?? 0) / (e.risk_usd as number) }))
    .sort((a, b) => a.t - b.t);
  const points: Array<{ t: number; cum: number }> = [];
  let cum = 0;
  for (const c of closed) { cum += c.r; points.push({ t: c.t, cum }); }
  const since = Math.max(now - opts.peakWindowMs, prev.rebasedAtMs ?? -Infinity);
  let peak = cum;
  for (const p of points) if (p.t >= since && p.cum > peak) peak = p.cum;
  if (closed.length === 0 || closed[0].t >= since) peak = Math.max(peak, 0);
  if (prev.rebasedAtMs != null && prev.rebasedAtCumR != null && prev.rebasedAtMs >= now - opts.peakWindowMs) peak = Math.max(peak, prev.rebasedAtCumR);
  const dd = peak - cum;
  let state: DrawdownGuardState = { ...prev };
  let transition: DrawdownGuardEval["transition"] = "none";
  if (!prev.halted) {
    if (dd >= opts.haltR) { state = { ...state, halted: true, haltedSinceMs: now }; transition = "halt"; }
  } else {
    const expired = prev.haltedSinceMs != null && now - prev.haltedSinceMs >= opts.maxHaltMs;
    if (dd <= opts.resumeR) { state = { ...state, halted: false, haltedSinceMs: null }; transition = "resume"; }
    else if (expired) { state = { halted: false, haltedSinceMs: null, rebasedAtCumR: cum, rebasedAtMs: now }; transition = "expire"; }
  }
  return { state, cumR: cum, peakR: peak, ddR: dd, transition };
}
const DD_PEAK_DAYS = 30, DD_MAX_HALT_H = 24;

// ── Portfolio simulation (parameterized ENGINE-CURRENT + pluggable guard) ───
type GuardKind = "trio" | "none" | "dd";
type LsMode = "off" | "both" | "shortBtcUp";
interface Arm {
  label: string;
  portfolio: string;                       // P0 … E4 / PARITY
  strategies: string[];                    // component ids in the book (LS included via lsMode)
  lsMode: LsMode;
  guard: GuardKind; X?: number;            // dd guard halt level (resume X/2)
  maxOpen: number;
  driftBps: number;
  funding?: boolean;                       // POST-HOC
  seed?: number;                           // POST-HOC: shuffle same-timestamp order
  pool: string;                            // "master" | "parity"
  tag?: string;                            // "RECORD" | "GRID" | "PARITY" | "POSTHOC"
}
interface SimTrade {
  symbol: string; strategy: string; interval: string; dir: "LONG" | "SHORT";
  netR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number;
  btcD: Trend; outcome: string; barsHeld: number; holdDays: number;
}
interface SimOut {
  arm: Arm; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number;
  candidates: number; haltedMs: number; episodes: number; spanMs: number; guardBlocked: number;
}

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const model: EntryModel = { driftBps: arm.driftBps, fundingPctPerDay: arm.funding ? FUNDING_PCT_PER_DAY : 0 };
  const exits = resolveExits(arm.pool, allCands, streams, model, ENGINE_EXIT);
  const active = new Set(arm.strategies);
  if (arm.lsMode !== "off") active.add("liquidity-sweep");
  const cands = allCands
    .filter(c => active.has(c.stratId))
    .filter(c => !(c.stratId === "liquidity-sweep" && arm.lsMode === "shortBtcUp" && c.dir !== "SHORT"))
    .sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));   // stable sort: ties keep pool insertion order (registry order B&R, RSI, LS, then TSMOM — as phase8)
  if (arm.seed != null) {
    const rnd = mulberry32(arm.seed);
    const keyed = cands.map(c => ({ c, k: rnd() }));
    keyed.sort((a, b) => a.c.tsSec - b.c.tsSec || a.k - b.k);
    cands.splice(0, cands.length, ...keyed.map(x => x.c));
  }
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));
  const ddOpts: DrawdownGuardOpts = { peakWindowMs: DD_PEAK_DAYS * 86_400_000, haltR: arm.X ?? 12, resumeR: (arm.X ?? 12) / 2, maxHaltMs: DD_MAX_HALT_H * 3_600_000 };

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
  // BTC daily tag on CLOSED daily candles only (dailyTrendAt drops candles whose close is after nowSec)
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
  // portfolio-scope halt episodes: a maximal run of guard-blocked evaluations (trio: daily||rolling;
  // dd: state.halted). Time halted = Σ (first unblocked evaluation − first blocked evaluation).
  let epStart: number | null = null, haltedMs = 0, episodes = 0, guardBlocked = 0;
  const onGuard = (blockedNow: boolean, nowMs: number) => {
    if (blockedNow) { if (epStart == null) { epStart = nowMs; episodes++; } }
    else if (epStart != null) { haltedMs += nowMs - epStart; epStart = null; }
  };
  let ddState: DrawdownGuardState = { ...INITIAL_GUARD_STATE };
  const firstTs = cands.length ? cands[0].tsSec : 0, lastTs = cands.length ? cands[cands.length - 1].tsSec : 0;

  for (const c of cands) {
    const nowSec = c.tsSec, nowMs = nowSec * 1000;
    closeDue(nowSec);
    const btcDailyTrend = dTrend("BTC", nowSec);
    // regime filter (phase 9 component A2) — strategy-level, applied before any slot/cooldown
    if (c.stratId === "liquidity-sweep" && arm.lsMode === "shortBtcUp" && btcDailyTrend !== "up") { block("lsRegime"); continue; }

    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }

    let riskMultiplier = 1.0;
    if (btcDailyTrend === "up") riskMultiplier = 1.25; else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    const oneR = balance * BASE_RISK_PCT / 100;   // engine R unit: balance × base risk %

    // ── guards ──
    let ksBlocked = false;
    if (arm.guard === "trio") {
      let fired = false;
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -4 * oneR) { fired = true; block("ddDaily"); }
      if (!fired && isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: 6, now: nowMs })) { fired = true; block("ddRolling7d"); }
      onGuard(fired, nowMs);
      if (fired) { guardBlocked++; continue; }
      // kill-switch is evaluated after the slot gates in the engine order below
      ksBlocked = strategiesToPause(closedLog, [c.stratId], { windowMs: ROLLING_WINDOW_MS, minTrades: 4, maxNetR: -3, now: nowMs }).has(c.stratId);
    } else if (arm.guard === "dd") {
      const ev = evaluateDrawdownGuard(closedLog, ddState, { ...ddOpts, now: nowMs });
      ddState = ev.state;
      onGuard(ddState.halted, nowMs);
      if (ddState.halted) { block("ddGuard"); guardBlocked++; continue; }
    }

    if (totalOpen() >= arm.maxOpen) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const p of list) if (p.group === group) inGroup++;
      if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; }
    }
    if (ksBlocked) { block(`killSwitch:${c.stratId}`); guardBlocked++; continue; }
    if (c.interval === "4h") {   // weekly-trend alignment gate: 4h strategies only (1d exempt, as in phase 6/9-tsmom)
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }

    const riskUsd = balance * BASE_RISK_PCT * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, interval: c.interval, dir: c.dir,
      netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, outcome: ex.outcome, barsHeld: ex.barsHeld, holdDays: ex.barsHeld * c.ivSec / 86_400,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }
  if (epStart != null) { haltedMs += lastTs * 1000 - epStart; }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, candidates: cands.length, haltedMs, episodes, spanMs: (lastTs - firstTs) * 1000, guardBlocked };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
interface WinMetrics {
  n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; maxDD: number;
  top5Share: number; h1: { n: number; exp: number; sumR: number }; h2: { n: number; exp: number; sumR: number };
  coinsPos: number; coinsTotal: number; coinsPosPct: number; spanYrs: number; tradesPerYr: number;
}
function inWin(trades: SimTrade[], from: number, to: number): SimTrade[] { return trades.filter(t => t.openedSec >= from && t.openedSec < to); }
function metrics(trades: SimTrade[], from: number, to: number, iters = 10_000): WinMetrics {
  const t = inWin(trades, from, to);
  const rs = t.map(x => x.netR);
  const s = stats(rs);
  const ci = rs.length >= 2 ? bootstrapCI(rs, iters) : { lo: NaN, hi: NaN };
  const top5 = [...rs].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const lo = Math.max(from, t.length ? Math.min(...t.map(x => x.openedSec)) : from);
  const hi = Math.min(to, END_TS + 86_400);
  const mid = (lo + hi) / 2;
  const a = stats(t.filter(x => x.openedSec < mid).map(x => x.netR));
  const b = stats(t.filter(x => x.openedSec >= mid).map(x => x.netR));
  const byCoin = new Map<string, number>();
  for (const x of t) byCoin.set(x.symbol, (byCoin.get(x.symbol) ?? 0) + x.netR);
  const coinsTotal = byCoin.size, coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  const spanYrs = Math.max(0, (hi - lo) / YEAR_SEC);
  return {
    n: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi, maxDD: maxDrawdownR(rs),
    top5Share: s.sumR > 0 ? 100 * top5 / s.sumR : NaN,
    h1: { n: a.n, exp: a.exp, sumR: a.sumR }, h2: { n: b.n, exp: b.exp, sumR: b.sumR },
    coinsPos, coinsTotal, coinsPosPct: coinsTotal ? 100 * coinsPos / coinsTotal : NaN,
    spanYrs, tradesPerYr: spanYrs > 0 ? s.n / spanYrs : NaN,
  };
}
function rowStr(m: WinMetrics): string {
  return `T=${String(m.n).padStart(4)} WR=${f(m.wr, 0).padStart(3)}% PF=${f(m.pf).padStart(5)} sumR=${sgn(m.sumR, 1).padStart(7)} exp=${sgn(m.exp, 3)} CI95=[${sgn(m.ciLo, 3)}, ${sgn(m.ciHi, 3)}] maxDD=${f(m.maxDD, 1).padStart(5)}R`;
}
function detailStr(m: WinMetrics): string {
  return `H1 T=${m.h1.n} exp=${sgn(m.h1.exp, 3)} sumR=${sgn(m.h1.sumR, 1)} | H2 T=${m.h2.n} exp=${sgn(m.h2.exp, 3)} sumR=${sgn(m.h2.sumR, 1)} | top5=${f(m.top5Share, 0)}% | coins+ ${m.coinsPos}/${m.coinsTotal} (${f(m.coinsPosPct, 0)}%) | ${f(m.tradesPerYr, 0)} tr/yr over ${f(m.spanYrs, 2)}y`;
}

// ── Pre-registered acceptance (applied literally on FULL) ───────────────────
type Verdict = "ACCEPT-LIVE-CANDIDATE" | "PAPER-CANDIDATE" | "REJECT" | "INSUFFICIENT-DATA";
function portfolioVerdict(m: WinMetrics, expSlip15: number, eligible: boolean): { verdict: Verdict; reasons: string[]; paperOk: boolean; acceptOk: boolean } {
  const reasons: string[] = [];
  if (m.n < 30) return { verdict: "INSUFFICIENT-DATA", reasons: [`T=${m.n} < 30`], paperOk: false, acceptOk: false };
  const pap: Array<[boolean, string]> = [
    [m.exp >= 0.20, `exp ${sgn(m.exp, 3)} ≥ +0.20`],
    [m.pf >= 1.30, `PF ${f(m.pf)} ≥ 1.30`],
    [m.ciLo > 0, `CI95 lo ${sgn(m.ciLo, 3)} > 0`],
    [m.h1.exp >= 0.10 && m.h2.exp >= 0.10, `halves ${sgn(m.h1.exp, 3)} / ${sgn(m.h2.exp, 3)} each ≥ +0.10`],
    [m.tradesPerYr >= 80, `${f(m.tradesPerYr, 0)} tr/yr ≥ 80`],
    [m.maxDD <= 25, `maxDD ${f(m.maxDD, 1)}R ≤ 25R`],
    [expSlip15 >= 0.10, `exp @ +15 bps ${sgn(expSlip15, 3)} ≥ +0.10`],
  ];
  const papFail = pap.filter(([ok]) => !ok).map(([, w]) => `✗ ${w}`);
  const paperOk = papFail.length === 0;
  reasons.push(paperOk ? `PORTFOLIO-PAPER rule met: ${pap.map(([, w]) => w).join("; ")}` : `PORTFOLIO-PAPER failed: ${papFail.join("; ")}`);
  const acc: Array<[boolean, string]> = [
    [m.exp >= 0.25, `exp ≥ +0.25`], [m.pf >= 1.30, `PF ≥ 1.30`], [m.ciLo > 0, `CI lo > 0`], [m.tradesPerYr >= 50, `≥ 50 tr/yr`],
    [Math.sign(m.h1.exp) === Math.sign(m.h2.exp) && m.h1.exp >= 0.10 && m.h2.exp >= 0.10, `halves each ≥ +0.10`],
    [Number.isFinite(m.top5Share) && m.top5Share <= 30, `top-5 ≤ 30% (${f(m.top5Share, 0)}%)`],
    [m.coinsPosPct >= 55, `coins+ ≥ 55% (${f(m.coinsPosPct, 0)}%)`], [expSlip15 >= 0.10, `slip15 ≥ +0.10`],
  ];
  const accFail = acc.filter(([ok]) => !ok).map(([, w]) => w);
  const acceptOk = accFail.length === 0;
  reasons.push(acceptOk ? "general ACCEPT-LIVE rule met" : `general ACCEPT-LIVE failed on: ${accFail.join("; ")}`);
  if (!eligible) reasons.push("NOT ELIGIBLE for recommendation: contains a component REJECTED by its component stage (B&R / RSI) — reference only");
  let verdict: Verdict = "REJECT";
  if (paperOk && acceptOk) verdict = "ACCEPT-LIVE-CANDIDATE"; else if (paperOk) verdict = "PAPER-CANDIDATE";
  if (!eligible && verdict !== "REJECT") { reasons.push(`literal verdict would be ${verdict}; recorded as REJECT because of the rejected component`); verdict = "REJECT"; }
  return { verdict, reasons, paperOk, acceptOk };
}

// ── Data ────────────────────────────────────────────────────────────────────
async function loadStream(streams: Map<string, OHLCV[]>, sym: string, interval: string, total: number, key = `${sym}:${interval}`) {
  if (streams.has(key)) return;
  try { streams.set(key, await fetchPaginated(sym, interval, total)); } catch (e: any) { console.error(`fetch failed ${key} ×${total}: ${e?.message ?? e}`); }
}

interface Portfolio { id: string; label: string; strategies: string[]; lsMode: LsMode; eligible: boolean; kind: "baseline" | "reference" | "eligible" }

async function main() {
  L(`# Phase 9 — PORTFOLIO stage — ${new Date().toISOString().slice(0, 10)}`);
  L(`capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · exits ${JSON.stringify(ENGINE_EXIT)} · honest entry (signal-candle close) · fees 0.05% + slippage model 0.05%/side inside simulateManagedExit · no margin gate (R metrics are scale-invariant)`);
  L(`data (Binance spot, day cache ${DAY_KEY}): LS 1h×${C1H} ×40 · B&R 4h×${C4H} ×6 (parity pool 4h×${C4H_PARITY}) · RSI 1h×${C1H} ×2 · TSMOM 1d×${C1D} ×40 · BTC/alt daily context 1d×${C1D} (parity: 600/400) · weekly 1w×400`);
  L("");
  L("## Pre-registration (fixed before the run — see the header of script/audit/phase9-portfolio.ts)");
  L("- Components received: LS SHORT & BTC-daily-UP = ACCEPT (fragile); TSMOM = PAPER-CANDIDATE (order-fragile); B&R = REJECT; RSI = REJECT (selection-bias rule).");
  L("- P0/P1 baselines; P2–P4 as written in the brief are simulated but contain REJECTED B&R/RSI → REFERENCE ONLY, not recommendable; eligible set E2 = LS-regime alone, E3 = TSMOM alone, E4 = LS-regime + TSMOM.");
  L("- Grid: guards {trio, OFF, dd X∈{8,12,16} resume X/2, 30d peak, 24h max halt} × maxOpen {6,10} × slip {0,+15 bps}. Verdict of record = trio / maxOpen 10 / 0 bps cell (exp@15 from the paired cell).");
  L("- Guard-grid rule: lowest maxDD(R) X with sumR ≥ 90% of guards-OFF sumR (defined only when guards-OFF sumR > 0); ties → larger X.");
  L("- PORTFOLIO-PAPER acceptance on FULL: exp ≥ +0.20; PF ≥ 1.30; CI95 lo > 0; halves ≥ +0.10 each; ≥ 80 tr/yr; maxDD ≤ 25R; exp@+15bps ≥ +0.10. General ACCEPT-LIVE rule also evaluated.");
  L("- POST-HOC (labelled): 10-seed same-timestamp order shuffles; funding drag −0.03%/day; sleeve breakdown.");
  L("");

  const registry = getAllStrategies();
  const ls = registry.find(s => s.id === "liquidity-sweep")!;
  const br = registry.find(s => s.id === "break-retest")!;
  const rsi = registry.find(s => s.id === "rsi-divergence")!;
  const UNIVERSE = [...(ls.preferredSymbols ?? [])];
  const tsmom = makeTsmom(UNIVERSE);
  const allStrats: Strategy[] = [ls, br, rsi, tsmom];

  // streams
  const streams = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) await loadStream(streams, sym, "1h", C1H);
  for (const sym of br.preferredSymbols ?? []) { await loadStream(streams, sym, "4h", C4H); await loadStream(streams, sym, "4h", C4H_PARITY, `${sym}:4h:parity`); }
  for (const sym of rsi.preferredSymbols ?? []) await loadStream(streams, sym, "1h", C1H);
  const dailyBySym = new Map<string, OHLCV[]>(), dailyBySym400 = new Map<string, OHLCV[]>(), weeklyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) {
    try { const d = await fetchPaginated(sym, "1d", C1D); streams.set(`${sym}:1d`, d); dailyBySym.set(sym, d); } catch (e: any) { console.error(`1d ${sym}: ${e?.message ?? e}`); }
    try { dailyBySym400.set(sym, await fetchPaginated(sym, "1d", 400)); } catch (e: any) { console.error(`1d400 ${sym}: ${e?.message ?? e}`); }
    try { weeklyBySym.set(sym, await fetchPaginated(sym, "1w", 400)); } catch (e: any) { console.error(`1w ${sym}: ${e?.message ?? e}`); }
  }
  const btcDaily = await fetchPaginated("BTC", "1d", C1D);
  const btcDaily600 = await fetchPaginated("BTC", "1d", 600);
  const btcWeekly = await fetchPaginated("BTC", "1w", 400);
  const md: MarketData = { btcDaily, btcWeekly, dailyBySym, weeklyBySym };
  const mdParity: MarketData = { btcDaily: btcDaily600, btcWeekly, dailyBySym: dailyBySym400, weeklyBySym };

  const btc1h = streams.get("BTC:1h")!;
  const FULL_START = btc1h[Math.max(ls.minCandles, 60)].time + 3600;   // first possible 1h decision
  const FULL_END = btc1h[btc1h.length - 1].time + 3600;
  const MID = (FULL_START + FULL_END) / 2;
  L(`## Windows`);
  L(`  FULL = ${new Date(FULL_START * 1000).toISOString()} → ${new Date(FULL_END * 1000).toISOString()} (${f((FULL_END - FULL_START) / YEAR_SEC, 2)}y) · MID = ${iso(MID)} · 2026 from ${iso(YEAR_2026_TS)} · Aug14→Sep1 = [${iso(RESET_TS)}, ${iso(END_TS)}) · EXT = all trades`);
  const spans = ["BTC:1h", "SOL:4h", "SOL:4h:parity", "BTC:1d", "ATOM:1h"].map(k => { const c = streams.get(k); return c ? `${k} ${iso(c[0].time)}→${iso(c[c.length - 1].time)} (${c.length})` : `${k} —`; });
  L(`  streams: ${spans.join(" · ")}`);
  L("");

  // ── Candidate pools (LS pool cached on disk — the slow part) ──────────────
  const lsCachePath = `${CACHE_DIR}/phase9-portfolio-ls-${C1H}-${DAY_KEY}.json`;
  let lsCands: Cand[];
  if (existsSync(lsCachePath)) { lsCands = JSON.parse(readFileSync(lsCachePath, "utf-8")) as Cand[]; L(`[LS candidates loaded from ${lsCachePath}: ${lsCands.length}]`); }
  else {
    lsCands = [];
    const t0 = Date.now();
    for (const sym of UNIVERSE) { const c = streams.get(`${sym}:1h`); if (c) lsCands.push(...buildCandidates(ls, sym, c, `${sym}:1h`)); }
    writeFileSync(lsCachePath, JSON.stringify(lsCands));
    L(`[LS candidates built in ${f((Date.now() - t0) / 1000, 0)}s: ${lsCands.length} → cached ${lsCachePath}]`);
  }
  const brCands: Cand[] = [], brParity: Cand[] = [], rsiCands: Cand[] = [], tsCands: Cand[] = [];
  for (const sym of br.preferredSymbols ?? []) {
    const c = streams.get(`${sym}:4h`); if (c) brCands.push(...buildCandidates(br, sym, c, `${sym}:4h`));
    const p = streams.get(`${sym}:4h:parity`); if (p) brParity.push(...buildCandidates(br, sym, p, `${sym}:4h:parity`));
  }
  for (const sym of rsi.preferredSymbols ?? []) { const c = streams.get(`${sym}:1h`); if (c) rsiCands.push(...buildCandidates(rsi, sym, c, `${sym}:1h`)); }
  for (const sym of UNIVERSE) { const c = streams.get(`${sym}:1d`); if (c) tsCands.push(...buildCandidates(tsmom, sym, c, `${sym}:1d`)); }
  const master: Cand[] = [...brCands, ...rsiCands, ...lsCands, ...tsCands].map(c => ({ ...c }));   // registry order first (tiebreak parity with phase8)
  master.forEach((c, i) => { c.idx = i; });
  const parityPool: Cand[] = [...brParity, ...rsiCands, ...lsCands].map(c => ({ ...c }));
  parityPool.forEach((c, i) => { c.idx = i; });
  L(`## Candidate pools (post minSL 0.6% + R:R 1.5)`);
  L(`  master: LS=${lsCands.length} (SHORT ${lsCands.filter(c => c.dir === "SHORT").length}) · B&R(4h×${C4H})=${brCands.length} · RSI=${rsiCands.length} · TSMOM=${tsCands.length} · total ${master.length}`);
  L(`  parity: LS=${lsCands.length} · B&R(4h×${C4H_PARITY})=${brParity.length} · RSI=${rsiCands.length} · total ${parityPool.length}`);
  L("");

  // ── Portfolios ────────────────────────────────────────────────────────────
  const CORE = ["break-retest", "rsi-divergence"];
  const portfolios: Portfolio[] = [
    { id: "P0", label: "P0 current honest engine: LS floor 68 both dirs + B&R + RSI", strategies: CORE, lsMode: "both", eligible: false, kind: "baseline" },
    { id: "P1", label: "P1 B&R + RSI (no LS)", strategies: CORE, lsMode: "off", eligible: false, kind: "baseline" },
    { id: "P2", label: "P2 B&R + RSI + LS SHORT-only & BTC daily UP  [REFERENCE: contains rejected B&R/RSI]", strategies: CORE, lsMode: "shortBtcUp", eligible: false, kind: "reference" },
    { id: "P3", label: "P3 B&R + RSI + TSMOM  [REFERENCE: contains rejected B&R/RSI]", strategies: [...CORE, "tsmom"], lsMode: "off", eligible: false, kind: "reference" },
    { id: "P4", label: "P4 B&R + RSI + LS SHORT-only & BTC UP + TSMOM  [REFERENCE: contains rejected B&R/RSI]", strategies: [...CORE, "tsmom"], lsMode: "shortBtcUp", eligible: false, kind: "reference" },
    { id: "E2", label: "E2 LS SHORT-only & BTC daily UP (alone)  [eligible]", strategies: [], lsMode: "shortBtcUp", eligible: true, kind: "eligible" },
    { id: "E3", label: "E3 TSMOM daily (alone)  [eligible]", strategies: ["tsmom"], lsMode: "off", eligible: true, kind: "eligible" },
    { id: "E4", label: "E4 LS SHORT-only & BTC daily UP + TSMOM  [eligible]", strategies: ["tsmom"], lsMode: "shortBtcUp", eligible: true, kind: "eligible" },
  ];
  const GUARDS: Array<{ guard: GuardKind; X?: number; name: string }> = QUICK
    ? [{ guard: "trio", name: "trio" }, { guard: "none", name: "OFF" }, { guard: "dd", X: 12, name: "dd12" }]
    : [{ guard: "trio", name: "trio" }, { guard: "none", name: "OFF" }, { guard: "dd", X: 8, name: "dd8" }, { guard: "dd", X: 12, name: "dd12" }, { guard: "dd", X: 16, name: "dd16" }];
  const MAXOPENS = QUICK ? [10] : [10, 6];
  const SLIPS = [0, 15];

  // ── Parity arm: P0 on the phase8 core-20000 pool/context (expects T=1647 sumR −103.0 exp −0.063) ──
  L(`## PARITY — P0 on phase8 pool (B&R 4h×${C4H_PARITY}, BTC 1d×600, alts 1d×400) vs phase8-report-core-20000 "FLOOR 68": T=1647 WR=29% PF=0.92 sumR=-103.0 exp=-0.063 maxDD=202.9R`);
  const parityArm: Arm = { label: "PARITY P0 phase8 pool", portfolio: "PARITY", strategies: CORE, lsMode: "both", guard: "trio", maxOpen: 10, driftBps: 0, pool: "parity", tag: "PARITY" };
  const par = simulate(parityArm, parityPool, streams, mdParity, allStrats);
  const parAll = metrics(par.trades, 0, Number.MAX_SAFE_INTEGER, 2000);
  L(`  EXT     ${rowStr(parAll)}  balDD=${f(par.maxDDpct, 1)}%`);
  L(`  blocks: ${Object.entries(par.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  const parityOk = parAll.n === 1647 && Math.abs(parAll.sumR + 103.0) < 0.15;
  L(`  parity: ${parityOk ? "EXACT" : "MISMATCH (see note)"}`);
  L("");

  // ── Grid ──────────────────────────────────────────────────────────────────
  const results = new Map<string, SimOut>();
  const key = (p: string, g: string, mo: number, slip: number) => `${p}|${g}|${mo}|${slip}`;
  const tStart = Date.now();
  for (const p of portfolios) for (const g of GUARDS) for (const mo of MAXOPENS) for (const slip of SLIPS) {
    const arm: Arm = { label: `${p.id} ${g.name} maxOpen${mo} slip${slip}`, portfolio: p.id, strategies: p.strategies, lsMode: p.lsMode, guard: g.guard, X: g.X, maxOpen: mo, driftBps: slip, pool: "master", tag: g.name === "trio" && mo === 10 && slip === 0 ? "RECORD" : "GRID" };
    results.set(key(p.id, g.name, mo, slip), simulate(arm, master, streams, md, allStrats));
  }
  console.log(`[grid: ${results.size} simulations in ${f((Date.now() - tStart) / 1000, 0)}s]`);

  // ── Report per portfolio ─────────────────────────────────────────────────
  interface VerdictRow {
    component: string; hypothesis: string; window: string; trades: number; exp: number; pf: number; ci_low: number; ci_high: number;
    half1_exp: number; half2_exp: number; verdict: Verdict; reasons: string; coins_positive_pct?: number; exp_slip15?: number; top5_share_pct?: number;
  }
  const verdictRows: VerdictRow[] = [];
  const summary: any = { generatedAt: new Date().toISOString(), capital: START_CAPITAL, riskPct: BASE_RISK_PCT, windows: { FULL_START, FULL_END, MID }, parity: { T: parAll.n, sumR: parAll.sumR, exp: parAll.exp, pf: parAll.pf, ok: parityOk }, portfolios: {} as any };

  for (const p of portfolios) {
    L(`# ${p.label}`);
    const rec = results.get(key(p.id, "trio", 10, 0))!;
    const rec15 = results.get(key(p.id, "trio", 10, 15))!;
    const mFull = metrics(rec.trades, FULL_START, FULL_END);
    const mH1 = metrics(rec.trades, FULL_START, MID, 4000);
    const mH2 = metrics(rec.trades, MID, FULL_END, 4000);
    const m26 = metrics(rec.trades, YEAR_2026_TS, FULL_END, 4000);
    const mAug = metrics(rec.trades, RESET_TS, END_TS, 2000);
    const mExt = metrics(rec.trades, 0, Number.MAX_SAFE_INTEGER, 4000);
    const mFull15 = metrics(rec15.trades, FULL_START, FULL_END, 4000);
    const mExt15 = metrics(rec15.trades, 0, Number.MAX_SAFE_INTEGER, 2000);
    L(`## RECORD cell — trio guards · maxOpen 10 · 0 bps`);
    L(`  FULL    ${rowStr(mFull)}  balDD=${f(rec.maxDDpct, 1)}%`);
    L(`          ${detailStr(mFull)}`);
    L(`  H1      ${rowStr(mH1)}`);
    L(`  H2      ${rowStr(mH2)}`);
    L(`  2026    ${rowStr(m26)}`);
    L(`  Aug14→  ${rowStr(mAug)}   (parity with realized only: paper −0.29R/30, live −0.45R/43)`);
    L(`  EXT     ${rowStr(mExt)}  (${f(mExt.spanYrs, 2)}y, ${f(mExt.tradesPerYr, 0)} tr/yr)`);
    L(`  +15bps  FULL ${rowStr(mFull15)} | EXT exp=${sgn(mExt15.exp, 3)}`);
    L(`  blocks: ${Object.entries(rec.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")} | guard time halted ${f(rec.spanMs ? 100 * rec.haltedMs / rec.spanMs : NaN, 1)}% in ${rec.episodes} episodes`);
    // sleeves (POST-HOC descriptive)
    const sleeves = [...new Set(rec.trades.map(t => t.strategy))].sort();
    if (sleeves.length > 1) {
      for (const sid of sleeves) {
        const ms = metrics(rec.trades.filter(t => t.strategy === sid), FULL_START, FULL_END, 2000);
        L(`  sleeve ${sid.padEnd(16)} FULL T=${String(ms.n).padStart(4)} PF=${f(ms.pf)} sumR=${sgn(ms.sumR, 1)} exp=${sgn(ms.exp, 3)} | H1 ${sgn(ms.h1.exp, 3)} H2 ${sgn(ms.h2.exp, 3)} | coins+ ${ms.coinsPos}/${ms.coinsTotal}`);
      }
    }
    const v = portfolioVerdict(mFull, mFull15.exp, p.eligible);
    L(`  VERDICT (record cell, FULL): ${v.verdict}`);
    for (const r of v.reasons) L(`    ${r}`);
    verdictRows.push({
      component: `${p.id} — ${p.label.replace(/\s+\[.*$/, "")} — record cell (trio guards, maxOpen 10)`,
      hypothesis: p.kind === "baseline" ? "baseline (no hypothesis)" : p.kind === "reference" ? "pre-registered P-portfolio; contains REJECTED B&R/RSI → reference only" : "eligible-component portfolio: PORTFOLIO-PAPER rule on FULL",
      window: `FULL ${iso(FULL_START)}→${iso(FULL_END)} (halves split ${iso(MID)})`,
      trades: mFull.n, exp: +mFull.exp.toFixed(3), pf: +mFull.pf.toFixed(2), ci_low: +mFull.ciLo.toFixed(3), ci_high: +mFull.ciHi.toFixed(3),
      half1_exp: +mFull.h1.exp.toFixed(3), half2_exp: +mFull.h2.exp.toFixed(3), verdict: v.verdict,
      reasons: `${v.reasons.join(" | ")} | maxDD ${f(mFull.maxDD, 1)}R; ${f(mFull.tradesPerYr, 0)} tr/yr; sumR ${sgn(mFull.sumR, 1)}; EXT T=${mExt.n} exp ${sgn(mExt.exp, 3)} PF ${f(mExt.pf)} maxDD ${f(mExt.maxDD, 1)}R; 2026 exp ${sgn(m26.exp, 3)} (T=${m26.n}); Aug14→ exp ${sgn(mAug.exp, 3)} (T=${mAug.n})`,
      coins_positive_pct: +mFull.coinsPosPct.toFixed(1), exp_slip15: +mFull15.exp.toFixed(3),
      ...(Number.isFinite(mFull.top5Share) ? { top5_share_pct: +mFull.top5Share.toFixed(0) } : {}),
    });

    // grid table
    L(`## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell`);
    L(`| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |`);
    L(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
    const gridOut: any[] = [];
    for (const mo of MAXOPENS) for (const g of GUARDS) for (const slip of SLIPS) {
      const r = results.get(key(p.id, g.name, mo, slip))!;
      const m = metrics(r.trades, FULL_START, FULL_END, 4000);
      const m15 = slip === 0 ? metrics(results.get(key(p.id, g.name, mo, 15))!.trades, FULL_START, FULL_END, 2000) : m;
      const pv = portfolioVerdict(m, m15.exp, true);
      const halted = r.spanMs ? 100 * r.haltedMs / r.spanMs : NaN;
      L(`| ${g.name} | ${mo} | ${slip} | ${m.n} | ${f(m.pf)} | ${sgn(m.sumR, 1)} | ${sgn(m.exp, 3)} | ${sgn(m.ciLo, 3)} | ${f(m.maxDD, 1)} | ${sgn(m.h1.exp, 3)} | ${sgn(m.h2.exp, 3)} | ${f(m.tradesPerYr, 0)} | ${f(halted, 1)} | ${slip === 0 ? (pv.paperOk ? "PASS" : "fail") : "—"} |`);
      gridOut.push({ guard: g.name, maxOpen: mo, slip, T: m.n, pf: m.pf, sumR: m.sumR, exp: m.exp, ciLo: m.ciLo, ciHi: m.ciHi, maxDD: m.maxDD, h1: m.h1.exp, h2: m.h2.exp, tradesPerYr: m.tradesPerYr, haltedPct: halted, episodes: r.episodes, guardBlocked: r.guardBlocked, paperOk: slip === 0 ? pv.paperOk : null, coinsPosPct: m.coinsPosPct, top5: m.top5Share });
    }
    // guard-grid rule
    L(`## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)`);
    const guardPick: any = {};
    for (const mo of MAXOPENS) {
      const off = metrics(results.get(key(p.id, "OFF", mo, 0))!.trades, FULL_START, FULL_END, 1000);
      const trio = metrics(results.get(key(p.id, "trio", mo, 0))!.trades, FULL_START, FULL_END, 1000);
      const cells = GUARDS.filter(g => g.guard === "dd").map(g => { const r = results.get(key(p.id, g.name, mo, 0))!; const m = metrics(r.trades, FULL_START, FULL_END, 1000); return { X: g.X!, m, halted: r.spanMs ? 100 * r.haltedMs / r.spanMs : NaN, episodes: r.episodes }; });
      const line = cells.map(c => `X=${c.X}: sumR ${sgn(c.m.sumR, 1)} (${f(100 * c.m.sumR / (off.sumR || NaN), 0)}% of OFF) maxDD ${f(c.m.maxDD, 1)}R halted ${f(c.halted, 1)}%/${c.episodes}ep`).join(" · ");
      let pick = "n/a";
      if (off.sumR > 0) {
        const ok = cells.filter(c => c.m.sumR >= 0.9 * off.sumR).sort((a, b) => a.m.maxDD - b.m.maxDD || b.X - a.X);
        pick = ok.length ? `X=${ok[0].X} (maxDD ${f(ok[0].m.maxDD, 1)}R vs OFF ${f(off.maxDD, 1)}R vs trio ${f(trio.maxDD, 1)}R; sumR ${sgn(ok[0].m.sumR, 1)} vs OFF ${sgn(off.sumR, 1)} vs trio ${sgn(trio.sumR, 1)})` : "none qualifies (every X cuts sumR > 10%)";
      } else pick = `undefined — guards-OFF sumR ${sgn(off.sumR, 1)} ≤ 0 (nothing to protect)`;
      L(`  maxOpen ${mo}: OFF sumR ${sgn(off.sumR, 1)} maxDD ${f(off.maxDD, 1)}R | trio sumR ${sgn(trio.sumR, 1)} maxDD ${f(trio.maxDD, 1)}R | ${line}`);
      L(`    → pick: ${pick}`);
      guardPick[mo] = { off: { sumR: off.sumR, maxDD: off.maxDD }, trio: { sumR: trio.sumR, maxDD: trio.maxDD }, dd: cells.map(c => ({ X: c.X, sumR: c.m.sumR, maxDD: c.m.maxDD, exp: c.m.exp, halted: c.halted, episodes: c.episodes })), pick };
    }
    L("");
    summary.portfolios[p.id] = {
      label: p.label, eligible: p.eligible, kind: p.kind, verdict: v.verdict, reasons: v.reasons,
      record: { FULL: mFull, H1: mH1, H2: mH2, Y2026: m26, Aug14: mAug, EXT: mExt, FULL_slip15: mFull15, EXT_slip15: mExt15, balDDpct: rec.maxDDpct, blocks: rec.blocks, haltedPct: rec.spanMs ? 100 * rec.haltedMs / rec.spanMs : null, episodes: rec.episodes },
      grid: gridOut, guardPick,
    };
  }

  // ── POST-HOC ──────────────────────────────────────────────────────────────
  L(`# POST-HOC diagnostics (labelled — not used for any verdict)`);
  const posthoc: any = {};
  // (1) same-timestamp order shuffles for the eligible portfolios + P4 (record cell)
  if (SEEDS > 0) {
    L(`## (1) Same-timestamp order sensitivity — ${SEEDS} random orders vs default A→Z (record cell: trio, maxOpen 10, 0 bps), FULL window`);
    for (const pid of ["E2", "E3", "E4", "P4", "P3"]) {
      const p = portfolios.find(x => x.id === pid)!;
      const base = metrics(results.get(key(pid, "trio", 10, 0))!.trades, FULL_START, FULL_END, 1000);
      const exps: number[] = [], sums: number[] = [], dds: number[] = [], ciPos: boolean[] = [], paperOks: boolean[] = [];
      for (let s = 1; s <= SEEDS; s++) {
        const arm: Arm = { label: `${pid} seed${s}`, portfolio: pid, strategies: p.strategies, lsMode: p.lsMode, guard: "trio", maxOpen: 10, driftBps: 0, pool: "master", seed: s, tag: "POSTHOC" };
        const r = simulate(arm, master, streams, md, allStrats);
        const m = metrics(r.trades, FULL_START, FULL_END, 2000);
        exps.push(m.exp); sums.push(m.sumR); dds.push(m.maxDD); ciPos.push(m.ciLo > 0);
        paperOks.push(m.exp >= 0.20 && m.pf >= 1.30 && m.ciLo > 0 && m.h1.exp >= 0.10 && m.h2.exp >= 0.10 && m.tradesPerYr >= 80 && m.maxDD <= 25);
      }
      const srt = [...exps].sort((a, b) => a - b);
      L(`  ${pid}: default exp ${sgn(base.exp, 3)} sumR ${sgn(base.sumR, 1)} maxDD ${f(base.maxDD, 1)}R | seeds exp min/med/max ${sgn(srt[0], 3)}/${sgn(srt[Math.floor(srt.length / 2)], 3)}/${sgn(srt[srt.length - 1], 3)} · sumR ${sgn(Math.min(...sums), 1)}…${sgn(Math.max(...sums), 1)} · maxDD ${f(Math.min(...dds), 1)}…${f(Math.max(...dds), 1)}R · CI lo>0 in ${ciPos.filter(Boolean).length}/${SEEDS} · paper rule (ex-slip) in ${paperOks.filter(Boolean).length}/${SEEDS}`);
      posthoc[`seeds_${pid}`] = { defaultExp: base.exp, exps, sums, dds, ciPos: ciPos.filter(Boolean).length, paperOks: paperOks.filter(Boolean).length };
    }
    L("");
  }
  // (2) funding drag on every position (−0.03 %/day), record cell and +15 bps
  L(`## (2) Funding drag −0.03%/day of hold on every position (conservative; matters for TSMOM's multi-week holds) — record cell, FULL`);
  for (const pid of ["E3", "E4", "P3", "P4", "E2"]) {
    const p = portfolios.find(x => x.id === pid)!;
    for (const slip of [0, 15]) {
      const arm: Arm = { label: `${pid} funding slip${slip}`, portfolio: pid, strategies: p.strategies, lsMode: p.lsMode, guard: "trio", maxOpen: 10, driftBps: slip, pool: "master", funding: true, tag: "POSTHOC" };
      const r = simulate(arm, master, streams, md, allStrats);
      const m = metrics(r.trades, FULL_START, FULL_END, 2000);
      L(`  ${pid} +funding slip${String(slip).padStart(2)}: ${rowStr(m)} | halves ${sgn(m.h1.exp, 3)} / ${sgn(m.h2.exp, 3)}`);
      posthoc[`funding_${pid}_slip${slip}`] = { T: m.n, exp: m.exp, pf: m.pf, ciLo: m.ciLo, maxDD: m.maxDD, h1: m.h1.exp, h2: m.h2.exp };
    }
  }
  L("");
  // (3) direction × BTC daily for the eligible record cells
  L(`## (3) Direction × BTC daily (record cells, FULL)`);
  for (const pid of ["E2", "E3", "E4"]) {
    const t = inWin(results.get(key(pid, "trio", 10, 0))!.trades, FULL_START, FULL_END);
    const cells: string[] = [];
    for (const dir of ["LONG", "SHORT"]) for (const tr of ["up", "neutral", "down"] as Trend[]) { const s = stats(t.filter(x => x.dir === dir && x.btcD === tr).map(x => x.netR)); if (s.n) cells.push(`${dir}·${tr} T=${s.n} exp ${sgn(s.exp, 3)}`); }
    L(`  ${pid}: ${cells.join(" · ")}`);
  }
  // (4) monthly sumR for the eligible record cells
  L(`## (4) Monthly sumR (record cells, FULL)`);
  for (const pid of ["E2", "E3", "E4"]) {
    const t = inWin(results.get(key(pid, "trio", 10, 0))!.trades, FULL_START, FULL_END);
    const byM = new Map<string, number[]>();
    for (const x of t) { const m = new Date(x.openedSec * 1000).toISOString().slice(0, 7); byM.set(m, [...(byM.get(m) ?? []), x.netR]); }
    const ms = [...byM.entries()].sort();
    const neg = ms.filter(([, r]) => r.reduce((a, b) => a + b, 0) < 0).length;
    L(`  ${pid} (${neg}/${ms.length} months negative): ` + ms.map(([m, r]) => `${m}:${sgn(r.reduce((a, b) => a + b, 0), 1)}/${r.length}`).join(" "));
  }
  L("");

  summary.posthoc = posthoc;
  summary.verdicts = verdictRows;
  writeFileSync(`${CACHE_DIR}/phase9-portfolio-summary.json`, JSON.stringify(summary, null, 1));
  const e2 = results.get(key("E2", "trio", 10, 0))!, e4 = results.get(key("E4", "trio", 10, 0))!;
  writeFileSync(`${CACHE_DIR}/phase9-portfolio-trades.json`, JSON.stringify({ E2: e2.trades, E4: e4.trades, P0: results.get(key("P0", "trio", 10, 0))!.trades }));
  const outPath = `script/audit/phase9-report-portfolio${QUICK ? "-quick" : ""}.md`;
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[report written to ${outPath}; summary → ${CACHE_DIR}/phase9-portfolio-summary.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
