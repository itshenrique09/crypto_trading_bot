import type { Strategy, StrategySignal } from "./types";
import { smcSignal, type OHLCV } from "../analysis";

export const smcStrategy: Strategy = {
  id: "smc",
  name: "SMC",
  description:
    "Smart Money Concepts — BOS + unmitigated Order Block retest + rejection candle. " +
    "EMA200 macro filter (LONG in bull market only). 2.5× TP target. " +
    "Complements B&R: best on DOGE, BTC, DOT over 3.7-year 4H backtest.",
  interval: "4h",
  minCandles: 150,  // needs 150 bars for reliable EMA200 macro-trend filter
  // ── 3.7-year 4H backtest (8000 candles, ~2022–2026) ──────────────────
  //   ✅ DOGE PF=2.87 T=12 WR=58% Sharpe=0.84  (best OB reaction quality)
  //   ✅ BTC  PF=2.46 T=7  WR=57% Sharpe=0.52  (low freq but high precision)
  //   ✅ DOT  PF=1.56 T=10 WR=40% Sharpe=0.28  (consistent across years)
  //   ❌ SOL  PF=0.71 | ETH PF=0.85 | BNB PF=0.89 | ADA PF=0.84
  //   ❌ XRP  PF=0.94 | AVAX PF=0.36 | LINK PF=0.70
  //   ⚠️  ALL results are low-N (7–18 trades) — use as directional guidance only
  //   🔄 SMC complements B&R: DOGE/DOT fail on B&R but excel on SMC
  preferredSymbols: ["DOGE", "BTC", "DOT"],

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
      confidence: sig.confidence,
      confluenceScore: sig.confidence,
      reason: sig.reason,
    };
  },
};
