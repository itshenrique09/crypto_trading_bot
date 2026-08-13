import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getJson } from "@/lib/queryClient";
import { fmtPrice, fmtPct, pnlClass, heldFor } from "@/lib/format";
import { getStratName, type JournalEntry, type OHLCV } from "@/lib/types";
import CandleChart, { CHART_COLORS, type ChartMarker, type ChartPriceLine } from "./CandleChart";
import { Segmented, DirectionBadge, ModeBadge, SourceTag } from "./ui-kit";

interface Props {
  trade: JournalEntry;
  onClose: () => void;
}

const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

export default function TradeChartModal({ trade, onClose }: Props) {
  const [interval, setInterval] = useState<Interval>("1h");

  const entryTs = Math.floor(new Date(trade.created_at).getTime() / 1000);
  const exitTs = trade.closed_at ? Math.floor(new Date(trade.closed_at).getTime() / 1000) : undefined;

  const { data: candles, isLoading, error } = useQuery<OHLCV[]>({
    queryKey: ["/api/trade-chart", trade.id, interval],
    queryFn: () =>
      getJson<OHLCV[]>(
        `/api/trade-chart/${trade.symbol}?from=${entryTs}${exitTs ? `&to=${exitTs}` : ""}&interval=${interval}`,
      ),
    staleTime: 60_000,
  });

  const priceLines: ChartPriceLine[] = [
    { price: trade.entry_price, color: CHART_COLORS.entry, title: "Entry", style: "solid" },
    { price: trade.stop_loss, color: CHART_COLORS.sl, title: "SL" },
    { price: trade.take_profit1, color: CHART_COLORS.tp, title: "TP1" },
    ...(trade.take_profit2 && trade.take_profit2 !== trade.take_profit1
      ? [{ price: trade.take_profit2, color: CHART_COLORS.tp, title: "TP2", style: "dotted" as const }]
      : []),
    ...(trade.exit_price ? [{ price: trade.exit_price, color: "#e2e8f0", title: "Exit", style: "solid" as const }] : []),
  ];

  const markers: ChartMarker[] = [
    {
      time: entryTs,
      position: trade.direction === "LONG" ? "belowBar" : "aboveBar",
      color: CHART_COLORS.entry,
      shape: trade.direction === "LONG" ? "arrowUp" : "arrowDown",
      text: "Entry",
    },
    ...(exitTs
      ? [{
          time: exitTs,
          position: (trade.direction === "LONG" ? "aboveBar" : "belowBar") as ChartMarker["position"],
          color: "#e2e8f0",
          shape: "circle" as const,
          text: "Exit",
        }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-lg border border-border bg-card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-semibold">{trade.symbol}</span>
            <DirectionBadge direction={trade.direction} />
            <ModeBadge mode={trade.mode} />
            <span className="text-xs text-muted-foreground">{getStratName(trade.strategy)}</span>
            {trade.pnl_pct != null && (
              <span className={`num text-xs ${pnlClass(trade.pnl_pct)}`}>{fmtPct(trade.pnl_pct)}</span>
            )}
            <span className="text-xs text-muted-foreground">held {heldFor(trade.created_at, trade.closed_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <SourceTag>Binance Spot</SourceTag>
            <Segmented
              value={interval}
              onChange={setInterval}
              options={INTERVALS.map(i => ({ value: i, label: i }))}
            />
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card-2 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="p-4">
          {error ? (
            <div className="flex h-[380px] items-center justify-center text-xs text-down">
              Falha ao carregar velas: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="flex h-[380px] items-center justify-center text-xs text-muted-foreground">
              A carregar velas…
            </div>
          ) : (
            <CandleChart
              candles={candles ?? []}
              height={380}
              priceLines={priceLines}
              markers={markers}
              emaPeriods={[]}
              showVolume
            />
          )}
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Entry </span>
              <span className="num">{fmtPrice(trade.entry_price)}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">SL </span>
              <span className="num text-down">{fmtPrice(trade.stop_loss)}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">TP1 </span>
              <span className="num text-up">{fmtPrice(trade.take_profit1)}</span>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">{trade.exit_price ? "Exit " : "TP2 "}</span>
              <span className="num">{fmtPrice(trade.exit_price ?? trade.take_profit2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
