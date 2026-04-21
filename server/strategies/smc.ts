import type { Strategy, StrategySignal } from "./types";
import { smcSignal, type OHLCV } from "../analysis";

export const smcStrategy: Strategy = {
  id: "smc",
  name: "SMC",
  description:
    "Smart Money Concepts — BOS + unmitigated Order Block retest + rejection candle. " +
    "EMA200 macro filter (LONG in bull market only). 2.5× TP target. " +
    "Complements B&R: best on LINK, DOGE, DOT over 3.7-year 4H backtest.",
  interval: "4h",
  minCandles: 150,  // needs 150 bars for reliable EMA200 macro-trend filter
  // ── Walk-forward Apr 2026 (65/35 train/test split) — SMC overfits badly OOS ──
  // Only 2 coins pass strict OOS filter (netR>+15 AND PF>1.15 in TEST period):
  //   🟢 DOGE  train +24 PF 2.26  → test +63 PF 3.30  (real edge, best-in-class)
  //   🟢 AAVE  train +34 PF 1.48  → test +22 PF 2.75
  //   🟡 ATOM  train +38 → test +6 (marginal, kept as diversifier)
  //   🟡 PEPE/DOT/BNB/FIL — train+/test+ but low trade count, excluded
  //   ❌ DROPPED (train positive but test negative = overfit):
  //     BCH (+61 → -19) SAND (+74 → -19) ICP (+53 → -28) LINK (+46 → -37)
  //     FIL (+41 → +1 marginal) — previously thought strong, doesn't hold
  //   ⚠️  SMC is low-frequency and regime-sensitive — expect few signals.
  //   🔄 Role: precision complement to Swing/LiqSweep. Very narrow coin universe is correct.
  preferredSymbols: ["DOGE", "AAVE", "ATOM"],
  cooldownHours: 12,  // matches backtest COOLDOWN=3×4H bars

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = smcSignal(candles);

    if (sig.type === "NONE") return null;

    // Require minimum 68% confidence (strong OB + rejection quality signals)
    if (sig.confidence < 68) return null;

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
