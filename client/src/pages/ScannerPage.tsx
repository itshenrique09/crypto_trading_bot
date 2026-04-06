import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Flame, Zap } from "lucide-react";
import { formatPrice, formatCompact, formatPercent, getChangeColor } from "@/lib/utils";
import { useState } from "react";
import MiniSparkline from "@/components/MiniSparkline";
import type { CoinData } from "@/lib/types";

export default function ScannerPage() {
  const [search, setSearch] = useState("");

  const { data: coins, isLoading } = useQuery<CoinData[]>({
    queryKey: ["/api/market"],
    queryFn: async () => (await apiRequest("GET", "/api/market")).json(),
    refetchInterval: 60000,
  });

  const topVolume = coins ? coins.slice(0, 20) : [];
  const topMovers = coins
    ? [...coins].sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0)).slice(0, 6)
    : [];
  const hotCoins = coins
    ? [...coins].filter(c => Math.abs(c.change1h || 0) > 1).sort((a, b) => Math.abs(b.change1h || 0) - Math.abs(a.change1h || 0)).slice(0, 6)
    : [];

  const filtered = search
    ? coins?.filter(c =>
        c.symbol.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header + Search */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Market</h1>
          <p className="text-xs text-muted-foreground">Top coins by volume and momentum — MEXC data</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search coin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm bg-card border border-border/50 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 placeholder:text-muted-foreground/40 transition-all"
          />
        </div>
      </div>

      {/* Search Results Dropdown */}
      {filtered && filtered.length > 0 && (
        <Card className="border-border/50 p-1">
          {filtered.slice(0, 8).map(coin => (
            <Link key={coin.symbol} href={`/market/${coin.symbol}`} className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-card/60 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{coin.symbol}</span>
                  <span className="text-xs text-muted-foreground">{coin.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">${formatPrice(coin.price)}</span>
                  <span className={`text-xs font-mono ${getChangeColor(coin.change24h)}`}>{formatPercent(coin.change24h)}</span>
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                </div>
            </Link>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Table — 3 cols */}
        <div className="lg:col-span-3">
          <Card className="border-border/40 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Top Volume</h2>
              <span className="text-xs text-muted-foreground">{coins?.length ?? 0} coins</span>
            </div>
            {isLoading ? (
              <div className="p-4 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/20 text-xs text-muted-foreground">
                      <th className="text-left py-2.5 px-4 sm:px-5 font-medium">#</th>
                      <th className="text-left py-2.5 px-2 font-medium">Coin</th>
                      <th className="text-right py-2.5 px-3 font-medium">Price</th>
                      <th className="text-right py-2.5 px-3 font-medium">24h</th>
                      <th className="text-right py-2.5 px-3 font-medium hidden sm:table-cell">Volume</th>
                      <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell">High / Low</th>
                      <th className="text-center py-2.5 px-3 font-medium hidden md:table-cell">7d</th>
                      <th className="py-2.5 px-3 sm:px-5"></th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {topVolume.map((coin, i) => (
                      <tr key={coin.symbol} className="border-b border-border/10 hover:bg-card/30 transition-colors">
                        <td className="py-2.5 px-4 sm:px-5 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{coin.symbol}</span>
                            <span className="text-muted-foreground text-xs hidden sm:inline">{coin.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">${formatPrice(coin.price)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-medium ${getChangeColor(coin.change24h)}`}>{formatPercent(coin.change24h)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground hidden sm:table-cell">${formatCompact(coin.volume24h)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                          <span className="text-emerald-400/70">${formatPrice(coin.high24h)}</span>
                          <span className="mx-0.5">/</span>
                          <span className="text-red-400/70">${formatPrice(coin.low24h)}</span>
                        </td>
                        <td className="py-2.5 px-3 hidden md:table-cell">
                          <div className="flex justify-center">
                            <MiniSparkline data={coin.sparkline} color={(coin.change7d || 0) >= 0 ? "#22c55e" : "#ef4444"} />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 sm:px-5 text-right">
                          <Link href={`/market/${coin.symbol}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors">
                              <Eye className="w-3.5 h-3.5" /> Analyze
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar — 1 col */}
        <div className="space-y-6">
          {/* Biggest Movers */}
          <Card className="border-border/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold">24h Movers</span>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <div className="space-y-1.5">
                {topMovers.map(coin => (
                  <Link key={coin.symbol} href={`/market/${coin.symbol}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-card/40 transition-colors">
                      <div>
                        <span className="text-sm font-semibold">{coin.symbol}</span>
                        <span className="text-xs text-muted-foreground font-mono ml-2">${formatPrice(coin.price)}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md ${
                        (coin.change24h || 0) > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {formatPercent(coin.change24h)}
                      </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Moving Now */}
          <Card className="border-border/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold">Moving Now</span>
              <span className="text-xs text-muted-foreground">1h &gt;1%</span>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : hotCoins.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No coins moving &gt;1% right now</p>
            ) : (
              <div className="space-y-1.5">
                {hotCoins.map(coin => (
                  <Link key={coin.symbol} href={`/market/${coin.symbol}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-card/40 transition-colors">
                      <span className="text-sm font-semibold">{coin.symbol}</span>
                      <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md ${
                        (coin.change1h || 0) > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {formatPercent(coin.change1h)}
                      </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Analyze */}
          <Card className="border-border/40 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold">Quick Analyze</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "ADA", "LINK", "NEAR", "SUI", "ARB"].map(sym => (
                <Link key={sym} href={`/market/${sym}`} className="flex items-center justify-center p-2 rounded-md bg-card/30 border border-border/20 hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors">
                    <span className="text-xs font-bold">{sym}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
