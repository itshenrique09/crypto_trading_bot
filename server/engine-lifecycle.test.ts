import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPausePolicy, decideEnginesToStart, parseGuardState, serializeGuardState, parseAppliedPolicy, parseIdList } from "./engine-lifecycle";
import { emptyDrawdownGuardState } from "./portfolio-guards";

const LS = { id: "liquidity-sweep", defaultPaused: { paper: true, live: true }, pausePolicyRev: 2 };
const TS = { id: "tsmom-daily", defaultPaused: { paper: false, live: true } };

test("pause policy: an install with an existing pause list still gets the new strategies' defaults (the Sep-2026 bug)", () => {
  // VPS state at the 2026-09-07 deploy: a live list existed (RSI paused since Aug) → old code skipped the defaults.
  const lists = { paper: new Set(["rsi-divergence"]), live: new Set(["rsi-divergence"]) };
  const r = applyPausePolicy([LS, TS], {}, lists);
  assert.ok(r.lists.live.has("liquidity-sweep") && r.lists.live.has("tsmom-daily"), "both paused on live");
  assert.ok(r.lists.paper.has("liquidity-sweep") && !r.lists.paper.has("tsmom-daily"), "LS paused on paper, TSMOM active on paper");
  assert.ok(r.lists.live.has("rsi-divergence"), "unrelated entries untouched");
  assert.deepEqual(r.applied, { "liquidity-sweep": 2, "tsmom-daily": 1 });
  assert.equal(r.changes.length, 3);
});

test("pause policy: applied revisions are respected — the user's manual toggles survive a restart", () => {
  const lists = { paper: new Set<string>(), live: new Set<string>() }; // user un-paused everything
  const r = applyPausePolicy([LS, TS], { "liquidity-sweep": 2, "tsmom-daily": 1 }, lists);
  assert.equal(r.changes.length, 0);
  assert.equal(r.lists.live.size, 0);
});

test("pause policy: a revision bump re-applies the registry default over a manual toggle, once", () => {
  const lists = { paper: new Set<string>(), live: new Set<string>() };
  const r1 = applyPausePolicy([LS], { "liquidity-sweep": 1 }, lists);
  assert.ok(r1.lists.paper.has("liquidity-sweep") && r1.lists.live.has("liquidity-sweep"));
  assert.equal(r1.applied["liquidity-sweep"], 2);
  const r2 = applyPausePolicy([LS], r1.applied, { paper: new Set(), live: new Set() }); // user toggles back on
  assert.equal(r2.changes.length, 0, "not re-applied until the next revision");
});

test("pause policy: a default of NOT paused removes a stale pause entry on first application", () => {
  const lists = { paper: new Set(["tsmom-daily"]), live: new Set<string>() };
  const r = applyPausePolicy([TS], {}, lists);
  assert.ok(!r.lists.paper.has("tsmom-daily"));
  assert.deepEqual(r.changes, [{ id: "tsmom-daily", mode: "paper", paused: false, rev: 1 }, { id: "tsmom-daily", mode: "live", paused: true, rev: 1 }]);
});

test("parse helpers tolerate garbage", () => {
  assert.deepEqual(parseAppliedPolicy("nope"), {});
  assert.deepEqual(parseAppliedPolicy(JSON.stringify({ a: 2, b: "x" })), { a: 2 });
  assert.deepEqual([...parseIdList("[1, \"x\"]")], ["x"]);
  assert.equal(parseIdList(null).size, 0);
});

test("boot: per-engine flags win when present, independently of the legacy mode", () => {
  const d = decideEnginesToStart({ paperRunning: "true", liveRunning: "true", mode: "live", openPaper: 0, openLive: 0, liveConfigured: true });
  assert.deepEqual([d.paper, d.live, d.migrated], [true, true, false]);
  const d2 = decideEnginesToStart({ paperRunning: "false", liveRunning: "true", mode: "paper", openPaper: 3, openLive: 0, liveConfigured: true });
  assert.deepEqual([d2.paper, d2.live], [false, true]);
});

test("boot: legacy install — mode=paper (last Start) with open live positions starts BOTH engines", () => {
  // The VPS on 2026-09-23: mode="paper" (paper Start pressed on Sep 18), 10 open live positions.
  const d = decideEnginesToStart({ paperRunning: null, liveRunning: null, mode: "paper", openPaper: 10, openLive: 10, liveConfigured: true });
  assert.deepEqual([d.paper, d.live, d.migrated], [true, true, true]);
  assert.equal(d.warnings.length, 0);
});

test("boot: legacy install — mode=live with open paper positions starts paper too (Sep 8-18 the paper book was dead)", () => {
  const d = decideEnginesToStart({ paperRunning: null, liveRunning: null, mode: "live", openPaper: 2, openLive: 0, liveConfigured: true });
  assert.deepEqual([d.paper, d.live], [true, true]);
});

test("boot: live never starts without a configured venue, and open live positions raise a warning", () => {
  const d = decideEnginesToStart({ paperRunning: "true", liveRunning: "true", mode: null, openPaper: 0, openLive: 4, liveConfigured: false });
  assert.deepEqual([d.paper, d.live], [true, false]);
  assert.match(d.warnings[0], /NOT being managed/);
  const d2 = decideEnginesToStart({ paperRunning: "true", liveRunning: "false", mode: null, openPaper: 0, openLive: 4, liveConfigured: true });
  assert.match(d2.warnings[0], /open live position/);
});

test("guard state round-trips through settings and rejects an un-expirable halt", () => {
  const s = { halted: true, haltedSinceMs: 1_000, rebasedAtCumR: -13.2, rebasedAtMs: 500 };
  assert.deepEqual(parseGuardState(serializeGuardState(s)), s);
  assert.deepEqual(parseGuardState(JSON.stringify({ halted: true })), emptyDrawdownGuardState());
  assert.deepEqual(parseGuardState("garbage"), emptyDrawdownGuardState());
  assert.deepEqual(parseGuardState(null), emptyDrawdownGuardState());
  // A re-base needs both halves; a half-written one is dropped, not half-applied.
  assert.deepEqual(parseGuardState(JSON.stringify({ halted: false, rebasedAtMs: 5 })), emptyDrawdownGuardState());
});
