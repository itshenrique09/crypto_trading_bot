import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import {
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getSignals,
  getJournal, addJournalEntry, updateJournalEntry, deleteJournalEntry,
  getSetting, setSetting,
} from "./storage";
import { analyzeIndicators, generateSignal, refineEntry, smcSignal, breakRetestSignal, rsiDivergenceSignal, liquiditySweepSignal, type OHLCV } from "./analysis";
import { getAllStrategies, getStrategyIds } from "./strategies/registry";
import type { Strategy } from "./strategies/types";
import { dropOpenCandle } from "./candles";
import { buildMexcContractTickerMaps, parseMexcKlineData, toMexcContractInterval, type MexcContractTicker } from "./mexc-market";
import { getRuntimeInfo } from "./runtime-info";
import { shouldSkipSymbolForOpenExposure } from "./exposure-guards";
import { isRollingDrawdownBreached, strategiesToPause } from "./portfolio-guards";
import { classifyBtcRegime, defaultBtcContext, type BtcRegimeContext, type BtcTrend } from "./btc-regime-gate";
import { startFundingCarryLoop, getFundingCarryReport } from "./funding-carry";
import { computeTrailStop, deriveOriginalRiskFromJournal, type TrailingMode, DEFAULT_TRAIL_PCT, DEFAULT_R_MULTIPLE } from "./trailing-stop";
import { confluenceBacktestDirection, isConfluenceBacktestEligible } from "./confluence-backtest";
import { getMexcClient, getOpenOrderSide, toMexcSymbol } from "./mexc-client";
import { planLiveReconciliation } from "./live-reconciliation";
import { buildAdapter, isExchangeId, venueSymbol, EXCHANGES, type ExchangeId, type ExchangePosition } from "./exchange";
import { buildLiveTp1JournalUpdate } from "./live-protection";
import { validateLiveStartConnection } from "./live-start";
import { applyPartialClose, estimateOpenTradePnl, finalizeTradeAccounting } from "./trade-accounting";
import { simulateManagedExit } from "./trade-exits";
import crypto from "crypto";

// Derive a 32-byte key from APP_PASSWORD (or a fixed fallback for dev)
const ENC_KEY = crypto.createHash("sha256")
  .update(process.env.APP_PASSWORD ?? "dev-key-not-secret")
  .digest();

function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptValue(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) return ciphertext; // not encrypted (legacy plain value)
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, iv);
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const MEXC_BASE = "https://api.mexc.com/api/v3";
const MEXC_CONTRACT_BASE = "https://contract.mexc.com";
const TP1_PARTIAL_CLOSE_PCT = 0.6;
const TAKER_FEE_PCT = 0.0002;
const SLIPPAGE_PCT = 0.0005;
const TRADE_COSTS = { takerFeePct: TAKER_FEE_PCT, slippagePct: SLIPPAGE_PCT };
// Round-trip cost ≈ 2×(taker+slip) = 0.14%. A stop tighter than this floor lets
// fees dominate the risk and produces garbage R math (e.g. a 0.21% stop turned a
// −0.35% move into −1.66R in May 2026 paper data). Reject such signals outright
// rather than widening the structural stop. 0.6% ≈ 4× round-trip → fee drag ≤ ~0.23R.
const MIN_SL_DISTANCE_PCT = 0.006;

// ── Drawdown-guard tuning (shared by paper + live engines) ──
// Calendar daily (−4R) and monthly (−8R) limits reset on their boundaries and
// can miss a slow multi-day grind. A rolling 7-day window has no blind spot;
// −6R over a week (1.5× the daily cap across 7× the time) signals a structural
// problem, not normal R-multiple variance, so it only trips on a real bleed.
const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ROLLING_DRAWDOWN_MAX_LOSS_R = 6;
// Per-strategy kill-switch: 4-trade floor (was 6). At ~3 min scans most of the
// suite is low-frequency and never reached 6 closed trades in 7 days, leaving
// the switch effectively dead for them; 4 keeps random-variance protection
// while letting it actually fire. Pause when window netR < −3R.
const KILL_SWITCH_MIN_TRADES = 4;
const KILL_SWITCH_MAX_NET_R = -3;

// ── MAX-HOLD TIMEOUT — parity with the validation harness (Jul 2026) ──────
// The pipeline harness (script/validate-pipeline.ts) and every backtest that
// validated this system force-close any trade still open after maxBars
// (200×1h ≈ 8.3 days, 60×4h = 10 days). The engines previously had no such
// exit: positions could linger for weeks (an XRP paper trade once sat open
// 5+ weeks), blocking the symbol slot and diverging from the validated system.
// Both engines now close stale positions at market once the age exceeds the
// strategy interval's budget.
const MAX_HOLD_HOURS_BY_INTERVAL: Record<string, number> = { "1h": 200, "4h": 240 };
function maxHoldHoursForStrategy(strategyId: string | null | undefined): number {
  const strat = strategyId ? getAllStrategies().find(s => s.id === strategyId) : undefined;
  return MAX_HOLD_HOURS_BY_INTERVAL[strat?.interval ?? "4h"] ?? 240;
}

function normalizeDirection(direction: string): "LONG" | "SHORT" {
  return direction === "SHORT" ? "SHORT" : "LONG";
}

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

async function fetchJSON(url: string, opts: { retries?: number; retryDelayMs?: number } = {}) {
  const { retries = 2, retryDelayMs = 500 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      // Only retry transient responses (5xx, 429). 4xx other than 429 = real error, don't retry.
      if (!res.ok) {
        const transient = res.status >= 500 || res.status === 429;
        if (transient && attempt < retries) {
          lastErr = new Error(`API error: ${res.status} from ${url}`);
        } else {
          throw new Error(`API error: ${res.status} from ${url}`);
        }
      } else {
        return res.json();
      }
    } catch (err) {
      lastErr = err;
      // Don't retry explicit aborts from upstream callers.
      if (attempt >= retries) throw err;
    } finally {
      clearTimeout(timer);
    }
    // Exponential backoff with jitter
    await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt) + Math.random() * 200));
  }
  throw lastErr ?? new Error(`fetchJSON exhausted retries for ${url}`);
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
  const fetchLimit = Math.min(limit + 1, 1000);
  const url = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${interval}&limit=${fetchLimit}`;
  const data: any[][] = await fetchJSON(url);
  const candles = data.map(k => ({
    time:   k[0] / 1000,
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
  return dropOpenCandle(candles, interval).slice(-limit);
}

// Paginated fetch — retrieves multiple batches to get large historical datasets
// Used for backtests that need 2000–3000+ candles for statistical reliability
async function fetchBinanceKlinesPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
  const pair = getBinanceSymbol(symbol);
  const candles: OHLCV[] = [];
  let endTime: number | undefined;
  const batchSize = 1000;
  const target = total + 1;
  const batches = Math.ceil(target / batchSize);

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
  return dropOpenCandle(candles, interval).slice(-total);
}

type MexcKlineResponse = {
  success?: boolean;
  code?: number;
  message?: string;
  data?: unknown;
};

async function fetchMexcFuturesKlinesBatch(symbol: string, interval: string, end?: number): Promise<OHLCV[]> {
  const mexcInterval = toMexcContractInterval(interval);
  if (!mexcInterval) throw new Error(`Unsupported MEXC contract interval: ${interval}`);

  const qs = new URLSearchParams({ interval: mexcInterval });
  if (end) qs.set("end", String(end));
  const url = `${MEXC_CONTRACT_BASE}/api/v1/contract/kline/${toMexcSymbol(symbol)}?${qs.toString()}`;
  const res = await fetchJSON(url) as MexcKlineResponse;
  if (res.success === false || !res.data) {
    throw new Error(`MEXC kline error ${res.code ?? ""}: ${res.message ?? "missing data"}`);
  }
  return parseMexcKlineData(res.data as Parameters<typeof parseMexcKlineData>[0]);
}

async function fetchMexcFuturesKlines(symbol: string, interval: string, limit: number): Promise<OHLCV[]> {
  const candles = await fetchMexcFuturesKlinesBatch(symbol, interval);
  return dropOpenCandle(candles, interval).slice(-limit);
}

async function fetchMexcFuturesKlinesPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
  const candles: OHLCV[] = [];
  let end: number | undefined;
  const target = total + 1;
  const maxBatches = Math.ceil(target / 2000) + 1;

  for (let b = 0; b < maxBatches && candles.length < target; b++) {
    const batch = await fetchMexcFuturesKlinesBatch(symbol, interval, end);
    if (batch.length === 0) break;
    candles.unshift(...batch);
    if (batch.length < 2000) break;
    end = batch[0].time - 1;
  }

  return dropOpenCandle(candles, interval).slice(-total);
}

async function fetchStrategyKlines(symbol: string, interval: string, limit: number): Promise<OHLCV[]> {
  try {
    return await fetchMexcFuturesKlines(symbol, interval, limit);
  } catch (err: any) {
    console.error(`[market-data] MEXC futures klines failed for ${symbol}/${interval}; falling back to Binance:`, err?.message ?? err);
    return fetchBinanceKlines(symbol, interval, limit);
  }
}

async function fetchStrategyKlinesPaginated(symbol: string, interval: string, total: number): Promise<OHLCV[]> {
  try {
    return await fetchMexcFuturesKlinesPaginated(symbol, interval, total);
  } catch (err: any) {
    console.error(`[market-data] MEXC futures historical klines failed for ${symbol}/${interval}; falling back to Binance:`, err?.message ?? err);
    return fetchBinanceKlinesPaginated(symbol, interval, total);
  }
}

async function fetchMexcContractTickerMaps() {
  const res = await fetchJSON(`${MEXC_CONTRACT_BASE}/api/v1/contract/ticker`) as {
    success?: boolean;
    code?: number;
    message?: string;
    data?: MexcContractTicker[] | MexcContractTicker;
  };
  if (res.success === false || !res.data) {
    throw new Error(`MEXC contract ticker error ${res.code ?? ""}: ${res.message ?? "missing data"}`);
  }
  const tickers = Array.isArray(res.data) ? res.data : [res.data];
  return buildMexcContractTickerMaps(tickers);
}

const insertWatchlistSchema = z.object({
  symbol:  z.string().min(1),
  name:    z.string().min(1),
  addedAt: z.string(),
});

const insertJournalSchema = z.object({
  symbol:        z.string().min(1).max(20).toUpperCase(),
  direction:     z.enum(["LONG", "SHORT"]),
  entry_price:   z.number().positive(),
  stop_loss:     z.number().positive(),
  take_profit1:  z.number().positive(),
  take_profit2:  z.number().positive().optional(),
  confluence_score: z.number().optional(),
  mode:          z.enum(["signal", "auto", "paper", "live"]).default("signal"),
  strategy:      z.string().optional(),
  followed:      z.enum(["pending", "yes", "no"]).optional(),
  notes:         z.string().max(2000).optional(),
  position_size_usd: z.number().positive().optional(),
  remaining_position_size_usd: z.number().nonnegative().optional(),
  realized_pnl_usd: z.number().optional(),
  risk_usd:      z.number().positive().optional(),
}).refine(d => {
  if (d.direction === "LONG")  return d.stop_loss < d.entry_price && d.take_profit1 > d.entry_price;
  if (d.direction === "SHORT") return d.stop_loss > d.entry_price && d.take_profit1 < d.entry_price;
  return true;
}, { message: "SL/TP must be on the correct side of entry price" });

const capitalSchema = z.object({
  capital:  z.number().positive().max(1_000_000).optional(),
  riskPct:  z.number().positive().max(5).optional(),
  leverage: z.number().int().min(1).max(20).optional(),
});

export async function registerRoutes(server: Server, app: Express) {

  function validateSymbol(symbol: string): string | null {
    const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.length < 2 || s.length > 20) return null;
    return s;
  }

  app.get("/api/runtime", (_req, res) => {
    res.json(getRuntimeInfo());
  });


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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });
      const days = parseInt((req.query.days as string) || "30", 10);
      const id = getCoingeckoId(symbol);

      const [info, candles] = await Promise.all([
        cgFetch(`${COINGECKO_BASE}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`),
        fetchStrategyKlines(symbol, "1d", Math.min(days + 5, 200)),
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      // Fetch timeframes: 4H primary, 1D for trend, 15m for entry
      // 1H: Swing signal generation (needs 250+ for EMA200 seed)
      // 4H: chart display + B&R/SMC context (needs ≥150 for EMA200)
      const [candles1h, candles4h, candles1d, candles15m] = await Promise.all([
        fetchStrategyKlines(symbol, "1h",  260),  // primary Swing signal (1H — matches live strategy)
        fetchStrategyKlines(symbol, "4h",  300),  // chart display + EMA200 context
        fetchStrategyKlines(symbol, "1d",  100),  // trend filter
        fetchStrategyKlines(symbol, "15m", 200),  // entry refinement
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });
      const [candles1h, candles4h] = await Promise.all([
        fetchStrategyKlines(symbol, "1h", 260),  // 260 → EMA200 reliable, covers DIV_RANGE
        fetchStrategyKlines(symbol, "4h", 400),  // 400 → EMA200 seed ~2% (reliable)
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      // ── 1H confirmed throughout: strategy.interval = "1h", matching live Confluence Swing
      // WINDOW=250 → EMA200 seed (200 bars) with enough history for reliable macro filter
      // COOLDOWN=20×1H bars = 20h real-time (matches backtest-swing-1h.ts COOLDOWN=20)
      const WINDOW   = 250;
      const FORWARD  = 200;  // 200×1H = 200h (≈8 days) time stop
      const COOLDOWN = 20;   // 20h cooldown — matches live cooldownHours=20

      // 8000 1H candles ≈ 333 days (≈1 year) — fast web response, statistically useful
      const allCandles = await fetchStrategyKlinesPaginated(symbol, "1h", 8000);

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
        if (!isConfluenceBacktestEligible(signal) || !signal.takeProfit2) continue;
        const entry = signal.entry!;
        const stopLoss = signal.stopLoss!;
        const takeProfit1 = signal.takeProfit1!;
        const takeProfit2 = signal.takeProfit2;

        lastTradeIdx = i;
        const isBuy  = confluenceBacktestDirection(signal) === "LONG";
        const future = allCandles.slice(i + 1, i + 1 + FORWARD);

        const exit = simulateManagedExit({
          direction: isBuy ? "LONG" : "SHORT",
          entry,
          stopLoss,
          takeProfit1,
          takeProfit2,
        }, future);

        const pnlPct = exit.netPnlPct;
        const outcomeLabel: "win" | "loss" = pnlPct >= 0 ? "win" : "loss";
        const barsToOutcome = exit.barsHeld || FORWARD;

        // Compound return
        const posRisk = signal.positionSizePct / 100;
        const equityPnl = equity * (pnlPct / 100) * posRisk;
        equity += equityPnl;
        peakEq = Math.max(peakEq, equity);
        maxDD  = Math.max(maxDD, (peakEq - equity) / peakEq * 100);

        // Duration label (1H bars → hours)
        const durationLabel = barsToOutcome === 1 ? "1h" : `${barsToOutcome}h`;
        const hitLevel = exit.outcome;

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
          grossPnlPct:      Math.round(exit.grossPnlPct * 100) / 100,
          costPct:          Math.round(exit.costPct * 100) / 100,
          rMultiple:        Math.round(exit.netR * 100) / 100,
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      const WINDOW         = 150;  // reliable EMA200 (22% seed influence vs 55% at 60 bars)
      const TIME_STOP      = 15;
      const COOLDOWN       = 3;
      const ZONE_COOLDOWN  = 20;   // bars before same OB zone can be traded again
      const ZONE_PCT       = 0.008; // 0.8% price zone grouping for cooldown key

      // 8000 4H candles ≈ 1333 days (3.7 years) — same as standalone script
      const allCandles = await fetchStrategyKlinesPaginated(symbol, "4h", 8000);

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

        const exit = simulateManagedExit({
          direction: isLong ? "LONG" : "SHORT",
          entry: sig.entry,
          stopLoss: sig.stopLoss,
          takeProfit1: sig.takeProfit,
          takeProfit2: sig.takeProfit,
        }, future, { tp1ClosePct: 1 });

        const barsToOutcome = exit.barsHeld || TIME_STOP;
        const pnlPct = exit.netPnlPct;
        const outcomeLabel: "win" | "loss" = pnlPct >= 0 ? "win" : "loss";

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
          hitLevel:        exit.outcome,
          grossPnlPct:     Math.round(exit.grossPnlPct * 100) / 100,
          costPct:         Math.round(exit.costPct * 100) / 100,
          rMultiple:       Math.round(exit.netR * 100) / 100,
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      const WINDOW         = 150;  // 150 bars → reliable EMA200 (22% seed vs 55% at 60 bars)
      const TIME_STOP      = 15;
      const COOLDOWN       = 3;
      const LEVEL_COOLDOWN = 20;    // candles before same zone can be traded again
      const ZONE_PCT       = 0.008; // 0.8% price zone grouping for cooldown

      // 8000 4H candles ≈ 1333 days (3.7 years) — same as standalone script
      const allCandles = await fetchStrategyKlinesPaginated(symbol, "4h", 8000);

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

        const exit = simulateManagedExit({
          direction: isLong ? "LONG" : "SHORT",
          entry: sig.entry,
          stopLoss: sig.stopLoss,
          takeProfit1: sig.takeProfit,
          takeProfit2: sig.takeProfit,
        }, future, { tp1ClosePct: 1 });

        const barsToOutcome = exit.barsHeld || TIME_STOP;
        const pnlPct = exit.netPnlPct;
        const outcomeLabel: "win" | "loss" = pnlPct >= 0 ? "win" : "loss";

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
          hitLevel:        exit.outcome,
          grossPnlPct:     Math.round(exit.grossPnlPct * 100) / 100,
          costPct:         Math.round(exit.costPct * 100) / 100,
          rMultiple:       Math.round(exit.netR * 100) / 100,
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      const WINDOW   = 250;  // EMA200 seed
      const MAX_BARS = 200;  // 200h max hold
      const COOLDOWN = 20;   // 20h between signals

      const allCandles = await fetchStrategyKlinesPaginated(symbol, "1h", 8000);
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

        const exit = simulateManagedExit({
          direction: isLong ? "LONG" : "SHORT",
          entry: sig.entry,
          stopLoss: sig.stopLoss,
          takeProfit1: sig.takeProfit,
          takeProfit2: sig.takeProfit2,
        }, future);

        const barsToOutcome = exit.barsHeld || MAX_BARS;
        const pnlPct = exit.netPnlPct;
        const outcomeLabel: "win" | "loss" = pnlPct >= 0 ? "win" : "loss";

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
          hitLevel: exit.outcome,
          grossPnlPct: Math.round(exit.grossPnlPct * 100) / 100,
          costPct: Math.round(exit.costPct * 100) / 100,
          rMultiple: Math.round(exit.netR * 100) / 100,
          rsiDir: sig.type,
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      const WINDOW   = 220;  // EMA200 seed + signal window buffer
      const MAX_BARS = 200;  // 200h max hold (~8 days)
      const COOLDOWN = 12;   // 12h between signals on same coin

      const allCandles = await fetchStrategyKlinesPaginated(symbol, "1h", 8000);
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

        const exit = simulateManagedExit({
          direction: isLong ? "LONG" : "SHORT",
          entry: sig.entry,
          stopLoss: sig.stopLoss,
          takeProfit1: sig.takeProfit,
          takeProfit2: sig.takeProfit2,
        }, future);

        const barsToOutcome = exit.barsHeld || MAX_BARS;
        const pnlPct = exit.netPnlPct;
        const outcomeLabel: "win" | "loss" = pnlPct >= 0 ? "win" : "loss";

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
          hitLevel: exit.outcome,
          grossPnlPct: Math.round(exit.grossPnlPct * 100) / 100,
          costPct: Math.round(exit.costPct * 100) / 100,
          rMultiple: Math.round(exit.netR * 100) / 100,
          confidence: sig.confidence,
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });
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

  // ── Engine settings (apply to BOTH paper and live engines) ──
  // The regime brain (ADX regime gate, short-macro filter, BTC regime gate +
  // directional overlay) is ALWAYS ON and self-governing — there are no manual
  // on/off switches. The only remaining tunable here is the trailing-stop mode,
  // which defaults to r_multiple (2R). Engine "intelligence" state is reported
  // read-only via /api/paper/status (paperStatus.intelligence).
  // ── Funding-rate carry — paper observer (Phase 1, no execution) ──
  // Always-on scanner + simulated delta-neutral carry ledger. Uncorrelated
  // return source under evaluation; see server/funding-carry.ts header.
  startFundingCarryLoop();
  app.get("/api/funding-carry", async (_req, res) => {
    try {
      res.json(await getFundingCarryReport());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/settings/feature-flags", async (_req, res) => {
    try {
      const [trailMode, trailR] = await Promise.all([
        getSetting("trailing_mode"),
        getSetting("trailing_r_multiple"),
      ]);
      res.json({
        // Always-on intelligence — reported for UI display, not toggleable.
        regime_filter_enabled:      true,
        short_macro_filter_enabled: true,
        btc_regime_gate_enabled:    true,
        // Default = r_multiple 2R since the Jul 2026 portfolio exit A/B (see paperCheck note).
        trailing_mode:              trailMode === "fixed_pct" ? "fixed_pct" : "r_multiple",
        trailing_r_multiple:        parseFloat(trailR || "2.0"),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/settings/feature-flags", async (req, res) => {
    try {
      const body = req.body ?? {};
      const updates: Record<string, string> = {};
      // Intelligence flags are ignored — the brain is always on. Only trailing config is writable.
      if (body.trailing_mode === "fixed_pct" || body.trailing_mode === "r_multiple") {
        updates.trailing_mode = body.trailing_mode;
      }
      if (typeof body.trailing_r_multiple === "number" && body.trailing_r_multiple >= 0.5 && body.trailing_r_multiple <= 5) {
        updates.trailing_r_multiple = String(body.trailing_r_multiple);
      }
      for (const [k, v] of Object.entries(updates)) await setSetting(k, v);
      res.json({ ok: true, applied: Object.keys(updates) });
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
      const parsed = insertJournalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      res.json(await addJournalEntry(parsed.data));
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
  // Selection is automatic (regime brain) — no per-mode enabled list is read.

  app.get("/api/strategies", async (_req, res) => {
    // Every strategy is always eligible — the regime brain governs which fire.
    const all = getAllStrategies();
    res.json(all.map(s => ({
      id: s.id, name: s.name, description: s.description, interval: s.interval,
      paperEnabled: true,
      liveEnabled:  true,
      enabled: true,
    })));
  });

  // Deprecated: per-strategy toggling is gone (selection is automatic via the
  // regime brain). Kept as a no-op so any stale client calls don't 404.
  app.put("/api/strategies/:id/toggle", async (req, res) => {
    const { id } = req.params;
    const { mode } = req.body as { enabled?: boolean; mode?: "paper" | "live" };
    res.json({ id, enabled: true, mode: mode === "live" ? "live" : "paper", note: "deprecated: strategy selection is automatic" });
  });

  // Per-strategy stats
  app.get("/api/journal/stats", async (_req, res) => {
    const journal = await getJournal(10_000);
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
    ONDO: "defi", ENA: "defi", CRV: "defi", RUNE: "defi",
    SAND: "gaming", GALA: "gaming", IMX: "gaming", VET: "infra",
    SUI: "L1", ARB: "L1", OP: "L1", APT: "L1", INJ: "L1", SEI: "L1", TIA: "L1",
    POL: "L1",
    FET: "ai", RENDER: "ai", WLD: "ai", GRT: "ai",
  };
  // Raised 2 → 3 with the Jul 2026 LS universe expansion (43 coins): at cap 2
  // the new coins bottlenecked inside their groups and only diluted expectancy
  // (PF 1.82, maxDD 42.4%); at cap 3 the expansion pays: +671R vs +517R
  // pre-expansion (PF 1.90, maxDD 37.6%). Cap 3 + maxOpen 12 was worse — keep 10.
  const MAX_PER_GROUP = 3;

  // ── Minimum 24h volume (USDT) to trade — avoids illiquid / manipulated markets ──
  const MIN_VOLUME_USDT = 30_000_000; // $30M
  const MAX_SPREAD_PCT = 0.002;       // 0.20% max bid/ask spread for entries

  // ── Volume cache (5 min) — populated from MEXC ticker ──
  let cachedVolumes: { map: Record<string, number>; fetchedAt: number } | null = null;

  async function getVolumeMap(): Promise<Record<string, number>> {
    if (cachedVolumes && Date.now() - cachedVolumes.fetchedAt < 5 * 60 * 1000) {
      return cachedVolumes.map;
    }
    try {
      const { amount24BySymbol: map } = await fetchMexcContractTickerMaps();
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
    if (scanLog.length > 500) scanLog.pop();
  }

  // Dynamic coin list from MEXC (cached 5 min)
  let cachedTopCoins: { coins: string[]; fetchedAt: number } | null = null;
  const STABLECOINS = new Set(["USDC", "USDT", "DAI", "BUSD", "FDUSD", "TUSD", "USDD", "USDP", "USD1", "PYUSD", "GUSD", "FRAX", "LUSD", "SUSD", "EURC", "EURT", "AEUR", "USDE", "USDS", "CUSD", "USDX", "USDJ", "USTC", "USDB"]);

  async function getTopCoinsByVolume(count = 30): Promise<string[]> {
    if (cachedTopCoins && Date.now() - cachedTopCoins.fetchedAt < 5 * 60 * 1000) {
      return cachedTopCoins.coins;
    }
    try {
      const { amount24BySymbol } = await fetchMexcContractTickerMaps();
      const coins = Object.entries(amount24BySymbol)
        .map(([symbol, vol]) => ({ symbol, vol }))
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

  // Strategy selection is fully automatic: every strategy is eligible on every
  // scan, and the regime brain (per-symbol ADX regime + BTC directional overlay)
  // plus the per-strategy drawdown kill-switch decide which actually fire. There
  // are no manual per-strategy toggles. `mode` is kept for signature parity.
  async function getEnabledStrategies(_mode: "paper" | "live"): Promise<Strategy[]> {
    return getAllStrategies();
  }

  // Server-side paper trading loop
  let paperCheckInterval: ReturnType<typeof setInterval> | null = null;
  let paperScanInterval: ReturnType<typeof setInterval> | null = null;
  interface EngineIntelligence {
    btcRegime: string;
    btcRegimeReason: string;
    maxOpen: number;
    direction: { long: boolean; short: boolean; sizeMultiplier: number; reason: string };
    pausedStrategies: string[];
    updatedAt: string;
  }
  let paperStatus = {
    running: false,
    lastCheck: null as string | null,
    lastScan: null as string | null,
    coinsScanned: 0,
    intelligence: null as EngineIntelligence | null,
  };

  async function paperCheck() {
    try {
      const journal = await getJournal(10_000);
      const openPaper = journal.filter(e => e.mode === "paper" && e.outcome === "open");
      if (openPaper.length === 0) return;

      // Fetch all MEXC futures tickers in one call.
      const { priceByPair: priceMap } = await fetchMexcContractTickerMaps();

      // ── TRAILING STOP MODE — opt-in via setting (default fixed_pct/2%) ──
      // "fixed_pct"  → legacy peak × (1 ± 2%)
      // "r_multiple" → peak ± (N × original-risk), where N defaults to 2.0.
      //   Adapts to each trade's natural noise so tight-SL momentum entries
      //   don't get knocked out by ordinary 2% pullbacks post-TP1.
      // DEFAULT = r_multiple 2R since Jul 2026: the full-pipeline portfolio A/B
      // (script/validate-pipeline.ts, exit-layer round) showed r_multiple beats
      // fixed 2% on EVERY metric in BOTH windows: PF 1.99 vs 1.90, +715.5R vs
      // +674.3R, maxDD 31.2% vs 35.8%. The old per-strategy objection (it hurt
      // Confluence Swing) is moot — that strategy was cut. A fixed % trail is
      // too tight for wide-ATR entries and too loose for tight ones; scaling
      // the trail to each trade's own risk unit is the technically correct form.
      // Opt back into "fixed_pct" via the trailing_mode setting if ever needed.
      const trailingMode: TrailingMode =
        (await getSetting("trailing_mode")) === "fixed_pct" ? "fixed_pct" : "r_multiple";
      const trailingRMultiple = parseFloat((await getSetting("trailing_r_multiple")) || String(DEFAULT_R_MULTIPLE));

      for (const trade of openPaper) {
        const pair = `${trade.symbol}USDT`;
        const price = priceMap[pair];
        if (!price) continue;

        const isLong    = trade.direction === "LONG";
        const peak      = trade.peak_price ?? trade.entry_price;
        let tp1Hit      = trade.tp1_hit === 1;
        const sl        = trade.stop_loss;
        const tp1       = trade.take_profit1;
        const tp2       = trade.take_profit2;
        const accountingState = {
          direction: isLong ? "LONG" as const : "SHORT" as const,
          entryPrice: trade.entry_price,
          positionSizeUsd: trade.position_size_usd,
          remainingPositionSizeUsd: trade.remaining_position_size_usd,
          realizedPnlUsd: trade.realized_pnl_usd,
        };

        // ── MAX-HOLD TIMEOUT — close stale positions at market ──────────
        const ageHours = (Date.now() - new Date(trade.created_at).getTime()) / 3_600_000;
        const maxHoldH = maxHoldHoursForStrategy(trade.strategy);
        if (Number.isFinite(ageHours) && ageHours > maxHoldH) {
          const timeoutAccounting = finalizeTradeAccounting(accountingState, price, TRADE_COSTS);
          await updateJournalEntry(trade.id, {
            outcome:     timeoutAccounting.outcome,
            exit_price:  Math.round(price * 10000) / 10000,
            pnl_pct:     Math.round(timeoutAccounting.pnlPct * 100) / 100,
            pnl_usd:     timeoutAccounting.pnlUsd !== null ? Math.round(timeoutAccounting.pnlUsd * 100) / 100 : undefined,
            remaining_position_size_usd: 0,
            closed_at:   new Date().toISOString(),
            notes:       (trade.notes || "") + ` | Max-hold timeout ${maxHoldH}h — closed at market (backtest parity)`,
          });
          continue;
        }

        // Update peak price (best price in favour of trade)
        const newPeak = isLong ? Math.max(peak, price) : Math.min(peak, price);
        if (newPeak !== peak) {
          await updateJournalEntry(trade.id, { peak_price: newPeak });
        }

        // ── TRAILING STOP (active after TP1 is hit) ──────────────
        // Mode = "fixed_pct" (legacy 2%) or "r_multiple" (peak ± N×risk).
        const originalRisk = deriveOriginalRiskFromJournal(
          trade.risk_usd,
          trade.position_size_usd,
          trade.entry_price,
        );
        const trailStop = computeTrailStop({
          direction: isLong ? "LONG" : "SHORT",
          peak: newPeak,
          entry: trade.entry_price,
          originalRisk,
          mode: trailingMode,
          fixedPct: DEFAULT_TRAIL_PCT,
          rMultiple: trailingRMultiple,
        });
        const trailDescription = trailingMode === "r_multiple"
          ? `r_multiple ${trailingRMultiple}× (risk ${originalRisk.toFixed(6)})`
          : `fixed ${(DEFAULT_TRAIL_PCT * 100).toFixed(0)}%`;

        let outcome: string | null = null;
        let exitPrice = price;
        let closeReason = "";

        // Check trailing stop BEFORE SL: after TP1 the SL sits at entry, so a fast
        // drop below entry in one tick could otherwise close at break-even instead
        // of the (higher, in favour) trailing stop level — converting a win into 0R.
        if (isLong) {
          if (tp1Hit && price <= trailStop) {
            outcome = "win";
            exitPrice = trailStop;
            closeReason = `Trailing stop (peak ${newPeak.toFixed(4)}, ${trailDescription})`;
          } else if (price <= sl) {
            outcome = tp1Hit ? "breakeven" : "loss";
            exitPrice = sl;
            closeReason = tp1Hit ? "Trailing SL (break-even)" : "SL";
          } else if (!tp1Hit && tp1 && price >= tp1) {
            // TP1 reached: move SL to entry (break-even), start trailing
            const partial = applyPartialClose(accountingState, tp1, TP1_PARTIAL_CLOSE_PCT, TRADE_COSTS);
            await updateJournalEntry(trade.id, {
              tp1_hit: 1,
              stop_loss: trade.entry_price,  // SL → break-even
              peak_price: newPeak,
              remaining_position_size_usd: partial.remainingPositionSizeUsd,
              realized_pnl_usd: partial.realizedPnlUsd,
            });
            accountingState.remainingPositionSizeUsd = partial.remainingPositionSizeUsd;
            accountingState.realizedPnlUsd = partial.realizedPnlUsd;
            tp1Hit = true;
            closeReason = `TP1 ${Math.round(TP1_PARTIAL_CLOSE_PCT * 100)}% partial — trailing active, SL moved to entry`;
          } else if (tp2 && price >= tp2) {
            outcome = "win";
            exitPrice = tp2;
            closeReason = "TP2";
          }
        } else {
          if (tp1Hit && price >= trailStop) {
            outcome = "win";
            exitPrice = trailStop;
            closeReason = `Trailing stop (peak ${newPeak.toFixed(4)}, ${trailDescription})`;
          } else if (price >= sl) {
            outcome = tp1Hit ? "breakeven" : "loss";
            exitPrice = sl;
            closeReason = tp1Hit ? "Trailing SL (break-even)" : "SL";
          } else if (!tp1Hit && tp1 && price <= tp1) {
            const partial = applyPartialClose(accountingState, tp1, TP1_PARTIAL_CLOSE_PCT, TRADE_COSTS);
            await updateJournalEntry(trade.id, {
              tp1_hit: 1,
              stop_loss: trade.entry_price,
              peak_price: newPeak,
              remaining_position_size_usd: partial.remainingPositionSizeUsd,
              realized_pnl_usd: partial.realizedPnlUsd,
            });
            accountingState.remainingPositionSizeUsd = partial.remainingPositionSizeUsd;
            accountingState.realizedPnlUsd = partial.realizedPnlUsd;
            tp1Hit = true;
            closeReason = `TP1 ${Math.round(TP1_PARTIAL_CLOSE_PCT * 100)}% partial — trailing active, SL moved to entry`;
          } else if (tp2 && price <= tp2) {
            outcome = "win";
            exitPrice = tp2;
            closeReason = "TP2";
          }
        }

        if (outcome) {
          const finalAccounting = finalizeTradeAccounting(accountingState, exitPrice, TRADE_COSTS);

          await updateJournalEntry(trade.id, {
            outcome:     finalAccounting.outcome,
            exit_price:  Math.round(exitPrice * 10000) / 10000,
            pnl_pct:     Math.round(finalAccounting.pnlPct * 100) / 100,
            pnl_usd:     finalAccounting.pnlUsd !== null ? Math.round(finalAccounting.pnlUsd * 100) / 100 : undefined,
            remaining_position_size_usd: 0,
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
      const dailyCandles = await fetchStrategyKlines(symbol, "1d", 55);
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
      const weeklyCandles = await fetchStrategyKlines(symbol, "1w", 26);
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

      const strategies = await getEnabledStrategies("paper");
      if (strategies.length === 0) return;

      // Use the same coin list as the market page + any strategy-specific preferred coins
      // This keeps the engine consistent with what the user sees on the Market page
      const preferredSet = new Set<string>(SCANNER_COINS);
      for (const strat of strategies) {
        for (const sym of strat.preferredSymbols ?? []) preferredSet.add(sym);
      }
      const coins = Array.from(preferredSet);
      paperStatus.coinsScanned = coins.length;

      const journal = await getJournal(10_000);
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

      // NOTE (Jul 2026): the -8R MONTHLY guard was removed after the full-pipeline
      // harness (script/validate-pipeline.ts) showed it fired on normal variance
      // (1609 blocked entries in baseline) and then froze the rest of the month:
      // removing it alone was worth +36R over the window. Daily -4R and rolling-7d
      // -6R remain — they bind rarely and cut genuine loss streaks.

      // Rolling 7-day: catches a multi-day grind that never trips the daily cap.
      if (isRollingDrawdownBreached(closedTrades, daily1R, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R })) {
        console.log(`[paper-scan] Rolling 7d drawdown < -${ROLLING_DRAWDOWN_MAX_LOSS_R}R — scanning paused`);
        return;
      }

      // ── BTC MACRO RISK FILTER ─────────────────────────────────────
      // Adjust risk % based on BTC daily trend
      let riskMultiplier = 1.0;
      let btcDailyTrend: BtcTrend = "neutral";
      try {
        btcDailyTrend = await getDailyTrend("BTC") as BtcTrend;
        if      (btcDailyTrend === "up")   riskMultiplier = 1.25;  // BTC bull → 2.5%
        else if (btcDailyTrend === "down") riskMultiplier = 0.75;  // BTC bear → 1.5%
      } catch (err) { console.error("[btc-filter] failed:", err); }

      // ── REGIME BRAIN (always on — no manual flags) ───────────────
      // BTC weekly+daily trend is computed for the risk multiplier and reported
      // to the UI. Jul 2026 full-pipeline A/B (script/validate-pipeline.ts):
      //   • the DYNAMIC position cap (2-6 by regime) was mixed vs a fixed 6 and
      //     the pruned stack performed better with fixed 6 → cap is fixed.
      //   • the DIRECTIONAL overlay (blocking longs in risk_off etc.) cost ~27R
      //     over the window — profitable reversal trades were the casualties →
      //     both directions always allowed; strategy edge + weekly filter govern.
      let btcContext: BtcRegimeContext = defaultBtcContext();
      try {
        const btcWeekly = (await getWeeklyTrend("BTC")) as BtcTrend;
        btcContext = classifyBtcRegime({ daily: btcDailyTrend, weekly: btcWeekly });
        console.log(`[paper-scan] BTC regime: ${btcContext.reason} (informational — cap fixed at 10, both directions open)`);
      } catch (err) {
        console.error("[btc-regime-gate] failed:", err);
      }
      // Cap raised 6 → 10 (Jul 2026 capacity A/B): +55R and LOWER maxDD (27.4%
      // vs 28.4%) — more concurrent diversification smooths the equity curve.
      // 12 was identical to 10 (saturation); 2-per-symbol was worse. At 2% risk,
      // 10 concurrent = 20% max at-risk, spread across ≥5 correlation groups.
      const effectiveMaxOpen = 10;
      const dirPolicy = { long: true, short: true, sizeMultiplier: 1.0, reason: "directional overlay retired Jul 2026 — pipeline A/B: blocking cost ~27R/yr" };

      // ── POSITION SIZING — fixed fractional (Kelly retired Jul 2026) ──
      // Half-Kelly from ≥10 closed trades was A/B-tested in the full-pipeline
      // harness: it added return only by over-sizing after win streaks and more
      // than DOUBLED max drawdown (62% vs 28% in the final config). Fixed base
      // risk % won on every risk-adjusted basis. 10-trade samples are noise.

      // ── PER-STRATEGY DRAWDOWN KILL-SWITCH ─────────────────────────
      // Complements portfolio-level -4R daily / -8R monthly / -6R rolling-7d
      // checks. Pauses an individual strategy in a regime shift even when the
      // overall portfolio is net positive (other strategies carrying).
      // Trigger: ≥KILL_SWITCH_MIN_TRADES closed trades in last 7d AND
      // netR < KILL_SWITCH_MAX_NET_R. Self-healing: re-evaluated each scan —
      // auto-resumes as losses age past the 7d window or wins rebalance netR.
      const pausedStrategies = strategiesToPause(
        closedTrades,
        strategies.map(s => s.id),
        { windowMs: ROLLING_WINDOW_MS, minTrades: KILL_SWITCH_MIN_TRADES, maxNetR: KILL_SWITCH_MAX_NET_R },
      );

      // ── Publish engine intelligence snapshot (read-only, for the UI) ──
      paperStatus.intelligence = {
        btcRegime:       btcContext.regime,
        btcRegimeReason: btcContext.reason,
        maxOpen:         effectiveMaxOpen,
        direction:       { long: dirPolicy.long, short: dirPolicy.short, sizeMultiplier: dirPolicy.sizeMultiplier, reason: dirPolicy.reason },
        pausedStrategies: Array.from(pausedStrategies),
        updatedAt:       new Date().toISOString(),
      };

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

      // Limit: max concurrent open trades — dynamic when BTC regime gate is on,
      // otherwise the prior fixed cap of 6 (× 2% = 12% total exposure).
      const openTradesList = paperTrades.filter(e => e.outcome === "open");
      const openSymbolExposures = openTradesList.map(e => ({
        symbol: e.symbol,
        strategy: e.strategy,
        outcome: e.outcome,
      }));
      const totalOpen = openTradesList.length;
      if (totalOpen >= effectiveMaxOpen) {
        if (effectiveMaxOpen < 6) {
          console.log(`[paper-scan] BTC regime cap reached: ${totalOpen}/${effectiveMaxOpen} (${btcContext.regime})`);
        }
        return;
      }

      // ── FUTURES LIQUIDITY + FUNDING MAPS — fetch once per scan ──
      const [marketMaps, fundingMap] = await Promise.all([fetchMexcContractTickerMaps(), getFundingMap()]);
      const volumeMap = marketMaps.amount24BySymbol;
      const spreadMap = marketMaps.spreadPctBySymbol;
      const tradableSymbols = marketMaps.availableSymbols;

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

      // Count only NEW trades opened during this scan. openPairs is pre-populated
      // with existing open trades for duplicate prevention — counting it would
      // cause the 6-trade cap check to fire before any scanning happens.
      let newOpens = 0;

      for (const sym of coins) {
        if (totalOpen + newOpens >= effectiveMaxOpen) break;

        const existingExposure = shouldSkipSymbolForOpenExposure(openSymbolExposures, sym);
        if (existingExposure.skip) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: existingExposure.reason ?? "Open exposure already exists for this symbol" });
          }
          continue;
        }

        if (!tradableSymbols.has(sym)) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: "No active MEXC futures contract/ticker for this symbol" });
          }
          continue;
        }

        // ── VOLUME FILTER — skip illiquid coins ──
        // Backtested preferred symbols are exempt — their liquidity was validated during research.
        // Volume filter only guards against unknown dynamic coins with no proven edge.
        const vol24h = volumeMap[sym] ?? 0;
        const isPreferred = strategies.some(s => s.preferredSymbols?.includes(sym));
        if (!isPreferred && vol24h > 0 && vol24h < MIN_VOLUME_USDT) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Low volume $${(vol24h/1e6).toFixed(0)}M < $30M minimum` });
          }
          continue;
        }

        const spreadPct = spreadMap[sym];
        if (spreadPct != null && spreadPct > MAX_SPREAD_PCT) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Wide futures spread ${(spreadPct * 100).toFixed(2)}% > ${(MAX_SPREAD_PCT * 100).toFixed(2)}%` });
          }
          continue;
        }

        // ── FUNDING RATE FILTER — skip crowded side ──
        // High positive funding = longs paying = market too long = squeeze risk for LONGs
        // High negative funding = shorts paying = market too short = squeeze risk for SHORTs
        const funding = fundingMap[sym];  // checked per-signal below

        // ── CORRELATION FILTER — skip if group is full ──
        const group = COIN_GROUP[sym];
        if (group && (openByGroup[group] || 0) >= MAX_PER_GROUP) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Group limit: ${group} already has ${MAX_PER_GROUP} open trades` });
          }
          continue;
        }

        for (const [interval, strats] of Object.entries(byInterval)) {
          let candles: OHLCV[] | null = null;

          for (const strat of strats) {
            const exposureDecision = shouldSkipSymbolForOpenExposure(openSymbolExposures, sym);
            if (exposureDecision.skip) {
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: exposureDecision.reason ?? "Open exposure already exists for this symbol" });
              continue;
            }

            if (openPairs.has(`${sym}:${strat.id}`)) continue;

            // Skip strategy/coin combos with no proven edge (preferredSymbols filter)
            if (strat.preferredSymbols && strat.preferredSymbols.length > 0) {
              if (!strat.preferredSymbols.includes(sym)) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Not in preferred symbols list` });
                continue;
              }
            }

            // ── Per-strategy drawdown kill-switch ──
            if (pausedStrategies.has(strat.id)) {
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Strategy paused: 7d netR < -3R (per-strategy drawdown kill-switch)` });
              continue;
            }

            // Cooldown check — matches backtest COOLDOWN parameter
            if (strat.cooldownHours) {
              const lastClose = lastClosedAt.get(`${sym}:${strat.id}`);
              if (lastClose) {
                const hoursSince = (Date.now() - lastClose) / (1000 * 60 * 60);
                if (hoursSince < strat.cooldownHours) {
                  logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Cooldown: ${hoursSince.toFixed(1)}h / ${strat.cooldownHours}h elapsed` });
                  continue;
                }
              }
            }

            if (totalOpen + newOpens >= effectiveMaxOpen) break;

            try {
              // Lazy-fetch candles for this interval
              if (!candles) {
                const limit = Math.max(...strats.map(s => s.minCandles)) + 10;
                candles = await fetchStrategyKlines(sym, interval, limit);
              }
              if (candles.length < strat.minCandles) continue;

              // NOTE (Jul 2026): three entry filters were REMOVED here after the
              // full-pipeline A/B (script/validate-pipeline.ts, both ALL and 2026
              // windows agreed):
              //   • ATR-percentile >85 skip — the single most damaging filter:
              //     removing it alone took the stack from +107R to +175R. Stop-hunt
              //     entries NEED volatility spikes; this filter skipped the best ones.
              //   • per-symbol ADX regime gate — tested earlier, hurt Confluence
              //     Swing (PF 1.02→0.96), neutral elsewhere.
              //   • daily contra-trend confidence filter — cost ~17R; the weekly
              //     filter below (which SAVES ~45R in 2026) covers trend alignment
              //     where it actually matters (multi-day 4h holds).

              const signal = strat.analyze(candles);
              if (!signal) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "no_signal", reason: "No setup detected" });
                continue;
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

              // NOTE (Jul 2026): the SHORT ≥72% confidence gate was REMOVED —
              // pipeline A/B: it blocked 1863 candidate entries and cost ~26R
              // (+80R 2026 without it vs +57R with it). Most of this suite's edge
              // is on the short side (L/S ≈ 1:2); penalizing shorts was asymmetric
              // risk aversion, not risk management. The funding filter below still
              // protects against crowded-short squeezes at entry time.
              // (The per-symbol "macroDown required for SHORTs" filter was likewise
              // tested and rejected earlier — PF 1.54→1.36 on Liquidity Sweep.)

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
              // Matches live engine. Strategies set their own floor:
              //   Conf Swing TP1 = 1.5R by design, LiqSweep enforces ≥2.0 internally.
              // This just guards against degenerate signals (risk=0, inverted TPs).
              const risk = Math.abs(signal.entry - signal.stopLoss);
              const reward = Math.abs(signal.takeProfit1 - signal.entry);
              const slDistPctSig = signal.entry > 0 ? risk / signal.entry : 0;
              // ── MINIMUM SL DISTANCE — cost-aware gate ──
              // Reject stops so tight that round-trip fees dominate the risk.
              if (slDistPctSig < MIN_SL_DISTANCE_PCT) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `SL too tight ${(slDistPctSig*100).toFixed(2)}% < ${(MIN_SL_DISTANCE_PCT*100).toFixed(2)}% — fees would dominate`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }
              if (risk <= 0 || reward / risk < 1.5) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `R:R ${(reward/risk).toFixed(2)} < 1.5 minimum`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }

              // ── POSITION SIZING — fixed fractional × BTC macro multiplier ──
              // Kelly retired Jul 2026 (see sizing note above): fixed base risk
              // halved max drawdown for <4% less total R in the pipeline A/B.
              const riskPctUsed = baseRiskPct * riskMultiplier;
              const slDistPct   = Math.abs(signal.entry - signal.stopLoss) / signal.entry;
              const riskUsd     = currentBalance * riskPctUsed / 100;
              const posSize     = slDistPct > 0 ? riskUsd / slDistPct : 0;

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
                notes: `Paper [${strat.name}] | 1R=${riskUsd.toFixed(2)}€ size=${posSize.toFixed(0)}€ risk=${riskPctUsed.toFixed(2)}% vol24h=$${(vol24h/1e6).toFixed(0)}M funding=${funding != null ? (funding*100).toFixed(3)+"%" : "n/a"} — ${signal.reason}`,
              });

              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "opened", reason: `${signal.direction} | score=${signal.confluenceScore} conf=${signal.confidence}% RR=${(reward/risk).toFixed(1)} risk=${riskPctUsed.toFixed(2)}%`, signal: signal.direction, confidence: signal.confidence });
              openPairs.add(`${sym}:${strat.id}`);
              openSymbolExposures.push({ symbol: sym, strategy: strat.id, outcome: "open" });
              newOpens++;
              const g = COIN_GROUP[sym];
              if (g) openByGroup[g] = (openByGroup[g] || 0) + 1;

            } catch (err: any) {
              console.error(`[paper-scan] ${sym}/${strat.id} error:`, err);
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Strategy error: ${err?.message ?? String(err)}` });
            }
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
    const journal = await getJournal(10_000);
    const paperTrades = journal.filter(e => e.mode === "paper");
    const openPaper   = paperTrades.filter(e => e.outcome === "open");
    const closed      = paperTrades.filter(e => e.outcome !== "open");

    // Capital stats
    const initialCapital = parseFloat(await getSetting("paper_capital") || "1000");
    const baseRiskPct    = parseFloat(await getSetting("paper_risk_pct") || "2");
    const leverage       = parseInt(await getSetting("paper_leverage") || "5", 10);
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
        leverage,
        oneR:       Math.round(daily1R * 100) / 100,
        todayPnlUsd: Math.round(todayPnl * 100) / 100,
        todayR:     daily1R > 0 ? Math.round((todayPnl / daily1R) * 100) / 100 : 0,
      },
    });
  });

  // Set paper trading capital and risk %
  app.post("/api/paper/capital", async (req, res) => {
    try {
      const parsed = capitalSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { capital, riskPct, leverage } = parsed.data;
      if (capital  !== undefined) await setSetting("paper_capital",  String(capital));
      if (riskPct  !== undefined) await setSetting("paper_risk_pct", String(riskPct));
      if (leverage !== undefined) await setSetting("paper_leverage", String(leverage));
      const ic = parseFloat(await getSetting("paper_capital")  || "1000");
      const rp = parseFloat(await getSetting("paper_risk_pct") || "2");
      const lv = parseInt  (await getSetting("paper_leverage") || "5", 10);
      res.json({ capital: ic, riskPct: rp, leverage: lv, oneR: Math.round(ic * rp) / 100 });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Live prices for open paper trades (polled by frontend every 10s)
  app.get("/api/paper/prices", async (_req, res) => {
    try {
      const journal = await getJournal(10_000);
      const openPaper = journal.filter(e => e.mode === "paper" && e.outcome === "open");
      if (openPaper.length === 0) return res.json([]);

      // Single MEXC futures call for all prices.
      const { priceByPair: priceMap } = await fetchMexcContractTickerMaps();

      const result = openPaper.map(trade => {
        const pair = `${trade.symbol}USDT`;
        const currentPrice = priceMap[pair] || 0;
        const isLong = trade.direction === "LONG";
        // Progress: 0% = at entry, 100% = at TP, negative = toward SL
        const tpDist = Math.abs(trade.take_profit1 - trade.entry_price);
        const slDist = Math.abs(trade.entry_price - trade.stop_loss);
        const fromEntry = isLong ? currentPrice - trade.entry_price : trade.entry_price - currentPrice;
        const progressPct = tpDist > 0 ? (fromEntry / tpDist) * 100 : 0;
        // SL progress: how close to SL (0% = at entry, 100% = at SL)
        const slProgress = slDist > 0 ? Math.max(0, (-fromEntry / slDist) * 100) : 0;

        const accounting = estimateOpenTradePnl({
          direction: isLong ? "LONG" : "SHORT",
          entryPrice: trade.entry_price,
          positionSizeUsd: trade.position_size_usd,
          remainingPositionSizeUsd: trade.remaining_position_size_usd,
          realizedPnlUsd: trade.realized_pnl_usd,
        }, currentPrice);

        return {
          id: trade.id,
          symbol: trade.symbol,
          strategy: trade.strategy || DEFAULT_STRATEGY,
          currentPrice:   Math.round(currentPrice * 10000) / 10000,
          unrealizedPnl:  Math.round(accounting.totalOpenPnlPct * 100) / 100,
          unrealizedUsd:  accounting.totalOpenPnlUsd !== null ? Math.round(accounting.totalOpenPnlUsd * 100) / 100 : null,
          riskUsd:        trade.risk_usd ?? null,
          positionSizeUsd: trade.position_size_usd ?? null,
          remainingPositionSizeUsd: trade.remaining_position_size_usd ?? trade.position_size_usd ?? null,
          realizedPnlUsd: trade.realized_pnl_usd ?? 0,
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
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });
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

  // ── Live Trading Engine ───────────────────────────────────────────
  //
  // Mirror of the paper engine but places real orders on a real venue.
  // Venue is selectable (bot_settings `live_exchange`) because MEXC stopped
  // serving EEA/Portuguese residents in Jul 2026; Kraken Futures is MiFID II
  // licensed for the EEA. Keys are stored per venue (<id>_api_key/_secret) so
  // switching back and forth never mixes credentials.
  // Activate by calling POST /api/live/config then POST /api/live/start.

  let liveCheckInterval: ReturnType<typeof setInterval> | null = null;
  let liveScanInterval:  ReturnType<typeof setInterval> | null = null;
  let liveEngineStatus = {
    running:       false,
    lastCheck:     null as string | null,
    lastScan:      null as string | null,
    balance:       null as number | null,
    openPositions: 0,
    unmanagedPositions: 0,
    error:         null as string | null,
    // Venue snapshot refreshed each liveCheck so the UI can show real exchange
    // state (mark price, unrealised P&L, funding, resting stops) without the
    // user opening the exchange — and without extra API calls per page load.
    account:   null as { equity: number; available: number; usedMargin?: number; unrealizedPnl?: number } | null,
    positions: [] as Array<ExchangePosition & { protection?: { stop?: number; takeProfit?: number } }>,
    snapshotAt: null as string | null,
  };

  const DEFAULT_EXCHANGE: ExchangeId = "kraken";

  async function getLiveExchangeId(): Promise<ExchangeId> {
    const stored = await getSetting("live_exchange");
    return isExchangeId(stored) ? stored : DEFAULT_EXCHANGE;
  }

  /** Settings keys holding this venue's credentials. */
  function credentialKeys(exchange: ExchangeId) {
    return { key: `${exchange}_api_key`, secret: `${exchange}_api_secret` };
  }

  async function getLiveClient() {
    const exchange = await getLiveExchangeId();
    const { key, secret } = credentialKeys(exchange);
    const apiKey    = await getSetting(key);
    const apiSecret = await getSetting(secret);
    if (!apiKey || !apiSecret) {
      throw new Error(`${exchange.toUpperCase()} API keys not configured. Use POST /api/live/config first.`);
    }
    return buildAdapter(exchange, decryptValue(apiKey), decryptValue(apiSecret));
  }

  async function liveCheck() {
    try {
      const client = await getLiveClient();

      // Reconcile the venue's open positions with our journal
      const exchangePositions = await client.getPositions();
      liveEngineStatus.openPositions = exchangePositions.length;
      const account = await client.getBalance();
      liveEngineStatus.balance = account.available;

      // Snapshot venue state for the UI: mark price and unrealised P&L come
      // from the exchange itself, and the resting stop/TP orders are read back
      // so the dashboard can prove a position is actually protected.
      const protection = client.getProtection ? await client.getProtection().catch(() => []) : [];
      liveEngineStatus.account = account;
      liveEngineStatus.positions = exchangePositions.map(p => {
        const forSymbol = protection.filter(x => x.botSymbol === p.botSymbol);
        return {
          ...p,
          protection: {
            stop:       forSymbol.find(x => x.kind === "stop")?.price,
            takeProfit: forSymbol.find(x => x.kind === "take_profit")?.price,
          },
        };
      });
      liveEngineStatus.snapshotAt = new Date().toISOString();

      // ── TRAILING STOP MODE — default r_multiple 2R (Jul 2026 pipeline A/B) ──
      // Mirrors paperCheck — see the rationale note there.
      const trailingMode: TrailingMode =
        (await getSetting("trailing_mode")) === "fixed_pct" ? "fixed_pct" : "r_multiple";
      const trailingRMultiple = parseFloat((await getSetting("trailing_r_multiple")) || String(DEFAULT_R_MULTIPLE));

      const journal = await getJournal(10_000);
      const liveTrades = journal.filter(e => e.mode === "live" && e.outcome === "open");
      const reconciliation = planLiveReconciliation(liveTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        direction: normalizeDirection(t.direction),
      })), exchangePositions);
      liveEngineStatus.unmanagedPositions = reconciliation.unmanagedExchangePositions.length;
      const unmanagedError = reconciliation.unmanagedExchangePositions.length > 0
        ? `Unmanaged ${client.id.toUpperCase()} position detected: ${reconciliation.unmanagedExchangePositions.map(p => `${p.botSymbol}:${p.direction}`).join(", ")}. Live scan paused until journal/exchange are reconciled.`
        : null;

      // Prices come from MEXC's public ticker feed (no auth) regardless of the
      // execution venue — perp prices track each other closely enough for
      // journal marking, and this keeps one price source across paper and live.
      const { priceByPair: priceMap } = await fetchMexcContractTickerMaps();

      for (const trade of liveTrades) {
        const tradeDirection = normalizeDirection(trade.direction);
        const pos = exchangePositions.find(p =>
          p.botSymbol.toUpperCase() === trade.symbol.toUpperCase() &&
          p.direction === tradeDirection &&
          p.size > 0
        );

        if (!pos) {
          // Position no longer open on the venue — closed (SL/TP hit or manual)
          const lastPrice = priceMap[`${trade.symbol}USDT`] || trade.entry_price;
          const isLong = trade.direction === "LONG";
          const accounting = finalizeTradeAccounting({
            direction: isLong ? "LONG" : "SHORT",
            entryPrice: trade.entry_price,
            positionSizeUsd: trade.position_size_usd,
            remainingPositionSizeUsd: trade.remaining_position_size_usd,
            realizedPnlUsd: trade.realized_pnl_usd,
          }, lastPrice, TRADE_COSTS);

          await updateJournalEntry(trade.id, {
            outcome:   accounting.outcome,
            exit_price: Math.round(lastPrice * 10000) / 10000,
            pnl_pct:   Math.round(accounting.pnlPct * 100) / 100,
            pnl_usd:   accounting.pnlUsd !== null ? Math.round(accounting.pnlUsd * 100) / 100 : undefined,
            remaining_position_size_usd: 0,
            closed_at: new Date().toISOString(),
            notes:     (trade.notes || "") + ` | Closed on ${client.id.toUpperCase()}`,
          });
          continue;
        }

        // Still open — track peak price and manage trailing stop
        const price = priceMap[`${trade.symbol}USDT`] || 0;
        if (!price) continue;

        const isLong = trade.direction === "LONG";

        // ── MAX-HOLD TIMEOUT — close stale positions at market (mirrors paper) ──
        const ageHoursLive = (Date.now() - new Date(trade.created_at).getTime()) / 3_600_000;
        const maxHoldHLive = maxHoldHoursForStrategy(trade.strategy);
        if (Number.isFinite(ageHoursLive) && ageHoursLive > maxHoldHLive) {
          try {
            await client.closePosition(pos);
          } catch (closeErr: any) {
            console.error(`[Live] Max-hold close failed for ${trade.symbol}: ${closeErr.message}`);
            continue; // retry on next check
          }
          const timeoutAccounting = finalizeTradeAccounting({
            direction: isLong ? "LONG" : "SHORT",
            entryPrice: trade.entry_price,
            positionSizeUsd: trade.position_size_usd,
            remainingPositionSizeUsd: trade.remaining_position_size_usd,
            realizedPnlUsd: trade.realized_pnl_usd,
          }, price, TRADE_COSTS);
          await updateJournalEntry(trade.id, {
            outcome:     timeoutAccounting.outcome,
            exit_price:  Math.round(price * 10000) / 10000,
            pnl_pct:     Math.round(timeoutAccounting.pnlPct * 100) / 100,
            pnl_usd:     timeoutAccounting.pnlUsd !== null ? Math.round(timeoutAccounting.pnlUsd * 100) / 100 : undefined,
            remaining_position_size_usd: 0,
            closed_at:   new Date().toISOString(),
            notes:       (trade.notes || "") + ` | Max-hold timeout ${maxHoldHLive}h — closed at market (backtest parity)`,
          });
          continue;
        }

        const peak   = trade.peak_price ?? trade.entry_price;
        const newPeak = isLong ? Math.max(peak, price) : Math.min(peak, price);
        if (newPeak !== peak) {
          await updateJournalEntry(trade.id, { peak_price: newPeak });
        }

        // TP1 hit → take the partial and move SL to break-even on the venue
        if (!trade.tp1_hit && trade.take_profit1) {
          const tp1Hit = isLong ? price >= trade.take_profit1 : price <= trade.take_profit1;
          if (tp1Hit) {
            let closedVol = 0;
            try {
              const partialOrder = await client.closePartial(pos, TP1_PARTIAL_CLOSE_PCT);
              closedVol = partialOrder.size;
            } catch (closeErr: any) {
              console.error(`[Live] Failed to partial close TP1 on ${client.id.toUpperCase()} for ${trade.symbol}: ${closeErr.message}`);
              continue;
            }

            const actualClosePct = pos.size > 0 ? closedVol / pos.size : TP1_PARTIAL_CLOSE_PCT;
            const partial = applyPartialClose({
              direction: isLong ? "LONG" : "SHORT",
              entryPrice: trade.entry_price,
              positionSizeUsd: trade.position_size_usd,
              remainingPositionSizeUsd: trade.remaining_position_size_usd,
              realizedPnlUsd: trade.realized_pnl_usd,
            }, trade.take_profit1, actualClosePct, TRADE_COSTS);
            const closedFullPosition = closedVol >= pos.size;

            let exchangeProtectionUpdated = false;
            let exchangeProtectionError: string | undefined;
            try {
              if (!closedFullPosition) {
                const currentTp = trade.take_profit2 ?? trade.take_profit1;
                // Protect only what is still open after the partial.
                const runner: ExchangePosition = { ...pos, size: pos.size - closedVol };
                await client.setProtection(runner, trade.entry_price, currentTp);
                exchangeProtectionUpdated = true;
              }
            } catch (slErr: any) {
              exchangeProtectionError = slErr.message;
              console.error(`[Live] Failed to update SL on ${client.id.toUpperCase()} for ${trade.symbol}: ${slErr.message}`);
            }

            const journalUpdate = buildLiveTp1JournalUpdate({
              entryPrice: trade.entry_price,
              takeProfit1: trade.take_profit1,
              closedFullPosition,
              closedVol,
              holdVol: pos.size,
              remainingPositionSizeUsd: partial.remainingPositionSizeUsd,
              realizedPnlUsd: partial.realizedPnlUsd,
              realizedPnlPct: partial.realizedPnlPct,
              exchangeProtectionUpdated,
              exchangeProtectionError,
            });

            const { notesSuffix, ...journalFields } = journalUpdate;
            await updateJournalEntry(trade.id, {
              ...journalFields,
              notes: (trade.notes || "") + ` | ${notesSuffix}`,
            });

            if (closedFullPosition) continue;
          }
        }

        // Trailing stop after TP1 — fixed 2% (legacy) or N×R (chandelier-style)
        if (trade.tp1_hit) {
          const originalRiskLive = deriveOriginalRiskFromJournal(
            trade.risk_usd,
            trade.position_size_usd,
            trade.entry_price,
          );
          const trailStop = computeTrailStop({
            direction: isLong ? "LONG" : "SHORT",
            peak: newPeak,
            entry: trade.entry_price,
            originalRisk: originalRiskLive,
            mode: trailingMode,
            fixedPct: DEFAULT_TRAIL_PCT,
            rMultiple: trailingRMultiple,
          });
          const trailHit  = isLong ? price <= trailStop : price >= trailStop;
          if (trailHit) {
            // Close position at market
            try {
              await client.closePosition(pos);


              const accounting = finalizeTradeAccounting({
                direction: isLong ? "LONG" : "SHORT",
                entryPrice: trade.entry_price,
                positionSizeUsd: trade.position_size_usd,
                remainingPositionSizeUsd: trade.remaining_position_size_usd,
                realizedPnlUsd: trade.realized_pnl_usd,
              }, price, TRADE_COSTS);

              await updateJournalEntry(trade.id, {
                outcome:   accounting.outcome,
                exit_price: Math.round(price * 10000) / 10000,
                pnl_pct:   Math.round(accounting.pnlPct * 100) / 100,
                pnl_usd:   accounting.pnlUsd !== null ? Math.round(accounting.pnlUsd * 100) / 100 : undefined,
                remaining_position_size_usd: 0,
                closed_at: new Date().toISOString(),
                notes:     (trade.notes || "") + ` | Trailing stop (peak ${newPeak.toFixed(4)}, mode=${trailingMode}${trailingMode === "r_multiple" ? ` ${trailingRMultiple}×` : ` ${(DEFAULT_TRAIL_PCT*100).toFixed(0)}%`})`,
              });
            } catch (err) { console.error("[live-trail] journal update failed (position may already be closed):", err); }
          }
        }
      }

      liveEngineStatus.lastCheck = new Date().toISOString();
      liveEngineStatus.error = unmanagedError;
    } catch (e: any) {
      liveEngineStatus.error = e.message;
    }
  }

  async function liveScan() {
    try {
      if (!liveEngineStatus.running) return;
      if (liveEngineStatus.unmanagedPositions > 0) {
        liveEngineStatus.lastScan = new Date().toISOString();
        return;
      }

      const client = await getLiveClient();
      const strategies = await getEnabledStrategies("live");
      if (strategies.length === 0) return;

      // Same coin universe as market page + strategy-specific preferred coins
      const preferredSet = new Set<string>(SCANNER_COINS);
      for (const strat of strategies) {
        for (const sym of strat.preferredSymbols ?? []) preferredSet.add(sym);
      }
      const coins = Array.from(preferredSet);

      const journal = await getJournal(10_000);
      const liveTrades = journal.filter(e => e.mode === "live");
      const openLive   = liveTrades.filter(e => e.outcome === "open");
      const exchangePositions = await client.getPositions();
      const reconciliation = planLiveReconciliation(openLive.map(t => ({
        id: t.id,
        symbol: t.symbol,
        direction: normalizeDirection(t.direction),
      })), exchangePositions);

      liveEngineStatus.openPositions = exchangePositions.filter(p => p.size > 0).length;
      liveEngineStatus.unmanagedPositions = reconciliation.unmanagedExchangePositions.length;
      if (reconciliation.unmanagedExchangePositions.length > 0) {
        liveEngineStatus.error = `Unmanaged ${client.id.toUpperCase()} position detected before live scan: ${reconciliation.unmanagedExchangePositions.map(p => `${p.botSymbol}:${p.direction}`).join(", ")}. New entries paused.`;
        liveEngineStatus.lastScan = new Date().toISOString();
        return;
      }
      if (reconciliation.missingExchangeTrades.length > 0) {
        liveEngineStatus.error = `Journal has live trades missing on ${client.id.toUpperCase()} before scan; running live reconciliation before new entries.`;
        await liveCheck();
        liveEngineStatus.lastScan = new Date().toISOString();
        return;
      }

      // ── REGIME BRAIN (always on — no manual flags) ──
      // Mirrors paper engine: BTC weekly+daily trend drives the concurrent
      // cap and the directional overlay; per-symbol ADX regime + short-macro
      // filter run unconditionally below. Loaded BEFORE the early cap check.

      // BTC trends — daily fetched here so it's available for both the BTC gate
      // (computed next) and the per-trade riskMultiplier (set later).
      let btcDailyTrend: BtcTrend = "neutral";
      try {
        btcDailyTrend = await getDailyTrend("BTC") as BtcTrend;
      } catch (err) { console.error("[btc-filter] failed:", err); }

      let btcContext: BtcRegimeContext = defaultBtcContext();
      try {
        const btcWeekly = (await getWeeklyTrend("BTC")) as BtcTrend;
        btcContext = classifyBtcRegime({ daily: btcDailyTrend, weekly: btcWeekly });
        console.log(`[live-scan] BTC regime: ${btcContext.reason} (informational — cap fixed at 10, both directions open)`);
      } catch (err) {
        console.error("[btc-regime-gate] failed:", err);
      }
      // Jul 2026 pipeline A/B: dynamic regime cap and directional overlay retired;
      // cap raised to 10 (mirrors paper scan — see the REGIME BRAIN note there).
      const effectiveMaxOpen = 10;

      // Cap concurrent live positions
      if (openLive.length >= effectiveMaxOpen || liveEngineStatus.openPositions >= effectiveMaxOpen) {
        return;
      }

      // Capital from actual MEXC balance (use equity, not just available balance which excludes margin)
      const balance = await client.getBalance();
      const currentBalance = balance.equity;
      const baseRiskPct = parseFloat(await getSetting("live_risk_pct") || "1"); // conservative 1% default

      // BTC macro risk multiplier (per-trade sizing — distinct from the BTC regime cap above)
      let riskMultiplier = 1.0;
      if      (btcDailyTrend === "up")   riskMultiplier = 1.25;
      else if (btcDailyTrend === "down") riskMultiplier = 0.75;

      // Drawdown protection (same as paper)
      const closedLive = liveTrades.filter(e => e.outcome !== "open");

      // Sizing is fixed fractional — live Kelly retired Jul 2026 together with the
      // paper one (pipeline A/B: Kelly doubled maxDD for <4% extra R).
      const daily1R    = currentBalance * baseRiskPct / 100;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayPnl   = closedLive.filter(e => e.closed_at && new Date(e.closed_at) >= todayStart)
                                   .reduce((s, e) => s + (e.pnl_usd ?? 0), 0);
      if (todayPnl < -4 * daily1R) return;  // Daily DD limit: -4R

      // Monthly -8R guard removed Jul 2026 — same rationale as paper scan.

      // Rolling 7-day portfolio guard — matches paper engine.
      if (isRollingDrawdownBreached(closedLive, daily1R, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R })) {
        console.log(`[live-scan] Rolling 7d drawdown < -${ROLLING_DRAWDOWN_MAX_LOSS_R}R — scanning paused`);
        return;
      }

      // ── PER-STRATEGY DRAWDOWN KILL-SWITCH (live) ───────────────────
      // Same rule as paper: ≥KILL_SWITCH_MIN_TRADES closed trades in last 7d
      // AND netR < KILL_SWITCH_MAX_NET_R → pause until the window recovers.
      const pausedStrategiesLive = strategiesToPause(
        closedLive,
        strategies.map(s => s.id),
        { windowMs: ROLLING_WINDOW_MS, minTrades: KILL_SWITCH_MIN_TRADES, maxNetR: KILL_SWITCH_MAX_NET_R },
      );

      const openPairs = new Set(openLive.map(e => `${e.symbol}:${e.strategy}`));
      const openSymbolExposures = openLive.map(e => ({
        symbol: e.symbol,
        strategy: e.strategy,
        outcome: e.outcome,
      }));
      const lastClosedAt = new Map<string, number>();
      for (const e of liveTrades) {
        if (e.outcome !== "open" && e.closed_at) {
          const key = `${e.symbol}:${e.strategy}`;
          const ts  = new Date(e.closed_at).getTime();
          if (!lastClosedAt.has(key) || ts > lastClosedAt.get(key)!) lastClosedAt.set(key, ts);
        }
      }

      // ── FUTURES LIQUIDITY + FUNDING MAPS — fetch once per scan ──
      const [marketMaps, fundingMap] = await Promise.all([fetchMexcContractTickerMaps(), getFundingMap()]);
      const volumeMap = marketMaps.amount24BySymbol;
      const spreadMap = marketMaps.spreadPctBySymbol;

      // ── CORRELATION — count open live trades per group ──
      const tradableSymbols = marketMaps.availableSymbols;
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

      // Count only NEW trades opened in this scan (openPairs is pre-seeded with existing).
      let newOpens = 0;

      for (const sym of coins) {
        if (openLive.length + newOpens >= effectiveMaxOpen) break;

        const existingExposure = shouldSkipSymbolForOpenExposure(openSymbolExposures, sym);
        if (existingExposure.skip) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: existingExposure.reason ?? "Open exposure already exists for this symbol" });
          }
          continue;
        }

        if (!tradableSymbols.has(sym)) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: "No active MEXC futures contract/ticker for this symbol" });
          }
          continue;
        }

        // ── VOLUME FILTER — skip illiquid coins ──
        // Preferred symbols are exempt — validated via backtest, volume checked separately.
        const vol24h = volumeMap[sym] ?? 0;
        const isPreferred = strategies.some(s => s.preferredSymbols?.includes(sym));
        if (!isPreferred && vol24h > 0 && vol24h < MIN_VOLUME_USDT) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Low volume $${(vol24h/1e6).toFixed(0)}M < $30M minimum` });
          }
          continue;
        }

        const spreadPct = spreadMap[sym];
        if (spreadPct != null && spreadPct > MAX_SPREAD_PCT) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Wide futures spread ${(spreadPct * 100).toFixed(2)}% > ${(MAX_SPREAD_PCT * 100).toFixed(2)}%` });
          }
          continue;
        }

        // ── FUNDING RATE FILTER — skip crowded side ──
        const funding = fundingMap[sym];

        // ── CORRELATION FILTER — skip if group is full ──
        const group = COIN_GROUP[sym];
        if (group && (openByGroup[group] || 0) >= MAX_PER_GROUP) {
          for (const strat of strategies) {
            if (!strat.preferredSymbols?.length || strat.preferredSymbols.includes(sym))
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Group limit: ${group} already has ${MAX_PER_GROUP} open trades` });
          }
          continue;
        }

        for (const [interval, strats] of Object.entries(byInterval)) {
          let candles: OHLCV[] | null = null;

          for (const strat of strats) {
            const exposureDecision = shouldSkipSymbolForOpenExposure(openSymbolExposures, sym);
            if (exposureDecision.skip) {
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: exposureDecision.reason ?? "Open exposure already exists for this symbol" });
              continue;
            }

            if (openPairs.has(`${sym}:${strat.id}`)) continue;
            if (strat.preferredSymbols?.length && !strat.preferredSymbols.includes(sym)) {
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Not in preferred symbols list` });
              continue;
            }

            // ── Per-strategy drawdown kill-switch ──
            if (pausedStrategiesLive.has(strat.id)) {
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Strategy paused: 7d netR < -3R (per-strategy drawdown kill-switch)` });
              continue;
            }

            if (strat.cooldownHours) {
              const lastClose = lastClosedAt.get(`${sym}:${strat.id}`);
              if (lastClose && (Date.now() - lastClose) / 3600000 < strat.cooldownHours) {
                const hoursSince = (Date.now() - lastClose) / 3600000;
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Cooldown: ${hoursSince.toFixed(1)}h / ${strat.cooldownHours}h elapsed` });
                continue;
              }
            }

            if (openLive.length + newOpens >= effectiveMaxOpen) break;

            try {
              if (!candles) {
                const limit = Math.max(...strats.map(s => s.minCandles)) + 10;
                candles = await fetchStrategyKlines(sym, interval, limit);
              }
              if (candles.length < strat.minCandles) continue;

              // Jul 2026: ATR-percentile, directional-overlay, daily contra-trend
              // and SHORT-confidence filters removed — mirrors paper scan; see the
              // pipeline A/B notes there. Weekly alignment for 4h strategies kept
              // (it saved ~45R in 2026).

              const signal = strat.analyze(candles);
              if (!signal) continue;

              // ── WEEKLY TREND FILTER — 4H strategies only (SMC, B&R) ──
              if (interval === "4h") {
                const weeklyTrend = await getWeeklyTrend(sym);
                const isContraWeekly =
                  (signal.direction === "LONG"  && weeklyTrend === "down") ||
                  (signal.direction === "SHORT" && weeklyTrend === "up");
                if (isContraWeekly) continue;
              }

              // ── FUNDING RATE FILTER ──
              if (funding != null) {
                if (signal.direction === "LONG"  && funding > FUNDING_LONG_MAX)  continue;
                if (signal.direction === "SHORT" && funding < FUNDING_SHORT_MIN) continue;
              }

              // ── MINIMUM R:R CHECK + cost-aware SL floor ──
              const risk   = Math.abs(signal.entry - signal.stopLoss);
              const reward = Math.abs(signal.takeProfit1 - signal.entry);
              const slDistPctSig = signal.entry > 0 ? risk / signal.entry : 0;
              if (slDistPctSig < MIN_SL_DISTANCE_PCT) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `SL too tight ${(slDistPctSig*100).toFixed(2)}% < ${(MIN_SL_DISTANCE_PCT*100).toFixed(2)}% — fees would dominate`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }
              if (risk <= 0 || reward / risk < 1.5) continue;

              // ── POSITION SIZING — fixed fractional × BTC macro multiplier ──
              const riskPctUsed = baseRiskPct * riskMultiplier;
              const slDistPct   = risk / signal.entry;
              const riskUsd     = currentBalance * riskPctUsed / 100;
              const posSize     = slDistPct > 0 ? riskUsd / slDistPct : 0;

              const venueSym = venueSymbol(client.id, sym);
              const leverage = Math.max(1, Math.min(20, parseInt(await getSetting("live_leverage") || "5", 10) || 5));

              const order = await client.openPosition(sym, signal.direction, posSize, signal.entry, leverage);

              // ── Reconcile actual fill price ──────────────────────────
              // Venues return only an order id; market fills may slip
              // meaningfully. Poll positions briefly to pick up the real
              // average entry before persisting. If the position never shows
              // (rejected, still pending), skip the journal entry so the
              // engine doesn't record a ghost trade.
              let actualEntry = signal.entry;
              let actualVol   = order.size;
              let filled      = false;
              for (let attempt = 0; attempt < 6; attempt++) {
                await new Promise(r => setTimeout(r, 500));
                try {
                  const pos = (await client.getPositions()).find(p =>
                    p.botSymbol.toUpperCase() === sym.toUpperCase() && p.direction === signal.direction && p.size > 0);
                  if (pos && pos.entryPrice > 0) {
                    actualEntry = pos.entryPrice;
                    actualVol   = pos.size;
                    filled      = true;
                    break;
                  }
                } catch (err) { console.error("[live-fill-check] failed:", err); }
              }

              if (!filled) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Order ${order.orderId} not visible in positions after 3s — skipping journal entry`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }

              // Attach protective SL/TP. MEXC could carry these on the entry
              // order; Kraken needs separate reduce-only orders, so both go
              // through the adapter once the fill is confirmed.
              try {
                const pos = (await client.getPositions()).find(p =>
                  p.botSymbol.toUpperCase() === sym.toUpperCase() && p.direction === signal.direction && p.size > 0);
                if (pos) await client.setProtection(pos, signal.stopLoss, signal.takeProfit2 ?? signal.takeProfit1);
              } catch (protErr: any) {
                console.error(`[live-scan] protection failed for ${sym}: ${protErr?.message ?? protErr}`);
              }

              // Recompute position_size_usd at actual fill price
              const actualPosSize = actualVol > 0 ? actualVol * actualEntry : posSize;
              const slipBps = Math.round(((actualEntry - signal.entry) / signal.entry) * 10000);

              await addJournalEntry({
                symbol:            sym,
                direction:         signal.direction,
                entry_price:       Math.round(actualEntry * 10000) / 10000,
                stop_loss:         signal.stopLoss,
                take_profit1:      signal.takeProfit1,
                take_profit2:      signal.takeProfit2,
                confluence_score:  signal.confluenceScore,
                mode:              "live",
                strategy:          strat.id,
                followed:          "yes",
                position_size_usd: Math.round(actualPosSize * 100) / 100,
                risk_usd:          Math.round(riskUsd * 100) / 100,
                notes: `Live [${strat.name}] ${client.id}:${venueSym} orderId=${order.orderId} size=${actualVol} fill=${actualEntry.toFixed(6)} slip=${slipBps}bps lev=${leverage}x risk=${riskPctUsed.toFixed(2)}% vol24h=$${(vol24h/1e6).toFixed(0)}M funding=${funding != null ? (funding*100).toFixed(3)+"%" : "n/a"} | ${signal.reason}`,
              });

              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "opened", reason: `LIVE ${signal.direction} | score=${signal.confluenceScore} conf=${signal.confidence}% RR=${(reward/risk).toFixed(1)}`, signal: signal.direction, confidence: signal.confidence });
              openPairs.add(`${sym}:${strat.id}`);
              openSymbolExposures.push({ symbol: sym, strategy: strat.id, outcome: "open" });
              newOpens++;
              if (group) openByGroup[group] = (openByGroup[group] || 0) + 1;
            } catch (err: any) {
              console.error(`[live-scan] ${sym}/${strat.id} error:`, err);
              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Strategy error: ${err?.message ?? String(err)}` });
            }
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

  // Configure the live venue: which exchange, its API keys, risk + leverage.
  // Credentials are stored per venue so switching never mixes them up.
  app.post("/api/live/config", async (req, res) => {
    try {
      const { apiKey, apiSecret, riskPct, leverage, exchange } = req.body;

      if (exchange !== undefined) {
        if (!isExchangeId(exchange)) return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
        await setSetting("live_exchange", exchange);
      }
      const venue = await getLiveExchangeId();
      const { key: keyName, secret: secretName } = credentialKeys(venue);

      // Sentinel "__keep__" (or empty) means: don't overwrite stored key. Allows
      // updating risk/leverage without re-entering credentials.
      const hasNewKey    = apiKey    && apiKey    !== "__keep__";
      const hasNewSecret = apiSecret && apiSecret !== "__keep__";
      const existingKey    = await getSetting(keyName);
      const existingSecret = await getSetting(secretName);

      if (hasNewKey)    await setSetting(keyName,    encryptValue(apiKey));
      if (hasNewSecret) await setSetting(secretName, encryptValue(apiSecret));

      if (!hasNewKey && !existingKey)       return res.status(400).json({ error: `apiKey is required for ${venue}` });
      if (!hasNewSecret && !existingSecret) return res.status(400).json({ error: `apiSecret is required for ${venue}` });

      if (riskPct && riskPct > 0 && riskPct <= 3) await setSetting("live_risk_pct", String(riskPct));
      if (leverage && Number.isFinite(leverage) && leverage >= 1 && leverage <= 20) {
        await setSetting("live_leverage", String(Math.round(leverage)));
      }

      // Test the connection using whatever keys are now in storage
      const effectiveKey    = hasNewKey    ? apiKey    : decryptValue(existingKey!);
      const effectiveSecret = hasNewSecret ? apiSecret : decryptValue(existingSecret!);
      const test = await buildAdapter(venue, effectiveKey, effectiveSecret).testConnection();
      res.json({ ok: test.ok, balance: test.balance, error: test.error, exchange: venue });
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
      const client = await getLiveClient();
      validateLiveStartConnection(await client.testConnection());
      startLiveEngine();
      await setSetting("mode", "live");
      res.json({ running: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/live/stop", async (_req, res) => {
    stopLiveEngine();
    res.json({ running: false });
  });

  /**
   * Manually close an open LIVE trade — on the venue first, then in the journal.
   *
   * The generic PATCH /api/journal/:id only writes the database. That was
   * harmless while paper was the only book, but on a live trade it closes the
   * row while the position stays open on the exchange: the next reconciliation
   * sees an unmanaged position, pauses all live entries, and the position runs
   * on with no trailing stop or max-hold. So the UI's close button routes here.
   */
  app.post("/api/live/close/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const trade = (await getJournal(10_000)).find(e => e.id === id);
      if (!trade) return res.status(404).json({ error: "Trade not found" });
      if (trade.mode !== "live") return res.status(400).json({ error: "Not a live trade — use the journal endpoint" });
      if (trade.outcome !== "open") return res.status(400).json({ error: "Trade is already closed" });

      const client = await getLiveClient();
      const direction = normalizeDirection(trade.direction);
      const pos = (await client.getPositions()).find(p =>
        p.botSymbol.toUpperCase() === trade.symbol.toUpperCase() && p.direction === direction && p.size > 0);

      // No position on the venue: it already closed (stop/TP filled). Reconcile
      // the journal rather than refusing — refusing would leave a phantom row.
      const { priceByPair } = await fetchMexcContractTickerMaps().catch(() => ({ priceByPair: {} as Record<string, number> }));
      const exitPrice = pos?.markPrice ?? priceByPair[`${trade.symbol}USDT`] ?? trade.entry_price;

      if (pos) await client.closePosition(pos);

      const accounting = finalizeTradeAccounting({
        direction,
        entryPrice: trade.entry_price,
        positionSizeUsd: trade.position_size_usd,
        remainingPositionSizeUsd: trade.remaining_position_size_usd,
        realizedPnlUsd: trade.realized_pnl_usd,
      }, exitPrice, TRADE_COSTS);

      await updateJournalEntry(id, {
        outcome:    accounting.outcome,
        exit_price: Math.round(exitPrice * 10000) / 10000,
        pnl_pct:    Math.round(accounting.pnlPct * 100) / 100,
        pnl_usd:    accounting.pnlUsd !== null ? Math.round(accounting.pnlUsd * 100) / 100 : undefined,
        remaining_position_size_usd: 0,
        closed_at:  new Date().toISOString(),
        notes: (trade.notes || "") + (pos
          ? ` | Closed manually at market on ${client.id.toUpperCase()}`
          : ` | Manual close: no position on ${client.id.toUpperCase()}, journal reconciled`),
      });

      res.json({ ok: true, closedOnVenue: !!pos, exitPrice });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/live/status", async (_req, res) => {
    try {
      const exchange  = await getLiveExchangeId();
      const { key: keyName, secret: secretName } = credentialKeys(exchange);
      const hasKeys   = !!(await getSetting(keyName)) && !!(await getSetting(secretName));
      // Which venues already hold credentials — lets the UI show what's ready.
      const configured: Record<string, boolean> = {};
      for (const e of EXCHANGES) {
        const c = credentialKeys(e.id);
        configured[e.id] = !!(await getSetting(c.key)) && !!(await getSetting(c.secret));
      }
      const riskPct   = parseFloat(await getSetting("live_risk_pct") || "1");
      const leverage  = parseInt(await getSetting("live_leverage") || "5", 10) || 5;
      const journal   = await getJournal(10_000);
      const liveTrades = journal.filter(e => e.mode === "live");
      const closed     = liveTrades.filter(e => e.outcome !== "open");
      const totalPnl   = closed.reduce((s, e) => s + (e.pnl_usd ?? 0), 0);

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayPnl   = closed.filter(e => e.closed_at && new Date(e.closed_at) >= todayStart)
                               .reduce((s, e) => s + (e.pnl_usd ?? 0), 0);

      res.json({
        ...liveEngineStatus,
        hasKeys,
        exchange,
        exchanges: EXCHANGES,
        configured,
        riskPct,
        leverage,
        openTrades:       liveTrades.filter(e => e.outcome === "open").length,
        totalLiveTrades:  liveTrades.length,
        closedLiveTrades: closed.length,
        totalPnlUsd:     Math.round(totalPnl * 100) / 100,
        todayPnlUsd:     Math.round(todayPnl * 100) / 100,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── AUTO-START on server boot ──────────────────────────────────────
  // If the mode was "paper" before the server restarted (PM2 restart etc.),
  // resume scanning automatically — no need to click "Start" after every deploy.
  // Awaited so that registerRoutes doesn't return before the engine is armed:
  // prevents any early /api/paper/start request from racing against this and
  // double-registering the interval (which would double-fire every scan).
  try {
    const mode = await getSetting("mode");
    if (mode === "paper") {
      console.log("[auto-start] mode=paper detected — starting paper engine");
      startPaperEngine();
    } else if (mode === "live") {
      console.log("[auto-start] mode=live detected — starting live engine");
      startLiveEngine();
    }
  } catch (err) { console.error("[auto-start] failed:", err); }
}
