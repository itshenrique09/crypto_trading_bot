// ─── 2026 STRATEGY VALIDATION HARNESS ────────────────────────────────────
// Walks each ACTIVE strategy (registry) over its own preferredSymbols using
// the SAME analyze() the live engine calls, the SAME simulateManagedExit, and
// the SAME engine-level gates that decide a real entry (min SL distance, R:R).
// Reports all-history vs 2026-only so we can see which strategy/coin combos
// still have edge in the current regime — and which to cut.
//
// Run: npx tsx script/validate-2026.ts
//
// Caveats (stated honestly):
//   • Does NOT apply the BTC directional overlay / daily-weekly trend filters
//     (those need live BTC + per-symbol trend series). This is the raw
//     per-strategy edge under entry-quality gating — the upper bound of what
//     the live filters then trim. Good enough to rank keep/cut.
//   • preferredSymbols were partly selected on this same history, so all-time
//     numbers are in-sample-optimistic; the 2026 slice is the honest tell.

import { getAllStrategies } from "../server/strategies/registry";
import { simulateManagedExit } from "../server/trade-exits";
import { dropOpenCandle } from "../server/candles";
import type { OHLCV } from "../server/analysis";
import type { Strategy } from "../server/strategies/types";

const BINANCE_BASE = "https://api.binance.com/api/v3";
const BINANCE_OVERRIDES: Record<string, string> = { MATIC: "MATICUSDT" };
const MIN_SL_DISTANCE_PCT = 0.006;   // mirrors engine
const MIN_RR = 1.5;                  // mirrors engine R:R gate
const TOTAL_CANDLES = 8000;          // ~1y (1h) / ~3.7y (4h) — matches route backtests
const YEAR_2026_TS = Date.UTC(2026, 0, 1) / 1000; // candle.time is in seconds

function getBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  return BINANCE_OVERRIDES[upper] ?? `${upper}USDT`;
}

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

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
  const pair = getBinanceSymbol(symbol);
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
  }
  return dropOpenCandle(candles, interval).slice(-total);
}

interface TradeRec { time: number; dir: "LONG" | "SHORT"; netR: number; win: boolean; }

function intervalHours(iv: string): number {
  if (iv.endsWith("h")) return parseInt(iv);
  if (iv.endsWith("d")) return parseInt(iv) * 24;
  return 1;
}

function backtestSymbol(strat: Strategy, candles: OHLCV[]): TradeRec[] {
  const trades: TradeRec[] = [];
  const window = Math.max(strat.minCandles, 60);
  const maxBars = strat.interval === "4h" ? 60 : 200; // hold window (route parity)
  const cdBars = strat.cooldownHours ? Math.round(strat.cooldownHours / intervalHours(strat.interval)) : 0;
  if (candles.length < window + maxBars + 10) return trades;

  let lastIdx = -1e9;
  for (let i = window; i < candles.length - maxBars; i++) {
    if (i - lastIdx < cdBars) continue;
    const sig = strat.analyze(candles.slice(i - window, i + 1));
    if (!sig) continue;
    const risk = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit1 - sig.entry);
    const slDist = sig.entry > 0 ? risk / sig.entry : 0;
    if (slDist < MIN_SL_DISTANCE_PCT) continue;       // engine gate
    if (risk <= 0 || reward / risk < MIN_RR) continue; // engine gate
    lastIdx = i;
    const exit = simulateManagedExit(
      { direction: sig.direction, entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit1, takeProfit2: sig.takeProfit2 },
      candles.slice(i + 1, i + 1 + maxBars),
    );
    trades.push({ time: candles[i].time, dir: sig.direction, netR: exit.netR, win: exit.netR >= 0 });
  }
  return trades;
}

interface Agg { n: number; wins: number; sumR: number; grossWin: number; grossLoss: number; longs: number; shorts: number; }
function emptyAgg(): Agg { return { n: 0, wins: 0, sumR: 0, grossWin: 0, grossLoss: 0, longs: 0, shorts: 0 }; }
function add(a: Agg, t: TradeRec) {
  a.n++; if (t.win) a.wins++; a.sumR += t.netR;
  if (t.netR >= 0) a.grossWin += t.netR; else a.grossLoss += -t.netR;
  if (t.dir === "LONG") a.longs++; else a.shorts++;
}
function fmt(a: Agg): string {
  if (a.n === 0) return "  (no trades)";
  const wr = (a.wins / a.n) * 100;
  const pf = a.grossLoss > 0 ? a.grossWin / a.grossLoss : (a.grossWin > 0 ? Infinity : 0);
  const exp = a.sumR / a.n;
  return `T=${a.n} WR=${wr.toFixed(0)}% PF=${pf === Infinity ? "∞" : pf.toFixed(2)} sumR=${a.sumR >= 0 ? "+" : ""}${a.sumR.toFixed(1)} exp=${exp >= 0 ? "+" : ""}${exp.toFixed(2)}R L/S=${a.longs}/${a.shorts}`;
}

async function main() {
  const strategies = getAllStrategies();
  const lines: string[] = [];
  const log = (s = "") => { console.log(s); lines.push(s); };

  log(`# 2026 Strategy Validation — ${new Date().toISOString().slice(0, 10)}`);
  log(`Gates: minSLdist ${MIN_SL_DISTANCE_PCT * 100}% · R:R ≥ ${MIN_RR} · candles ${TOTAL_CANDLES} · 2026 = entries on/after ${new Date(YEAR_2026_TS * 1000).toISOString().slice(0, 10)}`);
  log();

  const candleCache = new Map<string, OHLCV[]>();

  for (const strat of strategies) {
    log(`\n## ${strat.name} (${strat.id}) — ${strat.interval}, ${(strat.preferredSymbols ?? []).length} coins`);
    const allAgg = emptyAgg();
    const agg26 = emptyAgg();
    const perCoin26: { sym: string; agg: Agg }[] = [];

    for (const sym of strat.preferredSymbols ?? []) {
      const key = `${sym}:${strat.interval}`;
      let candles = candleCache.get(key);
      if (!candles) {
        try { candles = await fetchPaginated(sym, strat.interval, TOTAL_CANDLES); candleCache.set(key, candles); }
        catch (e: any) { log(`  ${sym.padEnd(6)} fetch failed: ${e?.message ?? e}`); continue; }
        await sleep(120);
      }
      const trades = backtestSymbol(strat, candles);
      const c26 = emptyAgg();
      for (const t of trades) { add(allAgg, t); if (t.time >= YEAR_2026_TS) { add(agg26, t); add(c26, t); } }
      perCoin26.push({ sym, agg: c26 });
    }

    log(`  ALL-HISTORY: ${fmt(allAgg)}`);
    log(`  2026-ONLY:   ${fmt(agg26)}`);
    log(`  2026 per coin:`);
    perCoin26.sort((a, b) => b.agg.sumR - a.agg.sumR);
    for (const { sym, agg } of perCoin26) log(`    ${sym.padEnd(6)} ${fmt(agg)}`);
  }

  log(`\n---\nNote: 2026-ONLY sumR/exp is the keep/cut signal. exp < 0 over T≥15 = no current edge → cut the coin or pause the strategy.`);

  const fs = await import("fs");
  const out = "script/validate-2026-report.md";
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`\n[report written to ${out}]`);
}

main().catch(e => { console.error(e); process.exit(1); });
