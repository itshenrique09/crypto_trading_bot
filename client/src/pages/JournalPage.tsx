import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, BookOpen, CheckCircle2, XCircle, Clock,
  TrendingUp, TrendingDown, Minus, Zap, Radio,
  Trash2, Filter, AlertTriangle, FlaskConical, Play, Square, Loader2, Activity,
  ToggleLeft, ToggleRight, BarChart2, LineChart as LineChartIcon, ChevronDown, ChevronUp
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid
} from "recharts";
import { formatPrice, getSignalColor } from "@/lib/utils";
import TradeChartModal from "@/components/TradeChartModal";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PaperPrice, JournalEntry, StrategyInfo, STRATEGY_COLORS, getStratColor } from "@/lib/types";

const DEFAULT_STRATEGY = "confluence-swing";

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "win" | "loss">("all");
  const [modeFilter, setModeFilter] = useState<"all" | "signal" | "auto" | "paper">("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [closingId, setClosingId] = useState<number | null>(null);
  const [equityVisible, setEquityVisible] = useState(true);
  const [closeForm, setCloseForm] = useState({ exit_price: "", outcome: "win" as string });
  const [chartEntry, setChartEntry] = useState<any | null>(null);

  // Fetch current mode
  const { data: modeData } = useQuery({
    queryKey: ["/api/settings/mode"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/mode");
      return res.json();
    },
  });

  const currentMode = modeData?.mode || "signal";

  // Fetch strategies
  const { data: strategies = [] } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/strategies");
      return res.json();
    },
  });

  // Fetch journal (poll while paper running to catch auto-closed trades)
  const { data: journal = [], isLoading } = useQuery({
    queryKey: ["/api/journal"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/journal");
      return res.json();
    },
    refetchInterval: currentMode === "paper" ? 15000 : false,
  });

  // Paper trading status (server-side engine)
  const { data: paperStatusData } = useQuery({
    queryKey: ["/api/paper/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/paper/status");
      return res.json();
    },
    refetchInterval: 5000,
    enabled: currentMode === "paper",
  });

  const paperRunning = paperStatusData?.running || false;

  // Live prices for open paper trades
  const { data: paperPrices = [] } = useQuery<PaperPrice[]>({
    queryKey: ["/api/paper/prices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/paper/prices");
      return res.json();
    },
    refetchInterval: 10000,
    enabled: currentMode === "paper" && paperRunning,
  });

  const priceMap = useMemo(
    () => new Map(paperPrices.map((p: PaperPrice) => [p.id, p])),
    [paperPrices]
  );

  // Set mode
  const modeMutation = useMutation({
    mutationFn: async (newMode: string) => {
      await apiRequest("PUT", "/api/settings/mode", { mode: newMode });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/settings/mode"] }),
  });

  // Start/stop paper engine (server-side)
  const paperStartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/paper/start");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] });
    },
  });

  const paperStopMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/paper/stop");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] });
    },
  });

  // Toggle strategy on/off
  const toggleStrategyMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PUT", `/api/strategies/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
    },
  });

  const cycleMode = () => {
    const modes = ["signal", "auto", "paper"];
    const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
    const next = modes[nextIdx];
    if (currentMode === "paper" && paperRunning) paperStopMutation.mutate();
    modeMutation.mutate(next);
  };

  // Update journal entry (follow/close)
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      await apiRequest("PATCH", `/api/journal/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/prices"] });
    },
  });

  // Delete journal entry
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/journal/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/prices"] });
    },
  });

  // Filter entries
  const filtered = (journal as JournalEntry[]).filter(e => {
    if (filter !== "all" && e.outcome !== filter && !(filter === "open" && e.outcome === "open")) return false;
    if (modeFilter !== "all" && e.mode !== modeFilter) return false;
    if (strategyFilter !== "all" && (e.strategy || DEFAULT_STRATEGY) !== strategyFilter) return false;
    return true;
  });

  // Stats
  const all = journal as JournalEntry[];
  const closed = all.filter(e => e.outcome !== "open");
  const wins = closed.filter(e => e.outcome === "win");
  const losses = closed.filter(e => e.outcome === "loss");
  const totalPnl = closed.reduce((s, e) => s + (e.pnl_pct || 0), 0);
  const paperTrades = all.filter(e => e.mode === "paper");
  const paperClosed = paperTrades.filter(e => e.outcome !== "open");
  const paperPnl = paperClosed.reduce((s, e) => s + (e.pnl_pct || 0), 0);

  // Equity curve: closed trades filtered by strategy, sorted by close time
  const equityClosed = closed
    .filter(e => strategyFilter === "all" || (e.strategy || DEFAULT_STRATEGY) === strategyFilter)
    .filter(e => e.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  let _runningPnl = 0;
  let _peak = 0;
  const equityData = equityClosed.map((e, i) => {
    _runningPnl += e.pnl_pct || 0;
    _peak = Math.max(_peak, _runningPnl);
    const drawdown = _runningPnl - _peak;
    return {
      i: i + 1,
      label: new Date(e.closed_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pnl: Math.round(_runningPnl * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    };
  });
  const finalEquityPnl = equityData.length > 0 ? equityData[equityData.length - 1].pnl : 0;

  const handleClose = (id: number) => {
    const entry = all.find(e => e.id === id);
    if (!entry) return;
    const exitPrice = parseFloat(closeForm.exit_price);
    if (isNaN(exitPrice)) return;
    const pnl = entry.direction === "LONG"
      ? ((exitPrice - entry.entry_price) / entry.entry_price) * 100
      : ((entry.entry_price - exitPrice) / entry.entry_price) * 100;
    updateMutation.mutate({
      id,
      updates: {
        outcome: closeForm.outcome,
        exit_price: exitPrice,
        pnl_pct: Math.round(pnl * 100) / 100,
        closed_at: new Date().toISOString(),
      },
    });
    setClosingId(null);
    setCloseForm({ exit_price: "", outcome: "win" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/">
            <a className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs">Market</span>
            </a>
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold">Trade Journal</span>
          </div>

          {/* Mode Toggle */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase">Mode:</span>
            <button
              onClick={cycleMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentMode === "signal"
                  ? "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                  : currentMode === "paper"
                  ? "bg-orange-500/20 border border-orange-500/40 text-orange-300"
                  : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
              }`}
            >
              {currentMode === "signal" ? (
                <><Radio className="w-3 h-3" /> Signal</>
              ) : currentMode === "paper" ? (
                <><FlaskConical className="w-3 h-3" /> Paper</>
              ) : (
                <><Zap className="w-3 h-3" /> Auto</>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Mode banner — compact (full engine controls live on Dashboard + Trades pages) */}
        <Card className={`border-border/40 px-3 py-2 flex items-center gap-3 ${
          currentMode === "paper"  ? "border-orange-500/30 bg-orange-500/[0.03]" :
          currentMode === "signal" ? "border-blue-500/30 bg-blue-500/[0.03]" :
          "border-emerald-500/30 bg-emerald-500/[0.03]"
        }`}>
          {currentMode === "signal" ? <Radio className="w-4 h-4 text-blue-400 shrink-0" /> :
           currentMode === "paper"  ? <FlaskConical className="w-4 h-4 text-orange-400 shrink-0" /> :
                                      <Zap className="w-4 h-4 text-emerald-400 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${
              currentMode === "paper"  ? "text-orange-400" :
              currentMode === "signal" ? "text-blue-400" :
              "text-emerald-400"
            }`}>
              {currentMode === "signal" ? "Signal Mode" : currentMode === "paper" ? "Paper Trading" : "Auto (Live)"}
              {currentMode === "paper" && paperRunning && (
                <span className="ml-2 inline-flex items-center gap-1 text-[9px] text-orange-400/80 font-normal">
                  <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse" /> running · {paperStatusData?.openTrades || 0} open
                </span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {currentMode === "signal" && "Signals recorded as \u201CPending\u201D \u2014 you confirm Followed / Ignored manually."}
              {currentMode === "paper"  && `Multi-strategy simulation on top ${paperStatusData?.coinsScanned || 30} coins. Scan every 3 min.`}
              {currentMode === "auto"   && "Automatic execution on MEXC \u2014 configure keys on the Trades page."}
            </p>
          </div>
        </Card>

        {/* Strategy toggles — compact row */}
        {currentMode === "paper" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-1">Strategies:</span>
            {strategies.map(s => {
              const c = getStratColor(s.id);
              const counts = paperStatusData?.strategyCounts?.[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStrategyMutation.mutate({ id: s.id, enabled: !s.enabled })}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all border ${
                    s.enabled
                      ? `${c.bg} ${c.border} ${c.text}`
                      : "bg-card/30 border-border/20 text-muted-foreground/60 line-through"
                  }`}
                >
                  {s.name}
                  {counts && counts.total > 0 && <span className="text-[9px] opacity-70">{counts.open}/{counts.total}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Trades" value={`${all.length}`} color="text-blue-400" />
          <StatCard label="Open" value={`${all.filter(e => e.outcome === "open").length}`} color="text-yellow-400" />
          <StatCard label="Win Rate" value={closed.length > 0 ? `${Math.round((wins.length / closed.length) * 100)}%` : "--"} color={wins.length >= losses.length ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Total P&L" value={`${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%`} color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Paper Trades" value={`${paperTrades.length}`} color="text-orange-400" />
          <StatCard label="Paper P&L" value={paperClosed.length > 0 ? `${paperPnl > 0 ? "+" : ""}${paperPnl.toFixed(2)}%` : "--"} color={paperPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>

        {/* Equity Curve */}
        <Card className="border-border/20 overflow-hidden">
          <button
            onClick={() => setEquityVisible(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-card/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <LineChartIcon className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold">Equity Curve</span>
              {strategyFilter !== "all" && (
                <span className={`text-[10px] px-2 py-0.5 rounded ${getStratColor(strategyFilter).bg} ${getStratColor(strategyFilter).text}`}>
                  {strategies.find(s => s.id === strategyFilter)?.name || strategyFilter}
                </span>
              )}
              {equityClosed.length > 0 && (
                <span className={`text-xs font-mono font-bold ml-1 ${finalEquityPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {finalEquityPnl >= 0 ? "+" : ""}{finalEquityPnl.toFixed(2)}%
                </span>
              )}
            </div>
            {equityVisible ? <ChevronUp className="w-4 h-4 text-muted-foreground/50" /> : <ChevronDown className="w-4 h-4 text-muted-foreground/50" />}
          </button>

          {equityVisible && (
            <div className="px-2 pb-3">
              {equityClosed.length < 2 ? (
                <div className="h-28 flex items-center justify-center">
                  <p className="text-[11px] text-muted-foreground/40">
                    {equityClosed.length === 0 ? "No closed trades yet" : "Need at least 2 closed trades"}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={equityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v > 0 ? "+" : ""}${v}%`}
                      width={42}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
                    <Tooltip
                      contentStyle={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 11 }}
                      labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                      formatter={(value: number, name: string) => [
                        `${value >= 0 ? "+" : ""}${value}%`,
                        name === "pnl" ? "Cumulative P&L" : "Drawdown",
                      ]}
                    />
                    <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.5} fill="url(#ddGrad)" dot={false} />
                    <Area type="monotone" dataKey="pnl" stroke="#22c55e" strokeWidth={1.5} fill="url(#equityGrad)" dot={false} activeDot={{ r: 3, fill: "#22c55e" }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {(["all", "open", "win", "loss"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                filter === f
                  ? "bg-purple-500/30 border border-purple-500/50 text-purple-300 font-medium"
                  : "bg-card/50 border border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "open" ? "Open" : f === "win" ? "Wins" : "Losses"}
            </button>
          ))}
          <span className="text-border/40 mx-1">|</span>
          {(["all", "signal", "auto", "paper"] as const).map(f => (
            <button
              key={f}
              onClick={() => setModeFilter(f)}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                modeFilter === f
                  ? "bg-blue-500/30 border border-blue-500/50 text-blue-300 font-medium"
                  : "bg-card/50 border border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All Modes" : f === "signal" ? "Signal" : f === "paper" ? "Paper" : "Auto"}
            </button>
          ))}
          {strategies.length > 1 && (
            <>
              <span className="text-border/40 mx-1">|</span>
              {[{ id: "all", name: "All Strats" }, ...strategies].map(s => {
                const c = s.id !== "all" ? getStratColor(s.id) : null;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStrategyFilter(s.id)}
                    className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                      strategyFilter === s.id
                        ? c ? `${c.bg} border ${c.border} ${c.text} font-medium` : "bg-purple-500/30 border border-purple-500/50 text-purple-300 font-medium"
                        : "bg-card/50 border border-border/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Journal Entries */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="border-border/50 bg-card/50 p-8 text-center">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No trades yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Go to a coin's analysis page and click "Log Signal" to start tracking trades.
            </p>
          </Card>
        )}

        {filtered.map((entry) => {
          const sc = getStratColor(entry.strategy || DEFAULT_STRATEGY);
          return (
          <Card key={entry.id} className="border-border/50 bg-card/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {/* Direction badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  entry.direction === "LONG"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}>
                  {entry.direction}
                </span>
                {/* Symbol */}
                <Link href={`/analyze/${entry.symbol}`}>
                  <a className="text-sm font-bold hover:text-purple-400 transition-colors">{entry.symbol}</a>
                </Link>
                {/* Strategy badge */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>
                  {strategies.find(s => s.id === (entry.strategy || DEFAULT_STRATEGY))?.name || (entry.strategy === "v2-swing" ? "Confluence Swing" : entry.strategy || "Confluence Swing")}
                </span>
                {/* Mode */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                  entry.mode === "auto" ? "bg-emerald-500/10 text-emerald-400" :
                  entry.mode === "paper" ? "bg-orange-500/10 text-orange-400" :
                  "bg-blue-500/10 text-blue-400"
                }`}>
                  {entry.mode === "auto" ? "Auto" : entry.mode === "paper" ? "Paper" : "Signal"}
                </span>
                {/* Outcome */}
                {entry.outcome === "open" && <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">Open</Badge>}
                {entry.outcome === "win" && <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">Win</Badge>}
                {entry.outcome === "loss" && <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400">Loss</Badge>}
                {entry.outcome === "breakeven" && <Badge variant="outline" className="text-[9px] border-gray-500/40 text-gray-400">BE</Badge>}
              </div>

              <div className="flex items-center gap-2">
                {/* P&L */}
                {entry.pnl_pct != null && (
                  <span className={`text-xs font-bold ${entry.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {entry.pnl_pct > 0 ? "+" : ""}{entry.pnl_pct}%
                  </span>
                )}
                {/* Date */}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
                {/* Chart */}
                <button
                  onClick={() => setChartEntry(entry)}
                  className="text-muted-foreground/50 hover:text-purple-400 transition-colors p-1"
                  title="View chart"
                >
                  <BarChart2 className="w-3 h-3" />
                </button>
                {/* Delete */}
                <ConfirmButton
                  onConfirm={() => deleteMutation.mutate(entry.id)}
                  title="Delete trade?"
                  description={`Permanently remove ${entry.symbol} ${entry.direction} from the journal. This cannot be undone.`}
                  confirmText="Delete"
                >
                  <button className="text-muted-foreground hover:text-red-400 transition-colors p-1" aria-label="Delete trade">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </ConfirmButton>
              </div>
            </div>

            {/* Trade Details */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 text-[10px] mb-2">
              <div>
                <span className="text-muted-foreground block">Entry</span>
                <span className="font-mono">${formatPrice(entry.entry_price)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Stop Loss</span>
                <span className="font-mono text-red-400">${formatPrice(entry.stop_loss)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">TP1</span>
                <span className="font-mono text-emerald-400">${formatPrice(entry.take_profit1)}</span>
              </div>
              {entry.take_profit2 != null && entry.take_profit2 !== entry.take_profit1 && (
                <div>
                  <span className="text-muted-foreground block">TP2</span>
                  <span className="font-mono text-emerald-400">${formatPrice(entry.take_profit2)}</span>
                </div>
              )}
              {entry.confluence_score != null && (
                <div>
                  <span className="text-muted-foreground block">Score</span>
                  <span className="font-mono">{entry.confluence_score > 0 ? "+" : ""}{entry.confluence_score}</span>
                </div>
              )}
            </div>

            {/* Live P&L for open paper trades */}
            {entry.outcome === "open" && entry.mode === "paper" && priceMap.has(entry.id) && (() => {
              const p = priceMap.get(entry.id)!;
              const isProfit = p.unrealizedPnl >= 0;
              return (
                <div className="mt-2 p-2 rounded-md bg-background/50 border border-border/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3 h-3 text-orange-400" />
                      <span className="text-[10px] text-muted-foreground">Live</span>
                      <span className="text-xs font-mono font-bold">${formatPrice(p.currentPrice)}</span>
                    </div>
                    <span className={`text-xs font-bold ${isProfit ? "text-emerald-400" : "text-red-400"}`}>
                      {isProfit ? "+" : ""}{p.unrealizedPnl}%
                    </span>
                  </div>
                  {/* Progress bar: SL <- Entry -> TP */}
                  <div className="relative h-2 rounded-full bg-border/30 overflow-hidden">
                    {p.progressPct >= 0 ? (
                      <div
                        className="absolute left-1/2 h-full bg-emerald-500/60 rounded-full"
                        style={{ width: `${Math.min(p.progressPct, 100) / 2}%` }}
                      />
                    ) : (
                      <div
                        className="absolute right-1/2 h-full bg-red-500/60 rounded-full"
                        style={{ width: `${Math.min(p.slProgress, 100) / 2}%` }}
                      />
                    )}
                    <div className="absolute left-1/2 top-0 w-0.5 h-full bg-muted-foreground/40" />
                  </div>
                  <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground">
                    <span className="text-red-400">SL</span>
                    <span>Entry</span>
                    <span className="text-emerald-400">TP</span>
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            {entry.outcome === "open" && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                {/* Follow buttons (signal mode only) */}
                {entry.mode === "signal" && entry.followed === "pending" && (
                  <>
                    <button
                      onClick={() => updateMutation.mutate({ id: entry.id, updates: { followed: "yes" } })}
                      className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-colors font-medium"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Segui
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: entry.id, updates: { followed: "no" } })}
                      className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors font-medium"
                    >
                      <XCircle className="w-3 h-3" /> Ignorei
                    </button>
                  </>
                )}
                {entry.followed === "yes" && entry.mode === "signal" && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Followed</span>
                )}
                {entry.followed === "no" && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> Ignored</span>
                )}

                {/* Close trade button */}
                <div className="ml-auto">
                  {closingId === entry.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Exit price"
                        value={closeForm.exit_price}
                        onChange={e => setCloseForm(f => ({ ...f, exit_price: e.target.value }))}
                        className="w-28 px-2 py-1 text-[10px] rounded-md bg-background border border-border/50 text-foreground"
                      />
                      <select
                        value={closeForm.outcome}
                        onChange={e => setCloseForm(f => ({ ...f, outcome: e.target.value }))}
                        className="px-2 py-1 text-[10px] rounded-md bg-background border border-border/50 text-foreground"
                      >
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="breakeven">BE</option>
                      </select>
                      <button
                        onClick={() => handleClose(entry.id)}
                        className="text-[10px] px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setClosingId(null)}
                        className="text-[10px] px-2 py-1 text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setClosingId(entry.id)}
                      className="text-[10px] px-3 py-1.5 rounded-md bg-card border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors font-medium"
                    >
                      Close Trade
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Closed trade info */}
            {entry.outcome !== "open" && entry.exit_price != null && (
              <div className="flex items-center gap-3 pt-2 border-t border-border/20 text-[10px] text-muted-foreground">
                <span>Exit: <span className="font-mono text-foreground">${formatPrice(entry.exit_price)}</span></span>
                {entry.followed === "yes" && entry.mode === "signal" && <span className="text-emerald-400">Followed</span>}
                {entry.followed === "no" && <span className="text-muted-foreground">Ignored</span>}
                {entry.closed_at && (
                  <span>Closed: {new Date(entry.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            )}

            {/* Notes */}
            {entry.notes && (
              <p className="text-[10px] text-muted-foreground mt-1 italic">"{entry.notes}"</p>
            )}
          </Card>
          );
        })}
      </main>

      {/* Trade chart modal */}
      {chartEntry && <TradeChartModal entry={chartEntry} onClose={() => setChartEntry(null)} />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="border-border/40 bg-card/30 px-3 py-2">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">{label}</span>
      <span className={`text-sm font-bold ${color || "text-foreground"}`}>{value}</span>
    </Card>
  );
}
