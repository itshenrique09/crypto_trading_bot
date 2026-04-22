// ══════════════════════════════════════════════════════════
//  RSI Divergence — Confidence Threshold Test: 72% vs 68%
//  Goal: measure if lowering threshold adds useful trades
//        without degrading PF on preferred coins
//  Coins: current preferred (FIL, SAND, SOL) + candidates (INJ, PEPE)
// ══════════════════════════════════════════════════════════
import { rsiDivergenceSignal, type OHLCV } from "../../server/analysis";

const COINS      = ["FIL", "SAND", "SOL", "INJ", "PEPE"];
const INTERVAL   = "1h";
const WINDOW     = 250;
const MAX_BARS   = 200;
const COOLDOWN   = 20;
const TOTAL_BARS = 32000; // 3.7 years

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

interface TradeRecord { time: number; pnl: number; win: boolean; conf: number; }

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 50) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  // Collect all signals ≥ 68%, then split into two groups for comparison
  const trades68: TradeRecord[] = [];
  const trades72: TradeRecord[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;

    const slice = allCandles.slice(Math.max(0, i - WINDOW + 1), i + 1);
    const sig   = rsiDivergenceSignal(slice);

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
    const rec: TradeRecord = { time: allCandles[i].time, pnl, win: pnl > 0, conf: sig.confidence };
    trades68.push(rec);
    if (sig.confidence >= 72) trades72.push(rec);
  }

  const printGroup = (trades: TradeRecord[], label: string) => {
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
  };

  // Extra vs only in 68-72 range
  const extra = trades68.filter(t => t.conf < 72);

  console.log(`\n${symbol}`);
  printGroup(trades72, "conf≥72% (baseline)");
  printGroup(trades68, "conf≥68% (proposed)");
  if (extra.length > 0) {
    console.log(`  → Extra trades from 68-71%: ${extra.length} (${extra.filter(t=>t.win).length} wins, ${extra.filter(t=>!t.win).length} losses)`);
  }
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RSI Divergence — Confidence Threshold: 72% vs 68%`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (3.7 years)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<100  💀 T<50\n`);
  console.log(`DECISION RULE: Apply 68% if PF remains ≥1.4 on all current preferred coins (FIL, SAND, SOL)\n`);
})();
