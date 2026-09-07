// ─── SCAN SCHEDULER — run the strategy scan at candle closes, not on a free timer ──
// Strategies decide on the last CLOSED candle, so the only moments a scan can
// find a fresh setup are the candle closes. A free-running 3-minute interval
// gave a uniform 0–3 min entry latency and, after restarts or un-halts, entries
// on setups 15–57 minutes old (now also rejected by the freshness gate). This
// module fires at every close of the given intervals plus a fixed offset (the
// feeds publish the closed bar within seconds) and once more at a retry offset,
// coalescing coinciding closes (a 4h/1d close is also a 1h close) into one run.
import { intervalToMs } from "./candles";

/** Start of the next candle close for `interval` strictly after `nowMs` (UTC-aligned, like the exchanges). */
export function nextCloseMs(interval: string, nowMs: number): number {
  const iv = intervalToMs(interval);
  if (!iv) throw new Error(`Unknown interval ${interval}`);
  return Math.floor(nowMs / iv) * iv + iv;
}

/**
 * Earliest due time strictly after `nowMs` among all (interval × offset)
 * combinations: for each interval, the next close whose close+offset is still
 * in the future, plus the previous close's close+offset if that is still ahead
 * (so a retry offset scheduled after a close that already happened still fires).
 */
export function nextDueMs(intervals: string[], offsetsMs: number[], nowMs: number): number {
  let best = Infinity;
  for (const interval of intervals) {
    const iv = intervalToMs(interval);
    if (!iv) continue;
    const prevClose = Math.floor(nowMs / iv) * iv;
    for (const off of offsetsMs) {
      for (const close of [prevClose, prevClose + iv]) {
        const due = close + off;
        if (due > nowMs && due < best) best = due;
      }
    }
  }
  return best;
}

export interface ScanSchedule {
  stop(): void;
  /** Next scheduled run, for status displays. */
  nextRunAt(): number | null;
}

/**
 * setTimeout chain (never setInterval): each run re-computes the next due time
 * from the clock, so drift and long-running scans cannot accumulate. Overlapping
 * runs are prevented with an in-flight flag — a due run that finds a scan still
 * running is skipped, not queued (the next close will produce a fresh one).
 */
export function scheduleAtCloses(
  intervals: string[],
  offsetsMs: number[],
  run: () => Promise<void>,
  now: () => number = () => Date.now(),
): ScanSchedule {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let inFlight = false;
  let next: number | null = null;

  const arm = () => {
    if (stopped) return;
    const t = now();
    const due = nextDueMs(intervals, offsetsMs, t);
    if (!Number.isFinite(due)) return;
    next = due;
    timer = setTimeout(async () => {
      timer = null;
      if (stopped) return;
      if (!inFlight) {
        inFlight = true;
        try { await run(); } catch (err) { console.error("[scan-scheduler] run failed:", err); }
        finally { inFlight = false; }
      }
      arm();
    }, Math.max(0, due - t));
  };
  arm();

  return {
    stop() { stopped = true; if (timer) { clearTimeout(timer); timer = null; } next = null; },
    nextRunAt() { return next; },
  };
}
