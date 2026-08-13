// Closed-trade history for ONE mode, with filters and R-metrics that follow
// the filter. Open positions live in PositionsTable — this is the audit log.

import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { BarChart2, Download, Search, Trash2, Upload } from "lucide-react";
import type { JournalEntry, StrategyInfo } from "@/lib/types";
import { canonicalStratId, getStratColor, getStratName } from "@/lib/types";
import { ago, fmtPct, fmtPF, fmtPrice, fmtR, fmtUsd, heldFor, pnlClass, rMetrics, tradeR } from "@/lib/format";
import { Panel, Segmented, EmptyState, Th, Td, DirectionBadge, Pnl } from "@/components/ui-kit";
import { ConfirmButton } from "@/components/ConfirmButton";
import TradeChartModal from "@/components/TradeChartModal";
import { useAction } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

/** Downloads the SERVER-side full export (the list endpoint caps at 200 rows). */
async function downloadExport(mode: "paper" | "live", setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    const res = await apiRequest("GET", `/api/journal/export?mode=${mode}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast({ variant: "destructive", title: "Export falhou", description: (err as Error).message });
  } finally {
    setBusy(false);
  }
}

/** Restores a previously exported JSON file. Duplicates are skipped server-side. */
async function uploadImport(file: File, setBusy: (b: boolean) => void) {
  setBusy(true);
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const res = await apiRequest("POST", "/api/journal/import", parsed);
    const result = await res.json() as { imported: number; skipped: number; invalid: number; total: number };
    toast({
      description: `Import: ${result.imported} novos, ${result.skipped} duplicados ignorados${result.invalid ? `, ${result.invalid} inválidos` : ""} (${result.total} no ficheiro)`,
      variant: result.invalid > 0 ? "destructive" : undefined,
    });
  } catch (err) {
    toast({ variant: "destructive", title: "Import falhou", description: (err as Error).message });
  } finally {
    setBusy(false);
  }
}

type StateFilter = "all" | "wins" | "losses";

export default function HistorySection({
  mode, journal, strategies,
}: {
  mode: "paper" | "live";
  journal: JournalEntry[];
  strategies?: StrategyInfo[];
}) {
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [chartTrade, setChartTrade] = useState<JournalEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deleteTrade = useAction(
    (id: number) => apiRequest("DELETE", `/api/journal/${id}`),
    { invalidates: ["/api/journal"], successMessage: "Registo apagado" },
  );

  const closed = useMemo(
    () => journal.filter(t => t.mode === mode && t.outcome !== "open"),
    [journal, mode],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return closed.filter(t => {
      if (stateFilter === "wins" && t.outcome !== "win") return false;
      if (stateFilter === "losses" && t.outcome !== "loss") return false;
      if (strategyFilter !== "all" && canonicalStratId(t.strategy) !== strategyFilter) return false;
      if (q && !t.symbol.includes(q)) return false;
      return true;
    });
  }, [closed, stateFilter, strategyFilter, search]);

  const m = useMemo(() => rMetrics(filtered), [filtered]);
  const strategyIds = useMemo(
    () => Array.from(new Set(closed.map(t => canonicalStratId(t.strategy)).filter(Boolean))),
    [closed],
  );

  return (
    <Panel
      title={`Histórico ${mode === "live" ? "live" : "paper"} · ${closed.length} fechados`}
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <span className="num text-[11px] text-muted-foreground">
            {m.count > 0 && (
              <>
                <span className={pnlClass(m.netR)}>{fmtR(m.netR)}</span>
                {" · WR "}{m.winRate?.toFixed(0)}%{" · PF "}{m.profitFactor === Infinity ? "∞" : fmtPF(m.profitFactor)}
              </>
            )}
          </span>
          <Segmented
            value={stateFilter}
            onChange={setStateFilter}
            options={[
              { value: "all", label: "Tudo" },
              { value: "wins", label: "Ganhos" },
              { value: "losses", label: "Perdas" },
            ]}
          />
          {strategyIds.length > 1 && (
            <select
              value={strategyFilter}
              onChange={e => setStrategyFilter(e.target.value)}
              className="h-[26px] rounded-md border border-border bg-card-2 px-2 text-xs text-foreground outline-none focus:border-accent/50"
            >
              <option value="all">Estratégias</option>
              {strategyIds.map(id => (
                <option key={id} value={id}>{getStratName(id, strategies)}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Símbolo"
              className="h-[26px] w-24 rounded-md border border-border bg-card-2 pl-6 pr-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-accent/50"
            />
          </div>
          <button
            onClick={() => downloadExport(mode, setExporting)}
            disabled={exporting}
            title={`Descarrega TODOS os trades ${mode} em JSON (sem o limite de 200 da listagem)`}
            className="flex h-[26px] items-center gap-1.5 rounded-md border border-border bg-card-2 px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {exporting ? "A exportar…" : "Exportar JSON"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Restaura um ficheiro exportado — duplicados são ignorados, IDs são reatribuídos"
            className="flex h-[26px] items-center gap-1.5 rounded-md border border-border bg-card-2 px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />
            {importing ? "A importar…" : "Importar"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) uploadImport(file, setImporting);
              e.target.value = "";
            }}
          />
        </div>
      }
      noPadding
    >
      {filtered.length === 0 ? (
        <EmptyState title={closed.length === 0 ? "Ainda sem trades fechados" : "Sem trades para este filtro"} />
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 border-b border-border bg-card">
              <tr>
                <Th className="pl-4">Símbolo</Th>
                <Th>Estratégia</Th>
                <Th>Resultado</Th>
                <Th right>Entrada</Th>
                <Th right>Saída</Th>
                <Th right>P&L</Th>
                <Th right>R</Th>
                <Th right>Duração</Th>
                <Th right>Fechado</Th>
                <Th right className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const r = tradeR(t);
                const c = getStratColor(t.strategy);
                return (
                  <tr key={t.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-card-2/40">
                    <Td className="pl-4">
                      <Link href={`/markets/${t.symbol}`} className="flex items-center gap-2 hover:underline">
                        <span className="text-[13px] font-medium">{t.symbol}</span>
                        <DirectionBadge direction={t.direction} />
                      </Link>
                    </Td>
                    <Td>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
                        {getStratName(t.strategy, strategies)}
                      </span>
                    </Td>
                    <Td>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        t.outcome === "win" ? "bg-up/10 text-up" : t.outcome === "loss" ? "bg-down/10 text-down" : "bg-secondary text-muted-foreground"
                      }`}>
                        {t.outcome}
                      </span>
                    </Td>
                    <Td right className="num">{fmtPrice(t.entry_price)}</Td>
                    <Td right className="num">{fmtPrice(t.exit_price)}</Td>
                    <Td right>
                      <div className="flex flex-col items-end leading-tight">
                        <Pnl value={t.pnl_usd} format={v => fmtUsd(v, { sign: true })} />
                        {t.pnl_pct != null && <span className={`num text-[10px] ${pnlClass(t.pnl_pct)}`}>{fmtPct(t.pnl_pct)}</span>}
                      </div>
                    </Td>
                    <Td right>{r != null ? <Pnl value={r} format={fmtR} className="text-xs" /> : <span className="text-muted-foreground">—</span>}</Td>
                    <Td right className="text-[11px] text-muted-foreground">{heldFor(t.created_at, t.closed_at)}</Td>
                    <Td right className="text-[11px] text-muted-foreground">{ago(t.closed_at)}</Td>
                    <Td right className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setChartTrade(t)}
                          title="Ver gráfico do trade"
                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-card-2 hover:text-foreground"
                        >
                          <BarChart2 className="h-3.5 w-3.5" />
                        </button>
                        <ConfirmButton
                          title="Apagar este registo?"
                          description="Remove o trade do histórico permanentemente."
                          confirmText="Apagar"
                          onConfirm={() => deleteTrade.mutate(t.id)}
                        >
                          <button title="Apagar" className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-down/10 hover:text-down">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </ConfirmButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {chartTrade && <TradeChartModal trade={chartTrade} onClose={() => setChartTrade(null)} />}
    </Panel>
  );
}
