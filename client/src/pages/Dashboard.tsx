import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, TrendingUp, BarChart3, Target, Clock, Zap, Shield, ShieldAlert,
  ArrowUpRight, ArrowDownRight, ChevronRight, LineChart,
  Play, Square, Loader2, Settings2, AlertTriangle, FlaskConical, RefreshCw,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor, getStratName } from "@/lib/types";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid, Legend,
} from "recharts";

/** Size-normalised performance. R = pnl / risk, so books of different size compare. */
function rMetrics(trades: JournalEntry[]) {
  const closed = trades.filter(t => t.outcome !== "open");
  const rs = closed
    .filter(t => t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null)
    .map(t => t.pnl_usd! / t.risk_usd!);
  const wins = closed.filter(t => t.outcome === "win").length;
  const gw = rs.filter(r => r > 0).reduce((s, r) => s + r, 0);
  const gl = -rs.filter(r => r < 0).reduce((s, r) => s + r, 0);
  const sumR = rs.reduce((s, r) => s + r, 0);
  return {
    closed: closed.length, open: trades.filter(t => t.outcome === "open").length,
    wins, losses: closed.length - wins,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    sumR, expectancy: rs.length ? sumR / rs.length : 0,
    profitFactor: gl > 0 ? gw / gl : (gw > 0 ? Infinity : 0),
    scored: rs.length,
  };
}

const fmtR = (r: number) => `${r >= 0 ? "+" : ""}${r.toFixed(1)}R`;
const fmtPF = (pf: number) => (pf === Infinity ? "∞" : pf.toFixed(2));
const fmtUsd = (n: number) => `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`;
const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
};
const heldFor = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  return h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${h.toFixed(1)}h` : `${Math.floor(h / 24)}d`;
};

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [curveMode, setCurveMode] = useState<"both" | "live" | "paper">("both");

  const { data: paperStatus } = useQuery({
    queryKey: ["/api/paper/status"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/status")).json(),
    refetchInterval: 10_000,
  });
  // Live carries real money — poll it hardest.
  const { data: liveStatus } = useQuery({
    queryKey: ["/api/live/status"],
    queryFn: async () => (await apiRequest("GET", "/api/live/status")).json(),
    refetchInterval: 5_000,
  });
  const { data: strategies = [] } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
    queryFn: async () => (await apiRequest("GET", "/api/strategies")).json(),
    staleTime: 5 * 60_000,
  });
  const { data: journal = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => (await apiRequest("GET", "/api/journal")).json(),
    refetchInterval: 10_000,
  });
  const { data: paperPrices = [] } = useQuery<PaperPrice[]>({
    queryKey: ["/api/paper/prices"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/prices")).json(),
    refetchInterval: 10_000,
    enabled: paperStatus?.running,
  });

  // Declared individually rather than via a factory: a helper that calls
  // useMutation internally would be a hook in disguise and breaks the rules
  // of hooks the moment one becomes conditional.
  const engineOpts = (url: string) => ({
    mutationFn: async () => (await apiRequest("POST", url, {})).json(),
    onSuccess: () => { queryClient.invalidateQueries(); },
  });
  const paperStart = useMutation(engineOpts("/api/paper/start"));
  const paperStop  = useMutation(engineOpts("/api/paper/stop"));
  const liveStart  = useMutation(engineOpts("/api/live/start"));
  const liveStop   = useMutation(engineOpts("/api/live/stop"));

  const priceMap = new Map(paperPrices.map(p => [p.id, p]));
  const liveTrades  = journal.filter(e => e.mode === "live");
  const paperTrades = journal.filter(e => e.mode === "paper");
  const live  = rMetrics(liveTrades);
  const paper = rMetrics(paperTrades);

  const liveRunning  = liveStatus?.running ?? false;
  const paperRunning = paperStatus?.running ?? false;
  const venue = String(liveStatus?.exchange ?? "").toUpperCase();
  const acct = liveStatus?.account;
  const cap = paperStatus?.capital;

  // Live rows come from the exchange itself (mark price, P&L, resting stops),
  // joined to the journal for strategy and age. Paper rows use the paper marks.
  const venuePositions: any[] = liveStatus?.positions ?? [];
  const liveRows = venuePositions.map(vp => {
    const j = liveTrades.find(t => t.outcome === "open"
      && t.symbol.toUpperCase() === String(vp.botSymbol).toUpperCase()
      && t.direction === vp.direction);
    const pnlPct = vp.notionalUsd ? (vp.unrealizedPnl / vp.notionalUsd) * 100 : 0;
    return {
      key: `live-${vp.botSymbol}-${vp.direction}`,
      isLive: true, symbol: vp.botSymbol, direction: vp.direction,
      strategy: j?.strategy, entry: vp.entryPrice, mark: vp.markPrice,
      pnlUsd: vp.unrealizedPnl, pnlPct, notional: vp.notionalUsd,
      funding: vp.unrealizedFunding, protection: vp.protection,
      target: { sl: j?.stop_loss, tp: j?.take_profit1 },
      opened: j?.created_at, orphan: !j,
    };
  });
  const paperRows = paperTrades.filter(t => t.outcome === "open").map(t => {
    const p = priceMap.get(t.id);
    return {
      key: `paper-${t.id}`, isLive: false, symbol: t.symbol, direction: t.direction,
      strategy: t.strategy, entry: t.entry_price, mark: p?.currentPrice,
      pnlUsd: p?.unrealizedUsd ?? null, pnlPct: p?.unrealizedPnl ?? null,
      notional: t.position_size_usd, funding: null, protection: undefined,
      target: { sl: t.stop_loss, tp: t.take_profit1 },
      opened: t.created_at, orphan: false,
    };
  });
  const rows = [...liveRows, ...paperRows];

  const recentClosed = journal
    .filter(e => (e.mode === "live" || e.mode === "paper") && e.outcome !== "open" && e.closed_at)
    .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())
    .slice(0, 6);

  const equityData = (() => {
    const closed = journal
      .filter(t => (t.mode === "live" || t.mode === "paper") && t.outcome !== "open"
        && t.closed_at && t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());
    if (!closed.length) return [];
    let l = 0, p = 0;
    return [{ date: "Start", live: 0, paper: 0 }, ...closed.map(t => {
      const r = t.pnl_usd! / t.risk_usd!;
      if (t.mode === "live") l += r; else p += r;
      return {
        date: new Date(t.closed_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        live: Math.round(l * 100) / 100, paper: Math.round(p * 100) / 100,
      };
    })];
  })();

  const focus = live.closed > 0 ? liveTrades : paperTrades;
  const perStrategy = strategies
    .map(s => ({ s, m: rMetrics(focus.filter(t => t.strategy === s.id)) }))
    .filter(x => x.m.closed + x.m.open > 0);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1500px]">
      {/* ═══ STATUS BAR — chrome that recedes: what's running, how fresh ═══ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium ${
            liveRunning ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
            : liveStatus?.hasKeys ? "bg-card/40 border-border/30 text-muted-foreground"
            : "bg-card/30 border-border/20 text-muted-foreground/50"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${liveRunning ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/40"}`} />
            {liveRunning ? `LIVE · ${venue}` : liveStatus?.hasKeys ? `${venue} ready` : "Live not set"}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full border font-medium ${
            paperRunning ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400/90" : "bg-card/30 border-border/20 text-muted-foreground/50"}`}>
            <FlaskConical className="w-2.5 h-2.5" /> Paper {paperRunning ? "on" : "off"}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <RefreshCw className="w-2.5 h-2.5" /> {ago(liveStatus?.snapshotAt ?? liveStatus?.lastCheck)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/paper" className="text-[11px] text-muted-foreground hover:text-purple-400 transition-colors flex items-center gap-1">
            <Settings2 className="w-3 h-3" /> Settings
          </Link>
          {liveRunning ? (
            <button onClick={() => liveStop.mutate()} disabled={liveStop.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 font-semibold disabled:opacity-50">
              {liveStop.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />} Stop live
            </button>
          ) : (
            <button onClick={() => liveStart.mutate()} disabled={!liveStatus?.hasKeys || liveStart.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 font-semibold disabled:opacity-40">
              {liveStart.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Start live
            </button>
          )}
        </div>
      </div>

      {(liveStatus?.unmanagedPositions > 0 || liveStatus?.error) && (
        <Card className="border-red-500/30 bg-red-500/[0.06] px-4 py-2.5">
          <div className="flex items-start gap-2 text-[11px] text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              {liveStatus?.unmanagedPositions > 0 && (
                <p><b>{liveStatus.unmanagedPositions} unmanaged position(s)</b> on {venue} — the bot is not managing their stop. New entries paused.</p>
              )}
              {liveStatus?.error && <p className="font-mono break-all opacity-90">{liveStatus.error}</p>}
            </div>
          </div>
        </Card>
      )}

      {/* ═══ ACCOUNT — straight from the venue ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat label={`${venue || "Live"} equity`} value={acct?.equity != null ? `$${acct.equity.toFixed(2)}` : liveStatus?.balance != null ? `$${liveStatus.balance.toFixed(2)}` : "—"}
          sub={acct ? `$${(acct.available ?? 0).toFixed(2)} free · $${(acct.usedMargin ?? 0).toFixed(2)} margin` : "not connected"}
          icon={<Zap className="w-4 h-4 text-amber-400" />} />
        <BigStat label="Unrealised" value={acct?.unrealizedPnl != null ? fmtUsd(acct.unrealizedPnl) : "—"}
          tone={(acct?.unrealizedPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
          sub={`${live.open} position${live.open === 1 ? "" : "s"} open`}
          icon={<Activity className="w-4 h-4 text-sky-400" />} />
        <BigStat label="Realised today" value={liveStatus?.todayPnlUsd != null ? fmtUsd(liveStatus.todayPnlUsd) : "—"}
          tone={(liveStatus?.todayPnlUsd ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
          sub={`${liveStatus?.closedLiveTrades ?? 0} closed live`}
          icon={<Clock className="w-4 h-4 text-muted-foreground" />} />
        <BigStat label="Live Net R" value={live.scored ? fmtR(live.sumR) : "—"}
          tone={live.sumR >= 0 ? "text-emerald-400" : "text-red-400"}
          sub={live.scored ? `exp ${live.expectancy >= 0 ? "+" : ""}${live.expectancy.toFixed(2)}R · PF ${fmtPF(live.profitFactor)}` : "awaiting first close"}
          reference={paper.scored ? `paper ${fmtR(paper.sumR)} · exp ${paper.expectancy >= 0 ? "+" : ""}${paper.expectancy.toFixed(2)}R · PF ${fmtPF(paper.profitFactor)}` : undefined}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} />
      </div>

      {/* ═══ OPEN POSITIONS — a table, because this is tabular data ═══ */}
      <Card className="border-border/20 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-bold">Open Positions</h2>
            {rows.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold">{rows.length}</span>}
          </div>
          <Link href="/paper" className="text-[11px] text-muted-foreground hover:text-purple-400 flex items-center gap-0.5">
            All trades <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <Target className="w-7 h-7 text-muted-foreground/15 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground">No open positions</p>
            <p className="text-[10px] text-muted-foreground/45 mt-0.5">The engine opens one when a setup passes every gate</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-muted-foreground/50 border-b border-border/15">
                  <th className="text-left font-medium py-2 px-4">Symbol</th>
                  <th className="text-left font-medium py-2 px-2">Strategy</th>
                  <th className="text-right font-medium py-2 px-2">Entry</th>
                  <th className="text-right font-medium py-2 px-2">Mark</th>
                  <th className="text-right font-medium py-2 px-2">Size</th>
                  <th className="text-right font-medium py-2 px-2">P&L</th>
                  <th className="text-center font-medium py-2 px-2">Protection</th>
                  <th className="text-right font-medium py-2 px-2 hidden md:table-cell">Funding</th>
                  <th className="text-right font-medium py-2 px-4">Held</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {rows.map(r => {
                  const sc = getStratColor(r.strategy ?? "");
                  const up = (r.pnlPct ?? 0) >= 0;
                  const protectedOk = r.isLive ? (r.protection?.stop != null) : true;
                  return (
                    <tr key={r.key} className={`hover:bg-card/25 transition-colors ${r.isLive ? "bg-amber-500/[0.025]" : ""}`}>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${r.direction === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                            {r.direction === "LONG" ? "L" : "S"}
                          </span>
                          <Link href={`/market/${r.symbol}`} className="font-bold text-[13px] hover:text-purple-400">{r.symbol}</Link>
                          {r.isLive && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">LIVE</span>}
                          {r.orphan && <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/20 text-red-300 font-bold" title="No journal entry — not managed by the bot">ORPHAN</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        {r.strategy && <span className={`text-[10px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>{getStratName(r.strategy, strategies)}</span>}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[12px] text-muted-foreground">${formatPrice(r.entry)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-[12px]">{r.mark ? `$${formatPrice(r.mark)}` : "—"}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-[11px] text-muted-foreground/70">{r.notional != null ? `$${r.notional.toFixed(0)}` : "—"}</td>
                      <td className={`py-2.5 px-2 text-right font-mono font-bold text-[12px] ${up ? "text-emerald-400" : "text-red-400"}`}>
                        {r.pnlUsd != null && <div>{fmtUsd(r.pnlUsd)}</div>}
                        {r.pnlPct != null && <div className="text-[10px] opacity-70">{up ? "+" : ""}{r.pnlPct.toFixed(2)}%</div>}
                        {r.pnlUsd == null && r.pnlPct == null && "—"}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {r.isLive ? (
                          protectedOk ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400" title={`SL ${r.protection?.stop} · TP ${r.protection?.takeProfit ?? "—"}`}>
                              <Shield className="w-3 h-3" /> {formatPrice(r.protection!.stop!)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400" title="No stop order resting on the exchange">
                              <ShieldAlert className="w-3 h-3" /> none
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] font-mono text-red-400/60">{r.target.sl ? formatPrice(r.target.sl) : "—"}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-[10px] hidden md:table-cell">
                        {r.funding != null
                          ? <span className={r.funding >= 0 ? "text-emerald-400/70" : "text-red-400/70"}>{fmtUsd(r.funding)}</span>
                          : <span className="text-muted-foreground/25">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[11px] text-muted-foreground/60">{r.opened ? heldFor(r.opened) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ═══ EQUITY CURVE ═══ */}
      <Card className="border-border/20 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold">Equity Curve</h2>
            <span className="text-[10px] text-muted-foreground/50">cumulative R · live vs paper benchmark</span>
          </div>
          <div className="flex items-center bg-card/40 border border-border/30 rounded-lg p-0.5">
            {(["both", "live", "paper"] as const).map(m => (
              <button key={m} onClick={() => setCurveMode(m)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium capitalize transition-all ${
                  curveMode === m ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground"}`}>{m}</button>
            ))}
          </div>
        </div>
        {equityData.length < 2 ? (
          <div className="h-[190px] flex items-center justify-center text-center">
            <div>
              <LineChart className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/40">Curve appears after the first closed trade</p>
            </div>
          </div>
        ) : (
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.18} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="paperGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.08} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.25)" }} tickLine={false} axisLine={false} tickFormatter={v => `${v > 0 ? "+" : ""}${v}R`} />
                <Tooltip contentStyle={{ backgroundColor: "rgba(15,15,20,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px", padding: "6px 10px" }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}
                  formatter={(v: number, n: string) => [`${v > 0 ? "+" : ""}${v.toFixed(2)}R`, n === "live" ? "Live" : "Paper"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="plainline" />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                {curveMode !== "live" && <Area type="monotone" dataKey="paper" name="Paper" stroke="#22c55e" strokeWidth={1.25} strokeDasharray="4 3" fill="url(#paperGrad)" dot={false} isAnimationActive={false} />}
                {curveMode !== "paper" && <Area type="monotone" dataKey="live" name="Live" stroke="#f59e0b" strokeWidth={2} fill="url(#liveGrad)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} isAnimationActive={false} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ═══ STRATEGY + RECENT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold">By Strategy</h2>
              <span className="text-[10px] text-muted-foreground/50">{live.closed > 0 ? "live" : "paper"}</span>
            </div>
            <Link href="/compare" className="text-[11px] text-muted-foreground hover:text-purple-400 flex items-center gap-0.5">
              Compare <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {perStrategy.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 py-8 text-center">No data yet</p>
          ) : (
            <div className="divide-y divide-border/10">
              {perStrategy.map(({ s, m }) => {
                const sc = getStratColor(s.id);
                return (
                  <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold truncate ${sc.text}`}>{s.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-card/60 text-muted-foreground/60 font-mono">{s.interval}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] shrink-0">
                      <span className="text-muted-foreground/60">{m.wins}W/{m.losses}L</span>
                      <span className="text-muted-foreground">PF <span className={m.profitFactor >= 1 ? "text-emerald-400" : "text-red-400"}>{m.scored ? fmtPF(m.profitFactor) : "—"}</span></span>
                      <span className={`font-mono font-bold ${m.sumR >= 0 ? "text-emerald-400" : "text-red-400"}`}>{m.scored ? fmtR(m.sumR) : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="border-border/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">Recent Closes</h2>
            </div>
            <Link href="/paper" className="text-[11px] text-muted-foreground hover:text-purple-400 flex items-center gap-0.5">
              All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {recentClosed.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 py-8 text-center">Nothing closed yet</p>
          ) : (
            <div className="divide-y divide-border/10">
              {recentClosed.map(t => {
                const sc = getStratColor(t.strategy);
                const r = t.risk_usd && t.risk_usd > 0 && t.pnl_usd != null ? t.pnl_usd / t.risk_usd : null;
                const win = t.outcome === "win";
                return (
                  <div key={t.id} className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-card/25 transition-colors">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${win ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                      {win ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold">{t.symbol}</span>
                        {t.mode === "live" && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">LIVE</span>}
                        <span className={`text-[9px] px-1 py-0.5 rounded ${sc.bg} ${sc.text}`}>{getStratName(t.strategy, strategies)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/45">{new Date(t.closed_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.outcome}</span>
                    </div>
                    <span className={`text-xs font-bold font-mono ${(r ?? t.pnl_pct ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {r != null ? `${r > 0 ? "+" : ""}${r.toFixed(2)}R` : t.pnl_pct != null ? `${t.pnl_pct > 0 ? "+" : ""}${t.pnl_pct}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Paper engine control — the benchmark, kept out of the way */}
      <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground/60">
        <span>
          Paper benchmark: {paper.closed} closed · {paper.scored ? fmtR(paper.sumR) : "—"}
          {cap && <> · €{cap.balance.toFixed(2)}</>}
        </span>
        <button onClick={() => (paperRunning ? paperStop : paperStart).mutate()}
          className="hover:text-foreground transition-colors">
          {paperRunning ? "Stop paper engine" : "Start paper engine"}
        </button>
      </div>
    </div>
  );
}

function BigStat({ label, value, sub, tone, icon, reference }: {
  label: string; value: string; sub?: string; tone?: string; icon?: React.ReactNode; reference?: string;
}) {
  return (
    <Card className="border-border/20 p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">{label}</span>
        {icon}
      </div>
      <span className={`text-[22px] leading-tight font-bold font-mono block ${tone ?? "text-foreground"}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground/55 mt-0.5 block">{sub}</span>}
      {reference && <span className="text-[10px] text-muted-foreground/35 mt-1 block border-t border-border/10 pt-1">{reference}</span>}
    </Card>
  );
}
