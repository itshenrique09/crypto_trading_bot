import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, TrendingUp, TrendingDown,
  BarChart3, Target, Clock, Zap,
  ArrowUpRight, ArrowDownRight,
  CircleDot, Trophy, ChevronRight, LineChart,
  Play, Square, Loader2, Wallet, Settings2
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor, getStratName } from "@/lib/types";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";

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
  profitFactor: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
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

  const { data: liveStatus } = useQuery({
    queryKey: ["/api/live/status"],
    queryFn: async () => (await apiRequest("GET", "/api/live/status")).json(),
    refetchInterval: 10000,
  });

  const paperStartMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/paper/start", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }),
  });
  const paperStopMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/paper/stop", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }),
  });

  const priceMap = new Map(paperPrices.map(p => [p.id, p]));
  const paperTrades = journal.filter(e => e.mode === "paper");
  const openTrades = paperTrades.filter(e => e.outcome === "open");
  const closedTrades = paperTrades.filter(e => e.outcome !== "open");
  const totalWins = closedTrades.filter(e => e.outcome === "win").length;
  const running = paperStatus?.running || false;
  const recentClosed = closedTrades.slice(0, 5);
  const activeStats = stratStats.filter(s => s.totalTrades > 0);

  // ── Honest, size-normalized R metrics (the numbers a trader actually judges by).
  // Summing pnl_pct across differently-sized positions is misleading; R = pnl/risk is not.
  const rTrades = closedTrades
    .filter(t => t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null)
    .map(t => t.pnl_usd! / t.risk_usd!);
  const sumR = rTrades.reduce((s, r) => s + r, 0);
  const grossWinR = rTrades.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const grossLossR = -rTrades.filter(r => r < 0).reduce((s, r) => s + r, 0);
  const profitFactor = grossLossR > 0 ? grossWinR / grossLossR : (grossWinR > 0 ? Infinity : 0);
  const expectancy = rTrades.length ? sumR / rTrades.length : 0;
  const winRate = closedTrades.length ? (totalWins / closedTrades.length) * 100 : 0;

  // Sort open trades by absolute P&L (biggest movers first)
  const sortedOpen = [...openTrades].sort((a, b) => {
    const pnlA = priceMap.get(a.id)?.unrealizedPnl ?? 0;
    const pnlB = priceMap.get(b.id)?.unrealizedPnl ?? 0;
    return Math.abs(pnlB) - Math.abs(pnlA);
  });

  // ── Equity curve — cumulative R (size-normalized, honest) ─────────
  const equityData = (() => {
    const sorted = [...closedTrades]
      .filter(t => t.closed_at && t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

    if (sorted.length === 0) return [];

    let cumulative = 0;
    let peak = 0;
    return [
      { date: "Start", equity: 0, drawdown: 0 },
      ...sorted.map(t => {
        cumulative += t.pnl_usd! / t.risk_usd!;
        if (cumulative > peak) peak = cumulative;
        const drawdown = peak > 0 ? cumulative - peak : 0;
        return {
          date: new Date(t.closed_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          equity: Math.round(cumulative * 100) / 100,
          drawdown: Math.round(drawdown * 100) / 100,
          symbol: t.symbol,
          outcome: t.outcome,
        };
      }),
    ];
  })();

  const equityFinal = equityData.length > 0 ? equityData[equityData.length - 1].equity : 0;
  const maxDrawdown = equityData.length > 0
    ? Math.min(...equityData.map(d => d.drawdown))
    : 0;

  const cap = paperStatus?.capital;
  const realReturnPct = cap && cap.initial > 0 ? ((cap.balance - cap.initial) / cap.initial) * 100 : null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px]">
      {/* Hero: Title */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
        <Link href="/paper" className="text-[11px] text-muted-foreground hover:text-purple-400 transition-colors flex items-center gap-1">
          <Settings2 className="w-3 h-3" /> Settings &amp; history
        </Link>
      </div>

      {/* Engine Control Strip — actionable */}
      <Card className={`border-border/30 overflow-hidden ${running ? "bg-emerald-500/[0.03] border-emerald-500/30" : ""}`}>
        <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
          {/* Paper engine: status + action */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
              running ? "bg-emerald-500/15 text-emerald-400" : "bg-card/60 text-muted-foreground"
            }`}>
              {running ? <Activity className="w-4 h-4 animate-pulse" /> : <CircleDot className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight">Paper Engine</p>
              <p className="text-[10px] text-muted-foreground/70 truncate">
                {running ? `Scanning · ${paperStatus?.coinsScanned ?? 0} coins / cycle` : "Stopped"}
              </p>
            </div>
            {running ? (
              <button
                onClick={() => paperStopMutation.mutate()}
                disabled={paperStopMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-colors font-semibold disabled:opacity-50"
              >
                {paperStopMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />} Stop
              </button>
            ) : (
              <button
                onClick={() => paperStartMutation.mutate()}
                disabled={paperStartMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold disabled:opacity-50"
              >
                {paperStartMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Start
              </button>
            )}
          </div>

          <span className="text-border/40 hidden md:inline">│</span>

          {/* Capital summary + Live pill — wraps cleanly on mobile */}
          <div className="flex items-center gap-3 flex-wrap flex-1 md:justify-end">
            {cap && (
              <>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <Wallet className="w-3 h-3 text-emerald-400/60" />
                  <span className="text-[10px] text-muted-foreground/60">Balance</span>
                  <span className={`text-xs font-bold font-mono ${cap.balance >= cap.initial ? "text-emerald-400" : "text-red-400"}`}>
                    €{cap.balance.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[10px] text-muted-foreground/60">1R</span>
                  <span className="text-xs font-bold font-mono text-amber-400">€{cap.oneR.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[10px] text-muted-foreground/60">Today</span>
                  <span className={`text-xs font-bold font-mono ${cap.todayR >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {cap.todayR >= 0 ? "+" : ""}{cap.todayR.toFixed(1)}R
                  </span>
                </div>
              </>
            )}
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border whitespace-nowrap ${
              liveStatus?.running
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : liveStatus?.hasKeys
                ? "bg-card/40 border-border/30 text-muted-foreground"
                : "bg-card/30 border-border/20 text-muted-foreground/50"
            }`}>
              <Zap className="w-2.5 h-2.5" />
              Live: {liveStatus?.running ? "active" : liveStatus?.hasKeys ? "ready" : "not set"}
            </span>
          </div>
        </div>
      </Card>

      {/* Key Metrics Strip — honest, size-normalized (R) + real account return */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Account Return"
          value={realReturnPct != null ? `${realReturnPct > 0 ? "+" : ""}${realReturnPct.toFixed(1)}%` : "--"}
          icon={<Wallet className="w-4 h-4 text-emerald-400" />}
          valueColor={realReturnPct != null ? (realReturnPct >= 0 ? "text-emerald-400" : "text-red-400") : ""}
          sub={cap ? `€${cap.balance.toFixed(2)} balance` : "No capital set"}
        />
        <MetricCard
          label="Net R"
          value={rTrades.length > 0 ? `${sumR > 0 ? "+" : ""}${sumR.toFixed(1)}R` : "--"}
          icon={sumR >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
          valueColor={rTrades.length > 0 ? (sumR >= 0 ? "text-emerald-400" : "text-red-400") : ""}
          sub={rTrades.length > 0 ? `expectancy ${expectancy > 0 ? "+" : ""}${expectancy.toFixed(2)}R / trade` : "No closed trades"}
        />
        <MetricCard
          label="Profit Factor"
          value={rTrades.length > 0 ? (profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)) : "--"}
          icon={<BarChart3 className="w-4 h-4 text-blue-400" />}
          valueColor={rTrades.length > 0 ? (profitFactor >= 1 ? "text-emerald-400" : "text-red-400") : ""}
          sub={`${closedTrades.length} closed · gross ${grossWinR.toFixed(0)}R / ${grossLossR.toFixed(0)}R`}
        />
        <MetricCard
          label="Win Rate"
          value={closedTrades.length > 0 ? `${Math.round(winRate)}%` : "--"}
          icon={<Trophy className="w-4 h-4 text-amber-400" />}
          valueColor={closedTrades.length > 0 ? (winRate >= 45 ? "text-emerald-400" : "text-amber-400") : ""}
          sub={closedTrades.length > 0 ? `${totalWins}W / ${closedTrades.length - totalWins}L · ${openTrades.length} open` : `${openTrades.length} open`}
        />
      </div>

      {/* Equity Curve */}
      <Card className="border-border/20 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold">Equity Curve</h2>
            <span className="text-[10px] text-muted-foreground/50">paper · cumulative R</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            {equityData.length > 1 && (
              <>
                <span className={`font-mono font-bold ${equityFinal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {equityFinal > 0 ? "+" : ""}{equityFinal.toFixed(1)}R
                </span>
                {maxDrawdown < -0.01 && (
                  <span className="font-mono text-red-400/70">
                    DD {maxDrawdown.toFixed(1)}R
                  </span>
                )}
                <span className="text-muted-foreground/40">{rTrades.length} trades</span>
              </>
            )}
          </div>
        </div>

        {equityData.length < 2 ? (
          <div className="h-[160px] flex items-center justify-center">
            <div className="text-center">
              <LineChart className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/40">Equity curve appears after first closed trade</p>
            </div>
          </div>
        ) : (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={equityFinal >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={equityFinal >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v > 0 ? "+" : ""}${v}R`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15,15,20,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    padding: "6px 10px",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}
                  formatter={(value: number, name: string) => [
                    `${value > 0 ? "+" : ""}${value.toFixed(2)}R`,
                    name === "equity" ? "Cumulative R" : "Drawdown",
                  ]}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                {/* Drawdown shading */}
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="transparent"
                  fill="url(#drawdownGrad)"
                  isAnimationActive={false}
                />
                {/* Equity line */}
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={equityFinal >= 0 ? "#22c55e" : "#ef4444"}
                  strokeWidth={1.5}
                  fill="url(#equityGrad)"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

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
                const sc = getStratColor(t.strategy);
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
                            {getStratName(t.strategy, strategies)}
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
                      {/* Row 1: name + total P&L */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${sc.text}`}>{s.strategyName}</span>
                          {s.openTrades > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-semibold">
                              {s.openTrades} open
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-bold font-mono ${s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.totalPnl > 0 ? "+" : ""}{s.totalPnl.toFixed(2)}%
                        </span>
                      </div>

                      {/* Win rate bar */}
                      {s.closedTrades > 0 && (
                        <div className="mb-2">
                          <div className="h-1 rounded-full bg-border/30 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${wr >= 50 ? "bg-emerald-500/60" : "bg-red-500/60"}`} style={{ width: `${Math.max(wr, 3)}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Row 2: W/L + WR + trades */}
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span>
                          <span className="text-emerald-400 font-semibold">{s.wins}W</span>
                          <span className="mx-1 text-muted-foreground/30">/</span>
                          <span className="text-red-400 font-semibold">{s.losses}L</span>
                        </span>
                        <span className="text-muted-foreground">
                          WR: <span className={`font-semibold ${wr >= 50 ? "text-emerald-400" : s.closedTrades > 0 ? "text-red-400" : "text-muted-foreground"}`}>{s.winRate != null ? `${wr}%` : "--"}</span>
                        </span>
                        <span className="text-muted-foreground/50 text-[10px]">{s.closedTrades} closed</span>
                      </div>

                      {/* Row 3: Avg P&L + Profit Factor + Avg Win/Loss */}
                      {s.closedTrades > 0 && (
                        <div className="flex items-center gap-3 pt-1.5 border-t border-border/15 text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground/50">Avg</span>
                            <span className={`font-mono font-semibold ${(s.avgPnl ?? 0) >= 0 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                              {s.avgPnl != null ? `${s.avgPnl > 0 ? "+" : ""}${s.avgPnl.toFixed(2)}%` : "--"}
                            </span>
                          </div>
                          {s.profitFactor != null && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground/50">PF</span>
                              <span className={`font-mono font-semibold ${s.profitFactor >= 1 ? "text-emerald-400/80" : "text-red-400/80"}`}>
                                {s.profitFactor.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {s.avgWin != null && s.avgLoss != null && (
                            <div className="flex items-center gap-1 ml-auto">
                              <span className="text-emerald-400/60 font-mono">+{s.avgWin.toFixed(1)}%</span>
                              <span className="text-muted-foreground/30">/</span>
                              <span className="text-red-400/60 font-mono">{s.avgLoss.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      )}
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
                  const sc = getStratColor(t.strategy);
                  const rMult = t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null ? t.pnl_usd / t.risk_usd : null;
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
                            {getStratName(t.strategy, strategies)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/50">
                          {new Date(t.closed_at || t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <span className={`text-xs font-bold font-mono ${(rMult ?? t.pnl_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {rMult != null ? `${rMult > 0 ? "+" : ""}${rMult.toFixed(2)}R` : t.pnl_pct != null ? `${t.pnl_pct > 0 ? "+" : ""}${t.pnl_pct}%` : "--"}
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
