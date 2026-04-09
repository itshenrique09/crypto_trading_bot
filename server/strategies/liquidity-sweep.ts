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
  // ── 5000-candle 1H backtest (~7 months, COOLDOWN=12h, technical TPs) ──
  //   ✅ FIL   PF=2.26 T=69  WR=41%  avgTP1=2.79R
  //   ✅ PEPE  PF=2.32 T=44  WR=46%  avgTP1=2.69R
  //   ✅ SAND  PF=2.07 T=56  WR=43%  avgTP1=2.80R
  //   ✅ INJ   PF=1.79 T=61  WR=39%  avgTP1=2.77R
  //   ✅ SUI   PF=1.67 T=59  WR=41%  avgTP1=2.70R
  //   ✅ SOL   PF=1.57 T=58  WR=38%  avgTP1=2.58R
  //   🟡 OP    PF=1.36 | ADA PF=1.41 | BTC PF=1.48 | ARB PF=1.06 | DOT PF=1.09 (borderline)
  //   ❌ ETH   PF=0.99 | LINK PF=0.86 (excluded)
  //   ⚠️  Strategy fires on sharp stop-hunt wicks — most effective on 1H with liquid futures
  //   ⚠️  LONG macro filter (EMA50 > EMA200) keeps LONG signals in bull market only
  preferredSymbols: ["FIL", "PEPE", "SAND", "INJ", "SUI", "SOL"],
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
