import test from "node:test";
import assert from "node:assert/strict";
import { getRuntimeInfo } from "./runtime-info";

test("runtime info exposes deploy fingerprint fields", () => {
  const info = getRuntimeInfo({
    NODE_ENV: "production",
    APP_VERSION: "1.2.3",
    BUILD_COMMIT: "abc123",
    BUILD_DIRTY: "true",
    BUILD_TIME: "2026-04-29T10:00:00.000Z",
  });

  assert.equal(info.nodeEnv, "production");
  assert.equal(info.version, "1.2.3");
  assert.equal(info.buildCommit, "abc123");
  assert.equal(info.buildDirty, true);
  assert.equal(info.buildTime, "2026-04-29T10:00:00.000Z");
  assert.match(info.startedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("runtime info falls back to unknown build metadata", () => {
  const info = getRuntimeInfo({});

  assert.equal(info.buildCommit, "unknown");
  assert.equal(info.buildDirty, false);
  assert.equal(info.buildTime, "unknown");
});
