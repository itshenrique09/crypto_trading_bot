import type { Strategy, StrategySignal } from "./types";
import { analyzeIndicators, generateSignal, type OHLCV } from "../analysis";

export const v2SwingStrategy: Strategy = {
  id: "confluence-swing",
  name: "Confluence Swing",
  description:
    "Multi-indicator confluence: EMA9/21/50/200 + Ichimoku + RSI + Stoch RSI + MACD + " +
    "Bollinger + OBV + Order Blocks + Fibonacci. Score ±10, signal at ±4/±6. " +
    "Dual TP: 1.5× (TP1) + 2.5× (TP2). High frequency — 130-160 trades/year per coin.",
  interval: "4h",
  minCandles: 250,  // EMA200 seed ≈8% at 250 bars (reliable); was 90 → EMA200 always disabled
  // ── 3.7-year 4H backtest (8000 candles, ~2022–2026) ──────────────────
  //   STRONG signals only (score≥6) + EMA200 macro filter (1% margin)
  //   ✅ AVAX PF=2.15 T=53  WR=47% Sharpe=1.19  (best — PF>2)
  //   ✅ XRP  PF=2.03 T=46  WR=50% Sharpe=1.15  (PF>2, low N)
  //   ✅ DOT  PF=1.98 T=44  WR=43% Sharpe=1.00  (just under 2, low N)
  //   ✅ BTC  PF=1.51 T=82  WR=41% Sharpe=0.87  (good frequency ~22/year)
  //   ✅ BNB  PF=1.51 T=65  WR=49% Sharpe=0.78  (~18/year)
  //   🟡 ADA  PF=1.15 T=58 | DOGE PF=1.07 | LINK PF=1.08 (marginal)
  //   ❌ ETH  PF=0.69 T=53  (avoid — consistently underperforms)
  //   ❌ SOL  PF=0.85 T=47  (avoid — volatile, low WR 30%)
  //   ⚠️  Low N for XRP/DOT/AVAX — ~12-14 trades/year
  preferredSymbols: ["AVAX", "XRP", "DOT", "BTC", "BNB"],

  analyze(candles: OHLCV[]): StrategySignal | null {
    const ind = analyzeIndicators(candles);
    const sig = generateSignal(candles, ind);

    if (sig.type === "HOLD" || !sig.entry || !sig.stopLoss || !sig.takeProfit1) return null;

    // Only STRONG signals (score ≥ ±6) for highest quality entries
    if (Math.abs(sig.confluenceScore) < 6) return null;

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
