import test from "node:test";
import assert from "node:assert/strict";
import { defaultEnabledStrategyIds } from "./strategy-settings";

test("defaults paper strategies to all eligible (regime governs selection)", () => {
  assert.deepEqual(defaultEnabledStrategyIds("paper", ["a", "b"]), ["a", "b"]);
});

test("defaults live strategies to all eligible — master switch is keys + running engine", () => {
  assert.deepEqual(defaultEnabledStrategyIds("live", ["a", "b"]), ["a", "b"]);
});
