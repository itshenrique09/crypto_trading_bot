import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Wallet, Info, Route, Power } from "lucide-react";
import {
  useFeatureFlags, useHealth, useLiveStatus, usePaperStatus, useRuntime, useAction,
  useStrategies, useToggleStrategy, useUniverse, useToggleSymbol,
} from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { ago, fmtUsd } from "@/lib/format";
import { getStratColor } from "@/lib/types";
import { Page, PageHeader, Panel, SourceTag } from "@/components/ui-kit";

const KEEP = "__keep__";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-9 w-full rounded-md border border-border bg-card-2 px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-accent/50";

function Toggle({ checked, onChange, disabled, label, tone = "accent" }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string;
  /** Mode identity: paper = accent (violeta), live = warn (âmbar). */
  tone?: "accent" | "warn";
}) {
  const on = tone === "warn" ? "bg-warn" : "bg-accent";
  const knobOn = tone === "warn" ? "bg-background" : "bg-accent-foreground";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? on : "border border-border bg-card-2"
      }`}
    >
      <span
        className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[left] ${
          checked ? `left-[18px] ${knobOn}` : "left-[3px] bg-muted-foreground"
        }`}
      />
    </button>
  );
}

function RangeField({
  label, value, onChange, min, max, step, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="num text-xs">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[hsl(var(--accent))]"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { data: live } = useLiveStatus();
  const { data: paper } = usePaperStatus();
  const { data: flags } = useFeatureFlags();
  const { data: runtime } = useRuntime();
  const { data: health } = useHealth();
  const { data: strategies } = useStrategies();
  const toggleStrategy = useToggleStrategy();
  const { data: universe } = useUniverse();
  const toggleSymbol = useToggleSymbol();

  // ── Live config ─────────────────────────────────────────────────
  const [exchange, setExchange] = useState("kraken");
  const [apiKey, setApiKey] = useState(KEEP);
  const [apiSecret, setApiSecret] = useState(KEEP);
  const [showSecrets, setShowSecrets] = useState(false);
  const [liveRisk, setLiveRisk] = useState(1);
  const [liveLev, setLiveLev] = useState(3);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (live) {
      setExchange(live.exchange);
      setLiveRisk(live.riskPct);
      setLiveLev(live.leverage);
    }
  }, [live?.exchange, live?.riskPct, live?.leverage]);

  const saveLiveConfig = useAction(
    () => apiRequest("POST", "/api/live/config", {
      exchange,
      apiKey: apiKey || KEEP,
      apiSecret: apiSecret || KEEP,
      riskPct: liveRisk,
      leverage: liveLev,
    }),
    {
      invalidates: ["/api/live/status"],
      successMessage: "Configuração live guardada",
      onSuccess: () => { setApiKey(KEEP); setApiSecret(KEEP); },
    },
  );

  const testConnection = useAction(
    async () => {
      const res = await apiRequest("POST", "/api/live/test");
      const body = await res.json() as { ok: boolean; balance?: number; error?: string };
      setTestResult(body.ok ? `Ligação OK — margem disponível ${fmtUsd(body.balance ?? 0)}` : `Falhou: ${body.error}`);
      return body;
    },
    { invalidates: ["/api/live/status"] },
  );

  // ── Paper capital ───────────────────────────────────────────────
  const [capital, setCapital] = useState(10000);
  const [paperRisk, setPaperRisk] = useState(2);
  const [paperLev, setPaperLev] = useState(3);

  useEffect(() => {
    if (paper?.capital) {
      setCapital(paper.capital.initial);
      setPaperRisk(paper.capital.riskPct);
      setPaperLev(paper.capital.leverage);
    }
  }, [paper?.capital?.initial, paper?.capital?.riskPct, paper?.capital?.leverage]);

  const savePaperCapital = useAction(
    () => apiRequest("POST", "/api/paper/capital", { capital, riskPct: paperRisk, leverage: paperLev }),
    { invalidates: ["/api/paper/status"], successMessage: "Capital paper atualizado" },
  );

  // ── Trailing ────────────────────────────────────────────────────
  const [trailMode, setTrailMode] = useState<"r_multiple" | "fixed_pct">("r_multiple");
  const [trailR, setTrailR] = useState(2);

  useEffect(() => {
    if (flags) {
      setTrailMode(flags.trailing_mode);
      setTrailR(flags.trailing_r_multiple);
    }
  }, [flags?.trailing_mode, flags?.trailing_r_multiple]);

  const saveTrailing = useAction(
    () => apiRequest("PUT", "/api/settings/feature-flags", { trailing_mode: trailMode, trailing_r_multiple: trailR }),
    { invalidates: ["/api/settings/feature-flags"], successMessage: "Trailing atualizado" },
  );

  return (
    <Page>
      <PageHeader title="Definições" subtitle="Exchange, capital, saídas, estratégias e sistema" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ── Live exchange ─────────────────────────────────────── */}
        <Panel
          title={<span className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5 text-warn" /> Exchange (live)</span>}
          aside={live?.configured && (
            <SourceTag>
              {Object.entries(live.configured).filter(([, v]) => v).map(([k]) => k).join(" + ") || "sem chaves guardadas"}
            </SourceTag>
          )}
        >
          <div className="space-y-4">
            <Field label="Exchange de execução">
              <select value={exchange} onChange={e => setExchange(e.target.value)} className={inputCls}>
                {(live?.exchanges ?? []).map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}{live?.configured?.[e.id as "kraken" | "mexc"] ? " · chaves guardadas" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {live?.exchanges.find(e => e.id === exchange)?.note && (
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                {live.exchanges.find(e => e.id === exchange)!.note}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="API key" hint={live?.configured?.[exchange as "kraken" | "mexc"] ? "Deixa como está para manter a chave guardada." : undefined}>
                <input
                  type={showSecrets ? "text" : "password"}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onFocus={() => apiKey === KEEP && setApiKey("")}
                  className={inputCls}
                  placeholder="API key"
                />
              </Field>
              <Field label="API secret">
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={apiSecret}
                    onChange={e => setApiSecret(e.target.value)}
                    onFocus={() => apiSecret === KEEP && setApiSecret("")}
                    className={`${inputCls} pr-9`}
                    placeholder="API secret"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RangeField label="Risco por trade" value={liveRisk} onChange={setLiveRisk} min={0.25} max={3} step={0.25} format={v => `${v}%`} />
              <RangeField label="Alavancagem" value={liveLev} onChange={setLiveLev} min={1} max={20} step={1} format={v => `${v}×`} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => saveLiveConfig.mutate()}
                disabled={saveLiveConfig.isPending}
                className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                Guardar configuração
              </button>
              <button
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending}
                className="rounded-md border border-border bg-card-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {testConnection.isPending ? "A testar…" : "Testar ligação"}
              </button>
            </div>
            {testResult && (
              <p className={`text-xs ${testResult.startsWith("Falhou") ? "text-down" : "text-up"}`}>{testResult}</p>
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground/70">
              As chaves ficam encriptadas (AES-256) na base de dados local e nunca saem do teu servidor.
              Cria a API key sem permissão de levantamentos. O arranque e paragem do engine fazem-se na página Live.
            </p>
          </div>
        </Panel>

        <div className="space-y-4">
          {/* ── Paper capital ────────────────────────────────────── */}
          <Panel title={<span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-accent" /> Capital paper</span>}>
            <div className="space-y-4">
              <Field label="Capital inicial (USD)">
                <input
                  type="number"
                  value={capital}
                  min={100}
                  max={1_000_000}
                  onChange={e => setCapital(Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RangeField label="Risco por trade" value={paperRisk} onChange={setPaperRisk} min={0.25} max={5} step={0.25} format={v => `${v}%`} />
                <RangeField label="Alavancagem" value={paperLev} onChange={setPaperLev} min={1} max={20} step={1} format={v => `${v}×`} />
              </div>
              <button
                onClick={() => savePaperCapital.mutate()}
                disabled={savePaperCapital.isPending}
                className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                Guardar
              </button>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                Alterar o capital recalcula o balance simulado a partir do P&L histórico. O arranque do engine faz-se na página Paper.
              </p>
            </div>
          </Panel>

          {/* ── Exits ────────────────────────────────────────────── */}
          <Panel title={<span className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5" /> Trailing do runner</span>}>
            <div className="space-y-4">
              <Field label="Modo (após TP1)">
                <select
                  value={trailMode}
                  onChange={e => setTrailMode(e.target.value as typeof trailMode)}
                  className={inputCls}
                >
                  <option value="r_multiple">R-multiple — trail a N× o risco original (validado no pipeline)</option>
                  <option value="fixed_pct">Percentagem fixa — 2% do pico</option>
                </select>
              </Field>
              {trailMode === "r_multiple" && (
                <RangeField label="Distância do trail" value={trailR} onChange={setTrailR} min={0.5} max={5} step={0.5} format={v => `${v}R`} />
              )}
              <button
                onClick={() => saveTrailing.mutate()}
                disabled={saveTrailing.isPending}
                className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
              >
                Guardar
              </button>
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                Aplica-se aos dois engines (paper e live mantêm-se em sincronia). Os restantes parâmetros do engine são
                fixos por validação — vê-os na página Atividade.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {/* ── Strategies ─────────────────────────────────────────── */}
      <Panel
        title={<span className="flex items-center gap-1.5"><Power className="h-3.5 w-3.5 text-accent" /> Estratégias</span>}
        aside={<SourceTag>interruptores por modo</SourceTag>}
      >
        <div className="divide-y divide-border">
          {!strategies && [0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="h-4 w-40 animate-pulse rounded bg-card-2" />
              <div className="ml-auto h-5 w-9 animate-pulse rounded-full bg-card-2" />
            </div>
          ))}
          {strategies?.map(s => {
            const color = getStratColor(s.id);
            const paperOn = s.paperEnabled ?? s.enabled;
            const liveOn = s.liveEnabled ?? s.enabled;
            const ksPaper = s.killSwitchPaused?.paper ?? false;
            const ksLive = s.killSwitchPaused?.live ?? false;
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${color.bg} ${color.text} ${color.border}`}>
                      {s.name}
                    </span>
                    <span className="num text-[10px] text-muted-foreground">{s.interval}</span>
                    <span className="num text-[10px] text-muted-foreground">{s.preferredSymbols.length} moedas</span>
                    {s.cooldownHours != null && (
                      <span className="num text-[10px] text-muted-foreground">cooldown {s.cooldownHours}h</span>
                    )}
                    {!paperOn && !liveOn && (
                      <span className="rounded bg-card-2 px-1.5 py-0.5 text-[10px] text-muted-foreground">pausada</span>
                    )}
                    {(ksPaper || ksLive) && (
                      <span className="rounded bg-down/10 px-1.5 py-0.5 text-[10px] text-down">
                        kill-switch{ksPaper && ksLive ? "" : ksPaper ? " (paper)" : " (live)"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground/70">{s.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${paperOn ? "text-accent" : "text-muted-foreground"}`}>Paper</span>
                  <Toggle
                    tone="accent"
                    checked={paperOn}
                    disabled={toggleStrategy.isPending}
                    label={`${paperOn ? "Pausar" : "Ligar"} ${s.name} no paper`}
                    onChange={enabled => toggleStrategy.mutate({ id: s.id, enabled, mode: "paper" })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${liveOn ? "text-warn" : "text-muted-foreground"}`}>Live</span>
                  <Toggle
                    tone="warn"
                    checked={liveOn}
                    disabled={toggleStrategy.isPending}
                    label={`${liveOn ? "Pausar" : "Ligar"} ${s.name} no live`}
                    onChange={enabled => toggleStrategy.mutate({ id: s.id, enabled, mode: "live" })}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
          Interruptores independentes por modo: podes testar uma estratégia no <span className="text-accent">paper</span> mantendo-a
          pausada no <span className="text-warn">live</span> (dinheiro real). Pausar bloqueia apenas{" "}
          <span className="text-foreground">novas entradas</span> — posições abertas continuam a ser geridas (TP1, trailing,
          stops) até fecharem. A RSI Divergence começa pausada nos dois modos por decisão da auditoria de Ago 2026
          (contribuição marginal negativa no portfólio: −18R ALL / −27R 2026 — canibaliza entradas do Liquidity Sweep em
          ATOM/INJ); se quiseres continuar a acumular evidência, liga-a só no paper. O kill-switch automático (−3R/7d)
          é independente destes interruptores.
        </p>
      </Panel>

      {/* ── Universe blocklist ─────────────────────────────────── */}
      <Panel
        title={<span className="flex items-center gap-1.5"><Power className="h-3.5 w-3.5 text-down" /> Universo — kill operacional por moeda</span>}
        aside={universe && (
          <SourceTag>
            {universe.symbols.filter(s => s.enabled).length}/{universe.symbols.length} ativas
          </SourceTag>
        )}
      >
        {!universe && <div className="h-16 animate-pulse rounded bg-card-2" />}
        {universe && (
          <div className="flex flex-wrap gap-1.5">
            {universe.symbols.map(s => (
              <button
                key={s.symbol}
                type="button"
                onClick={() => toggleSymbol.mutate({ symbol: s.symbol, enabled: !s.enabled })}
                disabled={toggleSymbol.isPending}
                title={`${s.symbol} — ${s.strategies.join(", ")} — ${s.enabled ? "clica para bloquear novas entradas" : "bloqueada; clica para reativar"}`}
                className={`num rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ${
                  s.enabled
                    ? "border-border bg-card-2 text-foreground hover:border-down/50"
                    : "border-down/40 bg-down/10 text-down line-through"
                }`}
              >
                {s.symbol}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
          Interruptor <span className="text-foreground">operacional</span> — para delistings, morte de liquidez ou
          problemas na exchange. Bloqueia novas entradas nos <span className="text-foreground">dois modos</span> de
          propósito (lição LUNC: o paper medir uma moeda que o live não pode negociar corrompe a comparação).
          Posições abertas continuam geridas até fechar. <span className="text-down">Não uses isto para tuning de
          performance</span> — as amostras por moeda (~27 trades/ano) são pequenas demais para essa decisão; o
          universo foi validado como conjunto e mudanças de composição passam pelo screen de duas metades + A/B
          do pipeline (auditoria, Fase 5).
        </p>
      </Panel>

      {/* ── System ─────────────────────────────────────────────── */}
      <Panel title={<span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Sistema</span>}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3 xl:grid-cols-6">
          <div className="flex justify-between py-1 sm:block">
            <span className="text-muted-foreground">Versão </span>
            <span className="num">{runtime?.version ?? "—"}</span>
          </div>
          <div className="flex justify-between py-1 sm:block">
            <span className="text-muted-foreground">Commit </span>
            <span className="num">{runtime?.buildCommit === "unknown" ? "—" : runtime?.buildCommit?.slice(0, 8)}{runtime?.buildDirty ? " (dirty)" : ""}</span>
          </div>
          <div className="flex justify-between py-1 sm:block">
            <span className="text-muted-foreground">Servidor iniciado </span>
            <span>{runtime?.startedAt ? ago(runtime.startedAt) : "—"}</span>
          </div>
          <div className="flex justify-between py-1 sm:block">
            <span className="text-muted-foreground">Candles </span>
            <span>MEXC Futures → Binance</span>
          </div>
          <div className="flex justify-between py-1 sm:block">
            <span className="text-muted-foreground">Conta live </span>
            <span>{live?.exchanges.find(e => e.id === live.exchange)?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between py-1 sm:block">
            <span className="text-muted-foreground">Backups BD </span>
            <span className={health?.backups?.lastError ? "text-down" : undefined}>
              {health?.backups
                ? health.backups.lastError
                  ? `falhou: ${health.backups.lastError}`
                  : `${health.backups.count}/${health.backups.keep} · ${health.backups.lastBackupFile ?? "—"}`
                : "—"}
            </span>
          </div>
        </div>
        {health?.backups && !health.backups.lastError && (
          <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
            Cópia diária automática de data.db (journal + chaves encriptadas) para ./backups, com rotação
            das últimas {health.backups.keep}. Para restaurar: parar o servidor e substituir data.db pelo backup.
          </p>
        )}
      </Panel>
    </Page>
  );
}
