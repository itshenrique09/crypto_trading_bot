# Crypto Trading Bot

Automated crypto futures trading bot with paper trading, live execution (Kraken Futures / MEXC Futures) and a real-time supervision dashboard.

---

## Overview

The bot scans its coin universe on a 3-minute cycle, applies the active strategies, and opens positions when a high-confidence setup passes every engine gate. Paper trading runs in parallel with live trading — both use identical signal logic, gates and exit management, so results are directly comparable.

### Architecture

```
MEXC Futures (candles, tickers, funding) ──► Strategy Engine ──► Signal
        │ fallback: Binance spot                    │
        ▼                                           ▼
   Market data                    ┌─────────────────┼─────────────────┐
                                  ▼                 ▼                 ▼
                            Paper Engine       Live Engine        Backtest
                            (simulated,      (Kraken Futures      (research
                             costs modeled)   or MEXC Futures)     scripts)
                                  │                 │
                                  └────────┬────────┘
                                           ▼
                                   Journal (SQLite)
                                           │
                              Express API + SSE push
                                           │
                                   React dashboard
```

**Stack**: Node.js + Express 5 (server), React 18 + Vite (client), SQLite via sql.js (storage, persisted to `data.db`), MEXC Futures public API (candles/tickers/funding, Binance spot fallback), Kraken Futures API (default live venue) / MEXC Futures API (alternative venue, unavailable to EEA residents since Jul 2026).

The full HTTP surface is documented in [API.md](./API.md).

---

## Active Strategies (frozen 2026-07-02)

| Strategy | Timeframe | Universe | Role |
|----------|-----------|----------|------|
| **Liquidity Sweep** | 1H | 41 coins | Workhorse — stop-hunt reversals (~85% of trades) |
| **RSI Divergence** | 1H | ATOM, INJ | Mean-reversion complement |
| **Break & Retest** | 4H | 6 coins | Uncorrelated breakout exposure |

The scanner universe is the union of every active strategy's preferred symbols (41 coins), built from `server/strategies/registry.ts` — the Markets page shows exactly what the engine trades.

Validated as a **portfolio** by the full-pipeline harness (`script/validate-pipeline.ts`) with every engine gate, sequential capital, and fees+slippage modeled: **PF 1.99 · +715R · maxDD 31.2%** over the full window (PF 2.00 · +400R in 2026, data through Jul 7). The direction×regime matrix confirms the edge is symmetric — more than half of total R comes from BTC-down periods. The LS universe was expanded 28→41 coins in Jul 2026 via a two-halves consistency screen (`script/expand-universe-ls.ts`) — each new coin had to be independently profitable in both halves of the year, then the whole portfolio had to improve with them included (+517R → +688R). Every universe coin is verified to have a tradeable MEXC futures contract (`script/check-mexc-symbols.ts`) so backtest = paper = live; TON and BONK passed the screen but were excluded for lacking one. The tighter pre-expansion config (28 coins, group cap 2: PF 2.01, +517R, maxDD 27.4%) is the documented fallback if live drawdown tolerance demands it. Retired: Confluence Swing (Jul 2026, fee fodder at PF 1.07), SMC and Bollinger MR (May 2026). Rationale lives in `server/strategies/registry.ts`.

> **Change policy**: strategy parameters and coin universes are FROZEN. Any change requires a pre-stated hypothesis, a full-pipeline A/B (`script/validate-pipeline.ts`, ALL + 2026 windows), and 90 days of frozen paper validation. Recent-window per-coin re-optimization is how this project previously destroyed its own edge.

---

## Risk Management

All values below are the **actual engine constants** — they are exported verbatim at `GET /api/engine/config` so the dashboard can never drift from the code.

| Parameter | Value |
|-----------|-------|
| Risk per trade | 2% of balance (paper) / 1% default (live), fixed fractional (Kelly retired Jul 2026 — doubled maxDD) |
| BTC macro multiplier | ×1.25 bull / ×0.75 bear (BTC daily trend) |
| Max open positions | 10 (fixed; capacity A/B Jul 2026: +55R and *lower* maxDD than 6; 12 tested worse) |
| Max hold time | 200h (1H strategies) / 240h (4H) → close at market (backtest parity + slot turnover) |
| Max per correlation group | 3 (raised from 2 with the 41-coin universe — cap 2 bottlenecked the expansion) |
| Symbol exposure | 1 position per symbol across all strategies |
| Daily drawdown halt | −4R |
| Rolling 7-day halt | −6R |
| Per-strategy kill-switch | 7d netR < −3R over ≥4 trades → strategy pauses, self-heals |
| Minimum R:R | 1.5:1 |
| Minimum SL distance | 0.6% (round-trip costs ≈ 0.14% — fee-dominance guard) |
| Min 24h volume | $30M USDT |
| Max spread | 0.20% |
| Funding filter | No LONGs above +0.1%, no SHORTs below −0.1% |

**Position sizing:**
```
slDistPct   = |entry − stopLoss| / entry
riskUsd     = balance × riskPct/100 × btcMultiplier
positionUsd = riskUsd / slDistPct
```
The stop loss is always set by the strategy's technical logic — the position size adjusts to keep the dollar risk fixed. For live, `balance` is the venue account **equity** (Kraken `/accounts`), refreshed each 30s engine cycle.

**Removed by evidence (Jul 2026 pipeline A/B)** — see `STRATEGIES.md` → Engine Filters for the numbers: ATR-percentile filter, SHORT ≥72% confidence gate, daily contra-trend gate, BTC directional overlay, dynamic position cap, monthly −8R pause, fractional-Kelly sizing.

---

## Exit Management

1. Position opens with SL and TP1/TP2 from the strategy signal
2. Price hits **TP1** → close 60%, SL moves to break-even
3. Runner trails at **2× the trade's original risk** from the peak (`r_multiple` mode — default since the Jul 2026 portfolio exit A/B: beat the fixed-2% trail on every metric in both windows). `fixed_pct` remains available via Settings.
4. Position closes at **TP2**, the trailing stop, break-even, or the max-hold timeout

On Kraken, protective stop/take-profit orders are placed **on the venue** (reduce-only, mark-price triggered) and read back so the dashboard can prove a position is protected. MEXC exposes no protection read-back — the UI shows "sem proteção" for those.

---

## Funding-Rate Carry (Phase 1 — paper observer)

Always-on scanner + simulated delta-neutral carry ledger (`server/funding-carry.ts`, `GET /api/funding-carry`). When perp funding on a hedgeable coin exceeds **30%/yr annualized**, the simulator "opens" a short-perp + long-spot position ($1000/leg, max 5) and accrues real funding every 8h settlement, net of realistic entry/exit costs. Exits below 10%/yr (hysteresis). **No orders are ever placed**; visible on the Activity page.

---

## Dashboard

React SPA (hash routing) served by the same Express process. Dark-only design system (`client/src/index.css` tokens); numbers in JetBrains Mono, UI in Inter. Freshness comes from **SSE push** (`/api/events`) — the server notifies the UI after every engine cycle; polling remains as a slower fallback. Every data panel is labeled with its real source (Kraken Futures, MEXC Futures, Binance Spot, simulação).

| Page | Path | Description |
|------|------|-------------|
| Live | `/#/live` | Kraken/MEXC account (equity, margin, uPnL), venue positions with on-exchange SL/TP protection and funding, risk guards, live-only equity curve and history, engine start/stop. Onboarding flow when no API keys are stored. |
| Paper | `/#/paper` | Simulated balance and positions (marks from MEXC Futures), risk guards computed with the engine's own formulas, per-strategy performance, paper-only equity curve and history, engine start/stop. |
| Mercados | `/#/markets` | The 41-coin trading universe with price, 1h/24h/7d change, volume/spread/funding **checked against the real engine gates** (✓/✗ per row). |
| Símbolo | `/#/markets/:symbol` | TradingView-style chart (lightweight-charts: 15m/1H/4H/1D, volume, EMA 50/200, OHLC crosshair legend), open-position levels drawn on the chart, per-symbol gate status, live signals from the actual strategy registry, bot trade history for the symbol. |
| Atividade | `/#/activity` | The scanner's decision feed (opened / filtered / no-signal with reasons — persisted across restarts), active strategies with universe sizes and kill-switch state, engine parameters, funding-carry observer. Force-scan button. |
| Definições | `/#/settings` | Exchange API keys (AES-256 encrypted at rest), risk/leverage, paper capital, trailing mode, backup status, system info. |

Paper and live are **deliberately separated** — separate pages, separate histories, separate equity curves; live carries an amber "dinheiro real" identity, paper a violet "simulado" one.

---

## Operations

### Backups
`data.db` (journal **and** encrypted API keys) is snapshotted daily to `./backups/data-YYYY-MM-DD.db`, keeping the last **7** (rotation automatic). The snapshot is taken from the in-memory database and written atomically — it can never capture a torn file. Runs at startup + hourly check; status is visible at `GET /api/health` and in Settings → Sistema. **Restore**: stop the server, replace `data.db` with a backup, start. Note: backups live on the same disk — copy `./backups` off-machine for real disaster recovery.

### Export / Import
Each history panel has **Exportar JSON** (full per-mode dump, not capped at the 200-row list limit) and **Importar** (restore; IDs re-assigned, duplicates by symbol+mode+created_at skipped — importing the same file twice is safe). Endpoints: `GET /api/journal/export?mode=paper|live`, `POST /api/journal/import`.

### Health monitoring
`GET /api/health` returns **200** when supervisable and **503** when something needs attention (database unreachable, or live engine running in an error state). Body includes DB row count, market-data reachability (MEXC ping, 60s cache), engine states, backup status and build info. Point an uptime monitor at it in production.

### Credentials & security
- Production is gated by HTTP Basic auth (`admin` / `APP_PASSWORD`). Development skips auth.
- Exchange keys are stored AES-256-CBC encrypted in SQLite; the key derives from `sha256(APP_PASSWORD)` — **changing `APP_PASSWORD` makes previously stored exchange keys unreadable** (re-enter them in Settings afterwards).
- Create venue API keys **without withdrawal permission**.

---

## Running

```bash
npm install
npm run dev          # server + client (Vite middleware, HMR) — default port 5000
```

Set `PORT` if 5000 is taken (any `.env` var or inline):

```bash
npx cross-env PORT=5001 NODE_ENV=development tsx server/index.ts
```

The database is auto-created at `./data.db` on first run; the paper engine auto-starts if the persisted mode is `paper`.

```bash
npm run check        # tsc --noEmit
npm test             # node --test server/*.test.ts (156 tests)
npm run build        # → dist/index.cjs + dist/public
npm start            # production (requires APP_PASSWORD)
```

For a VPS, `ecosystem.config.cjs` is a ready pm2 config (secrets from a server-side `.env`).

---

## Validation Tooling

| Script | Purpose |
|--------|---------|
| `script/validate-pipeline.ts` | **The arbiter.** Chronological portfolio sim of the whole engine: all gates (each individually toggleable), sequential capital, exposure/caps/guards, fees+slippage. Writes `script/validate-pipeline-report.md`. |
| `script/validate-2026.ts` | Raw per-strategy edge (2 gates only) — upper-bound sanity check, not a system test. |
| `script/validate-universe.ts` | ⚠️ Frozen — selection-bias methodology (picks coins on the window it validates on). Reference only. |

The per-symbol backtest endpoints (`/api/backtest*`) remain available for research but are **deliberately not surfaced in the UI** — raw single-strategy backtests on recent windows contradict the validation policy above.

---

## Documentation Map

| Document | Contents |
|----------|----------|
| [README.md](./README.md) | This file — architecture, risk, operations |
| [API.md](./API.md) | Complete HTTP API + SSE reference |
| [STRATEGIES.md](./STRATEGIES.md) | Full per-strategy logic, thresholds, engine filter table |
| [cryptotrader-docs/02-analysis-engine.md](./cryptotrader-docs/02-analysis-engine.md) | Indicator implementations in `server/analysis.ts` (reference) |
| [cryptotrader-docs/04-setup-dev.md](./cryptotrader-docs/04-setup-dev.md) | Setup, project layout, development workflow |
| `cryptotrader-docs/archive/` | Historical docs from the pre-execution era (kept for context, no longer accurate) |
