// ─── PORTFOLIO-LEVEL DRAWDOWN GUARDS ─────────────────────────────────────
// Pure, side-effect-free helpers shared by the paper and live engines so the
// two stay in lock-step (CLAUDE.md: paper and live must not drift).
//
// The engine already enforces:
//   • calendar daily   limit (−4R since 00:00)
//   • calendar monthly limit (−8R since the 1st)
//   • a per-strategy kill-switch
// These helpers add the missing pieces:
//   • a ROLLING-window portfolio halt — calendar limits reset on day/month
//     boundaries, so a slow multi-day grind can bleed indefinitely without
//     ever breaching a single-period cap. A rolling window has no such blind
//     spot.
//   • a reusable per-strategy kill-switch with a lower trade-count floor, so
//     low-frequency strategies (most of the suite) can actually be paused when
//     they bleed instead of only the high-frequency ones reaching the floor.

export interface ClosedTradeLite {
  closed_at?: string | null;
  pnl_usd?: number | null;
  risk_usd?: number | null;
  strategy?: string | null;
  outcome?: string | null;
}

/** Sum realized P&L (USD) of trades closed at or after `sinceMs`. */
export function sumPnlUsdSince(trades: ClosedTradeLite[], sinceMs: number): number {
  let sum = 0;
  for (const e of trades) {
    if (!e.closed_at) continue;
    if (new Date(e.closed_at).getTime() < sinceMs) continue;
    sum += e.pnl_usd ?? 0;
  }
  return sum;
}

/** Sum realized R (pnl_usd / risk_usd) of trades closed at or after `sinceMs`. */
export function sumNetRSince(trades: ClosedTradeLite[], sinceMs: number): number {
  let sum = 0;
  for (const e of trades) {
    if (!e.closed_at) continue;
    if (new Date(e.closed_at).getTime() < sinceMs) continue;
    if (!e.pnl_usd || !e.risk_usd || e.risk_usd <= 0) continue;
    sum += e.pnl_usd / e.risk_usd;
  }
  return sum;
}

export interface RollingDrawdownOpts {
  /** Length of the rolling window in milliseconds (e.g. 7 days). */
  windowMs: number;
  /** Loss budget expressed in R; breach when window P&L < −maxLossR × oneR. */
  maxLossR: number;
  /** Override "now" for deterministic tests. */
  now?: number;
}

/**
 * True when the portfolio's realized P&L over the rolling window is worse than
 * −maxLossR × oneR. `oneR` is the current per-trade dollar risk (balance × risk%).
 * Returns false when oneR is not positive (no basis to evaluate).
 */
export function isRollingDrawdownBreached(
  trades: ClosedTradeLite[],
  oneR: number,
  opts: RollingDrawdownOpts,
): boolean {
  if (!(oneR > 0)) return false;
  const since = (opts.now ?? Date.now()) - opts.windowMs;
  const pnl = sumPnlUsdSince(trades, since);
  return pnl < -Math.abs(opts.maxLossR) * oneR;
}

export interface KillSwitchOpts {
  /** Rolling lookback window in milliseconds (e.g. 7 days). */
  windowMs: number;
  /** Minimum closed trades in the window before the switch can fire. */
  minTrades: number;
  /** Pause when the strategy's window netR is below this (e.g. −3). */
  maxNetR: number;
  /** Override "now" for deterministic tests. */
  now?: number;
}

/**
 * Returns the set of strategy ids that should be paused: those with at least
 * `minTrades` closed trades in the window whose summed netR is below `maxNetR`.
 * Self-healing — re-evaluated each scan, so a strategy auto-resumes as losing
 * trades age past the window or new wins rebalance its netR.
 */
export function strategiesToPause(
  trades: ClosedTradeLite[],
  strategyIds: string[],
  opts: KillSwitchOpts,
): Set<string> {
  const since = (opts.now ?? Date.now()) - opts.windowMs;
  const paused = new Set<string>();
  for (const id of strategyIds) {
    const recent = trades.filter(
      e => e.strategy === id && e.closed_at && new Date(e.closed_at).getTime() >= since,
    );
    if (recent.length < opts.minTrades) continue;
    const netR = recent.reduce((s, e) => {
      if (!e.pnl_usd || !e.risk_usd || e.risk_usd <= 0) return s;
      return s + e.pnl_usd / e.risk_usd;
    }, 0);
    if (netR < opts.maxNetR) paused.add(id);
  }
  return paused;
}
