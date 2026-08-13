import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, BarChart2 } from "lucide-react";
import {
  useCandles, useEngineConfig, useJournal, useMarket, useSignals, useStrategies,
} from "@/lib/api";
import { ago, fmtCompact, fmtPct, fmtPrice, fmtR, fmtUsd, pnlClass, tradeR } from "@/lib/format";
import { getStratColor, type JournalEntry } from "@/lib/types";
import { Page, Panel, Segmented, EmptyState, DirectionBadge, ModeBadge, Pnl, SourceTag } from "@/components/ui-kit";
import CandleChart, { CHART_COLORS, type ChartPriceLine } from "@/components/CandleChart";
import TradeChartModal from "@/components/TradeChartModal";
import { Skeleton } from "@/components/ui/skeleton";

const TIMEFRAMES = [
  { value: "15m", label: "15m", limit: 400 },
  { value: "1h", label: "1H", limit: 500 },
  { value: "4h", label: "4H", limit: 500 },
  { value: "1d", label: "1D", limit: 400 },
] as const;
type TF = (typeof TIMEFRAMES)[number]["value"];

const SOURCE_LABEL: Record<string, string> = {
  "mexc-futures": "MEXC Futures",
  "binance-spot": "Binance Spot (fallback)",
};

function SignalPill({ signal }: { signal: string }) {
  const cls = signal === "BUY" ? "bg-up/10 text-up" : signal === "SELL" ? "bg-down/10 text-down" : "bg-secondary text-muted-foreground";
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold tracking-wide ${cls}`}>{signal}</span>;
}

function GateRow({ label, value, pass, detail }: { label: string; value: string; pass: boolean | null; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs" title={detail}>
      <span className="text-muted-foreground">{label}</span>
      <span className="num flex items-center gap-1.5">
        {value}
        {pass != null && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${pass ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>
            {pass ? "OK" : "BLOQUEIA"}
          </span>
        )}
      </span>
    </div>
  );
}

export default function SymbolPage() {
  const [, params] = useRoute("/markets/:symbol");
  const symbol = params?.symbol?.toUpperCase();
  const [tf, setTf] = useState<TF>("1h");
  const [chartTrade, setChartTrade] = useState<JournalEntry | null>(null);

  const tfConfig = TIMEFRAMES.find(t => t.value === tf)!;
  const { data: candlesRes, isLoading: candlesLoading } = useCandles(symbol, tf, tfConfig.limit);
  const { data: signals } = useSignals(symbol);
  const { data: market } = useMarket();
  const { data: journal = [] } = useJournal();
  const { data: strategies } = useStrategies();
  const { data: config } = useEngineConfig();

  const coin = market?.find(c => c.symbol === symbol);
  const candles = candlesRes?.candles ?? [];
  const lastPrice = candles.length ? candles[candles.length - 1].close : coin?.price;

  const symbolTrades = useMemo(
    () => journal
      .filter(t => t.symbol === symbol)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10),
    [journal, symbol],
  );
  const openTrade = symbolTrades.find(t => t.outcome === "open");

  const priceLines: ChartPriceLine[] = useMemo(() => {
    if (!openTrade) return [];
    return [
      { price: openTrade.entry_price, color: CHART_COLORS.entry, title: "Entry", style: "solid" },
      { price: openTrade.stop_loss, color: CHART_COLORS.sl, title: "SL" },
      { price: openTrade.tp1_hit ? openTrade.take_profit2 ?? openTrade.take_profit1 : openTrade.take_profit1, color: CHART_COLORS.tp, title: openTrade.tp1_hit ? "TP2" : "TP1" },
    ];
  }, [openTrade]);

  const gates = config?.riskGates;
  const inUniverseOf = (strategies ?? []).filter(s => s.preferredSymbols.includes(symbol ?? ""));

  return (
    <Page>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/markets" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card-2 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold tracking-tight">{symbol}</h1>
              {coin && <span className="text-xs text-muted-foreground">{coin.name}</span>}
              {inUniverseOf.length > 0 ? (
                <span className="rounded bg-up/10 px-1.5 py-0.5 text-[10px] font-medium text-up">
                  no universo · {inUniverseOf.map(s => s.name).join(", ")}
                </span>
              ) : (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  fora do universo de trading
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3">
              <span className="num text-xl font-semibold">${fmtPrice(lastPrice)}</span>
              {coin && <span className={`num text-sm ${pnlClass(coin.change24h)}`}>{fmtPct(coin.change24h)} 24h</span>}
            </div>
          </div>
        </div>
        {coin && (
          <div className="flex items-center gap-5 text-xs">
            <div className="text-right">
              <div className="text-muted-foreground">Máx / Mín 24h</div>
              <div className="num">{fmtPrice(coin.high24h)} / {fmtPrice(coin.low24h)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Volume 24h</div>
              <div className="num">${fmtCompact(coin.volume24h)}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Funding</div>
              <div className="num">{coin.fundingRate != null ? `${(coin.fundingRate * 100).toFixed(4)}%` : "—"}</div>
            </div>
          </div>
        )}
      </div>

      {openTrade && (
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-xs ${
          openTrade.mode === "live" ? "border-warn/30 bg-warn/5" : "border-accent/25 bg-accent/5"
        }`}>
          <DirectionBadge direction={openTrade.direction} />
          <ModeBadge mode={openTrade.mode} />
          <span>
            Posição aberta {ago(openTrade.created_at)} · entrada <span className="num">{fmtPrice(openTrade.entry_price)}</span>
            {" · "}SL <span className="num text-down">{fmtPrice(openTrade.stop_loss)}</span>
            {" · "}TP <span className="num text-up">{fmtPrice(openTrade.tp1_hit ? openTrade.take_profit2 ?? openTrade.take_profit1 : openTrade.take_profit1)}</span>
            {openTrade.tp1_hit ? " · TP1 atingido, runner em trailing" : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {/* Chart */}
        <div className="xl:col-span-3">
          <Panel
            title={`${symbol}/USDT`}
            aside={
              <div className="flex items-center gap-2">
                {candlesRes && <SourceTag>{SOURCE_LABEL[candlesRes.source] ?? candlesRes.source}</SourceTag>}
                <Segmented value={tf} onChange={setTf} options={TIMEFRAMES.map(t => ({ value: t.value, label: t.label }))} />
              </div>
            }
          >
            {candlesLoading ? (
              <Skeleton className="h-[500px] w-full" />
            ) : (
              <CandleChart candles={candles} height={500} priceLines={priceLines} emaPeriods={[50, 200]} rightAlign />
            )}
          </Panel>
        </div>

        {/* Rail */}
        <div className="space-y-4">
          {gates && coin && (
            <Panel title={`Gates do engine para ${symbol}`}>
              <div className="space-y-0.5">
                <GateRow
                  label="Volume 24h"
                  value={`$${fmtCompact(coin.volume24h)}`}
                  pass={coin.volume24h >= gates.minVolumeUsdt}
                  detail={`mínimo $${fmtCompact(gates.minVolumeUsdt)}`}
                />
                <GateRow
                  label="Spread"
                  value={coin.spreadPct != null ? `${(coin.spreadPct * 100).toFixed(3)}%` : "—"}
                  pass={coin.spreadPct != null ? coin.spreadPct <= gates.maxSpreadPct : null}
                  detail={`máximo ${(gates.maxSpreadPct * 100).toFixed(2)}%`}
                />
                <GateRow
                  label="Funding → LONGs"
                  value={coin.fundingRate != null ? `${(coin.fundingRate * 100).toFixed(4)}%` : "—"}
                  pass={coin.fundingRate != null ? coin.fundingRate <= gates.fundingLongMax : null}
                />
                <GateRow
                  label="Funding → SHORTs"
                  value={coin.fundingRate != null ? `${(coin.fundingRate * 100).toFixed(4)}%` : "—"}
                  pass={coin.fundingRate != null ? coin.fundingRate >= gates.fundingShortMin : null}
                />
              </div>
              <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
                Um gate a vermelho impede novas entradas neste símbolo; posições abertas não são afetadas.
              </p>
            </Panel>
          )}

          <Panel title="Sinais das estratégias ativas" aside={<SourceTag>registry do engine</SourceTag>} noPadding>
            {!signals ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {signals.strategies.map(s => {
                  const c = getStratColor(s.id);
                  return (
                    <div key={s.id} className="space-y-1.5 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
                          {s.name} · {s.interval}
                        </span>
                        <SignalPill signal={s.signal} />
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{s.reason}</p>
                      {s.entry != null && (
                        <div className="num flex gap-3 text-[11px]">
                          <span>E {fmtPrice(s.entry)}</span>
                          <span className="text-down">SL {fmtPrice(s.stopLoss)}</span>
                          <span className="text-up">TP {fmtPrice(s.takeProfit)}</span>
                        </div>
                      )}
                      {!s.inUniverse && (
                        <p className="text-[10px] text-muted-foreground/60">
                          Fora do universo validado desta estratégia — o engine não abre trades aqui.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title={`Trades do bot em ${symbol}`} noPadding>
            {symbolTrades.length === 0 ? (
              <EmptyState title="O bot nunca negociou este símbolo" />
            ) : (
              <div className="divide-y divide-border/50">
                {symbolTrades.map(t => {
                  const r = tradeR(t);
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <DirectionBadge direction={t.direction} />
                        <ModeBadge mode={t.mode} />
                        <span className="text-[11px] text-muted-foreground">{ago(t.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.outcome === "open" ? (
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">open</span>
                        ) : (
                          <>
                            {r != null && <Pnl value={r} format={fmtR} className="text-[11px]" />}
                            <Pnl value={t.pnl_usd} format={v => fmtUsd(v, { sign: true })} className="text-xs" />
                          </>
                        )}
                        <button
                          onClick={() => setChartTrade(t)}
                          title="Ver gráfico do trade"
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-card-2 hover:text-foreground"
                        >
                          <BarChart2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {chartTrade && <TradeChartModal trade={chartTrade} onClose={() => setChartTrade(null)} />}
    </Page>
  );
}
