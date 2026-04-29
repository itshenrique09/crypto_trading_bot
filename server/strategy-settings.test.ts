import test from "node:test";
import assert from "node:assert/strict";
import { defaultEnabledStrategyIds } from "./strategy-settings";

test("defaults paper strategies to enabled", () => {
  assert.deepEqual(defaultEnabledStrategyIds("paper", ["a", "b"]), ["a", "b"]);
});

test("defaults live strategies to disabled", () => {
  assert.deepEqual(defaultEnabledStrategyIds("live", ["a", "b"]), []);
});
