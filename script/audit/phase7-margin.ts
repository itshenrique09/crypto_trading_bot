// ─── AUDIT PHASE 7: margin-aware config A/B — pre-registered (AUDIT-NOTES) ──
// How much R does each (risk%, leverage) pair lose to the margin wall that
// checkMarginCapacity now enforces? Answers "can live go to 1%? 2%?" with
// numbers instead of a fixed paper setting.
// Run: npx tsx script/audit/phase7-margin.ts

import { getAllStrategies } from "../../server/strategies/registry";
import {
  loadMarketData, buildCandidatesTagged, resolveExitsFull, simulateEngineCurrent,
  stats, maxDrawdownR, ENGINE_EXIT, YEAR_2026_TS,
  type AuditCandidate,
} from "./lib";

const TOTAL_CANDLES = 8000;
const START_CAPITAL = 500;

async function main() {
  const strategies = getAllStrategies();
  const { streams, md } = await loadMarketData(strategies, TOTAL_CANDLES);
  console.log("building candidates...");
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

  const ref = simulateEngineCurrent(accepted, exits, md, strategies, START_CAPITAL, 2);
  const refAll = stats(ref.trades.map(t => t.netR));
  const ref26 = stats(ref.trades.filter(t => t.openedSec >= YEAR_2026_TS).map(t => t.netR));
  console.log(`\nSEM MARGEM (referência/paridade): ALL T=${refAll.n} sumR=${refAll.sumR.toFixed(1)} | 2026 T=${ref26.n} sumR=${ref26.sumR.toFixed(1)}\n`);

  console.log("risk% lev | ALL T   sumR    Δ vs s/margem | 2026 T   sumR    Δ     | recusas margem | maxDD(R)");
  console.log("─".repeat(104));
  for (const risk of [0.5, 1, 2]) {
    for (const lev of [5, 7, 10]) {
      const sim = simulateEngineCurrent(accepted, exits, md, strategies, START_CAPITAL, risk, { marginLeverage: lev });
      const a = stats(sim.trades.map(t => t.netR));
      const y = stats(sim.trades.filter(t => t.openedSec >= YEAR_2026_TS).map(t => t.netR));
      const refusals = sim.blocks["margin"] ?? 0;
      console.log(
        `${String(risk).padStart(4)}% ${String(lev).padStart(2)}x | ` +
        `${String(a.n).padStart(5)} ${(a.sumR >= 0 ? "+" : "") + a.sumR.toFixed(1).padStart(7)} ${((a.sumR - refAll.sumR) >= 0 ? "+" : "") + (a.sumR - refAll.sumR).toFixed(1).padStart(7)}       | ` +
        `${String(y.n).padStart(5)} ${(y.sumR >= 0 ? "+" : "") + y.sumR.toFixed(1).padStart(7)} ${((y.sumR - ref26.sumR) >= 0 ? "+" : "") + (y.sumR - ref26.sumR).toFixed(1).padStart(7)} | ` +
        `${String(refusals).padStart(8)}       | ${maxDrawdownR(sim.trades.map(t => t.netR)).toFixed(1)}`,
      );
    }
  }
  console.log("\nNOTA: sumR/T em R — os braços só diferem pelas recusas de margem (guards são scale-invariantes).");
  console.log("Kraken retail: máx 10×. Simplificação declarada: notional cheio até ao fecho (sem redução TP1).");
}

main().catch(e => { console.error(e); process.exit(1); });
