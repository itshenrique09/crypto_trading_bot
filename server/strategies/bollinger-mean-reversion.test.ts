import test from "node:test";
import assert from "node:assert/strict";
import { bollingerMeanReversionStrategy } from "./bollinger-mean-reversion";
import type { OHLCV } from "../analysis";

// ─── Synthetic candle generators ──────────────────────────────────────────

// Sideways chop: noisy oscillation around a mid price.
// Produces low-ADX series with reasonable Bollinger band width.
function chopSeries(n: number, mid = 100, ampPct = 0.012, seed = 1): OHLCV[] {
  const out: OHLCV[] = [];
  let rng = seed;
  const rand = () => {
    // Deterministic LCG for repeatable tests
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return (rng & 0xffffffff) / 0x100000000;
  };
  for (let i = 0; i < n; i++) {
    const phase = Math.sin((i / 9) * Math.PI * 2) * ampPct;
    const noise = (rand() - 0.5) * ampPct * 0.4;
    const close = mid * (1 + phase + noise);
    const high  = close * (1 + ampPct * 0.25);
    const low   = close * (1 - ampPct * 0.25);
    out.push({ time: i * 3600_000, open: close, high, low, close, volume: 1000 });
  }
  return out;
}

// Strong uptrend — high ADX, strategy must NOT fire
function trendingSeries(n: number, start = 100, stepPct = 0.01): OHLCV[] {
  const out: OHLCV[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const open  = price;
    const close = open * (1 + stepPct);
    const high  = close * (1 + stepPct * 0.5);
    const low   = open  * (1 - stepPct * 0.1);
    out.push({ time: i * 3600_000, open, high, low, close, volume: 1000 });
    price = close;
  }
  return out;
}

// Append a "long-setup" candle: pierces below `lowerBandTarget`, closes back above,
// with volume spike. Used to inject a clean entry condition into a chop series.
function withLongSetupAt(candles: OHLCV[], lowerBandTarget: number, closeAt: number, volumeMult = 1.5): OHLCV[] {
  const out = candles.slice(0, -1);
  const last = candles[candles.length - 1];
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  out.push({
    time: last.time,
    open:  last.open,
    high:  Math.max(last.high, closeAt * 1.001),
    low:   lowerBandTarget * 0.998,   // pierce
    close: closeAt,                   // back inside
    volume: avgVol * volumeMult,
  });
  return out;
}

// ─── analyze() tests ──────────────────────────────────────────────────────

test("strategy metadata is correct", () => {
  assert.equal(bollingerMeanReversionStrategy.id, "bollinger-mr");
  assert.equal(bollingerMeanReversionStrategy.interval, "1h");
  assert.ok(bollingerMeanReversionStrategy.minCandles >= 60);
  assert.ok(Array.isArray(bollingerMeanReversionStrategy.preferredSymbols));
});

test("returns null when candle history is too short", () => {
  const tiny = chopSeries(50);
  const sig = bollingerMeanReversionStrategy.analyze(tiny);
  assert.equal(sig, null);
});

test("does not fire in a strong uptrend (ADX gate blocks)", () => {
  // 250 trending candles → ADX well above 20
  const candles = trendingSeries(250, 100, 0.012);
  const sig = bollingerMeanReversionStrategy.analyze(candles);
  assert.equal(sig, null);
});

test("does not fire on flat chop without a piercing candle", () => {
  // Chop without an explicit setup candle → no entry signal
  const candles = chopSeries(250);
  const sig = bollingerMeanReversionStrategy.analyze(candles);
  assert.equal(sig, null);
});

test("rejects setups that violate the 2.5% risk cap", () => {
  // Pure chop, then inject a piercing wick that's >5% below close
  // (would imply risk > 2.5% of entry → must be filtered)
  let candles = chopSeries(250, 100, 0.005);
  const last = candles[candles.length - 1];
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  candles = candles.slice(0, -1);
  candles.push({
    time: last.time,
    open: last.open,
    high: last.high,
    low:  last.close * 0.93,   // 7% wick → risk far above 2.5% cap
    close: last.close,
    volume: avgVol * 1.5,
  });
  const sig = bollingerMeanReversionStrategy.analyze(candles);
  assert.equal(sig, null);
});
