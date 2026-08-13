import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Wallet, Info, Route } from "lucide-react";
import {
  useFeatureFlags, useHealth, useLiveStatus, usePaperStatus, useRuntime, useAction,
} from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { ago, fmtUsd } from "@/lib/format";
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
      <PageHeader title="Definições" subtitle="Exchange, capital, saídas e sistema" />

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
