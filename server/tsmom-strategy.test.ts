import { test } from "node:test";
import assert from "node:assert/strict";
import { tsmomStrategy } from "./strategies/tsmom";
import type { OHLCV } from "./analysis";

/** Flat daily series at `base` with tiny noise, then a final candle closing at `lastClose`. */
function series(base: number, days: number, lastClose: number): OHLCV[] {
  const out: OHLCV[] = [];
  const t0 = Date.UTC(2026, 0, 1) / 1000;
  for (let i = 0; i < days; i++) {
    const wiggle = (i % 3 - 1) * base * 0.004;
    out.push({ time: t0 + i * 86_400, open: base + wiggle, high: base + Math.abs(wiggle) + base * 0.01, low: base - Math.abs(wiggle) - base * 0.01, close: base + wiggle, volume: 1000 });
  }
  const last = out[out.length - 1];
  out[out.length - 1] = { ...last, close: lastClose, high: Math.max(last.high, lastClose), low: Math.min(last.low, lastClose) };
  return out;
}

test("TSMOM fires LONG on a close above the prior 55-day high and prices from that close only", () => {
  const candles = series(100, 90, 104);
  const sig = tsmomStrategy.analyze(candles);
  assert.ok(sig, "expected a signal");
  assert.equal(sig!.direction, "LONG");
  assert.equal(sig!.entry, 104);               // the signal candle's close — no look-ahead
  assert.ok(sig!.stopLoss < sig!.entry && sig!.takeProfit1 > sig!.entry && (sig!.takeProfit2 ?? 0) > sig!.takeProfit1);
  const risk = sig!.entry - sig!.stopLoss;
  assert.ok(Math.abs((sig!.takeProfit1 - sig!.entry) / risk - 1.75) < 1e-9, "TP1 = 1.75 × stop distance");
  assert.ok(Math.abs(((sig!.takeProfit2 as number) - sig!.entry) / risk - 3.5) < 1e-9, "TP2 = 3.5 × stop distance");
  assert.match(sig!.reason, /Donchian55 high/);
});

test("TSMOM fires SHORT on a close below the prior 55-day low, and nothing inside the channel", () => {
  const short = tsmomStrategy.analyze(series(100, 90, 96));
  assert.ok(short && short.direction === "SHORT");
  assert.equal(tsmomStrategy.analyze(series(100, 90, 100.2)), null);
});

test("TSMOM needs enough history and declares its engine contract", () => {
  assert.equal(tsmomStrategy.analyze(series(100, 40, 110)), null);
  assert.equal(tsmomStrategy.interval, "1d");
  assert.equal(tsmomStrategy.cooldownHours, 72);
  assert.ok((tsmomStrategy.preferredSymbols?.length ?? 0) >= 40);
  assert.equal(tsmomStrategy.defaultPaused?.live, true);
});

test("TSMOM refuses a SHORT whose 3.5× target would be at or below zero (huge-ATR coin)", () => {
  // Daily ranges of ±30% → ATR ≈ 60% of price → stop 2×ATR ≈ 120% of price.
  // SHORT: TP2 = entry − 3.5×stop < 0 — a price cannot fall past zero, so the
  // signal must be rejected (92/1180 real shorts did this in the audit scan and
  // the negative TP2 reached the journal and the venue).
  const wild: OHLCV[] = [];
  const t0 = Date.UTC(2026, 0, 1) / 1000;
  for (let i = 0; i < 90; i++) {
    wild.push({ time: t0 + i * 86_400, open: 100, high: 130, low: 70, close: 100 + (i % 2 ? 3 : -3), volume: 1000 });
  }
  const shortBreak = [...wild];
  shortBreak[shortBreak.length - 1] = { ...wild[wild.length - 1], close: 60, low: 60 };
  assert.equal(tsmomStrategy.analyze(shortBreak), null, "SHORT with TP2 ≤ 0 must be rejected");

  // The LONG mirror on the same volatility is fine — every level is positive.
  const longBreak = [...wild];
  longBreak[longBreak.length - 1] = { ...wild[wild.length - 1], close: 140, high: 140 };
  const sig = tsmomStrategy.analyze(longBreak);
  assert.ok(sig && sig.direction === "LONG" && sig.takeProfit2! > sig.takeProfit1 && sig.takeProfit1 > sig.entry);
});
