import type { OHLCV } from "./analysis";

export interface MexcKlineData {
  time?: Array<number | string | null>;
  open?: Array<number | string | null>;
  high?: Array<number | string | null>;
  low?: Array<number | string | null>;
  close?: Array<number | string | null>;
  vol?: Array<number | string | null>;
  amount?: Array<number | string | null>;
}

export interface MexcContractTicker {
  symbol?: string;
  lastPrice?: number | string | null;
  fairPrice?: number | string | null;
  bid1?: number | string | null;
  ask1?: number | string | null;
  volume24?: number | string | null;
  amount24?: number | string | null;
}

const MEXC_INTERVALS: Record<string, string> = {
  "1m": "Min1",
  "5m": "Min5",
  "15m": "Min15",
  "30m": "Min30",
  "1h": "Min60",
  "4h": "Hour4",
  "8h": "Hour8",
  "1d": "Day1",
  "1w": "Week1",
  "1M": "Month1",
};

export function toMexcContractInterval(interval: string): string | null {
  return MEXC_INTERVALS[interval] ?? null;
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMexcKlineData(data: MexcKlineData): OHLCV[] {
  const times = data.time ?? [];
  const opens = data.open ?? [];
  const highs = data.high ?? [];
  const lows = data.low ?? [];
  const closes = data.close ?? [];
  const volumes = data.vol ?? data.amount ?? [];
  const candles: OHLCV[] = [];

  for (let i = 0; i < times.length; i++) {
    const time = toFiniteNumber(times[i]);
    const open = toFiniteNumber(opens[i]);
    const high = toFiniteNumber(highs[i]);
    const low = toFiniteNumber(lows[i]);
    const close = toFiniteNumber(closes[i]);
    const volume = toFiniteNumber(volumes[i]) ?? 0;
    if (time == null || open == null || high == null || low == null || close == null) continue;
    candles.push({ time, open, high, low, close, volume });
  }

  return candles.sort((a, b) => a.time - b.time);
}

export function buildMexcContractTickerMaps(tickers: MexcContractTicker[]) {
  const priceByPair: Record<string, number> = {};
  const amount24BySymbol: Record<string, number> = {};
  const spreadPctBySymbol: Record<string, number> = {};
  const availableSymbols = new Set<string>();

  for (const ticker of tickers) {
    const contractSymbol = ticker.symbol?.toUpperCase();
    if (!contractSymbol?.endsWith("_USDT")) continue;

    const botSymbol = contractSymbol.slice(0, -5);
    const pair = `${botSymbol}USDT`;
    const lastPrice = toFiniteNumber(ticker.lastPrice) ?? toFiniteNumber(ticker.fairPrice);
    if (lastPrice == null || lastPrice <= 0) continue;

    availableSymbols.add(botSymbol);
    priceByPair[pair] = lastPrice;

    const amount24 = toFiniteNumber(ticker.amount24);
    const volume24 = toFiniteNumber(ticker.volume24);
    amount24BySymbol[botSymbol] = amount24 ?? (volume24 != null ? volume24 * lastPrice : 0);

    const bid = toFiniteNumber(ticker.bid1);
    const ask = toFiniteNumber(ticker.ask1);
    if (bid != null && ask != null && bid > 0 && ask >= bid) {
      spreadPctBySymbol[botSymbol] = (ask - bid) / lastPrice;
    }
  }

  return { priceByPair, amount24BySymbol, spreadPctBySymbol, availableSymbols };
}
