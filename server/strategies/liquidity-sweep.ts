import type { Strategy, StrategySignal } from "./types";
import { liquiditySweepSignal, type OHLCV } from "../analysis";

// ═══ PARAMETER FREEZE — 2026-07-02 (exits re-validated 2026-07-07) ═══════
// Amended 2026-08-14: confidence floor 68→60 via pre-registered full-pipeline
// A/B (Aug 2026 audit) — see the note above the floor check in analyze().
// Universe and parameters below are FROZEN as validated by the full-pipeline
// portfolio harness (script/validate-pipeline.ts, shipped config: 41-coin
// MEXC-verified universe, group cap 3, r_multiple 2R trailing:
// PF 1.99 · +715R · maxDD 31.2% with fees+slippage; pre-expansion fallback
// 28 coins/cap 2: PF 2.01 · +517R · maxDD 27.4%).
// Do NOT add/remove coins or retune thresholds based on recent-window backtests —
// that is the selection-bias cycle that broke this project (universe picked on
// the same 2026 window used to "validate" it). Changes require: (1) a hypothesis
// stated BEFORE looking at results, (2) full-pipeline A/B on ALL+2026 windows,
// (3) 90 days of frozen paper trading confirming the direction of the change.
// ═════════════════════════════════════════════════════════════════════════
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
  // ── Universe expansion Jun 26 2026 (validate-universe.ts, 1y 1H, live gates) ──
  //   Tested all 31 tradeable coins; promoted 7 not-yet-traded with strong 2026
  //   edge (PF≥1.84, exp≥+0.53R) to raise trade frequency on the proven workhorse
  //   (this strategy was the most robust OOS in the original walk-forward):
  //     SEI +0.83R/PF2.55  ETH +0.72R/PF2.20  SUI +0.70R/PF2.18  BNB +0.70R/PF2.13
  //     ARB +0.69R/PF2.13  TIA +0.64R/PF2.04  BTC +0.53R/PF1.84
  //   (SHIB +0.37R and ADA +0.01R left out — sample T<15 or no edge.)
  // ── Universe expansion Jul 2 2026 (script/expand-universe-ls.ts) ──
  //   Two-halves consistency screen (NOT the old 2026-only method): pass =
  //   T≥30 · PF≥1.5 · sumR>0 in BOTH halves of the 1y window, then accepted
  //   only after the FULL-PIPELINE portfolio run improved with them included.
  //   13 added: FET RENDER ONDO ENA WLD CRV GALA RUNE GRT IMX POL VET ADA
  //   12 rejected by screen: TRX ALGO XLM JUP WIF MKR MANA STX TAO AXS OP SHIB
  //   2 passed the screen but have NO tradeable MEXC futures contract
  //   (script/check-mexc-symbols.ts): TON (none) and BONK (only 1000BONK_USDT,
  //   1000× price scale — unsafe alias). Excluded so backtest = paper = live.
  // ── LUNC removed Aug 14 2026 — venue availability, NOT performance ────────
  //   Execution moved to Kraken (MEXC closed to PT residents). Kraken lists 40
  //   of these 41 symbols; LUNC is the one absent. Paper kept trading it, so
  //   the benchmark measured trades live could never take — and in the first
  //   42 days of paper LUNC went 4 for 4 for +8.8R, NINETEEN PERCENT of all
  //   paper profit, on a sample far too small to be anything but luck. The
  //   number the live engine is judged against was inflated by a coin it
  //   cannot buy.
  //   Full-pipeline A/B (validate-pipeline.ts, report 2026-08-11), the honest
  //   cost of removal:
  //     ALL   PF 1.93→1.90  sumR +703.1→+676.3 (−26.8R, −3.8%)  maxDD 31.2→30.9%
  //     2026  PF 1.91→1.87  sumR +466.1→+447.5 (−18.6R, −4.0%)
  //   Same principle as TON/BONK above: backtest = paper = live, or the
  //   comparison between them means nothing.
  preferredSymbols: ["UNI", "ICP", "AAVE", "PEPE", "INJ", "BCH", "FIL", "LTC", "ATOM", "AVAX", "XRP", "DOGE", "SOL", "ETC", "NEAR", "DOT", "SAND", "LINK", "APT", "HBAR", "SEI", "ETH", "SUI", "BNB", "ARB", "TIA", "BTC", "FET", "RENDER", "ONDO", "ENA", "WLD", "CRV", "GALA", "RUNE", "GRT", "IMX", "POL", "VET", "ADA"],
  cooldownHours: 12,  // matches backtest COOLDOWN=12h

  analyze(candles: OHLCV[]): StrategySignal | null {
    const sig = liquiditySweepSignal(candles);

    if (sig.type === "NONE") return null;

    // Minimum 60% confidence — lowered from 68 on 2026-08-14 via the audit's
    // pre-registered official A/B (script/audit/AUDIT-NOTES.md + report copy in
    // script/audit/validate-pipeline-report-LS-floor60.md): vs the shipped
    // config it adds ~385 trades/yr at flat-to-better expectancy — sumR +35%
    // ALL / +47% 2026, PF 1.97/2.07 — at the cost of sim maxDD 28.4%→42.7%
    // (risk accepted by the user; live runs 0.5% risk/trade). RAISING the floor
    // destroys edge (68→72 cost −248R ALL): confidence is informative above 68,
    // not below. 90-day paper confirmation window runs from 2026-08-14.
    if (sig.confidence < 60) return null;

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
