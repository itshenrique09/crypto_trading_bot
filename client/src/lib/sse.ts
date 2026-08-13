// Server-Sent Events client — the server pushes an event whenever an engine
// cycle finishes, and we invalidate exactly the queries that cycle touched.
// Polling (lib/api.ts) stays as a slower fallback for when the stream drops.

import { useSyncExternalStore } from "react";
import { API_BASE, queryClient } from "./queryClient";

const INVALIDATIONS: Record<string, string[]> = {
  paper: ["/api/paper/status", "/api/paper/prices", "/api/journal"],
  live: ["/api/live/status", "/api/journal"],
  scan: ["/api/paper/scan-log"],
  journal: ["/api/journal", "/api/paper/status", "/api/live/status"],
};

let source: EventSource | null = null;
let connected = false;
const listeners = new Set<() => void>();

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach(fn => fn());
}

export function startSse() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource(`${API_BASE}/api/events`);
  source.onopen = () => setConnected(true);
  // EventSource reconnects by itself; we only track the indicator state.
  source.onerror = () => setConnected(false);
  for (const [type, keys] of Object.entries(INVALIDATIONS)) {
    source.addEventListener(type, () => {
      for (const key of keys) queryClient.invalidateQueries({ queryKey: [key] });
    });
  }
}

/** Live connection state for the topbar indicator. */
export function useSseConnected(): boolean {
  return useSyncExternalStore(
    fn => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    () => connected,
  );
}
