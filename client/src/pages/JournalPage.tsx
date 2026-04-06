import { useState } from "react";
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
  ToggleLeft, ToggleRight
} from "lucide-react";
import { formatPrice, getSignalColor } from "@/lib/utils";

interface PaperPrice {
  id: number;
  symbol: string;
  strategy: string;
  currentPrice: number;
  unrealizedPnl: number;
  progressPct: number;
  slProgress: number;
}

interface JournalEntry {
  id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit1: number;
  take_profit2: number | null;
  confluence_score: number | null;
  mode: string;
  strategy: string;
  followed: string;
  outcome: string;
  exit_price: number | null;
  pnl_pct: number | null;
  notes: string;
  created_at: string;
  closed_at: string | null;
}

interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  interval: string;
  enabled: boolean;
}

const STRATEGY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "v2-swing": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  "mean-reversion": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30" },
  "breakout": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
};

function getStratColor(id: string) {
  return STRATEGY_COLORS[id] || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30" };
}

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "win" | "loss">("all");
  const [modeFilter, setModeFilter] = useState<"all" | "signal" | "auto" | "paper">("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closeForm, setCloseForm] = useState({ exit_price: "", outcome: "win" as string });

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

  const priceMap = new Map(paperPrices.map((p: PaperPrice) => [p.id, p]));

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal"] }),
  });

  // Delete journal entry
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/journal/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal"] }),
  });

  // Filter entries
  const filtered = (journal as JournalEntry[]).filter(e => {
    if (filter !== "all" && e.outcome !== filter && !(filter === "open" && e.outcome === "open")) return false;
    if (modeFilter !== "all" && e.mode !== modeFilter) return false;
    if (strategyFilter !== "all" && (e.strategy || "v2-swing") !== strategyFilter) return false;
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
        {/* Mode Description */}
        <Card className={`border-border/50 bg-card/50 p-3 ${currentMode === "paper" ? "border-orange-500/30" : ""}`}>
          {currentMode === "signal" && (
            <div className="flex items-start gap-3">
              <Radio className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-400">Signal Mode</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  O bot analisa e da calls. Cada signal aparece no journal como "Pending" — clicas "Segui" ou "Ignorei" para registar.
                </p>
              </div>
            </div>
          )}
          {currentMode === "auto" && (
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-400">Auto Mode</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Execucao automatica de trades na exchange.
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Requer API Key de exchange (Binance/MEXC) — configurar em Settings</span>
                </div>
              </div>
            </div>
          )}
          {currentMode === "paper" && (
            <div className="flex items-start gap-3">
              <FlaskConical className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-orange-400">Paper Trading</p>
                  {paperRunning ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground">
                        {paperStatusData?.coinsScanned || 0} coins
                        {paperStatusData?.lastScan && ` · scan ${new Date(paperStatusData.lastScan).toLocaleTimeString()}`}
                      </span>
                      <button
                        onClick={() => paperStopMutation.mutate()}
                        disabled={paperStopMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 font-medium"
                      >
                        {paperStopMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Square className="w-2.5 h-2.5" />} Stop
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => paperStartMutation.mutate()}
                      disabled={paperStartMutation.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30 font-medium"
                    >
                      {paperStartMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />} Start Paper Trading
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Multi-estrategia — cada estrategia activa corre em paralelo nas top {paperStatusData?.coinsScanned || 30} coins por volume.
                  Check a cada 30s, scan a cada 3 min.
                </p>

                {/* Strategy toggles */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {strategies.map(s => {
                    const c = getStratColor(s.id);
                    const counts = paperStatusData?.strategyCounts?.[s.id];
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleStrategyMutation.mutate({ id: s.id, enabled: !s.enabled })}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all border ${
                          s.enabled
                            ? `${c.bg} ${c.border} ${c.text}`
                            : "bg-card/30 border-border/20 text-muted-foreground opacity-50"
                        }`}
                      >
                        {s.enabled ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                        {s.name}
                        {counts && counts.total > 0 && (
                          <span className="text-[9px] opacity-70">({counts.open}/{counts.total})</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {paperRunning && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-[10px] text-orange-400 font-medium">
                      Engine activo — {paperStatusData?.openTrades || 0} trades abertas
                      {strategies.filter(s => s.enabled).length > 0 && ` · ${strategies.filter(s => s.enabled).length} estrategias`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total Trades" value={`${all.length}`} color="text-blue-400" />
          <StatCard label="Open" value={`${all.filter(e => e.outcome === "open").length}`} color="text-yellow-400" />
          <StatCard label="Win Rate" value={closed.length > 0 ? `${Math.round((wins.length / closed.length) * 100)}%` : "--"} color={wins.length >= losses.length ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Total P&L" value={`${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%`} color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Paper Trades" value={`${paperTrades.length}`} color="text-orange-400" />
          <StatCard label="Paper P&L" value={paperClosed.length > 0 ? `${paperPnl > 0 ? "+" : ""}${paperPnl.toFixed(2)}%` : "--"} color={paperPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>

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
          const sc = getStratColor(entry.strategy || "v2-swing");
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
                  {strategies.find(s => s.id === (entry.strategy || "v2-swing"))?.name || entry.strategy || "v2 Swing"}
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
                {/* Delete */}
                <button
                  onClick={() => deleteMutation.mutate(entry.id)}
                  className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
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
              {entry.take_profit2 && (
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
                  <span>Closed: {new Date(entry.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
