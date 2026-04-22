// ══════════════════════════════════════════════════════════
//  Confluence Swing — 1H Backtest
//  • 32000 1H candles ≈ 3.7 years
//  • STRONG signals only (score ≥ ±6) — same logic as 4H
//  • EMA200 macro filter on 1H
//  • Goal: 4× more trades vs 4H → statistical confidence
//  • MAX_BARS=800 (50 days, same real-time as 200×4H)
// ══════════════════════════════════════════════════════════
import { analyzeIndicators, generateSignal, type OHLCV } from "../../server/analysis";

const COINS      = [
  "BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "LINK",
  "MATIC", "UNI", "ATOM", "LTC", "BCH", "AAVE", "ALGO", "VET", "XLM", "TRX",
  "ETC", "FIL", "NEAR", "ICP", "SAND",
];
const INTERVAL   = "1h";
const WINDOW     = 250;   // EMA200 seed (reliable at 250 bars)
const MAX_BARS   = 800;   // 50 days max hold (= 200×4H bars, same real-time)
const COOLDOWN   = 20;    // 20h cooldown (= 5×4H bars, same real-time)
const TOTAL_BARS = 32000; // 32000×1H ≈ 3.7 years

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
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) {
    console.log(`${symbol}: not enough data (${allCandles.length} bars)`);
    return;
  }

  const trades:     TradeRecord[] = [];
  let equity       = 100;
  let peakEq       = 100;
  let maxDD        = 0;
  let lastTradeIdx = -COOLDOWN;

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastTradeIdx < COOLDOWN) continue;

    const window     = allCandles.slice(i - WINDOW, i + 1);
    const indicators = analyzeIndicators(window);
    const signal     = generateSignal(window, indicators);

    if (signal.type !== "STRONG_BUY" && signal.type !== "STRONG_SELL") continue;
    if (!signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

    lastTradeIdx = i;
    const isBuy  = signal.type === "STRONG_BUY";
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);

    let outcome: "tp1" | "tp2" | "loss" | "pending" = "pending";
    let hitTp1 = false;

    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isBuy) {
        if (c.low  <= signal.stopLoss)                       { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.high >= signal.takeProfit1)           hitTp1 = true;
        if (c.high >= signal.takeProfit2)                    { outcome = "tp2"; break; }
      } else {
        if (c.high >= signal.stopLoss)                       { outcome = hitTp1 ? "tp1" : "loss"; break; }
        if (!hitTp1 && c.low  <= signal.takeProfit1)           hitTp1 = true;
        if (c.low  <= signal.takeProfit2)                    { outcome = "tp2"; break; }
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

    const posRisk = signal.positionSizePct / 100;
    equity += equity * (pnlPct / 100) * posRisk;
    peakEq  = Math.max(peakEq, equity);
    maxDD   = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

    trades.push({ time: allCandles[i].time, dir: isBuy ? "LONG" : "SHORT", pnlPct, outcome: outcomeLabel });
  }

  const wins   = trades.filter(t => t.outcome === "win");
  const losses = trades.filter(t => t.outcome === "loss");
  const T      = trades.length;
  if (T === 0) { console.log(`${symbol}: 0 trades`); return; }

  const grossW     = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossL     = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf         = grossL > 0 ? grossW / grossL : Infinity;
  const wr         = (wins.length / T) * 100;
  const avgWin     = wins.length   > 0 ? grossW / wins.length   : 0;
  const avgLoss    = losses.length > 0 ? grossL / losses.length : 0;
  const expectancy = (wr / 100) * avgWin - ((100 - wr) / 100) * avgLoss;
  const ret        = equity - 100;

  const pnls     = trades.map(t => t.pnlPct);
  const mean     = pnls.reduce((s, x) => s + x, 0) / pnls.length;
  const variance = pnls.reduce((s, x) => s + (x - mean) ** 2, 0) / pnls.length;
  const stddev   = Math.sqrt(variance);
  const bars     = allCandles.length;
  const years    = bars / 8760;  // 1H bars → years
  const tpy      = T / years;
  const annReturn = mean * tpy;
  const annStd    = stddev * Math.sqrt(tpy);
  const sharpe    = annStd > 0 ? annReturn / annStd : 0;

  const yearMap: Record<number, { wins: number; losses: number; pnl: number }> = {};
  for (const t of trades) {
    const yr = new Date(t.time * 1000).getFullYear();
    if (!yearMap[yr]) yearMap[yr] = { wins: 0, losses: 0, pnl: 0 };
    if (t.outcome === "win") yearMap[yr].wins++;
    else yearMap[yr].losses++;
    yearMap[yr].pnl += t.pnlPct;
  }

  const pfNum    = Math.round(pf * 100) / 100;
  const status   = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const sigBadge = T >= 100 ? "" : T >= 50 ? " ⚠️(low N)" : T >= 30 ? " 🚨(low N)" : " 💀(insuf.)";

  console.log(
    `\n${symbol}${sigBadge}  [${bars} bars ≈ ${years.toFixed(1)}y]\n` +
    `  Trades: ${T}  WR: ${wr.toFixed(1)}%  PF: ${pfNum}  ${status}\n` +
    `  Return: ${ret.toFixed(1)}%  MDD: ${maxDD.toFixed(1)}%  Sharpe≈${sharpe.toFixed(2)}\n` +
    `  AvgWin: ${avgWin.toFixed(2)}%  AvgLoss: ${avgLoss.toFixed(2)}%  Expectancy: ${expectancy.toFixed(3)}%/trade`
  );

  const yrKeys = Object.keys(yearMap).sort();
  const yrLine = yrKeys.map(yr => {
    const d   = yearMap[parseInt(yr)];
    const yrT = d.wins + d.losses;
    const yrWr = yrT > 0 ? ((d.wins / yrT) * 100).toFixed(0) : "0";
    const mark = d.pnl > 0 ? "+" : "";
    return `  ${yr}: T=${yrT} WR=${yrWr}% P=${mark}${d.pnl.toFixed(1)}%`;
  }).join("  |");
  if (yrKeys.length > 1) console.log(yrLine);
}

(async () => {
  const days = Math.round(TOTAL_BARS / 24);
  const yrs  = (days / 365).toFixed(1);
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Confluence Swing — 1H Backtest`);
  console.log(`  ${TOTAL_BARS} bars × 1H ≈ ${days} days (${yrs} years)`);
  console.log(`  STRONG only (score≥6) · EMA200 macro filter · dual TP`);
  console.log(`  T≥100 = solid · T≥50 = ok · T<30 = insufficient`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`⚠️ T≥100 coins have solid statistical confidence\n`);
})();
