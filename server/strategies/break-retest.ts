import type { Strategy, StrategySignal } from "./types";
import { breakRetestSignal, type OHLCV } from "../analysis";

export const breakRetestStrategy: Strategy = {
  id: "break-retest",
  name: "Break & Retest",
  description:
    "Institutional S/R level detection (3+ touches) + volumetric break confirmation + retest rejection. " +
    "Trend-filtered (EMA21/EMA50/EMA200). Best on ETH, SOL, XRP, AVAX over 3.7-year 4H backtest.",
  interval: "4h",
  minCandles: 150,  // needs 150 bars for reliable EMA200 macro-trend filter
  // ── 3.7-year 4H backtest results (8000 candles, ~2020–2026) ──────────
  //   ✅ ETH  PF=1.77 T=36 WR=44% Sharpe=0.66  (statistically solid)
  //   ✅ SOL  PF=4.43 T=19 WR=63% Sharpe=1.22  (exceptional quality)
  //   ✅ XRP  PF=2.14 T=23 WR=52% Sharpe=0.72  (consistent)
  //   ✅ AVAX PF=1.58 T=19 WR=47% Sharpe=0.45
  //   🟡 BNB  PF=1.23 T=42 WR=50% (slight edge, valid)
  //   🟡 ADA  PF=1.21 T=27 WR=44%
  //   ⚪ BTC  PF=1.00 T=50 WR=40% (no real edge — BTC trends too strongly for B&R)
  //   ❌ DOT  PF=0.39 T=22 | DOGE PF=0.79 T=19
  preferredSymbols: ["ETH", "SOL", "XRP", "AVAX", "BNB", "ADA"],

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
      confidence: sig.confidence,
      confluenceScore: sig.confidence,
      reason: sig.reason,
    };
  },
};
