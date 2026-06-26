import test from "node:test";
import assert from "node:assert/strict";
import {
  sumPnlUsdSince,
  sumNetRSince,
  isRollingDrawdownBreached,
  strategiesToPause,
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
