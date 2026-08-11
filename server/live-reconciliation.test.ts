import test from "node:test";
import assert from "node:assert/strict";
import { planLiveReconciliation, directionToPositionType } from "./live-reconciliation";

test("matches journal trades to exchange positions by symbol and direction", () => {
  const plan = planLiveReconciliation(
    [{ id: 1, symbol: "BTC", direction: "LONG" }],
    [{ botSymbol: "BTC", direction: "LONG", size: 10 }],
  );

  assert.equal(plan.missingExchangeTrades.length, 0);
  assert.equal(plan.unmanagedExchangePositions.length, 0);
});

test("flags same-symbol opposite-side positions as missing and unmanaged", () => {
  const plan = planLiveReconciliation(
    [{ id: 1, symbol: "BTC", direction: "SHORT" }],
    [{ botSymbol: "BTC", direction: "LONG", size: 10 }],
  );

  assert.deepEqual(plan.missingExchangeTrades.map(t => t.id), [1]);
  assert.deepEqual(plan.unmanagedExchangePositions.map(p => `${p.botSymbol}:${p.direction}`), ["BTC:LONG"]);
});

test("ignores zero-size exchange positions", () => {
  const plan = planLiveReconciliation(
    [],
    [{ botSymbol: "BTC", direction: "LONG", size: 0 }],
  );

  assert.equal(plan.unmanagedExchangePositions.length, 0);
});

test("is venue-agnostic — the same journal reconciles against any adapter's output", () => {
  const journal = [{ id: 1, symbol: "BTC", direction: "SHORT" as const }];
  // Whether the position came from MEXC (BTC_USDT/positionType 2) or Kraken
  // (PF_XBTUSD/"short"), the adapter hands over the same neutral shape.
  const plan = planLiveReconciliation(journal, [{ botSymbol: "BTC", direction: "SHORT", size: 0.0031 }]);
  assert.equal(plan.missingExchangeTrades.length, 0);
  assert.equal(plan.unmanagedExchangePositions.length, 0);
});

test("directionToPositionType still maps to MEXC's numeric sides", () => {
  assert.equal(directionToPositionType("LONG"), 1);
  assert.equal(directionToPositionType("SHORT"), 2);
});
