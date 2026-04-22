// ══════════════════════════════════════════════════════════
//  Confluence Swing 1H — Cooldown Test: 20h vs 16h
//  Goal: more trades per coin without degrading PF
//  Uses score≥4 (applied change) on preferred coins
// ══════════════════════════════════════════════════════════
import { analyzeIndicators, generateSignal, type OHLCV } from "../../server/analysis";

const COINS      = ["ICP", "BNB", "NEAR", "AVAX", "SOL", "DOT", "VET", "XRP", "BTC", "MATIC"];
const INTERVAL   = "1h";
const WINDOW     = 250;
const MAX_BARS   = 800;
const TOTAL_BARS = 32000;

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

function simulate(allCandles: OHLCV[], cooldown: number): { T: number; pf: number; wr: number; yearMap: Record<number,number> } {
  const trades: { time: number; pnl: number; win: boolean }[] = [];
  let lastIdx = -cooldown;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < cooldown) continue;
    const window     = allCandles.slice(i - WINDOW, i + 1);
    const indicators = analyzeIndicators(window);
    const signal     = generateSignal(window, indicators);

    const isBuyish  = signal.type === "STRONG_BUY" || signal.type === "BUY";
    const isSellish = signal.type === "STRONG_SELL" || signal.type === "SELL";
    if (!isBuyish && !isSellish) continue;
    if (Math.abs(signal.confluenceScore) < 4) continue;
    if (!signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

    lastIdx = i;
    const isBuy = isBuyish;
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);

    let outcome: "tp1"|"tp2"|"loss"|"pending" = "pending";
    let hitTp1 = false;
    for (const c of future) {
      if (isBuy) {
        if (c.low  <= signal.stopLoss)    { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.high >= signal.takeProfit1) hitTp1 = true;
        if (c.high >= signal.takeProfit2) { outcome = "tp2"; break; }
      } else {
        if (c.high >= signal.stopLoss)    { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.low  <= signal.takeProfit1) hitTp1 = true;
        if (c.low  <= signal.takeProfit2) { outcome = "tp2"; break; }
      }
    }
    if (outcome === "pending" && hitTp1) outcome = "tp1";

    const risk      = Math.abs(signal.entry - signal.stopLoss);
    const tp1Reward = Math.abs(signal.takeProfit1 - signal.entry);
    const tp2Reward = Math.abs(signal.takeProfit2 - signal.entry);
    let pnlPct: number, win: boolean;
    if (outcome === "tp2") { pnlPct = (tp2Reward/signal.entry)*100; win = true; }
    else if (outcome === "tp1") { pnlPct = (tp1Reward/signal.entry)*100; win = true; }
    else if (outcome === "loss") { pnlPct = -(risk/signal.entry)*100; win = false; }
    else {
      const exit = future[future.length-1]?.close ?? signal.entry;
      pnlPct = isBuy ? ((exit-signal.entry)/signal.entry)*100 : ((signal.entry-exit)/signal.entry)*100;
      win = pnlPct >= 0;
    }
    trades.push({ time: allCandles[i].time, pnl: pnlPct, win });
  }

  const T = trades.length;
  if (T === 0) return { T: 0, pf: 0, wr: 0, yearMap: {} };
  const wins   = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const grossW = wins.reduce((s,t) => s+t.pnl, 0);
  const grossL = Math.abs(losses.reduce((s,t) => s+t.pnl, 0));
  const pf     = grossL > 0 ? grossW/grossL : Infinity;
  const wr     = (wins.length/T)*100;
  const yearMap: Record<number,number> = {};
  for (const t of trades) {
    const yr = new Date(t.time*1000).getFullYear();
    yearMap[yr] = (yearMap[yr] ?? 0) + t.pnl;
  }
  return { T, pf: Math.round(pf*100)/100, wr, yearMap };
}

function printResult(r: ReturnType<typeof simulate>, label: string) {
  if (r.T === 0) { console.log(`  ${label}: 0 trades`); return; }
  const status = r.pf >= 1.5 ? "✅" : r.pf >= 1.0 ? "🟡" : "❌";
  const badge  = r.T >= 100 ? "" : r.T >= 50 ? " ⚠️" : " 💀";
  const yrStr  = Object.keys(r.yearMap).sort().map(yr => {
    const v = r.yearMap[parseInt(yr)];
    return `${yr}:${v>0?"+":""}${v.toFixed(0)}%`;
  }).join(" ");
  console.log(`  ${label}${badge}: T=${r.T}  WR=${r.wr.toFixed(1)}%  PF=${r.pf}  ${status}  [${yrStr}]`);
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) { console.log(`${symbol}: not enough data`); return; }
  const r20 = simulate(allCandles, 20);
  const r16 = simulate(allCandles, 16);
  console.log(`\n${symbol}`);
  printResult(r20, "CD=20h (baseline)");
  printResult(r16, "CD=16h (proposed)");
  if (r16.T > r20.T) console.log(`  → +${r16.T - r20.T} extra trades`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Swing 1H — Cooldown: 20h vs 16h (score≥4)`);
  console.log(`  ${TOTAL_BARS} bars (3.7 years)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<100  💀 T<50`);
  console.log(`\nDECISION: Apply CD=16h if PF stays ≥1.2 on all coins\n`);
})();
