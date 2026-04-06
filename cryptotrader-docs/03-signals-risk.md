# Sistema de Sinais e Gestão de Risco

**Ficheiro:** `server/analysis.ts` → função `generateSignal()`

---

## Sistema de Confluência (-10 a +10)

O bot agrega todos os indicadores num único **score de confluência**. A lógica é simples: cada indicador contribui com pontos positivos (bullish) ou negativos (bearish), e só se gera sinal quando a soma ultrapassa um limiar.

### Pesos por Indicador

| Indicador | Peso Máximo Bullish | Peso Máximo Bearish |
|-----------|--------------------|--------------------|
| EMA Alignment | +2.0 | -2.0 |
| Ichimoku Cloud | +2.5 | -2.5 |
| RSI | +1.5 | -1.5 |
| MACD | +1.5 | -1.5 |
| Bollinger Bands | +1.0 | -1.0 |
| Volume / OBV | +1.0 | -1.0 |
| Order Blocks (SMC) | +1.0 | -1.0 |
| Fair Value Gaps (SMC) | +0.5 | -0.5 |
| Fibonacci | +0.5 | 0 |
| **TOTAL** | **+11.5** | **-11.5** |

O score é clampado entre -10 e +10.

---

## Tipos de Sinal

| Score | Sinal | Cor |
|-------|-------|-----|
| ≥ +5 | STRONG BUY | Verde forte |
| +2 a +4.9 | BUY | Verde |
| -1.9 a +1.9 | HOLD | Amarelo |
| -4.9 a -2 | SELL | Vermelho |
| ≤ -5 | STRONG SELL | Vermelho forte |

### Porquê estes limiares?

- **±2**: pelo menos 2-3 indicadores a concordar — sinal válido mas não excepcional
- **±5**: pelo menos 4-5 indicadores a concordar fortemente — alta probabilidade
- **HOLD**: zona de ruído — o mercado está indeciso, melhor não entrar

---

## Cálculo de Confiança

```
Confiança = min(95%, max(10%, |score| × 10 + 15))
```

Exemplos:
- Score ±2 → 35% confiança
- Score ±5 → 65% confiança
- Score ±8 → 95% confiança

O máximo é 95% — nenhum sistema é 100% certo.

---

## Gestão de Risco — ATR Based

O bot usa o **ATR (Average True Range)** para calibrar stop loss e take profits dinamicamente. O ATR mede a volatilidade real do ativo, então o SL/TP adapta-se automaticamente: mais largo em ativos voláteis, mais apertado em ativos estáveis.

### Stop Loss

```
Para STRONG BUY / STRONG SELL (|score| ≥ 5):
  Stop Loss = Entrada ± 1.5 × ATR

Para BUY / SELL (|score| < 5):
  Stop Loss = Entrada ± 2.0 × ATR
```

Sinais mais fortes têm SL mais apertado — mais confiança, menos espaço para o mercado errar.

### Take Profits (3 níveis)

```
Risco = |Entrada - Stop Loss|

TP1 = Entrada ± 1 × Risco   (1:1 R:R)  ← fechar 33% da posição
TP2 = Entrada ± 2 × Risco   (2:1 R:R)  ← fechar 33% da posição
TP3 = Entrada ± 3 × Risco   (3:1 R:R)  ← fechar o restante
```

Estratégia profissional: sair em 3 parcelas reduz o risco à medida que o trade avança.

### Position Sizing

```
Se |score| ≥ 5 (STRONG signal): 1.5% do portfolio
Se |score| ≥ 3:                 1.0% do portfolio
Se |score| ≥ 2:                 0.5% do portfolio

Ajustes por volatilidade:
  Volatilidade alta:    × 0.75
  Volatilidade extrema: × 0.50
```

Isto segue a **regra dos 1-2%**: nunca arriscar mais de 1-2% do capital em qualquer trade. Permite sobreviver a longas sequências de perdas.

---

## Classificação de Volatilidade

Baseada no ATR como percentagem do preço:

| ATR % | Classificação |
|-------|--------------|
| < 1.5% | Baixa |
| 1.5% - 3% | Média |
| 3% - 6% | Alta |
| > 6% | Extrema |

---

## Exemplo Prático — BTC

Supõe que o bot devolve:

```
Score: +6  →  STRONG BUY
Confiança: 75%
Entrada: $67,371
ATR: $197 (0.29% do preço → volatilidade baixa)

Stop Loss = $67,371 - 1.5 × $197 = $67,075  (-0.44%)
TP1       = $67,371 + $296      = $67,667  (+0.44%)
TP2       = $67,371 + $592      = $67,963  (+0.88%)
TP3       = $67,371 + $888      = $68,259  (+1.32%)

Position Size: 1.5% do portfolio
R:R Ratio: 1:3
```

**Como usar na prática:**
1. Entrar com 1.5% do portfolio a $67,371
2. Colocar SL a $67,075
3. Quando atingir TP1 ($67,667), fechar 1/3 e mover SL para breakeven
4. Quando atingir TP2 ($67,963), fechar mais 1/3
5. Deixar o restante correr até TP3

---

## Razões Detalhadas

Para cada sinal, o bot fornece uma lista de razões específicas que contribuíram para o score, por exemplo:

```
✅ EMAs perfectly aligned bullish (9>21>50>200)
✅ Price above green Ichimoku Cloud — strong bullish
✅ MACD strong bullish momentum
✅ Price at bullish Order Block — institutional buy zone
✅ Bullish Fair Value Gap being filled
✅ Price at 61.8% Fibonacci — golden retracement
```

Estas razões permitem ao trader perceber **porquê** o bot está a sinalizar, e decidir se concorda com a análise.

---

## O que o Bot NÃO faz

- **Não executa ordens** — é um sistema de análise, não um bot de execução automática
- **Não considera notícias ou sentimento** — puramente técnico
- **Não garante resultados** — indicadores técnicos são probabilísticos, não determinísticos
- **Não considera taxas** — os targets não incluem comissões da exchange

---

## Limitações Conhecidas

1. **Dados históricos diários**: a CoinGecko gratuita fornece dados diários para 90 dias. Para análise intraday (1h, 4h), seria necessária uma API paga (Binance, etc.)

2. **OHLC aproximado**: a API gratuita não fornece OHLC real — open e close são estimados a partir dos preços hora a hora, e high/low são ligeiramente artificiais (adicionamos uma variação aleatória pequena como proxy).

3. **Rate limiting**: a CoinGecko gratuita limita a ~30 requests/minuto. O bot tem throttling integrado de 1.2 segundos entre chamadas.

4. **Sem backtesting**: o bot analisa o presente mas não tem histórico de performance dos sinais passados.
