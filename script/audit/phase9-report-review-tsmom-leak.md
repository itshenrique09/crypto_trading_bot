# Phase 9 — ADVERSARIAL REVIEW (leakage / selection lens) of the TSMOM T0 verdict — 2026-09-02
Pipeline verbatim from phase9-tsmom.ts ($1000 @ 1%, honest signal-close entry, engine gates, ENGINE_EXIT {"trailMode":"r_multiple","trailRMultiple":2}). Review arms only; nothing promoted.

## Data — 40-coin LS universe
  loaded 40/40: UNI ICP AAVE PEPE INJ BCH FIL LTC ATOM AVAX XRP DOGE SOL ETC NEAR DOT SAND LINK APT HBAR SEI ETH SUI BNB ARB TIA BTC FET RENDER ONDO ENA WLD CRV GALA RUNE GRT IMX POL VET ADA
  BTC:1d 2022-07-25 → 2026-09-02 (1500); phase-6 run of 2026-08-14 covered 1500 daily candles ending 2026-08-13 → overlap ≈ 98.7% of this window

## Candidates (40-coin universe, post minSL/R:R gates): 2481 (phase9-tsmom.ts reported 2481)

## L0 reproduce T0 — A→Z tie-break, 200-bar cap, signal-close entry
  T=403 WR=44% PF=1.32 sumR=+73.8 exp=+0.183 iidCI95=[+0.049, +0.317] weekClusterLo=-0.020 (K=118) monthClusterLo=-0.070 (K=44) maxDD=30.0R
  halves +0.146 (T=250) / +0.244 (T=153) · top5 trades 18% · top5 MONTHS 119% of sumR · coins+ 24/40 · 104 tr/yr · L/S 260/143 · literal PAPER=PASS ACCEPT=FAIL
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=64 killSwitch=47 ddDaily=2

## L1 ENGINE tie-break order (SCANNER_COINS = LS preferredSymbols order), 200-bar cap
  T=407 WR=40% PF=1.12 sumR=+30.2 exp=+0.074 iidCI95=[-0.060, +0.207] weekClusterLo=-0.110 (K=129) monthClusterLo=-0.146 (K=44) maxDD=31.0R
  halves +0.058 (T=240) / +0.098 (T=167) · top5 trades 41% · top5 MONTHS 193% of sumR · coins+ 18/40 · 105 tr/yr · L/S 259/148 · literal PAPER=FAIL ACCEPT=FAIL
  blocks: maxOpen=1055 exposure=707 cooldown=112 groupCap=77 ddRolling7d=65 killSwitch=42 ddDaily=16

## L2 same-timestamp tie-break null distribution — 200 random orders (all daily candidates of a day share one timestamp; maxOpen blocked 1035 candidates in L0)
  exp min/p5/p25/median/p75/p95/max = +0.045/+0.074/+0.108/+0.128/+0.151/+0.176/+0.211
  reported A→Z result +0.183 sits at percentile 96.0 of the null · ENGINE order +0.074 at percentile 5.5
  literal PAPER criteria pass in 54/200 orders (27%) · exp ≥ 0.15 in 54/200 · iid CI lo > 0 in 85/200 · iid CI lo > −0.05 in 185/200

## L3 cluster bootstrap — see weekClusterLo / monthClusterLo on each row above (iid CI in phase9-tsmom.ts treats same-day breakouts across 40 coins as independent)

## L4 ENGINE max-hold parity — 240h fallback = 10 daily bars (routes.ts:99-102 has no "1d" key), A→Z
  T=752 WR=45% PF=1.09 sumR=+30.4 exp=+0.040 iidCI95=[-0.037, +0.116] weekClusterLo=-0.085 (K=164) monthClusterLo=-0.089 (K=48) maxDD=30.3R
  halves +0.079 (T=396) / -0.003 (T=356) · top5 trades 42% · top5 MONTHS 283% of sumR · coins+ 21/40 · 194 tr/yr · L/S 396/356 · literal PAPER=FAIL ACCEPT=FAIL
  blocks: exposure=686 maxOpen=595 killSwitch=143 cooldown=142 groupCap=85 ddRolling7d=77 ddDaily=1

## L4b ENGINE max-hold 10 bars + ENGINE order
  T=753 WR=45% PF=1.11 sumR=+35.3 exp=+0.047 iidCI95=[-0.029, +0.123] weekClusterLo=-0.080 (K=166) monthClusterLo=-0.083 (K=48) maxDD=27.2R
  halves +0.087 (T=394) / +0.002 (T=359) · top5 trades 37% · top5 MONTHS 219% of sumR · coins+ 19/40 · 194 tr/yr · L/S 397/356 · literal PAPER=FAIL ACCEPT=FAIL
  blocks: exposure=684 maxOpen=618 cooldown=136 killSwitch=136 groupCap=81 ddRolling7d=72 ddDaily=1

  L0 decomposition by hold: ≤10 bars T=204 sumR=-46.6 exp=-0.229 · >10 bars T=199 sumR=+120.4 exp=+0.605 — the engine as written cannot hold the second group

## L5 entry at NEXT candle open (fill realism), A→Z, 200-bar cap
  T=403 WR=44% PF=1.32 sumR=+73.8 exp=+0.183 iidCI95=[+0.049, +0.317] weekClusterLo=-0.020 (K=118) monthClusterLo=-0.070 (K=44) maxDD=30.0R
  halves +0.146 (T=250) / +0.243 (T=153) · top5 trades 18% · top5 MONTHS 119% of sumR · coins+ 24/40 · 104 tr/yr · L/S 260/143 · literal PAPER=PASS ACCEPT=FAIL
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=64 killSwitch=47 ddDaily=2

## L6 time concentration of L0: top-5 entry-months = 119% of sumR · by year: 2022 T=31 -10.1R exp=-0.32 | 2023 T=149 +40.2R exp=+0.27 | 2024 T=111 +17.3R exp=+0.16 | 2025 T=66 +33.6R exp=+0.51 | 2026 T=46 -7.3R exp=-0.16

## L7 selection-bias probe — U-A (expand-universe-ls candidates NOT admitted by the LS screen)
  loaded 14/14: TON TRX ALGO XLM JUP WIF BONK MKR MANA STX TAO AXS OP SHIB
  candidates 737 (no COIN_GROUP entries for these coins → group cap inactive, which is permissive)
## L7 U-A — A→Z, 200-bar cap
  T=248 WR=39% PF=0.98 sumR=-2.3 exp=-0.009 iidCI95=[-0.171, +0.155] weekClusterLo=-0.187 (K=114) monthClusterLo=-0.210 (K=50) maxDD=17.7R
  halves -0.001 (T=102) / -0.015 (T=146) · top5 trades —% · top5 MONTHS —% of sumR · coins+ 8/14 · 51 tr/yr · L/S 132/116 · literal PAPER=FAIL ACCEPT=FAIL
  blocks: exposure=410 cooldown=57 maxOpen=15 killSwitch=7

  50 random orders: exp min/median/max -0.018/-0.002/+0.007 · exp ≥ 0.15 in 0/50
  ungated signal level (every candidate): T=737 exp=-0.192 PF=0.72 (40-coin universe ungated in phase9-tsmom.ts: T=2481 exp −0.040 PF 0.94)

## L7 selection-bias probe — U-B (2022-era Binance large caps never in the LS universe)
  loaded 30/30: EOS XTZ THETA EGLD ZIL CHZ ENJ ONE NEO IOTA QTUM DASH ZEC BAT LRC 1INCH COMP SNX YFI SUSHI KSM FLOW KAVA ROSE CELO ANKR AR STORJ SKL ICX
  candidates 1904 (no COIN_GROUP entries for these coins → group cap inactive, which is permissive)
## L7 U-B — A→Z, 200-bar cap
  T=359 WR=44% PF=1.32 sumR=+66.1 exp=+0.184 iidCI95=[+0.039, +0.332] weekClusterLo=-0.038 (K=120) monthClusterLo=-0.062 (K=50) maxDD=20.4R
  halves +0.020 (T=163) / +0.321 (T=196) · top5 trades 26% · top5 MONTHS 109% of sumR · coins+ 19/30 · 71 tr/yr · L/S 198/161 · literal PAPER=PASS ACCEPT=FAIL
  blocks: maxOpen=743 exposure=650 cooldown=88 killSwitch=31 ddRolling7d=30 ddDaily=3

  50 random orders: exp min/median/max +0.129/+0.209/+0.288 · exp ≥ 0.15 in 47/50
  ungated signal level (every candidate): T=1904 exp=-0.046 PF=0.93 (40-coin universe ungated in phase9-tsmom.ts: T=2481 exp −0.040 PF 0.94)

## reference — 40-coin ungated signal level: T=2481 exp=-0.040 PF=0.94

## Conclusions (leakage / selection lens)

**Price look-ahead: none found.** Donchian lookback excludes the signal day; ATR uses bars closed by the decision; entry = signal close ≈ next open (L5 identical to L0: crypto daily bars have no gap); exits start at entryIdx+1 with downside checked before upside within a bar; BTC-trend multiplier uses only candles closed at/before the decision (`dailyTrendAt`: time+86400 ≤ now). L0 reproduces the researcher's T0 to the digit (T=403, +0.183, CI [+0.049, +0.317]).

**The verdict is nevertheless not clean — four defects, each sufficient on its own:**
1. **Arbitrary tie-break at the 96th percentile of its own null.** All 1d candidates share a timestamp and maxOpen blocked 1035/2481; the A→Z sort decides which breakouts are taken. A→Z is NOT the engine's order — `SCANNER_COINS` (routes.ts) scans in registry preferredSymbols order (UNI, ICP, AAVE, …). Under the engine's order: T=407 exp +0.074 PF 1.12 iid CI [−0.060, +0.207], top-5 41%, coins+ 18/40 → literal REJECT (fails PAPER on exp, PF and CI). Over 200 random orders: median +0.128, A→Z at p96, engine order at p5.5; literal PAPER passes in 54/200 (27%).
2. **CI computed i.i.d. over clustered trades.** Same-day breakouts across 40 coins co-move (65% sign agreement per the stats reviewer). Cluster bootstrap on the reported A→Z trade set: week-cluster lo −0.020, month-cluster lo −0.070 → fails the PAPER bar "CI95 lo > −0.05" even for the lucky order.
3. **"Engine gates" label was false when measured.** routes.ts MAX_HOLD_HOURS_BY_INTERVAL had no "1d" key → 240h fallback = 10 daily bars; the sim held up to 200 bars. Under the engine as it stood: exp +0.040 PF 1.09 halves +0.079/−0.003 → REJECT. All of the reported edge lives in holds > 10 bars (T=199, +120.4R, exp +0.605) while ≤ 10-bar trades lose (T=204, −46.6R, exp −0.229). NOTE: the lead has since added `"1d": 200*24` to server/engine-config.ts, so this is moot for the CURRENT tree — but it means the component under review was never testable against the engine that existed, and the promotion rests on a same-day engine change.
4. **Pre-registration on already-seen data.** Phase 6 (2026-08-14) evaluated the identical spec on 1500 daily candles ending 2026-08-13 (overlap 98.7%) and reported exp +0.233, halves and plateau; the phase-9 H1 bar (+0.25) and PAPER bar (+0.15) were therefore set with the outcome essentially known. The only new data is 19 days.

**Time concentration.** Top-5 entry-months = 119% of sumR (193% under engine order): outside five months over 3.9 years the strategy is net negative. By year: 2022 −10.1R, 2023 +40.2R, 2024 +17.3R, 2025 +33.6R, 2026 −7.3R.

**Universe selection (probe, not decisive).** U-A (the 14 coins the LS screen considered and did NOT admit): exp −0.009, 0/50 orders ≥ 0.15, ungated −0.192 PF 0.72. U-B (30 still-listed 2022 large caps never in the LS universe): exp +0.184 (order median +0.209, 47/50 ≥ 0.15) but halves +0.020/+0.321, ungated −0.046, month-cluster lo −0.062. Mixed: the 40-coin result is not obviously a coin-selection artefact (U-B reproduces it), but U-B is itself survivor-selected and its edge is entirely second-half.

**Corrected verdict for the component as specified: REJECT** (engine-order exp +0.074 / order-median +0.128; cluster CI lo −0.070; PAPER pass-rate 27% across arbitrary orders). Any re-test must (a) fix the tie-break to the engine's scan order or report the order-median, (b) use cluster (week/month) bootstrap, (c) run on data not seen by phase 6 (i.e. genuinely forward), (d) state the 1d hold budget as an engine change that was made for it.
