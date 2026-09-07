import { test } from "node:test";
import assert from "node:assert/strict";
import { nextCloseMs, nextDueMs, scheduleAtCloses } from "./scan-scheduler";

const H = 3_600_000;

test("nextCloseMs is the next UTC-aligned close strictly after now", () => {
  const t = Date.UTC(2026, 8, 3, 10, 17, 0);
  assert.equal(nextCloseMs("1h", t), Date.UTC(2026, 8, 3, 11, 0, 0));
  assert.equal(nextCloseMs("4h", t), Date.UTC(2026, 8, 3, 12, 0, 0));
  assert.equal(nextCloseMs("1d", t), Date.UTC(2026, 8, 4, 0, 0, 0));
  // exactly on a close → the following one
  assert.equal(nextCloseMs("1h", Date.UTC(2026, 8, 3, 11, 0, 0)), Date.UTC(2026, 8, 3, 12, 0, 0));
});

test("nextDueMs picks the earliest close+offset ahead, including a retry offset after a recent close", () => {
  const close = Date.UTC(2026, 8, 3, 11, 0, 0);
  // 10s after the close: the +30s slot is next
  assert.equal(nextDueMs(["1h", "1d"], [30_000, 210_000], close + 10_000), close + 30_000);
  // 1 min after the close: the +3.5 min retry is next
  assert.equal(nextDueMs(["1h"], [30_000, 210_000], close + 60_000), close + 210_000);
  // 5 min after the close: the next hour's +30s slot
  assert.equal(nextDueMs(["1h"], [30_000, 210_000], close + 300_000), close + H + 30_000);
  // coinciding closes (1d at midnight is also a 1h close) collapse into one due time
  const midnight = Date.UTC(2026, 8, 4, 0, 0, 0);
  assert.equal(nextDueMs(["1h", "4h", "1d"], [30_000], midnight - 1000), midnight + 30_000);
});

test("scheduleAtCloses runs at due times, never overlaps, and stops cleanly", async () => {
  let virtualNow = Date.UTC(2026, 8, 3, 11, 0, 0) + 29_500; // 500 ms before the +30s slot
  let runs = 0;
  let concurrent = 0, maxConcurrent = 0;
  const schedule = scheduleAtCloses(["1h"], [30_000], async () => {
    concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
    runs++;
    await new Promise(r => setTimeout(r, 20));
    concurrent--;
  }, () => virtualNow);
  assert.ok(schedule.nextRunAt() != null && schedule.nextRunAt()! > virtualNow);
  // advance the virtual clock past the slot and let the timer fire
  virtualNow += 600;
  await new Promise(r => setTimeout(r, 700));
  assert.equal(runs, 1);
  assert.equal(maxConcurrent, 1);
  schedule.stop();
  assert.equal(schedule.nextRunAt(), null);
});
