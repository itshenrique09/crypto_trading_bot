// ─── ENGINE CONFIG — constants shared by the engines AND the validation harness ──
// Everything here is imported by server/routes.ts (paper + live) and by
// script/validate-pipeline.ts / script/audit/lib.ts. The August 2026 look-ahead
// survived for months partly because gate constants lived in three hand-mirrored
// copies; anything that both sides must agree on goes here and nowhere else.

/**
 * Portfolio drawdown guard (2026-09-03, replaces daily −4R / rolling-7d −6R /
 * per-strategy kill-switch, which measured one process in three overlapping
 * ways: 58% of guard-blocked entries had ≥2 guards co-firing, halts lasted
 * ~7× the losing cluster that caused them, and the 1R unit was balance×base%
 * while trades were sized at base×1.25).
 *
 * Realized equity in trade-R (Σ pnl/risk); peak = highest point within the
 * rolling `peakWindowDays`; HALT when drawdown ≥ haltR, RESUME when it has
 * recovered to ≤ resumeR (hysteresis), and a halt never outlives
 * `maxHaltHours` — on expiry the peak is re-based to the current level so a
 * slow bleed cannot freeze the engine for weeks. Calibrated on the phase-9
 * candidate book (LS SHORT·BTC-up + TSMOM, 2.3y): X=12 kept 99% of the
 * no-guard sumR with maxDD 16.9R vs 24.0R under the old trio, 0.3% of the
 * calendar halted (script/audit/phase9-report-portfolio.md).
 */
export const GUARD = {
  peakWindowDays: 30,
  haltR: 12,
  resumeR: 6,
  maxHaltHours: 24,
} as const;

/** Max hold per strategy interval, in hours — parity with the harness (200 bars for 1h/1d, 60 bars for 4h). */
export const MAX_HOLD_HOURS_BY_INTERVAL: Record<string, number> = { "1h": 200, "4h": 240, "1d": 200 * 24 };

/**
 * Scan timing. Strategies decide on the last CLOSED candle, so the scan runs
 * at every candle close + `closeOffsetMs` (data feeds publish the closed bar
 * within seconds) with one retry at `retryOffsetMs` in case the first fetch
 * was early or failed. Anything older than `maxSignalAgeMin` is skipped: a
 * sweep reversal is a moment, not a level.
 */
export const SCAN = {
  closeOffsetMs: 30_000,
  retryOffsetMs: 210_000,
  maxSignalAgeMin: 10,
} as const;
