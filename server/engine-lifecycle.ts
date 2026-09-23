// Engine lifecycle policy — pure functions behind the boot block in routes.ts.
//
// Three things went wrong on the production VPS between 2026-09-07 and
// 2026-09-19 (see AUDIT-NOTES Fase 10) and all three were "state that lived
// in the wrong place":
//
//  1. ONE `mode` setting ("paper" | "live" = whichever Start was pressed last)
//     both gated paperScan and chose the single engine to auto-start after a
//     restart. Pressing Start on live silently muted paper entries for 11
//     days while paper positions kept being managed. Each engine now has its
//     own persisted running flag and paperScan no longer reads `mode`.
//  2. Registry pause defaults were written only when a mode had NO pause list
//     yet; an install that already had one (RSI paused since Aug) never saw the
//     redesign's `defaultPaused.live = true`, so both new strategies traded
//     live from the first scan after the deploy. Defaults are now applied per
//     strategy and per policy revision (`Strategy.pausePolicyRev`), so a new
//     strategy — or a re-decided one — gets its default exactly once, whatever
//     the lists already contain.
//  3. The drawdown guard's re-base lived in memory and was lost on every
//     restart, re-halting an engine for 24h at each boot while its raw 30-day
//     drawdown was ≥ 12R. The state is now serialised to bot_settings.
import { emptyDrawdownGuardState, type DrawdownGuardState } from "./portfolio-guards";

export type EngineMode = "paper" | "live";
export const ENGINE_MODES: readonly EngineMode[] = ["paper", "live"] as const;

export const ENGINE_RUNNING_KEYS = { paper: "paper_engine_running", live: "live_engine_running" } as const;
export const GUARD_STATE_KEYS = { paper: "guard_state_paper", live: "guard_state_live" } as const;
export const PAUSE_POLICY_APPLIED_KEY = "strategy_pause_policy_applied";

// ── Pause policy ────────────────────────────────────────────────────────────

export interface PausePolicyStrategy {
  id: string;
  defaultPaused?: { paper?: boolean; live?: boolean };
  /** Bump when the registry's default pause for this strategy is re-decided; defaults to 1. */
  pausePolicyRev?: number;
}

export interface PauseLists { paper: Set<string>; live: Set<string> }

export interface PausePolicyChange { id: string; mode: EngineMode; paused: boolean; rev: number }

export interface PausePolicyResult {
  lists: PauseLists;
  applied: Record<string, number>;
  changes: PausePolicyChange[];
}

/**
 * Apply each strategy's registry default pause ONCE per policy revision.
 * `applied` maps strategy id → highest revision already written; a strategy
 * absent from it (new, or an install predating this mechanism) is applied now.
 * The user's manual toggles are respected between revisions and overridden
 * only when the registry re-decides (revision bump) — that is the point.
 */
export function applyPausePolicy(
  strategies: readonly PausePolicyStrategy[],
  applied: Record<string, number>,
  lists: PauseLists,
): PausePolicyResult {
  const out: PauseLists = { paper: new Set(lists.paper), live: new Set(lists.live) };
  const nextApplied: Record<string, number> = { ...applied };
  const changes: PausePolicyChange[] = [];
  for (const s of strategies) {
    const rev = Math.max(1, Math.floor(s.pausePolicyRev ?? 1));
    if ((nextApplied[s.id] ?? 0) >= rev) continue;
    for (const mode of ENGINE_MODES) {
      const want = Boolean(s.defaultPaused?.[mode]);
      const has = out[mode].has(s.id);
      if (want === has) continue;
      if (want) out[mode].add(s.id); else out[mode].delete(s.id);
      changes.push({ id: s.id, mode, paused: want, rev });
    }
    nextApplied[s.id] = rev;
  }
  return { lists: out, applied: nextApplied, changes };
}

export function parseAppliedPolicy(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    return out;
  } catch { return {}; }
}

export function parseIdList(raw: string | null | undefined): Set<string> {
  if (raw == null) return new Set();
  try {
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch { return new Set(); }
}

// ── Which engines to start at boot ─────────────────────────────────────────

export interface BootInputs {
  /** Persisted per-engine flags ("true" | "false" | null when never written). */
  paperRunning: string | null;
  liveRunning: string | null;
  /** Legacy single flag: the mode of the engine whose Start was pressed last. */
  mode: string | null;
  /** Open journal rows per mode — an engine with open positions MUST run to manage them. */
  openPaper: number;
  openLive: number;
  /** Whether a live venue is configured (keys stored) — live cannot start without it. */
  liveConfigured: boolean;
}

export interface BootDecision {
  paper: boolean;
  live: boolean;
  /** True when the decision came from the legacy `mode` flag and should be persisted as per-engine flags. */
  migrated: boolean;
  warnings: string[];
  reason: string;
}

export function decideEnginesToStart(f: BootInputs): BootDecision {
  const warnings: string[] = [];
  const hasFlags = f.paperRunning != null || f.liveRunning != null;
  let paper: boolean, live: boolean, migrated = false, reason: string;
  if (hasFlags) {
    paper = f.paperRunning === "true";
    live = f.liveRunning === "true";
    reason = `per-engine flags (paper=${f.paperRunning ?? "unset"}, live=${f.liveRunning ?? "unset"})`;
  } else {
    // Legacy install: `mode` says which Start was pressed last, not which
    // engines were running. Open positions are the ground truth for "must run".
    paper = f.mode === "paper" || f.openPaper > 0;
    live = f.mode === "live" || f.openLive > 0;
    migrated = true;
    reason = `legacy mode=${f.mode ?? "unset"}, open paper=${f.openPaper}, open live=${f.openLive}`;
  }
  if (live && !f.liveConfigured) {
    live = false;
    warnings.push(f.openLive > 0
      ? `live engine wanted (${f.openLive} open live position(s)) but no live venue is configured — positions are NOT being managed by the bot`
      : "live engine flag set but no live venue is configured — not started");
  }
  if (!live && f.openLive > 0 && f.liveConfigured) {
    warnings.push(`${f.openLive} open live position(s) with the live engine stopped — start it or close them on the venue`);
  }
  return { paper, live, migrated, warnings, reason };
}

// ── Drawdown-guard state persistence ───────────────────────────────────────

export function serializeGuardState(s: DrawdownGuardState): string {
  return JSON.stringify({
    halted: Boolean(s.halted),
    haltedSinceMs: s.haltedSinceMs ?? null,
    rebasedAtCumR: s.rebasedAtCumR ?? null,
    rebasedAtMs: s.rebasedAtMs ?? null,
  });
}

export function parseGuardState(raw: string | null | undefined): DrawdownGuardState {
  const empty = emptyDrawdownGuardState();
  if (!raw) return empty;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return empty;
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v)) ? v : null;
    const halted = o.halted === true;
    const haltedSinceMs = num(o.haltedSinceMs);
    // A halt without a timestamp could never expire — do not resurrect it.
    if (halted && haltedSinceMs == null) return empty;
    const rebasedAtCumR = num(o.rebasedAtCumR);
    const rebasedAtMs = num(o.rebasedAtMs);
    return {
      halted,
      haltedSinceMs: halted ? haltedSinceMs : null,
      rebasedAtCumR: rebasedAtMs != null ? rebasedAtCumR : null,
      rebasedAtMs: rebasedAtCumR != null ? rebasedAtMs : null,
    };
  } catch { return empty; }
}
