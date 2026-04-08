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
  // ── 3.7-year 4H backtest (25 coins, 8000 candles, ~2022–2026, MAX_BARS=200) ──
  //   Tuning tested: conf≥60/65/68 → identical results (threshold not the bottleneck)
  //   ✅ LINK PF=1.92 T=27 WR=44%  (best — 2022/2023/2024 all positive)
  //   ✅ DOGE PF=1.80 T=23 WR=48%  (strong OB reaction, consistent)
  //   ✅ DOT  PF=1.50 T=12 WR=33%  (low N but positive across years)
  //   🟡 AAVE PF=1.43 T=22 | BCH PF=1.37 T=36 (borderline)
  //   ❌ BTC  PF=0.87 4H (but PF=1.56 T=80 on 1H — OBs work better on BTC 1H)
  //   ❌ SOL  PF=0.49 T=34 | ETH PF=0.76 | XRP PF=0.60 | AVAX PF=0.96
  //   ⚠️  Strategy is inherently low-frequency (BOS+OB+rejection = rare setup)
  //   ⚠️  1H makes LINK/DOGE/DOT worse (LINK drops to PF=0.58) — keep on 4H
  //   🔄 Role: high-precision complement to Swing. Accept low N as cost of quality.
  preferredSymbols: ["LINK", "DOGE", "DOT"],
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
