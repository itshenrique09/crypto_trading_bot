import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FlaskConical, Filter, ArrowUpDown, Wallet, TrendingUp, TrendingDown, Settings2, Zap, Eye, EyeOff, Activity, ChevronDown, ChevronUp, Shield, KeyRound, AlertTriangle, CheckCircle2, Circle, Power, Play, Square, Loader2 } from "lucide-react";
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
  const [sortBy, setSortBy] = useState<"date" | "pnl">("date");
  const [showCapitalForm, setShowCapitalForm] = useState(false);
  const [capitalInput, setCapitalInput] = useState("");
  const [riskInput, setRiskInput] = useState("");
  const [paperLeverageInput, setPaperLeverageInput] = useState("5");
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [liveApiKey, setLiveApiKey] = useState("");
  const [liveApiSecret, setLiveApiSecret] = useState("");
  const [liveRiskInput, setLiveRiskInput] = useState("1");
  const [liveLeverageInput, setLiveLeverageInput] = useState("5");
  const [showSecret, setShowSecret] = useState(false);

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

  const priceMap = useMemo(
    () => new Map(paperPrices.map(p => [p.id, p])),
    [paperPrices]
  );

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      await apiRequest("PATCH", `/api/journal/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/prices"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/journal/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/paper/prices"] });
    },
  });

  const capitalMutation = useMutation({
    mutationFn: async ({ capital, riskPct, leverage }: { capital?: number; riskPct?: number; leverage?: number }) => {
      const res = await apiRequest("POST", "/api/paper/capital", { capital, riskPct, leverage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] });
      setShowCapitalForm(false);
    },
  });

  const paperStartMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/paper/start", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }),
  });
  const paperStopMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/paper/stop", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }),
  });

  // ── Engine trailing config (the only remaining tunable) ─────────
  const { data: featureFlags } = useQuery<{
    regime_filter_enabled: boolean;
    short_macro_filter_enabled: boolean;
    btc_regime_gate_enabled: boolean;
    trailing_mode: "fixed_pct" | "r_multiple";
    trailing_r_multiple: number;
  }>({
    queryKey: ["/api/settings/feature-flags"],
    queryFn: async () => (await apiRequest("GET", "/api/settings/feature-flags")).json(),
  });
  const updateFlagsMutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      await apiRequest("PUT", "/api/settings/feature-flags", patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/settings/feature-flags"] }),
  });

  const { data: liveStatus } = useQuery({
    queryKey: ["/api/live/status"],
    queryFn: async () => (await apiRequest("GET", "/api/live/status")).json(),
    refetchInterval: 10000,
  });

  const liveConfigMutation = useMutation({
    mutationFn: async ({ apiKey, apiSecret, riskPct, leverage }: { apiKey: string; apiSecret: string; riskPct?: number; leverage?: number }) => {
      const res = await apiRequest("POST", "/api/live/config", {
        apiKey, apiSecret,
        riskPct:  riskPct  != null ? Number(riskPct)  : undefined,
        leverage: leverage != null ? Number(leverage) : undefined,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });

  const liveTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/live/test", {});
      return res.json();
    },
  });

  const liveStartMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/live/start", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });

  const liveStopMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/live/stop", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });

  const [showScanLog, setShowScanLog] = useState(false);
  const { data: scanLog = [] } = useQuery<any[]>({
    queryKey: ["/api/paper/scan-log"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/scan-log")).json(),
    refetchInterval: paperRunning ? 15000 : false,
    enabled: showScanLog,
  });

  const paperTrades = journal.filter(e => e.mode === "paper");
  const openTrades = paperTrades.filter(e => e.outcome === "open");
  const closedTrades = paperTrades.filter(e => e.outcome !== "open");
  const wins = closedTrades.filter(e => e.outcome === "win");
  const totalPnl = closedTrades.reduce((s, e) => s + (e.pnl_pct || 0), 0);

  let displayTrades = (tab === "open" ? openTrades : closedTrades)
    .filter(e => strategyFilter === "all" || (e.strategy || "confluence-swing") === strategyFilter);

  // Sort
  if (sortBy === "pnl" && tab === "open") {
    displayTrades = [...displayTrades].sort((a, b) => {
      const pA = priceMap.get(a.id)?.unrealizedPnl ?? 0;
      const pB = priceMap.get(b.id)?.unrealizedPnl ?? 0;
      return pB - pA;
    });
  }

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

  const activeStrats = stratStats.filter(s => s.totalTrades > 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px]">
      {/* Page Header + Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Paper Trades</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {paperRunning
              ? <span className="text-emerald-400">Engine running</span>
              : <span className="text-muted-foreground/60">Engine stopped</span>
            }
            {" · "}{paperTrades.length} total · {openTrades.length} open · {closedTrades.length} closed
          </p>
        </div>

        {/* Quick stats pills */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="px-2.5 py-1 rounded-md bg-card/50 border border-border/20">
            WR: <span className={`font-bold ${wins.length >= closedTrades.length - wins.length ? "text-emerald-400" : "text-red-400"}`}>
              {closedTrades.length > 0 ? `${Math.round((wins.length / closedTrades.length) * 100)}%` : "--"}
            </span>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-card/50 border border-border/20">
            P&L: <span className={`font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {closedTrades.length > 0 ? `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%` : "--"}
            </span>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-card/50 border border-border/20">
            Avg: <span className={`font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {closedTrades.length > 0 ? `${(totalPnl / closedTrades.length).toFixed(2)}%` : "--"}
            </span>
          </span>
        </div>
      </div>

      {/* ═══ Paper Engine Control ═══ */}
      <Card className={`border-border/30 overflow-hidden ${paperRunning ? "bg-emerald-500/[0.03] border-emerald-500/30" : ""}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
            paperRunning ? "bg-emerald-500/15 text-emerald-400" : "bg-card/60 text-muted-foreground"
          }`}>
            {paperRunning ? <Activity className="w-4 h-4 animate-pulse" /> : <FlaskConical className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
              Paper Engine
              {paperRunning && <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400" />}
            </p>
            <p className="text-[10px] text-muted-foreground/70 truncate">
              {paperRunning
                ? `Scanning every 3 min · ${paperStatus?.coinsScanned ?? 0} coins last cycle`
                : "Stopped — start to begin scanning for signals"}
            </p>
          </div>
          {paperRunning ? (
            <button
              onClick={() => paperStopMutation.mutate()}
              disabled={paperStopMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-colors font-semibold disabled:opacity-50"
            >
              {paperStopMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />} Stop
            </button>
          ) : (
            <button
              onClick={() => paperStartMutation.mutate()}
              disabled={paperStartMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold disabled:opacity-50"
            >
              {paperStartMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Start
            </button>
          )}
        </div>
      </Card>

      {/* Capital Management Card */}
      {paperStatus?.capital && (
        <Card className="border-border/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold">Capital Management</span>
              <span className="text-[10px] text-muted-foreground/60">paper</span>
            </div>
            <button
              onClick={() => {
                setShowCapitalForm(!showCapitalForm);
                setCapitalInput(String(paperStatus.capital.initial));
                setRiskInput(String(paperStatus.capital.riskPct));
                setPaperLeverageInput(String(paperStatus.capital.leverage ?? 5));
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="w-3 h-3" /> Configure
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Balance</p>
              <p className={`text-sm font-bold font-mono ${paperStatus.capital.balance >= paperStatus.capital.initial ? "text-emerald-400" : "text-red-400"}`}>
                €{paperStatus.capital.balance.toFixed(2)}
              </p>
              <p className={`text-[10px] ${paperStatus.capital.totalPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {paperStatus.capital.totalPnlUsd >= 0 ? "+" : ""}€{paperStatus.capital.totalPnlUsd.toFixed(2)} total
              </p>
            </div>
            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">1R (risk/trade)</p>
              <p className="text-sm font-bold font-mono text-amber-400">€{paperStatus.capital.oneR.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">
                {paperStatus.capital.riskPct}% risk · {paperStatus.capital.leverage ?? 5}× lev
              </p>
            </div>
            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Today P&L</p>
              <p className={`text-sm font-bold font-mono ${paperStatus.capital.todayPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {paperStatus.capital.todayPnlUsd >= 0 ? "+" : ""}€{paperStatus.capital.todayPnlUsd.toFixed(2)}
              </p>
              <p className={`text-[10px] ${paperStatus.capital.todayR >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {paperStatus.capital.todayR >= 0 ? "+" : ""}{paperStatus.capital.todayR.toFixed(1)}R today
              </p>
            </div>
            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Drawdown Limits</p>
              <p className="text-[11px] font-medium text-muted-foreground">Daily: <span className="text-red-400">-4R</span></p>
              <p className="text-[11px] font-medium text-muted-foreground">Monthly: <span className="text-red-400">-8R</span></p>
            </div>
          </div>

          {/* Progress bar: balance vs initial */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-border/30 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${paperStatus.capital.balance >= paperStatus.capital.initial ? "bg-emerald-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, (paperStatus.capital.balance / paperStatus.capital.initial) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              Initial: €{paperStatus.capital.initial}
            </span>
          </div>

          {/* Configure form — symmetric with Live: capital + risk slider + leverage slider */}
          {showCapitalForm && (
            <div className="mt-3 pt-3 border-t border-border/20 space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">Initial capital (€)</label>
                  <input
                    type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                    className="w-32 px-2.5 py-1.5 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-emerald-500/60 font-mono"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Risk per trade */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground">Risk per trade</label>
                    <span className="text-xs font-mono font-bold text-emerald-400">{parseFloat(riskInput || "0").toFixed(2)}%</span>
                  </div>
                  <input
                    type="range" min="0.25" max="3" step="0.25"
                    value={riskInput || "0"}
                    onChange={e => setRiskInput(e.target.value)}
                    className="w-full h-1.5 bg-border/40 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5">
                    <span>0.25%</span><span>1%</span><span>2%</span><span>3%</span>
                  </div>
                </div>

                {/* Leverage */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground">Leverage</label>
                    <span className={`text-xs font-mono font-bold ${
                      parseInt(paperLeverageInput) >= 15 ? "text-red-400" :
                      parseInt(paperLeverageInput) >= 10 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>{paperLeverageInput}×</span>
                  </div>
                  <input
                    type="range" min="1" max="20" step="1"
                    value={paperLeverageInput}
                    onChange={e => setPaperLeverageInput(e.target.value)}
                    className="w-full h-1.5 bg-border/40 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5">
                    <span>1×</span><span>5×</span><span>10×</span><span>20×</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground/70">
                Paper mirrors the live engine's sizing model — tweak here to A/B test risk % or leverage side-by-side with live.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => capitalMutation.mutate({
                    capital: parseFloat(capitalInput),
                    riskPct: parseFloat(riskInput),
                    leverage: parseInt(paperLeverageInput, 10),
                  })}
                  disabled={capitalMutation.isPending}
                  className="px-3.5 py-2 text-xs rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold disabled:opacity-50"
                >
                  {capitalMutation.isPending ? "Saving…" : "Save Settings"}
                </button>
                <button onClick={() => setShowCapitalForm(false)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ═══ MEXC Live Trading ═══ */}
      <Card className="border-border/30 overflow-hidden">
        {/* Header band */}
        <div className={`px-4 py-3 flex items-center justify-between border-b border-border/20 ${
          liveStatus?.running ? "bg-amber-500/[0.04]" : "bg-card/30"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              liveStatus?.running ? "bg-amber-500/15 text-amber-400" :
              liveStatus?.hasKeys ? "bg-card/60 text-muted-foreground" :
              "bg-card/40 text-muted-foreground/40"
            }`}>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold leading-tight">MEXC Live Trading</p>
              <p className="text-[10px] text-muted-foreground/70">
                {liveStatus?.running
                  ? <span className="text-amber-400 inline-flex items-center gap-1"><Circle className="w-1.5 h-1.5 fill-amber-400 text-amber-400" /> Active · real capital</span>
                  : liveStatus?.hasKeys ? "Ready — keys configured, engine stopped"
                  : "Not configured — add API keys to activate"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {liveStatus?.running && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold tracking-wide">LIVE</span>
            )}
            <button
              onClick={() => {
                setShowLiveForm(v => !v);
                if (!showLiveForm && liveStatus) {
                  setLiveRiskInput(String(liveStatus.riskPct ?? 1));
                  setLiveLeverageInput(String(liveStatus.leverage ?? 5));
                }
              }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
              title="Configure keys, risk, leverage"
            >
              <Settings2 className="w-3 h-3" /> Settings
            </button>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <Wallet className="w-3 h-3 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-bold font-mono text-foreground">
                {liveStatus?.balance != null ? `$${liveStatus.balance.toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">Available USDT</p>
            </div>

            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] text-muted-foreground">Positions</p>
                <Activity className="w-3 h-3 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-bold font-mono text-foreground">
                <span className={liveStatus?.openTrades > 0 ? "text-amber-400" : ""}>{liveStatus?.openTrades ?? 0}</span>
                <span className="text-muted-foreground/40"> / 6</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                Risk {liveStatus?.riskPct ?? 1}% · Lev {liveStatus?.leverage ?? 5}×
              </p>
            </div>

            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] text-muted-foreground">Today</p>
                {(liveStatus?.todayPnlUsd ?? 0) >= 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-400/60" />
                  : <TrendingDown className="w-3 h-3 text-red-400/60" />}
              </div>
              <p className={`text-sm font-bold font-mono ${(liveStatus?.todayPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {liveStatus?.todayPnlUsd != null
                  ? `${liveStatus.todayPnlUsd >= 0 ? "+" : ""}$${liveStatus.todayPnlUsd.toFixed(2)}`
                  : <span className="text-muted-foreground/40">—</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">Since 00:00</p>
            </div>

            <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] text-muted-foreground">Total P&amp;L</p>
                {(liveStatus?.totalPnlUsd ?? 0) >= 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-400/60" />
                  : <TrendingDown className="w-3 h-3 text-red-400/60" />}
              </div>
              <p className={`text-sm font-bold font-mono ${(liveStatus?.totalPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {liveStatus?.totalPnlUsd != null
                  ? `${liveStatus.totalPnlUsd >= 0 ? "+" : ""}$${liveStatus.totalPnlUsd.toFixed(2)}`
                  : <span className="text-muted-foreground/40">—</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">{liveStatus?.totalLiveTrades ?? 0} closed trades</p>
            </div>
          </div>

          {/* Error banner */}
          {liveStatus?.error && (
            <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5 mb-3 font-mono">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="break-all">{liveStatus.error}</span>
            </div>
          )}

          {/* Primary actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {liveStatus?.running ? (
              <button
                onClick={() => liveStopMutation.mutate()}
                disabled={liveStopMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-colors font-semibold disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" /> Stop Engine
              </button>
            ) : (
              <button
                onClick={() => liveStartMutation.mutate()}
                disabled={!liveStatus?.hasKeys || liveStartMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                title={!liveStatus?.hasKeys ? "Configure API keys first" : "Start live trading"}
              >
                <Power className="w-3.5 h-3.5" /> Start Engine
              </button>
            )}
            {liveStatus?.hasKeys && (
              <button
                onClick={() => liveTestMutation.mutate()}
                disabled={liveTestMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-md bg-card/50 border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50 transition-colors"
              >
                <Activity className="w-3.5 h-3.5" />
                {liveTestMutation.isPending ? "Testing…" : "Test Connection"}
              </button>
            )}
            {liveTestMutation.data && (
              <span className={`text-[11px] inline-flex items-center gap-1 ${liveTestMutation.data.ok ? "text-emerald-400" : "text-red-400"}`}>
                {liveTestMutation.data.ok
                  ? <><CheckCircle2 className="w-3 h-3" /> Connected · ${liveTestMutation.data.balance?.toFixed(2)} available</>
                  : <><AlertTriangle className="w-3 h-3" /> {liveTestMutation.data.error}</>}
              </span>
            )}
          </div>
        </div>

        {/* Settings panel (collapsible) */}
        {showLiveForm && (
          <div className="border-t border-border/20 bg-card/20 px-4 py-4 space-y-4">
            {/* Credentials */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <KeyRound className="w-3 h-3 text-muted-foreground" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Credentials</h4>
                {liveStatus?.hasKeys && (
                  <span className="text-[10px] text-emerald-400/80 inline-flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> saved
                  </span>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">API Key</label>
                  <input
                    type="text" value={liveApiKey} onChange={e => setLiveApiKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-amber-500/60 font-mono"
                    placeholder={liveStatus?.hasKeys ? "Stored — leave empty to keep" : "mx0v…"}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">API Secret</label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"} value={liveApiSecret} onChange={e => setLiveApiSecret(e.target.value)}
                      className="w-full px-2.5 py-1.5 pr-8 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-amber-500/60 font-mono"
                      placeholder={liveStatus?.hasKeys ? "Stored — leave empty to keep" : "••••••••••••••••"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-amber-400/70 mt-1.5 inline-flex items-center gap-1">
                <Shield className="w-3 h-3" /> Stored encrypted. Use <b>read + trade</b> permissions only — never withdrawal.
              </p>
            </section>

            {/* Risk & Leverage */}
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3 h-3 text-muted-foreground" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk Management</h4>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Risk per trade */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground">Risk per trade</label>
                    <span className="text-xs font-mono font-bold text-amber-400">{parseFloat(liveRiskInput || "0").toFixed(2)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.25" max="3" step="0.25"
                    value={liveRiskInput}
                    onChange={e => setLiveRiskInput(e.target.value)}
                    className="w-full h-1.5 bg-border/40 rounded-full appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5">
                    <span>0.25%</span><span>1%</span><span>2%</span><span>3%</span>
                  </div>
                </div>

                {/* Leverage */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-muted-foreground">Leverage</label>
                    <span className={`text-xs font-mono font-bold ${
                      parseInt(liveLeverageInput) >= 15 ? "text-red-400" :
                      parseInt(liveLeverageInput) >= 10 ? "text-amber-400" :
                      "text-emerald-400"
                    }`}>{liveLeverageInput}×</span>
                  </div>
                  <input
                    type="range"
                    min="1" max="20" step="1"
                    value={liveLeverageInput}
                    onChange={e => setLiveLeverageInput(e.target.value)}
                    className="w-full h-1.5 bg-border/40 rounded-full appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5">
                    <span>1×</span><span>5×</span><span>10×</span><span>20×</span>
                  </div>
                </div>
              </div>

              {/* Leverage warning */}
              {parseInt(liveLeverageInput) >= 10 && (
                <p className="text-[10px] text-amber-400/80 mt-2 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  At {liveLeverageInput}× leverage, a {(100 / parseInt(liveLeverageInput)).toFixed(1)}% adverse move = full liquidation of that position's margin.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                Position sizing is always risk-based (SL distance → R). Leverage only changes margin utilization on MEXC.
              </p>
            </section>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/20">
              <button
                onClick={() => liveConfigMutation.mutate({
                  apiKey: liveApiKey || "__keep__",
                  apiSecret: liveApiSecret || "__keep__",
                  riskPct: parseFloat(liveRiskInput),
                  leverage: parseInt(liveLeverageInput),
                })}
                disabled={liveConfigMutation.isPending || (!liveStatus?.hasKeys && (!liveApiKey || !liveApiSecret))}
                className="px-3.5 py-2 text-xs rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {liveConfigMutation.isPending ? "Saving…" : "Save Settings"}
              </button>
              <button
                onClick={() => { setShowLiveForm(false); setLiveApiKey(""); setLiveApiSecret(""); }}
                className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              {liveConfigMutation.data && (
                <span className={`text-[11px] inline-flex items-center gap-1 ${liveConfigMutation.data.ok ? "text-emerald-400" : "text-red-400"}`}>
                  {liveConfigMutation.data.ok
                    ? <><CheckCircle2 className="w-3 h-3" /> Saved · MEXC balance ${liveConfigMutation.data.balance?.toFixed(2)}</>
                    : <><AlertTriangle className="w-3 h-3" /> {liveConfigMutation.data.error}</>}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ═══ Engine Intelligence — read-only, self-governing ═══ */}
      {(() => {
        const intel = paperStatus?.intelligence as {
          btcRegime: string; btcRegimeReason: string; maxOpen: number;
          direction: { long: boolean; short: boolean; sizeMultiplier: number; reason: string };
          pausedStrategies: string[]; updatedAt: string;
        } | null | undefined;
        const regimeColor: Record<string, string> = {
          risk_on:         "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
          neutral_bullish: "text-emerald-300/80 border-emerald-500/30 bg-emerald-500/5",
          neutral_bearish: "text-red-300/80 border-red-500/30 bg-red-500/5",
          volatile_drift:  "text-amber-300 border-amber-500/40 bg-amber-500/10",
          risk_off:        "text-red-300 border-red-500/40 bg-red-500/10",
        };
        return (
          <Card className="border-border/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-bold">Engine Intelligence</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">always on · self-governing</span>
            </div>

            {!intel ? (
              <div className="px-4 py-4 text-[11px] text-muted-foreground/60">
                Awaiting first scan — the engine publishes its regime read each cycle (every 3 min).
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Market regime + directional bias */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-md border border-border/30 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">BTC Regime</p>
                    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${regimeColor[intel.btcRegime] ?? "text-muted-foreground border-border/40"}`}>
                      {intel.btcRegime}
                    </span>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-snug">{intel.btcRegimeReason}</p>
                  </div>
                  <div className="rounded-md border border-border/30 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">Directional Bias</p>
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1 text-[11px] font-bold ${intel.direction.long ? "text-emerald-300" : "text-muted-foreground/40 line-through"}`}>
                        <TrendingUp className="w-3.5 h-3.5" /> LONG
                      </span>
                      <span className={`flex items-center gap-1 text-[11px] font-bold ${intel.direction.short ? "text-red-300" : "text-muted-foreground/40 line-through"}`}>
                        <TrendingDown className="w-3.5 h-3.5" /> SHORT
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-snug">
                      {intel.direction.reason}{intel.direction.sizeMultiplier !== 1 ? ` · size ×${intel.direction.sizeMultiplier}` : ""}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/30 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">Max Concurrent</p>
                    <p className="text-lg font-bold font-mono text-foreground">{intel.maxOpen}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-snug">positions cap (scales with BTC regime)</p>
                  </div>
                </div>

                {/* Per-strategy status */}
                <div className="rounded-md border border-border/30 overflow-hidden">
                  <p className="px-3 py-2 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold border-b border-border/20">Strategies — auto-selected by regime</p>
                  <div className="divide-y divide-border/10">
                    {strategies.map(s => {
                      const c = getStratColor(s.id);
                      const counts = paperStatus?.strategyCounts?.[s.id];
                      const paused = intel.pausedStrategies.includes(s.id);
                      return (
                        <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-bold truncate ${c.text}`}>{s.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-card/60 text-muted-foreground/70 font-mono">{s.interval}</span>
                            {counts && counts.total > 0 && (
                              <span className="text-[9px] text-muted-foreground/50">{counts.open} open · {counts.total} total</span>
                            )}
                          </div>
                          {paused ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300 shrink-0" title="Auto-paused: 7d netR < −3R. Re-activates as losses age out or new wins rebalance.">
                              <AlertTriangle className="w-3 h-3" /> auto-paused
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300 shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> active
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Always-on guardrails */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "BTC soft overlay", on: true },
                    { label: "BTC regime cap", on: true },
                    { label: "Cost-aware SL floor", on: true },
                    { label: "Per-strategy DD kill-switch", on: true },
                  ].map(g => (
                    <div key={g.label} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="text-[10px] text-muted-foreground/80 truncate">{g.label}</span>
                    </div>
                  ))}
                </div>

                {/* Trailing mode — the one remaining tunable */}
                {featureFlags && (
                  <div className="rounded-md border border-border/30 p-3 space-y-2">
                    <p className="text-xs font-bold">Post-TP1 Trailing</p>
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      After TP1 closes 60%, the runner trails. Default <span className="font-mono">fixed_pct</span> (2% from peak) — backtest-best for these strategies. <span className="font-mono">r_multiple</span> (N × original-risk) was tested and gave back profit on Swing; opt in only if re-validated.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        onClick={() => updateFlagsMutation.mutate({ trailing_mode: "r_multiple" })}
                        disabled={updateFlagsMutation.isPending}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                          featureFlags.trailing_mode === "r_multiple"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : "bg-card/40 border-border/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >r_multiple</button>
                      <button
                        onClick={() => updateFlagsMutation.mutate({ trailing_mode: "fixed_pct" })}
                        disabled={updateFlagsMutation.isPending}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                          featureFlags.trailing_mode === "fixed_pct"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : "bg-card/40 border-border/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >fixed_pct (2%)</button>
                      {featureFlags.trailing_mode === "r_multiple" && (
                        <div className="flex items-center gap-2 ml-2">
                          <label className="text-[10px] text-muted-foreground/70">multiplier</label>
                          <input
                            type="number" min="0.5" max="5" step="0.25"
                            defaultValue={featureFlags.trailing_r_multiple}
                            onBlur={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0.5 && v <= 5 && v !== featureFlags.trailing_r_multiple) {
                                updateFlagsMutation.mutate({ trailing_r_multiple: v });
                              }
                            }}
                            className="w-16 px-2 py-1 text-xs rounded bg-background border border-border/40 focus:outline-none focus:border-emerald-500/60 font-mono"
                          />
                          <span className="text-[10px] text-muted-foreground/70">× R</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Strategy Mini Stats — only if there's data */}
      {activeStrats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {activeStrats.map(s => {
            const sc = getStratColor(s.strategyId);
            return (
              <Card key={s.strategyId} className={`px-3 py-2.5 border ${sc.border} ${sc.bg} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${sc.text}`}>{s.strategyName}</span>
                  <span className="text-[10px] text-muted-foreground/60">{s.totalTrades} trades</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className={s.winRate != null && s.winRate >= 50 ? "text-emerald-400" : "text-red-400"}>
                    {s.winRate ?? "--"}%
                  </span>
                  <span className={`font-bold font-mono ${s.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {s.totalPnl > 0 ? "+" : ""}{s.totalPnl.toFixed(2)}%
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Toolbar: Tabs + Filters + Sort */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex items-center bg-card/40 border border-border/30 rounded-lg p-0.5">
            <button
              onClick={() => setTab("open")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === "open" ? "bg-purple-500/20 text-purple-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Open ({openTrades.length})
            </button>
            <button
              onClick={() => setTab("closed")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === "closed" ? "bg-purple-500/20 text-purple-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              History ({closedTrades.length})
            </button>
          </div>

          {/* Strategy filter */}
          {strategies.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground/50" />
              <select
                value={strategyFilter}
                onChange={e => setStrategyFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md bg-card/40 border border-border/30 text-foreground cursor-pointer"
              >
                <option value="all">All Strategies</option>
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Sort */}
        {tab === "open" && openTrades.length > 1 && (
          <button
            onClick={() => setSortBy(s => s === "date" ? "pnl" : "date")}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            Sort: {sortBy === "date" ? "Date" : "P&L"}
          </button>
        )}
      </div>

      {/* Scan Activity Log */}
      <Card className="border-border/30">
        <button
          onClick={() => setShowScanLog(s => !s)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground/50" />
            <span className="text-xs font-bold">Scan Activity</span>
            {scanLog.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-muted-foreground">
                {scanLog.length} events
              </span>
            )}
          </div>
          {showScanLog ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
        </button>
        {showScanLog && (
          <div className="border-t border-border/20 px-4 pb-3">
            {scanLog.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 py-3 text-center">
                {paperRunning ? "No activity yet — runs every 3 minutes" : "Start engine to see activity"}
              </p>
            ) : (
              <div className="space-y-1 mt-2 max-h-64 overflow-y-auto">
                {scanLog.map((ev: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] py-1 border-b border-border/10 last:border-0">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      ev.result === "opened" ? "bg-emerald-500/20 text-emerald-400" :
                      ev.result === "filtered" ? "bg-amber-500/20 text-amber-400" :
                      "bg-card/40 text-muted-foreground/40"
                    }`}>
                      {ev.result === "opened" ? "OPENED" : ev.result === "filtered" ? "FILTER" : "HOLD"}
                    </span>
                    <span className="font-bold text-foreground shrink-0 w-10">{ev.symbol}</span>
                    <span className="text-muted-foreground/60 shrink-0 w-20 truncate">{ev.strategy}</span>
                    <span className="text-muted-foreground/70 flex-1 leading-relaxed">{ev.reason}</span>
                    <span className="text-muted-foreground/30 shrink-0 whitespace-nowrap">
                      {new Date(ev.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Trade List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : displayTrades.length === 0 ? (
        <Card className="border-border/30 border-dashed py-14 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground/15 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{tab === "open" ? "No open trades" : "No closed trades"}</p>
          {tab === "open" && !paperRunning && (
            <p className="text-[11px] text-muted-foreground/50 mt-1">Start the paper engine above to begin scanning</p>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {displayTrades.map(entry => (
            <Card key={entry.id} className="border-border/20 hover:border-border/40 transition-colors">
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
