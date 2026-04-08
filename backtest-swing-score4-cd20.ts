// ══════════════════════════════════════════════════════════
//  Confluence Swing — Score ≥ 4 · COOLDOWN=20 bars (4H)
//  • COOLDOWN=20 bars = 80h ≈ 3.3 days between trades/coin
//  • Goal: balance between trade count and signal quality
//  • Also breaks down by score tier: 4-5 vs 6+
// ══════════════════════════════════════════════════════════
import { analyzeIndicators, generateSignal, type OHLCV } from "./server/analysis";

const COINS      = [
  "BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "LINK",
  "MATIC", "UNI", "ATOM", "LTC", "BCH", "AAVE", "ALGO", "VET", "XLM", "TRX",
  "ETC", "FIL", "NEAR", "ICP", "SAND",
];
const WINDOW     = 250;
const MAX_BARS   = 200;
const COOLDOWN   = 20;   // 20×4H = 80h ≈ 3.3 days
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

function calcMetrics(trades: TradeRecord[]): string {
  const T = trades.length;
  if (T === 0) return "T=0";
  const wins   = trades.filter(t => t.outcome === "win");
  const losses = trades.filter(t => t.outcome === "loss");
  const grossW = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf     = grossL > 0 ? grossW / grossL : Infinity;
  const wr     = (wins.length / T) * 100;
  const pfNum  = Math.round(pf * 100) / 100;
  const status = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const avgW   = wins.length > 0 ? grossW / wins.length : 0;
  const avgL   = losses.length > 0 ? grossL / losses.length : 0;
  const exp    = (wr/100)*avgW - ((100-wr)/100)*avgL;

  // Per-year
  const yrMap: Record<number, number> = {};
  for (const t of trades) {
    const yr = new Date(t.time * 1000).getFullYear();
    yrMap[yr] = (yrMap[yr] ?? 0) + t.pnlPct;
  }
  const yrStr = Object.keys(yrMap).sort().map(yr => {
    const v = yrMap[parseInt(yr)];
    return `${yr}:${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
  }).join(" ");

  return `T=${T}  WR=${wr.toFixed(1)}%  PF=${pfNum}  ${status}  Exp=${exp.toFixed(3)}%  | ${yrStr}`;
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) {
    console.log(`${symbol}: not enough data`);
    return;
  }

  const tradesAll: TradeRecord[] = [];
  let lastTradeIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastTradeIdx < COOLDOWN) continue;

    const window     = allCandles.slice(i - WINDOW, i + 1);
    const indicators = analyzeIndicators(window);
    const signal     = generateSignal(window, indicators);

    const isBuyish  = signal.type === "STRONG_BUY"  || signal.type === "BUY";
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
        if (c.low  <= signal.stopLoss)               { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.high >= signal.takeProfit1)   hitTp1 = true;
        if (c.high >= signal.takeProfit2)            { outcome = "tp2"; break; }
      } else {
        if (c.high >= signal.stopLoss)               { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.low  <= signal.takeProfit1)   hitTp1 = true;
        if (c.low  <= signal.takeProfit2)            { outcome = "tp2"; break; }
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
      pnlPct = isBuy ? ((exit - signal.entry) / signal.entry) * 100
                     : ((signal.entry - exit) / signal.entry) * 100;
      outcomeLabel = pnlPct >= 0 ? "win" : "loss";
    }

    tradesAll.push({ time: allCandles[i].time, dir: isBuy ? "LONG" : "SHORT", pnlPct, outcome: outcomeLabel, score: signal.score });
  }

  const tradesStrong = tradesAll.filter(t => Math.abs(t.score) >= 6);
  const tradesMid    = tradesAll.filter(t => Math.abs(t.score) < 6);

  console.log(`\n${symbol}`);
  console.log(`  ALL  (≥4, CD=20): ${calcMetrics(tradesAll)}`);
  console.log(`  STR  (≥6, CD=20): ${calcMetrics(tradesStrong)}`);
  console.log(`  MID  (4-5, CD=20): ${calcMetrics(tradesMid)}`);
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Confluence Swing — Score≥4  COOLDOWN=20bars (4H)`);
  console.log(`  COOLDOWN=20 bars = 80h ≈ 3.3 days/coin`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0\n`);
})();
