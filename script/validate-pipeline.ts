// ─── FULL-PIPELINE PORTFOLIO VALIDATION ──────────────────────────────────
// Unlike validate-2026.ts (per-strategy raw edge, 2 gates), this simulates the
// ENTIRE live paper pipeline chronologically as one portfolio:
//   • sequential capital (compounding from --capital)
//   • one open position per symbol (exposure guard)
//   • BTC regime cap on concurrent positions + directional overlay
//   • daily/weekly trend filters, SHORT confidence, ATR-percentile filter
//   • correlation-group caps, per-pair cooldowns
//   • drawdown guards (-4R day / -8R month / -6R rolling-7d) + per-strategy
//     kill-switch (same functions the engine calls)
//   • fractional-Kelly sizing with BTC risk multiplier + direction size mult
//
// Each gate is individually toggleable, so the suite quantifies what every
// filter actually contributes to net P&L. This answers the question the old
// harness could not: "does the SYSTEM (not the strategy) make money?"
//
// Honestly unmodeled (needs historical data we don't fetch):
//   • MEXC volume / spread / funding-rate filters (entry-time market state)
//   • contract availability, order rejections, engine downtime
//   • live entry drift vs candle close (paper enters at signal.entry too)
//
// Run: npx tsx script/validate-pipeline.ts        (full suite → report)
//      npx tsx script/validate-pipeline.ts --candles=8000 --capital=500 --risk=2

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { getAllStrategies } from "../server/strategies/registry";
import { simulateManagedExit } from "../server/trade-exits";
import { dropOpenCandle } from "../server/candles";
import { calcATRPercentile, type OHLCV } from "../server/analysis";
import {
  classifyBtcRegime,
  directionPolicyForRegime,
  defaultBtcContext,
  type BtcTrend,
} from "../server/btc-regime-gate";
import { isRollingDrawdownBreached, strategiesToPause } from "../server/portfolio-guards";
import type { Strategy } from "../server/strategies/types";

// ── Engine constants (mirrored from server/routes.ts) ─────────────────────
const MIN_SL_DISTANCE_PCT = 0.006;
const MIN_RR = 1.5;
const ATR_PERCENTILE_MAX = 85;
const SHORT_MIN_CONFIDENCE = 72;
const CONTRA_TREND_MIN_CONFIDENCE = 75;
const CONTRA_TREND_MIN_SCORE = 6;
const MAX_PER_GROUP = 3; // raised with the 43-coin LS universe (Jul 2026) — see routes.ts
// Raised 6 → 10 in the Jul 2026 capacity A/B (+55R, lower maxDD; 12 = saturation).
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

// ── CLI ────────────────────────────────────────────────────────────────────
const argv = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const TOTAL_CANDLES = parseInt(argv.candles ?? "8000");
const START_CAPITAL = parseFloat(argv.capital ?? "500");
const BASE_RISK_PCT = parseFloat(argv.risk ?? "2");
const YEAR_2026_TS = Date.UTC(2026, 0, 1) / 1000;

// ── Toggleable gates ───────────────────────────────────────────────────────
type GateId =
  | "dirOverlay"   // BTC directional overlay (blocks longs in risk_off etc.)
  | "dailyTrend"   // per-symbol contra-daily-trend confidence filter
  | "weeklyTrend"  // 4h strategies must align with weekly trend
  | "shortConf"    // SHORT needs ≥72% confidence
  | "atrPct"       // skip entries when ATR percentile > 85
  | "btcCap"       // BTC regime concurrent-position cap (off → fixed 6)
  | "groupCap"     // max 2 open per correlation group
  | "killSwitch"   // per-strategy -3R/7d pause
  | "ddDaily"      // -4R daily portfolio pause
  | "ddMonthly"    // -8R monthly portfolio pause
  | "ddRolling"    // -6R rolling-7d portfolio pause
  | "kelly"        // fractional-Kelly sizing (off → base risk %)
  | "riskMult";    // BTC daily-trend risk multiplier 0.75x/1.25x

const ALL_GATES: GateId[] = [
  "dirOverlay", "dailyTrend", "weeklyTrend", "shortConf", "atrPct",
  "btcCap", "groupCap", "killSwitch", "ddDaily", "ddMonthly", "ddRolling", "kelly", "riskMult",
];

interface RunConfig {
  label: string;
  skip: Set<GateId>;
  strategies?: string[]; // undefined → all active
  maxOpen?: number;               // override fixed cap (default 6)
  perSymbolCap?: number;          // concurrent positions per symbol, different strategies only (default 1)
  cooldownOverride?: Record<string, number>; // strategyId → hours
  maxPerGroup?: number;           // correlation-group cap override (default 2)
}

// ── Candle fetching with day-keyed disk cache ─────────────────────────────
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

// ── Trend helpers (mirror getDailyTrend / getWeeklyTrend in routes.ts) ────
function emaSeeded(closes: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

type Trend = "up" | "down" | "neutral";

// Daily: EMA50 over the last 55 CLOSED daily candles; ±1% band.
function dailyTrendAt(daily: OHLCV[], nowSec: number): Trend {
  // a 1d candle with open time T is closed when T + 86400 <= now
  let end = daily.length;
  while (end > 0 && daily[end - 1].time + 86_400 > nowSec) end--;
  if (end < 52) return "neutral";
  const closes = daily.slice(Math.max(0, end - 55), end).map(c => c.close);
  const ema = emaSeeded(closes, 50);
  const dist = (closes[closes.length - 1] - ema) / ema;
  return dist > 0.01 ? "up" : dist < -0.01 ? "down" : "neutral";
}

// Weekly: EMA20 over the last 26 CLOSED weekly candles; ±2% band.
function weeklyTrendAt(weekly: OHLCV[], nowSec: number): Trend {
  let end = weekly.length;
  while (end > 0 && weekly[end - 1].time + 7 * 86_400 > nowSec) end--;
  if (end < 20) return "neutral";
  const closes = weekly.slice(Math.max(0, end - 26), end).map(c => c.close);
  const ema = emaSeeded(closes, 20);
  const dist = (closes[closes.length - 1] - ema) / ema;
  return dist > 0.02 ? "up" : dist < -0.02 ? "down" : "neutral";
}

// ── Phase A: state-independent signal candidates per (strategy, symbol) ───
interface Candidate {
  stratId: string;
  interval: string;
  symbol: string;
  tsSec: number;          // decision time = candle close time (candle.time + interval)
  dir: "LONG" | "SHORT";
  entry: number;
  confidence: number;
  confluenceScore: number;
  slDistPct: number;
  atrPercentile: number;
  netR: number;           // from simulateManagedExit (default exit config = engine default)
  exitTsSec: number;      // when the position frees its slot
  outcome: string;
}

function intervalSec(iv: string): number {
  if (iv === "1h") return 3600;
  if (iv === "4h") return 4 * 3600;
  if (iv === "1d") return 24 * 3600;
  return 3600;
}
function intervalHours(iv: string): number { return intervalSec(iv) / 3600; }

function buildCandidates(strat: Strategy, symbol: string, candles: OHLCV[]): Candidate[] {
  const out: Candidate[] = [];
  const window = Math.max(strat.minCandles, 60);
  const maxBars = strat.interval === "4h" ? 60 : 200; // parity with validate-2026 + route backtests
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
    if (slDistPct < MIN_SL_DISTANCE_PCT) continue;       // engine gate (not toggleable)
    if (risk <= 0 || reward / risk < MIN_RR) continue;   // engine gate (not toggleable)

    const exit = simulateManagedExit(
      { direction: sig.direction, entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2 },
      candles.slice(i + 1, i + 1 + maxBars),
    );

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
      netR: exit.netR,
      exitTsSec: candles[i].time + ivSec + exit.barsHeld * ivSec,
      outcome: exit.outcome,
    });
  }
  return out;
}

// ── Phase B: chronological portfolio simulation ────────────────────────────
interface SimTrade {
  symbol: string; strategy: string; dir: "LONG" | "SHORT";
  netR: number; riskUsd: number; pnlUsd: number;
  openedSec: number; closedSec: number;
}

interface GateCounters { [k: string]: number }

interface SimResult {
  label: string;
  trades: SimTrade[];
  finalBalance: number;
  maxDrawdownPct: number;
  gateBlocks: GateCounters;
}

interface MarketData {
  btcDaily: OHLCV[];
  btcWeekly: OHLCV[];
  dailyBySym: Map<string, OHLCV[]>;
  weeklyBySym: Map<string, OHLCV[]>;
}

function simulate(cfg: RunConfig, candidates: Candidate[], md: MarketData, strategies: Strategy[]): SimResult {
  const skip = cfg.skip;
  const active = new Set((cfg.strategies ?? strategies.map(s => s.id)));
  const cands = candidates
    .filter(c => active.has(c.stratId))
    .sort((a, b) => a.tsSec - b.tsSec || a.symbol.localeCompare(b.symbol));

  const perSymbolCap = cfg.perSymbolCap ?? 1;
  const cooldownH = new Map(strategies.map(s => [s.id, cfg.cooldownOverride?.[s.id] ?? s.cooldownHours ?? 0]));

  let balance = START_CAPITAL;
  let peakBalance = START_CAPITAL;
  let maxDD = 0;
  interface OpenPos { strategy: string; group?: string; exitTsSec: number; trade: SimTrade }
  const openBySymbol = new Map<string, OpenPos[]>();
  const totalOpenCount = () => { let n = 0; for (const v of openBySymbol.values()) n += v.length; return n; };
  const lastClosedAt = new Map<string, number>(); // sym:strat → closed ms
  const closedLog: Array<{ strategy: string; closed_at: string; pnl_usd: number; risk_usd: number; outcome: string }> = [];
  const trades: SimTrade[] = [];
  const blocks: GateCounters = {};
  const block = (k: string) => { blocks[k] = (blocks[k] ?? 0) + 1; };

  // trend caches keyed by UTC day / week bucket
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

    // ── exposure: cap positions per symbol; same (symbol,strategy) never doubles ──
    const symPositions = openBySymbol.get(c.symbol) ?? [];
    if (symPositions.length >= perSymbolCap) { block("exposure"); continue; }
    if (symPositions.some(p => p.strategy === c.stratId)) { block("exposure"); continue; }

    // ── cooldown per (symbol, strategy) ──
    const cd = cooldownH.get(c.stratId) ?? 0;
    if (cd > 0) {
      const last = lastClosedAt.get(`${c.symbol}:${c.stratId}`);
      if (last && (nowMs - last) / 3_600_000 < cd) { block("cooldown"); continue; }
    }

    // ── portfolio drawdown guards (mirror paperScan order) ──
    const oneR = balance * BASE_RISK_PCT / 100;
    if (!skip.has("ddDaily")) {
      const dayStart = new Date(nowMs); dayStart.setUTCHours(0, 0, 0, 0);
      const dayPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= dayStart.getTime() ? s + e.pnl_usd : s, 0);
      if (dayPnl < -4 * oneR) { block("ddDaily"); continue; }
    }
    if (!skip.has("ddMonthly")) {
      const monStart = new Date(nowMs); monStart.setUTCDate(1); monStart.setUTCHours(0, 0, 0, 0);
      const monPnl = closedLog.reduce((s, e) => new Date(e.closed_at).getTime() >= monStart.getTime() ? s + e.pnl_usd : s, 0);
      if (monPnl < -8 * oneR) { block("ddMonthly"); continue; }
    }
    if (!skip.has("ddRolling")) {
      if (isRollingDrawdownBreached(closedLog, oneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R, now: nowMs })) {
        block("ddRolling7d"); continue;
      }
    }

    // ── BTC regime: risk multiplier, position cap, directional overlay ──
    const btcDailyTrend = dTrend("BTC", nowSec) as BtcTrend;
    let riskMultiplier = 1.0;
    if (!skip.has("riskMult")) {
      if (btcDailyTrend === "up") riskMultiplier = 1.25;
      else if (btcDailyTrend === "down") riskMultiplier = 0.75;
    }
    const btcContext = (() => {
      try {
        return classifyBtcRegime({ daily: btcDailyTrend, weekly: wTrend("BTC", nowSec) as BtcTrend });
      } catch { return defaultBtcContext(); }
    })();
    const fixedCap = cfg.maxOpen ?? FIXED_MAX_OPEN;
    const effectiveMaxOpen = skip.has("btcCap") ? fixedCap : btcContext.maxOpen;
    const dirPolicy = skip.has("dirOverlay")
      ? { long: true, short: true, sizeMultiplier: 1.0, reason: "overlay skipped" }
      : directionPolicyForRegime(btcContext.regime);

    if (totalOpenCount() >= effectiveMaxOpen) { block("maxOpen"); continue; }

    // ── correlation group cap ──
    const group = COIN_GROUP[c.symbol];
    if (!skip.has("groupCap") && group) {
      let inGroup = 0;
      for (const list of openBySymbol.values()) for (const pos of list) if (pos.group === group) inGroup++;
      if (inGroup >= (cfg.maxPerGroup ?? MAX_PER_GROUP)) { block("groupCap"); continue; }
    }

    // ── per-strategy kill-switch ──
    if (!skip.has("killSwitch")) {
      const paused = strategiesToPause(closedLog, [c.stratId], {
        windowMs: ROLLING_WINDOW_MS, minTrades: KILL_SWITCH_MIN_TRADES, maxNetR: KILL_SWITCH_MAX_NET_R, now: nowMs,
      });
      if (paused.has(c.stratId)) { block("killSwitch"); continue; }
    }

    // ── ATR percentile (volatility regime) ──
    if (!skip.has("atrPct") && c.atrPercentile > ATR_PERCENTILE_MAX) { block("atrPct"); continue; }

    // ── directional overlay ──
    if ((c.dir === "LONG" && !dirPolicy.long) || (c.dir === "SHORT" && !dirPolicy.short)) {
      block("dirOverlay"); continue;
    }

    // ── daily trend contra filter ──
    if (!skip.has("dailyTrend")) {
      const dt = dTrend(c.symbol, nowSec);
      const contra = (c.dir === "LONG" && dt === "down") || (c.dir === "SHORT" && dt === "up");
      if (contra) {
        if (c.stratId === "confluence-swing" && Math.abs(c.confluenceScore) < CONTRA_TREND_MIN_SCORE) { block("dailyTrend"); continue; }
        if (c.stratId !== "confluence-swing" && c.confidence < CONTRA_TREND_MIN_CONFIDENCE) { block("dailyTrend"); continue; }
      }
    }

    // ── weekly alignment for 4h strategies ──
    if (!skip.has("weeklyTrend") && c.interval === "4h") {
      const wt = wTrend(c.symbol, nowSec);
      if ((c.dir === "LONG" && wt === "down") || (c.dir === "SHORT" && wt === "up")) { block("weeklyTrend"); continue; }
    }

    // ── SHORT confidence gate ──
    if (!skip.has("shortConf") && c.dir === "SHORT" && c.confidence < SHORT_MIN_CONFIDENCE) {
      block("shortConf"); continue;
    }

    // ── sizing: fractional Kelly per strategy (≥10 closed trades) ──
    let pct = BASE_RISK_PCT;
    if (!skip.has("kelly")) {
      const closed = closedLog.filter(e => e.strategy === c.stratId);
      if (closed.length >= 10) {
        const wins = closed.filter(e => e.outcome === "win");
        const losses = closed.filter(e => e.outcome !== "win");
        const winRate = wins.length / closed.length;
        const lossRate = losses.length / closed.length;
        const avgWinR = wins.length ? wins.reduce((s, e) => s + Math.abs(e.pnl_usd) / e.risk_usd, 0) / wins.length : 2.0;
        const avgLossR = losses.length ? losses.reduce((s, e) => s + Math.abs(e.pnl_usd) / e.risk_usd, 0) / losses.length : 1.0;
        const rr = avgLossR > 0 ? avgWinR / avgLossR : avgWinR;
        const halfKelly = (winRate - lossRate / Math.max(rr, 0.5)) * 0.5;
        pct = Math.min(Math.max(halfKelly * 100, 0.5), BASE_RISK_PCT * 2);
      }
    }
    const kellyPct = pct * riskMultiplier * dirPolicy.sizeMultiplier;
    const riskUsd = balance * kellyPct / 100;
    if (riskUsd <= 0) { block("zeroRisk"); continue; }

    const trade: SimTrade = {
      symbol: c.symbol, strategy: c.stratId, dir: c.dir,
      netR: c.netR, riskUsd, pnlUsd: c.netR * riskUsd,
      openedSec: nowSec, closedSec: c.exitTsSec,
    };
    const list = openBySymbol.get(c.symbol) ?? [];
    list.push({ strategy: c.stratId, group, exitTsSec: c.exitTsSec, trade });
    openBySymbol.set(c.symbol, list);
  }

  // flush remaining opens
  closeDue(Number.MAX_SAFE_INTEGER);
  trades.sort((a, b) => a.closedSec - b.closedSec);

  return { label: cfg.label, trades, finalBalance: balance, maxDrawdownPct: maxDD * 100, gateBlocks: blocks };
}

// ── Metrics / report ───────────────────────────────────────────────────────
function stats(trades: SimTrade[], sinceSec = 0) {
  const t = trades.filter(x => x.openedSec >= sinceSec);
  const n = t.length;
  const wins = t.filter(x => x.netR >= 0).length;
  const sumR = t.reduce((s, x) => s + x.netR, 0);
  const gw = t.reduce((s, x) => s + (x.netR >= 0 ? x.netR : 0), 0);
  const gl = t.reduce((s, x) => s + (x.netR < 0 ? -x.netR : 0), 0);
  const pnl = t.reduce((s, x) => s + x.pnlUsd, 0);
  return {
    n, wr: n ? (wins / n) * 100 : 0,
    pf: gl > 0 ? gw / gl : gw > 0 ? Infinity : 0,
    sumR, exp: n ? sumR / n : 0, pnl,
  };
}

function fmtStats(s: ReturnType<typeof stats>): string {
  const pf = s.pf === Infinity ? "∞" : s.pf.toFixed(2);
  return `T=${String(s.n).padStart(4)} WR=${s.wr.toFixed(0).padStart(3)}% PF=${pf.padStart(5)} sumR=${(s.sumR >= 0 ? "+" : "") + s.sumR.toFixed(1)} exp=${(s.exp >= 0 ? "+" : "") + s.exp.toFixed(2)}R pnl=$${s.pnl.toFixed(0)}`;
}

async function main() {
  const strategies = getAllStrategies();
  const lines: string[] = [];
  const log = (s = "") => { console.log(s); lines.push(s); };

  log(`# Full-Pipeline Portfolio Validation — ${new Date().toISOString().slice(0, 10)}`);
  log(`Capital $${START_CAPITAL} · base risk ${BASE_RISK_PCT}% · candles ${TOTAL_CANDLES} · gates mirror server/routes.ts paperScan`);
  log(`Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.`);
  log();

  // ── data ──
  const streams = new Map<string, OHLCV[]>(); // sym:interval → candles
  const symbols = new Set<string>();
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      symbols.add(sym);
      const key = `${sym}:${strat.interval}`;
      if (!streams.has(key)) {
        process.stdout.write(`  fetching ${key}...\r`);
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

  // ── Phase A: candidates ──
  console.log("\nbuilding signal candidates...");
  const candidates: Candidate[] = [];
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      const candles = streams.get(`${sym}:${strat.interval}`);
      if (!candles) continue;
      const t0 = Date.now();
      const c = buildCandidates(strat, sym, candles);
      candidates.push(...c);
      console.log(`  ${strat.id.padEnd(18)} ${sym.padEnd(6)} candidates=${String(c.length).padStart(4)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  }
  log(`Total raw candidates (post minSL+R:R): ${candidates.length}`);
  log();

  // ── Phase B: suite ──
  const ALL_OFF: GateId[] = ["dirOverlay", "dailyTrend", "weeklyTrend", "shortConf", "atrPct", "btcCap", "groupCap", "killSwitch", "ddDaily", "ddMonthly", "ddRolling", "kelly", "riskMult"];
  const PROPOSED_SKIP = new Set<GateId>(["atrPct", "shortConf", "dailyTrend", "dirOverlay", "btcCap", "groupCap", "ddMonthly", "ddRolling"]);
  // ENGINE-CURRENT = server/routes.ts as of 2026-07-02 (PROPOSED-F + capacity round):
  //   registry = LS + RSI + B&R (confluence-swing cut);
  //   removed from engine: atrPct, shortConf, dailyTrend, dirOverlay,
  //     dynamic btcCap (→ fixed 10), ddMonthly, kelly (→ fixed base risk %);
  //   kept in engine: weeklyTrend, riskMult, groupCap, killSwitch, ddDaily,
  //     ddRolling, exposure (1/symbol), cooldown, minSL, R:R
  //     (+ live-only volume/spread/funding + max-hold timeout 200h/240h).
  const ENGINE_CURRENT_SKIP = new Set<GateId>(["atrPct", "shortConf", "dailyTrend", "dirOverlay", "btcCap", "ddMonthly", "kelly"]);
  const configs: RunConfig[] = [
    { label: "ENGINE-CURRENT (shipped Jul 2026 = PROPOSED-F)", skip: ENGINE_CURRENT_SKIP },
    // ── capacity suite (Jul 2026 round 2): structural throughput, not signal tuning ──
    { label: "CAP maxOpen=8", skip: ENGINE_CURRENT_SKIP, maxOpen: 8 },
    { label: "CAP maxOpen=10", skip: ENGINE_CURRENT_SKIP, maxOpen: 10 },
    { label: "CAP perSymbol=2", skip: ENGINE_CURRENT_SKIP, perSymbolCap: 2 },
    { label: "CAP maxOpen=8 + perSymbol=2", skip: ENGINE_CURRENT_SKIP, maxOpen: 8, perSymbolCap: 2 },
    { label: "CAP LS cooldown 8h", skip: ENGINE_CURRENT_SKIP, cooldownOverride: { "liquidity-sweep": 8 } },
    { label: "CAP LS cooldown 6h", skip: ENGINE_CURRENT_SKIP, cooldownOverride: { "liquidity-sweep": 6 } },
    { label: "CAP combo (mo8+ps2+LScd8)", skip: ENGINE_CURRENT_SKIP, maxOpen: 8, perSymbolCap: 2, cooldownOverride: { "liquidity-sweep": 8 } },
    { label: "CAP maxOpen=10 + perSymbol=2", skip: ENGINE_CURRENT_SKIP, maxOpen: 10, perSymbolCap: 2 },
    { label: "CAP maxOpen=12", skip: ENGINE_CURRENT_SKIP, maxOpen: 12 },
    { label: "CAP groupCap=2 (pre-expansion default)", skip: ENGINE_CURRENT_SKIP, maxPerGroup: 2 },
    { label: "CAP groupCap=3 + maxOpen=12", skip: ENGINE_CURRENT_SKIP, maxPerGroup: 3, maxOpen: 12 },
    { label: "BASELINE (all gates)", skip: new Set() },
    ...ALL_GATES.map(g => ({ label: `minus ${g}`, skip: new Set<GateId>([g]) })),
    { label: "LEAN (only exposure+cooldown+maxOpen6, opinion filters off)", skip: new Set<GateId>(ALL_OFF) },
    { label: "LS-only BASELINE", skip: new Set<GateId>(), strategies: ["liquidity-sweep"] },
    { label: "LS-only LEAN", skip: new Set<GateId>(ALL_OFF), strategies: ["liquidity-sweep"] },
    { label: "LS+RSI LEAN", skip: new Set<GateId>(ALL_OFF), strategies: ["liquidity-sweep", "rsi-divergence"] },
    { label: "PROPOSED-A (LS+RSI+BR, pruned gates)", skip: PROPOSED_SKIP, strategies: ["liquidity-sweep", "rsi-divergence", "break-retest"] },
    { label: "PROPOSED-B (LS+RSI, pruned gates)", skip: PROPOSED_SKIP, strategies: ["liquidity-sweep", "rsi-divergence"] },
    { label: "PROPOSED-C (= A + groupCap kept)", skip: new Set<GateId>([...PROPOSED_SKIP].filter(g => g !== "groupCap") as GateId[]), strategies: ["liquidity-sweep", "rsi-divergence", "break-retest"] },
    { label: "PROPOSED-D (= A + ddRolling kept)", skip: new Set<GateId>([...PROPOSED_SKIP].filter(g => g !== "ddRolling") as GateId[]), strategies: ["liquidity-sweep", "rsi-divergence", "break-retest"] },
    { label: "PROPOSED-E (= D + groupCap kept)", skip: new Set<GateId>([...PROPOSED_SKIP].filter(g => g !== "ddRolling" && g !== "groupCap") as GateId[]), strategies: ["liquidity-sweep", "rsi-divergence", "break-retest"] },
    { label: "PROPOSED-F (= E without kelly)", skip: new Set<GateId>([...[...PROPOSED_SKIP].filter(g => g !== "ddRolling" && g !== "groupCap"), "kelly"] as GateId[]), strategies: ["liquidity-sweep", "rsi-divergence", "break-retest"] },
  ];

  const results: SimResult[] = [];
  for (const cfg of configs) {
    const r = simulate(cfg, candidates, md, strategies);
    results.push(r);
    const all = stats(r.trades);
    const y26 = stats(r.trades, YEAR_2026_TS);
    log(`## ${cfg.label}`);
    log(`  ALL:  ${fmtStats(all)}  → balance $${r.finalBalance.toFixed(0)} maxDD ${r.maxDrawdownPct.toFixed(1)}%`);
    log(`  2026: ${fmtStats(y26)}`);
    const blocked = Object.entries(r.gateBlocks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(" ");
    log(`  blocks: ${blocked || "none"}`);
    log();
  }

  // ── per-strategy breakdown (ALL + 2026) for key configs ──
  const breakdownLabels = results.map(r => r.label).filter(l =>
    l.startsWith("ENGINE") || l.startsWith("BASELINE") || l.startsWith("LEAN") || l.startsWith("PROPOSED"));
  for (const label of breakdownLabels) {
    const r = results.find(x => x.label === label)!;
    log(`## Per-strategy — ${label}`);
    for (const strat of strategies) {
      const t = r.trades.filter(x => x.strategy === strat.id);
      if (!t.length) continue;
      log(`  ${strat.id.padEnd(18)} ALL:  ${fmtStats(stats(t))}`);
      log(`  ${"".padEnd(18)} 2026: ${fmtStats(stats(t, YEAR_2026_TS))}`);
    }
    log();
  }
  log(`NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —`);
  log(`they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).`);
  log(`4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.`);

  // ── monthly P&L for the shipped engine config ──
  const base = results[0];
  log(`## Monthly P&L — ${base.label}`);
  const byMonth = new Map<string, number>();
  for (const t of base.trades) {
    const m = new Date(t.closedSec * 1000).toISOString().slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + t.pnlUsd);
  }
  for (const [m, pnl] of Array.from(byMonth.entries()).sort()) {
    log(`  ${m}  ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`);
  }

  const out = "script/validate-pipeline-report.md";
  writeFileSync(out, lines.join("\n"));
  console.log(`\n[report written to ${out}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
