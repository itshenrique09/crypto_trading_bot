// ─── BOLLINGER MEAN-REVERSION STRATEGY ───────────────────────────────────
// EXPERIMENTAL — no historical backtest yet, paper-only.
// Designed to fire ONLY in dead_chop regimes (ADX<20) where the rest of
// the suite gets shredded. The strategy is intentionally narrow:
//
//   LONG:
//     • Last bar's LOW pierced below the 20/2σ lower Bollinger band
//     • Closed back inside the band (close > lower) — rejection candle
//     • RSI(14) < 35 (oversold confirmation)
//     • ADX(14) < 20 (genuine chop — no trend to fade)
//     • |EMA50 slope over 10 bars| < 1.5%  (no strong macro to fight)
//     • Volume on entry candle ≥ 1.2× 20-bar average (rejection conviction)
//
//   SHORT (mirror).
//
// Stops & targets:
//   SL: structural — entry-bar wick extreme ± 0.3 ATR.
//   TP1: middle band (≈ 1R when entry is near band extremes).
//   TP2: opposite band (typically 2-3R).
//
// Risk discipline:
//   • Caps per-trade risk at 2.5% of entry price (degenerate signals filtered).
//   • Confidence floor 65 — gates out marginal setups when scoring is weak.
//   • Cooldown 8h: faster than other 1H strategies because mean-reversion
//     fires more frequently and 8h is empirically the sweet spot for
//     range-day rotation (typical Asia/EU/US session boundary).
//
// IMPORTANT:
//   • Default OFF in fresh installs is NOT enforced here — caller must
//     manage `paper_enabled_strategies` and `live_enabled_strategies`.
//   • Backtest before any live trading. Recommended: 3.7y window, walk-forward
//     65/35, per-coin OOS filter (PF>1.2, netR>+15 in test).

import type { Strategy, StrategySignal } from "./types";
import { analyzeIndicators, type OHLCV, type IndicatorResult } from "../analysis";
import { detectRegime } from "../regime-detector";

// ─── EMA helper (last value only — for slope check) ──────────────────────
function emaArr(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

interface BollingerSignalRaw {
  type: "LONG" | "SHORT" | "NONE";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  confidence: number;
  reason: string;
}

const NONE_SIGNAL: BollingerSignalRaw = {
  type: "NONE",
  entry: 0,
  stopLoss: 0,
  takeProfit1: 0,
  takeProfit2: 0,
  confidence: 0,
  reason: "",
};

function bollingerMeanReversionSignal(candles: OHLCV[]): BollingerSignalRaw {
  if (candles.length < 60) return NONE_SIGNAL;

  const ind: IndicatorResult = analyzeIndicators(candles);
  const last = candles.length - 1;
  const bar = candles[last];
  const closes = candles.map(c => c.close);

  const bb = ind.bollingerBands;
  const rsi = ind.rsi;
  const atr = ind.atr;
  const volRatio = ind.volumeRatio;

  // ── 1. ADX gate — must be in chop regime ─────────────────────────
  const regimeCtx = detectRegime(candles);
  if (regimeCtx.adx >= 20) return NONE_SIGNAL;

  // ── 2. EMA50 slope over last 10 bars — reject strong-trend windows ──
  const ema50Series = emaArr(closes, 50);
  const ema50Now    = ema50Series[last];
  const ema50Prev10 = ema50Series[Math.max(0, last - 10)];
  const slopePct    = ((ema50Now - ema50Prev10) / ema50Prev10) * 100;
  if (Math.abs(slopePct) > 1.5) return NONE_SIGNAL;

  // ── 3. Volume conviction on entry candle ─────────────────────────
  if (volRatio < 1.2) return NONE_SIGNAL;

  // ── 4. Setup detection: piercing wick + close back inside band ──

  // LONG candidate: pierced below lower band, closed back above
  const longPierce = bar.low <= bb.lower && bar.close > bb.lower && rsi < 35;
  // SHORT candidate: pierced above upper band, closed back below
  const shortPierce = bar.high >= bb.upper && bar.close < bb.upper && rsi > 65;

  if (!longPierce && !shortPierce) return NONE_SIGNAL;
  if (longPierce && shortPierce)   return NONE_SIGNAL; // ambiguous — skip

  const isLong = longPierce;

  // ── 5. SL / TP — structural ───────────────────────────────────────
  const slBuf = atr * 0.3;
  const stopLoss = isLong ? bar.low - slBuf : bar.high + slBuf;
  const entry    = bar.close;
  const risk     = Math.abs(entry - stopLoss);
  if (risk <= 0) return NONE_SIGNAL;

  // Risk cap: 2.5% of entry — filters out degenerate wicks
  if (risk / entry > 0.025) return NONE_SIGNAL;

  const takeProfit1 = bb.middle;                                 // mean
  const takeProfit2 = isLong ? bb.upper : bb.lower;              // opposite band

  // Sanity: TP1 must be on the correct side and beyond entry
  if (isLong  && (takeProfit1 <= entry || takeProfit2 <= takeProfit1)) return NONE_SIGNAL;
  if (!isLong && (takeProfit1 >= entry || takeProfit2 >= takeProfit1)) return NONE_SIGNAL;

  const reward1 = Math.abs(takeProfit1 - entry);
  if (reward1 / risk < 1.0) return NONE_SIGNAL;  // TP1 must yield ≥1R

  // ── 6. Confidence scoring ────────────────────────────────────────
  let conf = 60;
  if ( isLong && rsi < 30) conf += 5;
  if (!isLong && rsi > 70) conf += 5;
  if (volRatio >= 1.5)     conf += 5;
  if (regimeCtx.adx < 15)  conf += 5;
  if (bb.width >= 0.04)    conf += 5;  // wide enough range to be tradable

  if (conf < 65) return NONE_SIGNAL;

  return {
    type: isLong ? "LONG" : "SHORT",
    entry,
    stopLoss,
    takeProfit1,
    takeProfit2,
    confidence: conf,
    reason: `BB-MR ${isLong ? "LONG" : "SHORT"} | RSI ${rsi.toFixed(0)} | ADX ${regimeCtx.adx.toFixed(1)} | vol ${volRatio.toFixed(2)}× | slope ${slopePct.toFixed(2)}%`,
  };
}

export const bollingerMeanReversionStrategy: Strategy = {
  id: "bollinger-mr",
  name: "Bollinger Mean-Reversion",
  description:
    "EXPERIMENTAL chop-regime fader. Enters on Bollinger band piercing + " +
    "RSI extreme + ADX<20 + flat EMA50. TP1 = middle band, TP2 = opposite " +
    "band. Designed to capture range rotations the breakout suite misses. " +
    "Paper-only until backtest validates.",
  interval: "1h",
  // EMA200 reliability + BB(20) + 10-bar slope window — 220 covers all with margin
  minCandles: 220,
  // Narrow universe to start: most liquid, cleanest BB textbook behaviour
  preferredSymbols: ["BTC", "ETH", "SOL", "BNB", "DOGE"],
  cooldownHours: 8,

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = bollingerMeanReversionSignal(candles);
    if (sig.type === "NONE") return null;

    return {
      direction: sig.type,
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit1,
      takeProfit2: sig.takeProfit2,
      confidence: sig.confidence,
      confluenceScore: sig.confidence,
      reason: sig.reason,
    };
  },
};
