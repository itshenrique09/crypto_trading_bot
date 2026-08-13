import { useEffect, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
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
  type SeriesMarker,
} from "lightweight-charts";
import { fmtPrice, fmtCompact, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OHLCV } from "@/lib/types";

// One chart theme for the whole app.
export const CHART_COLORS = {
  up: "#2ebd85",
  down: "#f6465d",
  upSoft: "rgba(46,189,133,0.30)",
  downSoft: "rgba(246,70,93,0.30)",
  text: "#8b90a0",
  grid: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  ema50: "#a78bfa",
  ema200: "#fb923c",
  entry: "#f0b90b",
  sl: "#f6465d",
  tp: "#2ebd85",
} as const;

export interface ChartPriceLine {
  price: number | null | undefined;
  color: string;
  title: string;
  style?: "solid" | "dashed" | "dotted";
}

export interface ChartMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle";
  text?: string;
}

interface Props {
  candles: OHLCV[];
  height?: number;
  priceLines?: ChartPriceLine[];
  markers?: ChartMarker[];
  showVolume?: boolean;
  emaPeriods?: number[];
  /** Right-align latest data instead of fitting everything. */
  rightAlign?: boolean;
  className?: string;
}

function emaSeries(candles: OHLCV[], period: number): LineData<Time>[] {
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  const out: LineData<Time>[] = [];
  let prev = candles[0].close;
  for (let i = 0; i < candles.length; i++) {
    prev = i === 0 ? candles[i].close : candles[i].close * k + prev * (1 - k);
    if (i >= period - 1) out.push({ time: candles[i].time as Time, value: prev });
  }
  return out;
}

const LINE_STYLE = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
} as const;

export default function CandleChart({
  candles,
  height = 420,
  priceLines,
  markers,
  showVolume = true,
  emaPeriods = [50, 200],
  rightAlign = false,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<OHLCV | null>(null);

  useEffect(() => {
    if (!containerRef.current || !candles?.length) return;

    const sorted = [...candles]
      .filter(c => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);
    if (!sorted.length) return;

    const chart: IChartApi = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: CHART_COLORS.text,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.08 },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: rightAlign ? 4 : 0,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up,
      wickDownColor: CHART_COLORS.down,
      priceLineVisible: true,
      priceLineColor: CHART_COLORS.text,
    });
    candleSeries.setData(sorted.map(c => ({
      time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
    })) as CandlestickData<Time>[]);

    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "vol",
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      });
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      volSeries.setData(sorted.map(c => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? CHART_COLORS.upSoft : CHART_COLORS.downSoft,
      })) as HistogramData<Time>[]);
    }

    const emaColors = [CHART_COLORS.ema50, CHART_COLORS.ema200, "#38bdf8", "#f472b6"];
    emaPeriods.forEach((period, i) => {
      const data = emaSeries(sorted, period);
      if (!data.length) return;
      const s = chart.addSeries(LineSeries, {
        color: emaColors[i % emaColors.length],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(data);
    });

    for (const line of priceLines ?? []) {
      if (line.price == null || !Number.isFinite(line.price)) continue;
      candleSeries.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 1,
        lineStyle: LINE_STYLE[line.style ?? "dashed"],
        axisLabelVisible: true,
        title: line.title,
      });
    }

    if (markers?.length) {
      const sortedMarkers = [...markers]
        .sort((a, b) => a.time - b.time)
        .map(m => ({ ...m, time: m.time as Time })) as SeriesMarker<Time>[];
      createSeriesMarkers(candleSeries, sortedMarkers);
    }

    if (rightAlign) chart.timeScale().scrollToRealTime();
    else chart.timeScale().fitContent();

    const byTime = new Map(sorted.map(c => [c.time, c]));
    chart.subscribeCrosshairMove(param => {
      const t = param.time as number | undefined;
      setHover(t != null ? byTime.get(t) ?? null : null);
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); setHover(null); };
  }, [candles, height, showVolume, rightAlign, JSON.stringify(priceLines), JSON.stringify(markers), emaPeriods.join(",")]);

  if (!candles?.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        A carregar velas…
      </div>
    );
  }

  const c = hover ?? candles[candles.length - 1];
  const chg = c ? ((c.close - c.open) / c.open) * 100 : null;

  return (
    <div className={cn("relative", className)}>
      {/* OHLC legend — follows the crosshair, falls back to the last candle */}
      {c && (
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className="num text-muted-foreground">O <span className="text-foreground/90">{fmtPrice(c.open)}</span></span>
          <span className="num text-muted-foreground">H <span className="text-foreground/90">{fmtPrice(c.high)}</span></span>
          <span className="num text-muted-foreground">L <span className="text-foreground/90">{fmtPrice(c.low)}</span></span>
          <span className="num text-muted-foreground">C <span className="text-foreground/90">{fmtPrice(c.close)}</span></span>
          <span className="num" style={{ color: (chg ?? 0) >= 0 ? CHART_COLORS.up : CHART_COLORS.down }}>
            {fmtPct(chg)}
          </span>
          <span className="num text-muted-foreground">Vol <span className="text-foreground/90">{fmtCompact(c.volume)}</span></span>
        </div>
      )}
      <div ref={containerRef} className="w-full" />
      {emaPeriods.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1.5 text-[10px] text-muted-foreground">
          {emaPeriods.map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              <span
                className="inline-block h-0.5 w-3"
                style={{ background: [CHART_COLORS.ema50, CHART_COLORS.ema200, "#38bdf8", "#f472b6"][i % 4] }}
              />
              EMA {p}
            </span>
          ))}
          {(priceLines ?? []).filter(l => l.price != null).map(l => (
            <span key={l.title} className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3" style={{ background: l.color }} />
              {l.title} <span className="num">{fmtPrice(l.price!)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
