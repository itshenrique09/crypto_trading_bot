import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, FlaskConical, TrendingUp, TrendingDown,
  BarChart3, Target, Clock, Zap, Play, Square, Loader2,
  ToggleLeft, ToggleRight
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor } from "@/lib/types";

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

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: paperStatus } = useQuery({
    queryKey: ["/api/paper/status"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/status")).json(),
    refetchInterval: 5000,
  });

  const { data: strategies = [] } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
    queryFn: async () => (await apiRequest("GET", "/api/strategies")).json(),
  });

  const { data: journal = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => (await apiRequest("GET", "/api/journal")).json(),
    refetchInterval: 15000,
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
    enabled: paperStatus?.running,
  });

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

  const priceMap = new Map(paperPrices.map(p => [p.id, p]));
  const paperTrades = journal.filter(e => e.mode === "paper");
  const openTrades = paperTrades.filter(e => e.outcome === "open");
  const closedTrades = paperTrades.filter(e => e.outcome !== "open");
  const totalWins = closedTrades.filter(e => e.outcome === "win").length;
  const totalPnl = closedTrades.reduce((s, e) => s + (e.pnl_pct || 0), 0);
  const running = paperStatus?.running || false;
  const recentClosed = closedTrades.slice(0, 5);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Engine Banner with Start/Stop + Strategy Toggles */}
      <Card className={`p-4 sm:p-5 ${running ? "border-emerald-500/30 bg-emerald-950/20" : "border-border/40"}`}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${running ? "bg-emerald-500/15" : "bg-muted/20"}`}>
              <FlaskConical className={`w-5 h-5 ${running ? "text-emerald-400" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{running ? "Engine Running" : "Engine Stopped"}</p>
                {running && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {running
                  ? `Scanning ${paperStatus?.coinsScanned || 0} coins · scan every 3min`
                  : "Start the engine to begin paper trading"
                }
              </p>
            </div>
          </div>
          {running ? (
            <button
              onClick={() => paperStopMutation.mutate()}
              disabled={paperStopMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-medium transition-colors shrink-0"
            >
              {paperStopMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />} Stop
            </button>
          ) : (
            <button
              onClick={() => paperStartMutation.mutate()}
              disabled={paperStartMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 font-medium transition-colors shrink-0"
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Trades"
          value={paperTrades.length}
          icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
        />
        <StatCard
          label="Open Positions"
          value={openTrades.length}
          icon={<Target className="w-4 h-4 text-yellow-400" />}
          valueColor="text-yellow-400"
        />
        <StatCard
          label="Win Rate"
          value={closedTrades.length > 0 ? `${Math.round((totalWins / closedTrades.length) * 100)}%` : "--"}
          icon={<Activity className="w-4 h-4 text-emerald-400" />}
          valueColor={closedTrades.length > 0 && totalWins >= closedTrades.length / 2 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          label="Total P&L"
          value={closedTrades.length > 0 ? `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%` : "--"}
          icon={totalPnl >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          valueColor={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Open Trades */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold">Open Trades</span>
              {openTrades.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">{openTrades.length}</span>
              )}
            </div>
            <Link href="/paper" className="text-xs text-muted-foreground hover:text-purple-400 transition-colors">View all</Link>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : openTrades.length === 0 ? (
            <Card className="border-border/40 py-10 text-center">
              <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No open positions</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Trades will appear here when the engine finds signals</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {openTrades.slice(0, 8).map(t => {
                const price = priceMap.get(t.id);
                const sc = getStratColor(t.strategy || "v2-swing");
                const pnl = price?.unrealizedPnl;
                return (
                  <Card key={t.id} className="border-border/30 p-3">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1.5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        t.direction === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {t.direction}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{t.symbol}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>
                            {strategies.find(s => s.id === t.strategy)?.name || "v2 Swing"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">Entry ${formatPrice(t.entry_price)}</span>
                      </div>
                      <div className="text-right shrink-0">
                        {price ? (
                          <>
                            <span className="text-xs text-muted-foreground font-mono block">${formatPrice(price.currentPrice)}</span>
                            <span className={`text-sm font-bold ${(pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {(pnl ?? 0) > 0 ? "+" : ""}{pnl?.toFixed(2) ?? "--"}%
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-yellow-400/60">Waiting...</span>
                        )}
                      </div>
                    </div>
                    {/* Live P&L progress bar */}
                    {price && (
                      <div className="mt-2">
                        <div className="relative h-1.5 rounded-full bg-border/20 overflow-hidden">
                          {price.progressPct >= 0 ? (
                            <div className="absolute left-1/2 h-full bg-emerald-500/50 rounded-full" style={{ width: `${Math.min(price.progressPct, 100) / 2}%` }} />
                          ) : (
                            <div className="absolute right-1/2 h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min(price.slProgress, 100) / 2}%` }} />
                          )}
                          <div className="absolute left-1/2 top-0 w-px h-full bg-muted-foreground/30" />
                        </div>
                        <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground/60">
                          <span>SL</span>
                          <span>Entry</span>
                          <span>TP</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Strategy Performance */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold">Strategy Performance</span>
          </div>

          {stratStats.length === 0 || stratStats.every(s => s.totalTrades === 0) ? (
            <Card className="border-border/40 py-10 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No data yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Performance metrics appear after trades close</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {stratStats.filter(s => s.totalTrades > 0).map(s => {
                const sc = getStratColor(s.strategyId);
                const wr = s.winRate ?? 0;
                return (
                  <Card key={s.strategyId} className={`p-3 border ${sc.border} ${sc.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${sc.text}`}>{s.strategyName}</span>
                      <span className="text-[10px] text-muted-foreground">{s.totalTrades} trades</span>
                    </div>
                    {s.closedTrades > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">Win Rate</span>
                          <span className={wr >= 50 ? "text-emerald-400" : "text-red-400"}>{wr}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                          <div className={`h-full rounded-full ${wr >= 50 ? "bg-emerald-500/60" : "bg-red-500/60"}`} style={{ width: `${wr}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        <span className="text-emerald-400 font-medium">{s.wins}W</span>
                        {" / "}
                        <span className="text-red-400 font-medium">{s.losses}L</span>
                      </span>
                      <span className={`font-bold ${s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.totalPnl > 0 ? "+" : ""}{s.totalPnl.toFixed(2)}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Closed Trades */}
      {recentClosed.length > 0 && (
        <Card className="border-border/40">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recent Closed Trades</span>
            </div>
            <Link href="/paper" className="text-xs text-muted-foreground hover:text-purple-400 transition-colors">View all</Link>
          </div>
          <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_90px] gap-2 px-5 py-2 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border/20">
            <span>Trade</span>
            <span className="text-right">Entry</span>
            <span className="text-right">Exit</span>
            <span className="text-right">P&L</span>
            <span className="text-right">Date</span>
          </div>
          <div className="divide-y divide-border/10">
            {recentClosed.map(t => {
              const sc = getStratColor(t.strategy || "v2-swing");
              return (
                <div key={t.id} className="flex sm:grid sm:grid-cols-[1fr_80px_80px_80px_90px] gap-2 items-center px-4 sm:px-5 py-3 hover:bg-card/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-[10px] w-5 h-5 rounded flex items-center justify-center font-bold shrink-0 ${
                      t.direction === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}>{t.direction}</span>
                    <span className="text-xs font-semibold">{t.symbol}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text} hidden sm:inline`}>
                      {strategies.find(s => s.id === t.strategy)?.name || "v2 Swing"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      t.outcome === "win" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>{t.outcome === "win" ? "WIN" : "LOSS"}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground text-right hidden sm:block">${formatPrice(t.entry_price)}</span>
                  <span className="text-xs font-mono text-muted-foreground text-right hidden sm:block">{t.exit_price ? `$${formatPrice(t.exit_price)}` : "--"}</span>
                  <span className={`text-xs font-mono font-bold text-right ${(t.pnl_pct || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.pnl_pct != null ? `${t.pnl_pct > 0 ? "+" : ""}${t.pnl_pct}%` : "--"}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-right hidden sm:block">
                    {new Date(t.closed_at || t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, valueColor }: { label: string; value: string | number; icon: React.ReactNode; valueColor?: string }) {
  return (
    <Card className="border-border/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className={`text-xl font-bold ${valueColor || "text-foreground"}`}>{value}</span>
    </Card>
  );
}
