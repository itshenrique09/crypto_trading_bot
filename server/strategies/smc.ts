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
  //   ✅ DOGE PF=1.88 T=26 WR=46%  (strong OB reaction, consistent 2023-2026)
  //   ✅ LINK PF=1.85 T=31 WR=39%  (2022-2024 positive, 2025/2026 recently weaker)
  //   ✅ ATOM PF=1.83 T=22 WR=41%  (2022:+11% 2023:-10% 2024:+15% 2025:+17% — added 2026)
  //   ✅ DOT  PF=1.74 T=15 WR=33%  (low N but 4/4 years positive)
  //   ❌ BTC  PF=0.87 4H (but PF=1.56 T=80 on 1H — OBs work better on BTC 1H)
  //   ❌ SOL  PF=0.74 T=38 | ETH PF=0.72 | XRP PF=0.44 | AVAX PF=1.03
  //   ⚠️  Strategy is inherently low-frequency (BOS+OB+rejection = rare setup)
  //   ⚠️  1H makes LINK/DOGE/DOT worse (LINK drops to PF=0.58) — keep on 4H
  //   🔄 Role: high-precision complement to Swing. Accept low N as cost of quality.
  preferredSymbols: ["LINK", "DOGE", "DOT", "ATOM"],
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
