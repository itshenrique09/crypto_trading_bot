import { breakRetestSignal, type OHLCV } from "./server/analysis";

async function fetchKlines(symbol: string, limit = 200): Promise<OHLCV[]> {
  const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=4h&limit=${limit}`);
  const data = await res.json() as any[];
  return data.map((k: any[]) => ({ time: Math.floor(k[0]/1000), open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]) }));
}

(async () => {
  console.log("\n── Live Signal Verification ──");
  for (const coin of ["ETH", "SOL", "BTC", "XRP", "DOT"]) {
    const candles = await fetchKlines(coin, 200);
    const sig = breakRetestSignal(candles);
    const line = sig.type === "NONE"
      ? `${coin}: HOLD (no setup)`
      : `${coin}: ${sig.type} @${sig.entry.toFixed(4)} conf=${sig.confidence}% — ${sig.reason.slice(0,55)}`;
    console.log(line);
  }
  console.log("── Done ──\n");
})();
