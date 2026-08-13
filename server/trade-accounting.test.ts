import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPartialClose,
  estimateOpenTradePnl,
  finalizeTradeAccounting,
  roundPriceForJournal,
  type TradeAccountingState,
} from "./trade-accounting";

test("roundPriceForJournal survives sub-cent assets", () => {
  // Real values from the 2026-08-13 paper export. The old
  // Math.round(p * 10000) / 10000 stored PEPE as exactly 0 — nine rows in that
  // history carry exit_price: 0 — and LUNC 98% off. On the LIVE ENTRY path a
  // zero entry price is divided by in every P&L calculation and is the basis
  // the trailing stop derives original risk from.
  assert.equal(roundPriceForJournal(0.0000027956), 0.0000027956);   // PEPE — was 0
  assert.equal(roundPriceForJournal(0.00005062), 0.00005062);       // LUNC — was 0.0001
  assert.equal(roundPriceForJournal(0.004757), 0.004757);           // VET  — was 0.0048
  assert.equal(roundPriceForJournal(0.002063), 0.002063);           // GALA — was 0.0021

  // and still behaves for ordinary prices
  assert.equal(roundPriceForJournal(64535.2), 64535.2);
  assert.equal(roundPriceForJournal(76.00925925925925), 76.009259);
  assert.equal(roundPriceForJournal(0.3354), 0.3354);
});

test("roundPriceForJournal never returns something you cannot divide by", () => {
  // The whole point: a stored price feeds (exit - entry) / entry.
  for (const p of [1e-9, 1e-7, 0.0000027956, 1, 1e6]) {
    const r = roundPriceForJournal(p);
    assert.ok(r > 0, `${p} rounded to ${r}`);
    assert.ok(Math.abs((r - p) / p) < 1e-7, `${p} -> ${r} lost too much`);
  }
  // degenerate inputs pass through rather than becoming misleading numbers
  assert.equal(roundPriceForJournal(0), 0);
  assert.ok(Number.isNaN(roundPriceForJournal(NaN)));
});

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
