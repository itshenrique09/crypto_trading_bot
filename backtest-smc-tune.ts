// ══════════════════════════════════════════════════════════
//  SMC — Tuning: confidence threshold + 1H test
//  • Tests confidence 60 / 65 / 68 on 4H
//  • Also tests 1H with confidence 68
//  • Goal: find threshold that gives T≥30 with PF≥1.5
// ══════════════════════════════════════════════════════════
import { smcSignal, type OHLCV } from "./server/analysis";

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

async function fetchKlines(symbol: string, interval: string, totalBars: number): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(totalBars / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=${interval}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const res  = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    const data = await res.json() as any[];
    if (!Array.isArray(data) || data.length === 0) break;
    const batch: OHLCV[] = data.map((k: any[]) => ({
      time:   Math.floor(k[0] / 1000),
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
  }
  return candles;
}

function runSim(allCandles: OHLCV[], minConf: number, maxBars: number, cooldown: number, zoneCd: number): string {
  const wins: number[] = [];
  const losses: number[] = [];
  let lastIdx = -cooldown;
  const zoneCooldown = new Map<string, number>();

  for (let i = WINDOW; i < allCandles.length - maxBars; i++) {
    if (i - lastIdx < cooldown) continue;
    const sig = smcSignal(allCandles.slice(i - WINDOW, i + 1));
    if (sig.type === "NONE") continue;
    if (sig.confidence < minConf) continue;

    const lvl     = sig.obZone ? (sig.obZone.high + sig.obZone.low) / 2 : sig.entry;
    const zoneKey = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
    if (i - (zoneCooldown.get(zoneKey) ?? -999) < zoneCd) continue;
    zoneCooldown.set(zoneKey, i);
    lastIdx = i;

    const isLong = sig.type === "LONG";
    const future = allCandles.slice(i + 1, i + 1 + maxBars);
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
  return `T=${T}${badge}  WR=${wr.toFixed(0)}%  PF=${pfNum}  ${status}`;
}

async function runBacktest(symbol: string) {
  const candles4h = await fetchKlines(symbol, "4h", TOTAL_BARS);
  const candles1h = await fetchKlines(symbol, "1h", TOTAL_BARS * 4);

  if (candles4h.length < WINDOW + MAX_BARS + 30) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  const r60 = runSim(candles4h, 60, MAX_BARS, COOLDOWN, ZONE_COOLDOWN);
  const r65 = runSim(candles4h, 65, MAX_BARS, COOLDOWN, ZONE_COOLDOWN);
  const r68 = runSim(candles4h, 68, MAX_BARS, COOLDOWN, ZONE_COOLDOWN);
  const r1h = candles1h.length >= WINDOW + MAX_BARS * 4 + 30
    ? runSim(candles1h, 68, MAX_BARS * 4, COOLDOWN, ZONE_COOLDOWN * 4)
    : "no data";

  console.log(`\n${symbol}`);
  console.log(`  4H conf≥60: ${r60}`);
  console.log(`  4H conf≥65: ${r65}`);
  console.log(`  4H conf≥68: ${r68}  ← current`);
  console.log(`  1H conf≥68: ${r1h}`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  SMC — Confidence Threshold + 1H Tuning`);
  console.log(`  Finding optimal threshold for T≥30 with PF≥1.5`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<30  💀 T<15\n`);
})();
