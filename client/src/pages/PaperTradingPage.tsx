import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FlaskConical, Filter, ArrowUpDown, Wallet, TrendingUp, TrendingDown, Settings2 } from "lucide-react";
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

  const capitalMutation = useMutation({
    mutationFn: async ({ capital, riskPct }: { capital?: number; riskPct?: number }) => {
      const res = await apiRequest("POST", "/api/paper/capital", { capital, riskPct });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] });
      setShowCapitalForm(false);
    },
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

      {/* Capital Management Card */}
      {paperStatus?.capital && (
        <Card className="border-border/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold">Capital Management</span>
            </div>
            <button
              onClick={() => { setShowCapitalForm(!showCapitalForm); setCapitalInput(String(paperStatus.capital.initial)); setRiskInput(String(paperStatus.capital.riskPct)); }}
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
              <p className="text-[10px] text-muted-foreground">{paperStatus.capital.riskPct}% of balance</p>
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

          {/* Configure form */}
          {showCapitalForm && (
            <div className="mt-3 pt-3 border-t border-border/20 flex items-end gap-2 flex-wrap">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Capital (€)</label>
                <input
                  type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                  className="w-28 px-2 py-1.5 text-xs rounded-md bg-card border border-border/40 focus:outline-none focus:border-purple-500/60"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Risk per trade (%)</label>
                <input
                  type="number" value={riskInput} onChange={e => setRiskInput(e.target.value)}
                  step="0.5" min="0.5" max="5"
                  className="w-20 px-2 py-1.5 text-xs rounded-md bg-card border border-border/40 focus:outline-none focus:border-purple-500/60"
                  placeholder="2"
                />
              </div>
              <button
                onClick={() => capitalMutation.mutate({ capital: parseFloat(capitalInput), riskPct: parseFloat(riskInput) })}
                disabled={capitalMutation.isPending}
                className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 transition-colors font-medium"
              >
                Save
              </button>
              <button onClick={() => setShowCapitalForm(false)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          )}
        </Card>
      )}

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

      {/* Trade List */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
      ) : displayTrades.length === 0 ? (
        <Card className="border-border/30 border-dashed py-14 text-center">
          <FlaskConical className="w-10 h-10 text-muted-foreground/15 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{tab === "open" ? "No open trades" : "No closed trades"}</p>
          {tab === "open" && !paperRunning && (
            <p className="text-[11px] text-muted-foreground/50 mt-1">Start the engine from the Dashboard to begin scanning</p>
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
