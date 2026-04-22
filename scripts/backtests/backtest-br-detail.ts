// Detailed trade breakdown for debugging problem coins
import { breakRetestSignal, type OHLCV } from "../../server/analysis";

const COINS = process.argv[2] ? [process.argv[2]] : ["DOT", "DOGE", "BNB", "XRP"];
const WINDOW = 60, TIME_STOP = 15, COOLDOWN = 3, LEVEL_COOLDOWN = 20;

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=4h&limit=1000`;
  const res = await fetch(url);
  const data = await res.json() as any[];
  return data.map((k: any[]) => ({
    time: Math.floor(k[0]/1000), open: parseFloat(k[1]),
    high: parseFloat(k[2]), low: parseFloat(k[3]),
    close: parseFloat(k[4]), volume: parseFloat(k[5])
  }));
}

async function run(symbol: string) {
  const all = await fetchKlines(symbol);
  let lastTrade = -COOLDOWN;
  const lvlCD = new Map<string, number>();

  const wins: number[] = [], losses: number[] = [];
  console.log(`\n══════ ${symbol} (${all.length} bars) ══════`);

  for (let i = WINDOW; i < all.length - TIME_STOP; i++) {
    if (i - lastTrade < COOLDOWN) continue;
    const sig = breakRetestSignal(all.slice(i - WINDOW, i + 1));
    if (sig.type === "NONE") continue;
    const key = (sig.level ?? 0).toFixed(3) + "_" + sig.type;
    const prev = lvlCD.get(key) ?? -999;
    if (i - prev < LEVEL_COOLDOWN) continue;
    lvlCD.set(key, i); lastTrade = i;

    const isLong = sig.type === "LONG";
    const future = all.slice(i+1, i+1+TIME_STOP);
    let outcome = "timeout", bars = TIME_STOP;
    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isLong) {
        if (c.low  <= sig.stopLoss)   { outcome="sl"; bars=j+1; break; }
        if (c.high >= sig.takeProfit) { outcome="tp"; bars=j+1; break; }
      } else {
        if (c.high >= sig.stopLoss)   { outcome="sl"; bars=j+1; break; }
        if (c.low  <= sig.takeProfit) { outcome="tp"; bars=j+1; break; }
      }
    }

    const risk   = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit - sig.entry);
    const exit   = future[future.length-1]?.close ?? sig.entry;
    const pnl    = outcome==="tp"
      ? (reward/sig.entry)*100
      : outcome==="sl"
      ? -(risk/sig.entry)*100
      : isLong ? ((exit-sig.entry)/sig.entry)*100 : ((sig.entry-exit)/sig.entry)*100;

    const rr     = (reward/risk).toFixed(2);
    const mark   = pnl > 0 ? "✅" : "❌";
    const date   = new Date(all[i].time * 1000).toISOString().slice(0,10);
    console.log(
      `  ${mark} ${date} ${isLong?"LONG":"SHRT"} @${sig.entry.toFixed(4)}`+
      `  SL=${sig.stopLoss.toFixed(4)}  RR=${rr}  → ${outcome.padEnd(7)} ${pnl.toFixed(1).padStart(6)}%  bars=${bars}`
    );

    if (pnl > 0) wins.push(pnl); else losses.push(pnl);
  }

  const t = wins.length + losses.length;
  const gW = wins.reduce((s,x)=>s+x,0);
  const gL = Math.abs(losses.reduce((s,x)=>s+x,0));
  const pf = gL > 0 ? (gW/gL).toFixed(2) : "∞";
  const wr = t > 0 ? ((wins.length/t)*100).toFixed(1) : "0";
  console.log(`  ── Summary: T=${t} WR=${wr}% PF=${pf} ──`);
}

(async () => { for (const c of COINS) await run(c); })();
