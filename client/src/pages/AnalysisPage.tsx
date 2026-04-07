import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useRoute, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, TrendingUp, TrendingDown, Shield, Target,
  AlertTriangle, Activity, BarChart3, Gauge, Layers,
  ChevronDown, ChevronUp, Minus, Zap, Clock, DollarSign,
  FlaskConical, CheckCircle2, XCircle, Timer, Send
} from "lucide-react";
import {
  formatPrice, formatCompact, formatPercent, getChangeColor,
  getSignalColor, getSignalBg, getBiasColor, getBiasBg
} from "@/lib/utils";
import { getStratColor } from "@/lib/types";
import PriceChart from "@/components/PriceChart";
import ConfluenceMeter from "@/components/ConfluenceMeter";

interface StrategySignal {
  id: string;
  name: string;
  signal: string;
  score: number;
  confidence: number;
  reason: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  trend?: string;
  rsi7?: number;
  bbPercentB?: number;
}

export default function AnalysisPage() {
  const [, marketParams] = useRoute("/market/:symbol");
  const [, analyzeParams] = useRoute("/analyze/:symbol");
  const symbol = marketParams?.symbol || analyzeParams?.symbol || "BTC";
  const [backtestTab, setBacktestTab] = useState<"confluence-swing" | "smc" | "break-retest">("confluence-swing");
  const [backtestRequested, setBacktestRequested] = useState(false);
  const [signalLogged, setSignalLogged] = useState(false);

  const logSignalMutation = useMutation({
    mutationFn: async (signal: any) => {
      const res = await apiRequest("POST", "/api/journal/from-signal", { symbol, signal });
      return res.json();
    },
    onSuccess: () => setSignalLogged(true),
  });

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ["/api/analyze", symbol],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/analyze/${symbol}`);
      return res.json();
    },
  });

  const { data: coinInfo } = useQuery({
    queryKey: ["/api/coin", symbol],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/coin/${symbol}?days=30`);
      return res.json();
    },
  });

  // Multi-strategy signals
  const { data: multiSignals } = useQuery({
    queryKey: ["/api/signals", symbol],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/signals/${symbol}`);
      return res.json();
    },
  });

  // Backtests — one per strategy
  const backtestEndpoints: Record<string, string> = {
    "confluence-swing": `/api/backtest/${symbol}`,
    "smc": `/api/backtest-smc/${symbol}`,
    "break-retest": `/api/backtest-breakretest/${symbol}`,
  };

  const { data: backtest, isLoading: backtestLoading } = useQuery({
    queryKey: ["/api/backtest", backtestTab, symbol],
    queryFn: async () => {
      const res = await apiRequest("GET", backtestEndpoints[backtestTab]);
      return res.json();
    },
    enabled: backtestRequested,
  });

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <Card className="p-8 text-center max-w-md border-border/30">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Failed to analyze {symbol}. API rate limit may apply.</p>
          <Link href="/market" className="mt-4 text-xs text-purple-400 hover:underline inline-block">Back to market</Link>
        </Card>
      </div>
    );
  }

  const signal = analysis?.signal;
  const indicators = analysis?.indicators;
  const timeframes = analysis?.timeframes;
  const combined = analysis?.combined;
  const stratSignals: StrategySignal[] = multiSignals?.strategies || [];

  return (
    <div>
      {/* Header */}
      <header className="border-b border-border/30 sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/market">
              <button className="p-1.5 rounded hover:bg-card transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              {coinInfo?.image && <img src={coinInfo.image} alt="" className="w-6 h-6 rounded-full" />}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold">{symbol.toUpperCase()}</h1>
                  {coinInfo?.name && <span className="text-xs text-muted-foreground">{coinInfo.name}</span>}
                  {coinInfo?.rank && <Badge variant="outline" className="text-[9px] py-0 px-1">#{coinInfo.rank}</Badge>}
                </div>
                {coinInfo?.price && (
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold font-mono">${formatPrice(coinInfo.price)}</span>
                    <span className={`text-xs font-mono ${getChangeColor(coinInfo.change24h)}`}>
                      {formatPercent(coinInfo.change24h)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {signal && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${getSignalBg(signal.type)}`}>
                {(signal.type === "STRONG_BUY" || signal.type === "BUY") ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : signal.type === "HOLD" ? (
                  <Minus className="w-4 h-4 text-yellow-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm font-bold ${getSignalColor(signal.type)}`}>
                  {signal.type.replace("_", " ")}
                </span>
                <span className="text-xs text-muted-foreground">
                  Score: {signal.confluenceScore}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-[400px] w-full rounded-lg" />
              <Skeleton className="h-[200px] w-full rounded-lg" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full rounded-lg" />
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Chart + Market Stats */}
            <div className="lg:col-span-2 space-y-4">

              {/* ── Multi-Strategy Signals ─────────────────────── */}
              {stratSignals.length > 0 && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold">Strategy Signals</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto">All strategies · 4H candles</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {stratSignals.map(s => {
                      const sc = getStratColor(s.id);
                      const isActive = s.signal !== "HOLD";
                      return (
                        <div key={s.id} className={`rounded-lg border p-3 transition-all ${
                          isActive ? `${getSignalBg(s.signal)} border-opacity-60` : "border-border/20 bg-card/20"
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.text}`}>{s.name}</span>
                            <span className="text-[10px] text-muted-foreground/50">{s.confidence}%</span>
                          </div>
                          <p className={`text-sm font-bold mb-1 ${getSignalColor(s.signal)}`}>
                            {s.signal.replace("_", " ")}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{s.reason || "No signal conditions met"}</p>
                          {isActive && s.entry && s.stopLoss && s.takeProfit && (
                            <div className="mt-2 pt-2 border-t border-border/15 space-y-0.5 text-[10px] font-mono">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground/50">Entry</span>
                                <span>${formatPrice(s.entry)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-400/50">SL</span>
                                <span className="text-red-400">${formatPrice(s.stopLoss)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-emerald-400/50">TP</span>
                                <span className="text-emerald-400">${formatPrice(s.takeProfit)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* ── v2 Swing: 4H Signal + 1D Trend Filter ──────── */}
              {(timeframes || isLoading) && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold">v2 Swing — 4H Signal + 1D Trend Filter</span>
                    {combined && (
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {combined.trendAligned
                          ? <span className="text-emerald-400">TREND ALIGNED</span>
                          : <span className="text-red-400">TREND CONFLICT</span>
                        }
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* 4H Signal Card */}
                    {timeframes?.["4h"] && (
                      <div className={`rounded-md border-2 p-3 ${getSignalBg(timeframes["4h"].signalType)} border-cyan-500/40`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">{timeframes["4h"].label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{timeframes["4h"].confluenceScore > 0 ? "+" : ""}{timeframes["4h"].confluenceScore}</span>
                        </div>
                        <p className={`text-xs font-bold ${getSignalColor(timeframes["4h"].signalType)}`}>
                          {timeframes["4h"].signalType.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 capitalize">{timeframes["4h"].trend.replace("_", " ")}</p>
                        <div className="mt-2 h-1 rounded-full bg-border/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${timeframes["4h"].confluenceScore >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.abs(timeframes["4h"].confluenceScore) * 10}%`, marginLeft: timeframes["4h"].confluenceScore < 0 ? `${100 - Math.abs(timeframes["4h"].confluenceScore) * 10}%` : "0" }}
                          />
                        </div>
                      </div>
                    )}
                    {/* 1D Trend Card */}
                    {timeframes?.["1d"] && (
                      <div className={`rounded-md border p-3 ${getSignalBg(timeframes["1d"].signalType)}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{timeframes["1d"].label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{timeframes["1d"].confluenceScore > 0 ? "+" : ""}{timeframes["1d"].confluenceScore}</span>
                        </div>
                        <p className={`text-xs font-bold ${getSignalColor(timeframes["1d"].signalType)}`}>
                          {timeframes["1d"].signalType.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Daily trend: <span className={combined?.dailyTrend === "up" ? "text-emerald-400" : combined?.dailyTrend === "down" ? "text-red-400" : "text-muted-foreground"}>{combined?.dailyTrend?.toUpperCase()}</span>
                        </p>
                        <div className="mt-2 h-1 rounded-full bg-border/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${timeframes["1d"].confluenceScore >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.abs(timeframes["1d"].confluenceScore) * 10}%`, marginLeft: timeframes["1d"].confluenceScore < 0 ? `${100 - Math.abs(timeframes["1d"].confluenceScore) * 10}%` : "0" }}
                          />
                        </div>
                      </div>
                    )}
                    {/* Final Signal Card */}
                    {combined && (
                      <div className={`rounded-md border p-3 ${getSignalBg(combined.signal)}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Final Signal</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{combined.score > 0 ? "+" : ""}{combined.score}</span>
                        </div>
                        <p className={`text-xs font-bold ${getSignalColor(combined.signal)}`}>
                          {combined.signal.replace("_", " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {combined.trendAligned ? `${combined.confidence}% confidence` : "Filtered by daily trend"}
                        </p>
                        <div className="mt-2 h-1 rounded-full bg-border/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${combined.score >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                            style={{ width: `${Math.abs(combined.score) * 10}%`, marginLeft: combined.score < 0 ? `${100 - Math.abs(combined.score) * 10}%` : "0" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Price Chart */}
              <Card className="border-border/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold">Price Chart (90d)</span>
                  </div>
                  {signal && (
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Trend: <span className="text-foreground font-medium capitalize">{signal.trend.replace("_", " ")}</span>
                      </span>
                      <span className="text-muted-foreground">
                        <Activity className="w-3 h-3 inline mr-1" />
                        Vol: <span className="text-foreground font-medium capitalize">{signal.volatility}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Phase: <span className="text-foreground font-medium capitalize">{signal.marketPhase}</span>
                      </span>
                    </div>
                  )}
                </div>
                <PriceChart candles={analysis?.candles || []} signal={signal} indicators={indicators} />
              </Card>

              {/* Market Stats */}
              {coinInfo && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Market Cap" value={`$${formatCompact(coinInfo.marketCap)}`} />
                  <StatCard label="24h Volume" value={`$${formatCompact(coinInfo.volume24h)}`} />
                  <StatCard label="24h High" value={`$${formatPrice(coinInfo.high24h)}`} color="text-emerald-400" />
                  <StatCard label="24h Low" value={`$${formatPrice(coinInfo.low24h)}`} color="text-red-400" />
                  <StatCard label="ATH" value={`$${formatPrice(coinInfo.ath)}`} />
                  <StatCard label="ATH Change" value={formatPercent(coinInfo.athChange)} color={getChangeColor(coinInfo.athChange)} />
                  <StatCard label="7d Change" value={formatPercent(coinInfo.change7d)} color={getChangeColor(coinInfo.change7d)} />
                  <StatCard label="30d Change" value={formatPercent(coinInfo.change30d)} color={getChangeColor(coinInfo.change30d)} />
                </div>
              )}

              {/* Indicator Details Grid */}
              {indicators && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold">Indicator Breakdown</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {signal && Object.entries(signal.indicators).map(([name, data]: [string, any]) => (
                      <div key={name} className={`rounded-md p-2.5 border border-border/20 ${getBiasBg(data.bias)}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{name}</span>
                          <BiasIcon bias={data.bias} />
                        </div>
                        <p className={`text-xs font-medium ${getBiasColor(data.bias)}`}>{data.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Smart Money & Fibonacci */}
              {indicators && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="border-border/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold">Smart Money Concepts</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Order Blocks</span>
                        <span>{indicators.orderBlocks?.length || 0} detected</span>
                      </div>
                      {indicators.orderBlocks?.map((ob: any, i: number) => (
                        <div key={i} className={`flex justify-between pl-3 ${ob.type === "bullish" ? "text-emerald-400" : "text-red-400"}`}>
                          <span className="capitalize">{ob.type} OB</span>
                          <span>${formatPrice(ob.low)} - ${formatPrice(ob.high)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1 border-t border-border/15">
                        <span className="text-muted-foreground">Fair Value Gaps</span>
                        <span>{indicators.fairValueGaps?.length || 0} open</span>
                      </div>
                      {indicators.fairValueGaps?.map((fvg: any, i: number) => (
                        <div key={i} className={`flex justify-between pl-3 ${fvg.type === "bullish" ? "text-emerald-400" : "text-red-400"}`}>
                          <span className="capitalize">{fvg.type} FVG</span>
                          <span>${formatPrice(fvg.low)} - ${formatPrice(fvg.high)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1 border-t border-border/15">
                        <span className="text-muted-foreground">Support</span>
                        <span className="text-emerald-400">${formatPrice(indicators.support)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resistance</span>
                        <span className="text-red-400">${formatPrice(indicators.resistance)}</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="border-border/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold">Fibonacci Retracement</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {indicators.fibLevels?.map((fib: any) => {
                        const isNearPrice = analysis?.currentPrice &&
                          Math.abs(analysis.currentPrice - fib.price) / analysis.currentPrice < 0.02;
                        return (
                          <div key={fib.level} className={`flex justify-between py-1 px-2 rounded ${isNearPrice ? "bg-emerald-500/10 border border-emerald-500/30" : ""}`}>
                            <span className={isNearPrice ? "text-emerald-400 font-medium" : "text-muted-foreground"}>{fib.level}</span>
                            <span className={isNearPrice ? "text-emerald-400 font-mono font-medium" : "font-mono"}>${formatPrice(fib.price)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Confluence Meter */}
              {signal && (
                <Card className={`border p-4 ${getSignalBg(signal.type)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold">Confluence Score</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${getSignalColor(signal.type)}`}>
                      {signal.confidence}% confident
                    </Badge>
                  </div>
                  <ConfluenceMeter score={signal.confluenceScore} type={signal.type} />
                  <div className="mt-3 text-center">
                    <p className={`text-lg font-bold ${getSignalColor(signal.type)}`}>
                      {signal.type.replace("_", " ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{signal.reason}</p>
                  </div>
                </Card>
              )}

              {/* Risk Management */}
              {signal && signal.type !== "HOLD" && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold">Risk Management</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <RiskRow label="Entry (4H)" value={`$${formatPrice(signal.entry)}`} color="text-foreground" icon={<DollarSign className="w-3 h-3" />} />
                    <RiskRow label="Stop (4H)" value={`$${formatPrice(signal.stopLoss)}`} color="text-red-400" icon={<AlertTriangle className="w-3 h-3" />} />

                    {/* Refined entry from 15m */}
                    {analysis?.refinedEntry && (
                      <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-md p-2 space-y-1.5">
                        <p className="text-[10px] text-cyan-400 uppercase tracking-wider font-medium">15m Refined Entry</p>
                        <RiskRow label="Entry (15m)" value={`$${formatPrice(analysis.refinedEntry.entry)}`} color="text-cyan-400" icon={<DollarSign className="w-3 h-3" />} />
                        <RiskRow label="Stop (15m)" value={`$${formatPrice(analysis.refinedEntry.stopLoss)}`} color="text-cyan-400" icon={<AlertTriangle className="w-3 h-3" />} />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk reduction</span>
                          <span className="font-semibold text-cyan-400">{analysis.refinedEntry.riskReduction}%</span>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border/15 pt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Take Profit Levels</p>
                      <RiskRow label="TP1 (1.5:1 R:R)" value={`$${formatPrice(signal.takeProfit1)}`} color="text-emerald-400/70" icon={<Target className="w-3 h-3" />} />
                      <RiskRow label="TP2 (2.5:1 R:R)" value={`$${formatPrice(signal.takeProfit2)}`} color="text-emerald-400/85" icon={<Target className="w-3 h-3" />} />
                      <RiskRow label="TP3 (4:1 R:R)" value={`$${formatPrice(signal.takeProfit3)}`} color="text-emerald-400" icon={<Target className="w-3 h-3" />} />
                    </div>
                    <div className="border-t border-border/15 pt-2 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Risk/Reward</span>
                        <span className="font-semibold text-blue-400">1:{signal.riskRewardRatio}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Position Size</span>
                        <span className="font-semibold">{signal.positionSizePct}% of portfolio</span>
                      </div>
                    </div>

                    {/* Log Signal to Journal */}
                    <div className="border-t border-border/15 pt-3">
                      {signalLogged ? (
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Signal logged to journal</span>
                          <Link href="/paper" className="underline hover:text-emerald-300 ml-1">View Trades</Link>
                        </div>
                      ) : (
                        <button
                          onClick={() => logSignalMutation.mutate(signal)}
                          disabled={logSignalMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-colors text-xs font-medium"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {logSignalMutation.isPending ? "Logging..." : "Log Signal to Journal"}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Analysis Reasons */}
              {signal && signal.detailedReasons?.length > 0 && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold">Analysis Reasons</span>
                  </div>
                  <ul className="space-y-1.5">
                    {signal.detailedReasons.map((reason: string, i: number) => (
                      <li key={i} className="text-xs flex items-start gap-2">
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                          reason.toLowerCase().includes("bullish") || reason.toLowerCase().includes("buy") || reason.toLowerCase().includes("oversold")
                            ? "bg-emerald-400"
                            : reason.toLowerCase().includes("bearish") || reason.toLowerCase().includes("sell") || reason.toLowerCase().includes("overbought")
                            ? "bg-red-400"
                            : "bg-yellow-400"
                        }`} />
                        <span className="text-muted-foreground">{reason}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Ichimoku Summary */}
              {indicators?.ichimoku && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold">Ichimoku Cloud</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tenkan-sen</span><span className="font-mono">${formatPrice(indicators.ichimoku.tenkan)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Kijun-sen</span><span className="font-mono">${formatPrice(indicators.ichimoku.kijun)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cloud Top</span><span className="font-mono">${formatPrice(indicators.ichimoku.cloudTop)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cloud Bottom</span><span className="font-mono">${formatPrice(indicators.ichimoku.cloudBottom)}</span></div>
                    <div className="flex justify-between pt-1 border-t border-border/15">
                      <span className="text-muted-foreground">Price vs Cloud</span>
                      <span className={indicators.ichimoku.priceVsCloud === "above" ? "text-emerald-400 font-medium" : indicators.ichimoku.priceVsCloud === "below" ? "text-red-400 font-medium" : "text-yellow-400 font-medium"}>
                        {indicators.ichimoku.priceVsCloud.charAt(0).toUpperCase() + indicators.ichimoku.priceVsCloud.slice(1)}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Cloud Color</span><span className={indicators.ichimoku.cloudColor === "green" ? "text-emerald-400" : "text-red-400"}>{indicators.ichimoku.cloudColor.charAt(0).toUpperCase() + indicators.ichimoku.cloudColor.slice(1)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">TK Cross</span><span className={indicators.ichimoku.tkCross === "bullish" ? "text-emerald-400" : indicators.ichimoku.tkCross === "bearish" ? "text-red-400" : "text-muted-foreground"}>{indicators.ichimoku.tkCross.charAt(0).toUpperCase() + indicators.ichimoku.tkCross.slice(1)}</span></div>
                  </div>
                </Card>
              )}

              {/* Raw Numbers */}
              {indicators && (
                <Card className="border-border/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-bold">Raw Indicator Values</span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <DataRow label="RSI (14)" value={indicators.rsi?.toFixed(1)} />
                    <DataRow label="Stoch RSI K" value={indicators.stochRsi?.k?.toFixed(1)} />
                    <DataRow label="MACD Line" value={indicators.macd?.line?.toFixed(4)} />
                    <DataRow label="MACD Signal" value={indicators.macd?.signal?.toFixed(4)} />
                    <DataRow label="MACD Hist" value={indicators.macd?.histogram?.toFixed(4)} />
                    <div className="border-t border-border/15 pt-1.5 mt-1.5" />
                    <DataRow label="EMA 9" value={`$${formatPrice(indicators.ema9)}`} />
                    <DataRow label="EMA 21" value={`$${formatPrice(indicators.ema21)}`} />
                    <DataRow label="EMA 50" value={`$${formatPrice(indicators.ema50)}`} />
                    <DataRow label="EMA 200" value={`$${formatPrice(indicators.ema200)}`} />
                    <div className="border-t border-border/15 pt-1.5 mt-1.5" />
                    <DataRow label="BB Upper" value={`$${formatPrice(indicators.bollingerBands?.upper)}`} />
                    <DataRow label="BB Middle" value={`$${formatPrice(indicators.bollingerBands?.middle)}`} />
                    <DataRow label="BB Lower" value={`$${formatPrice(indicators.bollingerBands?.lower)}`} />
                    <DataRow label="BB %B" value={`${((indicators.bollingerBands?.percentB || 0) * 100).toFixed(1)}%`} />
                    <div className="border-t border-border/15 pt-1.5 mt-1.5" />
                    <DataRow label="ATR" value={`$${formatPrice(indicators.atr)}`} />
                    <DataRow label="ATR %" value={`${indicators.atrPercent?.toFixed(2)}%`} />
                    <DataRow label="Volume Ratio" value={`${indicators.volumeRatio?.toFixed(2)}x`} />
                    <DataRow label="OBV Trend" value={indicators.obvTrend} />
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── Backtesting Section ─────────────────────────────── */}
        <div className="mt-4">
          <Card className="border-border/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold">Backtesting</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Strategy tabs for backtest */}
                <div className="flex items-center bg-card/40 border border-border/20 rounded-lg p-0.5">
                  {[
                    { id: "confluence-swing" as const, label: "Confluence Swing" },
                    { id: "smc" as const, label: "SMC" },
                    { id: "break-retest" as const, label: "Break & Retest" },
                  ].map(tab => {
                    const sc = getStratColor(tab.id);
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setBacktestTab(tab.id); setBacktestRequested(true); }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          backtestTab === tab.id && backtestRequested
                            ? `${sc.bg} ${sc.text}`
                            : "text-muted-foreground/50 hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                {!backtestRequested && (
                  <button
                    onClick={() => setBacktestRequested(true)}
                    className="text-xs px-3 py-1.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-colors font-medium"
                  >
                    Run
                  </button>
                )}
              </div>
            </div>

            {backtestLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
              </div>
            )}

            {backtest && !backtestLoading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
                  <BacktestStat label="Win Rate" value={`${backtest.winRate}%`} color={backtest.winRate >= 50 ? "text-emerald-400" : "text-red-400"} />
                  <BacktestStat label="Profit Factor" value={backtest.profitFactor >= 999 ? "∞" : backtest.profitFactor.toFixed(2)} color={backtest.profitFactor >= 1.5 ? "text-emerald-400" : backtest.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"} />
                  <BacktestStat label="Expectancy" value={backtest.expectancy != null ? `${backtest.expectancy > 0 ? "+" : ""}${backtest.expectancy.toFixed(3)}%` : "—"} color={backtest.expectancy > 0 ? "text-emerald-400" : "text-red-400"} />
                  <BacktestStat label="Sharpe" value={backtest.sharpe != null ? backtest.sharpe.toFixed(2) : "—"} color={backtest.sharpe >= 0.5 ? "text-emerald-400" : backtest.sharpe >= 0 ? "text-yellow-400" : "text-red-400"} />
                  <BacktestStat label="Total Return" value={`${backtest.totalReturn > 0 ? "+" : ""}${backtest.totalReturn}%`} color={backtest.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"} />
                  <BacktestStat label="Max Drawdown" value={`${backtest.maxDrawdown.toFixed(1)}%`} color="text-red-400" />
                  <BacktestStat label="Avg Win" value={`+${backtest.avgWinPct}%`} color="text-emerald-400" />
                  <BacktestStat label="Avg Loss" value={`-${backtest.avgLossPct}%`} color="text-red-400" />
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-muted-foreground">
                    {backtest.totalTrades} trades over {backtest.spanDays || "~100"} days
                    ({backtest.totalBars} {backtest.interval || "1D"} candles)
                    {backtest.strategy && <> · <span className="text-foreground">{backtest.strategy}</span></>}
                  </span>
                  {backtest.totalTrades < 30 && (
                    <span className="text-[10px] text-yellow-400 font-medium">
                      ⚠️ {backtest.totalTrades < 15 ? "Insufficient" : "Low"} sample (N={backtest.totalTrades})
                    </span>
                  )}
                </div>

                {backtest.trades?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-border/20 text-muted-foreground">
                          <th className="text-left py-1.5 pr-3 font-medium">Date</th>
                          <th className="text-left py-1.5 pr-3 font-medium">Signal</th>
                          <th className="text-right py-1.5 pr-3 font-medium">Entry</th>
                          <th className="text-right py-1.5 pr-3 font-medium">Stop</th>
                          <th className="text-right py-1.5 pr-3 font-medium">TP1</th>
                          <th className="text-right py-1.5 pr-3 font-medium">Score</th>
                          <th className="text-right py-1.5 pr-3 font-medium">Duration</th>
                          <th className="text-right py-1.5 font-medium">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...backtest.trades].reverse().slice(0, 20).map((trade: any, i: number) => (
                          <tr key={i} className="border-b border-border/8 hover:bg-card/30">
                            <td className="py-1.5 pr-3 text-muted-foreground">
                              {new Date(trade.time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                            </td>
                            <td className="py-1.5 pr-3">
                              <span className={`font-medium ${getSignalColor(trade.signal)}`}>
                                {trade.signal.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-right font-mono">${formatPrice(trade.entry)}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-red-400">${formatPrice(trade.stopLoss)}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-emerald-400">${formatPrice(trade.takeProfit1)}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">{trade.confluenceScore > 0 ? "+" : ""}{trade.confluenceScore}</td>
                            <td className="py-1.5 pr-3 text-right text-muted-foreground">{trade.durationLabel || `${trade.barsToOutcome}b`}</td>
                            <td className="py-1.5 text-right">
                              {trade.outcome === "win"  && <span className="flex items-center justify-end gap-1 text-emerald-400 font-medium"><CheckCircle2 className="w-3 h-3" />+{trade.pnlPct}%</span>}
                              {trade.outcome === "loss" && <span className="flex items-center justify-end gap-1 text-red-400 font-medium"><XCircle className="w-3 h-3" />{trade.pnlPct}%</span>}
                              {trade.outcome === "pending" && <span className="flex items-center justify-end gap-1 text-muted-foreground"><Timer className="w-3 h-3" />—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {!backtestRequested && (
              <p className="text-[10px] text-muted-foreground">
                Select a strategy and click Run to backtest {symbol.toUpperCase()} with that strategy's signal logic.
              </p>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="border-border/20 px-3 py-2">
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider block">{label}</span>
      <span className={`text-xs font-bold font-mono ${color || "text-foreground"}`}>{value}</span>
    </Card>
  );
}

function RiskRow({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className={`font-mono font-medium ${color}`}>{value}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground font-sans">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

function BiasIcon({ bias }: { bias: string }) {
  if (bias === "bullish") return <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (bias === "bearish") return <ChevronDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function BacktestStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="border-border/20 px-3 py-2">
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider block">{label}</span>
      <span className={`text-sm font-bold font-mono ${color || "text-foreground"}`}>{value}</span>
    </Card>
  );
}
