import type { Strategy, StrategySignal } from "./types";
import { breakRetestSignal, type OHLCV } from "../analysis";

export const breakRetestStrategy: Strategy = {
  id: "break-retest",
  name: "Break & Retest",
  description:
    "Institutional S/R level detection (3+ touches) + volumetric break confirmation + retest rejection. " +
    "Trend-filtered (EMA21/EMA50/EMA200). Best on SOL, AVAX, XRP over 3.7-year 4H backtest.",
  interval: "4h",
  minCandles: 150,  // needs 150 bars for reliable EMA200 macro-trend filter
  // ── 3.7-year 4H backtest (25 coins, 8000 candles, ~2022–2026, MAX_BARS=200) ──
  //   Ranked by PF + cross-year consistency (2022 bear / 2023 bull / 2024 / 2025)
  //   ✅ SOL  PF=4.45 T=18 — 2022:+7%  2023:+32% 2024:+16% 2025:+44% (best, consistent)
  //   ✅ SAND PF=2.39 T=24 — 2022:+9%  2023:+44% 2024:+4%  2025:+18% (4/4 years+)
  //   ✅ AVAX PF=1.99 T=19 — 2022:-15% 2023:+10% 2024:+14% 2025:+35%
  //   ✅ XRP  PF=1.66 T=22 — 2022:-8%  2023:+9%  2024:-14% 2025:+32% (inconsistent yr)
  //   ⚠️  ALL results have T<30 — B&R is inherently low-frequency on 4H
  //   ❌ BTC  PF=0.85 T=47 | BNB PF=0.85 T=39 | DOT PF=0.40 T=21
  //   ❌ LINK PF=0.58 T=15 | LTC PF=0.62 T=29 | ATOM PF=0.60 T=27
  preferredSymbols: ["SOL", "AVAX", "SAND"],
  cooldownHours: 12,  // matches backtest COOLDOWN=3×4H bars

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = breakRetestSignal(candles);

    if (sig.type === "NONE") return null;

    // Require minimum 68% confidence (pin_bar or engulfing quality signals)
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
