import { getDb, persist } from "./db";
import type { Database } from "sql.js";

// Helper: convert sql.js query result to array of objects
function rowsToObjects<T>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

// ── Journal ────────────────────────────────────────────────────────

export interface JournalEntry {
  id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit1: number;
  take_profit2: number | null;
  confluence_score: number | null;
  mode: string;          // 'signal' | 'auto' | 'paper'
  strategy: string;
  followed: string;      // 'pending' | 'yes' | 'no'
  outcome: string;       // 'open' | 'win' | 'loss' | 'breakeven'
  exit_price: number | null;
  pnl_pct: number | null;
  // Capital management fields
  position_size_usd: number | null;  // USD position size
  remaining_position_size_usd: number | null; // USD size still open after partial exits
  realized_pnl_usd: number | null;   // USD P&L already locked by partial exits
  risk_usd: number | null;           // USD risked (1R)
  pnl_usd: number | null;            // actual P&L in USD
  peak_price: number | null;         // best price since entry (for trailing stop)
  tp1_hit: number;                   // 1 if TP1 was hit (trailing stop active)
  notes: string;
  created_at: string;
  closed_at: string | null;
}

export interface InsertJournal {
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit1: number;
  take_profit2?: number;
  confluence_score?: number;
  mode: string;
  strategy?: string;
  followed?: string;
  notes?: string;
  position_size_usd?: number;
  remaining_position_size_usd?: number;
  realized_pnl_usd?: number;
  risk_usd?: number;
}

export async function getJournal(limit = 200): Promise<JournalEntry[]> {
  const db = await getDb();
  return rowsToObjects<JournalEntry>(db, "SELECT * FROM journal ORDER BY created_at DESC LIMIT ?", [limit]);
}

/** Full journal dump for exports/backups — no row limit, optional mode filter. */
export async function getAllJournalEntries(mode?: string): Promise<JournalEntry[]> {
  const db = await getDb();
  if (mode) {
    return rowsToObjects<JournalEntry>(db, "SELECT * FROM journal WHERE mode = ? ORDER BY created_at DESC", [mode]);
  }
  return rowsToObjects<JournalEntry>(db, "SELECT * FROM journal ORDER BY created_at DESC");
}

/**
 * Restore one exported journal row. IDs are NOT preserved (autoincrement
 * assigns a fresh one) so backups from a different database can never
 * collide; duplicates are detected by the natural key symbol+mode+created_at.
 * Returns false when the row already exists (skipped).
 */
export async function importJournalEntry(row: Omit<JournalEntry, "id">): Promise<boolean> {
  const db = await getDb();
  const existing = rowsToObjects<{ id: number }>(
    db,
    "SELECT id FROM journal WHERE symbol = ? AND mode = ? AND created_at = ? LIMIT 1",
    [row.symbol, row.mode, row.created_at],
  );
  if (existing.length > 0) return false;
  db.run(
    `INSERT INTO journal (
       symbol, direction, entry_price, stop_loss, take_profit1, take_profit2,
       confluence_score, mode, strategy, followed, outcome, exit_price, pnl_pct,
       notes, created_at, closed_at, position_size_usd, remaining_position_size_usd,
       realized_pnl_usd, risk_usd, pnl_usd, peak_price, tp1_hit
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.symbol, row.direction, row.entry_price, row.stop_loss, row.take_profit1,
      row.take_profit2 ?? null, row.confluence_score ?? null, row.mode,
      row.strategy || "v2-swing", row.followed || "yes", row.outcome || "open",
      row.exit_price ?? null, row.pnl_pct ?? null, row.notes || "", row.created_at,
      row.closed_at ?? null, row.position_size_usd ?? null,
      row.remaining_position_size_usd ?? null, row.realized_pnl_usd ?? 0,
      row.risk_usd ?? null, row.pnl_usd ?? null, row.peak_price ?? null,
      row.tp1_hit ?? 0,
    ],
  );
  persist(db);
  return true;
}

// ── Scan log (persisted ring — survives restarts) ────────────────────

export interface ScanLogRow {
  id: number;
  time: string;
  symbol: string;
  strategy: string;
  result: string;
  reason: string;
  signal: string | null;
  confidence: number | null;
}

const SCAN_LOG_KEEP = 2000;
let scanLogInsertsSincePrune = 0;

export async function addScanLogEntry(e: {
  time: string; symbol: string; strategy: string; result: string;
  reason: string; signal?: string; confidence?: number;
}): Promise<void> {
  const db = await getDb();
  db.run(
    "INSERT INTO scan_log (time, symbol, strategy, result, reason, signal, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [e.time, e.symbol, e.strategy, e.result, e.reason, e.signal ?? null, e.confidence ?? null],
  );
  // Prune occasionally, not on every insert — a scan cycle writes ~100 rows.
  if (++scanLogInsertsSincePrune >= 500) {
    scanLogInsertsSincePrune = 0;
    db.run(
      "DELETE FROM scan_log WHERE id NOT IN (SELECT id FROM scan_log ORDER BY id DESC LIMIT ?)",
      [SCAN_LOG_KEEP],
    );
  }
  persist(db);
}

export async function getRecentScanLog(limit = 500): Promise<ScanLogRow[]> {
  const db = await getDb();
  return rowsToObjects<ScanLogRow>(db, "SELECT * FROM scan_log ORDER BY id DESC LIMIT ?", [limit]);
}

/** Cheap DB liveness probe for /api/health. */
export async function countJournalEntries(): Promise<number> {
  const db = await getDb();
  const rows = rowsToObjects<{ n: number }>(db, "SELECT COUNT(*) AS n FROM journal");
  return rows[0]?.n ?? 0;
}

export async function addJournalEntry(entry: InsertJournal): Promise<JournalEntry> {
  const db = await getDb();
  const followed = entry.mode === "auto" || entry.mode === "paper" ? "yes" : (entry.followed || "pending");
  const strategy = entry.strategy || "v2-swing";
  const remainingPositionSize = entry.remaining_position_size_usd ?? entry.position_size_usd ?? null;
  const realizedPnl = entry.realized_pnl_usd ?? 0;
  db.run(
    `INSERT INTO journal (symbol, direction, entry_price, stop_loss, take_profit1, take_profit2, confluence_score, mode, strategy, followed, outcome, notes, position_size_usd, remaining_position_size_usd, realized_pnl_usd, risk_usd, peak_price, tp1_hit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      entry.symbol, entry.direction, entry.entry_price, entry.stop_loss,
      entry.take_profit1, entry.take_profit2 || null, entry.confluence_score || null,
      entry.mode, strategy, followed, entry.notes || "",
      entry.position_size_usd || null, remainingPositionSize, realizedPnl, entry.risk_usd || null,
      entry.entry_price,  // peak_price starts at entry
      new Date().toISOString(),
    ]
  );
  persist(db);
  return rowsToObjects<JournalEntry>(db, "SELECT * FROM journal ORDER BY id DESC LIMIT 1")[0];
}

export async function updateJournalEntry(
  id: number,
  updates: {
    followed?: string; outcome?: string; exit_price?: number; pnl_pct?: number;
    notes?: string; closed_at?: string; pnl_usd?: number; peak_price?: number;
    tp1_hit?: number; stop_loss?: number; remaining_position_size_usd?: number;
    realized_pnl_usd?: number;
  }
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (updates.followed !== undefined)   { sets.push("followed = ?");    vals.push(updates.followed); }
  if (updates.outcome !== undefined)    { sets.push("outcome = ?");     vals.push(updates.outcome); }
  if (updates.exit_price !== undefined) { sets.push("exit_price = ?");  vals.push(updates.exit_price); }
  if (updates.pnl_pct !== undefined)    { sets.push("pnl_pct = ?");     vals.push(updates.pnl_pct); }
  if (updates.notes !== undefined)      { sets.push("notes = ?");       vals.push(updates.notes); }
  if (updates.closed_at !== undefined)  { sets.push("closed_at = ?");   vals.push(updates.closed_at); }
  if (updates.pnl_usd !== undefined)    { sets.push("pnl_usd = ?");     vals.push(updates.pnl_usd); }
  if (updates.remaining_position_size_usd !== undefined) { sets.push("remaining_position_size_usd = ?"); vals.push(updates.remaining_position_size_usd); }
  if (updates.realized_pnl_usd !== undefined) { sets.push("realized_pnl_usd = ?"); vals.push(updates.realized_pnl_usd); }
  if (updates.peak_price !== undefined) { sets.push("peak_price = ?");  vals.push(updates.peak_price); }
  if (updates.tp1_hit !== undefined)    { sets.push("tp1_hit = ?");     vals.push(updates.tp1_hit); }
  if (updates.stop_loss !== undefined)  { sets.push("stop_loss = ?");   vals.push(updates.stop_loss); }
  if (sets.length === 0) return;
  vals.push(id);
  db.run(`UPDATE journal SET ${sets.join(", ")} WHERE id = ?`, vals);
  persist(db);
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM journal WHERE id = ?", [id]);
  persist(db);
}

// ── Bot Settings ───────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = rowsToObjects<{ key: string; value: string }>(db, "SELECT * FROM bot_settings WHERE key = ?", [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  db.run("INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)", [key, value]);
  persist(db);
}
