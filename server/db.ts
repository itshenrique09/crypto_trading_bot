import initSqlJs, { type Database } from "sql.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
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
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      added_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL,
      price REAL NOT NULL,
      confidence REAL NOT NULL,
      reason TEXT NOT NULL,
      indicators TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
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
  `);

  // Default mode = signal
  const existing = rowsToObjectsSync<{ key: string; value: string }>(_db, "SELECT * FROM bot_settings WHERE key = 'mode'");
  if (existing.length === 0) {
    _db.run("INSERT INTO bot_settings (key, value) VALUES ('mode', 'signal')");
  }

  persist(_db);
  return _db;
}

// Save to disk after every write
export function persist(db: Database) {
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}
