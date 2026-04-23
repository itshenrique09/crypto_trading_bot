// ══════════════════════════════════════════════════════════════════
//  RSI Divergence — MEXC Symbol Discovery
//
//  Fetches every active USDT perpetual on MEXC, backtests the current
//  RSI Divergence strategy (post SL-structural refactor) on each one
//  using 3.7y of 1H Binance candles, and prints the symbols that
//  achieve PF ≥ 2.0 with statistical significance (T ≥ 40).
//
//  Winners get added to rsi-divergence.ts preferredSymbols.
// ══════════════════════════════════════════════════════════════════
import { rsiDivergenceSignal, type OHLCV } from "../../server/analysis.ts";

// ── Settings (mirror server/routes.ts backtest route) ──
const INTERVAL   = "1h";
const WINDOW     = 250;   // EMA200 seed
const MAX_BARS   = 200;   // 200h max hold (~8d)
const COOLDOWN   = 20;    // 20h between trades same coin
const TOTAL_BARS = 32000; // 3.7 years

// ── Quality gates for "winner" classification ──
const PF_MIN     = 2.0;
const TRADES_MIN = 40;    // statistical significance floor

// ── Already-tested or confirmed symbols: skip ──
const ALREADY_TESTED = new Set([
  // Active preferredSymbols (rsi-divergence.ts)
  "FIL", "DOT", "BCH", "SOL", "SAND", "ATOM", "AAVE", "AVAX", "INJ",
  // Documented as tested in backtest-rsi-div.ts (top of file header)
  "BTC", "ETH", "BNB", "XRP", "ADA", "DOGE", "LINK", "MATIC", "UNI",
  "LTC", "ALGO", "VET", "XLM", "TRX", "ETC", "NEAR", "ICP", "PEPE",
]);

// Stablecoins / wrapped / non-tradeable — exclude
const EXCLUDE = new Set([
  "USDC", "USDT", "BUSD", "TUSD", "DAI", "USDP", "USDD", "USTC",
  "WBTC", "WETH", "STETH", "CBETH", "WSTETH", "RETH",
]);

// ── Concurrency control ──
const MAX_PARALLEL = 3;

// ── Fetchers ──
async function fetchMexcPerps(): Promise<string[]> {
  const url = "https://contract.mexc.com/api/v1/contract/list";
  const res = await fetch(url);
  const json = await res.json() as { data: { symbol: string; state: number; quoteCoin: string; baseCoin: string }[] };
  const actives = json.data
    .filter(c => c.state === 0 && c.quoteCoin === "USDT")
    .map(c => c.baseCoin.toUpperCase());
  return Array.from(new Set(actives));
}

async function fetchBinanceKlines(symbol: string): Promise<OHLCV[] | null> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(TOTAL_BARS / batchSize);

  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=${INTERVAL}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
      if (!res.ok) {
        if (res.status === 400 || res.status === 404) return null; // not listed
        throw new Error(`HTTP ${res.status}`);
      }
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
    } catch (err: any) {
      console.error(`  [${symbol}] fetch error: ${err.message}`);
      return null;
    }
    // Small delay between batches to respect Binance rate limits
    await new Promise(r => setTimeout(r, 120));
  }
  return candles;
}

interface BTResult {
  symbol: string;
  trades: number;
  winRate: number;
  pf: number;
  netReturn: number;
  yearBreakdown: string;
}

// ── Backtest: identical logic to /api/backtest-rsi-div ──
function backtest(symbol: string, candles: OHLCV[]): BTResult | null {
  if (candles.length < WINDOW + MAX_BARS + 50) return null;

  type Trade = { time: number; pnl: number; win: boolean };
  const trades: Trade[] = [];
  let lastIdx = -COOLDOWN;

  for (let i = WINDOW; i < candles.length - MAX_BARS; i++) {
    if (i - lastIdx < COOLDOWN) continue;
    const slice = candles.slice(i - WINDOW, i + 1);
    const sig   = rsiDivergenceSignal(slice);
    if (sig.type === "NONE") continue;
    if (sig.confidence < 72) continue;
    if (!sig.entry || !sig.stopLoss || !sig.takeProfit || !sig.takeProfit2) continue;

    const isLong = sig.type === "LONG";
    const future = candles.slice(i + 1, i + 1 + MAX_BARS);

    let outcome: "tp1" | "tp2" | "loss" | "timeout" = "timeout";
    for (let j = 0; j < future.length; j++) {
      const c = future[j];
      if (isLong) {
        if (c.low  <= sig.stopLoss)    { outcome = "loss"; break; }
        if (c.high >= sig.takeProfit2) { outcome = "tp2";  break; }
        if (c.high >= sig.takeProfit)  { outcome = "tp1";  break; }
      } else {
        if (c.high >= sig.stopLoss)    { outcome = "loss"; break; }
        if (c.low  <= sig.takeProfit2) { outcome = "tp2";  break; }
        if (c.low  <= sig.takeProfit)  { outcome = "tp1";  break; }
      }
    }

    const risk   = Math.abs(sig.entry - sig.stopLoss);
    const tp1Rew = Math.abs(sig.takeProfit  - sig.entry);
    const tp2Rew = Math.abs(sig.takeProfit2 - sig.entry);

    let pnl: number;
    if      (outcome === "tp2")  pnl =  (tp2Rew / sig.entry) * 100;
    else if (outcome === "tp1")  pnl =  (tp1Rew / sig.entry) * 100;
    else if (outcome === "loss") pnl = -(risk    / sig.entry) * 100;
    else {
      const exit = future.length > 0 ? future[future.length - 1].close : sig.entry;
      pnl = isLong ? ((exit - sig.entry) / sig.entry) * 100 : ((sig.entry - exit) / sig.entry) * 100;
    }

    lastIdx = i;
    trades.push({ time: candles[i].time, pnl, win: pnl > 0 });
  }

  const T = trades.length;
  if (T === 0) return null;

  const wins    = trades.filter(t => t.win);
  const losses  = trades.filter(t => !t.win);
  const grossW  = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL  = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf      = grossL > 0 ? grossW / grossL : Infinity;
  const wr      = (wins.length / T) * 100;
  const net     = grossW - grossL;

  // Year breakdown
  const yearMap: Record<number, number> = {};
  for (const t of trades) {
    const yr = new Date(t.time * 1000).getFullYear();
    yearMap[yr] = (yearMap[yr] ?? 0) + t.pnl;
  }
  const yrStr = Object.keys(yearMap).sort().map(yr => {
    const v = yearMap[parseInt(yr)];
    return `${yr}:${v > 0 ? "+" : ""}${v.toFixed(0)}`;
  }).join(" ");

  return {
    symbol, trades: T, winRate: wr,
    pf: Math.round(pf * 100) / 100,
    netReturn: Math.round(net * 10) / 10,
    yearBreakdown: yrStr,
  };
}

// ── Parallel runner with limited concurrency ──
async function runLimited(symbols: string[], limit: number): Promise<BTResult[]> {
  const out: BTResult[] = [];
  const queue = [...symbols];
  let done = 0;

  async function worker(workerId: number) {
    while (queue.length > 0) {
      const sym = queue.shift();
      if (!sym) return;
      const candles = await fetchBinanceKlines(sym);
      done++;
      if (!candles) {
        console.log(`  [${done}/${symbols.length}] ${sym.padEnd(8)} — no Binance data`);
        continue;
      }
      const r = backtest(sym, candles);
      if (!r) {
        console.log(`  [${done}/${symbols.length}] ${sym.padEnd(8)} — backtest insufficient`);
        continue;
      }
      const tag = r.pf >= PF_MIN && r.trades >= TRADES_MIN
        ? "🏆 WINNER"
        : r.pf >= 1.5 && r.trades >= TRADES_MIN
          ? "✅ OK"
          : r.trades < TRADES_MIN
            ? "⚠️  LOW-T"
            : "❌ FAIL";
      console.log(
        `  [${done}/${symbols.length}] ${r.symbol.padEnd(8)} T=${String(r.trades).padStart(3)} ` +
        `WR=${r.winRate.toFixed(1).padStart(5)}% PF=${String(r.pf).padStart(4)} ` +
        `net=${r.netReturn >= 0 ? "+" : ""}${r.netReturn.toFixed(0)}%  ${tag}`
      );
      out.push(r);
    }
  }

  const workers = Array.from({ length: limit }, (_, i) => worker(i));
  await Promise.all(workers);
  return out;
}

// ── Main ──
(async () => {
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  RSI Divergence — MEXC Symbol Discovery");
  console.log(`  Looking for PF ≥ ${PF_MIN.toFixed(1)}, T ≥ ${TRADES_MIN}`);
  console.log(`  Window=${WINDOW}h, MaxHold=${MAX_BARS}h, Cooldown=${COOLDOWN}h, ${TOTAL_BARS}bars (~3.7y)`);
  console.log("═══════════════════════════════════════════════════════════════════\n");

  console.log("1. Fetching MEXC perpetual list…");
  const mexcSyms = await fetchMexcPerps();
  console.log(`   ${mexcSyms.length} active USDT perpetuals on MEXC\n`);

  const candidates = mexcSyms.filter(s =>
    !ALREADY_TESTED.has(s) && !EXCLUDE.has(s) && /^[A-Z0-9]{2,10}$/.test(s)
  );
  console.log(`2. Candidates after filter (exclude tested + stablecoins): ${candidates.length}`);
  console.log(`   Sample: ${candidates.slice(0, 20).join(", ")}…\n`);

  console.log(`3. Running backtests (parallel=${MAX_PARALLEL})…\n`);
  const results = await runLimited(candidates, MAX_PARALLEL);

  // Sort winners by PF
  const winners = results
    .filter(r => r.pf >= PF_MIN && r.trades >= TRADES_MIN)
    .sort((a, b) => b.pf - a.pf);

  const solid = results
    .filter(r => r.pf >= 1.5 && r.pf < PF_MIN && r.trades >= TRADES_MIN)
    .sort((a, b) => b.pf - a.pf);

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`  🏆 WINNERS (PF ≥ ${PF_MIN}, T ≥ ${TRADES_MIN}): ${winners.length}`);
  console.log("═══════════════════════════════════════════════════════════════════");
  for (const w of winners) {
    console.log(`  ${w.symbol.padEnd(8)} T=${String(w.trades).padStart(3)} WR=${w.winRate.toFixed(1)}% PF=${w.pf} net=${w.netReturn}%`);
    console.log(`           [${w.yearBreakdown}]`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`  ✅ Also solid (1.5 ≤ PF < ${PF_MIN}): ${solid.length}`);
  console.log("═══════════════════════════════════════════════════════════════════");
  for (const s of solid.slice(0, 15)) {
    console.log(`  ${s.symbol.padEnd(8)} T=${String(s.trades).padStart(3)} WR=${s.winRate.toFixed(1)}% PF=${s.pf} net=${s.netReturn}%`);
  }

  console.log(`\nSymbols for preferredSymbols (winners only):`);
  console.log(`  ${JSON.stringify(winners.map(w => w.symbol))}\n`);
})();
