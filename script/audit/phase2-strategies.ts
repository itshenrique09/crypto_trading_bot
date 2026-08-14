// ─── AUDIT PHASE 2: strategy triage — pre-registered (see AUDIT-NOTES.md) ───
// P2.1 marginal contribution: ENGINE minus/only each strategy (6 confirmatory arms)
// P2.2 temporal stability per strategy (descriptive, from baseline trades)
// P2.3 confidence-floor sweeps via direct signal calls (robustness diagnostic)
// Run: npx tsx script/audit/phase2-strategies.ts

import { writeFileSync, mkdirSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { liquiditySweepSignal, rsiDivergenceSignal, breakRetestSignal, type OHLCV } from "../../server/analysis";
import type { Strategy, StrategySignal } from "../../server/strategies/types";
import {
  loadMarketData, buildCandidatesTagged, resolveExitsFull, simulateEngineCurrent,
  stats, bootstrapCI, maxDrawdownR, expWithoutTopK, ENGINE_EXIT, YEAR_2026_TS,
  type AuditCandidate, type AuditTrade,
} from "./lib";

const TOTAL_CANDLES = 8000;
const START_CAPITAL = 500;
const BASE_RISK_PCT = 2;

interface ArmSummary {
  id: string;
  all: { n: number; sumR: number; exp: number; lo: number; hi: number; pf: number; ddR: number; expNoTop5: number };
  y26: { n: number; sumR: number; exp: number; lo: number; hi: number; pf: number };
  perStrategy: Record<string, { nAll: number; sumRAll: number; expAll: number; n26: number; sumR26: number; exp26: number }>;
}

function summarize(id: string, trades: AuditTrade[], strategies: Strategy[]): ArmSummary {
  const rsAll = trades.map(t => t.netR);
  const t26 = trades.filter(t => t.openedSec >= YEAR_2026_TS);
  const rs26 = t26.map(t => t.netR);
  const a = stats(rsAll), y = stats(rs26);
  const ca = bootstrapCI(rsAll), cy = bootstrapCI(rs26);
  const perStrategy: ArmSummary["perStrategy"] = {};
  for (const s of strategies) {
    const st = trades.filter(t => t.strategy === s.id);
    const st26 = st.filter(t => t.openedSec >= YEAR_2026_TS);
    if (!st.length) continue;
    const sa = stats(st.map(t => t.netR)), s6 = stats(st26.map(t => t.netR));
    perStrategy[s.id] = { nAll: sa.n, sumRAll: sa.sumR, expAll: sa.exp, n26: s6.n, sumR26: s6.sumR, exp26: s6.exp };
  }
  return {
    id,
    all: { n: a.n, sumR: a.sumR, exp: a.exp, lo: ca.lo, hi: ca.hi, pf: a.pf, ddR: maxDrawdownR(rsAll), expNoTop5: expWithoutTopK(rsAll, 5) },
    y26: { n: y.n, sumR: y.sumR, exp: y.exp, lo: cy.lo, hi: cy.hi, pf: y.pf },
    perStrategy,
  };
}

function fmtArm(s: ArmSummary, base?: ArmSummary): string {
  const d = base ? `  ΔsumR_all=${(s.all.sumR - base.all.sumR >= 0 ? "+" : "") + (s.all.sumR - base.all.sumR).toFixed(1)} ΔsumR_26=${(s.y26.sumR - base.y26.sumR >= 0 ? "+" : "") + (s.y26.sumR - base.y26.sumR).toFixed(1)}` : "";
  return `${s.id.padEnd(24)} ALL T=${String(s.all.n).padStart(4)} sumR=${(s.all.sumR >= 0 ? "+" : "") + s.all.sumR.toFixed(1)} exp=${(s.all.exp >= 0 ? "+" : "") + s.all.exp.toFixed(3)} [${s.all.lo.toFixed(3)},${s.all.hi.toFixed(3)}] PF=${s.all.pf.toFixed(2)} DD=${s.all.ddR.toFixed(1)}R | 2026 T=${String(s.y26.n).padStart(3)} sumR=${(s.y26.sumR >= 0 ? "+" : "") + s.y26.sumR.toFixed(1)} exp=${(s.y26.exp >= 0 ? "+" : "") + s.y26.exp.toFixed(3)}${d}`;
}

async function main() {
  const strategies = getAllStrategies();
  console.log("loading market data...");
  const { streams, md } = await loadMarketData(strategies, TOTAL_CANDLES);

  console.log("building production candidates...");
  const tagged: AuditCandidate[] = [];
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      const candles = streams.get(`${sym}:${strat.interval}`);
      if (!candles) continue;
      tagged.push(...buildCandidatesTagged(strat, sym, candles));
    }
  }
  tagged.forEach((c, i) => { c.idx = i; });
  const accepted = tagged.filter(c => !c.rejectMinSL && !c.rejectMinRR);
  const exits = resolveExitsFull(tagged, streams, ENGINE_EXIT);

  const run = (id: string, cands: AuditCandidate[], exitArr = exits): ArmSummary => {
    const sim = simulateEngineCurrent(cands, exitArr, md, strategies, START_CAPITAL, BASE_RISK_PCT);
    return summarize(id, sim.trades, strategies);
  };

  // parity
  const base = run("BASELINE (LS+RSI+BR)", accepted);
  console.log("\n== PARITY (expect T=1229 sumR=+692.6 | 2026 T=843 sumR=+467.0) ==");
  console.log(fmtArm(base));
  const parityOK = base.all.n === 1229 && Math.abs(base.all.sumR - 692.6) < 0.15 && base.y26.n === 843;
  console.log(parityOK ? "PARITY OK" : "PARITY FAIL — aborting");
  if (!parityOK) process.exit(2);
  const baseTrades = simulateEngineCurrent(accepted, exits, md, strategies, START_CAPITAL, BASE_RISK_PCT).trades;

  // D2-EXACT (correction from the Phase-1 adversarial review): MFE strictly
  // BEFORE the exit bar — a touch on the stop-out bar itself is not actionable.
  console.log("\n== D2-exact (pre-exit-bar MFE; corrects Phase-1's upper-bound version) ==");
  for (const th of [0.5, 1.0, 1.5, 2.0, 3.0]) {
    const touched = baseTrades.filter(t => t.mfePreExitR >= th);
    const died = touched.filter(t => t.netR <= 0);
    const losses = baseTrades.filter(t => t.netR < 0);
    const lossesTouched = losses.filter(t => t.mfePreExitR >= th);
    console.log(`  MFE>=+${th.toFixed(1)}R pre-exit: touched=${touched.length}/${baseTrades.length} (${(100 * touched.length / baseTrades.length).toFixed(1)}%) → ended<=0: ${died.length} (${touched.length ? (100 * died.length / touched.length).toFixed(1) : 0}%) | losses that had touched: ${lossesTouched.length}/${losses.length} (${(100 * lossesTouched.length / losses.length).toFixed(1)}%)`);
  }

  // ── P2.1 marginal contribution ────────────────────────────────────────────
  console.log("\n== P2.1 marginal contribution (with vs without; Δ vs baseline) ==");
  const armsDef: Array<{ id: string; keep: (c: AuditCandidate) => boolean }> = [
    { id: "minus liquidity-sweep", keep: c => c.stratId !== "liquidity-sweep" },
    { id: "minus rsi-divergence", keep: c => c.stratId !== "rsi-divergence" },
    { id: "minus break-retest", keep: c => c.stratId !== "break-retest" },
    { id: "only liquidity-sweep", keep: c => c.stratId === "liquidity-sweep" },
    { id: "only rsi-divergence", keep: c => c.stratId === "rsi-divergence" },
    { id: "only break-retest", keep: c => c.stratId === "break-retest" },
  ];
  const marginal: ArmSummary[] = [];
  for (const a of armsDef) {
    const s = run(a.id, accepted.filter(a.keep));
    marginal.push(s);
    console.log(fmtArm(s, base));
  }
  console.log("\n  marginal contribution of X = baseline − (minus X):");
  for (const s of strategies) {
    const m = marginal.find(x => x.id === `minus ${s.id}`)!;
    const only = marginal.find(x => x.id === `only ${s.id}`)!;
    const dAll = base.all.sumR - m.all.sumR;
    const d26 = base.y26.sumR - m.y26.sumR;
    console.log(`  ${s.id.padEnd(18)} marginal ALL=${(dAll >= 0 ? "+" : "") + dAll.toFixed(1)}R 2026=${(d26 >= 0 ? "+" : "") + d26.toFixed(1)}R | standalone(only): ALL ${(only.all.sumR >= 0 ? "+" : "") + only.all.sumR.toFixed(1)}R (T=${only.all.n}) 2026 ${(only.y26.sumR >= 0 ? "+" : "") + only.y26.sumR.toFixed(1)}R (T=${only.y26.n})`);
  }

  // ── P2.2 temporal stability (descriptive, baseline trades) ────────────────
  console.log("\n== P2.2 temporal stability — R per half-year per strategy (baseline portfolio) ==");
  const halfKey = (sec: number) => {
    const d = new Date(sec * 1000);
    return `${d.getUTCFullYear()}H${d.getUTCMonth() < 6 ? 1 : 2}`;
  };
  const halves = Array.from(new Set(baseTrades.map(t => halfKey(t.openedSec)))).sort();
  for (const s of strategies) {
    const rows: string[] = [];
    for (const h of halves) {
      const g = baseTrades.filter(t => t.strategy === s.id && halfKey(t.openedSec) === h);
      if (!g.length) { rows.push(`${h}: —`); continue; }
      const st = stats(g.map(t => t.netR));
      rows.push(`${h}: T=${st.n} ${(st.sumR >= 0 ? "+" : "") + st.sumR.toFixed(1)}R (exp ${(st.exp >= 0 ? "+" : "") + st.exp.toFixed(2)})`);
    }
    console.log(`  ${s.id}`);
    for (const r of rows) console.log(`    ${r}`);
  }

  // penalty + concentration per strategy (baseline)
  console.log("\n  per-strategy robustness (baseline portfolio trades):");
  for (const s of strategies) {
    const rs = baseTrades.filter(t => t.strategy === s.id).map(t => t.netR);
    if (!rs.length) continue;
    const st = stats(rs);
    const ci = bootstrapCI(rs);
    const pen = st.exp - 0.12;
    const penCi = { lo: ci.lo - 0.12, hi: ci.hi - 0.12 };
    console.log(`  ${s.id.padEnd(18)} n=${st.n} exp=${(st.exp >= 0 ? "+" : "") + st.exp.toFixed(3)} [${ci.lo.toFixed(3)},${ci.hi.toFixed(3)}] pen=${(pen >= 0 ? "+" : "") + pen.toFixed(3)} [${penCi.lo.toFixed(3)},${penCi.hi.toFixed(3)}] expNoTop5=${expWithoutTopK(rs, 5).toFixed(3)}`);
  }

  // ── P2.3 confidence-floor sweeps (diagnostic) ─────────────────────────────
  console.log("\n== P2.3 confidence-floor sweeps (others fixed at production; * = production floor) ==");
  type RawSig = { type: "LONG" | "SHORT" | "NONE"; entry: number; stopLoss: number; takeProfit: number; takeProfit2: number; confidence: number; reason: string };
  const signalFns: Record<string, (candles: OHLCV[]) => RawSig> = {
    "liquidity-sweep": c => liquiditySweepSignal(c),
    "rsi-divergence": c => rsiDivergenceSignal(c),
    "break-retest": c => breakRetestSignal(c),
  };
  const sweeps: Record<string, { floors: number[]; prod: number }> = {
    "liquidity-sweep": { floors: [60, 64, 68, 72, 76], prod: 68 },
    "rsi-divergence": { floors: [66, 72, 78], prod: 72 },
    "break-retest": { floors: [60, 68, 76], prod: 68 },
  };
  const sweepRows: Array<{ strat: string; floor: number; arm: ArmSummary }> = [];
  for (const strat of strategies) {
    const sweep = sweeps[strat.id];
    const fn = signalFns[strat.id];
    if (!sweep || !fn) continue;
    const pseudo: Strategy = {
      ...strat,
      analyze(candles: OHLCV[]): StrategySignal | null {
        const sig = fn(candles);
        if (sig.type === "NONE") return null;
        if (sig.confidence < 60) return null; // low floor; arms re-filter upward
        return {
          direction: sig.type, entry: sig.entry, stopLoss: sig.stopLoss,
          takeProfit1: sig.takeProfit, takeProfit2: sig.takeProfit2,
          confidence: sig.confidence, confluenceScore: sig.confidence, reason: sig.reason,
        };
      },
    };
    console.log(`  building low-floor candidates for ${strat.id}...`);
    const pseudoAll: AuditCandidate[] = [];
    for (const sym of strat.preferredSymbols ?? []) {
      const candles = streams.get(`${sym}:${strat.interval}`);
      if (!candles) continue;
      pseudoAll.push(...buildCandidatesTagged(pseudo, sym, candles));
    }
    // Insert the pseudo candidates at the swept strategy's REGISTRY position.
    // The portfolio sim's sort is stable, so ties at identical (tsSec, symbol)
    // across strategies are broken by insertion order — appending at the end
    // silently flips tie priority vs production (caught: BR sweep at the
    // production floor did not reproduce the baseline, +17 trades / +10R).
    const combined = strategies.flatMap(s =>
      s.id === strat.id ? pseudoAll : tagged.filter(c => c.stratId === s.id));
    combined.forEach((c, i) => { c.idx = i; });
    const combinedExits = resolveExitsFull(combined, streams, ENGINE_EXIT);
    for (const floor of sweep.floors) {
      const cands = combined.filter(c =>
        !c.rejectMinSL && !c.rejectMinRR && (c.stratId !== strat.id || c.confidence >= floor));
      const arm = run(`${strat.id} conf>=${floor}${floor === sweep.prod ? "*" : ""}`, cands, combinedExits);
      sweepRows.push({ strat: strat.id, floor, arm });
      console.log(fmtArm(arm, base));
    }
    // restore idx of production tagged array for the next iteration
    tagged.forEach((c, i) => { c.idx = i; });
  }

  mkdirSync("script/.cache", { recursive: true });
  writeFileSync("script/.cache/audit-phase2-results.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseline: base,
    marginal,
    sweeps: sweepRows.map(r => ({ strat: r.strat, floor: r.floor, arm: r.arm })),
  }, null, 1));
  console.log(`\n[results written to script/.cache/audit-phase2-results.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
