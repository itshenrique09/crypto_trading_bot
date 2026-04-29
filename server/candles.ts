import type { OHLCV } from "./analysis";

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "3m": 3 * 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "2h": 2 * 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "8h": 8 * 60 * 60_000,
  "12h": 12 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "3d": 3 * 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

export function intervalToMs(interval: string): number | null {
  return INTERVAL_MS[interval] ?? null;
}

export function dropOpenCandle(candles: OHLCV[], interval: string, nowMs = Date.now()): OHLCV[] {
  const intervalMs = intervalToMs(interval);
  if (!intervalMs || candles.length === 0) return candles.slice();

  const last = candles[candles.length - 1];
  const closeTimeMs = last.time * 1000 + intervalMs;
  if (closeTimeMs > nowMs) return candles.slice(0, -1);

  return candles.slice();
}
