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

/**
 * Earliest moment the rolling-drawdown halt clears NATURALLY, assuming no
 * further closed trades: the window sum only improves as old losses age out,
 * which happens exactly when a trade's closed_at leaves the window. Returns
 * null when the halt is not active at `now`. Always terminates: with no new
 * trades every window eventually empties (sum 0 is never a breach).
 * The UI uses this for "halt termina em ~X" — an ESTIMATE, since any new loss
 * pushes it out again.
 */
export function rollingHaltClearsAt(
  trades: ClosedTradeLite[],
  oneR: number,
  opts: RollingDrawdownOpts,
): number | null {
  const now = opts.now ?? Date.now();
  if (!isRollingDrawdownBreached(trades, oneR, { ...opts, now })) return null;
  const exits = trades
    .filter(e => e.closed_at)
    .map(e => new Date(e.closed_at as string).getTime() + opts.windowMs + 1000)
    .filter(t => t > now)
    .sort((a, b) => a - b);
  for (const t of exits) {
    if (!isRollingDrawdownBreached(trades, oneR, { ...opts, now: t })) return t;
  }
  // Unreachable in practice (the last exit empties the window), kept as a
  // truthful fallback instead of pretending to know better.
  return exits.length ? exits[exits.length - 1] : now;
}

export interface MarginCapacityOpts {
  /** Notional already open, in USD. */
  openNotionalUsd: number;
  /** Notional the candidate position would add. */
  newNotionalUsd: number;
  /** Account equity backing it all. */
  equityUsd: number;
  /** Leverage the venue is set to allow. */
  leverage: number;
}

export interface MarginCapacityResult {
  fits: boolean;
  /** Total notional the account can carry: equity × leverage. */
  capacityUsd: number;
  /** Capacity not yet consumed. */
  freeUsd: number;
  /** Share of capacity already in use, 0–100+. */
  usedPct: number;
}

/**
 * Can the account actually post margin for one more position?
 *
 * Nothing modelled this — not the paper engine, not the live engine, not the
 * backtest harness. Position size is risk ÷ stop-distance, which does not
 * reference capital at all, so `maxOpen` positions can demand far more margin
 * than exists. At 2% risk and the 0.6% minimum stop, ONE position is 3.3× the
 * balance in notional and ten are 33×, against 7× configured. Paper opened them
 * regardless and reported the results; live sent the order and let the venue
 * reject it, losing the signal with nothing but an error line.
 *
 * Measured on 2026-08-14: paper held $8,735 of notional on $1,253 of equity —
 * 99.6% of its 7× capacity — with only 4 of its 10 permitted positions open.
 * Its `maxOpen 10` was never reachable, so every result it has ever reported
 * assumed leverage the account could not provide.
 */
export function checkMarginCapacity(opts: MarginCapacityOpts): MarginCapacityResult {
  const leverage = Math.max(1, opts.leverage);
  const equity = Math.max(0, opts.equityUsd);
  const capacityUsd = equity * leverage;
  const openNotional = Math.max(0, opts.openNotionalUsd);
  const freeUsd = Math.max(0, capacityUsd - openNotional);
  return {
    fits: opts.newNotionalUsd <= freeUsd,
    capacityUsd,
    freeUsd,
    usedPct: capacityUsd > 0 ? (openNotional / capacityUsd) * 100 : 100,
  };
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

// ─── PORTFOLIO DRAWDOWN GUARD (2026-09-03) ──────────────────────────────────
// One guard on one process: the realized equity curve in trade-R (Σ pnl/risk,
// one point per closed trade), its peak inside a rolling window, and the
// drawdown from that peak. Hysteresis — halt at ≥ haltR, resume at ≤ resumeR —
// so a halt does not flicker; a bounded halt — on `maxHaltMs` expiry the peak
// is re-based to the current level — so a slow bleed cannot freeze the engine
// until the peak ages out of the window (pure hysteresis on a zero-edge stream
// halted 17–23% of the calendar; bounded halts 3–4%). Replaces the daily /
// rolling-7d / kill-switch trio (see server/engine-config.ts GUARD).
// Reference implementation validated in script/audit/phase9-design.ts and
// phase9-portfolio.ts; this is a verbatim port.

export interface DrawdownGuardOpts {
  /** Rolling window that a peak must fall inside to count (e.g. 30 days). */
  peakWindowMs: number;
  /** Halt when drawdown from the peak reaches this many trade-R. */
  haltR: number;
  /** Resume once the drawdown has recovered to this many trade-R or less. */
  resumeR: number;
  /** A halt never lasts longer than this; on expiry the peak is re-based. */
  maxHaltMs: number;
  /** Override "now" for deterministic tests. */
  now?: number;
}

export interface DrawdownGuardState {
  halted: boolean;
  haltedSinceMs: number | null;
  /** Level the peak was pinned to when the last halt expired (ages out with the window). */
  rebasedAtCumR?: number | null;
  rebasedAtMs?: number | null;
}

export interface DrawdownGuardEval {
  state: DrawdownGuardState;
  /** Σ pnl/risk over every closed trade (realized equity in trade-R). */
  cumR: number;
  /** Reference peak (trade-R) the drawdown is measured from. */
  peakR: number;
  /** peakR − cumR, ≥ 0. */
  ddR: number;
  transition: "none" | "halt" | "resume" | "expire";
}

export function emptyDrawdownGuardState(): DrawdownGuardState {
  return { halted: false, haltedSinceMs: null, rebasedAtCumR: null, rebasedAtMs: null };
}

export function evaluateDrawdownGuard(
  trades: ClosedTradeLite[],
  prev: DrawdownGuardState,
  opts: DrawdownGuardOpts,
): DrawdownGuardEval {
  const now = opts.now ?? Date.now();
  const closed = trades
    .filter(e => e.closed_at && e.risk_usd && e.risk_usd > 0)
    .map(e => ({ t: new Date(e.closed_at as string).getTime(), r: (e.pnl_usd ?? 0) / (e.risk_usd as number) }))
    .sort((a, b) => a.t - b.t);
  const points: Array<{ t: number; cum: number }> = [];
  let cum = 0;
  for (const c of closed) { cum += c.r; points.push({ t: c.t, cum }); }
  // Reference peak = highest point that is BOTH inside the rolling window AND at
  // or after the last re-base. The current point always qualifies (dd ≥ 0). The
  // origin (cum 0 before the first trade) qualifies only if the curve started
  // inside that span. A re-base pins the peak at the re-base level until it ages
  // out of the window like any other point.
  const since = Math.max(now - opts.peakWindowMs, prev.rebasedAtMs ?? -Infinity);
  let peak = cum;
  for (const p of points) if (p.t >= since && p.cum > peak) peak = p.cum;
  if (closed.length === 0 || closed[0].t >= since) peak = Math.max(peak, 0);
  if (prev.rebasedAtMs != null && prev.rebasedAtCumR != null && prev.rebasedAtMs >= now - opts.peakWindowMs) {
    peak = Math.max(peak, prev.rebasedAtCumR);
  }
  const dd = peak - cum;
  let state: DrawdownGuardState = { ...prev };
  let transition: DrawdownGuardEval["transition"] = "none";
  if (!prev.halted) {
    if (dd >= opts.haltR) { state = { ...state, halted: true, haltedSinceMs: now }; transition = "halt"; }
  } else {
    const expired = prev.haltedSinceMs != null && now - prev.haltedSinceMs >= opts.maxHaltMs;
    if (dd <= opts.resumeR) { state = { ...state, halted: false, haltedSinceMs: null }; transition = "resume"; }
    else if (expired) { state = { halted: false, haltedSinceMs: null, rebasedAtCumR: cum, rebasedAtMs: now }; transition = "expire"; }
  }
  return { state, cumR: cum, peakR: peak, ddR: dd, transition };
}
