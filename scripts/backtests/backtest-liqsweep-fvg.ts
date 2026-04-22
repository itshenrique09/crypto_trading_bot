// ══════════════════════════════════════════════════════════
//  Liquidity Sweep — FVG Post-Sweep Confirmation
//  Research: sweep + FVG = 60%+ WR; FVG in sweep direction adds
//  imbalance context, price tends to fill gap before reversing
//
//  Hypothesis: requiring a bullish FVG below price (for LONG) or
//  bearish FVG above price (for SHORT) within 3% filters low-conviction
//  sweeps, improving PF and WR
//
//  Uses real liquiditySweepSignal() + inline FVG detection
// ══════════════════════════════════════════════════════════
import { liquiditySweepSignal, type OHLCV } from "../../server/analysis";

const COINS      = ["FIL", "PEPE", "SAND", "INJ", "SUI", "SOL"];
const INTERVAL   = "1h";
const WINDOW     = 220;
const MAX_BARS   = 200;
const COOLDOWN   = 12;
const TOTAL_BARS = 16000;

// ── Inline FVG detection (matches analysis.ts logic) ──────────────
function calcATR(candles: OHLCV[], period=14): number {
  let atr=0;
  for (let i=Math.max(1,candles.length-period);i<candles.length;i++) {
    const h=candles[i].high,l=candles[i].low,pc=candles[i-1].close;
    atr+=Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc));
  }
  return atr/period;
}

interface FVG { type:"bullish"|"bearish"; high:number; low:number; }

function findFVGs(candles: OHLCV[], lookback=50): FVG[] {
  const gaps: FVG[] = [];
  const len=candles.length;
  const start=Math.max(0,len-lookback);
  const atr=calcATR(candles);
  for (let i=start+2;i<len;i++) {
    const c1=candles[i-2], c3=candles[i], c2=candles[i-1];
    if (c3.low>c1.high && c2.close>c2.open) {
      if (c3.low-c1.high > atr*0.3) gaps.push({type:"bullish",high:c3.low,low:c1.high});
    }
    if (c3.high<c1.low && c2.close<c2.open) {
      if (c1.low-c3.high > atr*0.3) gaps.push({type:"bearish",high:c1.low,low:c3.high});
    }
  }
  return gaps;
}

// Check for supporting FVG near current price:
// LONG: bullish FVG below price (support gap, unfilled, within 3%)
// SHORT: bearish FVG above price (resistance gap, unfilled, within 3%)
function hasSupportingFVG(candles: OHLCV[], direction: "LONG"|"SHORT"): boolean {
  const price=candles[candles.length-1].close;
  const fvgs=findFVGs(candles,60);
  const tol=0.03;
  if (direction==="LONG") {
    // Bullish FVG: high < price (below current price), within 3%
    return fvgs.some(f=>
      f.type==="bullish" &&
      f.high < price &&
      (price-f.high)/price < tol
    );
  } else {
    // Bearish FVG: low > price (above current price), within 3%
    return fvgs.some(f=>
      f.type==="bearish" &&
      f.low > price &&
      (f.low-price)/price < tol
    );
  }
}

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize=1000, batches=Math.ceil(TOTAL_BARS/batchSize);
  for (let b=0;b<batches;b++) {
    const qs=`symbol=${symbol}USDT&interval=${INTERVAL}&limit=${batchSize}`+
             (endTime?`&endTime=${endTime}`:"");
    const res  =await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    const data =await res.json() as any[];
    if (!Array.isArray(data)||data.length===0) break;
    const batch: OHLCV[]=data.map((k:any[])=>({
      time:Math.floor(k[0]/1000),open:parseFloat(k[1]),
      high:parseFloat(k[2]),low:parseFloat(k[3]),
      close:parseFloat(k[4]),volume:parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length<batchSize) break;
    endTime=data[0][0]-1;
  }
  return candles;
}

function simulate(allCandles: OHLCV[], requireFVG: boolean) {
  const trades: {time:number;pnl:number;win:boolean}[] = [];
  let lastIdx=-COOLDOWN;
  for (let i=WINDOW;i<allCandles.length-MAX_BARS;i++) {
    if (i-lastIdx<COOLDOWN) continue;
    const slice=allCandles.slice(Math.max(0,i-WINDOW+1),i+1);
    const sig  =liquiditySweepSignal(slice);
    if (sig.type==="NONE") continue;
    // FVG filter
    if (requireFVG && !hasSupportingFVG(slice, sig.type as "LONG"|"SHORT")) continue;

    const isLong =sig.type==="LONG";
    const future =allCandles.slice(i+1,i+1+MAX_BARS);
    let outcome: "tp1"|"tp2"|"loss"|"timeout"="timeout";
    for (const c of future) {
      if (isLong) {
        if (c.low  <=sig.stopLoss)    {outcome="loss";break;}
        if (c.high >=sig.takeProfit2) {outcome="tp2"; break;}
        if (c.high >=sig.takeProfit)  {outcome="tp1"; break;}
      } else {
        if (c.high >=sig.stopLoss)    {outcome="loss";break;}
        if (c.low  <=sig.takeProfit2) {outcome="tp2"; break;}
        if (c.low  <=sig.takeProfit)  {outcome="tp1"; break;}
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
  const allCandles=await fetchKlines(symbol);
  if (allCandles.length<WINDOW+MAX_BARS+10) {console.log(`${symbol}: not enough data`);return;}
  const baseline=simulate(allCandles,false);
  const withFVG  =simulate(allCandles,true);
  console.log(`\n${symbol}`);
  print(baseline,"no FVG (baseline)  ");
  print(withFVG, "FVG confirm (prop.)");
  const pfDiff=withFVG.pf-baseline.pf;
  console.log(`  → FVG filter: PF ${pfDiff>=0?"+":""}${pfDiff.toFixed(2)} T${withFVG.T-baseline.T}`);
}

(async ()=>{
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Liquidity Sweep — FVG Post-Sweep Confirmation`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (22 months)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`DECISION: Apply if PF improves ≥0.05 on avg AND T stays ≥20/coin\n`);
})();
