// ─── UNIVERSE EDGE SCAN ──────────────────────────────────────────────────
// Tests each 1H strategy against the FULL tradeable universe (not just its
// current preferredSymbols) to find coins with real 2026 edge that are NOT yet
// traded — i.e. where to add trades WITHOUT adding negative-EV setups.
//
// Run: npx tsx script/validate-universe.ts
//
// Same gates/exits as validate-2026.ts. A coin is a promotion CANDIDATE when
// its 2026 slice has T>=20 and exp>=+0.20R (enough sample + a real edge).
// Still partly in-sample — treat as a shortlist to paper-watch, not gospel.

import { getAllStrategies } from "../server/strategies/registry";
import { simulateManagedExit } from "../server/trade-exits";
import { dropOpenCandle } from "../server/candles";
import type { OHLCV } from "../server/analysis";
import type { Strategy } from "../server/strategies/types";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const MIN_SL_DISTANCE_PCT = 0.006;
const MIN_RR = 1.5;
const TOTAL_CANDLES = 8000;
const YEAR_2026_TS = Date.UTC(2026, 0, 1) / 1000;

// SCANNER_COINS ∪ all strategies' current preferred extras — the realistic set.
const UNIVERSE = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "DOT",
  "NEAR", "SUI", "ARB", "OP", "APT", "INJ", "FIL", "ATOM", "LTC", "UNI",
  "SEI", "TIA", "PEPE", "SHIB", "HBAR", "LUNC", "AAVE", "ICP", "SAND", "ETC", "BCH",
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  const pair = symbol === "MATIC" ? "MATICUSDT" : `${symbol}USDT`;
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches = Math.ceil((total + 1) / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${pair}&interval=${interval}&limit=${batchSize}` + (endTime ? `&endTime=${endTime}` : "");
    const data: any[][] = await fetchJSON(`${BINANCE_BASE}/klines?${qs}`);
    if (!Array.isArray(data) || data.length === 0) break;
    candles.unshift(...data.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })));
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
  }
  return dropOpenCandle(candles, interval).slice(-total);
}

interface Agg { n: number; wins: number; sumR: number; gW: number; gL: number; }
function emptyAgg(): Agg { return { n: 0, wins: 0, sumR: 0, gW: 0, gL: 0 }; }
function add(a: Agg, r: number) { a.n++; if (r >= 0) { a.wins++; a.gW += r; } else a.gL += -r; a.sumR += r; }
function pf(a: Agg): number { return a.gL > 0 ? a.gW / a.gL : (a.gW > 0 ? Infinity : 0); }
function exp(a: Agg): number { return a.n ? a.sumR / a.n : 0; }
function fmt(a: Agg): string {
  if (!a.n) return "(none)";
  const p = pf(a);
  return `T=${String(a.n).padStart(3)} WR=${((a.wins / a.n) * 100).toFixed(0).padStart(2)}% PF=${p === Infinity ? "inf" : p.toFixed(2)} sumR=${(a.sumR >= 0 ? "+" : "") + a.sumR.toFixed(1)} exp=${(exp(a) >= 0 ? "+" : "") + exp(a).toFixed(2)}R`;
}

function backtest(strat: Strategy, candles: OHLCV[], only2026: boolean): number[] {
  const out: number[] = [];
  const window = Math.max(strat.minCandles, 60);
  const maxBars = strat.interval === "4h" ? 60 : 200;
  const ivH = strat.interval.endsWith("h") ? parseInt(strat.interval) : 24;
  const cdBars = strat.cooldownHours ? Math.round(strat.cooldownHours / ivH) : 0;
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
    if (only2026 && candles[i].time < YEAR_2026_TS) continue;
    const exitR = simulateManagedExit(
      { direction: sig.direction, entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2 },
      candles.slice(i + 1, i + 1 + maxBars),
    ).netR;
    out.push(exitR);
  }
  return out;
}

async function main() {
  const strategies = getAllStrategies();
  const lines: string[] = [];
  const log = (s = "") => { console.log(s); lines.push(s); };
  log(`# Universe edge scan — ${new Date().toISOString().slice(0, 10)}`);
  log(`Candidate = NOT-yet-preferred coin with 2026 T>=20 and exp>=+0.20R.\n`);

  const cache = new Map<string, OHLCV[]>();

  for (const strat of strategies) {
    const preferred = new Set(strat.preferredSymbols ?? []);
    log(`\n## ${strat.name} (${strat.id}) — ${strat.interval}`);
    const rows: { sym: string; cur: boolean; agg: Agg }[] = [];
    for (const sym of UNIVERSE) {
      const key = `${sym}:${strat.interval}`;
      let candles = cache.get(key);
      if (!candles) {
        try { candles = await fetchPaginated(sym, strat.interval, TOTAL_CANDLES); cache.set(key, candles); await sleep(100); }
        catch { cache.set(key, []); candles = []; }
      }
      if (!candles.length) continue;
      const a = emptyAgg();
      for (const r of backtest(strat, candles, true)) add(a, r);
      if (a.n > 0) rows.push({ sym, cur: preferred.has(sym), agg: a });
    }
    rows.sort((x, y) => y.agg.sumR - x.agg.sumR);
    const candidates = rows.filter(r => !r.cur && r.agg.n >= 20 && exp(r.agg) >= 0.20);
    for (const r of rows) {
      const tag = r.cur ? "[current]" : (candidates.includes(r) ? "[ADD?]   " : "         ");
      log(`  ${tag} ${r.sym.padEnd(6)} ${fmt(r.agg)}`);
    }
    log(`  → promotion candidates: ${candidates.map(c => c.sym).join(", ") || "(none)"}`);
  }

  const fs = await import("fs");
  fs.writeFileSync("script/validate-universe-report.md", lines.join("\n"));
  console.log(`\n[report written to script/validate-universe-report.md]`);
}

main().catch(e => { console.error(e); process.exit(1); });
