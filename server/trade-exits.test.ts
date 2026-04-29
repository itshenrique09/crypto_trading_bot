import test from "node:test";
import assert from "node:assert/strict";
import { simulateManagedExit, type ManagedExitLevels } from "./trade-exits";

const longLevels: ManagedExitLevels = {
  direction: "LONG",
  entry: 100,
  stopLoss: 95,
  takeProfit1: 110,
  takeProfit2: 120,
};

test("managed exit records a full loss when SL hits before TP1", () => {
  const result = simulateManagedExit(longLevels, [
    { time: 1, open: 100, high: 103, low: 94, close: 95, volume: 1 },
  ], { takerFeePct: 0, slippagePct: 0 });

  assert.equal(result.outcome, "loss");
  assert.equal(result.tp1Hit, false);
  assert.equal(result.grossR, -1);
  assert.equal(result.grossPnlPct, -5);
});

test("managed exit realizes partial TP1 and lets the remainder reach TP2", () => {
  const result = simulateManagedExit(longLevels, [
    { time: 1, open: 100, high: 110, low: 99, close: 110, volume: 1 },
    { time: 2, open: 110, high: 120, low: 109, close: 120, volume: 1 },
  ], { tp1ClosePct: 0.6, takerFeePct: 0, slippagePct: 0 });

  assert.equal(result.outcome, "tp2");
  assert.equal(result.tp1Hit, true);
  assert.equal(result.grossR, 2.8);
  assert.equal(result.grossPnlPct, 14);
});

test("managed exit locks trailing profit when price reverses after TP1", () => {
  const result = simulateManagedExit(longLevels, [
    { time: 1, open: 100, high: 110, low: 99, close: 110, volume: 1 },
    { time: 2, open: 110, high: 111, low: 100, close: 100, volume: 1 },
  ], { tp1ClosePct: 0.6, takerFeePct: 0, slippagePct: 0 });

  assert.equal(result.outcome, "trailing");
  assert.equal(result.tp1Hit, true);
  assert.equal(result.grossR, 1.824);
  assert.equal(result.grossPnlPct, 9.12);
});

test("managed exit subtracts taker fees and slippage from net PnL", () => {
  const result = simulateManagedExit(longLevels, [
    { time: 1, open: 100, high: 110, low: 99, close: 110, volume: 1 },
    { time: 2, open: 110, high: 111, low: 100, close: 100, volume: 1 },
  ], { tp1ClosePct: 0.6, takerFeePct: 0.0002, slippagePct: 0.0005 });

  assert.equal(result.grossPnlPct, 9.12);
  assert.ok(result.netPnlPct < result.grossPnlPct);
});
