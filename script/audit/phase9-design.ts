// ─── AUDIT PHASE 9 — ENGINE ARCHITECTURE (design component) ─────────────────
// Research companion to script/audit/phase9-report-design.md. Fork of
// phase8-collapse.ts (same candidate builder, exit resolution, portfolio gates)
// that adds what the redesign needs measured rather than asserted:
//
//   A. LIVE-SCALE REALISM — Kraken Futures instrument metadata (tickSize,
//      contractValueTradePrecision, margin) × current Binance prices → per-coin
//      notional / contracts / lot-rounding error / fee share of 1R / TP1-partial
//      feasibility at ($110, 0.5%) and ($1000, 1%) with a 1.5% stop. Also the
//      Kraken-side liquidity picture (vol24h, OI, spread) vs the engine's dead
//      $30M MEXC volume filter.
//   B. GUARD REDESIGN — the current trio (daily −4R / rolling-7d −6R / per-strategy
//      kill-switch, measured in base-risk R) versus ONE peak-to-valley drawdown
//      guard in trade-R with hysteresis (halt X, resume X/2, 30-day rolling peak,
//      bounded halt with peak re-base) and a per-strategy switch built from the
//      same function. Grid over X; per arm: T/PF/exp/maxDD, halt episodes, halt
//      duration vs losing-cluster duration, fraction of calendar time halted,
//      guard co-firing. Honest candidates (entry = signal candle close — the
//      fixed strategy code) plus a +15 bps adverse-fill arm.
//   C. STRUCTURAL DIAGNOSTICS (POST-HOC, labelled) — BTC risk multiplier on/off,
//      correlation-group cap on/off, weekly filter on/off, max-hold timeouts,
//      cooldown blocks by strategy, scan-minute distribution of real paper entries.
//
// Nothing here promotes a component. Acceptance criteria are pre-registered in
// the phase-9 brief; the guard grid CALIBRATES a risk control, it does not
// create edge — which is why every arm is reported next to the no-guard baseline.
//
// Run:  npx tsx script/audit/phase9-design.ts [--candles=20000] [--capital=500] [--risk=2]
//       [--skip-sim] (table A + scan timing only)   [--no-fetch] (use cached Kraken/Binance JSON)
// Type-check:
//   npx tsc --noEmit --module esnext --moduleResolution bundler --target esnext --strict
//     --skipLibCheck --esModuleInterop --allowImportingTsExtensions --types node script/audit/phase9-design.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { simulateManagedExit, type ManagedExitConfig } from "../../server/trade-exits";
import type { OHLCV } from "../../server/analysis";
import type { Strategy } from "../../server/strategies/types";
import { isRollingDrawdownBreached, strategiesToPause, type ClosedTradeLite } from "../../server/portfolio-guards";
import { roundSize, toKrakenSymbol } from "../../server/kraken-client";
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
const TOTAL_CANDLES = parseInt(argv.candles ?? "20000");
const START_CAPITAL = parseFloat(argv.capital ?? "500");
const BASE_RISK_PCT = parseFloat(argv.risk ?? "2");
const SKIP_SIM = argv["skip-sim"] === "true";
const NO_FETCH = argv["no-fetch"] === "true";
const CACHE_DIR = "script/.cache";
const DAY_KEY = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const RESET_TS = Date.UTC(2026, 7, 14) / 1000;
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number, d = 2) => (n >= 0 ? "+" : "") + f(n, d);
const lines: string[] = [];
const L = (s = "") => { console.log(s); lines.push(s); };

// ═══════════════════════════════════════════════════════════════════════════
// A. LIVE-SCALE REALISM (Kraken Futures)
// ═══════════════════════════════════════════════════════════════════════════
interface KrakenInstrumentRaw {
  symbol: string; tickSize: number; contractValueTradePrecision: number; tradeable: boolean;
  impactMidSize?: number; maxPositionSize?: number;
  marginSchedules?: { europa?: { retail?: Array<{ initialMargin: number }> } };
  retailMarginLevels?: Array<{ initialMargin: number }>;
}
interface KrakenTickerRaw {
  symbol: string; last: number; markPrice: number; bid: number; ask: number;
  vol24h: number; volumeQuote?: number; openInterest: number; fundingRate: number; suspended?: boolean;
}

async function cachedJSON<T>(name: string, url: string): Promise<T> {
  const path = `${CACHE_DIR}/phase9_${name}_${DAY_KEY}.json`;
  if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8")) as T;
  if (NO_FETCH) throw new Error(`--no-fetch set and ${path} missing`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const json = await r.json();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(json));
  return json as T;
}

interface ScaleRow {
  coin: string; kSym: string; price: number; tick: number; prec: number;
  stopTicks: number;
  // per scale
  scales: Array<{
    label: string; riskUsd: number; notionalUsd: number; rawContracts: number; contracts: number;
    roundErrPct: number; realRiskUsd: number; feeShareOf1RPct: number; tp1Contracts: number; runnerContracts: number;
    tradeable: boolean; partialOk: boolean;
  }>;
  volUsd24h: number; oiUsd: number; spreadBps: number; impactUsd: number; retailIM: number | null;
}

const SCALES = [
  { label: "$110 / 0.5%", equity: 110, riskPct: 0.5 },
  { label: "$1000 / 1%", equity: 1000, riskPct: 1 },
];
const STOP_PCT = 0.015;
const TAKER = 0.0005;

async function liveScaleTable(coins: string[]): Promise<ScaleRow[]> {
  const ins = await cachedJSON<{ instruments: KrakenInstrumentRaw[] }>("kraken_instruments", "https://futures.kraken.com/derivatives/api/v3/instruments");
  const tks = await cachedJSON<{ tickers: KrakenTickerRaw[] }>("kraken_tickers", "https://futures.kraken.com/derivatives/api/v3/tickers");
  const px = await cachedJSON<Array<{ symbol: string; price: string }>>("binance_prices", "https://api.binance.com/api/v3/ticker/price");
  const priceOf = new Map(px.map(p => [p.symbol, Number(p.price)]));
  const rows: ScaleRow[] = [];
  for (const coin of coins) {
    const kSym = toKrakenSymbol(coin);
    const i = ins.instruments.find(x => x.symbol === kSym);
    const t = tks.tickers.find(x => x.symbol === kSym);
    const price = priceOf.get(`${coin}USDT`) ?? t?.last ?? 0;
    if (!i || !(price > 0)) { L(`  ${coin}: missing on Kraken or no price — skipped`); continue; }
    const prec = Number(i.contractValueTradePrecision ?? 0);
    const tick = Number(i.tickSize);
    const scales = SCALES.map(s => {
      const riskUsd = s.equity * s.riskPct / 100;
      const notionalUsd = riskUsd / STOP_PCT;
      const rawContracts = notionalUsd / price;
      const contracts = roundSize(rawContracts, prec);
      const realNotional = contracts * price;
      const realRiskUsd = realNotional * STOP_PCT;
      const roundErrPct = rawContracts > 0 ? (rawContracts - contracts) / rawContracts * 100 : 100;
      const feeShareOf1RPct = riskUsd > 0 ? (TAKER * 2 * realNotional) / riskUsd * 100 : NaN;
      const tp1Contracts = roundSize(contracts * 0.6, prec);
      const runnerContracts = contracts - tp1Contracts;
      return {
        label: s.label, riskUsd, notionalUsd, rawContracts, contracts, roundErrPct, realRiskUsd, feeShareOf1RPct,
        tp1Contracts, runnerContracts,
        tradeable: contracts > 0 && roundErrPct <= 25,
        partialOk: tp1Contracts > 0 && runnerContracts > 0,
      };
    });
    const last = t?.last ?? price;
    rows.push({
      coin, kSym, price, tick, prec,
      stopTicks: tick > 0 ? price * STOP_PCT / tick : NaN,
      scales,
      volUsd24h: t ? Number(t.vol24h) * last : NaN,
      oiUsd: t ? Number(t.openInterest) * last : NaN,
      spreadBps: t && t.bid > 0 && t.ask > 0 ? (t.ask - t.bid) / last * 1e4 : NaN,
      impactUsd: (i.impactMidSize ?? 0) * price,
      retailIM: i.marginSchedules?.europa?.retail?.[0]?.initialMargin ?? i.retailMarginLevels?.[0]?.initialMargin ?? null,
    });
  }
  return rows;
}

function reportScale(rows: ScaleRow[]) {
  L(`## A. Live-scale realism — Kraken Futures, 1.5% stop, taker 0.05% × 2 legs (data ${DAY_KEY})`);
  L(`Baseline fee share of 1R at a 1.5% stop = 0.10% ÷ 1.5% = 6.7% before lot rounding. Lot rounding is FLOOR (kraken-client roundSize), so real risk ≤ planned.`);
  for (const s of SCALES) {
    L(``);
    L(`### ${s.label} — risk $${f(s.equity * s.riskPct / 100)} → planned notional $${f(s.equity * s.riskPct / 100 / STOP_PCT)}`);
    L(`| coin | price | prec | contracts (raw → lot) | lot err % | real risk $ | fee % of 1R | TP1 60% lot | runner lot | tradeable | partial ok |`);
    L(`|---|---|---|---|---|---|---|---|---|---|---|`);
    for (const r of rows) {
      const c = r.scales.find(x => x.label === s.label)!;
      L(`| ${r.coin} | ${r.price} | ${r.prec} | ${f(c.rawContracts, 4)} → ${c.contracts} | ${f(c.roundErrPct, 1)} | ${f(c.realRiskUsd)} | ${f(c.feeShareOf1RPct, 1)} | ${c.tp1Contracts} | ${c.runnerContracts} | ${c.tradeable ? "yes" : "NO"} | ${c.partialOk ? "yes" : "NO"} |`);
    }
    const bad = rows.filter(r => !r.scales.find(x => x.label === s.label)!.tradeable).map(r => r.coin);
    const noPartial = rows.filter(r => { const c = r.scales.find(x => x.label === s.label)!; return c.tradeable && !c.partialOk; }).map(r => r.coin);
    const bigErr = rows.filter(r => { const c = r.scales.find(x => x.label === s.label)!; return c.tradeable && c.roundErrPct > 10; }).map(r => `${r.coin} ${f(r.scales.find(x => x.label === s.label)!.roundErrPct, 0)}%`);
    L(``);
    L(`Untradeable at ${s.label} (lot rounds to zero or >25% under-size): ${bad.length ? bad.join(", ") : "none"}`);
    L(`Tradeable but TP1 60% partial / runner rounds to zero: ${noPartial.length ? noPartial.join(", ") : "none"}`);
    L(`Lot rounding error > 10% (risk materially under the plan): ${bigErr.length ? bigErr.join(", ") : "none"}`);
  }
  L(``);
  L(`### Kraken-side liquidity (public /tickers) vs the engine's $30M MEXC volume filter`);
  L(`| coin | Kraken vol24h $ | OI $ | spread bps | impactMid $ | stop in ticks | retail IM (EEA) |`);
  L(`|---|---|---|---|---|---|---|`);
  for (const r of rows) L(`| ${r.coin} | ${f(r.volUsd24h / 1e6, 2)}M | ${f(r.oiUsd / 1e6, 2)}M | ${f(r.spreadBps, 1)} | ${f(r.impactUsd / 1e3, 1)}k | ${f(r.stopTicks, 0)} | ${r.retailIM ?? "—"} |`);
  const under30 = rows.filter(r => r.volUsd24h < 30e6).length;
  const under5 = rows.filter(r => r.volUsd24h < 5e6).map(r => r.coin);
  const wide = rows.filter(r => r.spreadBps > 20).map(r => `${r.coin} ${f(r.spreadBps, 0)}bps`);
  L(``);
  L(`Kraken coins under $30M/24h: ${under30}/${rows.length} — the MEXC $30M filter, if applied to the venue that executes, would kill most of the universe. Under $5M: ${under5.join(", ") || "none"}.`);
  L(`Kraken spread > 20 bps right now: ${wide.join(", ") || "none"} (engine MAX_SPREAD = 20 bps, but measured on MEXC).`);
}

// ═══════════════════════════════════════════════════════════════════════════
// B. GUARD REDESIGN — candidates, exits, portfolio sim with pluggable guards
// ═══════════════════════════════════════════════════════════════════════════
interface Cand {
  stratId: string; interval: string; symbol: string; tsSec: number; dir: "LONG" | "SHORT";
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null;
  confidence: number; slDistPct: number; streamKey: string; entryIdx: number; maxBars: number; ivSec: number; idx: number;
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
    out.push({
      stratId: strat.id, interval: strat.interval, symbol, tsSec: candles[i].time + ivSec, dir: sig.direction,
      entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2,
      confidence: sig.confidence, slDistPct, streamKey: `${symbol}:${strat.interval}`, entryIdx: i, maxBars, ivSec, idx: -1,
    });
  }
  return out;
}

// Entry = signal candle close (the fixed strategy code reports exactly that) plus an
// optional adverse drift in bps; SL/TP stay structural; re-gated on the real entry
// (stop ≥ 0.6%, R:R ≥ 1.5 — the engine's fill re-gate). Same as phase8 "honest".
interface EntryModel { driftBps: number }
interface ResolvedExit { netR: number; exitTsSec: number; barsHeld: number; outcome: string; tp1Hit: boolean; filled: boolean; entryUsed: number }
const exitCache = new Map<string, ResolvedExit[]>();
function resolveExits(cands: Cand[], streams: Map<string, OHLCV[]>, model: EntryModel, exitCfg: ManagedExitConfig): ResolvedExit[] {
  const key = JSON.stringify({ model, exitCfg });
  const hit = exitCache.get(key);
  if (hit) return hit;
  const out = new Array<ResolvedExit>(cands.length);
  for (const c of cands) {
    const candles = streams.get(c.streamKey)!;
    const d = model.driftBps / 10_000;
    const entry = c.dir === "LONG" ? c.entry * (1 + d) : c.entry * (1 - d);
    const riskH = c.dir === "LONG" ? entry - c.stopLoss : c.stopLoss - entry;
    const rewardH = c.dir === "LONG" ? c.takeProfit1 - entry : entry - c.takeProfit1;
    if (riskH <= 0 || rewardH <= 0 || riskH / entry < MIN_SL_DISTANCE_PCT || rewardH / riskH < MIN_RR) {
      out[c.idx] = { netR: 0, exitTsSec: c.tsSec, barsHeld: 0, outcome: "unfilled", tp1Hit: false, filled: false, entryUsed: entry };
      continue;
    }
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + c.maxBars);
    const tp2raw = c.takeProfit2 ?? c.takeProfit1;
    const tp2 = (c.dir === "LONG" ? tp2raw > c.takeProfit1 : tp2raw < c.takeProfit1) ? tp2raw : c.takeProfit1;
    const ex = simulateManagedExit({ direction: c.dir, entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: tp2 }, future, exitCfg);
    out[c.idx] = { netR: ex.netR, exitTsSec: c.tsSec + ex.barsHeld * c.ivSec, barsHeld: ex.barsHeld, outcome: ex.outcome, tp1Hit: ex.tp1Hit, filled: true, entryUsed: entry };
  }
  exitCache.set(key, out);
  return out;
}

// ── The proposed guard — pure function, drop-in for server/portfolio-guards.ts ──
// Peak-to-valley drawdown of the realized equity curve measured in TRADE-R
// (Σ pnl_usd / risk_usd — each trade in its own R, so a 1.25× BTC-bull trade
// counts as the risk it actually took), against the highest cumulative-R point
// among trades closed within `peakWindowMs`. Hysteresis: halt when dd ≥ haltR,
// resume when dd ≤ resumeR. A halt cannot outlive `maxHaltMs`: when it expires
// the peak is RE-BASED to the current cumulative R (recorded as `rebasedAtCumR`),
// so the guard re-arms fresh instead of waiting for the old peak to age out.
export interface DrawdownGuardOpts {
  /** Rolling window that the peak is taken over (e.g. 30 days). */
  peakWindowMs: number;
  /** Halt new entries when peak − current ≥ haltR (trade-R). */
  haltR: number;
  /** Resume when peak − current ≤ resumeR (typically haltR / 2). */
  resumeR: number;
  /** Upper bound on one halt; on expiry the peak is re-based. Infinity = pure hysteresis. */
  maxHaltMs: number;
  now?: number;
}
export interface DrawdownGuardState {
  halted: boolean;
  haltedSinceMs: number | null;
  /** Cumulative trade-R at the last re-base (peak floor). null = never re-based. */
  rebasedAtCumR: number | null;
  /** Time of the last re-base — peaks before it are ignored. */
  rebasedAtMs: number | null;
}
export const INITIAL_GUARD_STATE: DrawdownGuardState = { halted: false, haltedSinceMs: null, rebasedAtCumR: null, rebasedAtMs: null };

export interface DrawdownGuardEval { state: DrawdownGuardState; cumR: number; peakR: number; ddR: number; transition: "none" | "halt" | "resume" | "expire" }

export function evaluateDrawdownGuard(
  trades: ClosedTradeLite[],
  prev: DrawdownGuardState,
  opts: DrawdownGuardOpts,
): DrawdownGuardEval {
  const now = opts.now ?? Date.now();
  // Realized equity curve in trade-R: one point per closed trade, chronological.
  const closed = trades
    .filter(e => e.closed_at && e.risk_usd && e.risk_usd > 0)
    .map(e => ({ t: new Date(e.closed_at as string).getTime(), r: (e.pnl_usd ?? 0) / (e.risk_usd as number) }))
    .sort((a, b) => a.t - b.t);
  const points: Array<{ t: number; cum: number }> = [];
  let cum = 0;
  for (const c of closed) { cum += c.r; points.push({ t: c.t, cum }); }
  // Reference peak = highest point that is BOTH inside the rolling window AND at
  // or after the last re-base. The current point always qualifies (dd ≥ 0). The
  // origin (cum 0 before the first trade) qualifies only if the curve started
  // inside that span. A re-base pins the peak at the re-base level until it ages
  // out of the window like any other point.
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

// ── Guard configurations under test ─────────────────────────────────────────
type GuardKind = "none" | "trio" | "dd";
interface Arm {
  label: string;
  guard: GuardKind;
  rUnit?: "base" | "trade";           // trio only: oneR = balance×base% (engine) or ×riskMultiplier
  daily?: number | null; rolling?: number | null; ksMin?: number; ksMax?: number | null;   // trio params
  X?: number; resume?: number; peakDays?: number; maxHaltH?: number;                        // dd params
  Xs?: number | null;                 // per-strategy dd switch (null/undefined = off)
  driftBps?: number;
  riskMult?: boolean;                 // BTC ×1.25/×0.75 (default true = engine)
  groupCap?: boolean;                 // default true
  weekly?: boolean;                   // default true
  strategies?: string[];
}
interface SimTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT"; netR: number; riskUsd: number; pnlUsd: number;
  openedSec: number; closedSec: number; btcD: Trend; outcome: string; barsHeld: number; interval: string;
}
interface HaltEpisode { startMs: number; endMs: number; clusterMs: number; lossSpanMs: number; scope: string }
interface SimOut {
  label: string; trades: SimTrade[]; blocks: Record<string, number>; finalBalance: number; maxDDpct: number;
  episodes: HaltEpisode[]; coFire: number; guardBlocked: number; spanMs: number;
}

function simulate(arm: Arm, allCands: Cand[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]): SimOut {
  const exits = resolveExits(allCands, streams, { driftBps: arm.driftBps ?? 0 }, ENGINE_EXIT);
  const active = new Set(arm.strategies ?? strategies.map(s => s.id));
  const cands = allCands.filter(c => active.has(c.stratId)).sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));
  const useRiskMult = arm.riskMult ?? true;
  const useGroupCap = arm.groupCap ?? true;
  const useWeekly = arm.weekly ?? true;
  const dailyR = arm.daily === undefined ? 4 : arm.daily;
  const rollingR = arm.rolling === undefined ? 6 : arm.rolling;
  const ksMin = arm.ksMin ?? 4;
  const ksMax = arm.ksMax === undefined ? -3 : arm.ksMax;
  const ddOpts: DrawdownGuardOpts = {
    peakWindowMs: (arm.peakDays ?? 30) * 86_400_000,
    haltR: arm.X ?? 10,
    resumeR: arm.resume ?? (arm.X ?? 10) / 2,
    maxHaltMs: arm.maxHaltH != null ? arm.maxHaltH * 3_600_000 : Infinity,
  };

  let balance = START_CAPITAL, peak = START_CAPITAL, maxDD = 0;
  interface OpenPos { strategy: string; group?: string; exitTsSec: number; trade: SimTrade }
  const openBySymbol = new Map<string, OpenPos[]>();
  const totalOpen = () => { let n = 0; for (const v of openBySymbol.values()) n += v.length; return n; };
  const lastClosedAt = new Map<string, number>();
  const closedLog: Array<ClosedTradeLite & { closed_at: string; pnl_usd: number; risk_usd: number; strategy: string }> = [];
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

  // halt-episode bookkeeping, per scope ("portfolio", "ks:<strategy>", "dd:<strategy>"):
  // an episode is a maximal run of blocked evaluations for that scope; cluster =
  // time from the in-window equity peak to the halt start (portfolio scope only).
  const episodes: HaltEpisode[] = [];
  const open = new Map<string, { start: number; last: number; cluster: number; lossSpan: number }>();
  // span of the losing trades that produced the breach: halt time − earliest LOSS closed inside the guard window
  const lossSpanWithin = (nowMs: number, windowMs: number): number => {
    let earliest = nowMs;
    for (const e of closedLog) { const t = new Date(e.closed_at).getTime(); if (t >= nowMs - windowMs && e.pnl_usd < 0 && t < earliest) earliest = t; }
    return nowMs - earliest;
  };
  let coFire = 0, guardBlocked = 0;
  const peakTimeWithin = (nowMs: number, windowMs: number): number => {
    let best = -Infinity, bestT = nowMs - windowMs, cum = 0;
    for (const e of closedLog) {
      const t = new Date(e.closed_at).getTime();
      cum += e.pnl_usd / e.risk_usd;
      if (t >= nowMs - windowMs && cum > best) { best = cum; bestT = t; }
    }
    return bestT;
  };
  const onGuard = (scope: string, blockedNow: boolean, nowMs: number, windowMs: number) => {
    const cur = open.get(scope);
    if (blockedNow) {
      if (!cur) open.set(scope, { start: nowMs, last: nowMs, cluster: scope === "portfolio" ? nowMs - peakTimeWithin(nowMs, windowMs) : 0, lossSpan: scope === "portfolio" ? lossSpanWithin(nowMs, windowMs) : 0 });
      else cur.last = nowMs;
    } else if (cur) {
      episodes.push({ startMs: cur.start, endMs: nowMs, clusterMs: cur.cluster, lossSpanMs: cur.lossSpan, scope });
      open.delete(scope);
    }
  };

  let ddState: DrawdownGuardState = { ...INITIAL_GUARD_STATE };
  const stratState = new Map<string, DrawdownGuardState>();
  const stratHaltEpisodes = new Map<string, number>();
  const firstTs = cands.length ? cands[0].tsSec : 0, lastTs = cands.length ? cands[cands.length - 1].tsSec : 0;

  for (const c of cands) {
    const nowSec = c.tsSec, nowMs = nowSec * 1000;
    closeDue(nowSec);
    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= 1) { block("exposure"); continue; }
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) { const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`); if (last && (nowMs - last) / 3_600_000 < cd) { block(`cooldown:${c.stratId}`); continue; } }

    const btcDailyTrend = dTrend("BTC", nowSec);
    let riskMultiplier = 1.0;
    if (useRiskMult) { if (btcDailyTrend === "up") riskMultiplier = 1.25; else if (btcDailyTrend === "down") riskMultiplier = 0.75; }

    // ── portfolio guards ──
    let blockedByGuard = false;
    if (arm.guard === "trio") {
      const oneR = balance * BASE_RISK_PCT / 100 * (arm.rUnit === "trade" ? riskMultiplier : 1);
      let fired = 0;
      if (dailyR != null) {
        const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
        const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
        if (dayPnl < -dailyR * oneR) { fired++; block("ddDaily"); }
      }
      if (rollingR != null && isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: rollingR, now: nowMs })) { fired++; block("ddRolling7d"); }
      let ksFired = false;
      if (ksMax != null) {
        const paused = strategiesToPause(closedLog, [c.stratId], { windowMs: ROLLING_WINDOW_MS, minTrades: ksMin, maxNetR: ksMax, now: nowMs });
        if (paused.has(c.stratId)) { ksFired = true; block(`killSwitch:${c.stratId}`); }
      }
      if (fired + (ksFired ? 1 : 0) >= 2) coFire++;
      blockedByGuard = fired > 0 || ksFired;
      if (blockedByGuard) guardBlocked++;
      onGuard("portfolio", fired > 0, nowMs, ROLLING_WINDOW_MS);
      onGuard(`ks:${c.stratId}`, ksFired, nowMs, ROLLING_WINDOW_MS);
      if (blockedByGuard) continue;
    } else if (arm.guard === "dd") {
      const ev = evaluateDrawdownGuard(closedLog, ddState, { ...ddOpts, now: nowMs });
      ddState = ev.state;
      let stratHalted = false;
      if (arm.Xs != null) {
        const prev = stratState.get(c.stratId) ?? { ...INITIAL_GUARD_STATE };
        const evS = evaluateDrawdownGuard(closedLog.filter(e => e.strategy === c.stratId), prev, { ...ddOpts, haltR: arm.Xs, resumeR: arm.Xs / 2, now: nowMs });
        stratState.set(c.stratId, evS.state);
        if (evS.transition === "halt") stratHaltEpisodes.set(c.stratId, (stratHaltEpisodes.get(c.stratId) ?? 0) + 1);
        stratHalted = evS.state.halted;
        if (stratHalted) block(`ddStrategy:${c.stratId}`);
      }
      if (ddState.halted) block("ddPortfolio");
      if (ddState.halted && stratHalted) coFire++;
      if (ddState.halted || stratHalted) guardBlocked++;
      onGuard("portfolio", ddState.halted, nowMs, ddOpts.peakWindowMs);
      if (arm.Xs != null) onGuard(`dd:${c.stratId}`, stratHalted, nowMs, ddOpts.peakWindowMs);
      if (ddState.halted || stratHalted) continue;
    }

    if (totalOpen() >= FIXED_MAX_OPEN) { block("maxOpen"); continue; }
    const group = COIN_GROUP[c.symbol];
    if (useGroupCap && group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const p of list) if (p.group === group) inGroup++;
      if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; }
    }
    if (useWeekly && c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }
    const riskUsd = balance * BASE_RISK_PCT * riskMultiplier / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }
    const ex = exits[c.idx];
    if (!ex.filled) { block("unfilled"); continue; }
    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, dir: c.dir, netR: ex.netR, riskUsd, pnlUsd: ex.netR * riskUsd,
      openedSec: nowSec, closedSec: ex.exitTsSec, btcD: btcDailyTrend, outcome: ex.outcome, barsHeld: ex.barsHeld, interval: c.interval,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: ex.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }
  for (const [scope, cur] of open) episodes.push({ startMs: cur.start, endMs: lastTs * 1000, clusterMs: cur.cluster, lossSpanMs: cur.lossSpan, scope });
  for (const [id, n] of stratHaltEpisodes) blocks[`ddStrategyHalts:${id}`] = n;
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { label: arm.label, trades, blocks, finalBalance: balance, maxDDpct: maxDD * 100, episodes, coFire, guardBlocked, spanMs: (lastTs - firstTs) * 1000 };
}

function row(trades: SimTrade[], fromSec: number, toSec = Number.MAX_SAFE_INTEGER): string {
  const t = trades.filter(x => x.openedSec >= fromSec && x.openedSec < toSec);
  const rs = t.map(x => x.netR);
  const s = stats(rs);
  return `T=${String(s.n).padStart(4)} WR=${f(s.wr, 0).padStart(3)}% PF=${f(s.pf).padStart(5)} sumR=${sgn(s.sumR, 1).padStart(7)} exp=${sgn(s.exp, 3)} maxDD=${f(maxDrawdownR(rs), 1)}R`;
}
function median(xs: number[]): number { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

function reportArm(out: SimOut) {
  L(`## ${out.label}`);
  L(`  ALL     ${row(out.trades, 0)}  balDD=${f(out.maxDDpct, 1)}%`);
  L(`  2026    ${row(out.trades, YEAR_2026_TS)}`);
  L(`  Aug14→  ${row(out.trades, RESET_TS)}`);
  const rs = out.trades.map(t => t.netR);
  if (rs.length > 5) {
    const ci = bootstrapCI(rs, 10_000);
    // equal-COUNT halves (a time split lands in the 4h-only years where 1h streams have no data)
    const byOpen = [...out.trades].sort((a, b) => a.openedSec - b.openedSec);
    const mid = Math.floor(byOpen.length / 2);
    const h1 = stats(byOpen.slice(0, mid).map(t => t.netR)), h2 = stats(byOpen.slice(mid).map(t => t.netR));
    L(`  CI95(exp)=[${sgn(ci.lo, 3)}, ${sgn(ci.hi, 3)}]  H1 exp=${sgn(h1.exp, 3)} (T=${h1.n}, to ${new Date(byOpen[mid - 1].openedSec * 1000).toISOString().slice(0, 10)})  H2 exp=${sgn(h2.exp, 3)} (T=${h2.n})`);
  }
  const port = out.episodes.filter(e => e.scope === "portfolio");
  const durH = port.map(e => (e.endMs - e.startMs) / 3_600_000);
  const ratio = port.filter(e => e.clusterMs > 0).map(e => (e.endMs - e.startMs) / e.clusterMs);
  const ratioLoss = port.filter(e => e.lossSpanMs > 0).map(e => (e.endMs - e.startMs) / e.lossSpanMs);
  const haltedMs = port.reduce((s, e) => s + (e.endMs - e.startMs), 0);
  L(`  portfolio halts: episodes=${port.length} median=${f(median(durH), 0)}h mean=${f(durH.length ? durH.reduce((a, b) => a + b, 0) / durH.length : NaN, 0)}h max=${f(durH.length ? Math.max(...durH) : NaN, 0)}h | time halted=${f(out.spanMs ? 100 * haltedMs / out.spanMs : NaN, 1)}% | halt ÷ (peak→halt) median=${f(median(ratio), 1)}× | halt ÷ loss-span median=${f(median(ratioLoss), 1)}× | guard-blocked entries=${out.guardBlocked} co-fired=${out.coFire}`);
  const scopes = Array.from(new Set(out.episodes.filter(e => e.scope !== "portfolio").map(e => e.scope)));
  for (const sc of scopes) {
    const eps = out.episodes.filter(e => e.scope === sc);
    const d = eps.map(e => (e.endMs - e.startMs) / 3_600_000);
    const tot = eps.reduce((s, e) => s + (e.endMs - e.startMs), 0);
    L(`  ${sc} halts: episodes=${eps.length} median=${f(median(d), 0)}h max=${f(Math.max(...d), 0)}h | time halted=${f(out.spanMs ? 100 * tot / out.spanMs : NaN, 1)}%`);
  }
  const blocked = Object.entries(out.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ");
  L(`  blocks: ${blocked || "none"}`);
  L(``);
}

// ═══════════════════════════════════════════════════════════════════════════
// C. Scan timing evidence from real paper entries (pre-reset export)
// ═══════════════════════════════════════════════════════════════════════════
function scanTimingFromJournal() {
  const path = "trades-paper-2026-08-14.json";
  if (!existsSync(path)) { L(`(no ${path} — scan-timing histogram skipped)`); return; }
  const j = JSON.parse(readFileSync(path, "utf-8")) as { trades: Array<{ created_at: string; strategy: string }> };
  const oneH = j.trades.filter(t => t.strategy !== "break-retest");
  const mins = oneH.map(t => { const d = new Date(t.created_at); return d.getUTCMinutes() + d.getUTCSeconds() / 60; });
  const buckets = [0, 3, 6, 10, 20, 30, 60];
  L(`## C1. Minutes after the hourly close at which real paper 1h entries were booked (${path}, n=${mins.length})`);
  for (let i = 0; i < buckets.length - 1; i++) {
    const n = mins.filter(m => m >= buckets[i] && m < buckets[i + 1]).length;
    L(`  ${String(buckets[i]).padStart(2)}–${String(buckets[i + 1]).padStart(2)} min: ${String(n).padStart(3)} (${f(100 * n / mins.length, 0)}%)`);
  }
  L(`  median ${f(median(mins), 1)} min · p90 ${f([...mins].sort((a, b) => a - b)[Math.floor(mins.length * 0.9)], 1)} min. A free-running 3-min interval lands 0–3 min after the close only when the interval happens to be phased right; the tail is restarts/un-halts/slot-frees.`);
  L(``);
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const strategies = getAllStrategies();
  L(`# Phase 9 — engine architecture research — ${new Date().toISOString().slice(0, 10)}`);
  L(`candles ${TOTAL_CANDLES} · capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · entry = signal candle close (fixed strategy code) · exits ENGINE (TP1 60% → BE → 2R trail)`);
  L(``);

  const lsCoins = strategies.find(s => s.id === "liquidity-sweep")?.preferredSymbols ?? [];
  const universe = Array.from(new Set(strategies.flatMap(s => s.preferredSymbols ?? [])));
  L(`universe: ${universe.length} coins (LS ${lsCoins.length})`);
  L(``);

  // A
  try { reportScale(await liveScaleTable(universe)); } catch (e: any) { L(`Live-scale table failed: ${e?.message ?? e}`); }
  L(``);
  scanTimingFromJournal();
  if (SKIP_SIM) { writeOut(); return; }

  // B + C
  const { streams, md } = await loadMarketData(strategies, TOTAL_CANDLES);
  const cands: Cand[] = [];
  for (const strat of strategies) for (const sym of strat.preferredSymbols ?? []) {
    const c = streams.get(`${sym}:${strat.interval}`);
    if (c) cands.push(...buildCandidates(strat, sym, c));
  }
  cands.forEach((c, i) => { c.idx = i; });
  L(`candidates (post minSL+RR): ${cands.length}`);
  L(``);

  L(`# B. Guard redesign — honest entries, ${TOTAL_CANDLES}×1h (≈${f(TOTAL_CANDLES / 24 / 365, 1)}y on 1h streams)`);
  L(`Reading guide: the no-guard row is the system's own P&L; a guard can only remove trades. A good guard removes a losing cluster's tail at a small cost in sumR and cuts maxDD; a bad one removes the recovery too. halt/cluster = halt duration ÷ time from the equity peak to the halt.`);
  L(``);
  const arms: Arm[] = [
    { label: "G0 no portfolio guards (strategy gates only)", guard: "none" },
    { label: "G1 ENGINE trio: daily −4R · rolling-7d −6R · kill-switch −3R/4 (R = balance×base%)", guard: "trio" },
    { label: "G1b ENGINE trio, R = actual trade risk (base×BTC multiplier)", guard: "trio", rUnit: "trade" },
    { label: "G1c trio minus kill-switch", guard: "trio", ksMax: null },
    { label: "G1d kill-switch only", guard: "trio", daily: null, rolling: null },
  ];
  for (const X of [6, 8, 10, 12, 15]) {
    arms.push({ label: `G2 DD guard X=${X}R resume ${X / 2}R · 30d peak · no per-strategy · pure hysteresis`, guard: "dd", X, Xs: null });
  }
  for (const W of [7, 14]) {
    arms.push({ label: `G2 DD guard X=10R resume 5R · ${W}d peak · pure hysteresis`, guard: "dd", X: 10, Xs: null, peakDays: W });
  }
  for (const X of [8, 10, 12]) {
    for (const H of [24, 72]) {
      arms.push({ label: `G2 DD guard X=${X}R resume ${X / 2}R · 30d peak · maxHalt ${H}h (re-base)`, guard: "dd", X, Xs: null, maxHaltH: H });
    }
  }
  for (const X of [10, 12]) for (const Xs of [4, 6]) {
    arms.push({ label: `G3 DD guard X=${X}R + per-strategy switch Xs=${Xs}R (resume Xs/2) · maxHalt 72h`, guard: "dd", X, Xs, maxHaltH: 72 });
  }
  arms.push(
    { label: "G1 ENGINE trio +15 bps adverse fill", guard: "trio", driftBps: 15 },
    { label: "G3 DD X=10 Xs=6 maxHalt 72h +15 bps adverse fill", guard: "dd", X: 10, Xs: 6, maxHaltH: 72, driftBps: 15 },
    { label: "G0 no guards +15 bps adverse fill", guard: "none", driftBps: 15 },
  );
  const results: SimOut[] = [];
  for (const arm of arms) { const r = simulate(arm, cands, streams, md, strategies); results.push(r); reportArm(r); }

  // compact grid summary
  L(`## B-summary (ALL window)`);
  L(`| arm | T | PF | sumR | ΔsumR vs G0 | exp | maxDD R | ΔmaxDD | portfolio halts | median halt h | max halt h | time halted % | strategy-switch halts | co-fired |`);
  L(`|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  const g0 = results[0]; const g0s = stats(g0.trades.map(t => t.netR)); const g0dd = maxDrawdownR(g0.trades.map(t => t.netR));
  for (const r of results) {
    const rs = r.trades.map(t => t.netR); const s = stats(rs);
    const port = r.episodes.filter(e => e.scope === "portfolio");
    const durH = port.map(e => (e.endMs - e.startMs) / 3_600_000);
    const haltedMs = port.reduce((a, e) => a + (e.endMs - e.startMs), 0);
    const stratEps = r.episodes.filter(e => e.scope !== "portfolio").length;
    L(`| ${r.label} | ${s.n} | ${f(s.pf)} | ${sgn(s.sumR, 1)} | ${sgn(s.sumR - g0s.sumR, 1)} | ${sgn(s.exp, 3)} | ${f(maxDrawdownR(rs), 1)} | ${sgn(maxDrawdownR(rs) - g0dd, 1)} | ${port.length} | ${f(median(durH), 0)} | ${f(durH.length ? Math.max(...durH) : NaN, 0)} | ${f(r.spanMs ? 100 * haltedMs / r.spanMs : NaN, 1)} | ${stratEps} | ${r.coFire} |`);
  }
  L(``);

  // C. structural diagnostics — POST-HOC
  L(`# C. Structural diagnostics — POST-HOC (not used to promote anything; each says whether a backtest is needed before shipping)`);
  L(``);
  const diag: Arm[] = [
    { label: "D0 ENGINE trio (reference)", guard: "trio" },
    { label: "D1 ENGINE trio, BTC risk multiplier OFF (flat 1.0×)", guard: "trio", riskMult: false },
    { label: "D2 ENGINE trio, correlation-group cap OFF", guard: "trio", groupCap: false },
    { label: "D3 ENGINE trio, weekly-trend filter OFF (4h)", guard: "trio", weekly: false },
    { label: "D4 ENGINE trio, LS only", guard: "trio", strategies: ["liquidity-sweep"] },
    { label: "D5 ENGINE trio, B&R + RSI only (LS removed)", guard: "trio", strategies: ["break-retest", "rsi-divergence"] },
    { label: "D6 no guards, B&R + RSI only", guard: "none", strategies: ["break-retest", "rsi-divergence"] },
  ];
  const dres: SimOut[] = [];
  for (const arm of diag) { const r = simulate(arm, cands, streams, md, strategies); dres.push(r); reportArm(r); }

  // BTC multiplier: what the ×1.25 / ×0.75 actually does to the R accounting
  const ref = dres[0];
  L(`## C2. BTC daily-trend risk multiplier — where the extra 25% risk went (D0, ALL)`);
  for (const dir of ["LONG", "SHORT"] as const) for (const tr of ["up", "neutral", "down"] as const) {
    const t = ref.trades.filter(x => x.dir === dir && x.btcD === tr);
    if (!t.length) continue;
    const s = stats(t.map(x => x.netR));
    const mult = tr === "up" ? 1.25 : tr === "down" ? 0.75 : 1;
    L(`  ${dir.padEnd(5)} · BTC ${tr.padEnd(7)} T=${String(s.n).padStart(4)} exp=${sgn(s.exp, 3)} PF=${f(s.pf)} sumR=${sgn(s.sumR, 1)} · sized ×${mult} → sumR in base-R units=${sgn(s.sumR * mult, 1)}`);
  }
  L(``);

  // max-hold timeouts, exits by outcome
  L(`## C3. Exit outcomes (D0) — is the 200h/240h max-hold doing anything?`);
  for (const iv of ["1h", "4h"]) {
    const t = ref.trades.filter(x => x.interval === iv);
    if (!t.length) continue;
    const byOut = new Map<string, number[]>();
    for (const x of t) byOut.set(x.outcome, [...(byOut.get(x.outcome) ?? []), x.netR]);
    L(`  ${iv}: T=${t.length} ` + [...byOut.entries()].map(([k, r]) => `${k}=${r.length} (avg ${sgn(r.reduce((a, b) => a + b, 0) / r.length)}R)`).join("  "));
    const held = t.map(x => x.barsHeld).sort((a, b) => a - b);
    L(`      barsHeld p50=${held[Math.floor(held.length * 0.5)]} p90=${held[Math.floor(held.length * 0.9)]} p99=${held[Math.floor(held.length * 0.99)]} max=${held[held.length - 1]} (cap ${iv === "4h" ? 60 : 200})`);
  }
  L(``);

  L(`## C4. Cooldown / kill-switch blocks by strategy (D0)`);
  for (const [k, v] of Object.entries(ref.blocks).filter(([k]) => k.startsWith("cooldown") || k.startsWith("killSwitch")).sort()) L(`  ${k} = ${v}`);
  L(``);

  writeOut();
}

function writeOut() {
  const outPath = `script/audit/phase9-design-run-${TOTAL_CANDLES}.md`;
  writeFileSync(outPath, lines.join("\n"));
  console.log(`\n[raw run written to ${outPath}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
