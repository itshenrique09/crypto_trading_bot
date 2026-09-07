// ─── AUDIT PHASE 9 (2026-09-02) — component "brrsi" ────────────────────────────
// Break & Retest (4h) and RSI Divergence (1h): the only two strategies with honest
// positive expectancy after the LS look-ahead fix — both on HAND-PICKED coin lists.
// Question: is the edge real (survives the full 40-coin universe with identical
// parameters), or a selection artefact of the coin list?
//
// Fork of script/audit/phase8-collapse.ts: same buildCandidates → resolveExits (entry
// models) → parameterized portfolio simulate() mirroring the engine gates (one position
// per symbol, cooldown per (symbol,strategy), max open 10, group cap 3, weekly-trend
// alignment for 4h, daily −4R / rolling-7d −6R / kill-switch −3R over ≥4 trades,
// BTC daily-trend risk multiplier ×1.25/×0.75, exits TP1 60% → BE → 2R trail).
// Nothing under server/ is touched: strategies are wrapped as
//   { ...breakRetestStrategy, preferredSymbols: [...] } and passed alone to simulate().
//
// ── PRE-REGISTERED (fixed before any run) ──────────────────────────────────────
// H1  B&R's expectancy on its 6 preferred coins reflects a real edge: it also holds
//     (exp ≥ +0.15R) on the full 40-coin LS universe with identical parameters and the
//     weekly-trend gate.
// H2  RSI Divergence on ATOM/INJ likewise holds on the full 40-coin universe.
// H3  B&R and RSI expectancy is stable across halves of their windows.
// ARMS  B1 B&R ×6 preferred (4h×8000) · B2 B&R ×40 · B3 B&R ×34 non-preferred only ·
//       B4 = B1 and B2 under +15 bps adverse entry (SL/TP fixed, right-sized; +30 also shown)
//       R1 RSI ATOM/INJ (1h×20000) · R2 RSI ×40 · R3 RSI ×38 non-preferred · R4 = R2 +15 bps
// WINDOWS  FULL · H1/H2 (split at the midpoint of the pool's decision-time range) · 2026
// ACCEPT-LIVE-CANDIDATE = ALL of: exp ≥ +0.25R; PF ≥ 1.30; bootstrap CI95 lower > 0 (FULL);
//   ≥ 50 trades/yr (or ≥ 100 total for 4h/daily strategies); exp same sign in both halves
//   AND each half ≥ +0.10R; top-5 trades ≤ 30% of sumR; multi-coin: ≥ 55% of traded coins
//   with positive sumR; exp under +15 bps entry slippage ≥ +0.10R.
// PAPER-CANDIDATE = exp ≥ +0.15R; PF ≥ 1.15; CI95 lower > −0.05R; both halves positive;
//   ≥ 30 trades/yr.   REJECT otherwise.   INSUFFICIENT-DATA (declared here): T_FULL < 30.
// SELECTION-BIAS RULE: a hand-picked coin list must ALSO reach exp ≥ +0.15R on the full
//   40-coin universe (B2 / R2, same parameters); otherwise the preferred-coin result is an
//   artefact → component verdict REJECT regardless of B1 / R1.
// POST-HOC (allowed, labelled, never used for promotion): guards off; B&R LONG vs SHORT;
//   direction × BTC daily; per-year and per-coin tables; +30 bps.
//
// Run:  npx tsx script/audit/phase9-brrsi.ts [--c4h=8000] [--c1h=20000] [--capital=500] [--risk=2]
// Parity arm P0: registry (LS floor 68 + B&R + RSI) on the last 8000×1h + 8000×4h with the
// harness's 600/400-day trend context must reproduce the official B&R T=92 / +0.45R and
// RSI T=46 / +0.48R rows (same-day candle cache).

import { writeFileSync } from "fs";
import { breakRetestStrategy } from "../../server/strategies/break-retest";
import { rsiDivergenceStrategy } from "../../server/strategies/rsi-divergence";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import type { OHLCV } from "../../server/analysis";
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
const C4H = parseInt(argv.c4h ?? "8000");
const C1H = parseInt(argv.c1h ?? "20000");
const START_CAPITAL = parseFloat(argv.capital ?? "500");
const BASE_RISK_PCT = parseFloat(argv.risk ?? "2");
const DAILY_TOTAL = 1500;          // full-window daily trend context (harness uses 600 BTC / 400 alts)
const YEAR_SEC = 365.25 * 86_400;

const UNIVERSE: string[] = [...(liquiditySweepStrategy.preferredSymbols ?? [])];   // 40 coins
const BR_PREF: string[] = [...(breakRetestStrategy.preferredSymbols ?? [])];       // SOL SAND BNB XRP AVAX ETC
const RSI_PREF: string[] = [...(rsiDivergenceStrategy.preferredSymbols ?? [])];    // ATOM INJ

// ── Candidates ──────────────────────────────────────────────────────────────
interface Cand {
  stratId: string; interval: string; symbol: string;
  tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; rr: number;
  sigClose: number;
  streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
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

// ── Exit resolution under an entry model ────────────────────────────────────
// "close" → enter at the signal candle close (B&R and RSI report entry = last close, so
//           this IS the honest decision price — no look-ahead by construction).
// "drift" → adverse market fill: entry moved AGAINST the trade by driftBps; SL/TP stay at
//           the signal levels; position right-sized to the planned $risk (netR is per the
//           new, shorter risk distance — exactly what liveScan does).
interface EntryModel { kind: "close" | "drift"; driftBps?: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; entryUsed: number }

const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(poolName: string, cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = poolName + "|" + JSON.stringify({ model, exitCfg });
  const hit = exitCache.get(key);
  if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    let entry = c.entry;
    if (model.kind === "drift") {
      const d = (model.driftBps ?? 0) / 10_000;
      entry = c.dir === "LONG" ? c.entry * (1 + d) : c.entry * (1 - d);
    }
    const riskNow = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    if (riskNow <= 0) { out[c.idx] = { netR: -1, exitTsSec: c.tsSec + c.ivSec, barsHeld: 1, outcome: "loss", tp1Hit: false, entryUsed: entry }; continue; }
    const tp1Ok = c.dir === "LONG" ? c.takeProfit1 > entry : c.takeProfit1 < entry;
    const tp1 = tp1Ok ? c.takeProfit1 : (c.dir === "LONG" ? entry + riskNow * 1.5 : entry - riskNow * 1.5);
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > tp1 : tp2raw < tp1) ? tp2raw : tp1;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + c.maxBars);
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: tp1, takeProfit2: tp2 }, future, exitCfg);
    out[c.idx] = { netR: ex.netR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, tp1Hit: ex.tp1Hit, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

// ── Portfolio simulation (parameterized ENGINE-CURRENT) ─────────────────────
interface Arm {
  id: string; label: string;
  pool: string;                          // candidate pool name
  strategies?: string[];                 // strategy ids allowed (default: all in pool)
  symbols?: Set<string>;                 // symbol filter (B3 / R3)
  floor?: Record<string, number>;
  guardsOff?: boolean;                   // POST-HOC: daily / rolling / kill-switch off
  entry?: EntryModel;
  posthoc?: boolean;
}
interface SimTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT"; confidence: number;
  netR: number; riskUsd: number; pnlUsd: number; openedSec: number; closedSec: number;
  btcD: Trend; outcome: string; tp1Hit: boolean; barsHeld: number; entryUsed: number; slDistPct: number;
}
interface SimOut { arm: Arm; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number }

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const exitCfg = ENGINE_EXIT;
  const exits = resolveExits(arm.pool, allCands, streams, arm.entry ?? { kind: "close" }, exitCfg);
  const active = new Set(arm.strategies ?? strategies.map(s => s.id));
  const cands = allCands
    .filter(c => active.has(c.stratId))
    .filter(c => !arm.symbols || arm.symbols.has(c.symbol))
    .filter(c => { const fl = arm.floor?.[c.stratId]; return fl == null || c.confidence >= fl; })
    .sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));
  const guards = !arm.guardsOff;

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
    if ((openBySymbol.get(c.symbol) ?? []).length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; } }

    const btcDailyTrend = dTrend("BTC", nowSec);
    let riskMultiplier = 1.0;
    if (btcDailyTrend === "up") riskMultiplier = 1.25; else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    const oneR = balance * BASE_RISK_PCT / 100;

    if (guards) {
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -4 * oneR) { block("ddDaily"); continue; }
      if (isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: 6, now: nowMs })) { block("ddRolling7d"); continue; }
    }
    if (totalOpen() >= FIXED_MAX_OPEN) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const p of list) if (p.group === group) inGroup++;
      if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; }
    }
    if (guards) {
      const paused = strategiesToPause(closedLog, [c.stratId], { windowMs: ROLLING_WINDOW_MS, minTrades: 4, maxNetR: -3, now: nowMs });
      if (paused.has(c.stratId)) { block("killSwitch"); continue; }
    }
    if (c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }
    const riskUsd = balance * BASE_RISK_PCT * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, dir: c.dir, confidence: c.confidence,
      netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd, openedSec: nowSec, closedSec: ex.exitTsSec,
      btcD: btcDailyTrend, outcome: ex.outcome, tp1Hit: ex.tp1Hit, barsHeld: ex.barsHeld, entryUsed: ex.entryUsed, slDistPct: c.slDistPct,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { arm, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100 };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 3) => (Number.isFinite(n) ? (n >= 0 ? "+" : "") + n.toFixed(d) : "—");

interface WinMetrics {
  n: number; wr: number; pf: number; sumR: number; exp: number; ciLo: number; ciHi: number; maxDDR: number;
  top5Pct: number; coins: number; coinsPos: number; coinsPosPct: number; tradesPerYr: number; years: number;
  longN: number; longExp: number; shortN: number; shortExp: number;
}
function metrics(trades: SimTrade[], fromSec: number, toSec: number, iters = 10_000): WinMetrics {
  const t = trades.filter(x => x.openedSec >= fromSec && x.openedSec < toSec);
  const rs = t.map(x => x.netR);
  const s = stats(rs);
  const ci = rs.length >= 2 ? bootstrapCI(rs, iters) : { lo: NaN, hi: NaN };
  const sorted = [...rs].sort((a, b) => b - a);
  const top5 = sorted.slice(0, 5).reduce((a, b) => a + b, 0);
  const byCoin = new Map<string, number>();
  for (const x of t) byCoin.set(x.symbol, (byCoin.get(x.symbol) ?? 0) + x.netR);
  const coins = byCoin.size, coinsPos = [...byCoin.values()].filter(v => v > 0).length;
  const years = Math.max(1e-9, (Math.min(toSec, Number.MAX_SAFE_INTEGER / 2) - fromSec) / YEAR_SEC);
  const L = stats(t.filter(x => x.dir === "LONG").map(x => x.netR)), S = stats(t.filter(x => x.dir === "SHORT").map(x => x.netR));
  return {
    n: s.n, wr: s.wr, pf: s.pf, sumR: s.sumR, exp: s.exp, ciLo: ci.lo, ciHi: ci.hi, maxDDR: maxDrawdownR(rs),
    top5Pct: s.sumR > 0 ? 100 * top5 / s.sumR : NaN, coins, coinsPos, coinsPosPct: coins ? 100 * coinsPos / coins : NaN,
    tradesPerYr: s.n / years, years,
    longN: L.n, longExp: L.exp, shortN: S.n, shortExp: S.exp,
  };
}
function mline(m: WinMetrics): string {
  return `T=${String(m.n).padStart(4)} WR=${f(m.wr, 0).padStart(3)}% PF=${f(m.pf).padStart(5)} sumR=${sgn(m.sumR, 1).padStart(7)} exp=${sgn(m.exp)} CI95=[${sgn(m.ciLo, 2)}, ${sgn(m.ciHi, 2)}] maxDD=${f(m.maxDDR, 1)}R top5=${f(m.top5Pct, 0)}% coins+ ${m.coinsPos}/${m.coins} T/yr=${f(m.tradesPerYr, 1)}`;
}

// ── Verdict (pre-registered rules, applied literally) ───────────────────────
type Verdict = "ACCEPT-LIVE-CANDIDATE" | "PAPER-CANDIDATE" | "REJECT" | "INSUFFICIENT-DATA";
interface ArmResult {
  id: string; label: string; component: string; hypothesis: string; window: string;
  full: WinMetrics; h1: WinMetrics; h2: WinMetrics; y2026: WinMetrics; slip15Exp: number; slip30Exp: number; slip15N: number;
  multiCoin: boolean; is4h: boolean; verdict: Verdict; reasons: string[]; posthoc: boolean;
  blocks: Record<string, number>; dirBtc: string[]; perCoin: string; perYear: string; exits: string;
}
function verdictFor(full: WinMetrics, h1: WinMetrics, h2: WinMetrics, slip15Exp: number, multiCoin: boolean, is4h: boolean): { verdict: Verdict; reasons: string[] } {
  const fail: string[] = [];
  if (full.n < 30) return { verdict: "INSUFFICIENT-DATA", reasons: [`T=${full.n} < 30`] };
  const bothPos = h1.exp > 0 && h2.exp > 0;
  // ACCEPT
  if (!(full.exp >= 0.25)) fail.push(`exp ${sgn(full.exp)} < +0.25`);
  if (!(full.pf >= 1.30)) fail.push(`PF ${f(full.pf)} < 1.30`);
  if (!(full.ciLo > 0)) fail.push(`CI95 lower ${sgn(full.ciLo, 2)} ≤ 0`);
  const freqOk = full.tradesPerYr >= 50 || (is4h && full.n >= 100);
  if (!freqOk) fail.push(`${f(full.tradesPerYr, 1)} trades/yr < 50${is4h ? ` and T=${full.n} < 100` : ""}`);
  if (!(Math.sign(h1.exp) === Math.sign(h2.exp) && h1.exp >= 0.10 && h2.exp >= 0.10)) fail.push(`halves H1 ${sgn(h1.exp)} / H2 ${sgn(h2.exp)} (need same sign, each ≥ +0.10)`);
  if (!(full.top5Pct <= 30)) fail.push(`top-5 share ${f(full.top5Pct, 0)}% > 30%`);
  if (multiCoin && !(full.coinsPosPct >= 55)) fail.push(`coins positive ${full.coinsPos}/${full.coins} = ${f(full.coinsPosPct, 0)}% < 55%`);
  if (!(slip15Exp >= 0.10)) fail.push(`exp under +15 bps ${sgn(slip15Exp)} < +0.10`);
  if (fail.length === 0) return { verdict: "ACCEPT-LIVE-CANDIDATE", reasons: ["all ACCEPT criteria met"] };
  // PAPER
  const pfail: string[] = [];
  if (!(full.exp >= 0.15)) pfail.push(`exp ${sgn(full.exp)} < +0.15`);
  if (!(full.pf >= 1.15)) pfail.push(`PF ${f(full.pf)} < 1.15`);
  if (!(full.ciLo > -0.05)) pfail.push(`CI95 lower ${sgn(full.ciLo, 2)} ≤ −0.05`);
  if (!bothPos) pfail.push(`halves not both positive (H1 ${sgn(h1.exp)} / H2 ${sgn(h2.exp)})`);
  if (!(full.tradesPerYr >= 30)) pfail.push(`${f(full.tradesPerYr, 1)} trades/yr < 30`);
  if (pfail.length === 0) return { verdict: "PAPER-CANDIDATE", reasons: ["ACCEPT failed: " + fail.join("; "), "all PAPER criteria met"] };
  return { verdict: "REJECT", reasons: ["ACCEPT failed: " + fail.join("; "), "PAPER failed: " + pfail.join("; ")] };
}

// ── Diagnostics tables ──────────────────────────────────────────────────────
function dirBtcTable(trades: SimTrade[]): string[] {
  const out: string[] = [];
  for (const dir of ["LONG", "SHORT"]) for (const tr of ["up", "neutral", "down"]) {
    const t = trades.filter(x => x.dir === dir && x.btcD === tr);
    if (!t.length) continue;
    const s = stats(t.map(x => x.netR));
    out.push(`${dir.padEnd(5)} · BTC ${tr.padEnd(7)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} exp=${sgn(s.exp)}`);
  }
  return out;
}
function perCoin(trades: SimTrade[]): string {
  const by = new Map<string, number[]>();
  for (const t of trades) by.set(t.symbol, [...(by.get(t.symbol) ?? []), t.netR]);
  return [...by.entries()].map(([sym, r]) => ({ sym, n: r.length, sumR: r.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.sumR - a.sumR).map(c => `${c.sym} ${sgn(c.sumR, 1)}/${c.n}`).join("  ");
}
function perYear(trades: SimTrade[]): string {
  const by = new Map<string, number[]>();
  for (const t of trades) { const y = new Date(t.openedSec * 1000).toISOString().slice(0, 4); by.set(y, [...(by.get(y) ?? []), t.netR]); }
  return [...by.entries()].sort().map(([y, r]) => { const s = stats(r); return `${y}: T=${s.n} PF=${f(s.pf)} exp=${sgn(s.exp)} sumR=${sgn(s.sumR, 1)}`; }).join(" | ");
}
function exitsTable(trades: SimTrade[]): string {
  const by = new Map<string, number[]>();
  for (const t of trades) by.set(t.outcome, [...(by.get(t.outcome) ?? []), t.netR]);
  return [...by.entries()].map(([k, r]) => `${k}=${r.length} (avg ${sgn(r.reduce((a, b) => a + b, 0) / r.length, 2)}R)`).join("  ");
}

// ── Data loading ────────────────────────────────────────────────────────────
async function loadStreams(specs: Array<{ sym: string; interval: string; total: number }>): Promise<Map<string, OHLCV[]>> {
  const streams = new Map<string, OHLCV[]>();
  for (const s of specs) {
    const key = `${s.sym}:${s.interval}`;
    if (streams.has(key)) continue;
    try { streams.set(key, await fetchPaginated(s.sym, s.interval, s.total)); }
    catch (e: any) { console.error(`fetch failed ${key} ×${s.total}: ${e?.message ?? e}`); }
  }
  return streams;
}
async function loadContext(dailyTotalBtc: number, dailyTotalAlt: number, syms: string[]): Promise<MarketData> {
  const btcDaily = await fetchPaginated("BTC", "1d", dailyTotalBtc);
  const btcWeekly = await fetchPaginated("BTC", "1w", 400);
  const dailyBySym = new Map<string, OHLCV[]>();
  const weeklyBySym = new Map<string, OHLCV[]>();
  for (const sym of syms) {
    try { dailyBySym.set(sym, await fetchPaginated(sym, "1d", dailyTotalAlt)); } catch (e: any) { console.error(`daily ${sym}: ${e?.message ?? e}`); }
    try { weeklyBySym.set(sym, await fetchPaginated(sym, "1w", 400)); } catch (e: any) { console.error(`weekly ${sym}: ${e?.message ?? e}`); }
  }
  return { btcDaily, btcWeekly, dailyBySym, weeklyBySym };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const lines: string[] = [];
  const L = (s = "") => { console.log(s); lines.push(s); };
  L(`# Phase 9 — brrsi: Break & Retest and RSI Divergence vs the selection-bias rule — ${new Date().toISOString().slice(0, 10)}`);
  L(`4h candles ${C4H} · 1h candles ${C1H} · capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · fees 0.05%+0.05%/side (engine defaults) · daily-trend context ${DAILY_TOTAL}d`);
  L(`universe (${UNIVERSE.length}): ${UNIVERSE.join(" ")}`);
  L(`B&R preferred: ${BR_PREF.join(" ")} · RSI preferred: ${RSI_PREF.join(" ")}`);
  L("");

  // wrapped strategies (server/ untouched)
  const brPref: Strategy = { ...breakRetestStrategy, preferredSymbols: BR_PREF };
  const brAll: Strategy = { ...breakRetestStrategy, preferredSymbols: UNIVERSE };
  const rsiPref: Strategy = { ...rsiDivergenceStrategy, preferredSymbols: RSI_PREF };
  const rsiAll: Strategy = { ...rsiDivergenceStrategy, preferredSymbols: UNIVERSE };

  // data
  const streams = await loadStreams([
    ...UNIVERSE.map(sym => ({ sym, interval: "4h", total: C4H })),
    ...UNIVERSE.map(sym => ({ sym, interval: "1h", total: C1H })),
  ]);
  const md = await loadContext(DAILY_TOTAL, DAILY_TOTAL, UNIVERSE);
  const mdHarness = await loadContext(600, 400, UNIVERSE);
  const cov = (iv: string, window: number) => {
    let t0 = Infinity, t1 = 0, coinYears = 0;
    for (const sym of UNIVERSE) {
      const c = streams.get(`${sym}:${iv}`); if (!c || c.length < window + 70) continue;
      t0 = Math.min(t0, c[window].time); t1 = Math.max(t1, c[c.length - 1].time);
      coinYears += (c[c.length - 1].time - c[window].time) / YEAR_SEC;
    }
    return { t0, t1, coinYears };
  };
  const cov4h = cov("4h", 150), cov1h = cov("1h", 250);
  L(`4h coverage: ${new Date(cov4h.t0 * 1000).toISOString().slice(0, 10)} → ${new Date(cov4h.t1 * 1000).toISOString().slice(0, 10)} (${f((cov4h.t1 - cov4h.t0) / YEAR_SEC, 2)}y; ${f(cov4h.coinYears, 0)} coin-years over 40 coins)`);
  L(`1h coverage: ${new Date(cov1h.t0 * 1000).toISOString().slice(0, 10)} → ${new Date(cov1h.t1 * 1000).toISOString().slice(0, 10)} (${f((cov1h.t1 - cov1h.t0) / YEAR_SEC, 2)}y; ${f(cov1h.coinYears, 0)} coin-years over 40 coins)`);
  const short = UNIVERSE.filter(s => (streams.get(`${s}:4h`)?.length ?? 0) < C4H).map(s => `${s}:${streams.get(`${s}:4h`)?.length ?? 0}`);
  L(`coins with < ${C4H} 4h candles on Binance: ${short.join(" ") || "none"}`);
  L("");

  // candidate pools
  const pools = new Map<string, Cand[]>();
  const buildPool = (name: string, strat: Strategy) => {
    const p: Cand[] = [];
    for (const sym of strat.preferredSymbols ?? []) { const c = streams.get(`${sym}:${strat.interval}`); if (c) p.push(...buildCandidates(strat, sym, c)); }
    p.forEach((c, i) => { c.idx = i; });
    pools.set(name, p);
    L(`pool ${name}: ${p.length} candidates (post minSL+RR) on ${new Set(p.map(c => c.symbol)).size} coins`);
  };
  buildPool("br40", brAll);
  buildPool("rsi40", rsiAll);
  // preferred-only pools are the same candidates filtered by symbol — but built as their own
  // pool so exposure/guards see ONLY the preferred coins (what the engine does today).
  buildPool("br6", brPref);
  buildPool("rsi2", rsiPref);

  // parity pool P0: registry set on the last 8000×1h (same data as the official 8000 fetch) + 8000×4h
  const streamsP = new Map<string, OHLCV[]>();
  for (const sym of UNIVERSE) {
    const h = streams.get(`${sym}:1h`); if (h) streamsP.set(`${sym}:1h`, h.slice(-8000));
    const q = streams.get(`${sym}:4h`); if (q) streamsP.set(`${sym}:4h`, q.slice(-8000));
  }
  const registry: Strategy[] = [breakRetestStrategy, rsiDivergenceStrategy, liquiditySweepStrategy];
  const poolP: Cand[] = [];
  for (const strat of registry) for (const sym of strat.preferredSymbols ?? []) { const c = streamsP.get(`${sym}:${strat.interval}`); if (c) poolP.push(...buildCandidates(strat, sym, c)); }
  poolP.forEach((c, i) => { c.idx = i; });
  L(`pool P0 (registry, last 8000×1h + 8000×4h): ${poolP.length} candidates`);
  L("");

  // ── P0 parity ──
  const p0 = simulate({ id: "P0", label: "P0 parity: registry LS68+B&R+RSI, harness context", pool: "P0", floor: { "liquidity-sweep": 68 } }, poolP, streamsP, mdHarness, registry);
  L(`## P0 parity — registry system (expects LS T=632 −0.03R · B&R T=92 +0.45R · RSI T=46 +0.48R)`);
  for (const sid of ["liquidity-sweep", "break-retest", "rsi-divergence"]) {
    const t = p0.trades.filter(x => x.strategy === sid); const s = stats(t.map(x => x.netR));
    L(`  ${sid.padEnd(16)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} exp=${sgn(s.exp)}`);
  }
  { const s = stats(p0.trades.map(x => x.netR)); L(`  ${"SYSTEM".padEnd(16)} T=${String(s.n).padStart(4)} WR=${f(s.wr, 0)}% PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} exp=${sgn(s.exp)}`); }
  L("");

  // ── Pre-registered arms ──
  const notPref = (pref: string[]) => new Set(UNIVERSE.filter(s => !pref.includes(s)));
  const arms: Arm[] = [
    { id: "B1", label: "B&R ×6 preferred (SOL SAND BNB XRP AVAX ETC), 4h", pool: "br6" },
    { id: "B2", label: "B&R ×40 universe, 4h, identical params + weekly gate", pool: "br40" },
    { id: "B3", label: "B&R ×34 non-preferred only (out-of-sample coins)", pool: "br40", symbols: notPref(BR_PREF) },
    { id: "B4a", label: "B&R ×6 preferred, +15 bps adverse entry", pool: "br6", entry: { kind: "drift", driftBps: 15 } },
    { id: "B4b", label: "B&R ×40 universe, +15 bps adverse entry", pool: "br40", entry: { kind: "drift", driftBps: 15 } },
    { id: "B4c", label: "B&R ×6 preferred, +30 bps adverse entry", pool: "br6", entry: { kind: "drift", driftBps: 30 } },
    { id: "B4d", label: "B&R ×40 universe, +30 bps adverse entry", pool: "br40", entry: { kind: "drift", driftBps: 30 } },
    { id: "R1", label: "RSI ×2 preferred (ATOM INJ), 1h", pool: "rsi2" },
    { id: "R2", label: "RSI ×40 universe, 1h, identical params", pool: "rsi40" },
    { id: "R3", label: "RSI ×38 non-preferred only (out-of-sample coins)", pool: "rsi40", symbols: notPref(RSI_PREF) },
    { id: "R4a", label: "RSI ×2 preferred, +15 bps adverse entry", pool: "rsi2", entry: { kind: "drift", driftBps: 15 } },
    { id: "R4b", label: "RSI ×40 universe, +15 bps adverse entry", pool: "rsi40", entry: { kind: "drift", driftBps: 15 } },
    { id: "R4c", label: "RSI ×2 preferred, +30 bps adverse entry", pool: "rsi2", entry: { kind: "drift", driftBps: 30 } },
    { id: "R4d", label: "RSI ×40 universe, +30 bps adverse entry", pool: "rsi40", entry: { kind: "drift", driftBps: 30 } },
    // POST-HOC
    { id: "PH-B1g", label: "POST-HOC B&R ×6 preferred, portfolio guards off", pool: "br6", guardsOff: true, posthoc: true },
    { id: "PH-B2g", label: "POST-HOC B&R ×40, portfolio guards off", pool: "br40", guardsOff: true, posthoc: true },
    { id: "PH-R1g", label: "POST-HOC RSI ×2 preferred, portfolio guards off", pool: "rsi2", guardsOff: true, posthoc: true },
    { id: "PH-R2g", label: "POST-HOC RSI ×40, portfolio guards off", pool: "rsi40", guardsOff: true, posthoc: true },
  ];
  const stratsFor = (pool: string): Strategy[] => pool.startsWith("br") ? [pool === "br6" ? brPref : brAll] : [pool === "rsi2" ? rsiPref : rsiAll];

  const outs = new Map<string, SimOut>();
  const results: ArmResult[] = [];
  for (const arm of arms) {
    const o = simulate(arm, pools.get(arm.pool)!, streams, md, stratsFor(arm.pool));
    outs.set(arm.id, o);
  }
  for (const arm of arms) {
    const o = outs.get(arm.id)!;
    const is4h = arm.pool.startsWith("br");
    const c = is4h ? cov4h : cov1h;
    const mid = (c.t0 + c.t1) / 2;
    const full = metrics(o.trades, c.t0, c.t1 + 1);
    const h1 = metrics(o.trades, c.t0, mid, 4000), h2 = metrics(o.trades, mid, c.t1 + 1, 4000);
    const y2026 = metrics(o.trades, YEAR_2026_TS, c.t1 + 1, 4000);
    // slippage companions: same pool / symbol filter / guards, entry drifted +15 and +30 bps
    // (for the drift arms themselves the FULL exp already IS the slipped number)
    const slipM = (bps: number): WinMetrics => arm.entry?.kind === "drift" ? full
      : metrics(simulate({ ...arm, id: `${arm.id}-s${bps}`, entry: { kind: "drift", driftBps: bps } }, pools.get(arm.pool)!, streams, md, stratsFor(arm.pool)).trades, c.t0, c.t1 + 1, 2000);
    const slip15m = slipM(15), slip30m = slipM(30);
    const slip15Exp = slip15m.exp, slip30Exp = slip30m.exp;
    const multiCoin = (arm.symbols?.size ?? (pools.get(arm.pool)!.length ? new Set(pools.get(arm.pool)!.map(x => x.symbol)).size : 0)) > 1;
    const v = verdictFor(full, h1, h2, slip15Exp, multiCoin, is4h);
    const component = is4h ? "break-retest" : "rsi-divergence";
    const hypothesis = arm.posthoc ? "POST-HOC" : arm.id.startsWith("B") ? (arm.id === "B1" ? "H1 baseline / H3" : "H1 / H3") : (arm.id === "R1" ? "H2 baseline / H3" : "H2 / H3");
    const r: ArmResult = {
      id: arm.id, label: arm.label, component, hypothesis,
      window: `${new Date(c.t0 * 1000).toISOString().slice(0, 10)}→${new Date(c.t1 * 1000).toISOString().slice(0, 10)} (${is4h ? "4h×" + C4H : "1h×" + C1H})`,
      full, h1, h2, y2026, slip15Exp, slip30Exp, slip15N: slip15m.n, multiCoin, is4h,
      verdict: v.verdict, reasons: v.reasons, posthoc: !!arm.posthoc, blocks: o.blocks,
      dirBtc: dirBtcTable(o.trades), perCoin: perCoin(o.trades), perYear: perYear(o.trades), exits: exitsTable(o.trades),
    };
    results.push(r);
    L(`## ${arm.id} — ${arm.label}${arm.posthoc ? "  [POST-HOC]" : ""}`);
    L(`  window ${r.window}`);
    L(`  FULL  ${mline(full)}  balDD=${f(o.maxDDpct, 1)}%`);
    L(`  H1    ${mline(h1)}`);
    L(`  H2    ${mline(h2)}`);
    L(`  2026  ${mline(y2026)}`);
    if (arm.entry?.kind !== "drift") L(`  slip  +15bps exp=${sgn(slip15Exp)} (T=${slip15m.n}, PF ${f(slip15m.pf)}, CI lo ${sgn(slip15m.ciLo, 2)}) · +30bps exp=${sgn(slip30Exp)} (PF ${f(slip30m.pf)})`);
    L(`  LONG  T=${full.longN} exp=${sgn(full.longExp)} · SHORT T=${full.shortN} exp=${sgn(full.shortExp)}`);
    L(`  exits ${r.exits}`);
    L(`  years ${r.perYear}`);
    L(`  coins ${r.perCoin}`);
    for (const d of r.dirBtc) L(`  ${d}`);
    L(`  blocks ${Object.entries(o.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ") || "none"}`);
    L(`  VERDICT ${v.verdict}${arm.posthoc ? " (post-hoc — not for promotion)" : ""} — ${v.reasons.join(" | ")}`);
    L("");
  }

  // ── Component verdicts with the SELECTION-BIAS RULE ──
  const R = (id: string) => results.find(r => r.id === id)!;
  const comp: Array<{ component: string; base: ArmResult; univ: ArmResult; oos: ArmResult; verdict: Verdict; reasons: string[] }> = [];
  for (const [component, b, u, o] of [["break-retest", "B1", "B2", "B3"], ["rsi-divergence", "R1", "R2", "R3"]] as Array<[string, string, string, string]>) {
    const base = R(b), univ = R(u), oos = R(o);
    let verdict: Verdict = base.verdict;
    const reasons: string[] = [`${b} (preferred) verdict ${base.verdict}: ${base.reasons.join(" | ")}`];
    const univOk = univ.full.exp >= 0.15;
    reasons.push(`${u} (40-coin universe) exp ${sgn(univ.full.exp)} ${univOk ? "≥" : "<"} +0.15 → selection-bias rule ${univOk ? "PASSED" : "FAILED"}`);
    reasons.push(`${o} (non-preferred coins only) exp ${sgn(oos.full.exp)} PF ${f(oos.full.pf)} T=${oos.full.n} coins+ ${oos.full.coinsPos}/${oos.full.coins}`);
    if (!univOk && verdict !== "INSUFFICIENT-DATA") verdict = "REJECT";
    if (univOk && univ.verdict === "REJECT" && (verdict === "ACCEPT-LIVE-CANDIDATE" || verdict === "PAPER-CANDIDATE")) {
      reasons.push(`${u} itself is REJECT on the pre-registered criteria — preferred-list verdict stands only as ${verdict} on the coin list actually traded`);
    }
    comp.push({ component, base, univ, oos, verdict, reasons });
  }
  L(`## COMPONENT VERDICTS (selection-bias rule applied literally)`);
  for (const c of comp) { L(`  ${c.component}: ${c.verdict}`); for (const r of c.reasons) L(`    - ${r}`); }
  L("");
  L(`## Hypotheses`);
  L(`  H1 (B&R holds on 40 coins, exp ≥ +0.15R): ${R("B2").full.exp >= 0.15 ? "SUPPORTED" : "NOT SUPPORTED"} — B2 exp ${sgn(R("B2").full.exp)} (T=${R("B2").full.n}), B3 exp ${sgn(R("B3").full.exp)} (T=${R("B3").full.n})`);
  L(`  H2 (RSI holds on 40 coins, exp ≥ +0.15R): ${R("R2").full.exp >= 0.15 ? "SUPPORTED" : "NOT SUPPORTED"} — R2 exp ${sgn(R("R2").full.exp)} (T=${R("R2").full.n}), R3 exp ${sgn(R("R3").full.exp)} (T=${R("R3").full.n})`);
  const stable = (r: ArmResult) => r.h1.exp > 0 && r.h2.exp > 0 && r.h1.exp >= 0.10 && r.h2.exp >= 0.10;
  L(`  H3 (stable across halves): B1 ${stable(R("B1")) ? "yes" : "no"} (H1 ${sgn(R("B1").h1.exp)} / H2 ${sgn(R("B1").h2.exp)}), B2 ${stable(R("B2")) ? "yes" : "no"} (H1 ${sgn(R("B2").h1.exp)} / H2 ${sgn(R("B2").h2.exp)}), R1 ${stable(R("R1")) ? "yes" : "no"} (H1 ${sgn(R("R1").h1.exp)} / H2 ${sgn(R("R1").h2.exp)}), R2 ${stable(R("R2")) ? "yes" : "no"} (H1 ${sgn(R("R2").h1.exp)} / H2 ${sgn(R("R2").h2.exp)})`);
  L("");

  const outPath = `script/audit/phase9-report-brrsi.md`;
  writeFileSync(outPath, lines.join("\n"));
  const json = {
    generatedAt: new Date().toISOString(), c4h: C4H, c1h: C1H, capital: START_CAPITAL, riskPct: BASE_RISK_PCT,
    parity: { ls: stats(p0.trades.filter(x => x.strategy === "liquidity-sweep").map(x => x.netR)), br: stats(p0.trades.filter(x => x.strategy === "break-retest").map(x => x.netR)), rsi: stats(p0.trades.filter(x => x.strategy === "rsi-divergence").map(x => x.netR)) },
    coverage: { cov4h, cov1h, short },
    arms: results.map(r => ({ ...r, dirBtc: r.dirBtc })),
    components: comp.map(c => ({ component: c.component, verdict: c.verdict, reasons: c.reasons })),
  };
  writeFileSync(`script/.cache/phase9-brrsi-results.json`, JSON.stringify(json, null, 1));
  console.log(`\n[report written to ${outPath}; json in script/.cache/phase9-brrsi-results.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
