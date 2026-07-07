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

**Active set (frozen 2026-07-02)**: Liquidity Sweep (1H, 41 coins) · RSI Divergence (1H) · Break & Retest (4H).
Validated as a portfolio by `script/validate-pipeline.ts` (all engine gates, sequential capital, fees+slippage): **PF 1.99 · +715R · maxDD 31.2%** over the full window; PF 2.00 · +400R in 2026 (data through Jul 7; includes the r_multiple-trailing exit upgrade). Direction × regime matrix confirms symmetric edge: >half of total R comes from BTC-down periods (SHORT·down +284R · PF 1.94; LONG·down +99R · PF 2.02 — reversal buys at capitulation lows). The LS universe expansion (28→41, `script/expand-universe-ls.ts`) required each coin to be profitable in BOTH halves of the year independently, the portfolio to improve overall (+517R → +688R with group cap 3), and a tradeable MEXC futures contract (`script/check-mexc-symbols.ts` — TON/BONK passed the screen but failed this). The Jul 2026 capacity A/B also confirmed the LS 12h cooldown is optimal (8h/6h both reduced total R) — signal parameters stay frozen. Pre-expansion fallback (28 coins, cap 2): PF 2.01 · +517R · maxDD 27.4%. Confluence Swing and SMC are documented below for reference but are **not traded** — see `server/strategies/registry.ts` for the retirement rationale.

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
| **Preferred symbols** | 6 coins | 2 coins | 41 coins (frozen; two-halves screen + MEXC-verified) |

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

**Entry**: Candle wicks through a recent swing high/low but closes back inside the prior range, with confirmation from the following candle.  
**SL**: Just beyond the sweep wick's extreme.  
**TP1**: Nearest opposite-side structural level (≥ 2R minimum enforced internally).  
**TP2**: Opposing liquidity pool (previous low for a high-sweep, previous high for a low-sweep).  
**Cooldown**: 8h per symbol.  
**Min candles**: 100.

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
| Weekly trend (4H only) | 4H signal against weekly direction | Saved ~45R in 2026 — multi-day holds need weekly alignment |
| Funding rate | Funding > +0.1% for LONG, < −0.1% for SHORT | Avoid crowded side (live market state, unmodelable in backtest) |
| Min SL distance | SL closer than 0.6% | Fees would dominate the risk |
| R:R gate | reward / risk < 1.5 | Minimum acceptable trade |
| Volume | 24h volume < $30M USDT | Avoid illiquid markets |
| Spread | Bid/ask > 0.20% | Bad fills |
| Correlation | Group already has 3 open positions | Avoid overconcentration (raised 2→3 with the 43-coin universe; at 2 the expansion bottlenecked) |
| Daily drawdown | Today's P&L < −4R | Circuit breaker |
| Rolling 7d drawdown | 7-day P&L < −6R | Cuts genuine loss streaks (+18R in final config) |
| Per-strategy kill-switch | Strategy 7d netR < −3R over ≥4 trades | Pauses a strategy whose regime broke |
| Max positions | 10 open positions reached | Capacity A/B Jul 2026: 10 beat 6 on R *and* maxDD; 12 = saturation |
| Max hold | Age > 200h (1H) / 240h (4H) → close at market | Backtest parity; frees the symbol slot (a stale trade once blocked XRP 5 weeks) |

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
