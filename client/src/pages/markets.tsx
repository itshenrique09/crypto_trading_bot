import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Check, Search, X, Zap } from "lucide-react";
import { useEngineConfig, useMarket } from "@/lib/api";
import { fmtCompact, fmtPct, fmtPrice, pnlClass } from "@/lib/format";
import { Page, PageHeader, Panel, EmptyState, Th, Td, SourceTag } from "@/components/ui-kit";
import Sparkline from "@/components/Sparkline";
import { Skeleton } from "@/components/ui/skeleton";

function ChangeCell({ value }: { value: number | null }) {
  return <span className={`num ${pnlClass(value)}`}>{value != null ? fmtPct(value) : "—"}</span>;
}

function GateCheck({ pass, title }: { pass: boolean; title: string }) {
  return pass ? (
    <Check className="inline h-3 w-3 text-up" aria-label={title} />
  ) : (
    <X className="inline h-3 w-3 text-down" aria-label={title} />
  );
}

export default function MarketsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: market, isLoading } = useMarket();
  const { data: config } = useEngineConfig();

  const coins = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return market ?? [];
    return (market ?? []).filter(c => c.symbol.includes(q) || c.name.toUpperCase().includes(q));
  }, [market, search]);

  const gates = config?.riskGates;

  const fundingExtremes = useMemo(() => {
    const withFunding = (market ?? []).filter(c => c.fundingRate != null);
    const sorted = [...withFunding].sort((a, b) => (b.fundingRate ?? 0) - (a.fundingRate ?? 0));
    return [...sorted.slice(0, 4), ...sorted.slice(-4).reverse()];
  }, [market]);

  const blockedCount = useMemo(() => {
    if (!gates || !market) return null;
    return market.filter(c =>
      c.volume24h < gates.minVolumeUsdt ||
      (c.spreadPct != null && c.spreadPct > gates.maxSpreadPct),
    ).length;
  }, [market, gates]);

  return (
    <Page>
      <PageHeader
        title="Mercados"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {market ? `${market.length} moedas — o universo exato que o engine negoceia` : "Universo de trading"}
            <SourceTag>MEXC Futures · em direto</SourceTag>
            {blockedCount != null && blockedCount > 0 && (
              <span className="text-warn">{blockedCount} bloqueadas por gates agora</span>
            )}
          </span>
        }
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Procurar moeda…"
              className="h-8 w-52 rounded-md border border-border bg-card-2 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent/50"
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Panel className="xl:col-span-3" noPadding>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : coins.length === 0 ? (
            <EmptyState title="Nenhuma moeda encontrada" hint={search ? `Sem resultados para "${search}"` : undefined} />
          ) : (
            <div className="max-h-[calc(100vh-13rem)] overflow-auto">
              {/* Scroll VERTICAL dentro da tabela (não na página): o header fica
                  sempre visível e a página mantém-se estável. border-separate é
                  obrigatório — com border-collapse um thead sticky perde o fundo
                  e as rows aparecem por trás (o bug do BTC atrás do header). */}
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 [&_th]:border-b [&_th]:border-border [&_th]:bg-card">
                  <tr>
                    <Th className="pl-4">#</Th>
                    <Th>Moeda</Th>
                    <Th right>Preço</Th>
                    <Th right>1h</Th>
                    <Th right>24h</Th>
                    <Th right>7d</Th>
                    <Th right title={gates ? `Gate: ≥ $${fmtCompact(gates.minVolumeUsdt)}` : undefined}>
                      Volume 24h
                    </Th>
                    <Th right title={gates ? `Gate: ≤ ${(gates.maxSpreadPct * 100).toFixed(2)}%` : undefined}>
                      Spread
                    </Th>
                    <Th right title={gates ? `Gate: LONGs bloqueados > ${(gates.fundingLongMax * 100).toFixed(1)}%, SHORTs < ${(gates.fundingShortMin * 100).toFixed(1)}%` : undefined}>
                      Funding
                    </Th>
                    <Th right className="hidden md:table-cell pr-4">7 dias</Th>
                  </tr>
                </thead>
                <tbody>
                  {coins.map(c => {
                    const volPass = gates ? c.volume24h >= gates.minVolumeUsdt : true;
                    const spreadPass = gates && c.spreadPct != null ? c.spreadPct <= gates.maxSpreadPct : true;
                    const fundingBlocksLong = gates && c.fundingRate != null && c.fundingRate > gates.fundingLongMax;
                    const fundingBlocksShort = gates && c.fundingRate != null && c.fundingRate < gates.fundingShortMin;
                    return (
                      <tr
                        key={c.symbol}
                        onClick={() => navigate(`/markets/${c.symbol}`)}
                        className="cursor-pointer transition-colors hover:bg-card-2/60 [&>td]:border-b [&>td]:border-border/50 last:[&>td]:border-b-0"
                      >
                        <Td className="num pl-4 text-muted-foreground">{c.rank}</Td>
                        <Td>
                          <div className="flex flex-col leading-tight">
                            <span className="text-[13px] font-medium">{c.symbol}</span>
                            <span className="text-[10px] text-muted-foreground">{c.name}</span>
                          </div>
                        </Td>
                        <Td right className="num font-medium">${fmtPrice(c.price)}</Td>
                        <Td right><ChangeCell value={c.change1h} /></Td>
                        <Td right><ChangeCell value={c.change24h} /></Td>
                        <Td right><ChangeCell value={c.change7d} /></Td>
                        <Td right>
                          <span className="num text-muted-foreground">${fmtCompact(c.volume24h)} </span>
                          {gates && <GateCheck pass={volPass} title={volPass ? "Volume acima do mínimo" : `Abaixo do gate de $${fmtCompact(gates.minVolumeUsdt)} — sem entradas`} />}
                        </Td>
                        <Td right>
                          <span className="num text-muted-foreground">
                            {c.spreadPct != null ? `${(c.spreadPct * 100).toFixed(3)}% ` : "— "}
                          </span>
                          {gates && c.spreadPct != null && (
                            <GateCheck pass={spreadPass} title={spreadPass ? "Spread dentro do limite" : "Spread acima do gate — sem entradas"} />
                          )}
                        </Td>
                        <Td right>
                          {c.fundingRate != null ? (
                            <span className="num">
                              <span className={fundingBlocksLong ? "text-down" : fundingBlocksShort ? "text-up" : "text-muted-foreground"}>
                                {(c.fundingRate * 100).toFixed(4)}%
                              </span>
                              {fundingBlocksLong && <span className="ml-1 rounded bg-down/10 px-1 text-[9px] font-semibold text-down">L✗</span>}
                              {fundingBlocksShort && <span className="ml-1 rounded bg-up/10 px-1 text-[9px] font-semibold text-up">S✗</span>}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </Td>
                        <Td right className="hidden md:table-cell pr-4">
                          <div className="flex justify-end"><Sparkline data={c.sparkline} /></div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title={<span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-warn" /> Funding extremo</span>}
            noPadding
          >
            <div className="divide-y divide-border/50">
              {fundingExtremes.map((c, i) => (
                <button
                  key={`${c.symbol}-${i}`}
                  onClick={() => navigate(`/markets/${c.symbol}`)}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left transition-colors hover:bg-card-2/60"
                >
                  <span className="text-xs font-medium">{c.symbol}</span>
                  <span className={`num text-xs ${(c.fundingRate ?? 0) > 0 ? "text-down" : "text-up"}`}>
                    {((c.fundingRate ?? 0) * 100).toFixed(4)}%
                  </span>
                </button>
              ))}
            </div>
            {gates && (
              <p className="border-t border-border px-3.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
                Gate do engine: funding &gt; {(gates.fundingLongMax * 100).toFixed(1)}% bloqueia LONGs;
                &lt; {(gates.fundingShortMin * 100).toFixed(1)}% bloqueia SHORTs.
              </p>
            )}
          </Panel>

          {gates && (
            <Panel title="Gates de entrada (engine)">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Volume 24h mín.</span><span className="num">${fmtCompact(gates.minVolumeUsdt)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Spread máx.</span><span className="num">{(gates.maxSpreadPct * 100).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Funding (LONG / SHORT)</span><span className="num">≤{(gates.fundingLongMax * 100).toFixed(1)}% / ≥{(gates.fundingShortMin * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Distância SL mín.</span><span className="num">{(gates.minSlDistancePct * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">R:R mín.</span><span className="num">1 : {gates.minRiskReward}</span></div>
              </div>
              <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
                Valores lidos diretamente da configuração do engine — o que vês é o que o scanner aplica.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}
