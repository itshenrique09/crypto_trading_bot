import test from "node:test";
import assert from "node:assert/strict";
import { confluenceBacktestDirection, isConfluenceBacktestEligible } from "./confluence-backtest";
import type { TradeSignal } from "./analysis";

function signal(overrides: Partial<TradeSignal>): TradeSignal {
  return {
    type: "HOLD",
    confluenceScore: 0,
    confidence: 0,
    reason: "",
    detailedReasons: [],
    indicators: {},
    riskRewardRatio: 0,
    positionSizePct: 0,
    trend: "sideways",
    volatility: "medium",
    marketPhase: "accumulation",
    ...overrides,
  };
}

test("Confluence backtest accepts normal BUY signals that live scanner can trade", () => {
  const sig = signal({
    type: "BUY",
    confluenceScore: 4,
    entry: 100,
    stopLoss: 98,
    takeProfit1: 103,
  });

  assert.equal(isConfluenceBacktestEligible(sig), true);
  assert.equal(confluenceBacktestDirection(sig), "LONG");
});

test("Confluence backtest rejects weak or incomplete signals", () => {
  assert.equal(isConfluenceBacktestEligible(signal({
    type: "BUY",
    confluenceScore: 3.5,
    entry: 100,
    stopLoss: 98,
    takeProfit1: 103,
  })), false);

  assert.equal(isConfluenceBacktestEligible(signal({
    type: "STRONG_BUY",
    confluenceScore: 6,
    entry: 100,
    stopLoss: 98,
  })), false);
});

test("Confluence backtest maps SELL signals to short direction", () => {
  assert.equal(confluenceBacktestDirection(signal({ type: "SELL" })), "SHORT");
  assert.equal(confluenceBacktestDirection(signal({ type: "STRONG_SELL" })), "SHORT");
});
