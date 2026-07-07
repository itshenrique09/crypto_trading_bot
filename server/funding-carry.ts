// ─── FUNDING-RATE CARRY — scanner + paper simulation (Phase 1) ─────────────
// Non-directional return source, uncorrelated with the candle strategies:
// when perp funding is strongly positive, a SHORT perp hedged by LONG spot
// collects the funding every settlement (MEXC: every 8h at 00/08/16 UTC)
// with ~zero price exposure. This module OBSERVES and SIMULATES that trade
// on live funding data — it never places orders. If the simulated ledger
// proves out over weeks, Phase 2 wires real execution.
//
// Economics (defaults below): round-trip cost ≈ perp 2×(0.02%+0.05% slip)
// + spot 2×(0.10%+0.05% slip) = 0.44% of notional. At the 30%/yr entry
// threshold (≈0.0274%/8h) breakeven ≈ 16 settlements ≈ 5.4 days of sustained
// elevated funding — which is why entry demands a HIGH bar and exit a low one
// (hysteresis) instead of churning in and out.
//
// Simulation honesty:
//   • accrual uses the rate observed at check time, not the exact settled
//     rate — close enough at 5-min polling, and errs both directions.
//   • only positive-funding carry is simulated (short perp + long spot);
//     negative-funding carry needs shorting spot — not retail-feasible on
//     MEXC — so those opportunities are ranked but flagged `simulatable: false`.
//   • hedge leg assumed at spot price = perp price (basis ignored). Basis
//     drift is a real Phase-2 concern; Phase 1 measures the funding leg.

import { getDb, persist } from "./db";
import { getSetting, setSetting } from "./storage";
import { getAllStrategies } from "./strategies/registry";

// ── Config ──────────────────────────────────────────────────────────────────
export interface CarryConfig {
  entryAnnualized: number;  // enter when annualized funding ≥ this (fraction/yr)
  exitAnnualized: number;   // exit when annualized funding < this
  notionalPerLeg: number;   // hypothetical USD per leg
  maxPositions: number;
  perpFeePct: number;       // taker, per fill
  spotFeePct: number;       // taker, per fill
  slippagePct: number;      // per leg fill
  /** Symbols with a real, liquid spot market to hedge on. null = allow all (tests only).
   *  Without this filter the top of the funding ranking is unhedgeable garbage —
   *  tokenized stocks (no spot), 1000×-scaled tickers, illiquid micro-caps whose
   *  extreme funding is a liquidity trap, not carry. */
  universe: ReadonlySet<string> | null;
}

export const DEFAULT_CARRY_CONFIG: CarryConfig = {
  entryAnnualized: 0.30,
  exitAnnualized: 0.10,
  notionalPerLeg: 1000,
  maxPositions: 5,
  perpFeePct: 0.0002,
  spotFeePct: 0.001,
  slippagePct: 0.0005,
  universe: null,
};

// Hedgeable universe = every coin the strategy registry trades (all are
// Binance-spot-verified, deep books). Recomputed per tick so universe changes
// in the registry propagate automatically.
export function hedgeableUniverse(): ReadonlySet<string> {
  const set = new Set<string>();
  for (const strat of getAllStrategies()) {
    for (const sym of strat.preferredSymbols ?? []) set.add(sym);
  }
  return set;
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface FundingSnapshot {
  symbol: string;           // bot symbol, e.g. "BTC"
  rate: number;             // funding rate per settlement (fraction, e.g. 0.0001)
  collectCycleHours: number;
}

export interface CarryOpportunity {
  symbol: string;
  rate: number;
  annualized: number;       // fraction per year, signed
  side: "short_perp" | "long_perp";
  simulatable: boolean;     // only short_perp (positive funding) in Phase 1
}

export interface CarryPosition {
  symbol: string;
  side: "short_perp";
  openedAtMs: number;
  lastAccrualMs: number;    // settlement cursor (advanced to last boundary paid)
  entryAnnualized: number;
  accruedUsd: number;       // funding collected (or paid, if rate flipped) so far
  entryCostUsd: number;
}

export interface CarryState {
  positions: CarryPosition[];
  realizedUsd: number;      // net of all costs, closed positions only
  openedCount: number;
  closedCount: number;
}

export interface CarryEvent {
  time: string;
  symbol: string;
  action: "open" | "settle" | "close";
  rate: number;
  annualized: number;
  notional: number;
  pnlUsd: number;           // settle: accrual delta · close: realized net · open: −entryCost
  note: string;
}

export function emptyCarryState(): CarryState {
  return { positions: [], realizedUsd: 0, openedCount: 0, closedCount: 0 };
}

// ── Pure math ───────────────────────────────────────────────────────────────
export function annualizeRate(rate: number, collectCycleHours: number): number {
  if (!(collectCycleHours > 0)) return 0;
  return rate * (8760 / collectCycleHours);
}

// Settlement boundaries sit at epoch multiples of the cycle (MEXC 8h cycles
// settle 00/08/16 UTC, and the Unix epoch is UTC-midnight aligned).
// Counts boundaries in (fromMs, toMs].
export function countSettlements(fromMs: number, toMs: number, collectCycleHours: number): number {
  if (!(collectCycleHours > 0) || toMs <= fromMs) return 0;
  const cycleMs = collectCycleHours * 3_600_000;
  return Math.floor(toMs / cycleMs) - Math.floor(fromMs / cycleMs);
}

export function lastSettlementBoundary(nowMs: number, collectCycleHours: number): number {
  const cycleMs = collectCycleHours * 3_600_000;
  return Math.floor(nowMs / cycleMs) * cycleMs;
}

function legCosts(cfg: CarryConfig): number {
  // one entry OR one exit across both legs (perp + spot)
  return cfg.notionalPerLeg * (cfg.perpFeePct + cfg.slippagePct)
       + cfg.notionalPerLeg * (cfg.spotFeePct + cfg.slippagePct);
}

export function rankOpportunities(
  snapshots: FundingSnapshot[],
  minAbsAnnualized = 0,
  universe: ReadonlySet<string> | null = null,
): CarryOpportunity[] {
  return snapshots
    .filter(s => !universe || universe.has(s.symbol))
    .map(s => {
      const annualized = annualizeRate(s.rate, s.collectCycleHours);
      return {
        symbol: s.symbol,
        rate: s.rate,
        annualized,
        side: (s.rate >= 0 ? "short_perp" : "long_perp") as CarryOpportunity["side"],
        simulatable: s.rate > 0,
      };
    })
    .filter(o => Math.abs(o.annualized) >= minAbsAnnualized)
    .sort((a, b) => Math.abs(b.annualized) - Math.abs(a.annualized));
}

// ── Pure state transition — one polling tick ───────────────────────────────
export function updateCarryState(
  state: CarryState,
  snapshots: FundingSnapshot[],
  nowMs: number,
  cfg: CarryConfig = DEFAULT_CARRY_CONFIG,
): { state: CarryState; events: CarryEvent[] } {
  const events: CarryEvent[] = [];
  const bySymbol = new Map(snapshots.map(s => [s.symbol, s]));
  const nowIso = new Date(nowMs).toISOString();
  const next: CarryState = {
    positions: [],
    realizedUsd: state.realizedUsd,
    openedCount: state.openedCount,
    closedCount: state.closedCount,
  };

  // 1) settle + close checks on held positions
  for (const pos of state.positions) {
    const snap = bySymbol.get(pos.symbol);
    const p = { ...pos };

    if (snap) {
      const n = countSettlements(p.lastAccrualMs, nowMs, snap.collectCycleHours);
      if (n > 0) {
        // short perp RECEIVES positive funding, PAYS negative funding
        const delta = snap.rate * cfg.notionalPerLeg * n;
        p.accruedUsd += delta;
        p.lastAccrualMs = lastSettlementBoundary(nowMs, snap.collectCycleHours);
        events.push({
          time: nowIso, symbol: p.symbol, action: "settle",
          rate: snap.rate, annualized: annualizeRate(snap.rate, snap.collectCycleHours),
          notional: cfg.notionalPerLeg, pnlUsd: delta,
          note: `${n} settlement(s)`,
        });
      }
    }

    const annualizedNow = snap ? annualizeRate(snap.rate, snap.collectCycleHours) : 0;
    const outOfUniverse = cfg.universe != null && !cfg.universe.has(p.symbol);
    const shouldClose = !snap || outOfUniverse || annualizedNow < cfg.exitAnnualized;
    if (shouldClose) {
      const exitCost = legCosts(cfg);
      const realized = p.accruedUsd - p.entryCostUsd - exitCost;
      next.realizedUsd += realized;
      next.closedCount += 1;
      events.push({
        time: nowIso, symbol: p.symbol, action: "close",
        rate: snap?.rate ?? 0, annualized: annualizedNow,
        notional: cfg.notionalPerLeg, pnlUsd: realized,
        note: !snap
          ? "funding data gone — closed"
          : outOfUniverse
            ? "not in hedgeable universe — closed"
            : `annualized ${(annualizedNow * 100).toFixed(1)}% < exit ${(cfg.exitAnnualized * 100).toFixed(0)}% (accrued ${p.accruedUsd.toFixed(2)}, costs ${(p.entryCostUsd + exitCost).toFixed(2)})`,
      });
    } else {
      next.positions.push(p);
    }
  }

  // 2) open new positions from the top of the ranking
  const held = new Set(next.positions.map(p => p.symbol));
  const candidates = rankOpportunities(snapshots, 0, cfg.universe).filter(o =>
    o.simulatable && o.annualized >= cfg.entryAnnualized && !held.has(o.symbol));

  for (const cand of candidates) {
    if (next.positions.length >= cfg.maxPositions) break;
    const snap = bySymbol.get(cand.symbol)!;
    const entryCost = legCosts(cfg);
    next.positions.push({
      symbol: cand.symbol,
      side: "short_perp",
      openedAtMs: nowMs,
      // start accruing from the NEXT boundary — we were not short at the last one
      lastAccrualMs: lastSettlementBoundary(nowMs, snap.collectCycleHours),
      entryAnnualized: cand.annualized,
      accruedUsd: 0,
      entryCostUsd: entryCost,
    });
    next.openedCount += 1;
    events.push({
      time: nowIso, symbol: cand.symbol, action: "open",
      rate: cand.rate, annualized: cand.annualized,
      notional: cfg.notionalPerLeg, pnlUsd: -entryCost,
      note: `annualized ${(cand.annualized * 100).toFixed(1)}% ≥ entry ${(cfg.entryAnnualized * 100).toFixed(0)}% — short perp + long spot (paper)`,
    });
  }

  return { state: next, events };
}

// ── IO: MEXC funding fetch ──────────────────────────────────────────────────
const FUNDING_URL = "https://contract.mexc.com/api/v1/contract/funding_rate";

export async function fetchFundingSnapshots(): Promise<FundingSnapshot[]> {
  const res = await fetch(FUNDING_URL);
  if (!res.ok) throw new Error(`MEXC funding HTTP ${res.status}`);
  const data: any = await res.json();
  const list: any[] = data?.data ?? [];
  const out: FundingSnapshot[] = [];
  for (const f of list) {
    const contract: string = f?.symbol ?? "";
    if (!contract.endsWith("_USDT")) continue;
    const rate = parseFloat(f?.fundingRate);
    if (!Number.isFinite(rate)) continue;
    const cycle = Number(f?.collectCycle) || 8;
    out.push({ symbol: contract.slice(0, -5), rate, collectCycleHours: cycle });
  }
  return out;
}

// ── Persistence ─────────────────────────────────────────────────────────────
const STATE_KEY = "funding_carry_state";

async function loadState(): Promise<CarryState> {
  try {
    const raw = await getSetting(STATE_KEY);
    if (!raw) return emptyCarryState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.positions)) return emptyCarryState();
    return parsed as CarryState;
  } catch {
    return emptyCarryState();
  }
}

async function saveState(state: CarryState): Promise<void> {
  await setSetting(STATE_KEY, JSON.stringify(state));
}

async function logEvents(events: CarryEvent[]): Promise<void> {
  if (!events.length) return;
  const db = await getDb();
  for (const e of events) {
    db.run(
      "INSERT INTO funding_carry_log (time, symbol, action, rate, annualized, notional, pnl_usd, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [e.time, e.symbol, e.action, e.rate, e.annualized, e.notional, e.pnlUsd, e.note],
    );
  }
  persist(db);
}

async function recentEvents(limit = 50): Promise<any[]> {
  const db = await getDb();
  const stmt = db.prepare("SELECT * FROM funding_carry_log ORDER BY id DESC LIMIT ?");
  stmt.bind([limit]);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ── Loop + report ───────────────────────────────────────────────────────────
const POLL_MS = 5 * 60 * 1000;
let lastSnapshots: FundingSnapshot[] = [];
let lastUpdatedAt: string | null = null;
let running = false;
let loopStarted = false;

export async function fundingCarryTick(nowMs = Date.now()): Promise<void> {
  if (running) return;
  running = true;
  try {
    const snapshots = await fetchFundingSnapshots();
    lastSnapshots = snapshots;
    lastUpdatedAt = new Date(nowMs).toISOString();
    const state = await loadState();
    const cfg: CarryConfig = { ...DEFAULT_CARRY_CONFIG, universe: hedgeableUniverse() };
    const { state: nextState, events } = updateCarryState(state, snapshots, nowMs, cfg);
    await saveState(nextState);
    await logEvents(events);
    for (const e of events) {
      console.log(`[funding-carry] ${e.action} ${e.symbol} rate=${(e.rate * 100).toFixed(4)}% pnl=${e.pnlUsd.toFixed(2)} — ${e.note}`);
    }
  } catch (err: any) {
    console.error("[funding-carry] tick failed:", err?.message ?? err);
  } finally {
    running = false;
  }
}

export function startFundingCarryLoop(): void {
  if (loopStarted) return;
  loopStarted = true;
  // fire once shortly after boot, then poll
  setTimeout(() => { void fundingCarryTick(); }, 15_000);
  setInterval(() => { void fundingCarryTick(); }, POLL_MS);
  console.log("[funding-carry] paper observer started (poll 5m, no execution)");
}

export async function getFundingCarryReport() {
  const state = await loadState();
  const accruedOpen = state.positions.reduce((s, p) => s + p.accruedUsd, 0);
  const openCosts = state.positions.reduce((s, p) => s + p.entryCostUsd, 0);
  const universe = hedgeableUniverse();
  return {
    updatedAt: lastUpdatedAt,
    config: { ...DEFAULT_CARRY_CONFIG, universe: undefined, universeSize: universe.size },
    opportunities: rankOpportunities(lastSnapshots, 0, universe).slice(0, 15).map(o => ({
      ...o,
      annualizedPct: Math.round(o.annualized * 1000) / 10,
    })),
    portfolio: {
      openPositions: state.positions.map(p => ({
        ...p,
        openedAt: new Date(p.openedAtMs).toISOString(),
        entryAnnualizedPct: Math.round(p.entryAnnualized * 1000) / 10,
      })),
      accruedOpenUsd: Math.round(accruedOpen * 100) / 100,
      openEntryCostsUsd: Math.round(openCosts * 100) / 100,
      realizedUsd: Math.round(state.realizedUsd * 100) / 100,
      openedCount: state.openedCount,
      closedCount: state.closedCount,
    },
    recentEvents: await recentEvents(50),
  };
}
