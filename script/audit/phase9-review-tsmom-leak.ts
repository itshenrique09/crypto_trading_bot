// ─── AUDIT PHASE 9 — ADVERSARIAL REVIEW (leakage / selection-bias lens) of the
// TSMOM T0 verdict in script/audit/phase9-tsmom.ts (PAPER-CANDIDATE, exp +0.183).
//
// Pipeline is a verbatim copy of phase9-tsmom.ts (same makeTsmom, buildCandidates,
// resolveExits honest-close model, simulate with engine gates). Additions are REVIEW
// knobs only: explicit same-timestamp tie-break order, hold-cap override, next-open entry,
// alternative universes. Nothing here promotes anything.
//
// Review arms (fixed before running):
//   L0  reproduce T0 (A→Z tie-break, 200-bar cap)                      → must equal T=403 exp +0.183
//   L1  ENGINE tie-break order = getAllStrategies().flatMap(preferredSymbols) order (SCANNER_COINS,
//       routes.ts:179) — for a TSMOM-only book that is the LS preferredSymbols list order
//   L2  200 random same-timestamp orders: percentile of the A→Z result, share of orders that pass
//       the literal PAPER criteria (exp ≥ .15, PF ≥ 1.15, iid CI lo > −.05, halves > 0, ≥ 30/yr)
//   L3  cluster bootstrap (entry-week / entry-month clusters) on the T0 trade set — same-day
//       breakouts across 40 coins are not i.i.d.
//   L4  ENGINE max-hold parity: routes.ts MAX_HOLD_HOURS_BY_INTERVAL = {1h:200, 4h:240}, no "1d"
//       → maxHoldHoursForStrategy() falls back to 240h = 10 daily bars. Sim used 200 bars.
//   L5  entry at the NEXT candle's open instead of the signal close (fill realism; the engine
//       fills after the close with a 10-min freshness gate)
//   L6  time-cluster concentration: share of sumR from the top-5 entry-months
//   L7  SELECTION-BIAS probe: identical spec on two complement universes fixed a priori:
//       U-A = expand-universe-ls.ts CANDIDATES that the LS screen did NOT admit
//       U-B = 2022-era Binance large caps never in the LS universe (mechanical list; coins whose
//             spot pair no longer exists are skipped and reported — this makes U-B survivor-biased
//             in the SAME direction as the 40-coin list, i.e. conservative for this probe)
//
// Run: npx tsx script/audit/phase9-review-tsmom-leak.ts

import { writeFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import type { OHLCV } from "../../server/analysis";
import type { Strategy, StrategySignal } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause } from "../../server/portfolio-guards";
import {
  fetchPaginated, dailyTrendAt, intervalSec, stats, bootstrapCI, maxDrawdownR, calcATRLocal, mulberry32,
  COIN_GROUP, MAX_PER_GROUP, FIXED_MAX_OPEN, ROLLING_WINDOW_MS, MIN_SL_DISTANCE_PCT, MIN_RR, ENGINE_EXIT,
  type MarketData, type Trend,
} from "./lib";

const START_CAPITAL = 1000, BASE_RISK_PCT = 1, DAILY_CANDLES = 1500;
const UNIVERSE: string[] = [...(liquiditySweepStrategy.preferredSymbols ?? [])];
// Exact SCANNER_COINS order (routes.ts:179): union of every registry strategy's preferredSymbols in
// registry order → B&R coins, RSI coins, then the LS list. This is the order the engine scans in.
const SCANNER_COINS = Array.from(new Set(getAllStrategies().flatMap(s => s.preferredSymbols ?? [])));
const ENGINE_ORDER = new Map(SCANNER_COINS.map((s, i) => [s, i]));
const ENGINE_MAX_HOLD_BARS_1D = 10;   // routes.ts: MAX_HOLD_HOURS_BY_INTERVAL[...] ?? 240 → 240h / 24h
const N_ORDERS = 200;

// Complement universes — fixed before running (see header).
const U_A = ["TON", "TRX", "ALGO", "XLM", "JUP", "WIF", "BONK", "MKR", "MANA", "STX", "TAO", "AXS", "OP", "SHIB"];
const U_B = ["EOS", "XTZ", "THETA", "EGLD", "ZIL", "CHZ", "ENJ", "ONE", "NEO", "IOTA", "QTUM", "DASH", "ZEC", "BAT", "LRC", "1INCH", "COMP", "SNX", "YFI", "SUSHI", "KSM", "FLOW", "KAVA", "ROSE", "CELO", "ANKR", "AR", "STORJ", "SKL", "ICX"];

// ── TSMOM prototype (verbatim from phase9-tsmom.ts / phase6-tsmom.ts) ───────
function makeTsmom(id: string, donchianN: number, stopK: number, universe: string[]): Strategy {
  return {
    id, name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`, description: "TSMOM", interval: "1d",
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

interface Cand {
  stratId: string; interval: string; symbol: string; tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  slDistPct: number; sigClose: number; nextOpen: number; streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
}
function buildCandidates(strat: Strategy, symbol: string, candles: OHLCV[]): Cand[] {
  const out: Cand[] = [];
  const window = Math.max(strat.minCandles, 60), maxBars = 200, ivSec = intervalSec(strat.interval);
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
    out.push({ stratId: strat.id, interval: strat.interval, symbol, tsSec: candles[i].time + ivSec, dir: sig.direction,
      entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2,
      slDistPct, sigClose: candles[i].close, nextOpen: candles[i + 1].open, streamKey: `${symbol}:${strat.interval}`, entryIdx: i, maxBars, ivSec, idx: -1 });
  }
  return out;
}

interface EntryModel { driftBps: number; nextOpen: boolean; holdCapBars: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; filled: boolean; entryUsed: number }
const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = JSON.stringify({ poolName, model, exitCfg });
  const hit = exitCache.get(key); if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    const base = model.nextOpen ? c.nextOpen : c.sigClose;
    const d = model.driftBps / 10_000;
    const entry = c.dir === "LONG" ? base * (1 + d) : base * (1 - d);
    const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
    if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < MIN_RR) {
      out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", filled: false, entryUsed: entry }; continue;
    }
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > c.takeProfit1 : tp2raw < c.takeProfit1) ? tp2raw : c.takeProfit1;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + Math.min(c.maxBars, model.holdCapBars));
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: tp2 }, future, exitCfg);
    out[c.idx] = { netR: ex.netR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, filled: true, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

type Order = { kind: "az" } | { kind: "engine" } | { kind: "seed"; seed: number };
interface Arm { label: string; pool: string; order: Order; entry?: Partial<EntryModel> }
interface SimTrade { symbol: string; dir: "LONG" | "SHORT"; netR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number; outcome: string; barsHeld: number }

// Portfolio sim — identical gate sequence to phase9-tsmom.ts simulate() (single strategy book).
function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strat: Strategy) {
  const model: EntryModel = { driftBps: 0, nextOpen: false, holdCapBars: 200, ...(arm.entry ?? {}) };
  const exits = resolveExits(arm.pool, allCands, streams, model, ENGINE_EXIT);
  const cands = [...allCands].sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  if (arm.order.kind === "engine") cands.sort((a, b) => a.tsSec - b.tsSec || (ENGINE_ORDER.get(a.symbol) ?? 999) - (ENGINE_ORDER.get(b.symbol) ?? 999) || a.symbol.localeCompare(b.symbol));
  if (arm.order.kind === "seed") {
    const rnd = mulberry32(arm.order.seed);
    const keyed = cands.map(c => ({ c, k: rnd() }));
    keyed.sort((a, b) => a.c.tsSec - b.c.tsSec || a.k - b.k);
    cands.splice(0, cands.length, ...keyed.map(x => x.c));
  }
  const cd = strat.cooldownHours ?? 0;
  let balance = START_CAPITAL;
  interface OpenPos { group?: string; exitTsSec: number; trade: SimTrade }
  const openBySymbol = new Map<string, OpenPos[]>();
  const totalOpen = () => { let n = 0; for (const v of openBySymbol.values()) n += v.length; return n; };
  const lastClosedAt = new Map<string, number>();
  const closedLog: Array<{ strategy: string; closed_at: string; pnl_usd: number; risk_usd: number; outcome: string }> = [];
  const trades: SimTrade[] = []; const blocks: Record<string, number> = {};
  const block = (k: string) => { blocks[k] = (blocks[k] ?? 0) + 1; };
  const trendCache = new Map<string, Trend>();
  const dTrend = (nowSec: number): Trend => {
    const key = `d:${Math.floor(nowSec / 86_400)}`; let t = trendCache.get(key);
    if (t === undefined) { t = dailyTrendAt(md.btcDaily, nowSec); trendCache.set(key, t); } return t;
  };
  const closeDue = (nowSec: number) => {
    for (const [sym, list] of Array.from(openBySymbol.entries())) {
      const due = list.filter(p => p.exitTsSec <= nowSec); if (!due.length) continue;
      const remaining = list.filter(p => p.exitTsSec > nowSec);
      if (remaining.length) openBySymbol.set(sym, remaining); else openBySymbol.delete(sym);
      for (const pos of due) {
        balance += pos.trade.pnlUsd; lastClosedAt.set(sym, pos.exitTsSec * 1000);
        closedLog.push({ strategy: strat.id, closed_at: new Date(pos.exitTsSec * 1000).toISOString(), pnl_usd: pos.trade.pnlUsd, risk_usd: pos.trade.riskUsd, outcome: pos.trade.netR >= 0 ? "win" : "loss" });
        trades.push(pos.trade);
      }
    }
  };
  for (const c of cands) {
    const nowSec = c.tsSec, nowMs = nowSec * 1000;
    closeDue(nowSec);
    if ((openBySymbol.get(c.symbol) ?? []).length >= 1) { block("exposure"); continue; }
    if (cd > 0) { const last = lastClosedAt.get(c.symbol); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }
    const bt = dTrend(nowSec); const mult = bt === "up" ? 1.25 : bt === "down" ? 0.75 : 1;
    const oneR = balance * BASE_RISK_PCT / 100;
    const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
    const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
    if (dayPnl < -4 * oneR) { block("ddDaily"); continue; }
    if (isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: 6, now: nowMs })) { block("ddRolling7d"); continue; }
    if (totalOpen() >= FIXED_MAX_OPEN) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (group) { let g = 0; for (const l of openBySymbol.values()) for (const p of l) if (p.group === group) g++; if (g >= MAX_PER_GROUP) { block("groupCap"); continue; } }
    if (strategiesToPause(closedLog, [strat.id], { windowMs: ROLLING_WINDOW_MS, minTrades: 4, maxNetR: -3, now: nowMs }).has(strat.id)) { block("killSwitch"); continue; }
    const riskUsd = balance * BASE_RISK_PCT * mult / 100;
    const ex = exits[c.idx]; if (!ex.filled) { block("unfilled"); continue; }
    const trade: SimTrade = { symbol: c.symbol, dir: c.dir, netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec, outcome: ex.outcome, barsHeld: ex.barsHeld };
    const list = openBySymbol.get(c.symbol) ?? []; list.push({ group, exitTsSec: ex.exitTsSec, trade }); openBySymbol.set(c.symbol, list);
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { trades, blocks, candidates: cands.length };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
function clusterBootstrapCI(trades: SimTrade[], clusterSec: number, iters = 10_000, seed = 7): { lo: number; hi: number; clusters: number } {
  const byC = new Map<number, number[]>();
  for (const t of trades) { const k = Math.floor(t.openedSec / clusterSec); byC.set(k, [...(byC.get(k) ?? []), t.netR]); }
  const clusters = [...byC.values()]; const K = clusters.length;
  if (K < 2) return { lo: NaN, hi: NaN, clusters: K };
  const rnd = mulberry32(seed); const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0, n = 0;
    for (let j = 0; j < K; j++) { const c = clusters[(rnd() * K) | 0]; for (const r of c) { s += r; n++; } }
    means.push(n ? s / n : 0);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * 0.025)], hi: means[Math.floor(iters * 0.975)], clusters: K };
}
interface M { n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; h1: number; h2: number; h1n: number; h2n: number; top5: number; coinsPos: number; coins: number; trPerYr: number; maxDD: number; long: number; short: number; top5MonthsShare: number; wkLo: number; moLo: number; wkK: number; moK: number; paper: boolean; accept: boolean }
function metrics(trades: SimTrade[], iters = 10_000): M {
  const rs = trades.map(t => t.netR); const s = stats(rs);
  const ci = rs.length >= 2 ? bootstrapCI(rs, iters) : { lo: NaN, hi: NaN };
  let h1 = NaN, h2 = NaN, h1n = 0, h2n = 0, trPerYr = NaN;
  if (trades.length) {
    const t0 = Math.min(...trades.map(t => t.openedSec)), tE = Math.max(...trades.map(t => t.openedSec)), t1 = Math.max(...trades.map(t => t.closedSec));
    const mid = (t0 + tE) / 2;
    const a = stats(trades.filter(t => t.openedSec < mid).map(t => t.netR)), b = stats(trades.filter(t => t.openedSec >= mid).map(t => t.netR));
    h1 = a.exp; h2 = b.exp; h1n = a.n; h2n = b.n;
    trPerYr = s.n / ((t1 - t0) / (365.25 * 86_400));
  }
  const top5 = [...rs].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const byCoin = new Map<string, number>(); for (const t of trades) byCoin.set(t.symbol, (byCoin.get(t.symbol) ?? 0) + t.netR);
  const byM = new Map<string, number>(); for (const t of trades) { const k = new Date(t.openedSec * 1000).toISOString().slice(0, 7); byM.set(k, (byM.get(k) ?? 0) + t.netR); }
  const top5Months = [...byM.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const cw = iters >= 10_000 ? clusterBootstrapCI(trades, 7 * 86_400) : { lo: NaN, hi: NaN, clusters: 0 };
  const cm = iters >= 10_000 ? clusterBootstrapCI(trades, 30 * 86_400) : { lo: NaN, hi: NaN, clusters: 0 };
  const coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  const paper = s.exp >= 0.15 && s.pf >= 1.15 && ci.lo > -0.05 && h1 > 0 && h2 > 0 && trPerYr >= 30;
  const accept = s.exp >= 0.25 && s.pf >= 1.30 && ci.lo > 0 && (s.n >= 100 || trPerYr >= 50) && h1 >= 0.10 && h2 >= 0.10 && (s.sumR > 0 && 100 * top5 / s.sumR <= 30) && (byCoin.size ? 100 * coinsPos / byCoin.size >= 55 : false);
  return {
    n: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi, h1, h2, h1n, h2n,
    top5: s.sumR > 0 ? 100 * top5 / s.sumR : NaN, coinsPos, coins: byCoin.size, trPerYr, maxDD: maxDrawdownR(rs),
    long: trades.filter(t => t.dir === "LONG").length, short: trades.filter(t => t.dir === "SHORT").length,
    top5MonthsShare: s.sumR > 0 ? 100 * top5Months / s.sumR : NaN, wkLo: cw.lo, moLo: cm.lo, wkK: cw.clusters, moK: cm.clusters, paper, accept,
  };
}
const f = (n: number, d = 3) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
const g = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
function row(m: M): string {
  return `T=${m.n} WR=${g(m.wr, 0)}% PF=${g(m.pf)} sumR=${f(m.sumR, 1)} exp=${f(m.exp)} iidCI95=[${f(m.ciLo)}, ${f(m.ciHi)}] weekClusterLo=${f(m.wkLo)} (K=${m.wkK}) monthClusterLo=${f(m.moLo)} (K=${m.moK}) maxDD=${g(m.maxDD, 1)}R`;
}
function row2(m: M): string {
  return `halves ${f(m.h1)} (T=${m.h1n}) / ${f(m.h2)} (T=${m.h2n}) · top5 trades ${g(m.top5, 0)}% · top5 MONTHS ${g(m.top5MonthsShare, 0)}% of sumR · coins+ ${m.coinsPos}/${m.coins} · ${g(m.trPerYr, 0)} tr/yr · L/S ${m.long}/${m.short} · literal PAPER=${m.paper ? "PASS" : "FAIL"} ACCEPT=${m.accept ? "PASS" : "FAIL"}`;
}

async function loadDaily(symbols: string[], streams: Map<string, OHLCV[]>, L: (s: string) => void): Promise<string[]> {
  const ok: string[] = [], failed: string[] = [], short: string[] = [];
  for (const sym of symbols) {
    try {
      const c = await fetchPaginated(sym, "1d", DAILY_CANDLES);
      if (c.length < 80 + 200 + 10) { short.push(`${sym}:${c.length}`); continue; }
      streams.set(`${sym}:1d`, c); ok.push(sym);
    } catch (e: any) { failed.push(sym); }
  }
  L(`  loaded ${ok.length}/${symbols.length}: ${ok.join(" ")}${failed.length ? ` · fetch failed (no current Binance spot pair): ${failed.join(" ")}` : ""}${short.length ? ` · too short: ${short.join(" ")}` : ""}`);
  return ok;
}

async function main() {
  const lines: string[] = []; const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — ADVERSARIAL REVIEW (leakage / selection lens) of the TSMOM T0 verdict — ${new Date().toISOString().slice(0, 10)}`);
  L(`Pipeline verbatim from phase9-tsmom.ts ($1000 @ 1%, honest signal-close entry, engine gates, ENGINE_EXIT ${JSON.stringify(ENGINE_EXIT)}). Review arms only; nothing promoted.`);
  L("");
  const streams = new Map<string, OHLCV[]>();
  L(`## Data — 40-coin LS universe`);
  const okU = await loadDaily(UNIVERSE, streams, L);
  const btcDaily = await fetchPaginated("BTC", "1d", DAILY_CANDLES);
  const md: MarketData = { btcDaily, btcWeekly: [], dailyBySym: new Map(), weeklyBySym: new Map() };
  L(`  BTC:1d ${new Date(btcDaily[0].time * 1000).toISOString().slice(0, 10)} → ${new Date((btcDaily[btcDaily.length - 1].time + 86_400) * 1000).toISOString().slice(0, 10)} (${btcDaily.length}); phase-6 run of 2026-08-14 covered 1500 daily candles ending 2026-08-13 → overlap ≈ ${(100 * (1500 - 19) / 1500).toFixed(1)}% of this window`);
  L("");

  const stratU = makeTsmom("tsmom", 55, 2.0, okU);
  const poolU: Cand[] = [];
  for (const sym of okU) poolU.push(...buildCandidates(stratU, sym, streams.get(`${sym}:1d`)!));
  poolU.forEach((c, i) => { c.idx = i; });
  L(`## Candidates (40-coin universe, post minSL/R:R gates): ${poolU.length} (phase9-tsmom.ts reported 2481)`);
  L("");

  const out: Record<string, unknown> = {};
  const runArm = (arm: Arm, pool: Cand[], strat: Strategy, iters = 10_000) => {
    const r = simulate(arm, pool, streams, md, strat);
    const m = metrics(r.trades, iters);
    L(`## ${arm.label}`); L(`  ${row(m)}`); L(`  ${row2(m)}`);
    L(`  blocks: ${Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")}`); L("");
    out[arm.label] = m;
    return { r, m };
  };

  // L0 / L1
  const l0 = runArm({ label: "L0 reproduce T0 — A→Z tie-break, 200-bar cap, signal-close entry", pool: "U", order: { kind: "az" } }, poolU, stratU);
  const l1 = runArm({ label: "L1 ENGINE tie-break order (SCANNER_COINS = LS preferredSymbols order), 200-bar cap", pool: "U", order: { kind: "engine" } }, poolU, stratU);

  // L2 — 200 random orders
  {
    const exps: number[] = [], pass: boolean[] = [], ciLo: number[] = [];
    for (let seed = 1; seed <= N_ORDERS; seed++) {
      const r = simulate({ label: "", pool: "U", order: { kind: "seed", seed } }, poolU, streams, md, stratU);
      const m = metrics(r.trades, 2_000);
      exps.push(m.exp); pass.push(m.paper); ciLo.push(m.ciLo);
    }
    const s = [...exps].sort((a, b) => a - b);
    const pct = 100 * exps.filter(e => e < l0.m.exp).length / N_ORDERS;
    const pctEng = 100 * exps.filter(e => e < l1.m.exp).length / N_ORDERS;
    L(`## L2 same-timestamp tie-break null distribution — ${N_ORDERS} random orders (all daily candidates of a day share one timestamp; maxOpen blocked ${"maxOpen" in l0.r.blocks ? l0.r.blocks.maxOpen : 0} candidates in L0)`);
    L(`  exp min/p5/p25/median/p75/p95/max = ${f(s[0])}/${f(s[Math.floor(N_ORDERS * 0.05)])}/${f(s[Math.floor(N_ORDERS * 0.25)])}/${f(s[Math.floor(N_ORDERS * 0.5)])}/${f(s[Math.floor(N_ORDERS * 0.75)])}/${f(s[Math.floor(N_ORDERS * 0.95)])}/${f(s[N_ORDERS - 1])}`);
    L(`  reported A→Z result ${f(l0.m.exp)} sits at percentile ${pct.toFixed(1)} of the null · ENGINE order ${f(l1.m.exp)} at percentile ${pctEng.toFixed(1)}`);
    L(`  literal PAPER criteria pass in ${pass.filter(Boolean).length}/${N_ORDERS} orders (${(100 * pass.filter(Boolean).length / N_ORDERS).toFixed(0)}%) · exp ≥ 0.15 in ${exps.filter(e => e >= 0.15).length}/${N_ORDERS} · iid CI lo > 0 in ${ciLo.filter(x => x > 0).length}/${N_ORDERS} · iid CI lo > −0.05 in ${ciLo.filter(x => x > -0.05).length}/${N_ORDERS}`);
    out.L2 = { exps, pass, ciLo, pctAZ: pct, pctEngine: pctEng };
    L("");
  }

  // L3 — cluster bootstrap already in L0/L1 rows (weekClusterLo / monthClusterLo)
  L(`## L3 cluster bootstrap — see weekClusterLo / monthClusterLo on each row above (iid CI in phase9-tsmom.ts treats same-day breakouts across 40 coins as independent)`);
  L("");

  // L4 — engine hold cap parity
  const l4 = runArm({ label: `L4 ENGINE max-hold parity — 240h fallback = ${ENGINE_MAX_HOLD_BARS_1D} daily bars (routes.ts:99-102 has no "1d" key), A→Z`, pool: "U", order: { kind: "az" }, entry: { holdCapBars: ENGINE_MAX_HOLD_BARS_1D } }, poolU, stratU);
  runArm({ label: `L4b ENGINE max-hold ${ENGINE_MAX_HOLD_BARS_1D} bars + ENGINE order`, pool: "U", order: { kind: "engine" }, entry: { holdCapBars: ENGINE_MAX_HOLD_BARS_1D } }, poolU, stratU);
  {
    const le = l0.r.trades.filter(t => t.barsHeld <= ENGINE_MAX_HOLD_BARS_1D), gt = l0.r.trades.filter(t => t.barsHeld > ENGINE_MAX_HOLD_BARS_1D);
    L(`  L0 decomposition by hold: ≤${ENGINE_MAX_HOLD_BARS_1D} bars T=${le.length} sumR=${f(stats(le.map(t => t.netR)).sumR, 1)} exp=${f(stats(le.map(t => t.netR)).exp)} · >${ENGINE_MAX_HOLD_BARS_1D} bars T=${gt.length} sumR=${f(stats(gt.map(t => t.netR)).sumR, 1)} exp=${f(stats(gt.map(t => t.netR)).exp)} — the engine as written cannot hold the second group`);
    L("");
  }

  // L5 — next-open entry
  runArm({ label: "L5 entry at NEXT candle open (fill realism), A→Z, 200-bar cap", pool: "U", order: { kind: "az" }, entry: { nextOpen: true } }, poolU, stratU);

  // L6 — time-cluster concentration (already in rows) + by-year
  {
    const byY = new Map<string, number[]>();
    for (const t of l0.r.trades) { const y = new Date(t.openedSec * 1000).toISOString().slice(0, 4); byY.set(y, [...(byY.get(y) ?? []), t.netR]); }
    L(`## L6 time concentration of L0: top-5 entry-months = ${g(l0.m.top5MonthsShare, 0)}% of sumR · by year: ` + [...byY.entries()].sort().map(([y, r]) => { const s = stats(r); return `${y} T=${s.n} ${f(s.sumR, 1)}R exp=${f(s.exp, 2)}`; }).join(" | "));
    L("");
  }

  // L7 — selection-bias probe on complement universes
  for (const [name, list] of [["U-A (expand-universe-ls candidates NOT admitted by the LS screen)", U_A], ["U-B (2022-era Binance large caps never in the LS universe)", U_B]] as Array<[string, string[]]>) {
    L(`## L7 selection-bias probe — ${name}`);
    const ok = await loadDaily(list, streams, L);
    if (ok.length < 3) { L(`  too few coins loaded — skipped`); L(""); continue; }
    const strat = makeTsmom("tsmom", 55, 2.0, ok);
    const pool: Cand[] = [];
    for (const sym of ok) pool.push(...buildCandidates(strat, sym, streams.get(`${sym}:1d`)!));
    pool.forEach((c, i) => { c.idx = i; });
    L(`  candidates ${pool.length} (no COIN_GROUP entries for these coins → group cap inactive, which is permissive)`);
    const az = runArm({ label: `L7 ${name.split(" ")[0]} — A→Z, 200-bar cap`, pool: `P-${name.split(" ")[0]}`, order: { kind: "az" } }, pool, strat);
    const exps: number[] = [];
    for (let seed = 1; seed <= 50; seed++) exps.push(metrics(simulate({ label: "", pool: `P-${name.split(" ")[0]}`, order: { kind: "seed", seed } }, pool, streams, md, strat).trades, 2_000).exp);
    const s = [...exps].sort((a, b) => a - b);
    L(`  50 random orders: exp min/median/max ${f(s[0])}/${f(s[25])}/${f(s[49])} · exp ≥ 0.15 in ${exps.filter(e => e >= 0.15).length}/50`);
    // ungated signal level for the complement
    const ex = resolveExits(`P-${name.split(" ")[0]}`, pool, streams, { driftBps: 0, nextOpen: false, holdCapBars: 200 }, ENGINE_EXIT);
    const raw = pool.map(c => ex[c.idx]).filter(e => e.filled).map(e => e.netR);
    const rs = stats(raw);
    L(`  ungated signal level (every candidate): T=${rs.n} exp=${f(rs.exp)} PF=${g(rs.pf)} (40-coin universe ungated in phase9-tsmom.ts: T=2481 exp −0.040 PF 0.94)`);
    out[`L7-${name.split(" ")[0]}`] = { gated: az.m, orders: exps, ungated: rs, coins: ok };
    L("");
  }
  // also the 40-coin ungated for reference, same code path
  {
    const ex = resolveExits("U", poolU, streams, { driftBps: 0, nextOpen: false, holdCapBars: 200 }, ENGINE_EXIT);
    const raw = poolU.map(c => ex[c.idx]).filter(e => e.filled).map(e => e.netR); const rs = stats(raw);
    L(`## reference — 40-coin ungated signal level: T=${rs.n} exp=${f(rs.exp)} PF=${g(rs.pf)}`);
    L("");
  }

  writeFileSync("script/audit/phase9-report-review-tsmom-leak.md", lines.join("\n"));
  writeFileSync("script/.cache/phase9-review-tsmom-leak-summary.json", JSON.stringify(out, null, 1));
  console.log("\n[report written to script/audit/phase9-report-review-tsmom-leak.md]");
}
main().catch(e => { console.error(e); process.exit(1); });
