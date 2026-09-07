# Phase 9 — TSMOM daily without the Liquidity Sweep — 2026-09-02
capital $1000 · base risk 1% · exits {"trailMode":"r_multiple","trailRMultiple":2} · honest entry (signal close) · fees 0.05% + slip 0.05%/side inside simulateManagedExit
data: 1d×1500 (40 coins) · 4h×8000 (B&R coins) · 1h×20000 (RSI coins) · BTC 1d×1500 for the trend multiplier

## Pre-registered hypotheses & arms (fixed before the run)
- H1 TSMOM standalone (primary spec N=55, stop 2.0×ATR20, TP 1.75/3.5×, conf 70, cooldown 72h, 40 coins): exp ≥ +0.25R, CI95 lower > 0, both halves positive
- H2 portfolio B&R + RSI + TSMOM (no LS) has HIGHER sumR AND LOWER maxDD(R) than B&R + RSI alone (same gates: maxOpen 10, group cap 3, guards, weekly gate for 4h only)
- H3 TSMOM survives funding drag (−0.03%/day of hold, full position, converted to R via the real stop distance) and +15 bps adverse entry (SL/TP fixed, right-sized)
- T1 plateau N∈{40,70}, stopK∈{1.5,2.5} one-at-a-time — plateau check only; T4 LONG-only / SHORT-only — diagnostic only
- Acceptance applied literally (ACCEPT-LIVE-CANDIDATE / PAPER-CANDIDATE / REJECT), see task brief. TSMOM already runs on the full 40-coin universe → selection-bias rule not applicable to it.

## Data spans
  BTC:1d 2022-07-25→2026-09-01 (1500) · SOL:4h 2023-01-08→2026-09-02 (8000) · ATOM:1h 2024-05-22→2026-09-02 (20000)
  coins with < 1500 daily candles (newer listings): PEPE:1216 APT:1414 SEI:1114 SUI:1218 ARB:1259 TIA:1037 RENDER:768 ONDO:509 ENA:883 WLD:1136 POL:719

## Candidate pools (post minSL 0.6% + R:R 1.5 gates)
  tsmom         2481  tsmom=2481
  tsmom-n40     3060  tsmom=3060
  tsmom-n70     1979  tsmom=1979
  tsmom-k15     2482  tsmom=2482
  tsmom-k25     2479  tsmom=2479
  core          1182  break-retest=372 rsi-divergence=810
  core+tsmom    3663  break-retest=372 rsi-divergence=810 tsmom=2481

## T0 TSMOM standalone — primary N=55 stop 2.0×ATR20 (engine gates)
  ALL   T= 403 WR= 44% PF= 1.32 sumR=  +73.8 exp=+0.183 CI95=[+0.049, +0.317] maxDD=30.0R  balDD=29.0%  candidates=2481
        H1 T=250 exp=+0.146 PF=1.25 | H2 T=153 exp=+0.244 PF=1.44 | top5=18% | coins+ 24/40 (60%) | 104 tr/yr, +19.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 260/143
  2026  T=  46 WR= 37% PF= 0.74 sumR=   -7.3 exp=-0.158 CI95=[-0.472, +0.172] maxDD=13.6R
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=64 killSwitch=47 ddDaily=2

## T1 plateau — N=40
  ALL   T= 420 WR= 42% PF= 1.19 sumR=  +48.0 exp=+0.114 CI95=[-0.018, +0.248] maxDD=40.8R  balDD=34.5%  candidates=3060
        H1 T=252 exp=+0.066 PF=1.11 | H2 T=168 exp=+0.186 PF=1.33 | top5=30% | coins+ 25/40 (63%) | 108 tr/yr, +12.4 R/yr over 3.9y | hold avg 28.0d med 11.0d | L/S 257/163
  2026  T=  50 WR= 36% PF= 0.81 sumR=   -5.9 exp=-0.117 CI95=[-0.434, +0.226] maxDD=11.7R
  blocks: maxOpen=1413 exposure=837 cooldown=135 killSwitch=90 groupCap=82 ddRolling7d=74 ddDaily=9

## T1 plateau — N=70
  ALL   T= 398 WR= 41% PF= 1.16 sumR=  +37.5 exp=+0.094 CI95=[-0.039, +0.230] maxDD=32.3R  balDD=30.9%  candidates=1979
        H1 T=220 exp=-0.012 PF=0.98 | H2 T=178 exp=+0.225 PF=1.40 | top5=35% | coins+ 25/40 (63%) | 104 tr/yr, +9.8 R/yr over 3.8y | hold avg 26.3d med 9.0d | L/S 277/121
  2026  T=  59 WR= 44% PF= 1.17 sumR=   +5.6 exp=+0.096 CI95=[-0.230, +0.423] maxDD=7.1R
  blocks: maxOpen=733 exposure=606 cooldown=97 groupCap=87 killSwitch=50 ddRolling7d=4 ddDaily=4

## T1 plateau — stop 1.5×ATR
  ALL   T= 620 WR= 36% PF= 0.97 sumR=  -13.5 exp=-0.022 CI95=[-0.129, +0.086] maxDD=52.3R  balDD=42.1%  candidates=2482
        H1 T=353 exp=+0.025 PF=1.04 | H2 T=267 exp=-0.084 PF=0.88 | top5=—% | coins+ 20/40 (50%) | 160 tr/yr, -3.5 R/yr over 3.9y | hold avg 14.1d med 6.0d | L/S 387/233
  2026  T=  87 WR= 38% PF= 1.03 sumR=   +1.4 exp=+0.016 CI95=[-0.265, +0.310] maxDD=12.5R
  blocks: exposure=735 maxOpen=689 cooldown=155 groupCap=98 ddRolling7d=86 killSwitch=78 ddDaily=21

## T1 plateau — stop 2.5×ATR
  ALL   T= 305 WR= 45% PF= 1.39 sumR=  +64.8 exp=+0.212 CI95=[+0.057, +0.370] maxDD=15.3R  balDD=17.8%  candidates=2479
        H1 T=179 exp=+0.096 PF=1.16 | H2 T=126 exp=+0.377 PF=1.80 | top5=19% | coins+ 26/40 (65%) | 79 tr/yr, +16.7 R/yr over 3.9y | hold avg 40.1d med 16.0d | L/S 194/111
  2026  T=  35 WR= 37% PF= 0.91 sumR=   -1.7 exp=-0.047 CI95=[-0.417, +0.358] maxDD=5.1R
  blocks: maxOpen=1163 exposure=715 cooldown=103 groupCap=97 ddRolling7d=70 killSwitch=13 ddDaily=13

## T2a portfolio — B&R + RSI alone (registry minus LS)
  ALL   T= 266 WR= 36% PF= 1.21 sumR=  +39.7 exp=+0.149 CI95=[-0.058, +0.363] maxDD=18.5R  balDD=24.3%  candidates=1182
        H1 T=93 exp=+0.259 PF=1.39 | H2 T=173 exp=+0.090 PF=1.13 | top5=61% | coins+ 6/8 (75%) | 75 tr/yr, +11.2 R/yr over 3.5y | hold avg 2.1d med 1.0d | L/S 95/171
  2026  T=  71 WR= 41% PF= 1.34 sumR=  +15.3 exp=+0.216 CI95=[-0.174, +0.616] maxDD=12.5R
  sleeve break-retest   T=  98 WR= 40% PF= 1.58 sumR=  +36.0 exp=+0.368 CI95=[+0.009, +0.730] maxDD=9.1R
        H1 T=55 exp=+0.401 PF=1.63 | H2 T=43 exp=+0.324 PF=1.52 | top5=52% | coins+ 5/6 (83%) | 28 tr/yr, +10.2 R/yr over 3.5y | hold avg 3.6d med 2.8d | L/S 29/69
  sleeve rsi-divergence T= 168 WR= 33% PF= 1.03 sumR=   +3.6 exp=+0.022 CI95=[-0.226, +0.281] maxDD=24.8R
        H1 T=83 exp=-0.051 PF=0.93 | H2 T=85 exp=+0.093 PF=1.13 | top5=589% | coins+ 1/2 (50%) | 75 tr/yr, +1.6 R/yr over 2.2y | hold avg 1.2d med 0.5d | L/S 66/102
  blocks: exposure=550 cooldown=260 weeklyTrend=95 ddRolling7d=7 killSwitch=4

## T2b portfolio — B&R + RSI + TSMOM (no LS)
  ALL   T= 499 WR= 42% PF= 1.33 sumR=  +96.1 exp=+0.192 CI95=[+0.061, +0.327] maxDD=23.8R  balDD=22.4%  candidates=3663
        H1 T=278 exp=+0.202 PF=1.35 | H2 T=221 exp=+0.181 PF=1.30 | top5=23% | coins+ 27/40 (68%) | 128 tr/yr, +24.7 R/yr over 3.9y | hold avg 22.9d med 8.0d | L/S 292/207
  2026  T=  76 WR= 39% PF= 1.07 sumR=   +3.0 exp=+0.039 CI95=[-0.260, +0.360] maxDD=13.0R
  sleeve tsmom          T= 404 WR= 43% PF= 1.30 sumR=  +70.0 exp=+0.173 CI95=[+0.039, +0.310] maxDD=30.5R
        H1 T=247 exp=+0.129 PF=1.22 | H2 T=157 exp=+0.243 PF=1.44 | top5=18% | coins+ 25/40 (63%) | 104 tr/yr, +18.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 258/146
  sleeve break-retest   T=  54 WR= 39% PF= 1.63 sumR=  +20.8 exp=+0.385 CI95=[-0.095, +0.887] maxDD=11.1R
        H1 T=34 exp=+0.684 PF=2.24 | H2 T=20 exp=-0.122 PF=0.83 | top5=86% | coins+ 4/6 (67%) | 15 tr/yr, +6.0 R/yr over 3.5y | hold avg 4.1d med 3.1d | L/S 16/38
  sleeve rsi-divergence T=  41 WR= 34% PF= 1.18 sumR=   +5.3 exp=+0.128 CI95=[-0.429, +0.733] maxDD=11.9R
        H1 T=24 exp=-0.063 PF=0.92 | H2 T=17 exp=+0.398 PF=1.61 | top5=344% | coins+ 2/2 (100%) | 23 tr/yr, +2.9 R/yr over 1.8y | hold avg 1.3d med 0.6d | L/S 18/23
  blocks: maxOpen=1389 exposure=1271 cooldown=187 groupCap=173 ddRolling7d=79 weeklyTrend=43 killSwitch=22

## T2c portfolio — B&R + RSI + TSMOM, +15 bps slip + funding drag on ALL strategies
  ALL   T= 491 WR= 43% PF= 1.21 sumR=  +61.4 exp=+0.125 CI95=[-0.002, +0.255] maxDD=21.9R  balDD=22.5%  candidates=3663
        H1 T=275 exp=+0.140 PF=1.24 | H2 T=216 exp=+0.106 PF=1.17 | top5=31% | coins+ 22/40 (55%) | 126 tr/yr, +15.8 R/yr over 3.9y | hold avg 23.1d med 8.0d | L/S 289/202 | funding −25.2R
  2026  T=  76 WR= 39% PF= 0.95 sumR=   -2.5 exp=-0.033 CI95=[-0.322, +0.275] maxDD=15.6R
  sleeve tsmom          T= 398 WR= 44% PF= 1.21 sumR=  +48.4 exp=+0.122 CI95=[-0.010, +0.256] maxDD=31.8R
        H1 T=244 exp=+0.082 PF=1.14 | H2 T=154 exp=+0.185 PF=1.33 | top5=26% | coins+ 22/40 (55%) | 102 tr/yr, +12.5 R/yr over 3.9y | hold avg 27.8d med 10.0d | L/S 256/142 | funding −22.4R
  sleeve break-retest   T=  53 WR= 40% PF= 1.45 sumR=  +14.6 exp=+0.276 CI95=[-0.169, +0.739] maxDD=11.1R
        H1 T=34 exp=+0.509 PF=1.90 | H2 T=19 exp=-0.142 PF=0.80 | top5=109% | coins+ 4/6 (67%) | 15 tr/yr, +4.2 R/yr over 3.5y | hold avg 4.1d med 3.2d | L/S 15/38 | funding −2.2R
  sleeve rsi-divergence T=  40 WR= 33% PF= 0.95 sumR=   -1.6 exp=-0.041 CI95=[-0.536, +0.510] maxDD=14.2R
        H1 T=23 exp=-0.239 PF=0.71 | H2 T=17 exp=+0.227 PF=1.35 | top5=—% | coins+ 1/2 (50%) | 22 tr/yr, -0.9 R/yr over 1.8y | hold avg 1.3d med 0.5d | L/S 18/22 | funding −0.6R
  blocks: maxOpen=1355 exposure=1258 groupCap=189 cooldown=184 ddRolling7d=103 weeklyTrend=48 killSwitch=31 ddDaily=4

## T2d portfolio — B&R + RSI alone, +15 bps slip + funding drag
  ALL   T= 266 WR= 35% PF= 1.05 sumR=   +9.5 exp=+0.036 CI95=[-0.154, +0.235] maxDD=29.4R  balDD=31.7%  candidates=1182
        H1 T=93 exp=+0.151 PF=1.22 | H2 T=173 exp=-0.026 PF=0.96 | top5=208% | coins+ 4/8 (50%) | 75 tr/yr, +2.7 R/yr over 3.5y | hold avg 2.1d med 1.0d | L/S 95/171 | funding −5.8R
  2026  T=  71 WR= 41% PF= 1.14 sumR=   +6.4 exp=+0.090 CI95=[-0.265, +0.452] maxDD=14.1R
  sleeve break-retest   T=  98 WR= 40% PF= 1.39 sumR=  +24.6 exp=+0.251 CI95=[-0.087, +0.588] maxDD=9.4R
        H1 T=55 exp=+0.275 PF=1.43 | H2 T=43 exp=+0.219 PF=1.34 | top5=66% | coins+ 4/6 (67%) | 28 tr/yr, +7.0 R/yr over 3.5y | hold avg 3.6d med 2.8d | L/S 29/69 | funding −3.6R
  sleeve rsi-divergence T= 168 WR= 33% PF= 0.88 sumR=  -15.1 exp=-0.090 CI95=[-0.314, +0.143] maxDD=33.7R
        H1 T=83 exp=-0.126 PF=0.83 | H2 T=85 exp=-0.054 PF=0.93 | top5=—% | coins+ 0/2 (0%) | 75 tr/yr, -6.7 R/yr over 2.2y | hold avg 1.2d med 0.5d | L/S 66/102 | funding −2.3R
  blocks: exposure=549 cooldown=259 weeklyTrend=95 ddRolling7d=7 killSwitch=4 unfilled=2

## T3 TSMOM standalone + funding −0.03%/day
  ALL   T= 402 WR= 44% PF= 1.22 sumR=  +52.1 exp=+0.130 CI95=[-0.004, +0.265] maxDD=33.9R  balDD=31.8%  candidates=2481
        H1 T=250 exp=+0.097 PF=1.16 | H2 T=152 exp=+0.183 PF=1.32 | top5=25% | coins+ 23/39 (59%) | 103 tr/yr, +13.4 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 260/142 | funding −22.7R
  2026  T=  46 WR= 37% PF= 0.65 sumR=  -10.4 exp=-0.226 CI95=[-0.536, +0.099] maxDD=15.9R
  blocks: maxOpen=1035 exposure=732 cooldown=114 groupCap=81 ddRolling7d=62 killSwitch=49 ddDaily=6

## T3 TSMOM standalone + 15 bps adverse entry
  ALL   T= 402 WR= 44% PF= 1.28 sumR=  +63.7 exp=+0.158 CI95=[+0.024, +0.294] maxDD=30.7R  balDD=29.5%  candidates=2481
        H1 T=250 exp=+0.125 PF=1.22 | H2 T=152 exp=+0.214 PF=1.39 | top5=20% | coins+ 24/40 (60%) | 103 tr/yr, +16.4 R/yr over 3.9y | hold avg 27.8d med 10.0d | L/S 260/142
  2026  T=  46 WR= 37% PF= 0.72 sumR=   -7.8 exp=-0.171 CI95=[-0.481, +0.153] maxDD=14.0R
  blocks: maxOpen=1039 exposure=730 cooldown=115 groupCap=81 ddRolling7d=64 killSwitch=48 ddDaily=2

## T3 TSMOM standalone + 15 bps + funding (H3 arm)
  ALL   T= 404 WR= 44% PF= 1.18 sumR=  +41.9 exp=+0.104 CI95=[-0.029, +0.236] maxDD=31.4R  balDD=29.3%  candidates=2481
        H1 T=247 exp=+0.090 PF=1.15 | H2 T=157 exp=+0.125 PF=1.22 | top5=30% | coins+ 23/39 (59%) | 104 tr/yr, +10.8 R/yr over 3.9y | hold avg 27.4d med 10.0d | L/S 259/145 | funding −22.2R
  2026  T=  52 WR= 35% PF= 0.57 sumR=  -14.5 exp=-0.278 CI95=[-0.557, +0.012] maxDD=19.2R
  blocks: maxOpen=1006 exposure=732 cooldown=117 groupCap=79 killSwitch=76 ddRolling7d=62 ddDaily=5

## T3 TSMOM standalone + 30 bps adverse entry
  ALL   T= 401 WR= 43% PF= 1.23 sumR=  +52.5 exp=+0.131 CI95=[-0.001, +0.268] maxDD=32.7R  balDD=31.9%  candidates=2481
        H1 T=248 exp=+0.105 PF=1.18 | H2 T=153 exp=+0.173 PF=1.31 | top5=24% | coins+ 23/40 (58%) | 103 tr/yr, +13.5 R/yr over 3.9y | hold avg 28.2d med 10.0d | L/S 257/144
  2026  T=  48 WR= 35% PF= 0.69 sumR=   -9.4 exp=-0.195 CI95=[-0.506, +0.125] maxDD=13.6R
  blocks: maxOpen=1038 exposure=729 cooldown=111 groupCap=86 ddRolling7d=64 killSwitch=42 ddDaily=10

## T3 TSMOM standalone + 30 bps + funding
  ALL   T= 398 WR= 43% PF= 1.14 sumR=  +33.5 exp=+0.084 CI95=[-0.045, +0.215] maxDD=33.1R  balDD=31.8%  candidates=2481
        H1 T=245 exp=+0.071 PF=1.12 | H2 T=153 exp=+0.106 PF=1.18 | top5=37% | coins+ 20/40 (50%) | 102 tr/yr, +8.6 R/yr over 3.9y | hold avg 28.4d med 10.0d | L/S 254/144 | funding −22.1R
  2026  T=  48 WR= 35% PF= 0.62 sumR=  -12.1 exp=-0.252 CI95=[-0.560, +0.067] maxDD=15.9R
  blocks: maxOpen=1038 exposure=729 cooldown=111 groupCap=85 ddRolling7d=62 killSwitch=44 ddDaily=14

## T4 diagnostic — TSMOM LONG only
  ALL   T= 360 WR= 42% PF= 1.26 sumR=  +55.9 exp=+0.155 CI95=[+0.011, +0.307] maxDD=29.1R  balDD=32.1%  candidates=1295
        H1 T=201 exp=+0.213 PF=1.37 | H2 T=159 exp=+0.083 PF=1.14 | top5=22% | coins+ 24/40 (60%) | 93 tr/yr, +14.4 R/yr over 3.9y | hold avg 11.1d med 7.0d | L/S 360/0
  2026  T=  52 WR= 31% PF= 0.76 sumR=   -8.4 exp=-0.161 CI95=[-0.485, +0.199] maxDD=21.3R
  blocks: exposure=451 maxOpen=348 cooldown=87 groupCap=35 killSwitch=11 ddRolling7d=3

## T4 diagnostic — TSMOM SHORT only
  ALL   T= 149 WR= 49% PF= 1.49 sumR=  +37.8 exp=+0.254 CI95=[+0.037, +0.472] maxDD=20.9R  balDD=14.7%  candidates=1186
        H1 T=81 exp=+0.011 PF=1.02 | H2 T=68 exp=+0.543 PF=2.25 | top5=34% | coins+ 22/38 (58%) | 38 tr/yr, +9.7 R/yr over 3.9y | hold avg 56.7d med 27.0d | L/S 0/149
  2026  T=  23 WR= 65% PF= 2.48 sumR=  +12.0 exp=+0.521 CI95=[+0.021, +1.011] maxDD=3.0R
  blocks: maxOpen=623 exposure=380 groupCap=31 cooldown=3

## DIAG TSMOM standalone — portfolio guards OFF (daily/rolling/kill-switch)
  ALL   T= 429 WR= 45% PF= 1.35 sumR=  +85.1 exp=+0.198 CI95=[+0.062, +0.331] maxDD=29.6R  balDD=27.1%  candidates=2481
        H1 T=255 exp=+0.149 PF=1.26 | H2 T=174 exp=+0.270 PF=1.50 | top5=15% | coins+ 25/40 (63%) | 110 tr/yr, +21.9 R/yr over 3.9y | hold avg 26.5d med 9.0d | L/S 280/149
  2026  T=  56 WR= 43% PF= 1.02 sumR=   +0.7 exp=+0.013 CI95=[-0.302, +0.345] maxDD=8.3R
  blocks: maxOpen=1078 exposure=762 cooldown=124 groupCap=88

## DIAG TSMOM standalone — margin gate 10× ($1000 @ 1%)
  ALL   T= 403 WR= 44% PF= 1.32 sumR=  +73.8 exp=+0.183 CI95=[+0.049, +0.317] maxDD=30.0R  balDD=29.0%  candidates=2481
        H1 T=250 exp=+0.146 PF=1.25 | H2 T=153 exp=+0.244 PF=1.44 | top5=18% | coins+ 24/40 (60%) | 104 tr/yr, +19.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 260/143
  2026  T=  46 WR= 37% PF= 0.74 sumR=   -7.3 exp=-0.158 CI95=[-0.472, +0.172] maxDD=13.6R
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=64 killSwitch=47 ddDaily=2

## DIAG TSMOM standalone — live params $110 @ 0.5% margin 7×
  ALL   T= 403 WR= 44% PF= 1.32 sumR=  +73.8 exp=+0.183 CI95=[+0.049, +0.317] maxDD=30.0R  balDD=15.6%  candidates=2481
        H1 T=250 exp=+0.146 PF=1.25 | H2 T=153 exp=+0.244 PF=1.44 | top5=18% | coins+ 24/40 (60%) | 104 tr/yr, +19.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 260/143
  2026  T=  46 WR= 37% PF= 0.74 sumR=   -7.3 exp=-0.158 CI95=[-0.472, +0.172] maxDD=13.6R
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=57 killSwitch=54 ddDaily=2

## DIAGNOSTIC — TSMOM primary, UNGATED signal level (every candidate taken, no portfolio gates; overlapping same-symbol signals included)
  ALL   T=2481 WR= 37% PF= 0.94 sumR=  -99.5 exp=-0.040 CI95=[-0.091, +0.012] maxDD=128.0R
        H1 T=1171 exp=+0.014 PF=1.02 | H2 T=1310 exp=-0.089 PF=0.87 | top5=—% | coins+ 16/40 (40%) | 639 tr/yr, -25.6 R/yr over 3.9y | hold avg 28.0d med 11.0d | L/S 1295/1186

## T0 deep dive
  by year: 2022: T=31 -10.1R exp=-0.32 PF=0.55 | 2023: T=149 +40.2R exp=+0.27 PF=1.50 | 2024: T=111 +17.3R exp=+0.16 PF=1.27 | 2025: T=66 +33.6R exp=+0.51 PF=2.06 | 2026: T=46 -7.3R exp=-0.16 PF=0.74
  exits: loss=223 (avg -1.02R)  breakeven=22 (avg +1.03R)  trailing=83 (avg +1.42R)  tp2=51 (avg +2.43R)  tp1=16 (avg +1.96R)  timeout=8 (avg +0.59R)
  LONG  · BTC daily up      T=239 WR=43% PF=1.33 exp=+0.191 sumR=+45.6
  LONG  · BTC daily neutral T=  6 WR=50% PF=1.47 exp=+0.240 sumR=+1.4
  LONG  · BTC daily down    T= 15 WR=27% PF=0.57 exp=-0.323 sumR=-4.8
  SHORT · BTC daily up      T= 32 WR=56% PF=1.98 exp=+0.436 sumR=+14.0
  SHORT · BTC daily neutral T=  9 WR=67% PF=2.56 exp=+0.524 sumR=+4.7
  SHORT · BTC daily down    T=102 WR=43% PF=1.22 exp=+0.126 sumR=+12.9
  coins: FET +14.2/13  GRT +13.0/11  ADA +9.5/12  NEAR +8.8/6  IMX +7.2/10  ETH +6.4/12  RUNE +5.7/14  ETC +5.5/10  INJ +5.0/10  AVAX +4.6/10  BTC +4.5/14  VET +4.5/6  ICP +4.0/8  BNB +3.7/18  ATOM +3.2/14  TIA +2.1/1  UNI +2.1/10  CRV +1.7/13  ENA +1.6/5  ONDO +1.4/1  PEPE +0.9/7  SEI +0.8/7  AAVE +0.5/15  FIL +0.4/13  RENDER -0.3/3  ARB -0.5/12  SOL -0.6/11  HBAR -0.9/13  WLD -1.0/9  POL -1.0/1  XRP -1.3/8  SAND -1.4/9  GALA -1.5/15  APT -1.7/14  SUI -2.0/6  LINK -2.2/13  LTC -4.1/12  DOGE -4.7/12  DOT -5.0/9  BCH -9.4/16
  top-5 trades: FET SHORT 2025-09-26 +2.97R/16d  ICP SHORT 2025-09-23 +2.76R/19d  ETC SHORT 2025-09-23 +2.53R/19d  WLD LONG 2023-11-26 +2.44R/22d  SEI LONG 2023-12-20 +2.44R/11d
  hold days: avg 27.7 median 10.0 p90 71 · timeouts 8
  concurrency: mean open positions per day (approx) = 7.87

## H2 — portfolio B&R+RSI vs B&R+RSI+TSMOM
  ALL              sumR +39.7 → +96.1 (Δ +56.4)   maxDD 18.5R → 23.8R (Δ +5.3)   T 266 → 499   exp +0.149 → +0.192   balDD 24.3% → 22.4%   final $1331 → $2476
  since RSI data   sumR +15.4 → +37.8 (Δ +22.5)   maxDD 18.5R → 20.0R   T 225 → 230
  core sleeve (B&R+RSI) inside the combined book: T 266 → 95, sumR +39.7 → +26.1 (slot interaction)
  TSMOM sleeve inside combined book: T=404 sumR +70.0 exp +0.173  vs standalone T=403 sumR +73.8
  daily P&L corr TSMOM↔core inside combined book: r=-0.022 (n=319 days)
  daily P&L corr T0 standalone ↔ T2a standalone: r=0.001 (n=439); from 2023-02-21: r=0.002 (n=413)
  H2 verdict: NOT SUPPORTED (needs higher sumR AND lower maxDD(R))

## H1 — TSMOM standalone: exp +0.183 CI95 [+0.049, +0.317] halves +0.146 / +0.244 → NOT SUPPORTED
## H3 — funding only: exp +0.130 (funding total −22.7R, -0.056R/trade) · +15 bps: +0.158 · +15 bps + funding: +0.104 CI95 [-0.029, +0.236] · +30 bps: +0.131 · +30 bps + funding: +0.084 → NOT SUPPORTED

## Verdicts (pre-registered criteria applied literally)
  TSMOM standalone T0 (honest, no venue slip; slip criterion from T3 +15 bps): **PAPER-CANDIDATE**
    ACCEPT failed: ✗ exp +0.183 ≥ +0.25
    PAPER criteria all met
  TSMOM standalone under +15 bps + funding (H3 arm, as a component): **REJECT**
    ACCEPT failed: ✗ exp +0.104 ≥ +0.25; ✗ PF 1.18 ≥ 1.30; ✗ CI95 lo -0.029 > 0; ✗ halves +0.090 / +0.125 same sign, each ≥ +0.10; ✗ top-5 share 30% ≤ 30%
    PAPER failed: ✗ exp +0.104 ≥ +0.15
  Portfolio B&R + RSI alone (T2a; selection-bias rule for B&R/RSI coin lists NOT tested here): **REJECT**
    ACCEPT failed: ✗ exp +0.149 ≥ +0.25; ✗ PF 1.21 ≥ 1.30; ✗ CI95 lo -0.058 > 0; ✗ halves +0.259 / +0.090 same sign, each ≥ +0.10; ✗ top-5 share 61% ≤ 30%; ✗ exp @ +15 bps +0.036 ≥ +0.10
    PAPER failed: ✗ exp +0.149 ≥ +0.15; ✗ CI95 lo -0.058 > −0.05
  Portfolio B&R + RSI + TSMOM (T2b; same caveat): **PAPER-CANDIDATE**
    ACCEPT failed: ✗ exp +0.192 ≥ +0.25
    PAPER criteria all met

## Plateau (T1, one-at-a-time; no promotion)
  T0 TSMOM standalone — primary N=55 stop 2.0×ATR20 (engine gates) T=403 exp=+0.183 PF=1.32 CI95=[+0.049, +0.317] H1/H2 +0.15/+0.24 maxDD=30.0R
  T1 plateau — N=40                        T=420 exp=+0.114 PF=1.19 CI95=[-0.018, +0.248] H1/H2 +0.07/+0.19 maxDD=40.8R
  T1 plateau — N=70                        T=398 exp=+0.094 PF=1.16 CI95=[-0.039, +0.230] H1/H2 -0.01/+0.23 maxDD=32.3R
  T1 plateau — stop 1.5×ATR                T=620 exp=-0.022 PF=0.97 CI95=[-0.129, +0.086] H1/H2 +0.03/-0.08 maxDD=52.3R
  T1 plateau — stop 2.5×ATR                T=305 exp=+0.212 PF=1.39 CI95=[+0.057, +0.370] H1/H2 +0.10/+0.38 maxDD=15.3R

## POST-HOC — tie-break sensitivity: all 1d candidates of a day share one timestamp; maxOpen blocked 1035 T0 candidates, so WHICH breakouts get the slots depends on an arbitrary order (symbol A→Z by default). 20 random orders:
  T0 standalone (20 seeds): exp min/med/max +0.057/+0.130/+0.168 · sumR +24.6/+54.2/+68.1 · maxDD 25.9/31.0/34.2R · CI lo>0 in 9/20 · both halves>0 in 20/20 · exp≥0.15 in 5/20 · min H1 +0.015 min H2 +0.045
  T3 +15 bps + funding (20 seeds): exp min/med/max +0.014/+0.058/+0.116 · sumR +5.8/+24.1/+48.0 · maxDD 27.5/32.7/37.3R · CI lo>0 in 0/20 · both halves>0 in 12/20 · exp≥0.15 in 0/20 · min H1 -0.038 min H2 -0.003
  T2b B&R+RSI+TSMOM (20 seeds): exp min/med/max +0.112/+0.161/+0.214 · sumR +58.7/+82.3/+109.4 · maxDD 22.7/25.6/31.2R · CI lo>0 in 19/20 · both halves>0 in 20/20 · exp≥0.15 in 11/20 · min H1 +0.072 min H2 +0.105
  T1 stop 2.5×ATR (20 seeds): exp min/med/max +0.074/+0.187/+0.274 · sumR +23.5/+57.1/+81.2 · maxDD 17.1/20.5/25.6R · CI lo>0 in 14/20 · both halves>0 in 20/20 · exp≥0.15 in 14/20 · min H1 +0.020 min H2 +0.127

## POST-HOC — slot interaction: TSMOM sleeve cap inside the B&R+RSI book (design question for the lead, not a promotion)
  cap 3: book T= 396 WR= 37% PF= 1.20 sumR=  +50.9 exp=+0.129 CI95=[-0.032, +0.292] maxDD=19.2R | tsmom T=155 sumR +21.7 exp +0.140 | core T=241 sumR +29.3 exp +0.121 | vs T2a core alone T=266 sumR +39.7 maxDD 18.5R
  cap 5: book T= 429 WR= 40% PF= 1.27 sumR=  +73.0 exp=+0.170 CI95=[+0.025, +0.325] maxDD=18.7R | tsmom T=241 sumR +33.8 exp +0.140 | core T=188 sumR +39.1 exp +0.208 | vs T2a core alone T=266 sumR +39.7 maxDD 18.5R
  cap 7: book T= 451 WR= 39% PF= 1.18 sumR=  +49.7 exp=+0.110 CI95=[-0.029, +0.250] maxDD=31.8R | tsmom T=308 sumR +22.7 exp +0.074 | core T=143 sumR +26.9 exp +0.188 | vs T2a core alone T=266 sumR +39.7 maxDD 18.5R

## Conclusions (written after the run; verdicts above are the literal pre-registered ones)

**H1 — NOT SUPPORTED.** TSMOM standalone (primary spec, engine gates, honest close entry, real fees): T=403 over 3.9y, exp +0.183R, PF 1.32, CI95 [+0.049, +0.317], halves +0.146 / +0.244, top-5 18%, 24/40 coins positive, 104 trades/yr, +19R/yr, avg hold 27.7d (median 10d). Misses the +0.25R bar; every other ACCEPT criterion is met, so the literal verdict is **PAPER-CANDIDATE** — but see the tie-break caveat below.

**H2 — NOT SUPPORTED.** B&R+RSI alone: T=266, +39.7R, exp +0.149, maxDD 18.5R. With TSMOM: T=499, +96.1R, exp +0.192, maxDD 23.8R. sumR rises (+56R) but maxDD(R) rises too (+5.3R), so the joint criterion fails. Mechanism is the same slot starvation that killed the Jul-2026 test, now against B&R/RSI: inside the combined book the core sleeve shrinks from 266 to 95 trades (B&R 98→54, RSI 168→41) because TSMOM's multi-week holds sit on ~8 of the 10 slots on average (maxOpen blocks 1389). Daily P&L correlation TSMOM↔core is ≈0 (r = −0.02 in-book, +0.00 standalone) — the diversification thesis holds; the slot architecture is what fails. POST-HOC: a TSMOM sleeve cap of 5 keeps the core intact (core +39.1R vs +39.7R alone) and gives book +73.0R / maxDD 18.7R (≈ alone) — the only configuration that does not raise drawdown, but it is a design change (per-strategy slot cap does not exist in the engine) and was not pre-registered.

**H3 — NOT SUPPORTED.** Funding −0.03%/day costs −22.7R (−0.056R/trade) because the average hold is 28 days; +15 bps costs another ~−0.025R. Under +15 bps + funding: exp +0.104, PF 1.18, CI95 [−0.029, +0.236], halves +0.090 / +0.125 → **REJECT** as a component. +30 bps + funding: +0.084.

**T1 plateau — no plateau.** N=40 +0.114 (CI crosses 0), N=70 +0.094 (H1 negative), stop 1.5× −0.022, stop 2.5× +0.212 (CI [+0.057, +0.370], maxDD 15R, best neighbour). Same shape as phase 6: the primary sits on a ridge along the stop dimension (wider stop better, tighter stop kills it), not on a plateau.

**T4 (diagnostic).** LONG-only T=360 exp +0.155 (H1 +0.213 / H2 +0.083); SHORT-only T=149 exp +0.254 PF 1.49 (H1 +0.011 / H2 +0.543 — all of it in the second half; 2025-09 shorts are 3 of the top-5 trades). LONG in BTC-daily-down T=15 exp −0.32; SHORT in BTC-up T=32 exp +0.44. 2026 YTD: T=46, −7.3R, exp −0.158 (TSMOM has been losing this year — 40-coin ranging market).

**Robustness caveats (POST-HOC, decisive for how much weight the verdict deserves)**
1. Tie-break sensitivity: all daily candidates share one timestamp and maxOpen blocked 1035 of 2481 T0 candidates, so the symbol-A→Z order decides which breakouts are taken. Over 20 random orders T0 exp ranges +0.057…+0.168, median +0.130 (the default order, +0.183, is ABOVE the whole random range); CI lo > 0 in 9/20; exp ≥ 0.15 (PAPER bar) in 5/20. The PAPER-CANDIDATE verdict is therefore an artefact of a lucky ordering as much as of the signal; the honest central estimate is ≈ +0.13R, PF ≈ 1.2. Under +15 bps + funding the seed median is +0.058 (0/20 with CI > 0). T2b is more stable (median +0.161, CI lo > 0 in 19/20) because B&R/RSI fill part of the book. Stop 2.5× median +0.187, 14/20 ≥ 0.15.
2. The ungated signal set (every candidate, overlapping re-entries included) is exp −0.040, PF 0.94 over 2481 trades: the raw breakout signal has no edge; all of the positive result comes from the one-position-per-symbol + cooldown + maxOpen selection (first breakout of a run, at most 10 concurrently). That selection is legitimate engine behaviour but it means the result is a portfolio-construction effect on a zero-edge signal, and is exactly the part that the tie-break sensitivity shows to be fragile.
3. Data: Binance spot 1d candles (2022-07→2026-09); 11 of 40 coins have shorter histories (ONDO 509d, POL 719d, RENDER 768d). The 1d BTC-trend risk multiplier (×1.25/×0.75) is inside the sim; guards measured in base R. Weekly-trend gate not applied to 1d (as in phase 6). Max hold 200 days — 8 timeouts.
4. B&R+RSI baseline numbers here (B&R T=98 exp +0.368 over 4h×8000; RSI T=168 exp +0.022 over 1h×20000) differ from the 8000×1h harness figures (B&R +0.45 / RSI +0.48) because the windows are longer; RSI is flat over 2.2y. Their hand-picked coin lists were not re-tested on the 40-coin universe here (out of this component's scope), so the T2a/T2b verdicts carry the selection-bias caveat.

**Bottom line for the lead.** Removing LS removes the original objection (LS starvation) but exposes the same architectural problem against B&R/RSI, and the standalone edge is thinner than the pre-registered bar and order-fragile. Literal verdicts: TSMOM T0 PAPER-CANDIDATE (fragile; seed-median fails), TSMOM under realistic costs REJECT, portfolio with TSMOM PAPER-CANDIDATE but H2 fails on drawdown. Nothing here justifies live. If TSMOM is to be paper-tested at all it needs (a) a per-sleeve slot cap (≈5) so B&R/RSI are not starved, (b) a wider stop (2.5×ATR) re-derived and pre-registered as the primary spec, and (c) a paper window long enough for a ~100-trade/yr, 28-day-hold strategy — i.e. a year, not 90 days.
