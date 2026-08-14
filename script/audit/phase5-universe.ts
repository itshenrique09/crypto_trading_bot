// ─── AUDIT PHASE 5: per-coin universe review — pre-registered (AUDIT-NOTES) ──
// P5.1 exclude-one marginal contribution for the 40 LS coins (portfolio fork)
//      + standalone two-halves consistency per coin.
// P5.2 addition candidates: Kraken-tradable ∩ Binance-USDT − universe, liquidity
//      pre-filter $20M/24h, two-halves screen with PRODUCTION exits+floor, then
//      full-pipeline A/B in the fork for survivors.
// Run: npx tsx script/audit/phase5-universe.ts

import { writeFileSync, mkdirSync } from "fs";
import { getAllStrategies } from "../../server/strategies/registry";
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import type { Strategy } from "../../server/strategies/types";
import type { OHLCV } from "../../server/analysis";
import {
  loadMarketData, buildCandidatesTagged, resolveExitsFull, simulateEngineCurrent,
  stats, fetchPaginated, ENGINE_EXIT, YEAR_2026_TS,
  type AuditCandidate, type MarketData,
} from "./lib";

const TOTAL_CANDLES = 8000;
const START_CAPITAL = 500;
const BASE_RISK_PCT = 2;
const MIN_TRADES = 30;
const MIN_PF = 1.5;
const MIN_QUOTE_VOL_24H = 20_000_000; // operational liquidity pre-filter, USD
const STABLES = new Set(["USDT", "USDC", "DAI", "TUSD", "FDUSD", "USDE", "PYUSD", "EURT", "EUR", "GBP", "USD"]);

interface SimLine { n: number; sumR: number; exp: number }
function lineOf(trades: { netR: number; openedSec: number }[], sinceSec = 0): SimLine {
  const rs = trades.filter(t => t.openedSec >= sinceSec).map(t => t.netR);
  const s = stats(rs);
  return { n: s.n, sumR: s.sumR, exp: s.exp };
}

async function main() {
  const strategies = getAllStrategies();
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

  const baseSim = simulateEngineCurrent(accepted, exits, md, strategies, START_CAPITAL, BASE_RISK_PCT);
  const baseAll = lineOf(baseSim.trades);
  const base26 = lineOf(baseSim.trades, YEAR_2026_TS);
  console.log(`\nBASELINE (floor 60 production): ALL T=${baseAll.n} sumR=${baseAll.sumR.toFixed(1)} | 2026 T=${base26.n} sumR=${base26.sumR.toFixed(1)}`);

  // ── P5.1 exclude-one per coin ────────────────────────────────────────────
  console.log("\n== P5.1 exclude-one marginals (marginal = baseline − minus-coin; positive ⇒ coin HURTS) ==");
  const lsSyms = [...(liquiditySweepStrategy.preferredSymbols ?? [])].sort();
  const rows: Array<{
    sym: string; mAll: number; m26: number;
    standalone: { n: number; sumR: number; h1: number; h2: number };
    flagged: boolean;
  }> = [];
  for (const sym of lsSyms) {
    const sim = simulateEngineCurrent(accepted.filter(c => c.symbol !== sym), exits, md, strategies, START_CAPITAL, BASE_RISK_PCT);
    const mAll = baseAll.sumR - lineOf(sim.trades).sumR;
    const m26 = base26.sumR - lineOf(sim.trades, YEAR_2026_TS).sumR;
    // standalone two-halves on the coin's own LS candidates (accepted, ENGINE exits)
    const coinCands = accepted.filter(c => c.symbol === sym && c.stratId === "liquidity-sweep");
    const stream = streams.get(`${sym}:1h`) ?? [];
    const midTs = stream.length ? stream[Math.floor(stream.length / 2)].time : 0;
    const h1 = coinCands.filter(c => c.tsSec < midTs).reduce((s, c) => s + exits[c.idx].netR, 0);
    const h2 = coinCands.filter(c => c.tsSec >= midTs).reduce((s, c) => s + exits[c.idx].netR, 0);
    const sumR = h1 + h2;
    // pre-registered removal flag: marginal >= +5R in BOTH windows AND negative in BOTH halves
    const flagged = mAll >= 5 && m26 >= 5 && h1 < 0 && h2 < 0;
    rows.push({ sym, mAll, m26, standalone: { n: coinCands.length, sumR, h1, h2 }, flagged });
  }
  rows.sort((a, b) => b.mAll - a.mAll);
  for (const r of rows) {
    console.log(`  ${r.sym.padEnd(7)} marginal ALL=${(r.mAll >= 0 ? "+" : "") + r.mAll.toFixed(1).padStart(6)} 2026=${(r.m26 >= 0 ? "+" : "") + r.m26.toFixed(1).padStart(6)} | standalone n=${String(r.standalone.n).padStart(3)} sumR=${(r.standalone.sumR >= 0 ? "+" : "") + r.standalone.sumR.toFixed(1).padStart(6)} (H1 ${(r.standalone.h1 >= 0 ? "+" : "") + r.standalone.h1.toFixed(1)} / H2 ${(r.standalone.h2 >= 0 ? "+" : "") + r.standalone.h2.toFixed(1)})${r.flagged ? "  ⚠ REMOVAL FLAG (pre-registered rule)" : ""}`);
  }
  const flagged = rows.filter(r => r.flagged);
  console.log(`\n  removal flags: ${flagged.length ? flagged.map(r => r.sym).join(", ") : "none — everything else is inconclusive by the pre-registered rule"}`);

  // ── P5.2 addition candidates ─────────────────────────────────────────────
  console.log("\n== P5.2 addition candidates ==");
  const inUniverse = new Set(lsSyms);
  let krakenBases = new Set<string>();
  try {
    const res = await fetch("https://futures.kraken.com/derivatives/api/v3/instruments", { headers: { accept: "application/json" } });
    const json: any = await res.json();
    for (const i of json?.instruments ?? []) {
      const sym: string = i?.symbol ?? "";
      if (!i?.tradeable) continue;
      const m = /^(PF|PI)_(.+?)(USD|USDT)$/i.exec(sym);
      if (!m) continue;
      let base = m[2].toUpperCase();
      if (base === "XBT") base = "BTC";
      base = base.replace(/^(1000000|10000|1000)/, "");
      krakenBases.add(base);
    }
  } catch (e: any) {
    console.log(`  Kraken instruments fetch failed: ${e?.message ?? e} — aborting P5.2`);
    krakenBases = new Set();
  }
  console.log(`  Kraken perp bases: ${krakenBases.size}`);

  // Binance 24h tickers for liquidity pre-filter + pair existence
  const volBySym = new Map<string, number>();
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/24hr");
    const json: any[] = await res.json();
    for (const t of json) {
      const s: string = t?.symbol ?? "";
      if (!s.endsWith("USDT")) continue;
      volBySym.set(s.slice(0, -4), parseFloat(t?.quoteVolume ?? "0"));
    }
  } catch (e: any) {
    console.log(`  Binance tickers fetch failed: ${e?.message ?? e}`);
  }

  const JULY_REJECTED = new Set(["TRX", "ALGO", "XLM", "JUP", "WIF", "MKR", "MANA", "STX", "TAO", "AXS", "OP", "SHIB"]);
  const candidates = [...krakenBases]
    .filter(b => !inUniverse.has(b) && !STABLES.has(b) && b.length >= 2 && b.length <= 8)
    .filter(b => (volBySym.get(b) ?? 0) >= MIN_QUOTE_VOL_24H)
    .sort((a, b) => (volBySym.get(b) ?? 0) - (volBySym.get(a) ?? 0));
  console.log(`  candidates after Kraken ∩ Binance($≥${MIN_QUOTE_VOL_24H / 1e6}M/24h) − universe: ${candidates.length}`);
  console.log(`  ${candidates.map(c => c + (JULY_REJECTED.has(c) ? "*" : "")).join(", ")}  (* = rejeitada no screen de Jul — teste repetido)`);

  // Two-halves screen with PRODUCTION exits (ENGINE_EXIT) + production floor (LS analyze as-is)
  console.log(`\n  screen: T≥${MIN_TRADES} · PF≥${MIN_PF} · sumR>0 em ambas as metades · exit r_multiple 2R · floor produção`);
  const pass: string[] = [];
  const passRepeat: string[] = [];
  for (const sym of candidates) {
    let candles: OHLCV[];
    try { candles = await fetchPaginated(sym, "1h", TOTAL_CANDLES); }
    catch (e: any) { console.log(`  ${sym.padEnd(7)} fetch failed (${e?.message ?? e})`); continue; }
    if (candles.length < 4000) { console.log(`  ${sym.padEnd(7)} histórico insuficiente (${candles.length})`); continue; }
    const cands = buildCandidatesTagged(liquiditySweepStrategy, sym, candles).filter(c => !c.rejectMinSL && !c.rejectMinRR);
    // standalone, non-overlapping with cooldown — mirror expand-universe-ls.ts
    const cdSec = (liquiditySweepStrategy.cooldownHours ?? 0) * 3600;
    const recs: Array<{ time: number; netR: number }> = [];
    let lastTs = -1e15;
    cands.forEach((c, i) => { c.idx = i; });
    const streamMap = new Map([[`${sym}:1h`, candles]]);
    const exitArr = resolveExitsFull(cands, streamMap, ENGINE_EXIT);
    for (const c of cands) {
      if (c.tsSec - lastTs < cdSec) continue;
      lastTs = c.tsSec;
      recs.push({ time: c.tsSec, netR: exitArr[c.idx].netR });
    }
    const mid = candles[Math.floor(candles.length / 2)].time;
    const agg = (rs: Array<{ netR: number }>) => stats(rs.map(r => r.netR));
    const h1 = agg(recs.filter(r => r.time < mid));
    const h2 = agg(recs.filter(r => r.time >= mid));
    const all = agg(recs);
    const ok = all.n >= MIN_TRADES && all.pf >= MIN_PF && h1.sumR > 0 && h2.sumR > 0;
    console.log(`  ${sym.padEnd(7)} ${ok ? "✅ PASS" : "   fail"}  T=${String(all.n).padStart(3)} PF=${all.pf === Infinity ? "∞" : all.pf.toFixed(2)} sumR=${(all.sumR >= 0 ? "+" : "") + all.sumR.toFixed(1)} | H1=${(h1.sumR >= 0 ? "+" : "") + h1.sumR.toFixed(1)} (T=${h1.n}) H2=${(h2.sumR >= 0 ? "+" : "") + h2.sumR.toFixed(1)} (T=${h2.n})${JULY_REJECTED.has(sym) ? "  *repetida" : ""}`);
    if (ok) (JULY_REJECTED.has(sym) ? passRepeat : pass).push(sym);
  }
  console.log(`\n  sobreviventes novos: ${pass.length ? pass.join(", ") : "(nenhum)"}`);
  console.log(`  sobreviventes de teste repetido (tratar com desconto): ${passRepeat.length ? passRepeat.join(", ") : "(nenhum)"}`);

  // ── P5.2b full-pipeline A/B for survivors (fork) ─────────────────────────
  const survivors = [...pass, ...passRepeat];
  if (survivors.length) {
    console.log(`\n== P5.2b A/B full-pipeline: universo 40 + {${survivors.join(", ")}} ==`);
    const extended: Strategy = {
      ...liquiditySweepStrategy,
      preferredSymbols: [...(liquiditySweepStrategy.preferredSymbols ?? []), ...survivors],
    };
    const extraCands: AuditCandidate[] = [];
    for (const sym of survivors) {
      const candles = await fetchPaginated(sym, "1h", TOTAL_CANDLES);
      streams.set(`${sym}:1h`, candles);
      extraCands.push(...buildCandidatesTagged(extended, sym, candles));
      try { md.dailyBySym.set(sym, await fetchPaginated(sym, "1d", 400)); } catch { /* trend falls back to neutral */ }
    }
    // registry order: BR, RSI, LS — extended LS candidates keep LS position (last)
    const combined = [
      ...tagged.filter(c => c.stratId !== "liquidity-sweep"),
      ...tagged.filter(c => c.stratId === "liquidity-sweep"),
      ...extraCands,
    ];
    combined.forEach((c, i) => { c.idx = i; });
    const combinedExits = resolveExitsFull(combined, streams, ENGINE_EXIT);
    const acceptedExt = combined.filter(c => !c.rejectMinSL && !c.rejectMinRR);
    const sim = simulateEngineCurrent(acceptedExt, combinedExits, md, strategies, START_CAPITAL, BASE_RISK_PCT);
    const a = lineOf(sim.trades); const y = lineOf(sim.trades, YEAR_2026_TS);
    console.log(`  EXTENDED: ALL T=${a.n} sumR=${(a.sumR >= 0 ? "+" : "") + a.sumR.toFixed(1)} exp=${a.exp.toFixed(3)} | 2026 T=${y.n} sumR=${(y.sumR >= 0 ? "+" : "") + y.sumR.toFixed(1)} exp=${y.exp.toFixed(3)}`);
    console.log(`  Δ vs baseline: ALL ${(a.sumR - baseAll.sumR >= 0 ? "+" : "") + (a.sumR - baseAll.sumR).toFixed(1)}R | 2026 ${(y.sumR - base26.sumR >= 0 ? "+" : "") + (y.sumR - base26.sumR).toFixed(1)}R`);
  } else {
    console.log("\n  (sem sobreviventes — não há A/B de adição a correr)");
  }

  mkdirSync("script/.cache", { recursive: true });
  writeFileSync("script/.cache/audit-phase5-universe.json", JSON.stringify({ generatedAt: new Date().toISOString(), baseline: { all: baseAll, y26: base26 }, excludeOne: rows }, null, 1));
  console.log(`\n[JSON: script/.cache/audit-phase5-universe.json]`);
}

main().catch(e => { console.error(e); process.exit(1); });
