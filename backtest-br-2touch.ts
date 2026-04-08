// ══════════════════════════════════════════════════════════
//  Break & Retest — 2-touch vs 3-touch comparison
//  Tests: minTouches=2 with conf≥60/65/68 vs current (3-touch, conf≥68)
//  Goal: more signals without killing quality
// ══════════════════════════════════════════════════════════
import { breakRetestSignal, type OHLCV } from "./server/analysis";

const COINS = [
  "BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "LINK",
  "MATIC", "UNI", "ATOM", "LTC", "BCH", "AAVE", "ALGO", "VET", "XLM", "TRX",
  "ETC", "FIL", "NEAR", "ICP", "SAND",
];
const WINDOW       = 150;
const MAX_BARS     = 200;
const COOLDOWN     = 3;
const ZONE_COOLDOWN = 20;
const ZONE_PCT     = 0.008;
const TOTAL_BARS   = 8000;

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(TOTAL_BARS / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=4h&limit=${batchSize}` +
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

function runSim(allCandles: OHLCV[], minTouches: number, minConf: number): string {
  const wins: number[] = [];
  const losses: number[] = [];
  let lastIdx = -COOLDOWN;
  const zoneCooldown = new Map<string, number>();
  const yearMap: Record<number, number> = {};

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;
    const sig = breakRetestSignal(allCandles.slice(i - WINDOW, i + 1), minTouches);
    if (sig.type === "NONE") continue;
    if (sig.confidence < minConf) continue;

    const lvl = sig.level ?? sig.entry;
    const zoneKey = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
    if (i - (zoneCooldown.get(zoneKey) ?? -999) < ZONE_COOLDOWN) continue;
    zoneCooldown.set(zoneKey, i);
    lastIdx = i;

    const isLong = sig.type === "LONG";
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);
    let outcome: "tp" | "sl" | "timeout" = "timeout";
    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isLong) {
        if (c.low  <= sig.stopLoss)   { outcome = "sl"; break; }
        if (c.high >= sig.takeProfit) { outcome = "tp"; break; }
      } else {
        if (c.high >= sig.stopLoss)   { outcome = "sl"; break; }
        if (c.low  <= sig.takeProfit) { outcome = "tp"; break; }
      }
    }
    const risk   = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit - sig.entry);
    const exit   = future[future.length - 1]?.close ?? sig.entry;
    let pnl: number;
    if (outcome === "tp")      pnl =  (reward / sig.entry) * 100;
    else if (outcome === "sl") pnl = -(risk / sig.entry) * 100;
    else pnl = isLong ? ((exit - sig.entry) / sig.entry) * 100 : ((sig.entry - exit) / sig.entry) * 100;

    const yr = new Date(allCandles[i].time * 1000).getFullYear();
    yearMap[yr] = (yearMap[yr] ?? 0) + pnl;
    if (pnl >= 0) wins.push(pnl); else losses.push(pnl);
  }

  const T = wins.length + losses.length;
  if (T === 0) return "T=0";
  const grossW = wins.reduce((s, v) => s + v, 0);
  const grossL = Math.abs(losses.reduce((s, v) => s + v, 0));
  const pf     = grossL > 0 ? grossW / grossL : Infinity;
  const wr     = (wins.length / T) * 100;
  const pfNum  = Math.round(pf * 100) / 100;
  const status = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const badge  = T >= 30 ? "" : T >= 15 ? "⚠️" : "💀";
  const yrStr  = Object.keys(yearMap).sort().map(yr => {
    const v = yearMap[parseInt(yr)];
    return `${yr}:${v>0?"+":""}${v.toFixed(0)}%`;
  }).join(" ");
  return `T=${T}${badge} WR=${wr.toFixed(0)}% PF=${pfNum} ${status}  [${yrStr}]`;
}

async function runBacktest(symbol: string) {
  const candles = await fetchKlines(symbol);
  if (candles.length < WINDOW + MAX_BARS + 30) { console.log(`${symbol}: no data`); return; }

  const cur  = runSim(candles, 3, 68);
  const t2_68 = runSim(candles, 2, 68);
  const t2_65 = runSim(candles, 2, 65);
  const t2_60 = runSim(candles, 2, 60);

  console.log(`\n${symbol}`);
  console.log(`  3-touch conf≥68 (current): ${cur}`);
  console.log(`  2-touch conf≥68:           ${t2_68}`);
  console.log(`  2-touch conf≥65:           ${t2_65}`);
  console.log(`  2-touch conf≥60:           ${t2_60}`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  B&R — 2-touch vs 3-touch Comparison (4H)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0\n`);
})();
