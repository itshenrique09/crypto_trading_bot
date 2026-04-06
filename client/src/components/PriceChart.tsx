import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine
} from "recharts";
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

export default function PriceChart({ candles, signal, indicators }: Props) {
  const chartData = useMemo(() => {
    if (!candles?.length) return [];
    return candles.map((c) => ({
      time: new Date(c.time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: c.close,
      open: c.open,
      high: c.high,
      low: c.low,
      volume: c.volume,
      range: [c.low, c.high],
    }));
  }, [candles]);

  if (!chartData.length) {
    return <div className="h-[320px] flex items-center justify-center text-xs text-muted-foreground">Loading chart...</div>;
  }

  const minPrice = Math.min(...chartData.map((d) => d.low)) * 0.995;
  const maxPrice = Math.max(...chartData.map((d) => d.high)) * 1.005;

  return (
    <div className="space-y-1">
      {/* Main Price Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 12%)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: "hsl(215 15% 52%)" }}
              axisLine={{ stroke: "hsl(220 15% 14%)" }}
              tickLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 8))}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 9, fill: "hsl(215 15% 52%)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${formatPrice(v)}`}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 18% 10%)",
                border: "1px solid hsl(220 15% 18%)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "hsl(210 20% 90%)",
              }}
              formatter={(value: any, name: string) => {
                if (name === "price") return [`$${formatPrice(value)}`, "Close"];
                return [value, name];
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 3, fill: "#22c55e", stroke: "#22c55e33", strokeWidth: 6 }}
            />
            {/* Bollinger Bands */}
            {indicators?.bollingerBands && (
              <>
                <ReferenceLine
                  y={indicators.bollingerBands.upper}
                  stroke="#3b82f680"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <ReferenceLine
                  y={indicators.bollingerBands.middle}
                  stroke="#3b82f640"
                  strokeDasharray="2 2"
                  strokeWidth={1}
                />
                <ReferenceLine
                  y={indicators.bollingerBands.lower}
                  stroke="#3b82f680"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              </>
            )}
            {/* Signal Lines */}
            {signal?.entry && (
              <ReferenceLine y={signal.entry} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5} />
            )}
            {signal?.stopLoss && (
              <ReferenceLine y={signal.stopLoss} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1} />
            )}
            {signal?.takeProfit3 && (
              <ReferenceLine y={signal.takeProfit3} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1} />
            )}
            {/* Support/Resistance */}
            {indicators?.support && (
              <ReferenceLine y={indicators.support} stroke="#22c55e40" strokeDasharray="8 4" strokeWidth={1} />
            )}
            {indicators?.resistance && (
              <ReferenceLine y={indicators.resistance} stroke="#ef444440" strokeDasharray="8 4" strokeWidth={1} />
            )}
            {/* EMA lines */}
            {indicators?.ema50 && (
              <ReferenceLine y={indicators.ema50} stroke="#a78bfa60" strokeDasharray="2 2" strokeWidth={1} />
            )}
            {indicators?.ema200 && (
              <ReferenceLine y={indicators.ema200} stroke="#f9731660" strokeDasharray="2 2" strokeWidth={1} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Volume Bars */}
      <div className="h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 0, right: 5, bottom: 0, left: 5 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Bar
              dataKey="volume"
              fill="hsl(220 15% 18%)"
              radius={[1, 1, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Price</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500/50 inline-block border-dashed" /> Bollinger</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400/40 inline-block" /> EMA 50</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400/40 inline-block" /> EMA 200</span>
        {signal?.entry && (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" /> Entry</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" /> Stop Loss</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Take Profit</span>
          </>
        )}
      </div>
    </div>
  );
}
