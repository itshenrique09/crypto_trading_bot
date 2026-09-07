import type { Strategy, StrategySignal } from "./types";
import type { OHLCV } from "../analysis";
import { liquiditySweepStrategy } from "./liquidity-sweep";

// ═══ TSMOM DAILY — time-series momentum on closed daily candles ═════════════
// Spec fixed in the Aug-2026 audit (script/audit/AUDIT-NOTES.md, Fase 6 pre-
// registration) and re-evaluated honestly in Sep 2026 (Fase 9, phase9-tsmom.ts
// / phase9-portfolio.ts) once the Liquidity Sweep no longer occupied the slots
// it used to starve:
//   • LONG when the daily close breaks above the highest high of the prior 55
//     days; SHORT when it breaks below the lowest low. The lookback EXCLUDES the
//     signal day — no look-ahead: the decision uses only bars that have closed.
//   • Entry = that daily close. Stop = 2.0 × ATR(20d). TP1 = 1.75 × stop
//     distance (R:R 1.75 > engine gate 1.5), TP2 = 3.5 ×. Production exits
//     (TP1 60% → break-even → 2R trail). Confidence fixed 70. Cooldown 72h.
//   • Same 40-coin universe as the Liquidity Sweep — no new coin picking.
// Honest numbers, 1d × 1500 (2022-07 → 2026-09), engine gates, real fees:
//   standalone T=403 WR 44% PF 1.32 exp +0.18R CI95 [+0.05, +0.32] maxDD 30R,
//   halves +0.15/+0.24, 24/40 coins positive, avg hold 28d (median 10d);
//   in the phase-9 book with LS SHORT·BTC-up: T=351 exp +0.28R PF 1.46
//   CI95 [+0.11, +0.45] maxDD 24R (trio guards) / 16.9R (drawdown guard).
// Declared fragilities: same-timestamp tie-break sensitivity (all daily
// signals share a timestamp; maxOpen decides which are taken — median over
// 20 random orders +0.13R standalone, +0.24R in the book), funding drag on
// multi-week holds (≈ −0.05R/trade at −0.03%/day), 2026 YTD negative alone
// (−7.3R / 46). PAPER-FIRST: no live until the standing gate is met.
// ═════════════════════════════════════════════════════════════════════════

const DONCHIAN_N = 55;
const ATR_PERIOD = 20;
const STOP_ATR_K = 2.0;
const TP1_MULT = 1.75;
const TP2_MULT = 3.5;

/** Wilder ATR — same formula as server/analysis.ts calcATR (not exported there). */
function wilderAtr(candles: OHLCV[], period: number): number {
  if (candles.length < 2) return 0;
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    ));
  }
  if (tr.length < period) return tr.reduce((a, b) => a + b, 0) / tr.length;
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) atr = (atr * (period - 1) + tr[i]) / period;
  return atr;
}

export const tsmomStrategy: Strategy = {
  id: "tsmom-daily",
  name: "Trend Breakout 1D",
  description:
    "Time-series momentum: daily close breaks the 55-day Donchian channel (prior bars only) → trade the breakout. " +
    "Stop 2×ATR(20d), TP 1.75×/3.5× the stop distance, production exits. Multi-week holds; no LS look-ahead heritage.",
  interval: "1d",
  minCandles: Math.max(DONCHIAN_N + 25, 80),
  preferredSymbols: [...(liquiditySweepStrategy.preferredSymbols ?? [])],
  cooldownHours: 72,
  defaultPaused: { paper: false, live: true },

  analyze(candles: OHLCV[]): StrategySignal | null {
    const n = candles.length;
    if (n < DONCHIAN_N + ATR_PERIOD + 2) return null;
    const last = candles[n - 1];
    const lookback = candles.slice(n - 1 - DONCHIAN_N, n - 1); // prior N days, excludes the signal day
    let hi = -Infinity, lo = Infinity;
    for (const c of lookback) { if (c.high > hi) hi = c.high; if (c.low < lo) lo = c.low; }
    const direction: "LONG" | "SHORT" | null = last.close > hi ? "LONG" : last.close < lo ? "SHORT" : null;
    if (!direction) return null;
    const atr = wilderAtr(candles.slice(-(ATR_PERIOD * 2 + 2)), ATR_PERIOD);
    if (!(atr > 0)) return null;
    const entry = last.close;
    const stopDist = STOP_ATR_K * atr;
    const stopLoss = direction === "LONG" ? entry - stopDist : entry + stopDist;
    const takeProfit1 = direction === "LONG" ? entry + TP1_MULT * stopDist : entry - TP1_MULT * stopDist;
    const takeProfit2 = direction === "LONG" ? entry + TP2_MULT * stopDist : entry - TP2_MULT * stopDist;
    // A SHORT on a coin whose 2×ATR exceeds ~28.6% of price puts the 3.5× target
    // at or below zero (92 of 1180 real shorts in the audit scan). A price can't
    // fall past zero: no valid runner target → no valid trade. Nothing downstream
    // sanitised it — the journal stored a negative TP2 and Kraken rejected the leg.
    if (stopLoss <= 0 || takeProfit1 <= 0 || takeProfit2 <= 0) return null;
    return {
      direction, entry, stopLoss, takeProfit1, takeProfit2,
      confidence: 70, confluenceScore: 70,
      reason: `[TSMOM ${direction}] close ${entry} ${direction === "LONG" ? ">" : "<"} Donchian${DONCHIAN_N} ${direction === "LONG" ? "high" : "low"} ${(direction === "LONG" ? hi : lo).toPrecision(6)} | stop ${STOP_ATR_K}×ATR${ATR_PERIOD} (${(stopDist / entry * 100).toFixed(2)}%) | conf 70%`,
    };
  },
};
