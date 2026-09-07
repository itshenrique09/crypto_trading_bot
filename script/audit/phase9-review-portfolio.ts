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


// ═══════════════════════════════════════════════════════════════════════════
// ADVERSARIAL REVIEW of the E4 guard-grid pick cell (dd12, maxOpen 10) — 2026-09-03
// Everything above this line is byte-identical to script/audit/phase9-portfolio.ts
// lines 1–466 (candidate builder, honest exits, simulate, metrics, verdict).
// All diagnostics below are POST-HOC REVIEW checks — they can only weaken a
// verdict, never promote one. Data = the 20260902 caches mirrored to today's key.
// Run: npx tsx script/audit/phase9-review-portfolio.ts [--seeds=20]
// ═══════════════════════════════════════════════════════════════════════════
const LS_POOL_CACHE = `${CACHE_DIR}/phase9-portfolio-ls-${C1H}-20260902.json`;
const PRE8000_END_IDX_FROM_END = 8000;   // the 8000-candle window in which the SHORT×BTC-up pattern was first seen

async function reviewMain() {
  L(`# Phase 9 — REVIEW of the E4 guard-grid pick cell (dd12 · maxOpen 10 · 0 bps) — ${new Date().toISOString().slice(0, 10)}`);
  L(`Same code path as phase9-portfolio.ts (simulate/metrics copied verbatim), same 20260902 candles (cache mirrored). capital $${START_CAPITAL} · risk ${BASE_RISK_PCT}%`);
  L(`POST-HOC REVIEW diagnostics — labelled; not usable for promotion.`);
  L("");
  const registry = getAllStrategies();
  const ls = registry.find(s => s.id === "liquidity-sweep")!;
  const UNIVERSE = [...(ls.preferredSymbols ?? [])];
  const tsmom = makeTsmom(UNIVERSE);
  const allStrats: Strategy[] = [ls, tsmom];
  const streams = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) await loadStream(streams, sym, "1h", C1H);
  const dailyBySym = new Map<string, OHLCV[]>(), weeklyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) {
    try { const d = await fetchPaginated(sym, "1d", C1D); streams.set(`${sym}:1d`, d); dailyBySym.set(sym, d); } catch (e: any) { console.error(`1d ${sym}: ${e?.message ?? e}`); }
    try { weeklyBySym.set(sym, await fetchPaginated(sym, "1w", 400)); } catch (e: any) { console.error(`1w ${sym}: ${e?.message ?? e}`); }
  }
  const btcDaily = await fetchPaginated("BTC", "1d", C1D);
  const btcWeekly = await fetchPaginated("BTC", "1w", 400);
  const md: MarketData = { btcDaily, btcWeekly, dailyBySym, weeklyBySym };
  const btc1h = streams.get("BTC:1h")!;
  const FULL_START = btc1h[Math.max(ls.minCandles, 60)].time + 3600;
  const FULL_END = btc1h[btc1h.length - 1].time + 3600;
  const MID = (FULL_START + FULL_END) / 2;
  const PRE_END = btc1h[btc1h.length - PRE8000_END_IDX_FROM_END].time + 3600;   // start of the last-8000 window
  L(`## Windows: FULL ${iso(FULL_START)}→${iso(FULL_END)} · MID ${iso(MID)} · PRE-8000 = [FULL_START, ${iso(PRE_END)}) (clean OOS for the regime rule) · LAST-8000 = [${iso(PRE_END)}, FULL_END) (regime rule formed here)`);
  L("");

  if (!existsSync(LS_POOL_CACHE)) throw new Error(`missing ${LS_POOL_CACHE}`);
  const lsCands = JSON.parse(readFileSync(LS_POOL_CACHE, "utf-8")) as Cand[];
  const tsCands: Cand[] = [];
  for (const sym of UNIVERSE) { const c = streams.get(`${sym}:1d`); if (c) tsCands.push(...buildCandidates(tsmom, sym, c, `${sym}:1d`)); }
  // pool order LS then TSMOM — identical relative order to the master pool of phase9-portfolio (B&R/RSI are inactive in E4 and only shift idx)
  const pool: Cand[] = [...lsCands, ...tsCands].map(c => ({ ...c }));
  pool.forEach((c, i) => { c.idx = i; });
  L(`## Pool: LS=${lsCands.length} (SHORT ${lsCands.filter(c => c.dir === "SHORT").length}) · TSMOM=${tsCands.length} (phase9-portfolio: 7908 / 2481)`);
  L("");

  const GUARDS: Array<{ guard: GuardKind; X?: number; name: string }> = [
    { guard: "none", name: "OFF" }, { guard: "trio", name: "trio" }, { guard: "dd", X: 8, name: "dd8" }, { guard: "dd", X: 12, name: "dd12" }, { guard: "dd", X: 16, name: "dd16" },
  ];
  const mkArm = (g: typeof GUARDS[number], seed?: number, slip = 0, maxOpen = 10): Arm => ({
    label: `E4 ${g.name} mo${maxOpen} slip${slip} seed${seed ?? "default"}`, portfolio: "E4", strategies: ["tsmom"], lsMode: "shortBtcUp",
    guard: g.guard, X: g.X, maxOpen, driftBps: slip, pool: "review", seed, tag: "POSTHOC",
  });
  const paperOk = (m: WinMetrics) => m.exp >= 0.20 && m.pf >= 1.30 && m.ciLo > 0 && m.h1.exp >= 0.10 && m.h2.exp >= 0.10 && m.tradesPerYr >= 80 && m.maxDD <= 25;
  const generalPaperOk = (m: WinMetrics) => m.exp >= 0.15 && m.pf >= 1.15 && m.ciLo > -0.05 && m.h1.exp > 0 && m.h2.exp > 0 && m.tradesPerYr >= 30;

  // ── R1 parity with the phase9-portfolio E4 grid (maxOpen 10, 0 bps) ──
  L(`## R1 — PARITY with phase9-report-portfolio E4 grid (maxOpen 10, 0 bps). Expected: OFF T=439 +127.3 maxDD 20.5 · trio T=351 +98.8 24.0 · dd8 T=420 +100.1 22.9 · dd12 T=430 +126.2 16.9 · dd16 T=437 +121.6 22.9`);
  const base = new Map<string, SimOut>();
  for (const g of GUARDS) {
    const r = simulate(mkArm(g), pool, streams, md, allStrats);
    base.set(g.name, r);
    const m = metrics(r.trades, FULL_START, FULL_END, 4000);
    L(`  ${g.name.padEnd(5)} ${rowStr(m)} | ${detailStr(m)} | halted ${f(r.spanMs ? 100 * r.haltedMs / r.spanMs : NaN, 1)}% / ${r.episodes} ep / ${r.guardBlocked} blocked entries`);
  }
  const mDd12 = metrics(base.get("dd12")!.trades, FULL_START, FULL_END, 10_000);
  const mOff = metrics(base.get("OFF")!.trades, FULL_START, FULL_END, 10_000);
  L(`  dd12 (10k bootstrap): exp ${sgn(mDd12.exp, 3)} CI [${sgn(mDd12.ciLo, 3)}, ${sgn(mDd12.ciHi, 3)}] · OFF: exp ${sgn(mOff.exp, 3)} CI [${sgn(mOff.ciLo, 3)}, ${sgn(mOff.ciHi, 3)}]`);
  // how many trades differ between dd12 and OFF?
  const keyT = (t: SimTrade) => `${t.symbol}|${t.strategy}|${t.openedSec}`;
  const offSet = new Set(inWin(base.get("OFF")!.trades, FULL_START, FULL_END).map(keyT));
  const ddSet = new Set(inWin(base.get("dd12")!.trades, FULL_START, FULL_END).map(keyT));
  let onlyOff = 0, onlyDd = 0; for (const k of offSet) if (!ddSet.has(k)) onlyOff++; for (const k of ddSet) if (!offSet.has(k)) onlyDd++;
  L(`  trade-set overlap dd12 vs OFF (FULL): shared ${[...ddSet].filter(k => offSet.has(k)).length} · only-OFF ${onlyOff} · only-dd12 ${onlyDd} → the pick cell is the OFF book minus/plus a handful of trades`);
  L("");

  // ── R2 same-timestamp order sensitivity of the GUARD PICK itself ──
  L(`## R2 — Does the guard-grid rule still pick X=12 under arbitrary same-timestamp orderings? (${SEEDS} seeds, maxOpen 10, 0 bps, FULL)`);
  L(`| seed | OFF sumR / maxDD | trio sumR / maxDD | dd8 sumR / maxDD | dd12 sumR / maxDD | dd16 sumR / maxDD | rule pick | dd12 exp | dd12 CI lo | dd12 H1/H2 | dd12 maxDD<OFF? | dd12 PORTFOLIO-PAPER | dd12 general PAPER |`);
  L(`|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  const picks: Record<string, number> = {}; let dd12Better = 0, dd12PaperOk = 0, dd12GenOk = 0, dd12CiPos = 0;
  const dd12Exps: number[] = [], dd12DDs: number[] = [], offDDs: number[] = [];
  for (let s = 1; s <= SEEDS; s++) {
    const ms = new Map<string, WinMetrics>();
    for (const g of GUARDS) ms.set(g.name, metrics(simulate(mkArm(g, s), pool, streams, md, allStrats).trades, FULL_START, FULL_END, 2000));
    const off = ms.get("OFF")!;
    const cells = [8, 12, 16].map(X => ({ X, m: ms.get(`dd${X}`)! }));
    let pick = "undefined";
    if (off.sumR > 0) { const ok = cells.filter(c => c.m.sumR >= 0.9 * off.sumR).sort((a, b) => a.m.maxDD - b.m.maxDD || b.X - a.X); pick = ok.length ? `X=${ok[0].X}` : "none"; }
    picks[pick] = (picks[pick] ?? 0) + 1;
    const d = ms.get("dd12")!;
    if (d.maxDD < off.maxDD) dd12Better++;
    if (paperOk(d)) dd12PaperOk++; if (generalPaperOk(d)) dd12GenOk++; if (d.ciLo > 0) dd12CiPos++;
    dd12Exps.push(d.exp); dd12DDs.push(d.maxDD); offDDs.push(off.maxDD);
    const cell = (n: string) => `${sgn(ms.get(n)!.sumR, 1)} / ${f(ms.get(n)!.maxDD, 1)}`;
    L(`| ${s} | ${cell("OFF")} | ${cell("trio")} | ${cell("dd8")} | ${cell("dd12")} | ${cell("dd16")} | ${pick} | ${sgn(d.exp, 3)} | ${sgn(d.ciLo, 3)} | ${sgn(d.h1.exp, 3)} / ${sgn(d.h2.exp, 3)} | ${d.maxDD < off.maxDD ? "yes" : "NO"} | ${paperOk(d) ? "pass" : "fail"} | ${generalPaperOk(d) ? "pass" : "fail"} |`);
  }
  const srt = [...dd12Exps].sort((a, b) => a - b);
  L(`  pick distribution over ${SEEDS} seeds: ${Object.entries(picks).map(([k, v]) => `${k}×${v}`).join(" · ")} (default ordering picked X=12)`);
  L(`  dd12 lowers maxDD vs OFF in ${dd12Better}/${SEEDS} seeds · dd12 maxDD range ${f(Math.min(...dd12DDs), 1)}–${f(Math.max(...dd12DDs), 1)}R (OFF ${f(Math.min(...offDDs), 1)}–${f(Math.max(...offDDs), 1)}R) · dd12 exp min/med/max ${sgn(srt[0], 3)}/${sgn(srt[Math.floor(srt.length / 2)], 3)}/${sgn(srt[srt.length - 1], 3)} · CI lo>0 in ${dd12CiPos}/${SEEDS} · PORTFOLIO-PAPER in ${dd12PaperOk}/${SEEDS} · general PAPER-CANDIDATE in ${dd12GenOk}/${SEEDS}`);
  L("");

  // ── R3 in-sample contamination: PRE-8000 (clean for the regime rule) vs LAST-8000 ──
  L(`## R3 — dd12 and OFF cells on the slice that predates the regime hypothesis (PRE-8000) vs the slice it was formed on (LAST-8000); sleeves inside`);
  for (const name of ["dd12", "OFF", "trio"]) {
    const r = base.get(name)!;
    const pre = metrics(r.trades, FULL_START, PRE_END, 4000), last = metrics(r.trades, PRE_END, FULL_END, 4000);
    L(`  ${name.padEnd(5)} PRE-8000  ${rowStr(pre)} | ${detailStr(pre)}`);
    L(`  ${name.padEnd(5)} LAST-8000 ${rowStr(last)} | ${detailStr(last)}`);
    for (const sid of ["liquidity-sweep", "tsmom"]) {
      const sp = metrics(r.trades.filter(t => t.strategy === sid), FULL_START, PRE_END, 2000), sl = metrics(r.trades.filter(t => t.strategy === sid), PRE_END, FULL_END, 2000);
      L(`        sleeve ${sid.padEnd(16)} PRE T=${sp.n} exp ${sgn(sp.exp, 3)} PF ${f(sp.pf)} halves ${sgn(sp.h1.exp, 3)}/${sgn(sp.h2.exp, 3)} coins+ ${sp.coinsPos}/${sp.coinsTotal} | LAST T=${sl.n} exp ${sgn(sl.exp, 3)} PF ${f(sl.pf)} halves ${sgn(sl.h1.exp, 3)}/${sgn(sl.h2.exp, 3)} coins+ ${sl.coinsPos}/${sl.coinsTotal}`);
    }
  }
  L("");

  // ── R4 slippage arms for the pick cell (+15 / +30 bps) and funding ──
  L(`## R4 — pick cell (dd12, maxOpen 10) under +15 / +30 bps adverse entry and −0.03%/day funding (FULL)`);
  for (const [slip, funding] of [[15, false], [30, false], [0, true], [15, true]] as Array<[number, boolean]>) {
    const arm = { ...mkArm(GUARDS[3], undefined, slip), funding };
    const r = simulate(arm, pool, streams, md, allStrats);
    const m = metrics(r.trades, FULL_START, FULL_END, 4000);
    L(`  slip${String(slip).padStart(2)}${funding ? "+funding" : "        "} ${rowStr(m)} | halves ${sgn(m.h1.exp, 3)} / ${sgn(m.h2.exp, 3)} | maxDD ${f(m.maxDD, 1)}R`);
  }
  L("");

  // ── R5 X-response monotonicity (is 12 a plateau or a spike?) — finer X grid, default ordering ──
  L(`## R5 — finer X grid around the pick (default ordering, maxOpen 10, 0 bps): a real risk control should respond smoothly in X`);
  for (const X of [6, 8, 10, 11, 12, 13, 14, 16, 20]) {
    const r = simulate(mkArm({ guard: "dd", X, name: `dd${X}` }), pool, streams, md, allStrats);
    const m = metrics(r.trades, FULL_START, FULL_END, 1000);
    L(`  X=${String(X).padStart(2)}: T=${m.n} sumR ${sgn(m.sumR, 1)} (${f(100 * m.sumR / mOff.sumR, 0)}% of OFF) exp ${sgn(m.exp, 3)} maxDD ${f(m.maxDD, 1)}R halted ${f(r.spanMs ? 100 * r.haltedMs / r.spanMs : NaN, 1)}% / ${r.episodes} ep / ${r.guardBlocked} blocked`);
  }
  L("");
  const outPath = `script/audit/phase9-report-review-portfolio.md`;
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[review written to ${outPath}]`);
}

reviewMain().catch(e => { console.error(e); process.exit(1); });
