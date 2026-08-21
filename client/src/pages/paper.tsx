import { useMemo } from "react";
import { Link } from "wouter";
import { FlaskConical, Settings2 } from "lucide-react";
import {
  useEngineConfig, useJournal, usePaperPrices, usePaperStatus, useStrategies,
  usePaperStart, usePaperStop,
} from "@/lib/api";
import { ago, fmtPF, fmtR, fmtUsd, rMetrics } from "@/lib/format";
import { canonicalStratId, getStratColor, getStratName } from "@/lib/types";
import { Page, PageHeader, Panel, StatCard, SourceTag, EmptyState, Th, Td, Pnl } from "@/components/ui-kit";
import GuardsPanel from "@/components/mode/GuardsPanel";
import EquityCurve from "@/components/mode/EquityCurve";
import { PaperPositionsTable } from "@/components/mode/PositionsTable";
import HistorySection from "@/components/mode/HistorySection";

export default function PaperPage() {
  const { data: paper } = usePaperStatus();
  const { data: journal = [] } = useJournal();
  const { data: strategies } = useStrategies();
  const { data: config } = useEngineConfig();
  const { data: prices = [] } = usePaperPrices(!!paper?.running);

  const start = usePaperStart();
  const stop = usePaperStop();

  const m = useMemo(() => rMetrics(journal.filter(t => t.mode === "paper")), [journal]);
  const openCount = journal.filter(t => t.mode === "paper" && t.outcome === "open").length;

  const strategyNames = useMemo(
    () => Object.fromEntries((strategies ?? []).map(s => [s.id, s.name])),
    [strategies],
  );

  const byStrategy = useMemo(() => {
    const paperTrades = journal.filter(t => t.mode === "paper");
    const ids = Array.from(new Set(paperTrades.map(t => canonicalStratId(t.strategy)).filter(Boolean)));
    return ids
      .map(id => ({ id, m: rMetrics(paperTrades.filter(t => canonicalStratId(t.strategy) === id)) }))
      .filter(s => s.m.count > 0)
      .sort((a, b) => b.m.netR - a.m.netR);
  }, [journal]);

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4.5 w-4.5 text-accent" />
            Paper Trading
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Simulado
            </span>
          </span>
        }
        subtitle={
          paper?.lastScan
            ? `Scanner: ${paper.coinsScanned} moedas a cada ${config?.scan.scanEveryMinutes ?? 3} min · último scan ${ago(paper.lastScan)} · regime BTC ${paper.intelligence?.btcRegime?.replace(/_/g, " ") ?? "—"}`
            : "Motor de validação — mesma lógica do live, capital simulado"
        }
        actions={
          paper?.running ? (
            <button
              onClick={() => stop.mutate()}
              className="rounded-md border border-border bg-card-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Parar engine
            </button>
          ) : (
            <button
              onClick={() => start.mutate()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Iniciar engine
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Balance simulado"
          value={paper?.capital ? fmtUsd(paper.capital.balance) : "—"}
          sub={paper?.capital ? `inicial ${fmtUsd(paper.capital.initial, { decimals: 0 })}` : undefined}
        />
        <StatCard
          label="P&L total"
          value={fmtUsd(paper?.capital?.totalPnlUsd ?? null, { sign: true })}
          tone={paper?.capital?.totalPnlUsd}
        />
        <StatCard
          label="Hoje"
          value={fmtUsd(paper?.capital?.todayPnlUsd ?? null, { sign: true })}
          tone={paper?.capital?.todayPnlUsd}
          sub={paper?.capital ? fmtR(paper.capital.todayR) : undefined}
        />
        <StatCard
          label="Net R"
          value={fmtR(m.netR)}
          tone={m.netR}
          sub={`${m.count} fechados · WR ${m.winRate?.toFixed(0) ?? "—"}%`}
        />
        <StatCard
          label="Posições"
          value={`${openCount} / ${config?.portfolio.maxOpenPositions ?? 10}`}
          sub={`risco ${paper?.capital?.riskPct ?? "—"}%/trade · 1R = ${paper?.capital ? fmtUsd(paper.capital.oneR) : "—"}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <EquityCurve mode="paper" journal={journal} />
        </div>
        <GuardsPanel
          mode="paper"
          journal={journal}
          oneR={paper?.capital?.oneR ?? null}
          config={config}
          openCount={openCount}
          pausedStrategies={paper?.intelligence?.pausedStrategies ?? []}
          strategyNames={strategyNames}
          guards={paper?.guards}
        />
      </div>

      <PaperPositionsTable journal={journal} prices={prices} strategies={strategies} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Performance por estratégia" noPadding>
          {byStrategy.length === 0 ? (
            <EmptyState title="Sem trades fechados" />
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-border">
                <tr>
                  <Th className="pl-4">Estratégia</Th>
                  <Th right>Trades</Th>
                  <Th right>WR</Th>
                  <Th right>PF</Th>
                  <Th right className="pr-4">Net R</Th>
                </tr>
              </thead>
              <tbody>
                {byStrategy.map(({ id, m: sm }) => {
                  const c = getStratColor(id);
                  const paused = paper?.intelligence?.pausedStrategies.includes(id);
                  return (
                    <tr key={id} className="border-b border-border/50 last:border-0">
                      <Td className="pl-4">
                        <span className="flex items-center gap-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
                            {getStratName(id, strategies)}
                          </span>
                          {paused && <span className="rounded bg-warn/10 px-1 py-0.5 text-[8px] font-bold text-warn">PAUSADA</span>}
                        </span>
                      </Td>
                      <Td right className="num">{sm.count}</Td>
                      <Td right className="num">{sm.winRate != null ? `${sm.winRate.toFixed(0)}%` : "—"}</Td>
                      <Td right className="num">{sm.profitFactor === Infinity ? "∞" : fmtPF(sm.profitFactor)}</Td>
                      <Td right className="pr-4"><Pnl value={sm.netR} format={fmtR} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Panel>
        <div className="xl:col-span-2">
          <HistorySection mode="paper" journal={journal} strategies={strategies} />
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Capital, risco e alavancagem configuram-se nas{" "}
          <Link href="/settings" className="inline-flex items-center gap-1 text-accent hover:underline">
            <Settings2 className="h-3 w-3" /> Definições
          </Link>
        </span>
        <SourceTag>preços simulação: MEXC Futures</SourceTag>
      </div>
    </Page>
  );
}
