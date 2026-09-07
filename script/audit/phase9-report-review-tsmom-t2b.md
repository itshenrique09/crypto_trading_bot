# Phase 9 — ADVERSARIAL REVIEW (leakage lens) of the T2b portfolio verdict — 2026-09-02
Pipeline = phase9-tsmom.ts verbatim ($1000 @ 1%, honest signal-close entry, engine gates, fees 0.05%+0.05%/side). Review knobs: tie-break order, 1d hold cap, cluster bootstrap, portfolio PAPER bar.
engine scan order (first 12): UNI ICP AAVE PEPE INJ BCH FIL LTC ATOM AVAX XRP DOGE …

pools: tsmom=2481 core=1182 core+tsmom=3663 (phase9-tsmom.ts: 2481 / 1182 / 3663)

## V0 reproduce T2b — A→Z tie-break, 200d hold cap (must be T=499 exp +0.192)
  T= 499 PF= 1.33 sumR=  +96.1 exp=+0.192 iidCI=[+0.061, +0.327] wkClusterCI=[-0.002, +0.383](K=137) moClusterCI=[-0.039, +0.403](K=45) maxDD=23.8R halves +0.202/+0.181 top5=23% coins+ 27/40 128tr/yr  balDD=22.4%
  years: 2022: T=31 -10.1R exp=-0.32 | 2023: T=171 +65.3R exp=+0.38 | 2024: T=126 +12.8R exp=+0.10 | 2025: T=95 +25.0R exp=+0.26 | 2026: T=76 +3.0R exp=+0.04
  sleeve tsmom          T=404 sumR=+70.0 exp=+0.173 PF=1.30 halves +0.129/+0.243
  sleeve break-retest   T=54 sumR=+20.8 exp=+0.385 PF=1.63 halves +0.684/-0.122
  sleeve rsi-divergence T=41 sumR=+5.3 exp=+0.128 PF=1.18 halves -0.063/+0.398
  blocks: maxOpen=1389 exposure=1271 cooldown=187 groupCap=173 ddRolling7d=79 weeklyTrend=43 killSwitch=22

## V0a reproduce T2a — B&R+RSI alone (must be T=266 exp +0.149)
  T= 266 PF= 1.21 sumR=  +39.7 exp=+0.149 iidCI=[-0.058, +0.363] wkClusterCI=[-0.073, +0.384](K=129) moClusterCI=[-0.078, +0.401](K=44) maxDD=18.5R halves +0.259/+0.090 top5=61% coins+ 6/8 75tr/yr  balDD=24.3%
  years: 2023: T=33 +20.7R exp=+0.63 | 2024: T=65 +1.4R exp=+0.02 | 2025: T=97 +2.2R exp=+0.02 | 2026: T=71 +15.3R exp=+0.22
  blocks: exposure=550 cooldown=260 weeklyTrend=95 ddRolling7d=7 killSwitch=4

## V0b reproduce T0 — TSMOM alone (must be T=403 exp +0.183)
  T= 403 PF= 1.32 sumR=  +73.8 exp=+0.183 iidCI=[+0.049, +0.317] wkClusterCI=[-0.020, +0.382](K=118) moClusterCI=[-0.070, +0.414](K=44) maxDD=30.0R halves +0.146/+0.244 top5=18% coins+ 24/40 104tr/yr  balDD=29.0%
  years: 2022: T=31 -10.1R exp=-0.32 | 2023: T=149 +40.2R exp=+0.27 | 2024: T=111 +17.3R exp=+0.16 | 2025: T=66 +33.6R exp=+0.51 | 2026: T=46 -7.3R exp=-0.16
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=64 killSwitch=47 ddDaily=2

## V1 T2b — ENGINE scan order tie-break, 200d cap
  T= 507 PF= 1.25 sumR=  +75.9 exp=+0.150 iidCI=[+0.022, +0.279] wkClusterCI=[-0.027, +0.333](K=148) moClusterCI=[-0.062, +0.340](K=44) maxDD=25.2R halves +0.167/+0.130 top5=31% coins+ 20/40 130tr/yr  balDD=25.9%
  years: 2022: T=28 -5.0R exp=-0.18 | 2023: T=164 +40.8R exp=+0.25 | 2024: T=125 +9.9R exp=+0.08 | 2025: T=114 +24.0R exp=+0.21 | 2026: T=76 +6.0R exp=+0.08
  sleeve tsmom          T=403 sumR=+31.3 exp=+0.078 PF=1.13 halves +0.081/+0.073
  sleeve break-retest   T=51 sumR=+27.4 exp=+0.537 PF=1.96 halves +0.737/+0.170
  sleeve rsi-divergence T=53 sumR=+17.2 exp=+0.324 PF=1.48 halves -0.033/+0.668
  blocks: maxOpen=1382 exposure=1234 cooldown=200 groupCap=135 ddRolling7d=87 weeklyTrend=51 killSwitch=50 ddDaily=17

## V2 T2b — Z→A tie-break, 200d cap
  T= 515 PF= 1.24 sumR=  +75.8 exp=+0.147 iidCI=[+0.019, +0.277] wkClusterCI=[-0.032, +0.319](K=150) moClusterCI=[-0.057, +0.335](K=44) maxDD=23.1R halves +0.185/+0.110 top5=31% coins+ 20/40 133tr/yr  balDD=22.0%
  years: 2022: T=27 -6.0R exp=-0.22 | 2023: T=155 +50.0R exp=+0.32 | 2024: T=130 +2.3R exp=+0.02 | 2025: T=114 +15.2R exp=+0.13 | 2026: T=89 +14.3R exp=+0.16
  sleeve tsmom          T=402 sumR=+28.6 exp=+0.071 PF=1.12 halves +0.097/+0.038
  sleeve break-retest   T=53 sumR=+25.9 exp=+0.489 PF=1.85 halves +0.738/+0.079
  sleeve rsi-divergence T=60 sumR=+21.3 exp=+0.355 PF=1.55 halves -0.078/+0.643
  blocks: maxOpen=1421 exposure=1185 cooldown=205 groupCap=179 ddRolling7d=62 weeklyTrend=46 killSwitch=44 ddDaily=6

## V3 T2b — A→Z, ENGINE max-hold parity (1d → 240h fallback = 10 bars)
  T= 940 PF= 1.13 sumR=  +58.4 exp=+0.062 iidCI=[-0.017, +0.143] wkClusterCI=[-0.063, +0.187](K=183) moClusterCI=[-0.065, +0.186](K=48) maxDD=37.1R halves +0.107/+0.020 top5=41% coins+ 22/40 242tr/yr  balDD=35.5%
  years: 2022: T=56 -15.9R exp=-0.28 | 2023: T=239 +59.2R exp=+0.25 | 2024: T=232 +11.8R exp=+0.05 | 2025: T=238 +8.8R exp=+0.04 | 2026: T=175 -5.5R exp=-0.03
  sleeve tsmom          T=748 sumR=+21.8 exp=+0.029 PF=1.07 halves +0.085/-0.033
  sleeve break-retest   T=76 sumR=+25.9 exp=+0.341 PF=1.54 halves +0.358/+0.315
  sleeve rsi-divergence T=116 sumR=+10.7 exp=+0.092 PF=1.13 halves -0.012/+0.204
  blocks: exposure=1233 maxOpen=726 cooldown=258 ddRolling7d=165 groupCap=137 killSwitch=127 weeklyTrend=70 ddDaily=7

## V4 T2b — ENGINE order + ENGINE max-hold 10 bars
  T= 937 PF= 1.11 sumR=  +52.0 exp=+0.056 iidCI=[-0.021, +0.137] wkClusterCI=[-0.067, +0.177](K=185) moClusterCI=[-0.069, +0.175](K=48) maxDD=31.4R halves +0.106/+0.008 top5=46% coins+ 22/40 241tr/yr  balDD=33.5%
  years: 2022: T=56 -15.0R exp=-0.27 | 2023: T=234 +59.7R exp=+0.26 | 2024: T=236 +7.2R exp=+0.03 | 2025: T=236 +4.9R exp=+0.02 | 2026: T=175 -4.8R exp=-0.03
  sleeve tsmom          T=744 sumR=+17.6 exp=+0.024 PF=1.05 halves +0.079/-0.037
  sleeve break-retest   T=76 sumR=+25.9 exp=+0.341 PF=1.54 halves +0.358/+0.315
  sleeve rsi-divergence T=117 sumR=+8.6 exp=+0.073 PF=1.10 halves -0.030/+0.182
  blocks: exposure=1267 maxOpen=687 cooldown=259 ddRolling7d=150 killSwitch=148 groupCap=135 weeklyTrend=70 ddDaily=10

## V5 T2b — ENGINE order, 200d cap, +15 bps + funding (T2c under engine order)
  T= 498 PF= 1.08 sumR=  +23.8 exp=+0.048 iidCI=[-0.074, +0.172] wkClusterCI=[-0.126, +0.221](K=146) moClusterCI=[-0.152, +0.226](K=44) maxDD=27.0R halves +0.045/+0.051 top5=82% coins+ 19/40 128tr/yr  balDD=29.0% funding −24.7R
  years: 2022: T=28 -6.7R exp=-0.24 | 2023: T=159 +19.0R exp=+0.12 | 2024: T=123 -1.4R exp=-0.01 | 2025: T=115 +10.9R exp=+0.10 | 2026: T=73 +2.0R exp=+0.03
  sleeve tsmom          T=392 sumR=-1.1 exp=-0.003 PF=1.00 halves -0.018/+0.018
  sleeve break-retest   T=51 sumR=+16.2 exp=+0.318 PF=1.54 halves +0.439/+0.094
  sleeve rsi-divergence T=55 sumR=+8.7 exp=+0.158 PF=1.23 halves -0.174/+0.502
  blocks: maxOpen=1375 exposure=1225 cooldown=192 groupCap=137 ddRolling7d=88 killSwitch=73 weeklyTrend=57 ddDaily=18

## V5a T2b — A→Z, 200d cap, +15 bps + funding (reproduce T2c: T=491 exp +0.125)
  T= 491 PF= 1.21 sumR=  +61.4 exp=+0.125 iidCI=[-0.002, +0.255] wkClusterCI=[-0.058, +0.304](K=136) moClusterCI=[-0.100, +0.327](K=45) maxDD=21.9R halves +0.140/+0.106 top5=31% coins+ 22/40 126tr/yr  balDD=22.5% funding −25.2R
  years: 2022: T=31 -11.8R exp=-0.38 | 2023: T=168 +52.1R exp=+0.31 | 2024: T=123 +7.8R exp=+0.06 | 2025: T=93 +15.8R exp=+0.17 | 2026: T=76 -2.5R exp=-0.03
  sleeve tsmom          T=398 sumR=+48.4 exp=+0.122 PF=1.21 halves +0.082/+0.185
  sleeve break-retest   T=53 sumR=+14.6 exp=+0.276 PF=1.45 halves +0.509/-0.142
  sleeve rsi-divergence T=40 sumR=-1.6 exp=-0.041 PF=0.95 halves -0.239/+0.227
  blocks: maxOpen=1355 exposure=1258 groupCap=189 cooldown=184 ddRolling7d=103 weeklyTrend=48 killSwitch=31 ddDaily=4

## V6 T2b — A→Z, 200d cap, funding only (no venue slip) — the realistic perp headline
  T= 496 PF= 1.23 sumR=  +69.8 exp=+0.141 iidCI=[+0.010, +0.275] wkClusterCI=[-0.048, +0.322](K=136) moClusterCI=[-0.087, +0.349](K=45) maxDD=24.9R halves +0.151/+0.127 top5=31% coins+ 25/40 128tr/yr  balDD=24.9% funding −25.9R
  years: 2022: T=31 -11.5R exp=-0.37 | 2023: T=171 +56.7R exp=+0.33 | 2024: T=123 +7.5R exp=+0.06 | 2025: T=95 +18.1R exp=+0.19 | 2026: T=76 -1.0R exp=-0.01
  sleeve tsmom          T=404 sumR=+47.0 exp=+0.116 PF=1.20 halves +0.079/+0.175
  sleeve break-retest   T=53 sumR=+19.4 exp=+0.367 PF=1.59 halves +0.630/-0.103
  sleeve rsi-divergence T=39 sumR=+3.3 exp=+0.084 PF=1.11 halves -0.148/+0.384
  blocks: maxOpen=1389 exposure=1258 cooldown=183 groupCap=173 ddRolling7d=96 weeklyTrend=43 killSwitch=21 ddDaily=4

## V7 T0 TSMOM alone — ENGINE max-hold 10 bars, A→Z
  T= 752 PF= 1.09 sumR=  +30.4 exp=+0.040 iidCI=[-0.037, +0.116] wkClusterCI=[-0.085, +0.164](K=164) moClusterCI=[-0.089, +0.162](K=48) maxDD=30.3R halves +0.079/-0.003 top5=42% coins+ 21/40 194tr/yr  balDD=28.6%
  years: 2022: T=56 -15.9R exp=-0.28 | 2023: T=215 +41.8R exp=+0.19 | 2024: T=190 +11.6R exp=+0.06 | 2025: T=165 +2.8R exp=+0.02 | 2026: T=126 -9.8R exp=-0.08
  blocks: exposure=686 maxOpen=595 killSwitch=143 cooldown=142 groupCap=85 ddRolling7d=77 ddDaily=1

## V8 T0 TSMOM alone — ENGINE order, 200d cap
  T= 407 PF= 1.12 sumR=  +30.2 exp=+0.074 iidCI=[-0.060, +0.207] wkClusterCI=[-0.110, +0.254](K=129) moClusterCI=[-0.146, +0.282](K=44) maxDD=31.0R halves +0.058/+0.098 top5=41% coins+ 18/40 105tr/yr  balDD=30.6%
  years: 2022: T=28 -5.0R exp=-0.18 | 2023: T=144 +17.4R exp=+0.12 | 2024: T=112 -1.7R exp=-0.01 | 2025: T=71 +22.6R exp=+0.32 | 2026: T=52 -3.1R exp=-0.06
  blocks: maxOpen=1055 exposure=707 cooldown=112 groupCap=77 ddRolling7d=65 killSwitch=42 ddDaily=16

## Tie-break seeds (20 random same-timestamp orders)
  T2b 200d cap: exp min/med/max +0.128/+0.176/+0.201 · PF med 1.30 · maxDD min/med/max 22.2/25.5/30.2R · component-PAPER pass 16/20 · exp≥0.20 in 1/20 · iid CI lo>0 in 20/20 · wk-cluster CI lo>0 in 7/20 · both halves ≥0.10 in 20/20
  T2b engine 10-bar cap: exp min/med/max +0.035/+0.061/+0.076 · PF med 1.13 · maxDD min/med/max 32.5/36.0/39.5R · component-PAPER pass 0/20 · exp≥0.20 in 0/20 · iid CI lo>0 in 0/20 · wk-cluster CI lo>0 in 0/20 · both halves ≥0.10 in 0/20
  T2b 200d cap + funding only: exp min/med/max +0.063/+0.120/+0.147 · PF med 1.20 · maxDD min/med/max 22.0/28.3/32.6R · component-PAPER pass 0/20 · exp≥0.20 in 0/20 · iid CI lo>0 in 8/20 · wk-cluster CI lo>0 in 0/20 · both halves ≥0.10 in 8/20

## Verdict re-application
  V0 T2b as reported (A→Z, 200d): component-PAPER pass · portfolio-PAPER (AUDIT-NOTES) FAIL (exp +0.192 < +0.20)
  V1 T2b engine order: component-PAPER FAIL (exp +0.150 < +0.15) · portfolio-PAPER (AUDIT-NOTES) FAIL (exp +0.150 < +0.20; PF 1.25 < 1.30; maxDD 25.2R > 25R; +15 bps exp +0.048 < +0.10)
  V3 T2b engine 10-bar hold: component-PAPER FAIL (exp +0.062 < +0.15; PF 1.13 < 1.15) · portfolio-PAPER (AUDIT-NOTES) FAIL (exp +0.062 < +0.20; PF 1.13 < 1.30; CI lo -0.017 ≤ 0; halves +0.107/+0.020 not both ≥ +0.10; maxDD 37.1R > 25R; +15 bps exp — < +0.10)
  V4 T2b engine order + engine hold: component-PAPER FAIL (exp +0.056 < +0.15; PF 1.11 < 1.15) · portfolio-PAPER (AUDIT-NOTES) FAIL (exp +0.056 < +0.20; PF 1.11 < 1.30; CI lo -0.021 ≤ 0; halves +0.106/+0.008 not both ≥ +0.10; maxDD 31.4R > 25R; +15 bps exp — < +0.10)
  V6 T2b funding only (perp reality, no venue slip): component-PAPER FAIL (exp +0.141 < +0.15) · portfolio-PAPER (AUDIT-NOTES) FAIL (exp +0.141 < +0.20; PF 1.23 < 1.30)

## Selection-bias rule (task brief): B&R ×40 universe exp −0.016 / RSI ×40 −0.125 (phase9-report-brrsi.md) → both core sleeves are REJECT components; T2b core sleeve contributes +26.1R of +96.1R.
