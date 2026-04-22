// ══════════════════════════════════════════════════════════
//  Confluence Swing 1H — ADX > 20 Filter Test
//  Research: ADX>20 filters ranging markets, improves signal quality
//  Source: QuantifiedStrategies, MindMathMoney, StatOasis
//
//  Hypothesis: Score≥4 signals in trending markets (ADX>20) have higher PF
//  vs score≥4 with no ADX filter (current production)
// ══════════════════════════════════════════════════════════
import { analyzeIndicators, generateSignal, type OHLCV } from "../../server/analysis";

const COINS      = ["ICP", "BNB", "NEAR", "AVAX", "SOL", "DOT", "VET", "XRP", "BTC", "MATIC"];
const INTERVAL   = "1h";
const WINDOW     = 250;
const MAX_BARS   = 800;
const COOLDOWN   = 20;
const TOTAL_BARS = 32000;
const ADX_THRESHOLD = 20;

// ─── Inline ADX (Wilder's method, same as analysis.ts) ─────────────
function calcADX(candles: OHLCV[], period = 14): number {
  if (candles.length < period * 2 + 1) return 0;
  const trArr: number[] = [], plusDM: number[] = [], minusDM: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low;
    const ph = candles[i-1].high, pl = candles[i-1].low, pc = candles[i-1].close;
    trArr.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
    const up = h-ph, down = pl-l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  let sTR = trArr.slice(0,period).reduce((a,b)=>a+b,0);
  let sPDM = plusDM.slice(0,period).reduce((a,b)=>a+b,0);
  let sMDM = minusDM.slice(0,period).reduce((a,b)=>a+b,0);
  const dxArr: number[] = [];
  for (let i = period; i < trArr.length; i++) {
    sTR  = sTR  - sTR  / period + trArr[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];
    const pdi = sTR > 0 ? 100*sPDM/sTR : 0;
    const mdi = sTR > 0 ? 100*sMDM/sTR : 0;
    const sum = pdi + mdi;
    dxArr.push(sum > 0 ? 100*Math.abs(pdi-mdi)/sum : 0);
  }
  if (dxArr.length < period) return 0;
  let adx = dxArr.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for (let i = period; i < dxArr.length; i++) adx = (adx*(period-1)+dxArr[i])/period;
  return adx;
}

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
      time: Math.floor(k[0]/1000), open: parseFloat(k[1]),
      high: parseFloat(k[2]), low: parseFloat(k[3]),
      close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
  }
  return candles;
}

function simulate(
  allCandles: OHLCV[],
  useAdxFilter: boolean,
): { T: number; pf: number; wr: number; filtered: number; yearMap: Record<number,number> } {
  const trades: { time: number; pnl: number; win: boolean }[] = [];
  let lastIdx = -COOLDOWN;
  let adxFiltered = 0;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;
    const window     = allCandles.slice(i - WINDOW, i + 1);
    const indicators = analyzeIndicators(window);
    const signal     = generateSignal(window, indicators);

    const isBuyish  = signal.type === "STRONG_BUY" || signal.type === "BUY";
    const isSellish = signal.type === "STRONG_SELL" || signal.type === "SELL";
    if (!isBuyish && !isSellish) continue;
    if (Math.abs(signal.confluenceScore) < 4) continue;
    if (!signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

    // ADX filter: skip if market is ranging (ADX < threshold)
    if (useAdxFilter) {
      const adx = calcADX(window, 14);
      if (adx < ADX_THRESHOLD) { adxFiltered++; continue; }
    }

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

    const risk  = Math.abs(signal.entry - signal.stopLoss);
    const r1    = Math.abs(signal.takeProfit1 - signal.entry);
    const r2    = Math.abs(signal.takeProfit2 - signal.entry);
    let pnl: number, win: boolean;
    if (outcome === "tp2")  { pnl = (r2/signal.entry)*100; win = true; }
    else if (outcome === "tp1") { pnl = (r1/signal.entry)*100; win = true; }
    else if (outcome === "loss") { pnl = -(risk/signal.entry)*100; win = false; }
    else {
      const exit = future[future.length-1]?.close ?? signal.entry;
      pnl = isBuy ? ((exit-signal.entry)/signal.entry)*100 : ((signal.entry-exit)/signal.entry)*100;
      win = pnl >= 0;
    }
    trades.push({ time: allCandles[i].time, pnl, win });
  }

  const T = trades.length;
  if (T === 0) return { T: 0, pf: 0, wr: 0, filtered: adxFiltered, yearMap: {} };
  const wins   = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const grossW = wins.reduce((s,t)=>s+t.pnl,0);
  const grossL = Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  const pf     = grossL > 0 ? grossW/grossL : Infinity;
  const wr     = (wins.length/T)*100;
  const yearMap: Record<number,number> = {};
  for (const t of trades) {
    const yr = new Date(t.time*1000).getFullYear();
    yearMap[yr] = (yearMap[yr] ?? 0) + t.pnl;
  }
  return { T, pf: Math.round(pf*100)/100, wr, filtered: adxFiltered, yearMap };
}

function print(r: ReturnType<typeof simulate>, label: string) {
  if (r.T === 0) { console.log(`  ${label}: 0 trades`); return; }
  const status = r.pf >= 1.5 ? "✅" : r.pf >= 1.0 ? "🟡" : "❌";
  const badge  = r.T >= 100 ? "" : r.T >= 50 ? " ⚠️" : " 💀";
  const yrStr  = Object.keys(r.yearMap).sort().map(yr => {
    const v = r.yearMap[parseInt(yr)];
    return `${yr}:${v>0?"+":""}${v.toFixed(0)}%`;
  }).join(" ");
  const filtNote = r.filtered > 0 ? ` (${r.filtered} ADX-filtered)` : "";
  console.log(`  ${label}${badge}: T=${r.T}  WR=${r.wr.toFixed(1)}%  PF=${r.pf}  ${status}${filtNote}  [${yrStr}]`);
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) { console.log(`${symbol}: not enough data`); return; }
  const baseline = simulate(allCandles, false);
  const adxFilt  = simulate(allCandles, true);
  console.log(`\n${symbol}`);
  print(baseline, "no ADX (baseline) ");
  print(adxFilt,  `ADX>=${ADX_THRESHOLD} (proposed)`);
  const pfDiff = adxFilt.pf - baseline.pf;
  const tDiff  = adxFilt.T - baseline.T;
  console.log(`  → PF ${pfDiff >= 0 ? "+" : ""}${pfDiff.toFixed(2)}  Trades ${tDiff} (${((tDiff/baseline.T)*100).toFixed(1)}%)`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Swing 1H — ADX>${ADX_THRESHOLD} Filter Test (score≥4)`);
  console.log(`  ${TOTAL_BARS} bars (3.7 years) · COOLDOWN=${COOLDOWN}h`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`DECISION: Apply if avg PF improves ≥0.05 across coins AND no new ❌\n`);
})();
