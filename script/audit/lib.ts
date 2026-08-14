// ─── AUDIT SHARED LIB — mirrors validate-pipeline.ts ENGINE-CURRENT exactly ──
// Extracted from script/audit/phase0-dump.ts (which was validated by exact
// parity against the official harness report). Any change here must re-pass
// the parity check in phase1-exits.ts before results count.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { simulateManagedExit, type ManagedExitConfig, type ManagedExitResult } from "../../server/trade-exits";
import { dropOpenCandle } from "../../server/candles";
import { type OHLCV } from "../../server/analysis";
import { classifyBtcRegime, defaultBtcContext, type BtcTrend } from "../../server/btc-regime-gate";
import { isRollingDrawdownBreached, strategiesToPause } from "../../server/portfolio-guards";
import type { Strategy } from "../../server/strategies/types";

// ── Engine constants (mirror validate-pipeline.ts / server/routes.ts) ──────
export const MIN_SL_DISTANCE_PCT = 0.006;
export const MIN_RR = 1.5;
export const MAX_PER_GROUP = 3;
export const FIXED_MAX_OPEN = 10;
export const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const ROLLING_DRAWDOWN_MAX_LOSS_R = 6;
export const KILL_SWITCH_MIN_TRADES = 4;
export const KILL_SWITCH_MAX_NET_R = -3;
export const YEAR_2026_TS = Date.UTC(2026, 0, 1) / 1000;
export const ENGINE_EXIT: ManagedExitConfig = { trailMode: "r_multiple", trailRMultiple: 2.0 };
export const COIN_GROUP: Record<string, string> = {
  SOL: "L1", AVAX: "L1", NEAR: "L1", DOT: "L1", ICP: "L1", MATIC: "L1", ADA: "L1",
  BTC: "major", ETH: "major", BNB: "major", XRP: "major", LTC: "major",
  DOGE: "meme", SHIB: "meme", PEPE: "meme",
  LINK: "defi", UNI: "defi", FIL: "defi", ATOM: "defi",
  ONDO: "defi", ENA: "defi", CRV: "defi", RUNE: "defi",
  SAND: "gaming", GALA: "gaming", IMX: "gaming", VET: "infra",
  SUI: "L1", ARB: "L1", OP: "L1", APT: "L1", INJ: "L1", SEI: "L1", TIA: "L1",
  POL: "L1",
  FET: "ai", RENDER: "ai", WLD: "ai", GRT: "ai",
};

// ── Candle fetching with day-keyed disk cache (identical to harness) ───────
const BINANCE_BASE = "https://api.binance.com/api/v3";
const CACHE_DIR = "script/.cache";
const DAY_KEY = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchJSON(url: string, retries = 3): Promise<any> {
  let lastErr: unknown;
  for (let a = 0; a <= retries; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 429 || r.status === 418) { await sleep(2000 * (a + 1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { lastErr = e; await sleep(400 * (a + 1)); }
  }
  throw lastErr;
}

export async function fetchPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
  const cachePath = `${CACHE_DIR}/pl_${symbol}_${interval}_${total}_${DAY_KEY}.json`;
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf-8")) as OHLCV[];
  }
  const pair = `${symbol.toUpperCase()}USDT`;
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches = Math.ceil((total + 1) / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${pair}&interval=${interval}&limit=${batchSize}` + (endTime ? `&endTime=${endTime}` : "");
    const data: any[][] = await fetchJSON(`${BINANCE_BASE}/klines?${qs}`);
    if (!Array.isArray(data) || data.length === 0) break;
    const batch: OHLCV[] = data.map(k => ({
      time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
    }));
    candles.unshift(...batch);
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
    await sleep(120);
  }
  const result = dropOpenCandle(candles, interval).slice(-total);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(result));
  return result;
}

export interface MarketData {
  btcDaily: OHLCV[];
  btcWeekly: OHLCV[];
  dailyBySym: Map<string, OHLCV[]>;
  weeklyBySym: Map<string, OHLCV[]>;
}

export async function loadMarketData(strategies: Strategy[], totalCandles: number): Promise<{ streams: Map<string, OHLCV[]>; md: MarketData }> {
  const streams = new Map<string, OHLCV[]>();
  const symbols = new Set<string>();
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      symbols.add(sym);
      const key = `${sym}:${strat.interval}`;
      if (!streams.has(key)) {
        try { streams.set(key, await fetchPaginated(sym, strat.interval, totalCandles)); }
        catch (e: any) { console.error(`fetch failed ${key}: ${e?.message ?? e}`); }
      }
    }
  }
  const btcDaily = await fetchPaginated("BTC", "1d", 600);
  const btcWeekly = await fetchPaginated("BTC", "1w", 400);
  const dailyBySym = new Map<string, OHLCV[]>();
  for (const sym of symbols) {
    try { dailyBySym.set(sym, await fetchPaginated(sym, "1d", 400)); }
    catch (e: any) { console.error(`daily fetch failed ${sym}: ${e?.message ?? e}`); }
  }
  const weeklyBySym = new Map<string, OHLCV[]>();
  const fourHSyms = new Set(strategies.filter(s => s.interval === "4h").flatMap(s => s.preferredSymbols ?? []));
  for (const sym of fourHSyms) {
    try { weeklyBySym.set(sym, await fetchPaginated(sym, "1w", 400)); }
    catch (e: any) { console.error(`weekly fetch failed ${sym}: ${e?.message ?? e}`); }
  }
  return { streams, md: { btcDaily, btcWeekly, dailyBySym, weeklyBySym } };
}

// ── Trend helpers (identical to harness) ────────────────────────────────────
function emaSeeded(closes: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

export type Trend = "up" | "down" | "neutral";

export function dailyTrendAt(daily: OHLCV[], nowSec: number): Trend {
  let end = daily.length;
  while (end > 0 && daily[end - 1].time + 86_400 > nowSec) end--;
  if (end < 52) return "neutral";
  const closes = daily.slice(Math.max(0, end - 55), end).map(c => c.close);
  const ema = emaSeeded(closes, 50);
  const dist = (closes[closes.length - 1] - ema) / ema;
  return dist > 0.01 ? "up" : dist < -0.01 ? "down" : "neutral";
}

export function weeklyTrendAt(weekly: OHLCV[], nowSec: number): Trend {
  let end = weekly.length;
  while (end > 0 && weekly[end - 1].time + 7 * 86_400 > nowSec) end--;
  if (end < 20) return "neutral";
  const closes = weekly.slice(Math.max(0, end - 26), end).map(c => c.close);
  const ema = emaSeeded(closes, 20);
  const dist = (closes[closes.length - 1] - ema) / ema;
  return dist > 0.02 ? "up" : dist < -0.02 ? "down" : "neutral";
}

// ── Wilder ATR-14 (copied verbatim from server/analysis.ts:384 — not exported there) ──
export function calcATRLocal(candles: OHLCV[], period = 14): number {
  if (candles.length < 2) return 0;
  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trValues.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ));
  }
  if (trValues.length < period) return trValues.reduce((a, b) => a + b, 0) / trValues.length;
  let atr = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }
  return atr;
}

// ── Candidates — tagged with gate outcomes so rejected signals stay visible ─
export interface AuditCandidate {
  stratId: string;
  interval: string;
  symbol: string;
  tsSec: number;
  dir: "LONG" | "SHORT";
  entry: number;
  confidence: number;
  confluenceScore: number;
  slDistPct: number;
  rr: number;
  atr14: number;
  rejectMinSL: boolean;
  rejectMinRR: boolean;
  idx: number;
  streamKey: string;
  entryIdx: number;
  maxBars: number;
  ivSec: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number | null;
}

export function intervalSec(iv: string): number {
  if (iv === "1h") return 3600;
  if (iv === "4h") return 4 * 3600;
  if (iv === "1d") return 24 * 3600;
  return 3600;
}

export function buildCandidatesTagged(strat: Strategy, symbol: string, candles: OHLCV[]): AuditCandidate[] {
  const out: AuditCandidate[] = [];
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
    if (risk <= 0 || sig.entry <= 0) continue; // degenerate — unusable even for diagnostics
    const reward = Math.abs(sig.takeProfit1 - sig.entry);
    const slDistPct = risk / sig.entry;
    const rr = reward / risk;

    out.push({
      stratId: strat.id,
      interval: strat.interval,
      symbol,
      tsSec: candles[i].time + ivSec,
      dir: sig.direction,
      entry: sig.entry,
      confidence: sig.confidence,
      confluenceScore: sig.confluenceScore,
      slDistPct,
      rr,
      atr14: calcATRLocal(slice),
      rejectMinSL: slDistPct < MIN_SL_DISTANCE_PCT,
      rejectMinRR: rr < MIN_RR,
      idx: -1,
      streamKey: `${symbol}:${strat.interval}`,
      entryIdx: i,
      maxBars,
      ivSec,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit1,
      takeProfit2: sig.takeProfit2,
    });
  }
  return out;
}

// ── Extended managed-exit simulator ─────────────────────────────────────────
// Identical to server/trade-exits.ts simulateManagedExit, PLUS an optional
// pre-TP1 break-even ratchet (beAtR): once favorable excursion reaches
// beAtR × risk, the pre-TP1 stop moves to entry. Convention matches the
// production simulator: within a bar, downside is checked BEFORE upside, and
// the ratchet arms only for FOLLOWING bars (like the trail's peak update).
// With beAtR undefined it DELEGATES to the production simulator (bit parity).
export function simulateManagedExitAudit(
  levels: { direction: "LONG" | "SHORT"; entry: number; stopLoss: number; takeProfit1: number; takeProfit2?: number | null },
  futureCandles: OHLCV[],
  config: ManagedExitConfig = {},
  beAtR?: number,
): ManagedExitResult {
  if (beAtR == null) return simulateManagedExit(levels, futureCandles, config);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const round = (v: number, digits = 10) => Math.round(v * 10 ** digits) / 10 ** digits;
  const directionalReturn = (dir: "LONG" | "SHORT", entry: number, exit: number) =>
    dir === "LONG" ? (exit - entry) / entry : (entry - exit) / entry;

  const tp1ClosePct = clamp(config.tp1ClosePct ?? 0.6, 0, 1);
  const trailingPct = Math.max(0, config.trailingPct ?? 0.02);
  const takerFeePct = Math.max(0, config.takerFeePct ?? 0.0002);
  const slippagePct = Math.max(0, config.slippagePct ?? 0.0005);
  const trailMode = config.trailMode ?? "fixed_pct";
  const trailR = Math.max(0, config.trailRMultiple ?? 2.0);

  const { direction, entry, stopLoss, takeProfit1 } = levels;
  const takeProfit2 = levels.takeProfit2 ?? takeProfit1;
  const riskAbs = Math.abs(entry - stopLoss);
  if (riskAbs <= 0 || entry <= 0) throw new Error("Managed exit requires positive entry and non-zero risk");

  const trailStopFor = (pk: number): number => {
    if (trailMode === "r_multiple") {
      return direction === "LONG" ? pk - trailR * riskAbs : pk + trailR * riskAbs;
    }
    return direction === "LONG" ? pk * (1 - trailingPct) : pk * (1 + trailingPct);
  };

  let outcome: ManagedExitResult["outcome"] = "timeout";
  let tp1Hit = false;
  let beArmed = false;
  let remainingShare = 1;
  let peak = entry;
  let exitPrice = entry;
  let barsHeld = 0;
  const fills: Array<{ share: number; price: number }> = [];

  const closeShare = (share: number, price: number) => {
    const filledShare = clamp(share, 0, remainingShare);
    if (filledShare <= 0) return;
    fills.push({ share: filledShare, price });
    remainingShare = round(remainingShare - filledShare);
    exitPrice = price;
  };

  for (let i = 0; i < futureCandles.length; i++) {
    const candle = futureCandles[i];
    barsHeld = i + 1;

    if (direction === "LONG") {
      if (!tp1Hit) {
        const stopNow = beArmed ? entry : stopLoss;
        if (candle.low <= stopNow) {
          outcome = beArmed ? "breakeven" : "loss";
          closeShare(remainingShare, stopNow);
          break;
        }
        if (candle.high >= takeProfit1) {
          tp1Hit = true;
          peak = Math.max(peak, takeProfit1, candle.high);
          closeShare(tp1ClosePct, takeProfit1);
          if (remainingShare <= 0) { outcome = "tp1"; break; }
          continue;
        }
        // arm the ratchet only after this bar's checks (next bar onward)
        if (!beArmed && candle.high - entry >= beAtR * riskAbs) beArmed = true;
      }

      if (tp1Hit && remainingShare > 0) {
        const trailStop = trailStopFor(peak);
        if (candle.low <= trailStop && trailStop > entry) {
          outcome = "trailing";
          closeShare(remainingShare, trailStop);
          break;
        }
        if (candle.low <= entry) {
          outcome = "breakeven";
          closeShare(remainingShare, entry);
          break;
        }
        peak = Math.max(peak, candle.high);
        if (takeProfit2 && candle.high >= takeProfit2) {
          outcome = "tp2";
          closeShare(remainingShare, takeProfit2);
          break;
        }
      }
    } else {
      if (!tp1Hit) {
        const stopNow = beArmed ? entry : stopLoss;
        if (candle.high >= stopNow) {
          outcome = beArmed ? "breakeven" : "loss";
          closeShare(remainingShare, stopNow);
          break;
        }
        if (candle.low <= takeProfit1) {
          tp1Hit = true;
          peak = Math.min(peak, takeProfit1, candle.low);
          closeShare(tp1ClosePct, takeProfit1);
          if (remainingShare <= 0) { outcome = "tp1"; break; }
          continue;
        }
        if (!beArmed && entry - candle.low >= beAtR * riskAbs) beArmed = true;
      }

      if (tp1Hit && remainingShare > 0) {
        const trailStop = trailStopFor(peak);
        if (candle.high >= trailStop && trailStop < entry) {
          outcome = "trailing";
          closeShare(remainingShare, trailStop);
          break;
        }
        if (candle.high >= entry) {
          outcome = "breakeven";
          closeShare(remainingShare, entry);
          break;
        }
        peak = Math.min(peak, candle.low);
        if (takeProfit2 && candle.low <= takeProfit2) {
          outcome = "tp2";
          closeShare(remainingShare, takeProfit2);
          break;
        }
      }
    }
  }

  if (remainingShare > 0) {
    const timeoutExit = futureCandles[futureCandles.length - 1]?.close ?? entry;
    closeShare(remainingShare, timeoutExit);
    if (outcome === "timeout" && tp1Hit) outcome = "tp1";
  }

  const grossPnlPct = fills.reduce((sum, f) => sum + f.share * directionalReturn(direction, entry, f.price) * 100, 0);
  const totalExitShare = fills.reduce((sum, f) => sum + f.share, 0);
  const costPct = (takerFeePct + slippagePct) * 100 * (1 + totalExitShare);
  const netPnlPct = grossPnlPct - costPct;
  const riskPct = (riskAbs / entry) * 100;

  return {
    outcome,
    tp1Hit,
    grossR: round(grossPnlPct / riskPct),
    netR: round(netPnlPct / riskPct),
    grossPnlPct: round(grossPnlPct),
    netPnlPct: round(netPnlPct),
    costPct: round(costPct),
    exitPrice: round(exitPrice),
    barsHeld,
  };
}

// ── Exit resolution with MFE/MAE ────────────────────────────────────────────
export interface ResolvedExitFull {
  netR: number;
  grossR: number;
  outcome: ManagedExitResult["outcome"];
  tp1Hit: boolean;
  barsHeld: number;
  exitTsSec: number;
  mfeR: number;        // max favorable excursion up to AND INCLUDING the exit bar (upper bound)
  maeR: number;
  mfeFullR: number;
  barsToMfe: number;
  mfePreExitR: number; // max favorable excursion STRICTLY BEFORE the exit bar — the
                       // conservative "touched +XR then died" measure (a touch on the
                       // exit bar itself could never have been acted on: downside is
                       // resolved before upside within a bar)
}

export interface ExitOptions {
  maxBarsBy?: Record<string, number>;      // interval → bars (default: candidate.maxBars)
  beAtR?: number;                          // pre-TP1 break-even ratchet
  slOverride?: (c: AuditCandidate) => number; // replace stop for the whole trade (ATR-stop arms)
}

export function resolveExitsFull(
  candidates: AuditCandidate[],
  streams: Map<string, OHLCV[]>,
  exitCfg: ManagedExitConfig,
  opts: ExitOptions = {},
): ResolvedExitFull[] {
  const resolved = new Array<ResolvedExitFull>(candidates.length);
  for (const c of candidates) {
    const candles = streams.get(c.streamKey)!;
    const maxBars = opts.maxBarsBy?.[c.interval] ?? c.maxBars;
    const stopLoss = opts.slOverride ? opts.slOverride(c) : c.stopLoss;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + maxBars);
    const exit = simulateManagedExitAudit(
      { direction: c.dir, entry: c.entry, stopLoss, takeProfit1: c.takeProfit1, takeProfit2: c.takeProfit2 },
      future,
      exitCfg,
      opts.beAtR,
    );
    const risk = Math.abs(c.entry - stopLoss);
    let mfeR = 0, maeR = 0, mfeFullR = 0, barsToMfe = 0, mfePreExitR = 0;
    for (let i = 0; i < future.length; i++) {
      const fav = c.dir === "LONG" ? (future[i].high - c.entry) / risk : (c.entry - future[i].low) / risk;
      const adv = c.dir === "LONG" ? (c.entry - future[i].low) / risk : (future[i].high - c.entry) / risk;
      if (fav > mfeFullR) mfeFullR = fav;
      if (i < exit.barsHeld) {
        if (fav > mfeR) { mfeR = fav; barsToMfe = i + 1; }
        if (adv > maeR) maeR = adv;
        if (i < exit.barsHeld - 1 && fav > mfePreExitR) mfePreExitR = fav;
      }
    }
    resolved[c.idx] = {
      netR: exit.netR, grossR: exit.grossR, outcome: exit.outcome, tp1Hit: exit.tp1Hit,
      barsHeld: exit.barsHeld, exitTsSec: c.tsSec + exit.barsHeld * c.ivSec,
      mfeR, maeR, mfeFullR, barsToMfe, mfePreExitR,
    };
  }
  return resolved;
}

// ── Portfolio simulation — ENGINE-CURRENT gates ─────────────────────────────
export interface AuditTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT"; interval: string;
  netR: number; riskUsd: number; pnlUsd: number;
  openedSec: number; closedSec: number;
  btcD: Trend; btcW: Trend;
  outcome: ManagedExitResult["outcome"]; tp1Hit: boolean; barsHeld: number;
  slDistPct: number;
  mfeR: number; maeR: number; mfeFullR: number; mfePreExitR: number;
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number | null;
}

export interface SimOutput {
  trades: AuditTrade[];
  finalBalance: number;
  maxDrawdownPct: number;
  blocks: Record<string, number>;
}

export interface SimOptions {
  /** When set, mirror the engines' checkMarginCapacity: refuse an entry when
   *  openNotional + newNotional > balance × leverage. Notional = riskUsd ÷
   *  slDistPct. Simplification (declared): full notional is held until close —
   *  the TP1 partial reduction is ignored, which is slightly conservative.
   *  Undefined = no margin model (parity with the official harness). */
  marginLeverage?: number;
}

export function simulateEngineCurrent(
  candidates: AuditCandidate[],
  exits: ResolvedExitFull[],
  md: MarketData,
  strategies: Strategy[],
  startCapital: number,
  baseRiskPct: number,
  simOpts: SimOptions = {},
): SimOutput {
  const cands = [...candidates].sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));

  let balance = startCapital;
  let peakBalance = startCapital;
  let maxDD = 0;
  let openNotionalUsd = 0;
  interface OpenPos { strategy: string; group?: string; exitTsSec: number; notionalUsd: number; trade: AuditTrade }
  const openBySymbol = new Map<string, OpenPos[]>();
  const totalOpenCount = () => { let n = 0; for (const v of openBySymbol.values()) n += v.length; return n; };
  const lastClosedAt = new Map<string, number>();
  const closedLog: Array<{ strategy: string; closed_at: string; pnl_usd: number; risk_usd: number; outcome: string }> = [];
  const trades: AuditTrade[] = [];
  const blocks: Record<string, number> = {};
  const block = (k: string) => { blocks[k] = (blocks[k] ?? 0) + 1; };

  const trendCache = new Map<string, Trend>();
  const dTrend = (sym: string, nowSec: number): Trend => {
    const key = `d:${sym}:${Math.floor(nowSec / 86_400)}`;
    let t = trendCache.get(key);
    if (t === undefined) {
      const series = sym === "BTC" ? md.btcDaily : md.dailyBySym.get(sym);
      t = series ? dailyTrendAt(series, nowSec) : "neutral";
      trendCache.set(key, t);
    }
    return t;
  };
  const wTrend = (sym: string, nowSec: number): Trend => {
    const key = `w:${sym}:${Math.floor(nowSec / (7 * 86_400))}`;
    let t = trendCache.get(key);
    if (t === undefined) {
      const series = sym === "BTC" ? md.btcWeekly : md.weeklyBySym.get(sym);
      t = series ? weeklyTrendAt(series, nowSec) : "neutral";
      trendCache.set(key, t);
    }
    return t;
  };

  const closeDue = (nowSec: number) => {
    for (const [sym, list] of Array.from(openBySymbol.entries())) {
      const due = list.filter(p => p.exitTsSec <= nowSec);
      if (!due.length) continue;
      const remaining = list.filter(p => p.exitTsSec > nowSec);
      if (remaining.length) openBySymbol.set(sym, remaining);
      else openBySymbol.delete(sym);
      for (const pos of due) {
        balance += pos.trade.pnlUsd;
        openNotionalUsd = Math.max(0, openNotionalUsd - pos.notionalUsd);
        peakBalance = Math.max(peakBalance, balance);
        maxDD = Math.max(maxDD, peakBalance > 0 ? (peakBalance - balance) / peakBalance : 0);
        lastClosedAt.set(`${sym}:${pos.strategy}`, pos.exitTsSec * 1000);
        closedLog.push({
          strategy: pos.strategy,
          closed_at: new Date(pos.exitTsSec * 1000).toISOString(),
          pnl_usd: pos.trade.pnlUsd,
          risk_usd: pos.trade.riskUsd,
          outcome: pos.trade.netR >= 0 ? "win" : "loss",
        });
        trades.push(pos.trade);
      }
    }
  };

  for (const c of cands) {
    const nowSec = c.tsSec;
    const nowMs = nowSec * 1000;
    closeDue(nowSec);

    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= 1) { block("exposure"); continue; }
    if (symPositions.some(p => p.strategy === c.stratId)) { block("exposure"); continue; }

    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) {
      const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`);
      if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; }
    }

    const oneR = balance * baseRiskPct / 100;
    {
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -4 * oneR) { block("ddDaily"); continue; }
    }
    if (isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R, now: nowMs })) {
      block("ddRolling7d"); continue;
    }

    const btcDailyTrend = dTrend("BTC", nowSec) as BtcTrend;
    let riskMultiplier = 1.0;
    if (btcDailyTrend === "up") riskMultiplier = 1.25;
    else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    try { classifyBtcRegime({ daily: btcDailyTrend, weekly: wTrend("BTC", nowSec) as BtcTrend }); } catch { defaultBtcContext(); }

    if (totalOpenCount() >= FIXED_MAX_OPEN) { block("maxOpen"); continue; }

    const group = COIN_GROUP[c.symbol];
    if (group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const pos of list) if (pos.group === group) inGroup++;
      if (inGroup >= MAX_PER_GROUP) { block("groupCap"); continue; }
    }

    {
      const paused = strategiesToPause(closedLog, [c.stratId], {
        windowMs: ROLLING_WINDOW_MS, minTrades: KILL_SWITCH_MIN_TRADES, maxNetR: KILL_SWITCH_MAX_NET_R, now: nowMs,
      });
      if (paused.has(c.stratId)) { block("killSwitch"); continue; }
    }

    if (c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }

    const kellyPct = baseRiskPct * riskMultiplier;
    const riskUsd = balance * kellyPct / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }

    // margin capacity (mirror of routes.ts checkMarginCapacity, optional)
    const notionalUsd = c.slDistPct > 0 ? riskUsd / c.slDistPct : 0;
    if (simOpts.marginLeverage != null) {
      const capacity = Math.max(0, balance) * Math.max(1, simOpts.marginLeverage);
      if (openNotionalUsd + notionalUsd > capacity) { block("margin"); continue; }
    }

    const exit = exits[c.idx];
    const trade: AuditTrade = {
      symbol: c.symbol, strategy: c.stratId, dir: c.dir, interval: c.interval,
      netR: exit.netR, riskUsd, pnlUsd: exit.netR * riskUsd,
      openedSec: nowSec, closedSec: exit.exitTsSec,
      btcD: btcDailyTrend as Trend, btcW: wTrend("BTC", nowSec),
      outcome: exit.outcome, tp1Hit: exit.tp1Hit, barsHeld: exit.barsHeld,
      slDistPct: c.slDistPct,
      mfeR: exit.mfeR, maeR: exit.maeR, mfeFullR: exit.mfeFullR, mfePreExitR: exit.mfePreExitR,
      entry: c.entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: c.takeProfit2 ?? null,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: exit.exitTsSec, notionalUsd, trade });
    openBySymbol.set(c.symbol, list);
    openNotionalUsd += notionalUsd;
  }

  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { trades, finalBalance: balance, maxDrawdownPct: maxDD * 100, blocks };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
export interface BasicStats { n: number; wr: number; pf: number; sumR: number; exp: number }

export function stats(rs: number[]): BasicStats {
  const n = rs.length;
  const wins = rs.filter(r => r >= 0).length;
  const sumR = rs.reduce((s, r) => s + r, 0);
  const gw = rs.reduce((s, r) => s + (r >= 0 ? r : 0), 0);
  const gl = rs.reduce((s, r) => s + (r < 0 ? -r : 0), 0);
  return { n, wr: n ? (wins / n) * 100 : 0, pf: gl > 0 ? gw / gl : Infinity, sumR, exp: n ? sumR / n : 0 };
}

export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapCI(rs: number[], iters = 10_000, seed = 42, alpha = 0.05): { lo: number; hi: number } {
  if (rs.length < 2) return { lo: NaN, hi: NaN };
  const rnd = mulberry32(seed);
  const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0;
    for (let j = 0; j < rs.length; j++) s += rs[(rnd() * rs.length) | 0];
    means.push(s / rs.length);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * (alpha / 2))], hi: means[Math.min(iters - 1, Math.floor(iters * (1 - alpha / 2)))] };
}

export function maxDrawdownR(rs: number[]): number {
  let cum = 0, peak = 0, dd = 0;
  for (const r of rs) { cum += r; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return dd;
}

export function expWithoutTopK(rs: number[], k: number): number {
  const sorted = [...rs].sort((a, b) => b - a);
  const rest = sorted.slice(k);
  return rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : 0;
}
