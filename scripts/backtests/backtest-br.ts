// ══════════════════════════════════════════════════════════
//  Break & Retest — Professional Backtest
//  • 8000 4H candles ≈ 3.7 years (~2022–2026)
//  • No time-stop: trades run until TP or SL (max 200 bars ≈ 1 month)
//  • Per-year breakdown to test consistency
//  • PF, Expectancy, Sharpe estimate, MDD, Trade count
// ══════════════════════════════════════════════════════════
import { breakRetestSignal, type OHLCV } from "../../server/analysis";

const COINS = [
  // Top 10 by market cap (with 2022+ history)
  "BTC", "ETH", "BNB", "XRP", "ADA", "SOL", "DOGE", "DOT", "AVAX", "LINK",
  // Extended — liquid coins with sufficient history
  "MATIC", "UNI", "ATOM", "LTC", "BCH", "AAVE", "ALGO", "VET", "XLM", "TRX",
  "ETC", "FIL", "NEAR", "ICP", "SAND",
];
const WINDOW     = 150;  // 150 bars passed so EMA200 converges (~22% seed influence vs 55% at 60 bars)
const MAX_BARS   = 200;  // max bars to hold a trade — no artificial time-stop
const COOLDOWN   = 3;
const LEVEL_COOLDOWN = 20;
const ZONE_PCT   = 0.008;
const TOTAL_BARS = 8000;   // ~1333 days ≈ 3.7 years

async function fetchKlines(symbol: string): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches = Math.ceil(TOTAL_BARS / batchSize);

  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=4h&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const res = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
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
  time: number;
  dir: "LONG" | "SHORT";
  pnlPct: number;
  outcome: "win" | "loss";
}

async function runBacktest(symbol: string) {
  const allCandles = await fetchKlines(symbol);
  if (allCandles.length < WINDOW + MAX_BARS + 30) {
    console.log(`${symbol}: not enough data (${allCandles.length} bars)`);
    return;
  }

  const trades: TradeRecord[] = [];
  let equity = 100;
  let peakEq = 100;
  let maxDD  = 0;
  let lastTradeIdx = -COOLDOWN;
  const zoneCooldown = new Map<string, number>();

  for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
    if (i - lastTradeIdx < COOLDOWN) continue;

    const sig = breakRetestSignal(allCandles.slice(i - WINDOW, i + 1));
    if (sig.type === "NONE") continue;
    if (sig.confidence < 68) continue;  // match break-retest.ts: only quality signals

    const lvl = sig.level ?? sig.entry;
    const zoneKey = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
    const lastZone = zoneCooldown.get(zoneKey) ?? -999;
    if (i - lastZone < LEVEL_COOLDOWN) continue;

    zoneCooldown.set(zoneKey, i);
    lastTradeIdx = i;

    const isLong = sig.type === "LONG";
    const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);
    let outcome: "tp" | "sl" | "timeout" = "timeout";
    let barsToOutcome = MAX_BARS;

    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isLong) {
        if (c.low  <= sig.stopLoss)   { outcome = "sl"; barsToOutcome = j + 1; break; }
        if (c.high >= sig.takeProfit) { outcome = "tp"; barsToOutcome = j + 1; break; }
      } else {
        if (c.high >= sig.stopLoss)   { outcome = "sl"; barsToOutcome = j + 1; break; }
        if (c.low  <= sig.takeProfit) { outcome = "tp"; barsToOutcome = j + 1; break; }
      }
    }

    const risk   = Math.abs(sig.entry - sig.stopLoss);
    const reward = Math.abs(sig.takeProfit - sig.entry);
    const exit   = future[future.length - 1]?.close ?? sig.entry;
    let pnlPct: number;
    let outcomeLabel: "win" | "loss";

    if (outcome === "tp") {
      pnlPct = (reward / sig.entry) * 100;
      outcomeLabel = "win";
    } else if (outcome === "sl") {
      pnlPct = -(risk / sig.entry) * 100;
      outcomeLabel = "loss";
    } else {
      pnlPct = isLong
        ? ((exit - sig.entry) / sig.entry) * 100
        : ((sig.entry - exit) / sig.entry) * 100;
      outcomeLabel = pnlPct >= 0 ? "win" : "loss";
    }

    equity += equity * (pnlPct / 100) * 0.01 * 100;
    peakEq  = Math.max(peakEq, equity);
    maxDD   = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

    trades.push({
      time:    allCandles[i].time,
      dir:     sig.type as "LONG" | "SHORT",
      pnlPct,
      outcome: outcomeLabel,
    });
  }

  // ── Metrics ──────────────────────────────────────────
  const wins   = trades.filter(t => t.outcome === "win");
  const losses = trades.filter(t => t.outcome === "loss");
  const T      = trades.length;
  if (T === 0) { console.log(`${symbol}: 0 trades`); return; }

  const grossW    = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossL    = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
  const pf        = grossL > 0 ? grossW / grossL : Infinity;
  const wr        = (wins.length / T) * 100;
  const avgWin    = wins.length > 0 ? grossW / wins.length : 0;
  const avgLoss   = losses.length > 0 ? grossL / losses.length : 0;
  const expectancy = (wr / 100) * avgWin - ((100 - wr) / 100) * avgLoss;  // % per trade
  const ret       = equity - 100;

  // Sharpe estimate: annualised return / annualised stdev of per-trade PnL
  const pnls = trades.map(t => t.pnlPct);
  const mean  = pnls.reduce((s, x) => s + x, 0) / pnls.length;
  const variance = pnls.reduce((s, x) => s + (x - mean) ** 2, 0) / pnls.length;
  const stddev = Math.sqrt(variance);
  // Trades per year: T / years, annualised return = mean * T/year
  const bars = allCandles.length;
  const years = (bars * 4) / 8760;   // 4H candles → hours → years
  const tradesPerYear = T / years;
  const annReturn = mean * tradesPerYear;
  const annStd    = stddev * Math.sqrt(tradesPerYear);
  const sharpe    = annStd > 0 ? annReturn / annStd : 0;

  // Per-year breakdown
  const yearMap: Record<number, { wins: number; losses: number; pnl: number }> = {};
  for (const t of trades) {
    const yr = new Date(t.time * 1000).getFullYear();
    if (!yearMap[yr]) yearMap[yr] = { wins: 0, losses: 0, pnl: 0 };
    if (t.outcome === "win") yearMap[yr].wins++;
    else yearMap[yr].losses++;
    yearMap[yr].pnl += t.pnlPct;
  }

  const pfNum   = Math.round(pf * 100) / 100;
  const status  = pfNum >= 1.5 ? "✅" : pfNum >= 1.0 ? "🟡" : "❌";
  const sigBadge = T >= 50 ? "" : T >= 30 ? " ⚠️(low N)" : " 🚨(insuf.)";

  console.log(
    `\n${symbol}${sigBadge}  [${bars} bars ≈ ${years.toFixed(1)}y]\n` +
    `  Trades: ${T}  WR: ${wr.toFixed(1)}%  PF: ${pfNum}  ${status}\n` +
    `  Return: ${ret.toFixed(1)}%  MDD: ${maxDD.toFixed(1)}%  Sharpe≈${sharpe.toFixed(2)}\n` +
    `  AvgWin: ${avgWin.toFixed(2)}%  AvgLoss: ${avgLoss.toFixed(2)}%  Expectancy: ${expectancy.toFixed(3)}%/trade`
  );

  const yrKeys = Object.keys(yearMap).sort();
  const yrLine = yrKeys.map(yr => {
    const d = yearMap[parseInt(yr)];
    const yrT = d.wins + d.losses;
    const yrWr = yrT > 0 ? ((d.wins / yrT) * 100).toFixed(0) : "0";
    const mark = d.pnl > 0 ? "+" : "";
    return `  ${yr}: T=${yrT} WR=${yrWr}% P=${mark}${d.pnl.toFixed(1)}%`;
  }).join("  |");
  if (yrKeys.length > 1) console.log(yrLine);
}

(async () => {
  const days = Math.round(TOTAL_BARS * 4 / 24);
  const yrs  = (days / 365).toFixed(1);
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Break & Retest — Professional Backtest`);
  console.log(`  ${TOTAL_BARS} bars × 4H ≈ ${days} days (${yrs} years)`);
  console.log(`═══════════════════════════════════════════════════`);
  for (const coin of COINS) await runBacktest(coin);
  console.log(`\n✅ PF≥1.5  🟡 PF≥1.0  ❌ PF<1.0`);
  console.log(`⚠️ <30 trades = low statistical confidence\n`);
})();
