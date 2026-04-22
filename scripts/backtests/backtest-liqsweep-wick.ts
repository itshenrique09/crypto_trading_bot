// ══════════════════════════════════════════════════════════
//  Liquidity Sweep — Wick Ratio Filter: 0.8 vs 1.0 vs 1.2
//  Research: stronger rejection wick = higher reversal conviction
//  Current: wick/body >= 0.8 (and vol >= 1.1)
//
//  Hypothesis: requiring wick >= body (ratio≥1.0) filters low-quality
//  sweeps where candle mostly closed against the sweep direction,
//  improving PF and WR
// ══════════════════════════════════════════════════════════
import { type OHLCV } from "../../server/analysis";

const COINS      = ["FIL", "PEPE", "SAND", "INJ", "SUI", "SOL"];
const INTERVAL   = "1h";
const WINDOW     = 220;
const MAX_BARS   = 200;
const COOLDOWN   = 12;
const TOTAL_BARS = 16000; // 22 months for robustness

// ── Helpers ─────────────────────────────────────────────────────────
function ema(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(0);
  const k = 2 / (period + 1);
  result[0] = values[0];
  for (let i = 1; i < values.length; i++) result[i] = values[i]*k + result[i-1]*(1-k);
  return result;
}
function calcATR(candles: OHLCV[], period = 14): number {
  let atr = 0;
  for (let i = Math.max(1, candles.length-period); i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i-1].close;
    atr += Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc));
  }
  return atr / period;
}
function findSwingPoints(candles: OHLCV[], lookback: number) {
  const highs: number[] = [], lows: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const h = candles[i].high, l = candles[i].low;
    if (candles.slice(i-lookback,i).every(c=>c.high<=h) && candles.slice(i+1,i+lookback+1).every(c=>c.high<=h)) highs.push(h);
    if (candles.slice(i-lookback,i).every(c=>c.low>=l)  && candles.slice(i+1,i+lookback+1).every(c=>c.low>=l)) lows.push(l);
  }
  return { highs, lows };
}
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period+1) return 50;
  let avgGain=0, avgLoss=0;
  for (let i=1;i<=period;i++) {
    const d = closes[i]-closes[i-1];
    if (d>0) avgGain+=d; else avgLoss-=d;
  }
  avgGain/=period; avgLoss/=period;
  for (let i=period+1;i<closes.length;i++) {
    const d = closes[i]-closes[i-1];
    avgGain=(avgGain*(period-1)+(d>0?d:0))/period;
    avgLoss=(avgLoss*(period-1)+(d<0?-d:0))/period;
  }
  return avgLoss===0 ? 100 : 100-100/(1+avgGain/avgLoss);
}

interface SweepSig {
  type: "LONG"|"SHORT"|"NONE";
  entry: number; sl: number; tp1: number; tp2: number;
  conf: number; volRatio: number; wickRatio: number;
}

function sweepSignal(candles: OHLCV[], minWickRatio: number): SweepSig {
  const none: SweepSig = { type:"NONE", entry:0, sl:0, tp1:0, tp2:0, conf:0, volRatio:0, wickRatio:0 };
  if (candles.length < 220) return none;
  const last   = candles.length - 1;
  const closes = candles.map(c=>c.close);
  const price  = closes[last];
  const ema200 = ema(closes, 200);
  const macroUp = price > ema200[last] && ema200[last] > ema200[last-20];
  const rsiNow = calcRSI(closes.slice(-50));
  const atr    = calcATR(candles);
  const sigCandles = candles.slice(-100);
  const volAvg20 = sigCandles.slice(-20).reduce((s,c)=>s+c.volume,0)/20;
  const swings = findSwingPoints(sigCandles, 3);
  if (swings.highs.length < 2 || swings.lows.length < 2) return none;

  const EQ_TOL = 0.004;
  const highPools: {price:number;touches:number;isEqual:boolean}[] = [];
  const lowPools:  {price:number;touches:number;isEqual:boolean}[] = [];
  for (const h of swings.highs) {
    const ex = highPools.find(p=>Math.abs(p.price-h)/price < EQ_TOL);
    if (ex) { ex.price=(ex.price+h)/2; ex.touches++; ex.isEqual=true; }
    else highPools.push({price:h,touches:1,isEqual:false});
  }
  for (const l of swings.lows) {
    const ex = lowPools.find(p=>Math.abs(p.price-l)/price < EQ_TOL);
    if (ex) { ex.price=(ex.price+l)/2; ex.touches++; ex.isEqual=true; }
    else lowPools.push({price:l,touches:1,isEqual:false});
  }
  const nearHighs = highPools.filter(p=>{const d=Math.abs(p.price-price)/price; return p.price>price&&d<0.08&&d>0.003;});
  const nearLows  = lowPools.filter(p=>{const d=Math.abs(p.price-price)/price; return p.price<price&&d<0.08&&d>0.003;});

  const sweeps: {dir:"bullish"|"bearish";pool:typeof lowPools[0];candle:OHLCV;wr:number;vr:number}[] = [];
  const lIdx = sigCandles.length - 1;
  for (let i = Math.max(0, lIdx-2); i <= lIdx; i++) {
    const c    = sigCandles[i];
    const body = Math.abs(c.close - c.open);
    const vr   = volAvg20 > 0 ? c.volume/volAvg20 : 1;
    for (const pool of nearLows) {
      const tol = atr*0.08;
      if (c.low < pool.price-tol && c.close > pool.price) {
        const wr = body>0 ? (pool.price-c.low)/body : 2.0;
        if (wr >= minWickRatio && vr >= 1.1) sweeps.push({dir:"bullish",pool,candle:c,wr,vr});
      }
    }
    for (const pool of nearHighs) {
      const tol = atr*0.08;
      if (c.high > pool.price+tol && c.close < pool.price) {
        const wr = body>0 ? (c.high-pool.price)/body : 2.0;
        if (wr >= minWickRatio && vr >= 1.1) sweeps.push({dir:"bearish",pool,candle:c,wr,vr});
      }
    }
  }
  if (sweeps.length === 0) return none;
  const best = sweeps.sort((a,b)=>b.wr*b.vr*(b.pool.isEqual?1.5:1) - a.wr*a.vr*(a.pool.isEqual?1.5:1))[0];

  if (best.dir==="bullish" && rsiNow>68) return none;
  if (best.dir==="bearish" && rsiNow<32) return none;
  if (best.dir==="bullish" && !macroUp) return none;

  const sc = best.candle;
  let entry = sc.close;
  let sl    = best.dir==="bullish" ? sc.low-atr*0.15 : sc.high+atr*0.15;
  if (Math.abs(entry-sl) < atr*0.5) sl = best.dir==="bullish" ? entry-atr*0.5 : entry+atr*0.5;
  const risk = Math.abs(entry-sl);
  if (risk<=0) return none;

  // Simple fixed TP for fair comparison
  const tp1 = best.dir==="bullish" ? entry+risk*1.5 : entry-risk*1.5;
  const tp2 = best.dir==="bullish" ? entry+risk*2.5 : entry-risk*2.5;
  if (Math.abs(tp1-entry)/risk < 2.0) return none;

  let conf = 60;
  if (best.pool.isEqual)      conf += 10;
  if (best.wr >= 1.5)         conf += 5;
  if (best.vr >= 1.5)         conf += 5;
  if (best.dir==="bullish" && rsiNow<40) conf += 5;
  if (best.dir==="bearish" && rsiNow>60) conf += 5;
  if (best.dir==="bullish" && macroUp)   conf += 5;
  conf = Math.min(conf, 88);
  if (conf < 68) return none;

  return { type: best.dir==="bullish"?"LONG":"SHORT", entry, sl, tp1, tp2, conf, volRatio:best.vr, wickRatio:best.wr };
}

// ── Backtest engine ────────────────────────────────────────────────
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

function simulate(allCandles: OHLCV[], minWickRatio: number) {
  const trades: {time:number;pnl:number;win:boolean}[] = [];
  let lastIdx = -COOLDOWN;
  for (let i=WINDOW;i<allCandles.length-MAX_BARS;i++) {
    if (i-lastIdx<COOLDOWN) continue;
    const slice = allCandles.slice(Math.max(0,i-WINDOW+1),i+1);
    const sig   = sweepSignal(slice, minWickRatio);
    if (sig.type==="NONE") continue;
    const isLong = sig.type==="LONG";
    const future = allCandles.slice(i+1,i+1+MAX_BARS);
    let outcome: "tp1"|"tp2"|"loss"|"timeout" = "timeout";
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
    const risk=Math.abs(sig.entry-sig.sl), r1=Math.abs(sig.tp1-sig.entry), r2=Math.abs(sig.tp2-sig.entry);
    let pnl: number, win: boolean;
    if (outcome==="tp2")  {pnl=(r2/sig.entry)*100;win=true;}
    else if (outcome==="tp1") {pnl=(r1/sig.entry)*100;win=true;}
    else if (outcome==="loss") {pnl=-(risk/sig.entry)*100;win=false;}
    else {
      const exit=future[future.length-1]?.close??sig.entry;
      pnl=isLong?((exit-sig.entry)/sig.entry)*100:((sig.entry-exit)/sig.entry)*100;
      win=pnl>=0;
    }
    lastIdx=i;
    trades.push({time:allCandles[i].time,pnl,win});
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
  const r12 = simulate(allCandles, 1.2);
  console.log(`\n${symbol}`);
  print(r08, "wick≥0.8 (baseline)");
  print(r10, "wick≥1.0 (proposed)");
  print(r12, "wick≥1.2 (proposed)");
  const pfDiff10=r10.pf-r08.pf, pfDiff12=r12.pf-r08.pf;
  console.log(`  → wick≥1.0: PF ${pfDiff10>=0?"+":""}${pfDiff10.toFixed(2)} T${r10.T-r08.T}`);
  console.log(`  → wick≥1.2: PF ${pfDiff12>=0?"+":""}${pfDiff12.toFixed(2)} T${r12.T-r08.T}`);
}

(async ()=>{
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Liquidity Sweep — Wick Ratio Filter: 0.8 vs 1.0 vs 1.2`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (22 months)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`DECISION: Apply if PF improves ≥0.05 on average AND T remains ≥20/coin\n`);
})();
