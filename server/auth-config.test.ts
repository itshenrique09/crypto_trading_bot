import test from "node:test";
import assert from "node:assert/strict";
import { getRequiredAuthPassword } from "./auth-config";

test("allows missing auth password in development", () => {
  assert.equal(getRequiredAuthPassword("development", undefined), "");
});

test("rejects missing auth password in production", () => {
  assert.throws(
    () => getRequiredAuthPassword("production", ""),
    /APP_PASSWORD env var must be set/,
  );
});

test("returns configured auth password in production", () => {
  assert.equal(getRequiredAuthPassword("production", "secret"), "secret");
});
