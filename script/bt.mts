// ─────────────────────────────────────────────────────────────────────────
// Offline backtest harness — fast, cached, for validating signal/core changes.
//
// Mirrors the 5 HTTP backtest endpoints in server/routes.ts (same WINDOW /
// FORWARD / COOLDOWN / tp1ClosePct / zone-cooldown / confidence gates) but
// runs offline against disk-cached Binance klines so iteration is instant and
// re-fetch-free. Imports the live signal functions directly, so any change to
// server/analysis.ts is reflected here.
//
// Usage:
//   node --import tsx script/bt.mts <strategy> <SYM1,SYM2,...|preset> [flags]
//   strategy: swing | smc | br | rsi | liq
//   flags:    --regime       apply ADX regime gate (isStrategyAllowedInRegime)
//             --shortmacro    require macroDown for SHORTs (SMC/B&R/LiqSweep)
//             --regwin=N      bars fed to detectRegime (default = strategy WINDOW)
//             --refresh       ignore cache, re-fetch candles
// ─────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeIndicators, generateSignal, smcSignal, breakRetestSignal,
  rsiDivergenceSignal, liquiditySweepSignal, type OHLCV,
} from "../server/analysis.ts";
import { simulateManagedExit } from "../server/trade-exits.ts";
import { isConfluenceBacktestEligible, confluenceBacktestDirection } from "../server/confluence-backtest.ts";
import { detectRegime, isStrategyAllowedInRegime, shouldRequireMacroDownForShort } from "../server/regime-detector.ts";
import { classifyBtcRegime, directionPolicyForRegime, type BtcTrend } from "../server/btc-regime-gate.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Long history: Binance has multi-year klines (MEXC perps are younger, so Binance
// is the better source for deep backtests; live execution stays on MEXC). 1h gets
// ~3y, 4h ~3.6y. Override per run with --bars=N.
const BARS_BY_INTERVAL: Record<string, number> = { "1h": 26000, "4h": 8000, "1d": 2200, "1w": 400 };

const BINANCE = "https://api.binance.com/api/v3";
const OVERRIDES: Record<string, string> = { MATIC: "MATICUSDT" };
const pairFor = (s: string) => OVERRIDES[s.toUpperCase()] ?? `${s.toUpperCase()}USDT`;

async function fetchJSON(url: string, retries = 3): Promise<any> {
  let lastErr: unknown;
  for (let a = 0; a <= retries; a++) {
    try {
      const res = await fetch(url);
      if (!res.ok) { if (res.status >= 500 || res.status === 429) { lastErr = new Error(`${res.status}`); await sleep(800 * (a + 1)); continue; } throw new Error(`HTTP ${res.status} ${url}`); }
      return await res.json();
    } catch (e) { lastErr = e; await sleep(500 * (a + 1)); }
  }
  throw lastErr;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchKlinesPaginated(sym: string, interval: string, total: number): Promise<OHLCV[]> {
  const pair = pairFor(sym);
  const out: OHLCV[] = [];
  let endTime: number | undefined;
  const batch = 1000;
  const batches = Math.ceil((total + 1) / batch);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${pair}&interval=${interval}&limit=${batch}` + (endTime ? `&endTime=${endTime}` : "");
    const data: any[][] = await fetchJSON(`${BINANCE}/klines?${qs}`);
    if (!Array.isArray(data) || data.length === 0) break;
    const part: OHLCV[] = data.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
    out.unshift(...part);
    if (data.length < batch) break;
    endTime = data[0][0] - 1;
  }
  return out.slice(0, -1).slice(-total); // drop the in-progress last candle
}

async function getCandles(sym: string, interval: string, total: number, refresh: boolean): Promise<OHLCV[]> {
  const f = path.join(CACHE_DIR, `${sym.toUpperCase()}_${interval}_${total}.json`);
  if (!refresh && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const c = await fetchKlinesPaginated(sym, interval, total);
  fs.writeFileSync(f, JSON.stringify(c));
  return c;
}

// ── Normalized signal ──
type NSig = { dir: "LONG" | "SHORT"; entry: number; sl: number; tp1: number; tp2: number; conf: number; zoneLvl?: number; score?: number } | null;

interface StratCfg {
  id: string;
  interval: string;
  WINDOW: number;
  FORWARD: number;
  COOLDOWN: number;
  tp1ClosePct: number;
  zoneCooldown?: { bars: number; pct: number };
  sig: (w: OHLCV[]) => NSig;
}

const STRATS: Record<string, StratCfg> = {
  swing: {
    id: "confluence-swing", interval: "1h", WINDOW: 250, FORWARD: 200, COOLDOWN: 20, tp1ClosePct: 0.6,
    sig: (w) => { const ind = analyzeIndicators(w); const s = generateSignal(w, ind); if (!isConfluenceBacktestEligible(s) || !s.takeProfit2) return null; return { dir: confluenceBacktestDirection(s), entry: s.entry!, sl: s.stopLoss!, tp1: s.takeProfit1!, tp2: s.takeProfit2, conf: s.confidence, score: s.confluenceScore }; },
  },
  smc: {
    id: "smc", interval: "4h", WINDOW: 150, FORWARD: 15, COOLDOWN: 3, tp1ClosePct: 1, zoneCooldown: { bars: 20, pct: 0.008 },
    sig: (w) => { const s = smcSignal(w); if (s.type === "NONE" || s.confidence < 68) return null; return { dir: s.type, entry: s.entry, sl: s.stopLoss, tp1: s.takeProfit, tp2: s.takeProfit, conf: s.confidence, zoneLvl: s.obZone ? (s.obZone.high + s.obZone.low) / 2 : s.entry }; },
  },
  br: {
    id: "break-retest", interval: "4h", WINDOW: 150, FORWARD: 15, COOLDOWN: 3, tp1ClosePct: 1, zoneCooldown: { bars: 20, pct: 0.008 },
    sig: (w) => { const s = breakRetestSignal(w); if (s.type === "NONE" || s.confidence < 68) return null; return { dir: s.type, entry: s.entry, sl: s.stopLoss, tp1: s.takeProfit, tp2: s.takeProfit, conf: s.confidence, zoneLvl: s.level ?? s.entry }; },
  },
  rsi: {
    id: "rsi-divergence", interval: "1h", WINDOW: 250, FORWARD: 200, COOLDOWN: 20, tp1ClosePct: 0.6,
    sig: (w) => { const s = rsiDivergenceSignal(w); if (s.type === "NONE") return null; return { dir: s.type, entry: s.entry, sl: s.stopLoss, tp1: s.takeProfit, tp2: s.takeProfit2, conf: s.confidence }; },
  },
  liq: {
    id: "liquidity-sweep", interval: "1h", WINDOW: 220, FORWARD: 200, COOLDOWN: 12, tp1ClosePct: 0.6,
    sig: (w) => { const s = liquiditySweepSignal(w); if (s.type === "NONE") return null; return { dir: s.type, entry: s.entry, sl: s.stopLoss, tp1: s.takeProfit, tp2: s.takeProfit2, conf: s.confidence }; },
  },
  // "bb" (bollinger-mr) removed Aug 2026 with the retired strategy file —
  // recover both via git history if ever needed.
};

// ── BTC directional overlay (historical) ──
// Replicates getDailyTrend (1d EMA50 ±1%) + getWeeklyTrend (1w EMA20 ±2%) as-of
// a timestamp, then classifyBtcRegime → directionPolicyForRegime to gate the
// alt signal's direction. Lets us backtest the portfolio-level "trade with the
// BTC tide" overlay shipped in the previous turn.
function emaLastN(closes: number[], period: number): number {
  if (closes.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = closes[0];
  for (let i = 1; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
  return e;
}
function trendAsOf(candles: OHLCV[], t: number, take: number, period: number, thr: number): BtcTrend {
  const upTo = candles.filter(c => c.time <= t).slice(-take);
  if (upTo.length < take * 0.8) return "neutral";
  const closes = upTo.map(c => c.close);
  const e = emaLastN(closes, period);
  const dist = (closes[closes.length - 1] - e) / e;
  return dist > thr ? "up" : dist < -thr ? "down" : "neutral";
}

interface Opts { regimeGate: boolean; shortMacro: boolean; regWin: number; minSlPct: number; btcOverlay: boolean; btcSoft: boolean; minScore: number; minConf: number; bars: number; tp1Close: number; trail: string; slMult: number; tpMult: number }
interface Result { T: number; wins: number; grossProfit: number; grossLoss: number; sumR: number; filtered: number; floorTP1: number; rrSum: number }
interface BtcData { daily: OHLCV[]; weekly: OHLCV[] }

function runBacktest(cfg: StratCfg, candles: OHLCV[], opts: Opts, btc?: BtcData): Result {
  const { WINDOW, FORWARD, COOLDOWN } = cfg;
  let lastTradeIdx = -COOLDOWN;
  const zone = new Map<string, number>();
  const r: Result = { T: 0, wins: 0, grossProfit: 0, grossLoss: 0, sumR: 0, filtered: 0, floorTP1: 0, rrSum: 0 };
  const regWin = opts.regWin || WINDOW;

  for (let i = WINDOW; i < candles.length - FORWARD; i++) {
    if (i - lastTradeIdx < COOLDOWN) continue;
    const window = candles.slice(i - WINDOW, i + 1);
    const sig = cfg.sig(window);
    if (!sig) continue;

    // Optional SL/TP placement scaling (test if structural levels sit right)
    if (opts.slMult !== 1) sig.sl = sig.entry + (sig.sl - sig.entry) * opts.slMult;
    if (opts.tpMult !== 1) { sig.tp1 = sig.entry + (sig.tp1 - sig.entry) * opts.tpMult; sig.tp2 = sig.entry + (sig.tp2 - sig.entry) * opts.tpMult; }

    // Optional min confluence score (swing)
    if (opts.minScore > 0 && sig.score != null && Math.abs(sig.score) < opts.minScore) { r.filtered++; continue; }
    // Optional min confidence gate
    if (opts.minConf > 0 && sig.conf < opts.minConf) { r.filtered++; continue; }

    // Optional regime filters (test the always-on engine brain in backtest)
    if (opts.regimeGate || opts.shortMacro) {
      const regCandles = candles.slice(Math.max(0, i + 1 - regWin), i + 1);
      const reg = detectRegime(regCandles);
      if (opts.regimeGate && !isStrategyAllowedInRegime(cfg.id, reg.regime)) { r.filtered++; continue; }
      if (opts.shortMacro && sig.dir === "SHORT" && shouldRequireMacroDownForShort(cfg.id) && !reg.macroDown) { r.filtered++; continue; }
    }

    // Optional BTC directional overlay
    if (opts.btcOverlay && btc) {
      const t = candles[i].time;
      const daily = trendAsOf(btc.daily, t, 55, 50, 0.01);
      const weekly = trendAsOf(btc.weekly, t, 26, 20, 0.02);
      const regime = classifyBtcRegime({ daily, weekly }).regime;
      // Soft mode: only gate direction in high-conviction regimes (risk_on/risk_off);
      // let neutral/drift markets trade both ways.
      if (!opts.btcSoft || regime === "risk_on" || regime === "risk_off") {
        const dp = directionPolicyForRegime(regime);
        if ((sig.dir === "LONG" && !dp.long) || (sig.dir === "SHORT" && !dp.short)) { r.filtered++; continue; }
      }
    }

    // Optional min SL distance floor
    if (opts.minSlPct > 0) {
      const slDist = Math.abs(sig.entry - sig.sl) / sig.entry;
      if (slDist < opts.minSlPct) { r.filtered++; continue; }
    }

    // Zone cooldown (SMC / B&R)
    if (cfg.zoneCooldown) {
      const lvl = sig.zoneLvl ?? sig.entry;
      const key = Math.round(lvl / (lvl * cfg.zoneCooldown.pct)).toString() + "_" + sig.dir;
      const lastZ = zone.get(key) ?? -999;
      if (i - lastZ < cfg.zoneCooldown.bars) continue;
      zone.set(key, i);
    }

    // Diagnostic: is TP1 a structural swing or the fixed 2R quality floor?
    const riskAbs0 = Math.abs(sig.entry - sig.sl);
    const rew1 = Math.abs(sig.tp1 - sig.entry);
    const floorR = Math.max(2 * riskAbs0, sig.entry * 0.01);
    if (Math.abs(rew1 - floorR) < 0.05 * riskAbs0) r.floorTP1++;
    r.rrSum += riskAbs0 > 0 ? rew1 / riskAbs0 : 0;

    lastTradeIdx = i;
    const future = candles.slice(i + 1, i + 1 + FORWARD);
    const trailMode = opts.trail.startsWith("r") ? "r_multiple" as const : "fixed_pct" as const;
    const trailR = trailMode === "r_multiple" ? Number(opts.trail.slice(1)) || 2 : undefined;
    const exit = simulateManagedExit(
      { direction: sig.dir, entry: sig.entry, stopLoss: sig.sl, takeProfit1: sig.tp1, takeProfit2: sig.tp2 },
      future,
      { tp1ClosePct: opts.tp1Close > 0 ? opts.tp1Close : cfg.tp1ClosePct, trailMode, trailRMultiple: trailR },
    );
    const pnl = exit.netPnlPct;
    r.T++;
    r.sumR += exit.netR;
    if (pnl >= 0) { r.wins++; r.grossProfit += pnl; } else { r.grossLoss += Math.abs(pnl); }
  }
  return r;
}

const PRESETS: Record<string, string[]> = {
  swing: ["DOGE", "AVAX", "XRP", "ICP", "ETH", "BNB"],
  smc: ["DOGE", "AAVE", "ATOM"],
  br: ["SOL", "SAND", "BNB"],
  rsi: ["BCH", "ATOM", "INJ"],
  liq: ["UNI", "ICP", "AAVE", "INJ", "BCH", "FIL", "LTC", "AVAX", "SOL", "LINK"],
  bb: ["BTC", "ETH", "SOL", "BNB", "DOGE"],
};

function pct(n: number) { return (n * 100).toFixed(1); }
function pf(gp: number, gl: number) { return gl > 0 ? gp / gl : (gp > 0 ? 999 : 0); }

async function main() {
  const args = process.argv.slice(2);
  const stratKey = args[0];
  const cfg = STRATS[stratKey];
  if (!cfg) { console.error(`Unknown strategy "${stratKey}". Use: ${Object.keys(STRATS).join(", ")}`); process.exit(1); }
  const symArg = args[1] && !args[1].startsWith("--") ? args[1] : "";
  const symbols = symArg ? (symArg === "preset" ? PRESETS[stratKey] : symArg.split(",").map(s => s.trim().toUpperCase())) : PRESETS[stratKey];
  const flags = args.filter(a => a.startsWith("--"));
  const opts: Opts = {
    regimeGate: flags.includes("--regime"),
    shortMacro: flags.includes("--shortmacro"),
    regWin: Number(flags.find(f => f.startsWith("--regwin="))?.split("=")[1] || 0),
    minSlPct: Number(flags.find(f => f.startsWith("--minsl="))?.split("=")[1] || 0),
    btcOverlay: flags.includes("--btcoverlay") || flags.includes("--btcsoft"),
    btcSoft: flags.includes("--btcsoft"),
    minScore: Number(flags.find(f => f.startsWith("--minscore="))?.split("=")[1] || 0),
    minConf: Number(flags.find(f => f.startsWith("--minconf="))?.split("=")[1] || 0),
    bars: Number(flags.find(f => f.startsWith("--bars="))?.split("=")[1] || 0),
    tp1Close: Number(flags.find(f => f.startsWith("--tp1close="))?.split("=")[1] || 0),
    trail: flags.find(f => f.startsWith("--trail="))?.split("=")[1] || "fixed",
    slMult: Number(flags.find(f => f.startsWith("--slmult="))?.split("=")[1] || 1),
    tpMult: Number(flags.find(f => f.startsWith("--tpmult="))?.split("=")[1] || 1),
  };
  const refresh = flags.includes("--refresh");
  const bars = opts.bars || BARS_BY_INTERVAL[cfg.interval] || 8000;

  let btc: BtcData | undefined;
  if (opts.btcOverlay) {
    btc = {
      daily: await getCandles("BTC", "1d", BARS_BY_INTERVAL["1d"], refresh),
      weekly: await getCandles("BTC", "1w", BARS_BY_INTERVAL["1w"], refresh),
    };
  }

  const label = `${cfg.id} [${cfg.interval}] bars=${bars} trail=${opts.trail} tp1=${opts.tp1Close || cfg.tp1ClosePct}` + (opts.regimeGate ? " +regime" : "") + (opts.shortMacro ? " +shortmacro" : "") + (opts.btcSoft ? " +btcsoft" : opts.btcOverlay ? " +btcoverlay" : "") + (opts.minScore ? ` minscore=${opts.minScore}` : "") + (opts.regWin ? ` regwin=${opts.regWin}` : "") + (opts.minSlPct ? ` minsl=${pct(opts.minSlPct)}%` : "");
  console.log(`\n═══ ${label} ═══`);
  console.log(`sym       T    WR%    PF    sumR  avgRR  floor%(TP1=2R fallback)`);

  const agg: Result = { T: 0, wins: 0, grossProfit: 0, grossLoss: 0, sumR: 0, filtered: 0, floorTP1: 0, rrSum: 0 };
  for (const sym of symbols) {
    try {
      const candles = await getCandles(sym, cfg.interval, bars, refresh);
      const r = runBacktest(cfg, candles, opts, btc);
      agg.T += r.T; agg.wins += r.wins; agg.grossProfit += r.grossProfit; agg.grossLoss += r.grossLoss; agg.sumR += r.sumR; agg.filtered += r.filtered; agg.floorTP1 += r.floorTP1; agg.rrSum += r.rrSum;
      const wr = r.T > 0 ? r.wins / r.T : 0;
      const floorPct = r.T > 0 ? (r.floorTP1 / r.T) * 100 : 0;
      const avgRR = r.T > 0 ? r.rrSum / r.T : 0;
      console.log(`${sym.padEnd(8)} ${String(r.T).padStart(4)}  ${pct(wr).padStart(5)}  ${pf(r.grossProfit, r.grossLoss).toFixed(2).padStart(5)}  ${r.sumR.toFixed(1).padStart(6)}  ${avgRR.toFixed(2).padStart(5)}  ${floorPct.toFixed(0).padStart(5)}%`);
    } catch (e: any) {
      console.log(`${sym.padEnd(8)} ERR ${e?.message ?? e}`);
    }
  }
  const wr = agg.T > 0 ? agg.wins / agg.T : 0;
  const aggFloor = agg.T > 0 ? (agg.floorTP1 / agg.T) * 100 : 0;
  const aggRR = agg.T > 0 ? agg.rrSum / agg.T : 0;
  console.log(`${"─".repeat(52)}`);
  console.log(`POOLED   ${String(agg.T).padStart(4)}  ${pct(wr).padStart(5)}  ${pf(agg.grossProfit, agg.grossLoss).toFixed(2).padStart(5)}  ${agg.sumR.toFixed(1).padStart(6)}  ${aggRR.toFixed(2).padStart(5)}  ${aggFloor.toFixed(0).padStart(5)}%`);
}

main();
