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
  // ── 3.7-year 1H backtest (25 coins, 32000 candles, ~2022–2026, MAX_BARS=800) ──
  //   STRONG signals only (score≥6) + EMA200 macro filter
  //   Ranked by PF + cross-year consistency (2022 bear / 2023 bull / 2024 / 2025)
  //   ✅ ICP   PF=2.12 T=190 Sharpe=2.17 — all years positive ⭐ (best risk-adj)
  //   ✅ MATIC PF=2.08 T=224 Sharpe=1.95 — 2021-2024 positive ⭐
  //   ✅ BNB   PF=1.68 T=185 Sharpe=1.51 — all years positive
  //   ✅ NEAR  PF=1.67 T=191 Sharpe=1.45 — all years positive
  //   ✅ AVAX  PF=1.65 T=198 Sharpe=1.53 — all years positive
  //   ✅ SOL   PF=1.59 T=204 Sharpe=1.39 — 2022 slight loss
  //   ✅ DOT   PF=1.57 T=202 Sharpe=1.33 — 2022 slight loss
  //   ✅ VET   PF=1.56 T=208 Sharpe=1.42 — all years positive
  //   ✅ XRP   PF=1.51 T=178 Sharpe=1.07 — all years positive
  //   ✅ BTC   PF=1.50 T=216 Sharpe=1.18 — 2023 slight loss
  //   🟡 ADA   PF=1.48 T=201 — borderline, all years positive (keep for volume)
  //   ❌ ETH   PF=1.07 T=197 (marginal — 2025 negative, avoid)
  //   ❌ LINK  PF=1.08 T=199 (2023/2025/2026 negative, avoid)
  preferredSymbols: ["ICP", "MATIC", "BNB", "NEAR", "AVAX", "SOL", "DOT", "VET", "XRP", "BTC"],
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
