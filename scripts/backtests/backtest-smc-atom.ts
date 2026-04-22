// ══════════════════════════════════════════════════════════
//  SMC — New coin candidate validation: ATOM
//  Runs ATOM vs current preferred (LINK, DOGE, DOT) for comparison
//  Extended: 8000 4H bars (same as full SMC backtest)
//  Goal: confirm ATOM is addable with PF≥1.5 and 3/4 years positive
// ══════════════════════════════════════════════════════════
import { smcSignal, type OHLCV } from "../../server/analysis";

const COINS          = ["LINK", "DOGE", "DOT", "ATOM"];
const WINDOW         = 150;
const MAX_BARS       = 200;
const COOLDOWN       = 3;
const ZONE_COOLDOWN  = 20;
const ZONE_PCT       = 0.008;
const TOTAL_BARS     = 8000;

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

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) { console.log(`${symbol}: not enough data`); return; }

  const trades: { time: number; pnl: number; win: boolean }[] = [];
  let lastIdx = -COOLDOWN;
  const zoneCooldown = new Map<string, number>();

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;
    const sig = smcSignal(allCandles.slice(i - WINDOW, i + 1));
    if (sig.type === "NONE" || sig.confidence < 68) continue;

    const lvl      = sig.obZone ? (sig.obZone.high + sig.obZone.low) / 2 : sig.entry;
    const zoneKey  = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
    const lastZone = zoneCooldown.get(zoneKey) ?? -999;
    if (i - lastZone < ZONE_COOLDOWN) continue;
    zoneCooldown.set(zoneKey, i);
    lastIdx = i;

    const isLong = sig.type === "LONG";
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);
    let outcome: "tp"|"sl"|"timeout" = "timeout";

    for (const c of future) {
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
    let pnl: number, win: boolean;
    if (outcome === "tp") {
      pnl = (reward / sig.entry) * 100; win = true;
    } else if (outcome === "sl") {
      pnl = -(risk / sig.entry) * 100; win = false;
    } else {
      pnl = isLong ? ((exit-sig.entry)/sig.entry)*100 : ((sig.entry-exit)/sig.entry)*100;
      win = pnl >= 0;
    }
    trades.push({ time: allCandles[i].time, pnl, win });
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
  const badge  = T >= 30 ? "" : T >= 15 ? " ⚠️" : " 💀";

  const yearMap: Record<number, { wins: number; losses: number; pnl: number }> = {};
  for (const t of trades) {
    const yr = new Date(t.time * 1000).getFullYear();
    if (!yearMap[yr]) yearMap[yr] = { wins: 0, losses: 0, pnl: 0 };
    if (t.win) yearMap[yr].wins++; else yearMap[yr].losses++;
    yearMap[yr].pnl += t.pnl;
  }
  const yrStr = Object.keys(yearMap).sort().map(yr => {
    const d = yearMap[parseInt(yr)];
    const yrT = d.wins + d.losses;
    return `${yr}:T=${yrT} ${d.pnl > 0 ? "+" : ""}${d.pnl.toFixed(1)}%`;
  }).join("  |  ");

  const label = symbol === "ATOM" ? "CANDIDATE" : "preferred ";
  console.log(`\n${symbol} [${label}]${badge}  T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  ${status}`);
  console.log(`  ${yrStr}`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  SMC — ATOM Candidate Validation (4H, 3.7y)`);
  console.log(`  Decision: add ATOM if PF≥1.5 and no year consistently negative`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<30  💀 T<15\n`);
})();
