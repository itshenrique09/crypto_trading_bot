import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
  type IChartApi,
  type Time,
  type CandlestickData,
  type LineData,
  type HistogramData,
} from "lightweight-charts";
import { formatPrice } from "@/lib/utils";

interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  candles: OHLCV[];
  signal?: any;
  indicators?: any;
}

// Exponential moving average over closes → a real series (not a flat line).
function emaSeries(candles: OHLCV[], period: number): LineData<Time>[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  const out: LineData<Time>[] = [];
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    prev = i === 0 ? candles[i].close : candles[i].close * k + prev * (1 - k);
    // Only emit once the average has enough data behind it to be meaningful.
    if (i >= period - 1) out.push({ time: candles[i].time as Time, value: prev });
  }
  return out;
}

export default function PriceChart({ candles, signal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !candles?.length) return;

    // De-dupe + sort ascending (lightweight-charts requires strictly increasing time).
    const sorted = [...candles]
      .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

    const chart: IChartApi = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: 340,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981", downColor: "#ef4444",
      borderUpColor: "#10b981", borderDownColor: "#ef4444",
      wickUpColor: "#10b981", wickDownColor: "#ef4444",
      priceLineVisible: false,
    });
    candleSeries.setData(sorted.map(c => ({
      time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
    })) as CandlestickData<Time>[]);

    // ── Volume histogram on its own overlay scale at the bottom ──
    const volSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
    });
    volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volSeries.setData(sorted.map(c => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)",
    })) as HistogramData<Time>[]);

    // ── EMA overlays — the macro filter the strategies actually use ──
    const ema50 = emaSeries(sorted, 50);
    if (ema50.length) {
      const s = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(ema50);
    }
    const ema200 = emaSeries(sorted, 200);
    if (ema200.length) {
      const s = chart.addSeries(LineSeries, { color: "#fb923c", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(ema200);
    }

    // ── Signal levels — horizontal price lines with axis labels ──
    const priceLine = (price: number | undefined, color: string, style: LineStyle, title: string) => {
      if (price == null || !Number.isFinite(price)) return;
      candleSeries.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
    };
    if (signal) {
      priceLine(signal.entry, "#f59e0b", LineStyle.Solid, "Entry");
      priceLine(signal.stopLoss, "#ef4444", LineStyle.Dashed, "SL");
      priceLine(signal.takeProfit1, "#10b981", LineStyle.Dashed, "TP1");
      if (signal.takeProfit2 && signal.takeProfit2 !== signal.takeProfit1) {
        priceLine(signal.takeProfit2, "#6ee7b7", LineStyle.Dotted, "TP2");
      }
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [candles, signal]);

  if (!candles?.length) {
    return <div className="h-[340px] flex items-center justify-center text-xs text-muted-foreground">Loading chart…</div>;
  }

  return (
    <div className="space-y-1">
      <div ref={containerRef} className="w-full" />
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-400 inline-block" /> EMA 50</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" /> EMA 200</span>
        {signal?.entry && (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> Entry {formatPrice(signal.entry)}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" /> SL {formatPrice(signal.stopLoss)}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> TP1 {formatPrice(signal.takeProfit1)}</span>
          </>
        )}
      </div>
    </div>
  );
}
