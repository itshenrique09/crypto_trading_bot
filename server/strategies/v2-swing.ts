import type { Strategy, StrategySignal } from "./types";
import { analyzeIndicators, generateSignal, type OHLCV } from "../analysis";

export const v2SwingStrategy: Strategy = {
  id: "v2-swing",
  name: "v2 Swing",
  description: "Confluence scoring com RSI, MACD, Bollinger, volume — a estratégia principal testada e validada.",
  interval: "4h",
  minCandles: 90,

  analyze(candles: OHLCV[]): StrategySignal | null {
    const ind = analyzeIndicators(candles);
    const sig = generateSignal(candles, ind);

    if (sig.type === "HOLD" || !sig.entry || !sig.stopLoss || !sig.takeProfit1) return null;

    const direction = (sig.type === "BUY" || sig.type === "STRONG_BUY") ? "LONG" : "SHORT";

    return {
      direction,
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit1,
      takeProfit2: sig.takeProfit2,
      confidence: sig.confidence,
      confluenceScore: sig.confluenceScore,
      reason: `${sig.type} score ${sig.confluenceScore}`,
    };
  },
};
