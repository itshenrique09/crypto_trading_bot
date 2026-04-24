import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Zap, Activity, ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { formatPrice, formatCompact, formatPercent, getChangeColor } from "@/lib/utils";
import { useState } from "react";
import MiniSparkline from "@/components/MiniSparkline";
import type { CoinData, JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor } from "@/lib/types";

export default function ScannerPage() {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: coins, isLoading } = useQuery<CoinData[]>({
    queryKey: ["/api/market"],
    queryFn: async () => (await apiRequest("GET", "/api/market")).json(),
    refetchInterval: 60000,
  });

  // Active signals = open paper positions (the bot's live bets)
  const { data: journal } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => (await apiRequest("GET", "/api/journal")).json(),
    refetchInterval: 30000,
  });

  const { data: livePrices } = useQuery<PaperPrice[]>({
    queryKey: ["/api/paper/prices"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/prices")).json(),
    refetchInterval: 10000,
  });

  const { data: strategies } = useQuery<StrategyInfo[]>({
    queryKey: ["/api/strategies"],
    queryFn: async () => (await apiRequest("GET", "/api/strategies")).json(),
    staleTime: 5 * 60_000,
  });

  const stratName = (id: string) =>
    strategies?.find(s => s.id === id)?.name ?? id;

  const openPaper = (journal ?? []).filter(e => e.mode === "paper" && e.outcome === "open");
  const priceById = new Map((livePrices ?? []).map(p => [p.id, p]));

  // Sort: biggest absolute PnL first → draws eye to what's moving
  const activeSignals = openPaper
    .map(t => ({ trade: t, live: priceById.get(t.id) }))
    .sort((a, b) => Math.abs(b.live?.unrealizedPnl ?? 0) - Math.abs(a.live?.unrealizedPnl ?? 0));

  const hotCoins = coins
    ? [...coins].filter(c => Math.abs(c.change1h || 0) > 1).sort((a, b) => Math.abs(b.change1h || 0) - Math.abs(a.change1h || 0)).slice(0, 6)
    : [];

  const topVolume = coins ? coins.slice(0, 25) : [];

  const filtered = search
    ? coins?.filter(c =>
        c.symbol.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px]">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Market Overview</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {coins?.length ?? 0} coins tracked · MEXC data · updated every 60s
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search coin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-card/50 border border-border/30 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/40 placeholder:text-muted-foreground/30 transition-all"
          />
        </div>
      </div>

      {/* Search Results */}
      {filtered && filtered.length > 0 && (
        <Card className="border-border/30 p-1">
          {filtered.slice(0, 8).map(coin => (
            <Link key={coin.symbol} href={`/market/${coin.symbol}`} className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-card/60 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{coin.symbol}</span>
                <span className="text-xs text-muted-foreground/60">{coin.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono">${formatPrice(coin.price)}</span>
                <span className={`text-xs font-mono font-medium ${getChangeColor(coin.change24h)}`}>{formatPercent(coin.change24h)}</span>
                <Eye className="w-3.5 h-3.5 text-purple-400/60" />
              </div>
            </Link>
          ))}
        </Card>
      )}

      {/* ── ACTIVE SIGNALS — leads the page: what the bot is trading NOW ── */}
      <Card className="border-border/30 overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b border-border/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold">Active Signals</h2>
            <span className="text-[10px] text-muted-foreground/50 ml-1">
              {activeSignals.length === 0 ? "no open positions" : `${activeSignals.length} open`}
            </span>
          </div>
          <Link href="/paper" className="text-[11px] text-purple-400/80 hover:text-purple-300 transition-colors flex items-center gap-1">
            Paper <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {activeSignals.length === 0 ? (
          <div className="px-4 md:px-5 py-8 text-center">
            <p className="text-[12px] text-muted-foreground/60">
              Bot is scanning. No strategy has fired yet — signals appear here when trades open.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-px bg-border/10">
            {activeSignals.map(({ trade, live }) => {
              const color = getStratColor(trade.strategy);
              const isLong = trade.direction === "LONG";
              const pnl = live?.unrealizedPnl ?? 0;
              const progress = live?.progressPct ?? 0;
              const slProgress = live?.slProgress ?? 0;
              return (
                <button
                  key={trade.id}
                  onClick={() => setLocation(`/market/${trade.symbol}`)}
                  className="group text-left bg-card/40 hover:bg-card/70 transition-colors p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight">{trade.symbol}</span>
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${isLong ? "text-emerald-400" : "text-red-400"}`}>
                      {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {trade.direction}
                    </span>
                  </div>
                  <div className={`inline-flex self-start px-1.5 py-0.5 rounded text-[9px] font-semibold ${color.bg} ${color.text} border ${color.border}`}>
                    {stratName(trade.strategy)}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-muted-foreground/60 font-mono">
                      ${formatPrice(live?.currentPrice ?? trade.entry_price)}
                    </span>
                    <span className={`text-[12px] font-mono font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                    </span>
                  </div>
                  {/* Progress bar — green toward TP, red toward SL */}
                  <div className="h-1 bg-border/20 rounded-full overflow-hidden relative">
                    {progress > 0 ? (
                      <div
                        className="h-full bg-emerald-400/70 transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    ) : slProgress > 0 ? (
                      <div
                        className="h-full bg-red-400/70 transition-all"
                        style={{ width: `${Math.min(100, slProgress)}%` }}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Main Table — 3 cols */}
        <div className="xl:col-span-3">
          <Card className="border-border/20 overflow-hidden">
            <div className="px-4 md:px-5 py-3 border-b border-border/20 flex items-center justify-between">
              <h2 className="text-sm font-bold">Top by Volume</h2>
              <span className="text-[10px] text-muted-foreground/60">{coins?.length ?? 0} coins</span>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/15 text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                      <th className="text-left py-2.5 px-4 md:px-5 font-medium w-8">#</th>
                      <th className="text-left py-2.5 px-2 font-medium">Coin</th>
                      <th className="text-right py-2.5 px-3 font-medium">Price</th>
                      <th className="text-right py-2.5 px-3 font-medium">1h</th>
                      <th className="text-right py-2.5 px-3 font-medium">24h</th>
                      <th className="text-right py-2.5 px-3 font-medium hidden sm:table-cell">Volume</th>
                      <th className="text-right py-2.5 px-3 font-medium hidden xl:table-cell">Funding</th>
                      <th className="text-right py-2.5 px-3 font-medium hidden lg:table-cell">High / Low</th>
                      <th className="text-center py-2.5 px-3 font-medium hidden lg:table-cell">7d</th>
                      <th className="py-2.5 px-3 md:px-5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {topVolume.map((coin, i) => (
                      <tr
                        key={coin.symbol}
                        onClick={() => setLocation(`/market/${coin.symbol}`)}
                        className="border-b border-border/8 hover:bg-card/20 transition-colors group cursor-pointer"
                      >
                        <td className="py-2.5 px-4 md:px-5 text-[11px] text-muted-foreground/40 font-mono">{i + 1}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[13px]">{coin.symbol}</span>
                            <span className="text-muted-foreground/40 text-xs hidden sm:inline">{coin.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[13px]">${formatPrice(coin.price)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono text-xs ${getChangeColor(coin.change1h)}`}>{formatPercent(coin.change1h)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono text-xs font-medium ${getChangeColor(coin.change24h)}`}>{formatPercent(coin.change24h)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground/60 hidden sm:table-cell">${formatCompact(coin.volume24h)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] hidden xl:table-cell">
                          {coin.fundingRate != null ? (
                            <span className={
                              coin.fundingRate > 0.0005 ? "text-red-400 font-medium" :
                              coin.fundingRate < -0.0005 ? "text-emerald-400 font-medium" :
                              "text-muted-foreground/50"
                            }>
                              {coin.fundingRate >= 0 ? "+" : ""}{(coin.fundingRate * 100).toFixed(4)}%
                            </span>
                          ) : <span className="text-muted-foreground/20">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground/50 hidden lg:table-cell">
                          <span className="text-emerald-400/50">{formatPrice(coin.high24h)}</span>
                          <span className="mx-0.5 text-muted-foreground/20">/</span>
                          <span className="text-red-400/50">{formatPrice(coin.low24h)}</span>
                        </td>
                        <td className="py-2.5 px-3 hidden lg:table-cell">
                          <div className="flex justify-center">
                            <MiniSparkline data={coin.sparkline} color={(coin.change7d || 0) >= 0 ? "#22c55e" : "#ef4444"} />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 md:px-5 text-right">
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-purple-400 transition-colors inline-block" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar — compacted: Quick Analyze + Moving Now only */}
        <div className="space-y-5">
          {/* Quick Analyze — kept because it's fast navigation, not decorative */}
          <Card className="border-border/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold">Quick Analyze</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "ADA", "LINK", "NEAR", "SUI", "ARB"].map(sym => (
                <Link key={sym} href={`/market/${sym}`} className="flex items-center justify-center p-2 rounded-md bg-card/30 border border-border/15 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all">
                  <span className="text-[11px] font-bold">{sym}</span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Moving Now — volatility often precedes signals, keep it */}
          <Card className="border-border/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold">Moving Now</span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto">1h &gt;1%</span>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : hotCoins.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/40 py-4 text-center">Calm market — no 1h moves &gt;1%</p>
            ) : (
              <div className="space-y-0.5">
                {hotCoins.map(coin => (
                  <Link key={coin.symbol} href={`/market/${coin.symbol}`} className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-card/40 transition-colors group">
                    <span className="text-xs font-bold group-hover:text-purple-400 transition-colors">{coin.symbol}</span>
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                      (coin.change1h || 0) > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {formatPercent(coin.change1h)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
