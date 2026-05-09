import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTrailStop,
  deriveOriginalRiskFromJournal,
  DEFAULT_TRAIL_PCT,
  DEFAULT_R_MULTIPLE,
} from "./trailing-stop";

// ─── computeTrailStop — fixed_pct (legacy) ────────────────────────────────

test("fixed_pct LONG matches peak × (1 - 2%) by default", () => {
  const stop = computeTrailStop({
    direction: "LONG", peak: 100, entry: 90, originalRisk: 5, mode: "fixed_pct",
  });
  assert.equal(stop, 100 * (1 - DEFAULT_TRAIL_PCT));
});

test("fixed_pct SHORT matches peak × (1 + 2%)", () => {
  const stop = computeTrailStop({
    direction: "SHORT", peak: 80, entry: 90, originalRisk: 5, mode: "fixed_pct",
  });
  assert.equal(stop, 80 * (1 + DEFAULT_TRAIL_PCT));
});

test("fixed_pct respects custom fixedPct override", () => {
  const stop = computeTrailStop({
    direction: "LONG", peak: 100, entry: 90, originalRisk: 5,
    mode: "fixed_pct", fixedPct: 0.05,
  });
  assert.equal(stop, 100 * 0.95);
});

// ─── computeTrailStop — r_multiple (chandelier) ───────────────────────────

test("r_multiple LONG uses peak − k × risk", () => {
  // Entry 100, SL 95 (risk=5), TP1 hit, peak grew to 115
  // Default multiplier 2 → trailStop = 115 - 2*5 = 105
  const stop = computeTrailStop({
    direction: "LONG", peak: 115, entry: 100, originalRisk: 5, mode: "r_multiple",
  });
  assert.equal(stop, 105);
  assert.equal(DEFAULT_R_MULTIPLE, 2);
});

test("r_multiple SHORT uses peak + k × risk (peak is the LOW for shorts)", () => {
  // Entry 100, SL 105 (risk=5), TP1 hit, peak (low) reached 80
  // Trail = 80 + 2*5 = 90
  const stop = computeTrailStop({
    direction: "SHORT", peak: 80, entry: 100, originalRisk: 5, mode: "r_multiple",
  });
  assert.equal(stop, 90);
});

test("r_multiple respects custom multiplier", () => {
  const stop = computeTrailStop({
    direction: "LONG", peak: 115, entry: 100, originalRisk: 5,
    mode: "r_multiple", rMultiple: 1.5,
  });
  assert.equal(stop, 115 - 1.5 * 5);
});

test("r_multiple is wider than fixed_pct on tight-SL trades", () => {
  // Trade with 1% risk: entry=100, SL=99, peak=110
  // fixed_pct trail = 110 * 0.98 = 107.8 (10R+ above entry — locks 7.8R)
  // r_multiple trail = 110 - 2*1 = 108 (similar)
  // But on entry=100, SL=98 (risk=2), peak=110
  // fixed_pct = 107.8 (locks 3.9R)
  // r_multiple = 110 - 4 = 106 (locks 3R)
  const fixed = computeTrailStop({
    direction: "LONG", peak: 110, entry: 100, originalRisk: 2, mode: "fixed_pct",
  });
  const rMult = computeTrailStop({
    direction: "LONG", peak: 110, entry: 100, originalRisk: 2, mode: "r_multiple",
  });
  // r_multiple sits LOWER than fixed_pct here (more room) → the chandelier intent
  assert.ok(rMult < fixed,
    `expected r_multiple (${rMult}) to give more room than fixed_pct (${fixed}) on tight-SL trades`);
});

test("r_multiple falls back to fixed_pct when originalRisk is zero/missing", () => {
  // Defensive: a zero risk would make the trail = peak (instantly close).
  // The function must fall back to the safe legacy 2% trail.
  const stop = computeTrailStop({
    direction: "LONG", peak: 100, entry: 100, originalRisk: 0, mode: "r_multiple",
  });
  assert.equal(stop, 100 * (1 - DEFAULT_TRAIL_PCT));
});

test("r_multiple handles negative originalRisk via abs()", () => {
  // Inputs are taken from journal fields — we shouldn't assume sign.
  const stopNeg = computeTrailStop({
    direction: "LONG", peak: 115, entry: 100, originalRisk: -5, mode: "r_multiple",
  });
  const stopPos = computeTrailStop({
    direction: "LONG", peak: 115, entry: 100, originalRisk: 5, mode: "r_multiple",
  });
  assert.equal(stopNeg, stopPos);
});

// ─── deriveOriginalRiskFromJournal ────────────────────────────────────────

test("derives original entry-to-SL distance from journal fields", () => {
  // entry=100, SL=95 → SL_pct = 5/100 = 0.05
  // position_size = $1000, risk_usd = $50 → 50/1000 = 0.05 ✅
  // expected price-risk = 0.05 × 100 = 5
  const risk = deriveOriginalRiskFromJournal(50, 1000, 100);
  assert.equal(risk, 5);
});

test("returns 0 on missing or invalid fields (caller falls back to fixed_pct)", () => {
  assert.equal(deriveOriginalRiskFromJournal(null, 1000, 100), 0);
  assert.equal(deriveOriginalRiskFromJournal(50, null, 100), 0);
  assert.equal(deriveOriginalRiskFromJournal(50, 1000, null), 0);
  assert.equal(deriveOriginalRiskFromJournal(50, 0, 100), 0);
  assert.equal(deriveOriginalRiskFromJournal(50, 1000, 0), 0);
  assert.equal(deriveOriginalRiskFromJournal(undefined, undefined, undefined), 0);
});

test("derived risk roundtrips correctly through computeTrailStop", () => {
  // Real-world: entry $0.1063 (DOGE), SL $0.1037 (~2.4% risk)
  // position_size_usd = $520, risk_usd = $12.50, entry = $0.1063
  // Derived risk = (12.5/520) × 0.1063 ≈ $0.002555
  const risk = deriveOriginalRiskFromJournal(12.50, 520, 0.1063);
  assert.ok(Math.abs(risk - 0.002555) < 1e-5, `derived risk ${risk} ≈ 0.002555`);
  // Trail at 2R from peak 0.1125 → 0.1125 - 2*0.002555 = 0.10739 (above entry — locks gain)
  const stop = computeTrailStop({
    direction: "LONG", peak: 0.1125, entry: 0.1063, originalRisk: risk, mode: "r_multiple",
  });
  assert.ok(stop > 0.1063, "trail must sit above entry (in-profit)");
  assert.ok(stop < 0.1125, "trail must sit below peak");
});
