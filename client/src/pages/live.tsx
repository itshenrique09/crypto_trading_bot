import { useMemo } from "react";
import { Link } from "wouter";
import { AlertTriangle, Banknote, KeyRound, ShieldAlert } from "lucide-react";
import {
  useEngineConfig, useJournal, useLiveStatus, useStrategies,
  useLiveStart, useLiveStop, useCloseLive,
} from "@/lib/api";
import { ago, fmtR, fmtUsd, rMetrics } from "@/lib/format";
import { Page, PageHeader, Panel, StatCard, SourceTag } from "@/components/ui-kit";
import { ConfirmButton } from "@/components/ConfirmButton";
import GuardsPanel from "@/components/mode/GuardsPanel";
import EquityCurve from "@/components/mode/EquityCurve";
import { LivePositionsTable } from "@/components/mode/PositionsTable";
import HistorySection from "@/components/mode/HistorySection";

function Onboarding({ exchangeName }: { exchangeName: string }) {
  return (
    <Panel title="Ligar a conta da exchange">
      <div className="max-w-xl space-y-3 text-[13px] leading-relaxed text-muted-foreground">
        <p>
          O modo live executa ordens com <span className="font-medium text-foreground">dinheiro real</span> na{" "}
          {exchangeName}. Ainda não há chaves API configuradas, por isso esta página não tem dados de conta.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Cria uma API key na exchange com permissões de trading em futuros (sem permissão de levantamentos).</li>
          <li>Guarda a key e o secret nas Definições — ficam encriptados na base de dados local.</li>
          <li>Usa "Testar ligação" para confirmar que a conta responde e mostra a margem disponível.</li>
          <li>Inicia o engine — o bot passa a executar os mesmos sinais que validas no Paper.</li>
        </ol>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-md bg-warn px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          <KeyRound className="h-3.5 w-3.5" /> Configurar chaves nas Definições
        </Link>
      </div>
    </Panel>
  );
}

export default function LivePage() {
  const { data: live } = useLiveStatus();
  const { data: journal = [] } = useJournal();
  const { data: strategies } = useStrategies();
  const { data: config } = useEngineConfig();

  const start = useLiveStart();
  const stop = useLiveStop();
  const closeLive = useCloseLive();

  const m = useMemo(() => rMetrics(journal.filter(t => t.mode === "live")), [journal]);

  const exchangeName = live?.exchanges.find(e => e.id === live.exchange)?.name ?? "Kraken Futures";
  // Engine sizing: riskUsd = balance × riskPct% — same formula, labelled as estimate
  // because the balance snapshot refreshes on the engine's 30s cycle.
  const oneR = live?.account?.equity != null && live.riskPct
    ? (live.account.equity * live.riskPct) / 100
    : null;

  const strategyNames = useMemo(
    () => Object.fromEntries((strategies ?? []).map(s => [s.id, s.name])),
    [strategies],
  );

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Banknote className="h-4.5 w-4.5 text-warn" />
            Live Trading
            <span className="rounded bg-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warn">
              Dinheiro real
            </span>
          </span>
        }
        subtitle={
          live?.hasKeys
            ? `${exchangeName} · risco ${live.riskPct}%/trade · alavancagem ${live.leverage}× · snapshot ${live.snapshotAt ? ago(live.snapshotAt) : "—"}${live.running && live.lastScan ? ` · último scan ${ago(live.lastScan)}` : ""}`
            : "Execução real na exchange — requer chaves API"
        }
        actions={
          live?.hasKeys && (live.running ? (
            <ConfirmButton
              title="Parar o live engine?"
              description="Posições abertas mantêm-se na exchange mas deixam de ser geridas (SL/TP/trailing) até reiniciares."
              confirmText="Parar live"
              onConfirm={() => stop.mutate()}
            >
              <button className="rounded-md border border-warn/40 bg-warn/10 px-3 py-1.5 text-xs font-medium text-warn transition-colors hover:bg-warn/20">
                Parar engine
              </button>
            </ConfirmButton>
          ) : (
            <ConfirmButton
              title="Iniciar trading com dinheiro real?"
              description={`${exchangeName} · risco ${live.riskPct}% por trade · alavancagem ${live.leverage}×. O bot abre e gere posições autonomamente.`}
              confirmText="Iniciar live"
              destructive={false}
              onConfirm={() => start.mutate()}
            >
              <button className="rounded-md bg-warn px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90">
                Iniciar engine
              </button>
            </ConfirmButton>
          ))
        }
      />

      {live?.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-down/30 bg-down/5 px-4 py-3 text-xs text-down">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Live engine em erro — novas entradas pausadas</div>
            <div className="mt-0.5 text-down/80">{live.error}</div>
          </div>
        </div>
      )}
      {!!live?.unmanagedPositions && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-xs text-warn">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">
              {live.unmanagedPositions} posição(ões) na exchange sem registo no bot
            </div>
            <div className="mt-0.5 text-warn/80">
              O bot pausa novas entradas até a posição ser fechada manualmente na exchange ou registada no histórico.
            </div>
          </div>
        </div>
      )}

      {!live?.hasKeys ? (
        <Onboarding exchangeName={exchangeName} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="Equity"
              value={live.account ? fmtUsd(live.account.equity) : "—"}
              sub={<SourceTag>{exchangeName}</SourceTag>}
            />
            <StatCard
              label="Margem disponível"
              value={live.account ? fmtUsd(live.account.available) : "—"}
              sub={live.account?.usedMargin != null ? `${fmtUsd(live.account.usedMargin)} em uso` : undefined}
            />
            <StatCard
              label="P&L não realizado"
              value={fmtUsd(live.account?.unrealizedPnl ?? null, { sign: true })}
              tone={live.account?.unrealizedPnl}
              sub={`${live.positions.length} posições abertas`}
            />
            <StatCard
              label="Hoje"
              value={fmtUsd(live.todayPnlUsd, { sign: true })}
              tone={live.todayPnlUsd}
              sub={live.running ? "engine a correr" : "engine parado"}
            />
            <StatCard
              label="Net R"
              value={fmtR(m.netR)}
              tone={m.netR}
              sub={`${m.count} fechados · total ${fmtUsd(live.totalPnlUsd, { sign: true })}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <EquityCurve mode="live" journal={journal} />
            </div>
            <GuardsPanel
              mode="live"
              journal={journal}
              oneR={oneR}
              oneRIsEstimate
              config={config}
              openCount={live.positions.length}
              pausedStrategies={live.pausedStrategies ?? []}
              strategyNames={strategyNames}
              guards={live.guards}
            />
          </div>

          <LivePositionsTable
            positions={live.positions}
            journal={journal}
            strategies={strategies}
            exchangeName={exchangeName}
            snapshotNote={live.snapshotAt ? `snapshot ${ago(live.snapshotAt)}` : undefined}
            onClose={id => closeLive.mutate(id)}
          />

          <HistorySection mode="live" journal={journal} strategies={strategies} />
        </>
      )}
    </Page>
  );
}
