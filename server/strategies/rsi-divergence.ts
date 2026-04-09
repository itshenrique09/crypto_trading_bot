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
  // ── 3.7-year 1H backtest (25 coins, 32000 candles, COOLDOWN=20h, technical TPs) ──
  //   ✅ FIL  PF=1.55 T=113 WR=35%  (2022:+3% 2023:-5% 2024:+26% 2025:+68% 2026:-3%)
  //   ✅ SAND PF=1.55 T=140 WR=35%  (2022:+22% 2023:+30% 2024:-8% 2025:+61% 2026:+12%) ⭐
  //   ✅ SOL  PF=1.50 T=134 WR=34%  (2022:+29% 2023:+35% 2024:+35% 2025:+24% 2026:-17%)
  //   🟡 XRP PF=1.28 | BCH PF=1.28 | AVAX PF=1.33 | ICP PF=1.27 (borderline)
  //   ❌ ETH/BTC/UNI/NEAR/TRX/LTC (PF<1.0 or inconsistent cross-year)
  //   Strategy on 1H gives T≈110-140 over 3.7 years = ~30-38 trades/year per coin
  preferredSymbols: ["FIL", "SAND", "SOL"],
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
