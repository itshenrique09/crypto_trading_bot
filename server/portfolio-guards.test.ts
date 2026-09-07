import test from "node:test";
import assert from "node:assert/strict";
import {
  sumPnlUsdSince,
  sumNetRSince,
  isRollingDrawdownBreached,
  rollingHaltClearsAt,
  strategiesToPause,
  checkMarginCapacity,
  type ClosedTradeLite,
} from "./portfolio-guards";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 5, 12, 12, 0, 0); // fixed clock for determinism

function at(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString();
}

test("sumPnlUsdSince includes only trades closed at or after the cutoff", () => {
  const trades: ClosedTradeLite[] = [
    { closed_at: at(1), pnl_usd: -10 },
    { closed_at: at(3), pnl_usd: -10 },
    { closed_at: at(9), pnl_usd: -100 }, // outside a 7d window
  ];
  assert.equal(sumPnlUsdSince(trades, NOW - 7 * DAY), -20);
});

test("sumPnlUsdSince treats null pnl and never-closed trades as zero", () => {
  const trades: ClosedTradeLite[] = [
    { closed_at: at(1), pnl_usd: null },
    { closed_at: at(1) },
    { closed_at: null, pnl_usd: -999 }, // never closed → ignored
  ];
  assert.equal(sumPnlUsdSince(trades, NOW - 7 * DAY), 0);
});

test("sumNetRSince sums pnl_usd / risk_usd and ignores rows with no/zero risk", () => {
  const trades: ClosedTradeLite[] = [
    { closed_at: at(1), pnl_usd: -8, risk_usd: 8 }, // -1R
    { closed_at: at(2), pnl_usd: 20, risk_usd: 8 }, // +2.5R
    { closed_at: at(2), pnl_usd: -8, risk_usd: 0 }, // ignored (risk 0)
    { closed_at: at(2), pnl_usd: -8 }, // ignored (no risk)
  ];
  assert.ok(Math.abs(sumNetRSince(trades, NOW - 7 * DAY) - 1.5) < 1e-9);
});

test("isRollingDrawdownBreached does not trip on a normal losing week", () => {
  const oneR = 10;
  // worst observed real week was ~-2.76R — must not trip a -6R guard
  const trades: ClosedTradeLite[] = [
    { closed_at: at(1), pnl_usd: -11 },
    { closed_at: at(2), pnl_usd: -12 },
    { closed_at: at(3), pnl_usd: 28 },
    { closed_at: at(4), pnl_usd: -10 },
  ];
  assert.equal(
    isRollingDrawdownBreached(trades, oneR, { windowMs: 7 * DAY, maxLossR: 6, now: NOW }),
    false,
  );
});

test("isRollingDrawdownBreached trips when window loss exceeds the R budget", () => {
  const oneR = 10;
  const trades: ClosedTradeLite[] = Array.from({ length: 7 }, (_, i) => ({
    closed_at: at(i),
    pnl_usd: -10, // 7 × -1R = -7R < -6R
  }));
  assert.equal(
    isRollingDrawdownBreached(trades, oneR, { windowMs: 7 * DAY, maxLossR: 6, now: NOW }),
    true,
  );
});

test("isRollingDrawdownBreached ignores losses aged out of the window", () => {
  const oneR = 10;
  const trades: ClosedTradeLite[] = [
    { closed_at: at(8), pnl_usd: -100 }, // 8 days ago — outside 7d window
    { closed_at: at(1), pnl_usd: -10 },
  ];
  assert.equal(
    isRollingDrawdownBreached(trades, oneR, { windowMs: 7 * DAY, maxLossR: 6, now: NOW }),
    false,
  );
});

test("isRollingDrawdownBreached returns false when oneR is not positive", () => {
  const trades: ClosedTradeLite[] = [{ closed_at: at(1), pnl_usd: -999 }];
  assert.equal(
    isRollingDrawdownBreached(trades, 0, { windowMs: 7 * DAY, maxLossR: 6, now: NOW }),
    false,
  );
});

const KILL_OPTS = { windowMs: 7 * DAY, minTrades: 4, maxNetR: -3, now: NOW };

test("strategiesToPause pauses a strategy that bled past the threshold with enough trades", () => {
  const trades: ClosedTradeLite[] = Array.from({ length: 4 }, (_, i) => ({
    closed_at: at(i),
    strategy: "rsi-divergence",
    pnl_usd: -10,
    risk_usd: 10, // 4 × -1R = -4R < -3R
  }));
  const paused = strategiesToPause(trades, ["rsi-divergence", "break-retest"], KILL_OPTS);
  assert.equal(paused.has("rsi-divergence"), true);
  assert.equal(paused.has("break-retest"), false);
});

test("strategiesToPause does NOT pause below the trade-count floor even if deeply negative", () => {
  // 3 straight losses (-3R) must not pause at a 4-trade floor — too small a sample
  const trades: ClosedTradeLite[] = Array.from({ length: 3 }, (_, i) => ({
    closed_at: at(i),
    strategy: "rsi-divergence",
    pnl_usd: -10,
    risk_usd: 10,
  }));
  assert.equal(strategiesToPause(trades, ["rsi-divergence"], KILL_OPTS).size, 0);
});

test("strategiesToPause does not pause when wins rebalance netR above the threshold", () => {
  const trades: ClosedTradeLite[] = [
    { closed_at: at(1), strategy: "liquidity-sweep", pnl_usd: -10, risk_usd: 10 },
    { closed_at: at(2), strategy: "liquidity-sweep", pnl_usd: -10, risk_usd: 10 },
    { closed_at: at(3), strategy: "liquidity-sweep", pnl_usd: -10, risk_usd: 10 },
    { closed_at: at(4), strategy: "liquidity-sweep", pnl_usd: 28, risk_usd: 10 }, // +2.8R → net -0.2R
  ];
  assert.equal(strategiesToPause(trades, ["liquidity-sweep"], KILL_OPTS).size, 0);
});

test("strategiesToPause auto-resumes as losses age out of the window", () => {
  const trades: ClosedTradeLite[] = Array.from({ length: 4 }, (_, i) => ({
    closed_at: at(8 + i), // all older than 7 days
    strategy: "rsi-divergence",
    pnl_usd: -10,
    risk_usd: 10,
  }));
  assert.equal(strategiesToPause(trades, ["rsi-divergence"], KILL_OPTS).size, 0);
});

// ── rolling halt: when does it clear naturally? ───────────────────────────

test("rollingHaltClearsAt is null while the halt is not active", () => {
  const trades = [{ strategy: "ls", closed_at: new Date(NOW - DAY).toISOString(), pnl_usd: -10, risk_usd: 10, outcome: "loss" }];
  assert.equal(rollingHaltClearsAt(trades, 10, { windowMs: 7 * DAY, maxLossR: 6, now: NOW }), null);
});

test("rollingHaltClearsAt lands right after the breaching loss ages out of the window", () => {
  // One −70 loss (7R at oneR=10) closed 2 days ago breaches −6R; it leaves the
  // 7-day window 5 days from now (closed_at + 7d).
  const closedAt = NOW - 2 * DAY;
  const trades = [{ strategy: "ls", closed_at: new Date(closedAt).toISOString(), pnl_usd: -70, risk_usd: 10, outcome: "loss" }];
  const clears = rollingHaltClearsAt(trades, 10, { windowMs: 7 * DAY, maxLossR: 6, now: NOW });
  assert.ok(clears != null);
  assert.ok(Math.abs((clears as number) - (closedAt + 7 * DAY + 1000)) < 2000);
  assert.equal(isRollingDrawdownBreached(trades, 10, { windowMs: 7 * DAY, maxLossR: 6, now: clears as number }), false);
});

test("rollingHaltClearsAt waits for ENOUGH losses to age out, not just the first", () => {
  // Two −40 losses (4R each): dropping only the older one leaves −4R (fine),
  // so the halt clears when the FIRST exits; but three −30s need two exits.
  const t = (daysAgo: number, pnl: number) => ({ strategy: "ls", closed_at: new Date(NOW - daysAgo * DAY).toISOString(), pnl_usd: pnl, risk_usd: 10, outcome: "loss" });
  const three = [t(6, -30), t(4, -30), t(2, -30)]; // −9R total
  const clears = rollingHaltClearsAt(three, 10, { windowMs: 7 * DAY, maxLossR: 6, now: NOW });
  // After the 6-days-ago loss exits (in 1 day): −6R = not < −6R → clears there.
  assert.ok(Math.abs((clears as number) - (NOW - 6 * DAY + 7 * DAY + 1000)) < 2000);
  const worse = [t(6, -40), t(4, -40), t(2, -40)]; // −12R: one exit leaves −8R, still breached
  const clears2 = rollingHaltClearsAt(worse, 10, { windowMs: 7 * DAY, maxLossR: 6, now: NOW });
  assert.ok(Math.abs((clears2 as number) - (NOW - 4 * DAY + 7 * DAY + 1000)) < 2000);
});

// ── margin capacity ───────────────────────────────────────────────────────
// Nothing modelled this before: position size is risk ÷ stop-distance and never
// consults capital, so maxOpen positions could demand far more margin than the
// account holds. Real state on 2026-08-14: paper carried $8,735 of notional on
// $1,253 of equity at 7x — 99.6% of capacity — with 4 of its 10 permitted
// positions open.

test("margin capacity refuses a position the account cannot post margin for", () => {
  const r = checkMarginCapacity({
    openNotionalUsd: 8_735, newNotionalUsd: 2_900, equityUsd: 1_253.2, leverage: 7,
  });
  assert.equal(r.fits, false);
  assert.ok(Math.abs(r.capacityUsd - 8_772.4) < 0.1);
  assert.ok(r.usedPct > 99 && r.usedPct < 100);
});

test("margin capacity allows what fits, to the dollar", () => {
  const base = { openNotionalUsd: 8_735, equityUsd: 1_253.2, leverage: 7 };
  assert.equal(checkMarginCapacity({ ...base, newNotionalUsd: 37 }).fits, true);
  assert.equal(checkMarginCapacity({ ...base, newNotionalUsd: 38 }).fits, false);
});

test("margin capacity: live's 0.5% risk fits ten positions where paper's 2% does not", () => {
  // The configurations differ by 4x in risk and it decides whether maxOpen is
  // reachable at all. Typical stop distance ~0.8%, so notional = risk / 0.008.
  const ten = (equity: number, riskPct: number) => {
    const notional = (equity * riskPct / 100) / 0.008;
    return checkMarginCapacity({
      openNotionalUsd: notional * 9, newNotionalUsd: notional, equityUsd: equity, leverage: 7,
    });
  };
  assert.equal(ten(117, 0.5).fits, true);    // live: 6.25x needed, 7x available
  assert.equal(ten(1_253, 2).fits, false);   // paper: 25x needed — impossible
});

test("margin capacity degrades safely on nonsense inputs", () => {
  // A zero or negative equity must never read as unlimited room.
  assert.equal(checkMarginCapacity({ openNotionalUsd: 0, newNotionalUsd: 1, equityUsd: 0, leverage: 7 }).fits, false);
  assert.equal(checkMarginCapacity({ openNotionalUsd: 0, newNotionalUsd: 1, equityUsd: -50, leverage: 7 }).fits, false);
  // leverage below 1x is treated as 1x rather than shrinking capacity to zero
  assert.equal(checkMarginCapacity({ openNotionalUsd: 0, newNotionalUsd: 100, equityUsd: 100, leverage: 0 }).fits, true);
  // already over capacity: free is clamped at zero, never negative
  const over = checkMarginCapacity({ openNotionalUsd: 20_000, newNotionalUsd: 1, equityUsd: 1_000, leverage: 7 });
  assert.equal(over.freeUsd, 0);
  assert.equal(over.fits, false);
});

// ── Drawdown guard (2026-09-03) ─────────────────────────────────────────────
import { evaluateDrawdownGuard, emptyDrawdownGuardState } from "./portfolio-guards";

const DAY_MS = 86_400_000;
const ddOpts = { peakWindowMs: 30 * DAY_MS, haltR: 12, resumeR: 6, maxHaltMs: 24 * 3_600_000 };
function tradesFromR(rs: number[], startMs: number, stepMs = 3_600_000) {
  return rs.map((r, i) => ({ closed_at: new Date(startMs + i * stepMs).toISOString(), pnl_usd: r * 10, risk_usd: 10, strategy: "x", outcome: r >= 0 ? "win" : "loss" }));
}

test("drawdown guard halts at ≥ haltR below the rolling peak and resumes with hysteresis", () => {
  const t0 = Date.UTC(2026, 8, 1);
  // climb +8R, then bleed −12R → dd 12R from the peak → halt
  const rs = [2, 2, 2, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
  const trades = tradesFromR(rs, t0);
  let state = emptyDrawdownGuardState();
  const now = t0 + rs.length * 3_600_000;
  const ev = evaluateDrawdownGuard(trades, state, { ...ddOpts, now });
  assert.equal(ev.peakR, 8);
  assert.equal(ev.cumR, -4);
  assert.equal(ev.ddR, 12);
  assert.equal(ev.transition, "halt");
  assert.equal(ev.state.halted, true);
  state = ev.state;
  // recovering to dd 7R is not enough (resume ≤ 6R)
  const recovering = [...trades, ...tradesFromR([5], now)];
  const ev2 = evaluateDrawdownGuard(recovering, state, { ...ddOpts, now: now + 3_600_000 });
  assert.equal(ev2.ddR, 7);
  assert.equal(ev2.state.halted, true);
  assert.equal(ev2.transition, "none");
  // dd 5R → resume
  const recovered = [...recovering, ...tradesFromR([2], now + 3_600_000)];
  const ev3 = evaluateDrawdownGuard(recovered, ev2.state, { ...ddOpts, now: now + 2 * 3_600_000 });
  assert.equal(ev3.ddR, 5);
  assert.equal(ev3.transition, "resume");
  assert.equal(ev3.state.halted, false);
});

test("a halt expires after maxHaltMs and re-bases the peak so a slow bleed cannot freeze the engine", () => {
  const t0 = Date.UTC(2026, 8, 1);
  const trades = tradesFromR([-2, -2, -2, -2, -2, -2], t0);
  const now = t0 + 6 * 3_600_000;
  const halted = evaluateDrawdownGuard(trades, emptyDrawdownGuardState(), { ...ddOpts, now });
  assert.equal(halted.transition, "halt");        // origin peak 0 → dd 12
  // 25h later, no recovery: the halt expires and the peak is pinned at the current level
  const later = now + 25 * 3_600_000;
  const expired = evaluateDrawdownGuard(trades, halted.state, { ...ddOpts, now: later });
  assert.equal(expired.transition, "expire");
  assert.equal(expired.state.halted, false);
  assert.equal(expired.state.rebasedAtCumR, -12);
  // after the re-base the drawdown is measured from −12, not from 0
  const after = evaluateDrawdownGuard(trades, expired.state, { ...ddOpts, now: later + 1000 });
  assert.equal(after.ddR, 0);
  assert.equal(after.state.halted, false);
});

test("peaks older than the window no longer count", () => {
  const t0 = Date.UTC(2026, 6, 1);
  const old = tradesFromR([10, 10], t0);                                  // +20R two months ago
  const recent = tradesFromR([-1, -1, -1, -1, -1], t0 + 60 * DAY_MS);     // −5R now
  const now = t0 + 60 * DAY_MS + 6 * 3_600_000;
  const ev = evaluateDrawdownGuard([...old, ...recent], emptyDrawdownGuardState(), { ...ddOpts, now });
  assert.equal(ev.cumR, 15);
  assert.equal(ev.peakR, 20 - 1);   // highest point INSIDE the window = after the first recent loss
  assert.equal(ev.ddR, 4);
  assert.equal(ev.state.halted, false);
});
