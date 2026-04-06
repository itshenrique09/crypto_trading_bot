import type { Strategy, StrategySignal } from "./types";
import { breakoutSignal, type OHLCV } from "../analysis";

export const breakoutStrategy: Strategy = {
  id: "breakout",
  name: "Breakout",
  description: "Donchian Channel breakout + volume spike + EMA20 trend filter.",
  interval: "4h",
  minCandles: 25,

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = breakoutSignal(candles);

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
