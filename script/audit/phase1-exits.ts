// ─── AUDIT PHASE 1: exit anatomy — pre-registered arms (see AUDIT-NOTES.md) ──
// P1.1 TP1-split × trailing grid · P1.2 pre-TP1 BE ratchet · P1.3 max-hold ·
// P1.4 Kraken-fee calibration · P1.5 minRR/minSL rejected-signal expectancy ·
// P1.6 mechanical ATR stop vs structural. Plus descriptives D1-D3.
// The DEFAULT arm must reproduce Phase 0 exactly before any arm counts.
// Run: npx tsx script/audit/phase1-exits.ts [--candles=8000] [--capital=500] [--risk=2]

import { writeFileSync, mkdirSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import type { ManagedExitConfig } from "../../server/trade-exits";
import {
  loadMarketData, buildCandidatesTagged, resolveExitsFull, simulateEngineCurrent,
  stats, bootstrapCI, maxDrawdownR, expWithoutTopK,
  ENGINE_EXIT, MIN_SL_DISTANCE_PCT, MIN_RR, YEAR_2026_TS,
  type AuditCandidate, type ExitOptions, type AuditTrade, type SimOutput,
} from "./lib";

const argv = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const TOTAL_CANDLES = parseInt(argv.candles ?? "8000");
const START_CAPITAL = parseFloat(argv.capital ?? "500");
const BASE_RISK_PCT = parseFloat(argv.risk ?? "2");
const N_CONFIRMATORY = 39; // pre-registered comparison count → Bonferroni alpha
const BONF_ALPHA = 0.05 / N_CONFIRMATORY;

interface ArmRow {
  id: string;
  group: string;
  all: { n: number; wr: number; pf: number; sumR: number; exp: number; lo: number; hi: number; ddR: number; expPen: number; expNoTop5: number };
  y26: { n: number; wr: number; pf: number; sumR: number; exp: number; lo: number; hi: number; expPen: number };
  dAllExp?: number;
  d26Exp?: number;
}

function summarize(id: string, group: string, sim: SimOutput): ArmRow {
  const rsAll = sim.trades.map(t => t.netR);
  const y26T = sim.trades.filter(t => t.openedSec >= YEAR_2026_TS);
  const rs26 = y26T.map(t => t.netR);
  const sAll = stats(rsAll);
  const s26 = stats(rs26);
  const ciA = bootstrapCI(rsAll);
  const ci6 = bootstrapCI(rs26);
  return {
    id, group,
    all: {
      n: sAll.n, wr: sAll.wr, pf: sAll.pf, sumR: sAll.sumR, exp: sAll.exp,
      lo: ciA.lo, hi: ciA.hi, ddR: maxDrawdownR(rsAll), expPen: sAll.exp - 0.12,
      expNoTop5: expWithoutTopK(rsAll, 5),
    },
    y26: { n: s26.n, wr: s26.wr, pf: s26.pf, sumR: s26.sumR, exp: s26.exp, lo: ci6.lo, hi: ci6.hi, expPen: s26.exp - 0.12 },
  };
}

function fmtRow(r: ArmRow): string {
  const a = r.all, y = r.y26;
  const d = r.dAllExp != null ? ` Δall=${(r.dAllExp >= 0 ? "+" : "") + r.dAllExp.toFixed(3)} Δ26=${(r.d26Exp! >= 0 ? "+" : "") + r.d26Exp!.toFixed(3)}` : "";
  return `${r.id.padEnd(30)} ALL T=${String(a.n).padStart(4)} exp=${(a.exp >= 0 ? "+" : "") + a.exp.toFixed(3)} [${a.lo.toFixed(3)},${a.hi.toFixed(3)}] sumR=${(a.sumR >= 0 ? "+" : "") + a.sumR.toFixed(0).padStart(4)} PF=${a.pf.toFixed(2)} DD=${a.ddR.toFixed(1)}R pen=${(a.expPen >= 0 ? "+" : "") + a.expPen.toFixed(3)} noTop5=${(a.expNoTop5 >= 0 ? "+" : "") + a.expNoTop5.toFixed(3)} | 2026 T=${String(y.n).padStart(3)} exp=${(y.exp >= 0 ? "+" : "") + y.exp.toFixed(3)} [${y.lo.toFixed(3)},${y.hi.toFixed(3)}] pen=${(y.expPen >= 0 ? "+" : "") + y.expPen.toFixed(3)}${d}`;
}

async function main() {
  const strategies = getAllStrategies();
  console.log("loading market data (day-keyed cache)...");
  const { streams, md } = await loadMarketData(strategies, TOTAL_CANDLES);

  console.log("building tagged candidates (one pass, shared by all arms)...");
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
  console.log(`tagged=${tagged.length} accepted=${accepted.length} rejMinSL=${tagged.filter(c => c.rejectMinSL).length} rejMinRR=${tagged.filter(c => c.rejectMinRR).length} rejBoth=${tagged.filter(c => c.rejectMinSL && c.rejectMinRR).length}`);

  const runArm = (id: string, group: string, exitCfg: ManagedExitConfig, opts: ExitOptions = {}, cands: AuditCandidate[] = accepted): { row: ArmRow; sim: SimOutput } => {
    const exits = resolveExitsFull(tagged, streams, exitCfg, opts);
    const sim = simulateEngineCurrent(cands, exits, md, strategies, START_CAPITAL, BASE_RISK_PCT);
    return { row: summarize(id, group, sim), sim };
  };

  // ── PARITY: default arm must reproduce Phase 0 ────────────────────────────
  const base = runArm("ENGINE (tp1=60%, trail r2.0)", "baseline", ENGINE_EXIT);
  console.log("\n== PARITY (expect T=1229 sumR=+692.6 exp=+0.564 | 2026 T=843 sumR=+467.0) ==");
  console.log(fmtRow(base.row));
  const parityOK = base.row.all.n === 1229 && Math.abs(base.row.all.sumR - 692.6) < 0.15 && base.row.y26.n === 843;
  console.log(parityOK ? "PARITY OK" : "PARITY FAIL — results below are NOT trustworthy");
  if (!parityOK) process.exit(2);

  const rows: ArmRow[] = [base.row];
  const withDelta = (r: ArmRow): ArmRow => {
    r.dAllExp = r.all.exp - base.row.all.exp;
    r.d26Exp = r.y26.exp - base.row.y26.exp;
    return r;
  };

  // ── Descriptives D1-D3 on the baseline arm ────────────────────────────────
  const T = base.sim.trades;
  console.log("\n== D2: MFE before exit — how many touched +XR and still ended <=0? ==");
  for (const th of [0.5, 1.0, 1.5, 2.0, 3.0]) {
    const touched = T.filter(t => t.mfeR >= th);
    const died = touched.filter(t => t.netR <= 0);
    const losses = T.filter(t => t.netR < 0);
    const lossesTouched = losses.filter(t => t.mfeR >= th);
    console.log(`  MFE>=+${th.toFixed(1)}R: touched=${touched.length}/${T.length} (${(100 * touched.length / T.length).toFixed(1)}%) → ended<=0: ${died.length} (${touched.length ? (100 * died.length / touched.length).toFixed(1) : 0}% of touched) | losses that had touched: ${lossesTouched.length}/${losses.length} (${(100 * lossesTouched.length / losses.length).toFixed(1)}%)`);
  }

  console.log("\n== D1: what the runner leaves on the table (tp1Hit trades) ==");
  for (const oc of ["trailing", "tp2", "timeout"] as const) {
    const g = T.filter(t => t.tp1Hit && t.outcome === oc);
    if (!g.length) continue;
    const avgNet = g.reduce((s, t) => s + t.netR, 0) / g.length;
    const avgMfeFull = g.reduce((s, t) => s + t.mfeFullR, 0) / g.length;
    console.log(`  ${oc.padEnd(9)} n=${String(g.length).padStart(4)} avg netR=${avgNet.toFixed(3)} avg window-max MFE=${avgMfeFull.toFixed(3)}R → avg unrealized beyond exit=${(avgMfeFull - avgNet).toFixed(3)}R (upper bound, not capturable in full)`);
  }

  console.log("\n== D3: runners that closed without TP2 — did price still reach TP2 in-window? ==");
  {
    const runnersNoTp2 = T.filter(t => t.tp1Hit && t.outcome !== "tp2" && t.takeProfit2 != null);
    const tp2R = (t: AuditTrade) => Math.abs((t.takeProfit2 as number) - t.entry) / Math.abs(t.entry - t.stopLoss);
    const reached = runnersNoTp2.filter(t => t.mfeFullR >= tp2R(t));
    console.log(`  runners w/o TP2 exit: ${runnersNoTp2.length}; window-max later/anytime reached TP2 level: ${reached.length} (${runnersNoTp2.length ? (100 * reached.length / runnersNoTp2.length).toFixed(1) : 0}%)`);
    for (const oc of ["trailing", "breakeven", "timeout"] as const) {
      const g = runnersNoTp2.filter(t => t.outcome === oc);
      const gr = g.filter(t => t.mfeFullR >= tp2R(t));
      if (g.length) console.log(`    ${oc.padEnd(9)} n=${g.length} → TP2 was reachable in ${gr.length} (${(100 * gr.length / g.length).toFixed(1)}%)`);
    }
  }

  // ── P1.1 grid: TP1 split × trail ──────────────────────────────────────────
  console.log("\n== P1.1 grid: tp1ClosePct × trail ==");
  const splits = [0, 0.3, 0.5, 0.6, 0.75];
  const trails: Array<{ label: string; cfg: ManagedExitConfig }> = [
    { label: "r1.5", cfg: { trailMode: "r_multiple", trailRMultiple: 1.5 } },
    { label: "r2.0", cfg: { trailMode: "r_multiple", trailRMultiple: 2.0 } },
    { label: "r2.5", cfg: { trailMode: "r_multiple", trailRMultiple: 2.5 } },
    { label: "r3.0", cfg: { trailMode: "r_multiple", trailRMultiple: 3.0 } },
    { label: "pct2", cfg: { trailingPct: 0.02 } },
  ];
  for (const sp of splits) {
    for (const tr of trails) {
      const { row } = runArm(`GRID tp1=${(sp * 100).toFixed(0)}% ${tr.label}`, "P1.1", { ...tr.cfg, tp1ClosePct: sp });
      rows.push(withDelta(row));
      console.log(fmtRow(row));
    }
  }
  {
    const { row } = runArm("GRID tp1=100% (no runner)", "P1.1", { tp1ClosePct: 1.0 });
    rows.push(withDelta(row));
    console.log(fmtRow(row));
  }

  // ── P1.2 pre-TP1 break-even ratchet ───────────────────────────────────────
  console.log("\n== P1.2 pre-TP1 BE ratchet (on engine exit) ==");
  for (const be of [0.5, 1.0, 1.5]) {
    const { row } = runArm(`BE@+${be.toFixed(1)}R pre-TP1`, "P1.2", ENGINE_EXIT, { beAtR: be });
    rows.push(withDelta(row));
    console.log(fmtRow(row));
  }

  // ── P1.3 max-hold ─────────────────────────────────────────────────────────
  console.log("\n== P1.3 max-hold (bars 1h/4h; engine = 200/60) ==");
  for (const mb of [{ "1h": 100, "4h": 60 }, { "1h": 300, "4h": 60 }, { "1h": 400, "4h": 90 }, { "1h": 200, "4h": 90 }]) {
    const { row } = runArm(`HOLD 1h=${mb["1h"]} 4h=${mb["4h"]}`, "P1.3", ENGINE_EXIT, { maxBarsBy: mb });
    rows.push(withDelta(row));
    console.log(fmtRow(row));
  }

  // ── P1.4 Kraken fee calibration (not a decision arm) ──────────────────────
  console.log("\n== P1.4 fee calibration (taker 0.05% instead of 0.02%) ==");
  {
    const { row } = runArm("FEE taker=0.05%", "P1.4", { ...ENGINE_EXIT, takerFeePct: 0.0005 });
    rows.push(withDelta(row));
    console.log(fmtRow(row));
  }

  // ── P1.5 rejected-signal expectancy (exploratory, standalone netR) ────────
  console.log("\n== P1.5 gate-rejected signals — standalone managed-exit netR (NO portfolio context) ==");
  {
    const exits = resolveExitsFull(tagged, streams, ENGINE_EXIT);
    const groups: Array<{ label: string; cands: AuditCandidate[] }> = [
      { label: "rejected by minSL only", cands: tagged.filter(c => c.rejectMinSL && !c.rejectMinRR) },
      { label: "rejected by minRR only", cands: tagged.filter(c => c.rejectMinRR && !c.rejectMinSL) },
      { label: "rejected by both", cands: tagged.filter(c => c.rejectMinSL && c.rejectMinRR) },
      { label: "accepted (reference)", cands: accepted },
    ];
    for (const g of groups) {
      const rs = g.cands.map(c => exits[c.idx].netR);
      const s = stats(rs);
      const ci = bootstrapCI(rs);
      console.log(`  ${g.label.padEnd(24)} n=${String(s.n).padStart(4)} exp=${(s.exp >= 0 ? "+" : "") + s.exp.toFixed(3)} [${ci.lo.toFixed(3)},${ci.hi.toFixed(3)}] WR=${s.wr.toFixed(1)}% PF=${s.pf === Infinity ? "∞" : s.pf.toFixed(2)}`);
      const byStrat = new Map<string, number[]>();
      for (const c of g.cands) byStrat.set(c.stratId, [...(byStrat.get(c.stratId) ?? []), exits[c.idx].netR]);
      for (const [st, rr] of byStrat) {
        const ss = stats(rr);
        console.log(`      ${st.padEnd(18)} n=${String(ss.n).padStart(4)} exp=${(ss.exp >= 0 ? "+" : "") + ss.exp.toFixed(3)}`);
      }
    }
  }

  // ── P1.6 mechanical ATR stop vs structural (targets fixed, gates re-applied) ──
  console.log("\n== P1.6 ATR stop (SL = entry ∓ k×ATR14; TPs unchanged; gates re-applied) ==");
  for (const k of [1.5, 2.0]) {
    const slOf = (c: AuditCandidate) => c.dir === "LONG" ? c.entry - k * c.atr14 : c.entry + k * c.atr14;
    const candsATR = tagged.filter(c => {
      const risk = Math.abs(c.entry - slOf(c));
      if (risk <= 0 || c.atr14 <= 0) return false;
      const slDist = risk / c.entry;
      const rr = Math.abs(c.takeProfit1 - c.entry) / risk;
      return slDist >= MIN_SL_DISTANCE_PCT && rr >= MIN_RR;
    });
    const { row, sim } = runArm(`ATR-SL k=${k.toFixed(1)}`, "P1.6", ENGINE_EXIT, { slOverride: slOf }, candsATR);
    rows.push(withDelta(row));
    console.log(fmtRow(row));
    for (const strat of strategies) {
      const rs = sim.trades.filter(t => t.strategy === strat.id).map(t => t.netR);
      if (!rs.length) continue;
      const s = stats(rs);
      const bs = stats(base.sim.trades.filter(t => t.strategy === strat.id).map(t => t.netR));
      console.log(`      ${strat.id.padEnd(18)} n=${String(s.n).padStart(4)} exp=${(s.exp >= 0 ? "+" : "") + s.exp.toFixed(3)} (struct: n=${bs.n} exp=${(bs.exp >= 0 ? "+" : "") + bs.exp.toFixed(3)})`);
    }
  }

  // ── Winner screen with Bonferroni-corrected CI ─────────────────────────────
  console.log(`\n== Winner screen (Δexp>=+0.05 in BOTH windows, then ${((1 - BONF_ALPHA) * 100).toFixed(2)}% CI must clear baseline) ==`);
  const candidates = rows.filter(r => r.group !== "baseline" && r.group !== "P1.4" && (r.dAllExp ?? 0) >= 0.05 && (r.d26Exp ?? 0) >= 0.05 && r.all.n >= 100 && r.y26.n >= 100);
  if (!candidates.length) {
    console.log("  none — no arm clears the +0.05R pre-registered threshold in both windows.");
  } else {
    console.log(`  ${candidates.length} arm(s) pass the effect-size screen — NOTE: arms share data with baseline (correlated), CI vs 0 shown, verify vs baseline pairing in review:`);
    for (const c of candidates) console.log(`  CANDIDATE: ${fmtRow(c)}`);
  }

  mkdirSync("script/.cache", { recursive: true });
  writeFileSync("script/.cache/audit-phase1-results.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    candles: TOTAL_CANDLES, capital: START_CAPITAL, riskPct: BASE_RISK_PCT,
    nConfirmatory: N_CONFIRMATORY,
    rows,
    baselineTrades: base.sim.trades,
  }, null, 1));
  console.log(`\n[results written to script/.cache/audit-phase1-results.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
