import test from "node:test";
import assert from "node:assert/strict";
import { rsiDivergenceStrategy } from "./strategies/rsi-divergence";

test("RSI Divergence only enables MEXC-vetted symbols with recent edge", () => {
  assert.deepEqual(rsiDivergenceStrategy.preferredSymbols, ["BCH", "ATOM", "INJ"]);
});
