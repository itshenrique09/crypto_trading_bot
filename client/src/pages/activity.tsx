import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Activity, Radio, RefreshCw, Search } from "lucide-react";
import {
  useEngineConfig, useForceScan, useFundingCarry, usePaperStatus, useScanLog, useStrategies,
} from "@/lib/api";
import { ago, fmtCompact, fmtUsd } from "@/lib/format";
import { getStratColor, getStratName } from "@/lib/types";
import { Page, PageHeader, Panel, Segmented, EmptyState, Pnl, SourceTag } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

type ResultFilter = "all" | "opened" | "filtered" | "no_signal";

const RESULT_STYLE: Record<string, { label: string; cls: string }> = {
  opened: { label: "ABRIU", cls: "bg-up/10 text-up" },
  filtered: { label: "FILTRADO", cls: "bg-warn/10 text-warn" },
  no_signal: { label: "SEM SINAL", cls: "bg-secondary text-muted-foreground" },
};

export default function ActivityPage() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [search, setSearch] = useState("");

  const { data: scanLog = [], isLoading } = useScanLog();
  const { data: paper } = usePaperStatus();
  const { data: strategies } = useStrategies();
  const { data: config } = useEngineConfig();
  const { data: carry } = useFundingCarry();
  const forceScan = useForceScan();

  const entries = useMemo(() => {
    const q = search.trim().toUpperCase();
    return scanLog.filter(e => {
      if (filter !== "all" && e.result !== filter) return false;
      if (q && !e.symbol.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [scanLog, filter, search]);

  const counts = useMemo(() => ({
    opened: scanLog.filter(e => e.result === "opened").length,
    filtered: scanLog.filter(e => e.result === "filtered").length,
    no_signal: scanLog.filter(e => e.result === "no_signal").length,
  }), [scanLog]);

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Radio className="h-4.5 w-4.5 text-accent" />
            Atividade do bot
          </span>
        }
        subtitle={
          paper?.lastScan
            ? `Scan a cada ${config?.scan.scanEveryMinutes ?? 3} min · gestão de posições a cada ${config?.scan.checkEverySeconds ?? 30}s · último scan ${ago(paper.lastScan)}`
            : "O que o engine avaliou e porquê"
        }
        actions={
          <button
            onClick={() => forceScan.mutate()}
            disabled={forceScan.isPending || !paper?.running}
            title={paper?.running ? "Corre um ciclo de gestão + scan imediatamente" : "O paper engine está parado"}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card-2 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${forceScan.isPending ? "animate-spin" : ""}`} />
            {forceScan.isPending ? "A correr…" : "Forçar scan agora"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Scan feed */}
        <Panel
          className="xl:col-span-2"
          title="Decisões do scanner"
          aside={
            <div className="flex items-center gap-2">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: `Tudo (${scanLog.length})` },
                  { value: "opened", label: `Abriu (${counts.opened})` },
                  { value: "filtered", label: `Filtrado (${counts.filtered})` },
                  { value: "no_signal", label: `Sem sinal (${counts.no_signal})` },
                ]}
              />
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Símbolo"
                  className="h-[26px] w-24 rounded-md border border-border bg-card-2 pl-6 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-accent/50"
                />
              </div>
            </div>
          }
          noPadding
        >
          {isLoading ? (
            <EmptyState title="A carregar…" />
          ) : entries.length === 0 ? (
            <EmptyState
              title={scanLog.length === 0 ? "Ainda sem eventos de scan" : "Sem eventos para este filtro"}
              hint={scanLog.length === 0 ? "O feed enche a cada ciclo de scan (memória do processo — limpa ao reiniciar)." : undefined}
            />
          ) : (
            <div className="max-h-[560px] divide-y divide-border/40 overflow-auto">
              {entries.map((e, i) => {
                const style = RESULT_STYLE[e.result] ?? RESULT_STYLE.no_signal;
                const c = getStratColor(e.strategy);
                return (
                  <div key={`${e.time}-${e.symbol}-${i}`} className="flex items-start gap-3 px-4 py-2">
                    <span className="num w-14 shrink-0 pt-0.5 text-[10px] text-muted-foreground">
                      {new Date(e.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      onClick={() => navigate(`/markets/${e.symbol}`)}
                      className="w-14 shrink-0 pt-0.5 text-left text-xs font-medium hover:underline"
                    >
                      {e.symbol}
                    </button>
                    <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold", style.cls)}>
                      {style.label}
                    </span>
                    <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium", c.bg, c.text)}>
                      {getStratName(e.strategy, strategies)}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {e.reason}
                      {e.signal ? ` · sinal ${e.signal}${e.confidence != null ? ` (${e.confidence}%)` : ""}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {/* Strategies */}
          <Panel title="Estratégias ativas" aside={<SourceTag>registry do engine</SourceTag>} noPadding>
            <div className="divide-y divide-border/50">
              {(strategies ?? []).map(s => {
                const c = getStratColor(s.id);
                const counts = paper?.strategyCounts?.[s.id];
                const paused = paper?.intelligence?.pausedStrategies.includes(s.id);
                return (
                  <div key={s.id} className="space-y-1 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
                        {s.name} · {s.interval}
                      </span>
                      {paused ? (
                        <span className="rounded bg-warn/10 px-1.5 py-0.5 text-[9px] font-semibold text-warn">PAUSADA</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {counts ? `${counts.open} abertas · ${counts.total} total` : "—"}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{s.description}</p>
                    <div className="num text-[10px] text-muted-foreground/70">
                      universo {s.preferredSymbols.length} moedas
                      {s.cooldownHours != null ? ` · cooldown ${s.cooldownHours}h` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Engine parameters */}
          {config && (
            <Panel title="Parâmetros do engine" aside={<SourceTag>código do engine</SourceTag>}>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Posições máx.</span><span className="num">{config.portfolio.maxOpenPositions} · {config.portfolio.maxPerCorrelationGroup}/grupo · 1/símbolo</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Halt diário / rolling {config.portfolio.rollingWindowDays}d</span><span className="num">−{config.portfolio.dailyDrawdownHaltR}R / −{config.portfolio.rollingDrawdownHaltR}R</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kill-switch</span><span className="num">≥{config.portfolio.killSwitchMinTrades} trades 7d, netR &lt; {config.portfolio.killSwitchMaxNetR}R</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TP1 fecha</span><span className="num">{config.exits.tp1PartialClosePct * 100}% → SL a break-even</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max hold</span><span className="num">{Object.entries(config.exits.maxHoldHoursByInterval).map(([k, v]) => `${k}: ${v}h`).join(" · ")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Volume / spread / R:R</span><span className="num">≥${fmtCompact(config.riskGates.minVolumeUsdt)} · ≤{(config.riskGates.maxSpreadPct * 100).toFixed(2)}% · ≥1:{config.riskGates.minRiskReward}</span></div>
              </div>
            </Panel>
          )}

          {/* Funding carry observer */}
          {carry && (
            <Panel
              title={<span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Funding carry (observador)</span>}
              aside={carry.updatedAt && <span className="text-[10px] text-muted-foreground">{ago(carry.updatedAt)}</span>}
            >
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Posições simuladas</span>
                  <span className="num">{carry.portfolio.openPositions.length} / {carry.config.maxPositions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acumulado − custos</span>
                  <Pnl value={carry.portfolio.accruedOpenUsd - carry.portfolio.openEntryCostsUsd} format={v => fmtUsd(v, { sign: true })} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Realizado</span>
                  <Pnl value={carry.portfolio.realizedUsd} format={v => fmtUsd(v, { sign: true })} />
                </div>
                {carry.portfolio.openPositions.map(p => (
                  <div key={p.symbol} className="flex items-center justify-between rounded-md border border-border bg-card-2/50 px-2.5 py-1.5">
                    <span className="font-medium">{p.symbol}</span>
                    <span className="num text-muted-foreground">{p.entryAnnualizedPct.toFixed(0)}%/ano</span>
                    <Pnl value={p.accruedUsd - p.entryCostUsd} format={v => fmtUsd(v, { sign: true })} />
                  </div>
                ))}
                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground/70">
                  Simulação delta-neutral (short perp + long spot). Nunca coloca ordens — valida a estratégia de carry antes de qualquer execução.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}
