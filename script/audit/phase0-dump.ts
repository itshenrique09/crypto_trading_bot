// ─── AUDIT PHASE 0: per-trade dump of the ENGINE-CURRENT pipeline config ───
// Faithful fork of script/validate-pipeline.ts (candidates + simulate) that runs
// ONLY the shipped engine config and dumps every simulated trade to JSON, then
// prints the Phase-0 baseline metrics the aggregate report cannot provide:
//   • R distribution histogram
//   • top-3 / top-5 trade concentration of sumR
//   • bootstrap 95% CI of expectancy (ALL + 2026)
//   • -0.12R/trade live-execution-penalty scenario
//   • max drawdown measured in R (the report's maxDD is balance-based)
//   • MFE/MAE per trade (recorded for Phase 1; not analysed here)
// PARITY CHECK: aggregate T/WR/PF/sumR/exp/maxDD must match the report's
// "ENGINE-CURRENT (shipped Jul 2026)" row exactly (same day-keyed candle cache).
// Run: npx tsx script/audit/phase0-dump.ts [--candles=8000] [--capital=500] [--risk=2] [--out=path.json]

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getAllStrategies } from "../../server/strategies/registry";
import { simulateManagedExit, type ManagedExitConfig, type ManagedExitResult } from "../../server/trade-exits";
import { dropOpenCandle } from "../../server/candles";
import { calcATRPercentile, type OHLCV } from "../../server/analysis";
import { classifyBtcRegime, defaultBtcContext, type BtcTrend } from "../../server/btc-regime-gate";
import { isRollingDrawdownBreached, strategiesToPause } from "../../server/portfolio-guards";
import type { Strategy } from "../../server/strategies/types";

// ── Engine constants (mirror validate-pipeline.ts / server/routes.ts) ──────
const MIN_SL_DISTANCE_PCT = 0.006;
const MIN_RR = 1.5;
const MAX_PER_GROUP = 3;
const FIXED_MAX_OPEN = 10;
const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ROLLING_DRAWDOWN_MAX_LOSS_R = 6;
const KILL_SWITCH_MIN_TRADES = 4;
const KILL_SWITCH_MAX_NET_R = -3;
const COIN_GROUP: Record<string, string> = {
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
// ENGINE-CURRENT: gates OFF = atrPct, shortConf, dailyTrend, dirOverlay, btcCap, ddMonthly, kelly
// (these gate branches are simply omitted below); exit = r_multiple 2R trailing.
const ENGINE_EXIT: ManagedExitConfig = { trailMode: "r_multiple", trailRMultiple: 2.0 };

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
const OUT_PATH = argv.out ?? "script/.cache/audit-phase0-trades.json";
const YEAR_2026_TS = Date.UTC(2026, 0, 1) / 1000;

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

async function fetchPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
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

// ── Trend helpers (identical to harness) ────────────────────────────────────
function emaSeeded(closes: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

type Trend = "up" | "down" | "neutral";

function dailyTrendAt(daily: OHLCV[], nowSec: number): Trend {
  let end = daily.length;
  while (end > 0 && daily[end - 1].time + 86_400 > nowSec) end--;
  if (end < 52) return "neutral";
  const closes = daily.slice(Math.max(0, end - 55), end).map(c => c.close);
  const ema = emaSeeded(closes, 50);
  const dist = (closes[closes.length - 1] - ema) / ema;
  return dist > 0.01 ? "up" : dist < -0.01 ? "down" : "neutral";
}

function weeklyTrendAt(weekly: OHLCV[], nowSec: number): Trend {
  let end = weekly.length;
  while (end > 0 && weekly[end - 1].time + 7 * 86_400 > nowSec) end--;
  if (end < 20) return "neutral";
  const closes = weekly.slice(Math.max(0, end - 26), end).map(c => c.close);
  const ema = emaSeeded(closes, 20);
  const dist = (closes[closes.length - 1] - ema) / ema;
  return dist > 0.02 ? "up" : dist < -0.02 ? "down" : "neutral";
}

// ── Candidates (identical filters to harness) ───────────────────────────────
interface Candidate {
  stratId: string;
  interval: string;
  symbol: string;
  tsSec: number;
  dir: "LONG" | "SHORT";
  entry: number;
  confidence: number;
  confluenceScore: number;
  slDistPct: number;
  atrPercentile: number;
  idx: number;
  streamKey: string;
  entryIdx: number;
  maxBars: number;
  ivSec: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number | null;
}

function intervalSec(iv: string): number {
  if (iv === "1h") return 3600;
  if (iv === "4h") return 4 * 3600;
  if (iv === "1d") return 24 * 3600;
  return 3600;
}

function buildCandidates(strat: Strategy, symbol: string, candles: OHLCV[]): Candidate[] {
  const out: Candidate[] = [];
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
      stratId: strat.id,
      interval: strat.interval,
      symbol,
      tsSec: candles[i].time + ivSec,
      dir: sig.direction,
      entry: sig.entry,
      confidence: sig.confidence,
      confluenceScore: sig.confluenceScore,
      slDistPct,
      atrPercentile: calcATRPercentile(slice),
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

// ── Exit resolution — keeps the FULL ManagedExitResult + MFE/MAE ────────────
interface ResolvedExitFull {
  netR: number;
  grossR: number;
  outcome: ManagedExitResult["outcome"];
  tp1Hit: boolean;
  barsHeld: number;
  exitTsSec: number;
  mfeR: number;        // max favorable excursion in R, up to and including exit bar
  maeR: number;        // max adverse excursion in R, up to and including exit bar
  mfeFullR: number;    // MFE over the entire maxBars window (ignores exit)
  barsToMfe: number;   // bar index (1-based) at which mfeR was reached
}

function resolveExitsFull(candidates: Candidate[], streams: Map<string, OHLCV[]>, exitCfg: ManagedExitConfig): ResolvedExitFull[] {
  const resolved = new Array<ResolvedExitFull>(candidates.length);
  for (const c of candidates) {
    const candles = streams.get(c.streamKey)!;
    const future = candles.slice(c.entryIdx + 1, c.entryIdx + 1 + c.maxBars);
    const exit = simulateManagedExit(
      { direction: c.dir, entry: c.entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: c.takeProfit2 },
      future,
      exitCfg,
    );
    const risk = Math.abs(c.entry - c.stopLoss);
    let mfeR = 0, maeR = 0, mfeFullR = 0, barsToMfe = 0;
    for (let i = 0; i < future.length; i++) {
      const fav = c.dir === "LONG" ? (future[i].high - c.entry) / risk : (c.entry - future[i].low) / risk;
      const adv = c.dir === "LONG" ? (c.entry - future[i].low) / risk : (future[i].high - c.entry) / risk;
      if (fav > mfeFullR) mfeFullR = fav;
      if (i < exit.barsHeld) {
        if (fav > mfeR) { mfeR = fav; barsToMfe = i + 1; }
        if (adv > maeR) maeR = adv;
      }
    }
    resolved[c.idx] = {
      netR: exit.netR, grossR: exit.grossR, outcome: exit.outcome, tp1Hit: exit.tp1Hit,
      barsHeld: exit.barsHeld, exitTsSec: c.tsSec + exit.barsHeld * c.ivSec,
      mfeR, maeR, mfeFullR, barsToMfe,
    };
  }
  return resolved;
}

// ── Portfolio simulation — ENGINE-CURRENT only (identical gate order) ──────
export interface DumpTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT"; interval: string;
  netR: number; grossR: number; riskUsd: number; pnlUsd: number;
  openedSec: number; closedSec: number;
  btcD: Trend; btcW: Trend;
  outcome: ManagedExitResult["outcome"]; tp1Hit: boolean; barsHeld: number;
  slDistPct: number; confidence: number;
  mfeR: number; maeR: number; mfeFullR: number; barsToMfe: number;
  entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number | null;
}

interface MarketData {
  btcDaily: OHLCV[];
  btcWeekly: OHLCV[];
  dailyBySym: Map<string, OHLCV[]>;
  weeklyBySym: Map<string, OHLCV[]>;
}

function simulateEngineCurrent(candidates: Candidate[], streams: Map<string, OHLCV[]>, md: MarketData, strategies: Strategy[]) {
  const exits = resolveExitsFull(candidates, streams, ENGINE_EXIT);
  const cands = [...candidates].sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));
  const cooldownH = new Map(strategies.map(s => [s.id, s.cooldownHours ?? 0]));

  let balance = START_CAPITAL;
  let peakBalance = START_CAPITAL;
  let maxDD = 0;
  interface OpenPos { strategy: string; group?: string; exitTsSec: number; trade: DumpTrade }
  const openBySymbol = new Map<string, OpenPos[]>();
  const totalOpenCount = () => { let n = 0; for (const v of openBySymbol.values()) n += v.length; return n; };
  const lastClosedAt = new Map<string, number>();
  const closedLog: Array<{ strategy: string; closed_at: string; pnl_usd: number; risk_usd: number; outcome: string }> = [];
  const trades: DumpTrade[] = [];
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

    const oneR = balance * BASE_RISK_PCT / 100;
    // ddDaily (active)
    {
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -4 * oneR) { block("ddDaily"); continue; }
    }
    // ddMonthly: SKIPPED (removed from engine Jul 2026)
    // ddRolling (active)
    if (isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R, now: nowMs })) {
      block("ddRolling7d"); continue;
    }

    // BTC regime: classification informational; riskMult ACTIVE; cap fixed; overlay off
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

    // kill-switch (active)
    {
      const paused = strategiesToPause(closedLog, [c.stratId], {
        windowMs: ROLLING_WINDOW_MS, minTrades: KILL_SWITCH_MIN_TRADES, maxNetR: KILL_SWITCH_MAX_NET_R, now: nowMs,
      });
      if (paused.has(c.stratId)) { block("killSwitch"); continue; }
    }

    // atrPct / dirOverlay / dailyTrend / shortConf: SKIPPED (removed from engine Jul 2026)

    // weekly alignment for 4h strategies (active)
    if (c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }

    // kelly: SKIPPED (removed — fixed base risk %)
    const kellyPct = BASE_RISK_PCT * riskMultiplier;
    const riskUsd = balance * kellyPct / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }

    const exit = exits[c.idx];
    const trade: DumpTrade = {
      symbol: c.symbol, strategy: c.stratId, dir: c.dir, interval: c.interval,
      netR: exit.netR, grossR: exit.grossR, riskUsd, pnlUsd: exit.netR * riskUsd,
      openedSec: nowSec, closedSec: exit.exitTsSec,
      btcD: btcDailyTrend as Trend, btcW: wTrend("BTC", nowSec),
      outcome: exit.outcome, tp1Hit: exit.tp1Hit, barsHeld: exit.barsHeld,
      slDistPct: c.slDistPct, confidence: c.confidence,
      mfeR: exit.mfeR, maeR: exit.maeR, mfeFullR: exit.mfeFullR, barsToMfe: exit.barsToMfe,
      entry: c.entry, stopLoss: c.stopLoss, takeProfit1: c.takeProfit1, takeProfit2: c.takeProfit2 ?? null,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: exit.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }

  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);
  return { trades, finalBalance: balance, maxDrawdownPct: maxDD * 100, blocks };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
function stats(rs: number[]) {
  const n = rs.length;
  const wins = rs.filter(r => r >= 0).length;
  const sumR = rs.reduce((s, r) => s + r, 0);
  const gw = rs.reduce((s, r) => s + (r >= 0 ? r : 0), 0);
  const gl = rs.reduce((s, r) => s + (r < 0 ? -r : 0), 0);
  return { n, wr: n ? (wins / n) * 100 : 0, pf: gl > 0 ? gw / gl : Infinity, sumR, exp: n ? sumR / n : 0 };
}

function fmt(s: ReturnType<typeof stats>): string {
  return `T=${String(s.n).padStart(4)} WR=${s.wr.toFixed(1)}% PF=${s.pf === Infinity ? "∞" : s.pf.toFixed(2)} sumR=${(s.sumR >= 0 ? "+" : "") + s.sumR.toFixed(1)} exp=${(s.exp >= 0 ? "+" : "") + s.exp.toFixed(3)}R`;
}

// Deterministic RNG (mulberry32) — no Math.random so reruns are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bootstrapCI(rs: number[], iters = 10_000, seed = 42): { lo: number; hi: number } {
  const rnd = mulberry32(seed);
  const means: number[] = [];
  for (let i = 0; i < iters; i++) {
    let s = 0;
    for (let j = 0; j < rs.length; j++) s += rs[(rnd() * rs.length) | 0];
    means.push(s / rs.length);
  }
  means.sort((a, b) => a - b);
  return { lo: means[Math.floor(iters * 0.025)], hi: means[Math.floor(iters * 0.975)] };
}

function maxDrawdownR(rs: number[]): number {
  let cum = 0, peak = 0, dd = 0;
  for (const r of rs) { cum += r; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return dd;
}

function report(label: string, trades: DumpTrade[]) {
  const rs = trades.map(t => t.netR);
  const s = stats(rs);
  const ci = trades.length >= 2 ? bootstrapCI(rs) : { lo: NaN, hi: NaN };
  const sorted = [...rs].sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3).reduce((a, b) => a + b, 0);
  const top5 = sorted.slice(0, 5).reduce((a, b) => a + b, 0);
  const pen = rs.map(r => r - 0.12);
  const sPen = stats(pen);
  console.log(`\n### ${label}`);
  console.log(`  ${fmt(s)}  maxDD(R)=${maxDrawdownR(rs).toFixed(1)}R`);
  console.log(`  exp 95% CI (bootstrap 10k): [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] R/trade`);
  console.log(`  top3 = ${top3.toFixed(1)}R (${(100 * top3 / s.sumR).toFixed(1)}% of sumR) | top5 = ${top5.toFixed(1)}R (${(100 * top5 / s.sumR).toFixed(1)}%)`);
  console.log(`  sumR w/o top3 = ${(s.sumR - top3).toFixed(1)} | w/o top5 = ${(s.sumR - top5).toFixed(1)}`);
  console.log(`  -0.12R penalty: ${fmt(sPen)}  CI [${(ci.lo - 0.12).toFixed(3)}, ${(ci.hi - 0.12).toFixed(3)}]`);
  // outcome distribution
  const byOutcome = new Map<string, number[]>();
  for (const t of trades) byOutcome.set(t.outcome, [...(byOutcome.get(t.outcome) ?? []), t.netR]);
  for (const [o, arr] of [...byOutcome].sort((a, b) => b[1].length - a[1].length)) {
    const os = stats(arr);
    console.log(`  exit=${o.padEnd(10)} n=${String(os.n).padStart(4)} (${(100 * os.n / s.n).toFixed(1).padStart(4)}%) avgR=${(os.exp >= 0 ? "+" : "") + os.exp.toFixed(3)} sumR=${(os.sumR >= 0 ? "+" : "") + os.sumR.toFixed(1)}`);
  }
  // R histogram
  console.log(`  R histogram (0.5R bins):`);
  const bins = new Map<number, number>();
  for (const r of rs) {
    const b = Math.floor(r / 0.5) * 0.5;
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  for (const [b, nBin] of [...bins].sort((a, b) => a[0] - b[0])) {
    const bar = "#".repeat(Math.max(1, Math.round(60 * nBin / s.n)));
    console.log(`    ${b.toFixed(1).padStart(5)}..${(b + 0.5).toFixed(1).padEnd(5)} ${String(nBin).padStart(4)} ${bar}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const strategies = getAllStrategies();
  const streams = new Map<string, OHLCV[]>();
  const symbols = new Set<string>();
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      symbols.add(sym);
      const key = `${sym}:${strat.interval}`;
      if (!streams.has(key)) {
        try { streams.set(key, await fetchPaginated(sym, strat.interval, TOTAL_CANDLES)); }
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
  const md: MarketData = { btcDaily, btcWeekly, dailyBySym, weeklyBySym };

  const candidates: Candidate[] = [];
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      const candles = streams.get(`${sym}:${strat.interval}`);
      if (!candles) continue;
      candidates.push(...buildCandidates(strat, sym, candles));
    }
  }
  candidates.forEach((c, i) => { c.idx = i; });
  console.log(`Total raw candidates (post minSL+R:R): ${candidates.length}`);

  const r = simulateEngineCurrent(candidates, streams, md, strategies);
  console.log(`\nPARITY vs report ENGINE-CURRENT row — expect identical T/WR/PF/sumR/exp/maxDD:`);
  const all = stats(r.trades.map(t => t.netR));
  console.log(`  ALL:  ${fmt(all)}  balance $${r.finalBalance.toFixed(0)} maxDD ${r.maxDrawdownPct.toFixed(1)}%`);
  const y26 = r.trades.filter(t => t.openedSec >= YEAR_2026_TS);
  console.log(`  2026: ${fmt(stats(y26.map(t => t.netR)))}`);
  const blocked = Object.entries(r.blocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(`  blocks: ${blocked}`);

  report("ALL window", r.trades);
  report("2026 window", y26);
  for (const strat of strategies) {
    const t = r.trades.filter(x => x.strategy === strat.id);
    if (t.length) report(`${strat.id} — ALL`, t);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), candles: TOTAL_CANDLES, capital: START_CAPITAL, riskPct: BASE_RISK_PCT, trades: r.trades }, null, 1));
  console.log(`\n[per-trade dump written to ${OUT_PATH} — ${r.trades.length} trades]`);
}

main().catch(e => { console.error(e); process.exit(1); });
