// ══════════════════════════════════════════════════════════
//  Liquidity Sweep — Backtest (1H) — uses liquiditySweepSignal directly
//  Tests actual signal function (technical TPs via findTechnicalTPs)
// ══════════════════════════════════════════════════════════
import { liquiditySweepSignal, type OHLCV } from "./server/analysis";

const COINS      = ["FIL", "OP", "ADA", "SUI", "BTC", "SOL", "ETH", "ARB", "INJ", "LINK", "SAND", "DOT", "PEPE"];
const INTERVAL   = "1h";
const WINDOW     = 220;   // EMA200 seed + buffer
const MAX_BARS   = 200;   // max hold (200h ≈ 8 days)
const COOLDOWN   = 12;    // 12h between signals per coin (matches backtest)
const TOTAL_BARS = 5000;  // same as original backtest (~7 months)

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

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 10) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  const trades: { time: number; pnl: number; win: boolean; rr1: number; rr2: number }[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;

    const slice = allCandles.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const sig   = liquiditySweepSignal(slice);

    if (sig.type === "NONE") continue;
    if (sig.confidence < 68) continue;
    if (!sig.entry || !sig.stopLoss || !sig.takeProfit || !sig.takeProfit2) continue;

    const isLong = sig.type === "LONG";
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);

    let outcome: "tp1" | "tp2" | "loss" | "timeout" = "timeout";
    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isLong) {
        if (c.low  <= sig.stopLoss)    { outcome = "loss"; break; }
        if (c.high >= sig.takeProfit2) { outcome = "tp2";  break; }
        if (c.high >= sig.takeProfit)  { outcome = "tp1";  break; }
      } else {
        if (c.high >= sig.stopLoss)    { outcome = "loss"; break; }
        if (c.low  <= sig.takeProfit2) { outcome = "tp2";  break; }
        if (c.low  <= sig.takeProfit)  { outcome = "tp1";  break; }
      }
    }

    const risk   = Math.abs(sig.entry - sig.stopLoss);
    const tp1Rew = Math.abs(sig.takeProfit  - sig.entry);
    const tp2Rew = Math.abs(sig.takeProfit2 - sig.entry);
    const rr1    = tp1Rew / risk;
    const rr2    = tp2Rew / risk;

    let pnl: number;
    if      (outcome === "tp2")  pnl =  (tp2Rew / sig.entry) * 100;
    else if (outcome === "tp1")  pnl =  (tp1Rew / sig.entry) * 100;
    else if (outcome === "loss") pnl = -(risk    / sig.entry) * 100;
    else {
      const exit = future.length > 0 ? future[future.length - 1].close : sig.entry;
      pnl = isLong ? ((exit - sig.entry) / sig.entry) * 100 : ((sig.entry - exit) / sig.entry) * 100;
    }

    lastIdx = i;
    trades.push({ time: allCandles[i].time, pnl, win: pnl > 0, rr1, rr2 });
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
  const avgRR1 = trades.reduce((s, t) => s + t.rr1, 0) / T;
  const status = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const badge  = T >= 50 ? "" : T >= 20 ? " ⚠️" : " 💀";

  console.log(
    `${symbol}${badge}  T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  avgTP1=${avgRR1.toFixed(2)}R  ${status}`
  );
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Liquidity Sweep — 1H Backtest (technical TPs)`);
  console.log(`  COOLDOWN=${COOLDOWN}h · MAX_BARS=${MAX_BARS}h · ${TOTAL_BARS} bars`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0\n`);
})();
