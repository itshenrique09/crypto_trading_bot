// Risk-guard state, computed EXACTLY like the engine computes it
// (sum of pnl_usd since midnight / last 7d vs −NR × oneR) so what the user
// sees is what the scan loop enforces.

import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { EngineConfig, JournalEntry } from "@/lib/types";
import { fmtUsd } from "@/lib/format";
import { Panel } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

interface Props {
  mode: "paper" | "live";
  journal: JournalEntry[];
  /** Current 1R in USD (paper: capital.oneR; live: balance × risk% — estimated). */
  oneR: number | null;
  oneRIsEstimate?: boolean;
  config?: EngineConfig;
  openCount: number;
  pausedStrategies?: string[];
  strategyNames?: Record<string, string>;
}

function sumPnlUsdSince(trades: JournalEntry[], sinceMs: number): number {
  let sum = 0;
  for (const t of trades) {
    if (!t.closed_at) continue;
    if (new Date(t.closed_at).getTime() < sinceMs) continue;
    sum += t.pnl_usd ?? 0;
  }
  return sum;
}

function GuardRow({
  label, valueUsd, limitUsd, oneR,
}: { label: string; valueUsd: number; limitUsd: number | null; oneR: number | null }) {
  const rValue = oneR && oneR > 0 ? valueUsd / oneR : null;
  // Progress toward the halt: 0 when flat/positive, 1 when the limit is hit.
  const frac = limitUsd && limitUsd < 0 ? Math.min(1, Math.max(0, valueUsd / limitUsd)) : 0;
  const breached = limitUsd != null && valueUsd < limitUsd;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="num">
          <span className={valueUsd < 0 ? "text-down" : valueUsd > 0 ? "text-up" : "text-muted-foreground"}>
            {fmtUsd(valueUsd, { sign: true })}
          </span>
          {rValue != null && (
            <span className="text-muted-foreground"> ({rValue > 0 ? "+" : ""}{rValue.toFixed(1)}R)</span>
          )}
        </span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-card-2">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", breached ? "bg-down" : frac > 0.6 ? "bg-warn" : "bg-muted-foreground/40")}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>{breached ? "LIMITE ATINGIDO — entradas pausadas" : "dentro do limite"}</span>
        <span className="num">halt em {limitUsd != null ? fmtUsd(limitUsd) : "—"}</span>
      </div>
    </div>
  );
}

export default function GuardsPanel({
  mode, journal, oneR, oneRIsEstimate, config, openCount, pausedStrategies, strategyNames,
}: Props) {
  const trades = journal.filter(t => t.mode === mode);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dailyPnl = sumPnlUsdSince(trades, todayStart.getTime());

  const rollingDays = config?.portfolio.rollingWindowDays ?? 7;
  const rollingPnl = sumPnlUsdSince(trades, Date.now() - rollingDays * 86_400_000);

  const dailyLimit = oneR && config ? -config.portfolio.dailyDrawdownHaltR * oneR : null;
  const rollingLimit = oneR && config ? -config.portfolio.rollingDrawdownHaltR * oneR : null;

  const maxOpen = config?.portfolio.maxOpenPositions ?? 10;
  const anyPaused = (pausedStrategies?.length ?? 0) > 0;

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          {anyPaused ? <ShieldAlert className="h-3.5 w-3.5 text-warn" /> : <ShieldCheck className="h-3.5 w-3.5 text-up" />}
          Guards de risco
        </span>
      }
      aside={oneR != null && (
        <span className="num text-[11px] text-muted-foreground">
          1R = {fmtUsd(oneR)}{oneRIsEstimate ? " (estimado)" : ""}
        </span>
      )}
    >
      <div className="space-y-4">
        <GuardRow label="P&L de hoje vs halt diário" valueUsd={dailyPnl} limitUsd={dailyLimit} oneR={oneR} />
        <GuardRow label={`P&L ${rollingDays} dias vs halt rolling`} valueUsd={rollingPnl} limitUsd={rollingLimit} oneR={oneR} />

        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Posições usadas</span>
          <span className="num">
            {openCount} / {maxOpen}
            <span className="text-muted-foreground"> · máx {config?.portfolio.maxPerCorrelationGroup ?? "—"}/grupo · 1/símbolo</span>
          </span>
        </div>

        {pausedStrategies && (
          <div className="border-t border-border pt-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              Kill-switch por estratégia
              {config && (
                <span className="normal-case tracking-normal"> (≥{config.portfolio.killSwitchMinTrades} trades 7d e netR &lt; {config.portfolio.killSwitchMaxNetR}R)</span>
              )}
            </div>
            {pausedStrategies.length === 0 ? (
              <p className="text-xs text-up">Nenhuma estratégia pausada</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {pausedStrategies.map(id => (
                  <span key={id} className="rounded bg-warn/10 px-2 py-0.5 text-[11px] font-medium text-warn">
                    {strategyNames?.[id] ?? id} — pausada
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
