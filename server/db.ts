import initSqlJs, { type Database } from "sql.js";
import { existsSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data.db");

let _db: Database | null = null;

function rowsToObjectsSync<T>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  // Create tables
  _db.run(`
    CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price REAL NOT NULL,
      stop_loss REAL NOT NULL,
      take_profit1 REAL NOT NULL,
      take_profit2 REAL,
      confluence_score REAL,
      mode TEXT NOT NULL DEFAULT 'signal',
      followed TEXT NOT NULL DEFAULT 'pending',
      outcome TEXT NOT NULL DEFAULT 'open',
      exit_price REAL,
      pnl_pct REAL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      closed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS funding_carry_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      rate REAL,
      annualized REAL,
      notional REAL,
      pnl_usd REAL,
      note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      symbol TEXT NOT NULL,
      strategy TEXT NOT NULL,
      result TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      signal TEXT,
      confidence REAL
    );
  `);

  // Removed features (Aug 2026): the CoinGecko-era watchlist (UI bookmark
  // list nothing used; verified empty before removal) and the signals table
  // (never written by any code path).
  _db.run("DROP TABLE IF EXISTS watchlist; DROP TABLE IF EXISTS signals;");

  // Migrations — safe to run multiple times (catch = column already exists)
  const migrations = [
    "ALTER TABLE journal ADD COLUMN strategy TEXT NOT NULL DEFAULT 'v2-swing'",
    "ALTER TABLE journal ADD COLUMN position_size_usd REAL",   // USD size of the position
    "ALTER TABLE journal ADD COLUMN remaining_position_size_usd REAL", // USD size still open after partial exits
    "ALTER TABLE journal ADD COLUMN realized_pnl_usd REAL DEFAULT 0",  // USD P&L already locked by partial exits
    "ALTER TABLE journal ADD COLUMN risk_usd REAL",            // USD risked (1R)
    "ALTER TABLE journal ADD COLUMN pnl_usd REAL",             // closed P&L in USD
    "ALTER TABLE journal ADD COLUMN peak_price REAL",          // trailing stop tracking
    "ALTER TABLE journal ADD COLUMN tp1_hit INTEGER DEFAULT 0", // 1 if TP1 was hit (trailing active)
  ];
  for (const sql of migrations) {
    try { _db.run(sql); } catch { /* already exists */ }
  }

  // Performance indices
  const indices = [
    "CREATE INDEX IF NOT EXISTS idx_journal_created_at   ON journal(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_journal_strategy     ON journal(strategy)",
    "CREATE INDEX IF NOT EXISTS idx_journal_outcome      ON journal(outcome)",
    "CREATE INDEX IF NOT EXISTS idx_journal_mode_outcome ON journal(mode, outcome)",
    "CREATE INDEX IF NOT EXISTS idx_carry_log_time       ON funding_carry_log(time DESC)",
    "CREATE INDEX IF NOT EXISTS idx_scan_log_id          ON scan_log(id DESC)",
    "CREATE INDEX IF NOT EXISTS idx_journal_natural_key  ON journal(symbol, mode, created_at)",
  ];
  for (const sql of indices) {
    _db.run(sql);
  }

  // Default mode = signal
  const existing = rowsToObjectsSync<{ key: string; value: string }>(_db, "SELECT * FROM bot_settings WHERE key = 'mode'");
  if (existing.length === 0) {
    _db.run("INSERT INTO bot_settings (key, value) VALUES ('mode', 'signal')");
  }

  persist(_db);
  return _db;
}

// Save to disk after every write — non-blocking with write queue
let _persistPending = false;
let _persistQueued  = false;

export function persist(db: Database): void {
  if (_persistPending) {
    _persistQueued = true;
    return;
  }
  _persistPending = true;
  const data = Buffer.from(db.export());
  writeFile(DB_PATH, data)
    .catch(err => console.error("[db] persist failed:", err))
    .finally(() => {
      _persistPending = false;
      if (_persistQueued) {
        _persistQueued = false;
        persist(db);
      }
    });
}
