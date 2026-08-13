# CryptoTrader Pro — Visão Geral

## O que é

CryptoTrader Pro é um **bot de análise de trading de criptomoedas** com dashboard web profissional. Analisa o mercado em tempo real usando múltiplos indicadores técnicos e gera sinais de entrada e saída com gestão de risco integrada.

Não executa ordens automaticamente — é um sistema de **análise e decisão** que te diz quando e como entrar/sair de trades, incluindo onde colocar o stop loss e os take profits.

---

## Filosofia

> *"Só sinalizar quando MÚLTIPLOS fatores independentes concordam. Um trader profissional com 30 anos de experiência espera pelos setups de alta probabilidade."*

O bot não gera sinais em cada vela. Espera por **confluência** — o alinhamento de pelo menos 3-4 indicadores na mesma direção antes de recomendar entrada. Isto reduz drasticamente os falsos sinais.

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│  ┌─────────────┐    ┌──────────────────────┐ │
│  │  Dashboard  │    │   Analysis Page      │ │
│  │  (mercado)  │───▶│  (análise completa)  │ │
│  └─────────────┘    └──────────────────────┘ │
└──────────────────────┬──────────────────────┘
                       │ HTTP / REST API
┌──────────────────────▼──────────────────────┐
│              Express Server                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ /market  │  │/analyze  │  │/watchlist │  │
│  └──────────┘  └────┬─────┘  └───────────┘  │
│                     │                        │
│         ┌───────────▼──────────┐             │
│         │   Analysis Engine    │             │
│         │  (analysis.ts)       │             │
│         └───────────┬──────────┘             │
│                     │                        │
│         ┌───────────▼──────────┐             │
│         │      sql.js DB       │             │
│         │   (data.db)          │             │
│         └──────────────────────┘             │
└─────────────────────┬───────────────────────┘
                      │ fetch()
┌─────────────────────▼───────────────────────┐
│           CoinGecko API (gratuito)           │
│  Preços, volumes, market cap, sparklines     │
└─────────────────────────────────────────────┘
```

---

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript |
| Routing | Wouter (hash-based) |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v3 |
| Charts | Recharts |
| Server | Express 5 + Node.js |
| Database | sql.js (SQLite via WebAssembly) |
| Build | Vite (frontend) + esbuild (backend) |
| Data API | CoinGecko API (gratuita, sem chave) |

---

## Funcionalidades

### Dashboard (`/`)
- Tabela com as top 25 criptos por market cap
- Preço, variação 1h / 24h / 7d em tempo real
- Sparklines de 7 dias para cada coin
- Market cap, volume 24h
- Estatísticas globais: total market cap, volume, gainers/losers
- Pesquisa em tempo real
- Botão "Analyze" em cada coin

### Página de Análise (`/analyze/:symbol`)
- Gráfico de preço 90 dias com overlays (Bollinger, EMAs, S/R, entry/SL/TP)
- Volume como sub-gráfico
- Score de Confluência visual (-10 a +10)
- Sinal: STRONG BUY / BUY / HOLD / SELL / STRONG SELL
- Gestão de risco completa (entry, SL, TP1/TP2/TP3)
- Breakdown de todos os indicadores com bias (bullish/bearish/neutral)
- Smart Money Concepts (Order Blocks, FVGs, S/R dinâmico)
- Fibonacci Retracement
- Ichimoku Cloud detalhado
- Valores raw de todos os indicadores

---

## Fluxo de uma Análise

```
1. Utilizador clica "Analyze BTC"
2. Frontend faz GET /api/analyze/BTC
3. Backend busca 90 dias de dados à CoinGecko
4. Constrói array de OHLCV (Open/High/Low/Close/Volume)
5. analyzeIndicators() calcula todos os indicadores
6. generateSignal() aplica o scoring de confluência
7. Retorna: indicadores + sinal + risk management
8. Frontend renderiza dashboard completo
```

---

## Ficheiros de Documentação

| Ficheiro | Conteúdo |
|----------|---------|
| `01-overview.md` | Este ficheiro — visão geral |
| `02-analysis-engine.md` | Motor de análise técnica em detalhe |
| `03-signals-risk.md` | Sistema de sinais e gestão de risco |
| `04-setup-dev.md` | Como correr e desenvolver o projeto |
