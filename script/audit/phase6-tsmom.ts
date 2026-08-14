// ─── AUDIT PHASE 6: TSMOM daily prototype — pre-registered (AUDIT-NOTES) ────
// Primary spec: Donchian-55d close breakout on the SAME 40-coin universe,
// stop 2.0×ATR(20d), TP1 = 1.75×stop-dist, TP2 = 3.5×stop-dist, production
// exits (TP1 60% → trail r2.0), confidence 70, cooldown 72h, 1d candles.
// Sensitivity (plateau check, one-at-a-time): N ∈ {40,70}, STOP_K ∈ {1.5,2.5}.
// Run: npx tsx script/audit/phase6-tsmom.ts

import { getAllStrategies } from "../../server/strategies/registry";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import type { Strategy, StrategySignal } from "../../server/strategies/types";
import type { OHLCV } from "../../server/analysis";
import {
  loadMarketData, buildCandidatesTagged, resolveExitsFull, simulateEngineCurrent,
  stats, bootstrapCI, maxDrawdownR, expWithoutTopK, calcATRLocal, fetchPaginated,
  ENGINE_EXIT, YEAR_2026_TS,
  type AuditCandidate, type AuditTrade,
} from "./lib";

const TOTAL_CANDLES = 8000;
const DAILY_CANDLES = 1500;
const START_CAPITAL = 500;
const BASE_RISK_PCT = 2;

function makeTsmom(id: string, donchianN: number, stopK: number): Strategy {
  return {
    id,
    name: `TSMOM proto (N=${donchianN}, ${stopK}×ATR)`,
    description: "Time-series momentum prototype — daily Donchian close breakout, ATR stop.",
    interval: "1d",
    minCandles: Math.max(donchianN + 25, 80),
    preferredSymbols: [...(liquiditySweepStrategy.preferredSymbols ?? [])],
    cooldownHours: 72,
    analyze(candles: OHLCV[]): StrategySignal | null {
      const n = candles.length;
      if (n < donchianN + 22) return null;
      const last = candles[n - 1];
      const lookback = candles.slice(n - 1 - donchianN, n - 1); // prior N days, excludes signal day
      let hi = -Infinity, lo = Infinity;
      for (const c of lookback) { if (c.high > hi) hi = c.high; if (c.low < lo) lo = c.low; }
      const dir: "LONG" | "SHORT" | null = last.close > hi ? "LONG" : last.close < lo ? "SHORT" : null;
      if (!dir) return null;
      const atr = calcATRLocal(candles.slice(-42), 20);
      if (!(atr > 0)) return null;
      const entry = last.close;
      const stopDist = stopK * atr;
      const stopLoss = dir === "LONG" ? entry - stopDist : entry + stopDist;
      const takeProfit1 = dir === "LONG" ? entry + 1.75 * stopDist : entry - 1.75 * stopDist;
      const takeProfit2 = dir === "LONG" ? entry + 3.5 * stopDist : entry - 3.5 * stopDist;
      if (stopLoss <= 0 || takeProfit1 <= 0) return null;
      return {
        direction: dir, entry, stopLoss, takeProfit1, takeProfit2,
        confidence: 70, confluenceScore: 70,
        reason: `TSMOM ${dir} — close ${dir === "LONG" ? ">" : "<"} Donchian${donchianN} ${dir === "LONG" ? "high" : "low"} | stop ${stopK}×ATR20`,
      };
    },
  };
}

function line(label: string, trades: { netR: number; openedSec: number }[], sinceSec = 0): void {
  const rs = trades.filter(t => t.openedSec >= sinceSec).map(t => t.netR);
  const s = stats(rs);
  const ci = bootstrapCI(rs);
  console.log(`  ${label.padEnd(30)} T=${String(s.n).padStart(4)} sumR=${(s.sumR >= 0 ? "+" : "") + s.sumR.toFixed(1).padStart(7)} exp=${(s.exp >= 0 ? "+" : "") + s.exp.toFixed(3)} [${ci.lo.toFixed(3)},${ci.hi.toFixed(3)}] PF=${s.pf === Infinity ? "∞" : s.pf.toFixed(2)} DD=${maxDrawdownR(rs).toFixed(1)}R pen=${(s.exp - 0.12 >= 0 ? "+" : "") + (s.exp - 0.12).toFixed(3)} noTop5=${expWithoutTopK(rs, 5).toFixed(3)}`);
}

function dailyPnlSeries(trades: AuditTrade[], filter: (t: AuditTrade) => boolean): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of trades) {
    if (!filter(t)) continue;
    const d = new Date(t.closedSec * 1000).toISOString().slice(0, 10);
    m.set(d, (m.get(d) ?? 0) + t.netR);
  }
  return m;
}

function pearson(a: Map<string, number>, b: Map<string, number>): { r: number; n: number } {
  // union of days where EITHER sleeve is active (absent = 0 that day)
  const days = new Set([...a.keys(), ...b.keys()]);
  const xs: number[] = [], ys: number[] = [];
  for (const d of days) { xs.push(a.get(d) ?? 0); ys.push(b.get(d) ?? 0); }
  const n = xs.length;
  if (n < 10) return { r: NaN, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const u = xs[i] - mx, v = ys[i] - my; num += u * v; dx += u * u; dy += v * v; }
  return { r: dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : NaN, n };
}

async function main() {
  const registry = getAllStrategies();
  const { streams, md } = await loadMarketData(registry, TOTAL_CANDLES);

  console.log("building production candidates...");
  const tagged: AuditCandidate[] = [];
  for (const strat of registry) {
    for (const sym of strat.preferredSymbols ?? []) {
      const candles = streams.get(`${sym}:${strat.interval}`);
      if (!candles) continue;
      tagged.push(...buildCandidatesTagged(strat, sym, candles));
    }
  }

  console.log("fetching 1d candles (1500 per coin) + building TSMOM candidates...");
  const dailyStreams = new Map<string, OHLCV[]>();
  for (const sym of liquiditySweepStrategy.preferredSymbols ?? []) {
    try {
      const candles = await fetchPaginated(sym, "1d", DAILY_CANDLES);
      dailyStreams.set(`${sym}:1d`, candles);
      streams.set(`${sym}:1d`, candles);
    } catch (e: any) { console.error(`  1d fetch failed ${sym}: ${e?.message ?? e}`); }
  }

  const ARMS: Array<{ label: string; strat: Strategy; primary?: boolean }> = [
    { label: "PRIMARY N=55 stop=2.0×ATR", strat: makeTsmom("tsmom-proto", 55, 2.0), primary: true },
    { label: "SENS N=40 stop=2.0×ATR", strat: makeTsmom("tsmom-proto", 40, 2.0) },
    { label: "SENS N=70 stop=2.0×ATR", strat: makeTsmom("tsmom-proto", 70, 2.0) },
    { label: "SENS N=55 stop=1.5×ATR", strat: makeTsmom("tsmom-proto", 55, 1.5) },
    { label: "SENS N=55 stop=2.5×ATR", strat: makeTsmom("tsmom-proto", 55, 2.5) },
  ];

  // baseline (registry only) for the portfolio delta
  const baseTagged = [...tagged];
  baseTagged.forEach((c, i) => { c.idx = i; });
  const baseExits = resolveExitsFull(baseTagged, streams, ENGINE_EXIT);
  const baseAccepted = baseTagged.filter(c => !c.rejectMinSL && !c.rejectMinRR);
  const baseSim = simulateEngineCurrent(baseAccepted, baseExits, md, registry, START_CAPITAL, BASE_RISK_PCT);
  console.log("\n== baseline (registry, floor-60 production) ==");
  line("BASELINE ALL", baseSim.trades);
  line("BASELINE 2026", baseSim.trades, YEAR_2026_TS);
  const base26sumR = stats(baseSim.trades.filter(t => t.openedSec >= YEAR_2026_TS).map(t => t.netR)).sumR;

  for (const arm of ARMS) {
    const tsCands: AuditCandidate[] = [];
    for (const sym of arm.strat.preferredSymbols ?? []) {
      const candles = dailyStreams.get(`${sym}:1d`);
      if (!candles) continue;
      tsCands.push(...buildCandidatesTagged(arm.strat, sym, candles));
    }
    // combined candidate set — TSMOM appended AFTER registry (loses same-ts ties, conservative)
    const combined = [...tagged, ...tsCands];
    combined.forEach((c, i) => { c.idx = i; });
    const exits = resolveExitsFull(combined, streams, ENGINE_EXIT);
    const accepted = combined.filter(c => !c.rejectMinSL && !c.rejectMinRR);
    const sim = simulateEngineCurrent(accepted, exits, md, [...registry, arm.strat], START_CAPITAL, BASE_RISK_PCT);

    const sleeve = sim.trades.filter(t => t.strategy === arm.strat.id);
    const others = sim.trades.filter(t => t.strategy !== arm.strat.id);
    console.log(`\n== ${arm.label} ==  (candidatos TSMOM aceites: ${accepted.filter(c => c.stratId === arm.strat.id).length}, rejeitados minSL: ${tsCands.filter(c => c.rejectMinSL).length}, minRR: ${tsCands.filter(c => c.rejectMinRR).length})`);
    line("sleeve TSMOM ALL", sleeve);
    line("sleeve TSMOM 2026", sleeve, YEAR_2026_TS);
    line("portfolio ALL", sim.trades);
    line("portfolio 2026", sim.trades, YEAR_2026_TS);
    const delta26 = stats(sim.trades.filter(t => t.openedSec >= YEAR_2026_TS).map(t => t.netR)).sumR - base26sumR;
    const corr = pearson(
      dailyPnlSeries(sim.trades, t => t.strategy === arm.strat.id),
      dailyPnlSeries(sim.trades, t => t.strategy === "liquidity-sweep"),
    );
    const yearsSpan = sleeve.length ? (sleeve[sleeve.length - 1].closedSec - sleeve[0].openedSec) / (365.25 * 86400) : 0;
    const sleeveAll = stats(sleeve.map(t => t.netR));
    console.log(`  Δ portfólio 2026 vs baseline: ${(delta26 >= 0 ? "+" : "") + delta26.toFixed(1)}R (interação com LS — critério: ≥ 0)`);
    console.log(`  corr diária sleeve↔LS: r=${Number.isFinite(corr.r) ? corr.r.toFixed(3) : "—"} (n=${corr.n} dias; critério < 0.3)`);
    console.log(`  sleeve R/ano ≈ ${yearsSpan > 0 ? (sleeveAll.sumR / yearsSpan).toFixed(1) : "—"} (span ${yearsSpan.toFixed(1)}y; critério ≈ +30R/ano)`);
    if (arm.primary) {
      // metade-a-metade do sleeve para estabilidade
      if (sleeve.length) {
        const mid = sleeve[Math.floor(sleeve.length / 2)].openedSec;
        line("sleeve 1ª metade", sleeve.filter(t => t.openedSec < mid));
        line("sleeve 2ª metade", sleeve.filter(t => t.openedSec >= mid));
      }
    }
  }
  console.log("\nNOTA: fork isenta 1d do gate weeklyTrend (só existe para 4h) e usa maxBars=200d;");
  console.log("a integração real exigiria MAX_HOLD_HOURS_BY_INTERVAL['1d'] e decisão sobre gates.");
}

main().catch(e => { console.error(e); process.exit(1); });
