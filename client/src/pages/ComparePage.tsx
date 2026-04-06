import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, TrendingUp, TrendingDown, Trophy,
  Target, BarChart3, Percent, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import type { JournalEntry, StrategyInfo } from "@/lib/types";
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

export default function ComparePage() {
  const { data: strategies = [] } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
    queryFn: async () => (await apiRequest("GET", "/api/strategies")).json(),
  });

  const { data: stratStats = [], isLoading } = useQuery<StrategyStats[]>({
    queryKey: ["/api/journal/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/journal/stats")).json(),
    refetchInterval: 30000,
  });

  const { data: journal = [] } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => (await apiRequest("GET", "/api/journal")).json(),
    refetchInterval: 30000,
  });

  const paperTrades = journal.filter(e => e.mode === "paper");
  const activeStats = stratStats.filter(s => s.totalTrades > 0);

  // Find best strategy per metric
  const bestWinRate = activeStats.reduce((best, s) => (!best || (s.winRate ?? 0) > (best.winRate ?? 0)) ? s : best, null as StrategyStats | null);
  const bestPnl = activeStats.reduce((best, s) => (!best || s.totalPnl > best.totalPnl) ? s : best, null as StrategyStats | null);
  const bestAvgPnl = activeStats.reduce((best, s) => (!best || (s.avgPnl ?? 0) > (best.avgPnl ?? 0)) ? s : best, null as StrategyStats | null);
  const mostTrades = activeStats.reduce((best, s) => (!best || s.totalTrades > best.totalTrades) ? s : best, null as StrategyStats | null);

  // Per-strategy coin breakdown
  const coinBreakdown = (strategyId: string) => {
    const trades = paperTrades.filter(t => (t.strategy || "v2-swing") === strategyId && t.outcome !== "open");
    const bySymbol: Record<string, { wins: number; losses: number; pnl: number }> = {};
    for (const t of trades) {
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { wins: 0, losses: 0, pnl: 0 };
      if (t.outcome === "win") bySymbol[t.symbol].wins++;
      else bySymbol[t.symbol].losses++;
      bySymbol[t.symbol].pnl += t.pnl_pct || 0;
    }
    return Object.entries(bySymbol)
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.pnl - a.pnl);
  };

  // Recent trades timeline per strategy
  const recentByStrategy = (strategyId: string) => {
    return paperTrades
      .filter(t => (t.strategy || "v2-swing") === strategyId && t.outcome !== "open")
      .slice(0, 10);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold tracking-tight">Strategy Comparison</h1>
        <p className="text-xs text-muted-foreground">Side-by-side performance analysis of all strategies</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : activeStats.length === 0 ? (
        <Card className="border-border/40 py-16 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No strategy data yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Start the paper trading engine and wait for trades to close to see comparisons</p>
        </Card>
      ) : (
        <>
          {/* Leaderboard Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LeaderCard
              label="Best Win Rate"
              strategy={bestWinRate}
              value={bestWinRate?.winRate != null ? `${bestWinRate.winRate}%` : "--"}
              icon={<Trophy className="w-4 h-4 text-yellow-400" />}
            />
            <LeaderCard
              label="Best Total P&L"
              strategy={bestPnl}
              value={bestPnl ? `${bestPnl.totalPnl > 0 ? "+" : ""}${bestPnl.totalPnl.toFixed(2)}%` : "--"}
              icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            />
            <LeaderCard
              label="Best Avg P&L"
              strategy={bestAvgPnl}
              value={bestAvgPnl?.avgPnl != null ? `${bestAvgPnl.avgPnl > 0 ? "+" : ""}${bestAvgPnl.avgPnl.toFixed(2)}%` : "--"}
              icon={<Percent className="w-4 h-4 text-blue-400" />}
            />
            <LeaderCard
              label="Most Active"
              strategy={mostTrades}
              value={mostTrades ? `${mostTrades.totalTrades} trades` : "--"}
              icon={<Activity className="w-4 h-4 text-purple-400" />}
            />
          </div>

          {/* Side-by-Side Comparison Table */}
          <Card className="border-border/40 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-border/30">
              <h2 className="text-sm font-semibold">Head-to-Head</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20 text-xs text-muted-foreground">
                    <th className="text-left py-3 px-4 sm:px-5 font-medium">Metric</th>
                    {activeStats.map(s => {
                      const sc = getStratColor(s.strategyId);
                      return (
                        <th key={s.strategyId} className="text-center py-3 px-3 font-medium">
                          <span className={`inline-block px-2 py-1 rounded ${sc.bg} ${sc.text}`}>{s.strategyName}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <CompareRow label="Total Trades" values={activeStats.map(s => `${s.totalTrades}`)} bestIdx={findBestIdx(activeStats.map(s => s.totalTrades))} />
                  <CompareRow label="Open" values={activeStats.map(s => `${s.openTrades}`)} />
                  <CompareRow label="Closed" values={activeStats.map(s => `${s.closedTrades}`)} />
                  <CompareRow label="Wins" values={activeStats.map(s => `${s.wins}`)} bestIdx={findBestIdx(activeStats.map(s => s.wins))} positive />
                  <CompareRow label="Losses" values={activeStats.map(s => `${s.losses}`)} bestIdx={findBestIdx(activeStats.map(s => -s.losses))} />
                  <CompareRow
                    label="Win Rate"
                    values={activeStats.map(s => s.winRate != null ? `${s.winRate}%` : "--")}
                    bestIdx={findBestIdx(activeStats.map(s => s.winRate ?? -1))}
                    colorFn={(s) => (s.winRate ?? 0) >= 50 ? "text-emerald-400" : (s.closedTrades > 0 ? "text-red-400" : "")}
                    stats={activeStats}
                    positive
                  />
                  <CompareRow
                    label="Total P&L"
                    values={activeStats.map(s => `${s.totalPnl > 0 ? "+" : ""}${s.totalPnl.toFixed(2)}%`)}
                    bestIdx={findBestIdx(activeStats.map(s => s.totalPnl))}
                    colorFn={(s) => s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
                    stats={activeStats}
                    positive
                  />
                  <CompareRow
                    label="Avg P&L"
                    values={activeStats.map(s => s.avgPnl != null ? `${s.avgPnl > 0 ? "+" : ""}${s.avgPnl.toFixed(2)}%` : "--")}
                    bestIdx={findBestIdx(activeStats.map(s => s.avgPnl ?? -999))}
                    colorFn={(s) => (s.avgPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
                    stats={activeStats}
                    positive
                  />
                </tbody>
              </table>
            </div>
          </Card>

          {/* Per-Strategy Detail Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeStats.map(s => {
              const sc = getStratColor(s.strategyId);
              const coins = coinBreakdown(s.strategyId);
              const recent = recentByStrategy(s.strategyId);
              const wr = s.winRate ?? 0;

              return (
                <Card key={s.strategyId} className={`border ${sc.border} overflow-hidden`}>
                  {/* Header */}
                  <div className={`px-4 py-3 border-b border-border/20 ${sc.bg}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${sc.text}`}>{s.strategyName}</span>
                      <span className="text-xs text-muted-foreground">{s.totalTrades} trades</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {strategies.find(st => st.id === s.strategyId)?.description || ""}
                    </p>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Win Rate</span>
                        <span className={`text-base font-bold ${wr >= 50 ? "text-emerald-400" : s.closedTrades > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {s.winRate != null ? `${s.winRate}%` : "--"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Total P&L</span>
                        <span className={`text-base font-bold ${s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.totalPnl > 0 ? "+" : ""}{s.totalPnl.toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">W / L</span>
                        <span className="text-base font-bold">
                          <span className="text-emerald-400">{s.wins}</span>
                          <span className="text-muted-foreground mx-0.5">/</span>
                          <span className="text-red-400">{s.losses}</span>
                        </span>
                      </div>
                    </div>

                    {/* Win Rate Bar */}
                    {s.closedTrades > 0 && (
                      <div>
                        <div className="h-2 rounded-full bg-border/20 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${wr >= 50 ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                            style={{ width: `${Math.max(wr, 3)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Top Coins */}
                    {coins.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-2">Top Coins</span>
                        <div className="space-y-1">
                          {coins.slice(0, 5).map(c => (
                            <div key={c.symbol} className="flex items-center justify-between text-xs py-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{c.symbol}</span>
                                <span className="text-muted-foreground">
                                  <span className="text-emerald-400">{c.wins}W</span>/{<span className="text-red-400">{c.losses}L</span>}
                                </span>
                              </div>
                              <span className={`font-mono font-medium ${c.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {c.pnl > 0 ? "+" : ""}{c.pnl.toFixed(2)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Trade Results */}
                    {recent.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-2">Recent Results</span>
                        <div className="flex gap-1 flex-wrap">
                          {recent.map(t => (
                            <div
                              key={t.id}
                              className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${
                                t.outcome === "win"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : t.outcome === "loss"
                                  ? "bg-red-500/15 text-red-400"
                                  : "bg-gray-500/15 text-gray-400"
                              }`}
                              title={`${t.symbol} ${t.outcome} ${t.pnl_pct ?? 0}%`}
                            >
                              {t.outcome === "win" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LeaderCard({ label, strategy, value, icon }: {
  label: string;
  strategy: StrategyStats | null;
  value: string;
  icon: React.ReactNode;
}) {
  const sc = strategy ? getStratColor(strategy.strategyId) : null;
  return (
    <Card className="border-border/40 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-lg font-bold block">{value}</span>
      {strategy && sc && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text} mt-1 inline-block`}>
          {strategy.strategyName}
        </span>
      )}
    </Card>
  );
}

function CompareRow({ label, values, bestIdx, colorFn, stats, positive }: {
  label: string;
  values: string[];
  bestIdx?: number;
  colorFn?: (s: StrategyStats) => string;
  stats?: StrategyStats[];
  positive?: boolean;
}) {
  return (
    <tr className="border-b border-border/10">
      <td className="py-2.5 px-4 sm:px-5 text-xs text-muted-foreground font-medium">{label}</td>
      {values.map((v, i) => {
        const isBest = bestIdx === i;
        const color = colorFn && stats ? colorFn(stats[i]) : "";
        return (
          <td key={i} className={`py-2.5 px-3 text-center font-mono ${color} ${isBest ? "font-bold" : ""}`}>
            {v}
            {isBest && <Trophy className="w-3 h-3 text-yellow-400 inline ml-1" />}
          </td>
        );
      })}
    </tr>
  );
}

function findBestIdx(values: number[]): number {
  if (values.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}
