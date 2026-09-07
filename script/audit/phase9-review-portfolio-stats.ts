// ─── AUDIT PHASE 9 — ADVERSARIAL REVIEW (statistics lens) of the "portfolio" researcher's
// E4 guard-grid pick cell: DESIGN dd-guard X=12 (resume 6R, 30d peak, 24h max halt), maxOpen 10.
// Verdict under review: PAPER-CANDIDATE, T=430 exp +0.293 PF 1.48 CI [+0.142,+0.450] halves
// +0.329/+0.246 coins+ 68% top-5 16% slip15 +0.221 (FULL 2024-05-31 → 2026-09-02).
//
// What this script does (server/ and client/ untouched):
//   1. Re-runs the E4 book with the researcher's own simulate() (copied verbatim from
//      script/audit/phase9-portfolio.ts) on the SAME data snapshot — candles are read straight from
//      the day-keyed cache files `script/.cache/pl_<sym>_<iv>_<n>_20260902.json` and the LS candidate
//      cache `phase9-portfolio-ls-20000-20260902.json`, so the numbers must reproduce exactly.
//   2. Recomputes every headline number of the dd12 cell independently from the trade list
//      (exp, PF, bootstrap CI 10k, calendar halves, top-5 share, coin breadth, tr/yr, maxDD in trade-R,
//      maxDD in ENGINE-R (pnl / (balance × base risk%), i.e. including the ×1.25 BTC-up multiplier),
//      balance drawdown %) and applies the brief's ACCEPT / PAPER criteria and the researcher's
//      PORTFOLIO-PAPER rule literally.
//   3. POST-HOC (labelled): the dd12 pick's robustness to same-timestamp ordering — 10 seeds × {OFF,
//      dd8, dd12, dd16} — does the pre-stated grid rule still pick X=12, and does the dd12 cell keep
//      maxDD < OFF and the PAPER rule?  Plus: which trades the guard actually removed vs OFF.
//
// Run:  npx tsx script/audit/phase9-review-portfolio-stats.ts [--seeds=10]
// Type-check: npx tsc --noEmit --module esnext --moduleResolution bundler --target esnext --strict
//   --skipLibCheck --esModuleInterop --allowImportingTsExtensions --types node script/audit/phase9-review-portfolio-stats.ts

import { existsSync, readFileSync, writeFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import type { OHLCV } from "../../server/analysis";
import type { Strategy, StrategySignal } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause, type ClosedTradeLite } from "../../server/portfolio-guards";
import {
  dailyTrendAt, weeklyTrendAt, intervalSec, stats, bootstrapCI, maxDrawdownR, calcATRLocal, mulberry32,
  COIN_GROUP, MAX_PER_GROUP, ROLLING_WINDOW_MS, MIN_SL_DISTANCE_PCT, MIN_RR, ENGINE_EXIT, type MarketData, type Trend,
} from "./lib";

const argv = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "true"]; }));
const SEEDS = parseInt(argv.seeds ?? "10");
const START_CAPITAL = 500, BASE_RISK_PCT = 2;            // researcher's params (R metrics scale-invariant)
const C1H = 20000, C1D = 1500;
const SNAP = "20260902";                                   // the researcher's data snapshot
const CACHE_DIR = "script/.cache";
const YEAR_SEC = 365.25 * 86_400;
const END_TS = Date.UTC(2026, 8, 2) / 1000;
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 2) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
const lines: string[] = [];
const L = (s = "") => { console.log(s); lines.push(s); };

function loadCached(sym: string, iv: string, total: number): OHLCV[] {
  const p = `${CACHE_DIR}/pl_${sym}_${iv}_${total}_${SNAP}.json`;
  if (!existsSync(p)) throw new Error(`snapshot file missing: ${p}`);
  return JSON.parse(readFileSync(p, "utf-8")) as OHLCV[];
}

// ── TSMOM prototype — verbatim from phase9-portfolio.ts ─────────────────────
function makeTsmom(universe: string[], donchianN = 55, stopK = 2.0): Strategy {
  return {
    id: "tsmom", name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`, description: "TSMOM", interval: "1d",
    minCandles: Math.max(donchianN + 25, 80), preferredSymbols: [...universe], cooldownHours: 72,
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

// ── Candidates / exits / guard / simulate — verbatim copies of phase9-portfolio.ts ───
interface Cand {
  stratId: string; interval: string; symbol: string; tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number; sigClose: number;
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
    const risk = Math.abs(sig.entry - sig.stopLoss), reward = Math.abs(sig.takeProfit1 - sig.entry);
    const slDistPct = sig.entry > 0 ? risk / sig.entry : 0;
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;
    if (risk <= 0 || reward / risk < MIN_RR) continue;
    out.push({ stratId: strat.id, interval: strat.interval, symbol, tsSec: candles[i].time + ivSec, dir: sig.direction, entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2, confidence: sig.confidence, slDistPct, rr: reward / risk, sigClose: candles[i].close, streamKey, entryIdx: i, maxBars, ivSec, idx: -1 });
  }
  return out;
}
interface EntryModel { driftBps: number; fundingPctPerDay: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number }
const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = poolName + "|" + JSON.stringify({ model, exitCfg });
  const hit = exitCache.get(key); if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    const d = model.driftBps / 10_000;
    const entry = c.dir === "LONG" ? c.sigClose * (1 + d) : c.sigClose * (1 - d);
    const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
    if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < MIN_RR) { out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", tp1Hit: false, filled: false, entryUsed: entry }; continue; }
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
interface DrawdownGuardOpts { peakWindowMs: number; haltR: number; resumeR: number; maxHaltMs: number; now?: number }
interface DrawdownGuardState { halted: boolean; haltedSinceMs: number | null; rebasedAtCumR: number | null; rebasedAtMs: number | null }
const INITIAL_GUARD_STATE: DrawdownGuardState = { halted: false, haltedSinceMs: null, rebasedAtCumR: null, rebasedAtMs: null };
function evaluateDrawdownGuard(trades: ClosedTradeLite[], prev: DrawdownGuardState, opts: DrawdownGuardOpts) {
  const now = opts.now ?? Date.now();
  const closed = trades.filter(e => e.closed_at && e.risk_usd && e.risk_usd > 0).map(e => ({ t: new Date(e.closed_at as string).getTime(), r: (e.pnl_usd ?? 0) / (e.risk_usd as number) })).sort((a, b) => a.t - b.t);
  const points: Array<{ t: number; cum: number }> = [];
  let cum = 0; for (const c of closed) { cum += c.r; points.push({ t: c.t, cum }); }
  const since = Math.max(now - opts.peakWindowMs, prev.rebasedAtMs ?? -Infinity);
  let peak = cum; for (const p of points) if (p.t >= since && p.cum > peak) peak = p.cum;
  if (closed.length === 0 || closed[0].t >= since) peak = Math.max(peak, 0);
  if (prev.rebasedAtMs != null && prev.rebasedAtCumR != null && prev.rebasedAtMs >= now - opts.peakWindowMs) peak = Math.max(peak, prev.rebasedAtCumR);
  const dd = peak - cum;
  let state: DrawdownGuardState = { ...prev };
  if (!prev.halted) { if (dd >= opts.haltR) state = { ...state, halted: true, haltedSinceMs: now }; }
  else {
    const expired = prev.haltedSinceMs != null && now - prev.haltedSinceMs >= opts.maxHaltMs;
    if (dd <= opts.resumeR) state = { ...state, halted: false, haltedSinceMs: null };
    else if (expired) state = { halted: false, haltedSinceMs: null, rebasedAtCumR: cum, rebasedAtMs: now };
  }
  return { state, cumR: cum, peakR: peak, ddR: dd };
}
const DD_PEAK_DAYS = 30, DD_MAX_HALT_H = 24;

type GuardKind = "trio" | "none" | "dd";
type LsMode = "off" | "both" | "shortBtcUp";
interface Arm { label: string; strategies: string[]; lsMode: LsMode; guard: GuardKind; X?: number; maxOpen: number; driftBps: number; funding?: boolean; seed?: number; pool: string }
interface SimTrade { symbol: string; strategy: string; interval: string; dir: "LONG" | "SHORT"; netR: number; riskUsd: number; pnlUsd: number; oneR: number; riskMult: number; openedSec: number; closedSec: number; btcD: Trend; outcome: string; barsHeld: number; holdDays: number }
interface SimOut { arm: Arm; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number; candidates: number; haltedMs: number; episodes: number; spanMs: number; guardBlocked: number }

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const model: EntryModel = { driftBps: arm.driftBps, fundingPctPerDay: 0 };
  const exits = resolveExits(arm.pool, allCands, streams, model, ENGINE_EXIT);
  const active = new Set(arm.strategies);
  if (arm.lsMode !== "off") active.add("liquidity-sweep");
  const cands = allCands.filter(c => active.has(c.stratId)).filter(c => !(c.stratId === "liquidity-sweep" && arm.lsMode === "shortBtcUp" && c.dir !== "SHORT")).sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  if (arm.seed != null) { const rnd = mulberry32(arm.seed); const keyed = cands.map(c => ({ c, k: rnd() })); keyed.sort((a, b) => a.c.tsSec - b.c.tsSec || a.k - b.k); cands.splice(0, cands.length, ...keyed.map(x => x.c)); }
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
  const dTrend = (sym: string, nowSec: number): Trend => { const key = `d:${sym}:${Math.floor(nowSec / 86_400)}`; let t = trendCache.get(key); if (t === undefined) { const s = sym === "BTC" ? md.btcDaily : md.dailyBySym.get(sym); t = s ? dailyTrendAt(s, nowSec) : "neutral"; trendCache.set(key, t); } return t; };
  const wTrend = (sym: string, nowSec: number): Trend => { const key = `w:${sym}:${Math.floor(nowSec / (7 * 86_400))}`; let t = trendCache.get(key); if (t === undefined) { const s = sym === "BTC" ? md.btcWeekly : md.weeklyBySym.get(sym); t = s ? weeklyTrendAt(s, nowSec) : "neutral"; trendCache.set(key, t); } return t; };
  const closeDue = (nowSec: number) => {
    for (const [sym, list] of Array.from(openBySymbol.entries())) {
      const due = list.filter(p => p.exitTsSec <= nowSec); if (!due.length) continue;
      const remaining = list.filter(p => p.exitTsSec > nowSec);
      if (remaining.length) openBySymbol.set(sym, remaining); else openBySymbol.delete(sym);
      for (const pos of due) {
        balance += pos.trade.pnlUsd; peak = Math.max(peak, balance); maxDD = Math.max(maxDD, peak > 0 ? (peak - balance) / peak : 0);
        lastClosedAt.set(`${sym}:${pos.strategy}`, pos.exitTsSec * 1000);
        closedLog.push({ strategy: pos.strategy, closed_at: new Date(pos.exitTsSec * 1000).toISOString(), pnl_usd: pos.trade.pnlUsd, risk_usd: pos.trade.riskUsd, outcome: pos.trade.netR >= 0 ? "win" : "loss" });
        trades.push(pos.trade);
      }
    }
  };
  let epStart: number | null = null, haltedMs = 0, episodes = 0, guardBlocked = 0;
  const onGuard = (blockedNow: boolean, nowMs: number) => { if (blockedNow) { if (epStart == null) { epStart = nowMs; episodes++; } } else if (epStart != null) { haltedMs += nowMs - epStart; epStart = null; } };
  let ddState: DrawdownGuardState = { ...INITIAL_GUARD_STATE };
  const firstTs = cands.length ? cands[0].tsSec : 0, lastTs = cands.length ? cands[cands.length - 1].tsSec : 0;
  for (const c of cands) {
    const nowSec = c.tsSec, nowMs = nowSec * 1000;
    closeDue(nowSec);
    const btcDailyTrend = dTrend("BTC", nowSec);
    if (c.stratId === "liquidity-sweep" && arm.lsMode === "shortBtcUp" && btcDailyTrend !== "up") { block("lsRegime"); continue; }
    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }
    let riskMultiplier = 1.0;
    if (btcDailyTrend === "up") riskMultiplier = 1.25; else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    const oneR = balance * BASE_RISK_PCT / 100;
    let ksBlocked = false;
    if (arm.guard === "trio") {
      let fired = false;
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -4 * oneR) { fired = true; block("ddDaily"); }
      if (!fired && isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: 6, now: nowMs })) { fired = true; block("ddRolling7d"); }
      onGuard(fired, nowMs);
      if (fired) { guardBlocked++; continue; }
      ksBlocked = strategiesToPause(closedLog, [c.stratId], { windowMs: ROLLING_WINDOW_MS, minTrades: 4, maxNetR: -3, now: nowMs }).has(c.stratId);
    } else if (arm.guard === "dd") {
      const ev = evaluateDrawdownGuard(closedLog, ddState, { ...ddOpts, now: nowMs });
      ddState = ev.state; onGuard(ddState.halted, nowMs);
      if (ddState.halted) { block("ddGuard"); guardBlocked++; continue; }
    }
    if (totalOpen() >= arm.maxOpen) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (group) { let inGroup = 0; for (const list of openBySymbol.values()) for (const p of list) if (p.group === group) inGroup++; if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; } }
    if (ksBlocked) { block(`killSwitch:${c.stratId}`); guardBlocked++; continue; }
    if (c.interval === "4h") { const wt = wTrend(c.symbol, nowSec); if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; } }
    const riskUsd = balance * BASE_RISK_PCT * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const trade: SimTrade = { symbol: c.symbol, strategy: c.stratId, interval: c.interval, dir: c.dir, netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd, oneR, riskMult: riskMultiplier, openedSec: nowSec, closedSec: ex.exitTsSec, btcD: btcDailyTrend, outcome: ex.outcome, barsHeld: ex.barsHeld, holdDays: ex.barsHeld * c.ivSec / 86_400 };
    const list = openBySymbol.get(c.symbol) ?? []; list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, trade }); openBySymbol.set(c.symbol, list);
  }
  if (epStart != null) haltedMs += lastTs * 1000 - epStart;
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, candidates: cands.length, haltedMs, episodes, spanMs: (lastTs - firstTs) * 1000, guardBlocked };
}

// ── Independent metrics (written fresh, not copied) ─────────────────────────
interface M {
  n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number;
  maxDD: number; maxDDengineR: number; top5: number[]; top5Share: number;
  h1: { n: number; exp: number; sumR: number; pf: number }; h2: { n: number; exp: number; sumR: number; pf: number };
  coinsPos: number; coinsTotal: number; coinsPosPct: number; spanYrs: number; tradesPerYr: number;
  sleeves: Record<string, { n: number; exp: number; sumR: number; pf: number; coinsPos: number; coinsTotal: number }>;
}
function inWin(tr: SimTrade[], from: number, to: number) { return tr.filter(t => t.openedSec >= from && t.openedSec < to); }
function metricsX(tradesAll: SimTrade[], from: number, to: number, iters = 10_000): M {
  const t = inWin(tradesAll, from, to).slice().sort((a, b) => a.closedSec - b.closedSec);
  const rs = t.map(x => x.netR);
  const s = stats(rs);
  const ci = bootstrapCI(rs, iters);
  const sorted = [...rs].sort((a, b) => b - a);
  const top5 = sorted.slice(0, 5);
  const top5sum = top5.reduce((a, b) => a + b, 0);
  const mid = (from + Math.min(to, END_TS + 86_400)) / 2;      // calendar midpoint of the acceptance window
  const a = t.filter(x => x.openedSec < mid), b = t.filter(x => x.openedSec >= mid);
  const sa = stats(a.map(x => x.netR)), sb = stats(b.map(x => x.netR));
  const byCoin = new Map<string, number>();
  for (const x of t) byCoin.set(x.symbol, (byCoin.get(x.symbol) ?? 0) + x.netR);
  const coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  const spanYrs = (Math.min(to, END_TS + 86_400) - from) / YEAR_SEC;
  const sleeves: M["sleeves"] = {};
  for (const sid of new Set(t.map(x => x.strategy))) {
    const tt = t.filter(x => x.strategy === sid); const ss = stats(tt.map(x => x.netR));
    const bc = new Map<string, number>(); for (const x of tt) bc.set(x.symbol, (bc.get(x.symbol) ?? 0) + x.netR);
    sleeves[sid] = { n: ss.n, exp: ss.exp, sumR: ss.sumR, pf: ss.pf, coinsPos: [...bc.values()].filter(v => v > 0).length, coinsTotal: bc.size };
  }
  // engine-R: pnl / (balance-at-open × base risk %) = netR × riskMultiplier (1.25 in BTC-up, 0.75 in BTC-down)
  const engR = t.map(x => x.netR * x.riskMult);
  return {
    n: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi,
    maxDD: maxDrawdownR(rs), maxDDengineR: maxDrawdownR(engR), top5, top5Share: s.sumR > 0 ? 100 * top5sum / s.sumR : NaN,
    h1: { n: sa.n, exp: sa.exp, sumR: sa.sumR, pf: sa.pf }, h2: { n: sb.n, exp: sb.exp, sumR: sb.sumR, pf: sb.pf },
    coinsPos, coinsTotal: byCoin.size, coinsPosPct: byCoin.size ? 100 * coinsPos / byCoin.size : NaN, spanYrs, tradesPerYr: s.n / spanYrs, sleeves,
  };
}
const row = (m: M) => `T=${m.n} WR=${f(m.wr, 0)}% PF=${f(m.pf)} sumR=${sgn(m.sumR, 1)} exp=${sgn(m.exp, 3)} CI95=[${sgn(m.ciLo, 3)}, ${sgn(m.ciHi, 3)}] maxDD=${f(m.maxDD, 1)}R (engine-R ${f(m.maxDDengineR, 1)}R) | H1 T=${m.h1.n} exp ${sgn(m.h1.exp, 3)} PF ${f(m.h1.pf)} | H2 T=${m.h2.n} exp ${sgn(m.h2.exp, 3)} PF ${f(m.h2.pf)} | top5 ${f(m.top5Share, 0)}% [${m.top5.map(x => f(x, 2)).join(", ")}] | coins+ ${m.coinsPos}/${m.coinsTotal} (${f(m.coinsPosPct, 0)}%) | ${f(m.tradesPerYr, 0)} tr/yr`;

function criteria(m: M, expSlip15: number) {
  const accept: Array<[boolean, string]> = [
    [m.exp >= 0.25, `exp ${sgn(m.exp, 3)} ≥ +0.25`], [m.pf >= 1.30, `PF ${f(m.pf)} ≥ 1.30`], [m.ciLo > 0, `CI lo ${sgn(m.ciLo, 3)} > 0`],
    [m.tradesPerYr >= 50, `${f(m.tradesPerYr, 0)} tr/yr ≥ 50`],
    [Math.sign(m.h1.exp) === Math.sign(m.h2.exp) && m.h1.exp >= 0.10 && m.h2.exp >= 0.10, `halves ${sgn(m.h1.exp, 3)}/${sgn(m.h2.exp, 3)} same sign & ≥ +0.10`],
    [m.top5Share <= 30, `top-5 ${f(m.top5Share, 0)}% ≤ 30%`], [m.coinsPosPct >= 55, `coins+ ${f(m.coinsPosPct, 0)}% ≥ 55%`], [expSlip15 >= 0.10, `slip15 ${sgn(expSlip15, 3)} ≥ +0.10`],
  ];
  const paper: Array<[boolean, string]> = [
    [m.exp >= 0.15, `exp ≥ +0.15`], [m.pf >= 1.15, `PF ≥ 1.15`], [m.ciLo > -0.05, `CI lo > −0.05`], [m.h1.exp > 0 && m.h2.exp > 0, `both halves > 0`], [m.tradesPerYr >= 30, `≥ 30 tr/yr`],
  ];
  const pp: Array<[boolean, string]> = [
    [m.exp >= 0.20, `exp ≥ +0.20`], [m.pf >= 1.30, `PF ≥ 1.30`], [m.ciLo > 0, `CI lo > 0`], [m.h1.exp >= 0.10 && m.h2.exp >= 0.10, `halves ≥ +0.10`], [m.tradesPerYr >= 80, `≥ 80 tr/yr`], [m.maxDD <= 25, `maxDD ${f(m.maxDD, 1)}R ≤ 25R`], [expSlip15 >= 0.10, `slip15 ≥ +0.10`],
  ];
  const fails = (xs: Array<[boolean, string]>) => xs.filter(([ok]) => !ok).map(([, w]) => w);
  return { acceptFails: fails(accept), paperFails: fails(paper), ppFails: fails(pp) };
}

async function main() {
  L(`# Phase 9 — REVIEW (statistics) of the portfolio researcher's E4 dd12/maxOpen10 grid cell — ${new Date().toISOString().slice(0, 10)}`);
  L(`data: researcher's snapshot ${SNAP} read directly from script/.cache (pl_*_${SNAP}.json + phase9-portfolio-ls-${C1H}-${SNAP}.json); $${START_CAPITAL} / ${BASE_RISK_PCT}%; ENGINE_EXIT ${JSON.stringify(ENGINE_EXIT)}`);
  L("");
  const registry = getAllStrategies();
  const ls = registry.find(s => s.id === "liquidity-sweep")!;
  const UNIVERSE = [...(ls.preferredSymbols ?? [])];
  const tsmom = makeTsmom(UNIVERSE);
  const streams = new Map<string, OHLCV[]>();
  const dailyBySym = new Map<string, OHLCV[]>(), weeklyBySym = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) {
    streams.set(`${sym}:1h`, loadCached(sym, "1h", C1H));
    const d = loadCached(sym, "1d", C1D); streams.set(`${sym}:1d`, d); dailyBySym.set(sym, d);
    weeklyBySym.set(sym, loadCached(sym, "1w", 400));
  }
  const md: MarketData = { btcDaily: loadCached("BTC", "1d", C1D), btcWeekly: loadCached("BTC", "1w", 400), dailyBySym, weeklyBySym };
  const btc1h = streams.get("BTC:1h")!;
  const FULL_START = btc1h[Math.max(ls.minCandles, 60)].time + 3600, FULL_END = btc1h[btc1h.length - 1].time + 3600, MID = (FULL_START + FULL_END) / 2;
  L(`FULL = ${iso(FULL_START)} → ${iso(FULL_END)} (MID ${iso(MID)}) — must equal the researcher's 2024-05-31 → 2026-09-02 / 2025-07-17`);

  const lsPath = `${CACHE_DIR}/phase9-portfolio-ls-${C1H}-${SNAP}.json`;
  const lsCands = JSON.parse(readFileSync(lsPath, "utf-8")) as Cand[];
  const tsCands: Cand[] = [];
  for (const sym of UNIVERSE) tsCands.push(...buildCandidates(tsmom, sym, streams.get(`${sym}:1d`)!, `${sym}:1d`));
  // pool order LS then TSMOM — identical relative order to the researcher's master pool for the E4 book
  const pool: Cand[] = [...lsCands, ...tsCands].map(c => ({ ...c })); pool.forEach((c, i) => { c.idx = i; });
  L(`pool: LS=${lsCands.length} (expect 7908) · TSMOM=${tsCands.length} (expect 2481)`);
  L("");

  const E4 = { strategies: ["tsmom"], lsMode: "shortBtcUp" as LsMode };
  const GUARDS: Array<{ guard: GuardKind; X?: number; name: string }> = [{ guard: "trio", name: "trio" }, { guard: "none", name: "OFF" }, { guard: "dd", X: 8, name: "dd8" }, { guard: "dd", X: 12, name: "dd12" }, { guard: "dd", X: 16, name: "dd16" }];
  const res = new Map<string, SimOut>();
  const key = (g: string, mo: number, slip: number, seed?: number) => `${g}|${mo}|${slip}|${seed ?? "-"}`;
  for (const g of GUARDS) for (const mo of [10, 6]) for (const slip of [0, 15]) res.set(key(g.name, mo, slip), simulate({ label: `E4 ${g.name} mo${mo} s${slip}`, ...E4, guard: g.guard, X: g.X, maxOpen: mo, driftBps: slip, pool: "E4" }, pool, streams, md, [ls, tsmom]));

  // ── 1. Reproduction of the researcher's grid (maxOpen 10) ──────────────────
  L(`## 1. Reproduction — E4 grid, FULL window (researcher's report values in brackets)`);
  const REF: Record<string, [number, number, number, number]> = { // T, exp, maxDD, sumR from phase9-report-portfolio.md
    "trio|10|0": [351, 0.282, 24.0, 98.8], "trio|10|15": [350, 0.237, 25.0, 82.9], "OFF|10|0": [439, 0.290, 20.5, 127.3], "OFF|10|15": [437, 0.230, 19.1, 100.3],
    "dd8|10|0": [420, 0.238, 22.9, 100.1], "dd8|10|15": [426, 0.169, 25.0, 72.1], "dd12|10|0": [430, 0.293, 16.9, 126.2], "dd12|10|15": [434, 0.221, 21.5, 96.1],
    "dd16|10|0": [437, 0.278, 22.9, 121.6], "dd16|10|15": [432, 0.201, 20.6, 87.0],
    "trio|6|0": [228, 0.352, 16.4, 80.3], "OFF|6|0": [216, 0.289, 16.0, 62.4], "dd8|6|0": [206, 0.213, 31.7, 43.8], "dd12|6|0": [210, 0.250, 23.8, 52.5], "dd16|6|0": [216, 0.289, 16.0, 62.4],
  };
  let reproOk = true;
  const gridOut: any[] = [];
  for (const mo of [10, 6]) for (const g of GUARDS) for (const slip of [0, 15]) {
    const r = res.get(key(g.name, mo, slip))!;
    const m = metricsX(r.trades, FULL_START, FULL_END, slip === 0 ? 10_000 : 4000);
    const ref = REF[`${g.name}|${mo}|${slip}`];
    const match = ref ? (m.n === ref[0] && Math.abs(m.exp - ref[1]) < 0.0015 && Math.abs(m.maxDD - ref[2]) < 0.06 && Math.abs(m.sumR - ref[3]) < 0.06) : null;
    if (match === false) reproOk = false;
    L(`  ${g.name.padEnd(4)} maxOpen ${mo} slip ${String(slip).padStart(2)}: T=${m.n} exp=${sgn(m.exp, 3)} PF=${f(m.pf)} sumR=${sgn(m.sumR, 1)} maxDD=${f(m.maxDD, 1)}R CIlo=${sgn(m.ciLo, 3)} H1/H2 ${sgn(m.h1.exp, 3)}/${sgn(m.h2.exp, 3)} halted ${f(100 * r.haltedMs / r.spanMs, 2)}%/${r.episodes}ep blocked ${r.guardBlocked}` + (ref ? `  [ref T=${ref[0]} exp ${sgn(ref[1], 3)} maxDD ${f(ref[2], 1)} sumR ${sgn(ref[3], 1)}] ${match ? "MATCH" : "MISMATCH"}` : ""));
    gridOut.push({ guard: g.name, maxOpen: mo, slip, T: m.n, exp: m.exp, pf: m.pf, sumR: m.sumR, maxDD: m.maxDD, maxDDengineR: m.maxDDengineR, ciLo: m.ciLo, ciHi: m.ciHi, h1: m.h1.exp, h2: m.h2.exp, coinsPosPct: m.coinsPosPct, top5Share: m.top5Share, tradesPerYr: m.tradesPerYr, haltedPct: 100 * r.haltedMs / r.spanMs, episodes: r.episodes, guardBlocked: r.guardBlocked, balDDpct: r.maxDDpct, match });
  }
  L(`  → reproduction of the researcher's grid: ${reproOk ? "EXACT (all referenced cells match)" : "MISMATCH — see rows"}`);
  L("");

  // ── 2. The cell under review, recomputed independently ────────────────────
  const cell = res.get(key("dd12", 10, 0))!, cell15 = res.get(key("dd12", 10, 15))!, off = res.get(key("OFF", 10, 0))!, trio = res.get(key("trio", 10, 0))!;
  const mC = metricsX(cell.trades, FULL_START, FULL_END), mC15 = metricsX(cell15.trades, FULL_START, FULL_END), mO = metricsX(off.trades, FULL_START, FULL_END), mT = metricsX(trio.trades, FULL_START, FULL_END);
  L(`## 2. Cell under review — E4 · DESIGN dd-guard X=12 (resume 6, 30d, 24h) · maxOpen 10 · 0 bps — FULL, independent recompute (bootstrap 10k, seed 42)`);
  L(`  dd12 : ${row(mC)}  balDD ${f(cell.maxDDpct, 1)}%`);
  L(`  +15bp: ${row(mC15)}`);
  L(`  OFF  : ${row(mO)}  balDD ${f(off.maxDDpct, 1)}%`);
  L(`  trio : ${row(mT)}  balDD ${f(trio.maxDDpct, 1)}%`);
  for (const [sid, s] of Object.entries(mC.sleeves)) L(`  dd12 sleeve ${sid.padEnd(16)} T=${s.n} exp=${sgn(s.exp, 3)} PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} coins+ ${s.coinsPos}/${s.coinsTotal}`);
  const claimed = { trades: 430, exp: 0.293, pf: 1.48, ci_low: 0.142, ci_high: 0.45, half1: 0.329, half2: 0.246, coins: 68, top5: 16, slip15: 0.221, maxDD: 16.9, sumR: 126.2, trYr: 191 };
  const chk = [
    ["T", mC.n, claimed.trades, 0], ["exp", mC.exp, claimed.exp, 0.0015], ["PF", mC.pf, claimed.pf, 0.006], ["CI lo", mC.ciLo, claimed.ci_low, 0.006], ["CI hi", mC.ciHi, claimed.ci_high, 0.006],
    ["H1", mC.h1.exp, claimed.half1, 0.0015], ["H2", mC.h2.exp, claimed.half2, 0.0015], ["coins+%", mC.coinsPosPct, claimed.coins, 0.6], ["top5%", mC.top5Share, claimed.top5, 0.6], ["slip15", mC15.exp, claimed.slip15, 0.0015], ["maxDD", mC.maxDD, claimed.maxDD, 0.06], ["sumR", mC.sumR, claimed.sumR, 0.06], ["tr/yr", mC.tradesPerYr, claimed.trYr, 0.6],
  ] as Array<[string, number, number, number]>;
  const bad = chk.filter(([, got, want, tol]) => Math.abs(got - want) > tol);
  L(`  claimed vs recomputed: ${chk.map(([k, got, want]) => `${k} ${f(got, 3)}(${want})`).join(" · ")}`);
  L(`  → headline numbers ${bad.length ? "DO NOT reproduce: " + bad.map(b => b[0]).join(", ") : "REPRODUCE (within rounding; CI differs only by bootstrap iteration count 4000 vs 10000)"}`);
  const cr = criteria(mC, mC15.exp);
  L(`  brief ACCEPT-FOR-LIVE (literal): ${cr.acceptFails.length ? "FAILS on " + cr.acceptFails.join("; ") : "all 8 met"}`);
  L(`  brief PAPER-CANDIDATE (literal): ${cr.paperFails.length ? "FAILS on " + cr.paperFails.join("; ") : "all 5 met"}`);
  L(`  researcher's PORTFOLIO-PAPER (literal): ${cr.ppFails.length ? "FAILS on " + cr.ppFails.join("; ") : "all 7 met"}`);
  L(`  maxDD in ENGINE-R (pnl / (balance × 2%), i.e. with the ×1.25 BTC-up multiplier the LS sleeve always carries): dd12 ${f(mC.maxDDengineR, 1)}R · OFF ${f(mO.maxDDengineR, 1)}R · trio ${f(mT.maxDDengineR, 1)}R  (trade-R: ${f(mC.maxDD, 1)} / ${f(mO.maxDD, 1)} / ${f(mT.maxDD, 1)})`);
  L("");

  // ── 3. What the guard actually did vs OFF ─────────────────────────────────
  L(`## 3. What dd12 changed relative to guards-OFF (same book, same order)`);
  const sig = (t: SimTrade) => `${t.symbol}|${t.strategy}|${t.openedSec}`;
  const offSet = new Map(inWin(off.trades, FULL_START, FULL_END).map(t => [sig(t), t])), cellSet = new Map(inWin(cell.trades, FULL_START, FULL_END).map(t => [sig(t), t]));
  const removed = [...offSet.values()].filter(t => !cellSet.has(sig(t))), added = [...cellSet.values()].filter(t => !offSet.has(sig(t)));
  const sr = stats(removed.map(t => t.netR)), sa = stats(added.map(t => t.netR));
  L(`  trades in OFF not in dd12: ${removed.length} (sumR ${sgn(sr.sumR, 1)}, exp ${sgn(sr.exp, 3)}) · trades in dd12 not in OFF: ${added.length} (sumR ${sgn(sa.sumR, 1)}, exp ${sgn(sa.exp, 3)}) · guard-blocked evaluations ${cell.guardBlocked} in ${cell.episodes} episodes, ${f(100 * cell.haltedMs / cell.spanMs, 2)}% of calendar`);
  L(`  removed: ${removed.map(t => `${iso(t.openedSec)} ${t.symbol} ${t.strategy === "tsmom" ? "TS" : "LS"} ${sgn(t.netR, 2)}`).join("; ")}`);
  L(`  added:   ${added.map(t => `${iso(t.openedSec)} ${t.symbol} ${t.strategy === "tsmom" ? "TS" : "LS"} ${sgn(t.netR, 2)}`).join("; ")}`);
  L(`  net effect: sumR ${sgn(mC.sumR - mO.sumR, 1)}, exp ${sgn(mC.exp - mO.exp, 3)}, maxDD ${sgn(mC.maxDD - mO.maxDD, 1)}R — the cell's exp/PF/CI are those of the unguarded E4 book ± noise from ${removed.length + added.length} trade substitutions`);
  L(`  grid-rule neighbours: dd8 maxDD ${f(gridOut.find(g => g.guard === "dd8" && g.maxOpen === 10 && g.slip === 0)!.maxDD, 1)}R, dd16 maxDD ${f(gridOut.find(g => g.guard === "dd16" && g.maxOpen === 10 && g.slip === 0)!.maxDD, 1)}R vs OFF ${f(mO.maxDD, 1)}R — both neighbours are WORSE than OFF; only X=12 improves it (non-monotonic response)`);
  L("");

  // ── 4. POST-HOC: same-timestamp order sensitivity of the pick and of the dd12 cell ──
  L(`## 4. POST-HOC (labelled) — same-timestamp order shuffles, ${SEEDS} seeds × {OFF, dd8, dd12, dd16}, maxOpen 10, 0 bps, FULL`);
  const seedRows: any[] = [];
  let pick12 = 0, dd12BeatsOff = 0, dd12Paper = 0, dd12Accept = 0, dd12ciPos = 0;
  const dd12exps: number[] = [], dd12dds: number[] = [], dd12cilo: number[] = [], offdds: number[] = [];
  for (let s = 1; s <= SEEDS; s++) {
    const cells: Record<string, M> = {};
    for (const g of GUARDS.filter(x => x.name !== "trio")) {
      const r = simulate({ label: `E4 ${g.name} seed${s}`, ...E4, guard: g.guard, X: g.X, maxOpen: 10, driftBps: 0, pool: "E4", seed: s }, pool, streams, md, [ls, tsmom]);
      cells[g.name] = metricsX(r.trades, FULL_START, FULL_END, 2000);
    }
    const o = cells.OFF;
    const ok = (["dd8", "dd12", "dd16"] as const).filter(k => cells[k].sumR >= 0.9 * o.sumR).sort((a, b) => cells[a].maxDD - cells[b].maxDD || parseInt(b.slice(2)) - parseInt(a.slice(2)));
    const pick = o.sumR > 0 ? (ok.length ? ok[0] : "none") : "undefined";
    if (pick === "dd12") pick12++;
    const c12 = cells.dd12;
    if (c12.maxDD < o.maxDD) dd12BeatsOff++;
    const pp = c12.exp >= 0.20 && c12.pf >= 1.30 && c12.ciLo > 0 && c12.h1.exp >= 0.10 && c12.h2.exp >= 0.10 && c12.tradesPerYr >= 80 && c12.maxDD <= 25;
    const acc = c12.exp >= 0.25 && c12.pf >= 1.30 && c12.ciLo > 0 && c12.h1.exp >= 0.10 && c12.h2.exp >= 0.10 && c12.top5Share <= 30 && c12.coinsPosPct >= 55;
    if (pp) dd12Paper++; if (acc) dd12Accept++; if (c12.ciLo > 0) dd12ciPos++;
    dd12exps.push(c12.exp); dd12dds.push(c12.maxDD); dd12cilo.push(c12.ciLo); offdds.push(o.maxDD);
    L(`  seed ${String(s).padStart(2)}: OFF exp ${sgn(o.exp, 3)} maxDD ${f(o.maxDD, 1)} | dd8 ${sgn(cells.dd8.exp, 3)}/${f(cells.dd8.maxDD, 1)} | dd12 ${sgn(c12.exp, 3)}/${f(c12.maxDD, 1)} CIlo ${sgn(c12.ciLo, 3)} H ${sgn(c12.h1.exp, 2)}/${sgn(c12.h2.exp, 2)} | dd16 ${sgn(cells.dd16.exp, 3)}/${f(cells.dd16.maxDD, 1)} → pick ${pick}; dd12 PORTFOLIO-PAPER ${pp ? "pass" : "FAIL"}, ACCEPT(ex-slip) ${acc ? "pass" : "FAIL"}`);
    seedRows.push({ seed: s, off: { exp: o.exp, maxDD: o.maxDD, sumR: o.sumR }, dd8: { exp: cells.dd8.exp, maxDD: cells.dd8.maxDD, sumR: cells.dd8.sumR }, dd12: { exp: c12.exp, maxDD: c12.maxDD, sumR: c12.sumR, ciLo: c12.ciLo, h1: c12.h1.exp, h2: c12.h2.exp, pf: c12.pf }, dd16: { exp: cells.dd16.exp, maxDD: cells.dd16.maxDD, sumR: cells.dd16.sumR }, pick, dd12Paper: pp, dd12Accept: acc });
  }
  const srt = (xs: number[]) => [...xs].sort((a, b) => a - b);
  const med = (xs: number[]) => srt(xs)[Math.floor(xs.length / 2)];
  L(`  summary: grid rule picks X=12 in ${pick12}/${SEEDS} orderings; dd12 maxDD < OFF maxDD in ${dd12BeatsOff}/${SEEDS}; dd12 exp min/med/max ${sgn(Math.min(...dd12exps), 3)}/${sgn(med(dd12exps), 3)}/${sgn(Math.max(...dd12exps), 3)}; dd12 maxDD min/med/max ${f(Math.min(...dd12dds), 1)}/${f(med(dd12dds), 1)}/${f(Math.max(...dd12dds), 1)}R (OFF maxDD ${f(Math.min(...offdds), 1)}…${f(Math.max(...offdds), 1)}R); CI lo > 0 in ${dd12ciPos}/${SEEDS}; PORTFOLIO-PAPER in ${dd12Paper}/${SEEDS}; ACCEPT(ex-slip) in ${dd12Accept}/${SEEDS}; default A→Z order exp ${sgn(mC.exp, 3)} maxDD ${f(mC.maxDD, 1)}R`);
  L("");

  // ── 5. POST-HOC: alternative half split (by trade count) and monthly profile ──
  L(`## 5. POST-HOC (labelled) — dd12 cell: halves by trade-count median, yearly slices, monthly sign count`);
  const tC = inWin(cell.trades, FULL_START, FULL_END).slice().sort((a, b) => a.openedSec - b.openedSec);
  const half = Math.floor(tC.length / 2);
  const q1 = stats(tC.slice(0, half).map(t => t.netR)), q2 = stats(tC.slice(half).map(t => t.netR));
  L(`  by trade count: first ${q1.n} exp ${sgn(q1.exp, 3)} PF ${f(q1.pf)} | last ${q2.n} exp ${sgn(q2.exp, 3)} PF ${f(q2.pf)}`);
  for (const [a, b, lab] of [[Date.UTC(2024, 0, 1) / 1000, Date.UTC(2025, 0, 1) / 1000, "2024"], [Date.UTC(2025, 0, 1) / 1000, Date.UTC(2026, 0, 1) / 1000, "2025"], [Date.UTC(2026, 0, 1) / 1000, FULL_END, "2026"]] as Array<[number, number, string]>) {
    const s = stats(tC.filter(t => t.openedSec >= a && t.openedSec < b).map(t => t.netR));
    L(`  ${lab}: T=${s.n} exp ${sgn(s.exp, 3)} PF ${f(s.pf)} sumR ${sgn(s.sumR, 1)}`);
  }
  const byM = new Map<string, number>(); for (const t of tC) { const k = iso(t.openedSec).slice(0, 7); byM.set(k, (byM.get(k) ?? 0) + t.netR); }
  const months = [...byM.entries()].sort(); const negM = months.filter(([, v]) => v < 0).length;
  L(`  months: ${months.length} traded, ${negM} negative; worst ${months.slice().sort((a, b) => a[1] - b[1])[0].join(" ")}R`);
  L("");

  writeFileSync(`${CACHE_DIR}/phase9-review-portfolio-stats-summary.json`, JSON.stringify({ generatedAt: new Date().toISOString(), snapshot: SNAP, windows: { FULL_START, FULL_END, MID }, reproOk, grid: gridOut, cell: { ...mC, sleeves: mC.sleeves, balDDpct: cell.maxDDpct, blocks: cell.blocks, guardBlocked: cell.guardBlocked, episodes: cell.episodes }, cellSlip15: mC15, off: mO, trio: mT, claimedVsRecomputed: chk, criteria: cr, removedVsOff: removed.length, addedVsOff: added.length, seeds: seedRows, seedSummary: { pick12, dd12BeatsOff, dd12Paper, dd12Accept, dd12ciPos } }, null, 1));
  writeFileSync(`${CACHE_DIR}/phase9-review-portfolio-stats-dd12-trades.json`, JSON.stringify(cell.trades));
  const outPath = "script/audit/phase9-report-review-portfolio-stats.md";
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[report written to ${outPath}]`);
}
main().catch(e => { console.error(e); process.exit(1); });
