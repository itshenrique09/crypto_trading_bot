import type { Strategy, StrategySignal } from "./types";
import { liquiditySweepSignal, type OHLCV } from "../analysis";

export const liquiditySweepStrategy: Strategy = {
  id: "liquidity-sweep",
  name: "Liquidity Sweep",
  description:
    "Stop-hunt reversal: price sweeps a liquidity pool (equal highs/lows or swing S/R) " +
    "with a sharp rejection wick + volume spike + nearby FVG support, then closes back inside — trade the reversal. " +
    "EMA200 macro filter (LONG in bull only). 2.5×/4× R:R. Best on FIL, PEPE, SAND, INJ, SUI, SOL.",
  interval: "1h",
  minCandles: 220,  // EMA200 seed (200) + signal window (80) buffer
  // ── 16000-candle 1H backtest (22 months, COOLDOWN=12h, technical TPs) ──
  //   With FVG confirmation filter (avg PF +0.18 across all preferred coins):
  //   ✅ SUI   PF=1.82 T=192 WR=43%  (was 1.25 baseline — largest improvement)
  //   ✅ SOL   PF=1.55 T=203 WR=38%  (was 1.42)
  //   ✅ FIL   PF=1.51 T=172 WR=39%  (was 1.46)
  //   🟡 INJ   PF=1.41 T=204 WR=34%  (was 1.27)
  //   🟡 PEPE  PF=1.26 T=187 WR=35%  (was 1.09 — fixes bad baseline)
  //   🟡 SAND  PF=1.37 T=188 WR=38%  (was 1.36 — neutral)
  //   ⚠️  FVG filter reduces trade count ~45% but improves quality (WR +5-8% on most coins)
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
