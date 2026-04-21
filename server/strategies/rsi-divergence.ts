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
  //   Per-coin re-test Apr 2026 (BE@1R trailing, 3.7y):
  //     SOL  T=134 WR=27% PF=1.79 netR=+111  | FIL  T=113 WR=25% PF=1.79 netR=+70
  //     ATOM T=163 WR=25% PF=1.44 netR=+70 (added) | XRP  T=125 WR=23% PF=1.55 netR=+67
  //     BCH  T=140 WR=26% PF=1.46 netR=+65 (added) | MATIC T=117 WR=24% PF=1.48 netR=+57 (added)
  //     INJ  T=121 WR=22% PF=1.35 netR=+52 (added) | PEPE T=82  WR=28% PF=1.44 netR=+47 (added)
  //     SAND T=142 WR=19% PF=1.20 netR=+33  | AVAX T=147 WR=23% PF=1.18 netR=+31
  //   ❌ ETH/BTC/ADA/LINK/DOGE/UNI/TRX/LTC/SUI/ALGO/NEAR (PF<1.0 or neg netR)
  // NOTE: MATIC (PF=1.48 netR=+57) excluded — Binance delisted MATICUSDT (→ POL migration)
  // Walk-forward Apr 2026 (65/35 train/test, min OOS netR>15 + PF>1.15):
  //   🟢 FIL(+53) DOT(+33) BCH(+32) SOL(+27) SAND(+24) ATOM(+24) AAVE(+18)
  //   🟡 AVAX(+13) INJ(+7) — marginal but positive OOS, included
  //   ❌ XRP (train +72 → test -5)  overfit
  //   ❌ PEPE (train -16 → test +63) inconsistent, excluded until more data
  //   ❌ DOGE ETH BNB ICP LINK LTC — all test-negative
  preferredSymbols: ["FIL", "DOT", "BCH", "SOL", "SAND", "ATOM", "AAVE", "AVAX", "INJ"],
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
