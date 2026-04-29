import test from "node:test";
import assert from "node:assert/strict";
import { validateLiveStartConnection } from "./live-start";

test("accepts live start when MEXC connection test is ok", () => {
  assert.doesNotThrow(() => validateLiveStartConnection({ ok: true, balance: 100 }));
});

test("rejects live start when MEXC connection test fails", () => {
  assert.throws(
    () => validateLiveStartConnection({ ok: false, error: "invalid signature" }),
    /Cannot start live engine/,
  );
});
