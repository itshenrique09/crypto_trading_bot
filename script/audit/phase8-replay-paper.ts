// Replay each paper trade's signal candle on MEXC futures vs Binance spot 1h data.
// Answers: which data source did the engine use (entry == which close?), does the
// same signal fire on Binance data (what the backtest sees), and how far apart are
// the two venues' wicks/closes at the signal bar.
import { readFileSync } from "fs";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import { parseMexcKlineData, toMexcContractInterval, MEXC_CONTRACT_OVERRIDES } from "../../server/mexc-market";
import type { OHLCV } from "../../server/analysis";

const paper = JSON.parse(readFileSync("C:/Users/henri/Downloads/trades-paper-2026-09-01.json", "utf-8")).trades as any[];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function binance(sym: string, endMs: number, n = 235): Promise<OHLCV[]> {
  const startMs = endMs - n * 3_600_000;
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1h&startTime=${startMs}&endTime=${endMs - 1}&limit=1000`;
  const r = await fetch(url); const d: any[][] = await r.json();
  return d.map(k => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
}
async function mexc(sym: string, endSec: number, n = 235): Promise<OHLCV[]> {
  const contract = MEXC_CONTRACT_OVERRIDES[sym] ?? `${sym}_USDT`;
  const url = `https://contract.mexc.com/api/v1/contract/kline/${contract}?interval=${toMexcContractInterval("1h")}&start=${endSec - n * 3600}&end=${endSec - 1}`;
  const r = await fetch(url); const j = await r.json();
  if (!j?.data) throw new Error(`mexc ${sym}: ${JSON.stringify(j).slice(0, 120)}`);
  return parseMexcKlineData(j.data).filter(c => c.time < endSec);
}

(async () => {
  const rows: any[] = [];
  for (const t of paper.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (t.strategy !== "liquidity-sweep") continue;
    const created = new Date(t.created_at).getTime();
    // signal candle = last CLOSED 1h candle at scan time → its close time is the top of the hour ≤ created
    const closeMs = Math.floor(created / 3_600_000) * 3_600_000;
    try {
      const [b, m] = await Promise.all([binance(t.symbol, closeMs), mexc(t.symbol, closeMs / 1000)]);
      const bl = b[b.length - 1], ml = m[m.length - 1];
      const sb = liquiditySweepStrategy.analyze(b), sm = liquiditySweepStrategy.analyze(m);
      const src = Math.abs(ml.close - t.entry_price) / t.entry_price < 1e-6 ? "MEXC" : Math.abs(bl.close - t.entry_price) / t.entry_price < 1e-6 ? "BINANCE" : "?";
      rows.push({
        trade: `${t.created_at.slice(5, 16)} ${t.symbol} ${t.direction} c${t.confluence_score} R=${(t.pnl_usd / t.risk_usd).toFixed(2)}`,
        entry: t.entry_price, mexcClose: ml.close, binClose: bl.close, src,
        lowDiffBps: Math.round((ml.low - bl.low) / bl.low * 1e4), highDiffBps: Math.round((ml.high - bl.high) / bl.high * 1e4),
        sigMEXC: sm ? `${sm.direction} c${sm.confidence}` : "none",
        sigBIN: sb ? `${sb.direction} c${sb.confidence}` : "none",
        nB: b.length, nM: m.length,
      });
    } catch (e: any) { rows.push({ trade: `${t.created_at.slice(5, 16)} ${t.symbol}`, err: e.message?.slice(0, 80) }); }
    await sleep(250);
  }
  console.table(rows);
  const ok = rows.filter(r => !r.err);
  console.log("engine source:", ok.reduce((a: any, r) => { a[r.src] = (a[r.src] || 0) + 1; return a; }, {}));
  console.log("signal fires on BINANCE too:", ok.filter(r => r.sigBIN !== "none").length, "/", ok.length, "| fires on MEXC replay:", ok.filter(r => r.sigMEXC !== "none").length);
  console.log("same direction+conf on both:", ok.filter(r => r.sigBIN === r.sigMEXC && r.sigBIN !== "none").length);
})();
