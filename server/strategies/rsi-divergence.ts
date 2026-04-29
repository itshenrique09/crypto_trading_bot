import type { Strategy, StrategySignal } from "./types";
import { rsiDivergenceSignal, type OHLCV } from "../analysis";

export const rsiDivergenceStrategy: Strategy = {
  id: "rsi-divergence",
  name: "RSI Divergence",
  description:
    "Classic price-RSI divergence: bullish div (price lower low + RSI higher low, RSI<40) -> LONG; " +
    "bearish div (price higher high + RSI lower high, RSI>60) -> SHORT. " +
    "EMA200 macro filter. Technical TP. MEXC-only production set kept to symbols with recent edge.",
  interval: "1h",
  minCandles: 250,

  // MEXC Futures re-test Apr 29 2026 (last 8000 1H candles, managed exits):
  // Broad list: T=300 PF=1.01 netR=+2.6, 2026 netR=-2.6.
  // Kept only symbols positive both overall and in 2026:
  //   BCH  +8.4R overall / +1.0R 2026
  //   ATOM +8.8R overall / +2.3R 2026
  //   INJ  +1.2R overall / +9.6R 2026
  // Removed FIL (no current MEXC futures ticker), DOT/SOL/SAND/AAVE/AVAX
  // because recent MEXC results were flat or negative.
  preferredSymbols: ["BCH", "ATOM", "INJ"],
  cooldownHours: 20,

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = rsiDivergenceSignal(candles);

    if (sig.type === "NONE") return null;

    // Minimum 72% confidence: both bull/bear RSI thresholds are hard requirements.
    if (sig.confidence < 72) return null;

    return {
      direction: sig.type,
      entry: sig.entry,
      stopLoss: sig.stopLoss,
      takeProfit1: sig.takeProfit,
      takeProfit2: sig.takeProfit2,
      confidence: sig.confidence,
      confluenceScore: sig.confidence,
      reason: sig.reason,
    };
  },
};
