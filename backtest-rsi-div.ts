// ══════════════════════════════════════════════════════════
//  RSI Divergence — Backtest (1H)
//  • Bullish divergence: price lower low + RSI higher low  → LONG
//  • Bearish divergence: price higher high + RSI lower high → SHORT
//  • EMA200 macro filter (no longs in bear, no shorts in bull)
//  • SL: below/above the divergence swing
//  • TP: 2.5× SL (technical)
//  • Goal: assess viability as a 4th strategy
// ══════════════════════════════════════════════════════════
import type { OHLCV } from "./server/analysis";

const COINS = [
  "BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "LINK",
  "MATIC", "UNI", "ATOM", "LTC", "BCH", "AAVE", "ALGO", "VET", "XLM", "TRX",
  "ETC", "FIL", "NEAR", "ICP", "SAND",
];
const INTERVAL   = "1h";
const WINDOW     = 250;   // EMA200 seed
const MAX_BARS   = 200;   // max hold (200h ≈ 8 days)
const COOLDOWN   = 20;    // 20h between signals per coin
const TOTAL_BARS = 32000; // 3.7 years of 1H

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(TOTAL_BARS / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=${INTERVAL}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const res  = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    const data = await res.json() as any[];
    if (!Array.isArray(data) || data.length === 0) break;
    const batch: OHLCV[] = data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000), open: parseFloat(k[1]),
      high: parseFloat(k[2]), low: parseFloat(k[3]),
      close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
  }
  return candles;
}

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { ema.push(NaN); continue; }
    prev = i === period - 1 ? prev : values[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = Array(period).fill(NaN);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

// Find local swing lows (price): lowest in window±lookback
function findSwingLow(arr: number[], idx: number, lookback: number): number {
  let min = arr[idx];
  for (let i = Math.max(0, idx - lookback); i <= Math.min(arr.length - 1, idx + lookback); i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min;
}

function findSwingHigh(arr: number[], idx: number, lookback: number): number {
  let max = arr[idx];
  for (let i = Math.max(0, idx - lookback); i <= Math.min(arr.length - 1, idx + lookback); i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max;
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 50) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  const closes = allCandles.map(c => c.close);
  const lows   = allCandles.map(c => c.low);
  const highs  = allCandles.map(c => c.high);
  const ema200 = calcEMA(closes, 200);
  const rsiAll = calcRSI(closes, 14);

  const trades: { time: number; pnl: number; win: boolean }[] = [];
  let lastIdx = -COOLDOWN;

  const LOOKBACK = 5;   // bars each side to define a swing
  const DIV_RANGE = 30; // bars to look back for divergence

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;
    if (isNaN(rsiAll[i]) || isNaN(ema200[i])) continue;

    const price   = closes[i];
    const ema200v = ema200[i];
    const inBull  = price > ema200v;

    // ── BULLISH DIVERGENCE: price makes lower low, RSI makes higher low ──
    if (inBull) {  // only longs in bull trend
      // Current swing low in price around bar i
      const priceLow1 = Math.min(...lows.slice(i - LOOKBACK, i + 1));
      const rsiLow1   = Math.min(...rsiAll.slice(i - LOOKBACK, i + 1).filter(v => !isNaN(v)));

      // Find a previous swing low in the last DIV_RANGE bars
      let foundDiv = false;
      for (let j = i - LOOKBACK * 2 - 1; j >= Math.max(WINDOW, i - DIV_RANGE); j--) {
        const priceLow2 = Math.min(...lows.slice(j - LOOKBACK, j + 1));
        const rsiLow2   = Math.min(...rsiAll.slice(j - LOOKBACK, j + 1).filter(v => !isNaN(v)));

        // Bullish divergence: price lower low + RSI higher low
        if (priceLow1 < priceLow2 * 0.998 && rsiLow1 > rsiLow2 + 2) {
          // RSI must be in oversold territory (<40) for quality
          if (rsiLow1 < 40) {
            foundDiv = true;
            break;
          }
        }
      }

      if (foundDiv) {
        // Entry above current close
        const entry  = price;
        const sl     = priceLow1 * 0.995;  // below the divergence low
        const risk   = entry - sl;
        if (risk <= 0 || risk / entry > 0.05) continue;  // skip if SL too wide (>5%)
        const tp     = entry + risk * 2.5;

        lastIdx = i;
        const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);
        let outcome: "tp" | "sl" | "timeout" = "timeout";
        for (const c of future) {
          if (c.low  <= sl) { outcome = "sl"; break; }
          if (c.high >= tp) { outcome = "tp"; break; }
        }
        const exit = future[future.length - 1]?.close ?? entry;
        let pnl: number;
        if (outcome === "tp")      pnl =  (risk * 2.5 / entry) * 100;
        else if (outcome === "sl") pnl = -(risk / entry) * 100;
        else pnl = ((exit - entry) / entry) * 100;

        trades.push({ time: allCandles[i].time, pnl, win: pnl >= 0 });
      }
    }

    // ── BEARISH DIVERGENCE: price makes higher high, RSI makes lower high ──
    if (!inBull) {  // only shorts in bear trend
      const priceHigh1 = Math.max(...highs.slice(i - LOOKBACK, i + 1));
      const rsiHigh1   = Math.max(...rsiAll.slice(i - LOOKBACK, i + 1).filter(v => !isNaN(v)));

      let foundDiv = false;
      for (let j = i - LOOKBACK * 2 - 1; j >= Math.max(WINDOW, i - DIV_RANGE); j--) {
        const priceHigh2 = Math.max(...highs.slice(j - LOOKBACK, j + 1));
        const rsiHigh2   = Math.max(...rsiAll.slice(j - LOOKBACK, j + 1).filter(v => !isNaN(v)));

        // Bearish divergence: price higher high + RSI lower high
        if (priceHigh1 > priceHigh2 * 1.002 && rsiHigh1 < rsiHigh2 - 2) {
          if (rsiHigh1 > 60) {  // RSI in overbought territory for quality
            foundDiv = true;
            break;
          }
        }
      }

      if (foundDiv) {
        const entry  = price;
        const sl     = priceHigh1 * 1.005;
        const risk   = sl - entry;
        if (risk <= 0 || risk / entry > 0.05) continue;
        const tp     = entry - risk * 2.5;

        lastIdx = i;
        const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);
        let outcome: "tp" | "sl" | "timeout" = "timeout";
        for (const c of future) {
          if (c.high >= sl) { outcome = "sl"; break; }
          if (c.low  <= tp) { outcome = "tp"; break; }
        }
        const exit = future[future.length - 1]?.close ?? entry;
        let pnl: number;
        if (outcome === "tp")      pnl =  (risk * 2.5 / entry) * 100;
        else if (outcome === "sl") pnl = -(risk / entry) * 100;
        else pnl = ((entry - exit) / entry) * 100;

        trades.push({ time: allCandles[i].time, pnl, win: pnl >= 0 });
      }
    }
  }

  const T = trades.length;
  if (T === 0) { console.log(`${symbol}: 0 trades`); return; }

  const wins   = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const grossW = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf     = grossL > 0 ? grossW / grossL : Infinity;
  const wr     = (wins.length / T) * 100;
  const pfNum  = Math.round(pf * 100) / 100;
  const status = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const badge  = T >= 100 ? "" : T >= 50 ? " ⚠️" : " 💀";

  const yearMap: Record<number, number> = {};
  for (const t of trades) {
    const yr = new Date(t.time * 1000).getFullYear();
    yearMap[yr] = (yearMap[yr] ?? 0) + t.pnl;
  }
  const yrStr = Object.keys(yearMap).sort().map(yr => {
    const v = yearMap[parseInt(yr)];
    return `${yr}:${v>0?"+":""}${v.toFixed(0)}%`;
  }).join(" ");

  console.log(
    `\n${symbol}${badge}  T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  ${status}\n` +
    `  [${yrStr}]`
  );
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RSI Divergence — 1H Backtest (25 coins, 3.7 years)`);
  console.log(`  Bull div: price lower low + RSI higher low (<40)`);
  console.log(`  Bear div: price higher high + RSI lower high (>60)`);
  console.log(`  EMA200 macro filter · TP=2.5R · COOLDOWN=20h`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0\n`);
})();
