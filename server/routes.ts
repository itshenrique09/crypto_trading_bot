import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import {
  getJournal, getAllJournalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry,
  importJournalEntry, countJournalEntries,
  addScanLogEntry, getRecentScanLog,
  getSetting, setSetting,
} from "./storage";
import { analyzeIndicators, generateSignal, refineEntry, smcSignal, breakRetestSignal, rsiDivergenceSignal, liquiditySweepSignal, type OHLCV } from "./analysis";
import { getAllStrategies, getStrategyIds } from "./strategies/registry";
import type { Strategy } from "./strategies/types";
import { dropOpenCandle } from "./candles";
import { buildMexcContractTickerMaps, parseMexcKlineData, toMexcContractInterval, MEXC_CONTRACT_OVERRIDES, type MexcContractTicker } from "./mexc-market";
import { getRuntimeInfo } from "./runtime-info";
import { getBackupStatus } from "./backup";
import { shouldSkipSymbolForOpenExposure } from "./exposure-guards";
import { isRollingDrawdownBreached, rollingHaltClearsAt, strategiesToPause, checkMarginCapacity } from "./portfolio-guards";
import { classifyBtcRegime, defaultBtcContext, type BtcRegimeContext, type BtcTrend } from "./btc-regime-gate";
import { startFundingCarryLoop, getFundingCarryReport } from "./funding-carry";
import { computeTrailStop, deriveOriginalRiskFromJournal, type TrailingMode, DEFAULT_TRAIL_PCT, DEFAULT_R_MULTIPLE } from "./trailing-stop";
import { confluenceBacktestDirection, isConfluenceBacktestEligible } from "./confluence-backtest";
import { getMexcClient, getOpenOrderSide, toMexcSymbol } from "./mexc-client";
import { planLiveReconciliation } from "./live-reconciliation";
import { buildAdapter, isExchangeId, venueSymbol, exitPriceFromFills, EXCHANGES, type ExchangeId, type ExchangePosition, type ExchangeFill, type ExchangeAdapter, type ResolvedExit } from "./exchange";
import { buildLiveTp1JournalUpdate } from "./live-protection";
import { validateLiveStartConnection } from "./live-start";
import { applyPartialClose, estimateOpenTradePnl, finalizeTradeAccounting, roundPriceForJournal, TRADE_COSTS } from "./trade-accounting";
import { simulateManagedExit } from "./trade-exits";
import crypto from "crypto";
import {
  encryptValue, decryptValue, credentialKeys, getLiveExchangeId, buildLiveAdapter,
  DEFAULT_EXCHANGE,
} from "./live-credentials";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const BINANCE_BASE = "https://api.binance.com/api/v3";
const MEXC_BASE = "https://api.mexc.com/api/v3";
const MEXC_CONTRACT_BASE = "https://contract.mexc.com";
const TP1_PARTIAL_CLOSE_PCT = 0.6;
// Round-trip cost ≈ 2×(taker+slip) = 0.20% (Kraken taker 0.05% since 2026-08-14,
// audit P1.4). A stop tighter than this floor lets fees dominate the risk and
// produces garbage R math (e.g. a 0.21% stop turned a −0.35% move into −1.66R in
// May 2026 paper data). Reject such signals outright rather than widening the
// structural stop. 0.6% = 3× round-trip → fee drag ≤ ~0.33R.
const MIN_SL_DISTANCE_PCT = 0.006;

// ── Drawdown-guard tuning (shared by paper + live engines) ──
// Calendar daily (−4R) and monthly (−8R) limits reset on their boundaries and
// can miss a slow multi-day grind. A rolling 7-day window has no blind spot;
// −6R over a week (1.5× the daily cap across 7× the time) signals a structural
// problem, not normal R-multiple variance, so it only trips on a real bleed.
const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ROLLING_DRAWDOWN_MAX_LOSS_R = 6;
const DAILY_DRAWDOWN_MAX_LOSS_R = 4;
// Position cap is FIXED at 10 (capacity A/B Jul 2026: +55R and lower maxDD than
// 6; 12 tested worse). The BTC-regime maxOpen is informational only.
const FIXED_MAX_OPEN = 10;
const MIN_RISK_REWARD = 1.5;
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

/** Describe a resolved fill for the journal, including its drift from the ticker. */
function describeFill(resolved: ResolvedExit, tickerPrice: number): string {
  const driftBps = tickerPrice > 0 ? ((resolved.price - tickerPrice) / tickerPrice) * 10_000 : 0;
  return `fill ${resolved.price.toPrecision(6)} (${resolved.fillCount} exec${resolved.fillCount > 1 ? "s" : ""}`
    + `, vs ticker ${driftBps >= 0 ? "+" : ""}${driftBps.toFixed(1)}bps`
    + `${resolved.liquidation ? ", LIQUIDATION" : ""}${resolved.incomplete ? ", partial fill data" : ""})`;
}

/**
 * Price a market close the engine just sent, from the venue's own executions.
 *
 * `closePosition` returns an order id, not a price, so the engine used to book
 * these at whatever the ticker read — on a different exchange, moments later.
 * Real slippage went straight into the gap between the two and was invisible.
 * The fill takes a beat to appear, hence the short poll; the ticker remains the
 * fallback but is labelled an estimate so the two can never be conflated when
 * measuring execution quality.
 */
/** Share of the original position still open — 1 unless a TP1 partial ran. */
function remainingFractionOf(trade: TradeSizing): number {
  const total = trade.position_size_usd;
  if (!total || !(total > 0)) return 1;
  return (trade.remaining_position_size_usd ?? total) / total;
}

interface TradeSizing {
  symbol: string;
  created_at: string;
  position_size_usd: number | null;
  remaining_position_size_usd?: number | null;
}

async function priceMarketClose(
  client: ExchangeAdapter,
  trade: TradeSizing,
  direction: "LONG" | "SHORT",
  tickerPrice: number,
  /**
   * "remaining" size-matches against what the journal still has open — right
   * for a FINAL close. "last_event" prices whichever execution just happened,
   * which is what a TP1 partial needs: the journal still shows the position as
   * fully open at that point, so size-matching would demand the whole size,
   * find only the 60% just sold, call it incomplete and fall back to the ticker.
   */
  sizing: "remaining" | "last_event" = "remaining",
): Promise<{ price: number; note: string }> {
  if (!client.getFills) return { price: tickerPrice, note: "ticker ESTIMATE — venue exposes no fill history" };

  const openedAtMs = new Date(trade.created_at).getTime();
  const opts = {
    botSymbol: trade.symbol,
    direction,
    openedAtMs,
    remainingFraction: sizing === "remaining" ? remainingFractionOf(trade) : undefined,
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise(r => setTimeout(r, 600));
    const fills = await client.getFills(new Date(openedAtMs - 60 * 60_000)).catch(() => [] as ExchangeFill[]);
    const resolved = exitPriceFromFills(fills, opts);
    if (resolved && !resolved.incomplete) return { price: resolved.price, note: describeFill(resolved, tickerPrice) };
  }
  return { price: tickerPrice, note: "ticker ESTIMATE — fill not visible in time" };
}

// Default strategy ID — used as fallback when strategy field is missing (legacy entries)
const DEFAULT_STRATEGY = "confluence-swing";

// Scanner universe = union of every active strategy's preferred symbols,
// so the Markets page shows exactly what the engine trades.
const SCANNER_COINS = Array.from(
  new Set(getAllStrategies().flatMap(s => s.preferredSymbols ?? [])),
);

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

  // ── Server-Sent Events — push channel ─────────────────────────────
  // The UI refreshes the moment an engine cycle finishes instead of waiting
  // for the next poll. One-directional by design; EventSource reconnects
  // automatically and inherits the browser's Basic-auth credentials in prod.
  const sseClients = new Set<import("express").Response>();

  function broadcast(type: "paper" | "live" | "scan" | "journal", data: unknown = {}) {
    if (sseClients.size === 0) return;
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => client.write(payload));
  }

  // Scan bursts write ~100 events in seconds — coalesce them into one push.
  const pendingBroadcasts = new Map<string, NodeJS.Timeout>();
  function broadcastDebounced(type: "paper" | "live" | "scan" | "journal", delayMs = 1500) {
    if (pendingBroadcasts.has(type)) return;
    pendingBroadcasts.set(type, setTimeout(() => {
      pendingBroadcasts.delete(type);
      broadcast(type);
    }, delayMs));
  }

  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    res.write(": connected\n\n");
    sseClients.add(res);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ── Health — for uptime monitors / pm2 checks ──────────────────────
  // 200 = supervisable; 503 = wake somebody up (DB broken, or the live
  // engine is running but stuck in an error state with real money exposed).
  let healthMarketCache: { at: number; ok: boolean; note: string } | null = null;

  app.get("/api/health", async (_req, res) => {
    let dbOk = true;
    let journalRows = 0;
    try {
      journalRows = await countJournalEntries();
    } catch (err: any) {
      dbOk = false;
    }

    if (!healthMarketCache || Date.now() - healthMarketCache.at > 60_000) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5_000);
        const ping = await fetch(`${MEXC_CONTRACT_BASE}/api/v1/contract/ping`, { signal: controller.signal });
        clearTimeout(timer);
        healthMarketCache = {
          at: Date.now(),
          ok: ping.ok,
          note: ping.ok ? "MEXC futures reachable" : `MEXC ping HTTP ${ping.status}`,
        };
      } catch (err: any) {
        healthMarketCache = { at: Date.now(), ok: false, note: `MEXC unreachable: ${err?.message ?? err}` };
      }
    }

    const liveStuck = liveEngineStatus.running && !!liveEngineStatus.error;
    const ok = dbOk && !liveStuck;
    res.status(ok ? 200 : 503).json({
      status: ok ? "ok" : "degraded",
      reasons: [
        ...(dbOk ? [] : ["database unreachable"]),
        ...(liveStuck ? [`live engine error: ${liveEngineStatus.error}`] : []),
        ...(healthMarketCache.ok ? [] : [healthMarketCache.note]),
      ],
      uptimeSeconds: Math.floor(process.uptime()),
      db: { ok: dbOk, journalRows },
      marketData: { ok: healthMarketCache.ok, note: healthMarketCache.note, checkedAt: new Date(healthMarketCache.at).toISOString() },
      engines: {
        paper: { running: paperStatus.running, lastScan: paperStatus.lastScan },
        live: {
          running: liveEngineStatus.running,
          error: liveEngineStatus.error,
          unmanagedPositions: liveEngineStatus.unmanagedPositions,
          lastScan: liveEngineStatus.lastScan,
        },
      },
      backups: getBackupStatus(),
      build: getRuntimeInfo(),
    });
  });


  // ── Market Scanner (MEXC futures data — the venue data the engine trades on) ──
  // One contract-ticker call covers price / 24h change / high-low / volume /
  // funding for the whole universe; 1h klines (with Binance fallback) fill in
  // 1h + 7d change and the sparkline. Cached for 30s.
  const COIN_NAMES: Record<string, string> = {
    BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
    XRP: "XRP", DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche",
    LINK: "Chainlink", DOT: "Polkadot", NEAR: "NEAR", SUI: "Sui",
    ARB: "Arbitrum", OP: "Optimism", APT: "Aptos", INJ: "Injective",
    FIL: "Filecoin", ATOM: "Cosmos", LTC: "Litecoin", UNI: "Uniswap",
    SEI: "Sei", TIA: "Celestia", PEPE: "Pepe", SHIB: "Shiba Inu",
    ICP: "Internet Computer", AAVE: "Aave", BCH: "Bitcoin Cash",
    ETC: "Ethereum Classic", SAND: "The Sandbox", LUNC: "Terra Classic",
    HBAR: "Hedera", FET: "Fetch.ai", RENDER: "Render", ONDO: "Ondo",
    ENA: "Ethena", WLD: "Worldcoin", CRV: "Curve", GALA: "Gala",
    RUNE: "THORChain", GRT: "The Graph", IMX: "Immutable", POL: "Polygon",
    VET: "VeChain",
  };
  let marketCache: { at: number; data: unknown[] } | null = null;

  app.get("/api/market", async (_req, res) => {
    try {
      if (marketCache && Date.now() - marketCache.at < 30_000) {
        return res.json(marketCache.data);
      }
      const MEXC_FUTURES = "https://contract.mexc.com/api/v1/contract";
      const tickerRes = await fetchJSON(`${MEXC_FUTURES}/ticker`) as { data?: unknown[] };
      type FutTicker = {
        symbol?: string; lastPrice?: number; riseFallRate?: number;
        high24Price?: number; lower24Price?: number; amount24?: number;
        fundingRate?: number; bid1?: number; ask1?: number;
      };
      const tickerMap: Record<string, FutTicker> = {};
      for (const raw of tickerRes.data ?? []) {
        const t = raw as FutTicker;
        const sym = t.symbol?.toUpperCase();
        if (sym?.endsWith("_USDT")) tickerMap[sym.slice(0, -5)] = t;
      }
      // FIL trades as FILECOIN_USDT on MEXC futures
      for (const [bot, contract] of Object.entries(MEXC_CONTRACT_OVERRIDES)) {
        const t = tickerMap[contract.replace("_USDT", "")];
        if (t) tickerMap[bot] = t;
      }

      const results = SCANNER_COINS.map(sym => {
        const t = tickerMap[sym];
        const price = Number(t?.lastPrice);
        if (!t || !Number.isFinite(price) || price <= 0) return null;
        const bid = Number(t.bid1);
        const ask = Number(t.ask1);
        const spreadPct = Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask >= bid
          ? (ask - bid) / price
          : null;
        return {
          symbol: sym,
          name: COIN_NAMES[sym] ?? sym,
          price,
          change1h: null as number | null,   // filled from klines below
          change24h: Math.round((Number(t.riseFallRate) || 0) * 10000) / 100,
          change7d: null as number | null,   // filled from klines below
          marketCap: 0,
          volume24h: Math.round(Number(t.amount24) || 0),
          sparkline: [] as number[],
          image: "",
          high24h: Number(t.high24Price) || price,
          low24h: Number(t.lower24Price) || price,
          rank: 0,
          fundingRate: Number.isFinite(Number(t.fundingRate)) ? Number(t.fundingRate) : null,
          spreadPct,
        };
      }).filter((r): r is NonNullable<typeof r> => r !== null);

      results.sort((a, b) => b.volume24h - a.volume24h);
      results.forEach((r, i) => { r.rank = i + 1; });

      // 1h/7d change + sparkline for every coin, batched to be polite upstream
      const BATCH = 10;
      for (let i = 0; i < results.length; i += BATCH) {
        await Promise.all(results.slice(i, i + BATCH).map(async coin => {
          try {
            const klines = await fetchStrategyKlines(coin.symbol, "1h", 170);
            if (klines.length > 2) {
              const last = klines[klines.length - 1].close;
              const prev = klines[klines.length - 2].close;
              const first = klines[0].close;
              coin.change1h = Math.round(((last - prev) / prev) * 10000) / 100;
              coin.change7d = Math.round(((last - first) / first) * 10000) / 100;
              const step = Math.max(1, Math.floor(klines.length / 50));
              coin.sparkline = klines.filter((_, j) => j % step === 0).map(k => k.close);
            }
          } catch (err: any) {
            console.error(`[market] kline enrich failed for ${coin.symbol}:`, err?.message ?? err);
          }
        }));
      }

      marketCache = { at: Date.now(), data: results };
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Generic OHLCV endpoint — powers the chart page ────────────────
  // Reports which venue actually served the data (MEXC futures first, Binance
  // spot fallback) so the UI never has to guess at the source.
  const CANDLE_INTERVALS = new Set(["5m", "15m", "30m", "1h", "4h", "8h", "1d", "1w"]);
  app.get("/api/candles/:symbol", async (req, res) => {
    try {
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });
      const interval = String(req.query.interval ?? "1h");
      if (!CANDLE_INTERVALS.has(interval)) {
        return res.status(400).json({ error: `Invalid interval. Use one of: ${Array.from(CANDLE_INTERVALS).join(", ")}` });
      }
      const limit = Math.min(Math.max(Number(req.query.limit) || 400, 50), 1000);
      let candles: OHLCV[];
      let source: "mexc-futures" | "binance-spot";
      try {
        candles = await fetchMexcFuturesKlines(symbol, interval, limit);
        source = "mexc-futures";
      } catch {
        candles = await fetchBinanceKlines(symbol, interval, limit);
        source = "binance-spot";
      }
      res.json({ symbol, interval, source, candles });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Engine configuration — the REAL constants the engines run with ─
  // Single source of truth for the UI; values are the same identifiers the
  // scan/check loops use, so the display can never drift from the code.
  app.get("/api/engine/config", (_req, res) => {
    res.json({
      riskGates: {
        minVolumeUsdt: MIN_VOLUME_USDT,
        maxSpreadPct: MAX_SPREAD_PCT,
        fundingLongMax: FUNDING_LONG_MAX,
        fundingShortMin: FUNDING_SHORT_MIN,
        minSlDistancePct: MIN_SL_DISTANCE_PCT,
        minRiskReward: MIN_RISK_REWARD,
      },
      portfolio: {
        maxOpenPositions: FIXED_MAX_OPEN,
        maxPerCorrelationGroup: MAX_PER_GROUP,
        onePositionPerSymbol: true,
        dailyDrawdownHaltR: DAILY_DRAWDOWN_MAX_LOSS_R,
        rollingWindowDays: ROLLING_WINDOW_MS / 86_400_000,
        rollingDrawdownHaltR: ROLLING_DRAWDOWN_MAX_LOSS_R,
        killSwitchMinTrades: KILL_SWITCH_MIN_TRADES,
        killSwitchMaxNetR: KILL_SWITCH_MAX_NET_R,
      },
      exits: {
        tp1PartialClosePct: TP1_PARTIAL_CLOSE_PCT,
        maxHoldHoursByInterval: MAX_HOLD_HOURS_BY_INTERVAL,
        trailingMode: "r_multiple",
        trailingRMultiple: DEFAULT_R_MULTIPLE,
      },
      scan: {
        checkEverySeconds: 30,
        scanEveryMinutes: 3,
      },
    });
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
  // Runs the ACTIVE strategy registry (the same code the engines trade with)
  // against fresh candles, so the UI always reflects the real strategy set.
  app.get("/api/signals/:symbol", async (req, res) => {
    try {
      const symbol = validateSymbol(req.params.symbol);
      if (!symbol) return res.status(400).json({ error: "Invalid symbol" });

      const strategies = getAllStrategies();
      const intervals = Array.from(new Set(strategies.map(s => s.interval)));
      const candlesByInterval: Record<string, OHLCV[]> = {};
      await Promise.all(intervals.map(async interval => {
        const need = Math.max(...strategies.filter(s => s.interval === interval).map(s => s.minCandles));
        candlesByInterval[interval] = await fetchStrategyKlines(symbol, interval, need + 20);
      }));

      const anyCandles = Object.values(candlesByInterval).find(c => c.length > 0);
      if (!anyCandles) return res.status(400).json({ error: "Not enough data" });

      res.json({
        symbol: symbol.toUpperCase(),
        currentPrice: anyCandles[anyCandles.length - 1].close,
        strategies: strategies.map(s => {
          const candles = candlesByInterval[s.interval] ?? [];
          const enough = candles.length >= s.minCandles;
          const sig = enough ? s.analyze(candles) : null;
          return {
            id: s.id,
            name: s.name,
            interval: s.interval,
            inUniverse: s.preferredSymbols?.includes(symbol) ?? true,
            signal: sig ? (sig.direction === "LONG" ? "BUY" : "SELL") : "HOLD",
            score: sig ? Math.round(sig.confluenceScore * 10) / 10 : 0,
            confidence: sig?.confidence ?? 0,
            reason: sig?.reason ?? (enough ? "No setup on the latest candle" : "Not enough candle history"),
            entry: sig?.entry,
            stopLoss: sig?.stopLoss,
            takeProfit: sig?.takeProfit1,
            takeProfit2: sig?.takeProfit2,
          };
        }),
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
      res.json({
        // Always-on intelligence — reported for UI display, not toggleable.
        regime_filter_enabled:      true,
        short_macro_filter_enabled: true,
        btc_regime_gate_enabled:    true,
        // FROZEN at the validated optimum (Jul 2026 exit A/B + Aug 2026 audit
        // grid). Reported read-only; the engines ignore the old settings.
        trailing_mode:              "r_multiple",
        trailing_r_multiple:        DEFAULT_R_MULTIPLE,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Kept so stale clients don't 404 — everything here is frozen now: the
  // intelligence is always on and the trailing config is a validated constant
  // (changes go through the pipeline harness, not a setting).
  app.put("/api/settings/feature-flags", async (_req, res) => {
    res.json({ ok: true, applied: [], note: "exits and intelligence are frozen by validation — nothing is writable here" });
  });

  // ── Journal (Trade Log) ─────────────────────────────────────────

  app.get("/api/journal", async (_req, res) => {
    try {
      res.json(await getJournal());
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Full journal export — ALL rows (the list endpoint caps at 200), optional
  // ?mode=paper|live filter. Sent as a download-friendly JSON envelope.
  app.get("/api/journal/export", async (req, res) => {
    try {
      const rawMode = req.query.mode;
      const mode = rawMode === "paper" || rawMode === "live" ? rawMode : undefined;
      if (rawMode !== undefined && !mode) {
        return res.status(400).json({ error: "mode must be 'paper' or 'live'" });
      }
      const trades = await getAllJournalEntries(mode);
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="trades-${mode ?? "all"}-${stamp}.json"`,
      );
      res.json({
        app: "cryptotrader-pro",
        exportedAt: new Date().toISOString(),
        mode: mode ?? "all",
        count: trades.length,
        trades,
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Restore from an export file. Accepts the export envelope or a bare array.
  // IDs are re-assigned; duplicates (same symbol+mode+created_at) are skipped,
  // so importing the same file twice is safe.
  const importTradeSchema = z.object({
    symbol: z.string().min(1).max(20),
    direction: z.enum(["LONG", "SHORT"]),
    entry_price: z.number().positive(),
    stop_loss: z.number().positive(),
    take_profit1: z.number().positive(),
    take_profit2: z.number().nullish(),
    confluence_score: z.number().nullish(),
    mode: z.enum(["signal", "auto", "paper", "live"]),
    strategy: z.string().nullish(),
    followed: z.string().nullish(),
    outcome: z.enum(["open", "win", "loss", "breakeven"]),
    exit_price: z.number().nullish(),
    pnl_pct: z.number().nullish(),
    pnl_usd: z.number().nullish(),
    risk_usd: z.number().nullish(),
    position_size_usd: z.number().nullish(),
    remaining_position_size_usd: z.number().nullish(),
    realized_pnl_usd: z.number().nullish(),
    notes: z.string().nullish(),
    created_at: z.string().min(1),
    closed_at: z.string().nullish(),
    tp1_hit: z.number().nullish(),
    peak_price: z.number().nullish(),
    entry_risk_dist: z.number().nullish(),
  });

  app.post("/api/journal/import", async (req, res) => {
    try {
      const body = req.body as { trades?: unknown } | unknown[];
      const rows: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray((body as { trades?: unknown })?.trades)
          ? (body as { trades: unknown[] }).trades
          : [];
      if (rows.length === 0) {
        return res.status(400).json({ error: "Sem trades no ficheiro — esperado um array ou { trades: [...] }" });
      }
      if (rows.length > 10_000) {
        return res.status(400).json({ error: "Ficheiro demasiado grande (máximo 10000 trades)" });
      }

      let imported = 0, skipped = 0, invalid = 0;
      for (const raw of rows) {
        const parsed = importTradeSchema.safeParse(raw);
        if (!parsed.success) { invalid++; continue; }
        const d = parsed.data;
        const inserted = await importJournalEntry({
          symbol: d.symbol, direction: d.direction, entry_price: d.entry_price,
          stop_loss: d.stop_loss, take_profit1: d.take_profit1,
          take_profit2: d.take_profit2 ?? null, confluence_score: d.confluence_score ?? null,
          mode: d.mode, strategy: d.strategy ?? "v2-swing", followed: d.followed ?? "yes",
          outcome: d.outcome, exit_price: d.exit_price ?? null, pnl_pct: d.pnl_pct ?? null,
          pnl_usd: d.pnl_usd ?? null, risk_usd: d.risk_usd ?? null,
          position_size_usd: d.position_size_usd ?? null,
          remaining_position_size_usd: d.remaining_position_size_usd ?? null,
          realized_pnl_usd: d.realized_pnl_usd ?? 0, notes: d.notes ?? "",
          created_at: d.created_at, closed_at: d.closed_at ?? null,
          tp1_hit: d.tp1_hit ?? 0, peak_price: d.peak_price ?? null,
          entry_risk_dist: d.entry_risk_dist ?? null,
        });
        if (inserted) imported++;
        else skipped++;
      }
      broadcast("journal");
      res.json({ imported, skipped, invalid, total: rows.length });
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
  // Signal selection among ENABLED strategies stays automatic (regime brain +
  // per-strategy kill-switch), but each strategy can be manually paused from
  // the Settings UI (Aug 2026) — PER MODE, so paper can keep testing what live
  // has paused. Pausing blocks NEW entries only — open positions keep being
  // managed until they close.

  app.get("/api/strategies", async (_req, res) => {
    try {
      const [dPaper, dLive] = await Promise.all([
        getDisabledStrategyIds("paper"),
        getDisabledStrategyIds("live"),
      ]);
      const all = getAllStrategies();
      res.json(all.map(s => ({
        id: s.id, name: s.name, description: s.description, interval: s.interval,
        preferredSymbols: s.preferredSymbols ?? [],
        minCandles: s.minCandles,
        cooldownHours: s.cooldownHours ?? null,
        // `enabled` kept for backward compat = enabled somewhere.
        enabled: !dPaper.has(s.id) || !dLive.has(s.id),
        paperEnabled: !dPaper.has(s.id),
        liveEnabled:  !dLive.has(s.id),
        killSwitchPaused: {
          paper: paperStatus.intelligence?.pausedStrategies.includes(s.id) ?? false,
          live:  liveEngineStatus.pausedStrategies.includes(s.id),
        },
      })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/strategies/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled, mode } = (req.body ?? {}) as { enabled?: boolean; mode?: "paper" | "live" | "both" };
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "Body must include enabled: boolean" });
      if (mode !== undefined && !["paper", "live", "both"].includes(mode)) {
        return res.status(400).json({ error: "mode must be 'paper', 'live' or 'both'" });
      }
      if (!getAllStrategies().some(s => s.id === id)) return res.status(404).json({ error: `Unknown strategy: ${id}` });
      const modes: Array<"paper" | "live"> = mode === "paper" ? ["paper"] : mode === "live" ? ["live"] : ["paper", "live"];
      for (const m of modes) {
        const disabled = await getDisabledStrategyIds(m);
        if (enabled) disabled.delete(id); else disabled.add(id);
        await setSetting(DISABLED_STRATEGIES_KEYS[m], JSON.stringify(Array.from(disabled)));
        broadcast(m);
      }
      const [dPaper, dLive] = await Promise.all([
        getDisabledStrategyIds("paper"),
        getDisabledStrategyIds("live"),
      ]);
      console.log(`[strategies] ${id} ${enabled ? "reactivated" : "paused"} on ${modes.join("+")} — paper=${!dPaper.has(id)} live=${!dLive.has(id)}`);
      res.json({ id, mode: mode ?? "both", paperEnabled: !dPaper.has(id), liveEnabled: !dLive.has(id) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Universe (per-symbol operational blocklist) ──────────────────
  // See getDisabledSymbols() for why this is one list across both modes.

  app.get("/api/universe", async (_req, res) => {
    try {
      const disabled = await getDisabledSymbols();
      const bySymbol = new Map<string, string[]>();
      for (const s of getAllStrategies()) {
        for (const sym of s.preferredSymbols ?? []) {
          bySymbol.set(sym, [...(bySymbol.get(sym) ?? []), s.id]);
        }
      }
      res.json({
        symbols: Array.from(bySymbol.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([symbol, stratIds]) => ({ symbol, strategies: stratIds, enabled: !disabled.has(symbol) })),
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put("/api/universe/:symbol/toggle", async (req, res) => {
    try {
      const symbol = String(req.params.symbol ?? "").toUpperCase();
      const { enabled } = (req.body ?? {}) as { enabled?: boolean };
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "Body must include enabled: boolean" });
      const universe = new Set(getAllStrategies().flatMap(s => s.preferredSymbols ?? []));
      if (!universe.has(symbol)) return res.status(404).json({ error: `Symbol not in the validated universe: ${symbol}` });
      const disabled = await getDisabledSymbols();
      if (enabled) disabled.delete(symbol); else disabled.add(symbol);
      await setSetting(DISABLED_SYMBOLS_KEY, JSON.stringify(Array.from(disabled)));
      console.log(`[universe] ${symbol} ${enabled ? "reactivated" : "blocked"} (operational) — new entries ${enabled ? "allowed" : "blocked"} on paper+live`);
      broadcast("paper");
      broadcast("live");
      res.json({ symbol, enabled, disabled: Array.from(disabled) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Drawdown-halt manual override (one-shot resume) ────────────────
  // See ddOverrideUntil() for semantics. Every use lands in the scan log so
  // the decision is auditable next to the entries it allowed.
  app.post("/api/guards/override", async (req, res) => {
    try {
      const { mode, guard } = (req.body ?? {}) as { mode?: string; guard?: string };
      if (mode !== "paper" && mode !== "live") return res.status(400).json({ error: "mode must be 'paper' or 'live'" });
      if (guard !== "daily" && guard !== "rolling") return res.status(400).json({ error: "guard must be 'daily' or 'rolling'" });
      const untilMs = guard === "daily" ? nextDailyResetMs() : Date.now() + 24 * 3_600_000;
      const untilIso = new Date(untilMs).toISOString();
      await setSetting(DD_OVERRIDE_KEYS[mode][guard], untilIso);
      logScan({ time: new Date().toISOString(), symbol: "PORTFOLIO", strategy: "guards", result: "filtered", reason: `Halt ${guard} (${mode}) ignorado manualmente até ${untilIso} — o guard rearma-se sozinho` });
      console.log(`[guards] ${mode}/${guard} halt manually overridden until ${untilIso}`);
      broadcast(mode);
      res.json({ mode, guard, overrideUntil: untilIso });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/guards/override", async (req, res) => {
    try {
      const { mode, guard } = (req.body ?? {}) as { mode?: string; guard?: string };
      if (mode !== "paper" && mode !== "live") return res.status(400).json({ error: "mode must be 'paper' or 'live'" });
      if (guard !== "daily" && guard !== "rolling") return res.status(400).json({ error: "guard must be 'daily' or 'rolling'" });
      await setSetting(DD_OVERRIDE_KEYS[mode][guard], "");
      logScan({ time: new Date().toISOString(), symbol: "PORTFOLIO", strategy: "guards", result: "filtered", reason: `Halt ${guard} (${mode}): override cancelado — guard rearmado` });
      broadcast(mode);
      res.json({ mode, guard, overrideUntil: null });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
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
    // Persist so the decision feed survives restarts; fire-and-forget keeps
    // the scan loop synchronous. Coalesced SSE push for the UI.
    void addScanLogEntry(ev).catch(err => console.error("[scan-log] persist failed:", err));
    broadcastDebounced("scan");
  }
  // Hydrate the in-memory ring from the persisted log (newest first).
  try {
    const persisted = await getRecentScanLog(500);
    for (const row of persisted) {
      scanLog.push({
        time: row.time,
        symbol: row.symbol,
        strategy: row.strategy,
        result: row.result as ScanEvent["result"],
        reason: row.reason,
        signal: row.signal ?? undefined,
        confidence: row.confidence ?? undefined,
      });
    }
    if (persisted.length > 0) console.log(`[scan-log] restored ${persisted.length} events from disk`);
  } catch (err) {
    console.error("[scan-log] restore failed:", err);
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

  // Signal selection among enabled strategies is automatic (regime brain +
  // per-strategy kill-switch), but a strategy can be manually paused from the
  // Settings UI — PER MODE, so paper can keep testing a strategy that live has
  // paused (paper is the evidence-gathering ground; the engines' LOGIC stays in
  // sync, only the pause lists diverge). Pausing blocks NEW entries only — the
  // 30s check loops keep managing whatever is already open.
  const DISABLED_STRATEGIES_KEYS = {
    paper: "disabled_strategies_paper",
    live: "disabled_strategies_live",
  } as const;
  // Single-list key from the first iteration of this feature (2026-08-14) —
  // read as a fallback so an existing value migrates transparently.
  const LEGACY_DISABLED_STRATEGIES_KEY = "disabled_strategies";
  // Audit 2026-08-14 (script/audit/AUDIT-REPORT.md, phase 2): RSI Divergence's
  // marginal portfolio contribution measured NEGATIVE in both harness windows
  // (−18.3R ALL / −26.8R 2026) — it displaces higher-expectancy Liquidity Sweep
  // entries on ATOM/INJ via the one-position-per-symbol guard. Paused by
  // default on BOTH modes; one click in Settings re-enables it per mode.
  const DEFAULT_DISABLED_STRATEGIES = ["rsi-divergence"];
  async function getDisabledStrategyIds(mode: "paper" | "live"): Promise<Set<string>> {
    const raw = (await getSetting(DISABLED_STRATEGIES_KEYS[mode]))
      ?? (await getSetting(LEGACY_DISABLED_STRATEGIES_KEY));
    if (raw == null) return new Set(DEFAULT_DISABLED_STRATEGIES);
    try {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
    } catch {
      return new Set(DEFAULT_DISABLED_STRATEGIES);
    }
  }
  async function getEnabledStrategies(mode: "paper" | "live"): Promise<Strategy[]> {
    const disabled = await getDisabledStrategyIds(mode);
    return getAllStrategies().filter(s => !disabled.has(s.id));
  }

  // ── Manual ONE-SHOT override of an active drawdown halt ─────────────
  // The halts (−4R/day, −6R/rolling-7d) stay validated and armed; this lets
  // the human resume entries when their judgment says the breach is variance
  // or bookkeeping noise (both happened in Aug 2026), WITHOUT disabling the
  // guard: daily overrides expire at the next daily reset, rolling overrides
  // last 24h and must be re-confirmed while the breach persists. Per mode.
  const DD_OVERRIDE_KEYS = {
    paper: { daily: "dd_override_daily_paper", rolling: "dd_override_rolling_paper" },
    live:  { daily: "dd_override_daily_live",  rolling: "dd_override_rolling_live" },
  } as const;
  async function ddOverrideUntil(mode: "paper" | "live", guard: "daily" | "rolling"): Promise<number | null> {
    const raw = await getSetting(DD_OVERRIDE_KEYS[mode][guard]);
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isFinite(t) && t > Date.now() ? t : null;
  }
  /** Same day-boundary clock the halts use (server-local; UTC on the VPS). */
  function nextDailyResetMs(): number {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }

  // Manual per-symbol blocklist — an OPERATIONAL kill switch (venue delisting,
  // liquidity death, exchange trouble), NOT a performance tuner: per-coin
  // samples (~27 trades/coin in the harness) are far too small to justify
  // performance-based toggling, and the universe was validated as a SET.
  // ONE list for BOTH modes on purpose — the LUNC lesson (Aug 2026): paper
  // benchmarking a coin live cannot trade corrupts the paper↔live comparison.
  // Blocks NEW entries only; open positions keep being managed until close.
  const DISABLED_SYMBOLS_KEY = "disabled_symbols";
  async function getDisabledSymbols(): Promise<Set<string>> {
    const raw = await getSetting(DISABLED_SYMBOLS_KEY);
    if (raw == null) return new Set();
    try {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").map(s => s.toUpperCase()) : []);
    } catch {
      return new Set();
    }
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
      // Trailing is FROZEN at the validated optimum — r_multiple 2R (Jul 2026
      // exit A/B, re-confirmed by the Aug 2026 audit's 26-arm split×trail grid:
      // 2.5R, 3R and fixed 2% all measured equal or worse). The old
      // trailing_mode / trailing_r_multiple settings are ignored on purpose: a
      // silent 3R override was sitting in the UI slider on 2026-08-15 — exits
      // are validated constants, not knobs. Changes go through the pipeline
      // harness, not a setting.
      const trailingMode: TrailingMode = "r_multiple";
      const trailingRMultiple = DEFAULT_R_MULTIPLE;

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
            exit_price:  roundPriceForJournal(price),
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
          trade.entry_risk_dist,
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
            exit_price:  roundPriceForJournal(exitPrice),
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
      const disabledSymbols = await getDisabledSymbols();
      const coins = Array.from(preferredSet).filter(s => !disabledSymbols.has(s));
      paperStatus.coinsScanned = coins.length;

      const journal = await getJournal(10_000);
      const paperTrades = journal.filter(e => e.mode === "paper");

      // ── CAPITAL MANAGEMENT ────────────────────────────────────────
      const initialCapital = parseFloat(await getSetting("paper_capital") || "1000");
      const baseRiskPct    = parseFloat(await getSetting("paper_risk_pct") || "2");
      const paperLeverage  = parseInt(await getSetting("paper_leverage") || "5", 10) || 5;

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
      if (dailyPnlUsd < -DAILY_DRAWDOWN_MAX_LOSS_R * daily1R
          && !(await ddOverrideUntil("paper", "daily"))) return;  // Daily drawdown limit (manual override honoured)

      // NOTE (Jul 2026): the -8R MONTHLY guard was removed after the full-pipeline
      // harness (script/validate-pipeline.ts) showed it fired on normal variance
      // (1609 blocked entries in baseline) and then froze the rest of the month:
      // removing it alone was worth +36R over the window. Daily -4R and rolling-7d
      // -6R remain — they bind rarely and cut genuine loss streaks.

      // Rolling 7-day: catches a multi-day grind that never trips the daily cap.
      if (isRollingDrawdownBreached(closedTrades, daily1R, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R })
          && !(await ddOverrideUntil("paper", "rolling"))) {
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
      const effectiveMaxOpen = FIXED_MAX_OPEN;
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
      // Notional already committed — the basis for the margin guard below.
      // Tracked as a running total because several positions can open in one scan.
      let openNotionalUsd = openTradesList.reduce(
        (s, e) => s + (e.remaining_position_size_usd ?? e.position_size_usd ?? 0), 0,
      );

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
              if (risk <= 0 || reward / risk < MIN_RISK_REWARD) {
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

              // ── MARGIN CAPACITY — the venue would refuse this, so paper must ──
              // Sizing is risk ÷ stop-distance and never consults capital, so
              // maxOpen positions can demand more margin than the account has.
              // Without this the paper engine reports portfolios that could not
              // exist, which is worse than reporting nothing.
              const margin = checkMarginCapacity({
                openNotionalUsd: openNotionalUsd,
                newNotionalUsd: posSize,
                equityUsd: currentBalance,
                leverage: paperLeverage,
              });
              if (!margin.fits) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Margin: $${posSize.toFixed(0)} notional > $${margin.freeUsd.toFixed(0)} free (${margin.usedPct.toFixed(0)}% of ${paperLeverage}× capacity used)`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }

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
                entry_risk_dist:   slDistPct,
                notes: `Paper [${strat.name}] | 1R=${riskUsd.toFixed(2)}€ size=${posSize.toFixed(0)}€ risk=${riskPctUsed.toFixed(2)}% vol24h=$${(vol24h/1e6).toFixed(0)}M funding=${funding != null ? (funding*100).toFixed(3)+"%" : "n/a"} — ${signal.reason}`,
              });

              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "opened", reason: `${signal.direction} | score=${signal.confluenceScore} conf=${signal.confidence}% RR=${(reward/risk).toFixed(1)} risk=${riskPctUsed.toFixed(2)}%`, signal: signal.direction, confidence: signal.confidence });
              openPairs.add(`${sym}:${strat.id}`);
              openSymbolExposures.push({ symbol: sym, strategy: strat.id, outcome: "open" });
              openNotionalUsd += posSize;
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

  // Each engine cycle pushes an SSE event so the UI updates immediately.
  const runPaperCheck = () => paperCheck().finally(() => broadcast("paper"));
  const runPaperScan = () => paperScan().finally(() => broadcast("paper"));

  function startPaperEngine() {
    if (paperStatus.running) return;
    paperStatus.running = true;
    // Run immediately
    runPaperCheck();
    runPaperScan();
    // Then on intervals: check every 30s, scan every 3min
    paperCheckInterval = setInterval(runPaperCheck, 30 * 1000);
    paperScanInterval = setInterval(runPaperScan, 3 * 60 * 1000);
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
    // Drawdown-halt state for the UI — computed with the SAME numbers the scan
    // loop enforces, plus the manual override and a natural-end estimate.
    const dailyBreached   = todayPnl < -DAILY_DRAWDOWN_MAX_LOSS_R * daily1R;
    const rollingBreached = isRollingDrawdownBreached(closed, daily1R, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R });
    const rollingClears   = rollingHaltClearsAt(closed, daily1R, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R });
    const [ovDaily, ovRolling] = await Promise.all([ddOverrideUntil("paper", "daily"), ddOverrideUntil("paper", "rolling")]);

    res.json({
      ...paperStatus,
      openTrades:       openPaper.length,
      totalPaperTrades: paperTrades.length,
      strategyCounts,
      guards: {
        daily: {
          halted: dailyBreached,
          endsAt: dailyBreached ? new Date(nextDailyResetMs()).toISOString() : null,
          overrideUntil: ovDaily ? new Date(ovDaily).toISOString() : null,
        },
        rolling: {
          halted: rollingBreached,
          endsAt: rollingClears != null ? new Date(rollingClears).toISOString() : null,
          overrideUntil: ovRolling ? new Date(ovRolling).toISOString() : null,
        },
      },
      capital: {
        initial:    initialCapital,
        balance:    Math.round(currentBalance * 100) / 100,
        totalPnlUsd: Math.round(totalPnlUsd * 100) / 100,
        riskPct:    baseRiskPct,
        leverage,
        oneR:       Math.round(daily1R * 100) / 100,
        todayPnlUsd: Math.round(todayPnl * 100) / 100,
        todayR:     daily1R > 0 ? Math.round((todayPnl / daily1R) * 100) / 100 : 0,
        // Margin visibility (checkMarginCapacity is the gate; this is the gauge)
        openNotionalUsd: Math.round(openPaper.reduce((s, e) => s + (e.remaining_position_size_usd ?? e.position_size_usd ?? 0), 0) * 100) / 100,
        capacityUsd: Math.round(Math.max(0, currentBalance) * Math.max(1, leverage) * 100) / 100,
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
          currentPrice:   roundPriceForJournal(currentPrice),
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
      broadcast("paper");
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Watchlist CRUD ───────────────────────────────────────────────
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
    // Kill-switch state, refreshed each liveScan — parity with paper's
    // intelligence.pausedStrategies so the UI can show both engines equally.
    pausedStrategies: [] as string[],
  };

  async function liveCheck() {
    try {
      const client = await buildLiveAdapter();

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
      // FROZEN at r_multiple 2R — same rationale as paperCheck (validated
      // optimum; settings ignored so paper and live cannot silently diverge).
      const trailingMode: TrailingMode = "r_multiple";
      const trailingRMultiple = DEFAULT_R_MULTIPLE;

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

      // Real executions, fetched once per scan. Needed because a stop or TP
      // firing on the venue leaves no trace the engine can see except this —
      // the position is simply gone by the next scan.
      let venueFills: ExchangeFill[] = [];
      if (client.getFills && liveTrades.length > 0) {
        const oldestOpen = liveTrades.reduce(
          (min, t) => Math.min(min, new Date(t.created_at).getTime()),
          Date.now(),
        );
        venueFills = await client.getFills(new Date(oldestOpen - 60 * 60_000)).catch(() => []);
      }

      for (const trade of liveTrades) {
        const tradeDirection = normalizeDirection(trade.direction);
        const pos = exchangePositions.find(p =>
          p.botSymbol.toUpperCase() === trade.symbol.toUpperCase() &&
          p.direction === tradeDirection &&
          p.size > 0
        );

        if (!pos) {
          // Position no longer open on the venue — a stop, a take-profit or a
          // manual close fired. Price it from the venue's own executions; the
          // ticker is only a fallback for when the fill window has nothing,
          // and it is recorded as an estimate so it can never be mistaken for
          // a measured fill later.
          const resolved = exitPriceFromFills(venueFills, {
            botSymbol: trade.symbol,
            direction: tradeDirection,
            openedAtMs: new Date(trade.created_at).getTime(),
            remainingFraction: remainingFractionOf(trade),
          });
          const tickerPrice = priceMap[`${trade.symbol}USDT`] || trade.entry_price;
          const lastPrice = resolved?.price ?? tickerPrice;
          const priceNote = resolved
            ? describeFill(resolved, tickerPrice)
            : "ticker ESTIMATE — no venue fill found";

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
            exit_price: roundPriceForJournal(lastPrice),
            pnl_pct:   Math.round(accounting.pnlPct * 100) / 100,
            pnl_usd:   accounting.pnlUsd !== null ? Math.round(accounting.pnlUsd * 100) / 100 : undefined,
            remaining_position_size_usd: 0,
            closed_at: new Date().toISOString(),
            notes:     (trade.notes || "") + ` | Closed on ${client.id.toUpperCase()} @ ${priceNote}`,
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
          const fill = await priceMarketClose(client, trade, tradeDirection, price);
          const timeoutAccounting = finalizeTradeAccounting({
            direction: isLong ? "LONG" : "SHORT",
            entryPrice: trade.entry_price,
            positionSizeUsd: trade.position_size_usd,
            remainingPositionSizeUsd: trade.remaining_position_size_usd,
            realizedPnlUsd: trade.realized_pnl_usd,
          }, fill.price, TRADE_COSTS);
          await updateJournalEntry(trade.id, {
            outcome:     timeoutAccounting.outcome,
            exit_price:  roundPriceForJournal(fill.price),
            pnl_pct:     Math.round(timeoutAccounting.pnlPct * 100) / 100,
            pnl_usd:     timeoutAccounting.pnlUsd !== null ? Math.round(timeoutAccounting.pnlUsd * 100) / 100 : undefined,
            remaining_position_size_usd: 0,
            closed_at:   new Date().toISOString(),
            notes:       (trade.notes || "") + ` | Max-hold timeout ${maxHoldHLive}h — closed at market @ ${fill.note}`,
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

            // The partial went out as a MARKET order, so it filled wherever the
            // book was — not at the planned TP1 level. Book the execution.
            const tp1Fill = await priceMarketClose(
              client, trade, tradeDirection, trade.take_profit1, "last_event",
            );

            const actualClosePct = pos.size > 0 ? closedVol / pos.size : TP1_PARTIAL_CLOSE_PCT;
            const partial = applyPartialClose({
              direction: isLong ? "LONG" : "SHORT",
              entryPrice: trade.entry_price,
              positionSizeUsd: trade.position_size_usd,
              remainingPositionSizeUsd: trade.remaining_position_size_usd,
              realizedPnlUsd: trade.realized_pnl_usd,
            }, tp1Fill.price, actualClosePct, TRADE_COSTS);
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
              fillPrice: tp1Fill.price,
              venue: client.id.toUpperCase(),
              priceNote: tp1Fill.note,
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
            trade.entry_risk_dist,
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

              const trailFill = await priceMarketClose(client, trade, tradeDirection, price);
              const accounting = finalizeTradeAccounting({
                direction: isLong ? "LONG" : "SHORT",
                entryPrice: trade.entry_price,
                positionSizeUsd: trade.position_size_usd,
                remainingPositionSizeUsd: trade.remaining_position_size_usd,
                realizedPnlUsd: trade.realized_pnl_usd,
              }, trailFill.price, TRADE_COSTS);

              await updateJournalEntry(trade.id, {
                outcome:   accounting.outcome,
                exit_price: roundPriceForJournal(trailFill.price),
                pnl_pct:   Math.round(accounting.pnlPct * 100) / 100,
                pnl_usd:   accounting.pnlUsd !== null ? Math.round(accounting.pnlUsd * 100) / 100 : undefined,
                remaining_position_size_usd: 0,
                closed_at: new Date().toISOString(),
                notes:     (trade.notes || "") + ` | Trailing stop (peak ${newPeak.toFixed(4)}, mode=${trailingMode}${trailingMode === "r_multiple" ? ` ${trailingRMultiple}×` : ` ${(DEFAULT_TRAIL_PCT*100).toFixed(0)}%`}) @ ${trailFill.note}`,
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

      const client = await buildLiveAdapter();
      const strategies = await getEnabledStrategies("live");
      if (strategies.length === 0) return;

      // Same coin universe as market page + strategy-specific preferred coins
      const preferredSet = new Set<string>(SCANNER_COINS);
      for (const strat of strategies) {
        for (const sym of strat.preferredSymbols ?? []) preferredSet.add(sym);
      }
      const disabledSymbols = await getDisabledSymbols();
      const coins = Array.from(preferredSet).filter(s => !disabledSymbols.has(s));

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
      const effectiveMaxOpen = FIXED_MAX_OPEN;

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
      if (todayPnl < -DAILY_DRAWDOWN_MAX_LOSS_R * daily1R
          && !(await ddOverrideUntil("live", "daily"))) return;  // Daily DD limit (manual override honoured)

      // Monthly -8R guard removed Jul 2026 — same rationale as paper scan.

      // Rolling 7-day portfolio guard — matches paper engine.
      if (isRollingDrawdownBreached(closedLive, daily1R, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R })
          && !(await ddOverrideUntil("live", "rolling"))) {
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
      liveEngineStatus.pausedStrategies = Array.from(pausedStrategiesLive);

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

      // Notional already committed. The venue's own snapshot is ground truth
      // here; the journal is only a fallback if the position list came back
      // empty. Running total, since several can open in one scan.
      let openNotionalUsd = liveEngineStatus.positions.length > 0
        ? liveEngineStatus.positions.reduce((s, p) => s + (p.notionalUsd ?? 0), 0)
        : openLive.reduce((s, e) => s + (e.remaining_position_size_usd ?? e.position_size_usd ?? 0), 0);

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
              if (risk <= 0 || reward / risk < MIN_RISK_REWARD) continue;

              // ── POSITION SIZING — fixed fractional × BTC macro multiplier ──
              const riskPctUsed = baseRiskPct * riskMultiplier;
              const slDistPct   = risk / signal.entry;
              const riskUsd     = currentBalance * riskPctUsed / 100;
              const posSize     = slDistPct > 0 ? riskUsd / slDistPct : 0;

              const venueSym = venueSymbol(client.id, sym);
              const leverage = Math.max(1, Math.min(20, parseInt(await getSetting("live_leverage") || "5", 10) || 5));

              // ── MARGIN CAPACITY — check before sending, not after refusal ──
              // Without this the venue rejects the order, the catch below logs
              // a strategy error, and the signal is lost with no record of WHY.
              // Checking here turns an opaque failure into a visible reason.
              const liveMargin = checkMarginCapacity({
                openNotionalUsd: openNotionalUsd,
                newNotionalUsd: posSize,
                equityUsd: currentBalance,
                leverage,
              });
              if (!liveMargin.fits) {
                logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Margin: $${posSize.toFixed(0)} notional > $${liveMargin.freeUsd.toFixed(0)} free (${liveMargin.usedPct.toFixed(0)}% of ${leverage}× capacity used)`, signal: signal.direction, confidence: signal.confidence });
                continue;
              }

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

              // ── Right-size to the FILL ────────────────────────────────
              // Sizing used the SIGNAL's stop distance, but market orders fill
              // wherever the book is (measured entry drift up to ±167bps) while
              // the stop stays at the signal's structural level — so the true €
              // at risk moves with the fill. Audit 2026-08-15: a −118bps fill
              // doubled the real risk and booked a −1R stop-out as −2.39R
              // (RENDER). Trim the excess immediately so every trade risks what
              // the risk% setting says; favourable drift (smaller real risk) is
              // left alone. Runs BEFORE setProtection so the venue stop covers
              // the trimmed size.
              const slipBps = Math.round(((actualEntry - signal.entry) / signal.entry) * 10000);
              const fillStopDistPct = actualEntry > 0 ? Math.abs(actualEntry - signal.stopLoss) / actualEntry : slDistPct;
              let realRiskUsd = actualVol * actualEntry * fillStopDistPct;
              let resizeNote = "";
              // When the trim runs, the row is booked like a TP1 partial:
              // position_size_usd keeps the PRE-trim original and the trimmed
              // share flows through applyPartialClose into remaining/realized.
              // Booking the post-trim size as if it were the original made the
              // journal's remaining-fraction disagree with the venue's fill
              // history, and exit pricing then blended the trim fill into the
              // close (caught 2026-08-18: a −1R stop-out booked as −0.58R).
              let preTrimPosSizeUsd: number | null = null;
              let trimRemainingUsd: number | null = null;
              let trimRealizedUsd = 0;
              if (realRiskUsd > riskUsd * 1.10 && fillStopDistPct > 0) {
                const trimFraction = 1 - riskUsd / realRiskUsd;
                try {
                  const pos = (await client.getPositions()).find(p =>
                    p.botSymbol.toUpperCase() === sym.toUpperCase() && p.direction === signal.direction && p.size > 0);
                  const trimmed = pos ? await client.closePartial(pos, trimFraction) : null;
                  if (trimmed && pos && trimmed.size >= pos.size) {
                    // Venue lot rounding closed the WHOLE (tiny) position — a
                    // real round trip was paid, so it MUST be journaled: with
                    // no row there is no cooldown record and the still-valid
                    // 1H signal would re-enter (and re-pay fees) every 3-min
                    // scan. (Unreachable on Kraken today — its partial sizing
                    // floors — but reachable on venues that round up.)
                    const abortNotional = actualVol * actualEntry;
                    const abortCost = abortNotional * (TRADE_COSTS.takerFeePct + TRADE_COSTS.slippagePct) * 2;
                    const aborted = await addJournalEntry({
                      symbol: sym, direction: signal.direction,
                      entry_price: roundPriceForJournal(actualEntry),
                      stop_loss: signal.stopLoss, take_profit1: signal.takeProfit1, take_profit2: signal.takeProfit2,
                      confluence_score: signal.confluenceScore, mode: "live", strategy: strat.id, followed: "yes",
                      position_size_usd: Math.round(abortNotional * 100) / 100,
                      risk_usd: Math.round(realRiskUsd * 100) / 100,
                      entry_risk_dist: fillStopDistPct,
                      notes: `Live [${strat.name}] ${client.id}:${venueSym} orderId=${order.orderId} — entry drift ${slipBps}bps: right-sizing closed the entire position (venue lot rounding). Round trip booked; cooldown applies.`,
                    });
                    await updateJournalEntry(aborted.id, {
                      outcome: "loss",
                      exit_price: roundPriceForJournal(actualEntry),
                      pnl_usd: -Math.round(abortCost * 100) / 100,
                      pnl_pct: -Math.round((TRADE_COSTS.takerFeePct + TRADE_COSTS.slippagePct) * 2 * 10000) / 100,
                      closed_at: new Date().toISOString(),
                    });
                    logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "filtered", reason: `Entry drift ${slipBps}bps: right-sizing would close the entire position (${pos.size} contracts) — entry aborted, round trip booked`, signal: signal.direction, confidence: signal.confidence });
                    continue;
                  }
                  if (trimmed && trimmed.size > 0) {
                    const preTrimVol = actualVol;
                    preTrimPosSizeUsd = preTrimVol * actualEntry;
                    actualVol = Math.max(0, actualVol - trimmed.size);
                    realRiskUsd = actualVol * actualEntry * fillStopDistPct;
                    // The reduce-only market order executes seconds after the
                    // entry fill — book it AT the entry fill (model costs from
                    // TRADE_COSTS apply; price drift within those seconds is
                    // noise the slippage tooling measures, not books).
                    const trim = applyPartialClose({
                      direction: signal.direction,
                      entryPrice: actualEntry,
                      positionSizeUsd: preTrimPosSizeUsd,
                      remainingPositionSizeUsd: preTrimPosSizeUsd,
                      realizedPnlUsd: 0,
                    }, actualEntry, trimmed.size / preTrimVol, TRADE_COSTS);
                    trimRemainingUsd = trim.remainingPositionSizeUsd;
                    trimRealizedUsd = trim.realizedPnlUsd;
                    resizeNote = ` | right-sized −${(trimFraction * 100).toFixed(0)}% at fill (drift ${slipBps}bps widened the stop distance; trim booked as partial close)`;
                  }
                } catch (trimErr: any) {
                  console.error(`[live-scan] right-size failed for ${sym}: ${trimErr?.message ?? trimErr} — keeping full size, booking the real risk`);
                }
              }
              // R math must divide by what is truly at risk, not the plan —
              // booking the pre-order riskUsd made R lie in both directions
              // (losses read −1.3R…−2.4R, winners were inflated the same way).
              const bookedRiskUsd = realRiskUsd > 0 ? realRiskUsd : riskUsd;

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

              await addJournalEntry({
                symbol:            sym,
                direction:         signal.direction,
                entry_price:       roundPriceForJournal(actualEntry),
                stop_loss:         signal.stopLoss,
                take_profit1:      signal.takeProfit1,
                take_profit2:      signal.takeProfit2,
                confluence_score:  signal.confluenceScore,
                mode:              "live",
                strategy:          strat.id,
                followed:          "yes",
                position_size_usd: Math.round((preTrimPosSizeUsd ?? actualPosSize) * 100) / 100,
                remaining_position_size_usd: trimRemainingUsd != null ? Math.round(trimRemainingUsd * 100) / 100 : undefined,
                realized_pnl_usd: trimRealizedUsd !== 0 ? Math.round(trimRealizedUsd * 10000) / 10000 : undefined,
                risk_usd:          Math.round(bookedRiskUsd * 100) / 100,
                entry_risk_dist:   fillStopDistPct,
                notes: `Live [${strat.name}] ${client.id}:${venueSym} orderId=${order.orderId} size=${actualVol} fill=${actualEntry.toFixed(6)} slip=${slipBps}bps lev=${leverage}x risk=${riskPctUsed.toFixed(2)}% 1R=$${bookedRiskUsd.toFixed(2)} (planned $${riskUsd.toFixed(2)}) vol24h=$${(vol24h/1e6).toFixed(0)}M funding=${funding != null ? (funding*100).toFixed(3)+"%" : "n/a"}${resizeNote} | ${signal.reason}`,
              });

              logScan({ time: new Date().toISOString(), symbol: sym, strategy: strat.id, result: "opened", reason: `LIVE ${signal.direction} | score=${signal.confluenceScore} conf=${signal.confidence}% RR=${(reward/risk).toFixed(1)}`, signal: signal.direction, confidence: signal.confidence });
              openPairs.add(`${sym}:${strat.id}`);
              openSymbolExposures.push({ symbol: sym, strategy: strat.id, outcome: "open" });
              openNotionalUsd += actualPosSize;
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
    const runLiveCheck = () => liveCheck().finally(() => broadcast("live"));
    const runLiveScan = () => liveScan().finally(() => broadcast("live"));
    runLiveCheck();
    liveCheckInterval = setInterval(runLiveCheck, 30 * 1000);
    liveScanInterval  = setInterval(runLiveScan, 3 * 60 * 1000);
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
      const client = await buildLiveAdapter();
      const test   = await client.testConnection();
      res.json(test);
    } catch (err: any) { res.status(500).json({ ok: false, error: err.message }); }
  });

  app.post("/api/live/start", async (_req, res) => {
    try {
      const client = await buildLiveAdapter();
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

      const client = await buildLiveAdapter();
      const direction = normalizeDirection(trade.direction);
      const pos = (await client.getPositions()).find(p =>
        p.botSymbol.toUpperCase() === trade.symbol.toUpperCase() && p.direction === direction && p.size > 0);

      // No position on the venue: it already closed (stop/TP filled). Reconcile
      // the journal rather than refusing — refusing would leave a phantom row.
      const { priceByPair } = await fetchMexcContractTickerMaps().catch(() => ({ priceByPair: {} as Record<string, number> }));
      const tickerPrice = pos?.markPrice ?? priceByPair[`${trade.symbol}USDT`] ?? trade.entry_price;

      if (pos) await client.closePosition(pos);

      // Book the execution the venue actually gave us, not the ticker.
      const fill = await priceMarketClose(client, trade, direction, tickerPrice);
      const exitPrice = fill.price;

      const accounting = finalizeTradeAccounting({
        direction,
        entryPrice: trade.entry_price,
        positionSizeUsd: trade.position_size_usd,
        remainingPositionSizeUsd: trade.remaining_position_size_usd,
        realizedPnlUsd: trade.realized_pnl_usd,
      }, exitPrice, TRADE_COSTS);

      await updateJournalEntry(id, {
        outcome:    accounting.outcome,
        exit_price: roundPriceForJournal(exitPrice),
        pnl_pct:    Math.round(accounting.pnlPct * 100) / 100,
        pnl_usd:    accounting.pnlUsd !== null ? Math.round(accounting.pnlUsd * 100) / 100 : undefined,
        remaining_position_size_usd: 0,
        closed_at:  new Date().toISOString(),
        notes: (trade.notes || "") + (pos
          ? ` | Closed manually at market on ${client.id.toUpperCase()} @ ${fill.note}`
          : ` | Manual close: no position on ${client.id.toUpperCase()}, journal reconciled @ ${fill.note}`),
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

      // Halt state mirrors the live scan's math; oneR needs a balance snapshot
      // (engine stopped → no basis → guards read as not halted, like the scan).
      const liveOneR = (liveEngineStatus.balance ?? 0) > 0 ? (liveEngineStatus.balance as number) * riskPct / 100 : 0;
      const liveDailyBreached   = liveOneR > 0 && todayPnl < -DAILY_DRAWDOWN_MAX_LOSS_R * liveOneR;
      const liveRollingBreached = isRollingDrawdownBreached(closed, liveOneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R });
      const liveRollingClears   = rollingHaltClearsAt(closed, liveOneR, { windowMs: ROLLING_WINDOW_MS, maxLossR: ROLLING_DRAWDOWN_MAX_LOSS_R });
      const [ovDailyL, ovRollingL] = await Promise.all([ddOverrideUntil("live", "daily"), ddOverrideUntil("live", "rolling")]);

      res.json({
        ...liveEngineStatus,
        hasKeys,
        exchange,
        exchanges: EXCHANGES,
        configured,
        riskPct,
        leverage,
        guards: {
          daily: {
            halted: liveDailyBreached,
            endsAt: liveDailyBreached ? new Date(nextDailyResetMs()).toISOString() : null,
            overrideUntil: ovDailyL ? new Date(ovDailyL).toISOString() : null,
          },
          rolling: {
            halted: liveRollingBreached,
            endsAt: liveRollingClears != null ? new Date(liveRollingClears).toISOString() : null,
            overrideUntil: ovRollingL ? new Date(ovRollingL).toISOString() : null,
          },
        },
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
