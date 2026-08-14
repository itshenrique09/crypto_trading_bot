// ─── AUDIT PHASE 1b (EXPLORATORY, not pre-registered) ───────────────────────
// Follow-up to P1.5: minSL-rejected signals showed standalone exp +0.68R.
// Question: what does the FULL PORTFOLIO look like with the floor lowered/removed?
// Labeled exploratory — if promising, becomes a pre-registered A/B in the
// official harness before any engine change is considered.
// Run: npx tsx script/audit/phase1b-minsl.ts

import { getAllStrategies } from "../../server/strategies/registry";
import {
  loadMarketData, buildCandidatesTagged, resolveExitsFull, simulateEngineCurrent,
  stats, bootstrapCI, maxDrawdownR, expWithoutTopK, ENGINE_EXIT, YEAR_2026_TS,
  type AuditCandidate,
} from "./lib";

const TOTAL_CANDLES = 8000;
const START_CAPITAL = 500;
const BASE_RISK_PCT = 2;

function line(label: string, trades: { netR: number; openedSec: number }[]): void {
  const rsAll = trades.map(t => t.netR);
  const rs26 = trades.filter(t => t.openedSec >= YEAR_2026_TS).map(t => t.netR);
  const a = stats(rsAll), y = stats(rs26);
  const ca = bootstrapCI(rsAll), cy = bootstrapCI(rs26);
  console.log(`${label.padEnd(26)} ALL T=${String(a.n).padStart(4)} exp=${(a.exp >= 0 ? "+" : "") + a.exp.toFixed(3)} [${ca.lo.toFixed(3)},${ca.hi.toFixed(3)}] sumR=${(a.sumR >= 0 ? "+" : "") + a.sumR.toFixed(0)} PF=${a.pf.toFixed(2)} DD=${maxDrawdownR(rsAll).toFixed(1)}R noTop5=${expWithoutTopK(rsAll, 5).toFixed(3)} | 2026 T=${String(y.n).padStart(4)} exp=${(y.exp >= 0 ? "+" : "") + y.exp.toFixed(3)} [${cy.lo.toFixed(3)},${cy.hi.toFixed(3)}] sumR=${(y.sumR >= 0 ? "+" : "") + y.sumR.toFixed(0)}`);
}

async function main() {
  const strategies = getAllStrategies();
  const { streams, md } = await loadMarketData(strategies, TOTAL_CANDLES);
  const tagged: AuditCandidate[] = [];
  for (const strat of strategies) {
    for (const sym of strat.preferredSymbols ?? []) {
      const candles = streams.get(`${sym}:${strat.interval}`);
      if (!candles) continue;
      tagged.push(...buildCandidatesTagged(strat, sym, candles));
    }
  }
  tagged.forEach((c, i) => { c.idx = i; });
  const exits = resolveExitsFull(tagged, streams, ENGINE_EXIT);

  const arms: Array<{ label: string; pass: (c: AuditCandidate) => boolean }> = [
    { label: "floor 0.6% (engine)", pass: c => !c.rejectMinSL && !c.rejectMinRR },
    { label: "floor 0.4% (explor.)", pass: c => c.slDistPct >= 0.004 && !c.rejectMinRR },
    { label: "floor 0.2% (explor.)", pass: c => c.slDistPct >= 0.002 && !c.rejectMinRR },
    { label: "no floor (explor.)", pass: c => !c.rejectMinRR },
  ];
  for (const arm of arms) {
    const cands = tagged.filter(arm.pass);
    const sim = simulateEngineCurrent(cands, exits, md, strategies, START_CAPITAL, BASE_RISK_PCT);
    line(arm.label, sim.trades);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
