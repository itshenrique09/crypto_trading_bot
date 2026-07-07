# Crypto Trading Bot

Automated crypto futures trading bot with paper trading, backtesting, and live execution via MEXC Futures API.

---

## Overview

The bot scans the coin universe on a 3-minute cycle, applies the active strategies, and opens positions when a high-confidence setup passes the engine gates. Paper trading runs in parallel with live trading — both use identical signal logic so results are directly comparable.

### Architecture

```
Binance (candles) ──► Strategy Engine ──► Signal
                                            │
                       ┌────────────────────┼────────────────────┐
                       ▼                    ▼                    ▼
                 Paper Engine         Live Engine            Backtest
                 (simulated)        (MEXC Futures)         (historical)
                       │                    │
                       └─────────┬──────────┘
                                 ▼
                            Journal DB
                          (SQLite + API)
```

**Stack**: Node.js + Express (server), React + Vite (client), SQLite (storage), Binance public API (candles), MEXC Futures API (execution).

---

## Active Strategies (frozen 2026-07-02)

| Strategy | Timeframe | Universe | Role |
|----------|-----------|----------|------|
| **Liquidity Sweep** | 1H | 41 coins | Workhorse — stop-hunt reversals (~85% of trades) |
| **RSI Divergence** | 1H | ATOM, INJ | Mean-reversion complement |
| **Break & Retest** | 4H | 6 coins | Uncorrelated breakout exposure |

Validated as a **portfolio** by the full-pipeline harness (`script/validate-pipeline.ts`) with every engine gate, sequential capital, and fees+slippage modeled: **PF 1.99 · +715R · maxDD 31.2%** over the full window (PF 2.00 · +400R in 2026, data through Jul 7). The direction×regime matrix confirms the edge is symmetric — more than half of total R comes from BTC-down periods. The LS universe was expanded 28→41 coins in Jul 2026 via a two-halves consistency screen (`script/expand-universe-ls.ts`) — each new coin had to be independently profitable in both halves of the year, then the whole portfolio had to improve with them included (+517R → +688R). Every universe coin is verified to have a tradeable MEXC futures contract (`script/check-mexc-symbols.ts`) so backtest = paper = live; TON and BONK passed the screen but were excluded for lacking one. The tighter pre-expansion config (28 coins, group cap 2: PF 2.01, +517R, maxDD 27.4%) is the documented fallback if live drawdown tolerance demands it. Retired: Confluence Swing (Jul 2026, fee fodder at PF 1.07), SMC and Bollinger MR (May 2026). Rationale lives in `server/strategies/registry.ts`.

> **Change policy**: strategy parameters and coin universes are FROZEN. Any change requires a pre-stated hypothesis, a full-pipeline A/B (`script/validate-pipeline.ts`, ALL + 2026 windows), and 90 days of frozen paper validation. Recent-window per-coin re-optimization is how this project previously destroyed its own edge.

---

## Risk Management

| Parameter | Value |
|-----------|-------|
| Risk per trade | 2% of balance, fixed fractional (Kelly retired Jul 2026 — doubled maxDD) |
| BTC macro multiplier | ×1.25 bull / ×0.75 bear (BTC daily trend) |
| Max open positions | 10 (fixed; capacity A/B Jul 2026: +55R and *lower* maxDD than 6; 12 tested worse) |
| Max hold time | 200h (1H strategies) / 240h (4H) → close at market (backtest parity + slot turnover) |
| Max per correlation group | 3 (raised from 2 with the 43-coin universe — cap 2 bottlenecked the expansion) |
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
The stop loss is always set by the strategy's technical logic — the position size adjusts to keep the dollar risk fixed.

**Removed by evidence (Jul 2026 pipeline A/B)** — see `STRATEGIES.md` → Engine Filters for the numbers: ATR-percentile filter, SHORT ≥72% confidence gate, daily contra-trend gate, BTC directional overlay, dynamic position cap, monthly −8R pause, fractional-Kelly sizing.

---

## Funding-Rate Carry (Phase 1 — paper observer)

Always-on scanner + simulated delta-neutral carry ledger (`server/funding-carry.ts`, `GET /api/funding-carry`). When perp funding on a hedgeable coin exceeds **30%/yr annualized**, the simulator "opens" a short-perp + long-spot position ($1000/leg, max 5) and accrues real funding every 8h settlement, net of realistic entry/exit costs (~0.44% round trip → breakeven ≈ 5.4 days of sustained elevated funding). Exits below 10%/yr (hysteresis). Restricted to the 41-coin hedgeable universe — extreme funding on tokenized stocks / 1000×-tickers / illiquid micro-caps is a liquidity trap, not carry. **No orders are ever placed**; if the simulated ledger proves out over weeks, Phase 2 wires execution as an uncorrelated return sleeve.

---

## Exit Management

1. Position opens with SL and TP1/TP2 from the strategy signal
2. Price hits **TP1** → close 60%, SL moves to break-even
3. Runner trails at **2× the trade's original risk** from the peak (`r_multiple` mode — default since the Jul 2026 portfolio exit A/B: beat the fixed-2% trail on every metric in both windows, PF 1.99 vs 1.90 · +715R vs +674R · maxDD 31.2% vs 35.8%; a fixed % is too tight for wide-ATR entries and too loose for tight ones). `fixed_pct` remains available via settings.
4. Position closes at **TP2**, the trailing stop, break-even, or the max-hold timeout

Exit-layer variants A/B-tested at portfolio level (Jul 2026): TP1 close 50%/75%/100% — the 60% partial held its ground (100% all-out was second-best); trail 1.5%/3% — both worse than 2R r_multiple.

---

## Validation Tooling

| Script | Purpose |
|--------|---------|
| `script/validate-pipeline.ts` | **The arbiter.** Chronological portfolio sim of the whole engine: all gates (each individually toggleable), sequential capital, exposure/caps/guards, fees+slippage. Writes `script/validate-pipeline-report.md`. |
| `script/validate-2026.ts` | Raw per-strategy edge (2 gates only) — upper-bound sanity check, not a system test. |
| `script/validate-universe.ts` | ⚠️ Frozen — selection-bias methodology (picks coins on the window it validates on). Reference only. |

---

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Portfolio summary, open positions, recent activity |
| Paper Trading | `/paper` | Paper engine controls, capital management, MEXC live config |
| Market | `/market` | Coin scanner with live prices |
| Analysis | `/market/:symbol` | Full technical analysis + per-strategy signals + backtest |
| Compare | `/compare` | Side-by-side strategy performance |
| Journal | `/journal` | Trade log with filtering, notes, outcome tracking |

---

## Running Locally

```bash
npm install
npm run dev       # starts server (port 5000) + client (Vite HMR)
```

Database is auto-created at `./data.db` on first run.

---

## Strategy Documentation

See [STRATEGIES.md](./STRATEGIES.md) for full documentation of each strategy's entry/exit logic, indicators, thresholds, and the engine filter table (active + removed-by-evidence).
