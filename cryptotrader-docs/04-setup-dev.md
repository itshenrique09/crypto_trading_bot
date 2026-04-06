# Setup, Desenvolvimento e Estrutura de Ficheiros

---

## Requisitos

- **Node.js 18, 20 ou 22 LTS** (recomendado: v20)
- **npm** (incluído com o Node.js)
- Sistema operativo: Windows, macOS ou Linux

> ⚠️ Node.js v24 funciona mas ainda é experimental. Para produção usa v20 LTS.

---

## Instalação e Arranque

```bash
# 1. Entrar na pasta do projeto
cd trading-bot

# 2. Instalar dependências (só uma vez)
npm install

# 3. Modo desenvolvimento (hot reload)
npm run dev
```

Abre **http://localhost:5000** no browser.

---

## Scripts Disponíveis

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento com hot reload |
| `npm run build` | Build de produção (frontend + backend) |
| `npm start` | Corre o build de produção |
| `npm run check` | Verifica tipos TypeScript |

---

## Estrutura Completa de Ficheiros

```
trading-bot/
│
├── client/                          ← Frontend (React + Vite)
│   ├── index.html                   ← HTML base com fontes Google
│   └── src/
│       ├── main.tsx                 ← Entry point React
│       ├── App.tsx                  ← Router principal
│       ├── index.css                ← Tema dark terminal (Tailwind vars)
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx        ← Página principal (tabela de mercado)
│       │   ├── AnalysisPage.tsx     ← Página de análise completa
│       │   └── not-found.tsx        ← Página 404
│       │
│       ├── components/
│       │   ├── PriceChart.tsx       ← Gráfico de preço (Recharts)
│       │   ├── ConfluenceMeter.tsx  ← Medidor de confluência visual
│       │   ├── MiniSparkline.tsx    ← Sparklines na tabela
│       │   └── ui/                  ← Componentes shadcn/ui
│       │       ├── card.tsx
│       │       ├── badge.tsx
│       │       ├── button.tsx
│       │       ├── skeleton.tsx
│       │       └── ... (30+ componentes)
│       │
│       ├── hooks/
│       │   ├── use-toast.ts         ← Toast notifications
│       │   └── use-mobile.tsx       ← Detecção mobile
│       │
│       └── lib/
│           ├── queryClient.ts       ← TanStack Query setup
│           └── utils.ts             ← Helpers (formatPrice, getChangeColor, etc.)
│
├── server/                          ← Backend (Express + Node.js)
│   ├── index.ts                     ← Entry point do servidor
│   ├── routes.ts                    ← Todas as API routes
│   ├── analysis.ts                  ← Motor de análise técnica (core)
│   ├── storage.ts                   ← CRUD watchlist e sinais
│   ├── db.ts                        ← Setup sql.js (SQLite via WASM)
│   ├── vite.ts                      ← Integração Vite em desenvolvimento
│   └── static.ts                    ← Serve ficheiros estáticos em produção
│
├── shared/
│   └── schema.ts                    ← Tipos partilhados (Watchlist, Signal)
│
├── script/
│   └── build.ts                     ← Script de build (esbuild + vite)
│
├── docs/                            ← Esta documentação
│   ├── 01-overview.md
│   ├── 02-analysis-engine.md
│   ├── 03-signals-risk.md
│   └── 04-setup-dev.md
│
├── package.json                     ← Dependências e scripts
├── tsconfig.json                    ← Configuração TypeScript
├── tailwind.config.ts               ← Configuração Tailwind
├── vite.config.ts                   ← Configuração Vite
├── postcss.config.js                ← PostCSS
├── components.json                  ← Configuração shadcn/ui
└── data.db                          ← Base de dados SQLite (criada automaticamente)
```

---

## API Endpoints

Todos os endpoints estão em `server/routes.ts`.

### `GET /api/market`
Retorna as top 25 criptos com preços, variações e sparklines.

```json
[
  {
    "symbol": "BTC",
    "name": "Bitcoin",
    "price": 67371,
    "change1h": 0.02,
    "change24h": 0.72,
    "change7d": 1.02,
    "marketCap": 1350000000000,
    "volume24h": 22000000000,
    "sparkline": [65000, 65500, ...],
    "rank": 1
  }
]
```

### `GET /api/coin/:symbol`
Detalhes de uma coin específica + candles para o gráfico.

```json
{
  "symbol": "BTC",
  "price": 67371,
  "marketCap": 1350000000000,
  "change24h": 0.72,
  "ath": 108786,
  "candles": [
    { "time": 1710000000, "open": 65000, "high": 66000, "low": 64500, "close": 65800, "volume": 25000000000 }
  ]
}
```

### `GET /api/analyze/:symbol`
Análise técnica completa. O endpoint mais importante.

```json
{
  "symbol": "BTC",
  "currentPrice": 67371,
  "indicators": {
    "rsi": 63.1,
    "macd": { "line": 114.67, "signal": 101.0, "histogram": 13.67 },
    "ema9": 67289, "ema21": 67177, "ema50": 67089, "ema200": 67491,
    "ichimoku": { "priceVsCloud": "above", "cloudColor": "green", "tkCross": "none" },
    "bollingerBands": { "upper": 67501, "middle": 67151, "lower": 66802, "percentB": 0.814 },
    "atr": 197.83,
    "atrPercent": 0.29,
    "orderBlocks": [{ "type": "bullish", "high": 67128, "low": 67090, "strength": 75 }],
    "fairValueGaps": [{ "type": "bullish", "high": 66734, "low": 66643, "filled": false }],
    "support": 66686,
    "resistance": 67487,
    "fibLevels": [{ "level": "61.8%", "price": 66789 }]
  },
  "signal": {
    "type": "STRONG_BUY",
    "confluenceScore": 6,
    "confidence": 75,
    "reason": "Short-term EMAs bullish | Price above green Ichimoku Cloud | MACD strong bullish momentum",
    "entry": 67371,
    "stopLoss": 67074,
    "takeProfit1": 67668,
    "takeProfit2": 67965,
    "takeProfit3": 68262,
    "riskRewardRatio": 3,
    "positionSizePct": 1.5,
    "trend": "strong_up",
    "volatility": "low",
    "marketPhase": "accumulation"
  }
}
```

### `GET /api/watchlist`
Lista de coins na watchlist.

### `POST /api/watchlist`
Adiciona uma coin à watchlist.
```json
{ "symbol": "ETH", "name": "Ethereum", "addedAt": "2026-04-05T00:00:00Z" }
```

### `DELETE /api/watchlist/:id`
Remove uma coin da watchlist.

### `GET /api/signals`
Histórico de sinais gerados.

---

## Base de Dados

Usa **sql.js** — SQLite compilado para WebAssembly. Vantagem: funciona em qualquer plataforma sem compilação nativa (resolve o problema do `better-sqlite3` no Windows).

O ficheiro `data.db` é criado automaticamente na raiz do projeto quando o servidor arranca pela primeira vez.

### Tabelas

```sql
CREATE TABLE watchlist (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol   TEXT NOT NULL,
  name     TEXT NOT NULL,
  added_at TEXT NOT NULL
);

CREATE TABLE signals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol     TEXT NOT NULL,
  type       TEXT NOT NULL,   -- STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
  price      REAL NOT NULL,
  confidence REAL NOT NULL,
  reason     TEXT NOT NULL,
  indicators TEXT NOT NULL,   -- JSON string
  timestamp  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active'
);
```

---

## Como Adicionar uma Nova Coin

As coins disponíveis para análise estão mapeadas em `server/routes.ts`:

```ts
const SYMBOL_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  // adicionar aqui...
  NOVO: "id-no-coingecko",
};
```

O ID da CoinGecko pode ser encontrado em [coingecko.com](https://coingecko.com) no URL de cada coin.

---

## Personalizar o Scoring

O sistema de scoring está em `server/analysis.ts` na função `generateSignal()`. Para ajustar os pesos:

```ts
// Exemplo: aumentar o peso do RSI
if (indicators.rsi < 25) {
  score += 2.5;  // era 1.5
```

Para adicionar um novo indicador ao score, calcula-o em `analyzeIndicators()` e adiciona a lógica de scoring em `generateSignal()`.

---

## Build de Produção

```bash
npm run build
```

Gera:
```
dist/
├── public/          ← Frontend compilado (servido como estático)
│   ├── index.html
│   └── assets/
│       ├── index-xxx.js
│       └── index-xxx.css
├── index.cjs        ← Backend compilado (esbuild)
└── sql-wasm.wasm    ← SQLite WASM (necessário para o backend)
```

Para correr em produção:
```bash
node dist/index.cjs
```

---

## Variáveis de Ambiente

O projeto não precisa de variáveis de ambiente — usa apenas a CoinGecko API gratuita (sem chave).

Se no futuro quiseres adicionar uma API key (para remover rate limits):

```bash
# .env
COINGECKO_API_KEY=tua_chave_aqui
```

E no código:
```ts
const headers = process.env.COINGECKO_API_KEY
  ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
  : {};
```
