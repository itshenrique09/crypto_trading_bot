# Strategy Documentation

Full technical reference for all trading strategies implemented in the bot.

---

## Table of Contents

- [Overview](#overview)
- [Strategy 1 — Confluence Swing](#1-confluence-swing) *(retired Jul 2026)*
- [Strategy 2 — SMC (Smart Money Concepts)](#2-smc-smart-money-concepts) *(retired May 2026)*
- [Strategy 3 — Break & Retest](#3-break--retest)
- [Strategy 4 — RSI Divergence](#4-rsi-divergence)
- [Strategy 5 — Liquidity Sweep](#5-liquidity-sweep)
- [Common Components](#common-components)
- [Engine Filters](#engine-filters)

---

## Overview

**Active set (redesigned 2026-09-03, PAPER ONLY)**: Liquidity Sweep (1H, 40 coins, **SHORT only while BTC daily trend is UP**) · Trend Breakout 1D / TSMOM (1D, 40 coins). RSI Divergence and Break & Retest were **retired** the same day (selection-bias rule, section 6). Both active strategies start paused on live; see README "Status 2026-09-03".

> **2026-09-01 — every number below this line that predates Sep 2026 was measured with a look-ahead entry.** `liquiditySweepSignal` returned the sweep candle's close as `entry`; with the confirmation-bar rule (Apr 2026) 93% of signals are decided 1–2 bars later, when price had already moved a median 57 bps (mean 79, p90 190) in the trade's favour on a ~145 bps stop. Harness, paper engine and R math all booked that phantom fill. Honest re-measurement (entry = signal candle's close, `script/validate-pipeline.ts` 2026-09-01, 8000×1h): **ENGINE PF 1.08 · +45R · exp +0.06R**; **Liquidity Sweep PF 0.96 · exp −0.03R** (was PF 1.85 / +0.54R); Break & Retest PF 1.74 · exp +0.45R (T=92); RSI Divergence PF 1.79 · exp +0.48R (T=46). Over 2.3 years (20000×1h) the honest system is exp +0.04R with a 161R drawdown. Honest variants of LS tested in `script/audit/phase8-collapse.ts` — floors 60–80, EQ-pool only, wick/vol gates, same-bar sweeps only, entering at the sweep bar without confirmation, a resting limit at the sweep close — none has edge; only "block LONG when BTC daily is up" improves the portfolio (PF 1.20, exp +0.15R) and it remains a hypothesis for paper. The Apr 2026 "+18.4% netR" credited to the confirmation-bar rule was the look-ahead itself: waiting for confirmation while keeping the pre-confirmation price is free favourable drift.

Historical (stale-entry) validation record, kept for provenance: PF 1.99 · +715R · maxDD 31.2% over the full window; PF 2.00 · +400R in 2026 (data through Jul 7). The LS universe expansion (28→41, `script/expand-universe-ls.ts`) required each coin to be profitable in BOTH halves of the year, the portfolio to improve overall (+517R → +688R with group cap 3), and a tradeable MEXC futures contract (`script/check-mexc-symbols.ts` — TON/BONK failed this; LUNC dropped Aug 2026, Kraken does not list it). The Jul 2026 capacity A/B kept the LS 12h cooldown. Confluence Swing and SMC are documented below for reference but are **not traded** — see `server/strategies/registry.ts` for the retirement rationale.

| | Break & Retest | RSI Divergence | Liquidity Sweep |
|---|---|---|---|
| **ID** | `break-retest` | `rsi-divergence` | `liquidity-sweep` |
| **File** | `break-retest.ts` | `rsi-divergence.ts` | `liquidity-sweep.ts` |
| **Timeframe** | 4H | 1H | 1H |
| **Min candles** | 150 | 250 | 220 |
| **Cooldown** | 12h | 20h | 12h |
| **Signal type** | Confidence % | Binary + confidence | Confidence % |
| **SL basis** | Behind S/R level | 0.5% beyond swing | Above/below sweep wick |
| **TP1 basis** | Next S/R level | 2.5R | ≥2R structural |
| **TP2 basis** | Next S/R level | 4R | Opposite liquidity pool |
| **EMA200 guard** | Yes (macro bull for LONG) | Yes (price vs EMA200) | No (mean-reverts after sweep) |
| **Preferred symbols** | 6 coins | 2 coins | 40 coins (frozen; two-halves screen + MEXC-verified; LUNC dropped Aug 2026) |

> **Source of truth**: `server/strategies/registry.ts` is the canonical list of enabled strategies. If the table above and the registry disagree, the registry wins — fix the doc.

---

## 1. Confluence Swing

> **RETIRED — July 2026.** The full-pipeline portfolio harness showed PF 1.05–1.07 / exp +0.04R over the full window in every configuration — fees ate the edge. It also shared 9 coins with Liquidity Sweep on the same 1H interval and displaced higher-expectancy LS entries via the one-position-per-symbol guard. Its apparent 2026 strength was selection bias (its coin list was re-picked on 2026 data on Jun 26). Documentation kept for reference.

**File**: `server/strategies/v2-swing.ts` (strategy id: `confluence-swing`)  
**Timeframe**: 1H (uses EMA9, EMA21, EMA50, EMA200)  
**Philosophy**: Wait for multiple independent indicators to agree before entering. The more indicators align, the stronger the signal. Never trade on one indicator alone.

### Preferred Symbols

Only trades on coins where backtests show a profit factor > 1.5:

| Symbol | Profit Factor | Sharpe |
|--------|--------------|--------|
| ICP | 2.12 | 2.17 |
| MATIC | 2.08 | 1.95 |
| BNB | 1.68 | 1.51 |
| NEAR | 1.67 | 1.45 |
| AVAX | 1.65 | 1.53 |
| SOL | 1.59 | 1.39 |
| DOT | 1.57 | 1.33 |
| VET | 1.56 | 1.42 |
| XRP | 1.51 | 1.07 |
| BTC | 1.50 | 1.18 |

### Confluence Score

Each signal generates a **confluenceScore** from -10 to +10 by summing contributions from 11 indicator categories. Score ≥ +6 triggers a LONG; score ≤ -6 triggers a SHORT.

#### Score Components

**1. EMA Trend Alignment** (max ±1.5 pts)

| Condition | Points |
|-----------|--------|
| 9 > 21 > 50 > 200 (perfect uptrend) | +1.5 |
| 9 > 21 > 50 (short-term bullish) | +1.0 |
| 9 < 21 < 50 < 200 (perfect downtrend) | -1.5 |
| 9 < 21 < 50 (short-term bearish) | -1.0 |

**2. Ichimoku Cloud** (max ±1.5 pts)

| Condition | Points |
|-----------|--------|
| Price above green (bullish) cloud | +1.5 |
| Price above any cloud | +0.75 |
| Price below red (bearish) cloud | -1.5 |
| Price below any cloud | -0.75 |
| Price inside cloud (indecision) | 0 |

**3. RSI(14)** (max ±1.5 pts)

| RSI value | Points |
|-----------|--------|
| < 25 (deeply oversold) | +1.5 |
| 25–35 (oversold) | +0.5 |
| > 75 (deeply overbought) | -1.5 |
| 65–75 (overbought) | -0.5 |

**4. Stochastic RSI** (max ±0.5 pts)

| Condition | Points |
|-----------|--------|
| K < 20 AND K > D (bullish crossover, oversold) | +0.5 |
| K > 80 AND K < D (bearish crossover, overbought) | -0.5 |

**5. MACD Momentum** (max ±1.5 pts)

| Condition | Points |
|-----------|--------|
| Line > Signal, histogram > 0, strong (|hist| > |line| × 0.1) | +1.5 |
| Line > Signal, histogram > 0, weak | +0.5 |
| Line < Signal, histogram < 0, strong | -1.5 |
| Line < Signal, histogram < 0, weak | -0.5 |

**6. MACD Divergence** (±0.5 pts)

| Condition | Points |
|-----------|--------|
| Bullish divergence (price lower lows, MACD higher lows) | +0.5 |
| Bearish divergence (price higher highs, MACD lower highs) | -0.5 |

**7. Bollinger Bands %B** (max ±1.0 pts)

| Condition | Points |
|-----------|--------|
| %B < 0 (price below lower band — oversold) | +1.0 |
| %B > 1 (price above upper band — overbought) | -1.0 |

**8. Volume & OBV** (max ±1.0 pts)

| Condition | Points |
|-----------|--------|
| Volume spike (> 2× avg) + OBV rising | +1.0 |
| Volume spike + OBV falling (distribution) | -1.0 |
| OBV rising alone | +0.5 |
| OBV falling alone | -0.5 |

**9. Order Blocks** (max ±1.0 pts)

| Condition | Points |
|-----------|--------|
| Price retesting bullish OB | +1.0 |
| Price retesting bearish OB | -1.0 |

**10. Fair Value Gaps** (max ±0.5 pts)

| Condition | Points |
|-----------|--------|
| Price filling bullish FVG | +0.5 |
| Price filling bearish FVG | -0.5 |

**11. Fibonacci Levels** (max ±0.5 pts)

| Condition | Points |
|-----------|--------|
| Price at 61.8% retracement in uptrend | +0.5 |
| Price at 61.8% retracement in downtrend | -0.5 |

### Signal Thresholds

| Score | Signal | Action |
|-------|--------|--------|
| ≥ +6 | STRONG_BUY | Open LONG |
| +4 to +5 | BUY | Open LONG (lower size) |
| ≤ -6 | STRONG_SELL | Open SHORT |
| -5 to -4 | SELL | Open SHORT (lower size) |
| -3 to +3 | HOLD | No trade |

### Macro Trend Guard

Before opening, confirms EMA alignment at the macro level:
- **LONG**: EMA50 must be > EMA200 × 1.01 (decisively above, not just crossing)
- **SHORT**: EMA50 must be < EMA200 × 0.99

This prevents trading at whipsaw zones where EMAs are crossing.

### Exits

- **SL**: ATR-based
  - Strong signal (|score| ≥ 6): 1.5× ATR
  - Moderate signal: 2× ATR
- **TP1**: Nearest confirmed swing high/low beyond entry (min 1.5R from SL), fallback to 2.0R
- **TP2**: Second structural level, fallback to 4R

### Position Sizing

| Signal Strength | Risk % |
|-----------------|--------|
| |score| ≥ 6 (strong) | 1.5% of balance |
| |score| ≥ 4 (moderate) | 1.0% of balance |
| Weak | 0.5% of balance |

Volatility adjustments:
- ATR% > 3%: reduce by 25%
- ATR% > 6%: reduce by 50%

### Confidence Formula

```
confidence = min(95, max(10, |score| × 9 + 10))
```

Score ±6 → 64% | Score ±10 → 100% (capped at 95%)

---

## 2. SMC (Smart Money Concepts)

**File**: `server/strategies/smc.ts`  
**Timeframe**: 4H  
**Philosophy**: Trade with institutional money, not against it. Wait for smart money to leave evidence (Order Blocks, Break of Structure), then enter on the retest. The market respects prior institutional interest zones.

### Preferred Symbols

| Symbol | Profit Factor | Trades | Win Rate |
|--------|--------------|--------|---------|
| LINK | 1.92 | 27 | 44% |
| DOGE | 1.80 | 23 | 48% |
| DOT | 1.50 | 12 | 33% |

### Entry Logic (all conditions must be met)

**Step 1 — Market Structure**

Scans the last 120 bars for swing highs/lows (2-bar confirmation each side):
- **Bullish bias**: Last two swings form HH (Higher High) OR HL (Higher Low)
- **Bearish bias**: Last two swings form LH (Lower High) OR LL (Lower Low)
- Rejected if structure is mixed (choppy market) or flat

**Step 2 — Trend Alignment**

| For LONG | For SHORT |
|----------|-----------|
| EMA21 > EMA50 (micro uptrend) | EMA21 < EMA50 (micro downtrend) |
| EMA50 > EMA200 (macro bull) | — (corrections allowed in bull markets) |

**Step 3 — RSI Context Filter**

| Direction | RSI Condition | Reason |
|-----------|---------------|--------|
| LONG | RSI ≤ 72 | Block buying into overbought |
| SHORT | RSI ≥ 28 | Block shorting into oversold |

**Step 4 — Break of Structure (BOS)**

Scans the full 150-bar window:
- **Bullish BOS**: Candle closes above a prior confirmed swing high
- **Bearish BOS**: Candle closes below a prior confirmed swing low

Confirms that institutional money has broken the structure and may return to fill the origin zone.

**Step 5 — Order Block Retest**

Finds the most recent valid Order Block in the direction of the BOS:
- **Bullish OB**: Last bearish candle before a bullish surge (institutional buying zone)
- **Bearish OB**: Last bullish candle before a bearish surge (institutional selling zone)

Price must be within ATR × 0.3 of the OB zone.

**Step 6 — Rejection Candle**

Confirms that price is rejecting the OB, not just passing through it:

| Bullish rejection (LONG) | Bearish rejection (SHORT) |
|--------------------------|---------------------------|
| Low ≤ OB high | High ≥ OB low |
| Close > OB midpoint | Close < OB midpoint |
| Close > Open (bullish body) | Close < Open (bearish body) |

Alternative: prior bar rejected AND current close confirms continuation.

**Minimum quality gate**: R:R ≥ 1.8 required.

### Exits

- **SL**: Behind the Order Block with buffer
  - LONG: OB low − ATR × 0.3
  - SHORT: OB high + ATR × 0.3
- **TP1**: Nearest swing high/low beyond entry (structural target)
- **TP2**: Next structural level or 4R fallback

### Confidence Score

| Factor | Points |
|--------|--------|
| Base | 50 |
| OB strength > 60 | +10 |
| Has rejection candle | +10 |
| R:R ≥ 2.5 | +10 |
| Structure confirmed | +5 |
| Volume spike > 1.3× avg | +5 |
| Macro bull (for LONG) | +5 |
| Maximum | 90 |

---

## 3. Break & Retest

> **RETIRED — 2026-09-03 (phase 9, selection-bias rule).** On its 6 hand-picked coins the honest harness gives +0.37R (T=98, 27 trades/yr, top-5 trades = 52% of the profit); on the full 40-coin universe with identical parameters it is −0.02R (PF 0.98, 430 trades, years alternating sign) and −0.12R on the 34 non-preferred coins. The 6-coin result is a top-6-of-40 pick of a zero-mean strategy. File kept for research (`server/strategies/break-retest.ts`).

**File**: `server/strategies/break-retest.ts`  
**Timeframe**: 4H  
**Philosophy**: Institutional money is responsible for the initial break. After the break, price often returns to the breakout level where weak hands get stopped out and strong hands add. Enter the retest with price showing rejection, riding the continuation.

### Preferred Symbols

| Symbol | Profit Factor | Trades |
|--------|--------------|--------|
| SOL | 4.45 | 18 |
| SAND | 2.39 | 24 |
| AVAX | 1.99 | 19 |

### Entry Logic (all conditions must be met in sequence)

**Step 1 — Trend Filters**

| For LONG | For SHORT |
|----------|-----------|
| EMA21 > EMA50 | EMA21 < EMA50 |
| EMA50 > EMA200 | — (corrections in bull market allowed) |
| EMA50 slope < 7% (last 10 bars) | same |

**Step 2 — Level Detection**

Scans the last 120 bars for swing highs/lows:
- Clusters levels within 0.6% of each other
- **Requires 3+ touches** per level (institutional significance)
- Uses the 6 nearest levels (within 6% of current price)

**Step 3 — Break Validation** (within last 25 candles)

A valid break requires all three:
1. Close decisively beyond the level (> 0.5× ATR)
2. Candle body > 55% of total range (conviction, not just wick)
3. Volume > 1.5× 20-bar average (institutional participation)

**Step 4 — Break Hold**

After the break, price must stay on the broken side for ≥ 3 consecutive candles. This confirms the break is real, not a false breakout.

**Step 5 — Retest Window**

Retest must happen 3–18 candles after the break. Too soon = price hasn't had time to confirm; too late = setup is stale.

Price (current + prior candle) must touch the level within ATR × 0.5 tolerance.

**Step 6 — Volume Exhaustion**

Retest volume should be lower than break volume. Lower volume means fewer sellers/buyers are present — accumulation/capitulation in progress.

**Step 7 — Rejection Candle**

| Pattern | Bullish (break UP) | Bearish (break DOWN) |
|---------|-------------------|---------------------|
| Pin bar | Lower wick ≥ 40% of range, close > midpoint | Upper wick ≥ 40% of range, close < midpoint |
| Engulfing | Prior bearish + current close > prior open | Prior bullish + current close < prior open |
| Simple | Close > level AND close > open | Close < level AND close < open |

**Step 8 — RSI Guard**

| Direction | RSI Range | Reason |
|-----------|-----------|--------|
| LONG | 45–70 | Below 45 = bearish momentum; above 70 = overbought |
| SHORT | 30–60 | Below 30 = oversold (capitulation); above 60 = bullish momentum |

**Step 9 — Volatility Gate**

ATR% > 5.5% → skip (unpredictable price action, SL gets blown frequently).

**Minimum R:R**: 2.0:1 required.

### Exits

- **SL**:
  - LONG: level − ATR × 1.0
  - SHORT: level + ATR × 1.0
- **TP1**: Next major S/R level with ≥ 2 touches, or 2.5R fallback
- **TP2**: Level beyond TP1, or 4R fallback

### Confidence Score

| Factor | Points |
|--------|--------|
| Base | 45 |
| Level has 3+ touches | +10 |
| Pin bar rejection | +15 |
| Engulfing rejection | +12 |
| Simple close rejection | +5 |
| Volume exhaustion at retest | +8 |
| Break volume ≥ 2.0× avg | +7 |
| R:R ≥ 3.0 | +5 |
| Maximum | 90 |

---

## 4. RSI Divergence

> **RETIRED — 2026-09-03 (phase 9, selection-bias rule).** On ATOM/INJ over 2.25 years the honest harness gives +0.03R (the +0.48R quoted in Aug 2026 was the last 11 months only, and 2025 was −0.13R); on the full 40-coin universe −0.13R with a CI95 entirely below zero (T=1207, 11/40 coins positive) and negative under +15 bps slippage on every list. File kept for research (`server/strategies/rsi-divergence.ts`).

**File**: `server/strategies/rsi-divergence.ts`  
**Timeframe**: 1H  
**Philosophy**: When price makes a new extreme but RSI does not confirm it, momentum is weakening. This hidden divergence between price and oscillator precedes reversals. Only trade divergence in the direction of the macro trend (EMA200).

### Preferred Symbols

| Symbol | Profit Factor | Trades | Win Rate | Notes |
|--------|--------------|--------|---------|-------|
| FIL | 1.72 | 122 | 38% | All years positive except 2022 (-1%) |
| SAND | 1.70 | 135 | 40% | Every year positive since inception |

### Entry Logic

**Bullish Divergence (LONG)** — requires price > EMA200

| Condition | Detail |
|-----------|--------|
| Price makes lower low | Current swing low < prior swing low |
| RSI makes higher low | RSI at current low > RSI at prior low |
| RSI oversold | Current RSI < 40 |
| Price margin | Current low is ≥ 0.2% lower than prior |
| RSI margin | RSI is ≥ 2 points higher than prior reading |

**Bearish Divergence (SHORT)** — requires price < EMA200

| Condition | Detail |
|-----------|--------|
| Price makes higher high | Current swing high > prior swing high |
| RSI makes lower high | RSI at current high < RSI at prior high |
| RSI overbought | Current RSI > 60 |
| Price margin | Current high is ≥ 0.2% higher than prior |
| RSI margin | RSI is ≥ 2 points lower than prior reading |

**Scan parameters**:
- Swing definition: 5-bar lookback each side
- Divergence scan range: last 30 bars
- Requires at least one prior swing for comparison

### Exits

- **SL**:
  - LONG: swing low × 0.995 (0.5% below the divergence point)
  - SHORT: swing high × 1.005 (0.5% above)
- **TP1**: 2.5× risk
- **TP2**: 4× risk
- **Max risk gate**: If SL distance / entry price > 5%, skip trade (too wide)

### Confidence

| RSI Zone | Confidence |
|----------|-----------|
| RSI < 30 (LONG) or RSI > 70 (SHORT) — deep extreme | 80% |
| RSI < 40 (LONG) or RSI > 60 (SHORT) — standard | 72% |

---

## 5. Liquidity Sweep

**File**: `server/strategies/liquidity-sweep.ts` (strategy id: `liquidity-sweep`)  
**Timeframe**: 1H  
**Philosophy**: Price hunts resting liquidity above prior swing highs (or below lows), then reverses. The sweep wick + immediate reclaim is the entry trigger — institutional stop-runs that fade quickly.

**Entry**: Candle wicks through a recent swing high/low but closes back inside the prior range, with confirmation from the following candle(s). **The entry price is the close of the SIGNAL candle** (the last closed candle when the scan runs) — since 2026-09-01; before that it was the sweep candle's close, 1–2 bars stale, which is the look-ahead described in the Overview. The reason string tags the offset (`sweep bar -0/-1/-2`).  
**SL**: Structural level = the sweep wick's extreme + 0.5 ATR, then pulled 20% toward entry. **Known geometry fact (audit 2026-09-07):** the 20% pull was validated in May 2026 with the stale sweep-close entry; with the honest entry it lands the stop *inside* the swept wick for ~31% of signals (bar-1/bar-2 sweeps). The pre-stated hypothesis that this costs money was **not supported** by the official harness A/B (2.3y, engine scan order): tighten sumR +74.5 / exp +0.13R · clamp-beyond-wick +66.7 / +0.12R · no tightening +61.2 / +0.11R, identical maxDD — within noise, and the shipped arm is not the worse one, so it stays. The arms remain runnable with `LS_STOP_MODE=tighten|clamp|raw` (harness + tests); see `AUDIT-NOTES.md` Fase 9c.  
**TP1**: Nearest opposite-side structural level (≥ 2R from the real entry, enforced internally).  
**TP2**: Opposing liquidity pool (previous low for a high-sweep, previous high for a low-sweep).  
**Confidence floor**: 68 (60 between 2026-08-14 and 2026-09-01; the 60–67 band went 5 wins in 32 real trades).  
**Regime gate (2026-09-03)**: `regimeGate: { long: [], short: ["up"] }` — LONG is never traded; SHORT only while the BTC daily trend (EMA50 ±1% on closed daily candles) is UP. Honest 2.3-year book without the gate: exp −0.09R, PF 0.89 (LONG·BTC-up is the worst cell at −0.57R). With the gate: T=559, exp +0.26R, PF 1.37, 29/40 coins positive — **but** the pattern was formed on the last 11 months; on the prior 17 months alone it is +0.09R with one negative half, so it is a forward paper hypothesis, not a validated edge (`script/audit/phase9-report-regime.md` and the review verdicts in `AUDIT-NOTES.md`).  
**Cooldown**: 12h per symbol.  
**Min candles**: 220.

---

## 6. Trend Breakout 1D (TSMOM)

**File**: `server/strategies/tsmom.ts` (strategy id: `tsmom-daily`)  
**Timeframe**: 1D (closed daily candles)  
**Philosophy**: time-series momentum — a close beyond the prior 55-day Donchian channel tends to continue for weeks. Specified in the Aug-2026 audit (Fase 6) before any run and never tuned; re-evaluated in phase 9 once the Liquidity Sweep stopped occupying every slot.

**Entry**: daily close above the highest high of the PRIOR 55 days → LONG; below the lowest low → SHORT (the lookback excludes the signal day — no look-ahead). Entry price = that close.  
**SL**: 2.0 × ATR(20d). **TP1**: 1.75 × stop distance. **TP2**: 3.5 × stop distance. Production exits (TP1 60% → break-even → 2R trail). A SHORT whose 3.5× target would be ≤ 0 (2×ATR above ~28.6% of price — 92 of 1180 real shorts in the audit scan) returns no signal (2026-09-07; before that the negative TP2 reached the journal and Kraken rejected the leg).  
**Confidence**: fixed 70. **Cooldown**: 72h. **Max hold**: 200 days. **Universe**: the same 40 coins as LS (no new coin picking).  
**Honest numbers** (1d × 1500 ≈ 4 years, engine gates, real fees): standalone T=403, exp +0.18R, PF 1.32, 24/40 coins positive, avg hold 28 days — **with the engine's actual scan order as tie-break exp +0.07R, PF 1.12** (all daily signals share one timestamp; with maxOpen binding, the order decides which are taken; the edge lives in holds longer than 10 bars). Funding drag on multi-week holds ≈ −0.05R/trade. Verdict of record after adversarial review: REJECT standalone, PAPER-CANDIDATE only inside the book with the gated LS.

See `server/strategies/liquidity-sweep.ts` for the exact thresholds and reclaim logic.

---

## Common Components

### analyzeIndicators()

Computes the full technical picture used by Confluence Swing. Returns:

| Indicator | Parameters | Output |
|-----------|-----------|--------|
| EMA | 9, 21, 50, 200 | Values + reliability flag |
| RSI | 14 | Value + oversold/overbought |
| Stochastic RSI | 14, 3, 3 | K-line, D-line |
| MACD | 12, 26, 9 | Line, signal, histogram + divergence |
| Ichimoku | 9, 26, 52 | Tenkan, Kijun, Senkou A/B, cloud color, TK cross |
| Bollinger Bands | 20, 2σ | Upper, mid, lower, width, %B |
| ATR | 14 | Absolute value + ATR% |
| OBV | — | Value + trend (rising/falling/flat) |
| Volume Ratio | 20-bar avg | Current vs average |
| Order Blocks | 120-bar | Type, high, low, strength |
| Fair Value Gaps | — | Type, high, low, filled flag |
| Swing Points | — | Recent highs and lows |
| Support / Resistance | — | Active S/R levels |
| Fibonacci | — | 23.6%, 38.2%, 61.8% levels + direction |

### findTechnicalTPs()

Used by Confluence Swing and SMC to locate TP levels. Scans the last ~100 bars for confirmed swing points (2-bar each side), returns the nearest and second-nearest structural levels beyond the entry.

### findOrderBlocks()

Scans a configurable lookback window for Order Blocks. A bullish OB is the last bearish candle before a significant bullish impulse (and vice versa). OB strength is scored by the impulse magnitude and volume.

---

## Engine Filters

These filters run in the paper and live engines **after** a strategy returns a signal. A signal that passes all strategy-internal checks can still be rejected here.

**Active filters (post Jul 2026 pipeline A/B):**

| Filter | Condition | Reason |
|--------|-----------|--------|
| Symbol exposure | Any position already open on the symbol | One position per symbol, no averaging in |
| Cooldown | Closed < cooldownHours ago | Avoid re-entering same zone |
| Preferred symbols | Signal not in strategy's symbol list | Only trade proven edge |
| Weekly trend (4H only) | 4H signal against weekly direction | Multi-day holds need weekly alignment (honest value +8R over 2.3y — the "+45R" once quoted was a stale-entry number); no 4H strategy is active today |
| Regime gate (2026-09-03) | Strategy's `regimeGate` excludes the direction for the current BTC daily trend | LS: LONG never, SHORT only in BTC-up; declared on the strategy, applied identically by both engines and the harness |
| Signal freshness (2026-09-01) | Candle closed > 10 min ago | A sweep reversal is a moment; restarts/un-halts no longer enter stale setups |
| Funding rate | Funding > +0.1% for LONG, < −0.1% for SHORT | Avoid crowded side (live market state, unmodelable in backtest) |
| Min SL distance | SL closer than 0.6% | Fees would dominate the risk |
| R:R gate | reward / risk < 1.5 | Minimum acceptable trade — re-checked on the real fill (paper: MEXC ticker; live: Kraken fill) |
| Spread | Bid/ask > 0.20% on the executing venue (Kraken for live, MEXC for paper) | Bad fills. The $30M volume gate was removed 2026-09-03: it never fired |
| Correlation | Group already has 3 open positions | Avoid overconcentration (neutral in the honest harness; kept) |
| Drawdown guard (2026-09-03) | Realized equity in trade-R ≥ 12R below its 30-day peak → halt; resume ≤ 6R; halt ≤ 24h then the peak is re-based | ONE circuit breaker replacing daily −4R / rolling-7d −6R / kill-switch, which measured the same losses three times and kept both engines halted ~10 of 18 days in Aug 2026 |
| Max positions | 10 open positions reached | Capacity A/B Jul 2026: 10 beat 6 on R *and* maxDD; 12 = saturation (stale-entry numbers; kept) |
| Max hold | Age > 200h (1H) / 240h (4H) / 200 days (1D) → close at market | Backtest parity; frees the symbol slot |
| Lot feasibility (live, 2026-09-03) | Entry lot, TP1 lot or runner lot rounds to zero, or entry under-sized > 25% at the venue's precision | A position that cannot be split at TP1 or protected is not opened |
| TP2 contract (2026-09-07) | TP2 missing, ≤ 0, or closer than TP1 → collapses to single-target (TP2 = TP1) | One boundary for every strategy, applied by both scans after the gates above |

**Exit plan — the same in paper, live and the harness (2026-09-07 audit):** TP1 closes 60% at the level (live: a software market partial, booked at the real fill), the stop moves to break-even (the *fill*, so a drifted entry is protected at what was paid), the runner trails at peak ∓ 2R **only once that trail is beyond break-even**, and TP2 closes the rest. A **single-target trade (TP2 == TP1, 67% of LS signals) has no venue take-profit**: its runner is trailed in software exactly like paper — before the audit the venue was handed TP1 for the full size and closed 100% there while paper booked 60% + a runner. Live safety nets around that plan: venue stop (mark-triggered) + venue TP2 when distinct; a self-heal every 10 min that re-places a missing stop **at break-even after TP1** (and a missing TP2); a software stop (10 bps tolerance, never looser than entry after TP1) and a software TP2 for when the venue orders are missing; protective orders are cancelled after every engine-initiated close. A live fill that crosses the stop/TP1, leaves R:R < 1.5 or a stop < 0.6% is undone at market; if the undo itself fails 3×, the row is kept OPEN under management (never booked as a phantom round trip).

**Removed Jul 2026** — each was A/B-tested in `script/validate-pipeline.ts` (full portfolio, ALL + 2026 windows) and cost money in both:

| Removed filter | Cost of keeping it | Note |
|--------|-----------|------|
| ATR percentile > 85 skip | −68R | Worst offender: stop-hunt entries *need* vol spikes |
| SHORT ≥ 72% confidence | −26R | Edge is short-heavy (L/S ≈ 1:2); asymmetric penalty |
| Daily contra-trend gate | −17R | Weekly filter covers trend alignment where it matters |
| BTC directional overlay | −27R | Blocked profitable reversals in high-conviction regimes |
| Dynamic BTC position cap (2–6) | mixed | Fixed 6 performed better in the pruned stack |
| Monthly −8R drawdown pause | −36R | Fired on normal variance, froze the rest of the month |
| Fractional Kelly sizing | 2× maxDD | 10-trade samples are noise; fixed 2% risk won risk-adjusted |
