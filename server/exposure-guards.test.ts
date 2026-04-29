import test from "node:test";
import assert from "node:assert/strict";
import { shouldSkipSymbolForOpenExposure } from "./exposure-guards";

test("skips a new trade when the same symbol already has open exposure", () => {
  const decision = shouldSkipSymbolForOpenExposure(
    [{ symbol: "SOL", strategy: "rsi-divergence", outcome: "open" }],
    "SOL",
    "liquidity-sweep",
  );

  assert.deepEqual(decision, {
    skip: true,
    reason: "Open exposure already exists for SOL via rsi-divergence",
  });
});

test("allows a symbol with no existing open exposure", () => {
  const decision = shouldSkipSymbolForOpenExposure(
    [{ symbol: "BCH", strategy: "rsi-divergence", outcome: "open" }],
    "SOL",
    "liquidity-sweep",
  );

  assert.deepEqual(decision, { skip: false });
});

test("skips even when the existing exposure is from the same strategy", () => {
  const decision = shouldSkipSymbolForOpenExposure(
    [{ symbol: "SOL", strategy: "liquidity-sweep", outcome: "open" }],
    "sol",
    "liquidity-sweep",
  );

  assert.deepEqual(decision, {
    skip: true,
    reason: "Open exposure already exists for SOL via liquidity-sweep",
  });
});
