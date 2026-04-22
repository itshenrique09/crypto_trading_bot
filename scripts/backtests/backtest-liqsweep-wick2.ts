// ══════════════════════════════════════════════════════════
//  Liquidity Sweep — Wick Ratio Post-Filter (fixed)
//  Uses real liquiditySweepSignal() + parses wick ratio from reason
//  Tests minimum wick: 0.8 (baseline) vs 1.0 vs 1.5
//  Fixes bug in v1: inline simpleTP was 1.5R, failed reward/risk≥2.0 check
// ══════════════════════════════════════════════════════════
import { liquiditySweepSignal, type OHLCV } from "../../server/analysis";

const COINS      = ["FIL", "PEPE", "SAND", "INJ", "SUI", "SOL"];
const INTERVAL   = "1h";
const WINDOW     = 220;
const MAX_BARS   = 200;
const COOLDOWN   = 12;
const TOTAL_BARS = 16000;

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000, batches = Math.ceil(TOTAL_BARS/batchSize);
  for (let b=0;b<batches;b++) {
    const qs = `symbol=${symbol}USDT&interval=${INTERVAL}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const res  = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    const data = await res.json() as any[];
    if (!Array.isArray(data)||data.length===0) break;
    const batch: OHLCV[] = data.map((k:any[])=>({
      time:Math.floor(k[0]/1000),open:parseFloat(k[1]),
      high:parseFloat(k[2]),low:parseFloat(k[3]),
      close:parseFloat(k[4]),volume:parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length<batchSize) break;
    endTime = data[0][0]-1;
  }
  return candles;
}

// Parse wick ratio from reason string: "| wick X.X× body |"
function parseWickRatio(reason: string): number {
  const m = reason.match(/wick\s+([\d.]+)×\s+body/);
  return m ? parseFloat(m[1]) : 0;
}

function simulate(allCandles: OHLCV[], minWickRatio: number) {
  const trades: {time:number;pnl:number;win:boolean}[] = [];
  let lastIdx = -COOLDOWN;
  for (let i=WINDOW;i<allCandles.length-MAX_BARS;i++) {
    if (i-lastIdx<COOLDOWN) continue;
    const slice = allCandles.slice(Math.max(0,i-WINDOW+1),i+1);
    const sig   = liquiditySweepSignal(slice);
    if (sig.type==="NONE") continue;
    // Post-filter by wick ratio
    const wr = parseWickRatio(sig.reason);
    if (wr < minWickRatio) continue;

    const isLong  = sig.type==="LONG";
    const future  = allCandles.slice(i+1,i+1+MAX_BARS);
    let outcome: "tp1"|"tp2"|"loss"|"timeout" = "timeout";
    for (const c of future) {
      if (isLong) {
        if (c.low  <= sig.stopLoss)    {outcome="loss"; break;}
        if (c.high >= sig.takeProfit2) {outcome="tp2";  break;}
        if (c.high >= sig.takeProfit)  {outcome="tp1";  break;}
      } else {
        if (c.high >= sig.stopLoss)    {outcome="loss"; break;}
        if (c.low  <= sig.takeProfit2) {outcome="tp2";  break;}
        if (c.low  <= sig.takeProfit)  {outcome="tp1";  break;}
      }
    }
    const risk=Math.abs(sig.entry-sig.stopLoss);
    const r1  =Math.abs(sig.takeProfit-sig.entry);
    const r2  =Math.abs(sig.takeProfit2-sig.entry);
    let pnl: number, win: boolean;
    if (outcome==="tp2")       {pnl=(r2/sig.entry)*100;win=true;}
    else if (outcome==="tp1")  {pnl=(r1/sig.entry)*100;win=true;}
    else if (outcome==="loss") {pnl=-(risk/sig.entry)*100;win=false;}
    else {
      const exit=future[future.length-1]?.close??sig.entry;
      pnl=isLong?((exit-sig.entry)/sig.entry)*100:((sig.entry-exit)/sig.entry)*100;
      win=pnl>=0;
    }
    lastIdx=i; trades.push({time:allCandles[i].time,pnl,win});
  }
  const T=trades.length;
  if (T===0) return {T:0,pf:0,wr:0,yearMap:{} as Record<number,number>};
  const wins=trades.filter(t=>t.win), losses=trades.filter(t=>!t.win);
  const grossW=wins.reduce((s,t)=>s+t.pnl,0);
  const grossL=Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  const pf=grossL>0?grossW/grossL:Infinity;
  const wrPct=(wins.length/T)*100;
  const yearMap: Record<number,number>={};
  for (const t of trades) {
    const yr=new Date(t.time*1000).getFullYear();
    yearMap[yr]=(yearMap[yr]??0)+t.pnl;
  }
  return {T,pf:Math.round(pf*100)/100,wr:wrPct,yearMap};
}

function print(r: ReturnType<typeof simulate>, label: string) {
  if (r.T===0) {console.log(`  ${label}: 0 trades`);return;}
  const status=r.pf>=1.5?"✅":r.pf>=1.0?"🟡":"❌";
  const badge=r.T>=50?"":" ⚠️";
  const yrStr=Object.keys(r.yearMap).sort().map(yr=>{
    const v=r.yearMap[parseInt(yr)]; return `${yr}:${v>0?"+":""}${v.toFixed(0)}%`;
  }).join(" ");
  console.log(`  ${label}${badge}: T=${r.T}  WR=${r.wr.toFixed(1)}%  PF=${r.pf}  ${status}  [${yrStr}]`);
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length<WINDOW+MAX_BARS+10) {console.log(`${symbol}: not enough data`);return;}
  const r08 = simulate(allCandles, 0.8);
  const r10 = simulate(allCandles, 1.0);
  const r15 = simulate(allCandles, 1.5);
  console.log(`\n${symbol}`);
  print(r08, "wick≥0.8 (baseline)");
  print(r10, "wick≥1.0 (proposed)");
  print(r15, "wick≥1.5 (proposed)");
  console.log(`  → wick≥1.0: PF ${(r10.pf-r08.pf)>=0?"+":""}${(r10.pf-r08.pf).toFixed(2)} T${r10.T-r08.T}`);
  console.log(`  → wick≥1.5: PF ${(r15.pf-r08.pf)>=0?"+":""}${(r15.pf-r08.pf).toFixed(2)} T${r15.T-r08.T}`);
}

(async ()=>{
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Liquidity Sweep — Wick Ratio Post-Filter (v2 fixed)`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (22 months)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`DECISION: Apply if PF improves ≥0.05 on average AND T≥20/coin\n`);
})();
