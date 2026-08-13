import test from "node:test";
import assert from "node:assert/strict";
import { backupFilenameFor, selectBackupsToDelete } from "./backup";

test("backupFilenameFor uses local date with zero padding", () => {
  assert.equal(backupFilenameFor(new Date(2026, 0, 5)), "data-2026-01-05.db");
  assert.equal(backupFilenameFor(new Date(2026, 11, 31)), "data-2026-12-31.db");
});

test("selectBackupsToDelete keeps the N newest and deletes the rest", () => {
  const files = [
    "data-2026-08-07.db", "data-2026-08-08.db", "data-2026-08-09.db",
    "data-2026-08-10.db", "data-2026-08-11.db", "data-2026-08-12.db",
    "data-2026-08-13.db", "data-2026-08-05.db", "data-2026-08-06.db",
  ];
  const toDelete = selectBackupsToDelete(files, 7);
  assert.deepEqual(toDelete.sort(), ["data-2026-08-05.db", "data-2026-08-06.db"]);
});

test("selectBackupsToDelete returns empty when under the limit", () => {
  assert.deepEqual(selectBackupsToDelete(["data-2026-08-13.db"], 7), []);
  assert.deepEqual(selectBackupsToDelete([], 7), []);
});

test("selectBackupsToDelete ignores files that are not daily backups", () => {
  const files = [
    "data-2026-08-13.db", "data-2026-08-13.db.tmp", "notes.txt", "data.db",
    "data-2026-08-10.db", "data-2026-08-11.db", "data-2026-08-12.db",
  ];
  // Only 4 valid backups, keep 2 → the 2 oldest valid ones go.
  const toDelete = selectBackupsToDelete(files, 2);
  assert.deepEqual(toDelete.sort(), ["data-2026-08-10.db", "data-2026-08-11.db"]);
});

test("selectBackupsToDelete keeps chronological order across months and years", () => {
  const files = [
    "data-2025-12-31.db", "data-2026-01-01.db", "data-2026-02-01.db",
  ];
  assert.deepEqual(selectBackupsToDelete(files, 2), ["data-2025-12-31.db"]);
});
