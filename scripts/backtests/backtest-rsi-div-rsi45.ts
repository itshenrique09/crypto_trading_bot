// ══════════════════════════════════════════════════════════
//  RSI Divergence — RSI Threshold Test: <40 vs <45
//  Currently: bullish div requires rsiLow < 40, bearish > 60
//  Test:      relax to rsiLow < 45 and rsiHigh > 55
//  Goal: more trades, does PF hold?
// ══════════════════════════════════════════════════════════
import { type OHLCV } from "../../server/analysis";

const COINS      = ["FIL", "SAND", "SOL", "INJ", "PEPE"];
const INTERVAL   = "1h";
const WINDOW     = 250;
const MAX_BARS   = 200;
const COOLDOWN   = 20;
const TOTAL_BARS = 32000;

// ─── Inlined helpers ────────────────────────────────────────────────
function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(0);
  const k = 2 / (period + 1);
  result[0] = values[0];
  for (let i = 1; i < values.length; i++) result[i] = values[i] * k + result[i - 1] * (1 - k);
  return result;
}

// ─── Signal versions ────────────────────────────────────────────────
interface Sig { type: "LONG"|"SHORT"|"NONE"; entry: number; sl: number; tp1: number; tp2: number; conf: number; }

function buildSignal(candles: OHLCV[], rsiOversold: number, rsiOverbought: number): Sig {
  const none: Sig = { type: "NONE", entry: 0, sl: 0, tp1: 0, tp2: 0, conf: 0 };
  if (candles.length < 250) return none;

  const LOOKBACK = 5, DIV_RANGE = 30;
  const closes = candles.map(c => c.close);
  const lows   = candles.map(c => c.low);
  const highs  = candles.map(c => c.high);
  const rsiV   = calcRSI(closes, 14);
  const ema200 = ema(closes, 200);
  const n      = candles.length - 1;
  const price  = closes[n];
  const inBull = price > ema200[n];

  const simpleTP = (entry: number, sl: number, isLong: boolean) => {
    const risk = Math.abs(entry - sl);
    return isLong
      ? { tp1: entry + risk * 1.5, tp2: entry + risk * 2.5 }
      : { tp1: entry - risk * 1.5, tp2: entry - risk * 2.5 };
  };

  if (inBull) {
    const priceLow1 = Math.min(...lows.slice(n - LOOKBACK, n + 1));
    const rsiLow1   = Math.min(...rsiV.slice(n - LOOKBACK, n + 1));
    for (let j = n - LOOKBACK * 2 - 1; j >= Math.max(200, n - DIV_RANGE); j--) {
      const priceLow2 = Math.min(...lows.slice(j - LOOKBACK, j + 1));
      const rsiLow2   = Math.min(...rsiV.slice(j - LOOKBACK, j + 1));
      if (priceLow1 < priceLow2 * 0.998 && rsiLow1 > rsiLow2 + 2 && rsiLow1 < rsiOversold) {
        const sl   = priceLow1 * 0.995;
        const risk = price - sl;
        if (risk <= 0 || risk / price > 0.05) break;
        const conf = rsiLow1 < 30 ? 80 : 72;
        const tps  = simpleTP(price, sl, true);
        return { type: "LONG" as const, entry: price, sl, tp1: tps.tp1, tp2: tps.tp2, conf };
      }
    }
  }

  if (!inBull) {
    const priceHigh1 = Math.max(...highs.slice(n - LOOKBACK, n + 1));
    const rsiHigh1   = Math.max(...rsiV.slice(n - LOOKBACK, n + 1));
    for (let j = n - LOOKBACK * 2 - 1; j >= Math.max(200, n - DIV_RANGE); j--) {
      const priceHigh2 = Math.max(...highs.slice(j - LOOKBACK, j + 1));
      const rsiHigh2   = Math.max(...rsiV.slice(j - LOOKBACK, j + 1));
      if (priceHigh1 > priceHigh2 * 1.002 && rsiHigh1 < rsiHigh2 - 2 && rsiHigh1 > rsiOverbought) {
        const sl   = priceHigh1 * 1.005;
        const risk = sl - price;
        if (risk <= 0 || risk / price > 0.05) break;
        const conf = rsiHigh1 > 70 ? 80 : 72;
        const tps  = simpleTP(price, sl, false);
        return { type: "SHORT" as const, entry: price, sl, tp1: tps.tp1, tp2: tps.tp2, conf };
      }
    }
  }

  return none;
}

// ─── Backtest engine ────────────────────────────────────────────────
async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000, batches = Math.ceil(TOTAL_BARS / batchSize);
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

function simulateTrades(
  allCandles: OHLCV[],
  rsiOversold: number,
  rsiOverbought: number,
): { time: number; pnl: number; win: boolean }[] {
  const trades: { time: number; pnl: number; win: boolean }[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;
    const slice = allCandles.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const sig   = buildSignal(slice, rsiOversold, rsiOverbought);
    if (sig.type === "NONE" || sig.conf < 72) continue;
    if (!sig.entry || !sig.sl || !sig.tp1 || !sig.tp2) continue;

    const isLong = sig.type === "LONG";
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);

    let outcome: "tp1" | "tp2" | "loss" | "timeout" = "timeout";
    for (const c of future) {
      if (isLong) {
        if (c.low  <= sig.sl)  { outcome = "loss"; break; }
        if (c.high >= sig.tp2) { outcome = "tp2";  break; }
        if (c.high >= sig.tp1) { outcome = "tp1";  break; }
      } else {
        if (c.high >= sig.sl)  { outcome = "loss"; break; }
        if (c.low  <= sig.tp2) { outcome = "tp2";  break; }
        if (c.low  <= sig.tp1) { outcome = "tp1";  break; }
      }
    }

    const risk   = Math.abs(sig.entry - sig.sl);
    const tp1Rew = Math.abs(sig.tp1 - sig.entry);
    const tp2Rew = Math.abs(sig.tp2 - sig.entry);
    let pnl: number;
    if      (outcome === "tp2")  pnl =  (tp2Rew / sig.entry) * 100;
    else if (outcome === "tp1")  pnl =  (tp1Rew / sig.entry) * 100;
    else if (outcome === "loss") pnl = -(risk    / sig.entry) * 100;
    else {
      const exit = future.length > 0 ? future[future.length - 1].close : sig.entry;
      pnl = isLong ? ((exit - sig.entry) / sig.entry) * 100 : ((sig.entry - exit) / sig.entry) * 100;
    }

    lastIdx = i;
    trades.push({ time: allCandles[i].time, pnl, win: pnl > 0 });
  }
  return trades;
}

function printGroup(trades: { time: number; pnl: number; win: boolean }[], label: string) {
  const T = trades.length;
  if (T === 0) { console.log(`  ${label}: 0 trades`); return; }
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
    return `${yr}:${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
  }).join(" ");
  console.log(`  ${label}${badge}: T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  ${status}  [${yrStr}]`);
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 50) { console.log(`${symbol}: not enough data`); return; }

  const baseline = simulateTrades(allCandles, 40, 60);   // original
  const relaxed  = simulateTrades(allCandles, 45, 55);   // proposed

  const extra    = relaxed.length - baseline.length;
  console.log(`\n${symbol}`);
  printGroup(baseline, "RSI<40/>60 (baseline)");
  printGroup(relaxed,  "RSI<45/>55 (proposed)");
  if (extra !== 0) console.log(`  → ${extra > 0 ? "+" : ""}${extra} trades from relaxed RSI zone`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RSI Divergence — RSI Zone: <40/>60 vs <45/>55`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (3.7 years)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<100  💀 T<50`);
  console.log(`\nDECISION: Apply <45/>55 if all preferred coins (FIL, SAND, SOL) keep PF≥1.4\n`);
})();
