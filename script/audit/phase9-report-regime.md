# Phase 9 — component "regime": Liquidity Sweep × direction × BTC daily regime — 2026-09-02
candles 20000×1h · 40 LS coins · capital $1000 · base risk 1% · margin 10× · strategies: liquidity-sweep only (floor 68, fixed entry = signal-candle close)
BTC daily tag: lib.dailyTrendAt over CLOSED daily candles only (candle.time+86400 ≤ decision time) — no same-day close is used. Series 1d×1500 (EMA50 defined for the whole window).

## Pre-registered hypotheses (fixed before any run)
- H1: LS SHORT taken only when BTC daily trend is UP has positive expectancy over the full 2.3-year window AND in both halves (alt rallies fade against BTC strength).
- H2: LS SHORT-only (all regimes) is better than LS both-directions. "Better" = higher exp AND higher PF AND higher sumR on FULL and in both halves.
- H3: Blocking LS LONGs when BTC daily is UP improves the LS book (same rule).
- Diagnostic only (no hypothesis): the LONG-only book.
## Acceptance (pre-registered, applied literally to A1–A4 on FULL)
- ACCEPT-LIVE-CANDIDATE: exp ≥ +0.25R; PF ≥ 1.30; bootstrap CI95 lower > 0 (10k, FULL); ≥ 50 trades/yr; both halves exp ≥ +0.10R (same sign); top-5 trades ≤ 30% of sumR; ≥ 55% of traded coins with positive sumR; exp under +15 bps entry slippage ≥ +0.10R.
- PAPER-CANDIDATE: exp ≥ +0.15R; PF ≥ 1.15; CI95 lower > −0.05R; both halves positive; ≥ 30 trades/yr. Otherwise REJECT (T < 30 → INSUFFICIENT-DATA).
- Selection-bias rule: not applicable here — all arms run on the full 40-coin LS universe.
- Caveat declared up front: the direction×regime pattern behind H1 was first seen in the 8000-candle window (≈ last 11 months). FULL therefore partly overlaps the data that generated the hypothesis; the PRE-8000 window is the only clean out-of-sample test and is reported for every arm.

data: 1h 2024-05-22 → 2026-09-02; first decision 2024-05-31; halves split at 2025-07-17; 8000-candle window starts 2025-10-04
BTC 1d×1500 from 2022-07-25; phase8's 1d×600 from 2025-01-10 (tag undefined→"neutral" before 2025-03-03)
BTC daily regime coverage (days): up 358 (43%) · neutral 89 (11%) · down 378 (46%)  [with 1d×600: up 206 neutral 341 down 278]

registry pool (LS, post minSL+RR): 7908 candidates (9s) · LONG 2839 · SHORT 5069 · by confidence 68:0 70:3241 75:1958 80:1947 85:692
  candidates LONG: BTC up=1714 · BTC neutral=312 · BTC down=813
  candidates SHORT: BTC up=2067 · BTC neutral=555 · BTC down=2447

# PRE-REGISTERED ARMS (registry pool, honest by construction)
Windows: FULL · H1/H2 (time halves of the decision range) · PRE-8000 (before the 8000-candle window in which the direction×regime pattern was first observed — the only part of the data not seen when H1 was formed) · 2026 · last90d · Aug14→Sep1 (parity only). Each row also splits its own window in halves (H1/H2 columns).

## PARITY: A0 at phase8 params ($500 2% no margin, BTC 1d×600) — must equal phase8-report-core-20000 'FLOOR 68 LS only'
  candidates in: 7908 · balDD=98.9% · final $11
  FULL      T=1494 WR= 28% PF= 0.90 sumR= -117.6 exp=-0.079 CI95=[-0.164, +0.008] maxDD=175.3R | H1 T=662 exp=-0.159 PF=0.81 · H2 T=832 exp=-0.015 PF=0.98 | top5=—% coins+=14/40 T/yr=662
  H1        T= 662 WR= 25% PF= 0.81 sumR= -105.2 exp=-0.159 CI95=[-0.280, -0.027] maxDD=145.2R | H1 T=376 exp=-0.035 PF=0.96 · H2 T=286 exp=-0.321 PF=0.63 | top5=—% coins+=14/40 T/yr=587
  H2        T= 832 WR= 31% PF= 0.98 sumR=  -12.4 exp=-0.015 CI95=[-0.127, +0.100] maxDD=55.7R | H1 T=423 exp=+0.057 PF=1.08 · H2 T=409 exp=-0.089 PF=0.89 | top5=—% coins+=20/40 T/yr=737
  PRE-8000  T= 820 WR= 26% PF= 0.81 sumR= -125.1 exp=-0.153 CI95=[-0.263, -0.042] maxDD=173.1R | H1 T=429 exp=-0.078 PF=0.90 · H2 T=391 exp=-0.234 PF=0.72 | top5=—% coins+=11/40 T/yr=610
  2026      T= 510 WR= 32% PF= 1.00 sumR=   +1.4 exp=+0.003 CI95=[-0.137, +0.152] maxDD=55.7R | H1 T=281 exp=-0.022 PF=0.97 · H2 T=229 exp=+0.033 PF=1.04 | top5=1446% coins+=21/40 T/yr=762
  last90d   T= 143 WR= 25% PF= 0.60 sumR=  -47.5 exp=-0.332 CI95=[-0.553, -0.086] maxDD=55.7R | H1 T=83 exp=-0.212 PF=0.74 · H2 T=60 exp=-0.498 PF=0.42 | top5=—% coins+=9/38 T/yr=578
  Aug14→    T=  35 WR= 34% PF= 0.77 sumR=   -5.8 exp=-0.165 CI95=[-0.591, +0.298] maxDD=13.1R | H1 T=23 exp=-0.248 PF=0.68 · H2 T=12 exp=-0.005 PF=0.99 | top5=—% coins+=9/24 T/yr=673
  blocks: ddRolling7d=2233 killSwitch=1841 exposure=1337 ddDaily=356 cooldown=291 groupCap=182 maxOpen=174

## A0 LS both directions (baseline)
  candidates in: 7908 · balDD=87.6% · final $199
  FULL      T=1486 WR= 28% PF= 0.89 sumR= -134.5 exp=-0.091 CI95=[-0.174, -0.004] maxDD=194.7R | H1 T=654 exp=-0.187 PF=0.77 · H2 T=832 exp=-0.015 PF=0.98 | top5=—% coins+=14/40 T/yr=659
  H1        T= 654 WR= 25% PF= 0.77 sumR= -122.1 exp=-0.187 CI95=[-0.308, -0.058] maxDD=164.6R | H1 T=366 exp=-0.061 PF=0.92 · H2 T=288 exp=-0.347 PF=0.60 | top5=—% coins+=12/40 T/yr=580
  H2        T= 832 WR= 31% PF= 0.98 sumR=  -12.4 exp=-0.015 CI95=[-0.127, +0.100] maxDD=55.7R | H1 T=423 exp=+0.057 PF=1.08 · H2 T=409 exp=-0.089 PF=0.89 | top5=—% coins+=20/40 T/yr=737
  PRE-8000  T= 812 WR= 26% PF= 0.79 sumR= -142.0 exp=-0.175 CI95=[-0.287, -0.060] maxDD=192.6R | H1 T=424 exp=-0.088 PF=0.89 · H2 T=388 exp=-0.270 PF=0.68 | top5=—% coins+=10/40 T/yr=604
  2026      T= 510 WR= 32% PF= 1.00 sumR=   +1.4 exp=+0.003 CI95=[-0.137, +0.152] maxDD=55.7R | H1 T=281 exp=-0.022 PF=0.97 · H2 T=229 exp=+0.033 PF=1.04 | top5=1446% coins+=21/40 T/yr=762
  last90d   T= 143 WR= 25% PF= 0.60 sumR=  -47.5 exp=-0.332 CI95=[-0.553, -0.086] maxDD=55.7R | H1 T=83 exp=-0.212 PF=0.74 · H2 T=60 exp=-0.498 PF=0.42 | top5=—% coins+=9/38 T/yr=578
  Aug14→    T=  35 WR= 34% PF= 0.77 sumR=   -5.8 exp=-0.165 CI95=[-0.591, +0.298] maxDD=13.1R | H1 T=23 exp=-0.248 PF=0.68 · H2 T=12 exp=-0.005 PF=0.99 | top5=—% coins+=9/24 T/yr=673
  blocks: ddRolling7d=2229 killSwitch=1884 exposure=1320 ddDaily=353 cooldown=285 groupCap=184 maxOpen=167

## A1 LS SHORT-only (all regimes)
  candidates in: 5069 · balDD=70.6% · final $893
  FULL      T=1177 WR= 31% PF= 1.02 sumR=  +14.0 exp=+0.012 CI95=[-0.085, +0.112] maxDD=121.7R | H1 T=576 exp=+0.048 PF=1.06 · H2 T=601 exp=-0.023 PF=0.97 | top5=183% coins+=21/40 T/yr=522
  H1        T= 576 WR= 31% PF= 1.06 sumR=  +27.6 exp=+0.048 CI95=[-0.089, +0.194] maxDD=68.3R | H1 T=325 exp=+0.223 PF=1.31 · H2 T=251 exp=-0.178 PF=0.78 | top5=93% coins+=22/40 T/yr=511
  H2        T= 601 WR= 31% PF= 0.97 sumR=  -13.6 exp=-0.023 CI95=[-0.158, +0.111] maxDD=61.5R | H1 T=284 exp=+0.032 PF=1.04 · H2 T=317 exp=-0.071 PF=0.91 | top5=—% coins+=17/40 T/yr=533
  PRE-8000  T= 644 WR= 29% PF= 0.97 sumR=  -14.1 exp=-0.022 CI95=[-0.157, +0.119] maxDD=106.2R | H1 T=381 exp=+0.228 PF=1.32 · H2 T=263 exp=-0.384 PF=0.56 | top5=—% coins+=20/40 T/yr=479
  2026      T= 405 WR= 34% PF= 1.14 sumR=  +40.8 exp=+0.101 CI95=[-0.062, +0.266] maxDD=57.3R | H1 T=209 exp=+0.162 PF=1.23 · H2 T=196 exp=+0.036 PF=1.05 | top5=48% coins+=21/40 T/yr=605
  last90d   T= 117 WR= 21% PF= 0.50 sumR=  -52.5 exp=-0.449 CI95=[-0.681, -0.186] maxDD=52.5R | H1 T=69 exp=-0.303 PF=0.64 · H2 T=48 exp=-0.659 PF=0.32 | top5=—% coins+=9/39 T/yr=473
  Aug14→    T=  16 WR= 13% PF= 0.31 sumR=  -10.9 exp=-0.683 CI95=[-1.132, -0.020] maxDD=13.4R | H1 T=12 exp=-0.538 PF=0.43 · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=2/13 T/yr=308
  blocks: killSwitch=1279 ddRolling7d=1034 exposure=966 ddDaily=214 cooldown=173 maxOpen=120 groupCap=106

## A2 LS SHORT-only AND BTC daily UP
  candidates in: 5069 · balDD=55.4% · final $3707
  FULL      T= 559 WR= 36% PF= 1.37 sumR= +143.9 exp=+0.257 CI95=[+0.105, +0.419] maxDD=59.8R | H1 T=323 exp=+0.108 PF=1.14 · H2 T=236 exp=+0.462 PF=1.73 | top5=22% coins+=29/40 T/yr=248
  H1        T= 323 WR= 31% PF= 1.14 sumR=  +34.8 exp=+0.108 CI95=[-0.089, +0.310] maxDD=45.0R | H1 T=185 exp=+0.326 PF=1.46 · H2 T=138 exp=-0.185 PF=0.78 | top5=71% coins+=19/40 T/yr=286
  H2        T= 236 WR= 44% PF= 1.73 sumR= +109.1 exp=+0.462 CI95=[+0.221, +0.706] maxDD=21.9R | H1 T=104 exp=+0.535 PF=1.87 · H2 T=132 exp=+0.405 PF=1.63 | top5=25% coins+=30/40 T/yr=209
  PRE-8000  T= 376 WR= 31% PF= 1.12 sumR=  +33.2 exp=+0.088 CI95=[-0.094, +0.276] maxDD=59.8R | H1 T=231 exp=+0.323 PF=1.46 · H2 T=145 exp=-0.286 PF=0.66 | top5=75% coins+=22/40 T/yr=280
  2026      T= 163 WR= 45% PF= 1.70 sumR=  +71.3 exp=+0.437 CI95=[+0.166, +0.715] maxDD=21.9R | H1 T=75 exp=+0.116 PF=1.16 · H2 T=88 exp=+0.711 PF=2.33 | top5=28% coins+=26/40 T/yr=244
  last90d   T=  47 WR= 40% PF= 1.39 sumR=  +12.4 exp=+0.264 CI95=[-0.221, +0.790] maxDD=14.5R | H1 T=0 exp=+0.000 PF=— · H2 T=47 exp=+0.264 PF=1.39 | top5=136% coins+=18/32 T/yr=190
  Aug14→    T=  13 WR=  0% PF= 0.00 sumR=  -14.5 exp=-1.114 CI95=[-1.136, -1.094] maxDD=14.5R | H1 T=9 exp=-1.112 PF=0.00 · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/11 T/yr=250
  blocks: btcDailyRegime=3002 ddRolling7d=548 exposure=412 killSwitch=268 ddDaily=138 cooldown=82 maxOpen=33 groupCap=27

## A3 LS SHORT-only AND BTC daily NOT DOWN
  candidates in: 5069 · balDD=59.9% · final $1500
  FULL      T= 675 WR= 34% PF= 1.16 sumR=  +80.1 exp=+0.119 CI95=[-0.013, +0.254] maxDD=66.0R | H1 T=380 exp=+0.100 PF=1.13 · H2 T=295 exp=+0.143 PF=1.20 | top5=30% coins+=23/40 T/yr=299
  H1        T= 380 WR= 32% PF= 1.13 sumR=  +37.9 exp=+0.100 CI95=[-0.077, +0.278] maxDD=38.4R | H1 T=206 exp=+0.324 PF=1.47 · H2 T=174 exp=-0.165 PF=0.80 | top5=64% coins+=25/40 T/yr=337
  H2        T= 295 WR= 36% PF= 1.20 sumR=  +42.2 exp=+0.143 CI95=[-0.060, +0.353] maxDD=34.3R | H1 T=121 exp=+0.193 PF=1.27 · H2 T=174 exp=+0.108 PF=1.15 | top5=47% coins+=21/40 T/yr=261
  PRE-8000  T= 433 WR= 32% PF= 1.10 sumR=  +33.3 exp=+0.077 CI95=[-0.086, +0.245] maxDD=66.0R | H1 T=237 exp=+0.197 PF=1.27 · H2 T=196 exp=-0.069 PF=0.91 | top5=73% coins+=23/40 T/yr=322
  2026      T= 219 WR= 37% PF= 1.26 sumR=  +41.2 exp=+0.188 CI95=[-0.039, +0.419] maxDD=33.2R | H1 T=82 exp=+0.100 PF=1.13 · H2 T=137 exp=+0.241 PF=1.35 | top5=47% coins+=21/40 T/yr=327
  last90d   T=  78 WR= 32% PF= 0.89 sumR=   -6.3 exp=-0.081 CI95=[-0.428, +0.294] maxDD=19.4R | H1 T=15 exp=+0.205 PF=1.30 · H2 T=63 exp=-0.150 PF=0.81 | top5=—% coins+=12/34 T/yr=315
  Aug14→    T=  14 WR=  0% PF= 0.00 sumR=  -15.6 exp=-1.114 CI95=[-1.133, -1.095] maxDD=15.6R | H1 T=10 exp=-1.113 PF=0.00 · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/12 T/yr=269
  blocks: btcDailyRegime=2447 ddRolling7d=743 exposure=490 killSwitch=418 ddDaily=127 cooldown=90 groupCap=41 maxOpen=38

## A4 LS both directions, LONG blocked when BTC daily UP
  candidates in: 7908 · balDD=78.1% · final $757
  FULL      T=1312 WR= 30% PF= 0.99 sumR=   -9.5 exp=-0.007 CI95=[-0.101, +0.086] maxDD=149.1R | H1 T=601 exp=-0.014 PF=0.98 · H2 T=711 exp=-0.002 PF=1.00 | top5=—% coins+=18/40 T/yr=581
  H1        T= 601 WR= 29% PF= 0.98 sumR=   -8.2 exp=-0.014 CI95=[-0.148, +0.122] maxDD=94.1R | H1 T=344 exp=+0.217 PF=1.30 · H2 T=257 exp=-0.322 PF=0.63 | top5=—% coins+=19/40 T/yr=533
  H2        T= 711 WR= 31% PF= 1.00 sumR=   -1.3 exp=-0.002 CI95=[-0.121, +0.124] maxDD=64.5R | H1 T=324 exp=+0.035 PF=1.05 · H2 T=387 exp=-0.032 PF=0.96 | top5=—% coins+=19/40 T/yr=630
  PRE-8000  T= 678 WR= 28% PF= 0.91 sumR=  -48.1 exp=-0.071 CI95=[-0.191, +0.063] maxDD=129.0R | H1 T=386 exp=+0.152 PF=1.21 · H2 T=292 exp=-0.366 PF=0.58 | top5=—% coins+=17/40 T/yr=505
  2026      T= 487 WR= 34% PF= 1.14 sumR=  +51.4 exp=+0.106 CI95=[-0.054, +0.265] maxDD=45.4R | H1 T=266 exp=+0.120 PF=1.16 · H2 T=221 exp=+0.089 PF=1.12 | top5=40% coins+=25/40 T/yr=728
  last90d   T= 147 WR= 27% PF= 0.73 sumR=  -33.3 exp=-0.227 CI95=[-0.474, +0.040] maxDD=45.4R | H1 T=83 exp=-0.212 PF=0.74 · H2 T=64 exp=-0.245 PF=0.71 | top5=—% coins+=12/40 T/yr=594
  Aug14→    T=  18 WR=  6% PF= 0.13 sumR=  -16.7 exp=-0.929 CI95=[-1.150, -0.513] maxDD=16.8R | H1 T=14 exp=-0.876 PF=0.17 · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=1/14 T/yr=346
  blocks: longBtcUp=1714 killSwitch=1505 ddRolling7d=1407 exposure=1158 ddDaily=271 cooldown=227 maxOpen=174 groupCap=140

## A5a = A2 +15 bps adverse entry slippage (SL/TP fixed, right-sized, R:R re-gated ≥1.5)
  candidates in: 5069 · balDD=58.6% · final $2067
  FULL      T= 556 WR= 37% PF= 1.23 sumR=  +89.6 exp=+0.161 CI95=[+0.018, +0.303] maxDD=66.0R | H1 T=320 exp=+0.058 PF=1.08 · H2 T=236 exp=+0.302 PF=1.47 | top5=28% coins+=24/40 T/yr=246
  H1        T= 320 WR= 32% PF= 1.08 sumR=  +18.5 exp=+0.058 CI95=[-0.128, +0.243] maxDD=48.3R | H1 T=182 exp=+0.275 PF=1.40 · H2 T=138 exp=-0.229 PF=0.72 | top5=125% coins+=17/40 T/yr=284
  H2        T= 236 WR= 43% PF= 1.47 sumR=  +71.2 exp=+0.302 CI95=[+0.090, +0.528] maxDD=23.6R | H1 T=107 exp=+0.306 PF=1.48 · H2 T=129 exp=+0.298 PF=1.47 | top5=29% coins+=27/40 T/yr=209
  PRE-8000  T= 373 WR= 32% PF= 1.05 sumR=  +12.7 exp=+0.034 CI95=[-0.138, +0.205] maxDD=66.0R | H1 T=228 exp=+0.269 PF=1.39 · H2 T=145 exp=-0.335 PF=0.60 | top5=182% coins+=17/40 T/yr=278
  2026      T= 164 WR= 44% PF= 1.48 sumR=  +49.9 exp=+0.304 CI95=[+0.047, +0.553] maxDD=23.6R | H1 T=76 exp=-0.007 PF=0.99 · H2 T=88 exp=+0.573 PF=2.08 | top5=36% coins+=25/40 T/yr=245
  last90d   T=  47 WR= 40% PF= 1.25 sumR=   +7.8 exp=+0.167 CI95=[-0.292, +0.640] maxDD=14.4R | H1 T=0 exp=+0.000 PF=— · H2 T=47 exp=+0.167 PF=1.25 | top5=181% coins+=15/32 T/yr=190
  Aug14→    T=  13 WR=  0% PF= 0.00 sumR=  -14.4 exp=-1.104 CI95=[-1.122, -1.087] maxDD=14.4R | H1 T=9 exp=-1.103 PF=0.00 · H2 T=4 exp=-1.107 PF=0.00 | top5=—% coins+=0/11 T/yr=250
  blocks: btcDailyRegime=3002 ddRolling7d=563 exposure=417 killSwitch=265 ddDaily=136 cooldown=80 maxOpen=29 groupCap=21

## A5b = A2 +30 bps adverse entry slippage
  candidates in: 5069 · balDD=59.8% · final $1377
  FULL      T= 548 WR= 36% PF= 1.14 sumR=  +52.8 exp=+0.096 CI95=[-0.038, +0.232] maxDD=68.4R | H1 T=317 exp=+0.003 PF=1.00 · H2 T=231 exp=+0.224 PF=1.36 | top5=45% coins+=20/40 T/yr=243
  H1        T= 317 WR= 32% PF= 1.00 sumR=   +1.0 exp=+0.003 CI95=[-0.174, +0.186] maxDD=49.6R | H1 T=181 exp=+0.195 PF=1.29 · H2 T=136 exp=-0.252 PF=0.69 | top5=2150% coins+=15/40 T/yr=281
  H2        T= 231 WR= 42% PF= 1.36 sumR=  +51.8 exp=+0.224 CI95=[+0.024, +0.432] maxDD=22.0R | H1 T=105 exp=+0.224 PF=1.35 · H2 T=126 exp=+0.225 PF=1.36 | top5=37% coins+=24/40 T/yr=205
  PRE-8000  T= 369 WR= 32% PF= 0.98 sumR=   -6.2 exp=-0.017 CI95=[-0.177, +0.149] maxDD=68.4R | H1 T=226 exp=+0.198 PF=1.29 · H2 T=143 exp=-0.356 PF=0.57 | top5=—% coins+=18/40 T/yr=275
  2026      T= 160 WR= 43% PF= 1.35 sumR=  +34.9 exp=+0.218 CI95=[-0.017, +0.459] maxDD=22.0R | H1 T=73 exp=-0.066 PF=0.91 · H2 T=87 exp=+0.456 PF=1.86 | top5=47% coins+=24/40 T/yr=239
  last90d   T=  47 WR= 40% PF= 1.16 sumR=   +4.9 exp=+0.104 CI95=[-0.320, +0.561] maxDD=14.2R | H1 T=0 exp=+0.000 PF=— · H2 T=47 exp=+0.104 PF=1.16 | top5=269% coins+=17/32 T/yr=190
  Aug14→    T=  13 WR=  0% PF= 0.00 sumR=  -14.2 exp=-1.096 CI95=[-1.111, -1.081] maxDD=14.2R | H1 T=9 exp=-1.095 PF=0.00 · H2 T=4 exp=-1.098 PF=0.00 | top5=—% coins+=0/11 T/yr=250
  blocks: btcDailyRegime=3002 ddRolling7d=607 exposure=414 killSwitch=216 ddDaily=134 cooldown=81 maxOpen=35 groupCap=27 unfilled=5

## A6 = A2 with portfolio guards off (daily / rolling-7d / kill-switch) — guard-interaction diagnostic
  candidates in: 5069 · balDD=71.1% · final $2235
  FULL      T=1027 WR= 33% PF= 1.18 sumR= +133.4 exp=+0.130 CI95=[+0.021, +0.241] maxDD=87.1R | H1 T=614 exp=+0.105 PF=1.14 · H2 T=413 exp=+0.166 PF=1.23 | top5=22% coins+=23/40 T/yr=455
  H1        T= 614 WR= 31% PF= 1.14 sumR=  +64.6 exp=+0.105 CI95=[-0.037, +0.255] maxDD=55.8R | H1 T=327 exp=+0.228 PF=1.31 · H2 T=287 exp=-0.034 PF=0.96 | top5=38% coins+=22/40 T/yr=544
  H2        T= 413 WR= 36% PF= 1.23 sumR=  +68.8 exp=+0.166 CI95=[-0.002, +0.345] maxDD=71.4R | H1 T=175 exp=+0.286 PF=1.41 · H2 T=238 exp=+0.079 PF=1.11 | top5=37% coins+=27/40 T/yr=366
  PRE-8000  T= 728 WR= 31% PF= 1.10 sumR=  +56.2 exp=+0.077 CI95=[-0.058, +0.210] maxDD=87.1R | H1 T=397 exp=+0.273 PF=1.39 · H2 T=331 exp=-0.158 PF=0.81 | top5=44% coins+=22/40 T/yr=542
  2026      T= 278 WR= 37% PF= 1.20 sumR=  +39.7 exp=+0.143 CI95=[-0.057, +0.351] maxDD=71.4R | H1 T=130 exp=-0.190 PF=0.77 · H2 T=148 exp=+0.435 PF=1.72 | top5=51% coins+=24/40 T/yr=415
  last90d   T=  84 WR= 43% PF= 1.38 sumR=  +20.4 exp=+0.243 CI95=[-0.123, +0.603] maxDD=35.5R | H1 T=0 exp=+0.000 PF=— · H2 T=84 exp=+0.243 PF=1.38 | top5=89% coins+=20/38 T/yr=339
  Aug14→    T=  50 WR= 34% PF= 0.77 sumR=   -8.5 exp=-0.171 CI95=[-0.543, +0.237] maxDD=35.5R | H1 T=15 exp=-1.035 PF=0.02 · H2 T=35 exp=+0.200 PF=1.33 | top5=—% coins+=10/30 T/yr=961
  blocks: btcDailyRegime=3002 exposure=733 cooldown=133 maxOpen=104 groupCap=68 margin=2

## A1 +15 bps slippage (for the acceptance rule)
  candidates in: 5069 · balDD=73.5% · final $507
  FULL      T=1163 WR= 31% PF= 0.94 sumR=  -54.1 exp=-0.047 CI95=[-0.136, +0.045] maxDD=124.3R | H1 T=562 exp=-0.055 PF=0.93 · H2 T=601 exp=-0.039 PF=0.95 | top5=—% coins+=18/40 T/yr=515
  H1        T= 562 WR= 30% PF= 0.93 sumR=  -30.8 exp=-0.055 CI95=[-0.188, +0.082] maxDD=81.5R | H1 T=320 exp=+0.132 PF=1.19 · H2 T=242 exp=-0.302 PF=0.64 | top5=—% coins+=15/40 T/yr=498
  H2        T= 601 WR= 33% PF= 0.95 sumR=  -23.3 exp=-0.039 CI95=[-0.161, +0.085] maxDD=59.4R | H1 T=291 exp=+0.039 PF=1.06 · H2 T=310 exp=-0.112 PF=0.85 | top5=—% coins+=17/40 T/yr=533
  PRE-8000  T= 639 WR= 29% PF= 0.89 sumR=  -52.4 exp=-0.082 CI95=[-0.209, +0.045] maxDD=121.8R | H1 T=364 exp=+0.121 PF=1.17 · H2 T=275 exp=-0.351 PF=0.59 | top5=—% coins+=17/40 T/yr=476
  2026      T= 397 WR= 36% PF= 1.07 sumR=  +20.0 exp=+0.050 CI95=[-0.109, +0.211] maxDD=59.4R | H1 T=205 exp=+0.094 PF=1.13 · H2 T=192 exp=+0.004 PF=1.01 | top5=91% coins+=20/40 T/yr=593
  last90d   T= 113 WR= 26% PF= 0.49 sumR=  -47.5 exp=-0.420 CI95=[-0.640, -0.172] maxDD=52.6R | H1 T=67 exp=-0.375 PF=0.55 · H2 T=46 exp=-0.487 PF=0.40 | top5=—% coins+=7/39 T/yr=456
  Aug14→    T=  18 WR= 44% PF= 0.56 sumR=   -4.9 exp=-0.274 CI95=[-0.713, +0.190] maxDD=10.0R | H1 T=7 exp=-0.919 PF=0.05 · H2 T=11 exp=+0.136 PF=1.35 | top5=—% coins+=7/16 T/yr=346
  blocks: ddRolling7d=1220 killSwitch=1117 exposure=940 ddDaily=229 cooldown=166 maxOpen=119 groupCap=115

## A3 +15 bps slippage (for the acceptance rule)
  candidates in: 5069 · balDD=64.3% · final $793
  FULL      T= 662 WR= 34% PF= 1.03 sumR=  +15.4 exp=+0.023 CI95=[-0.100, +0.148] maxDD=77.1R | H1 T=374 exp=+0.032 PF=1.04 · H2 T=288 exp=+0.011 PF=1.02 | top5=146% coins+=19/40 T/yr=293
  H1        T= 374 WR= 33% PF= 1.04 sumR=  +12.1 exp=+0.032 CI95=[-0.133, +0.201] maxDD=45.5R | H1 T=203 exp=+0.252 PF=1.37 · H2 T=171 exp=-0.229 PF=0.72 | top5=185% coins+=24/40 T/yr=332
  H2        T= 288 WR= 35% PF= 1.02 sumR=   +3.2 exp=+0.011 CI95=[-0.171, +0.204] maxDD=34.2R | H1 T=120 exp=+0.109 PF=1.15 · H2 T=168 exp=-0.059 PF=0.92 | top5=540% coins+=19/40 T/yr=255
  PRE-8000  T= 427 WR= 32% PF= 1.01 sumR=   +2.8 exp=+0.007 CI95=[-0.153, +0.167] maxDD=77.1R | H1 T=234 exp=+0.130 PF=1.18 · H2 T=193 exp=-0.143 PF=0.82 | top5=810% coins+=23/40 T/yr=318
  2026      T= 212 WR= 36% PF= 1.06 sumR=   +8.8 exp=+0.041 CI95=[-0.160, +0.262] maxDD=33.0R | H1 T=81 exp=+0.033 PF=1.05 · H2 T=131 exp=+0.047 PF=1.07 | top5=189% coins+=18/40 T/yr=317
  last90d   T=  72 WR= 28% PF= 0.58 sumR=  -24.5 exp=-0.341 CI95=[-0.627, -0.029] maxDD=26.6R | H1 T=15 exp=+0.100 PF=1.15 · H2 T=57 exp=-0.457 PF=0.46 | top5=—% coins+=10/34 T/yr=291
  Aug14→    T=  13 WR=  0% PF= 0.00 sumR=  -14.5 exp=-1.114 CI95=[-1.136, -1.095] maxDD=14.5R | H1 T=8 exp=-1.108 PF=0.00 · H2 T=5 exp=-1.123 PF=0.00 | top5=—% coins+=0/12 T/yr=250
  blocks: btcDailyRegime=2447 ddRolling7d=831 exposure=493 killSwitch=356 ddDaily=120 cooldown=90 groupCap=40 maxOpen=30

## A4 +15 bps slippage (for the acceptance rule)
  candidates in: 7908 · balDD=85.1% · final $286
  FULL      T=1270 WR= 30% PF= 0.88 sumR= -116.8 exp=-0.092 CI95=[-0.177, -0.006] maxDD=178.7R | H1 T=577 exp=-0.089 PF=0.89 · H2 T=693 exp=-0.095 PF=0.88 | top5=—% coins+=14/40 T/yr=563
  H1        T= 577 WR= 29% PF= 0.89 sumR=  -51.3 exp=-0.089 CI95=[-0.217, +0.044] maxDD=103.3R | H1 T=340 exp=+0.131 PF=1.18 · H2 T=237 exp=-0.404 PF=0.54 | top5=—% coins+=15/40 T/yr=511
  H2        T= 693 WR= 31% PF= 0.88 sumR=  -65.5 exp=-0.095 CI95=[-0.207, +0.022] maxDD=80.3R | H1 T=337 exp=-0.017 PF=0.98 · H2 T=356 exp=-0.168 PF=0.78 | top5=—% coins+=17/40 T/yr=614
  PRE-8000  T= 673 WR= 28% PF= 0.84 sumR=  -82.8 exp=-0.123 CI95=[-0.242, +0.000] maxDD=136.7R | H1 T=382 exp=+0.070 PF=1.10 · H2 T=291 exp=-0.376 PF=0.56 | top5=—% coins+=13/40 T/yr=501
  2026      T= 454 WR= 33% PF= 0.97 sumR=  -10.3 exp=-0.023 CI95=[-0.166, +0.124] maxDD=73.4R | H1 T=226 exp=-0.084 PF=0.89 · H2 T=228 exp=+0.039 PF=1.05 | top5=—% coins+=19/40 T/yr=678
  last90d   T= 151 WR= 27% PF= 0.67 sumR=  -40.2 exp=-0.266 CI95=[-0.487, -0.035] maxDD=44.8R | H1 T=88 exp=-0.304 PF=0.63 · H2 T=63 exp=-0.213 PF=0.73 | top5=—% coins+=12/40 T/yr=610
  Aug14→    T=  17 WR=  6% PF= 0.11 sumR=  -15.8 exp=-0.931 CI95=[-1.135, -0.547] maxDD=15.8R | H1 T=13 exp=-0.877 PF=0.15 · H2 T=4 exp=-1.107 PF=0.00 | top5=—% coins+=1/14 T/yr=327
  blocks: longBtcUp=1714 ddRolling7d=1577 killSwitch=1429 exposure=1138 ddDaily=257 cooldown=219 maxOpen=165 groupCap=139

## DIAG D1 LS LONG-only (all regimes)
  candidates in: 2839 · balDD=84.7% · final $153
  FULL      T= 835 WR= 27% PF= 0.81 sumR= -126.1 exp=-0.151 CI95=[-0.259, -0.041] maxDD=135.3R | H1 T=423 exp=-0.246 PF=0.71 · H2 T=412 exp=-0.053 PF=0.93 | top5=—% coins+=15/40 T/yr=370
  H1        T= 423 WR= 24% PF= 0.71 sumR= -104.2 exp=-0.246 CI95=[-0.388, -0.096] maxDD=104.2R | H1 T=246 exp=-0.137 PF=0.83 · H2 T=177 exp=-0.398 PF=0.55 | top5=—% coins+=12/40 T/yr=375
  H2        T= 412 WR= 30% PF= 0.93 sumR=  -22.0 exp=-0.053 CI95=[-0.208, +0.106] maxDD=55.4R | H1 T=196 exp=-0.120 PF=0.85 · H2 T=216 exp=+0.007 PF=1.01 | top5=—% coins+=18/40 T/yr=365
  PRE-8000  T= 523 WR= 26% PF= 0.78 sumR=  -93.3 exp=-0.178 CI95=[-0.312, -0.040] maxDD=119.2R | H1 T=280 exp=-0.150 PF=0.81 · H2 T=243 exp=-0.211 PF=0.74 | top5=—% coins+=13/40 T/yr=389
  2026      T= 231 WR= 29% PF= 0.93 sumR=  -12.6 exp=-0.055 CI95=[-0.270, +0.172] maxDD=55.4R | H1 T=116 exp=+0.045 PF=1.06 · H2 T=115 exp=-0.155 PF=0.81 | top5=—% coins+=20/40 T/yr=345
  last90d   T=  74 WR= 18% PF= 0.50 sumR=  -33.5 exp=-0.453 CI95=[-0.773, -0.105] maxDD=37.3R | H1 T=38 exp=-0.333 PF=0.62 · H2 T=36 exp=-0.580 PF=0.40 | top5=—% coins+=8/29 T/yr=299
  Aug14→    T=  12 WR=  8% PF= 0.25 sumR=   -8.3 exp=-0.693 CI95=[-1.102, -0.013] maxDD=8.3R | H1 T=6 exp=-0.954 PF=0.00 · H2 T=6 exp=-0.432 PF=0.52 | top5=—% coins+=1/10 T/yr=231
  blocks: exposure=571 killSwitch=553 ddRolling7d=486 ddDaily=164 cooldown=134 groupCap=58 maxOpen=38

## DIAG D2 LS LONG-only AND BTC daily NOT UP
  candidates in: 2839 · balDD=26.4% · final $956
  FULL      T= 376 WR= 31% PF= 1.01 sumR=   +2.9 exp=+0.008 CI95=[-0.163, +0.184] maxDD=33.7R | H1 T=142 exp=-0.005 PF=0.99 · H2 T=234 exp=+0.015 PF=1.02 | top5=716% coins+=18/40 T/yr=167
  H1        T= 142 WR= 30% PF= 0.99 sumR=   -0.7 exp=-0.005 CI95=[-0.277, +0.283] maxDD=28.7R | H1 T=66 exp=+0.086 PF=1.12 · H2 T=76 exp=-0.084 PF=0.89 | top5=—% coins+=21/37 T/yr=126
  H2        T= 234 WR= 31% PF= 1.02 sumR=   +3.6 exp=+0.015 CI95=[-0.197, +0.239] maxDD=33.7R | H1 T=117 exp=+0.075 PF=1.10 · H2 T=117 exp=-0.044 PF=0.94 | top5=573% coins+=17/40 T/yr=207
  PRE-8000  T= 183 WR= 34% PF= 1.18 sumR=  +23.7 exp=+0.130 CI95=[-0.120, +0.376] maxDD=28.7R | H1 T=69 exp=+0.152 PF=1.21 · H2 T=114 exp=+0.116 PF=1.16 | top5=71% coins+=23/38 T/yr=136
  2026      T= 133 WR= 28% PF= 0.92 sumR=   -8.7 exp=-0.066 CI95=[-0.349, +0.230] maxDD=33.7R | H1 T=66 exp=+0.378 PF=1.57 · H2 T=67 exp=-0.502 PF=0.46 | top5=—% coins+=14/36 T/yr=199
  last90d   T=  58 WR= 19% PF= 0.55 sumR=  -24.0 exp=-0.414 CI95=[-0.773, -0.004] maxDD=27.8R | H1 T=38 exp=-0.333 PF=0.62 · H2 T=20 exp=-0.568 PF=0.43 | top5=—% coins+=8/26 T/yr=234
  Aug14→    T=   0 WR=  0% PF=    — sumR=   +0.0 exp=+0.000 CI95=[—, —] maxDD=0.0R | H1 T=0 exp=+0.000 PF=— · H2 T=0 exp=+0.000 PF=— | top5=—% coins+=0/0 T/yr=0
  blocks: btcDailyRegime=1714 killSwitch=302 exposure=258 ddRolling7d=60 cooldown=43 maxOpen=31 groupCap=28 ddDaily=27

## DIAG D3 LS SHORT-only AND BTC daily DOWN (complement of A3)
  candidates in: 5069 · balDD=58.6% · final $444
  FULL      T= 576 WR= 27% PF= 0.80 sumR=  -90.6 exp=-0.157 CI95=[-0.286, -0.025] maxDD=101.1R | H1 T=210 exp=-0.314 PF=0.63 · H2 T=366 exp=-0.067 PF=0.91 | top5=—% coins+=15/40 T/yr=255
  H1        T= 210 WR= 22% PF= 0.63 sumR=  -66.0 exp=-0.314 CI95=[-0.511, -0.110] maxDD=76.5R | H1 T=109 exp=-0.237 PF=0.72 · H2 T=101 exp=-0.398 PF=0.55 | top5=—% coins+=11/39 T/yr=186
  H2        T= 366 WR= 30% PF= 0.91 sumR=  -24.6 exp=-0.067 CI95=[-0.233, +0.102] maxDD=52.3R | H1 T=179 exp=+0.054 PF=1.07 · H2 T=187 exp=-0.184 PF=0.77 | top5=—% coins+=18/40 T/yr=324
  PRE-8000  T= 248 WR= 22% PF= 0.62 sumR=  -81.5 exp=-0.329 CI95=[-0.502, -0.135] maxDD=92.0R | H1 T=118 exp=-0.208 PF=0.75 · H2 T=130 exp=-0.438 PF=0.50 | top5=—% coins+=11/39 T/yr=185
  2026      T= 214 WR= 30% PF= 0.95 sumR=   -9.0 exp=-0.042 CI95=[-0.266, +0.196] maxDD=52.3R | H1 T=126 exp=+0.100 PF=1.14 · H2 T=88 exp=-0.246 PF=0.70 | top5=—% coins+=18/40 T/yr=320
  last90d   T=  75 WR= 24% PF= 0.61 sumR=  -25.0 exp=-0.334 CI95=[-0.649, +0.008] maxDD=25.0R | H1 T=64 exp=-0.291 PF=0.65 · H2 T=11 exp=-0.584 PF=0.40 | top5=—% coins+=9/33 T/yr=303
  Aug14→    T=   5 WR= 20% PF= 0.53 sumR=   -2.2 exp=-0.449 CI95=[-1.236, +1.032] maxDD=3.4R | H1 T=5 exp=-0.449 PF=0.53 · H2 T=0 exp=+0.000 PF=— | top5=—% coins+=1/5 T/yr=96
  blocks: btcDailyRegime=2622 killSwitch=754 exposure=487 ddRolling7d=372 cooldown=88 maxOpen=61 groupCap=57 ddDaily=52

## DIAG D4 = A0 with guards off (to pair with A6)
  candidates in: 7908 · balDD=94.1% · final $183
  FULL      T=3159 WR= 30% PF= 0.97 sumR=  -81.2 exp=-0.026 CI95=[-0.084, +0.034] maxDD=234.8R | H1 T=1613 exp=-0.085 PF=0.89 · H2 T=1546 exp=+0.036 PF=1.05 | top5=—% coins+=21/40 T/yr=1400
  H1        T=1613 WR= 28% PF= 0.89 sumR= -137.1 exp=-0.085 CI95=[-0.164, -0.005] maxDD=184.1R | H1 T=853 exp=+0.002 PF=1.00 · H2 T=760 exp=-0.183 PF=0.78 | top5=—% coins+=20/40 T/yr=1430
  H2        T=1546 WR= 32% PF= 1.05 sumR=  +55.9 exp=+0.036 CI95=[-0.048, +0.125] maxDD=64.1R | H1 T=767 exp=+0.121 PF=1.17 · H2 T=779 exp=-0.047 PF=0.94 | top5=46% coins+=22/40 T/yr=1370
  PRE-8000  T=1924 WR= 28% PF= 0.89 sumR= -172.8 exp=-0.090 CI95=[-0.163, -0.015] maxDD=234.8R | H1 T=970 exp=-0.000 PF=1.00 · H2 T=954 exp=-0.181 PF=0.78 | top5=—% coins+=18/40 T/yr=1432
  2026      T= 911 WR= 33% PF= 1.05 sumR=  +33.6 exp=+0.037 CI95=[-0.073, +0.147] maxDD=64.1R | H1 T=444 exp=+0.032 PF=1.04 · H2 T=467 exp=+0.042 PF=1.06 | top5=61% coins+=22/40 T/yr=1361
  last90d   T= 350 WR= 29% PF= 0.84 sumR=  -45.3 exp=-0.129 CI95=[-0.301, +0.041] maxDD=63.0R | H1 T=174 exp=-0.170 PF=0.79 · H2 T=176 exp=-0.089 PF=0.89 | top5=—% coins+=16/40 T/yr=1414
  Aug14→    T=  68 WR= 29% PF= 0.70 sumR=  -15.9 exp=-0.234 CI95=[-0.560, +0.115] maxDD=33.8R | H1 T=24 exp=-0.432 PF=0.49 · H2 T=44 exp=-0.126 PF=0.83 | top5=—% coins+=14/36 T/yr=1307
  blocks: exposure=2883 maxOpen=782 cooldown=643 groupCap=439 margin=2

## DIAG D5 = A1 with guards off
  candidates in: 5069 · balDD=88.0% · final $725
  FULL      T=2352 WR= 31% PF= 1.04 sumR=  +63.9 exp=+0.027 CI95=[-0.044, +0.098] maxDD=176.2R | H1 T=1174 exp=-0.005 PF=0.99 · H2 T=1178 exp=+0.059 PF=1.08 | top5=47% coins+=24/40 T/yr=1042
  H1        T=1174 WR= 29% PF= 0.99 sumR=   -6.1 exp=-0.005 CI95=[-0.102, +0.095] maxDD=97.8R | H1 T=591 exp=+0.088 PF=1.12 · H2 T=583 exp=-0.100 PF=0.87 | top5=—% coins+=22/40 T/yr=1041
  H2        T=1178 WR= 33% PF= 1.08 sumR=  +70.0 exp=+0.059 CI95=[-0.044, +0.160] maxDD=114.4R | H1 T=569 exp=+0.174 PF=1.24 · H2 T=609 exp=-0.048 PF=0.94 | top5=38% coins+=26/40 T/yr=1044
  PRE-8000  T=1398 WR= 29% PF= 0.95 sumR=  -57.6 exp=-0.041 CI95=[-0.131, +0.047] maxDD=176.2R | H1 T=682 exp=+0.113 PF=1.15 · H2 T=716 exp=-0.188 PF=0.77 | top5=—% coins+=20/40 T/yr=1040
  2026      T= 704 WR= 33% PF= 1.05 sumR=  +26.5 exp=+0.038 CI95=[-0.088, +0.169] maxDD=114.4R | H1 T=332 exp=-0.047 PF=0.94 · H2 T=372 exp=+0.113 PF=1.16 | top5=77% coins+=19/40 T/yr=1052
  last90d   T= 279 WR= 32% PF= 0.94 sumR=  -12.2 exp=-0.044 CI95=[-0.230, +0.150] maxDD=44.9R | H1 T=137 exp=-0.149 PF=0.81 · H2 T=142 exp=+0.058 PF=1.08 | top5=—% coins+=17/40 T/yr=1127
  Aug14→    T=  54 WR= 33% PF= 0.76 sumR=   -9.6 exp=-0.178 CI95=[-0.544, +0.214] maxDD=36.7R | H1 T=19 exp=-0.873 PF=0.15 · H2 T=35 exp=+0.200 PF=1.33 | top5=—% coins+=10/31 T/yr=1038
  blocks: exposure=1817 cooldown=349 maxOpen=349 groupCap=200 margin=2

# HYPOTHESIS TESTS (pre-registered rules)
H1 (A2 exp > 0 on FULL and in both halves): FULL exp +0.257 CI95 [+0.105, +0.419] · H1 +0.108 (T=323) · H2 +0.462 (T=236) · PRE-8000 +0.088 (T=376) → SUPPORTED
H2 (A1 SHORT-only better than both-directions; better = higher exp AND PF AND sumR): FULL yes (exp +0.012 vs -0.091, PF 1.02 vs 0.89, sumR +14.0 vs -134.5) · H1 yes · H2 no → PARTIALLY (FULL only)
H3 (A4 LONG blocked when BTC up better than both-directions; better = higher exp AND PF AND sumR): FULL yes (exp -0.007 vs -0.091, PF 0.99 vs 0.89, sumR -9.5 vs -134.5) · H1 yes · H2 yes → SUPPORTED

# VERDICTS (acceptance criteria applied literally to A1–A4 on FULL; slip15 from the matching +15 bps arm)
A1: REJECT — ACCEPT fails: exp +0.012 ≥ +0.25; PF 1.02 ≥ 1.30; CI95 lower -0.085 > 0; both halves exp ≥ +0.10 (H1 +0.048, H2 -0.023); top-5 share 183% ≤ 30%; coins positive 21/40 ≥ 55%; exp @+15bps -0.047 ≥ +0.10 | PAPER fails: exp +0.012 ≥ +0.15; PF 1.02 ≥ 1.15; CI95 lower -0.085 > −0.05; both halves positive (H1 +0.048, H2 -0.023)
A2: ACCEPT-LIVE-CANDIDATE — all ACCEPT criteria met
A3: REJECT — ACCEPT fails: exp +0.119 ≥ +0.25; PF 1.16 ≥ 1.30; CI95 lower -0.013 > 0; both halves exp ≥ +0.10 (H1 +0.100, H2 +0.143); top-5 share 30% ≤ 30%; exp @+15bps +0.023 ≥ +0.10 | PAPER fails: exp +0.119 ≥ +0.15
A4: REJECT — ACCEPT fails: exp -0.007 ≥ +0.25; PF 0.99 ≥ 1.30; CI95 lower -0.101 > 0; both halves exp ≥ +0.10 (H1 -0.014, H2 -0.002); top-5 share —% ≤ 30%; coins positive 18/40 ≥ 55%; exp @+15bps -0.092 ≥ +0.10 | PAPER fails: exp -0.007 ≥ +0.15; PF 0.99 ≥ 1.15; CI95 lower -0.101 > −0.05; both halves positive (H1 -0.014, H2 -0.002)

# A0 — direction × BTC daily regime (portfolio trades; the 8000-candle table in the brief was LONG·up −0.46R, SHORT·up +0.61R)
  [FULL    ] LONG  BTC up      T= 280 WR=22% PF=0.62 sumR=-90.4 exp=-0.323 CI95=[-0.487, -0.150]
  [FULL    ] LONG  BTC neutral T=  58 WR=26% PF=0.77 sumR=-10.7 exp=-0.184 CI95=[-0.563, +0.243]
  [FULL    ] LONG  BTC down    T= 131 WR=31% PF=1.00 sumR=-0.2 exp=-0.001 CI95=[-0.280, +0.288]
  [FULL    ] SHORT BTC up      T= 395 WR=35% PF=1.26 sumR=+74.5 exp=+0.189 CI95=[+0.005, +0.375]
  [FULL    ] SHORT BTC neutral T= 119 WR=31% PF=0.98 sumR=-1.6 exp=-0.014 CI95=[-0.309, +0.293]
  [FULL    ] SHORT BTC down    T= 503 WR=25% PF=0.74 sumR=-106.1 exp=-0.211 CI95=[-0.346, -0.078]
  [H1      ] LONG  BTC up      T= 161 WR=20% PF=0.56 sumR=-62.2 exp=-0.386 CI95=[-0.606, -0.162]
  [H1      ] LONG  BTC neutral T=   6 WR=50% PF=2.37 sumR=+4.7 exp=+0.777 CI95=[-0.619, +2.346]
  [H1      ] LONG  BTC down    T=  37 WR=30% PF=0.93 sumR=-2.0 exp=-0.055 CI95=[-0.553, +0.503]
  [H1      ] SHORT BTC up      T= 221 WR=27% PF=0.91 sumR=-16.1 exp=-0.073 CI95=[-0.305, +0.170]
  [H1      ] SHORT BTC neutral T=  44 WR=50% PF=2.26 sumR=+31.4 exp=+0.713 CI95=[+0.164, +1.255]
  [H1      ] SHORT BTC down    T= 185 WR=19% PF=0.52 sumR=-77.9 exp=-0.421 CI95=[-0.624, -0.200]
  [H2      ] LONG  BTC up      T= 119 WR=25% PF=0.71 sumR=-28.2 exp=-0.237 CI95=[-0.503, +0.038]
  [H2      ] LONG  BTC neutral T=  52 WR=23% PF=0.65 sumR=-15.3 exp=-0.295 CI95=[-0.672, +0.139]
  [H2      ] LONG  BTC down    T=  94 WR=31% PF=1.03 sumR=+1.9 exp=+0.020 CI95=[-0.316, +0.372]
  [H2      ] SHORT BTC up      T= 174 WR=45% PF=1.85 sumR=+90.6 exp=+0.521 CI95=[+0.208, +0.831]
  [H2      ] SHORT BTC neutral T=  75 WR=20% PF=0.51 sumR=-33.0 exp=-0.440 CI95=[-0.747, -0.117]
  [H2      ] SHORT BTC down    T= 318 WR=29% PF=0.89 sumR=-28.3 exp=-0.089 CI95=[-0.264, +0.092]
  [PRE-8000] LONG  BTC up      T= 194 WR=24% PF=0.69 sumR=-50.8 exp=-0.262 CI95=[-0.472, -0.055]
  [PRE-8000] LONG  BTC neutral T=  17 WR=41% PF=1.67 sumR=+7.4 exp=+0.435 CI95=[-0.453, +1.325]
  [PRE-8000] LONG  BTC down    T=  46 WR=30% PF=0.94 sumR=-2.2 exp=-0.048 CI95=[-0.498, +0.460]
  [PRE-8000] SHORT BTC up      T= 259 WR=26% PF=0.87 sumR=-26.6 exp=-0.103 CI95=[-0.307, +0.113]
  [PRE-8000] SHORT BTC neutral T=  70 WR=40% PF=1.46 sumR=+21.8 exp=+0.311 CI95=[-0.100, +0.740]
  [PRE-8000] SHORT BTC down    T= 226 WR=20% PF=0.54 sumR=-91.6 exp=-0.406 CI95=[-0.584, -0.210]
  [2026    ] LONG  BTC up      T=  69 WR=19% PF=0.48 sumR=-32.5 exp=-0.471 CI95=[-0.781, -0.124]
  [2026    ] LONG  BTC neutral T=  32 WR=25% PF=0.68 sumR=-8.5 exp=-0.267 CI95=[-0.736, +0.272]
  [2026    ] LONG  BTC down    T=  67 WR=30% PF=1.01 sumR=+0.3 exp=+0.005 CI95=[-0.378, +0.419]
  [2026    ] SHORT BTC up      T= 114 WR=50% PF=2.01 sumR=+65.1 exp=+0.571 CI95=[+0.243, +0.908]
  [2026    ] SHORT BTC neutral T=  44 WR=18% PF=0.46 sumR=-22.0 exp=-0.499 CI95=[-0.889, -0.071]
  [2026    ] SHORT BTC down    T= 184 WR=31% PF=0.99 sumR=-1.0 exp=-0.005 CI95=[-0.250, +0.241]

# A2 — per-coin sumR/T (29/40 positive)
  ENA +17.4/15  AAVE +15.7/14  SUI +14.8/14  ARB +11.8/14  GALA +11.6/16  ETC +10.8/23  SEI +10.7/20  ICP +9.8/14  DOT +9.5/14  LTC +9.3/14  ATOM +7.8/15  RENDER +6.4/14  SAND +5.5/13  SOL +5.0/18  IMX +4.6/9  ETH +4.2/19  NEAR +4.1/16  PEPE +3.1/10  AVAX +3.1/10  TIA +2.5/12  RUNE +2.4/14  HBAR +2.0/19  FIL +1.6/16  FET +1.5/5  GRT +1.2/7  APT +1.2/9  XRP +1.0/19  BNB +0.9/14  BCH +0.1/22  LINK -0.6/4  ADA -0.7/14  ONDO -1.2/8  VET -1.6/13  DOGE -3.3/12  INJ -3.3/13  CRV -3.4/20  BTC -3.7/22  POL -4.3/8  WLD -5.8/9  UNI -8.0/17
  monthly: 2024-05:-6.8R/6  2024-06:+12.3R/15  2024-07:-1.7R/22  2024-08:+19.7R/8  2024-09:-4.8R/8  2024-10:+20.2R/49  2024-11:-11.5R/48  2024-12:+30.6R/31  2025-01:+16.5R/44  2025-04:-7.5R/7  2025-05:-7.3R/35  2025-06:-12.9R/39  2025-07:-16.5R/21  2025-08:-0.6R/19  2025-09:-5.5R/12  2025-10:+48.3R/32  2026-01:+17.8R/31  2026-03:+8.1R/4  2026-04:-12.3R/36  2026-05:+45.3R/45  2026-07:+12.8R/18  2026-08:-0.4R/29
  exits: loss=354 (avg -1.11R)  tp2=140 (avg 2.79R)  trailing=52 (avg 2.51R)  timeout=12 (avg 1.11R)  tp1=1 (avg 2.09R)
  top-5 trades: ATOM 2025-10-10 +8.97R  ICP 2025-10-10 +6.44R  SUI 2024-12-09 +5.51R  RENDER 2024-12-08 +5.32R  RUNE 2024-08-25 +4.80R

# POST-HOC DIAGNOSTICS — labelled post-hoc; NOT used for any verdict
BTC WEEKLY tag = lib.weeklyTrendAt on closed weekly candles (EMA20, ±2%). Sweep-bar pool = liquiditySweepSignal({requireConfirmation:false}), barsAfter=0, floor 68 — the LS family without the confirmation rule.

## POST-HOC W1: SHORT-only AND BTC WEEKLY up
  candidates in: 5069 · balDD=56.5% · final $1696
  FULL      T= 560 WR= 33% PF= 1.17 sumR=  +69.0 exp=+0.123 CI95=[-0.027, +0.279] maxDD=64.3R | H1 T=413 exp=+0.188 PF=1.26 · H2 T=147 exp=-0.059 PF=0.93 | top5=43% coins+=25/40 T/yr=248
  H1        T= 413 WR= 34% PF= 1.26 sumR=  +77.7 exp=+0.188 CI95=[+0.012, +0.366] maxDD=31.8R | H1 T=200 exp=+0.430 PF=1.66 · H2 T=213 exp=-0.039 PF=0.95 | top5=33% coins+=25/40 T/yr=366
  H2        T= 147 WR= 28% PF= 0.93 sumR=   -8.7 exp=-0.059 CI95=[-0.335, +0.235] maxDD=40.6R | H1 T=124 exp=-0.064 PF=0.92 · H2 T=23 exp=-0.033 PF=0.96 | top5=—% coins+=19/39 T/yr=130
  PRE-8000  T= 493 WR= 33% PF= 1.17 sumR=  +63.0 exp=+0.128 CI95=[-0.029, +0.290] maxDD=64.3R | H1 T=256 exp=+0.393 PF=1.59 · H2 T=237 exp=-0.159 PF=0.80 | top5=40% coins+=22/40 T/yr=367
  2026      T=  23 WR= 30% PF= 0.96 sumR=   -0.8 exp=-0.033 CI95=[-0.668, +0.619] maxDD=13.2R | H1 T=0 exp=+0.000 PF=— · H2 T=23 exp=-0.033 PF=0.96 | top5=—% coins+=7/20 T/yr=34
  last90d   T=   4 WR=  0% PF= 0.00 sumR=   -4.5 exp=-1.118 CI95=[-1.154, -1.081] maxDD=4.5R | H1 T=0 exp=+0.000 PF=— · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/4 T/yr=16
  Aug14→    T=   4 WR=  0% PF= 0.00 sumR=   -4.5 exp=-1.118 CI95=[-1.154, -1.081] maxDD=4.5R | H1 T=0 exp=+0.000 PF=— · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/4 T/yr=77
  blocks: btcWeeklyRegime=3037 exposure=403 killSwitch=393 ddRolling7d=389 ddDaily=136 cooldown=82 groupCap=46 maxOpen=23

## POST-HOC W2: SHORT-only AND BTC WEEKLY not down
  candidates in: 5069 · balDD=67.0% · final $1668
  FULL      T= 692 WR= 33% PF= 1.15 sumR=  +78.5 exp=+0.113 CI95=[-0.020, +0.250] maxDD=97.0R | H1 T=495 exp=+0.175 PF=1.24 · H2 T=197 exp=-0.042 PF=0.95 | top5=32% coins+=24/40 T/yr=307
  H1        T= 495 WR= 34% PF= 1.24 sumR=  +86.7 exp=+0.175 CI95=[+0.020, +0.331] maxDD=32.1R | H1 T=282 exp=+0.337 PF=1.50 · H2 T=213 exp=-0.039 PF=0.95 | top5=29% coins+=26/40 T/yr=439
  H2        T= 197 WR= 29% PF= 0.95 sumR=   -8.2 exp=-0.042 CI95=[-0.269, +0.199] maxDD=73.3R | H1 T=117 exp=-0.486 PF=0.47 · H2 T=80 exp=+0.608 PF=2.02 | top5=—% coins+=21/40 T/yr=175
  PRE-8000  T= 563 WR= 32% PF= 1.11 sumR=  +45.1 exp=+0.080 CI95=[-0.065, +0.225] maxDD=69.7R | H1 T=338 exp=+0.324 PF=1.48 · H2 T=225 exp=-0.287 PF=0.66 | top5=56% coins+=22/40 T/yr=419
  2026      T=  80 WR= 48% PF= 2.02 sumR=  +48.7 exp=+0.608 CI95=[+0.207, +1.003] maxDD=12.0R | H1 T=6 exp=-1.229 PF=0.00 · H2 T=74 exp=+0.758 PF=2.39 | top5=33% coins+=24/36 T/yr=120
  last90d   T=   4 WR=  0% PF= 0.00 sumR=   -4.5 exp=-1.118 CI95=[-1.154, -1.081] maxDD=4.5R | H1 T=0 exp=+0.000 PF=— · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/4 T/yr=16
  Aug14→    T=   4 WR=  0% PF= 0.00 sumR=   -4.5 exp=-1.118 CI95=[-1.154, -1.081] maxDD=4.5R | H1 T=0 exp=+0.000 PF=— · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/4 T/yr=77
  blocks: btcWeeklyRegime=2480 killSwitch=634 exposure=504 ddRolling7d=442 ddDaily=137 cooldown=96 groupCap=49 maxOpen=35

## POST-HOC W3: SHORT-only AND BTC daily up AND weekly up
  candidates in: 5069 · balDD=51.6% · final $1961
  FULL      T= 362 WR= 35% PF= 1.31 sumR=  +81.4 exp=+0.225 CI95=[+0.036, +0.420] maxDD=53.4R | H1 T=278 exp=+0.150 PF=1.20 · H2 T=84 exp=+0.472 PF=1.72 | top5=38% coins+=26/40 T/yr=160
  H1        T= 278 WR= 33% PF= 1.20 sumR=  +41.7 exp=+0.150 CI95=[-0.061, +0.377] maxDD=38.6R | H1 T=146 exp=+0.417 PF=1.62 · H2 T=132 exp=-0.145 PF=0.82 | top5=57% coins+=22/40 T/yr=246
  H2        T=  84 WR= 40% PF= 1.72 sumR=  +39.7 exp=+0.472 CI95=[+0.020, +0.923] maxDD=19.2R | H1 T=68 exp=+0.475 PF=1.71 · H2 T=16 exp=+0.459 PF=1.75 | top5=63% coins+=22/39 T/yr=74
  PRE-8000  T= 331 WR= 32% PF= 1.16 sumR=  +40.1 exp=+0.121 CI95=[-0.075, +0.320] maxDD=53.4R | H1 T=192 exp=+0.392 PF=1.58 · H2 T=139 exp=-0.253 PF=0.70 | top5=59% coins+=20/40 T/yr=246
  2026      T=  16 WR= 44% PF= 1.75 sumR=   +7.3 exp=+0.459 CI95=[-0.391, +1.349] maxDD=5.1R | H1 T=0 exp=+0.000 PF=— · H2 T=16 exp=+0.459 PF=1.75 | top5=170% coins+=7/15 T/yr=24
  last90d   T=   4 WR=  0% PF= 0.00 sumR=   -4.5 exp=-1.118 CI95=[-1.154, -1.081] maxDD=4.5R | H1 T=0 exp=+0.000 PF=— · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/4 T/yr=16
  Aug14→    T=   4 WR=  0% PF= 0.00 sumR=   -4.5 exp=-1.118 CI95=[-1.154, -1.081] maxDD=4.5R | H1 T=0 exp=+0.000 PF=— · H2 T=4 exp=-1.118 PF=0.00 | top5=—% coins+=0/4 T/yr=77
  blocks: btcDailyRegime=3002 btcWeeklyRegime=760 ddRolling7d=306 exposure=261 killSwitch=184 ddDaily=110 cooldown=54 groupCap=16 maxOpen=14

## POST-HOC W4: both dirs, LONG blocked when BTC WEEKLY up
  candidates in: 7908 · balDD=76.2% · final $443
  FULL      T=1314 WR= 29% PF= 0.94 sumR=  -64.7 exp=-0.049 CI95=[-0.140, +0.043] maxDD=127.1R | H1 T=594 exp=-0.030 PF=0.96 · H2 T=720 exp=-0.065 PF=0.92 | top5=—% coins+=16/40 T/yr=582
  H1        T= 594 WR= 29% PF= 0.96 sumR=  -17.5 exp=-0.030 CI95=[-0.166, +0.110] maxDD=70.0R | H1 T=328 exp=+0.085 PF=1.11 · H2 T=266 exp=-0.171 PF=0.79 | top5=—% coins+=19/40 T/yr=527
  H2        T= 720 WR= 30% PF= 0.92 sumR=  -47.1 exp=-0.065 CI95=[-0.188, +0.059] maxDD=66.1R | H1 T=316 exp=-0.052 PF=0.93 · H2 T=404 exp=-0.076 PF=0.90 | top5=—% coins+=19/40 T/yr=638
  PRE-8000  T= 662 WR= 27% PF= 0.89 sumR=  -59.2 exp=-0.089 CI95=[-0.218, +0.041] maxDD=107.0R | H1 T=384 exp=+0.111 PF=1.15 · H2 T=278 exp=-0.366 PF=0.58 | top5=—% coins+=13/40 T/yr=493
  2026      T= 505 WR= 32% PF= 1.02 sumR=   +7.3 exp=+0.014 CI95=[-0.127, +0.162] maxDD=54.1R | H1 T=281 exp=-0.022 PF=0.97 · H2 T=224 exp=+0.060 PF=1.08 | top5=281% coins+=21/40 T/yr=755
  last90d   T= 140 WR= 26% PF= 0.62 sumR=  -43.9 exp=-0.314 CI95=[-0.539, -0.084] maxDD=54.1R | H1 T=83 exp=-0.212 PF=0.74 · H2 T=57 exp=-0.461 PF=0.45 | top5=—% coins+=10/38 T/yr=566
  Aug14→    T=  32 WR= 38% PF= 0.90 sumR=   -2.2 exp=-0.068 CI95=[-0.535, +0.426] maxDD=11.4R | H1 T=23 exp=-0.248 PF=0.68 · H2 T=9 exp=+0.392 PF=2.10 | top5=—% coins+=9/23 T/yr=615
  blocks: killSwitch=1750 ddRolling7d=1644 exposure=1173 longBtcWeeklyUp=1124 ddDaily=362 cooldown=244 maxOpen=155 groupCap=142

research pool sweepBar68: 3274 candidates · LONG 1269 · SHORT 2005
## POST-HOC S0: sweep-bar pool (no confirmation rule) both directions
  candidates in: 3274 · balDD=90.3% · final $146
  FULL      T=1188 WR= 27% PF= 0.83 sumR= -162.6 exp=-0.137 CI95=[-0.232, -0.042] maxDD=221.0R | H1 T=555 exp=-0.233 PF=0.73 · H2 T=633 exp=-0.052 PF=0.93 | top5=—% coins+=14/40 T/yr=527
  H1        T= 555 WR= 23% PF= 0.73 sumR= -129.3 exp=-0.233 CI95=[-0.367, -0.095] maxDD=148.4R | H1 T=313 exp=-0.179 PF=0.79 · H2 T=242 exp=-0.304 PF=0.65 | top5=—% coins+=11/40 T/yr=492
  H2        T= 633 WR= 30% PF= 0.93 sumR=  -33.2 exp=-0.052 CI95=[-0.187, +0.081] maxDD=78.2R | H1 T=281 exp=-0.119 PF=0.85 · H2 T=352 exp=+0.001 PF=1.00 | top5=—% coins+=18/40 T/yr=561
  PRE-8000  T= 656 WR= 23% PF= 0.70 sumR= -167.6 exp=-0.255 CI95=[-0.381, -0.130] maxDD=181.0R | H1 T=363 exp=-0.140 PF=0.83 · H2 T=293 exp=-0.398 PF=0.56 | top5=—% coins+=10/40 T/yr=488
  2026      T= 439 WR= 33% PF= 1.13 sumR=  +43.4 exp=+0.099 CI95=[-0.067, +0.265] maxDD=21.9R | H1 T=232 exp=+0.161 PF=1.22 · H2 T=207 exp=+0.029 PF=1.04 | top5=57% coins+=21/40 T/yr=656
  last90d   T= 156 WR= 29% PF= 0.88 sumR=  -15.1 exp=-0.097 CI95=[-0.352, +0.169] maxDD=21.9R | H1 T=70 exp=-0.189 PF=0.77 · H2 T=86 exp=-0.022 PF=0.97 | top5=—% coins+=16/40 T/yr=630
  Aug14→    T=  27 WR= 15% PF= 0.40 sumR=  -15.5 exp=-0.573 CI95=[-1.008, -0.023] maxDD=21.6R | H1 T=12 exp=-0.549 PF=0.43 · H2 T=15 exp=-0.592 PF=0.38 | top5=—% coins+=3/22 T/yr=519
  blocks: killSwitch=847 ddRolling7d=759 ddDaily=165 exposure=129 cooldown=96 maxOpen=48 groupCap=42

## POST-HOC S1: sweep-bar pool SHORT-only
  candidates in: 2005 · balDD=62.6% · final $617
  FULL      T= 924 WR= 29% PF= 0.95 sumR=  -38.3 exp=-0.041 CI95=[-0.160, +0.077] maxDD=102.3R | H1 T=470 exp=-0.056 PF=0.93 · H2 T=454 exp=-0.027 PF=0.97 | top5=—% coins+=18/40 T/yr=410
  H1        T= 470 WR= 27% PF= 0.93 sumR=  -26.2 exp=-0.056 CI95=[-0.213, +0.109] maxDD=67.4R | H1 T=244 exp=+0.018 PF=1.02 · H2 T=226 exp=-0.136 PF=0.84 | top5=—% coins+=15/40 T/yr=417
  H2        T= 454 WR= 30% PF= 0.97 sumR=  -12.1 exp=-0.027 CI95=[-0.184, +0.134] maxDD=53.1R | H1 T=222 exp=+0.045 PF=1.06 · H2 T=232 exp=-0.095 PF=0.88 | top5=—% coins+=22/40 T/yr=402
  PRE-8000  T= 546 WR= 27% PF= 0.89 sumR=  -49.9 exp=-0.091 CI95=[-0.235, +0.056] maxDD=94.7R | H1 T=295 exp=+0.046 PF=1.06 · H2 T=251 exp=-0.253 PF=0.71 | top5=—% coins+=14/40 T/yr=406
  2026      T= 298 WR= 34% PF= 1.15 sumR=  +33.6 exp=+0.113 CI95=[-0.093, +0.324] maxDD=51.6R | H1 T=174 exp=+0.271 PF=1.38 · H2 T=124 exp=-0.109 PF=0.87 | top5=72% coins+=24/40 T/yr=445
  last90d   T=  93 WR= 25% PF= 0.64 sumR=  -29.2 exp=-0.314 CI95=[-0.597, -0.005] maxDD=46.9R | H1 T=47 exp=-0.249 PF=0.71 · H2 T=46 exp=-0.380 PF=0.57 | top5=—% coins+=11/36 T/yr=376
  Aug14→    T=  24 WR= 38% PF= 1.06 sumR=   +1.1 exp=+0.044 CI95=[-0.598, +0.731] maxDD=11.3R | H1 T=10 exp=-0.780 PF=0.25 · H2 T=14 exp=+0.633 PF=2.29 | top5=1232% coins+=7/18 T/yr=461
  blocks: killSwitch=484 ddRolling7d=357 ddDaily=85 cooldown=63 exposure=58 groupCap=24 maxOpen=10

## POST-HOC S2: sweep-bar pool SHORT-only AND BTC daily up
  candidates in: 2005 · balDD=51.4% · final $1881
  FULL      T= 410 WR= 34% PF= 1.23 sumR=  +70.3 exp=+0.171 CI95=[-0.009, +0.363] maxDD=53.8R | H1 T=250 exp=+0.212 PF=1.29 · H2 T=160 exp=+0.109 PF=1.14 | top5=41% coins+=25/40 T/yr=182
  H1        T= 250 WR= 34% PF= 1.29 sumR=  +52.9 exp=+0.212 CI95=[-0.017, +0.443] maxDD=21.4R | H1 T=139 exp=+0.196 PF=1.26 · H2 T=111 exp=+0.231 PF=1.32 | top5=46% coins+=21/40 T/yr=222
  H2        T= 160 WR= 33% PF= 1.14 sumR=  +17.4 exp=+0.109 CI95=[-0.165, +0.409] maxDD=39.3R | H1 T=87 exp=+0.114 PF=1.15 · H2 T=73 exp=+0.102 PF=1.14 | top5=137% coins+=23/40 T/yr=142
  PRE-8000  T= 303 WR= 31% PF= 1.14 sumR=  +31.9 exp=+0.105 CI95=[-0.098, +0.311] maxDD=46.9R | H1 T=179 exp=+0.350 PF=1.50 · H2 T=124 exp=-0.248 PF=0.71 | top5=76% coins+=18/40 T/yr=225
  2026      T=  95 WR= 41% PF= 1.56 sumR=  +36.4 exp=+0.383 CI95=[+0.009, +0.798] maxDD=22.5R | H1 T=43 exp=+0.258 PF=1.34 · H2 T=52 exp=+0.486 PF=1.79 | top5=62% coins+=25/39 T/yr=142
  last90d   T=  35 WR= 49% PF= 1.80 sumR=  +16.8 exp=+0.479 CI95=[-0.095, +1.076] maxDD=11.5R | H1 T=0 exp=+0.000 PF=— · H2 T=35 exp=+0.479 PF=1.80 | top5=86% coins+=13/25 T/yr=141
  Aug14→    T=  20 WR= 40% PF= 1.14 sumR=   +2.0 exp=+0.098 CI95=[-0.595, +0.854] maxDD=10.2R | H1 T=6 exp=-1.151 PF=0.00 · H2 T=14 exp=+0.633 PF=2.29 | top5=631% coins+=7/16 T/yr=384
  blocks: btcDailyRegime=1241 ddRolling7d=146 killSwitch=103 ddDaily=49 exposure=23 cooldown=22 groupCap=11

## POST-HOC S3: sweep-bar pool SHORT-only AND BTC daily not down
  candidates in: 2005 · balDD=42.9% · final $1374
  FULL      T= 520 WR= 32% PF= 1.12 sumR=  +47.4 exp=+0.091 CI95=[-0.067, +0.250] maxDD=46.7R | H1 T=297 exp=+0.112 PF=1.15 · H2 T=223 exp=+0.063 PF=1.08 | top5=59% coins+=21/40 T/yr=230
  H1        T= 297 WR= 32% PF= 1.15 sumR=  +33.4 exp=+0.112 CI95=[-0.098, +0.321] maxDD=39.6R | H1 T=153 exp=-0.004 PF=0.99 · H2 T=144 exp=+0.236 PF=1.33 | top5=70% coins+=23/40 T/yr=263
  H2        T= 223 WR= 33% PF= 1.08 sumR=  +14.1 exp=+0.063 CI95=[-0.169, +0.313] maxDD=36.5R | H1 T=111 exp=+0.282 PF=1.40 · H2 T=112 exp=-0.154 PF=0.82 | top5=165% coins+=20/40 T/yr=198
  PRE-8000  T= 357 WR= 31% PF= 1.10 sumR=  +26.2 exp=+0.074 CI95=[-0.108, +0.261] maxDD=46.7R | H1 T=203 exp=+0.047 PF=1.06 · H2 T=154 exp=+0.109 PF=1.15 | top5=89% coins+=21/40 T/yr=266
  2026      T= 142 WR= 33% PF= 1.12 sumR=  +13.0 exp=+0.091 CI95=[-0.216, +0.423] maxDD=29.4R | H1 T=57 exp=+0.200 PF=1.26 · H2 T=85 exp=+0.019 PF=1.02 | top5=178% coins+=23/38 T/yr=212
  last90d   T=  63 WR= 30% PF= 0.84 sumR=   -8.3 exp=-0.132 CI95=[-0.517, +0.278] maxDD=28.8R | H1 T=6 exp=+1.200 PF=4.10 · H2 T=57 exp=-0.272 PF=0.68 | top5=—% coins+=14/31 T/yr=254
  Aug14→    T=  20 WR= 40% PF= 1.14 sumR=   +2.0 exp=+0.098 CI95=[-0.595, +0.854] maxDD=10.2R | H1 T=6 exp=-1.151 PF=0.00 · H2 T=14 exp=+0.633 PF=2.29 | top5=631% coins+=7/16 T/yr=384
  blocks: btcDailyRegime=1030 ddRolling7d=225 killSwitch=127 ddDaily=40 exposure=26 cooldown=20 groupCap=17

## POST-HOC S4: sweep-bar pool both dirs, LONG blocked when BTC daily up
  candidates in: 3274 · balDD=74.2% · final $537
  FULL      T=1071 WR= 29% PF= 0.93 sumR=  -56.3 exp=-0.053 CI95=[-0.156, +0.052] maxDD=143.4R | H1 T=505 exp=-0.067 PF=0.92 · H2 T=566 exp=-0.040 PF=0.95 | top5=—% coins+=19/40 T/yr=475
  H1        T= 505 WR= 27% PF= 0.92 sumR=  -33.8 exp=-0.067 CI95=[-0.211, +0.088] maxDD=75.0R | H1 T=260 exp=-0.020 PF=0.97 · H2 T=245 exp=-0.116 PF=0.86 | top5=—% coins+=16/40 T/yr=448
  H2        T= 566 WR= 30% PF= 0.95 sumR=  -22.5 exp=-0.040 CI95=[-0.185, +0.104] maxDD=86.6R | H1 T=269 exp=-0.073 PF=0.91 · H2 T=297 exp=-0.010 PF=0.99 | top5=—% coins+=18/40 T/yr=502
  PRE-8000  T= 585 WR= 26% PF= 0.84 sumR=  -78.0 exp=-0.133 CI95=[-0.269, +0.009] maxDD=106.6R | H1 T=313 exp=+0.017 PF=1.02 · H2 T=272 exp=-0.306 PF=0.65 | top5=—% coins+=15/40 T/yr=435
  2026      T= 371 WR= 35% PF= 1.21 sumR=  +57.4 exp=+0.155 CI95=[-0.026, +0.341] maxDD=39.0R | H1 T=185 exp=+0.185 PF=1.25 · H2 T=186 exp=+0.124 PF=1.17 | top5=43% coins+=26/40 T/yr=554
  last90d   T= 148 WR= 34% PF= 1.07 sumR=   +7.5 exp=+0.051 CI95=[-0.227, +0.332] maxDD=17.7R | H1 T=70 exp=-0.189 PF=0.77 · H2 T=78 exp=+0.266 PF=1.38 | top5=233% coins+=20/38 T/yr=598
  Aug14→    T=  25 WR= 40% PF= 1.20 sumR=   +3.5 exp=+0.138 CI95=[-0.493, +0.825] maxDD=11.3R | H1 T=11 exp=-0.491 PF=0.48 · H2 T=14 exp=+0.633 PF=2.29 | top5=389% coins+=8/18 T/yr=481
  blocks: longBtcUp=820 killSwitch=577 ddRolling7d=476 ddDaily=108 exposure=92 cooldown=72 groupCap=31 maxOpen=27

BTC weekly regime coverage (days): up 377 · neutral 91 · down 357
A0 — direction × BTC WEEKLY (FULL):
  LONG  BTCw up      T= 225 WR=27% PF=0.82 sumR=-32.9 exp=-0.146
  LONG  BTCw neutral T=  46 WR=28% PF=0.86 sumR=-5.3 exp=-0.114
  LONG  BTCw down    T= 198 WR=22% PF=0.63 sumR=-63.1 exp=-0.319
  SHORT BTCw up      T= 491 WR=31% PF=1.07 sumR=+24.9 exp=+0.051
  SHORT BTCw neutral T= 121 WR=31% PF=1.03 sumR=+3.0 exp=+0.025
  SHORT BTCw down    T= 405 WR=28% PF=0.81 sumR=-61.2 exp=-0.151
A0 — SHORT × BTC daily × BTC weekly (FULL):
  SHORT BTCd up      BTCw up      T= 268 WR=31% PF=1.15 sumR=+29.6 exp=+0.110
  SHORT BTCd up      BTCw neutral T=  53 WR=42% PF=1.58 sumR=+20.5 exp=+0.387
  SHORT BTCd up      BTCw down    T=  74 WR=42% PF=1.51 sumR=+24.4 exp=+0.330
  SHORT BTCd neutral BTCw up      T=  70 WR=41% PF=1.56 sumR=+26.0 exp=+0.371
  SHORT BTCd neutral BTCw neutral T=   6 WR=17% PF=0.52 sumR=-2.6 exp=-0.440
  SHORT BTCd neutral BTCw down    T=  43 WR=16% PF=0.39 sumR=-25.0 exp=-0.581
  SHORT BTCd down    BTCw up      T= 153 WR=25% PF=0.75 sumR=-30.6 exp=-0.200
  SHORT BTCd down    BTCw neutral T=  62 WR=24% PF=0.72 sumR=-14.8 exp=-0.239
  SHORT BTCd down    BTCw down    T= 288 WR=26% PF=0.74 sumR=-60.7 exp=-0.211

[trade dump: script/.cache/phase9-regime-trades-20000.json]
# INTERPRETATION (written after the run; verdicts above are the literal pre-registered rule)

## Parity
The PARITY arm reproduces `phase8-report-core-20000.md` "FLOOR 68 LS only" exactly (T=1494 · WR 28% · PF 0.90 · sumR −117.6 · exp −0.079; identical block counts), so the simulate() fork is faithful. Note that phase8's 20000-candle runs used a BTC 1d×600 series (first close 2025-01-10): `dailyTrendAt` returns "neutral" while it has fewer than 52 closed candles, so every decision before 2025-03-03 carried a "neutral" BTC tag (341 "neutral" days vs 89 with the full series). All phase-9 arms use 1d×1500, under which the regime split is up 43% / neutral 11% / down 46%.

## Literal verdicts
- **A2 (SHORT-only AND BTC daily UP) = ACCEPT-LIVE-CANDIDATE** — every pre-registered criterion is met on FULL: exp +0.257 · PF 1.37 · CI95 [+0.105, +0.419] · 248 trades/yr · H1 +0.108 / H2 +0.462 · top-5 22% · 29/40 coins positive · +0.161R at +15 bps slippage (+0.096R at +30 bps).
- A1, A3, A4 = REJECT. A3 (SHORT & BTC not down) is the nearest miss: exp +0.119, PF 1.16, CI lower −0.013, both halves positive, but fails exp ≥ 0.15 for PAPER and collapses to +0.023 under +15 bps slippage. A1 (SHORT-only) is a coin-flip (+0.012). A4 (LONG blocked when BTC up) only removes the worst book (LONG·BTC-up −0.323R) and lands at −0.007.
- H1 SUPPORTED (as defined). H2 PARTIALLY (SHORT-only beats both-directions on FULL and H1 but not H2). H3 SUPPORTED (A4 beats A0 on exp, PF and sumR in FULL and both halves — but A4 is still a losing book).

## Why the A2 verdict must be read as fragile
1. **Margins.** exp +0.257 clears the +0.25 bar by 0.007R; the first-half exp +0.108 clears the +0.10 bar by 0.008R. A handful of trades either way flips the verdict. The top-5 trades are 22% of sumR, so it is not concentration — it is a thin average.
2. **Hypothesis-formation overlap.** The SHORT·BTC-up pattern was first seen in the 8000-candle window (from 2025-10-04). On the clean out-of-sample slice **PRE-8000 (2024-05 → 2025-10, T=376)** A2 shows exp +0.088 · PF 1.12 · CI95 [−0.094, +0.276], and its own halves are +0.323 (T=231) then **−0.286 (T=145)**. Applied to PRE-8000 alone the same rules give REJECT (fails exp ≥ 0.15 for PAPER). The FULL-window pass is carried by the in-sample part: 2026 exp +0.437 (T=163, CI lower +0.166) and the 2025-10 burst (+48.3R in one month, 32 trades).
3. **Drought.** Monthly A2 sumR is negative for six consecutive months Apr–Sep 2025 (−7.5, −7.3, −12.9, −16.5, −0.6, −5.5 = −50.3R over ≈133 trades) and zero trades whenever BTC is not up (2025-02/03, 2025-11/12, 2026-02, 2026-06). At live size that is a 6-month, ~50R drawdown with no signal that the regime filter is "working". maxDD on FULL is 59.8R.
4. **Guard interaction.** A6 (A2 with daily/rolling/kill-switch guards off) is exp +0.130 · PF 1.18 · T=1027 · CI95 [+0.021, +0.241]. The guards are causal (closed trades only) so this is legitimate, but it means the raw signal set "LS SHORT when BTC daily up" carries ≈ +0.13R, and roughly half of A2's +0.257 comes from the guards skipping trades during losing clusters. The D4/D5 pairs show the guards do the same for A0/A1 (guards-off books are larger but not better).
5. **Direction × regime table is not stable.** In A0, SHORT·BTC-up is −0.073R in H1 (T=221) and +0.521R in H2 (T=174); SHORT·BTC-neutral flips from +0.713 (H1) to −0.440 (H2). The regime that "works" changes with the half. LONG·BTC-up is the only cell negative in every window (FULL −0.323, H1 −0.386, H2 −0.237, PRE-8000 −0.262, 2026 −0.471) — that is the robust finding, and it is a *removal*, not an edge.
6. **Untested execution assumptions.** Binance spot candles; phase 8 showed only 11/28 paper LS signals reproduce on Binance data (MEXC wicks differ). The regime tag itself is robust to venue (BTC daily EMA50 ±1%), but the LS signal stream is not.

## Post-hoc (not used for verdicts)
- BTC WEEKLY tag: W1 (SHORT & weekly up) exp +0.123, W3 (daily up AND weekly up) +0.225 · T=362 · CI lower +0.036, but W3's PRE-8000 halves are +0.392 / −0.253 — the same shape as A2. Weekly adds nothing the daily does not already give; the daily-up × weekly-neutral/down cells (+0.387 / +0.330 on T=53/74) are too small to mean anything.
- Sweep-bar pool (no confirmation rule): S2 (SHORT & BTC daily up) exp +0.171 · PF 1.23 · T=410 · CI lower −0.009 — same direction as A2, weaker. Every both-directions sweep-bar arm is negative on FULL. The regime effect is therefore a property of LS shorts, not of the confirmation rule.

## Recommendation to the lead
The pre-registered rule says ACCEPT-LIVE-CANDIDATE for A2 and that verdict is recorded as such. The evidence behind it is one in-sample year plus a marginal, non-monotone out-of-sample year; on the clean OOS slice alone the same rules reject it. Under the standing gate (memory: "honest paper ≥ +0.3R over ≥120 trades before any live") the defensible action is: implement `onlyDirection: SHORT` + `requireBtcDaily: up` for LS as a PAPER configuration, keep live OFF, and re-run this script when ≥120 honest paper trades exist. Blocking LS LONGs when BTC daily is up (A4) is safe to adopt anywhere LS runs — it removes a book that is negative in every window — but it does not by itself make LS positive.

Files: `script/audit/phase9-regime.ts` (script) · `script/.cache/phase9-regime-trades-20000.json` (per-trade dump, all arms) · `script/.cache/phase9-regime-summary.json` (per-window stats, all arms).
