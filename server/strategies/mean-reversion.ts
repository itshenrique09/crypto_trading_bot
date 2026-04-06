import type { Strategy, StrategySignal } from "./types";
import { meanReversionSignal, type OHLCV } from "../analysis";

export const meanReversionStrategy: Strategy = {
  id: "mean-reversion",
  name: "Mean Reversion",
  description: "Bollinger Bands + RSI(7) oversold/overbought — entradas na reversão à média com BB midline como TP.",
  interval: "4h",
  minCandles: 30,

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = meanReversionSignal(candles);

    if (sig.type === "NONE") return null;

    return {
      direction: sig.type,
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit,
      confidence: sig.confidence,
      confluenceScore: Math.round(sig.confidence * 10),
      reason: sig.reason,
    };
  },
};
