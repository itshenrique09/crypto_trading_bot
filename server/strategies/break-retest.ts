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
  // Per-coin re-test Apr 2026 (BE@1R trailing, 3.7y):
  //   SAND T=34 WR=50% PF=3.48 netR=+114  | NEAR T=18 WR=44% PF=3.38 netR=+82
  //   SOL  T=35 WR=43% PF=1.74 netR=+59   | BNB  T=60 WR=33% PF=2.19 netR=+52
  //   MATIC T=23 WR=30% PF=3.72 netR=+51  | ETC  T=29 WR=35% PF=2.67 netR=+44
  //   AVAX T=22 WR=23% PF=1.53 netR=+19 — DROPPED (marginal, low WR)
  // NOTE: MATIC (PF=3.72 netR=+51) excluded — Binance delisted MATICUSDT (→ POL migration)
  // Walk-forward Apr 2026 (65/35 train/test) — only SOL/SAND/BNB robust OOS:
  //   🟢 SOL  train +15 / test +30 PF 2.26
  //   🟢 SAND train +118 / test +18 PF 2.50
  //   🟢 BNB  train +2 / test +19 PF 3.23
  //   ❌ NEAR (train -14 → test +85 but only 9 trades train, unstable)
  // ── Universe expansion May 2026 (offline harness, 8000×4H ≈ 3.6y full-sample) ──
  //   Added on PF≥1.7 + positive netR + adequate T across the full window:
  //     🟢 XRP  T=23 PF 2.40 +10.4R   🟢 AVAX T=18 PF 1.75 +7.9R
  //     🟢 ETC  T=19 PF 1.71 +4.6R
  //   Rejected: LTC 0.70 / DOT 0.49 / ATOM 0.85 (net-negative); NEAR PF 2.14 but T=10 (too few).
  //   Under the BTC soft overlay the 6-coin set pools to PF 1.93 / +37R (vs 3-coin 2.31 / +25R)
  //   — lower PF but ~60% more trades and more total R, the right trade for a low-freq strategy.
  preferredSymbols: ["SOL", "SAND", "BNB", "XRP", "AVAX", "ETC"],
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
