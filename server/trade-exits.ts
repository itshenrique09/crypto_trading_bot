import type { OHLCV } from "./analysis";

export interface ManagedExitLevels {
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number | null;
}

export interface ManagedExitConfig {
  tp1ClosePct?: number;
  trailingPct?: number;
  takerFeePct?: number;
  slippagePct?: number;
}

export interface ManagedExitResult {
  outcome: "loss" | "tp1" | "tp2" | "trailing" | "breakeven" | "timeout";
  tp1Hit: boolean;
  grossR: number;
  netR: number;
  grossPnlPct: number;
  netPnlPct: number;
  costPct: number;
  exitPrice: number;
  barsHeld: number;
}

interface ExitFill {
  share: number;
  price: number;
}

const DEFAULT_TP1_CLOSE_PCT = 0.6;
const DEFAULT_TRAILING_PCT = 0.02;
const DEFAULT_TAKER_FEE_PCT = 0.0002;
const DEFAULT_SLIPPAGE_PCT = 0.0005;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 10): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function directionalReturn(direction: "LONG" | "SHORT", entry: number, exit: number): number {
  return direction === "LONG"
    ? (exit - entry) / entry
    : (entry - exit) / entry;
}

export function simulateManagedExit(
  levels: ManagedExitLevels,
  futureCandles: OHLCV[],
  config: ManagedExitConfig = {},
): ManagedExitResult {
  const tp1ClosePct = clamp(config.tp1ClosePct ?? DEFAULT_TP1_CLOSE_PCT, 0, 1);
  const trailingPct = Math.max(0, config.trailingPct ?? DEFAULT_TRAILING_PCT);
  const takerFeePct = Math.max(0, config.takerFeePct ?? DEFAULT_TAKER_FEE_PCT);
  const slippagePct = Math.max(0, config.slippagePct ?? DEFAULT_SLIPPAGE_PCT);

  const { direction, entry, stopLoss, takeProfit1 } = levels;
  const takeProfit2 = levels.takeProfit2 ?? takeProfit1;
  const riskAbs = Math.abs(entry - stopLoss);
  if (riskAbs <= 0 || entry <= 0) {
    throw new Error("Managed exit requires positive entry and non-zero risk");
  }

  let outcome: ManagedExitResult["outcome"] = "timeout";
  let tp1Hit = false;
  let remainingShare = 1;
  let peak = entry;
  let exitPrice = entry;
  let barsHeld = 0;
  const fills: ExitFill[] = [];

  const closeShare = (share: number, price: number) => {
    const filledShare = clamp(share, 0, remainingShare);
    if (filledShare <= 0) return;
    fills.push({ share: filledShare, price });
    remainingShare = round(remainingShare - filledShare);
    exitPrice = price;
  };

  for (let i = 0; i < futureCandles.length; i++) {
    const candle = futureCandles[i];
    barsHeld = i + 1;

    if (direction === "LONG") {
      if (!tp1Hit) {
        if (candle.low <= stopLoss) {
          outcome = "loss";
          closeShare(remainingShare, stopLoss);
          break;
        }
        if (candle.high >= takeProfit1) {
          tp1Hit = true;
          peak = Math.max(peak, takeProfit1, candle.high);
          closeShare(tp1ClosePct, takeProfit1);
          if (remainingShare <= 0) {
            outcome = "tp1";
            break;
          }
          continue;
        }
      }

      if (tp1Hit && remainingShare > 0) {
        const trailStop = peak * (1 - trailingPct);
        if (candle.low <= trailStop && trailStop > entry) {
          outcome = "trailing";
          closeShare(remainingShare, trailStop);
          break;
        }
        if (candle.low <= entry) {
          outcome = "breakeven";
          closeShare(remainingShare, entry);
          break;
        }
        peak = Math.max(peak, candle.high);
        if (takeProfit2 && candle.high >= takeProfit2) {
          outcome = "tp2";
          closeShare(remainingShare, takeProfit2);
          break;
        }
      }
    } else {
      if (!tp1Hit) {
        if (candle.high >= stopLoss) {
          outcome = "loss";
          closeShare(remainingShare, stopLoss);
          break;
        }
        if (candle.low <= takeProfit1) {
          tp1Hit = true;
          peak = Math.min(peak, takeProfit1, candle.low);
          closeShare(tp1ClosePct, takeProfit1);
          if (remainingShare <= 0) {
            outcome = "tp1";
            break;
          }
          continue;
        }
      }

      if (tp1Hit && remainingShare > 0) {
        const trailStop = peak * (1 + trailingPct);
        if (candle.high >= trailStop && trailStop < entry) {
          outcome = "trailing";
          closeShare(remainingShare, trailStop);
          break;
        }
        if (candle.high >= entry) {
          outcome = "breakeven";
          closeShare(remainingShare, entry);
          break;
        }
        peak = Math.min(peak, candle.low);
        if (takeProfit2 && candle.low <= takeProfit2) {
          outcome = "tp2";
          closeShare(remainingShare, takeProfit2);
          break;
        }
      }
    }
  }

  if (remainingShare > 0) {
    const timeoutExit = futureCandles[futureCandles.length - 1]?.close ?? entry;
    closeShare(remainingShare, timeoutExit);
    if (outcome === "timeout" && tp1Hit) outcome = "tp1";
  }

  const grossPnlPct = fills.reduce((sum, fill) => {
    return sum + fill.share * directionalReturn(direction, entry, fill.price) * 100;
  }, 0);
  const totalExitShare = fills.reduce((sum, fill) => sum + fill.share, 0);
  const costPct = (takerFeePct + slippagePct) * 100 * (1 + totalExitShare);
  const netPnlPct = grossPnlPct - costPct;
  const riskPct = (riskAbs / entry) * 100;

  return {
    outcome,
    tp1Hit,
    grossR: round(grossPnlPct / riskPct),
    netR: round(netPnlPct / riskPct),
    grossPnlPct: round(grossPnlPct),
    netPnlPct: round(netPnlPct),
    costPct: round(costPct),
    exitPrice: round(exitPrice),
    barsHeld,
  };
}
