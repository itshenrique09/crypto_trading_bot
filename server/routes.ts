import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import {
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getSignals,
  getJournal, addJournalEntry, updateJournalEntry, deleteJournalEntry,
  getSetting, setSetting,
} from "./storage";
import { analyzeIndicators, generateSignal, refineEntry, smcSignal, breakRetestSignal, rsiDivergenceSignal, liquiditySweepSignal, calcATRPercentile, type OHLCV } from "./analysis";
import { getAllStrategies, getStrategyIds } from "./strategies/registry";
import type { Strategy } from "./strategies/types";
import { getMexcClient, toMexcSymbol } from "./mexc-client";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const MEXC_BASE = "https://api.mexc.com/api/v3";

// Default strategy ID — used as fallback when strategy field is missing (legacy entries)
const DEFAULT_STRATEGY = "confluence-swing";

// Top tradeable coins on MEXC (USDT pairs)
const SCANNER_COINS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX",
  "LINK", "DOT", "NEAR", "SUI", "ARB", "OP", "APT", "INJ",
  "FIL", "ATOM", "LTC", "UNI", "SEI", "TIA", "PEPE", "SHIB",
];

// Simple EMA helper for trend filtering
function emaArray(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// CoinGecko IDs — used only for metadata (name, market cap, ATH, etc.)
const SYMBOL_MAP: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana",
  XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot",
  AVAX: "avalanche-2", MATIC: "matic-network", LINK: "chainlink",
  UNI: "uniswap", ATOM: "cosmos", LTC: "litecoin", NEAR: "near",
  APT: "aptos", ARB: "arbitrum", OP: "optimism", FIL: "filecoin",
  SHIB: "shiba-inu", PEPE: "pepe", SUI: "sui", SEI: "sei-network",
  TIA: "celestia", INJ: "injective-protocol",
};

// Binance uses USDT pairs; a handful need explicit overrides
const BINANCE_OVERRIDES: Record<string, string> = {
  MATIC: "MATICUSDT",
};

function getCoingeckoId(symbol: string): string {
  return SYMBOL_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
}

function getBinanceSymbol(symbol: string): string {
  const upper = symbol.toUpperCase();
  return BINANCE_OVERRIDES[upper] ?? `${upper}USDT`;
}

async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} from ${url}`);
  return res.json();
}

// CoinGecko free tier: ~30 req/min
let lastCGCall = 0;
async function cgFetch(url: string) {
  const wait = Math.max(0, 1200 - (Date.now() - lastCGCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCGCall = Date.now();
  return fetchJSON(url);
}

// Binance public market data — no API key, generous rate limits
async function fetchBinanceKlines(symbol: string, interval: string, limit: number): Promise<OHLCV[]> {
  const pair = getBinanceSymbol(symbol);
  const url = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const data: any[][] = await fetchJSON(url);
  return data.map(k => ({
    time:   k[0] / 1000,
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

// Paginated fetch — retrieves multiple batches to get large historical datasets
// Used for backtests that need 2000–3000+ candles for statistical reliability
async function fetchBinanceKlinesPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
  const pair = getBinanceSymbol(symbol);
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const batches = Math.ceil(total / batchSize);

  for (let b = 0; b < batches; b++) {
    const qs = `symbol=${pair}&interval=${interval}&limit=${batchSize}` +
               (endTime ? `&endTime=${endTime}` : "");
    const data: any[][] = await fetchJSON(`${BINANCE_BASE}/klines?${qs}`);
    if (!Array.isArray(data) || data.length === 0) break;
    const batch: OHLCV[] = data.map(k => ({
      time:   k[0] / 1000,
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
    candles.unshift(...batch);
    if (data.length < batchSize) break;
    endTime = data[0][0] - 1;  // fetch older batch next iteration
  }
  return candles;
}

const insertWatchlistSchema = z.object({
  symbol:  z.string().min(1),
  name:    z.string().min(1),
  addedAt: z.string(),
});

export async function registerRoutes(server: Server, app: Express) {

  // ── Market Scanner (MEXC data) ───────────────────────────────────
  // Uses MEXC 24hr tickers for the coins we care about
  app.get("/api/market", async (_req, res) => {
    try {
      // Fetch all 24h tickers from MEXC + funding rates (futures) in parallel
      const MEXC_FUTURES = "https://contract.mexc.com/api/v1/contract";
      const [allTickers, fundingData] = await Promise.all([
        fetchJSON(`${MEXC_BASE}/ticker/24hr`),
        fetchJSON(`${MEXC_FUTURES}/funding_rate`).catch(() => ({ data: [] })),
      ]);
      // Build funding rate map: symbol → rate (e.g. "BTC_USDT" → 0.0001)
      const fundingMap: Record<string, number> = {};
      const fList: Array<{ symbol: string; fundingRate: string }> = fundingData?.data ?? [];
      for (const f of fList) {
        const sym = f.symbol?.replace("_USDT", "") ?? "";
        if (sym) fundingMap[sym] = parseFloat(f.fundingRate) || 0;
      }
      type MexcTicker = { symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string; highPrice: string; lowPrice: string; openPrice: string };
      const allTickersList: MexcTicker[] = allTickers;
      const tickerMap: Record<string, MexcTicker> = {};
      for (const t of allTickersList) {
        tickerMap[t.symbol] = t;
      }

      const results = SCANNER_COINS.map(sym => {
        const pair = `${sym}USDT`;
        const t = tickerMap[pair];
        if (!t) return null;

        const price = parseFloat(t.lastPrice);
        const volume24h = parseFloat(t.quoteVolume); // in USDT
        const change24h = parseFloat(t.priceChangePercent) * 100;
        const high24h = parseFloat(t.highPrice);
        const low24h = parseFloat(t.lowPrice);
        const open = parseFloat(t.openPrice);

        // Estimate 1h change from price vs high/low range position
        // (MEXC doesn't give 1h change directly, we'll get it from klines)
        return {
          symbol: sym,
          name: sym, // We'll enrich with names below
          price,
          change1h: null as number | null, // filled by kline data
          change24h: Math.round(change24h * 100) / 100,
          change7d: null as number | null,
          marketCap: 0, // MEXC doesn't provide this
          volume24h: Math.round(volume24h),
          sparkline: [] as number[],
          image: "",
          high24h,
          low24h,
          rank: 0,
          fundingRate: fundingMap[sym] ?? null,
        };
      }).filter(Boolean) as any[];

      // Sort by volume (most active first)
      results.sort((a: any, b: any) => b.volume24h - a.volume24h);

      // Assign ranks by volume
      results.forEach((r: any, i: number) => { r.rank = i + 1; });

      // Fetch 1h klines for top coins to get 1h change & 7d sparkline
      // Do this for top 15 only to keep it fast
      const top = results.slice(0, 15);
      const klinePromises = top.map(async (coin: any) => {
        try {
          // 1h candles, last 168 (7 days) — for sparkline + 1h change
          const pair = `${coin.symbol}USDT`;
          const klines: any[][] = await fetchJSON(
            `${MEXC_BASE}/klines?symbol=${pair}&interval=1h&limit=168`
          );
          if (klines.length > 1) {
            // 1h change: last close vs previous close
            const lastClose = parseFloat(klines[klines.length - 1][4]);
            const prevClose = parseFloat(klines[klines.length - 2][4]);
            coin.change1h = Math.round(((lastClose - prevClose) / prevClose) * 10000) / 100;

            // 7d change
            const firstClose = parseFloat(klines[0][4]);
            coin.change7d = Math.round(((lastClose - firstClose) / firstClose) * 10000) / 100;

            // Sparkline (hourly closes, downsample to ~50 points)
            const step = Math.max(1, Math.floor(klines.length / 50));
            coin.sparkline = klines.filter((_: any[], i: number) => i % step === 0).map((k: any[]) => parseFloat(k[4]));
          }
        } catch (err) { console.error("[klines] fetch failed:", err); }
      });
      await Promise.all(klinePromises);

      // Coin names
      const COIN_NAMES: Record<string, string> = {
        BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
        XRP: "XRP", DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche",
        LINK: "Chainlink", DOT: "Polkadot", NEAR: "NEAR", SUI: "Sui",
        ARB: "Arbitrum", OP: "Optimism", APT: "Aptos", INJ: "Injective",
        FIL: "Filecoin", ATOM: "Cosmos", LTC: "Litecoin", UNI: "Uniswap",
        SEI: "Sei", TIA: "Celestia", PEPE: "Pepe", SHIB: "Shiba Inu",
      };
      results.forEach((r: any) => { r.name = COIN_NAMES[r.symbol] || r.symbol; });

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Coin Detail ─────────────────────────────────────────────────
  // CoinGecko for metadata, Binance for real OHLC candles
  app.get("/api/coin/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const days = parseInt((req.query.days as string) || "30", 10);
      const id = getCoingeckoId(symbol);

      const [info, candles] = await Promise.all([
        cgFetch(`${COINGECKO_BASE}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`),
        fetchBinanceKlines(symbol, "1d", Math.min(days + 5, 200)),
      ]);

      res.json({
        symbol:             info.symbol?.toUpperCase(),
        name:               info.name,
        image:              info.image?.small,
        price:              info.market_data?.current_price?.usd,
        marketCap:          info.market_data?.market_cap?.usd,
        volume24h:          info.market_data?.total_volume?.usd,
        change24h:          info.market_data?.price_change_percentage_24h,
        change7d:           info.market_data?.price_change_percentage_7d,
        change30d:          info.market_data?.price_change_percentage_30d,
        ath:                info.market_data?.ath?.usd,
        athChange:          info.market_data?.ath_change_percentage?.usd,
        high24h:            info.market_data?.high_24h?.usd,
        low24h:             info.market_data?.low_24h?.usd,
        circulatingSupply:  info.market_data?.circulating_supply,
        totalSupply:        info.market_data?.total_supply,
        rank:               info.market_cap_rank,
        candles:            candles.slice(-days),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Full Technical Analysis ──────────────────────────────────────
  //
  // Strategy: 4H swing trading with 1D trend filter + 15m entry refinement
  //   - 4H = primary signal (the strategy timeframe)
  //   - 1D = trend direction filter (don't fight the daily trend)
  //   - 15m = entry precision (tighter stop placement)

  app.get("/api/analyze/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      // Fetch timeframes: 4H primary, 1D for trend, 15m for entry
      // 1H: Swing signal generation (needs 250+ for EMA200 seed)
      // 4H: chart display + B&R/SMC context (needs ≥150 for EMA200)
      const [candles1h, candles4h, candles1d, candles15m] = await Promise.all([
        fetchBinanceKlines(symbol, "1h",  260),   // primary Swing signal (1H — matches live strategy)
        fetchBinanceKlines(symbol, "4h",  300),   // chart display + EMA200 context
        fetchBinanceKlines(symbol, "1d",  100),   // trend filter
        fetchBinanceKlines(symbol, "15m", 200),   // entry refinement
      ]);

      const swingCandles = candles1h.length >= 250 ? candles1h : candles4h;
      if (swingCandles.length < 90) {
        return res.status(400).json({ error: "Not enough data for analysis" });
      }

      // PRIMARY: 1H Swing analysis — matches live strategy interval
      const indSwing = analyzeIndicators(swingCandles);
      const sigSwing = generateSignal(swingCandles, indSwing);

      // TREND FILTER: 1D analysis — used to confirm direction
      const ind1d = analyzeIndicators(candles1d);
      const sig1d = generateSignal(candles1d, ind1d);

      // Daily trend via EMA50 (structural level)
      const dailyCloses = candles1d.map(c => c.close);
      const dEma50 = emaArray(dailyCloses, 50);
      const lastD = dailyCloses.length - 1;
      let dailyTrend: "up" | "down" | "neutral" = "neutral";
      if (lastD >= 50) {
        const dist = (dailyCloses[lastD] - dEma50[lastD]) / dEma50[lastD];
        if (dist > 0.0075) dailyTrend = "up";
        else if (dist < -0.0075) dailyTrend = "down";
      }

      // Is the 1H signal aligned with the daily trend?
      const isBuySwing  = sigSwing.type === "BUY" || sigSwing.type === "STRONG_BUY";
      const isSellSwing = sigSwing.type === "SELL" || sigSwing.type === "STRONG_SELL";
      const isContraTrend = (isBuySwing && dailyTrend === "down") || (isSellSwing && dailyTrend === "up");
      const trendAligned = !isContraTrend || dailyTrend === "neutral";

      // Final signal: contra-trend needs STRONG signal (±6), else filtered
      const finalSignal = { ...sigSwing };
      if (isContraTrend && Math.abs(sigSwing.confluenceScore) < 6 && sigSwing.type !== "HOLD") {
        finalSignal.type = "HOLD";
        finalSignal.reason = `1H says ${sigSwing.type} but daily trend is ${dailyTrend} — needs STRONG signal to override`;
        finalSignal.entry = undefined;
        finalSignal.stopLoss = undefined;
        finalSignal.takeProfit1 = undefined;
        finalSignal.takeProfit2 = undefined;
        finalSignal.takeProfit3 = undefined;
      }

      // Agreement: do 1H and 1D agree?
      const bothBull = sigSwing.confluenceScore > 0 && sig1d.confluenceScore > 0;
      const bothBear = sigSwing.confluenceScore < 0 && sig1d.confluenceScore < 0;
      const spread = Math.abs(sigSwing.confluenceScore - sig1d.confluenceScore);

      let agreement: "strong" | "moderate" | "weak" | "conflicting";
      if      ((bothBull || bothBear) && spread < 3) agreement = "strong";
      else if ((bothBull || bothBear) && spread < 6) agreement = "moderate";
      else if (spread < 8)                           agreement = "weak";
      else                                           agreement = "conflicting";

      // Refine entry/SL using 15m candles
      let refinedEntry: { entry: number; stopLoss: number; confidence: number } | null = null;
      if (finalSignal.type !== "HOLD" && finalSignal.entry && finalSignal.stopLoss) {
        const direction = isBuySwing ? "long" : "short";
        refinedEntry = refineEntry(direction, finalSignal.entry, finalSignal.stopLoss, candles15m);
      }

      const currentPrice = candles4h[candles4h.length - 1].close;

      res.json({
        symbol:       symbol.toUpperCase(),
        currentPrice,
        indicators:   indSwing,
        signal:       finalSignal,
        candles:      candles4h.slice(-150),
        // Timeframe breakdown — key matches actual data timeframe
        timeframes: {
          "1h":  { timeframe: "1h",  label: "1H (Signal)", confluenceScore: Math.round(sigSwing.confluenceScore * 10) / 10, signalType: sigSwing.type, trend: sigSwing.trend, confidence: sigSwing.confidence },
          "1d":  { timeframe: "1d",  label: "1D (Trend)",  confluenceScore: Math.round(sig1d.confluenceScore * 10) / 10, signalType: sig1d.type, trend: sig1d.trend, confidence: sig1d.confidence },
        },
        combined: {
          score:      Math.round(sigSwing.confluenceScore * 10) / 10,
          signal:     finalSignal.type,
          confidence: finalSignal.confidence,
          agreement,
          dailyTrend,
          trendAligned,
        },
        // Refined entry from 15m
        refinedEntry: refinedEntry ? {
          entry:          Math.round(refinedEntry.entry * 100) / 100,
          stopLoss:       Math.round(refinedEntry.stopLoss * 100) / 100,
          riskReduction:  refinedEntry.confidence,
          signalEntry:    finalSignal.entry,
          signalStopLoss: finalSignal.stopLoss,
        } : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Multi-strategy signals for a coin ─────────────────────────────
  // Swing + RSI Div → 1H candles; SMC + B&R → 4H candles
  app.get("/api/signals/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const [candles1h, candles4h] = await Promise.all([
        fetchBinanceKlines(symbol, "1h", 260),   // 260 → EMA200 reliable, covers DIV_RANGE
        fetchBinanceKlines(symbol, "4h", 400),   // 400 → EMA200 seed ~2% (reliable)
      ]);
      if (candles4h.length < 150) {
        return res.status(400).json({ error: "Not enough data" });
      }

      const ind = analyzeIndicators(candles1h.length >= 250 ? candles1h : candles4h);
      const swingSig  = generateSignal(candles1h.length >= 250 ? candles1h : candles4h, ind);
      const smcSig    = smcSignal(candles4h);
      const brSig     = breakRetestSignal(candles4h);
      const rsiDivSig = candles1h.length >= 250 ? rsiDivergenceSignal(candles1h) : null;

      res.json({
        symbol: symbol.toUpperCase(),
        currentPrice: candles4h[candles4h.length - 1].close,
        strategies: [
          {
            id: "confluence-swing",
            name: "Confluence Swing",
            interval: "1h",
            signal: swingSig.type,
            score: Math.round(swingSig.confluenceScore * 10) / 10,
            confidence: swingSig.confidence,
            reason: swingSig.reason,
            entry: swingSig.entry,
            stopLoss: swingSig.stopLoss,
            takeProfit: swingSig.takeProfit1,
            trend: swingSig.trend,
          },
          {
            id: "smc",
            name: "SMC",
            interval: "4h",
            signal: smcSig.type === "NONE" ? "HOLD" : smcSig.type === "LONG" ? "BUY" : "SELL",
            score: smcSig.confidence / 10,
            confidence: smcSig.confidence,
            reason: smcSig.reason || "No signal",
            entry: smcSig.entry || undefined,
            stopLoss: smcSig.stopLoss || undefined,
            takeProfit: smcSig.takeProfit || undefined,
            structure: smcSig.structure,
            obZone: smcSig.obZone,
          },
          {
            id: "break-retest",
            name: "Break & Retest",
            interval: "4h",
            signal: brSig.type === "NONE" ? "HOLD" : brSig.type === "LONG" ? "BUY" : "SELL",
            score: brSig.confidence / 10,
            confidence: brSig.confidence,
            reason: brSig.reason || "No signal",
            entry: brSig.entry || undefined,
            stopLoss: brSig.stopLoss || undefined,
            takeProfit: brSig.takeProfit || undefined,
            level: brSig.level,
          },
          ...(rsiDivSig ? [{
            id: "rsi-divergence",
            name: "RSI Divergence",
            interval: "1h",
            signal: rsiDivSig.type === "NONE" ? "HOLD" : rsiDivSig.type === "LONG" ? "BUY" : "SELL",
            score: rsiDivSig.confidence / 10,
            confidence: rsiDivSig.confidence,
            reason: rsiDivSig.reason || "No signal",
            entry: rsiDivSig.entry || undefined,
            stopLoss: rsiDivSig.stopLoss || undefined,
            takeProfit: rsiDivSig.takeProfit || undefined,
          }] : []),
        ],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backtesting — v2 proven logic ────────────────────────────────
  //
  // Signal from 1D, evaluate on 1D (proven: 65% WR, PF 3.82)
  // Simple: TP1/TP2 or SL check per bar, compound returns
  // COOLDOWN=5 bars, FORWARD=30 bars

  app.get("/api/backtest/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      // ── 1H confirmed throughout: strategy.interval = "1h", matching live Confluence Swing
      // WINDOW=250 → EMA200 seed (200 bars) with enough history for reliable macro filter
      // COOLDOWN=20×1H bars = 20h real-time (matches backtest-swing-1h.ts COOLDOWN=20)
      const WINDOW   = 250;
      const FORWARD  = 200;  // 200×1H = 200h (≈8 days) time stop
      const COOLDOWN = 20;   // 20h cooldown — matches live cooldownHours=20

      // 8000 1H candles ≈ 333 days (≈1 year) — fast web response, statistically useful
      const allCandles = await fetchBinanceKlinesPaginated(symbol, "1h", 8000);

      if (allCandles.length < WINDOW + FORWARD + 10) {
        return res.status(400).json({ error: "Not enough historical data for backtest" });
      }

      const trades: any[] = [];
      let equity   = 100;
      let peakEq   = 100;
      let maxDD    = 0;
      let lastTradeIdx = -COOLDOWN;

      for (let i = WINDOW; i < allCandles.length - FORWARD; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window     = allCandles.slice(i - WINDOW, i + 1);
        const indicators = analyzeIndicators(window);
        const signal     = generateSignal(window, indicators);

        // Only STRONG signals (score ≥ ±6) — matches live strategy in v2-swing.ts
        // Macro filter is now built into generateSignal() — no separate check needed
        if (signal.type !== "STRONG_BUY" && signal.type !== "STRONG_SELL") continue;
        if (!signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

        lastTradeIdx = i;
        const isBuy  = signal.type === "STRONG_BUY";
        const future = allCandles.slice(i + 1, i + 1 + FORWARD);

        let outcome: "tp1" | "tp2" | "loss" | "pending" = "pending";
        let barsToOutcome = FORWARD;
        let hitTp1 = false;

        for (let j = 0; j < future.length; j++) {
          const c = future[j];
          if (isBuy) {
            if (c.low <= signal.stopLoss)     { outcome = hitTp1 ? "tp1" : "loss"; barsToOutcome = j + 1; break; }
            if (!hitTp1 && c.high >= signal.takeProfit1) hitTp1 = true;
            if (c.high >= signal.takeProfit2) { outcome = "tp2"; barsToOutcome = j + 1; break; }
          } else {
            if (c.high >= signal.stopLoss)    { outcome = hitTp1 ? "tp1" : "loss"; barsToOutcome = j + 1; break; }
            if (!hitTp1 && c.low <= signal.takeProfit1) hitTp1 = true;
            if (c.low <= signal.takeProfit2)  { outcome = "tp2"; barsToOutcome = j + 1; break; }
          }
        }

        if (outcome === "pending" && hitTp1) outcome = "tp1";

        const risk      = Math.abs(signal.entry - signal.stopLoss);
        const tp1Reward = Math.abs(signal.takeProfit1 - signal.entry);
        const tp2Reward = Math.abs(signal.takeProfit2 - signal.entry);

        let pnlPct: number;
        let outcomeLabel: "win" | "loss" | "pending";
        if (outcome === "tp2") {
          pnlPct = (tp2Reward / signal.entry) * 100;
          outcomeLabel = "win";
        } else if (outcome === "tp1") {
          pnlPct = (tp1Reward / signal.entry) * 100;
          outcomeLabel = "win";
        } else if (outcome === "loss") {
          pnlPct = -(risk / signal.entry) * 100;
          outcomeLabel = "loss";
        } else {
          const exitPrice = future.length > 0 ? future[future.length - 1].close : signal.entry;
          pnlPct = isBuy
            ? ((exitPrice - signal.entry) / signal.entry) * 100
            : ((signal.entry - exitPrice) / signal.entry) * 100;
          outcomeLabel = pnlPct >= 0 ? "win" : "loss";
        }

        // Compound return
        const posRisk = signal.positionSizePct / 100;
        const equityPnl = equity * (pnlPct / 100) * posRisk;
        equity += equityPnl;
        peakEq = Math.max(peakEq, equity);
        maxDD  = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

        // Duration label (1H bars → hours)
        const durationLabel = barsToOutcome === 1 ? "1h" : `${barsToOutcome}h`;
        const hitLevel = outcome;

        trades.push({
          time:             allCandles[i].time,
          signal:           signal.type,
          entry:            signal.entry,
          stopLoss:         signal.stopLoss,
          takeProfit1:      signal.takeProfit1,
          outcome:          outcomeLabel,
          pnlPct:           Math.round(pnlPct * 100) / 100,
          barsToOutcome,
          durationLabel,
          confluenceScore:  signal.confluenceScore,
          hitLevel,
        });
      }

      const done   = trades.filter(t => t.outcome !== "pending");
      const wins   = done.filter(t => t.outcome === "win");
      const losses = done.filter(t => t.outcome === "loss");

      const avgWin      = wins.length   ? wins.reduce((s, t)   => s + t.pnlPct, 0) / wins.length   : 0;
      const avgLoss     = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t)   => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
      const wrFrac      = done.length > 0 ? wins.length / done.length : 0;
      const expectancy  = wrFrac * avgWin - (1 - wrFrac) * avgLoss;

      // Sharpe estimate (1H bars: each bar = 1/8760 year)
      const pnls      = done.map(t => t.pnlPct);
      const pnlMean   = pnls.length > 0 ? pnls.reduce((s, x) => s + x, 0) / pnls.length : 0;
      const pnlVar    = pnls.length > 1 ? pnls.reduce((s, x) => s + (x - pnlMean) ** 2, 0) / (pnls.length - 1) : 0;
      const pnlStd    = Math.sqrt(pnlVar);
      const years     = allCandles.length / 8760;  // 1H bars (fixed: was * 4 by mistake)
      const tpy       = done.length / Math.max(years, 0.01);
      const annReturn = pnlMean * tpy;
      const annStd    = pnlStd  * Math.sqrt(tpy);
      const sharpe    = annStd > 0 ? annReturn / annStd : 0;

      const totalReturn = Math.round((equity - 100) * 100) / 100;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime  = allCandles[allCandles.length - 1]?.time || 0;
      const spanDays  = Math.round((lastTime - firstTime) / 86400);

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "Confluence Swing (1H)",
        interval:     "1h",
        totalBars:    allCandles.length,
        totalTrades:  done.length,
        winRate:      done.length > 0 ? Math.round((wins.length / done.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        expectancy:   Math.round(expectancy * 1000) / 1000,
        sharpe:       Math.round(sharpe * 100) / 100,
        totalReturn,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        winsCount:    wins.length,
        spanDays,
        barHours:     1,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backtesting — Strategy B: SMC (Smart Money Concepts) ──────────
  //
  // BOS + OB retest + rejection candle confirmation
  // SL behind OB zone, TP at next swing / 3:1 R:R, time stop: 15 candles (60h)

  app.get("/api/backtest-smc/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW         = 150;  // reliable EMA200 (22% seed influence vs 55% at 60 bars)
      const TIME_STOP      = 15;
      const COOLDOWN       = 3;
      const ZONE_COOLDOWN  = 20;   // bars before same OB zone can be traded again
      const ZONE_PCT       = 0.008; // 0.8% price zone grouping for cooldown key

      // 8000 4H candles ≈ 1333 days (3.7 years) — same as standalone script
      const allCandles = await fetchBinanceKlinesPaginated(symbol, "4h", 8000);

      if (allCandles.length < WINDOW + TIME_STOP + 10) {
        return res.status(400).json({ error: "Not enough 4H data for SMC backtest" });
      }

      const trades: any[] = [];
      let equity   = 100;
      let peakEq   = 100;
      let maxDD    = 0;
      let lastTradeIdx = -COOLDOWN;
      const zoneCooldown = new Map<string, number>(); // OB zone → last bar index

      for (let i = WINDOW; i < allCandles.length - TIME_STOP; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window = allCandles.slice(i - WINDOW, i + 1);
        const sig = smcSignal(window);

        if (sig.type === "NONE") continue;
        if (sig.confidence < 68) continue;  // match smc.ts: confidence ≥ 68% required

        // Zone-based cooldown: don't re-trade the same OB zone within ZONE_COOLDOWN bars
        const lvl = sig.obZone ? (sig.obZone.high + sig.obZone.low) / 2 : sig.entry;
        const zoneKey = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
        const lastZone = zoneCooldown.get(zoneKey) ?? -999;
        if (i - lastZone < ZONE_COOLDOWN) continue;

        zoneCooldown.set(zoneKey, i);
        lastTradeIdx = i;
        const isLong = sig.type === "LONG";
        const future = allCandles.slice(i + 1, i + 1 + TIME_STOP);

        let outcome: "tp" | "sl" | "timeout" = "timeout";
        let barsToOutcome = TIME_STOP;

        for (let j = 0; j < future.length; j++) {
          const c = future[j];
          if (isLong) {
            if (c.low <= sig.stopLoss)     { outcome = "sl"; barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit)  { outcome = "tp"; barsToOutcome = j + 1; break; }
          } else {
            if (c.high >= sig.stopLoss)    { outcome = "sl"; barsToOutcome = j + 1; break; }
            if (c.low <= sig.takeProfit)   { outcome = "tp"; barsToOutcome = j + 1; break; }
          }
        }

        const risk = Math.abs(sig.entry - sig.stopLoss);
        const reward = Math.abs(sig.takeProfit - sig.entry);
        let pnlPct: number;
        let outcomeLabel: "win" | "loss";

        if (outcome === "tp") {
          pnlPct = (reward / sig.entry) * 100;
          outcomeLabel = "win";
        } else if (outcome === "sl") {
          pnlPct = -(risk / sig.entry) * 100;
          outcomeLabel = "loss";
        } else {
          const exitPrice = future.length > 0 ? future[future.length - 1].close : sig.entry;
          pnlPct = isLong
            ? ((exitPrice - sig.entry) / sig.entry) * 100
            : ((sig.entry - exitPrice) / sig.entry) * 100;
          outcomeLabel = pnlPct >= 0 ? "win" : "loss";
        }

        const posRisk = 0.01;
        const equityPnl = equity * (pnlPct / 100) * posRisk * 100;
        equity += equityPnl;
        peakEq = Math.max(peakEq, equity);
        maxDD  = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

        const hours = barsToOutcome * 4;
        const durationLabel = hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;

        trades.push({
          time:            allCandles[i].time,
          signal:          sig.type === "LONG" ? "BUY" : "SELL",
          strategy:        "SMC",
          entry:           sig.entry,
          stopLoss:        sig.stopLoss,
          takeProfit1:     sig.takeProfit,
          outcome:         outcomeLabel,
          pnlPct:          Math.round(pnlPct * 100) / 100,
          barsToOutcome,
          durationLabel,
          confluenceScore: Math.round(sig.confidence / 10),
          hitLevel:        outcome,
          structure:       sig.structure,
        });
      }

      const wins   = trades.filter(t => t.outcome === "win");
      const losses = trades.filter(t => t.outcome === "loss");

      const avgWin      = wins.length   ? wins.reduce((s, t)   => s + t.pnlPct, 0) / wins.length   : 0;
      const avgLoss     = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t)   => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
      const wr          = trades.length > 0 ? wins.length / trades.length : 0;
      const expectancy  = wr * avgWin - (1 - wr) * avgLoss; // % per trade

      // Sharpe estimate: annualised return / annualised std-dev of per-trade PnL
      const pnls      = trades.map(t => t.pnlPct);
      const pnlMean   = pnls.length > 0 ? pnls.reduce((s, x) => s + x, 0) / pnls.length : 0;
      const pnlVar    = pnls.length > 1 ? pnls.reduce((s, x) => s + (x - pnlMean) ** 2, 0) / (pnls.length - 1) : 0;
      const pnlStd    = Math.sqrt(pnlVar);
      const years     = (allCandles.length * 4) / 8760;  // 4H bars
      const tpy       = trades.length / Math.max(years, 0.01);
      const annReturn = pnlMean * tpy;
      const annStd    = pnlStd  * Math.sqrt(tpy);
      const sharpe    = annStd > 0 ? annReturn / annStd : 0;

      const totalReturn = Math.round((equity - 100) * 100) / 100;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime  = allCandles[allCandles.length - 1]?.time || 0;
      const spanDays  = Math.round((lastTime - firstTime) / 86400);

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "SMC (4H)",
        interval:     "4h",
        totalBars:    allCandles.length,
        totalTrades:  trades.length,
        winRate:      trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        expectancy:   Math.round(expectancy * 1000) / 1000,
        sharpe:       Math.round(sharpe * 100) / 100,
        totalReturn,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        winsCount:    wins.length,
        spanDays,
        barHours:     4,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backtesting — Strategy C: Break & Retest ──────────────────────
  //
  // S/R level break + retest + rejection confirmation
  // SL behind level, TP at next S/R / 2.5:1 R:R, time stop: 15 candles (60h)

  app.get("/api/backtest-breakretest/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW         = 150;  // 150 bars → reliable EMA200 (22% seed vs 55% at 60 bars)
      const TIME_STOP      = 15;
      const COOLDOWN       = 3;
      const LEVEL_COOLDOWN = 20;    // candles before same zone can be traded again
      const ZONE_PCT       = 0.008; // 0.8% price zone grouping for cooldown

      // 8000 4H candles ≈ 1333 days (3.7 years) — same as standalone script
      const allCandles = await fetchBinanceKlinesPaginated(symbol, "4h", 8000);

      if (allCandles.length < WINDOW + TIME_STOP + 10) {
        return res.status(400).json({ error: "Not enough 4H data for break & retest backtest" });
      }

      const trades: any[] = [];
      let equity   = 100;
      let peakEq   = 100;
      let maxDD    = 0;
      let lastTradeIdx = -COOLDOWN;
      // Zone-based cooldown: prevent re-trading the same price zone within 20 bars
      // Uses price buckets (0.8% wide) to group nearby levels — solves "3 SHORTs at same level" bug
      const zoneCooldown = new Map<string, number>(); // zoneKey → last bar index

      for (let i = WINDOW; i < allCandles.length - TIME_STOP; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window = allCandles.slice(i - WINDOW, i + 1);
        const sig = breakRetestSignal(window);

        if (sig.type === "NONE") continue;
        if (sig.confidence < 68) continue;  // match break-retest.ts: confidence ≥ 68% required

        // Zone-based cooldown check
        const lvl = sig.level ?? sig.entry;
        const zoneKey = Math.round(lvl / (lvl * ZONE_PCT)).toString() + "_" + sig.type;
        const lastZone = zoneCooldown.get(zoneKey) ?? -999;
        if (i - lastZone < LEVEL_COOLDOWN) continue;

        zoneCooldown.set(zoneKey, i);
        lastTradeIdx = i;
        const isLong = sig.type === "LONG";
        const future = allCandles.slice(i + 1, i + 1 + TIME_STOP);

        let outcome: "tp" | "sl" | "timeout" = "timeout";
        let barsToOutcome = TIME_STOP;

        for (let j = 0; j < future.length; j++) {
          const c = future[j];
          if (isLong) {
            if (c.low <= sig.stopLoss)     { outcome = "sl"; barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit)  { outcome = "tp"; barsToOutcome = j + 1; break; }
          } else {
            if (c.high >= sig.stopLoss)    { outcome = "sl"; barsToOutcome = j + 1; break; }
            if (c.low <= sig.takeProfit)   { outcome = "tp"; barsToOutcome = j + 1; break; }
          }
        }

        const risk = Math.abs(sig.entry - sig.stopLoss);
        const reward = Math.abs(sig.takeProfit - sig.entry);
        let pnlPct: number;
        let outcomeLabel: "win" | "loss";

        if (outcome === "tp") {
          pnlPct = (reward / sig.entry) * 100;
          outcomeLabel = "win";
        } else if (outcome === "sl") {
          pnlPct = -(risk / sig.entry) * 100;
          outcomeLabel = "loss";
        } else {
          const exitPrice = future.length > 0 ? future[future.length - 1].close : sig.entry;
          pnlPct = isLong
            ? ((exitPrice - sig.entry) / sig.entry) * 100
            : ((sig.entry - exitPrice) / sig.entry) * 100;
          outcomeLabel = pnlPct >= 0 ? "win" : "loss";
        }

        const posRisk = 0.01;
        const equityPnl = equity * (pnlPct / 100) * posRisk * 100;
        equity += equityPnl;
        peakEq = Math.max(peakEq, equity);
        maxDD  = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

        const hours = barsToOutcome * 4;
        const durationLabel = hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;

        trades.push({
          time:            allCandles[i].time,
          signal:          sig.type === "LONG" ? "BUY" : "SELL",
          strategy:        "Break & Retest",
          entry:           sig.entry,
          stopLoss:        sig.stopLoss,
          takeProfit1:     sig.takeProfit,
          outcome:         outcomeLabel,
          pnlPct:          Math.round(pnlPct * 100) / 100,
          barsToOutcome,
          durationLabel,
          confluenceScore: Math.round(sig.confidence / 10),
          hitLevel:        outcome,
          level:           sig.level,
        });
      }

      const wins   = trades.filter(t => t.outcome === "win");
      const losses = trades.filter(t => t.outcome === "loss");

      const avgWin      = wins.length   ? wins.reduce((s, t)   => s + t.pnlPct, 0) / wins.length   : 0;
      const avgLoss     = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t)   => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
      const wr          = trades.length > 0 ? wins.length / trades.length : 0;
      const expectancy  = wr * avgWin - (1 - wr) * avgLoss;

      // Sharpe estimate: annualised return / annualised std-dev of per-trade PnL
      const pnls      = trades.map(t => t.pnlPct);
      const pnlMean   = pnls.length > 0 ? pnls.reduce((s, x) => s + x, 0) / pnls.length : 0;
      const pnlVar    = pnls.length > 1 ? pnls.reduce((s, x) => s + (x - pnlMean) ** 2, 0) / (pnls.length - 1) : 0;
      const pnlStd    = Math.sqrt(pnlVar);
      const years     = (allCandles.length * 4) / 8760;  // 4H bars
      const tpy       = trades.length / Math.max(years, 0.01);
      const annReturn = pnlMean * tpy;
      const annStd    = pnlStd  * Math.sqrt(tpy);
      const sharpe    = annStd > 0 ? annReturn / annStd : 0;

      const totalReturn = Math.round((equity - 100) * 100) / 100;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime  = allCandles[allCandles.length - 1]?.time || 0;
      const spanDays  = Math.round((lastTime - firstTime) / 86400);

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "Break & Retest (4H)",
        interval:     "4h",
        totalBars:    allCandles.length,
        totalTrades:  trades.length,
        winRate:      trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        expectancy:   Math.round(expectancy * 1000) / 1000,
        sharpe:       Math.round(sharpe * 100) / 100,
        totalReturn,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        winsCount:    wins.length,
        spanDays,
        barHours:     4,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── RSI Divergence Backtest ─────────────────────────────────────
  // 1H candles, EMA200 macro filter, TP=2.5R, COOLDOWN=20h, MAX_BARS=200h
  // Best on FIL (PF=1.72) and SAND (PF=1.70, all years positive)

  app.get("/api/backtest-rsi-div/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW   = 250;  // EMA200 seed
      const MAX_BARS = 200;  // 200h max hold
      const COOLDOWN = 20;   // 20h between signals

      const allCandles = await fetchBinanceKlinesPaginated(symbol, "1h", 8000);
      if (allCandles.length < WINDOW + MAX_BARS + 10) {
        return res.status(400).json({ error: "Not enough 1H data for RSI Divergence backtest" });
      }

      const trades: any[] = [];
      let equity = 100, peakEq = 100, maxDD = 0;
      let lastTradeIdx = -COOLDOWN;

      for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window = allCandles.slice(i - WINDOW, i + 1);
        const sig = rsiDivergenceSignal(window);
        if (sig.type === "NONE") continue;

        lastTradeIdx = i;
        const isLong = sig.type === "LONG";
        const future = allCandles.slice(i + 1, i + 1 + MAX_BARS);

        let outcome: "tp1" | "tp2" | "loss" | "timeout" = "timeout";
        let barsToOutcome = MAX_BARS;

        for (let j = 0; j < future.length; j++) {
          const c = future[j];
          if (isLong) {
            if (c.low  <= sig.stopLoss)   { outcome = "loss";  barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit2){ outcome = "tp2";   barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit) { outcome = "tp1";   barsToOutcome = j + 1; break; }
          } else {
            if (c.high >= sig.stopLoss)   { outcome = "loss";  barsToOutcome = j + 1; break; }
            if (c.low  <= sig.takeProfit2){ outcome = "tp2";   barsToOutcome = j + 1; break; }
            if (c.low  <= sig.takeProfit) { outcome = "tp1";   barsToOutcome = j + 1; break; }
          }
        }

        const risk   = Math.abs(sig.entry - sig.stopLoss);
        const tp1Rew = Math.abs(sig.takeProfit  - sig.entry);
        const tp2Rew = Math.abs(sig.takeProfit2 - sig.entry);

        let pnlPct: number;
        let outcomeLabel: "win" | "loss";
        if      (outcome === "tp2")  { pnlPct =  (tp2Rew / sig.entry) * 100; outcomeLabel = "win"; }
        else if (outcome === "tp1")  { pnlPct =  (tp1Rew / sig.entry) * 100; outcomeLabel = "win"; }
        else if (outcome === "loss") { pnlPct = -(risk    / sig.entry) * 100; outcomeLabel = "loss"; }
        else {
          const exitPrice = future.length > 0 ? future[future.length - 1].close : sig.entry;
          pnlPct = isLong ? ((exitPrice - sig.entry) / sig.entry) * 100 : ((sig.entry - exitPrice) / sig.entry) * 100;
          outcomeLabel = pnlPct >= 0 ? "win" : "loss";
        }

        const posRisk = 0.01;
        equity += equity * (pnlPct / 100) * posRisk * 100;
        peakEq = Math.max(peakEq, equity);
        maxDD  = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

        const durationLabel = barsToOutcome >= 24 ? `${Math.round(barsToOutcome / 24)}d` : `${barsToOutcome}h`;
        trades.push({
          time: allCandles[i].time, signal: sig.type === "LONG" ? "BUY" : "SELL",
          entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit,
          outcome: outcomeLabel, pnlPct: Math.round(pnlPct * 100) / 100,
          barsToOutcome, durationLabel, confluenceScore: Math.round(sig.confidence / 10),
          hitLevel: outcome, rsiDir: sig.type,
        });
      }

      const wins   = trades.filter(t => t.outcome === "win");
      const losses = trades.filter(t => t.outcome === "loss");
      const avgWin  = wins.length   ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
      const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t) => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
      const wr = trades.length > 0 ? wins.length / trades.length : 0;
      const expectancy = wr * avgWin - (1 - wr) * avgLoss;

      const pnls    = trades.map(t => t.pnlPct);
      const pnlMean = pnls.length > 0 ? pnls.reduce((s, x) => s + x, 0) / pnls.length : 0;
      const pnlVar  = pnls.length > 1 ? pnls.reduce((s, x) => s + (x - pnlMean) ** 2, 0) / (pnls.length - 1) : 0;
      const years   = (allCandles.length) / 8760;
      const tpy     = trades.length / Math.max(years, 0.01);
      const annReturn = pnlMean * tpy;
      const annStd    = Math.sqrt(pnlVar) * Math.sqrt(tpy);
      const sharpe    = annStd > 0 ? annReturn / annStd : 0;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime  = allCandles[allCandles.length - 1]?.time || 0;

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "RSI Divergence (1H)",
        interval:     "1h",
        totalBars:    allCandles.length,
        totalTrades:  trades.length,
        winRate:      trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        expectancy:   Math.round(expectancy * 1000) / 1000,
        sharpe:       Math.round(sharpe * 100) / 100,
        totalReturn:  Math.round((equity - 100) * 100) / 100,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        spanDays:     Math.round((lastTime - firstTime) / 86400),
        barHours:     1,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Liquidity Sweep Backtest (1H) ───────────────────────────────
  // Stop-hunt reversal: sweep of EQL/EQH + rejection candle + volume spike
  // SL below/above wick, TP 2.5× and 4× R:R, COOLDOWN=12h

  app.get("/api/backtest-liquidity-sweep/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW   = 220;  // EMA200 seed + signal window buffer
      const MAX_BARS = 200;  // 200h max hold (~8 days)
      const COOLDOWN = 12;   // 12h between signals on same coin

      const allCandles = await fetchBinanceKlinesPaginated(symbol, "1h", 8000);
      if (allCandles.length < WINDOW + MAX_BARS + 10) {
        return res.status(400).json({ error: "Not enough 1H data for Liquidity Sweep backtest" });
      }

      const trades: any[] = [];
      let equity = 100, peakEq = 100, maxDD = 0;
      let lastTradeIdx = -COOLDOWN;

      for (let i = WINDOW; i < allCandles.length - MAX_BARS; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window = allCandles.slice(i - WINDOW, i + 1);
        const sig = liquiditySweepSignal(window);
        if (sig.type === "NONE") continue;

        lastTradeIdx = i;
        const isLong  = sig.type === "LONG";
        const future  = allCandles.slice(i + 1, i + 1 + MAX_BARS);

        let outcome: "tp1" | "tp2" | "loss" | "timeout" = "timeout";
        let barsToOutcome = MAX_BARS;

        for (let j = 0; j < future.length; j++) {
          const c = future[j];
          if (isLong) {
            if (c.low  <= sig.stopLoss)    { outcome = "loss"; barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit2) { outcome = "tp2";  barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit)  { outcome = "tp1";  barsToOutcome = j + 1; break; }
          } else {
            if (c.high >= sig.stopLoss)    { outcome = "loss"; barsToOutcome = j + 1; break; }
            if (c.low  <= sig.takeProfit2) { outcome = "tp2";  barsToOutcome = j + 1; break; }
            if (c.low  <= sig.takeProfit)  { outcome = "tp1";  barsToOutcome = j + 1; break; }
          }
        }

        const risk    = Math.abs(sig.entry - sig.stopLoss);
        const tp1Rew  = Math.abs(sig.takeProfit  - sig.entry);
        const tp2Rew  = Math.abs(sig.takeProfit2 - sig.entry);

        let pnlPct: number;
        let outcomeLabel: "win" | "loss";
        if      (outcome === "tp2")  { pnlPct =  (tp2Rew / sig.entry) * 100; outcomeLabel = "win"; }
        else if (outcome === "tp1")  { pnlPct =  (tp1Rew / sig.entry) * 100; outcomeLabel = "win"; }
        else if (outcome === "loss") { pnlPct = -(risk    / sig.entry) * 100; outcomeLabel = "loss"; }
        else {
          const exitPrice = future.length > 0 ? future[future.length - 1].close : sig.entry;
          pnlPct = isLong
            ? ((exitPrice - sig.entry) / sig.entry) * 100
            : ((sig.entry - exitPrice) / sig.entry) * 100;
          outcomeLabel = pnlPct >= 0 ? "win" : "loss";
        }

        const posRisk = 0.01;
        equity += equity * (pnlPct / 100) * posRisk * 100;
        peakEq  = Math.max(peakEq, equity);
        maxDD   = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

        const durationLabel = barsToOutcome >= 24 ? `${Math.round(barsToOutcome / 24)}d` : `${barsToOutcome}h`;
        trades.push({
          time: allCandles[i].time, signal: sig.type,
          entry: sig.entry, stopLoss: sig.stopLoss, takeProfit1: sig.takeProfit,
          outcome: outcomeLabel, pnlPct: Math.round(pnlPct * 100) / 100,
          barsToOutcome, durationLabel, confluenceScore: sig.confidence,
          hitLevel: outcome, confidence: sig.confidence,
        });
      }

      const wins        = trades.filter(t => t.outcome === "win");
      const losses      = trades.filter(t => t.outcome === "loss");
      const avgWin      = wins.length   ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
      const avgLoss     = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t) => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
      const wr          = trades.length > 0 ? wins.length / trades.length : 0;
      const expectancy  = wr * avgWin - (1 - wr) * avgLoss;

      const pnls      = trades.map(t => t.pnlPct);
      const pnlMean   = pnls.length > 0 ? pnls.reduce((s, x) => s + x, 0) / pnls.length : 0;
      const pnlVar    = pnls.length > 1 ? pnls.reduce((s, x) => s + (x - pnlMean) ** 2, 0) / (pnls.length - 1) : 0;
      const years     = allCandles.length / 8760;
      const tpy       = trades.length / Math.max(years, 0.01);
      const annReturn = pnlMean * tpy;
      const annStd    = Math.sqrt(pnlVar) * Math.sqrt(tpy);
      const sharpe    = annStd > 0 ? annReturn / annStd : 0;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime  = allCandles[allCandles.length - 1]?.time || 0;

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "Liquidity Sweep (1H)",
        interval:     "1h",
        totalBars:    allCandles.length,
        totalTrades:  trades.length,
        winRate:      trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        expectancy:   Math.round(expectancy * 1000) / 1000,
        sharpe:       Math.round(sharpe * 100) / 100,
        totalReturn:  Math.round((equity - 100) * 100) / 100,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        spanDays:     Math.round((lastTime - firstTime) / 86400),
        barHours:     1,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Combined Multi-Strategy Backtest ────────────────────────────
  //
  // Runs both Strategy A (1D Swing) and Strategy B (4H Mean Reversion)
  // Returns per-strategy breakdown + combined metrics

  app.get("/api/backtest-all/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const base = `http://localhost:${process.env.PORT || 5000}`;

      const [resA, resB, resC] = await Promise.all([
        fetch(`${base}/api/backtest/${symbol}`).then(r => r.json()),
        fetch(`${base}/api/backtest-smc/${symbol}`).then(r => r.json()),
        fetch(`${base}/api/backtest-breakretest/${symbol}`).then(r => r.json()),
      ]);

      // Show all strategies but mark profitable ones
      const allStrategies = [
        { name: "Confluence Swing", ...resA },
        { name: "SMC", ...resB },
        { name: "Break & Retest", ...resC },
      ];
      const strategies = allStrategies.filter(s => (s.totalTrades || 0) > 0);
      strategies.forEach(s => { (s as any).profitable = (s.profitFactor || 0) >= 1; });

      // Merge trades chronologically
      const allTrades = [
        ...(resA.trades || []).map((t: any) => ({ ...t, strategy: "Confluence Swing" })),
        ...(resB.trades || []).map((t: any) => ({ ...t, strategy: "SMC" })),
        ...(resC.trades || []).map((t: any) => ({ ...t, strategy: "Break & Retest" })),
      ].sort((a, b) => a.time - b.time);

      const totalTrades = strategies.reduce((s, st) => s + (st.totalTrades || 0), 0);
      const totalWins = strategies.reduce((s, st) => s + (st.winsCount || Math.round((st.winRate / 100) * (st.totalTrades || 0))), 0);
      const combinedWR = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 1000) / 10 : 0;
      const combinedReturn = strategies.reduce((s, st) => s + (st.totalReturn || 0), 0);

      res.json({
        symbol: symbol.toUpperCase(),
        strategies,
        combined: {
          totalTrades,
          winRate: combinedWR,
          totalReturn: Math.round(combinedReturn * 100) / 100,
          maxDrawdown: Math.max(...strategies.map(s => s.maxDrawdown || 0)),
        },
        trades: allTrades.slice(-60),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Bot Mode / Settings ──────────────────────────────────────────

  app.get("/api/settings/mode", async (_req, res) => {
    try {
      const mode = await getSetting("mode") || "signal";
      res.json({ mode });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/settings/mode", async (req, res) => {
    try {
      const { mode } = req.body;
      if (!["signal", "auto", "paper"].includes(mode)) return res.status(400).json({ error: "Mode must be 'signal', 'auto', or 'paper'" });
      await setSetting("mode", mode);
      res.json({ mode });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Journal (Trade Log) ─────────────────────────────────────────

  app.get("/api/journal", async (_req, res) => {
    try {
      res.json(await getJournal());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/journal", async (req, res) => {
    try {
      const entry = req.body;
      if (!entry.symbol || !entry.direction || !entry.entry_price || !entry.stop_loss || !entry.take_profit1) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      res.json(await addJournalEntry(entry));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/journal/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await updateJournalEntry(id, req.body);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/journal/:id", async (req, res) => {
    try {
      await deleteJournalEntry(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Log Signal as Call (from analysis page) ─────────────────────
  // When the bot generates a signal, log it to journal based on current mode

  app.post("/api/journal/from-signal", async (req, res) => {
    try {
      const { symbol, signal } = req.body;
      if (!symbol || !signal || !signal.entry || !signal.stopLoss || !signal.takeProfit1) {
        return res.status(400).json({ error: "Invalid signal data" });
      }
      const mode = await getSetting("mode") || "signal";
      const direction = (signal.type === "BUY" || signal.type === "STRONG_BUY") ? "LONG" : "SHORT";
      const entry = await addJournalEntry({
        symbol: symbol.toUpperCase(),
        direction,
        entry_price: signal.entry,
        stop_loss: signal.stopLoss,
        take_profit1: signal.takeProfit1,
        take_profit2: signal.takeProfit2,
        confluence_score: signal.confluenceScore,
        mode,
        followed: mode === "auto" ? "yes" : "pending",
      });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Strategy Management ──────────────────────────────────────────

  app.get("/api/strategies", async (_req, res) => {
    const all = getAllStrategies();
    const enabledJson = await getSetting("enabled_strategies");
    let enabled: string[] = enabledJson ? JSON.parse(enabledJson) : all.map(s => s.id);
    // Migrate: if stored IDs don't match any current strategy, reset to all enabled
    const validIds = all.map(s => s.id);
    if (enabled.length > 0 && !enabled.some(id => validIds.includes(id))) {
      enabled = validIds;
      await setSetting("enabled_strategies", JSON.stringify(enabled));
    }
    res.json(all.map(s => ({
      id: s.id, name: s.name, description: s.description,
      interval: s.interval, enabled: enabled.includes(s.id),
    })));
  });

  app.put("/api/strategies/:id/toggle", async (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    const all = getAllStrategies();
    const enabledJson = await getSetting("enabled_strategies");
    let enabledList: string[] = enabledJson ? JSON.parse(enabledJson) : all.map(s => s.id);
    if (enabled) { if (!enabledList.includes(id)) enabledList.push(id); }
    else { enabledList = enabledList.filter((s: string) => s !== id); }
    await setSetting("enabled_strategies", JSON.stringify(enabledList));
    res.json({ id, enabled });
  });

  // Per-strategy stats
  app.get("/api/journal/stats", async (_req, res) => {
    const journal = await getJournal();
    const strategies = getAllStrategies();
    const stats = strategies.map(s => {
      const trades = journal.filter(e => e.strategy === s.id);
      const paper = trades.filter(e => e.mode === "paper");
      const closed = paper.filter(e => e.outcome !== "open");
      const wins = closed.filter(e => e.outcome === "win");
      const lossesArr = closed.filter(e => e.outcome === "loss");
      const totalPnl = closed.reduce((sum, e) => sum + (e.pnl_pct || 0), 0);
      const grossProfit = wins.reduce((sum, e) => sum + (e.pnl_pct || 0), 0);
      const grossLoss = Math.abs(lossesArr.reduce((sum, e) => sum + (e.pnl_pct || 0), 0));
      const pnlValues = closed.map(e => e.pnl_pct || 0);
      return {
        strategyId: s.id,
        strategyName: s.name,
        totalTrades: paper.length,
        openTrades: paper.filter(e => e.outcome === "open").length,
        closedTrades: closed.length,
        wins: wins.length,
        losses: lossesArr.length,
        winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : null,
        totalPnl: Math.round(totalPnl * 100) / 100,
        avgPnl: closed.length > 0 ? Math.round((totalPnl / closed.length) * 100) / 100 : null,
        profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : null,
        avgWin: wins.length > 0 ? Math.round((grossProfit / wins.length) * 100) / 100 : null,
        avgLoss: lossesArr.length > 0 ? Math.round(-(grossLoss / lossesArr.length) * 100) / 100 : null,
        bestTrade: pnlValues.length > 0 ? Math.round(Math.max(...pnlValues) * 100) / 100 : null,
        worstTrade: pnlValues.length > 0 ? Math.round(Math.min(...pnlValues) * 100) / 100 : null,
      };
    });
    res.json(stats);
  });

  // ── Paper Trading Engine ─────────────────────────────────────────
  //
  // Server-side intervals: check every 30s, scan every 3min
  // Scans SCANNER_COINS + strategy preferred coins
  // Live prices endpoint for frontend P&L display

  // ── Correlation groups — prevent overconcentration in correlated assets ──
  // Max 2 open positions per group simultaneously
  const COIN_GROUP: Record<string, string> = {
    SOL: "L1", AVAX: "L1", NEAR: "L1", DOT: "L1", ICP: "L1", MATIC: "L1", ADA: "L1",
    BTC: "major", ETH: "major", BNB: "major", XRP: "major", LTC: "major",
    DOGE: "meme", SHIB: "meme", PEPE: "meme",
    LINK: "defi", UNI: "defi", FIL: "defi", ATOM: "defi",
    SAND: "gaming", VET: "infra",
    SUI: "L1", ARB: "L1", OP: "L1", APT: "L1", INJ: "L1", SEI: "L1", TIA: "L1",
  };
  const MAX_PER_GROUP = 2;

  // ── Minimum 24h volume (USDT) to trade — avoids illiquid / manipulated markets ──
  const MIN_VOLUME_USDT = 30_000_000; // $30M

  // ── Volume cache (5 min) — populated from MEXC ticker ──
  let cachedVolumes: { map: Record<string, number>; fetchedAt: number } | null = null;

  async function getVolumeMap(): Promise<Record<string, number>> {
    if (cachedVolumes && Date.now() - cachedVolumes.fetchedAt < 5 * 60 * 1000) {
      return cachedVolumes.map;
    }
    try {
      const tickers: Array<{ symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string; highPrice: string; lowPrice: string; openPrice: string }> = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const map: Record<string, number> = {};
      for (const t of tickers) {
        if (t.symbol.endsWith("USDT")) {
          map[t.symbol.replace("USDT", "")] = parseFloat(t.quoteVolume) || 0;
        }
      }
      cachedVolumes = { map, fetchedAt: Date.now() };
      return map;
    } catch (err) {
      console.error("[volume-map] fetch failed:", err);
      return cachedVolumes?.map || {};
    }
  }

  // ── Funding rate cache (5 min) — MEXC perpetual futures ──────────────
  // Funding > +0.001 (0.1%) = crowded longs → skip LONG entries (squeeze risk)
  // Funding < -0.001 (-0.1%) = crowded shorts → skip SHORT entries (squeeze risk)
  const FUNDING_LONG_MAX  =  0.001;  // above this → don't open LONGs
  const FUNDING_SHORT_MIN = -0.001;  // below this → don't open SHORTs
  let cachedFunding: { map: Record<string, number>; fetchedAt: number } | null = null;

  async function getFundingMap(): Promise<Record<string, number>> {
    if (cachedFunding && Date.now() - cachedFunding.fetchedAt < 5 * 60 * 1000) {
      return cachedFunding.map;
    }
    try {
      const data: any = await fetchJSON("https://contract.mexc.com/api/v1/contract/funding_rate");
      const map: Record<string, number> = {};
      const list: any[] = data?.data ?? [];
      for (const f of list) {
        const sym = (f.symbol ?? "").replace("_USDT", "");
        if (sym) map[sym] = parseFloat(f.fundingRate) || 0;
      }
      cachedFunding = { map, fetchedAt: Date.now() };
      return map;
    } catch (err) {
      console.error("[funding-map] fetch failed:", err);
      return cachedFunding?.map || {};
    }
  }

  // ── Scan activity log — last 60 events (visible in UI for debugging) ──
  interface ScanEvent {
    time: string;
    symbol: string;
    strategy: string;
    result: "opened" | "filtered" | "no_signal";
    reason: string;
    signal?: string;
    confidence?: number;
  }
  const scanLog: ScanEvent[] = [];
  function logScan(ev: ScanEvent) {
    scanLog.unshift(ev);
    if (scanLog.length > 60) scanLog.pop();
  }

  // Dynamic coin list from MEXC (cached 5 min)
  let cachedTopCoins: { coins: string[]; fetchedAt: number } | null = null;
  const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "FDUSD", "TUSD", "USDD", "USDP", "USD1", "PYUSD", "GUSD", "FRAX", "LUSD", "SUSD", "EURC", "EURT", "AEUR", "USDE", "USDS", "CUSD", "USDX", "USDJ", "USTC", "USDB"]);

  async function getTopCoinsByVolume(count = 30): Promise<string[]> {
    if (cachedTopCoins && Date.now() - cachedTopCoins.fetchedAt < 5 * 60 * 1000) {
      return cachedTopCoins.coins;
    }
    try {
      const tickers: Array<{ symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string; highPrice: string; lowPrice: string; openPrice: string }> = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const coins = tickers
        .filter(t => t.symbol.endsWith("USDT"))
        .map(t => ({ symbol: t.symbol.replace("USDT", ""), vol: parseFloat(t.quoteVolume) || 0 }))
        .filter(t => t.symbol.length >= 2 && t.symbol.length <= 8 && !STABLECOINS.has(t.symbol))
        .sort((a, b) => b.vol - a.vol)
        .slice(0, count)
        .map(t => t.symbol);
      cachedTopCoins = { coins, fetchedAt: Date.now() };
      return coins;
    } catch (err) {
      console.error("[top-coins] fetch failed:", err);
      return cachedTopCoins?.coins || ["BTC", "ETH", "SOL", "XRP", "BNB", "AVAX", "LINK", "ADA"];
    }
  }

  async function getEnabledStrategies(): Promise<Strategy[]> {
    const all = getAllStrategies();
    const enabledJson = await getSetting("enabled_strategies");
    const enabledIds: string[] = enabledJson ? JSON.parse(enabledJson) : all.map(s => s.id);
    return all.filter(s => enabledIds.includes(s.id));
  }

  // Server-side paper trading loop
  let paperCheckInterval: ReturnType<typeof setInterval> | null = null;
  let paperScanInterval: ReturnType<typeof setInterval> | null = null;
  let paperStatus = { running: false, lastCheck: null as string | null, lastScan: null as string | null, coinsScanned: 0 };

  async function paperCheck() {
    try {
      const journal = await getJournal();
      const openPaper = journal.filter(e => e.mode === "paper" && e.outcome === "open");
      if (openPaper.length === 0) return;

      // Fetch all MEXC tickers in one call
      const tickers: Array<{ symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string; highPrice: string; lowPrice: string; openPrice: string }> = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const priceMap: Record<string, number> = {};
      for (const t of tickers) priceMap[t.symbol] = parseFloat(t.lastPrice);

      for (const trade of openPaper) {
        const pair = `${trade.symbol}USDT`;
        const price = priceMap[pair];
        if (!price) continue;

        const isLong    = trade.direction === "LONG";
        const peak      = trade.peak_price ?? trade.entry_price;
        const tp1Hit    = trade.tp1_hit === 1;
        const sl        = trade.stop_loss;
        const tp1       = trade.take_profit1;
        const tp2       = trade.take_profit2;

        // Update peak price (best price in favour of trade)
        const newPeak = isLong ? Math.max(peak, price) : Math.min(peak, price);
        if (newPeak !== peak) {
          await updateJournalEntry(trade.id, { peak_price: newPeak });
        }

        // ── TRAILING STOP (active after TP1 is hit) ──────────────
        // Trail by 2% from peak — locks in profit as price moves in our favour
        const TRAIL_PCT = 0.02;
        const trailStop = isLong
          ? newPeak * (1 - TRAIL_PCT)
          : newPeak * (1 + TRAIL_PCT);

        let outcome: string | null = null;
        let exitPrice = price;
        let closeReason = "";

        if (isLong) {
          if (price <= sl) {
            // SL hit — full loss (or break-even if TP1 was already hit)
            outcome = tp1Hit ? "breakeven" : "loss";
            exitPrice = sl;
            closeReason = tp1Hit ? "Trailing SL (break-even)" : "SL";
          } else if (!tp1Hit && tp1 && price >= tp1) {
            // TP1 reached: move SL to entry (break-even), start trailing
            await updateJournalEntry(trade.id, {
              tp1_hit: 1,
              stop_loss: trade.entry_price,  // SL → break-even
            });
            closeReason = "TP1 — trailing active, SL moved to entry";
          } else if (tp1Hit && price <= trailStop) {
            // Trailing stop triggered after TP1
            outcome = "win";
            exitPrice = trailStop;
            closeReason = `Trailing stop (peak ${newPeak.toFixed(4)}, trail ${TRAIL_PCT*100}%)`;
          } else if (tp2 && price >= tp2) {
            // TP2 — full target reached
            outcome = "win";
            exitPrice = tp2;
            closeReason = "TP2";
          }
        } else {
          if (price >= sl) {
            outcome = tp1Hit ? "breakeven" : "loss";
            exitPrice = sl;
            closeReason = tp1Hit ? "Trailing SL (break-even)" : "SL";
          } else if (!tp1Hit && tp1 && price <= tp1) {
            await updateJournalEntry(trade.id, {
              tp1_hit: 1,
              stop_loss: trade.entry_price,
            });
            closeReason = "TP1 — trailing active, SL moved to entry";
          } else if (tp1Hit && price >= trailStop) {
            outcome = "win";
            exitPrice = trailStop;
            closeReason = `Trailing stop (peak ${newPeak.toFixed(4)}, trail ${TRAIL_PCT*100}%)`;
          } else if (tp2 && price <= tp2) {
            outcome = "win";
            exitPrice = tp2;
            closeReason = "TP2";
          }
        }

        if (outcome) {
          const pnlPct = isLong
            ? ((exitPrice - trade.entry_price) / trade.entry_price) * 100
            : ((trade.entry_price - exitPrice) / trade.entry_price) * 100;

          // P&L in USD (requires position_size_usd stored at open time)
          const pnlUsd = trade.position_size_usd
            ? trade.position_size_usd * (pnlPct / 100)
            : null;

          await updateJournalEntry(trade.id, {
            outcome,
            exit_price:  Math.round(exitPrice * 10000) / 10000,
            pnl_pct:     Math.round(pnlPct * 100) / 100,
            pnl_usd:     pnlUsd !== null ? Math.round(pnlUsd * 100) / 100 : undefined,
            closed_at:   new Date().toISOString(),
            notes:       (trade.notes || "") + ` | ${closeReason}`,
          });
        }
      }
      paperStatus.lastCheck = new Date().toISOString();
    } catch (err) { console.error("[paper-check] failed:", err); }
  }

  // Helper: determine daily trend for a coin using 1D EMA50
  async function getDailyTrend(symbol: string): Promise<"up" | "down" | "neutral"> {
    try {
      const dailyCandles = await fetchBinanceKlines(symbol, "1d", 55);
      if (dailyCandles.length < 52) return "neutral";
      const closes = dailyCandles.map(c => c.close);
      // EMA50
      const k = 2 / 51;
      let ema = closes[0];
      for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
      const last = closes[closes.length - 1];
      const dist = (last - ema) / ema;
      if (dist > 0.01) return "up";
      if (dist < -0.01) return "down";
      return "neutral";
    } catch { return "neutral"; }
  }

  // Weekly trend using 1W candles — EMA20 weekly ≈ roughly 5-month moving average
  // Used as an extra filter for 4H strategies (SMC, B&R) to avoid fighting macro structure
  // neutral = don't block trades (when insufficient data or unclear direction)
  const weeklyTrendCache = new Map<string, { trend: "up" | "down" | "neutral"; fetchedAt: number }>();

  async function getWeeklyTrend(symbol: string): Promise<"up" | "down" | "neutral"> {
    const cached = weeklyTrendCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < 60 * 60 * 1000) return cached.trend; // 1h cache
    try {
      const weeklyCandles = await fetchBinanceKlines(symbol, "1w", 26);
      if (weeklyCandles.length < 20) return "neutral";
      const closes = weeklyCandles.map(c => c.close);
      const k = 2 / 21;
      let ema = closes[0];
      for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
      const last = closes[closes.length - 1];
      const dist = (last - ema) / ema;
      const trend = dist > 0.02 ? "up" : dist < -0.02 ? "down" : "neutral";
      weeklyTrendCache.set(symbol, { trend, fetchedAt: Date.now() });
      return trend;
    } catch { return "neutral"; }
  }

  async function paperScan() {
    try {
      const mode = await getSetting("mode");
      if (mode !== "paper" || !paperStatus.running) return;

      const strategies = await getEnabledStrategies();
      if (strategies.length === 0) return;

      // Use the same coin list as the market page + any strategy-specific preferred coins
      // This keeps the engine consistent with what the user sees on the Market page
      const preferredSet = new Set<string>(SCANNER_COINS);
      for (const strat of strategies) {
        for (const sym of strat.preferredSymbols ?? []) preferredSet.add(sym);
      }
      const coins = Array.from(preferredSet);
      paperStatus.coinsScanned = coins.length;

      const journal = await getJournal();
      const paperTrades = journal.filter(e => e.mode === "paper");

      // ── CAPITAL MANAGEMENT ────────────────────────────────────────
      const initialCapital = parseFloat(await getSetting("paper_capital") || "1000");
      const baseRiskPct    = parseFloat(await getSetting("paper_risk_pct") || "2");

      // Current balance = initial + sum of all closed P&L in USD
      const closedTrades  = paperTrades.filter(e => e.outcome !== "open");
      const totalPnlUsd   = closedTrades.reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
      const currentBalance = initialCapital + totalPnlUsd;

      // ── DRAWDOWN PROTECTION ───────────────────────────────────────
      // Daily: if today's closed P&L < -4R → pause scanning
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayTrades = closedTrades.filter(e => e.closed_at && new Date(e.closed_at) >= todayStart);
      const daily1R     = currentBalance * baseRiskPct / 100;
      const dailyPnlUsd = todayTrades.reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
      if (dailyPnlUsd < -4 * daily1R) return;  // Daily drawdown limit: -4R

      // Monthly: if this month's closed P&L < -8R → pause
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthTrades = closedTrades.filter(e => e.closed_at && new Date(e.closed_at) >= monthStart);
      const monthPnlUsd = monthTrades.reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
      if (monthPnlUsd < -8 * daily1R) return;  // Monthly drawdown limit: -8R

      // ── BTC MACRO RISK FILTER ─────────────────────────────────────
      // Adjust risk % based on BTC daily trend
      let riskMultiplier = 1.0;
      try {
        const btcDaily = await getDailyTrend("BTC");
        if      (btcDaily === "up")   riskMultiplier = 1.25;  // BTC bull → 2.5%
        else if (btcDaily === "down") riskMultiplier = 0.75;  // BTC bear → 1.5%
      } catch (err) { console.error("[btc-filter] failed:", err); }
      const effectiveRiskPct = baseRiskPct * riskMultiplier;

      // ── FRACTIONAL KELLY PER STRATEGY ────────────────────────────
      // Kelly% = WinRate - (LossRate / R:R)  — use half Kelly (more conservative)
      // Only activates when a strategy has ≥10 closed trades (reliable stats)
      // Falls back to baseRiskPct when insufficient data
      // Capped at 2× baseRiskPct to prevent over-sizing
      const strategyKellyPct = new Map<string, number>();
      for (const strat of strategies) {
        const closed = closedTrades.filter(e => e.strategy === strat.id);
        if (closed.length < 10) {
          strategyKellyPct.set(strat.id, baseRiskPct); // not enough data → use base
          continue;
        }
        const wins   = closed.filter(e => e.outcome === "win").length;
        const losses = closed.length - wins;
        const winRate  = wins / closed.length;
        const lossRate = losses / closed.length;
        // Average R:R from actual trades (reward / risk, both in USD)
        const winTrades  = closed.filter(e => e.outcome === "win"  && e.pnl_usd != null && e.risk_usd != null && e.risk_usd > 0);
        const lossTrades = closed.filter(e => e.outcome !== "win"  && e.pnl_usd != null && e.risk_usd != null && e.risk_usd > 0);
        const avgWinR  = winTrades.length  > 0 ? winTrades.reduce((s, e)  => s + Math.abs(e.pnl_usd!) / e.risk_usd!, 0) / winTrades.length  : 2.0;
        const avgLossR = lossTrades.length > 0 ? lossTrades.reduce((s, e) => s + Math.abs(e.pnl_usd!) / e.risk_usd!, 0) / lossTrades.length : 1.0;
        const rr = avgLossR > 0 ? avgWinR / avgLossR : avgWinR;
        // Full Kelly: WR - (LR / R:R)
        const fullKelly = winRate - (lossRate / Math.max(rr, 0.5));
        // Half Kelly — captures ~75% of optimal growth with ~50% less drawdown
        const halfKelly = fullKelly * 0.5;
        // Clamp: minimum 0.5%, maximum 2× base risk
        const kellyClamped = Math.min(Math.max(halfKelly * 100, 0.5), baseRiskPct * 2);
        strategyKellyPct.set(strat.id, kellyClamped);
      }

      // Track open trades per (symbol, strategy) to avoid duplicates
      const openPairs = new Set(
        paperTrades
          .filter(e => e.outcome === "open")
          .map(e => `${e.symbol}:${e.strategy}`)
      );

      // Build cooldown map: last closed_at per (symbol:strategy) pair
      const lastClosedAt = new Map<string, number>();
      for (const e of paperTrades) {
        if (e.outcome !== "open" && e.closed_at) {
          const key = `${e.symbol}:${e.strategy}`;
          const ts  = new Date(e.closed_at).getTime();
          if (!lastClosedAt.has(key) || ts > lastClosedAt.get(key)!) {
            lastClosedAt.set(key, ts);
          }
        }
      }

      // Limit: max 6 concurrent open trades (6 × 2% = 12% total exposure)
      const openTradesList = paperTrades.filter(e => e.outcome === "open");
      const totalOpen = openTradesList.length;
      if (totalOpen >= 6) return;

      // ── VOLUME + FUNDING MAPS — fetch once per scan ──
      const [volumeMap, fundingMap] = await Promise.all([getVolumeMap(), getFundingMap()]);

      // ── CORRELATION — count open trades per group ──
      const openByGroup: Record<string, number> = {};
      for (const t of openTradesList) {
        const g = COIN_GROUP[t.symbol];
        if (g) openByGroup[g] = (openByGroup[g] || 0) + 1;
      }

      // Group strategies by interval to avoid fetching same candles twice
      const byInterval: Record<string, Strategy[]> = {};
      for (const s of strategies) {
        if (!byInterval[s.interval]) byInterval[s.interval] = [];
        byInterval[s.interval].push(s);
      }

      for (const sym of coins) {
        if (totalOpen + openPairs.size >= 6) break;

        // ── VOLUME FILTER — skip illiquid coins ──
        const vol24h = volumeMap[sym] ?? 0;
        if (vol24h > 0 && vol24h < MIN_VOLUME_USDT) continue;

        // ── FUNDING RATE FILTER — skip crowded side ──
        // High positive funding = longs paying = market too long = squeeze risk for LONGs
        // High negative funding = shorts paying = market too short = squeeze risk for SHORTs
        const funding = fundingMap[sym];  // checked per-signal below

        // ── CORRELATION FILTER — skip if group is full ──
        const group = COIN_GROUP[sym];
        if (group && (openByGroup[group] || 0) >= MAX_PER_GROUP) continue;

        // Daily trend filter — fetch once per coin
        const dailyTrend = await getDailyTrend(sym);

        for (const [interval, strats] of Object.entries(byInterval)) {
          let candles: OHLCV[] | null = null;

          let atrPercentile: number | null = null; // computed once per (sym, interval)

          for (const strat of strats) {
            if (openPairs.has(`${sym}:${strat.id}`)) continue;

            // Skip strategy/coin combos with no proven edge (preferredSymbols filter)
            if (strat.preferredSymbols && strat.preferredSymbols.length > 0) {
              if (!strat.preferredSymbols.includes(sym)) continue;
            }

            // Cooldown check — matches backtest COOLDOWN parameter
            if (strat.cooldownHours) {
              const lastClose = lastClosedAt.get(`${sym}:${strat.id}`);
              if (lastClose) {
                const hoursSince = (Date.now() - lastClose) / (1000 * 60 * 60);
                if (hoursSince < strat.cooldownHours) continue;
              }
            }

            if (totalOpen + openPairs.size >= 6) break;

            try {
              // Lazy-fetch candles for this interval
              if (!candles) {
                const limit = Math.max(...strats.map(s => s.minCandles)) + 10;
                candles = await fetchBinanceKlines(sym, interval, limit);
              }
              if (candles.length < strat.minCandles) continue;

              // ── VOLATILITY REGIME FILTER — computed once per (sym, interval) ──
              // Skips entries when ATR is in the top 15% of its last 50-period range.
              // Explosive volatility = wider stops, unreliable candle structure, poor fills.
              if (atrPercentile === null) atrPercentile = calcATRPercentile(candles);
              if (atrPercentile > 85) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Volatility regime: ATR at ${atrPercentile}th percentile (>85) — explosive, skip entry` });
                continue;
              }

              const signal = strat.analyze(candles);
              if (!signal) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "no_signal", reason: "No setup detected" });
                continue;
              }

              // ── DAILY TREND FILTER ──
              const isContraTrend =
                (signal.direction === "LONG" && dailyTrend === "down") ||
                (signal.direction === "SHORT" && dailyTrend === "up");

              if (isContraTrend) {
                if (strat.id === "confluence-swing" && Math.abs(signal.confluenceScore) < 6) {
                  logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Contra-trend (daily ${dailyTrend}), score ${signal.confluenceScore} < 6`, signal: signal.direction, confidence: signal.confidence });
                  continue;
                }
                if (strat.id !== "confluence-swing" && signal.confidence < 75) {
                  logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Contra-trend (daily ${dailyTrend}), confidence ${signal.confidence}% < 75%`, signal: signal.direction, confidence: signal.confidence });
                  continue;
                }
              }

              // ── WEEKLY TREND FILTER — 4H strategies only (SMC, B&R) ──
              // 4H trades can last days; fighting the weekly structure kills edge.
              // 1H strategies (Swing, RSI Div) already have daily filter — weekly too slow.
              if (interval === "4h") {
                const weeklyTrend = await getWeeklyTrend(sym);
                const isContraWeekly =
                  (signal.direction === "LONG"  && weeklyTrend === "down") ||
                  (signal.direction === "SHORT" && weeklyTrend === "up");
                if (isContraWeekly) {
                  logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Contra weekly trend (${weeklyTrend}), 4H strategy needs weekly alignment`, signal: signal.direction, confidence: signal.confidence });
                  continue;
                }
              }

              // ── SHORT confirmation — require higher confidence ──
              // Shorts are riskier (squeezes, funding rates) — need stronger signal
              if (signal.direction === "SHORT" && signal.confidence < 72) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `SHORT needs ≥72% confidence, got ${signal.confidence}%`, signal: "SHORT", confidence: signal.confidence });
                continue;
              }

              // ── FUNDING RATE FILTER ──
              // Crowded longs (funding > +0.1%) → squeeze risk for new LONGs
              // Crowded shorts (funding < -0.1%) → squeeze risk for new SHORTs
              if (funding != null) {
                if (signal.direction === "LONG" && funding > FUNDING_LONG_MAX) {
                  logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Funding ${(funding*100).toFixed(3)}% > +0.1% — longs crowded, squeeze risk`, signal: "LONG", confidence: signal.confidence });
                  continue;
                }
                if (signal.direction === "SHORT" && funding < FUNDING_SHORT_MIN) {
                  logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Funding ${(funding*100).toFixed(3)}% < -0.1% — shorts crowded, squeeze risk`, signal: "SHORT", confidence: signal.confidence });
                  continue;
                }
              }

              // ── MINIMUM R:R CHECK ──
              const risk = Math.abs(signal.entry - signal.stopLoss);
              const reward = Math.abs(signal.takeProfit1 - signal.entry);
              if (risk <= 0 || reward / risk < 2.0) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `R:R ${(reward/risk).toFixed(2)} < 2.0 minimum`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }

              // ── POSITION SIZING (Fractional Kelly per strategy) ──
              // Uses half-Kelly derived from real closed trades if ≥10 available,
              // otherwise falls back to base risk %. Multiplied by BTC macro multiplier.
              const kellyPct    = (strategyKellyPct.get(strat.id) ?? baseRiskPct) * riskMultiplier;
              const slDistPct   = Math.abs(signal.entry - signal.stopLoss) / signal.entry;
              const riskUsd     = currentBalance * kellyPct / 100;
              const posSize     = slDistPct > 0 ? riskUsd / slDistPct : 0;
              const kellySource = (closedTrades.filter(e => e.strategy === strat.id).length >= 10) ? "kelly" : "base";

              await addJournalEntry({
                symbol: sym,
                direction: signal.direction,
                entry_price: signal.entry,
                stop_loss: signal.stopLoss,
                take_profit1: signal.takeProfit1,
                take_profit2: signal.takeProfit2,
                confluence_score: signal.confluenceScore,
                mode: "paper",
                strategy: strat.id,
                followed: "yes",
                position_size_usd: Math.round(posSize * 100) / 100,
                risk_usd:          Math.round(riskUsd * 100) / 100,
                notes: `Paper [${strat.name}] | 1R=${riskUsd.toFixed(2)}€ size=${posSize.toFixed(0)}€ risk=${kellyPct.toFixed(2)}%(${kellySource}) vol24h=$${(vol24h/1e6).toFixed(0)}M funding=${funding != null ? (funding*100).toFixed(3)+"%" : "n/a"} — ${signal.reason}`,
              });

              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "opened", reason: `${signal.direction} | score=${signal.confluenceScore} conf=${signal.confidence}% RR=${(reward/risk).toFixed(1)} kelly=${kellyPct.toFixed(2)}%(${kellySource})`, signal: signal.direction, confidence: signal.confidence });
              openPairs.add(`${sym}:${strat.id}`);
              const g = COIN_GROUP[sym];
              if (g) openByGroup[g] = (openByGroup[g] || 0) + 1;

            } catch (err) { console.error("[paper-scan] signal error:", err); }
          }
        }
      }
      paperStatus.lastScan = new Date().toISOString();
    } catch (err) { console.error("[paper-scan] scan failed:", err); }
  }

  function startPaperEngine() {
    if (paperStatus.running) return;
    paperStatus.running = true;
    // Run immediately
    paperCheck();
    paperScan();
    // Then on intervals: check every 30s, scan every 3min
    paperCheckInterval = setInterval(paperCheck, 30 * 1000);
    paperScanInterval = setInterval(paperScan, 3 * 60 * 1000);
  }

  function stopPaperEngine() {
    paperStatus.running = false;
    if (paperCheckInterval) { clearInterval(paperCheckInterval); paperCheckInterval = null; }
    if (paperScanInterval) { clearInterval(paperScanInterval); paperScanInterval = null; }
  }

  app.post("/api/paper/start", async (_req, res) => {
    await setSetting("mode", "paper");
    startPaperEngine();
    res.json({ running: true });
  });

  app.post("/api/paper/stop", async (_req, res) => {
    stopPaperEngine();
    res.json({ running: false });
  });

  app.get("/api/paper/status", async (_req, res) => {
    const journal = await getJournal();
    const paperTrades = journal.filter(e => e.mode === "paper");
    const openPaper   = paperTrades.filter(e => e.outcome === "open");
    const closed      = paperTrades.filter(e => e.outcome !== "open");

    // Capital stats
    const initialCapital = parseFloat(await getSetting("paper_capital") || "1000");
    const baseRiskPct    = parseFloat(await getSetting("paper_risk_pct") || "2");
    const totalPnlUsd    = closed.reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
    const currentBalance = initialCapital + totalPnlUsd;

    // Drawdown today
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayPnl   = closed.filter(e => e.closed_at && new Date(e.closed_at) >= todayStart)
                             .reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
    const daily1R    = currentBalance * baseRiskPct / 100;

    const strategies = getAllStrategies();
    const strategyCounts: Record<string, { open: number; total: number }> = {};
    for (const s of strategies) {
      const stTrades = paperTrades.filter(e => e.strategy === s.id);
      strategyCounts[s.id] = { open: stTrades.filter(e => e.outcome === "open").length, total: stTrades.length };
    }
    res.json({
      ...paperStatus,
      openTrades:       openPaper.length,
      totalPaperTrades: paperTrades.length,
      strategyCounts,
      capital: {
        initial:    initialCapital,
        balance:    Math.round(currentBalance * 100) / 100,
        totalPnlUsd: Math.round(totalPnlUsd * 100) / 100,
        riskPct:    baseRiskPct,
        oneR:       Math.round(daily1R * 100) / 100,
        todayPnlUsd: Math.round(todayPnl * 100) / 100,
        todayR:     daily1R > 0 ? Math.round((todayPnl / daily1R) * 100) / 100 : 0,
      },
    });
  });

  // Set paper trading capital and risk %
  app.post("/api/paper/capital", async (req, res) => {
    try {
      const { capital, riskPct } = req.body;
      if (capital !== undefined && capital > 0) await setSetting("paper_capital", String(capital));
      if (riskPct !== undefined && riskPct > 0 && riskPct <= 5) await setSetting("paper_risk_pct", String(riskPct));
      const ic  = parseFloat(await getSetting("paper_capital") || "1000");
      const rp  = parseFloat(await getSetting("paper_risk_pct") || "2");
      res.json({ capital: ic, riskPct: rp, oneR: Math.round(ic * rp) / 100 });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Live prices for open paper trades (polled by frontend every 10s)
  app.get("/api/paper/prices", async (_req, res) => {
    try {
      const journal = await getJournal();
      const openPaper = journal.filter(e => e.mode === "paper" && e.outcome === "open");
      if (openPaper.length === 0) return res.json([]);

      // Single MEXC call for all prices
      const tickers: Array<{ symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string; highPrice: string; lowPrice: string; openPrice: string }> = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const priceMap: Record<string, number> = {};
      for (const t of tickers) priceMap[t.symbol] = parseFloat(t.lastPrice);

      const result = openPaper.map(trade => {
        const pair = `${trade.symbol}USDT`;
        const currentPrice = priceMap[pair] || 0;
        const isLong = trade.direction === "LONG";
        const unrealizedPnl = currentPrice > 0
          ? (isLong
            ? ((currentPrice - trade.entry_price) / trade.entry_price) * 100
            : ((trade.entry_price - currentPrice) / trade.entry_price) * 100)
          : 0;

        // Progress: 0% = at entry, 100% = at TP, negative = toward SL
        const tpDist = Math.abs(trade.take_profit1 - trade.entry_price);
        const slDist = Math.abs(trade.entry_price - trade.stop_loss);
        const fromEntry = isLong ? currentPrice - trade.entry_price : trade.entry_price - currentPrice;
        const progressPct = tpDist > 0 ? (fromEntry / tpDist) * 100 : 0;
        // SL progress: how close to SL (0% = at entry, 100% = at SL)
        const slProgress = slDist > 0 ? Math.max(0, (-fromEntry / slDist) * 100) : 0;

        const unrealizedUsd = trade.position_size_usd
          ? trade.position_size_usd * (unrealizedPnl / 100)
          : null;

        return {
          id: trade.id,
          symbol: trade.symbol,
          strategy: trade.strategy || DEFAULT_STRATEGY,
          currentPrice:   Math.round(currentPrice * 10000) / 10000,
          unrealizedPnl:  Math.round(unrealizedPnl * 100) / 100,
          unrealizedUsd:  unrealizedUsd !== null ? Math.round(unrealizedUsd * 100) / 100 : null,
          riskUsd:        trade.risk_usd ?? null,
          positionSizeUsd: trade.position_size_usd ?? null,
          tp1Hit:         trade.tp1_hit === 1,
          peakPrice:      trade.peak_price ?? null,
          progressPct:    Math.round(progressPct * 10) / 10,
          slProgress:     Math.round(slProgress * 10) / 10,
        };
      });

      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Trade chart data ─────────────────────────────────────────────
  // Returns OHLCV candles around a trade's entry/exit for chart display
  app.get("/api/trade-chart/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const from     = parseInt(req.query.from as string);   // unix seconds
      const to       = parseInt(req.query.to   as string);   // unix seconds
      const interval = (req.query.interval as string) || "4h";

      if (isNaN(from)) return res.status(400).json({ error: "from required" });

      // Fetch candles: 60 before entry + window after (up to now or exit + 20 bars)
      // Use startTime/endTime Binance params to get the right window
      const msPerBar: Record<string, number> = { "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 };
      const barMs  = msPerBar[interval] ?? 14400000;
      const before = 60;  // candles before entry
      const after  = 30;  // candles after exit (or after entry if still open)

      const startMs = (from * 1000) - before * barMs;
      const endMs   = to ? (to * 1000) + after * barMs : Date.now() + after * barMs;
      const limit   = Math.min(Math.ceil((endMs - startMs) / barMs) + 5, 500);

      const pair = getBinanceSymbol(symbol);
      const url  = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&startTime=${startMs}&limit=${limit}`;
      const data: any[][] = await fetchJSON(url);

      const candles = data.map(k => ({
        time:   Math.floor(k[0] / 1000),
        open:   parseFloat(k[1]),
        high:   parseFloat(k[2]),
        low:    parseFloat(k[3]),
        close:  parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      res.json(candles);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Scan activity log — last 60 events
  app.get("/api/paper/scan-log", (_req, res) => {
    res.json(scanLog);
  });

  // Keep tick for manual triggers
  app.post("/api/paper/tick", async (_req, res) => {
    try {
      await paperCheck();
      await paperScan();
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Watchlist CRUD ───────────────────────────────────────────────
  app.get("/api/watchlist", async (_req, res) => {
    try {
      res.json(await getWatchlist());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const parsed = insertWatchlistSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error });
      res.json(await addToWatchlist(parsed.data));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      await removeFromWatchlist(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Signals History ──────────────────────────────────────────────
  app.get("/api/signals", async (_req, res) => {
    try {
      res.json(await getSignals());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── MEXC Live Trading Engine ──────────────────────────────────────
  //
  // Mirror of the paper engine but places real orders on MEXC Futures.
  // Keys stored in bot_settings (mexc_api_key / mexc_api_secret).
  // Activate by calling POST /api/live/config then POST /api/live/start.

  let liveCheckInterval: ReturnType<typeof setInterval> | null = null;
  let liveScanInterval:  ReturnType<typeof setInterval> | null = null;
  let liveEngineStatus = {
    running:       false,
    lastCheck:     null as string | null,
    lastScan:      null as string | null,
    balance:       null as number | null,
    openPositions: 0,
    error:         null as string | null,
  };

  async function getLiveClient() {
    const apiKey    = await getSetting("mexc_api_key");
    const apiSecret = await getSetting("mexc_api_secret");
    if (!apiKey || !apiSecret) throw new Error("MEXC API keys not configured. Use POST /api/live/config first.");
    return getMexcClient(apiKey, apiSecret);
  }

  async function liveCheck() {
    try {
      const client = await getLiveClient();

      // Reconcile MEXC open positions with our journal
      const mexcPositions = await client.getPositions();
      liveEngineStatus.openPositions = mexcPositions.length;
      liveEngineStatus.balance = (await client.getBalance()).availableBalance;

      const journal = await getJournal();
      const liveTrades = journal.filter(e => e.mode === "live" && e.outcome === "open");

      // Fetch all prices once
      const tickers: Array<{ symbol: string; lastPrice: string; quoteVolume: string; priceChangePercent: string; highPrice: string; lowPrice: string; openPrice: string }> = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const priceMap: Record<string, number> = {};
      for (const t of tickers) priceMap[t.symbol] = parseFloat(t.lastPrice);

      for (const trade of liveTrades) {
        const mexcSym = toMexcSymbol(trade.symbol);
        const pos = mexcPositions.find(p => p.symbol === mexcSym);

        if (!pos) {
          // Position no longer open on MEXC — it was closed (SL/TP hit or manual)
          const lastPrice = priceMap[`${trade.symbol}USDT`] || trade.entry_price;
          const isLong = trade.direction === "LONG";
          const pnlPct = isLong
            ? ((lastPrice - trade.entry_price) / trade.entry_price) * 100
            : ((trade.entry_price - lastPrice) / trade.entry_price) * 100;
          const pnlUsd = trade.position_size_usd ? trade.position_size_usd * (pnlPct / 100) : null;

          await updateJournalEntry(trade.id, {
            outcome:   pnlPct >= 0 ? "win" : "loss",
            exit_price: Math.round(lastPrice * 10000) / 10000,
            pnl_pct:   Math.round(pnlPct * 100) / 100,
            pnl_usd:   pnlUsd !== null ? Math.round(pnlUsd * 100) / 100 : undefined,
            closed_at: new Date().toISOString(),
            notes:     (trade.notes || "") + " | Closed on MEXC",
          });
          continue;
        }

        // Still open — track peak price and manage trailing stop
        const price = priceMap[`${trade.symbol}USDT`] || 0;
        if (!price) continue;

        const isLong = trade.direction === "LONG";
        const peak   = trade.peak_price ?? trade.entry_price;
        const newPeak = isLong ? Math.max(peak, price) : Math.min(peak, price);
        if (newPeak !== peak) {
          await updateJournalEntry(trade.id, { peak_price: newPeak });
        }

        // TP1 hit → move SL to break-even on MEXC
        if (!trade.tp1_hit && trade.take_profit1) {
          const tp1Hit = isLong ? price >= trade.take_profit1 : price <= trade.take_profit1;
          if (tp1Hit) {
            await updateJournalEntry(trade.id, { tp1_hit: 1, stop_loss: trade.entry_price });

            // Update SL on MEXC exchange — move to break-even
            // Find positionId from the MEXC position list (matched by symbol)
            if (pos) {
              try {
                // Use the existing TP (TP2 or TP1) when updating risk levels
                const currentTp = trade.take_profit2 ?? trade.take_profit1;
                await client.setTpSl(mexcSym, String(pos.positionId), trade.entry_price, currentTp);
              } catch (slErr: any) {
                // Log but don't break — SL update is best-effort
                console.error(`[Live] Failed to update SL on MEXC for ${trade.symbol}: ${slErr.message}`);
              }
            }
          }
        }

        // Trailing stop: 2% from peak (after TP1)
        if (trade.tp1_hit) {
          const TRAIL_PCT = 0.02;
          const trailStop = isLong ? newPeak * (1 - TRAIL_PCT) : newPeak * (1 + TRAIL_PCT);
          const trailHit  = isLong ? price <= trailStop : price >= trailStop;
          if (trailHit) {
            // Close position at market
            try {
              const posType = isLong ? 1 : 2;
              await client.closePosition(mexcSym, posType, pos.holdVol);
              
              const pnlPct = isLong
                ? ((price - trade.entry_price) / trade.entry_price) * 100
                : ((trade.entry_price - price) / trade.entry_price) * 100;
              const pnlUsd = trade.position_size_usd ? trade.position_size_usd * (pnlPct / 100) : null;

              await updateJournalEntry(trade.id, {
                outcome:   pnlPct >= 0 ? "win" : "loss",
                exit_price: Math.round(price * 10000) / 10000,
                pnl_pct:   Math.round(pnlPct * 100) / 100,
                pnl_usd:   pnlUsd !== null ? Math.round(pnlUsd * 100) / 100 : undefined,
                closed_at: new Date().toISOString(),
                notes:     (trade.notes || "") + ` | Trailing stop (peak ${newPeak.toFixed(4)}, trail ${TRAIL_PCT*100}%)`,
              });
            } catch (err) { console.error("[live-trail] journal update failed (position may already be closed):", err); }
          }
        }
      }

      liveEngineStatus.lastCheck = new Date().toISOString();
      liveEngineStatus.error = null;
    } catch (e: any) {
      liveEngineStatus.error = e.message;
    }
  }

  async function liveScan() {
    try {
      if (!liveEngineStatus.running) return;

      const client = await getLiveClient();
      const strategies = await getEnabledStrategies();
      if (strategies.length === 0) return;

      // Same coin universe as market page + strategy-specific preferred coins
      const preferredSet = new Set<string>(SCANNER_COINS);
      for (const strat of strategies) {
        for (const sym of strat.preferredSymbols ?? []) preferredSet.add(sym);
      }
      const coins = Array.from(preferredSet);

      const journal = await getJournal();
      const liveTrades = journal.filter(e => e.mode === "live");
      const openLive   = liveTrades.filter(e => e.outcome === "open");

      // Cap at 6 concurrent live positions
      if (openLive.length >= 6) return;

      // Capital from actual MEXC balance (use equity, not just available balance which excludes margin)
      const balance = await client.getBalance();
      const currentBalance = balance.equity;
      const baseRiskPct = parseFloat(await getSetting("live_risk_pct") || "1"); // conservative 1% default

      // BTC macro filter
      let riskMultiplier = 1.0;
      try {
        const btcDaily = await getDailyTrend("BTC");
        if      (btcDaily === "up")   riskMultiplier = 1.25;
        else if (btcDaily === "down") riskMultiplier = 0.75;
      } catch (err) { console.error("[btc-filter] failed:", err); }

      // Drawdown protection (same as paper)
      const closedLive = liveTrades.filter(e => e.outcome !== "open");

      // ── FRACTIONAL KELLY PER STRATEGY (live) ─────────────────────
      // Uses live closed trades if ≥10, otherwise falls back to baseRiskPct
      const liveKellyPct = new Map<string, number>();
      for (const strat of strategies) {
        const closed = closedLive.filter(e => e.strategy === strat.id);
        if (closed.length < 10) { liveKellyPct.set(strat.id, baseRiskPct); continue; }
        const wins    = closed.filter(e => e.outcome === "win").length;
        const winRate = wins / closed.length;
        const lossRate = 1 - winRate;
        const winT  = closed.filter(e => e.outcome === "win"  && e.pnl_usd != null && e.risk_usd != null && e.risk_usd > 0);
        const lossT = closed.filter(e => e.outcome !== "win"  && e.pnl_usd != null && e.risk_usd != null && e.risk_usd > 0);
        const avgWinR  = winT.length  > 0 ? winT.reduce((s, e)  => s + Math.abs(e.pnl_usd!) / e.risk_usd!, 0) / winT.length  : 2.0;
        const avgLossR = lossT.length > 0 ? lossT.reduce((s, e) => s + Math.abs(e.pnl_usd!) / e.risk_usd!, 0) / lossT.length : 1.0;
        const rr = avgLossR > 0 ? avgWinR / avgLossR : avgWinR;
        const halfKelly = (winRate - (lossRate / Math.max(rr, 0.5))) * 0.5;
        liveKellyPct.set(strat.id, Math.min(Math.max(halfKelly * 100, 0.5), baseRiskPct * 2));
      }
      const daily1R    = currentBalance * baseRiskPct / 100;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayPnl   = closedLive.filter(e => e.closed_at && new Date(e.closed_at) >= todayStart)
                                   .reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
      if (todayPnl < -4 * daily1R) return;

      const openPairs = new Set(openLive.map(e => `${e.symbol}:${e.strategy}`));
      const lastClosedAt = new Map<string, number>();
      for (const e of liveTrades) {
        if (e.outcome !== "open" && e.closed_at) {
          const key = `${e.symbol}:${e.strategy}`;
          const ts  = new Date(e.closed_at).getTime();
          if (!lastClosedAt.has(key) || ts > lastClosedAt.get(key)!) lastClosedAt.set(key, ts);
        }
      }

      // ── VOLUME + FUNDING MAPS — fetch once per scan ──
      const [volumeMap, fundingMap] = await Promise.all([getVolumeMap(), getFundingMap()]);

      // ── CORRELATION — count open live trades per group ──
      const openByGroup: Record<string, number> = {};
      for (const t of openLive) {
        const g = COIN_GROUP[t.symbol];
        if (g) openByGroup[g] = (openByGroup[g] || 0) + 1;
      }

      const byInterval: Record<string, Strategy[]> = {};
      for (const s of strategies) {
        if (!byInterval[s.interval]) byInterval[s.interval] = [];
        byInterval[s.interval].push(s);
      }

      for (const sym of coins) {
        if (openLive.length + openPairs.size >= 6) break;

        // ── VOLUME FILTER — skip illiquid coins ──
        const vol24h = volumeMap[sym] ?? 0;
        if (vol24h > 0 && vol24h < MIN_VOLUME_USDT) continue;

        // ── FUNDING RATE FILTER — skip crowded side ──
        const funding = fundingMap[sym];

        // ── CORRELATION FILTER — skip if group is full ──
        const group = COIN_GROUP[sym];
        if (group && (openByGroup[group] || 0) >= MAX_PER_GROUP) continue;

        const dailyTrend = await getDailyTrend(sym);

        for (const [interval, strats] of Object.entries(byInterval)) {
          let candles: OHLCV[] | null = null;
          let atrPercentile: number | null = null;

          for (const strat of strats) {
            if (openPairs.has(`${sym}:${strat.id}`)) continue;
            if (strat.preferredSymbols?.length && !strat.preferredSymbols.includes(sym)) continue;

            if (strat.cooldownHours) {
              const lastClose = lastClosedAt.get(`${sym}:${strat.id}`);
              if (lastClose && (Date.now() - lastClose) / 3600000 < strat.cooldownHours) continue;
            }

            if (openLive.length + openPairs.size >= 6) break;

            try {
              if (!candles) {
                const limit = Math.max(...strats.map(s => s.minCandles)) + 10;
                candles = await fetchBinanceKlines(sym, interval, limit);
              }
              if (candles.length < strat.minCandles) continue;

              // ── VOLATILITY REGIME FILTER ──
              if (atrPercentile === null) atrPercentile = calcATRPercentile(candles);
              if (atrPercentile > 85) continue;

              const signal = strat.analyze(candles);
              if (!signal) continue;

              // ── DAILY TREND FILTER ──
              const isContraTrend =
                (signal.direction === "LONG" && dailyTrend === "down") ||
                (signal.direction === "SHORT" && dailyTrend === "up");
              if (isContraTrend) {
                if (strat.id === "confluence-swing" && Math.abs(signal.confluenceScore) < 6) continue;
                if (strat.id !== "confluence-swing" && signal.confidence < 75) continue;
              }

              // ── WEEKLY TREND FILTER — 4H strategies only (SMC, B&R) ──
              if (interval === "4h") {
                const weeklyTrend = await getWeeklyTrend(sym);
                const isContraWeekly =
                  (signal.direction === "LONG"  && weeklyTrend === "down") ||
                  (signal.direction === "SHORT" && weeklyTrend === "up");
                if (isContraWeekly) continue;
              }

              // ── SHORT confirmation — require higher confidence (squeezes, funding) ──
              if (signal.direction === "SHORT" && signal.confidence < 72) continue;

              // ── FUNDING RATE FILTER ──
              if (funding != null) {
                if (signal.direction === "LONG"  && funding > FUNDING_LONG_MAX)  continue;
                if (signal.direction === "SHORT" && funding < FUNDING_SHORT_MIN) continue;
              }

              // ── MINIMUM R:R CHECK ──
              const risk   = Math.abs(signal.entry - signal.stopLoss);
              const reward = Math.abs(signal.takeProfit1 - signal.entry);
              if (risk <= 0 || reward / risk < 1.5) continue;

              // ── POSITION SIZING (Fractional Kelly per strategy) ──
              const kellyPct  = (liveKellyPct.get(strat.id) ?? baseRiskPct) * riskMultiplier;
              const slDistPct = risk / signal.entry;
              const riskUsd   = currentBalance * kellyPct / 100;
              const posSize   = slDistPct > 0 ? riskUsd / slDistPct : 0;

              const mexcSym  = toMexcSymbol(sym);
              const leverage = 5;
              const vol      = await client.calcContractVol(mexcSym, posSize, signal.entry);
              const side     = signal.direction === "LONG" ? 1 : 2;

              const order = await client.placeOrder({
                symbol:          mexcSym,
                side:            side as 1 | 2,
                openType:        2,       // cross margin
                type:            5,       // market
                vol,
                leverage,
                stopLossPrice:   signal.stopLoss,
                takeProfitPrice: signal.takeProfit2 ?? signal.takeProfit1,
              });

              await addJournalEntry({
                symbol:            sym,
                direction:         signal.direction,
                entry_price:       signal.entry,
                stop_loss:         signal.stopLoss,
                take_profit1:      signal.takeProfit1,
                take_profit2:      signal.takeProfit2,
                confluence_score:  signal.confluenceScore,
                mode:              "live",
                strategy:          strat.id,
                followed:          "yes",
                position_size_usd: Math.round(posSize * 100) / 100,
                risk_usd:          Math.round(riskUsd * 100) / 100,
                notes: `Live [${strat.name}] orderId=${order.orderId} vol=${vol} lev=${leverage}x risk=${kellyPct.toFixed(2)}%(${closedLive.filter(e=>e.strategy===strat.id).length>=10?"kelly":"base"}) vol24h=$${(vol24h/1e6).toFixed(0)}M funding=${funding != null ? (funding*100).toFixed(3)+"%" : "n/a"} | ${signal.reason}`,
              });

              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "opened", reason: `LIVE ${signal.direction} | score=${signal.confluenceScore} conf=${signal.confidence}% RR=${(reward/risk).toFixed(1)}`, signal: signal.direction, confidence: signal.confidence });
              openPairs.add(`${sym}:${strat.id}`);
              if (group) openByGroup[group] = (openByGroup[group] || 0) + 1;
            } catch (err) { console.error("[live-scan] signal error:", err); }
          }
        }
      }

      liveEngineStatus.lastScan = new Date().toISOString();
    } catch (e: any) {
      liveEngineStatus.error = e.message;
    }
  }

  function startLiveEngine() {
    if (liveEngineStatus.running) return;
    liveEngineStatus.running = true;
    liveCheck();
    liveCheckInterval = setInterval(liveCheck, 30 * 1000);
    liveScanInterval  = setInterval(liveScan, 3 * 60 * 1000);
  }

  function stopLiveEngine() {
    liveEngineStatus.running = false;
    if (liveCheckInterval) { clearInterval(liveCheckInterval); liveCheckInterval = null; }
    if (liveScanInterval)  { clearInterval(liveScanInterval);  liveScanInterval  = null; }
  }

  // Configure MEXC API keys + optional live risk settings
  app.post("/api/live/config", async (req, res) => {
    try {
      const { apiKey, apiSecret, riskPct } = req.body;
      if (!apiKey || !apiSecret) return res.status(400).json({ error: "apiKey and apiSecret are required" });
      await setSetting("mexc_api_key",    apiKey);
      await setSetting("mexc_api_secret", apiSecret);
      if (riskPct && riskPct > 0 && riskPct <= 3) await setSetting("live_risk_pct", String(riskPct));
      // Immediately test the connection
      const client = getMexcClient(apiKey, apiSecret);
      const test   = await client.testConnection();
      res.json({ ok: test.ok, balance: test.balance, error: test.error });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Test existing keys without saving new ones
  app.post("/api/live/test", async (_req, res) => {
    try {
      const client = await getLiveClient();
      const test   = await client.testConnection();
      res.json(test);
    } catch (err: any) { res.status(500).json({ ok: false, error: err.message }); }
  });

  app.post("/api/live/start", async (_req, res) => {
    try {
      startLiveEngine();
      await setSetting("mode", "live");
      res.json({ running: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/live/stop", async (_req, res) => {
    stopLiveEngine();
    res.json({ running: false });
  });

  app.get("/api/live/status", async (_req, res) => {
    try {
      const hasKeys   = !!(await getSetting("mexc_api_key")) && !!(await getSetting("mexc_api_secret"));
      const riskPct   = parseFloat(await getSetting("live_risk_pct") || "1");
      const journal   = await getJournal();
      const liveTrades = journal.filter(e => e.mode === "live");
      const closed     = liveTrades.filter(e => e.outcome !== "open");
      const totalPnl   = closed.reduce((s, e) => s + (e.pnl_usd ?? 0), 0);

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayPnl   = closed.filter(e => e.closed_at && new Date(e.closed_at) >= todayStart)
                               .reduce((s, e) => s + (e.pnl_usd ?? 0), 0);

      res.json({
        ...liveEngineStatus,
        hasKeys,
        riskPct,
        openTrades:      liveTrades.filter(e => e.outcome === "open").length,
        totalLiveTrades: liveTrades.length,
        totalPnlUsd:     Math.round(totalPnl * 100) / 100,
        todayPnlUsd:     Math.round(todayPnl * 100) / 100,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
}
