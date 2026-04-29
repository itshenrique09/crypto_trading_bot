import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPartialClose,
  estimateOpenTradePnl,
  finalizeTradeAccounting,
  type TradeAccountingState,
} from "./trade-accounting";

const longTrade: TradeAccountingState = {
  direction: "LONG",
  entryPrice: 100,
  positionSizeUsd: 1_000,
  remainingPositionSizeUsd: null,
  realizedPnlUsd: null,
};

test("partial close realizes PnL on the closed share and leaves the runner open", () => {
  const result = applyPartialClose(longTrade, 110, 0.6);

  assert.equal(result.closedSizeUsd, 600);
  assert.equal(result.remainingPositionSizeUsd, 400);
  assert.equal(result.realizedPnlUsd, 60);
  assert.equal(result.realizedPnlPct, 6);
});

test("partial close subtracts trading costs from the realized PnL", () => {
  const result = applyPartialClose(longTrade, 110, 0.6, {
    takerFeePct: 0.0002,
    slippagePct: 0.0005,
  });

  assert.equal(result.closedSizeUsd, 600);
  assert.equal(result.tradingCostUsd, 0.84);
  assert.equal(result.realizedPnlUsd, 59.16);
  assert.equal(result.realizedPnlPct, 5.916);
});

test("final close combines realized TP1 PnL with the remaining runner PnL", () => {
  const result = finalizeTradeAccounting({
    ...longTrade,
    remainingPositionSizeUsd: 400,
    realizedPnlUsd: 60,
  }, 100);

  assert.equal(result.pnlUsd, 60);
  assert.equal(result.pnlPct, 6);
  assert.equal(result.outcome, "win");
});

test("final close subtracts costs only on the remaining runner", () => {
  const result = finalizeTradeAccounting({
    ...longTrade,
    remainingPositionSizeUsd: 400,
    realizedPnlUsd: 59.16,
  }, 100, {
    takerFeePct: 0.0002,
    slippagePct: 0.0005,
  });

  assert.equal(result.tradingCostUsd, 0.56);
  assert.equal(result.pnlUsd, 58.6);
  assert.equal(result.pnlPct, 5.86);
  assert.equal(result.outcome, "win");
});

test("open PnL includes realized TP1 PnL and unrealized runner PnL", () => {
  const result = estimateOpenTradePnl({
    ...longTrade,
    remainingPositionSizeUsd: 400,
    realizedPnlUsd: 60,
  }, 105);

  assert.equal(result.unrealizedPnlUsd, 20);
  assert.equal(result.totalOpenPnlUsd, 80);
  assert.equal(result.totalOpenPnlPct, 8);
});
