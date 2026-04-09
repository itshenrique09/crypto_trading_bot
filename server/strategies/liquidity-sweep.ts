import type { Strategy, StrategySignal } from "./types";
import { liquiditySweepSignal, type OHLCV } from "../analysis";

export const liquiditySweepStrategy: Strategy = {
  id: "liquidity-sweep",
  name: "Liquidity Sweep",
  description:
    "Stop-hunt reversal: price sweeps a liquidity pool (equal highs/lows or swing S/R) " +
    "with a sharp rejection wick + volume spike, then closes back inside — trade the reversal. " +
    "EMA200 macro filter (LONG in bull only). 2.5×/4× R:R. Best on FIL, OP, ADA, SUI, BTC, SOL.",
  interval: "1h",
  minCandles: 220,  // EMA200 seed (200) + signal window (80) buffer
  // ── 5000-candle 1H backtest (~7 months, COOLDOWN=12h, TP=2.5×R) ──
  //   ✅ FIL  PF=2.06 T=90  WR=42%  EQ=+154%
  //   ✅ OP   PF=1.84 T=92  WR=42%  EQ=+92%
  //   ✅ ADA  PF=1.73 T=71  WR=42%  EQ=+52%
  //   ✅ SUI  PF=1.63 T=84  WR=44%  EQ=+69%
  //   ✅ BTC  PF=1.54 T=67  WR=42%  EQ=+24%
  //   ✅ SOL  PF=1.44 T=86  WR=41%  EQ=+36%
  //   🟡 ETH  PF=1.34 | SAND PF=1.38 | DOT PF=1.37 | PEPE PF=1.36 (borderline, excluded)
  //   ❌ ARB  PF=0.94 | INJ PF=0.90 | LINK PF=1.02 (negative/breakeven — excluded)
  //   ⚠️  Strategy fires on sharp stop-hunt wicks — most effective on 1H with liquid futures
  //   ⚠️  LONG macro filter (EMA50 > EMA200) keeps LONG signals in bull market only
  preferredSymbols: ["FIL", "OP", "ADA", "SUI", "BTC", "SOL"],
  cooldownHours: 12,  // matches backtest COOLDOWN=12h

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = liquiditySweepSignal(candles);

    if (sig.type === "NONE") return null;

    // Minimum 68% confidence — requires either EQL/EQH pool or strong wick + volume
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
