import test from "node:test";
import assert from "node:assert/strict";
import { rsiDivergenceStrategy } from "./strategies/rsi-divergence";

test("RSI Divergence only enables MEXC-vetted symbols with recent edge", () => {
  // BCH dropped Jun 2026 after re-validation (T=16 exp -0.09R, edge decayed OOS).
  assert.deepEqual(rsiDivergenceStrategy.preferredSymbols, ["ATOM", "INJ"]);
});
