// Smoke test for the MEXC feed option: fetch the same 1h window from MEXC
// futures and Binance spot and report the basis (close) and wick differences.
// Run: npx tsx script/audit/phase9-feed-smoke.ts [SYM=BTC] [N=3000]
import { fetchMexcPaginated } from "./feed";
import { fetchPaginated } from "./lib";

async function main() {
  const sym = process.argv[2] ?? "BTC";
  const n = parseInt(process.argv[3] ?? "3000");
  const m = await fetchMexcPaginated(sym, "1h", n, "script/.cache", new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const b = await fetchPaginated(sym, "1h", n);
  console.log(`${sym} mexc n=${m.length} ${new Date(m[0].time * 1000).toISOString()} → ${new Date(m[m.length - 1].time * 1000).toISOString()}`);
  console.log(`${sym} binance n=${b.length} ${new Date(b[0].time * 1000).toISOString()} → ${new Date(b[b.length - 1].time * 1000).toISOString()}`);
  const bm = new Map(b.map(c => [c.time, c]));
  let k = 0, sumC = 0, absC = 0, sumH = 0, sumL = 0, wickBigger = 0;
  for (const c of m) {
    const x = bm.get(c.time); if (!x) continue; k++;
    const dc = (c.close - x.close) / x.close * 1e4; sumC += dc; absC += Math.abs(dc);
    sumH += (c.high - x.high) / x.high * 1e4; sumL += (c.low - x.low) / x.low * 1e4;
    if ((c.high - c.low) > (x.high - x.low)) wickBigger++;
  }
  console.log(`matched=${k} close basis mean=${(sumC / k).toFixed(2)}bps mean|Δclose|=${(absC / k).toFixed(2)}bps Δhigh mean=${(sumH / k).toFixed(2)}bps Δlow mean=${(sumL / k).toFixed(2)}bps MEXC range wider in ${(100 * wickBigger / k).toFixed(0)}% of bars`);
}
main().catch(e => { console.error(e); process.exit(1); });
