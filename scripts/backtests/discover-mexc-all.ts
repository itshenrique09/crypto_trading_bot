// ══════════════════════════════════════════════════════════════════
//  MEXC Symbol Discovery — ALL 5 strategies
//
//  Fetches every active USDT perpetual on MEXC, backtests each
//  strategy against 3.7 years of Binance candles, and prints the
//  symbols that clear PF ≥ 2.0 with T ≥ 40 trades per strategy.
//
//  Strategy configs match exactly the /api/backtest-* routes:
//    Confluence Swing : 1H  WIN=250  MAX=800  CD=20  STRONG_BUY/SELL
//    SMC              : 4H  WIN=150  TS=15    CD=3   conf≥68  (zone CD 20)
//    Break & Retest   : 4H  WIN=150  TS=15    CD=3   conf≥68  (zone CD 20)
//    RSI Divergence   : 1H  WIN=250  MAX=200  CD=20  conf≥72
//    Liquidity Sweep  : 1H  WIN=220  MAX=200  CD=12
// ══════════════════════════════════════════════════════════════════
import {
  analyzeIndicators, generateSignal,
  smcSignal, breakRetestSignal,
  rsiDivergenceSignal, liquiditySweepSignal,
  type OHLCV,
} from "../../server/analysis.ts";

// ── Quality gates for "winner" ──
const PF_MIN       = 2.0;
const T_MIN_1H     = 40;  // 1H strategies have more trades, demand more
const T_MIN_4H     = 25;  // 4H has fewer trades, lower minimum
const TOTAL_BARS   = 8000;
const TOP_N_VOLUME = 100; // top N by 24h volume on MEXC — focus on liquid

// ── Already-tested symbols (skip; already in preferredSymbols or documented) ──
const ALREADY_TESTED = new Set([
  // Existing preferredSymbols across strategies
  "DOGE", "AVAX", "XRP", "ICP", "ETH", "BNB", "BTC",
  "AAVE", "ATOM", "SOL", "SAND",
  "FIL", "DOT", "BCH", "INJ",
  "UNI", "PEPE", "LTC", "ETC", "NEAR", "LINK",
  // Broadly documented tested
  "ADA", "MATIC", "ALGO", "VET", "XLM", "TRX",
]);

const EXCLUDE = new Set([
  "USDC", "USDT", "BUSD", "TUSD", "DAI", "USDP", "USDD", "USTC",
  "WBTC", "WETH", "STETH", "CBETH", "WSTETH", "RETH",
]);

const MAX_PARALLEL = 4;

// ── MEXC: fetch active USDT perpetuals sorted by 24h volume ──
async function fetchMexcLiquidUSDT(topN: number): Promise<string[]> {
  const headers = { "User-Agent": "Mozilla/5.0" };

  // Contract detail → list of symbols
  const detailUrl = "https://contract.mexc.com/api/v1/contract/detail";
  const detailRes = await fetch(detailUrl, { headers });
  const detailJson = await detailRes.json() as {
    data: { symbol: string; baseCoin: string; quoteCoin: string; state: number }[];
  };
  const allActive = detailJson.data
    .filter(c => c.state === 0 && c.quoteCoin === "USDT")
    .map(c => c.baseCoin.toUpperCase());

  // Try to sort by 24h volume via ticker endpoint
  try {
    const tickerUrl = "https://contract.mexc.com/api/v1/contract/ticker";
    const tickerRes = await fetch(tickerUrl, { headers });
    const tickerJson = await tickerRes.json() as { data: { symbol: string; amount24: string }[] };
    const volMap = new Map<string, number>();
    for (const t of tickerJson.data) {
      if (!t.symbol.endsWith("_USDT")) continue;
      const base = t.symbol.replace("_USDT", "").toUpperCase();
      volMap.set(base, parseFloat(t.amount24 ?? "0"));
    }
    return allActive
      .filter(b => volMap.has(b))
      .sort((a, b) => (volMap.get(b) ?? 0) - (volMap.get(a) ?? 0))
      .slice(0, topN);
  } catch {
    return allActive.slice(0, topN);
  }
}

// ── Binance klines paginated ──
async function fetchBinance(symbol: string, interval: "1h" | "4h", total: number): Promise<OHLCV[] | null> {
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches   = Math.ceil(total / batchSize);

  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${symbol}USDT&interval=${interval}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?${qs}`);
      if (!res.ok) {
        if (res.status === 400 || res.status === 404) return null; // not listed on Binance
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
    } catch {
      return null;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return candles;
}

interface Result {
  symbol: string; strategy: string;
  trades: number; winRate: number; pf: number; net: number;
}

// ══════════════════════════════════════════════════════════════════
//  Per-strategy backtest functions
// ══════════════════════════════════════════════════════════════════

// ── Generic forward-scan: TP1/TP2/SL with hitTp1 bookkeeping ──
function simulateTwoTargets(
  isLong: boolean, entry: number, sl: number, tp1: number, tp2: number,
  future: OHLCV[],
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

function pnlFromOutcome(
  isLong: boolean, outcome: string, entry: number, sl: number, tp1: number, tp2: number, future: OHLCV[],
): { pnl: number; win: boolean } {
  if (outcome === "tp2") { const r = Math.abs(tp2 - entry) / entry * 100; return { pnl: r,   win: true  }; }
  if (outcome === "tp1") { const r = Math.abs(tp1 - entry) / entry * 100; return { pnl: r,   win: true  }; }
  if (outcome === "loss") { const r = Math.abs(entry - sl) / entry * 100; return { pnl: -r,  win: false }; }
  const exit = future.length > 0 ? future[future.length - 1].close : entry;
  const pnl = isLong ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
  return { pnl, win: pnl >= 0 };
}

function summarise(trades: { pnl: number; win: boolean }[]): { T: number; wr: number; pf: number; net: number } | null {
  const T = trades.length;
  if (T === 0) return null;
  const wins   = trades.filter(t => t.win);
  const losses = trades.filter(t => !t.win);
  const grossW = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const pf = grossL > 0 ? grossW / grossL : Infinity;
  return {
    T,
    wr:  (wins.length / T) * 100,
    pf:  Math.round(pf * 100) / 100,
    net: Math.round((grossW - grossL) * 10) / 10,
  };
}

function btSwing(symbol: string, c: OHLCV[]): Result | null {
  const WINDOW = 250, MAX = 800, CD = 20;
  if (c.length < WINDOW + MAX + 30) return null;
  const trades: { pnl: number; win: boolean }[] = [];
  let lastIdx = -CD;
  for (let i = WINDOW; i < c.length - MAX; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const ind = analyzeIndicators(w);
    const sig = generateSignal(w, ind);
    if (sig.type !== "STRONG_BUY" && sig.type !== "STRONG_SELL") continue;
    if (!sig.entry || !sig.stopLoss || !sig.takeProfit1 || !sig.takeProfit2) continue;
    lastIdx = i;
    const isLong = sig.type === "STRONG_BUY";
    const future = c.slice(i + 1, i + 1 + MAX);
    const { outcome } = simulateTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit1, sig.takeProfit2, future);
    trades.push(pnlFromOutcome(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit1, sig.takeProfit2, future));
  }
  const s = summarise(trades);
  if (!s) return null;
  return { symbol, strategy: "Swing", trades: s.T, winRate: s.wr, pf: s.pf, net: s.net };
}

function btSMC(symbol: string, c: OHLCV[]): Result | null {
  const WINDOW = 150, TS = 15, CD = 3, ZONE_CD = 20, ZONE_PCT = 0.008;
  if (c.length < WINDOW + TS + 10) return null;
  const trades: { pnl: number; win: boolean }[] = [];
  let lastIdx = -CD;
  const zoneCd = new Map<string, number>();
  for (let i = WINDOW; i < c.length - TS; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const sig = smcSignal(w);
    if (sig.type === "NONE" || sig.confidence < 68) continue;
    const lvl = sig.obZone ? (sig.obZone.high + sig.obZone.low) / 2 : sig.entry;
    const key = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
    if (i - (zoneCd.get(key) ?? -999) < ZONE_CD) continue;
    zoneCd.set(key, i);
    lastIdx = i;
    const isLong = sig.type === "LONG";
    const future = c.slice(i + 1, i + 1 + TS);
    // SMC uses single TP (takeProfit only); emulate by passing tp as tp1=tp2
    const { outcome } = simulateTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit, future);
    trades.push(pnlFromOutcome(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit, future));
  }
  const s = summarise(trades);
  if (!s) return null;
  return { symbol, strategy: "SMC", trades: s.T, winRate: s.wr, pf: s.pf, net: s.net };
}

function btBR(symbol: string, c: OHLCV[]): Result | null {
  const WINDOW = 150, TS = 15, CD = 3, LVL_CD = 20, ZONE_PCT = 0.008;
  if (c.length < WINDOW + TS + 10) return null;
  const trades: { pnl: number; win: boolean }[] = [];
  let lastIdx = -CD;
  const zoneCd = new Map<string, number>();
  for (let i = WINDOW; i < c.length - TS; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const sig = breakRetestSignal(w);
    if (sig.type === "NONE" || sig.confidence < 68) continue;
    const lvl = sig.level ?? sig.entry;
    const key = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
    if (i - (zoneCd.get(key) ?? -999) < LVL_CD) continue;
    zoneCd.set(key, i);
    lastIdx = i;
    const isLong = sig.type === "LONG";
    const future = c.slice(i + 1, i + 1 + TS);
    const { outcome } = simulateTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future);
    trades.push(pnlFromOutcome(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future));
  }
  const s = summarise(trades);
  if (!s) return null;
  return { symbol, strategy: "B&R", trades: s.T, winRate: s.wr, pf: s.pf, net: s.net };
}

function btRSI(symbol: string, c: OHLCV[]): Result | null {
  const WINDOW = 250, MAX = 200, CD = 20;
  if (c.length < WINDOW + MAX + 50) return null;
  const trades: { pnl: number; win: boolean }[] = [];
  let lastIdx = -CD;
  for (let i = WINDOW; i < c.length - MAX; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const sig = rsiDivergenceSignal(w);
    if (sig.type === "NONE" || sig.confidence < 72) continue;
    if (!sig.entry || !sig.stopLoss || !sig.takeProfit || !sig.takeProfit2) continue;
    lastIdx = i;
    const isLong = sig.type === "LONG";
    const future = c.slice(i + 1, i + 1 + MAX);
    const { outcome } = simulateTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future);
    trades.push(pnlFromOutcome(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future));
  }
  const s = summarise(trades);
  if (!s) return null;
  return { symbol, strategy: "RSI-Div", trades: s.T, winRate: s.wr, pf: s.pf, net: s.net };
}

function btLiqSweep(symbol: string, c: OHLCV[]): Result | null {
  const WINDOW = 220, MAX = 200, CD = 12;
  if (c.length < WINDOW + MAX + 10) return null;
  const trades: { pnl: number; win: boolean }[] = [];
  let lastIdx = -CD;
  for (let i = WINDOW; i < c.length - MAX; i++) {
    if (i - lastIdx < CD) continue;
    const w = c.slice(i - WINDOW, i + 1);
    const sig = liquiditySweepSignal(w);
    if (sig.type === "NONE") continue;
    lastIdx = i;
    const isLong = sig.type === "LONG";
    const future = c.slice(i + 1, i + 1 + MAX);
    const { outcome } = simulateTwoTargets(isLong, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future);
    trades.push(pnlFromOutcome(isLong, outcome, sig.entry, sig.stopLoss, sig.takeProfit, sig.takeProfit2, future));
  }
  const s = summarise(trades);
  if (!s) return null;
  return { symbol, strategy: "LiqSweep", trades: s.T, winRate: s.wr, pf: s.pf, net: s.net };
}

// ══════════════════════════════════════════════════════════════════
//  Orchestration
// ══════════════════════════════════════════════════════════════════

async function processSymbol(sym: string): Promise<Result[]> {
  // Fetch both timeframes
  const [c1h, c4h] = await Promise.all([
    fetchBinance(sym, "1h", TOTAL_BARS),
    fetchBinance(sym, "4h", TOTAL_BARS),
  ]);

  const out: Result[] = [];
  if (c1h && c1h.length >= 500) {
    const s = btSwing(sym, c1h);     if (s) out.push(s);
    const r = btRSI(sym, c1h);       if (r) out.push(r);
    const l = btLiqSweep(sym, c1h);  if (l) out.push(l);
  }
  if (c4h && c4h.length >= 200) {
    const m = btSMC(sym, c4h);       if (m) out.push(m);
    const b = btBR(sym, c4h);        if (b) out.push(b);
  }
  return out;
}

async function runLimited(symbols: string[], limit: number): Promise<Map<string, Result[]>> {
  const results = new Map<string, Result[]>();
  const queue = [...symbols];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const s = queue.shift();
      if (!s) return;
      try {
        const res = await processSymbol(s);
        done++;
        if (res.length === 0) {
          console.log(`  [${done}/${symbols.length}] ${s.padEnd(8)} — no Binance data`);
        } else {
          results.set(s, res);
          const summary = res.map(r => `${r.strategy}=${r.pf}(T${r.trades})`).join(" ");
          console.log(`  [${done}/${symbols.length}] ${s.padEnd(8)} ${summary}`);
        }
      } catch (err: any) {
        done++;
        console.log(`  [${done}/${symbols.length}] ${s.padEnd(8)} error: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

(async () => {
  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  MEXC Symbol Discovery — All 5 strategies");
  console.log(`  Winner gate: PF ≥ ${PF_MIN}, T ≥ ${T_MIN_1H} (1H) or ${T_MIN_4H} (4H)`);
  console.log("═══════════════════════════════════════════════════════════════════\n");

  console.log("1. Fetching MEXC top liquid USDT perpetuals…");
  const top = await fetchMexcLiquidUSDT(TOP_N_VOLUME);
  console.log(`   Top ${top.length} by 24h volume: ${top.slice(0, 15).join(", ")}…\n`);

  const candidates = top.filter(s =>
    !ALREADY_TESTED.has(s) && !EXCLUDE.has(s) && /^[A-Z0-9]{2,10}$/.test(s)
  );
  console.log(`2. After filter (exclude already-tested + stablecoins): ${candidates.length}`);
  console.log(`   Candidates: ${candidates.join(", ")}\n`);

  console.log(`3. Running backtests (parallel=${MAX_PARALLEL})…\n`);
  const byCoin = await runLimited(candidates, MAX_PARALLEL);

  // Flatten + classify
  const all: Result[] = [];
  for (const arr of byCoin.values()) all.push(...arr);

  const byStrategy = new Map<string, Result[]>();
  for (const r of all) {
    if (!byStrategy.has(r.strategy)) byStrategy.set(r.strategy, []);
    byStrategy.get(r.strategy)!.push(r);
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log(`  🏆 WINNERS per strategy (PF ≥ ${PF_MIN})`);
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const winnersByStrategy: Record<string, string[]> = {};
  for (const [strat, arr] of byStrategy.entries()) {
    const minT = strat === "SMC" || strat === "B&R" ? T_MIN_4H : T_MIN_1H;
    const winners = arr
      .filter(r => r.pf >= PF_MIN && r.trades >= minT)
      .sort((a, b) => b.pf - a.pf);
    winnersByStrategy[strat] = winners.map(w => w.symbol);
    console.log(`— ${strat} (min T=${minT}) → ${winners.length} winners`);
    for (const w of winners) {
      console.log(`    ${w.symbol.padEnd(8)} T=${String(w.trades).padStart(3)} WR=${w.winRate.toFixed(1)}% PF=${w.pf} net=${w.net}%`);
    }
    // Also show solid (1.5–2.0)
    const solid = arr.filter(r => r.pf >= 1.5 && r.pf < PF_MIN && r.trades >= minT)
      .sort((a, b) => b.pf - a.pf).slice(0, 5);
    if (solid.length > 0) {
      console.log(`   (solid 1.5≤PF<2: ${solid.map(s => `${s.symbol}@${s.pf}`).join(", ")})`);
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  SUMMARY — JSON to add to preferredSymbols");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(JSON.stringify(winnersByStrategy, null, 2));
})();
