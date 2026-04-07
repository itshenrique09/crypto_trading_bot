import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, TrendingUp, TrendingDown,
  BarChart3, Target, Clock, Zap, Play, Square, Loader2,
  ToggleLeft, ToggleRight, ArrowUpRight, ArrowDownRight,
  CircleDot, Trophy, Percent, ChevronRight
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
  const activeStats = stratStats.filter(s => s.totalTrades > 0);

  // Sort open trades by absolute P&L (biggest movers first)
  const sortedOpen = [...openTrades].sort((a, b) => {
    const pnlA = priceMap.get(a.id)?.unrealizedPnl ?? 0;
    const pnlB = priceMap.get(b.id)?.unrealizedPnl ?? 0;
    return Math.abs(pnlB) - Math.abs(pnlA);
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px]">
      {/* Top bar: Engine + Stats in one row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Engine Control — compact */}
        <Card className={`flex-1 p-4 flex items-center gap-4 ${running ? "border-emerald-500/30 bg-emerald-950/10" : "border-border/40"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${running ? "bg-emerald-500/15" : "bg-muted/20"}`}>
            {running ? <Activity className="w-5 h-5 text-emerald-400 animate-pulse" /> : <CircleDot className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold">{running ? "Engine Running" : "Engine Stopped"}</p>
              {running && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {running
                ? `${paperStatus?.coinsScanned || 0} coins scanned · every 3min`
                : "Start to begin scanning for signals"
              }
            </p>
          </div>
          {running ? (
            <button
              onClick={() => paperStopMutation.mutate()}
              disabled={paperStopMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 font-semibold transition-colors shrink-0"
            >
              {paperStopMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />} Stop
            </button>
          ) : (
            <button
              onClick={() => paperStartMutation.mutate()}
              disabled={paperStartMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 font-semibold transition-colors shrink-0"
            >
              {paperStartMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Start
            </button>
          )}
        </Card>
      </div>

      {/* Strategy Toggles — separate horizontal strip */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium mr-1">Strategies:</span>
        {strategies.map(s => {
          const c = getStratColor(s.id);
          const counts = paperStatus?.strategyCounts?.[s.id];
          return (
            <button
              key={s.id}
              onClick={() => toggleStrategyMutation.mutate({ id: s.id, enabled: !s.enabled })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                s.enabled
                  ? `${c.bg} ${c.border} ${c.text}`
                  : "bg-card/30 border-border/20 text-muted-foreground/50 line-through"
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

      {/* Key Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Open Positions"
          value={openTrades.length}
          icon={<Target className="w-4 h-4 text-yellow-400" />}
          valueColor="text-yellow-400"
          sub={`of ${paperTrades.length} total`}
        />
        <MetricCard
          label="Win Rate"
          value={closedTrades.length > 0 ? `${Math.round((totalWins / closedTrades.length) * 100)}%` : "--"}
          icon={<Trophy className="w-4 h-4 text-amber-400" />}
          valueColor={closedTrades.length > 0 && totalWins >= closedTrades.length / 2 ? "text-emerald-400" : closedTrades.length > 0 ? "text-red-400" : ""}
          sub={closedTrades.length > 0 ? `${totalWins}W / ${closedTrades.length - totalWins}L` : "No closed trades"}
        />
        <MetricCard
          label="Total P&L"
          value={closedTrades.length > 0 ? `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%` : "--"}
          icon={totalPnl >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          valueColor={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          sub={closedTrades.length > 0 ? `${closedTrades.length} closed trades` : ""}
        />
        <MetricCard
          label="Avg P&L"
          value={closedTrades.length > 0 ? `${(totalPnl / closedTrades.length) > 0 ? "+" : ""}${(totalPnl / closedTrades.length).toFixed(2)}%` : "--"}
          icon={<Percent className="w-4 h-4 text-blue-400" />}
          valueColor={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          sub="per trade"
        />
      </div>

      {/* Main Content: Open Trades + Strategy Performance side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Open Trades — takes 2 cols */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-bold">Open Positions</h2>
              {openTrades.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold">{openTrades.length}</span>
              )}
            </div>
            <Link href="/paper" className="text-[11px] text-muted-foreground hover:text-purple-400 transition-colors flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-lg" />)}</div>
          ) : openTrades.length === 0 ? (
            <Card className="border-border/30 border-dashed py-12 text-center">
              <Target className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No open positions</p>
              <p className="text-[11px] text-muted-foreground/50 mt-1">Trades appear when the engine finds signals</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedOpen.slice(0, 8).map(t => {
                const price = priceMap.get(t.id);
                const sc = getStratColor(t.strategy || "confluence-swing");
                const pnl = price?.unrealizedPnl;
                return (
                  <Card key={t.id} className="border-border/20 hover:border-border/40 transition-colors overflow-hidden">
                    <div className="p-3 flex items-center gap-3">
                      {/* Direction badge */}
                      <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                        t.direction === "LONG" ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}>
                        {t.direction === "LONG"
                          ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          : <ArrowDownRight className="w-4 h-4 text-red-400" />
                        }
                        <span className={`text-[8px] font-bold mt-0.5 ${t.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                          {t.direction}
                        </span>
                      </div>

                      {/* Coin info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{t.symbol}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text} font-medium`}>
                            {strategies.find(s => s.id === t.strategy)?.name || "v2 Swing"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Entry <span className="text-foreground">${formatPrice(t.entry_price)}</span>
                          </span>
                          {price && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              Now <span className="text-foreground">${formatPrice(price.currentPrice)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* P&L */}
                      <div className="text-right shrink-0">
                        {price ? (
                          <span className={`text-base font-bold font-mono ${(pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {(pnl ?? 0) > 0 ? "+" : ""}{pnl?.toFixed(2) ?? "--"}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-yellow-400/50">Loading...</span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {price && (
                      <div className="px-3 pb-2">
                        <div className="relative h-1 rounded-full bg-border/15 overflow-hidden">
                          {price.progressPct >= 0 ? (
                            <div className="absolute left-1/2 h-full bg-emerald-500/50 rounded-full" style={{ width: `${Math.min(price.progressPct, 100) / 2}%` }} />
                          ) : (
                            <div className="absolute right-1/2 h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min(price.slProgress, 100) / 2}%` }} />
                          )}
                          <div className="absolute left-1/2 top-0 w-px h-full bg-muted-foreground/20" />
                        </div>
                        <div className="flex justify-between mt-0.5 text-[8px] text-muted-foreground/40 font-mono">
                          <span>SL ${formatPrice(t.stop_loss)}</span>
                          <span>TP ${formatPrice(t.take_profit1)}</span>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
              {openTrades.length > 8 && (
                <Link href="/paper" className="block text-center text-[11px] text-muted-foreground hover:text-purple-400 py-2">
                  +{openTrades.length - 8} more trades
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: Strategy Performance + Recent */}
        <div className="space-y-5">
          {/* Strategy Performance Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold">Strategy Performance</h2>
              </div>
              <Link href="/compare" className="text-[11px] text-muted-foreground hover:text-purple-400 transition-colors flex items-center gap-0.5">
                Compare <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {activeStats.length === 0 ? (
              <Card className="border-border/30 border-dashed py-8 text-center">
                <BarChart3 className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground">No data yet</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {activeStats.map(s => {
                  const sc = getStratColor(s.strategyId);
                  const wr = s.winRate ?? 0;
                  return (
                    <Card key={s.strategyId} className={`p-3 border ${sc.border} ${sc.bg} hover:brightness-110 transition-all`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-bold ${sc.text}`}>{s.strategyName}</span>
                        <span className={`text-sm font-bold font-mono ${s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.totalPnl > 0 ? "+" : ""}{s.totalPnl.toFixed(2)}%
                        </span>
                      </div>
                      {s.closedTrades > 0 && (
                        <div className="mb-2">
                          <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${wr >= 50 ? "bg-emerald-500/60" : "bg-red-500/60"}`} style={{ width: `${Math.max(wr, 3)}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          <span className="text-emerald-400 font-semibold">{s.wins}W</span>
                          <span className="mx-1 text-muted-foreground/30">/</span>
                          <span className="text-red-400 font-semibold">{s.losses}L</span>
                        </span>
                        <span className="text-muted-foreground">
                          WR: <span className={`font-semibold ${wr >= 50 ? "text-emerald-400" : s.closedTrades > 0 ? "text-red-400" : "text-muted-foreground"}`}>{s.winRate != null ? `${wr}%` : "--"}</span>
                        </span>
                        <span className="text-muted-foreground/60 text-[10px]">{s.totalTrades} trades</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Closed Trades */}
          {recentClosed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold">Recent Trades</h2>
                </div>
                <Link href="/paper" className="text-[11px] text-muted-foreground hover:text-purple-400 transition-colors flex items-center gap-0.5">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <Card className="border-border/20 divide-y divide-border/10 overflow-hidden">
                {recentClosed.map(t => {
                  const sc = getStratColor(t.strategy || "confluence-swing");
                  return (
                    <div key={t.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-card/30 transition-colors">
                      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                        t.outcome === "win" ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}>
                        {t.outcome === "win"
                          ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          : <ArrowDownRight className="w-3 h-3 text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">{t.symbol}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded ${sc.bg} ${sc.text}`}>
                            {strategies.find(s => s.id === t.strategy)?.name || "v2"}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/50">
                          {new Date(t.closed_at || t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <span className={`text-xs font-bold font-mono ${(t.pnl_pct || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl_pct != null ? `${t.pnl_pct > 0 ? "+" : ""}${t.pnl_pct}%` : "--"}
                      </span>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, valueColor, sub }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/20 p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        {icon}
      </div>
      <span className={`text-xl font-bold block ${valueColor || "text-foreground"}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">{sub}</span>}
    </Card>
  );
}
