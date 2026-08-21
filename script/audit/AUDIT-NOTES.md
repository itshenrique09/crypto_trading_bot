# Auditoria do núcleo de alpha — notas de trabalho

> Ficheiro vivo. Tudo o que for importante fica aqui para não se perder entre fases.
> Regras: prova = `script/validate-pipeline.ts` (ALL+2026); hipótese antes do teste;
> custos modelados + cenário -0.12R; sem alterações em produção; `tsc --noEmit` sempre.

## Implementação (2026-08-14, autorizada pelo utilizador)

1. **Pausa manual de estratégias + UI** (pedido do utilizador): setting `disabled_strategies` (JSON em
   bot_settings), lido por `getEnabledStrategies()` — único choke point dos dois scans (paper routes.ts:2220,
   live routes.ts:3140). Pausar bloqueia SÓ novas entradas; posições abertas continuam geridas pelos check
   loops. `GET /api/strategies` devolve `enabled` real + `killSwitchPaused` por engine; `PUT
   /api/strategies/:id/toggle` (revivido do endpoint deprecated) persiste e faz broadcast SSE. UI: painel
   "Estratégias" em Definições (toggles, badges de kill-switch, skeleton, nota explicativa).
   **Verificado no browser**: RSI arranca "pausada", round-trip ligar/pausar persiste, e o scan-log do
   engine mostra 0 entradas rsi-divergence com ATOM/INJ a serem scanados pelo LS.
2. **RSI Divergence pausada por default** (`DEFAULT_DISABLED_STRATEGIES = ["rsi-divergence"]`, com citação
   da auditoria no código; override persistido a um clique na UI).
3. **Linha TRIAGE minus rsi-divergence** adicionada ao harness oficial (documenta o with/without em todos
   os relatórios futuros).
4. **A/B oficial floor LS 68→60 — CONCLUÍDO (2026-08-14)**, harness oficial, ambas as corridas com o mesmo
   cache de candles; relatório floor-60 guardado em `script/audit/validate-pipeline-report-LS-floor60.md`;
   o relatório committed foi restaurado para a corrida floor-68 (estado real do código).
   | Config | ALL sumR | 2026 sumR | exp ALL/2026 | PF ALL/2026 | maxDD bal. |
   |---|---|---|---|---|---|
   | floor 68 + RSI ativa (Run A ENGINE) | +692.6 | +467.0 | 0.56/0.55 | 1.92/1.90 | 30.9% |
   | floor 68 + RSI pausada (Run A TRIAGE) = **estado atual shipped** | +711.0 | +493.8 | 0.58/0.58 | 1.96/1.95 | 28.4% |
   | floor 60 + RSI ativa (Run B ENGINE) | +939.0 | +678.9 | 0.58/0.62 | 1.95/2.03 | 56.0% |
   | floor 60 + RSI pausada (Run B TRIAGE) = **proposta** | **+960.4** | **+725.3** | **0.59/0.64** | **1.97/2.07** | **42.7%** |
   Vs estado atual: **+35% sumR ALL / +47% 2026, exp e PF sobem, maxDD 28.4%→42.7% (1.5×)**. Números batem
   ao dígito com o sweep do fork de auditoria (validação cruzada). Critérios pré-registados: ΔsumR ≥+15%
   nas duas janelas ✓; ≥100 trades ✓; sobrevive -0.12R ✓; expNoTop5 limpo ✓; ressalva mantida: banda 64-68
   não-monotónica → confiança média. Floor de produção mantido a 68 — decisão de risco entregue ao
   utilizador; se aplicar, a política do repo exige 90 dias de paper a confirmar a direção.
5. `.claude/launch.json` atualizado para PORT=5001 (nota do CLAUDE.md).
6. **Pausa por modo** (pedido do utilizador, 2ª iteração): listas separadas
   `disabled_strategies_paper` / `disabled_strategies_live` (legacy `disabled_strategies` lida como
   fallback → migração transparente); `PUT /api/strategies/:id/toggle` aceita `mode: paper|live|both`;
   UI com dois interruptores por estratégia (paper=violeta, live=âmbar). Caso de uso verificado no browser:
   RSI paper=ON / live=OFF. Nota de comparabilidade: com listas divergentes, o paper deixa de ser benchmark
   1:1 do live nas estratégias afetadas — usar trades por estratégia nas comparações de execução.

## Backlog de hipóteses (para A/B futuro — NÃO tocar durante a janela de 90d)

- **Cooldown direction-aware** (anedota ICP 2026-08-15: live estopado num SHORT ficou em cooldown 12h e
  perdeu o sinal LONG oposto 4h depois, que o paper apanhou por ter journal limpo — +2.46R). Hipótese: o
  cooldown por (símbolo, estratégia) podia bloquear só re-entradas na MESMA direção. n=1 anedota ≠ evidência;
  o harness não distingue direção no cooldown — exigiria extensão + A/B pré-registado ALL+2026. Reavaliar
  no fim da janela, junto com o gate de drift (dados a acumular nas notes das trades live).

## Estado

- **2026-08-14**: Fase 0 concluída. Fase 1 concluída (resultados abaixo) — pendente só a revisão
  adversarial de paridade do código de auditoria (workflow em curso). Próxima: Fase 2 (triagem de estratégias).
- Branch de backup criada: `backup/main-2026-08-14` @ `2a43fe2`.
- Artefactos: `script/audit/phase0-dump.ts` (fork validado por paridade exata),
  dump per-trade em `script/.cache/audit-phase0-trades.json` (1229 trades, inclui MFE/MAE);
  `script/audit/lib.ts` + `phase1-exits.ts` (braços P1.1-P1.6) + `phase1b-minsl.ts` (exploratório);
  resultados em `script/.cache/audit-phase1-results.json`.

## Fase 0 — Baseline (fechado)

Comandos:
```
npx tsx script/validate-pipeline.ts --candles=8000 --capital=500 --risk=2
npx tsx script/audit/phase0-dump.ts --candles=8000 --capital=500 --risk=2
```

ENGINE-CURRENT (universo 40, pós-LUNC):

| | ALL | 2026 |
|---|---|---|
| Trades | 1229 | 843 |
| exp | +0.564R [IC95 0.456, 0.672] | +0.554R [0.425, 0.686] |
| exp com -0.12R | +0.444R [0.336, 0.552] | +0.434R [0.305, 0.566] |
| PF / WR | 1.92 / 44.3% | 1.90 / 44.5% |
| sumR | +692.6 | +467.0 |
| maxDD | 30.9% balance / 19.7R | 19.7R |
| top-3 share | 3.4% | 4.9% |

Causas de fecho (ALL): SL 55.4% (avg -1.10R) · TP2 26.4% (+2.97R) · trailing 15.8% (+2.32R) ·
timeout 2.3% (+0.85R) · TP1-total 0.2% · **breakeven 0.0%** (trail 2R ≥ entry logo após TP1 → substitui o BE).

Per-strategy ALL (exploratório): LS T=1082 exp+0.578 (robusto à penalização); BR T=96 exp+0.417
(IC com penalização cruza 0); RSI T=51 exp+0.541 (top-5 = 80% do seu sumR; IC c/ penalização cruza 0).

**Realidade vs simulação**: paper 02-Jul→13-Ago n=173 exp+0.281R PF 1.40 (≈ metade do simulado 2026);
live n=8 todos ganhadores (+13.7R); pares emparelhados n=2 gap -0.64R (inconclusivo, mecanismo = caminho
de saída do runner, não slippage de entrada).

### Correções ao briefing (verificadas no código)
- Removidos dos motores em Jul 2026: filtro ATR-percentil ≤85, SHORT ≥72 conf, contra-trend 75/score-6, guard mensal -8R.
- Universo = **40** moedas (LUNC saiu a 2026-08-14), não 41.
- Trailing r_multiple 2R é default de produção via settings (`routes.ts:1607-1609`); `trade-exits.ts` sozinho defaulta a fixed_pct 2%.
- `MIN_SL_DISTANCE_PCT` **rejeita** o sinal (não alarga o stop) — routes.ts:41-45.
- Fee taker do harness = 0.02% vs Kraken real 0.05% (flag para calibração P1.4).
- Harness não modela: filtros live-only (volume/spread/funding), drift de entrada, gaps (fill exato no nível), downtime; candles Binance spot como proxy.

### Questões em aberto
- Live notes mostram trades com vol24h $0-4M vs `MIN_VOLUME_USDT=30M` (routes.ts:1868) — semântica do filtro de volume a confirmar (não bloqueante para Fases 1-2).
- Relatório committed foi gerado com LUNC ainda no universo (corrida começou antes do commit do drop); baseline fresco ≈ linha VENUE(−LUNC) ✓.

---

## Fase 1 — Anatomia das saídas — PRÉ-REGISTO (escrito antes de correr)

Infra: `script/audit/lib.ts` + `script/audit/phase1-exits.ts` (candidatos construídos UMA vez;
braços partilham o mesmo conjunto de candidatos; portfolio sim idêntico ao ENGINE-CURRENT).
Paridade obrigatória: braço default da lib reproduz Fase 0 ao dígito antes de qualquer braço contar.

**Critérios de adoção (todos obrigatórios)**: Δexp ≥ +0.05R/trade (ou ≥ +15% sumR) vs ENGINE em
**ALL e 2026**; IC95 bootstrap do braço não cruza 0; ≥100 trades por braço; sobrevive a -0.12R e à
remoção dos top-5; vizinhos do braço vencedor também melhoram (**plateau, não pico**).
**Correção para testes múltiplos**: N≈39 comparações confirmatórias nesta fase → um "vencedor"
tem de sobreviver a IC ~99.9% (Bonferroni 0.05/39), senão é registado como sugestivo, não adotável.

- **P1.1 Grade TP1-split × trailing (30 braços)**: split {0, 30, 50, 60, 75, 100%} × trail {1.5R, 2R, 2.5R, 3R, fixed 2%}.
  Hipótese: superfície ~plana com plateau largo em split 50-100%; trail 2R ≈ ótimo local; sem interação forte.
  Métrica primária: exp (ALL+2026). Se nada passa os critérios → manter exit atual e registar margem como ruído.
- **P1.2 BE pré-TP1 (beAtR {0.5, 1.0, 1.5}R)**: só é confirmatório se o descritivo D2 mostrar ≥15% dos SL-losses
  a tocar ≥+1R antes de morrer. Mecanismo novo no simulador (extensão local; com beAtR off = paridade bit-a-bit).
  Hipótese: beAtR=1.0 sobe exp se o waste for alto; risco: whipsaws a entry matam runners que iam a TP.
- **P1.3 Max-hold**: braços {1h:100/4h:60}, {1h:300/4h:60}, {1h:400/4h:90}, {1h:200/4h:90}.
  Hipótese: estender sobe exp marginalmente (<+0.05R → não adotável); honestamente esperado inconclusivo (timeouts n=28).
- **P1.4 Fee Kraken 0.05%** (calibração, não decisão): ENGINE com takerFeePct=0.0005. Esperado: exp cai ~0.05-0.09R.
- **P1.5 Gates minRR/minSL** (exploratório, sem portfólio): n e exp standalone dos candidatos rejeitados, por estratégia.
  Hipótese: minSL rejeita trades com custo ≥0.2R (exp standalone baixo); minRR rejeita poucos (floors internos ≥2).
- **P1.6 Stop ATR mecânico** {1.5, 2.0}×ATR14 vs estrutural atual (TPs fixos, gates re-aplicados, por estratégia).
  Hipótese: estrutural ≥ ATR. Se ATR ganhar ≥+0.05R com plateau entre multiplicadores → flag para teste profundo, não adoção.
  Limitação declarada: TPs foram desenhados com o SL original (R:R interno das estratégias) — isto testa colocação do stop com alvos fixos.

**Descritivos (sem pré-registo — não são decisões)**:
- D1: quanto R o trailing 2R deixa na mesa — para runners pós-TP1, netR alcançado vs mfeFullR.
- D2: tabela MFE — % de trades que tocaram +1R/+2R/+3R e fecharam ≤0.
- D3: "BE pós-TP1 salva ou custa?" reformulado — runners fechados ~entry cujo mfeFullR chegava ao TP2.

### Resultados Fase 1 (2026-08-14, PARITY OK no braço default; log: phase1-run.log; JSON: script/.cache/audit-phase1-results.json)

**Veredito global: NENHUM braço passa os critérios pré-registados (Δexp ≥ +0.05R em ALL+2026).
O exit atual (TP1 60% → trail r_multiple 2R) está num plateau largo — não é um pico de overfit.**

- **P1.1 grade (26 braços)**: baseline no topo do plateau; melhores alternativas: tp1=100% (Δ+0.005/+0.010),
  tp1=75% r3.0 (Δ+0.008/+0.026) — ruído. Vizinhos coerentes; superfície suave. Conclusão: manter exit.
- **P1.2 BE pré-TP1 — hipótese de exp REFUTADA, mas achado secundário forte**: apesar de 47% das perdas
  terem tocado +1R (D2), os ratchets BE baixam exp (whipsaw a entry mata winners): BE@0.5R Δexp -0.118.
  PORÉM: BE@0.5R dá **PF 2.85 (vs 1.92), maxDD 12.2R (vs 19.7R), sumR ALL +694 ≈ baseline (+693)** com T=1556.
  Mesmo R total, metade do drawdown → candidato a A/B pré-registado dedicado se o objetivo for DD (permitiria
  subir risk% ao mesmo DD). 2026 sumR ligeiramente pior (+457 vs +467). NÃO adotável pelos critérios atuais.
- **P1.3 max-hold**: tudo ±0.011 — inconclusivo/ruído (timeouts são só 2.3% dos trades). Manter 200h/240h.
- **P1.4 fee Kraken 0.05%**: exp ALL +0.533 / 2026 +0.526 (-0.03 vs modelo 0.02%). Com -0.12R: ~+0.41R.
  O edge simulado sobrevive a custos realistas.
- **P1.5 gates**: `MIN_RISK_REWARD=1.5` rejeita **0** candidatos (floors internos das estratégias ≥2 — letra morta,
  inofensivo). `MIN_SL_DISTANCE_PCT=0.006` rejeita 136 sinais cujo netR standalone é **+0.676** [0.34,1.02]
  (LS: +0.794, n=113) — hipótese refutada: o gate rejeita sinais bons NA SIMULAÇÃO. Caveat crítico: o custo real
  de stops apertados é slippage live (o incidente de Mai 2026 que motivou o gate), que o modelo de 0.05% fixo
  não captura.
- **P1.5b exploratório (não pré-registado)**: floor 0.4% → +51 trades, sumR +724 ALL (+4.5%) / +501 2026 (+7.3%),
  exp e DD inalterados. Abaixo de 0.4% degrada (exp -0.015). FALHA os critérios de adoção; re-visitar apenas com
  medição live de slippage por distância de stop (dados a acumular no journal Kraken).
- **P1.6 stop ATR mecânico**: REFUTADO com força — k=1.5: Δexp -0.160; k=2.0: Δexp -0.248. O stop estrutural
  (swing+buffer) é claramente superior para LS (+0.578 vs +0.400/+0.306) e RSI; BR indiferente (n≈96, ruído).
  Manter stops estruturais.
- **D1 (trail deixa na mesa)**: runners médios realizam +2.3R (trailing) / +3.0R (TP2) contra máximos de janela
  de 10-12R — mas TODAS as tentativas de capturar mais cauda (trails largos, splits baixos) pioram ou empatam.
  A cauda é teórica/path-dependent; o trail 2R já captura o que é capturável.
- **D3**: 77% dos runners fechados sem TP2 tinham o nível do TP2 alcançável dentro da janela (mfeFullR ≥ TP2),
  mas os braços que tentam esperar por ele (trail 2.5-3R) não melhoram exp — o timing não é capturável à escala
  da carteira.

**Implicação para a Fase 3 (custo de oportunidade)**: afinar saídas rende ~0 (plateau). Os levers reais que
sobraram: (a) BE@0.5R como redução de DD (não de R), (b) floor minSL 0.4% como capacidade marginal (+30R/ano,
condicionado a slippage live), (c) throughput/novas fontes de sinal — a starvation continua a ser o problema
dominante (paper real: 173 trades/6 semanas vs sim 843/7.5 meses ≈ mesmo ritmo; o gap real é exp 0.28 vs 0.55).

**Verificação adversarial do código Fase 1** (workflow, 3 revisores — TODOS parity-holds):
- lib-vs-harness: um edge NaN teórico que não pode disparar (gate de paridade aborta); footguns de contrato
  satisfeitos pelo caller; PF de bucket vazio só cosmético.
- Simulador BE: fuzz diferencial de 30.000 cenários — 0 desvios na delegação e no caminho nunca-armado;
  6.441 divergências com ratchet ativo, TODAS exits BE pré-TP1 intencionais; sem look-ahead.
- Driver Fase 1 (minors de reporting, nenhum muda conclusões porque nenhum braço passou o screen e todos os
  vieses iam na direção de ajudar braços a passar): (a) IC Bonferroni nunca computado de facto — moot, zero
  candidatos; (b) via "+15% sumR" ausente do screen — verificado manualmente nos sumR impressos: máx +4%,
  nada perto de +15%; (c) **D2 sobreconta** "tocou +XR e morreu" ao incluir o high do próprio bar de saída —
  corrigido: campo `mfePreExitR` na lib, recontagem exata impressa na Fase 2 (D2-exact); (d) D1 mistura
  unidades (~2.5× overstated, upper bound declarado); (e) grupo timeout do D1/D3 vazio por construção
  (produção re-etiqueta timeouts pós-TP1 como "tp1" — os 0.2% "tp1" da Fase 0 são timeouts com TP1);
  (f) crash latente P1.6 se atr14≤0 (não disparou); (g) expNoTop5 só ALL; assert de paridade não cobria
  sumR 2026 (bateu visualmente).

---

## Fase 2 — Triagem das estratégias — PRÉ-REGISTO (escrito antes de correr)

Contexto estrutural: preferredSymbols do B&R (SOL SAND BNB XRP AVAX ETC) e do RSI (ATOM INJ) são TODOS
subconjuntos do universo LS(40) → o guard 1-posição/símbolo cria canibalização mecânica. Foi isto que matou
a confluence-swing. A pergunta certa: "o portfólio melhora com a estratégia lá dentro?"

**P2.1 Contribuição marginal (6 braços confirmatórios)**: ENGINE−LS, ENGINE−RSI, ENGINE−BR, LS-só, RSI-só, BR-só.
Métrica primária: Δ(sumR do portfólio) with-vs-without, ALL e 2026; secundárias Δexp, ΔmaxDD(R).
Hipóteses: (H-LS) remover LS colapsa o portfólio — trivial manter; (H-RSI) contribuição marginal < o seu sumR
próprio (+27.6R) por canibalização em ATOM/INJ; pode ser ~0; (H-BR) contribuição marginal < +40R e 2026 fraca
(só 21 trades 2026 — starvation própria).
**Regras de veredito (pré-registadas)**:
- MANTER: marginal ≥ +10R ALL **e** ≥ 0R em 2026.
- PAUSAR: marginal ≤ 0 em ambas as janelas (a estratégia tira mais do que põe), OU marginal 2026 < −10R.
- AFINAR: marginal positiva numa janela, negativa noutra, com causa identificável (ex.: floor de confiança).
- MATAR: PAUSAR + expectativa própria com -0.12R ≤ 0 com n≥30 + sem estabilidade temporal.
- <30 trades na perna → inconclusivo, default MANTER-e-vigiar (não se mata com ruído).

**P2.2 Estabilidade temporal (descritivo)**: R por semestre e por ano civil, por estratégia, do dump baseline.
Um edge só-2026 é condicional; reportar sem gate estatístico (amostras pequenas nos semestres).

**P2.3 Sensibilidade ao floor de confiança (diagnóstico de robustez, não adoção)**: reconstruir candidatos
por chamada direta a liquiditySweepSignal/rsiDivergenceSignal/breakRetestSignal com floor 60 e varrer:
LS {60,64,68*,72,76}, RSI {66,72*,78}, BR {60,68*,76} (asterisco = produção; braço no floor de produção tem
de reproduzir o baseline — sanity check). Cada braço mantém as OUTRAS estratégias nos candidatos de produção.
Hipótese: floors atuais estão em plateaus; um pico agudo no valor atual = red flag de overfit do freeze.
Limitação declarada: thresholds internos (wick ratio, vol multiple, RSI 40/60, touches S/R) NÃO são injetáveis
sem fork profundo de analysis.ts — fica registado como não-testado nesta fase.

N confirmatório Fase 2 = 6 (P2.1); P2.3 são ~11 braços diagnósticos.

---

## Fase 5 — Universo por moeda — PRÉ-REGISTO (escrito antes de correr; 2026-08-14)

Contexto: seleção de moedas in-sample é o pecado original do projeto. Regras fixadas ANTES de ver resultados.

**P5.1 Remoções (exclude-one, 40 moedas, fork com paridade):**
Proposta de remoção APENAS se (a) marginal exclude-one ≥ +5R em ALL **e** 2026 (portfólio melhor sem a moeda
nas duas janelas), **e** (b) sumR standalone da moeda negativa em AMBAS as metades do stream 1h.
Multiplicidade: 40 comparações → 1-2 falsos positivos a p=0.05 são ESPERADOS; por isso exige-se a conjunção
(a)+(b) com piso de efeito. Com ~27 trades/moeda, o esperado honesto é: quase tudo inconclusivo. Nenhuma
remoção é aplicada automaticamente — vai para decisão do utilizador. Remoções operacionais (delisting) são
um mecanismo separado (blocklist na UI).

**P5.2 Adições (screen de duas metades, método Jul 2026 com 2 desvios declarados):**
Candidatas = (Kraken Futures PF_*USD tradeable) ∩ (Binance USDT spot com ≥4000 candles 1h) − universo 40
− stablecoins, com pré-filtro de liquidez OPERACIONAL (volume 24h Binance ≥ $20M — não é filtro de
performance). Regra de passagem (igual a Jul): T≥30 · PF≥1.5 · sumR>0 em AMBAS as metades da janela 8000×1h.
Desvios vs Jul, declarados: exit = produção (r_multiple 2R, não fixed_pct 2%) e floor de confiança = 60
(produção atual). Sobreviventes → A/B full-pipeline no fork (paridade verificada): proposta de adição só se
o sumR do portfólio melhora em ALL **e** 2026, exp não degrada >0.02R e maxDD(R) não sobe >15%.
Rejeitadas de Jul que voltem a ser testadas são reportadas SEPARADAS (risco de teste repetido).
Adoção final = corrida no harness oficial + decisão do utilizador (como o floor).

**P5.3 BR/RSI:** sem decisões por moeda — BR tem ~2 trades/moeda/ano (inconclusivo por construção) e a RSI
está em observação paper-only. Registado como não-testável.

### Resultados Fase 5 (2026-08-14; log: phase5-run.log; JSON: script/.cache/audit-phase5-universe.json)

Baseline do fork = floor 60 produção, paridade exata com a corrida oficial floor-60 (T=1614/+939.0; 1091/+678.9).

**P5.1 Remoções: NENHUMA moeda cumpre a regra pré-registada.** Todas as 40 têm sumR standalone positivo no
total, e só ETC/GRT/ARB têm UMA metade negativa (nunca as duas). Os marginais exclude-one variam de +215R
(TIA) a −84R (GRT) — dispersão dominada por path-dependence (a soma dos marginais positivos ≈ +2500R num
portfólio de +939R: remover uma moeda liberta slots e reordena tudo), NÃO por contribuição própria. A regra
de conjunção evitou 8 falsas "remoções" que o marginal ingénuo sugeria (GRT, ARB, VET, ONDO, NEAR, CRV,
SAND, BTC — todas com standalone positivo nas duas metades). **Watch-list** (marginal negativo nas duas
janelas, sem ação): GRT (−84/−99, H2 −17), ARB (−40/−32, H2 −3), VET, ONDO, NEAR, CRV, SAND, BTC.
Reavaliar no fim da janela de 90 dias com dados novos — não antes.

**P5.2 Adições: NENHUMA.** Kraken lista 276 bases perp; após ∩ Binance(≥$20M/24h) − universo sobram só
4 candidatas: ACE (fail PF 1.38), ZEC (fail PF 1.24), XAUT (histórico insuficiente), TRX (n=7, repetida).
O universo está saturado no tier de liquidez atual — a expansão de Jul apanhou tudo o que valia. Adicionar
mais exigiria baixar o bar de liquidez, o que é desaconselhado com o slippage live por medir.

**Veredito Fase 5: universo fica como está (40).** A blocklist operacional por moeda na UI cobre o caso
LUNC (delistings) sem reabrir a porta ao tuning in-sample.

---

## Fase 6 — Protótipo TSMOM 1d — PRÉ-REGISTO (escrito antes de correr; 2026-08-14)

Especificação PRIMÁRIA (fixada antes de qualquer corrida; da investigação Fase 3 — Donchian/trend diário,
vol-scaled via stop ATR; SEM otimização):
- Universo: as MESMAS 40 moedas do LS (nenhuma seleção nova — evita o pecado original).
- Sinal (candle diário fechado): LONG se close > máximo dos 55 dias anteriores; SHORT se close < mínimo.
- Stop: 2.0×ATR(20d). TP1 = 1.75×dist_stop (RR 1.75 > gate 1.5). TP2 = 3.5×dist_stop. Runner: exit de
  produção (TP1 60% → trail r2.0). Confidence fixa 70. Cooldown 72h. maxBars 200 dias (fork).
- Sensibilidade (plateau, não adoção; one-at-a-time): N ∈ {40, 70}; STOP_K ∈ {1.5, 2.5} (TPs escalam com o stop).

Critérios pré-registados (da Fase 3): sleeve TSMOM com ≥100 trades no ALL; exp do sleeve com -0.12R e IC95
sem cruzar 0; Δ portfólio 2026 (janela de interação com LS) ≥ 0 — não pode canibalizar; correlação diária
de P&L sleeve-vs-LS < 0.3; ~+30R/ano no ALL do sleeve; plateau nos 4 braços vizinhos. 2026-só consistência
direcional (potência limitada declarada).
Limitações declaradas: candles 1d Binance spot; gate weeklyTrend só existe para 4h (1d isento no fork — a
integração real teria de decidir); MAX_HOLD do engine não tem entrada "1d" (fork usa 200d); o modelo de
exit TP1/trail é o de produção — um TSMOM "puro" (sem TP) não é expressável sem mexer no engine, portanto
isto testa a variante implementável.

## Fase 7 — Margem como parâmetro de desenho — PRÉ-REGISTO (2026-08-14)

Contexto: o fix 2a43fe2 (checkMarginCapacity) fez os motores recusar posições sem margem, mas deixou
deliberadamente o harness sem modelo de margem — o +939R assume concorrência ilimitada. Pergunta do
utilizador: "e se eu quiser subir o live para 1% ou 2%?" — a resposta certa é um A/B margin-aware, não
um número fixo no paper.

Modelo no fork (extensão OPCIONAL à lib; desligada = paridade intacta): notional por posição =
riskUsd ÷ slDistPct do candidato; recusa quando openNotional + novo > equity × leverage (espelha
checkMarginCapacity; simplificação declarada: notional cheio até ao fecho — ignora a redução do TP1
parcial, ligeiramente conservador). Capacidade em nº de posições é invariante ao compounding (numerador
e denominador escalam com o balance).

Braços: risco% ∈ {0.5, 1, 2} × leverage ∈ {5, 7, 10} (10× = máx. Kraken retail), maxOpen 10, exit e floor
de produção. Métrica: sumR ALL+2026 vs sem-margem (+939.0/+678.9) + nº de recusas por margem.
Hipóteses: 0.5% ≈ sem perda a qualquer lev; 1% perde pouco a 7-10×; 2% perde muito a 5-7× (capacidade
3.7-5.1 posições < maxOpen 10). Decisão final = utilizador escolhe o triplo (risco, lev, maxOpen); regra
operacional derivada: **paper espelha SEMPRE o triplo pretendido para o live**.

### Aplicado pós-Fase 7 (2026-08-14, autorizado: "faz da melhor maneira / paper realista")

1. **Custos reais Kraken em todo o lado**: taker 0.02%→0.05% em `TRADE_COSTS` (bookkeeping dos dois engines)
   E em `trade-exits.ts` (simulador de backtest) — mantém o invariante backtest=paper=live. Testes 164/164 ✓.
2. **Relatório oficial re-gerado com os custos reais** (baseline committed = verdade do código):
   - ENGINE (floor 60, com RSI): ALL T=1479 +766.6R exp +0.52 | 2026 T=974 +544.3R exp +0.56
   - **TRIAGE sem RSI = ESTADO SHIPPED: ALL T=1551 +845.7R exp +0.55 | 2026 T=1101 +649.9R exp +0.59**
   - Custo dos fees reais vs 0.02%: ≈ −0.05R/trade a floor 60 (−115R ALL) — maior que os −0.03 medidos
     a floor 68 (P1.4), coerente: stops mais apertados em mais trades.
   - A pausa da RSI vale AINDA MAIS com fees reais: +79R ALL / +106R 2026.
   - **ALVO DA JANELA DE 90 DIAS (paper realista): exp 2026 ≈ +0.59R/trade, ~34 trades/semana.**
3. **Gauge de margem**: /api/paper/status expõe openNotionalUsd/capacityUsd; Definições mostram "Margem
   agora: X% usada" + hint de capacidade EM DIRETO nos sliders (paper e live): capacidade ≈ lev × 1.47% ÷
   risco%, com aviso âmbar quando < maxOpen 10.
4. **Config recomendada** (utilizador aplica na instância real): paper = triplo pretendido do live =
   **1% / 10×** (custo de margem −1.2R ≈ zero); live fica 0.5%/7× até a janela confirmar; 2%/trade fora
   do menu na Kraken retail (−262R mesmo a 10×).

### Resultados Fase 7 (2026-08-14; paridade s/margem: T=1614/+939.0 ✓)

| risco | lev | sumR ALL (Δ) | sumR 2026 (Δ) | recusas |
|---|---|---|---|---|
| 0.5% | 5× | +939.0 (−0.1) | +678.9 (−0.1) | 19 |
| 0.5% | 7-10× | +940.9 (+1.9) | +680.8 (+1.9) | 0 |
| 1% | 5× | +660.7 (**−278.4**) | +414.9 (−264.0) | 566 |
| 1% | 7× | +886.9 (−52.1) | +628.0 (−50.9) | 240 |
| **1%** | **10×** | **+937.8 (−1.2)** | **+677.7 (−1.2)** | **18** |
| 2% | 5× | +501.4 (**−437.6**) | +315.2 (−363.7) | 2011 |
| 2% | 7× | +656.4 (−282.6) | +400.2 (−278.8) | 1100 |
| 2% | 10× | +676.6 (**−262.4**) | +430.9 (−248.0) | 526 |

**Conclusões:** (a) 0.5% não perde nada a qualquer lev; (b) **1% é viável com 10× (custo −1.2R ≈ zero)**,
proibitivo a 5×; (c) **2% não tem config viável na Kraken retail** — mesmo a 10× deixa −262R ALL (−28%)
na mesa (10 posições a 2% exigiriam ~14×). Config atual do paper (2%/5×) é o pior quadrante da tabela.
Regra operacional: paper espelha o TRIPLO PRETENDIDO do live. Caminho de escala validado:
live 0.5%/7× hoje → (1%, 10×) quando a janela de 90d confirmar; 2%/trade fica fora do menu — a escala
acima disso vem de capital/compounding, não de risco por trade.

### Resultados Fase 6 (2026-08-14; log: phase6-run.log) — **REJEITADO pelos critérios pré-registados**

| Critério | Resultado | Passa? |
|---|---|---|
| Sleeve ALL ≥100 trades | T=386 | ✓ |
| Exp sleeve c/ -0.12R, IC>0 | +0.233 → pen +0.113, IC [0.093, 0.380] | ✓ (fraco) |
| Descorrelação diária < 0.3 | **r = −0.030** | ✓✓ (mecanismo confirmado) |
| ~+30R/ano | +23.5R/ano | ✗ |
| Δ portfólio 2026 ≥ 0 | **−559R** | ✗✗✗ |
| Plateau nos vizinhos | N=40: +0.110; stop 1.5×: **−0.008**; N=70: +0.168; stop 2.5×: +0.207 — pico, não plateau | ✗ |

**Causa do chumbo (a descoberta que importa):** incompatibilidade ARQUITETURAL, não falta de edge.
Posições TSMOM seguram semanas/meses (cap 200d) e ocupam os slots do guard 1-posição/símbolo e do
maxOpen=10 — o livro LS (que gera ~10× mais R por slot-dia) fica esfomeado: portfólio 2026 cai de 1091
para 233 trades. Qualquer estratégia multi-semanas que partilhe o universo/slots com o LS canibaliza POR
CONSTRUÇÃO — é o efeito confluence-swing elevado a meses. A única integração viável seria um **sleeve com
capital/slots próprios** (mudança de arquitetura de portfólio), e o sleeve medido (+23R/ano, PF 1.42,
sem plateau) não paga esse custo hoje.
A descorrelação (r≈−0.03) confirma a tese da investigação — o driver é mesmo independente — por isso a
família fica na prateleira: re-visitar SE um dia existir arquitetura de sleeves separados, com espec
re-derivada (a atual não tem plateau).

**Veredito: NÃO integrar TSMOM como estratégia de registry.** Custo de descoberta: uma tarde e zero
código de produção — exatamente para isto é que o harness serve.

### Resultados Fase 2 (2026-08-14, PARITY OK; log: phase2-run2.log; JSON: script/.cache/audit-phase2-results.json)

**Nota metodológica**: a 1ª corrida do P2.3 tinha um bug de prioridade em empates (tsSec,símbolo) entre
estratégias (candidatos pseudo apendados no fim → BR perdia empates vs LS; o braço no floor de produção não
reproduzia o baseline, +10R). Corrigido inserindo os pseudo na posição de registry; na 2ª corrida os TRÊS
sweeps reproduzem o baseline ao dígito no floor de produção. Efeito colateral informativo: a prioridade de
empate entre estratégias vale ~±10R — a ordem do registry importa no engine real.

**D2-exact** (correção do reviewer): 46.8% das perdas tinham tocado ≥+1R ANTES do bar de saída (vs 47.4%
upper bound da Fase 1) — narrativa da Fase 1 intacta.

**P2.1 Contribuição marginal (baseline − minus-X):**
| Estratégia | Marginal ALL | Marginal 2026 | Standalone ALL | Standalone 2026 |
|---|---|---|---|---|
| liquidity-sweep | **+633.0R** | **+444.6R** | +665.1R (T=1120) | +478.9R (T=821) |
| rsi-divergence | **−18.3R** | **−26.8R** | +21.9R (T=66) | +17.6R (T=43) |
| break-retest | **+13.8R** | **−17.2R** | +40.0R (T=96) | +7.1R (T=21) |

RSI: lucrativa sozinha, mas o portfólio é MELHOR sem ela em ambas as janelas — canibaliza entradas LS em
ATOM/INJ via guard 1-posição/símbolo (o padrão confluence-swing). Floor 78 não é um tune: deixa 1 trade.
BR: mista; 2026 tem só 21 trades próprios (<30 → inconclusivo pela regra).

**P2.2 Estabilidade**: LS consistente (2025H2 +0.61, 2026H1 +0.61, 2026H2 +0.43 — softening recente,
coerente com o paper realizado +0.28); BR alterna sinal por semestre (2024H2 −7.8R) — edge fraco e lento
mas com 3.7 anos de história; RSI: 2026H2 −0.4R.
Robustez própria (portfolio baseline): LS pen-CI [0.343,0.576] limpo, expNoTop5 0.548; BR pen-CI cruza 0,
expNoTop5 0.234; RSI pen-CI cruza 0, **expNoTop5 0.119** (top-5 = 80% do lucro).

**P2.3 Sweeps de floor de confiança:**
- BR: plateau (60≈68; 76: +7.7/+1.1 ruído). Sem ação.
- RSI: fn interna já floora a 72; subir para 78 = remover (1 trade).
- **LS: floor 68 NÃO está num plateau** — é o achado nº1 da auditoria:
  | floor | T | sumR ALL | Δ | sumR 2026 | Δ | exp ALL | exp 2026 | maxDD(R) | expNoTop5 |
  |---|---|---|---|---|---|---|---|---|---|
  | 60 | 1614 | +939.0 | **+246.4 (+36%)** | +678.9 | **+211.9 (+45%)** | +0.582 | +0.622 | 36.2 | 0.561 |
  | 64 | 1413 | +775.4 | +82.7 | +544.5 | +77.5 | +0.549 | +0.591 | 38.0 | 0.525 |
  | 68* | 1229 | +692.6 | 0 | +467.0 | 0 | +0.564 | +0.554 | 19.7 | 0.537 |
  | 72 | 880 | +444.3 | −248.3 | +304.9 | −162.1 | +0.505 | +0.530 | 16.7 | 0.472 |
  | 76 | 553 | +232.4 | −460.2 | −302.8 | +0.420 | +0.455 | 18.1 | 0.376 |
  Subir o floor destrói (a confiança É informativa acima de 68). Descer para 60 adiciona ~385 trades com exp
  marginal ≈ +0.65R (portfolio-level) e +36%/+45% sumR — MAS duplica o maxDD em R (19.7→36.2). Não-monotónico
  em 64 (banda 64-68 fraca) → estrutura em bandas = confiança média, não alta. P2.3 era diagnóstico, não
  adoção: isto define o PRÓXIMO A/B pré-registado no harness oficial (diff: floor 68→60 no wrapper LS +
  decisão de risco sobre o DD; ver Fase 3).

**VEREDITOS (regras pré-registadas):**
- **liquidity-sweep: MANTER** (marginal +633R/+445R; pen-CI limpo; sem concentração). Único candidato a
  AFINAR real: floor de confiança (A/B oficial pendente, trade-off DD).
- **rsi-divergence: PAUSAR** (marginal −18.3R ALL e −26.8R 2026 — consistente nas duas janelas; concentração
  top-5=80%; pen-CI cruza 0). Confiança média: magnitude pequena (3-6% do sumR), mas o sinal é consistente e
  o mecanismo (canibalização ATOM/INJ) é o mesmo que matou a confluence-swing. Implementação limpa: remover
  do registry (2 linhas), reversível.
- **break-retest: MANTER-E-VIGIAR** (inconclusivo: 2026 n=21<30; marginal +13.8/−17.2 mista; é a única
  estratégia 4h com 3.7 anos de história e a única fonte de sinal fora do LS). Rever quando 2026 tiver ≥30
  trades próprios.

---

## Fase 3 — Vale a pena procurar uma estratégia nova? (síntese; investigação: workflow 5 agentes/98 fontes)

**Custo de oportunidade medido (R/ano, base 2026-sim ~7.5 meses anualizados):**
| Lever | R/ano esperado | Esforço | Risco | Estado da evidência |
|---|---|---|---|---|
| Afinar saídas (Fase 1) | **~0** | — | — | Plateau provado, 26 braços |
| LS floor 68→60 | **~+340R/ano** (2026: +212R/7.5m) | 1 linha + A/B oficial | maxDD(R) 2× (19.7→36.2) | Medido no fork; banda 64-68 fraca → confiança média |
| Pausar RSI | **~+43R/ano** (2026: +26.8R/7.5m) | 2 linhas, reversível | Perde diversificação nominal | Medido, consistente ALL+2026 |
| BE@+0.5R pré-TP1 | 0 em R; **DD −38%** (19.7→12.2R) | Config exit + A/B oficial | Exp/trade cai −0.12 | Medido; lever de DD, não de R |
| Estratégia nova | +30-80R/ano *se* validar | Semanas + 90d paper | Validação pode nem ser possível (potência) | Prior art abaixo |

**Starvation**: o diagnóstico de Jul mantém-se só em parte — throughput atual ≈26-29 trades/semana (sim e
paper coincidem). O bloqueio dominante é `exposure` (1199 blocks) = guard 1-posição/símbolo; perSymbol=2 já
foi testado no harness oficial (≈neutro). O lever de throughput real é o floor LS (+385 trades/ano medidos),
não uma família nova.

**Famílias candidatas (vereditos da investigação + crítica):**
1. **TSMOM / trend-following diário (multi-semanas)** — **strong-prior** (Liu-Tsyvinski 1-8w continuation;
   evidência académica mais limpa). Descorrelação: positive-feedback multi-semanas vs negative-feedback
   12-60h do suite atual; ganha exatamente nos regimes one-way onde o LS sangra. Dados: 1d candles (harness
   já suporta "1d") + funding drag (a modelar). Encaixa no registry como estratégia normal (stop ATR(20d),
   cooldown 24-48h). Caveats: crashes de momentum, whipsaw em range (2023-style), net Sharpe ~1-1.5 assenta
   quase num único paper (Zarattini) — single-source, dito explicitamente.
2. **Vol-compression breakout (continuation)** — **moderate-prior**. Mecanismo-complemento exato do LS:
   o LS é pago quando o breakout FALHA, esta é paga quando SEGURA — correlação trade-level esperada
   baixa/negativa. Puro OHLCV, encaixe perfeito no harness. Evidência pública mais fraca/inconsistente
   (WR 30-36%, chop bleed pode disparar os drawdown guards; um dos números-chave do brief era internamente
   inconsistente — crítica anotada).
3. **CS momentum semanal** — moderate-prior mas **rejeitada por agora**: não encaixa no Strategy.analyze
   single-symbol (precisa de sleeve de ranking universe-wide), precisa de universo point-in-time (o pecado
   original do projeto outra vez), e o resultado negativo mais replicado é morte-por-custos.
4. **Funding carry/fade** — **weak-prior, rejeitada**: decay estrutural documentado (compressão pós-ETF
   ~3-5pp; Ethena a sair do basis em 2026); a variante delta-neutral (a única com evidência forte) precisa
   de perna spot que o bot não tem; a fade direcional não tem um único backtest público com números.
   Se um dia: verificar 1º a cadência/fórmula real de funding da Kraken Futures (crítica: assumida sem fonte).

**Aviso de potência (da crítica, válido)**: o A/B ALL+2026 pode ser estruturalmente incapaz de validar
famílias de baixa frequência (TSMOM ~centenas de trades no ALL mas poucos em 2026). Critério de aceitação
pré-registado para a família nova: ≥100 trades no braço ALL; 2026 apenas consistência direcional; marginal
de portfólio ≥ +30R/ano no ALL; sobrevive -0.12R e remoção top-5; correlação diária sim vs livro LS < 0.3;
90 dias de paper antes de live.

**Resposta à pergunta 4 da missão**: SIM, vale a pena UMA família nova (TSMOM 1d primeiro; compression
breakout como 2ª), mas SÓ depois de colher os dois levers baratos e medidos (floor LS + pausar RSI) — uma
família nova não-validada rende menos por unidade de esforço×risco do que +340R/ano num diff de 1 linha.
