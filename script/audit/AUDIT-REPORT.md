# Auditoria do núcleo de alpha — Relatório final
**Data**: 2026-08-14 · **Âmbito**: SL/TP, triagem de estratégias, custo de oportunidade, famílias novas
**Método**: fork de auditoria com paridade exata vs `script/validate-pipeline.ts` (verificada por 3 revisores adversariais + fuzz diferencial de 30k cenários), hipóteses pré-registadas em `AUDIT-NOTES.md` antes de cada corrida, custos modelados, cenário -0.12R em tudo.
**Sem alterações em produção.** Backup: branch `backup/main-2026-08-14` @ `2a43fe2`.

---

## 1. Sumário executivo

**As saídas não são o problema.** O exit de produção (TP1 60% → break-even → trailing 2R) está no topo de um plateau largo: 26 combinações de split×trailing, ratchets de break-even, max-hold e stops ATR mecânicos — nenhum braço chega perto do critério de adoção (Δexp ≥ +0.05R em ALL e 2026). O stop estrutural esmaga o ATR mecânico (−0.16 a −0.25 Δexp). O `MIN_RISK_REWARD=1.5` rejeita zero sinais (letra morta inofensiva). Deixar de mexer nas saídas: o retorno esperado desse trabalho é ~0.

**O portfólio é o Liquidity Sweep.** Contribuição marginal: LS +633R ALL / +445R 2026; RSI Divergence **−18.3R ALL / −26.8R 2026** (o portfólio é melhor sem ela — lucrativa isolada, mas canibaliza entradas LS em ATOM/INJ via guard 1-posição/símbolo, o mesmo mecanismo que matou a confluence-swing; 80% do lucro próprio está em 5 trades); Break & Retest misto (+13.8/−17.2) com n=21 em 2026 — inconclusivo, mantém-se sob vigilância.

**O maior lever da auditoria é o floor de confiança do LS.** O floor 68 não está num plateau: subir destrói (−248R a −460R), descer para 60 adiciona ~385 trades/ano com expectativa marginal ≈ +0.65R — **+36% sumR ALL / +45% 2026** — mas duplica o drawdown em R (19.7→36.2). É a resposta medida à trade starvation. Confiança média (banda 64-68 não-monotónica); exige A/B no harness oficial + decisão explícita de risco + 90 dias de paper (política do repo).

**Estratégia nova: sim, mas depois.** Prior art (5 investigadores, ~40 fontes): TSMOM diário multi-semanas tem o prior mais forte e é o complemento mecânico do suite (positive-feedback vs negative-feedback); compression breakout é a 2ª candidata; funding-carry e CS-momentum rejeitadas (decay estrutural / não encaixa na arquitetura). Nenhuma família nova bate +340R/ano por 1 linha de diff — colher primeiro os levers baratos.

**Aviso de calibração**: com fees reais Kraken (0.05%) o exp simulado é +0.53R; o paper realizado de 6 semanas corre a +0.28R (n=173). O edge sobrevive a -0.12R com folga em todos os cenários centrais, mas o gap simulação→realidade é o risco número um de todas estas estimativas.

---

## 2. Tabela de decisão

| Item | Veredito | Efeito medido (IC95) | n trades | ALL+2026? | Sobrevive -0.12R? | Confiança |
|---|---|---|---|---|---|---|
| Exit atual (TP1 60% + trail 2R) | **MANTER** | baseline exp +0.564R [0.456, 0.672] | 1229 | ✓ | ✓ (+0.444R) | Alta |
| Qualquer variante de exit testada | **REJEITAR** | melhor Δ: +0.008/+0.026 (ruído) | 26+11 braços | ✗ (nenhum passa) | — | Alta |
| Stop ATR mecânico | **REJEITAR** | Δexp −0.16 (k=1.5) a −0.25 (k=2.0) | 1114/799 | ✗ ambas | ✗ | Alta |
| BE@+0.5R pré-TP1 | **NÃO ADOTAR** (flag DD) | Δexp −0.118; maxDD 19.7→12.2R; sumR ≈ igual | 1556 | sumR: ✓/− | ✓ (+0.326R) | Média |
| MIN_RR 1.5 | **MANTER** (inofensivo) | rejeita 0 candidatos | 0 | — | — | Alta |
| minSL 0.6%→0.4% | **NÃO ADOTAR** (aguarda slippage live) | +31R ALL / +34R 2026; Δexp ≈ 0 | +51 | ✓ mas <15% | ✓ | Baixa |
| MAX_HOLD 200h/240h | **MANTER** | variantes ±0.011 (ruído) | 4 braços | ✗ | — | Média |
| liquidity-sweep | **MANTER** | marginal +633R ALL / +445R 2026; pen-CI [0.343, 0.576] | 1082 | ✓ | ✓ | Alta |
| rsi-divergence | **PAUSAR** | marginal −18.3R ALL / −26.8R 2026; expNoTop5 +0.119 | 51 | ✓ (consistente) | própria: cruza 0 | Média |
| break-retest | **MANTER-E-VIGIAR** | marginal +13.8 ALL / −17.2 2026 | 96 (21 em 2026) | inconclusivo | pen-CI cruza 0 | — |
| LS floor 68→60 | **A/B OFICIAL** (próximo passo) | +246R ALL (+36%) / +212R 2026 (+45%); exp 2026 +0.622 [CI arm 0.486, 0.680]; maxDD 2× | 1614 | ✓ | ✓ (+0.46/+0.50) | Média |
| Família nova: TSMOM 1d | **PROTÓTIPO depois dos levers** | prior art forte; sem número interno ainda | — | por testar | — | — |
| Família nova: funding-carry, CS-momentum | **REJEITAR por agora** | decay estrutural / mismatch arquitetural | — | — | — | Média |

---

## 3. Evidência por fase (comandos exatos + números crus)

### Fase 0 — Baseline reproduzido
```
npx tsx script/validate-pipeline.ts --candles=8000 --capital=500 --risk=2
npx tsx script/audit/phase0-dump.ts --candles=8000 --capital=500 --risk=2
```
ENGINE-CURRENT (universo 40, pós-LUNC): ALL T=1229 WR 44.3% PF 1.92 sumR +692.6 exp +0.564R [0.456, 0.672] maxDD 30.9%/19.7R · 2026 T=843 exp +0.554R [0.425, 0.686]. Top-3 trades = 3.4% do sumR. Fork validado por paridade exata (T/WR/PF/sumR/exp/maxDD/gate-blocks idênticos ao dígito). Saídas: SL 55.4% (avg −1.10R), TP2 26.4% (+2.97R), trailing 15.8% (+2.32R), timeout 2.3% (+0.85R); breakeven 0% (o trail 2R ≥ entry após TP1 substitui o BE).

### Fase 1 — Anatomia das saídas
```
npx tsx script/audit/phase1-exits.ts --candles=8000 --capital=500 --risk=2
npx tsx script/audit/phase1b-minsl.ts
```
- Grade split {0,30,50,60,75,100%} × trail {1.5R, 2R, 2.5R, 3R, fixed 2%}: baseline no topo; melhores alternativas Δ+0.005 a +0.026 — ruído; plateau suave (vizinhos coerentes).
- D2-exact: 46.8% das perdas tocaram ≥+1R antes do bar de saída; mas ratchets BE@{0.5,1.0,1.5}R baixam exp (−0.076 a −0.118) — whipsaw a entry mata winners. BE@0.5R: PF 2.85, maxDD 12.2R, sumR +694 ≈ baseline.
- Fee Kraken real 0.05%: exp +0.533 ALL / +0.526 2026 (−0.03). Com -0.12R: ~+0.41R.
- minSL rejeita 136 sinais com netR standalone +0.676 [0.337, 1.018] — o gate custa R na simulação, mas existe por causa de slippage live em stops apertados (não modelado). Floor 0.4%: +31/+34R, Δexp≈0, <15% → não adotável já.
- minRR 1.5: 0 candidatos rejeitados (floors internos ≥2.0).
- Stops ATR k∈{1.5, 2.0}: Δexp −0.160/−0.248; por estratégia, LS estrutural +0.578 vs ATR +0.400/+0.306.
- Max-hold {100,300,400 barras 1h; 60,90 4h}: tudo ±0.011.
- Verificação adversarial: 3× parity-holds; fuzz diferencial 30.000 cenários, 0 desvios nos caminhos de paridade.

### Fase 2 — Triagem
```
npx tsx script/audit/phase2-strategies.ts
```
- Marginal (baseline − minus-X): LS +633.0/+444.6; RSI −18.3/−26.8; BR +13.8/−17.2. Standalone: LS-only +665R (T=1120); RSI-only +21.9R (T=66); BR-only +40.0R (T=96).
- Robustez própria: LS pen-CI [0.343, 0.576] limpo, expNoTop5 0.548; RSI pen-CI [−0.098, 0.991], expNoTop5 0.119; BR pen-CI [−0.060, 0.678], expNoTop5 0.234.
- Estabilidade: LS +0.61/+0.61/+0.43 (2025H2/2026H1/2026H2); BR alterna sinal por semestre; RSI 2026H2 −0.4R.
- Sweeps de floor (todos reproduzem o baseline ao dígito no floor de produção): LS 60→+246.4/+211.9 (DD 36.2R), 64→+82.7/+77.5, 72→−248.3/−162.1, 76→−460.2/−302.8; RSI 78 deixa 1 trade (não é tune); BR plateau.
- Bug apanhado e corrigido na 1ª corrida do P2.3: prioridade de empates (tsSec,símbolo) entre estratégias vale ~±10R; a ordem do registry importa também no engine real.

### Fase 3 — Custo de oportunidade e famílias novas
Workflow de investigação (5 agentes, ~40 fontes citadas, crítica de completude independente). Vereditos: TSMOM 1d strong-prior; compression breakout moderate; CS-momentum moderate mas rejeitada (arquitetura + custos); funding-carry weak (decay pós-ETF ~3-5pp documentado; Ethena a sair do basis; variante delta-neutral precisa de spot). Detalhe e fontes: output do workflow + `AUDIT-NOTES.md`.

### Realidade (exports 2026-08-14)
Paper 02-Jul→13-Ago: n=173, exp +0.281R, PF 1.40, WR 38%. Live: 8 fechados, todos ganhadores, +13.7R; pares emparelhados paper↔live n=2, gap −0.64R/trade (inconclusivo, <30).

---

## 4. O que NÃO consegui testar (e porquê)

1. **Slippage live por distância de stop** — bloqueia a decisão do minSL 0.4%. Os fills da Kraken ainda são só 8 trades, todos winners; o journal não computa fill vs trigger dos stops (recomendado em `reconcile-live-fills.ts`).
2. **Thresholds internos das estratégias** (wick ratio, vol multiple, RSI 40/60, nº de touches S/R) — não injetáveis sem fork profundo de `analysis.ts` (~2500 linhas); o sweep de floor de confiança é o proxy testado. Fica como follow-up se o A/B do floor 60 confirmar.
3. **Filtros live-only (volume/spread/funding à entrada)** — o harness não os simula (declarado no próprio ficheiro); explicam parte do gap sim (+0.55R) vs paper (+0.28R), mas a atribuição exata não é mensurável com os dados atuais. Nota: trades live mostram vol24h $0-4M vs `MIN_VOLUME_USDT=30M` — semântica do filtro por esclarecer.
4. **Gaps e sequência intrabar** — o simulador fecha ao nível exato (otimista em gaps contra); mitigado pela convenção SL-antes-de-TP e pelo cenário -0.12R, não eliminado.
5. **Correlação em cascata (Oct-2025-style)** — o harness não modela liquidation cascades; o cap same-direction já foi rejeitado num A/B anterior, mas o stress conjunto "todos os livros perdem ao mesmo tempo" não é testável com candles horários.
6. **Potência estatística para famílias de baixa frequência** — o próprio A/B ALL+2026 pode não conseguir validar/invalidar TSMOM na janela 2026 (poucos trades); o critério de aceitação pré-registado usa ALL + consistência direcional 2026 por essa razão.
7. **IC da diferença entre braços** — os braços partilham dados (altamente correlacionados); os ICs apresentados são por-braço vs 0. Um bootstrap emparelhado ao nível de candidato seria mais potente; os efeitos adotáveis aqui ou são enormes (floor LS) ou nulos (exits), pelo que a conclusão não muda.

---

## 5. Plano priorizado (retorno ÷ esforço×risco)

1. **A/B oficial: LS floor 68→60** — próximo passo concreto. Diff de 1 linha em `server/strategies/liquidity-sweep.ts` (`sig.confidence < 68` → `< 60`) + corrida `npx tsx script/validate-pipeline.ts` ALL+2026 com hipótese pré-registada: "+≥15% sumR nas duas janelas, exp ≥ baseline−0.02, aceitando maxDD(R) ≤ 40". Se passar: 90 dias de paper (política do repo) antes de live. Opcional no mesmo A/B: braço combinado floor60 + BE@0.5R (o lever de DD pode compensar a duplicação do drawdown — os dois efeitos foram medidos separadamente, a interação não).
2. **Pausar rsi-divergence** — remover do registry (2 linhas, reversível), +43R/ano esperados. Custo de reversão ~0; re-testar quando ATOM/INJ deixarem de estar no universo LS ou com prioridade de empate explícita.
3. **Instrumentar slippage live** — computar fill-vs-trigger nos exits de stop/TP1 no journal (a recomendação já existe em memória do projeto); desbloqueia minSL 0.4% (+31R/ano) e calibra o -0.12R.
4. **Protótipo TSMOM 1d** (depois de 1-3): estratégia registry-compatível (Donchian/MA-cross 20-200d, stop ATR(20d), cooldown 24-48h, funding drag modelado), A/B full-pipeline com critério pré-registado (marginal ≥ +30R/ano ALL, consistência 2026, correlação diária vs LS < 0.3, sobrevive -0.12R e top-5).
5. **Não fazer**: mexer em splits/trails/max-hold (plateau), stops ATR, funding-carry, CS-momentum, re-tuning de thresholds internos sem o A/B do floor fechado primeiro.

---
*Artefactos: `script/audit/` (scripts + notas), `script/.cache/audit-phase{0,1,2}-*.json` (dados crus por trade/braço), logs de corrida no scratchpad da sessão. Todos os scripts passam `npx tsc --noEmit`.*
