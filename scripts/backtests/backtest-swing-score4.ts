// ══════════════════════════════════════════════════════════
//  Confluence Swing — Score ≥ 4 Test (4H)
//  • Tests BUY/SELL signals (score ±4-5) vs STRONG (±6)
//  • Goal: see if lower threshold still profitable
//  • If PF holds → more trades by lowering filter in live
// ══════════════════════════════════════════════════════════
import { analyzeIndicators, generateSignal, type OHLCV } from "../../server/analysis";

const COINS      = [
  "BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "LINK",
  "MATIC", "UNI", "ATOM", "LTC", "BCH", "AAVE", "ALGO", "VET", "XLM", "TRX",
  "ETC", "FIL", "NEAR", "ICP", "SAND",
];
const WINDOW     = 250;
const MAX_BARS   = 200;
const COOLDOWN   = 5;
const TOTAL_BARS = 8000;

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(TOTAL_BARS / batchSize);

  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=4h&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const res  = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
    const data = await res.json() as any[];
    if (!Array.isArray(data) || data.length === 0) break;
    const batch: OHLCV[] = data.map((k: any[]) => ({
      time:   Math.floor(k[0] / 1000),
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;
  }
  return candles;
}

interface TradeRecord {
  time:    number;
  dir:     "LONG" | "SHORT";
  pnlPct:  number;
  outcome: "win" | "loss";
  score:   number;
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  const tradesAll:    TradeRecord[] = [];
  const tradesStrong: TradeRecord[] = [];
  let lastTradeIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastTradeIdx < COOLDOWN) continue;

    const window     = allCandles.slice(i - WINDOW, i + 1);
    const indicators = analyzeIndicators(window);
    const signal     = generateSignal(window, indicators);

    // Accept score ≥ 4 (BUY/SELL and STRONG_BUY/STRONG_SELL)
    const isStrong = signal.type === "STRONG_BUY" || signal.type === "STRONG_SELL";
    const isBuyish = signal.type === "STRONG_BUY" || signal.type === "BUY";
    const isSellish = signal.type === "STRONG_SELL" || signal.type === "SELL";
    if (!isBuyish && !isSellish) continue;
    if (!signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

    lastTradeIdx = i;
    const isBuy  = isBuyish;
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);

    let outcome: "tp1" | "tp2" | "loss" | "pending" = "pending";
    let hitTp1 = false;

    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isBuy) {
        if (c.low  <= signal.stopLoss)                     { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.high >= signal.takeProfit1)         hitTp1 = true;
        if (c.high >= signal.takeProfit2)                  { outcome = "tp2"; break; }
      } else {
        if (c.high >= signal.stopLoss)                     { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.low  <= signal.takeProfit1)         hitTp1 = true;
        if (c.low  <= signal.takeProfit2)                  { outcome = "tp2"; break; }
      }
    }
    if (outcome === "pending" && hitTp1) outcome = "tp1";

    const risk      = Math.abs(signal.entry - signal.stopLoss);
    const tp1Reward = Math.abs(signal.takeProfit1 - signal.entry);
    const tp2Reward = Math.abs(signal.takeProfit2 - signal.entry);

    let pnlPct: number;
    let outcomeLabel: "win" | "loss";

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

    const rec: TradeRecord = { time: allCandles[i].time, dir: isBuy ? "LONG" : "SHORT", pnlPct, outcome: outcomeLabel, score: signal.score };
    tradesAll.push(rec);
    if (isStrong) tradesStrong.push(rec);
  }

  const printMetrics = (trades: TradeRecord[], label: string) => {
    const wins   = trades.filter(t => t.outcome === "win");
    const losses = trades.filter(t => t.outcome === "loss");
    const T      = trades.length;
    if (T === 0) { console.log(`  ${label}: 0 trades`); return; }
    const grossW     = wins.reduce((s, t) => s + t.pnlPct, 0);
    const grossL     = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
    const pf         = grossL > 0 ? grossW / grossL : Infinity;
    const wr         = (wins.length / T) * 100;
    const pfNum      = Math.round(pf * 100) / 100;
    const status     = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
    console.log(`  ${label}: T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  ${status}`);
  };

  console.log(`\n${symbol}`);
  printMetrics(tradesStrong, "STRONG (≥6)");
  printMetrics(tradesAll,    "ALL    (≥4)");
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Confluence Swing — Score Threshold Test (4H)`);
  console.log(`  Comparing STRONG (≥6) vs ALL signals (≥4)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0\n`);
})();
