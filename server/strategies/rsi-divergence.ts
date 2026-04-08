import type { Strategy, StrategySignal } from "./types";
import { rsiDivergenceSignal, type OHLCV } from "../analysis";

export const rsiDivergenceStrategy: Strategy = {
  id: "rsi-divergence",
  name: "RSI Divergence",
  description:
    "Classic price-RSI divergence: bullish div (price lower low + RSI higher low, RSI<40) → LONG; " +
    "bearish div (price higher high + RSI lower high, RSI>60) → SHORT. " +
    "EMA200 macro filter. 2.5× TP. Best on FIL and SAND (all years positive on SAND).",
  interval: "1h",
  minCandles: 250,  // EMA200 seed (200) + divergence scan range (30) + swing lookback (5) + buffer
  // ── 3.7-year 1H backtest (25 coins, 32000 candles, COOLDOWN=20h, MAX_BARS=200h) ──
  //   ✅ FIL  PF=1.72 T=122 WR=38%  (2022:-1% 2023:+14% 2024:+35% 2025:+70% 2026:+7%)
  //   ✅ SAND PF=1.70 T=135 WR=40%  (2022:+26% 2023:+34% 2024:+3% 2025:+57% 2026:+10%) ⭐ all years positive
  //   🟡 MATIC PF=1.37 | ICP PF=1.34 | ETC PF=1.36 (borderline, not included)
  //   ❌ ETH/BTC/ADA/DOGE/NEAR/XRP (PF<1.3 or inconsistent cross-year)
  //   Strategy on 1H gives T≈120-135 over 3.7 years = ~33-36 trades/year per coin
  preferredSymbols: ["FIL", "SAND"],
  cooldownHours: 20,  // matches backtest COOLDOWN=20×1H bars

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = rsiDivergenceSignal(candles);

    if (sig.type === "NONE") return null;

    // Minimum 72% confidence (both bull/bear RSI thresholds are hard requirements)
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
