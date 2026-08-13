// Open positions for ONE mode. Live rows come from the venue snapshot
// (/api/live/status.positions — Kraken/MEXC data); paper rows come from the
// journal + simulated marks (/api/paper/prices). Never mixed.

import { useLocation } from "wouter";
import type { JournalEntry, LivePosition, PaperPrice, StrategyInfo } from "@/lib/types";
import { fmtPct, fmtPrice, fmtUsd, heldFor, pnlClass } from "@/lib/format";
import { getStratColor, getStratName } from "@/lib/types";
import { Panel, EmptyState, Th, Td, DirectionBadge, Pnl, SourceTag } from "@/components/ui-kit";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useClosePaper } from "@/lib/api";

function StratChip({ id, strategies }: { id?: string; strategies?: StrategyInfo[] }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  const c = getStratColor(id);
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
      {getStratName(id, strategies)}
    </span>
  );
}

// ── LIVE ─────────────────────────────────────────────────────────────

export function LivePositionsTable({
  positions, journal, strategies, exchangeName, snapshotNote, onClose,
}: {
  positions: LivePosition[];
  journal: JournalEntry[];
  strategies?: StrategyInfo[];
  exchangeName: string;
  snapshotNote?: string;
  onClose: (journalId: number) => void;
}) {
  const [, navigate] = useLocation();
  const openLive = journal.filter(j => j.mode === "live" && j.outcome === "open");

  return (
    <Panel
      title={`Posições na exchange${positions.length ? ` · ${positions.length}` : ""}`}
      aside={<SourceTag>{exchangeName}{snapshotNote ? ` · ${snapshotNote}` : ""}</SourceTag>}
      noPadding
    >
      {positions.length === 0 ? (
        <EmptyState title="Sem posições abertas na exchange" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border">
              <tr>
                <Th className="pl-4">Símbolo</Th>
                <Th>Estratégia</Th>
                <Th right>Entrada</Th>
                <Th right>Mark</Th>
                <Th right>Nocional</Th>
                <Th right>P&L não real.</Th>
                <Th right>Funding acum.</Th>
                <Th right>Proteção (venue)</Th>
                <Th right>Idade</Th>
                <Th right className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {positions.map(p => {
                const j = openLive.find(t => t.symbol === p.botSymbol && t.direction === p.direction);
                const pnlPct = p.notionalUsd ? (p.unrealizedPnl / p.notionalUsd) * 100 : null;
                return (
                  <tr
                    key={`${p.botSymbol}-${p.direction}`}
                    className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-card-2/60"
                    onClick={() => navigate(`/markets/${p.botSymbol}`)}
                  >
                    <Td className="pl-4 font-medium">
                      <span className="flex items-center gap-2">
                        {p.botSymbol}
                        <DirectionBadge direction={p.direction} />
                        {!j && (
                          <span className="rounded bg-down/10 px-1.5 py-0.5 text-[10px] font-semibold text-down" title="Posição na exchange sem registo no bot — novas entradas pausadas até resolver">
                            NÃO GERIDA
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td><StratChip id={j?.strategy} strategies={strategies} /></Td>
                    <Td right className="num">{fmtPrice(p.entryPrice)}</Td>
                    <Td right className="num">{fmtPrice(p.markPrice)}</Td>
                    <Td right className="num text-muted-foreground">{p.notionalUsd != null ? fmtUsd(p.notionalUsd, { decimals: 0 }) : "—"}</Td>
                    <Td right>
                      <div className="flex flex-col items-end leading-tight">
                        <Pnl value={p.unrealizedPnl} format={v => fmtUsd(v, { sign: true })} />
                        {pnlPct != null && <span className={`num text-[10px] ${pnlClass(pnlPct)}`}>{fmtPct(pnlPct)}</span>}
                      </div>
                    </Td>
                    <Td right className="num text-[11px] text-muted-foreground">
                      {p.unrealizedFunding != null ? fmtUsd(p.unrealizedFunding, { sign: true }) : "—"}
                    </Td>
                    <Td right className="num text-[11px]">
                      {p.protection ? (
                        <>
                          <span className="text-down">{fmtPrice(p.protection.stop)}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-up">{fmtPrice(p.protection.takeProfit)}</span>
                        </>
                      ) : (
                        <span className="text-warn" title="Sem ordens de proteção visíveis na exchange">sem proteção</span>
                      )}
                    </Td>
                    <Td right className="text-muted-foreground">{j ? heldFor(j.created_at) : "—"}</Td>
                    <Td right className="pr-4">
                      {j && (
                        <span onClick={e => e.stopPropagation()}>
                          <ConfirmButton
                            title={`Fechar ${p.botSymbol} a mercado?`}
                            description="A posição é fechada na exchange ao preço atual e o registo reconciliado."
                            confirmText="Fechar posição"
                            onConfirm={() => onClose(j.id)}
                          >
                            <button className="rounded border border-down/40 px-2 py-1 text-[10px] font-medium text-down transition-colors hover:bg-down/10">
                              Fechar
                            </button>
                          </ConfirmButton>
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ── PAPER ────────────────────────────────────────────────────────────

export function PaperPositionsTable({
  journal, prices, strategies,
}: {
  journal: JournalEntry[];
  prices: PaperPrice[];
  strategies?: StrategyInfo[];
}) {
  const [, navigate] = useLocation();
  const closePaper = useClosePaper();
  const open = journal.filter(t => t.mode === "paper" && t.outcome === "open");
  const priceById = new Map(prices.map(p => [p.id, p]));

  return (
    <Panel
      title={`Posições simuladas${open.length ? ` · ${open.length}` : ""}`}
      aside={<SourceTag>simulação · marks MEXC Futures</SourceTag>}
      noPadding
    >
      {open.length === 0 ? (
        <EmptyState title="Sem posições simuladas abertas" hint="O scanner abre posições quando um setup passa todos os gates." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border">
              <tr>
                <Th className="pl-4">Símbolo</Th>
                <Th>Estratégia</Th>
                <Th right>Entrada</Th>
                <Th right>Mark</Th>
                <Th right>Tamanho</Th>
                <Th right>P&L não real.</Th>
                <Th right>SL / TP</Th>
                <Th right>Idade</Th>
                <Th right className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {open.map(t => {
                const p = priceById.get(t.id);
                const tp = t.tp1_hit ? t.take_profit2 ?? t.take_profit1 : t.take_profit1;
                return (
                  <tr
                    key={t.id}
                    className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-card-2/60"
                    onClick={() => navigate(`/markets/${t.symbol}`)}
                  >
                    <Td className="pl-4 font-medium">
                      <span className="flex items-center gap-2">
                        {t.symbol}
                        <DirectionBadge direction={t.direction} />
                        {!!t.tp1_hit && (
                          <span className="rounded bg-up/10 px-1.5 py-0.5 text-[9px] font-semibold text-up" title="TP1 atingido — 60% fechado, runner em trailing">
                            TP1 ✓
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td><StratChip id={t.strategy} strategies={strategies} /></Td>
                    <Td right className="num">{fmtPrice(t.entry_price)}</Td>
                    <Td right className="num">{fmtPrice(p?.currentPrice)}</Td>
                    <Td right className="num text-muted-foreground">
                      {fmtUsd(t.remaining_position_size_usd ?? t.position_size_usd, { decimals: 0 })}
                    </Td>
                    <Td right>
                      <div className="flex flex-col items-end leading-tight">
                        <Pnl value={p?.unrealizedUsd ?? null} format={v => fmtUsd(v, { sign: true })} />
                        {p && <span className={`num text-[10px] ${pnlClass(p.unrealizedPnl)}`}>{fmtPct(p.unrealizedPnl)}</span>}
                      </div>
                    </Td>
                    <Td right className="num text-[11px]">
                      <span className="text-down">{fmtPrice(t.stop_loss)}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-up">{fmtPrice(tp)}</span>
                    </Td>
                    <Td right className="text-muted-foreground">{heldFor(t.created_at)}</Td>
                    <Td right className="pr-4">
                      {p && (
                        <span onClick={e => e.stopPropagation()}>
                          <ConfirmButton
                            title={`Fechar ${t.symbol} (simulado) ao mark atual?`}
                            description={`Fecho a ${fmtPrice(p.currentPrice)} — P&L ${fmtUsd((p.realizedPnlUsd ?? 0) + (p.unrealizedUsd ?? 0), { sign: true })} calculado pelo engine.`}
                            confirmText="Fechar posição"
                            destructive={false}
                            onConfirm={() => closePaper.mutate({
                              id: t.id,
                              exitPrice: p.currentPrice,
                              pnlPct: p.unrealizedPnl,
                              pnlUsd: (p.realizedPnlUsd ?? 0) + (p.unrealizedUsd ?? 0),
                            })}
                          >
                            <button className="rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-card-2 hover:text-foreground">
                              Fechar
                            </button>
                          </ConfirmButton>
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
