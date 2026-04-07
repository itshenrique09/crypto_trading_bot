import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { X, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { JournalEntry } from "@/lib/types";

interface TradeChartModalProps {
  entry: JournalEntry;
  onClose: () => void;
}

const INTERVAL_OPTIONS = ["15m", "1h", "4h", "1d"];

export default function TradeChartModal({ entry, onClose }: TradeChartModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<SeriesType> | null>(null);
  const [interval, setInterval]   = useState("4h");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const entryTs = Math.floor(new Date(entry.created_at).getTime() / 1000);
  const exitTs  = entry.closed_at ? Math.floor(new Date(entry.closed_at).getTime() / 1000) : undefined;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0f0f17" },
        textColor:  "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#374151" },
      timeScale: { borderColor: "#374151", timeVisible: true, secondsVisible: false },
      width:  containerRef.current.clientWidth,
      height: 380,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         "#10b981",
      downColor:       "#ef4444",
      borderUpColor:   "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor:     "#10b981",
      wickDownColor:   "#ef4444",
    });
    seriesRef.current = candleSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    const from = entryTs;
    const to   = exitTs ?? Math.floor(Date.now() / 1000);
    const url  = `/api/trade-chart/${entry.symbol}?from=${from}&to=${to}&interval=${interval}`;

    setLoading(true);
    setError(null);

    fetch(url)
      .then(r => r.json())
      .then((data: { time: number; open: number; high: number; low: number; close: number }[]) => {
        if (!Array.isArray(data) || data.length === 0) {
          setError("No candle data available");
          setLoading(false);
          return;
        }

        candleSeries.setData(data as CandlestickData<Time>[]);

        // ── Price lines ──────────────────────────────────────────────
        candleSeries.createPriceLine({
          price:    entry.entry_price,
          color:    "#a78bfa",
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `Entry ${formatPrice(entry.entry_price)}`,
        });
        candleSeries.createPriceLine({
          price:    entry.stop_loss,
          color:    "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL ${formatPrice(entry.stop_loss)}`,
        });
        candleSeries.createPriceLine({
          price:    entry.take_profit1,
          color:    "#10b981",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP1 ${formatPrice(entry.take_profit1)}`,
        });
        if (entry.take_profit2) {
          candleSeries.createPriceLine({
            price:    entry.take_profit2,
            color:    "#6ee7b7",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `TP2 ${formatPrice(entry.take_profit2)}`,
          });
        }
        if (entry.exit_price && entry.outcome !== "open") {
          candleSeries.createPriceLine({
            price:    entry.exit_price,
            color:    entry.outcome === "win" ? "#34d399" : entry.outcome === "loss" ? "#f87171" : "#9ca3af",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `Exit ${formatPrice(entry.exit_price)}`,
          });
        }

        // ── Markers: entry & exit ─────────────────────────────────────
        const entryCandle = data.reduce((prev, cur) =>
          Math.abs(cur.time - entryTs) < Math.abs(prev.time - entryTs) ? cur : prev
        );
        const markers: Parameters<typeof createSeriesMarkers>[1] = [
          {
            time:     entryCandle.time as Time,
            position: entry.direction === "LONG" ? "belowBar" : "aboveBar",
            color:    "#a78bfa",
            shape:    entry.direction === "LONG" ? "arrowUp" : "arrowDown",
            text:     "Entry",
          },
        ];

        if (exitTs && entry.exit_price) {
          const exitCandle = data.reduce((prev, cur) =>
            Math.abs(cur.time - exitTs) < Math.abs(prev.time - exitTs) ? cur : prev
          );
          markers.push({
            time:     exitCandle.time as Time,
            position: entry.direction === "LONG" ? "aboveBar" : "belowBar",
            color:    entry.outcome === "win" ? "#10b981" : entry.outcome === "loss" ? "#ef4444" : "#9ca3af",
            shape:    "circle",
            text:     `Exit${entry.pnl_pct != null ? ` ${entry.pnl_pct > 0 ? "+" : ""}${entry.pnl_pct}%` : ""}`,
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createSeriesMarkers(candleSeries as any, markers);
        chart.timeScale().fitContent();
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || "Failed to load chart data");
        setLoading(false);
      });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#0f0f17] border border-border/40 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border/30">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              entry.direction === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}>{entry.direction}</span>
            <span className="font-bold text-sm">{entry.symbol}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(entry.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            {entry.pnl_pct != null && entry.outcome !== "open" && (
              <span className={`text-xs font-bold ${entry.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {entry.pnl_pct > 0 ? "+" : ""}{entry.pnl_pct}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Interval selector */}
            <div className="flex items-center gap-0.5">
              {INTERVAL_OPTIONS.map(iv => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`text-[10px] px-1.5 sm:px-2 py-1 rounded transition-colors ${
                    interval === iv
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart area */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f17]/80 z-10" style={{ height: 380 }}>
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ height: 380 }}>
              <span className="text-sm text-muted-foreground">{error}</span>
            </div>
          )}
          <div ref={containerRef} className="w-full" />
        </div>

        {/* Footer: price levels */}
        <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2 border-t border-border/20 text-[10px] flex-wrap">
          <span className="text-purple-400">Entry <span className="font-mono">${formatPrice(entry.entry_price)}</span></span>
          <span className="text-red-400">SL <span className="font-mono">${formatPrice(entry.stop_loss)}</span></span>
          <span className="text-emerald-400">TP1 <span className="font-mono">${formatPrice(entry.take_profit1)}</span></span>
          {entry.take_profit2 && (
            <span className="text-emerald-300">TP2 <span className="font-mono">${formatPrice(entry.take_profit2)}</span></span>
          )}
          {entry.exit_price && entry.outcome !== "open" && (
            <span className={entry.outcome === "win" ? "text-emerald-400" : entry.outcome === "loss" ? "text-red-400" : "text-muted-foreground"}>
              Exit <span className="font-mono">${formatPrice(entry.exit_price)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
