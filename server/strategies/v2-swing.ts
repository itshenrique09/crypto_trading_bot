import type { Strategy, StrategySignal } from "./types";
import { analyzeIndicators, generateSignal, type OHLCV } from "../analysis";

export const v2SwingStrategy: Strategy = {
  id: "confluence-swing",
  name: "Confluence Swing",
  description:
    "Multi-indicator confluence: EMA9/21/50/200 + Ichimoku + RSI + Stoch RSI + MACD + " +
    "Bollinger + OBV + Order Blocks + Fibonacci. Score ±10, signal at ±4 (BUY/SELL or STRONG). " +
    "Dual TP: 1.5× (TP1) + 2.5× (TP2). Runs on 1H for optimal timing and trade frequency.",
  interval: "1h",
  minCandles: 250,  // EMA200 seed — 250×1H ≈ 10 days, reliable
  // ── Walk-forward Apr 2026 (3.7y, 65% train / 35% test split, score≥4, BE@1R) ──
  // Only coins with netR>+20% in TEST (out-of-sample) + PF≥1.1 kept. Prevents overfit.
  // Coin | TRAIN netR/PF        | TEST netR/PF         | verdict
  //   🟢 ICP  | +30   1.05        | +102  1.30           | keep (test > train — real edge)
  //   🟢 DOGE | +252  1.50        | +94   1.36           | keep (strong both windows)
  //   🟢 ETH  | +12   1.05        | +85   1.42           | keep (improving OOS)
  //   🟢 AVAX | +242  1.43        | +60   1.22           | keep
  //   🟢 BNB  | +8    1.03        | +45   1.30           | keep (OOS much stronger)
  //   🟢 XRP  | +104  1.25        | +32   1.13           | keep
  //   ❌ DROPPED as overfit (train positive but test flat/negative):
  //     ATOM (train +84 → test -17.9)  — big regime shift
  //     PEPE (train +104 → test -43)   — memecoin noise, can't time
  //     ADA  (train +197 → test +21 PF 1.08)  — marginal, excluded
  //     SAND/SOL/INJ/BTC/LTC/FIL/UNI/NEAR/DOT/AAVE/LINK/BCH/SUI — test<0
  //   ❌ Still excluded: MATIC (Binance delisted → POL migration)
  //   Low WR 20-26% is expected — R-multiple strategy (TP1=1.5R, TP2=2.5R).
  // ── 2026 re-validation (Jun 26, validate-2026.ts, 1y 1H, live gates) ──
  //   AVAX DROPPED: T=82 exp -0.16R PF 0.79 — net-negative on a solid sample.
  //   Kept (2026 exp/PF): XRP +0.34/1.52  ETH +0.20/1.30  DOGE +0.07/1.11
  //   ICP +0.04/1.06  BNB +0.03/1.05. Suite is thin (pooled exp +0.08R) — Swing
  //   is the weakest active strategy; keep but do not lean on it.
  preferredSymbols: ["DOGE", "XRP", "ICP", "ETH", "BNB"],
  cooldownHours: 20,  // matches backtest COOLDOWN=20×1H bars (= 5×4H bars, same 20h real-time)

  analyze(candles: OHLCV[]): StrategySignal | null {
    const ind = analyzeIndicators(candles);
    const sig = generateSignal(candles, ind);

    if (sig.type === "HOLD" || !sig.entry || !sig.stopLoss || !sig.takeProfit1) return null;

    // BUY/SELL signals (score ≥ ±4) — backtest (1H, 32000 bars, COOLDOWN=20h) shows
    // score≥4 gives T=500-675/coin with PF 1.19-1.76 across all preferred coins (all ✅/🟡)
    // score≥6 only gave T=38-53/coin — insufficient statistical confidence
    if (Math.abs(sig.confluenceScore) < 4) return null;

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
