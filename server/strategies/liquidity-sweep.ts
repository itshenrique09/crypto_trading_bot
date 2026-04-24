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
  // ── Apr 2026 — CONFIRMATION-BAR RULE added (pro stop-hunt discipline) ──
  // A/B across all 21 preferredSymbols (3.7y, 1H, conf≥68):
  //   netR +18.4% (3920 → 4640), trade count –16% (4963 → 4154)
  //   ALL 21 coins improved PF, ZERO regressions. Biggest lifts:
  //   PEPE 1.91→2.55  SOL 1.68→2.21  AVAX 1.93→2.40  UNI 1.80→2.24
  //   ICP  1.44→1.87  SAND 1.37→1.77  ETC 1.42→1.77  DOT 2.10→2.45
  //   Mechanism: "wait for the close" — sweeps at current bar need premium
  //   quality (EQL/EQH + vol≥2× + wick≥1.5× body); sweeps at bar-1/-2 need
  //   every subsequent close on the reversal side of the pool. Filters out
  //   wick-noise where the sweep candle was followed by continuation.
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
  // Per-coin re-test Apr 2026 (3.7y, BE@1R, conf≥70): strategy works on ~every liquid coin.
  //   TOP tier (netR >150): UNI=+220 AAVE=+214 NEAR=+206 INJ=+177 SUI=+154 PEPE=+150
  //   Strong  (netR 100-150): MATIC=+138 AVAX=+128 LINK=+126 FIL=+113 DOT=+111 SOL=+104
  //   Added to preferred: UNI, AAVE, NEAR, MATIC, AVAX, LINK, DOT — all PF>1.7
  // NOTE: MATIC (netR=+138) excluded — Binance delisted MATICUSDT (→ POL migration)
  // Walk-forward Apr 2026 (65/35 train/test split) — 18 coins robust in OOS:
  //   UNI(+97) ICP(+65) AAVE(+65) PEPE(+63) INJ(+58) BCH(+56) FIL(+51) LTC(+51)
  //   ATOM(+51) AVAX(+48) XRP(+40) DOGE(+39) SOL(+32) ETC(+31) NEAR(+28) DOT(+24)
  //   SAND(+22) LINK(+15). Strategy is the MOST robust of the suite out-of-sample.
  // ── MEXC discovery Apr 2026 (top-100 liquid USDT perps, prod gate conf≥68):
  //   🏆 LUNC T=49 WR=42.9% PF=2.99 net=+83%  (2025:+47  2026:+36) — confirmed
  //   🏆 APT  T=57 WR=43.9% PF=2.04 net=+74%  (2025:+33  2026:+41) — confirmed
  //   🏆 HBAR T=53 WR=43.4% PF=2.01 net=+60%  (2025:+31  2026:+29) — confirmed
  //   ⚠️  ENA PF 3.06 T=39 (just below T≥40 threshold — re-test when more data)
  //   ⚠️  WLD PF 2.76 T=34 (low trade count — re-test when more data)
  //   ❌ SHIB/SPK/PAXG drop below PF 2 under conf≥68 production gate
  preferredSymbols: ["UNI", "ICP", "AAVE", "PEPE", "INJ", "BCH", "FIL", "LTC", "ATOM", "AVAX", "XRP", "DOGE", "SOL", "ETC", "NEAR", "DOT", "SAND", "LINK", "LUNC", "APT", "HBAR"],
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
