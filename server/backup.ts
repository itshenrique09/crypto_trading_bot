// ─── AUTOMATIC DATABASE BACKUPS ──────────────────────────────────────────
// data.db holds the whole journal AND the encrypted exchange API keys, and
// sql.js rewrites the entire file on every persist — one corrupted write is
// total loss. This module keeps one backup per calendar day in ./backups,
// rotating out the oldest beyond BACKUP_KEEP.
//
// Strategy: snapshot the IN-MEMORY database (db.export()), never copy the
// file on disk — copying can race the persist() rewrite and capture a torn
// file. Writes are atomic (tmp + rename). The loop runs at startup and then
// hourly, creating a backup only when today's file doesn't exist yet, so it
// behaves the same for a 24/7 VPS and for a laptop restarted daily.

import { existsSync } from "fs";
import { mkdir, readdir, rename, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { getDb } from "./db";

const BACKUP_DIR = join(process.cwd(), "backups");
const BACKUP_KEEP = 7;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly "is today's backup done?" check

const BACKUP_NAME_RE = /^data-\d{4}-\d{2}-\d{2}\.db$/;

/** Local-date filename: restarting at 23:59 and 00:01 yields two distinct days. */
export function backupFilenameFor(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `data-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.db`;
}

/** Pure rotation rule: which files to delete, keeping the `keep` newest. */
export function selectBackupsToDelete(files: string[], keep: number): string[] {
  return files
    .filter(f => BACKUP_NAME_RE.test(f))
    .sort()            // ISO dates in the name sort chronologically
    .reverse()
    .slice(Math.max(0, keep));
}

export interface BackupStatus {
  dir: string;
  keep: number;
  count: number;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  lastError: string | null;
}

const status: BackupStatus = {
  dir: BACKUP_DIR,
  keep: BACKUP_KEEP,
  count: 0,
  lastBackupAt: null,
  lastBackupFile: null,
  lastError: null,
};

export function getBackupStatus(): BackupStatus {
  return { ...status };
}

async function refreshCount(): Promise<void> {
  try {
    const files = await readdir(BACKUP_DIR);
    const backups = files.filter(f => BACKUP_NAME_RE.test(f)).sort();
    status.count = backups.length;
    if (!status.lastBackupFile && backups.length > 0) {
      status.lastBackupFile = backups[backups.length - 1];
    }
  } catch {
    status.count = 0;
  }
}

/** Creates today's backup if missing; prunes beyond BACKUP_KEEP. Idempotent. */
export async function ensureDailyBackup(): Promise<{ created: boolean; file: string }> {
  const file = backupFilenameFor(new Date());
  const target = join(BACKUP_DIR, file);

  await mkdir(BACKUP_DIR, { recursive: true });

  if (existsSync(target)) {
    await refreshCount();
    return { created: false, file };
  }

  const db = await getDb();
  const data = Buffer.from(db.export());
  const tmp = `${target}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, target);

  status.lastBackupAt = new Date().toISOString();
  status.lastBackupFile = file;
  status.lastError = null;

  // Rotate
  const files = await readdir(BACKUP_DIR);
  for (const stale of selectBackupsToDelete(files, BACKUP_KEEP)) {
    await unlink(join(BACKUP_DIR, stale)).catch(() => {});
  }
  await refreshCount();

  console.log(`[backup] wrote ${file} (${(data.length / 1024).toFixed(0)} KB), keeping last ${BACKUP_KEEP}`);
  return { created: true, file };
}

let loopStarted = false;

/** Start at boot: backup immediately if today's is missing, then check hourly. */
export function startBackupLoop(): void {
  if (loopStarted) return;
  loopStarted = true;
  const run = () =>
    ensureDailyBackup().catch(err => {
      status.lastError = err?.message ?? String(err);
      console.error("[backup] failed:", err);
    });
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}
