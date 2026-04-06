import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FlaskConical, Play, Square, Loader2,
  ToggleLeft, ToggleRight, Filter
} from "lucide-react";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor } from "@/lib/types";
import TradeRow from "@/components/TradeRow";

interface StrategyStats {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalPnl: number;
  avgPnl: number | null;
}

export default function PaperTradingPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closeForm, setCloseForm] = useState({ exit_price: "", outcome: "win" as string });

  const { data: strategies = [] } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
    queryFn: async () => (await apiRequest("GET", "/api/strategies")).json(),
  });

  const { data: paperStatus } = useQuery({
    queryKey: ["/api/paper/status"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/status")).json(),
    refetchInterval: 5000,
  });

  const paperRunning = paperStatus?.running || false;

  const { data: journal = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => (await apiRequest("GET", "/api/journal")).json(),
    refetchInterval: paperRunning ? 15000 : false,
  });

  const { data: stratStats = [] } = useQuery<StrategyStats[]>({
    queryKey: ["/api/journal/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/journal/stats")).json(),
    refetchInterval: 30000,
  });

  const { data: paperPrices = [] } = useQuery<PaperPrice[]>({
    queryKey: ["/api/paper/prices"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/prices")).json(),
    refetchInterval: 10000,
    enabled: paperRunning,
  });

  const priceMap = new Map(paperPrices.map(p => [p.id, p]));

  const paperStartMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/paper/start"); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }),
  });

  const paperStopMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/paper/stop"); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }),
  });

  const toggleStrategyMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PUT", `/api/strategies/${id}/toggle`, { enabled });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/strategies"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      await apiRequest("PATCH", `/api/journal/${id}`, updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/journal/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal"] }),
  });

  const paperTrades = journal.filter(e => e.mode === "paper");
  const openTrades = paperTrades.filter(e => e.outcome === "open");
  const closedTrades = paperTrades.filter(e => e.outcome !== "open");
  const wins = closedTrades.filter(e => e.outcome === "win");
  const totalPnl = closedTrades.reduce((s, e) => s + (e.pnl_pct || 0), 0);

  const displayTrades = (tab === "open" ? openTrades : closedTrades)
    .filter(e => strategyFilter === "all" || (e.strategy || "v2-swing") === strategyFilter);

  const handleClose = (id: number) => {
    const entry = paperTrades.find(e => e.id === id);
    if (!entry) return;
    const exitPrice = parseFloat(closeForm.exit_price);
    if (isNaN(exitPrice)) return;
    const pnl = entry.direction === "LONG"
      ? ((exitPrice - entry.entry_price) / entry.entry_price) * 100
      : ((entry.entry_price - exitPrice) / entry.entry_price) * 100;
    updateMutation.mutate({
      id,
      updates: { outcome: closeForm.outcome, exit_price: exitPrice, pnl_pct: Math.round(pnl * 100) / 100, closed_at: new Date().toISOString() },
    });
    setClosingId(null);
    setCloseForm({ exit_price: "", outcome: "win" });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Engine Control */}
      <Card className={`p-4 sm:p-5 ${paperRunning ? "border-emerald-500/30 bg-emerald-950/20" : "border-border/40"}`}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${paperRunning ? "bg-emerald-500/15" : "bg-muted/20"}`}>
              <FlaskConical className={`w-5 h-5 ${paperRunning ? "text-emerald-400" : "text-muted-foreground"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{paperRunning ? "Engine Running" : "Engine Stopped"}</p>
                {paperRunning && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {paperRunning
                  ? `${paperStatus?.coinsScanned || 0} coins · scan every 3min${paperStatus?.lastScan ? ` · last ${new Date(paperStatus.lastScan).toLocaleTimeString()}` : ""}`
                  : "Click Start to begin scanning for signals"
                }
              </p>
            </div>
          </div>
          {paperRunning ? (
            <button
              onClick={() => paperStopMutation.mutate()}
              disabled={paperStopMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-medium transition-colors"
            >
              {paperStopMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} Stop
            </button>
          ) : (
            <button
              onClick={() => paperStartMutation.mutate()}
              disabled={paperStartMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 font-medium transition-colors"
            >
              {paperStartMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start
            </button>
          )}
        </div>

        {/* Strategy Toggles */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border/20">
          <span className="text-xs text-muted-foreground self-center mr-1">Strategies:</span>
          {strategies.map(s => {
            const c = getStratColor(s.id);
            const counts = paperStatus?.strategyCounts?.[s.id];
            return (
              <button
                key={s.id}
                onClick={() => toggleStrategyMutation.mutate({ id: s.id, enabled: !s.enabled })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  s.enabled
                    ? `${c.bg} ${c.border} ${c.text}`
                    : "bg-card/30 border-border/20 text-muted-foreground/50"
                }`}
              >
                {s.enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                {s.name}
                {counts && counts.total > 0 && (
                  <span className="text-[10px] opacity-70 ml-0.5">{counts.open}/{counts.total}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Total" value={paperTrades.length} />
        <MiniStat label="Open" value={openTrades.length} color="text-yellow-400" />
        <MiniStat label="Win Rate" value={closedTrades.length > 0 ? `${Math.round((wins.length / closedTrades.length) * 100)}%` : "--"} color={wins.length >= closedTrades.length - wins.length ? "text-emerald-400" : "text-red-400"} />
        <MiniStat label="Total P&L" value={closedTrades.length > 0 ? `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%` : "--"} color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <MiniStat label="Avg P&L" value={closedTrades.length > 0 ? `${(totalPnl / closedTrades.length).toFixed(2)}%` : "--"} color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
      </div>

      {/* Strategy Mini Stats */}
      {stratStats.filter(s => s.totalTrades > 0).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stratStats.filter(s => s.totalTrades > 0).map(s => {
            const sc = getStratColor(s.strategyId);
            return (
              <Card key={s.strategyId} className={`p-3 border ${sc.border} ${sc.bg}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${sc.text}`}>{s.strategyName}</span>
                  <span className="text-[10px] text-muted-foreground">{s.totalTrades} trades</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">WR: <b className={s.winRate !== null && s.winRate >= 50 ? "text-emerald-400" : "text-red-400"}>{s.winRate ?? "--"}%</b></span>
                  <span className="text-muted-foreground">P&L: <b className={s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{s.totalPnl > 0 ? "+" : ""}{s.totalPnl.toFixed(2)}%</b></span>
                  <span className="text-muted-foreground"><b className="text-emerald-400">{s.wins}</b>W / <b className="text-red-400">{s.losses}</b>L</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-card/40 border border-border/30 rounded-lg p-0.5">
          <button
            onClick={() => setTab("open")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === "open" ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Open ({openTrades.length})
          </button>
          <button
            onClick={() => setTab("closed")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === "closed" ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            History ({closedTrades.length})
          </button>
        </div>

        {strategies.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={strategyFilter}
              onChange={e => setStrategyFilter(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md bg-card/40 border border-border/30 text-foreground"
            >
              <option value="all">All Strategies</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Trade List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : displayTrades.length === 0 ? (
        <Card className="border-border/40 py-12 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{tab === "open" ? "No open trades" : "No closed trades"}</p>
          {tab === "open" && !paperRunning && (
            <p className="text-xs text-muted-foreground/60 mt-1">Start the engine to begin scanning for signals</p>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {displayTrades.map(entry => (
            <Card key={entry.id} className="border-border/30">
              <TradeRow
                entry={entry}
                strategies={strategies}
                price={priceMap.get(entry.id)}
                closingId={closingId}
                closeForm={closeForm}
                onStartClose={(id) => setClosingId(id)}
                onCancelClose={() => setClosingId(null)}
                onCloseFormChange={(updates) => setCloseForm(f => ({ ...f, ...updates }))}
                onConfirmClose={handleClose}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="border-border/40 px-3 py-2.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">{label}</span>
      <span className={`text-base font-bold ${color || "text-foreground"}`}>{value}</span>
    </Card>
  );
}
