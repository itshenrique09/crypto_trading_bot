# HTTP API Reference

All endpoints are served by the Express process (default port `5000`, override with `PORT`). In production every route is gated by HTTP Basic auth (`admin` / `APP_PASSWORD`); in development auth is skipped.

Conventions:
- All bodies are JSON. Non-2xx responses carry `{ "error": string }`.
- `:symbol` is the bot symbol (e.g. `BTC`, `SOL`) — uppercased and sanitized server-side.
- "Journal" is the single trades table — paper, live and manual signal entries, discriminated by `mode`.

---

## Status & push

### `GET /api/health`
Liveness/degradation probe for uptime monitors. **HTTP 200** = supervisable, **HTTP 503** = needs attention (database unreachable, or live engine running with an error while real money is exposed). Body (returned on both codes):

```jsonc
{
  "status": "ok" | "degraded",
  "reasons": ["…"],                       // empty when ok
  "uptimeSeconds": 123,
  "db": { "ok": true, "journalRows": 21 },
  "marketData": { "ok": true, "note": "MEXC futures reachable", "checkedAt": "…" }, // 60s cache
  "engines": {
    "paper": { "running": true, "lastScan": "…" },
    "live":  { "running": false, "error": null, "unmanagedPositions": 0, "lastScan": null }
  },
  "backups": { "dir": "…", "keep": 7, "count": 1, "lastBackupAt": "…", "lastBackupFile": "data-2026-08-13.db", "lastError": null },
  "build": { /* same as /api/runtime */ }
}
```

### `GET /api/runtime`
Build metadata: `{ app, nodeEnv, version, buildCommit, buildDirty, buildTime, startedAt }`.

### `GET /api/events` — Server-Sent Events
Push channel. The server emits an event after every engine cycle so the UI can refresh immediately (polling is only a fallback). Heartbeat comment every 25s. Event types (data payload is currently `{}` — consumers re-fetch the relevant endpoints):

| Event | Emitted when | Client should refresh |
|-------|--------------|----------------------|
| `paper` | paperCheck/paperScan finished, `/api/paper/tick` | `/api/paper/status`, `/api/paper/prices`, `/api/journal` |
| `live` | liveCheck/liveScan finished | `/api/live/status`, `/api/journal` |
| `scan` | scan-log entries written (debounced ~1.5s per burst) | `/api/paper/scan-log` |
| `journal` | bulk journal changes (import) | `/api/journal` |

---

## Market data

### `GET /api/market`
The trading universe (union of every active strategy's preferred symbols — 41 coins) with **MEXC Futures** data. Cached 30s server-side. Array of:

```jsonc
{
  "symbol": "BTC", "name": "Bitcoin", "rank": 1,
  "price": 63853.7,
  "change1h": 0.21, "change24h": 0.68, "change7d": -0.88,   // 1h/7d from klines
  "volume24h": 3680000000,                                   // USDT
  "spreadPct": 0.00001,                                      // (ask-bid)/price from the book, null if unavailable
  "fundingRate": 0.000073,                                   // fraction per 8h, null if unavailable
  "high24h": 63990, "low24h": 63283,
  "sparkline": [/* ~50 closes, 7d */]
}
```

### `GET /api/candles/:symbol?interval=1h&limit=400`
Generic OHLCV for charting. Intervals: `5m 15m 30m 1h 4h 8h 1d 1w`. Limit 50–1000 (default 400). The response **names the venue that actually served the data**:

```jsonc
{ "symbol": "BTC", "interval": "1h", "source": "mexc-futures" | "binance-spot", "candles": [{ "time": 1786449600, "open": …, "high": …, "low": …, "close": …, "volume": … }] }
```

### `GET /api/trade-chart/:symbol?from=<unix_s>&to=<unix_s>&interval=4h`
Candle window around a trade (60 bars before `from` → 30 after `to`, cap 500). **Binance spot only.** Intervals: `15m 1h 4h 1d`. Returns a bare `OHLCV[]`.

### `GET /api/coin/:symbol?days=30`
Legacy CoinGecko metadata (name, market cap, ATH, supply) + daily candles. Rate-limited upstream (1 req/1.2s server-wide); not used by the current UI.

---

## Engine configuration & strategies

### `GET /api/engine/config`
The **real constants the engines run with** — same identifiers the scan/check loops use, so a UI built on this can never drift from the code:

```jsonc
{
  "riskGates":  { "minVolumeUsdt": 30000000, "maxSpreadPct": 0.002, "fundingLongMax": 0.001,
                  "fundingShortMin": -0.001, "minSlDistancePct": 0.006, "minRiskReward": 1.5 },
  "portfolio":  { "maxOpenPositions": 10, "maxPerCorrelationGroup": 3, "onePositionPerSymbol": true,
                  "dailyDrawdownHaltR": 4, "rollingWindowDays": 7, "rollingDrawdownHaltR": 6,
                  "killSwitchMinTrades": 4, "killSwitchMaxNetR": -3 },
  "exits":      { "tp1PartialClosePct": 0.6, "maxHoldHoursByInterval": { "1h": 200, "4h": 240 } },
  "scan":       { "checkEverySeconds": 30, "scanEveryMinutes": 3 }
}
```

### `GET /api/strategies`
Active registry: `[{ id, name, description, interval, preferredSymbols: string[], minCandles, cooldownHours, enabled, paperEnabled, liveEnabled, killSwitchPaused: { paper, live } }]`.
`paperEnabled`/`liveEnabled` are the **manual pause switches per mode** (Settings UI; persisted in `bot_settings.disabled_strategies_paper` / `disabled_strategies_live`, with the legacy single-list `disabled_strategies` read as fallback) — paper can keep testing a strategy that live has paused. `enabled` = enabled on at least one mode (backward compat). `killSwitchPaused` is the automatic −3R/7d drawdown kill-switch state per engine (read-only, self-healing). Signal selection among enabled strategies stays automatic.
Default: `rsi-divergence` starts paused on both modes (Aug 2026 audit — negative marginal portfolio contribution in both harness windows).

### `PUT /api/strategies/:id/toggle`
Body `{ enabled: boolean, mode?: "paper" | "live" | "both" }` (default `both`). Pausing blocks **new entries only** — open positions keep being managed until they close. Returns `{ id, mode, paperEnabled, liveEnabled }` and pushes the affected mode's SSE event(s).

### `GET /api/universe`
`{ symbols: [{ symbol, strategies: string[], enabled }] }` — the validated 40-coin universe with the **operational per-symbol blocklist** state. One list for BOTH modes on purpose (the LUNC lesson: paper benchmarking a coin live cannot trade corrupts the comparison). For delistings/liquidity emergencies — not a performance tuner (per-coin samples are too small; composition changes go through the two-halves screen + pipeline A/B).

### `PUT /api/universe/:symbol/toggle`
Body `{ enabled: boolean }`. Symbol must belong to the validated universe. Blocks **new entries only**, both engines. Returns `{ symbol, enabled, disabled: string[] }`.

---

## Analysis & signals

### `GET /api/signals/:symbol`
Runs the **actual strategy registry** (the same `analyze()` code the engines trade with) against fresh candles:

```jsonc
{ "symbol": "SOL", "currentPrice": 76.43, "strategies": [
  { "id": "liquidity-sweep", "name": "Liquidity Sweep", "interval": "1h",
    "inUniverse": true,                    // symbol in this strategy's validated universe?
    "signal": "BUY" | "SELL" | "HOLD",
    "score": 0, "confidence": 0, "reason": "No setup on the latest candle",
    "entry": …, "stopLoss": …, "takeProfit": …, "takeProfit2": … }   // present when signal ≠ HOLD
] }
```

### `GET /api/analyze/:symbol`
Legacy multi-indicator analysis (`server/analysis.ts`): 1H signal + 1D trend filter + 15m entry refinement, full indicator dump, 150×4h candles. Not what the engines trade with; kept for research.

---

## Journal (trades & positions)

Row shape (all endpoints):

```jsonc
{ "id": 45, "symbol": "SOL", "direction": "LONG" | "SHORT",
  "entry_price": …, "stop_loss": …, "take_profit1": …, "take_profit2": …,
  "confluence_score": …, "mode": "signal" | "auto" | "paper" | "live",
  "strategy": "liquidity-sweep", "followed": "pending" | "yes" | "no",
  "outcome": "open" | "win" | "loss" | "breakeven",
  "exit_price": …, "pnl_pct": …, "pnl_usd": …, "risk_usd": …,
  "position_size_usd": …, "remaining_position_size_usd": …, "realized_pnl_usd": …,
  "tp1_hit": 0 | 1, "peak_price": …, "notes": "…", "created_at": "…", "closed_at": … }
```

| Method & path | Purpose |
|---|---|
| `GET /api/journal` | Latest **200** rows, newest first (no filters — filter client-side or use export) |
| `POST /api/journal` | Create entry (Zod-validated: SL/TP must sit on the correct side of entry) |
| `PATCH /api/journal/:id` | Update whitelisted fields (`outcome, exit_price, pnl_pct, pnl_usd, closed_at, notes, followed, stop_loss, tp1_hit, peak_price, remaining_position_size_usd, realized_pnl_usd`) |
| `DELETE /api/journal/:id` | Delete row |
| `POST /api/journal/from-signal` | Create a signal-mode entry from an analysis signal |
| `GET /api/journal/stats` | Per-strategy aggregates — **paper trades and active strategies only** |
| `GET /api/journal/export?mode=paper\|live` | **Full dump** (no 200 cap), download envelope `{ app, exportedAt, mode, count, trades }` with `Content-Disposition` filename |
| `POST /api/journal/import` | Restore an export (envelope or bare array, ≤10 000 rows). IDs re-assigned; duplicates (symbol+mode+created_at) skipped → idempotent. Returns `{ imported, skipped, invalid, total }` |

> **Closing live positions**: never `PATCH` a live journal row shut — use `POST /api/live/close/:id`, which closes on the venue first and then reconciles the journal. Patching alone leaves the exchange position open and pauses all live entries.

---

## Paper engine

| Method & path | Purpose |
|---|---|
| `POST /api/paper/start` / `POST /api/paper/stop` | Engine control → `{ running }` (start also sets persisted mode to `paper`) |
| `GET /api/paper/status` | `{ running, lastCheck, lastScan, coinsScanned, intelligence: { btcRegime, maxOpen, direction, pausedStrategies, … } \| null, openTrades, totalPaperTrades, strategyCounts, capital: { initial, balance, totalPnlUsd, riskPct, leverage, oneR, todayPnlUsd, todayR } }` |
| `POST /api/paper/capital` | `{ capital? ≤1e6, riskPct? ≤5, leverage? 1–20 }` — recomputes balance from historical P&L |
| `GET /api/paper/prices` | Server-computed marks for open paper trades: `[{ id, symbol, currentPrice, unrealizedPnl (%), unrealizedUsd, realizedPnlUsd, tp1Hit, progressPct, slProgress, … }]` |
| `GET /api/paper/scan-log` | Scanner decision feed, newest first: `[{ time, symbol, strategy, result: "opened"\|"filtered"\|"no_signal", reason, signal?, confidence? }]`. **Persisted** (`scan_log` table, last 2000 kept, restored at boot). Live-engine scan events land in the same feed. |
| `POST /api/paper/tick` | Force one check+scan cycle immediately |

Cadence: position management every **30s**, scan every **3min**; auto-starts on boot when the persisted mode is `paper`.

---

## Live engine

| Method & path | Purpose |
|---|---|
| `POST /api/live/config` | `{ exchange: "kraken"\|"mexc", apiKey, apiSecret, riskPct ≤3, leverage 1–20 }`. Sentinel `"__keep__"` (or omission) preserves stored credentials so risk/leverage can change alone. Keys stored AES-256-CBC encrypted. |
| `POST /api/live/test` | Connection test → `{ ok, balance?, error? }` |
| `POST /api/live/start` / `POST /api/live/stop` | Engine control; start throws if the connection test fails and sets mode `live` |
| `POST /api/live/close/:id` | Close a live position **on the venue** at market, then reconcile → `{ ok, closedOnVenue, exitPrice }` |
| `GET /api/live/status` | Full venue snapshot (below) |

`GET /api/live/status` response highlights:

```jsonc
{
  "running": false, "hasKeys": false, "exchange": "kraken",
  "exchanges": [{ "id", "name", "note" }], "configured": { "kraken": false, "mexc": false },
  "riskPct": 1, "leverage": 5,
  "account": { "equity", "available", "usedMargin", "unrealizedPnl" } | null,   // Kraken /accounts
  "positions": [{ "botSymbol", "direction", "size", "entryPrice", "markPrice",
                  "notionalUsd", "unrealizedPnl", "unrealizedFunding",
                  "protection": { "stop", "takeProfit" } }],                    // venue-resting orders (Kraken)
  "snapshotAt": "…",              // refreshed each 30s cycle while running
  "pausedStrategies": [],          // kill-switch state from the last liveScan
  "unmanagedPositions": 0,         // venue positions with no journal row → live entries paused
  "error": null,
  "openTrades": 0, "totalLiveTrades": 0, "closedLiveTrades": 0, "totalPnlUsd": 0, "todayPnlUsd": 0
}
```

Venue notes: Kraken Futures is the default (perpetuals `PF_<BASE>USD`, BTC→XBT); MEXC has no fill history nor protection read-back — exit prices fall back to ticker estimates and `protection` is absent.

---

## Settings

| Method & path | Purpose |
|---|---|
| `GET /api/settings/mode` / `PUT` | Persisted mode `signal\|auto\|paper` (drives engine auto-start on boot; `live` is set internally by `/api/live/start` and rejected here) |
| `GET /api/settings/feature-flags` | `{ regime_filter_enabled, short_macro_filter_enabled, btc_regime_gate_enabled (display-only, always true), trailing_mode: "r_multiple"\|"fixed_pct", trailing_r_multiple }` |
| `PUT /api/settings/feature-flags` | Accepts **only** `trailing_mode` and `trailing_r_multiple` (0.5–5); applies to both engines |

---

## Misc

| Method & path | Purpose |
|---|---|
| `GET /api/funding-carry` | Phase-1 carry observer report: config, top opportunities, simulated portfolio, recent events. No orders are ever placed. |
| `GET /api/backtest/:symbol` · `/api/backtest-smc/:symbol` · `/api/backtest-breakretest/:symbol` · `/api/backtest-rsi-div/:symbol` · `/api/backtest-liquidity-sweep/:symbol` · `/api/backtest-all/:symbol` | Per-symbol research backtests (8000 candles, slow, uncached). **Not in the UI by design** — raw recent-window backtests contradict the validation policy; `script/validate-pipeline.ts` is the arbiter. |

> Removed Aug 2026: the CoinGecko-era watchlist endpoints and the never-written `GET /api/signals` history — dead surface with no consumers.

---

## Storage

SQLite via sql.js (WASM): the whole DB lives in memory and is rewritten to `./data.db` on every write (debounced queue). Tables:

| Table | Holds |
|---|---|
| `journal` | All trades/positions (paper, live, signal), discriminated by `mode` |
| `bot_settings` | Key/value: mode, capital/risk/leverage, trailing config, **encrypted exchange keys** |
| `scan_log` | Persisted scanner decision feed (last ~2000) |
| `funding_carry_log` | Carry observer events |

Daily backups: `./backups/data-YYYY-MM-DD.db`, last 7 kept — see README → Operations.
