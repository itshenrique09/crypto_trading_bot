import type { Strategy, StrategySignal } from "./types";
import { meanReversionSignal, type OHLCV } from "../analysis";

export const meanReversionStrategy: Strategy = {
  id: "mean-reversion",
  name: "Mean Reversion",
  description: "Bollinger Bands + RSI(7) oversold/overbought — fades overextended moves targeting BB midline.",
  interval: "4h",
  minCandles: 30,

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = meanReversionSignal(candles);

    if (sig.type === "NONE") return null;

    // Require minimum 60% confidence to avoid weak reversals
    if (sig.confidence < 60) return null;

    return {
      direction: sig.type,
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit,
      confidence: sig.confidence,
      confluenceScore: sig.confidence,  // Already 0-100 scale
      reason: sig.reason,
    };
  },
};
