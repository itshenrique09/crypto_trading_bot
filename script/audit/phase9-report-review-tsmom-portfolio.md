# Phase 9 — ADVERSARIAL REVIEW (statistics) of the T2b verdict in phase9-report-tsmom.md — 2026-09-02
pipeline copied from phase9-tsmom.ts · data pinned to snapshot 20260902 · capital $1000 @ 1% · exits {"trailMode":"r_multiple","trailRMultiple":2} · honest entry · fees 0.05% + slip 0.05%/side

## Data
  all series read from the 20260902 snapshot cache
  BTC:1d 2022-07-25→2026-09-01 (1500) · SOL:4h 2023-01-08→2026-09-02 (8000) · ATOM:1h 2024-05-22→2026-09-02 (20000)

## Candidate pools (post minSL 0.6% + R:R 1.5 gates)
  core             1182  break-retest=372 rsi-divergence=810
  core+tsmom       3663  break-retest=372 rsi-divergence=810 tsmom=2481
  br40             1803  break-retest=1803
  rsi40           13784  rsi-divergence=13784
  core40          15587  break-retest=1803 rsi-divergence=13784
  core40+tsmom    18068  break-retest=1803 rsi-divergence=13784 tsmom=2481

## R0 reproduce T2a — B&R + RSI (preferred lists), A→Z
  ALL   T= 266 WR= 36% PF= 1.21 sumR=  +39.7 exp=+0.149 CI95=[-0.058, +0.363] maxDD=18.5R  balDD=24.3%  candidates=1182
        H1 T=93 exp=+0.259 PF=1.39 | H2 T=173 exp=+0.090 PF=1.13 | top5=61% | coins+ 6/8 (75%) | 75 tr/yr, +11.2 R/yr over 3.5y | hold avg 2.1d med 1.0d | L/S 95/171
  2026  T=  71 WR= 41% PF= 1.34 sumR=  +15.3 exp=+0.216 CI95=[-0.174, +0.616] maxDD=12.5R
  sleeve break-retest   T=  98 WR= 40% PF= 1.58 sumR=  +36.0 exp=+0.368 CI95=[+0.009, +0.730] maxDD=9.1R
        H1 T=55 exp=+0.401 PF=1.63 | H2 T=43 exp=+0.324 PF=1.52 | top5=52% | coins+ 5/6 (83%) | 28 tr/yr, +10.2 R/yr over 3.5y | hold avg 3.6d med 2.8d | L/S 29/69
  sleeve rsi-divergence T= 168 WR= 33% PF= 1.03 sumR=   +3.6 exp=+0.022 CI95=[-0.226, +0.281] maxDD=24.8R
        H1 T=83 exp=-0.051 PF=0.93 | H2 T=85 exp=+0.093 PF=1.13 | top5=589% | coins+ 1/2 (50%) | 75 tr/yr, +1.6 R/yr over 2.2y | hold avg 1.2d med 0.5d | L/S 66/102
  blocks: exposure=550 cooldown=260 weeklyTrend=95 ddRolling7d=7 killSwitch=4

## R1 reproduce T2b — B&R + RSI + TSMOM, A→Z
  ALL   T= 499 WR= 42% PF= 1.33 sumR=  +96.1 exp=+0.192 CI95=[+0.061, +0.327] maxDD=23.8R  balDD=22.4%  candidates=3663
        H1 T=278 exp=+0.202 PF=1.35 | H2 T=221 exp=+0.181 PF=1.30 | top5=23% | coins+ 27/40 (68%) | 128 tr/yr, +24.7 R/yr over 3.9y | hold avg 22.9d med 8.0d | L/S 292/207
  2026  T=  76 WR= 39% PF= 1.07 sumR=   +3.0 exp=+0.039 CI95=[-0.260, +0.360] maxDD=13.0R
  sleeve break-retest   T=  54 WR= 39% PF= 1.63 sumR=  +20.8 exp=+0.385 CI95=[-0.095, +0.887] maxDD=11.1R
        H1 T=34 exp=+0.684 PF=2.24 | H2 T=20 exp=-0.122 PF=0.83 | top5=86% | coins+ 4/6 (67%) | 15 tr/yr, +6.0 R/yr over 3.5y | hold avg 4.1d med 3.1d | L/S 16/38
  sleeve rsi-divergence T=  41 WR= 34% PF= 1.18 sumR=   +5.3 exp=+0.128 CI95=[-0.429, +0.733] maxDD=11.9R
        H1 T=24 exp=-0.063 PF=0.92 | H2 T=17 exp=+0.398 PF=1.61 | top5=344% | coins+ 2/2 (100%) | 23 tr/yr, +2.9 R/yr over 1.8y | hold avg 1.3d med 0.6d | L/S 18/23
  sleeve tsmom          T= 404 WR= 43% PF= 1.30 sumR=  +70.0 exp=+0.173 CI95=[+0.039, +0.310] maxDD=30.5R
        H1 T=247 exp=+0.129 PF=1.22 | H2 T=157 exp=+0.243 PF=1.44 | top5=18% | coins+ 25/40 (63%) | 104 tr/yr, +18.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 258/146
  blocks: maxOpen=1389 exposure=1271 cooldown=187 groupCap=173 ddRolling7d=79 weeklyTrend=43 killSwitch=22

## R2 reproduce T2c — T2b + 15 bps + funding (all strategies)
  ALL   T= 491 WR= 43% PF= 1.21 sumR=  +61.4 exp=+0.125 CI95=[-0.002, +0.255] maxDD=21.9R  balDD=22.5%  candidates=3663
        H1 T=275 exp=+0.140 PF=1.24 | H2 T=216 exp=+0.106 PF=1.17 | top5=31% | coins+ 22/40 (55%) | 126 tr/yr, +15.8 R/yr over 3.9y | hold avg 23.1d med 8.0d | L/S 289/202 | funding −25.2R
  2026  T=  76 WR= 39% PF= 0.95 sumR=   -2.5 exp=-0.033 CI95=[-0.322, +0.275] maxDD=15.6R
  sleeve break-retest   T=  53 WR= 40% PF= 1.45 sumR=  +14.6 exp=+0.276 CI95=[-0.169, +0.739] maxDD=11.1R
        H1 T=34 exp=+0.509 PF=1.90 | H2 T=19 exp=-0.142 PF=0.80 | top5=109% | coins+ 4/6 (67%) | 15 tr/yr, +4.2 R/yr over 3.5y | hold avg 4.1d med 3.2d | L/S 15/38 | funding −2.2R
  sleeve rsi-divergence T=  40 WR= 33% PF= 0.95 sumR=   -1.6 exp=-0.041 CI95=[-0.536, +0.510] maxDD=14.2R
        H1 T=23 exp=-0.239 PF=0.71 | H2 T=17 exp=+0.227 PF=1.35 | top5=—% | coins+ 1/2 (50%) | 22 tr/yr, -0.9 R/yr over 1.8y | hold avg 1.3d med 0.5d | L/S 18/22 | funding −0.6R
  sleeve tsmom          T= 398 WR= 44% PF= 1.21 sumR=  +48.4 exp=+0.122 CI95=[-0.010, +0.256] maxDD=31.8R
        H1 T=244 exp=+0.082 PF=1.14 | H2 T=154 exp=+0.185 PF=1.33 | top5=26% | coins+ 22/40 (55%) | 102 tr/yr, +12.5 R/yr over 3.9y | hold avg 27.8d med 10.0d | L/S 256/142 | funding −22.4R
  blocks: maxOpen=1355 exposure=1258 groupCap=189 cooldown=184 ddRolling7d=103 weeklyTrend=48 killSwitch=31 ddDaily=4

## R3 T2b with ENGINE tie-break order (SCANNER_COINS, then registry strategy order)
  ALL   T= 531 WR= 41% PF= 1.27 sumR=  +86.4 exp=+0.163 CI95=[+0.034, +0.294] maxDD=25.2R  balDD=24.8%  candidates=3663
        H1 T=273 exp=+0.134 PF=1.22 | H2 T=258 exp=+0.193 PF=1.32 | top5=28% | coins+ 21/40 (53%) | 137 tr/yr, +22.2 R/yr over 3.9y | hold avg 21.3d med 7.0d | L/S 310/221
  2026  T=  89 WR= 42% PF= 1.28 sumR=  +14.5 exp=+0.163 CI95=[-0.136, +0.476] maxDD=11.4R
  sleeve break-retest   T=  53 WR= 43% PF= 1.85 sumR=  +26.0 exp=+0.490 CI95=[-0.000, +1.000] maxDD=7.6R
        H1 T=35 exp=+0.749 PF=2.40 | H2 T=18 exp=-0.013 PF=0.98 | top5=69% | coins+ 5/6 (83%) | 15 tr/yr, +7.4 R/yr over 3.5y | hold avg 4.0d med 3.2d | L/S 19/34
  sleeve rsi-divergence T=  65 WR= 43% PF= 1.67 sumR=  +27.4 exp=+0.422 CI95=[-0.030, +0.902] maxDD=8.7R
        H1 T=27 exp=+0.049 PF=1.07 | H2 T=38 exp=+0.687 PF=2.24 | top5=78% | coins+ 2/2 (100%) | 36 tr/yr, +15.3 R/yr over 1.8y | hold avg 1.5d med 1.0d | L/S 25/40
  sleeve tsmom          T= 413 WR= 40% PF= 1.13 sumR=  +33.0 exp=+0.080 CI95=[-0.053, +0.216] maxDD=30.0R
        H1 T=241 exp=+0.039 PF=1.06 | H2 T=172 exp=+0.138 PF=1.23 | top5=39% | coins+ 22/40 (55%) | 106 tr/yr, +8.5 R/yr over 3.9y | hold avg 26.6d med 10.0d | L/S 266/147
  blocks: maxOpen=1366 exposure=1254 cooldown=203 groupCap=115 ddRolling7d=86 killSwitch=61 weeklyTrend=41 ddDaily=6

## R3 T2b ENGINE order + 15 bps + funding
  ALL   T= 495 WR= 41% PF= 1.06 sumR=  +19.9 exp=+0.040 CI95=[-0.082, +0.164] maxDD=27.9R  balDD=27.5%  candidates=3663
        H1 T=272 exp=+0.064 PF=1.10 | H2 T=223 exp=+0.011 PF=1.02 | top5=81% | coins+ 18/39 (46%) | 127 tr/yr, +5.1 R/yr over 3.9y | hold avg 23.2d med 8.0d | L/S 299/196 | funding −25.1R
  2026  T=  71 WR= 37% PF= 0.76 sumR=  -11.3 exp=-0.159 CI95=[-0.441, +0.136] maxDD=17.9R
  sleeve break-retest   T=  51 WR= 41% PF= 1.44 sumR=  +14.0 exp=+0.274 CI95=[-0.182, +0.750] maxDD=13.7R
        H1 T=33 exp=+0.676 PF=2.30 | H2 T=18 exp=-0.461 PF=0.42 | top5=114% | coins+ 5/6 (83%) | 15 tr/yr, +4.0 R/yr over 3.5y | hold avg 4.2d med 3.3d | L/S 17/34 | funding −2.2R
  sleeve rsi-divergence T=  40 WR= 35% PF= 0.87 sumR=   -3.9 exp=-0.097 CI95=[-0.533, +0.350] maxDD=11.0R
        H1 T=29 exp=-0.101 PF=0.87 | H2 T=11 exp=-0.084 PF=0.86 | top5=—% | coins+ 1/2 (50%) | 22 tr/yr, -2.2 R/yr over 1.8y | hold avg 1.4d med 1.0d | L/S 21/19 | funding −0.6R
  sleeve tsmom          T= 404 WR= 41% PF= 1.04 sumR=   +9.8 exp=+0.024 CI95=[-0.105, +0.158] maxDD=33.7R
        H1 T=242 exp=-0.025 PF=0.96 | H2 T=162 exp=+0.098 PF=1.16 | top5=129% | coins+ 18/39 (46%) | 104 tr/yr, +2.5 R/yr over 3.9y | hold avg 27.8d med 10.0d | L/S 261/143 | funding −22.3R
  blocks: exposure=1400 maxOpen=1329 cooldown=147 groupCap=105 ddRolling7d=98 weeklyTrend=54 killSwitch=28 ddDaily=7

## R4 T2b with Z→A order
  ALL   T= 515 WR= 41% PF= 1.24 sumR=  +75.8 exp=+0.147 CI95=[+0.019, +0.277] maxDD=23.1R  balDD=22.0%  candidates=3663
        H1 T=256 exp=+0.185 PF=1.32 | H2 T=259 exp=+0.110 PF=1.17 | top5=31% | coins+ 20/40 (50%) | 133 tr/yr, +19.5 R/yr over 3.9y | hold avg 22.2d med 7.0d | L/S 295/220
  2026  T=  89 WR= 42% PF= 1.27 sumR=  +14.3 exp=+0.161 CI95=[-0.138, +0.481] maxDD=13.3R
  sleeve break-retest   T=  53 WR= 43% PF= 1.85 sumR=  +25.9 exp=+0.489 CI95=[+0.001, +0.995] maxDD=7.6R
        H1 T=33 exp=+0.738 PF=2.38 | H2 T=20 exp=+0.079 PF=1.12 | top5=69% | coins+ 5/6 (83%) | 15 tr/yr, +7.4 R/yr over 3.5y | hold avg 3.8d med 2.8d | L/S 18/35
  sleeve rsi-divergence T=  60 WR= 42% PF= 1.55 sumR=  +21.3 exp=+0.355 CI95=[-0.106, +0.837] maxDD=11.8R
        H1 T=24 exp=-0.078 PF=0.90 | H2 T=36 exp=+0.643 PF=2.16 | top5=97% | coins+ 2/2 (100%) | 33 tr/yr, +11.8 R/yr over 1.8y | hold avg 1.5d med 0.9d | L/S 20/40
  sleeve tsmom          T= 402 WR= 41% PF= 1.12 sumR=  +28.6 exp=+0.071 CI95=[-0.062, +0.205] maxDD=28.4R
        H1 T=226 exp=+0.097 PF=1.17 | H2 T=176 exp=+0.038 PF=1.06 | top5=43% | coins+ 19/40 (48%) | 103 tr/yr, +7.4 R/yr over 3.9y | hold avg 27.7d med 11.0d | L/S 257/145
  blocks: maxOpen=1421 exposure=1185 cooldown=205 groupCap=179 ddRolling7d=62 weeklyTrend=46 killSwitch=44 ddDaily=6

## R4 T2b Z→A + 15 bps + funding
  ALL   T= 521 WR= 41% PF= 1.09 sumR=  +29.2 exp=+0.056 CI95=[-0.064, +0.178] maxDD=25.4R  balDD=24.6%  candidates=3663
        H1 T=257 exp=+0.102 PF=1.17 | H2 T=264 exp=+0.012 PF=1.02 | top5=67% | coins+ 19/40 (48%) | 134 tr/yr, +7.5 R/yr over 3.9y | hold avg 22.2d med 7.0d | L/S 301/220 | funding −25.3R
  2026  T=  92 WR= 37% PF= 0.86 sumR=   -8.4 exp=-0.091 CI95=[-0.358, +0.186] maxDD=19.4R
  sleeve break-retest   T=  51 WR= 39% PF= 1.31 sumR=  +10.1 exp=+0.199 CI95=[-0.259, +0.667] maxDD=12.8R
        H1 T=33 exp=+0.562 PF=2.03 | H2 T=18 exp=-0.467 PF=0.42 | top5=157% | coins+ 4/6 (67%) | 15 tr/yr, +2.9 R/yr over 3.5y | hold avg 3.9d med 3.0d | L/S 18/33 | funding −2.1R
  sleeve rsi-divergence T=  63 WR= 40% PF= 1.25 sumR=  +10.5 exp=+0.166 CI95=[-0.242, +0.585] maxDD=12.2R
        H1 T=26 exp=-0.101 PF=0.87 | H2 T=37 exp=+0.354 PF=1.59 | top5=169% | coins+ 1/2 (50%) | 35 tr/yr, +5.8 R/yr over 1.8y | hold avg 1.5d med 0.7d | L/S 23/40 | funding −1.0R
  sleeve tsmom          T= 407 WR= 41% PF= 1.03 sumR=   +8.6 exp=+0.021 CI95=[-0.105, +0.152] maxDD=31.6R
        H1 T=227 exp=+0.028 PF=1.05 | H2 T=180 exp=+0.012 PF=1.02 | top5=140% | coins+ 18/40 (45%) | 105 tr/yr, +2.2 R/yr over 3.9y | hold avg 27.7d med 9.0d | L/S 260/147 | funding −22.2R
  blocks: maxOpen=1391 exposure=1190 cooldown=208 groupCap=195 ddRolling7d=70 weeklyTrend=50 killSwitch=32 ddDaily=6

## R6 SELECTION-BIAS RULE — B&R ×40 alone (same params, engine gates)
  ALL   T= 430 WR= 31% PF= 0.98 sumR=   -6.7 exp=-0.016 CI95=[-0.168, +0.139] maxDD=41.5R  balDD=42.6%  candidates=1803
        H1 T=197 exp=-0.003 PF=1.00 | H2 T=233 exp=-0.026 PF=0.96 | top5=—% | coins+ 20/40 (50%) | 120 tr/yr, -1.9 R/yr over 3.6y | hold avg 3.2d med 1.8d | L/S 114/316
  2026  T= 117 WR= 28% PF= 0.76 sumR=  -20.5 exp=-0.175 CI95=[-0.436, +0.089] maxDD=39.5R
  sleeve break-retest   T= 430 WR= 31% PF= 0.98 sumR=   -6.7 exp=-0.016 CI95=[-0.168, +0.139] maxDD=41.5R
        H1 T=197 exp=-0.003 PF=1.00 | H2 T=233 exp=-0.026 PF=0.96 | top5=—% | coins+ 20/40 (50%) | 120 tr/yr, -1.9 R/yr over 3.6y | hold avg 3.2d med 1.8d | L/S 114/316
  blocks: exposure=662 weeklyTrend=431 killSwitch=157 ddRolling7d=61 cooldown=39 ddDaily=9 maxOpen=8 groupCap=6

## R6 SELECTION-BIAS RULE — B&R ×40 + 15 bps
  ALL   T= 424 WR= 31% PF= 0.93 sumR=  -21.8 exp=-0.051 CI95=[-0.193, +0.100] maxDD=43.4R  balDD=41.6%  candidates=1803
        H1 T=197 exp=-0.060 PF=0.92 | H2 T=227 exp=-0.045 PF=0.94 | top5=—% | coins+ 20/40 (50%) | 118 tr/yr, -6.1 R/yr over 3.6y | hold avg 3.2d med 1.8d | L/S 114/310
  2026  T= 111 WR= 29% PF= 0.76 sumR=  -19.0 exp=-0.171 CI95=[-0.431, +0.095] maxDD=33.9R
  sleeve break-retest   T= 424 WR= 31% PF= 0.93 sumR=  -21.8 exp=-0.051 CI95=[-0.193, +0.100] maxDD=43.4R
        H1 T=197 exp=-0.060 PF=0.92 | H2 T=227 exp=-0.045 PF=0.94 | top5=—% | coins+ 20/40 (50%) | 118 tr/yr, -6.1 R/yr over 3.6y | hold avg 3.2d med 1.8d | L/S 114/310
  blocks: exposure=656 weeklyTrend=430 killSwitch=201 ddRolling7d=48 cooldown=37 groupCap=5 ddDaily=2

## R6 SELECTION-BIAS RULE — RSI ×40 alone (same params, engine gates)
  ALL   T=1207 WR= 30% PF= 0.84 sumR= -151.4 exp=-0.125 CI95=[-0.211, -0.039] maxDD=178.0R  balDD=85.7%  candidates=13784
        H1 T=632 exp=+0.006 PF=1.01 | H2 T=575 exp=-0.270 PF=0.67 | top5=—% | coins+ 11/40 (28%) | 536 tr/yr, -67.2 R/yr over 2.3y | hold avg 1.2d med 0.6d | L/S 526/681
  2026  T= 336 WR= 28% PF= 0.68 sumR=  -86.0 exp=-0.256 CI95=[-0.404, -0.103] maxDD=100.6R
  sleeve rsi-divergence T=1207 WR= 30% PF= 0.84 sumR= -151.4 exp=-0.125 CI95=[-0.211, -0.039] maxDD=178.0R
        H1 T=632 exp=+0.006 PF=1.01 | H2 T=575 exp=-0.270 PF=0.67 | top5=—% | coins+ 11/40 (28%) | 536 tr/yr, -67.2 R/yr over 2.3y | hold avg 1.2d med 0.6d | L/S 526/681
  blocks: killSwitch=3568 ddRolling7d=3165 exposure=2789 cooldown=1395 ddDaily=910 maxOpen=609 groupCap=141

## R6 SELECTION-BIAS RULE — RSI ×40 + 15 bps
  ALL   T=1104 WR= 27% PF= 0.65 sumR= -304.7 exp=-0.276 CI95=[-0.356, -0.195] maxDD=317.3R  balDD=96.6%  candidates=13784
        H1 T=567 exp=-0.191 PF=0.75 | H2 T=537 exp=-0.365 PF=0.56 | top5=—% | coins+ 5/40 (13%) | 494 tr/yr, -136.3 R/yr over 2.2y | hold avg 1.2d med 0.5d | L/S 480/624
  2026  T= 306 WR= 24% PF= 0.52 sumR= -121.4 exp=-0.397 CI95=[-0.535, -0.254] maxDD=125.5R
  sleeve rsi-divergence T=1104 WR= 27% PF= 0.65 sumR= -304.7 exp=-0.276 CI95=[-0.356, -0.195] maxDD=317.3R
        H1 T=567 exp=-0.191 PF=0.75 | H2 T=537 exp=-0.365 PF=0.56 | top5=—% | coins+ 5/40 (13%) | 494 tr/yr, -136.3 R/yr over 2.2y | hold avg 1.2d med 0.5d | L/S 480/624
  blocks: killSwitch=3630 ddRolling7d=3433 exposure=2651 cooldown=1371 ddDaily=885 maxOpen=557 groupCap=147 unfilled=6

## R7 portfolio core40 — B&R ×40 + RSI ×40 (no TSMOM)
  ALL   T=1536 WR= 30% PF= 0.86 sumR= -162.4 exp=-0.106 CI95=[-0.184, -0.026] maxDD=204.2R  balDD=90.9%  candidates=15587
        H1 T=457 exp=-0.016 PF=0.98 | H2 T=1079 exp=-0.144 PF=0.81 | top5=—% | coins+ 11/40 (28%) | 429 tr/yr, -45.4 R/yr over 3.6y | hold avg 1.6d med 0.8d | L/S 633/903
  2026  T= 412 WR= 27% PF= 0.68 sumR= -104.5 exp=-0.254 CI95=[-0.389, -0.116] maxDD=117.1R
  sleeve break-retest   T= 355 WR= 31% PF= 1.02 sumR=   +4.3 exp=+0.012 CI95=[-0.157, +0.183] maxDD=32.4R
        H1 T=186 exp=+0.028 PF=1.04 | H2 T=169 exp=-0.006 PF=0.99 | top5=449% | coins+ 18/38 (47%) | 99 tr/yr, +1.2 R/yr over 3.6y | hold avg 3.2d med 1.8d | L/S 94/261
  sleeve rsi-divergence T=1181 WR= 29% PF= 0.82 sumR= -166.7 exp=-0.141 CI95=[-0.227, -0.052] maxDD=193.7R
        H1 T=633 exp=+0.000 PF=1.00 | H2 T=548 exp=-0.305 PF=0.63 | top5=—% | coins+ 10/40 (25%) | 525 tr/yr, -74.0 R/yr over 2.3y | hold avg 1.1d med 0.5d | L/S 539/642
  blocks: ddRolling7d=4022 exposure=3491 killSwitch=2952 cooldown=1473 ddDaily=882 maxOpen=725 weeklyTrend=323 groupCap=183

## R7 portfolio core40 + TSMOM — B&R ×40 + RSI ×40 + TSMOM
  ALL   T= 933 WR= 38% PF= 1.18 sumR= +112.9 exp=+0.121 CI95=[+0.017, +0.223] maxDD=38.7R  balDD=35.0%  candidates=18068
        H1 T=356 exp=+0.114 PF=1.18 | H2 T=577 exp=+0.125 PF=1.18 | top5=21% | coins+ 24/40 (60%) | 240 tr/yr, +29.1 R/yr over 3.9y | hold avg 12.4d med 2.3d | L/S 466/467
  2026  T= 163 WR= 37% PF= 1.03 sumR=   +3.1 exp=+0.019 CI95=[-0.212, +0.252] maxDD=24.2R
  sleeve break-retest   T= 145 WR= 32% PF= 1.06 sumR=   +6.6 exp=+0.045 CI95=[-0.232, +0.326] maxDD=25.7R
        H1 T=94 exp=+0.082 PF=1.11 | H2 T=51 exp=-0.022 PF=0.97 | top5=272% | coins+ 15/36 (42%) | 42 tr/yr, +1.9 R/yr over 3.5y | hold avg 3.4d med 2.2d | L/S 52/93
  sleeve rsi-divergence T= 404 WR= 34% PF= 1.09 sumR=  +26.6 exp=+0.066 CI95=[-0.099, +0.230] maxDD=52.7R
        H1 T=184 exp=+0.368 PF=1.56 | H2 T=220 exp=-0.186 PF=0.76 | top5=83% | coins+ 20/40 (50%) | 181 tr/yr, +11.9 R/yr over 2.2y | hold avg 1.1d med 0.5d | L/S 174/230
  sleeve tsmom          T= 384 WR= 45% PF= 1.37 sumR=  +79.7 exp=+0.208 CI95=[+0.066, +0.354] maxDD=23.6R
        H1 T=236 exp=+0.178 PF=1.32 | H2 T=148 exp=+0.255 PF=1.46 | top5=16% | coins+ 24/40 (60%) | 99 tr/yr, +20.5 R/yr over 3.9y | hold avg 27.8d med 10.0d | L/S 240/144
  blocks: maxOpen=8383 exposure=5179 killSwitch=1015 ddRolling7d=977 cooldown=552 groupCap=455 ddDaily=402 weeklyTrend=172

## R7 portfolio core40 + TSMOM + 15 bps + funding
  ALL   T= 865 WR= 37% PF= 1.03 sumR=  +16.5 exp=+0.019 CI95=[-0.078, +0.120] maxDD=54.0R  balDD=47.4%  candidates=18068
        H1 T=356 exp=+0.031 PF=1.05 | H2 T=509 exp=+0.011 PF=1.02 | top5=124% | coins+ 23/40 (58%) | 223 tr/yr, +4.2 R/yr over 3.9y | hold avg 13.5d med 3.0d | L/S 462/403 | funding −29.9R
  2026  T= 134 WR= 30% PF= 0.74 sumR=  -26.3 exp=-0.196 CI95=[-0.427, +0.044] maxDD=36.9R
  sleeve break-retest   T= 144 WR= 29% PF= 0.86 sumR=  -15.3 exp=-0.106 CI95=[-0.352, +0.159] maxDD=43.3R
        H1 T=94 exp=-0.070 PF=0.91 | H2 T=50 exp=-0.173 PF=0.77 | top5=—% | coins+ 14/37 (38%) | 40 tr/yr, -4.3 R/yr over 3.6y | hold avg 3.5d med 2.4d | L/S 50/94 | funding −4.5R
  sleeve rsi-divergence T= 347 WR= 32% PF= 0.92 sumR=  -21.1 exp=-0.061 CI95=[-0.221, +0.107] maxDD=72.5R
        H1 T=183 exp=+0.274 PF=1.42 | H2 T=164 exp=-0.435 PF=0.49 | top5=—% | coins+ 15/40 (38%) | 155 tr/yr, -9.4 R/yr over 2.2y | hold avg 1.2d med 0.5d | L/S 179/168 | funding −4.5R
  sleeve tsmom          T= 374 WR= 45% PF= 1.24 sumR=  +52.9 exp=+0.141 CI95=[+0.004, +0.285] maxDD=25.0R
        H1 T=234 exp=+0.113 PF=1.19 | H2 T=140 exp=+0.189 PF=1.33 | top5=24% | coins+ 25/40 (63%) | 96 tr/yr, +13.6 R/yr over 3.9y | hold avg 28.8d med 10.0d | L/S 233/141 | funding −21.0R
  blocks: maxOpen=8485 exposure=5205 killSwitch=1256 ddRolling7d=956 groupCap=486 cooldown=425 ddDaily=211 weeklyTrend=178 unfilled=1

## Reproduction of the T2b headline (claimed → recomputed)
  trades                  499 →  499.000  OK
  exp                   0.192 →    0.192  OK
  PF                     1.33 →    1.326  OK
  CI lo                 0.061 →    0.061  OK
  CI hi                 0.327 →    0.327  OK
  half1 exp             0.202 →    0.202  OK
  half2 exp             0.181 →    0.181  OK
  top5 %                   23 →   22.906  OK
  coins+ %                 68 →   67.500  OK
  maxDD R                23.8 →   23.822  OK
  exp @15bps+fund       0.125 →    0.125  OK
  literal verdict recomputed: **PAPER-CANDIDATE** — ACCEPT failed: ✗ exp +0.192 ≥ +0.25 | PAPER criteria all met
  H2 (sumR up AND maxDD(R) down vs T2a): sumR +39.7 → +96.1, maxDD 18.5R → 23.8R → NOT SUPPORTED

## R5 — T2b over 20 random same-timestamp orders: literal verdict per seed (each seed's +15 bps + funding arm supplies the slip criterion)
  seed  1: T= 509 WR= 40% PF= 1.22 sumR=  +67.5 exp=+0.133 CI95=[+0.005, +0.266] maxDD=22.7R H1/H2 +0.155/+0.107 top5=34% coins+ 51% slip15=+0.097 → REJECT
  seed  2: T= 536 WR= 40% PF= 1.21 sumR=  +67.6 exp=+0.126 CI95=[+0.002, +0.257] maxDD=25.2R H1/H2 +0.137/+0.114 top5=35% coins+ 53% slip15=+0.041 → REJECT
  seed  3: T= 490 WR= 40% PF= 1.22 sumR=  +66.3 exp=+0.135 CI95=[+0.008, +0.267] maxDD=25.4R H1/H2 +0.125/+0.147 top5=33% coins+ 58% slip15=+0.081 → REJECT
  seed  4: T= 504 WR= 43% PF= 1.36 sumR= +105.6 exp=+0.209 CI95=[+0.077, +0.345] maxDD=23.7R H1/H2 +0.198/+0.223 top5=23% coins+ 58% slip15=+0.121 → PAPER-CANDIDATE
  seed  5: T= 503 WR= 41% PF= 1.25 sumR=  +75.3 exp=+0.150 CI95=[+0.022, +0.281] maxDD=25.2R H1/H2 +0.139/+0.163 top5=30% coins+ 63% slip15=+0.062 → REJECT
  seed  6: T= 516 WR= 42% PF= 1.33 sumR= +101.0 exp=+0.196 CI95=[+0.066, +0.327] maxDD=26.3R H1/H2 +0.155/+0.241 top5=23% coins+ 63% slip15=+0.080 → PAPER-CANDIDATE
  seed  7: T= 551 WR= 40% PF= 1.20 sumR=  +67.7 exp=+0.123 CI95=[+0.002, +0.249] maxDD=24.7R H1/H2 +0.140/+0.105 top5=35% coins+ 58% slip15=+0.060 → REJECT
  seed  8: T= 512 WR= 43% PF= 1.37 sumR= +109.4 exp=+0.214 CI95=[+0.086, +0.349] maxDD=26.2R H1/H2 +0.210/+0.218 top5=21% coins+ 55% slip15=+0.146 → PAPER-CANDIDATE
  seed  9: T= 514 WR= 42% PF= 1.29 sumR=  +88.2 exp=+0.172 CI95=[+0.041, +0.302] maxDD=27.3R H1/H2 +0.188/+0.154 top5=27% coins+ 58% slip15=+0.110 → PAPER-CANDIDATE
  seed 10: T= 519 WR= 40% PF= 1.23 sumR=  +72.0 exp=+0.139 CI95=[+0.011, +0.269] maxDD=25.6R H1/H2 +0.125/+0.154 top5=33% coins+ 68% slip15=+0.066 → REJECT
  seed 11: T= 516 WR= 41% PF= 1.28 sumR=  +87.4 exp=+0.169 CI95=[+0.041, +0.300] maxDD=27.3R H1/H2 +0.162/+0.177 top5=27% coins+ 60% slip15=+0.068 → PAPER-CANDIDATE
  seed 12: T= 510 WR= 42% PF= 1.30 sumR=  +91.7 exp=+0.180 CI95=[+0.051, +0.314] maxDD=24.1R H1/H2 +0.171/+0.190 top5=26% coins+ 63% slip15=+0.092 → PAPER-CANDIDATE
  seed 13: T= 512 WR= 41% PF= 1.27 sumR=  +82.3 exp=+0.161 CI95=[+0.034, +0.292] maxDD=29.1R H1/H2 +0.174/+0.147 top5=29% coins+ 65% slip15=+0.097 → PAPER-CANDIDATE
  seed 14: T= 519 WR= 41% PF= 1.28 sumR=  +88.1 exp=+0.170 CI95=[+0.040, +0.303] maxDD=23.1R H1/H2 +0.216/+0.122 top5=27% coins+ 63% slip15=+0.092 → PAPER-CANDIDATE
  seed 15: T= 523 WR= 39% PF= 1.18 sumR=  +58.7 exp=+0.112 CI95=[-0.015, +0.242] maxDD=31.2R H1/H2 +0.072/+0.157 top5=39% coins+ 55% slip15=+0.069 → REJECT
  seed 16: T= 510 WR= 43% PF= 1.33 sumR=  +98.8 exp=+0.194 CI95=[+0.067, +0.324] maxDD=26.2R H1/H2 +0.133/+0.264 top5=20% coins+ 70% slip15=+0.097 → PAPER-CANDIDATE
  seed 17: T= 504 WR= 41% PF= 1.24 sumR=  +73.7 exp=+0.146 CI95=[+0.020, +0.278] maxDD=25.0R H1/H2 +0.123/+0.172 top5=27% coins+ 55% slip15=+0.092 → REJECT
  seed 18: T= 511 WR= 42% PF= 1.30 sumR=  +91.0 exp=+0.178 CI95=[+0.050, +0.308] maxDD=28.7R H1/H2 +0.127/+0.237 top5=25% coins+ 60% slip15=+0.080 → PAPER-CANDIDATE
  seed 19: T= 504 WR= 41% PF= 1.27 sumR=  +80.9 exp=+0.161 CI95=[+0.034, +0.294] maxDD=24.1R H1/H2 +0.149/+0.174 top5=29% coins+ 55% slip15=+0.079 → PAPER-CANDIDATE
  seed 20: T= 513 WR= 40% PF= 1.24 sumR=  +74.3 exp=+0.145 CI95=[+0.017, +0.280] maxDD=26.3R H1/H2 +0.142/+0.148 top5=32% coins+ 48% slip15=+0.062 → REJECT
  summary: PAPER-CANDIDATE 11/20 · ACCEPT 0/20 · REJECT 9/20 · exp min/med/max +0.112/+0.161/+0.214 · exp ≥ 0.15 in 11/20 · PF ≥ 1.15 in 20/20 · CI lo > −0.05 in 20/20 · default A→Z exp +0.192 sits at percentile 80 of the seed distribution
  ENGINE order: exp +0.163 PF 1.27 CI [+0.034, +0.294] halves +0.134/+0.193 slip15+fund +0.040 → **PAPER-CANDIDATE** (ACCEPT failed: ✗ exp +0.163 ≥ +0.25; ✗ PF 1.27 ≥ 1.30; ✗ coins positive 21/40 (53%) ≥ 55%; ✗ exp @ +15 bps +0.040 ≥ +0.10 | PAPER criteria all met)
  Z→A order:    exp +0.147 PF 1.24 CI [+0.019, +0.277] halves +0.185/+0.110 slip15+fund +0.056 → **REJECT** (ACCEPT failed: ✗ exp +0.147 ≥ +0.25; ✗ PF 1.24 ≥ 1.30; ✗ top-5 share 31% ≤ 30%; ✗ coins positive 20/40 (50%) ≥ 55%; ✗ exp @ +15 bps +0.056 ≥ +0.10 | PAPER failed: ✗ exp +0.147 ≥ +0.15)

## R6 — SELECTION-BIAS RULE (pre-registered: hand-picked list must ALSO reach exp ≥ +0.15 on the 40-coin universe, else the preferred-coin result is an artefact → REJECT)
  B&R ×40: exp -0.016 PF 0.98 T=430 CI [-0.168, +0.139] coins+ 20/40 · +15 bps -0.051 → **FAILS** the rule
  RSI ×40: exp -0.125 PF 0.84 T=1207 CI [-0.211, -0.039] coins+ 11/40 · +15 bps -0.276 → **FAILS** the rule
## R7 — the same portfolio with the core on the 40-coin universe (what T2b looks like without the hand-pick)
  core40 alone:        T=1536 WR= 30% PF= 0.86 sumR= -162.4 exp=-0.106 CI95=[-0.184, -0.026] maxDD=204.2R
  core40 + TSMOM:      T= 933 WR= 38% PF= 1.18 sumR= +112.9 exp=+0.121 CI95=[+0.017, +0.223] maxDD=38.7R  halves +0.114/+0.125 top5 21% coins+ 60% slip15+fund +0.019 → **REJECT** (ACCEPT failed: ✗ exp +0.121 ≥ +0.25; ✗ PF 1.18 ≥ 1.30; ✗ exp @ +15 bps +0.019 ≥ +0.10 | PAPER failed: ✗ exp +0.121 ≥ +0.15)

## R8 — T2b restricted to the window where all three sleeves exist (entries ≥ 2024-05-22, first RSI 1h candle)
  T2b   T= 230 WR= 40% PF= 1.27 sumR=  +37.8 exp=+0.164 CI95=[-0.032, +0.368] maxDD=20.0R
        H1 T=88 exp=+0.236 PF=1.39 | H2 T=142 exp=+0.120 PF=1.19 | top5=50% | coins+ 26/39 (67%) | 101 tr/yr, +16.7 R/yr over 2.3y | hold avg 26.0d med 7.0d | L/S 119/111
  T2a   T= 225 WR= 34% PF= 1.10 sumR=  +15.4 exp=+0.068 CI95=[-0.146, +0.290] maxDD=18.5R  (H2 in this window: sumR +15.4 → +37.8, maxDD 18.5R → 20.0R)
  +15 bps + funding: exp +0.089 CI [-0.100, +0.279]
  literal verdict on this window: **PAPER-CANDIDATE** — ACCEPT failed: ✗ exp +0.164 ≥ +0.25; ✗ PF 1.27 ≥ 1.30; ✗ CI95 lo -0.032 > 0; ✗ top-5 share 50% ≤ 30%; ✗ exp @ +15 bps +0.089 ≥ +0.10 | PAPER criteria all met

## R9 — cluster bootstrap CI95 (10k) for T2b: trades are not i.i.d. (same-day pairs agree in sign 66% of 304 pairs; independent trades at WR 42% would agree 51%)
  trade-level (as reported):  [+0.061, +0.327]
  entry-day clusters (313):   [+0.041, +0.352]   PAPER bar (lo > −0.05): met · ACCEPT bar (lo > 0): met
  entry-week clusters (141):  [+0.004, +0.377]   PAPER bar: met · ACCEPT bar: met
  +15 bps + funding — day clusters [-0.021, +0.276] · week clusters [-0.054, +0.301]
  common window (R8) — day clusters [-0.066, +0.393] · week clusters [-0.114, +0.449]

## R10 — where the T2b expectancy comes from
  TSMOM sleeve in-book: T=404 sumR +70.0 exp +0.173 PF 1.30 CI [+0.039, +0.310] halves +0.129/+0.243
  core sleeve in-book (B&R+RSI, hand-picked coins): T=95 sumR +26.1 exp +0.274 PF 1.41 CI [-0.092, +0.666]
  portfolio exp +0.192 = (+70.0 + +26.1) / 499; the core sleeve lifts the book from the TSMOM-only +0.173 by +0.019R/trade
  POST-HOC hypothetical: if the hand-picked core has zero true expectancy (R6), the book's exp is ≈ +0.140 (TSMOM sumR over all 499 slots) — BELOW the +0.15 PAPER bar
  halves by TIME midpoint (as reported): H1 T=278 +0.202 / H2 T=221 +0.181 · by TRADE-COUNT median: H1 T=249 +0.229 / H2 T=250 +0.157
  by year: 2022: T=31 -10.1R exp -0.32 (tsmom -10.1/31, core +0.0/0) | 2023: T=171 +65.3R exp +0.38 (tsmom +40.6/148, core +24.7/23) | 2024: T=126 +12.8R exp +0.10 (tsmom +10.5/108, core +2.3/18) | 2025: T=95 +25.0R exp +0.26 (tsmom +30.2/67, core -5.2/28) | 2026: T=76 +3.0R exp +0.04 (tsmom -1.3/50, core +4.3/26)
  top-5 trades: INJ rsi-divergence SHORT 2025-11-02 +6.79R  ETC break-retest SHORT 2023-08-09 +5.80R  ATOM rsi-divergence LONG 2024-11-26 +3.24R  XRP break-retest SHORT 2026-01-18 +3.14R  AVAX break-retest SHORT 2023-07-22 +3.02R = 23% of sumR

## Review findings (statistics lens)
1. Reproduction: the T2b headline numbers reproduce exactly from the same pipeline and data snapshot; the literal verdict function returns PAPER-CANDIDATE.
2. Criterion waived: the pre-registered SELECTION-BIAS RULE applies to "every component and portfolio"; the report states it was "NOT tested here" for B&R/RSI and issued the PAPER verdict anyway. Applied here: B&R ×40 exp -0.016, RSI ×40 exp -0.125 — both FAIL the ≥ +0.15 bar, so the core sleeve's in-book +26.1R (exp +0.274) is a selection artefact by the pre-registered definition. With the core on the 40-coin universe the same book is exp +0.121 (REJECT); without the core's contribution TSMOM's +70.0R over 499 slots is +0.140R/trade.
3. Tie-break fragility: the A→Z order is not the engine's order. Engine order gives PAPER-CANDIDATE (exp +0.163); across 20 random orders the literal verdict is PAPER-CANDIDATE in 11/20 and REJECT in 9/20 (exp median +0.161); the reported +0.192 is at the 80th percentile of that distribution.
4. CI: the trade-level bootstrap treats 499 trades as i.i.d.; same-day entries across 40 coins agree in sign 66% of the time. Entry-week cluster bootstrap CI95 = [+0.004, +0.377] (PAPER bar still met; ACCEPT bar met).
5. Halves: time-midpoint halves +0.202/+0.181; count-median halves +0.229/+0.157. In the only window where all three sleeves exist (2024-05-22→) the book is exp +0.164 CI [-0.032, +0.368] halves +0.236/+0.120 → PAPER-CANDIDATE.
6. H2 was correctly reported NOT SUPPORTED (maxDD(R) rises 18.5 → 23.8); the top-5 (23%) and breadth (27/40) figures reproduce and are not at issue.

## Addendum — which acceptance rule was applied
- The report under review graded T2b with the COMPONENT rules (PAPER: exp ≥ +0.15, PF ≥ 1.15, CI lo > −0.05, halves > 0, ≥ 30/yr). The Fase 9 pre-registration in `script/audit/AUDIT-NOTES.md` also fixes a stricter PORTFOLIO-for-PAPER rule: exp ≥ +0.20R, PF ≥ 1.30, CI95 lo > 0, halves ≥ +0.10R, ≥ 80 trades/yr, maxDD(R) ≤ 25R, +15 bps ≥ +0.10R. T2b (exp +0.192) fails that rule on expectancy alone; under the engine tie-break order (+0.163) and in 16/20 random orders it fails it as well.
- The SELECTION-BIAS RULE ("applies to every component and portfolio") was explicitly not applied to the B&R/RSI sleeves inside T2b ("NOT tested here"). Applied (R6), both fail; the brrsi stage reached the same numbers independently (B&R ×40 −0.016, RSI ×40 −0.125) and the portfolio stage treated any book containing B&R/RSI as "REFERENCE ONLY → REJECT". The T2b PAPER-CANDIDATE verdict therefore rests on a waived criterion.
- Review verdict: the numbers reproduce exactly, H2 was correctly reported as failed, but the PAPER-CANDIDATE label for "B&R + RSI + TSMOM" does not survive literal application of the pre-registered rules → **REJECT (as a portfolio); the only surviving content is the TSMOM sleeve, which is already graded separately as an order-fragile PAPER-CANDIDATE in the same report.**
