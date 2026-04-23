// ══════════════════════════════════════════════════════════════════
//  Verify MEXC discovery winners with PRODUCTION gates
//
//  The discover script used research gates (STRONG_BUY for Swing, no
//  conf filter for LiqSweep). Production strategy files apply stricter
//  gates. This re-runs the winners with the real gates to confirm
//  PF ≥ 2 still holds before adding to preferredSymbols.
// ══════════════════════════════════════════════════════════════════
import {
  analyzeIndicators, generateSignal,
  liquiditySweepSignal,
  type OHLCV,
} from "../../server/analysis.ts";

// ── Candidates from discover-mexc-all.ts run ──
const SWING_WINNERS    = ["ZRO"];
const LIQSWEEP_WINNERS = ["SHIB", "LUNC", "WLD", "ENA", "PAXG", "APT", "SPK", "SEI", "HBAR"];

const TOTAL_BARS = 8000;

async function fetchBinance(symbol: string, interval: "1h"): Promise<OHLCV[] | null> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(TOTAL_BARS / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=${interval}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
      if (!res.ok) return null;
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
    } catch { return null; }
    await new Promise(r => setTimeout(r, 80));
  }
  return candles;
}

function simTwoTargets(
  isLong: boolean, entry: number, sl: number, tp1: number, tp2: number, future: OHLCV[],
): { outcome: "tp1" | "tp2" | "loss" | "timeout"; hitTp1: boolean } {
  let hitTp1 = false;
  for (const c of future) {
    if (isLong) {
      if (c.low  <= sl)  return { outcome: hitTp1 ? "tp1" : "loss", hitTp1 };
      if (!hitTp1 && c.high >= tp1) hitTp1 = true;
      if (c.high >= tp2) return { outcome: "tp2", hitTp1: true };
    } else {
      if (c.high >= sl)  return { outcome: hitTp1 ? "tp1" : "loss", hitTp1 };
      if (!hitTp1 && c.low  <= tp1) hitTp1 = true;
      if (c.low  <= tp2) return { outcome: "tp2", hitTp1: true };
    }
  }
  return { outcome: hitTp1 ? "tp1" : "timeout", hitTp1 };
}

function pnl(isLong: boolean, outcome: string, entry: number, sl: number, tp1: number, tp2: number, future: OHLCV[]): { pnl: number; win: boolean } {
  if (outcome === "tp2") return { pnl: (Math.abs(tp2 - entry) / entry) * 100, win: true };
  if (outcome === "tp1") return { pnl: (Math.abs(tp1 - entry) / entry) * 100, win: true };
  if (outcome === "loss") return { pnl: -(Math.abs(entry - sl) / entry) * 100, win: false };
  const exit = future.length > 0 ? future[future.length - 1].close : entry;
  const p = isLong ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
  return { pnl: p, win: p >= 0 };
}

function summarise(trades: { pnl: number; win: boolean; year: number }[]) {
  const T = trades.length;
  const wins   = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const grossW = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf = grossL > 0 ? grossW / grossL : Infinity;
  const years: Record<number, number> = {};
  for (const t of trades) years[t.year] = (years[t.year] ?? 0) + t.pnl;
  const yrStr = Object.keys(years).sort().map(y => {
    const v = years[parseInt(y)];
    return `${y}:${v>=0?"+":""}${v.toFixed(0)}`;
  }).join(" ");
  return { T, wr: (wins.length / Math.max(T,1)) * 100, pf: Math.round(pf*100)/100, net: Math.round((grossW-grossL)*10)/10, yrStr };
}

function btSwingProd(c: OHLCV[]) {
  const WINDOW = 250, MAX = 800, CD = 20;
  const trades: { pnl: number; win: boolean; year: number }[] = [];
  let lastIdx = -CD;
  for (let i = WINDOW; i < c.length - MAX; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const ind = analyzeIndicators(w);
    const sig = generateSignal(w, ind);
    if (sig.type === "HOLD") continue;
    if (!sig.entry || !sig.stopLoss || !sig.takeProfit1 || !sig.takeProfit2) continue;
    // PRODUCTION gate: score >= 4 (abs)
    if (Math.abs(sig.confluenceScore) < 4) continue;
    lastIdx = i;
    const isLong = sig.type === "BUY" || sig.type === "STRONG_BUY";
    const future = c.slice(i + 1, i + 1 + MAX);
    const { outcome } = simTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit1, sig.takeProfit2, future);
    const r = pnl(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit1, sig.takeProfit2, future);
    trades.push({ ...r, year: new Date(c[i].time * 1000).getFullYear() });
  }
  return summarise(trades);
}

function btLiqSweepProd(c: OHLCV[]) {
  const WINDOW = 220, MAX = 200, CD = 12;
  const trades: { pnl: number; win: boolean; year: number }[] = [];
  let lastIdx = -CD;
  for (let i = WINDOW; i < c.length - MAX; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const sig = liquiditySweepSignal(w);
    if (sig.type === "NONE") continue;
    // PRODUCTION gate: confidence >= 68
    if (sig.confidence < 68) continue;
    lastIdx = i;
    const isLong = sig.type === "LONG";
    const future = c.slice(i + 1, i + 1 + MAX);
    const { outcome } = simTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future);
    const r = pnl(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future);
    trades.push({ ...r, year: new Date(c[i].time * 1000).getFullYear() });
  }
  return summarise(trades);
}

(async () => {
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  Verify MEXC winners with PRODUCTION gates");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  console.log("── Confluence Swing (production gate: score≥4) ──");
  for (const sym of SWING_WINNERS) {
    const c = await fetchBinance(sym, "1h");
    if (!c || c.length < 1100) { console.log(`  ${sym}: no/insufficient data`); continue; }
    const s = btSwingProd(c);
    const keep = s.pf >= 2 && s.T >= 40 ? "🏆 CONFIRMED" : s.pf >= 1.5 && s.T >= 40 ? "🟡 solid" : "❌ drops below 2";
    console.log(`  ${sym.padEnd(8)} T=${s.T} WR=${s.wr.toFixed(1)}% PF=${s.pf} net=${s.net}%  ${keep}`);
    console.log(`           [${s.yrStr}]`);
  }

  console.log("\n── Liquidity Sweep (production gate: conf≥68) ──");
  for (const sym of LIQSWEEP_WINNERS) {
    const c = await fetchBinance(sym, "1h");
    if (!c || c.length < 450) { console.log(`  ${sym}: no/insufficient data`); continue; }
    const s = btLiqSweepProd(c);
    const keep = s.pf >= 2 && s.T >= 40 ? "🏆 CONFIRMED" : s.pf >= 1.5 && s.T >= 40 ? "🟡 solid" : "❌ drops below 2";
    console.log(`  ${sym.padEnd(8)} T=${s.T} WR=${s.wr.toFixed(1)}% PF=${s.pf} net=${s.net}%  ${keep}`);
    console.log(`           [${s.yrStr}]`);
  }
})();
