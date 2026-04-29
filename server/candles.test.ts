import test from "node:test";
import assert from "node:assert/strict";
import { dropOpenCandle, intervalToMs } from "./candles";
import type { OHLCV } from "./analysis";

const candles: OHLCV[] = [
  { time: 1_000, open: 1, high: 2, low: 1, close: 2, volume: 10 },
  { time: 4_600, open: 2, high: 3, low: 2, close: 3, volume: 10 },
];

test("intervalToMs maps exchange timeframes to milliseconds", () => {
  assert.equal(intervalToMs("15m"), 15 * 60_000);
  assert.equal(intervalToMs("1h"), 60 * 60_000);
  assert.equal(intervalToMs("4h"), 4 * 60 * 60_000);
  assert.equal(intervalToMs("1d"), 24 * 60 * 60_000);
  assert.equal(intervalToMs("1w"), 7 * 24 * 60 * 60_000);
});

test("dropOpenCandle removes the last candle when its close time is in the future", () => {
  const result = dropOpenCandle(candles, "1h", 4_600_000 + 30 * 60_000);

  assert.deepEqual(result, [candles[0]]);
});

test("dropOpenCandle keeps the last candle once its interval is complete", () => {
  const result = dropOpenCandle(candles, "1h", 4_600_000 + 60 * 60_000);

  assert.equal(result.length, 2);
});

test("dropOpenCandle returns a copy for unsupported intervals", () => {
  const result = dropOpenCandle(candles, "90m", 4_600_000);

  assert.notEqual(result, candles);
  assert.deepEqual(result, candles);
});
