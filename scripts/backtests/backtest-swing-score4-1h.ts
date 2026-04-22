// ══════════════════════════════════════════════════════════
//  Confluence Swing — 1H Score Threshold Test: ≥6 vs ≥4
//  Preferred coins only (ICP, MATIC, BNB, NEAR, AVAX, SOL, DOT, VET, XRP, BTC)
//  COOLDOWN=20h (production value)
//  Goal: see if including BUY/SELL (score 4-5) adds useful trades
// ══════════════════════════════════════════════════════════
import { analyzeIndicators, generateSignal, type OHLCV } from "../../server/analysis";

const COINS      = ["ICP", "BNB", "NEAR", "AVAX", "SOL", "DOT", "VET", "XRP", "BTC", "MATIC"];
const INTERVAL   = "1h";
const WINDOW     = 250;
const MAX_BARS   = 800;   // 50 days max hold (same as 1H backtest)
const COOLDOWN   = 20;    // production value
const TOTAL_BARS = 32000;

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(TOTAL_BARS / batchSize);
  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=${INTERVAL}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const res  = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
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
  }
  return candles;
}

interface TradeRecord { time: number; pnlPct: number; outcome: "win"|"loss"; isStrong: boolean; }

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  const allTrades:    TradeRecord[] = [];
  const strongTrades: TradeRecord[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;

    const window     = allCandles.slice(i - WINDOW, i + 1);
    const indicators = analyzeIndicators(window);
    const signal     = generateSignal(window, indicators);

    const isStrong = signal.type === "STRONG_BUY" || signal.type === "STRONG_SELL";
    const isBuyish = signal.type === "STRONG_BUY" || signal.type === "BUY";
    const isSellish = signal.type === "STRONG_SELL" || signal.type === "SELL";
    if (!isBuyish && !isSellish) continue;
    if (!signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

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

    const risk      = Math.abs(signal.entry - signal.stopLoss);
    const tp1Reward = Math.abs(signal.takeProfit1 - signal.entry);
    const tp2Reward = Math.abs(signal.takeProfit2 - signal.entry);
    let pnlPct: number;
    let outcomeLabel: "win"|"loss";
    if (outcome === "tp2") {
      pnlPct = (tp2Reward / signal.entry) * 100; outcomeLabel = "win";
    } else if (outcome === "tp1") {
      pnlPct = (tp1Reward / signal.entry) * 100; outcomeLabel = "win";
    } else if (outcome === "loss") {
      pnlPct = -(risk / signal.entry) * 100; outcomeLabel = "loss";
    } else {
      const exit = future[future.length - 1]?.close ?? signal.entry;
      pnlPct = isBuy
        ? ((exit - signal.entry) / signal.entry) * 100
        : ((signal.entry - exit) / signal.entry) * 100;
      outcomeLabel = pnlPct >= 0 ? "win" : "loss";
    }

    const rec: TradeRecord = { time: allCandles[i].time, pnlPct, outcome: outcomeLabel, isStrong };
    allTrades.push(rec);
    if (isStrong) strongTrades.push(rec);
  }

  const printGroup = (trades: TradeRecord[], label: string) => {
    const T = trades.length;
    if (T === 0) { console.log(`  ${label}: 0 trades`); return; }
    const wins   = trades.filter(t => t.outcome === "win");
    const losses = trades.filter(t => t.outcome === "loss");
    const grossW = wins.reduce((s, t) => s + t.pnlPct, 0);
    const grossL = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
    const pf     = grossL > 0 ? grossW / grossL : Infinity;
    const wr     = (wins.length / T) * 100;
    const pfNum  = Math.round(pf * 100) / 100;
    const status = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
    const badge  = T >= 100 ? "" : T >= 50 ? " ⚠️" : " 💀";
    const yearMap: Record<number, number> = {};
    for (const t of trades) {
      const yr = new Date(t.time * 1000).getFullYear();
      yearMap[yr] = (yearMap[yr] ?? 0) + t.pnlPct;
    }
    const yrStr = Object.keys(yearMap).sort().map(yr => {
      const v = yearMap[parseInt(yr)];
      return `${yr}:${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
    }).join(" ");
    console.log(`  ${label}${badge}: T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  ${status}  [${yrStr}]`);
  };

  const extra = allTrades.length - strongTrades.length;
  console.log(`\n${symbol}`);
  printGroup(strongTrades, "score≥6 STRONG (baseline)");
  printGroup(allTrades,    "score≥4 ALL    (proposed)");
  if (extra > 0) {
    const extraTrades = allTrades.filter(t => !t.isStrong);
    const extraWins   = extraTrades.filter(t => t.outcome === "win").length;
    console.log(`  → +${extra} trades from score 4-5 (${extraWins}W/${extra-extraWins}L)`);
  }
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Confluence Swing 1H — Score ≥6 vs ≥4 (preferred coins)`);
  console.log(`  COOLDOWN=${COOLDOWN}h · ${TOTAL_BARS} bars (3.7 years)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0  ⚠️ T<100  💀 T<50`);
  console.log(`\nDECISION: Apply score≥4 if PF stays ≥1.4 on majority of coins AND no new ❌\n`);
})();
