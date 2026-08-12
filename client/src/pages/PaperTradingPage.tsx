import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Wallet, TrendingUp, TrendingDown, Settings2, Zap, Eye, EyeOff, Activity,
  ChevronDown, ChevronUp, Shield, KeyRound, AlertTriangle, CheckCircle2, Circle,
  Power, Play, Square, Loader2, Cpu, SlidersHorizontal, ListChecks,
} from "lucide-react";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor, getStratName } from "@/lib/types";
import TradeRow from "@/components/TradeRow";

type Section = "trades" | "engine" | "config";
type ModeFilter = "all" | "paper" | "live";
type StateFilter = "all" | "open" | "win" | "loss";

/** Size-normalised stats for whatever slice the filters produce. */
function rMetrics(trades: JournalEntry[]) {
  const closed = trades.filter(t => t.outcome !== "open");
  const rs = closed.filter(t => t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null)
    .map(t => t.pnl_usd! / t.risk_usd!);
  const wins = closed.filter(t => t.outcome === "win").length;
  const gw = rs.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const gl = -rs.filter(r => r < 0).reduce((s, r) => s + r, 0);
  const sumR = rs.reduce((s, r) => s + r, 0);
  return {
    total: trades.length, closed: closed.length, open: trades.length - closed.length,
    wins, losses: closed.length - wins,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    sumR, expectancy: rs.length ? sumR / rs.length : 0,
    profitFactor: gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0),
    scored: rs.length,
  };
}
const fmtR = (r: number) => `${r >= 0 ? "+" : ""}${r.toFixed(1)}R`;
const fmtPF = (pf: number) => (pf === Infinity ? "∞" : pf.toFixed(2));

export default function PaperTradingPage() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("trades");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closeForm, setCloseForm] = useState({ exit_price: "", outcome: "win" as string });

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
    staleTime: 5 * 60_000,
  });
  const { data: paperStatus } = useQuery({
    queryKey: ["/api/paper/status"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/status")).json(),
    refetchInterval: 10_000,
  });
  const paperRunning = paperStatus?.running || false;
  const { data: journal = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => (await apiRequest("GET", "/api/journal")).json(),
    refetchInterval: 10_000,
  });
  const { data: paperPrices = [] } = useQuery<PaperPrice[]>({
    queryKey: ["/api/paper/prices"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/prices")).json(),
    refetchInterval: 10_000,
    enabled: paperRunning,
  });
  const { data: liveStatus } = useQuery({
    queryKey: ["/api/live/status"],
    queryFn: async () => (await apiRequest("GET", "/api/live/status")).json(),
    refetchInterval: 5_000,
  });
  const { data: featureFlags } = useQuery<{ trailing_mode: "fixed_pct" | "r_multiple"; trailing_r_multiple: number }>({
    queryKey: ["/api/settings/feature-flags"],
    queryFn: async () => (await apiRequest("GET", "/api/settings/feature-flags")).json(),
  });
  const { data: scanLog = [] } = useQuery<any[]>({
    queryKey: ["/api/paper/scan-log"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/scan-log")).json(),
    refetchInterval: paperRunning ? 15_000 : false,
    enabled: section === "engine" && showScanLog,
  });

  // Live rows had no price, no P&L and no progress bar, because /api/paper/prices
  // only covers paper. Synthesise the same shape from the venue snapshot so a
  // live position is presented exactly like a paper one — marked at the
  // exchange's own mark price rather than a second-hand quote.
  const priceMap = useMemo(() => {
    const map = new Map<number, PaperPrice>(paperPrices.map(p => [p.id, p]));
    const venuePositions: any[] = liveStatus?.positions ?? [];
    for (const t of journal) {
      if (t.mode !== "live" || t.outcome !== "open") continue;
      const vp = venuePositions.find(p =>
        String(p.botSymbol).toUpperCase() === t.symbol.toUpperCase() && p.direction === t.direction);
      if (!vp?.markPrice) continue;

      const moveFromEntry = t.direction === "LONG" ? vp.markPrice - t.entry_price : t.entry_price - vp.markPrice;
      const slDistance = Math.abs(t.entry_price - t.stop_loss);
      const tpDistance = Math.abs(t.take_profit1 - t.entry_price);
      map.set(t.id, {
        id: t.id, symbol: t.symbol, strategy: t.strategy,
        currentPrice: vp.markPrice,
        unrealizedPnl: (moveFromEntry / t.entry_price) * 100,
        unrealizedUsd: vp.unrealizedPnl ?? null,
        riskUsd: t.risk_usd, positionSizeUsd: vp.notionalUsd ?? t.position_size_usd,
        remainingPositionSizeUsd: t.remaining_position_size_usd,
        realizedPnlUsd: t.realized_pnl_usd ?? 0,
        tp1Hit: t.tp1_hit === 1, peakPrice: t.peak_price ?? null,
        progressPct: tpDistance > 0 ? Math.max(0, (moveFromEntry / tpDistance) * 100) : 0,
        slProgress: slDistance > 0 ? Math.max(0, (-moveFromEntry / slDistance) * 100) : 0,
      });
    }
    return map;
  }, [paperPrices, liveStatus, journal]);

  const invalidateTrades = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
    queryClient.invalidateQueries({ queryKey: ["/api/paper/prices"] });
  };
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => { await apiRequest("PATCH", `/api/journal/${id}`, updates); },
    onSuccess: invalidateTrades,
  });
  // Live closes must go through the venue. Writing only the journal would leave
  // the position open on the exchange, unmanaged, and pause all live entries.
  const closeLiveMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/live/close/${id}`, {})).json(),
    onSuccess: () => { invalidateTrades(); queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/journal/${id}`); },
    onSuccess: invalidateTrades,
  });
  const capitalMutation = useMutation({
    mutationFn: async (v: { capital?: number; riskPct?: number; leverage?: number }) =>
      (await apiRequest("POST", "/api/paper/capital", v)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/paper/status"] }); setShowCapitalForm(false); },
  });
  const engineOpts = (url: string, key: string) => ({
    mutationFn: async () => (await apiRequest("POST", url, {})).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [key] }); },
  });
  const paperStart = useMutation(engineOpts("/api/paper/start", "/api/paper/status"));
  const paperStop  = useMutation(engineOpts("/api/paper/stop", "/api/paper/status"));
  const liveStart  = useMutation(engineOpts("/api/live/start", "/api/live/status"));
  const liveStop   = useMutation(engineOpts("/api/live/stop", "/api/live/status"));
  const updateFlags = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => { await apiRequest("PUT", "/api/settings/feature-flags", patch); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/settings/feature-flags"] }),
  });
  const liveConfig = useMutation({
    mutationFn: async (v: { apiKey: string; apiSecret: string; riskPct?: number; leverage?: number; exchange?: string }) =>
      (await apiRequest("POST", "/api/live/config", {
        ...v,
        riskPct: v.riskPct != null ? Number(v.riskPct) : undefined,
        leverage: v.leverage != null ? Number(v.leverage) : undefined,
      })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/live/status"] }),
  });
  const liveTest = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/live/test", {})).json() });

  // ── Filter pipeline — one list, several lenses ────────────────────
  const tradable = journal.filter(e => e.mode === "paper" || e.mode === "live");
  const filtered = tradable.filter(e => {
    if (modeFilter !== "all" && e.mode !== modeFilter) return false;
    if (stateFilter === "open" && e.outcome !== "open") return false;
    if (stateFilter === "win" && e.outcome !== "win") return false;
    if (stateFilter === "loss" && e.outcome !== "loss") return false;
    if (strategyFilter !== "all" && e.strategy !== strategyFilter) return false;
    if (search && !e.symbol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  // Stats follow the filter — that is this page's job, and what the dashboard
  // (which only ever shows the whole book) cannot answer.
  const m = rMetrics(filtered);
  const cap = paperStatus?.capital;
  const venue = String(liveStatus?.exchange ?? "").toUpperCase();

  const handleClose = (id: number) => {
    const entry = journal.find(e => e.id === id);
    if (!entry) return;
    // A live trade closes at market on the venue; the exit price is whatever
    // the exchange fills at, not something typed into a form.
    if (entry.mode === "live") {
      closeLiveMutation.mutate(id);
      setClosingId(null);
      return;
    }
    const exitPrice = parseFloat(closeForm.exit_price);
    if (isNaN(exitPrice)) return;
    const pnl = entry.direction === "LONG"
      ? ((exitPrice - entry.entry_price) / entry.entry_price) * 100
      : ((entry.entry_price - exitPrice) / entry.entry_price) * 100;
    updateMutation.mutate({ id, updates: { outcome: closeForm.outcome, exit_price: exitPrice, pnl_pct: Math.round(pnl * 100) / 100, closed_at: new Date().toISOString() } });
    setClosingId(null);
    setCloseForm({ exit_price: "", outcome: "win" });
  };

  const SECTIONS: { id: Section; label: string; icon: typeof ListChecks }[] = [
    { id: "trades", label: "Trade Log", icon: ListChecks },
    { id: "engine", label: "Engine", icon: Cpu },
    { id: "config", label: "Config", icon: SlidersHorizontal },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px]">
      {/* Header — no metrics here; the dashboard owns the scoreboard */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-card/40 border border-border/30 rounded-lg p-0.5">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                section === s.id ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground"}`}>
              <s.icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border font-medium ${
            liveStatus?.running ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-card/30 border-border/20 text-muted-foreground/50"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${liveStatus?.running ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/40"}`} />
            {liveStatus?.running ? `LIVE ${venue}` : "Live off"}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border font-medium ${
            paperRunning ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400/90" : "bg-card/30 border-border/20 text-muted-foreground/50"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${paperRunning ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
            Paper {paperRunning ? "on" : "off"}
          </span>
        </div>
      </div>

      {/* ═══ TRADE LOG ═══ */}
      {section === "trades" && (
        <div className="space-y-3">
          <Card className="border-border/20 p-3 space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Segmented value={modeFilter} onChange={v => setModeFilter(v as ModeFilter)} accentLive
                options={[
                  { id: "all", label: "All", count: tradable.length },
                  { id: "paper", label: "Paper", count: tradable.filter(t => t.mode === "paper").length },
                  { id: "live", label: "Live", count: tradable.filter(t => t.mode === "live").length },
                ]} />
              <Segmented value={stateFilter} onChange={v => setStateFilter(v as StateFilter)}
                options={[
                  { id: "all", label: "All" },
                  { id: "open", label: "Open" },
                  { id: "win", label: "Wins" },
                  { id: "loss", label: "Losses" },
                ]} />
              <select value={strategyFilter} onChange={e => setStrategyFilter(e.target.value)}
                className="text-[11px] px-2 py-1.5 rounded-md bg-card/40 border border-border/30 text-foreground cursor-pointer">
                <option value="all">All strategies</option>
                {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Symbol…"
                  className="pl-7 pr-2 py-1.5 w-28 text-[11px] rounded-md bg-card/40 border border-border/30 focus:outline-none focus:border-purple-500/40" />
              </div>
              {(modeFilter !== "all" || stateFilter !== "all" || strategyFilter !== "all" || search) && (
                <button onClick={() => { setModeFilter("all"); setStateFilter("all"); setStrategyFilter("all"); setSearch(""); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">clear</button>
              )}
            </div>

            {/* Stats for the current filter — the page's reason to exist */}
            <div className="flex items-center gap-5 flex-wrap pt-2.5 border-t border-border/15 text-[11px]">
              <Stat label="Showing" value={`${filtered.length}`} sub={`${m.open} open · ${m.closed} closed`} />
              <Stat label="Net R" value={m.scored ? fmtR(m.sumR) : "—"} tone={m.sumR >= 0 ? "text-emerald-400" : "text-red-400"}
                sub={m.scored ? `exp ${m.expectancy >= 0 ? "+" : ""}${m.expectancy.toFixed(2)}R` : "no scored trades"} />
              <Stat label="Profit factor" value={m.scored ? fmtPF(m.profitFactor) : "—"} tone={m.profitFactor >= 1 ? "text-emerald-400" : "text-red-400"} />
              <Stat label="Win rate" value={m.closed ? `${Math.round(m.winRate)}%` : "—"} tone={m.winRate >= 45 ? "text-emerald-400" : "text-amber-400"}
                sub={`${m.wins}W / ${m.losses}L`} />
            </div>
          </Card>

          {isLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="border-border/30 border-dashed py-14 text-center">
              <ListChecks className="w-9 h-9 text-muted-foreground/15 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No trades match these filters</p>
              <p className="text-[11px] text-muted-foreground/45 mt-1">
                {tradable.length === 0 ? "Start an engine to begin trading" : "Try clearing a filter"}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => (
                <Card key={entry.id} className={`transition-colors ${entry.mode === "live" ? "border-amber-500/25 bg-amber-500/[0.02] hover:border-amber-500/40" : "border-border/20 hover:border-border/40"}`}>
                  <TradeRow
                    entry={entry} strategies={strategies} price={priceMap.get(entry.id)}
                    closingId={closingId} closeForm={closeForm}
                    onStartClose={setClosingId} onCancelClose={() => setClosingId(null)}
                    onCloseFormChange={u => setCloseForm(f => ({ ...f, ...u }))}
                    onConfirmClose={handleClose} onDelete={id => deleteMutation.mutate(id)}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ENGINE ═══ */}
      {section === "engine" && (
        <EngineSection
          intel={paperStatus?.intelligence} strategies={strategies}
          strategyCounts={paperStatus?.strategyCounts} featureFlags={featureFlags}
          updateFlags={p => updateFlags.mutate(p)} flagsPending={updateFlags.isPending}
          scanLog={scanLog} showScanLog={showScanLog} onToggleScanLog={() => setShowScanLog(s => !s)}
          paperRunning={paperRunning}
        />
      )}

      {/* ═══ CONFIG ═══ */}
      {section === "config" && (
        <div className="space-y-4">
          {/* Engines side by side — start/stop and sizing live together */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Live */}
            <Card className={`overflow-hidden ${liveStatus?.running ? "border-amber-500/40" : "border-border/30"}`}>
              <div className={`px-4 py-3 flex items-center justify-between border-b border-border/20 ${liveStatus?.running ? "bg-amber-500/[0.05]" : "bg-card/30"}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${liveStatus?.running ? "bg-amber-500/15 text-amber-400" : "bg-card/60 text-muted-foreground"}`}>
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">
                      {(liveStatus?.exchanges ?? []).find((e: any) => e.id === liveStatus?.exchange)?.name ?? "Live Trading"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {liveStatus?.running
                        ? <span className="text-amber-400 inline-flex items-center gap-1"><Circle className="w-1.5 h-1.5 fill-amber-400 text-amber-400" /> real capital</span>
                        : liveStatus?.hasKeys ? "keys set — stopped" : "not configured"}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowLiveForm(v => !v); if (!showLiveForm && liveStatus) { setLiveRiskInput(String(liveStatus.riskPct ?? 1)); setLiveLeverageInput(String(liveStatus.leverage ?? 5)); setLiveExchange(String(liveStatus.exchange ?? "kraken")); } }}
                  className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60">
                  <Settings2 className="w-3 h-3" /> {showLiveForm ? "Close" : "Settings"}
                </button>
              </div>

              <div className="p-3.5 space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <MiniStat label="Equity" value={liveStatus?.account?.equity != null ? `$${liveStatus.account.equity.toFixed(2)}` : liveStatus?.balance != null ? `$${liveStatus.balance.toFixed(2)}` : "—"} />
                  <MiniStat label="Positions" value={<><span className={liveStatus?.openTrades > 0 ? "text-amber-400" : ""}>{liveStatus?.openTrades ?? 0}</span><span className="text-muted-foreground/40"> / 10</span></>} />
                  <MiniStat label="Total P&L"
                    value={liveStatus?.totalPnlUsd != null ? `${liveStatus.totalPnlUsd >= 0 ? "+" : ""}$${liveStatus.totalPnlUsd.toFixed(2)}` : "—"}
                    valueColor={(liveStatus?.totalPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} />
                </div>
                <p className="text-[10px] text-muted-foreground/60">Risk {liveStatus?.riskPct ?? 1}% · leverage {liveStatus?.leverage ?? 5}× · {liveStatus?.closedLiveTrades ?? 0} closed</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {liveStatus?.running ? (
                    <button onClick={() => liveStop.mutate()} disabled={liveStop.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 font-semibold disabled:opacity-50">
                      <Power className="w-3.5 h-3.5" /> Stop
                    </button>
                  ) : (
                    <button onClick={() => liveStart.mutate()} disabled={!liveStatus?.hasKeys || liveStart.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 font-semibold disabled:opacity-40">
                      <Power className="w-3.5 h-3.5" /> Start
                    </button>
                  )}
                  {liveStatus?.hasKeys && (
                    <button onClick={() => liveTest.mutate()} disabled={liveTest.isPending}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-card/50 border border-border/30 text-muted-foreground hover:text-foreground">
                      <Activity className="w-3.5 h-3.5" /> {liveTest.isPending ? "Testing…" : "Test"}
                    </button>
                  )}
                  {liveTest.data && (
                    <span className={`text-[10px] inline-flex items-center gap-1 ${liveTest.data.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {liveTest.data.ok ? <><CheckCircle2 className="w-3 h-3" /> ${liveTest.data.balance?.toFixed(2)}</> : <><AlertTriangle className="w-3 h-3" /> {liveTest.data.error}</>}
                    </span>
                  )}
                </div>
                {liveStatus?.error && (
                  <div className="flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 font-mono">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /><span className="break-all">{liveStatus.error}</span>
                  </div>
                )}
              </div>

              {showLiveForm && (
                <div className="border-t border-border/20 bg-card/20 px-3.5 py-3.5 space-y-3.5">
                  <section>
                    <SectionLabel icon={<Zap className="w-3 h-3" />}>Exchange</SectionLabel>
                    <div className="grid gap-2">
                      {(liveStatus?.exchanges ?? []).map((ex: any) => {
                        const active = liveExchange === ex.id;
                        return (
                          <button key={ex.id} onClick={() => setLiveExchange(ex.id)} disabled={liveStatus?.running}
                            className={`text-left p-2.5 rounded-md border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              active ? "bg-amber-500/10 border-amber-500/40" : "bg-card/40 border-border/30 hover:border-border/50"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold ${active ? "text-amber-300" : ""}`}>{ex.name}</span>
                              {liveStatus?.configured?.[ex.id] && <span className="text-[9px] text-emerald-400/80 inline-flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> keys</span>}
                            </div>
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-snug">{ex.note}</p>
                          </button>
                        );
                      })}
                    </div>
                    {liveStatus?.running && <p className="text-[10px] text-amber-400/70 mt-1.5">Stop the engine to switch exchange.</p>}
                  </section>

                  <section>
                    <SectionLabel icon={<KeyRound className="w-3 h-3" />}>Credentials</SectionLabel>
                    <div className="space-y-2">
                      <input type="text" value={liveApiKey} onChange={e => setLiveApiKey(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-amber-500/60 font-mono"
                        placeholder={liveStatus?.configured?.[liveExchange] ? "API key — stored, leave empty to keep" : "API key"} />
                      <div className="relative">
                        <input type={showSecret ? "text" : "password"} value={liveApiSecret} onChange={e => setLiveApiSecret(e.target.value)}
                          className="w-full px-2.5 py-1.5 pr-8 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-amber-500/60 font-mono"
                          placeholder={liveStatus?.configured?.[liveExchange] ? "Secret — stored, leave empty to keep" : "API secret"} />
                        <button type="button" onClick={() => setShowSecret(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-400/70 mt-1.5 inline-flex items-start gap-1">
                      <Shield className="w-3 h-3 mt-0.5 shrink-0" /> Grant trade permissions only — never withdrawal.
                    </p>
                  </section>

                  <section>
                    <SectionLabel icon={<Shield className="w-3 h-3" />}>Risk</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <RangeField label="Risk / trade" value={liveRiskInput} onChange={setLiveRiskInput} min="0.25" max="3" step="0.25" accent="amber"
                        display={`${parseFloat(liveRiskInput || "0").toFixed(2)}%`} marks={["0.25%", "3%"]} />
                      <RangeField label="Leverage" value={liveLeverageInput} onChange={setLiveLeverageInput} min="1" max="20" step="1" accent="amber"
                        display={`${liveLeverageInput}×`}
                        displayColor={parseInt(liveLeverageInput) >= 15 ? "text-red-400" : parseInt(liveLeverageInput) >= 10 ? "text-amber-400" : "text-emerald-400"}
                        marks={["1×", "20×"]} />
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      Sizing is risk-based (stop distance → R). Leverage only changes margin used.
                      {liveExchange === "kraken" && " Kraken caps EEA retail at 10×."}
                    </p>
                  </section>

                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => liveConfig.mutate({ apiKey: liveApiKey || "__keep__", apiSecret: liveApiSecret || "__keep__", riskPct: parseFloat(liveRiskInput), leverage: parseInt(liveLeverageInput), exchange: liveExchange })}
                      disabled={liveConfig.isPending || (!liveStatus?.configured?.[liveExchange] && (!liveApiKey || !liveApiSecret))}
                      className="px-3 py-1.5 text-xs rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 font-semibold disabled:opacity-40">
                      {liveConfig.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => { setShowLiveForm(false); setLiveApiKey(""); setLiveApiSecret(""); }} className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    {liveConfig.data && (
                      <span className={`text-[10px] inline-flex items-center gap-1 ${liveConfig.data.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {liveConfig.data.ok ? <><CheckCircle2 className="w-3 h-3" /> saved · ${liveConfig.data.balance?.toFixed(2)}</> : <><AlertTriangle className="w-3 h-3" /> {liveConfig.data.error}</>}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Paper */}
            <Card className={`overflow-hidden ${paperRunning ? "border-emerald-500/30" : "border-border/30"}`}>
              <div className={`px-4 py-3 flex items-center justify-between border-b border-border/20 ${paperRunning ? "bg-emerald-500/[0.04]" : "bg-card/30"}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${paperRunning ? "bg-emerald-500/15 text-emerald-400" : "bg-card/60 text-muted-foreground"}`}>
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">Paper Benchmark</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {paperRunning ? `scanning · ${paperStatus?.coinsScanned ?? 0} coins` : "stopped"}
                    </p>
                  </div>
                </div>
                {cap && (
                  <button onClick={() => { setShowCapitalForm(v => !v); setCapitalInput(String(cap.initial)); setRiskInput(String(cap.riskPct)); setPaperLeverageInput(String(cap.leverage ?? 5)); }}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-card/60">
                    <Settings2 className="w-3 h-3" /> {showCapitalForm ? "Close" : "Settings"}
                  </button>
                )}
              </div>

              {cap && (
                <div className="p-3.5 space-y-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <MiniStat label="Balance" value={`€${cap.balance.toFixed(2)}`} valueColor={cap.balance >= cap.initial ? "text-emerald-400" : "text-red-400"} />
                    <MiniStat label="1R" value={`€${cap.oneR.toFixed(2)}`} valueColor="text-amber-400" />
                    <MiniStat label="Today" value={`${cap.todayR >= 0 ? "+" : ""}${cap.todayR.toFixed(1)}R`} valueColor={cap.todayR >= 0 ? "text-emerald-400" : "text-red-400"} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    Risk {cap.riskPct}% · leverage {cap.leverage ?? 5}× · initial €{cap.initial} · halts −4R daily / −6R rolling-7d
                  </p>
                  <button onClick={() => (paperRunning ? paperStop : paperStart).mutate()}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-semibold border transition-colors ${
                      paperRunning ? "bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25" : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"}`}>
                    {paperRunning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {paperRunning ? "Stop" : "Start"}
                  </button>

                  {showCapitalForm && (
                    <div className="pt-3 border-t border-border/20 space-y-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Initial capital (€)</label>
                        <input type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                          className="w-28 px-2.5 py-1.5 text-xs rounded-md bg-background border border-border/40 focus:outline-none focus:border-emerald-500/60 font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <RangeField label="Risk / trade" value={riskInput || "0"} onChange={setRiskInput} min="0.25" max="3" step="0.25" accent="emerald"
                          display={`${parseFloat(riskInput || "0").toFixed(2)}%`} marks={["0.25%", "3%"]} />
                        <RangeField label="Leverage" value={paperLeverageInput} onChange={setPaperLeverageInput} min="1" max="20" step="1" accent="emerald"
                          display={`${paperLeverageInput}×`} marks={["1×", "20×"]} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => capitalMutation.mutate({ capital: parseFloat(capitalInput), riskPct: parseFloat(riskInput), leverage: parseInt(paperLeverageInput, 10) })}
                          disabled={capitalMutation.isPending}
                          className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 font-semibold disabled:opacity-50">
                          {capitalMutation.isPending ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setShowCapitalForm(false)} className="px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small building blocks ───────────────────────────────────────────
function Segmented({ value, onChange, options, accentLive }: {
  value: string; onChange: (v: string) => void; accentLive?: boolean;
  options: { id: string; label: string; count?: number }[];
}) {
  return (
    <div className="flex items-center bg-card/40 border border-border/30 rounded-lg p-0.5">
      {options.map(o => {
        const active = value === o.id;
        const amber = accentLive && o.id === "live";
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              active ? (amber ? "bg-amber-500/20 text-amber-300" : "bg-purple-500/20 text-purple-400") : "text-muted-foreground hover:text-foreground"}`}>
            {o.label}{o.count != null && <span className="opacity-55 ml-1">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{label}</p>
      <p className={`text-sm font-bold font-mono ${tone ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/45">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, valueColor = "text-foreground" }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div className="rounded-md bg-card/40 border border-border/20 p-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">{label}</p>
      <p className={`text-[13px] font-bold font-mono ${valueColor}`}>{value}</p>
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
      {icon}
      <h4 className="text-[10px] font-bold uppercase tracking-wider">{children}</h4>
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
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-muted-foreground">{label}</label>
        <span className={`text-[11px] font-mono font-bold ${displayColor ?? (accent === "amber" ? "text-amber-400" : "text-emerald-400")}`}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)}
        className={`w-full h-1.5 bg-border/40 rounded-full appearance-none cursor-pointer ${accent === "amber" ? "accent-amber-500" : "accent-emerald-500"}`} />
      <div className="flex justify-between text-[9px] text-muted-foreground/50 mt-0.5">
        {marks.map(m => <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}

// ── Engine section ──────────────────────────────────────────────────
function EngineSection({ intel, strategies, strategyCounts, featureFlags, updateFlags, flagsPending, scanLog, showScanLog, onToggleScanLog, paperRunning }: {
  intel: any; strategies: StrategyInfo[]; strategyCounts: any;
  featureFlags: { trailing_mode: "fixed_pct" | "r_multiple"; trailing_r_multiple: number } | undefined;
  updateFlags: (patch: Record<string, unknown>) => void; flagsPending: boolean;
  scanLog: any[]; showScanLog: boolean; onToggleScanLog: () => void; paperRunning: boolean;
}) {
  const regimeColor: Record<string, string> = {
    risk_on: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    neutral_bullish: "text-emerald-300/80 border-emerald-500/30 bg-emerald-500/5",
    neutral_bearish: "text-red-300/80 border-red-500/30 bg-red-500/5",
    volatile_drift: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    risk_off: "text-red-300 border-red-500/40 bg-red-500/10",
  };
  const guardrails = [
    "Daily −4R halt", "Rolling-7d −6R halt", "Per-strategy kill-switch", "Cost-aware SL floor (0.6%)",
    "Correlation cap (3 / group)", "Weekly-trend filter (4H)", "Funding-rate filter", "Max-hold timeout",
  ];

  return (
    <div className="space-y-4">
      <Card className="border-border/30 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/20 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-bold">Engine Intelligence</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">always on</span>
        </div>
        {!intel ? (
          <p className="px-4 py-4 text-[11px] text-muted-foreground/60">Awaiting first scan — the engine publishes its regime read every 3 min.</p>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-md border border-border/30 p-3 sm:col-span-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">BTC Regime · informational</p>
                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded border ${regimeColor[intel.btcRegime] ?? "text-muted-foreground border-border/40"}`}>{intel.btcRegime}</span>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-snug">
                  {intel.btcRegimeReason} — read only; both directions always open and the cap is fixed.
                </p>
              </div>
              <div className="rounded-md border border-border/30 p-3">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold mb-1.5">Max Positions</p>
                <p className="text-lg font-bold font-mono">{intel.maxOpen ?? 10}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">fixed (A/B: 10 &gt; 6)</p>
              </div>
            </div>

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
                        {counts && counts.total > 0 && <span className="text-[9px] text-muted-foreground/50">{counts.open} open · {counts.total} total</span>}
                      </div>
                      {paused ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-300 shrink-0" title="Auto-paused: 7d netR < −3R">
                          <AlertTriangle className="w-3 h-3" /> paused
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300 shrink-0"><CheckCircle2 className="w-3 h-3" /> active</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {guardrails.map(g => (
                <div key={g} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-muted-foreground/80 truncate">{g}</span>
                </div>
              ))}
            </div>

            {featureFlags && (
              <div className="rounded-md border border-border/30 p-3 space-y-2">
                <p className="text-xs font-bold">Post-TP1 Trailing</p>
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  After TP1 closes 60%, the runner trails. Default <span className="font-mono">r_multiple</span> (2× the trade's own risk) — chosen over a fixed 2% trail by the Jul 2026 portfolio A/B (better PF, lower drawdown).
                </p>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {(["r_multiple", "fixed_pct"] as const).map(mode => (
                    <button key={mode} onClick={() => updateFlags({ trailing_mode: mode })} disabled={flagsPending}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                        featureFlags.trailing_mode === mode ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : "bg-card/40 border-border/30 text-muted-foreground hover:text-foreground"}`}>
                      {mode === "fixed_pct" ? "fixed_pct (2%)" : "r_multiple (2R)"}
                    </button>
                  ))}
                  {featureFlags.trailing_mode === "r_multiple" && (
                    <div className="flex items-center gap-2 ml-1">
                      <label className="text-[10px] text-muted-foreground/70">×R</label>
                      <input type="number" min="0.5" max="5" step="0.25" defaultValue={featureFlags.trailing_r_multiple}
                        onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.5 && v <= 5 && v !== featureFlags.trailing_r_multiple) updateFlags({ trailing_r_multiple: v }); }}
                        className="w-14 px-2 py-1 text-xs rounded bg-background border border-border/40 focus:outline-none focus:border-emerald-500/60 font-mono" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="border-border/30">
        <button onClick={onToggleScanLog} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground/50" />
            <span className="text-xs font-bold">Scan Activity</span>
            <span className="text-[10px] text-muted-foreground/50">why it did or didn't trade</span>
            {scanLog.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-muted-foreground">{scanLog.length}</span>}
          </div>
          {showScanLog ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
        </button>
        {showScanLog && (
          <div className="border-t border-border/20 px-4 pb-3">
            {scanLog.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 py-3 text-center">{paperRunning ? "No activity yet — runs every 3 minutes" : "Start the paper engine to see activity"}</p>
            ) : (
              <div className="space-y-1 mt-2 max-h-80 overflow-y-auto">
                {scanLog.map((ev: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] py-1 border-b border-border/10 last:border-0">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      ev.result === "opened" ? "bg-emerald-500/20 text-emerald-400" :
                      ev.result === "filtered" ? "bg-amber-500/20 text-amber-400" : "bg-card/40 text-muted-foreground/40"}`}>
                      {ev.result === "opened" ? "OPEN" : ev.result === "filtered" ? "SKIP" : "HOLD"}
                    </span>
                    <span className="font-bold shrink-0 w-10">{ev.symbol}</span>
                    <span className="text-muted-foreground/60 shrink-0 w-24 truncate">{getStratName(ev.strategy, strategies)}</span>
                    <span className="text-muted-foreground/70 flex-1 leading-relaxed">{ev.reason}</span>
                    <span className="text-muted-foreground/30 shrink-0">{new Date(ev.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
