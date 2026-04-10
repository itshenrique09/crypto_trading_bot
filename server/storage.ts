import { getDb, persist } from "./db";
import type { Database } from "sql.js";

export interface Watchlist {
  id: number;
  symbol: string;
  name: string;
  added_at: string;
}

export interface Signal {
  id: number;
  symbol: string;
  type: string;
  price: number;
  confidence: number;
  reason: string;
  indicators: string;
  timestamp: string;
  status: string;
}

export interface InsertWatchlist {
  symbol: string;
  name: string;
  addedAt: string;
}

export interface InsertSignal {
  symbol: string;
  type: string;
  price: number;
  confidence: number;
  reason: string;
  indicators: string;
  timestamp: string;
  status: string;
}

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

export async function getWatchlist(): Promise<Watchlist[]> {
  const db = await getDb();
  return rowsToObjects<Watchlist>(db, "SELECT * FROM watchlist ORDER BY id DESC");
}

export async function addToWatchlist(item: InsertWatchlist): Promise<Watchlist> {
  const db = await getDb();
  db.run(
    "INSERT INTO watchlist (symbol, name, added_at) VALUES (?, ?, ?)",
    [item.symbol, item.name, item.addedAt]
  );
  persist(db);
  const rows = rowsToObjects<Watchlist>(
    db,
    "SELECT * FROM watchlist ORDER BY id DESC LIMIT 1"
  );
  return rows[0];
}

export async function removeFromWatchlist(id: number): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM watchlist WHERE id = ?", [id]);
  persist(db);
}

export async function getSignals(): Promise<Signal[]> {
  const db = await getDb();
  return rowsToObjects<Signal>(db, "SELECT * FROM signals ORDER BY timestamp DESC LIMIT 100");
}

export async function addSignal(signal: InsertSignal): Promise<Signal> {
  const db = await getDb();
  db.run(
    `INSERT INTO signals (symbol, type, price, confidence, reason, indicators, timestamp, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signal.symbol,
      signal.type,
      signal.price,
      signal.confidence,
      signal.reason,
      signal.indicators,
      signal.timestamp,
      signal.status,
    ]
  );
  persist(db);
  const rows = rowsToObjects<Signal>(
    db,
    "SELECT * FROM signals ORDER BY id DESC LIMIT 1"
  );
  return rows[0];
}

export async function updateSignalStatus(id: number, status: string): Promise<void> {
  const db = await getDb();
  db.run("UPDATE signals SET status = ? WHERE id = ?", [status, id]);
  persist(db);
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
  risk_usd?: number;
}

export async function getJournal(): Promise<JournalEntry[]> {
  const db = await getDb();
  return rowsToObjects<JournalEntry>(db, "SELECT * FROM journal ORDER BY created_at DESC LIMIT 200");
}

export async function addJournalEntry(entry: InsertJournal): Promise<JournalEntry> {
  const db = await getDb();
  const followed = entry.mode === "auto" || entry.mode === "paper" ? "yes" : (entry.followed || "pending");
  const strategy = entry.strategy || "v2-swing";
  db.run(
    `INSERT INTO journal (symbol, direction, entry_price, stop_loss, take_profit1, take_profit2, confluence_score, mode, strategy, followed, outcome, notes, position_size_usd, risk_usd, peak_price, tp1_hit, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, 0, ?)`,
    [
      entry.symbol, entry.direction, entry.entry_price, entry.stop_loss,
      entry.take_profit1, entry.take_profit2 || null, entry.confluence_score || null,
      entry.mode, strategy, followed, entry.notes || "",
      entry.position_size_usd || null, entry.risk_usd || null,
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
    tp1_hit?: number; stop_loss?: number;
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
