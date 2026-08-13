# Setup, Desenvolvimento e Estrutura de Ficheiros

*(atualizado Ago 2026 — reflete o sistema atual: engines paper/live, UI v2, Kraken/MEXC)*

---

## Requisitos

- **Node.js 20 LTS ou superior** (o projeto corre em produção com v24)
- **npm** (incluído com o Node.js)
- Sistema operativo: Windows, macOS ou Linux (sql.js é WASM — sem compilação nativa)

---

## Instalação e Arranque

```bash
npm install
npm run dev        # servidor + cliente (Vite middleware, HMR) — porta 5000
```

Se a porta 5000 estiver ocupada na tua máquina:

```bash
npx cross-env PORT=5001 NODE_ENV=development tsx server/index.ts
```

Abre **http://localhost:5000** (ou a porta escolhida). A base de dados `data.db` é criada automaticamente; o paper engine arranca sozinho se o modo persistido for `paper`.

> Nota: `tsx` não faz watch do código do servidor — alterações em `server/*` exigem reiniciar o processo. O cliente tem HMR via Vite.

---

## Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (Express + Vite middleware, HMR no cliente) |
| `npm run check` | `tsc --noEmit` — verifica tipos em todo o projeto |
| `npm test` | `node --test server/*.test.ts` — suite completa (156 testes) |
| `npm run build` | Build de produção (Vite → `dist/public`, esbuild → `dist/index.cjs`) |
| `npm start` | Corre o build de produção (exige `APP_PASSWORD`) |

**Depois de editar TypeScript, corre sempre `npm run check`.** Depois de mexer no servidor, corre `npm test`.

---

## Estrutura de Ficheiros

```
trading-bot/
│
├── client/                            ← Frontend (React 18 + Vite, hash routing)
│   ├── index.html                     ← Fontes: Inter + JetBrains Mono
│   ├── public/favicon.svg
│   └── src/
│       ├── main.tsx / App.tsx         ← Entry + rotas (/live /paper /markets /markets/:s /activity /settings)
│       ├── index.css                  ← Design tokens (dark-only): --card --accent --up --down --warn …
│       ├── pages/
│       │   ├── live.tsx               ← Conta/posições da exchange, guards, histórico live
│       │   ├── paper.tsx              ← Balance simulado, guards, performance por estratégia, histórico paper
│       │   ├── markets.tsx            ← Universo de 41 moedas com gates reais (✓/✗)
│       │   ├── symbol.tsx             ← Gráfico profissional + sinais do registry + gates por símbolo
│       │   ├── activity.tsx           ← Feed de decisões do scanner, estratégias, parâmetros, funding carry
│       │   ├── settings.tsx           ← Chaves API, capital, trailing, backups, sistema
│       │   └── not-found.tsx
│       ├── components/
│       │   ├── AppShell.tsx           ← Sidebar agrupada + topbar (equity, indicador SSE)
│       │   ├── ui-kit.tsx             ← Primitivas: Page, Panel, StatCard, Segmented, Th/Td, badges…
│       │   ├── CandleChart.tsx        ← Wrapper lightweight-charts (CHART_COLORS = paleta única)
│       │   ├── TradeChartModal.tsx    ← Gráfico de um trade (entry/SL/TP/exit marcados)
│       │   ├── Sparkline.tsx / ConfirmButton.tsx
│       │   ├── mode/                  ← Partilhados pelos dashboards de modo
│       │   │   ├── GuardsPanel.tsx    ← Halts diário/rolling + kill-switch (fórmulas do engine)
│       │   │   ├── PositionsTable.tsx ← Variantes live (proteção do venue) e paper (marks simulados)
│       │   │   ├── HistorySection.tsx ← Histórico filtrável + export/import JSON
│       │   │   └── EquityCurve.tsx    ← Curva R acumulado por modo
│       │   └── ui/                    ← shadcn mínimos: alert-dialog, button, skeleton, toast(er)
│       ├── hooks/use-toast.ts
│       └── lib/
│           ├── api.ts                 ← TODOS os hooks de dados (endpoints + cadências num só sítio)
│           ├── sse.ts                 ← Ligação /api/events → invalidação de queries
│           ├── types.ts               ← Tipos da API + STRATEGY_COLORS
│           ├── format.ts              ← fmtPrice/fmtUsd/fmtR/rMetrics… (fonte única de formatação)
│           ├── queryClient.ts         ← fetch helpers + TanStack Query defaults
│           └── utils.ts               ← cn()
│
├── server/                            ← Backend (Express 5)
│   ├── index.ts                       ← Entry: auth Basic (prod), body limit 5mb, backup loop
│   ├── routes.ts                      ← Engines paper/live + toda a API + SSE (~3600 linhas)
│   ├── strategies/                    ← registry.ts + estratégias ativas (a fonte de verdade do trading)
│   ├── analysis.ts                    ← Indicadores (referência: 02-analysis-engine.md)
│   ├── exchange.ts                    ← ExchangeAdapter + KrakenAdapter/MexcAdapter
│   ├── kraken-client.ts               ← Kraken Futures REST (contas, posições, ordens, fills)
│   ├── mexc-client.ts / mexc-market.ts← MEXC futures privado / parsing público
│   ├── db.ts / storage.ts             ← sql.js + schema + CRUD (journal, scan_log, settings…)
│   ├── backup.ts                      ← Backup diário de data.db com rotação
│   ├── portfolio-guards.ts            ← Halts rolling + kill-switch (puros, partilhados pelos 2 engines)
│   ├── trade-accounting.ts / trade-exits.ts / trailing-stop.ts
│   ├── live-credentials.ts            ← Encriptação AES-256 das chaves (KDF = sha256(APP_PASSWORD))
│   ├── live-reconciliation.ts         ← Journal ↔ posições do venue
│   ├── btc-regime-gate.ts / exposure-guards.ts / funding-carry.ts
│   ├── candles.ts / runtime-info.ts / auth-config.ts
│   ├── vite.ts / static.ts            ← Dev middleware / estáticos em produção
│   └── *.test.ts                      ← 156 testes (node:test)
│
├── script/                            ← Validação e investigação (validate-pipeline.ts = o árbitro)
├── backups/                           ← Backups diários de data.db (gitignored, rotação 7)
├── cryptotrader-docs/                 ← Esta pasta (02 = referência de indicadores; archive/ = histórico)
├── README.md / API.md / STRATEGIES.md ← Documentação principal
├── ecosystem.config.cjs               ← Config pm2 para VPS
└── data.db                            ← SQLite (journal + settings + chaves encriptadas)
```

---

## API

A referência completa (42+ endpoints, SSE, health, shapes de resposta) está em [`API.md`](../API.md). Regras rápidas:

- Fechar posições **live** só via `POST /api/live/close/:id` (nunca PATCH direto ao journal).
- Constantes do engine vêm de `GET /api/engine/config` — a UI nunca as hardcoda.
- O cliente recebe push via SSE (`/api/events`); polling é apenas fallback.

---

## Base de Dados

**sql.js** (SQLite em WASM): a BD vive em memória e é reescrita para `data.db` a cada escrita (fila debounced). Tabelas: `journal` (todos os trades, discriminados por `mode`), `bot_settings` (modo, capital, trailing, **chaves encriptadas**), `scan_log` (feed de decisões, últimos ~2000), `funding_carry_log`, `watchlist` (não usada), `signals` (morta).

Backups: diários em `./backups/`, últimos 7, escrita atómica a partir da memória. Restaurar = parar servidor, substituir `data.db`, arrancar.

---

## Produção (VPS)

```bash
npm run build
APP_PASSWORD=... PORT=5000 npm start     # ou: pm2 start ecosystem.config.cjs
```

- `APP_PASSWORD` é obrigatório em produção (Basic auth `admin:<password>`); é também a chave de encriptação das API keys — mudá-lo invalida as chaves guardadas.
- Aponta um monitor de uptime a `GET /api/health` (200 = ok, 503 = atenção).
- Copia `./backups/` para fora da máquina periodicamente.

---

## Regras de Desenvolvimento

- **Paper e live nunca podem divergir** — qualquer alteração a gates/saídas aplica-se aos dois engines (helpers puros em `portfolio-guards.ts`, `trade-exits.ts`, `trailing-stop.ts` existem para isso).
- **Estratégias e universos estão CONGELADOS** — mudanças exigem hipótese prévia + A/B com `script/validate-pipeline.ts` + 90 dias de validação paper (ver README → Change policy).
- UI: usar as primitivas de `ui-kit.tsx` e os tokens de `index.css`; grids responsivas com classe de colunas base; tabelas dentro de `overflow-x-auto`; toda a data com `SourceTag` da fonte real.
