// ─── REGIME DETECTOR ─────────────────────────────────────────────────────
// Classifies a candle stream into one of three market regimes and decides
// which strategies are appropriate for that regime.
//
// Why this exists:
//   The strategy suite contains breakout (B&R), momentum (Confluence Swing),
//   structure-based (SMC), stop-hunt (Liquidity Sweep) and mean-reversion
//   (RSI Divergence, Bollinger MR) approaches. Each has a regime where it
//   works and a regime where it bleeds. Without an explicit regime gate the
//   scanner fires every strategy in every condition; in lateral / dead-chop
//   markets that means breakouts fail, momentum churns, and the bot pays
//   fees and slippage with no edge. The kill-switch at -3R/7d catches the
//   bleeding *after* it happens; this module aims to prevent it.
//
// Regimes:
//   • dead_chop     — ADX < 18: no directional conviction, range-bound noise
//   • strong_trend  — ADX > 30: directional flow, mean-reversion gets run over
//   • normal        — 18 ≤ ADX ≤ 30: standard market, all setups viable
//
// Strategy → regime allow-list reflects the design of each strategy:
//   • RSI Divergence and Bollinger MR are mean-reversion → allowed in
//     dead_chop & normal, blocked in strong_trend (you don't fade a freight train)
//   • Confluence Swing & Break & Retest are momentum/breakout setups →
//     blocked in dead_chop, allowed in normal & strong_trend
//   • SMC and Liquidity Sweep are structure-based and have shown edge in
//     all regimes — kept on by default. Tighten only if data shows otherwise.
//
// Macro short filter:
//   Confluence Swing already requires symmetric macro (EMA50/200) for both
//   directions. SMC, B&R and Liquidity Sweep historically fired SHORTs on
//   micro-trend only — fine in mixed markets, painful in confirmed bulls.
//   This module exposes `shouldRequireMacroDownForShort()` so the scanner
//   can enforce a symmetric macro filter when the feature flag is on.
//
// Both regime gating and the short macro filter are off by default; the
// scanner reads `regime_filter_enabled` and `short_macro_filter_enabled`
// settings to opt in — paper trade for ≥2 weeks before promoting to live.

import type { OHLCV } from "./analysis";

export type Regime = "dead_chop" | "strong_trend" | "normal";

export interface RegimeContext {
  regime: Regime;
  adx: number;        // 0-100 — 14-period ADX (Wilder)
  atrPct: number;     // ATR(14) as % of last close
  macroDown: boolean; // EMA50 < EMA200 * 0.99 (decisive bear macro structure)
  reason: string;     // human-readable explanation for logScan
}

// Thresholds — exported for tests and potential future tuning via settings
export const REGIME_THRESHOLDS = {
  ADX_DEAD_CHOP: 18,
  ADX_STRONG_TREND: 30,
} as const;

// ─── Wilder's ATR (smoothed) ─────────────────────────────────────────────
function calcATRInline(candles: OHLCV[], period = 14): number {
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

// ─── Wilder's ADX (DI+, DI-, DX, ADX) ────────────────────────────────────
function calcADXInline(candles: OHLCV[], period = 14): number {
  if (candles.length < period * 2 + 1) return 0;
  const trArr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low;
    const ph = candles[i - 1].high, pl = candles[i - 1].low, pc = candles[i - 1].close;
    trArr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = h - ph, down = pl - l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }

  let sTR  = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let sPDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sMDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dx: number[] = [];
  for (let i = period; i < trArr.length; i++) {
    sTR  = sTR  - sTR  / period + trArr[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];
    const pdi = sTR > 0 ? 100 * sPDM / sTR : 0;
    const mdi = sTR > 0 ? 100 * sMDM / sTR : 0;
    const sum = pdi + mdi;
    dx.push(sum > 0 ? 100 * Math.abs(pdi - mdi) / sum : 0);
  }

  if (dx.length < period) return 0;
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adx = (adx * (period - 1) + dx[i]) / period;
  return adx;
}

// ─── Last-value EMA ──────────────────────────────────────────────────────
function emaLast(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let v = values[0];
  for (let i = 1; i < values.length; i++) v = values[i] * k + v * (1 - k);
  return v;
}

// ─── PUBLIC: classify a candle stream ─────────────────────────────────────
export function detectRegime(candles: OHLCV[]): RegimeContext {
  // Need at least 2*period+1 = 29 candles for ADX(14); with margin, 30
  if (candles.length < 30) {
    return {
      regime: "normal",
      adx: 0,
      atrPct: 0,
      macroDown: false,
      reason: "insufficient candles for regime detection — defaulting to normal",
    };
  }

  const adx = calcADXInline(candles, 14);
  const atr = calcATRInline(candles, 14);
  const lastPrice = candles[candles.length - 1].close;
  const atrPct = lastPrice > 0 ? (atr / lastPrice) * 100 : 0;

  // EMA50/200 macro structure — only meaningful when EMA200 has converged
  let macroDown = false;
  if (candles.length >= 200) {
    const closes = candles.map(c => c.close);
    const e50  = emaLast(closes, 50);
    const e200 = emaLast(closes, 200);
    macroDown = e50 < e200 * 0.99;
  }

  let regime: Regime;
  let reason: string;
  if (adx < REGIME_THRESHOLDS.ADX_DEAD_CHOP) {
    regime = "dead_chop";
    reason = `dead_chop: ADX ${adx.toFixed(1)} < ${REGIME_THRESHOLDS.ADX_DEAD_CHOP}`;
  } else if (adx > REGIME_THRESHOLDS.ADX_STRONG_TREND) {
    regime = "strong_trend";
    reason = `strong_trend: ADX ${adx.toFixed(1)} > ${REGIME_THRESHOLDS.ADX_STRONG_TREND}`;
  } else {
    regime = "normal";
    reason = `normal: ADX ${adx.toFixed(1)}`;
  }

  return { regime, adx, atrPct, macroDown, reason };
}

// ─── Strategy → Regime allow-list ─────────────────────────────────────────
const STRATEGY_REGIME_RULES: Record<string, ReadonlyArray<Regime>> = {
  // Mean-reversion — fades extremes, kills in chop, dies in strong trends
  "rsi-divergence":   ["dead_chop", "normal"],
  // Momentum confluence — needs directional flow
  "confluence-swing": ["normal", "strong_trend"],
  // Breakout pattern — chop generates fakeouts; needs directional resolution
  "break-retest":     ["normal", "strong_trend"],
  // Structure-based — works in all regimes per backtest evidence
  "smc":              ["dead_chop", "normal", "strong_trend"],
  // Stop-hunt reversal — works in all regimes; quality gated by FVG/wick rules
  "liquidity-sweep":  ["dead_chop", "normal", "strong_trend"],
  // EXPERIMENTAL Bollinger mean-reversion — designed for chop, never strong-trend
  "bollinger-mr":     ["dead_chop", "normal"],
};

export function isStrategyAllowedInRegime(strategyId: string, regime: Regime): boolean {
  const allowed = STRATEGY_REGIME_RULES[strategyId];
  // Unknown strategy → permissive (don't break new strategies that ship without a rule)
  if (!allowed) return true;
  return allowed.includes(regime);
}

// ─── Strategies that should require macroDown for SHORTs ─────────────────
// Excluded:
//   • confluence-swing — already enforces symmetric EMA50/200 macro internally
//   • rsi-divergence   — uses inBull/inBear (price vs EMA200) by design;
//                        adding macroDown would double-count and over-filter
//   • bollinger-mr     — its own ADX gate already rules out strong bears,
//                        and SHORTs are already gated by the EMA50 slope filter
const SHORT_MACRO_REQUIRED: ReadonlySet<string> = new Set([
  "smc",
  "break-retest",
  "liquidity-sweep",
]);

export function shouldRequireMacroDownForShort(strategyId: string): boolean {
  return SHORT_MACRO_REQUIRED.has(strategyId);
}
