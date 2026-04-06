import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Activity, BarChart3, Zap,
  Search, Eye, ArrowRight, BookOpen, Flame, Volume2,
  Target, Clock
} from "lucide-react";
import { formatPrice, formatCompact, formatPercent, getChangeColor } from "@/lib/utils";
import { useState } from "react";
import MiniSparkline from "@/components/MiniSparkline";

interface CoinData {
  symbol: string;
  name: string;
  price: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number;
  volume24h: number;
  sparkline: number[];
  image: string;
  high24h: number;
  low24h: number;
  rank: number;
}

interface JournalEntry {
  id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  outcome: string;
  pnl_pct: number | null;
  followed: string;
  created_at: string;
  mode: string;
}

export default function Dashboard() {
  const [search, setSearch] = useState("");

  const { data: coins, isLoading } = useQuery<CoinData[]>({
    queryKey: ["/api/market"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/market");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: journal = [] } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/journal");
      return res.json();
    },
  });

  // Derived data for scanner — sorted by 24h volume (already sorted from API)
  const topVolume = coins ? coins.slice(0, 10) : [];

  const topMovers = coins
    ? [...coins]
        .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
        .slice(0, 6)
    : [];

  const hotCoins = coins
    ? [...coins]
        .filter(c => Math.abs(c.change1h || 0) > 1)
        .sort((a, b) => Math.abs(b.change1h || 0) - Math.abs(a.change1h || 0))
        .slice(0, 6)
    : [];

  const openTrades = (journal as JournalEntry[]).filter(e => e.outcome === "open");
  const recentClosed = (journal as JournalEntry[]).filter(e => e.outcome !== "open").slice(0, 5);

  const filtered = search
    ? coins?.filter(c =>
        c.symbol.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="CryptoTrader Pro">
              <rect x="2" y="2" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="2" className="text-emerald-400"/>
              <path d="M8 22L13 14L18 18L24 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"/>
              <circle cx="24" cy="10" r="2.5" fill="currentColor" className="text-emerald-400"/>
            </svg>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-foreground">CryptoTrader Pro</h1>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Signal Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                data-testid="input-search"
                type="text"
                placeholder="Search & analyze..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-card border border-border rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-muted-foreground/50"
              />
            </div>
            <Link href="/journal">
              <a className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-colors">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Journal</span>
              </a>
            </Link>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">LIVE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Search Results Overlay */}
      {filtered && filtered.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 pt-2">
          <Card className="border-border/50 bg-card/80 p-2">
            <p className="text-[10px] text-muted-foreground mb-1 px-2">Search results — click to analyze</p>
            {filtered.slice(0, 8).map(coin => (
              <Link key={coin.symbol} href={`/analyze/${coin.symbol}`}>
                <a className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-background/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {coin.image && <img src={coin.image} alt="" className="w-4 h-4 rounded-full" />}
                    <span className="text-xs font-semibold">{coin.symbol}</span>
                    <span className="text-[10px] text-muted-foreground">{coin.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono">${formatPrice(coin.price)}</span>
                    <span className={`text-[10px] font-mono ${getChangeColor(coin.change24h)}`}>{formatPercent(coin.change24h)}</span>
                    <Eye className="w-3 h-3 text-emerald-400" />
                  </div>
                </a>
              </Link>
            ))}
          </Card>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">

        {/* Open Trades (if any) */}
        {openTrades.length > 0 && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Open Trades</span>
              <span className="text-[10px] text-muted-foreground">{openTrades.length} active</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {openTrades.map(t => (
                <Link key={t.id} href="/journal">
                  <a className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs ${
                    t.direction === "LONG"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}>
                    <span className="font-bold">{t.symbol}</span>
                    <span className="text-[10px]">{t.direction}</span>
                    <span className="font-mono">${formatPrice(t.entry_price)}</span>
                    {t.followed === "pending" && <Badge variant="outline" className="text-[8px] py-0 px-1 border-yellow-500/40 text-yellow-400">PENDING</Badge>}
                  </a>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: Volume Scanner + Hot Right Now */}
          <div className="lg:col-span-2 space-y-4">

            {/* High Volume / Mcap Ratio — best for trading */}
            <Card className="border-border/50 bg-card/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <h2 className="text-xs font-semibold">Top Volume (MEXC)</h2>
                </div>
                <span className="text-[10px] text-muted-foreground">Sorted by 24h volume — most active coins</span>
              </div>
              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="text-left py-2 px-4 font-medium">Coin</th>
                        <th className="text-right py-2 px-3 font-medium">Price</th>
                        <th className="text-right py-2 px-3 font-medium">24h</th>
                        <th className="text-right py-2 px-3 font-medium">Volume 24h</th>
                        <th className="text-right py-2 px-3 font-medium hidden sm:table-cell">High/Low</th>
                        <th className="text-center py-2 px-3 font-medium hidden sm:table-cell">7d</th>
                        <th className="text-center py-2 px-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {topVolume.map((coin) => (
                          <tr key={coin.symbol} className="border-b border-border/20 hover:bg-card/80 transition-colors group">
                            <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{coin.symbol}</span>
                                <span className="text-muted-foreground text-[10px] hidden sm:inline">{coin.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">${formatPrice(coin.price)}</td>
                            <td className={`py-2 px-3 text-right font-mono ${getChangeColor(coin.change24h)}`}>{formatPercent(coin.change24h)}</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">${formatCompact(coin.volume24h)}</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground hidden sm:table-cell text-[10px]">
                              <span className="text-emerald-400/70">${formatPrice(coin.high24h)}</span>
                              <span className="text-muted-foreground mx-0.5">/</span>
                              <span className="text-red-400/70">${formatPrice(coin.low24h)}</span>
                            </td>
                            <td className="py-2 px-3 hidden sm:table-cell">
                              <div className="flex justify-center">
                                <MiniSparkline data={coin.sparkline} color={(coin.change7d || 0) >= 0 ? "#22c55e" : "#ef4444"} />
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Link href={`/analyze/${coin.symbol}`}>
                                <button className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                                  <Eye className="w-3 h-3" />
                                  Analyze
                                </button>
                              </Link>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* 24h Biggest Movers */}
            <Card className="border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold">24h Biggest Movers</span>
              </div>
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {topMovers.map(coin => (
                    <Link key={coin.symbol} href={`/analyze/${coin.symbol}`}>
                      <a className="flex items-center gap-2.5 p-2.5 rounded-md bg-background/50 border border-border/30 hover:border-border/60 transition-colors">
                        {coin.image && <img src={coin.image} alt="" className="w-5 h-5 rounded-full" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{coin.symbol}</span>
                            <span className={`text-[10px] font-mono font-bold ${getChangeColor(coin.change24h)}`}>
                              {formatPercent(coin.change24h)}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">${formatPrice(coin.price)}</span>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT: Hot Now + Recent Journal */}
          <div className="space-y-4">

            {/* Moving Right Now (1h) */}
            <Card className="border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-semibold">Moving Now</span>
                <span className="text-[10px] text-muted-foreground">1h &gt; 1%</span>
              </div>
              {isLoading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : hotCoins.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No coins moving &gt;1% in the last hour</p>
              ) : (
                <div className="space-y-1.5">
                  {hotCoins.map(coin => (
                    <Link key={coin.symbol} href={`/analyze/${coin.symbol}`}>
                      <a className="flex items-center justify-between p-2 rounded-md hover:bg-background/50 transition-colors">
                        <div className="flex items-center gap-2">
                          {coin.image && <img src={coin.image} alt="" className="w-4 h-4 rounded-full" />}
                          <span className="text-xs font-semibold">{coin.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">${formatPrice(coin.price)}</span>
                          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                            (coin.change1h || 0) > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                          }`}>
                            {formatPercent(coin.change1h)}
                          </span>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Analyze — Popular coins */}
            <Card className="border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold">Quick Analyze</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "ADA", "LINK", "NEAR", "SUI", "ARB"].map(sym => {
                  const coin = coins?.find(c => c.symbol === sym);
                  return (
                    <Link key={sym} href={`/analyze/${sym}`}>
                      <a className="flex flex-col items-center gap-1 p-2 rounded-md bg-background/50 border border-border/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors">
                        {coin?.image && <img src={coin.image} alt="" className="w-4 h-4 rounded-full" />}
                        <span className="text-[10px] font-bold">{sym}</span>
                      </a>
                    </Link>
                  );
                })}
              </div>
            </Card>

            {/* Recent Journal Activity */}
            <Card className="border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold">Recent Trades</span>
                </div>
                <Link href="/journal">
                  <a className="text-[10px] text-purple-400 hover:text-purple-300">View all</a>
                </Link>
              </div>
              {recentClosed.length === 0 && openTrades.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No trades logged yet. Analyze a coin and click "Log Signal" to start.</p>
              ) : (
                <div className="space-y-1.5">
                  {[...openTrades.slice(0, 3), ...recentClosed.slice(0, 3)].slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                          t.direction === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                        }`}>{t.direction === "LONG" ? "L" : "S"}</span>
                        <span className="text-[10px] font-semibold">{t.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.outcome === "open" ? (
                          <span className="text-[9px] text-yellow-400">OPEN</span>
                        ) : t.pnl_pct != null ? (
                          <span className={`text-[10px] font-mono font-bold ${t.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {t.pnl_pct > 0 ? "+" : ""}{t.pnl_pct}%
                          </span>
                        ) : (
                          <span className={`text-[9px] ${t.outcome === "win" ? "text-emerald-400" : "text-red-400"}`}>{t.outcome.toUpperCase()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
