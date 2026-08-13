// Typed data hooks — every query in the app goes through here so that
// endpoints, polling intervals and cache keys live in exactly one place.

import { useMutation, useQuery } from "@tanstack/react-query";
import { API_BASE, apiRequest, getJson, queryClient } from "./queryClient";
import { toast } from "@/hooks/use-toast";
import type {
  CandlesResponse, CoinData, EngineConfig, JournalEntry, LiveStatus,
  PaperPrice, PaperStatus, ScanLogEntry, SignalsResponse, StrategyInfo,
} from "./types";

// ── Poll cadence (single source of truth) ────────────────────────────
// SSE (lib/sse.ts) is the primary freshness channel — the server pushes on
// every engine cycle. These intervals are the FALLBACK when the stream drops.
const POLL = {
  engine: 30_000,
  prices: 30_000,
  journal: 60_000,
  market: 30_000,
  scanLog: 60_000,
  carry: 120_000,
} as const;

function useApi<T>(path: string, opts: { poll?: number; enabled?: boolean; staleTime?: number } = {}) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: () => getJson<T>(path),
    refetchInterval: opts.poll,
    enabled: opts.enabled,
    staleTime: opts.staleTime,
  });
}

// ── Queries ──────────────────────────────────────────────────────────

export const usePaperStatus = () => useApi<PaperStatus>("/api/paper/status", { poll: POLL.engine });
export const useLiveStatus = () => useApi<LiveStatus>("/api/live/status", { poll: POLL.engine });
export const useJournal = () => useApi<JournalEntry[]>("/api/journal", { poll: POLL.journal });
export const usePaperPrices = (enabled: boolean) =>
  useApi<PaperPrice[]>("/api/paper/prices", { poll: POLL.prices, enabled });
export const useStrategies = () => useApi<StrategyInfo[]>("/api/strategies", { staleTime: 5 * 60_000 });
export const useMarket = () => useApi<CoinData[]>("/api/market", { poll: POLL.market });
export const useScanLog = () => useApi<ScanLogEntry[]>("/api/paper/scan-log", { poll: POLL.scanLog });
export const useFundingCarry = () => useApi<FundingCarryReport>("/api/funding-carry", { poll: POLL.carry });
export const useRuntime = () => useApi<RuntimeInfo>("/api/runtime", { staleTime: Infinity });
export const useFeatureFlags = () => useApi<FeatureFlags>("/api/settings/feature-flags");
export const useEngineConfig = () => useApi<EngineConfig>("/api/engine/config", { staleTime: Infinity });

// Health returns its body with HTTP 200 (ok) AND 503 (degraded) — bypass the
// throw-on-non-OK helper so a degraded system still renders its diagnosis.
export const useHealth = () =>
  useQuery<HealthInfo>({
    queryKey: ["/api/health"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/health`);
      return res.json();
    },
    refetchInterval: 5 * 60_000,
  });

export const useCandles = (symbol: string | undefined, interval: string, limit = 400) =>
  useQuery<CandlesResponse>({
    queryKey: ["/api/candles", symbol, interval, limit],
    queryFn: () => getJson<CandlesResponse>(`/api/candles/${symbol}?interval=${interval}&limit=${limit}`),
    enabled: !!symbol,
    refetchInterval: 30_000,
  });

export const useSignals = (symbol: string | undefined) =>
  useQuery<SignalsResponse>({
    queryKey: ["/api/signals", symbol],
    queryFn: () => getJson<SignalsResponse>(`/api/signals/${symbol}`),
    enabled: !!symbol,
    refetchInterval: 60_000,
  });

// ── Mutations (uniform error toast + cache invalidation) ─────────────

const invalidate = (...keys: string[]) => {
  for (const key of keys) queryClient.invalidateQueries({ queryKey: [key] });
};

export function useAction<TVars = void>(
  fn: (vars: TVars) => Promise<unknown>,
  opts: { invalidates?: string[]; successMessage?: string; onSuccess?: () => void } = {},
) {
  return useMutation<unknown, Error, TVars>({
    mutationFn: fn as (vars: TVars) => Promise<unknown>,
    onSuccess: () => {
      invalidate(...(opts.invalidates ?? []));
      if (opts.successMessage) toast({ description: opts.successMessage });
      opts.onSuccess?.();
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Falhou", description: err.message });
    },
  });
}

const ENGINE_KEYS = ["/api/paper/status", "/api/live/status", "/api/journal"];

export const usePaperStart = () => useAction(() => apiRequest("POST", "/api/paper/start"), { invalidates: ENGINE_KEYS, successMessage: "Paper engine iniciado" });
export const usePaperStop = () => useAction(() => apiRequest("POST", "/api/paper/stop"), { invalidates: ENGINE_KEYS, successMessage: "Paper engine parado" });
export const useLiveStart = () => useAction(() => apiRequest("POST", "/api/live/start"), { invalidates: ENGINE_KEYS, successMessage: "Live engine iniciado" });
export const useLiveStop = () => useAction(() => apiRequest("POST", "/api/live/stop"), { invalidates: ENGINE_KEYS, successMessage: "Live engine parado" });
export const useCloseLive = () => useAction(
  (id: number) => apiRequest("POST", `/api/live/close/${id}`),
  { invalidates: ENGINE_KEYS, successMessage: "Posição fechada na exchange" },
);

/**
 * Manual paper close. The P&L numbers come from /api/paper/prices —
 * server-computed marks — so the closed row records what the engine saw.
 */
export const useClosePaper = () => useAction(
  ({ id, exitPrice, pnlPct, pnlUsd }: { id: number; exitPrice: number; pnlPct: number | null; pnlUsd: number | null }) =>
    apiRequest("PATCH", `/api/journal/${id}`, {
      outcome: (pnlUsd ?? 0) >= 0 ? "win" : "loss",
      exit_price: exitPrice,
      closed_at: new Date().toISOString(),
      ...(pnlPct != null ? { pnl_pct: pnlPct } : {}),
      ...(pnlUsd != null ? { pnl_usd: pnlUsd } : {}),
      remaining_position_size_usd: 0,
    }),
  { invalidates: [...ENGINE_KEYS, "/api/paper/prices"], successMessage: "Posição simulada fechada" },
);

export const useForceScan = () => useAction(
  () => apiRequest("POST", "/api/paper/tick"),
  { invalidates: ["/api/paper/status", "/api/paper/scan-log", "/api/journal"], successMessage: "Scan forçado — resultados no feed em segundos" },
);

// ── Extra response types ─────────────────────────────────────────────

export interface HealthInfo {
  status: "ok" | "degraded";
  reasons: string[];
  uptimeSeconds: number;
  db: { ok: boolean; journalRows: number };
  marketData: { ok: boolean; note: string; checkedAt: string };
  engines: {
    paper: { running: boolean; lastScan: string | null };
    live: { running: boolean; error: string | null; unmanagedPositions: number; lastScan: string | null };
  };
  backups: {
    dir: string;
    keep: number;
    count: number;
    lastBackupAt: string | null;
    lastBackupFile: string | null;
    lastError: string | null;
  };
}

export interface RuntimeInfo {
  app: string;
  nodeEnv: string;
  version: string;
  buildCommit: string;
  buildDirty: boolean;
  buildTime: string;
  startedAt: string;
}

export interface FeatureFlags {
  regime_filter_enabled: boolean;
  short_macro_filter_enabled: boolean;
  btc_regime_gate_enabled: boolean;
  trailing_mode: "r_multiple" | "fixed_pct";
  trailing_r_multiple: number;
}

export interface FundingCarryReport {
  updatedAt: string | null;
  config: {
    entryAnnualized: number;
    exitAnnualized: number;
    notionalPerLeg: number;
    maxPositions: number;
    universeSize: number;
  };
  opportunities: { symbol: string; annualizedPct: number; side: string; simulatable: boolean }[];
  portfolio: {
    openPositions: { symbol: string; side: string; openedAt: string; accruedUsd: number; entryCostUsd: number; entryAnnualizedPct: number }[];
    accruedOpenUsd: number;
    openEntryCostsUsd: number;
    realizedUsd: number;
    openedCount: number;
    closedCount: number;
  };
  recentEvents: { id: number; time: string; symbol: string; action: string; rate: number; annualized: number; notional: number; pnl_usd: number; note: string }[];
}
