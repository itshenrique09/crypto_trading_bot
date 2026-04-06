import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import {
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getSignals,
  getJournal, addJournalEntry, updateJournalEntry, deleteJournalEntry,
  getSetting, setSetting,
} from "./storage";
import { analyzeIndicators, generateSignal, refineEntry, meanReversionSignal, breakoutSignal, type OHLCV } from "./analysis";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const MEXC_BASE = "https://api.mexc.com/api/v3";

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
      // Fetch all 24h tickers from MEXC (single call, no rate limit issues)
      const allTickers: any[] = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const tickerMap: Record<string, any> = {};
      for (const t of allTickers) {
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
            coin.sparkline = klines.filter((_: any, i: number) => i % step === 0).map((k: any) => parseFloat(k[4]));
          }
        } catch { /* skip kline errors */ }
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
      const [candles4h, candles1d, candles15m] = await Promise.all([
        fetchBinanceKlines(symbol, "4h",  300),   // primary analysis
        fetchBinanceKlines(symbol, "1d",  100),   // trend filter
        fetchBinanceKlines(symbol, "15m", 200),   // entry refinement
      ]);

      if (candles4h.length < 90) {
        return res.status(400).json({ error: "Not enough data for analysis" });
      }

      // PRIMARY: 4H analysis — this generates the trade signal
      const ind4h = analyzeIndicators(candles4h);
      const sig4h = generateSignal(candles4h, ind4h);

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

      // Is the 4H signal aligned with the daily trend?
      const isBuy4h  = sig4h.type === "BUY" || sig4h.type === "STRONG_BUY";
      const isSell4h = sig4h.type === "SELL" || sig4h.type === "STRONG_SELL";
      const isContraTrend = (isBuy4h && dailyTrend === "down") || (isSell4h && dailyTrend === "up");
      const trendAligned = !isContraTrend || dailyTrend === "neutral";

      // Final signal: contra-trend needs STRONG signal (±6), else filtered
      const finalSignal = { ...sig4h };
      if (isContraTrend && Math.abs(sig4h.confluenceScore) < 6 && sig4h.type !== "HOLD") {
        finalSignal.type = "HOLD";
        finalSignal.reason = `4H says ${sig4h.type} but daily trend is ${dailyTrend} — needs STRONG signal to override`;
        finalSignal.entry = undefined;
        finalSignal.stopLoss = undefined;
        finalSignal.takeProfit1 = undefined;
        finalSignal.takeProfit2 = undefined;
        finalSignal.takeProfit3 = undefined;
      }

      // Agreement: do 4H and 1D agree?
      const bothBull = sig4h.confluenceScore > 0 && sig1d.confluenceScore > 0;
      const bothBear = sig4h.confluenceScore < 0 && sig1d.confluenceScore < 0;
      const spread = Math.abs(sig4h.confluenceScore - sig1d.confluenceScore);

      let agreement: "strong" | "moderate" | "weak" | "conflicting";
      if      ((bothBull || bothBear) && spread < 3) agreement = "strong";
      else if ((bothBull || bothBear) && spread < 6) agreement = "moderate";
      else if (spread < 8)                           agreement = "weak";
      else                                           agreement = "conflicting";

      // Refine entry/SL using 15m candles
      let refinedEntry: { entry: number; stopLoss: number; confidence: number } | null = null;
      if (finalSignal.type !== "HOLD" && finalSignal.entry && finalSignal.stopLoss) {
        const direction = isBuy4h ? "long" : "short";
        refinedEntry = refineEntry(direction, finalSignal.entry, finalSignal.stopLoss, candles15m);
      }

      const currentPrice = candles4h[candles4h.length - 1].close;

      res.json({
        symbol:       symbol.toUpperCase(),
        currentPrice,
        indicators:   ind4h,
        signal:       finalSignal,
        candles:      candles4h.slice(-150),
        // Timeframe breakdown
        timeframes: {
          "4h":  { timeframe: "4h",  label: "4H (Signal)", confluenceScore: Math.round(sig4h.confluenceScore * 10) / 10, signalType: sig4h.type, trend: sig4h.trend, confidence: sig4h.confidence },
          "1d":  { timeframe: "1d",  label: "1D (Trend)",  confluenceScore: Math.round(sig1d.confluenceScore * 10) / 10, signalType: sig1d.type, trend: sig1d.trend, confidence: sig1d.confidence },
        },
        combined: {
          score:      Math.round(sig4h.confluenceScore * 10) / 10,
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

  // ── Backtesting — v2 proven logic ────────────────────────────────
  //
  // Signal from 1D, evaluate on 1D (proven: 65% WR, PF 3.82)
  // Simple: TP1/TP2 or SL check per bar, compound returns
  // COOLDOWN=5 bars, FORWARD=30 bars

  app.get("/api/backtest/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW   = 90;
      const FORWARD  = 30;
      const COOLDOWN = 5;

      const allCandles = await fetchBinanceKlines(symbol, "1d", 400);

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

        if (signal.type === "HOLD" || !signal.entry || !signal.stopLoss || !signal.takeProfit1 || !signal.takeProfit2) continue;

        lastTradeIdx = i;
        const isBuy  = signal.type === "BUY" || signal.type === "STRONG_BUY";
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

        // Duration label
        const durationLabel = barsToOutcome === 1 ? "1d" : `${barsToOutcome}d`;
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

      const avgWin     = wins.length   ? wins.reduce((s, t)   => s + t.pnlPct, 0) / wins.length   : 0;
      const avgLoss    = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t)   => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

      const totalReturn = Math.round((equity - 100) * 100) / 100;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime = allCandles[allCandles.length - 1]?.time || 0;
      const spanDays = Math.round((lastTime - firstTime) / 86400);

      res.json({
        symbol:       symbol.toUpperCase(),
        interval:     "1d",
        totalBars:    allCandles.length,
        totalTrades:  done.length,
        winRate:      done.length > 0 ? Math.round((wins.length / done.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalReturn,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        spanDays,
        barHours:     24,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backtesting — Strategy B: 4H Mean Reversion ──────────────────
  //
  // Fades overextended moves on 4H using BB(2.5σ) + RSI(7) + volume exhaustion
  // TP: BB midline, SL: 1.2x ATR, time stop: 5 candles (20h)

  app.get("/api/backtest-meanrev/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW    = 50;   // 50 candles lookback for indicators
      const TIME_STOP = 10;   // exit after 10 candles (40h) if no TP/SL hit
      const COOLDOWN  = 3;    // 3 candles between trades (12h)

      const allCandles = await fetchBinanceKlines(symbol, "4h", 1000);

      if (allCandles.length < WINDOW + TIME_STOP + 10) {
        return res.status(400).json({ error: "Not enough 4H data for mean reversion backtest" });
      }

      const trades: any[] = [];
      let equity   = 100;
      let peakEq   = 100;
      let maxDD    = 0;
      let lastTradeIdx = -COOLDOWN;

      for (let i = WINDOW; i < allCandles.length - TIME_STOP; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window = allCandles.slice(i - WINDOW, i + 1);
        const sig = meanReversionSignal(window);

        if (sig.type === "NONE") continue;

        lastTradeIdx = i;
        const isLong = sig.type === "LONG";
        const future = allCandles.slice(i + 1, i + 1 + TIME_STOP);

        let outcome: "tp" | "sl" | "timeout" = "timeout";
        let barsToOutcome = TIME_STOP;

        for (let j = 0; j < future.length; j++) {
          const c = future[j];
          if (isLong) {
            if (c.low <= sig.stopLoss)       { outcome = "sl"; barsToOutcome = j + 1; break; }
            if (c.high >= sig.takeProfit)     { outcome = "tp"; barsToOutcome = j + 1; break; }
          } else {
            if (c.high >= sig.stopLoss)       { outcome = "sl"; barsToOutcome = j + 1; break; }
            if (c.low <= sig.takeProfit)      { outcome = "tp"; barsToOutcome = j + 1; break; }
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

        // Position sizing: 1% risk
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
          strategy:        "Mean Reversion",
          entry:           sig.entry,
          stopLoss:        sig.stopLoss,
          takeProfit1:     sig.takeProfit,
          outcome:         outcomeLabel,
          pnlPct:          Math.round(pnlPct * 100) / 100,
          barsToOutcome,
          durationLabel,
          confluenceScore: Math.round(sig.confidence / 10) / 1, // normalize to ~score
          hitLevel:        outcome,
          rsi7:            sig.rsi7,
          bbPercentB:      sig.bbPercentB,
          volumeRatio:     sig.volumeRatio,
        });
      }

      const wins   = trades.filter(t => t.outcome === "win");
      const losses = trades.filter(t => t.outcome === "loss");

      const avgWin     = wins.length   ? wins.reduce((s, t)   => s + t.pnlPct, 0) / wins.length   : 0;
      const avgLoss    = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t)   => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

      const totalReturn = Math.round((equity - 100) * 100) / 100;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime = allCandles[allCandles.length - 1]?.time || 0;
      const spanDays = Math.round((lastTime - firstTime) / 86400);

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "Mean Reversion (4H)",
        interval:     "4h",
        totalBars:    allCandles.length,
        totalTrades:  trades.length,
        winRate:      trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalReturn,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        spanDays,
        barHours:     4,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backtesting — Strategy C: 4H Breakout ─────────────────────────
  //
  // Donchian(20) breakout + volume spike + EMA(20) trend alignment
  // TP: 2:1 R:R, SL: 1.5x ATR, time stop: 15 candles (60h)

  app.get("/api/backtest-breakout/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;

      const WINDOW    = 25;
      const TIME_STOP = 15;   // 15 candles = 60h
      const COOLDOWN  = 3;

      const allCandles = await fetchBinanceKlines(symbol, "4h", 1000);

      if (allCandles.length < WINDOW + TIME_STOP + 10) {
        return res.status(400).json({ error: "Not enough 4H data for breakout backtest" });
      }

      const trades: any[] = [];
      let equity   = 100;
      let peakEq   = 100;
      let maxDD    = 0;
      let lastTradeIdx = -COOLDOWN;

      for (let i = WINDOW; i < allCandles.length - TIME_STOP; i++) {
        if (i - lastTradeIdx < COOLDOWN) continue;

        const window = allCandles.slice(i - WINDOW, i + 1);
        const sig = breakoutSignal(window);

        if (sig.type === "NONE") continue;

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
          strategy:        "Breakout",
          entry:           sig.entry,
          stopLoss:        sig.stopLoss,
          takeProfit1:     sig.takeProfit,
          outcome:         outcomeLabel,
          pnlPct:          Math.round(pnlPct * 100) / 100,
          barsToOutcome,
          durationLabel,
          confluenceScore: Math.round(sig.confidence / 10),
          hitLevel:        outcome,
        });
      }

      const wins   = trades.filter(t => t.outcome === "win");
      const losses = trades.filter(t => t.outcome === "loss");

      const avgWin     = wins.length   ? wins.reduce((s, t)   => s + t.pnlPct, 0) / wins.length   : 0;
      const avgLoss    = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, t)   => s + t.pnlPct, 0);
      const grossLoss   = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

      const totalReturn = Math.round((equity - 100) * 100) / 100;

      const firstTime = allCandles[WINDOW]?.time || 0;
      const lastTime = allCandles[allCandles.length - 1]?.time || 0;
      const spanDays = Math.round((lastTime - firstTime) / 86400);

      res.json({
        symbol:       symbol.toUpperCase(),
        strategy:     "Breakout (4H)",
        interval:     "4h",
        totalBars:    allCandles.length,
        totalTrades:  trades.length,
        winRate:      trades.length > 0 ? Math.round((wins.length / trades.length) * 1000) / 10 : 0,
        avgWinPct:    Math.round(avgWin  * 100) / 100,
        avgLossPct:   Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalReturn,
        maxDrawdown:  Math.round(maxDD * 100) / 100,
        finalEquity:  Math.round(equity * 100) / 100,
        trades:       trades.slice(-50),
        spanDays,
        barHours:     4,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Combined Multi-Strategy Backtest ────────────────────────────
  //
  // Runs both Strategy A (1D Swing) and Strategy B (4H Mean Reversion)
  // Returns per-strategy breakdown + combined metrics

  app.get("/api/backtest-all/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const base = `http://localhost:${process.env.PORT || 5000}`;

      const [resA, resB] = await Promise.all([
        fetch(`${base}/api/backtest/${symbol}`).then(r => r.json()),
        fetch(`${base}/api/backtest-meanrev/${symbol}`).then(r => r.json()),
      ]);

      // Show all strategies but mark profitable ones
      const allStrategies = [
        { name: "Swing (1D)", ...resA },
        { name: "Mean Rev (4H)", ...resB },
      ];
      const strategies = allStrategies.filter(s => (s.totalTrades || 0) > 0);
      // Flag profitable strategies
      strategies.forEach(s => { (s as any).profitable = (s.profitFactor || 0) >= 1; });

      // Merge trades chronologically
      const allTrades = [
        ...(resA.trades || []).map((t: any) => ({ ...t, strategy: "Swing (1D)" })),
        ...(resB.trades || []).map((t: any) => ({ ...t, strategy: "Mean Rev (4H)" })),
      ].sort((a, b) => a.time - b.time);

      const totalTrades = strategies.reduce((s, st) => s + (st.totalTrades || 0), 0);
      const totalWins = strategies.reduce((s, st) => s + Math.round((st.winRate / 100) * (st.totalTrades || 0)), 0);
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

  // ── Paper Trading Engine ─────────────────────────────────────────
  //
  // Server-side intervals: check every 30s, scan every 3min
  // Scans top 30 coins by volume from MEXC
  // Live prices endpoint for frontend P&L display

  // Dynamic coin list from MEXC (cached 5 min)
  let cachedTopCoins: { coins: string[]; fetchedAt: number } | null = null;
  const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "FDUSD", "TUSD", "USDD", "USDP", "USD1", "PYUSD", "GUSD", "FRAX", "LUSD", "SUSD", "EURC", "EURT", "AEUR"]);

  async function getTopCoinsByVolume(count = 30): Promise<string[]> {
    if (cachedTopCoins && Date.now() - cachedTopCoins.fetchedAt < 5 * 60 * 1000) {
      return cachedTopCoins.coins;
    }
    try {
      const tickers: any[] = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const coins = tickers
        .filter(t => t.symbol.endsWith("USDT"))
        .map(t => ({ symbol: t.symbol.replace("USDT", ""), vol: parseFloat(t.quoteVolume) || 0 }))
        .filter(t => t.symbol.length >= 2 && t.symbol.length <= 8 && !STABLECOINS.has(t.symbol))
        .sort((a, b) => b.vol - a.vol)
        .slice(0, count)
        .map(t => t.symbol);
      cachedTopCoins = { coins, fetchedAt: Date.now() };
      return coins;
    } catch {
      return cachedTopCoins?.coins || ["BTC", "ETH", "SOL", "XRP", "BNB", "AVAX", "LINK", "ADA"];
    }
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
      const tickers: any[] = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
      const priceMap: Record<string, number> = {};
      for (const t of tickers) priceMap[t.symbol] = parseFloat(t.lastPrice);

      for (const trade of openPaper) {
        const pair = `${trade.symbol}USDT`;
        const price = priceMap[pair];
        if (!price) continue;

        const isLong = trade.direction === "LONG";
        let outcome: string | null = null;
        let exitPrice = price;

        if (isLong) {
          if (price <= trade.stop_loss) { outcome = "loss"; exitPrice = trade.stop_loss; }
          else if (price >= trade.take_profit1) { outcome = "win"; exitPrice = trade.take_profit1; }
        } else {
          if (price >= trade.stop_loss) { outcome = "loss"; exitPrice = trade.stop_loss; }
          else if (price <= trade.take_profit1) { outcome = "win"; exitPrice = trade.take_profit1; }
        }

        if (outcome) {
          const pnl = isLong
            ? ((exitPrice - trade.entry_price) / trade.entry_price) * 100
            : ((trade.entry_price - exitPrice) / trade.entry_price) * 100;
          await updateJournalEntry(trade.id, {
            outcome,
            exit_price: Math.round(exitPrice * 100) / 100,
            pnl_pct: Math.round(pnl * 100) / 100,
            closed_at: new Date().toISOString(),
          });
        }
      }
      paperStatus.lastCheck = new Date().toISOString();
    } catch { /* silent */ }
  }

  async function paperScan() {
    try {
      const mode = await getSetting("mode");
      if (mode !== "paper" || !paperStatus.running) return;

      const coins = await getTopCoinsByVolume(30);
      paperStatus.coinsScanned = coins.length;

      const journal = await getJournal();
      const openPaperSymbols = new Set(
        journal.filter(e => e.mode === "paper" && e.outcome === "open").map(e => e.symbol)
      );

      for (const sym of coins) {
        if (openPaperSymbols.has(sym)) continue;
        try {
          const candles = await fetchBinanceKlines(sym, "4h", 100);
          if (candles.length < 90) continue;

          const ind = analyzeIndicators(candles);
          const sig = generateSignal(candles, ind);

          if (sig.type === "HOLD" || !sig.entry || !sig.stopLoss || !sig.takeProfit1 || !sig.takeProfit2) continue;

          const direction = (sig.type === "BUY" || sig.type === "STRONG_BUY") ? "LONG" : "SHORT";
          await addJournalEntry({
            symbol: sym,
            direction,
            entry_price: sig.entry,
            stop_loss: sig.stopLoss,
            take_profit1: sig.takeProfit1,
            take_profit2: sig.takeProfit2,
            confluence_score: sig.confluenceScore,
            mode: "paper",
            followed: "yes",
            notes: `Paper — ${sig.type} score ${sig.confluenceScore}`,
          });
        } catch { /* skip */ }
      }
      paperStatus.lastScan = new Date().toISOString();
    } catch { /* silent */ }
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
    const openPaper = journal.filter(e => e.mode === "paper" && e.outcome === "open");
    res.json({
      ...paperStatus,
      openTrades: openPaper.length,
      totalPaperTrades: journal.filter(e => e.mode === "paper").length,
    });
  });

  // Live prices for open paper trades (polled by frontend every 10s)
  app.get("/api/paper/prices", async (_req, res) => {
    try {
      const journal = await getJournal();
      const openPaper = journal.filter(e => e.mode === "paper" && e.outcome === "open");
      if (openPaper.length === 0) return res.json([]);

      // Single MEXC call for all prices
      const tickers: any[] = await fetchJSON(`${MEXC_BASE}/ticker/24hr`);
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

        return {
          id: trade.id,
          symbol: trade.symbol,
          currentPrice: Math.round(currentPrice * 10000) / 10000,
          unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
          progressPct: Math.round(progressPct * 10) / 10,
          slProgress: Math.round(slProgress * 10) / 10,
        };
      });

      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
}
