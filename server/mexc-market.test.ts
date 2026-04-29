import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMexcContractTickerMaps,
  parseMexcKlineData,
  toMexcContractInterval,
} from "./mexc-market";

test("maps bot candle intervals to MEXC contract intervals", () => {
  assert.equal(toMexcContractInterval("15m"), "Min15");
  assert.equal(toMexcContractInterval("1h"), "Min60");
  assert.equal(toMexcContractInterval("4h"), "Hour4");
  assert.equal(toMexcContractInterval("1d"), "Day1");
  assert.equal(toMexcContractInterval("1w"), "Week1");
});

test("parses MEXC contract kline array columns into OHLCV candles", () => {
  const candles = parseMexcKlineData({
    time: [1_700_000_000, 1_700_003_600],
    open: [100, 110],
    high: [115, 120],
    low: [95, 105],
    close: [110, 108],
    vol: [42, 43],
  });

  assert.deepEqual(candles, [
    { time: 1_700_000_000, open: 100, high: 115, low: 95, close: 110, volume: 42 },
    { time: 1_700_003_600, open: 110, high: 120, low: 105, close: 108, volume: 43 },
  ]);
});

test("parseMexcKlineData sorts out-of-order candles by time", () => {
  const candles = parseMexcKlineData({
    time: [20, 10],
    open: [2, 1],
    high: [2, 1],
    low: [2, 1],
    close: [2, 1],
    vol: [2, 1],
  });

  assert.deepEqual(candles.map(c => c.time), [10, 20]);
});

test("buildMexcContractTickerMaps indexes futures prices, volume, and spread by bot symbol", () => {
  const maps = buildMexcContractTickerMaps([
    { symbol: "BTC_USDT", lastPrice: 100, bid1: 99.5, ask1: 100.5, amount24: 12_000_000 },
    { symbol: "ETH_USDT", fairPrice: "50", volume24: "1000" },
    { symbol: "BAD_USDT", lastPrice: 0 },
  ]);

  assert.equal(maps.priceByPair.BTCUSDT, 100);
  assert.equal(maps.priceByPair.ETHUSDT, 50);
  assert.equal(maps.amount24BySymbol.BTC, 12_000_000);
  assert.equal(maps.amount24BySymbol.ETH, 50_000);
  assert.equal(Math.round((maps.spreadPctBySymbol.BTC ?? 0) * 10_000) / 10_000, 0.01);
  assert.equal(maps.priceByPair.BADUSDT, undefined);
  assert.deepEqual([...maps.availableSymbols].sort(), ["BTC", "ETH"]);
});
