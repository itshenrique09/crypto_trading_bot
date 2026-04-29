import test from "node:test";
import assert from "node:assert/strict";
import { planLiveReconciliation } from "./live-reconciliation";

test("matches journal trades to MEXC positions by symbol and direction", () => {
  const plan = planLiveReconciliation(
    [{ id: 1, symbol: "BTC", direction: "LONG" }],
    [{ symbol: "BTC_USDT", positionType: 1, holdVol: 10 }],
  );

  assert.equal(plan.missingExchangeTrades.length, 0);
  assert.equal(plan.unmanagedExchangePositions.length, 0);
});

test("flags same-symbol opposite-side positions as missing and unmanaged", () => {
  const plan = planLiveReconciliation(
    [{ id: 1, symbol: "BTC", direction: "SHORT" }],
    [{ symbol: "BTC_USDT", positionType: 1, holdVol: 10 }],
  );

  assert.deepEqual(plan.missingExchangeTrades.map(t => t.id), [1]);
  assert.deepEqual(plan.unmanagedExchangePositions.map(p => `${p.symbol}:${p.positionType}`), ["BTC_USDT:1"]);
});

test("ignores zero-volume exchange positions", () => {
  const plan = planLiveReconciliation(
    [],
    [{ symbol: "BTC_USDT", positionType: 1, holdVol: 0 }],
  );

  assert.equal(plan.unmanagedExchangePositions.length, 0);
});
