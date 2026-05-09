import test from "node:test";
import assert from "node:assert/strict";
import {
  detectRegime,
  isStrategyAllowedInRegime,
  shouldRequireMacroDownForShort,
  REGIME_THRESHOLDS,
} from "./regime-detector";
import type { OHLCV } from "./analysis";

// ─── Synthetic candle generators ──────────────────────────────────────────
// We need 30+ candles for ADX(14). For the strong-trend tests we generate
// 100+ to ensure ADX(14) saturates. Macro tests need 200+ for EMA200.

function flatCandles(n: number, price = 100): OHLCV[] {
  const out: OHLCV[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      time: i * 3600_000,
      open: price,
      high: price + 0.05,
      low:  price - 0.05,
      close: price,
      volume: 100,
    });
  }
  return out;
}

function trendingCandles(n: number, start = 100, stepPct = 0.01): OHLCV[] {
  // Each candle moves +stepPct of the open; high = +0.5×step, low = -0.1×step
  // so directional movement dominates (drives ADX high) with consistent
  // higher-highs and higher-lows.
  const out: OHLCV[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const open  = price;
    const close = open * (1 + stepPct);
    const high  = close * (1 + stepPct * 0.5);
    const low   = open  * (1 - stepPct * 0.1);
    out.push({ time: i * 3600_000, open, high, low, close, volume: 100 });
    price = close;
  }
  return out;
}

function chopCandles(n: number, mid = 100, ampPct = 0.005): OHLCV[] {
  // Sine wave of small amplitude — keeps ADX low (no directional flow)
  const out: OHLCV[] = [];
  for (let i = 0; i < n; i++) {
    const phase = Math.sin((i / 6) * Math.PI * 2);
    const close = mid * (1 + phase * ampPct);
    out.push({
      time: i * 3600_000,
      open:  close,
      high:  close * (1 + ampPct * 0.3),
      low:   close * (1 - ampPct * 0.3),
      close,
      volume: 100,
    });
  }
  return out;
}

// ─── detectRegime ─────────────────────────────────────────────────────────
test("detectRegime returns 'normal' with insufficient candles", () => {
  const ctx = detectRegime(flatCandles(10));
  assert.equal(ctx.regime, "normal");
  assert.match(ctx.reason, /insufficient/);
});

test("detectRegime classifies sustained uptrend as strong_trend", () => {
  const ctx = detectRegime(trendingCandles(120, 100, 0.015));
  assert.equal(ctx.regime, "strong_trend");
  assert.ok(
    ctx.adx > REGIME_THRESHOLDS.ADX_STRONG_TREND,
    `ADX ${ctx.adx} should exceed strong-trend threshold`,
  );
});

test("detectRegime classifies low-amplitude chop as dead_chop", () => {
  const ctx = detectRegime(chopCandles(120));
  assert.equal(ctx.regime, "dead_chop");
  assert.ok(
    ctx.adx < REGIME_THRESHOLDS.ADX_DEAD_CHOP,
    `ADX ${ctx.adx} should sit below dead-chop threshold`,
  );
});

test("detectRegime exposes macroDown true on a sustained downtrend", () => {
  // 250 down candles → EMA50 well below EMA200
  const down = trendingCandles(250, 100, -0.005);
  const ctx = detectRegime(down);
  assert.equal(ctx.macroDown, true, `expected macroDown=true on sustained downtrend, got ${JSON.stringify(ctx)}`);
});

test("detectRegime keeps macroDown false in an uptrend", () => {
  const up = trendingCandles(250, 100, 0.005);
  const ctx = detectRegime(up);
  assert.equal(ctx.macroDown, false);
});

test("detectRegime keeps macroDown false when EMA200 cannot converge", () => {
  // Only 100 candles — EMA200 unreliable, macroDown must default to false
  const ctx = detectRegime(trendingCandles(100, 100, -0.01));
  assert.equal(ctx.macroDown, false);
});

// ─── isStrategyAllowedInRegime ────────────────────────────────────────────
test("RSI divergence allowed in dead_chop and normal, blocked in strong_trend", () => {
  assert.equal(isStrategyAllowedInRegime("rsi-divergence", "dead_chop"),    true);
  assert.equal(isStrategyAllowedInRegime("rsi-divergence", "normal"),       true);
  assert.equal(isStrategyAllowedInRegime("rsi-divergence", "strong_trend"), false);
});

test("Bollinger MR allowed in dead_chop and normal, blocked in strong_trend", () => {
  assert.equal(isStrategyAllowedInRegime("bollinger-mr", "dead_chop"),    true);
  assert.equal(isStrategyAllowedInRegime("bollinger-mr", "normal"),       true);
  assert.equal(isStrategyAllowedInRegime("bollinger-mr", "strong_trend"), false);
});

test("Confluence Swing and Break & Retest blocked in dead_chop", () => {
  assert.equal(isStrategyAllowedInRegime("confluence-swing", "dead_chop"),    false);
  assert.equal(isStrategyAllowedInRegime("confluence-swing", "normal"),       true);
  assert.equal(isStrategyAllowedInRegime("confluence-swing", "strong_trend"), true);

  assert.equal(isStrategyAllowedInRegime("break-retest", "dead_chop"),    false);
  assert.equal(isStrategyAllowedInRegime("break-retest", "normal"),       true);
  assert.equal(isStrategyAllowedInRegime("break-retest", "strong_trend"), true);
});

test("SMC and Liquidity Sweep allowed in every regime by default", () => {
  for (const regime of ["dead_chop", "normal", "strong_trend"] as const) {
    assert.equal(isStrategyAllowedInRegime("smc", regime), true);
    assert.equal(isStrategyAllowedInRegime("liquidity-sweep", regime), true);
  }
});

test("unknown strategy id is permissive", () => {
  assert.equal(isStrategyAllowedInRegime("future-strategy", "dead_chop"),    true);
  assert.equal(isStrategyAllowedInRegime("future-strategy", "normal"),       true);
  assert.equal(isStrategyAllowedInRegime("future-strategy", "strong_trend"), true);
});

// ─── shouldRequireMacroDownForShort ───────────────────────────────────────
test("SMC, Break & Retest and Liquidity Sweep require macroDown for SHORTs", () => {
  assert.equal(shouldRequireMacroDownForShort("smc"),              true);
  assert.equal(shouldRequireMacroDownForShort("break-retest"),     true);
  assert.equal(shouldRequireMacroDownForShort("liquidity-sweep"),  true);
});

test("Confluence Swing and RSI Divergence are exempt from the short macro filter", () => {
  // confluence-swing already enforces symmetric macro internally
  // rsi-divergence uses inBull/inBear (price vs EMA200) by design
  assert.equal(shouldRequireMacroDownForShort("confluence-swing"), false);
  assert.equal(shouldRequireMacroDownForShort("rsi-divergence"),   false);
});
