// ─── TRAILING STOP COMPUTATION ───────────────────────────────────────────
// Decides where the trailing stop sits after TP1 has been hit. Three modes:
//
//   • "fixed_pct"   — peak × (1 ± trailingPct)            (legacy, default 2%)
//   • "r_multiple"  — peak ± (R-multiple × original risk) (chandelier-style)
//
// Why R-multiple instead of ATR-based chandelier:
//   The SL at entry is structural (anchored to the last meaningful swing +
//   a small ATR buffer), so |entry − stop_loss| already encodes the
//   trade-specific volatility. Trailing in units of R adapts to each
//   trade's natural noise without needing a separate ATR field on the
//   journal. "Trail at 2R from peak" is also how discretionary pros
//   describe the runner — clean mental model, easy to reason about.
//
// Why this isn't just "make TRAIL_PCT bigger":
//   Crypto trades have wildly different SL distances. A tight-SL momentum
//   entry (0.8% risk) trailed at 2% gets thrown out by normal noise; a
//   loose-SL swing entry (3% risk) trailed at 2% is so tight the runner
//   never gets to breathe past TP1. Making the trail proportional to the
//   trade's own risk fixes both ends.
//
// Default behaviour preserved:
//   When mode is "fixed_pct" (no setting present) the function returns
//   exactly peak × (1 ± 0.02), matching the prior production code.

export type TrailingMode = "fixed_pct" | "r_multiple";

export interface TrailingStopInputs {
  direction: "LONG" | "SHORT";
  peak: number;          // best in-favour price reached so far
  entry: number;         // original entry price
  originalRisk: number;  // |entry - stop_loss| at entry time (price-distance, NOT R)
  mode: TrailingMode;
  fixedPct?: number;       // for "fixed_pct" mode — defaults to 0.02 (2%)
  rMultiple?: number;      // for "r_multiple" mode — defaults to 2.0
}

export const DEFAULT_TRAIL_PCT = 0.02;
export const DEFAULT_R_MULTIPLE = 2.0;

export function computeTrailStop(input: TrailingStopInputs): number {
  const { direction, peak, entry, originalRisk, mode } = input;
  const isLong = direction === "LONG";

  if (mode === "r_multiple") {
    const k = input.rMultiple ?? DEFAULT_R_MULTIPLE;
    // originalRisk must be positive — guard against degenerate input
    const safeRisk = Math.abs(originalRisk);
    if (safeRisk <= 0) {
      // Fall back to fixed-pct so we never return entry (which would
      // make the trail stop = breakeven and instantly close the runner)
      return isLong ? peak * (1 - DEFAULT_TRAIL_PCT) : peak * (1 + DEFAULT_TRAIL_PCT);
    }
    return isLong ? peak - k * safeRisk : peak + k * safeRisk;
  }

  // fixed_pct (legacy)
  const pct = input.fixedPct ?? DEFAULT_TRAIL_PCT;
  return isLong ? peak * (1 - pct) : peak * (1 + pct);
}

// Compute the original entry-to-SL distance from journal fields, even
// after the live SL has been moved to break-even post-TP1.
//
// The trade row stores:
//   • risk_usd          = position-level $ risk at entry
//   • position_size_usd = notional position size
//   • entry_price       = original entry price
//
// risk_usd / position_size_usd = |entry - SL| / entry  (the SL distance %)
// Therefore original_price_risk = (risk_usd / position_size_usd) × entry_price
//
// CAVEAT (2026-08-21): the ratio inference above is only valid when risk_usd
// and position_size_usd describe the SAME position size. Right-sized live
// trades broke that (risk_usd post-trim, position_size pre-trim) and the 2R
// trail silently ran at ~1-1.8R on them. Rows written since then carry the
// stop distance explicitly in entry_risk_dist — prefer it whenever present;
// the ratio stays as the fallback for older rows.
//
// Returns 0 if the inputs are insufficient — caller should treat as "fall
// back to fixed_pct mode" via the safeRisk guard above.
export function deriveOriginalRiskFromJournal(
  riskUsd: number | null | undefined,
  positionSizeUsd: number | null | undefined,
  entryPrice: number | null | undefined,
  entryRiskDist?: number | null,
): number {
  if (entryRiskDist && entryRiskDist > 0 && entryPrice && entryPrice > 0) {
    return entryRiskDist * entryPrice;
  }
  if (!riskUsd || !positionSizeUsd || !entryPrice) return 0;
  if (positionSizeUsd <= 0 || entryPrice <= 0) return 0;
  return (Math.abs(riskUsd) / positionSizeUsd) * entryPrice;
}
