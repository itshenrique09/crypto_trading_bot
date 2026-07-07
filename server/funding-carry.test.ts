import test from "node:test";
import assert from "node:assert/strict";
import {
  annualizeRate,
  countSettlements,
  lastSettlementBoundary,
  rankOpportunities,
  updateCarryState,
  emptyCarryState,
  DEFAULT_CARRY_CONFIG,
  type FundingSnapshot,
  type CarryConfig,
} from "./funding-carry";

const H8 = 8 * 3_600_000;

const cfg: CarryConfig = {
  ...DEFAULT_CARRY_CONFIG,
  entryAnnualized: 0.30,
  exitAnnualized: 0.10,
  notionalPerLeg: 1000,
  maxPositions: 2,
};

// entry/exit leg cost with defaults: 1000×(0.0002+0.0005) + 1000×(0.001+0.0005) = 0.7 + 1.5 = 2.2
const LEG_COST = 2.2;

function snap(symbol: string, rate: number): FundingSnapshot {
  return { symbol, rate, collectCycleHours: 8 };
}

test("annualizeRate scales a per-settlement rate to a yearly fraction", () => {
  // 0.01% per 8h → 3×/day × 365 = 10.95%/yr
  assert.ok(Math.abs(annualizeRate(0.0001, 8) - 0.1095) < 1e-9);
  assert.equal(annualizeRate(0.0001, 0), 0);
});

test("countSettlements counts epoch-aligned boundary crossings in (from, to]", () => {
  assert.equal(countSettlements(0, H8 - 1, 8), 0);
  assert.equal(countSettlements(0, H8, 8), 1);
  assert.equal(countSettlements(H8 - 1, H8 + 1, 8), 1);
  assert.equal(countSettlements(0, 3 * H8, 8), 3);
  assert.equal(countSettlements(H8, H8, 8), 0);        // empty interval
  assert.equal(countSettlements(2 * H8, H8, 8), 0);    // inverted interval
});

test("lastSettlementBoundary floors to the cycle grid", () => {
  assert.equal(lastSettlementBoundary(H8 + 123, 8), H8);
  assert.equal(lastSettlementBoundary(H8, 8), H8);
});

test("rankOpportunities sorts by |annualized| and flags negative funding as not simulatable", () => {
  const ranked = rankOpportunities([snap("A", 0.0001), snap("B", -0.0005), snap("C", 0.0003)]);
  assert.deepEqual(ranked.map(o => o.symbol), ["B", "C", "A"]);
  assert.equal(ranked[0].side, "long_perp");
  assert.equal(ranked[0].simulatable, false);
  assert.equal(ranked[1].side, "short_perp");
  assert.equal(ranked[1].simulatable, true);
});

test("opens only above the entry threshold, capped at maxPositions, charging entry costs", () => {
  // 0.0003/8h ≈ 32.85%/yr ≥ 30% entry; 0.0002 ≈ 21.9% < 30%
  const snaps = [snap("HOT1", 0.0004), snap("HOT2", 0.00035), snap("HOT3", 0.00032), snap("WARM", 0.0002)];
  const { state, events } = updateCarryState(emptyCarryState(), snaps, H8 + 1000, cfg);
  assert.equal(state.positions.length, 2); // maxPositions=2 — best two only
  assert.deepEqual(state.positions.map(p => p.symbol), ["HOT1", "HOT2"]);
  const opens = events.filter(e => e.action === "open");
  assert.equal(opens.length, 2);
  assert.ok(Math.abs(opens[0].pnlUsd - -LEG_COST) < 1e-9);
  // accrual cursor starts at the last boundary — no retroactive settlements
  assert.equal(state.positions[0].lastAccrualMs, H8);
});

test("accrues funding once per crossed settlement and keeps the position while hot", () => {
  const t0 = H8 + 1000;
  const open = updateCarryState(emptyCarryState(), [snap("X", 0.0004)], t0, cfg).state;
  // two boundaries later (2×8h)
  const t1 = 3 * H8 + 500;
  const { state, events } = updateCarryState(open, [snap("X", 0.0004)], t1, cfg);
  const settles = events.filter(e => e.action === "settle");
  assert.equal(settles.length, 1);
  assert.ok(Math.abs(settles[0].pnlUsd - 0.0004 * 1000 * 2) < 1e-9); // 2 settlements × $0.40
  assert.equal(state.positions.length, 1);
  assert.ok(Math.abs(state.positions[0].accruedUsd - 0.8) < 1e-9);
});

test("a flipped funding rate makes the short-perp position PAY, then exit closes it net of costs", () => {
  const t0 = H8 + 1000;
  const open = updateCarryState(emptyCarryState(), [snap("Y", 0.0004)], t0, cfg).state;
  // rate flips negative → annualized < exit threshold → pays one settlement, then closes
  const t1 = 2 * H8 + 500;
  const { state, events } = updateCarryState(open, [snap("Y", -0.0002)], t1, cfg);
  const settle = events.find(e => e.action === "settle")!;
  assert.ok(Math.abs(settle.pnlUsd - -0.2) < 1e-9); // paid 0.0002×1000×1
  const close = events.find(e => e.action === "close")!;
  // realized = accrued(−0.2) − entryCost(2.2) − exitCost(2.2) = −4.6
  assert.ok(Math.abs(close.pnlUsd - -4.6) < 1e-9);
  assert.equal(state.positions.length, 0);
  assert.equal(state.closedCount, 1);
  assert.ok(Math.abs(state.realizedUsd - -4.6) < 1e-9);
});

test("closes when funding decays below the exit threshold (hysteresis band holds it in between)", () => {
  const t0 = H8 + 1000;
  const open = updateCarryState(emptyCarryState(), [snap("Z", 0.0004)], t0, cfg).state;
  // 0.00015 ≈ 16.4%/yr — between exit (10%) and entry (30%): HOLD
  const hold = updateCarryState(open, [snap("Z", 0.00015)], t0 + 60_000, cfg);
  assert.equal(hold.state.positions.length, 1);
  // 0.00005 ≈ 5.5%/yr < 10%: CLOSE
  const closed = updateCarryState(hold.state, [snap("Z", 0.00005)], t0 + 120_000, cfg);
  assert.equal(closed.state.positions.length, 0);
  assert.equal(closed.state.closedCount, 1);
});

test("hedgeable-universe filter drops unhedgeable symbols from ranking/entry and closes strays", () => {
  const universe = new Set(["BTC", "ETH"]);
  const uniCfg: CarryConfig = { ...cfg, universe };
  const snaps = [snap("SKHYNIXSTOCK", 0.005), snap("BTC", 0.0004), snap("GARBAGE", 0.01)];

  // ranking with universe only contains BTC/ETH members
  const ranked = rankOpportunities(snaps, 0, universe);
  assert.deepEqual(ranked.map(o => o.symbol), ["BTC"]);

  // entry ignores the hotter unhedgeable funding and opens only BTC
  const t0 = H8 + 1000;
  const { state } = updateCarryState(emptyCarryState(), snaps, t0, uniCfg);
  assert.deepEqual(state.positions.map(p => p.symbol), ["BTC"]);

  // a stray held position outside the universe gets closed on the next tick
  const strayState = {
    ...emptyCarryState(),
    positions: [{
      symbol: "GARBAGE" as const, side: "short_perp" as const,
      openedAtMs: t0, lastAccrualMs: H8, entryAnnualized: 10, accruedUsd: 0, entryCostUsd: LEG_COST,
    }],
  };
  const cleaned = updateCarryState(strayState, snaps, t0 + 60_000, uniCfg);
  assert.equal(cleaned.state.positions.some(p => p.symbol === "GARBAGE"), false);
  assert.equal(cleaned.events.find(e => e.action === "close")!.note, "not in hedgeable universe — closed");
});

test("missing funding data for a held symbol closes the position defensively", () => {
  const t0 = H8 + 1000;
  const open = updateCarryState(emptyCarryState(), [snap("GONE", 0.0004)], t0, cfg).state;
  const { state, events } = updateCarryState(open, [], t0 + 60_000, cfg);
  assert.equal(state.positions.length, 0);
  assert.equal(events.find(e => e.action === "close")!.note, "funding data gone — closed");
});
