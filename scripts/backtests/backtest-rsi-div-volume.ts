// ══════════════════════════════════════════════════════════
//  RSI Divergence — Volume Confirmation at Pivot Test
//  Research: volume spike at divergence pivot = stronger reversal signal
//  Source: RSI Divergence Pro+ Volume studies, +15-20% accuracy cited
//
//  Hypothesis: requiring volume at the swing low/high bar to be
//  ≥1.2x the 20-bar average filters low-conviction divergences
//
//  Tests: volume at CURRENT swing low/high (last LOOKBACK bars)
// ══════════════════════════════════════════════════════════
import { type OHLCV } from "../../server/analysis";

const COINS      = ["FIL", "SAND", "SOL"];  // current preferred
const INTERVAL   = "1h";
const WINDOW     = 250;
const MAX_BARS   = 200;
const COOLDOWN   = 20;
const TOTAL_BARS = 32000;

// ── Helpers ────────────────────────────────────────────────────────
function calcRSI(closes: number[], period=14): number[] {
  const result = new Array(closes.length).fill(50);
  if (closes.length < period+1) return result;
  let avgGain=0, avgLoss=0;
  for (let i=1;i<=period;i++) {
    const d=closes[i]-closes[i-1];
    if (d>0) avgGain+=d; else avgLoss-=d;
  }
  avgGain/=period; avgLoss/=period;
  result[period] = avgLoss===0?100:100-100/(1+avgGain/avgLoss);
  for (let i=period+1;i<closes.length;i++) {
    const d=closes[i]-closes[i-1];
    avgGain=(avgGain*(period-1)+(d>0?d:0))/period;
    avgLoss=(avgLoss*(period-1)+(d<0?-d:0))/period;
    result[i] = avgLoss===0?100:100-100/(1+avgGain/avgLoss);
  }
  return result;
}
function emaArr(values: number[], period: number): number[] {
  const r=new Array(values.length).fill(0);
  const k=2/(period+1); r[0]=values[0];
  for (let i=1;i<values.length;i++) r[i]=values[i]*k+r[i-1]*(1-k);
  return r;
}

// ── Modified signal with optional volume filter at pivot ───────────
function rsiDivSig(candles: OHLCV[], requirePivotVolume: boolean, minVolRatio=1.2) {
  const none = { type:"NONE" as const, entry:0, sl:0, tp1:0, tp2:0 };
  if (candles.length<250) return none;
  const LOOKBACK=5, DIV_RANGE=30;
  const closes=candles.map(c=>c.close);
  const lows=candles.map(c=>c.low), highs=candles.map(c=>c.high);
  const vols=candles.map(c=>c.volume);
  const rsiV=calcRSI(closes,14);
  const ema200=emaArr(closes,200);
  const n=candles.length-1;
  const price=closes[n];
  const inBull=price>ema200[n];

  const volAvg20 = vols.slice(Math.max(0,n-20),n+1).reduce((s,v)=>s+v,0)/Math.min(20,n+1);

  const simpleTP = (entry:number,sl:number,isLong:boolean) => {
    const risk=Math.abs(entry-sl);
    return isLong
      ? {tp1:entry+risk*1.5,tp2:entry+risk*2.5}
      : {tp1:entry-risk*1.5,tp2:entry-risk*2.5};
  };

  if (inBull) {
    const priceLow1=Math.min(...lows.slice(n-LOOKBACK,n+1));
    const rsiLow1=Math.min(...rsiV.slice(n-LOOKBACK,n+1));

    // Find the index of the current swing low for volume check
    let pivotIdx = n;
    for (let k=n;k>=n-LOOKBACK;k--) { if (lows[k]===priceLow1) {pivotIdx=k;break;} }
    const pivotVol = vols[pivotIdx];
    const pivotVolRatio = volAvg20 > 0 ? pivotVol/volAvg20 : 1;

    for (let j=n-LOOKBACK*2-1;j>=Math.max(200,n-DIV_RANGE);j--) {
      const priceLow2=Math.min(...lows.slice(j-LOOKBACK,j+1));
      const rsiLow2=Math.min(...rsiV.slice(j-LOOKBACK,j+1));
      if (priceLow1<priceLow2*0.998 && rsiLow1>rsiLow2+2 && rsiLow1<40) {
        const sl=priceLow1*0.995, risk=price-sl;
        if (risk<=0||risk/price>0.05) break;
        // Volume filter: pivot bar must have elevated volume
        if (requirePivotVolume && pivotVolRatio < minVolRatio) break;
        const tps=simpleTP(price,sl,true);
        return {type:"LONG" as const,entry:price,sl,tp1:tps.tp1,tp2:tps.tp2};
      }
    }
  }

  if (!inBull) {
    const priceHigh1=Math.max(...highs.slice(n-LOOKBACK,n+1));
    const rsiHigh1=Math.max(...rsiV.slice(n-LOOKBACK,n+1));

    let pivotIdx = n;
    for (let k=n;k>=n-LOOKBACK;k--) { if (highs[k]===priceHigh1) {pivotIdx=k;break;} }
    const pivotVol = vols[pivotIdx];
    const pivotVolRatio = volAvg20 > 0 ? pivotVol/volAvg20 : 1;

    for (let j=n-LOOKBACK*2-1;j>=Math.max(200,n-DIV_RANGE);j--) {
      const priceHigh2=Math.max(...highs.slice(j-LOOKBACK,j+1));
      const rsiHigh2=Math.max(...rsiV.slice(j-LOOKBACK,j+1));
      if (priceHigh1>priceHigh2*1.002 && rsiHigh1<rsiHigh2-2 && rsiHigh1>60) {
        const sl=priceHigh1*1.005, risk=sl-price;
        if (risk<=0||risk/price>0.05) break;
        if (requirePivotVolume && pivotVolRatio < minVolRatio) break;
        const tps=simpleTP(price,sl,false);
        return {type:"SHORT" as const,entry:price,sl,tp1:tps.tp1,tp2:tps.tp2};
      }
    }
  }
  return none;
}

// ── Backtest engine ────────────────────────────────────────────────
async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize=1000, batches=Math.ceil(TOTAL_BARS/batchSize);
  for (let b=0;b<batches;b++) {
    const qs=`symbol=${symbol}USDT&interval=${INTERVAL}&limit=${batchSize}`+
             (endTime?`&endTime=${endTime}`:"");
    const res=await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    const data=await res.json() as any[];
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

function simulate(allCandles: OHLCV[], useVol: boolean, volRatio=1.2) {
  const trades: {time:number;pnl:number;win:boolean}[] = [];
  let lastIdx=-COOLDOWN;
  for (let i=WINDOW;i<allCandles.length-MAX_BARS;i++) {
    if (i-lastIdx<COOLDOWN) continue;
    const slice=allCandles.slice(Math.max(0,i-WINDOW+1),i+1);
    const sig=rsiDivSig(slice,useVol,volRatio);
    if (sig.type==="NONE") continue;
    const isLong=sig.type==="LONG";
    const future=allCandles.slice(i+1,i+1+MAX_BARS);
    let outcome: "tp1"|"tp2"|"loss"|"timeout"="timeout";
    for (const c of future) {
      if (isLong) {
        if (c.low<=sig.sl)  {outcome="loss";break;}
        if (c.high>=sig.tp2){outcome="tp2"; break;}
        if (c.high>=sig.tp1){outcome="tp1"; break;}
      } else {
        if (c.high>=sig.sl) {outcome="loss";break;}
        if (c.low<=sig.tp2) {outcome="tp2"; break;}
        if (c.low<=sig.tp1) {outcome="tp1"; break;}
      }
    }
    const risk=Math.abs(sig.entry-sig.sl);
    const r1=Math.abs(sig.tp1-sig.entry), r2=Math.abs(sig.tp2-sig.entry);
    let pnl: number, win: boolean;
    if (outcome==="tp2") {pnl=(r2/sig.entry)*100;win=true;}
    else if (outcome==="tp1") {pnl=(r1/sig.entry)*100;win=true;}
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
  const wr=(wins.length/T)*100;
  const yearMap: Record<number,number>={};
  for (const t of trades) {
    const yr=new Date(t.time*1000).getFullYear();
    yearMap[yr]=(yearMap[yr]??0)+t.pnl;
  }
  return {T,pf:Math.round(pf*100)/100,wr,yearMap};
}

function print(r: ReturnType<typeof simulate>, label: string) {
  if (r.T===0) {console.log(`  ${label}: 0 trades`);return;}
  const status=r.pf>=1.5?"✅":r.pf>=1.0?"🟡":"❌";
  const badge=r.T>=100?"":" ⚠️";
  const yrStr=Object.keys(r.yearMap).sort().map(yr=>{
    const v=r.yearMap[parseInt(yr)]; return `${yr}:${v>0?"+":""}${v.toFixed(0)}%`;
  }).join(" ");
  console.log(`  ${label}${badge}: T=${r.T}  WR=${r.wr.toFixed(1)}%  PF=${r.pf}  ${status}  [${yrStr}]`);
}

async function runBacktest(symbol: string) {
  const allCandles=await fetchKlines(symbol);
  if (allCandles.length<WINDOW+MAX_BARS+50) {console.log(`${symbol}: not enough data`);return;}
  const baseline = simulate(allCandles,false);
  const vol12    = simulate(allCandles,true,1.2);
  const vol15    = simulate(allCandles,true,1.5);
  console.log(`\n${symbol}`);
  print(baseline, "no vol filter (baseline)");
  print(vol12,    "vol≥1.2x at pivot (prop.)");
  print(vol15,    "vol≥1.5x at pivot (prop.)");
  console.log(`  → vol≥1.2: PF ${(vol12.pf-baseline.pf)>=0?"+":""}${(vol12.pf-baseline.pf).toFixed(2)} T${vol12.T-baseline.T}`);
  console.log(`  → vol≥1.5: PF ${(vol15.pf-baseline.pf)>=0?"+":""}${(vol15.pf-baseline.pf).toFixed(2)} T${vol15.T-baseline.T}`);
}

(async ()=>{
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RSI Divergence — Volume at Pivot Filter`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (3.7 years)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`DECISION: Apply if PF improves ≥0.05 on ALL preferred coins AND T stays ≥80\n`);
})();
