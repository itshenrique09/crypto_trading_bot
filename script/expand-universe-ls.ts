// ─── LIQUIDITY SWEEP UNIVERSE SCREEN — two-halves consistency ─────────────
// Purpose: add trade FREQUENCY to the validated workhorse without repeating the
// selection-bias mistake (picking coins on the same recent window used to
// "validate" them — see the frozen validate-universe.ts header).
//
// Methodology difference vs the old scan:
//   • full 8000×1h window (~1y), not the 2026 slice
//   • a coin only passes if it is profitable in BOTH halves of the window
//     independently (H1 AND H2 sumR > 0) — a crude but honest robustness split
//   • plus overall floor: T ≥ 30 and PF ≥ 1.5
//   • final acceptance is NOT this script: survivors go into the full-pipeline
//     harness (validate-pipeline.ts) and are only kept if the PORTFOLIO improves.
//
// Run: npx tsx script/expand-universe-ls.ts

import { liquiditySweepStrategy } from "../server/strategies/liquidity-sweep";
import { simulateManagedExit } from "../server/trade-exits";
import { dropOpenCandle } from "../server/candles";
import type { OHLCV } from "../server/analysis";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const CACHE_DIR = "script/.cache";
const DAY_KEY = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const TOTAL_CANDLES = 8000;
const MIN_SL_DISTANCE_PCT = 0.006;
const MIN_RR = 1.5;
const MIN_TRADES = 30;
const MIN_PF = 1.5;

// Candidates: liquid Binance+MEXC USDT pairs NOT already in the LS universe.
const CANDIDATES = [
  "TON", "TRX", "ALGO", "XLM", "FET", "RENDER", "ONDO", "JUP", "WIF", "BONK",
  "ENA", "WLD", "CRV", "MKR", "GALA", "MANA", "RUNE", "GRT", "IMX", "STX",
  "TAO", "POL", "VET", "AXS", "OP", "ADA", "SHIB",
];

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
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, "utf-8")) as OHLCV[];
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  for (let b = 0; b < Math.ceil((total + 1) / batchSize); b++) {
    const qs = `symbol=${symbol.toUpperCase()}USDT&interval=${interval}&limit=${batchSize}` + (endTime ? `&endTime=${endTime}` : "");
    const data: any[][] = await fetchJSON(`${BINANCE_BASE}/klines?${qs}`);
    if (!Array.isArray(data) || data.length === 0) break;
    candles.unshift(...data.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })));
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
    await sleep(120);
  }
  const result = dropOpenCandle(candles, interval).slice(-total);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(result));
  return result;
}

interface Rec { time: number; netR: number }

function backtestLS(candles: OHLCV[]): Rec[] {
  const strat = liquiditySweepStrategy;
  const window = Math.max(strat.minCandles, 60);
  const maxBars = 200;
  const cdBars = Math.round((strat.cooldownHours ?? 0));
  const out: Rec[] = [];
  if (candles.length < window + maxBars + 10) return out;
  let lastIdx = -1e9;
  for (let i = window; i < candles.length - maxBars; i++) {
    if (i - lastIdx < cdBars) continue;
    const sig = strat.analyze(candles.slice(i - window, i + 1));
    if (!sig) continue;
    const risk = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit1 - sig.entry);
    if (sig.entry <= 0 || risk / sig.entry < MIN_SL_DISTANCE_PCT) continue;
    if (risk <= 0 || reward / risk < MIN_RR) continue;
    lastIdx = i;
    const exit = simulateManagedExit(
      { direction: sig.direction, entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2 },
      candles.slice(i + 1, i + 1 + maxBars),
    );
    out.push({ time: candles[i].time, netR: exit.netR });
  }
  return out;
}

function agg(recs: Rec[]) {
  const n = recs.length;
  const sumR = recs.reduce((s, r) => s + r.netR, 0);
  const gw = recs.reduce((s, r) => s + Math.max(0, r.netR), 0);
  const gl = recs.reduce((s, r) => s + Math.max(0, -r.netR), 0);
  const wins = recs.filter(r => r.netR >= 0).length;
  return { n, sumR, pf: gl > 0 ? gw / gl : gw > 0 ? Infinity : 0, wr: n ? wins / n * 100 : 0 };
}

async function main() {
  const already = new Set(liquiditySweepStrategy.preferredSymbols ?? []);
  const lines: string[] = [];
  const log = (s = "") => { console.log(s); lines.push(s); };
  log(`# LS Universe Screen (two-halves consistency) — ${new Date().toISOString().slice(0, 10)}`);
  log(`Pass rule: T≥${MIN_TRADES} · PF≥${MIN_PF} · sumR>0 in BOTH halves of the ${TOTAL_CANDLES}×1h window`);
  log();

  const pass: string[] = [];
  for (const sym of CANDIDATES) {
    if (already.has(sym)) { log(`  ${sym.padEnd(7)} skipped (already in universe)`); continue; }
    let candles: OHLCV[];
    try { candles = await fetchPaginated(sym, "1h", TOTAL_CANDLES); }
    catch (e: any) { log(`  ${sym.padEnd(7)} fetch failed (${e?.message ?? e})`); continue; }
    if (candles.length < 4000) { log(`  ${sym.padEnd(7)} insufficient history (${candles.length} candles)`); continue; }
    const recs = backtestLS(candles);
    const mid = candles[Math.floor(candles.length / 2)].time;
    const h1 = agg(recs.filter(r => r.time < mid));
    const h2 = agg(recs.filter(r => r.time >= mid));
    const all = agg(recs);
    const ok = all.n >= MIN_TRADES && all.pf >= MIN_PF && h1.sumR > 0 && h2.sumR > 0;
    log(`  ${sym.padEnd(7)} ${ok ? "✅ PASS" : "   fail"}  T=${String(all.n).padStart(3)} WR=${all.wr.toFixed(0)}% PF=${all.pf === Infinity ? "∞" : all.pf.toFixed(2)} sumR=${all.sumR >= 0 ? "+" : ""}${all.sumR.toFixed(1)}  |  H1=${h1.sumR >= 0 ? "+" : ""}${h1.sumR.toFixed(1)} (T=${h1.n})  H2=${h2.sumR >= 0 ? "+" : ""}${h2.sumR.toFixed(1)} (T=${h2.n})`);
    if (ok) pass.push(sym);
  }

  log();
  log(`Survivors → full-pipeline validation: ${pass.length ? pass.join(", ") : "(none)"}`);
  writeFileSync("script/expand-universe-ls-report.md", lines.join("\n"));
  console.log(`\n[report written to script/expand-universe-ls-report.md]`);
}

main().catch(e => { console.error(e); process.exit(1); });
