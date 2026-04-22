// ══════════════════════════════════════════════════════════
//  Liquidity Sweep — Extended Backtest for new coin candidates
//  Tests coins NOT yet in preferred list: OP, ADA, ARB, BTC, ETH, DOT, DOGE
//  vs current preferred (FIL, PEPE, SAND, INJ, SUI, SOL) as reference
//  Extended to 16000 bars (~22 months) for robustness
// ══════════════════════════════════════════════════════════
import { liquiditySweepSignal, type OHLCV } from "../../server/analysis";

const PREFERRED  = ["FIL", "PEPE", "SAND", "INJ", "SUI", "SOL"];
const CANDIDATES = ["OP", "ADA", "ARB", "BTC", "ETH", "DOT", "DOGE", "AVAX", "LINK", "XRP"];

const INTERVAL   = "1h";
const WINDOW     = 220;
const MAX_BARS   = 200;
const COOLDOWN   = 12;
const TOTAL_BARS = 16000; // ~22 months (more robust than 7 months)

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

async function runBacktest(symbol: string): Promise<{ symbol: string; T: number; wr: number; pf: number }> {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 10) {
    console.log(`${symbol}: not enough data`);
    return { symbol, T: 0, wr: 0, pf: 0 };
  }

  const trades: { time: number; pnl: number; win: boolean }[] = [];
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
    for (const c of future) {
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

  const T = trades.length;
  if (T === 0) { console.log(`${symbol}: 0 trades`); return { symbol, T: 0, wr: 0, pf: 0 }; }
  const wins   = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const grossW = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf     = grossL > 0 ? grossW / grossL : Infinity;
  const wr     = (wins.length / T) * 100;
  return { symbol, T, wr, pf };
}

function printResult(r: { symbol: string; T: number; wr: number; pf: number }, note = "") {
  if (r.T === 0) return;
  const pfNum  = Math.round(r.pf * 100) / 100;
  const status = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const badge  = r.T >= 50 ? "" : r.T >= 20 ? " ⚠️" : " 💀";
  console.log(`  ${r.symbol.padEnd(6)}${badge}  T=${String(r.T).padEnd(4)}  WR=${r.wr.toFixed(1).padStart(5)}%  PF=${String(pfNum).padEnd(5)}  ${status}  ${note}`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Liquidity Sweep — New Coin Candidates (16000 bars)`);
  console.log(`  COOLDOWN=${COOLDOWN}h · MIN_CONF=68%`);
  console.log(`═══════════════════════════════════════════════════`);

  console.log(`\n── Current preferred (reference) ──`);
  for (const coin of PREFERRED) {
    const r = await runBacktest(coin);
    printResult(r, "(preferred)");
  }

  console.log(`\n── Candidates (not yet in preferred) ──`);
  const results: { symbol: string; T: number; wr: number; pf: number }[] = [];
  for (const coin of CANDIDATES) {
    const r = await runBacktest(coin);
    results.push(r);
    printResult(r, "");
  }

  const qualified = results.filter(r => r.pf >= 1.5 && r.T >= 20);
  console.log(`\n── Summary ──`);
  if (qualified.length === 0) {
    console.log(`  No candidates meet PF≥1.5 threshold. No additions recommended.`);
  } else {
    console.log(`  Candidates qualifying for preferred list (PF≥1.5, T≥20):`);
    for (const r of qualified) printResult(r, "← ADD?");
  }
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<50  💀 T<20\n`);
})();
