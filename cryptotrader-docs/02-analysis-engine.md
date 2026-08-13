# Motor de Análise Técnica

**Ficheiro:** `server/analysis.ts`

> **Âmbito (atualizado Ago 2026):** este documento é uma referência das implementações
> de indicadores em `analysis.ts`. O trading real é decidido pelas **estratégias do
> registry** (`server/strategies/` — ver `STRATEGIES.md`), que usam partes destes
> indicadores mas têm lógica de entrada/saída própria e validada. O sistema de
> "confluence scoring" descrito no fim continua acessível em `GET /api/analyze/:symbol`
> para investigação, mas **não é o que os engines negoceiam**.

Implementa 8 grupos de indicadores independentes, todos calculados do zero em TypeScript puro — sem bibliotecas externas de indicadores.

---

## Dados de Entrada

Todos os indicadores recebem um array de `OHLCV`:

```ts
interface OHLCV {
  time: number;   // Unix timestamp (segundos)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

O backend constrói este array a partir dos dados da CoinGecko (90 dias de histórico diário), necessitando de um mínimo de 60 candles para análise válida.

---

## Grupo 1 — Trend (EMAs)

### Exponential Moving Averages: 9, 21, 50, 200

```
EMA(n) = Preço × k + EMA_anterior × (1 - k)
onde k = 2 / (n + 1)
```

A EMA dá mais peso aos preços recentes. Períodos usados:
- **EMA 9** — tendência muito curto prazo
- **EMA 21** — tendência curto prazo
- **EMA 50** — tendência médio prazo (linha mais importante para swing traders)
- **EMA 200** — tendência longo prazo (linha de separação bull/bear market)

### Interpretação

| Condição | Significado | Score |
|----------|-------------|-------|
| EMA9 > EMA21 > EMA50 > EMA200 | Tendência bullish perfeita | +2 |
| EMA9 > EMA21 > EMA50 | Tendência bullish curto prazo | +1 |
| EMA9 < EMA21 < EMA50 < EMA200 | Tendência bearish perfeita | -2 |
| EMA9 < EMA21 < EMA50 | Tendência bearish curto prazo | -1 |

### Golden Cross / Death Cross
- **Golden Cross**: EMA50 > EMA200 → mercado bullish estruturalmente
- **Death Cross**: EMA50 < EMA200 → mercado bearish estruturalmente

---

## Grupo 2 — Ichimoku Cloud

Indicador japonês que combina suporte/resistência, tendência e momentum num só sistema. Configurado para crypto (mercado 24/7):

| Componente | Crypto | Tradicional | Fórmula |
|-----------|--------|-------------|---------|
| Tenkan-sen | 10 | 9 | (Max10 + Min10) / 2 |
| Kijun-sen | 30 | 26 | (Max30 + Min30) / 2 |
| Senkou Span B | 60 | 52 | (Max60 + Min60) / 2 |
| Senkou Span A | — | — | (Tenkan + Kijun) / 2 |

### A Nuvem (Kumo)
Formada pelos Span A e B. O espaço entre eles é a "nuvem":
- **Nuvem Verde** (SpanA > SpanB) → momentum bullish
- **Nuvem Vermelha** (SpanA < SpanB) → momentum bearish

### Interpretação

| Condição | Score |
|----------|-------|
| Preço acima de nuvem verde | +2 (forte bullish) |
| Preço acima de nuvem vermelha | +1 |
| Preço dentro da nuvem | 0 (indecisão) |
| Preço abaixo de nuvem vermelha | -2 (forte bearish) |
| Preço abaixo de nuvem verde | -1 |
| TK Cross bullish (Tenkan cruza Kijun para cima) | +0.5 |
| TK Cross bearish (Tenkan cruza Kijun para baixo) | -0.5 |

---

## Grupo 3 — RSI (Relative Strength Index)

Mede a velocidade e magnitude das mudanças de preço. Período: 14.

```
RSI = 100 - (100 / (1 + RS))
RS = Média de ganhos / Média de perdas (14 períodos)
```

Implementação usa o método Wilder (smooth RSI) — mais preciso que o simples.

### Interpretação

| RSI | Condição | Score |
|-----|----------|-------|
| < 25 | Profundamente oversold — reversão provável | +1.5 |
| 25-35 | Zona oversold | +0.5 |
| 35-65 | Neutro | 0 |
| 65-75 | Zona overbought | -0.5 |
| > 75 | Profundamente overbought — reversão provável | -1.5 |

### Stochastic RSI
Aplica o oscilador estocástico ao RSI (não ao preço), tornando-o mais sensível a mudanças de momentum.

```
StochRSI K = (RSI_atual - RSI_min14) / (RSI_max14 - RSI_min14) × 100
```

---

## Grupo 4 — MACD

Combina duas EMAs para medir momentum e mudanças de tendência.

```
MACD Line   = EMA(12) - EMA(26)
Signal Line = EMA(9) da MACD Line
Histogram   = MACD Line - Signal Line
```

### Interpretação

| Condição | Score |
|----------|-------|
| Histograma positivo forte (> 10% da MACD line) | +1.5 |
| Histograma positivo | +0.5 |
| Histograma negativo forte | -1.5 |
| Histograma negativo | -0.5 |

### Divergência MACD
- **Bullish Divergence**: preço faz mínimos mais baixos mas MACD não → reversão bullish provável (+0.5)
- **Bearish Divergence**: preço faz máximos mais altos mas MACD não → reversão bearish provável (-0.5)

---

## Grupo 5 — Bollinger Bands

Envelope de volatilidade em torno de uma SMA(20).

```
Middle Band = SMA(20)
Upper Band  = SMA(20) + 2 × StdDev(20)
Lower Band  = SMA(20) - 2 × StdDev(20)

%B = (Preço - Lower) / (Upper - Lower)
Band Width = (Upper - Lower) / Middle
```

### Interpretação

| Condição | Score |
|----------|-------|
| %B < 0 (preço abaixo da banda inferior) | +1 (oversold) |
| %B > 1 (preço acima da banda superior) | -1 (overbought) |
| Band Width < 5% (squeeze) | 0 (breakout iminente — neutro) |

**Bollinger Squeeze**: quando as bandas estreitam muito, significa que o mercado está em compressão e um movimento explosivo está próximo. O bot deteta isto e alerta.

---

## Grupo 6 — Volume (OBV)

### On Balance Volume (OBV)
Acumula volume na direção do preço:
```
Se preço subiu: OBV += Volume
Se preço desceu: OBV -= Volume
Se igual: OBV inalterado
```

Depois aplica uma EMA(5) nos últimos 10 valores de OBV para determinar tendência.

### Interpretação

| Condição | Score |
|----------|-------|
| Volume > 2x média + OBV crescente | +1 (spike confirmado bullish) |
| Volume > 2x média + OBV decrescente | -1 (spike confirmado bearish / distribuição) |
| OBV crescente | +0.5 |
| OBV decrescente | -0.5 |

---

## Grupo 7 — Smart Money Concepts (SMC)

Conceitos usados por traders institucionais para identificar onde "o dinheiro inteligente" entrou no mercado.

### Order Blocks (OB)

Zonas onde instituições colocaram ordens grandes. Identificados por:

**Bullish OB:**
- Vela bearish (fecha < abre)
- Seguida imediatamente por uma vela bullish forte que quebra o máximo da bearish
- A vela bullish deve ser > 1.5× o tamanho médio das últimas 10 velas

```
Candle[i]: bearish (close < open)
Candle[i+1]: bullish e fecha > Candle[i].high
→ Candle[i] é um Bullish Order Block
```

**Bearish OB:** lógica inversa.

Se o preço atual está **dentro ou próximo de um OB**: ±1 no score.

### Fair Value Gaps (FVG)

Desequilíbrios de preço criados por movimentos institucionais fortes. Identificados por 3 velas consecutivas onde existe um gap:

```
Candle[1].high  |
                |← GAP (FVG)
Candle[3].low   |
```

**Bullish FVG:** `Candle[3].low > Candle[1].high` com vela do meio bullish
**Bearish FVG:** `Candle[3].high < Candle[1].low` com vela do meio bearish

O mercado tende a **voltar para preencher** estes gaps. Se o preço está num FVG: ±0.5 no score.

---

## Grupo 8 — Fibonacci Retracement

Calculado sobre os últimos 50 candles:

```
High = máximo dos últimos 50 candles
Low  = mínimo dos últimos 50 candles
Range = High - Low

Nível X% = High - Range × X
```

Níveis calculados: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%

O nível **61.8% (Golden Ratio)** é o mais importante — o mercado frequentemente retrai até aqui antes de continuar a tendência. Se o preço está a ±2% do 61.8%: +0.5 no score.

---

## Swing Points e Suporte/Resistência Dinâmico

Identifica swing highs e swing lows com força 3 (precisa de 3 candles consecutivos em cada lado a confirmar):

```
SwingHigh[i]: high[i] > high[i-1,i-2,i-3] e high[i] > high[i+1,i+2,i+3]
SwingLow[i]:  low[i]  < low[i-1,i-2,i-3]  e low[i]  < low[i+1,i+2,i+3]
```

- **Suporte**: maior swing low abaixo do preço atual
- **Resistência**: menor swing high acima do preço atual

---

## Deteção de Fase de Mercado

Com base nos últimos 30 candles:

| Condição | Fase |
|----------|------|
| Preço subiu > 5% e está acima EMA20 | Markup (tendência bullish) |
| Preço desceu > 5% e está abaixo EMA20 | Markdown (tendência bearish) |
| Variação < 3% com volume crescente | Distribution (topo/lateralização) |
| Outro | Accumulation (base/lateralização) |
