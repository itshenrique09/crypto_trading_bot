// ─── AUDIT PHASE 9 — ADVERSARIAL REVIEW of phase9-tsmom.ts (T0 verdict) ─────
// Pipeline copied from phase9-tsmom.ts (same candidates, same honest exits, same
// portfolio gates). Adds ONLY the review arms:
//   R0  reproduce T0 (A→Z tie-break, 200-day hold cap)               → must equal +0.183
//   R1  ENGINE tie-break order (registry flatMap(preferredSymbols) = LS list order)
//   R2  reverse Z→A order (another arbitrary order)
//   R3  ENGINE max-hold parity: routes.ts MAX_HOLD_HOURS_BY_INTERVAL has no "1d" key →
//       maxHoldHoursForStrategy() falls back to 240h = 10 daily bars; sim used 200 bars
//   R4  R3 with engine order
//   R5  R3 over 20 random tie-break seeds (median)
//   Cluster bootstrap (entry-week clusters, 10k) for R0/R1/R3 — same-day breakouts across
//   40 coins are not i.i.d. (65% sign agreement between same-day pairs in the T0 dump).
// All arms are REVIEW diagnostics; nothing here promotes anything.
// Run: npx tsx script/audit/phase9-review-tsmom.ts

import { writeFileSync } from "fs";
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
const ENGINE_ORDER = new Map(UNIVERSE.map((s, i) => [s, i]));   // getAllStrategies().flatMap(preferredSymbols) order
const ENGINE_MAX_HOLD_BARS_1D = 10;                              // 240h fallback / 24h

function makeTsmom(id: string, donchianN: number, stopK: number): Strategy {
  return {
    id, name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`, description: "", interval: "1d",
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

interface Cand {
  stratId: string; interval: string; symbol: string; tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  slDistPct: number; sigClose: number; streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
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
      slDistPct, sigClose: candles[i].close, streamKey: `${symbol}:${strat.interval}`, entryIdx: i, maxBars, ivSec, idx: -1 });
  }
  return out;
}

interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; filled: boolean; entryUsed: number }
const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(cands: Cand[], streams: Map<string, OHLCV[]>, holdCapBars: number, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = JSON.stringify({ holdCapBars, exitCfg });
  const hit = exitCache.get(key); if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    const entry = c.sigClose;
    const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
    if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < MIN_RR) {
      out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", filled: false, entryUsed: entry }; continue;
    }
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > c.takeProfit1 : tp2raw < c.takeProfit1) ? tp2raw : c.takeProfit1;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + Math.min(c.maxBars, holdCapBars));
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: tp2 }, future, exitCfg);
    out[c.idx] = { netR: ex.netR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, filled: true, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

interface Arm { label: string; order: "az" | "za" | "engine" | "seed"; seed?: number; holdCapBars: number }
interface SimTrade { symbol: string; dir: "LONG" | "SHORT"; netR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number; outcome: string; barsHeld: number }

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strat: Strategy) {
  const exits = resolveExits(allCands, streams, arm.holdCapBars, ENGINE_EXIT);
  const rnd = mulberry32(arm.seed ?? 1);
  const rank = new Map(allCands.map(c => [c, arm.order === "seed" ? rnd() : arm.order === "engine" ? (ENGINE_ORDER.get(c.symbol) ?? 999) : 0]));
  const cands = [...allCands].sort((a, b) => a.tsSec - b.tsSec
    || (arm.order === "az" ? a.symbol.localeCompare(b.symbol) : arm.order === "za" ? b.symbol.localeCompare(a.symbol) : rank.get(a)! - rank.get(b)!));
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
  return { trades, blocks };
}

// cluster bootstrap: resample entry-week clusters with replacement, mean of all trades in the drawn clusters
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

const f = (n: number, d = 3) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");
function summarize(label: string, trades: SimTrade[], L: (s: string) => void) {
  const rs = trades.map(t => t.netR); const s = stats(rs); const ci = bootstrapCI(rs, 10_000);
  const cw = clusterBootstrapCI(trades, 7 * 86_400), cm = clusterBootstrapCI(trades, 30 * 86_400);
  const t0 = Math.min(...trades.map(t => t.openedSec)), t1 = Math.max(...trades.map(t => t.openedSec)); const mid = (t0 + t1) / 2;
  const h1 = stats(trades.filter(t => t.openedSec < mid).map(t => t.netR)), h2 = stats(trades.filter(t => t.openedSec >= mid).map(t => t.netR));
  const top5 = [...rs].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
  const byCoin = new Map<string, number>(); for (const t of trades) byCoin.set(t.symbol, (byCoin.get(t.symbol) ?? 0) + t.netR);
  const cp = [...byCoin.values()].filter(v => v > 0).length;
  const y = (t1 - t0) / (365.25 * 86_400);
  L(`## ${label}`);
  L(`  T=${s.n} WR=${s.wr.toFixed(0)}% PF=${s.pf.toFixed(2)} sumR=${f(s.sumR, 1)} exp=${f(s.exp)} iidCI95=[${f(ci.lo)}, ${f(ci.hi)}] weekClusterCI95=[${f(cw.lo)}, ${f(cw.hi)}] (K=${cw.clusters}) monthClusterCI95=[${f(cm.lo)}, ${f(cm.hi)}] (K=${cm.clusters}) maxDD=${maxDrawdownR(rs).toFixed(1)}R`);
  L(`  halves ${f(h1.exp)} (T=${h1.n}) / ${f(h2.exp)} (T=${h2.n}) · top5 ${s.sumR > 0 ? (100 * top5 / s.sumR).toFixed(0) : "—"}% · coins+ ${cp}/${byCoin.size} · ${(s.n / y).toFixed(0)} tr/yr · timeouts ${trades.filter(t => t.outcome === "timeout").length}`);
  return { n: s.n, exp: s.exp, pf: s.pf, sumR: s.sumR, ciLo: ci.lo, clusterWeekLo: cw.lo, clusterMonthLo: cm.lo, h1: h1.exp, h2: h2.exp };
}

async function main() {
  const lines: string[] = []; const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — ADVERSARIAL REVIEW of the TSMOM T0 verdict — ${new Date().toISOString().slice(0, 10)}`);
  L(`Same pipeline as phase9-tsmom.ts ($1000 @ 1%, honest signal-close entry, engine gates). Review arms only.`);
  const streams = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) { try { streams.set(`${sym}:1d`, await fetchPaginated(sym, "1d", DAILY_CANDLES)); } catch (e: any) { console.error(`1d fetch failed ${sym}: ${e?.message ?? e}`); } }
  const btcDaily = await fetchPaginated("BTC", "1d", DAILY_CANDLES);
  const md: MarketData = { btcDaily, btcWeekly: [], dailyBySym: new Map(), weeklyBySym: new Map() };
  const strat = makeTsmom("tsmom", 55, 2.0);
  const pool: Cand[] = [];
  for (const sym of UNIVERSE) { const c = streams.get(`${sym}:1d`); if (c) pool.push(...buildCandidates(strat, sym, c)); }
  pool.forEach((c, i) => { c.idx = i; });
  L(`candidates=${pool.length} (phase9-tsmom.ts reported 2481)`); L("");

  const arms: Arm[] = [
    { label: "R0 reproduce T0 — A→Z tie-break, 200-day hold cap", order: "az", holdCapBars: 200 },
    { label: "R1 ENGINE tie-break order (LS preferredSymbols list), 200-day cap", order: "engine", holdCapBars: 200 },
    { label: "R2 reverse Z→A tie-break, 200-day cap", order: "za", holdCapBars: 200 },
    { label: `R3 ENGINE max-hold parity — 240h fallback = ${ENGINE_MAX_HOLD_BARS_1D} daily bars, A→Z`, order: "az", holdCapBars: ENGINE_MAX_HOLD_BARS_1D },
    { label: `R4 ENGINE max-hold ${ENGINE_MAX_HOLD_BARS_1D} bars + ENGINE order`, order: "engine", holdCapBars: ENGINE_MAX_HOLD_BARS_1D },
  ];
  const out: Record<string, unknown> = {};
  for (const arm of arms) {
    const r = simulate(arm, pool, streams, md, strat);
    out[arm.label] = summarize(arm.label, r.trades, L);
    L(`  blocks: ${Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ")}`); L("");
  }
  // R5: 20 seeds under the engine hold cap; and 20 seeds under 200-day cap for comparison
  for (const cap of [200, ENGINE_MAX_HOLD_BARS_1D]) {
    const e: number[] = [], lo: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const r = simulate({ label: "", order: "seed", seed, holdCapBars: cap }, pool, streams, md, strat);
      const rs = r.trades.map(t => t.netR); e.push(stats(rs).exp); lo.push(bootstrapCI(rs, 2_000).lo);
    }
    const s = [...e].sort((a, b) => a - b);
    L(`## R5 20 random tie-break seeds, hold cap ${cap} bars: exp min/med/max ${f(s[0])}/${f(s[10])}/${f(s[19])} · exp≥0.15 in ${e.filter(x => x >= 0.15).length}/20 · iid CI lo>0 in ${lo.filter(x => x > 0).length}/20 · iid CI lo>−0.05 in ${lo.filter(x => x > -0.05).length}/20`);
    out[`R5_cap${cap}`] = { exp: e, ciLo: lo };
  }
  L("");
  // hold-length decomposition on R0
  {
    const r = simulate(arms[0], pool, streams, md, strat);
    const le = r.trades.filter(t => t.barsHeld <= ENGINE_MAX_HOLD_BARS_1D), gt = r.trades.filter(t => t.barsHeld > ENGINE_MAX_HOLD_BARS_1D);
    L(`## R0 decomposition by hold: ≤${ENGINE_MAX_HOLD_BARS_1D} bars T=${le.length} sumR=${f(stats(le.map(t => t.netR)).sumR, 1)} exp=${f(stats(le.map(t => t.netR)).exp)} · >${ENGINE_MAX_HOLD_BARS_1D} bars T=${gt.length} sumR=${f(stats(gt.map(t => t.netR)).sumR, 1)} exp=${f(stats(gt.map(t => t.netR)).exp)}`);
  }
  writeFileSync("script/audit/phase9-report-review-tsmom.md", lines.join("\n"));
  writeFileSync("script/.cache/phase9-review-tsmom-summary.json", JSON.stringify(out, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
