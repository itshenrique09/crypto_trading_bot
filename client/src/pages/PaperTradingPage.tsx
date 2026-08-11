import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FlaskConical, Filter, ArrowUpDown, Wallet, TrendingUp, TrendingDown, Settings2, Zap,
  Eye, EyeOff, Activity, ChevronDown, ChevronUp, Shield, KeyRound, AlertTriangle,
  CheckCircle2, Circle, Power, Play, Square, Loader2, ListChecks, History, Cpu, SlidersHorizontal,
} from "lucide-react";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor, getStratName } from "@/lib/types";
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

type Section = "positions" | "history" | "engine" | "config";
type TradeMode = "paper" | "live" | "all";

export default function PaperTradingPage() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("positions");
  const [tradeMode, setTradeMode] = useState<TradeMode>("all");
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
  const [liveExchange, setLiveExchange] = useState<string>("kraken");
  const [showSecret, setShowSecret] = useState(false);
  const [showScanLog, setShowScanLog] = useState(false);

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

  const priceMap = useMemo(() => new Map(paperPrices.map(p => [p.id, p])), [paperPrices]);

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
    mutationFn: async ({ apiKey, apiSecret, riskPct, leverage, exchange }: { apiKey: string; apiSecret: string; riskPct?: number; leverage?: number; exchange?: string }) => {
      const res = await apiRequest("POST", "/api/live/config", {
        apiKey, apiSecret, exchange,
        riskPct: riskPct != null ? Number(riskPct) : undefined,
        leverage: leverage != null ? Number(leverage) : undefined,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });

  const liveTestMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/live/test", {})).json(),
  });

  const liveStartMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/live/start", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });

  const liveStopMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/live/stop", {})).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });

  const { data: scanLog = [] } = useQuery<any[]>({
    queryKey: ["/api/paper/scan-log"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/scan-log")).json(),
    refetchInterval: paperRunning ? 15000 : false,
    enabled: section === "engine" && showScanLog,
  });

  // ── Derived ─────────────────────────────────────────────────────
  // Paper and live are shown side by side deliberately: running both at once
  // is the whole point of the live rollout — any divergence between them is
  // execution (slippage, funding, rejections), not strategy.
  const modeTrades = journal.filter(e =>
    tradeMode === "all" ? (e.mode === "paper" || e.mode === "live") : e.mode === tradeMode);
  const liveTradesAll = journal.filter(e => e.mode === "live");
  const paperTrades = journal.filter(e => e.mode === "paper");
  const openTrades = modeTrades.filter(e => e.outcome === "open");
  const closedTrades = modeTrades.filter(e => e.outcome !== "open");
  const wins = closedTrades.filter(e => e.outcome === "win");

  // Honest, size-normalized R metrics (pnl/risk) — not summed percentages.
  const rClosed = closedTrades
    .filter(t => t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null)
    .map(t => t.pnl_usd! / t.risk_usd!);
  const sumR = rClosed.reduce((s, r) => s + r, 0);
  const grossWinR = rClosed.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const grossLossR = -rClosed.filter(r => r < 0).reduce((s, r) => s + r, 0);
  const profitFactor = grossLossR > 0 ? grossWinR / grossLossR : (grossWinR > 0 ? Infinity : 0);
  const winRate = closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0;

  const cap = paperStatus?.capital;
  const realReturnPct = cap && cap.initial > 0 ? ((cap.balance - cap.initial) / cap.initial) * 100 : null;

  let displayTrades = (section === "history" ? closedTrades : openTrades)
    .filter(e => strategyFilter === "all" || e.strategy === strategyFilter);

  if (sortBy === "pnl" && section === "positions") {
    displayTrades = [...displayTrades].sort((a, b) => {
      const pA = priceMap.get(a.id)?.unrealizedPnl ?? 0;
      const pB = priceMap.get(b.id)?.unrealizedPnl ?? 0;
      return pB - pA;
    });
  }

  const handleClose = (id: number) => {
    const entry = journal.find(e => e.id === id);
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

  const SECTIONS: { id: Section; label: string; icon: typeof ListChecks; count?: number }[] = [
    { id: "positions", label: "Positions", icon: ListChecks, count: openTrades.length },
    { id: "history", label: "History", icon: History, count: closedTrades.length },
    { id: "engine", label: "Engine", icon: Cpu },
    { id: "config", label: "Config", icon: SlidersHorizontal },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px]">
      {/* ═══ Header: title + engine toggle + live pill ═══ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
            paperRunning ? "bg-emerald-500/15 text-emerald-400" : "bg-card/60 text-muted-foreground"
          }`}>
            {paperRunning ? <Activity className="w-4 h-4 animate-pulse" /> : <FlaskConical className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">Trading</h1>
            <p className="text-[11px] text-muted-foreground mt-1">
              {paperRunning
                ? <span className="text-emerald-400">Paper scanning · {paperStatus?.coinsScanned ?? 0} coins</span>
                : <span className="text-muted-foreground/60">Paper stopped</span>}
              {liveStatus?.running && <span className="text-amber-400"> · Live on {liveStatus?.exchange?.toUpperCase()}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* ═══ Capital / performance strip — always visible ═══ */}
      {cap && (
        <Card className="border-border/20 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <StripStat label="Paper balance" value={`€${cap.balance.toFixed(2)}`}
              color={cap.balance >= cap.initial ? "text-emerald-400" : "text-red-400"}
              sub={realReturnPct != null ? `${realReturnPct >= 0 ? "+" : ""}${realReturnPct.toFixed(1)}% · 1R €${cap.oneR.toFixed(2)}` : `€${cap.initial} initial`} />
            <StripStat label="Live balance"
              value={liveStatus?.balance != null ? `$${liveStatus.balance.toFixed(2)}` : "—"}
              color={liveStatus?.running ? "text-amber-300" : "text-muted-foreground"}
              sub={liveStatus?.hasKeys
                ? `${liveStatus?.exchange?.toUpperCase() ?? ""} · risk ${liveStatus?.riskPct ?? 1}%`
                : "not configured"} />
            <StripStat label={`Net R · ${tradeMode}`} value={rClosed.length > 0 ? `${sumR >= 0 ? "+" : ""}${sumR.toFixed(1)}R` : "--"}
              color={sumR >= 0 ? "text-emerald-400" : "text-red-400"}
              sub={rClosed.length > 0 ? `PF ${profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)}` : "no data"} />
            <StripStat label="Win Rate" value={closedTrades.length > 0 ? `${Math.round(winRate)}%` : "--"}
              color={winRate >= 45 ? "text-emerald-400" : "text-amber-400"}
              sub={`${wins.length}W / ${closedTrades.length - wins.length}L`} />
            <StripStat label="Open now" value={`${openTrades.length}`}
              color={openTrades.length > 0 ? "text-yellow-400" : "text-muted-foreground"}
              sub={`${paperTrades.filter(t => t.outcome === "open").length} paper · ${liveTradesAll.filter(t => t.outcome === "open").length} live`} />
            <StripStat label="Today (paper)" value={`${cap.todayR >= 0 ? "+" : ""}${cap.todayR.toFixed(1)}R`}
              color={cap.todayR >= 0 ? "text-emerald-400" : "text-red-400"}
              sub={`${cap.todayPnlUsd >= 0 ? "+" : ""}€${cap.todayPnlUsd.toFixed(2)}`} />
          </div>
          {liveStatus?.unmanagedPositions > 0 && (
            <div className="mt-2.5 flex items-start gap-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <b>{liveStatus.unmanagedPositions} unmanaged position(s)</b> open on {liveStatus?.exchange?.toUpperCase()} with no matching journal entry —
                the bot is not managing their stop or trailing. New live entries are paused until reconciled.
              </span>
            </div>
          )}
        </Card>
      )}

      {/* ═══ Section tabs ═══ */}
      <div className="flex items-center gap-1 bg-card/40 border border-border/30 rounded-lg p-0.5 w-fit">
        {SECTIONS.map(s => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                active ? "bg-purple-500/20 text-purple-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
              {s.count != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-purple-500/20" : "bg-card/60"}`}>{s.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ POSITIONS / HISTORY ═══ */}
      {(section === "positions" || section === "history") && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Paper / Live / All — the comparison that validates execution */}
              <div className="flex items-center bg-card/40 border border-border/30 rounded-lg p-0.5">
                {([
                  { id: "all" as const, label: "All" },
                  { id: "paper" as const, label: "Paper" },
                  { id: "live" as const, label: "Live" },
                ]).map(m => {
                  const active = tradeMode === m.id;
                  const n = m.id === "all"
                    ? journal.filter(e => e.mode === "paper" || e.mode === "live").length
                    : journal.filter(e => e.mode === m.id).length;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setTradeMode(m.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        active
                          ? m.id === "live" ? "bg-amber-500/20 text-amber-300" : "bg-purple-500/20 text-purple-400"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m.label} <span className="opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            {strategies.length > 1 ? (
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/50" />
                <select
                  value={strategyFilter}
                  onChange={e => setStrategyFilter(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-md bg-card/40 border border-border/30 text-foreground cursor-pointer"
                >
                  <option value="all">All strategies</option>
                  {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ) : null}
            </div>

            {section === "positions" && openTrades.length > 1 && (
              <button
                onClick={() => setSortBy(s => s === "date" ? "pnl" : "date")}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
                Sort: {sortBy === "date" ? "Date" : "P&L"}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : displayTrades.length === 0 ? (
            <Card className="border-border/30 border-dashed py-14 text-center">
              <FlaskConical className="w-10 h-10 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{section === "positions" ? "No open positions" : "No closed trades"}</p>
              {section === "positions" && !paperRunning && (
                <p className="text-[11px] text-muted-foreground/50 mt-1">Start the engine above to begin scanning</p>
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
      )}

      {/* ═══ ENGINE — read-only intelligence + scan activity ═══ */}
      {section === "engine" && (
        <EngineSection
          intel={paperStatus?.intelligence}
          strategies={strategies}
          strategyCounts={paperStatus?.strategyCounts}
          featureFlags={featureFlags}
          updateFlags={(p) => updateFlagsMutation.mutate(p)}
          flagsPending={updateFlagsMutation.isPending}
          scanLog={scanLog}
          showScanLog={showScanLog}
          onToggleScanLog={() => setShowScanLog(s => !s)}
          paperRunning={paperRunning}
        />
      )}

      {/* ═══ CONFIG — capital + live keys ═══ */}
      {section === "config" && (
        <div className="space-y-5">
          {/* Capital Management */}
          {cap && (
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
                    setCapitalInput(String(cap.initial));
                    setRiskInput(String(cap.riskPct));
                    setPaperLeverageInput(String(cap.leverage ?? 5));
                  }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings2 className="w-3 h-3" /> Configure
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <MiniStat label="Balance"
                  value={`€${cap.balance.toFixed(2)}`}
                  valueColor={cap.balance >= cap.initial ? "text-emerald-400" : "text-red-400"}
                  sub={`${cap.totalPnlUsd >= 0 ? "+" : ""}€${cap.totalPnlUsd.toFixed(2)} total`}
                  subColor={cap.totalPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"} />
                <MiniStat label="1R (risk/trade)"
                  value={`€${cap.oneR.toFixed(2)}`} valueColor="text-amber-400"
                  sub={`${cap.riskPct}% risk · ${cap.leverage ?? 5}× lev`} />
                <MiniStat label="Today P&L"
                  value={`${cap.todayPnlUsd >= 0 ? "+" : ""}€${cap.todayPnlUsd.toFixed(2)}`}
                  valueColor={cap.todayPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}
                  sub={`${cap.todayR >= 0 ? "+" : ""}${cap.todayR.toFixed(1)}R today`}
                  subColor={cap.todayR >= 0 ? "text-emerald-400" : "text-red-400"} />
                <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Drawdown halts</p>
                  <p className="text-[11px] font-medium text-muted-foreground">Daily: <span className="text-red-400">−4R</span></p>
                  <p className="text-[11px] font-medium text-muted-foreground">Rolling 7d: <span className="text-red-400">−6R</span></p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-border/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cap.balance >= cap.initial ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(100, (cap.balance / cap.initial) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">Initial: €{cap.initial}</span>
              </div>

              {showCapitalForm && (
                <div className="mt-3 pt-3 border-t border-border/20 space-y-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">Initial capital (€)</label>
                    <input
                      type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                      className="w-32 px-2.5 py-1.5 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-emerald-500/60 font-mono"
                      placeholder="1000"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <RangeField label="Risk per trade" value={riskInput || "0"} onChange={setRiskInput}
                      min="0.25" max="3" step="0.25" accent="emerald"
                      display={`${parseFloat(riskInput || "0").toFixed(2)}%`} marks={["0.25%", "1%", "2%", "3%"]} />
                    <RangeField label="Leverage" value={paperLeverageInput} onChange={setPaperLeverageInput}
                      min="1" max="20" step="1" accent="emerald"
                      display={`${paperLeverageInput}×`}
                      displayColor={parseInt(paperLeverageInput) >= 15 ? "text-red-400" : parseInt(paperLeverageInput) >= 10 ? "text-amber-400" : "text-emerald-400"}
                      marks={["1×", "5×", "10×", "20×"]} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">
                    Paper mirrors the live engine's sizing model — tweak here to A/B risk % or leverage against live.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => capitalMutation.mutate({ capital: parseFloat(capitalInput), riskPct: parseFloat(riskInput), leverage: parseInt(paperLeverageInput, 10) })}
                      disabled={capitalMutation.isPending}
                      className="px-3.5 py-2 text-xs rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold disabled:opacity-50"
                    >
                      {capitalMutation.isPending ? "Saving…" : "Save Settings"}
                    </button>
                    <button onClick={() => setShowCapitalForm(false)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* MEXC Live */}
          <Card className="border-border/30 overflow-hidden">
            <div className={`px-4 py-3 flex items-center justify-between border-b border-border/20 ${liveStatus?.running ? "bg-amber-500/[0.04]" : "bg-card/30"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
                  liveStatus?.running ? "bg-amber-500/15 text-amber-400" :
                  liveStatus?.hasKeys ? "bg-card/60 text-muted-foreground" : "bg-card/40 text-muted-foreground/40"
                }`}>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">
                    {(liveStatus?.exchanges ?? []).find((e: any) => e.id === liveStatus?.exchange)?.name ?? "Live Trading"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {liveStatus?.running
                      ? <span className="text-amber-400 inline-flex items-center gap-1"><Circle className="w-1.5 h-1.5 fill-amber-400 text-amber-400" /> Active · real capital</span>
                      : liveStatus?.hasKeys ? "Ready — keys configured, engine stopped" : "Not configured — add API keys to activate"}
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
                      setLiveExchange(String(liveStatus.exchange ?? "kraken"));
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                >
                  <Settings2 className="w-3 h-3" /> Settings
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                <MiniStat label="Balance"
                  value={liveStatus?.balance != null ? `$${liveStatus.balance.toFixed(2)}` : "—"}
                  sub="Available USDT" />
                <MiniStat label="Positions"
                  value={<><span className={liveStatus?.openTrades > 0 ? "text-amber-400" : ""}>{liveStatus?.openTrades ?? 0}</span><span className="text-muted-foreground/40"> / 10</span></>}
                  sub={`Risk ${liveStatus?.riskPct ?? 1}% · Lev ${liveStatus?.leverage ?? 5}×`} />
                <MiniStat label="Today"
                  value={liveStatus?.todayPnlUsd != null ? `${liveStatus.todayPnlUsd >= 0 ? "+" : ""}$${liveStatus.todayPnlUsd.toFixed(2)}` : "—"}
                  valueColor={(liveStatus?.todayPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
                  sub="Since 00:00" />
                <MiniStat label="Total P&L"
                  value={liveStatus?.totalPnlUsd != null ? `${liveStatus.totalPnlUsd >= 0 ? "+" : ""}$${liveStatus.totalPnlUsd.toFixed(2)}` : "—"}
                  valueColor={(liveStatus?.totalPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
                  sub={`${liveStatus?.closedLiveTrades ?? 0} closed · ${liveStatus?.openTrades ?? 0} open`} />
              </div>

              {liveStatus?.error && (
                <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5 mb-3 font-mono">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="break-all">{liveStatus.error}</span>
                </div>
              )}

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

            {showLiveForm && (
              <div className="border-t border-border/20 bg-card/20 px-4 py-4 space-y-4">
                {/* Venue selector — credentials are stored per exchange */}
                <section>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="w-3 h-3 text-muted-foreground" />
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Exchange</h4>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {(liveStatus?.exchanges ?? []).map((ex: any) => {
                      const active = liveExchange === ex.id;
                      const ready = liveStatus?.configured?.[ex.id];
                      return (
                        <button
                          key={ex.id}
                          onClick={() => setLiveExchange(ex.id)}
                          disabled={liveStatus?.running}
                          className={`text-left p-2.5 rounded-md border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            active ? "bg-amber-500/10 border-amber-500/40" : "bg-card/40 border-border/30 hover:border-border/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold ${active ? "text-amber-300" : "text-foreground"}`}>{ex.name}</span>
                            {ready && <span className="text-[9px] text-emerald-400/80 inline-flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> keys</span>}
                          </div>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-snug">{ex.note}</p>
                        </button>
                      );
                    })}
                  </div>
                  {liveStatus?.running && (
                    <p className="text-[10px] text-amber-400/70 mt-1.5">Stop the engine to switch exchange.</p>
                  )}
                </section>

                <section>
                  <div className="flex items-center gap-1.5 mb-2">
                    <KeyRound className="w-3 h-3 text-muted-foreground" />
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Credentials</h4>
                    {liveStatus?.hasKeys && (
                      <span className="text-[10px] text-emerald-400/80 inline-flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> saved</span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">API Key</label>
                      <input
                        type="text" value={liveApiKey} onChange={e => setLiveApiKey(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-amber-500/60 font-mono"
                        placeholder={liveStatus?.configured?.[liveExchange] ? "Stored — leave empty to keep" : "API key"}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">API Secret</label>
                      <div className="relative">
                        <input
                          type={showSecret ? "text" : "password"} value={liveApiSecret} onChange={e => setLiveApiSecret(e.target.value)}
                          className="w-full px-2.5 py-1.5 pr-8 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-amber-500/60 font-mono"
                          placeholder={liveStatus?.configured?.[liveExchange] ? "Stored — leave empty to keep" : "••••••••••••••••"}
                        />
                        <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-400/70 mt-1.5 inline-flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Stored encrypted. Use <b>read + trade</b> permissions only — never withdrawal.
                  </p>
                </section>

                <section>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield className="w-3 h-3 text-muted-foreground" />
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk Management</h4>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <RangeField label="Risk per trade" value={liveRiskInput} onChange={setLiveRiskInput}
                      min="0.25" max="3" step="0.25" accent="amber"
                      display={`${parseFloat(liveRiskInput || "0").toFixed(2)}%`} marks={["0.25%", "1%", "2%", "3%"]} />
                    <RangeField label="Leverage" value={liveLeverageInput} onChange={setLiveLeverageInput}
                      min="1" max="20" step="1" accent="amber"
                      display={`${liveLeverageInput}×`}
                      displayColor={parseInt(liveLeverageInput) >= 15 ? "text-red-400" : parseInt(liveLeverageInput) >= 10 ? "text-amber-400" : "text-emerald-400"}
                      marks={["1×", "5×", "10×", "20×"]} />
                  </div>
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

                <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                  <button
                    onClick={() => liveConfigMutation.mutate({
                      apiKey: liveApiKey || "__keep__",
                      apiSecret: liveApiSecret || "__keep__",
                      riskPct: parseFloat(liveRiskInput),
                      leverage: parseInt(liveLeverageInput),
                      exchange: liveExchange,
                    })}
                    disabled={liveConfigMutation.isPending || (!liveStatus?.configured?.[liveExchange] && (!liveApiKey || !liveApiSecret))}
                    className="px-3.5 py-2 text-xs rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {liveConfigMutation.isPending ? "Saving…" : "Save Settings"}
                  </button>
                  <button onClick={() => { setShowLiveForm(false); setLiveApiKey(""); setLiveApiSecret(""); }} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
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
        </div>
      )}
    </div>
  );
}

// ── Small presentational helpers ────────────────────────────────────
function StripStat({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground/60 mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono truncate ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground/50 truncate">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, valueColor = "text-foreground", sub, subColor = "text-muted-foreground" }: {
  label: string; value: React.ReactNode; valueColor?: string; sub?: string; subColor?: string;
}) {
  return (
    <div className="rounded-md bg-card/40 border border-border/20 p-2.5">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono ${valueColor}`}>{value}</p>
      {sub && <p className={`text-[10px] ${subColor}`}>{sub}</p>}
    </div>
  );
}

function RangeField({ label, value, onChange, min, max, step, accent, display, displayColor, marks }: {
  label: string; value: string; onChange: (v: string) => void;
  min: string; max: string; step: string; accent: "emerald" | "amber";
  display: string; displayColor?: string; marks: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] text-muted-foreground">{label}</label>
        <span className={`text-xs font-mono font-bold ${displayColor ?? (accent === "amber" ? "text-amber-400" : "text-emerald-400")}`}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full h-1.5 bg-border/40 rounded-full appearance-none cursor-pointer ${accent === "amber" ? "accent-amber-500" : "accent-emerald-500"}`}
      />
      <div className="flex justify-between text-[9px] text-muted-foreground/60 mt-0.5">
        {marks.map(m => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}

// ── Engine section (read-only intelligence + scan activity) ─────────
function EngineSection({ intel, strategies, strategyCounts, featureFlags, updateFlags, flagsPending, scanLog, showScanLog, onToggleScanLog, paperRunning }: {
  intel: any;
  strategies: StrategyInfo[];
  strategyCounts: any;
  featureFlags: { trailing_mode: "fixed_pct" | "r_multiple"; trailing_r_multiple: number } | undefined;
  updateFlags: (patch: Record<string, unknown>) => void;
  flagsPending: boolean;
  scanLog: any[];
  showScanLog: boolean;
  onToggleScanLog: () => void;
  paperRunning: boolean;
}) {
  const regimeColor: Record<string, string> = {
    risk_on: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    neutral_bullish: "text-emerald-300/80 border-emerald-500/30 bg-emerald-500/5",
    neutral_bearish: "text-red-300/80 border-red-500/30 bg-red-500/5",
    volatile_drift: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    risk_off: "text-red-300 border-red-500/40 bg-red-500/10",
  };

  // The active, always-on protections (post Jul 2026 pipeline validation).
  const guardrails = [
    "Daily −4R halt",
    "Rolling-7d −6R halt",
    "Per-strategy kill-switch",
    "Cost-aware SL floor (0.6%)",
    "Correlation cap (3 / group)",
    "Weekly-trend filter (4H)",
    "Funding-rate filter",
    "Max-hold timeout",
  ];

  return (
    <div className="space-y-5">
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
            {/* BTC regime (informational) + fixed cap */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-md border border-border/30 p-3 sm:col-span-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">BTC Regime · informational</p>
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${regimeColor[intel.btcRegime] ?? "text-muted-foreground border-border/40"}`}>
                  {intel.btcRegime}
                </span>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-snug">
                  {intel.btcRegimeReason} — read only; both directions always open (overlay retired) and the position cap is fixed.
                </p>
              </div>
              <div className="rounded-md border border-border/30 p-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">Max Positions</p>
                <p className="text-lg font-bold font-mono text-foreground">{intel.maxOpen ?? 10}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-snug">fixed cap (capacity A/B: 10 &gt; 6)</p>
              </div>
            </div>

            {/* Per-strategy status */}
            <div className="rounded-md border border-border/30 overflow-hidden">
              <p className="px-3 py-2 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold border-b border-border/20">Active strategies</p>
              <div className="divide-y divide-border/10">
                {strategies.map(s => {
                  const c = getStratColor(s.id);
                  const counts = strategyCounts?.[s.id];
                  const paused = intel.pausedStrategies?.includes(s.id);
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
              {guardrails.map(g => (
                <div key={g} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-muted-foreground/80 truncate">{g}</span>
                </div>
              ))}
            </div>

            {/* Trailing mode */}
            {featureFlags && (
              <div className="rounded-md border border-border/30 p-3 space-y-2">
                <p className="text-xs font-bold">Post-TP1 Trailing</p>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  After TP1 closes 60%, the runner trails. Default <span className="font-mono">r_multiple</span> (2× the trade's own risk) — the Jul 2026 portfolio A/B chose it over a fixed 2% trail (better PF, lower drawdown). <span className="font-mono">fixed_pct</span> stays available.
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {(["r_multiple", "fixed_pct"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => updateFlags({ trailing_mode: mode })}
                      disabled={flagsPending}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                        featureFlags.trailing_mode === mode
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-card/40 border-border/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >{mode === "fixed_pct" ? "fixed_pct (2%)" : "r_multiple (2R)"}</button>
                  ))}
                  {featureFlags.trailing_mode === "r_multiple" && (
                    <div className="flex items-center gap-2 ml-2">
                      <label className="text-[10px] text-muted-foreground/70">multiplier</label>
                      <input
                        type="number" min="0.5" max="5" step="0.25"
                        defaultValue={featureFlags.trailing_r_multiple}
                        onBlur={e => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 0.5 && v <= 5 && v !== featureFlags.trailing_r_multiple) {
                            updateFlags({ trailing_r_multiple: v });
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

      {/* Scan Activity */}
      <Card className="border-border/30">
        <button onClick={onToggleScanLog} className="w-full flex items-center justify-between px-4 py-3 text-left">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground/50" />
            <span className="text-xs font-bold">Scan Activity</span>
            {scanLog.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-muted-foreground">{scanLog.length} events</span>
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
              <div className="space-y-1 mt-2 max-h-80 overflow-y-auto">
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
                    <span className="text-muted-foreground/60 shrink-0 w-20 truncate">{getStratName(ev.strategy, strategies)}</span>
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
    </div>
  );
}
