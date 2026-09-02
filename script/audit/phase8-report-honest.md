# Phase 8 — collapse diagnosis — 2026-09-01
candles 8000 · capital $500 · base risk 2% · suite honest
candidates (post minSL+RR): 5544
LS candidates by confidence: 60:565 65:1357 70:1143 75:764 80:772 85:236 | eqPool 1784/4857

## ENGINE floor60 (parity with official report)
  ALL     T=1394 WR= 44% PF= 1.84 sumR=+ 749.8 exp=+0.538 maxDD=47.8R  balDD=66.6%
  2026    T=1041 WR= 45% PF= 1.86 sumR=+ 571.1 exp=+0.549 maxDD=47.8R
  last90d T= 432 WR= 44% PF= 1.75 sumR=+ 208.1 exp=+0.482 maxDD=22.3R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## HONEST floor60 minRR1.5 (engine gate only)
  ALL     T= 806 WR= 35% PF= 1.03 sumR=+  18.1 exp=+0.022 maxDD=66.7R  balDD=75.7%
  2026    T= 567 WR= 35% PF= 0.97 sumR= -10.6 exp=-0.019 maxDD=66.7R
  last90d T= 207 WR= 31% PF= 0.78 sumR= -35.4 exp=-0.171 maxDD=44.4R
  Aug14→  T=  30 WR= 23% PF= 0.49 sumR= -13.3 exp=-0.442 maxDD=14.7R
  blocks: killSwitch=1582 exposure=999 ddRolling7d=869 unfilled=571 cooldown=243 ddDaily=198 maxOpen=102 weeklyTrend=88 groupCap=86

## HONEST floor60 minRR2.0 (strategy floor re-applied)
  ALL     T= 713 WR= 33% PF= 1.07 sumR=+  39.1 exp=+0.055 maxDD=55.1R  balDD=72.0%
  2026    T= 470 WR= 32% PF= 1.02 sumR=+   5.6 exp=+0.012 maxDD=40.8R
  last90d T= 213 WR= 33% PF= 1.07 sumR=+  11.5 exp=+0.054 maxDD=22.5R
  Aug14→  T=  31 WR= 23% PF= 0.40 sumR= -14.4 exp=-0.465 maxDD=15.6R
  blocks: unfilled=1192 ddRolling7d=1027 exposure=994 killSwitch=879 cooldown=244 ddDaily=214 maxOpen=101 weeklyTrend=98 groupCap=82

## HONEST floor68 minRR2.0
  ALL     T= 624 WR= 33% PF= 1.10 sumR=+  45.6 exp=+0.073 maxDD=27.0R  balDD=44.2%
  2026    T= 461 WR= 34% PF= 1.08 sumR=+  27.3 exp=+0.059 maxDD=27.0R
  last90d T= 173 WR= 30% PF= 0.92 sumR= -10.2 exp=-0.059 maxDD=19.7R
  Aug14→  T=  33 WR= 21% PF= 0.45 sumR= -14.7 exp=-0.446 maxDD=16.1R
  blocks: exposure=788 unfilled=777 killSwitch=677 ddRolling7d=278 cooldown=180 ddDaily=110 weeklyTrend=95 maxOpen=51 groupCap=42

## HONEST floor60 minRR2.0 +15bps venue slip
  ALL     T= 583 WR= 30% PF= 0.88 sumR= -53.5 exp=-0.092 maxDD=101.6R  balDD=88.7%
  2026    T= 362 WR= 27% PF= 0.71 sumR= -86.1 exp=-0.238 maxDD=92.4R
  last90d T= 135 WR= 23% PF= 0.54 sumR= -52.1 exp=-0.386 maxDD=53.1R
  Aug14→  T=  31 WR= 26% PF= 0.48 sumR= -12.0 exp=-0.389 maxDD=13.1R
  blocks: unfilled=1395 ddRolling7d=1137 killSwitch=957 exposure=885 cooldown=191 ddDaily=160 weeklyTrend=98 groupCap=69 maxOpen=69

## HONEST floor60 minRR2.0 +30bps venue slip
  ALL     T= 503 WR= 31% PF= 0.91 sumR= -35.3 exp=-0.070 maxDD=75.9R  balDD=79.5%
  2026    T= 339 WR= 29% PF= 0.81 sumR= -49.1 exp=-0.145 maxDD=75.9R
  last90d T= 131 WR= 26% PF= 0.65 sumR= -36.6 exp=-0.279 maxDD=37.4R
  Aug14→  T=  28 WR= 25% PF= 0.50 sumR=  -9.8 exp=-0.349 maxDD=13.1R
  blocks: unfilled=1847 killSwitch=1209 exposure=791 ddRolling7d=692 cooldown=177 ddDaily=123 weeklyTrend=98 groupCap=56 maxOpen=48

## HONEST floor60 minRR2.0 − RSI
  ALL     T= 664 WR= 32% PF= 1.03 sumR=+  14.2 exp=+0.021 maxDD=67.9R  balDD=77.4%
  2026    T= 442 WR= 31% PF= 0.97 sumR= -10.7 exp=-0.024 maxDD=48.0R
  last90d T= 200 WR= 33% PF= 1.08 sumR=+  11.4 exp=+0.057 maxDD=27.1R
  Aug14→  T=  30 WR= 20% PF= 0.35 sumR= -15.7 exp=-0.524 maxDD=15.7R
  blocks: unfilled=1185 ddRolling7d=1115 killSwitch=897 exposure=816 ddDaily=173 cooldown=158 weeklyTrend=96 maxOpen=72 groupCap=49

## HONEST floor60 minRR2.0 LS only
  ALL     T= 573 WR= 30% PF= 0.95 sumR= -23.3 exp=-0.041 maxDD=73.5R  balDD=80.6%
  2026    T= 423 WR= 30% PF= 0.96 sumR= -13.7 exp=-0.032 maxDD=51.4R
  last90d T= 203 WR= 33% PF= 1.11 sumR=+  16.2 exp=+0.080 maxDD=25.4R
  Aug14→  T=  27 WR= 22% PF= 0.47 sumR= -11.1 exp=-0.413 maxDD=12.7R
  blocks: ddRolling7d=1173 unfilled=1163 killSwitch=878 exposure=631 ddDaily=171 cooldown=153 maxOpen=66 groupCap=49

## HONEST floor60 minRR2.0 − RSI + block LONG BTC up
  ALL     T= 654 WR= 34% PF= 1.12 sumR=+  57.2 exp=+0.087 maxDD=48.6R  balDD=65.7%
  2026    T= 437 WR= 35% PF= 1.13 sumR=+  42.0 exp=+0.096 maxDD=48.6R
  last90d T= 194 WR= 36% PF= 1.18 sumR=+  24.7 exp=+0.127 maxDD=20.0R
  Aug14→  T=  26 WR= 35% PF= 0.73 sumR=  -4.9 exp=-0.189 maxDD=9.9R
  blocks: unfilled=1202 ddRolling7d=1052 killSwitch=859 exposure=771 ddDaily=183 cooldown=146 longBtcUp=140 weeklyTrend=93 maxOpen=78 groupCap=47

## HONEST floor68 minRR2.0 − RSI + block LONG BTC up
  ALL     T= 537 WR= 33% PF= 1.10 sumR=+  40.3 exp=+0.075 maxDD=30.6R  balDD=46.8%
  2026    T= 379 WR= 35% PF= 1.14 sumR=+  39.0 exp=+0.103 maxDD=29.6R
  last90d T= 144 WR= 30% PF= 0.95 sumR=  -6.1 exp=-0.043 maxDD=18.8R
  Aug14→  T=  20 WR= 15% PF= 0.30 sumR= -13.0 exp=-0.648 maxDD=13.0R
  blocks: unfilled=766 exposure=583 killSwitch=545 ddRolling7d=346 longBtcUp=174 weeklyTrend=95 cooldown=91 ddDaily=91 groupCap=38 maxOpen=37

## HONEST floor60 minRR2.0 EQ pool only
  ALL     T= 503 WR= 36% PF= 1.27 sumR=+  95.7 exp=+0.190 maxDD=21.9R  balDD=40.7%
  2026    T= 332 WR= 36% PF= 1.19 sumR=+  45.5 exp=+0.137 maxDD=20.4R
  last90d T= 135 WR= 31% PF= 0.94 sumR=  -6.4 exp=-0.047 maxDD=20.0R
  Aug14→  T=  26 WR= 15% PF= 0.38 sumR= -15.4 exp=-0.593 maxDD=15.6R
  blocks: exposure=661 unfilled=489 ddRolling7d=266 killSwitch=255 cooldown=139 weeklyTrend=91 groupCap=30 maxOpen=20 ddDaily=17

## HONEST floor60 minRR2.0 wick≥1.5
  ALL     T= 559 WR= 33% PF= 1.09 sumR=+  35.8 exp=+0.064 maxDD=42.0R  balDD=58.9%
  2026    T= 400 WR= 34% PF= 1.10 sumR=+  28.5 exp=+0.071 maxDD=40.9R
  last90d T= 140 WR= 26% PF= 0.77 sumR= -27.1 exp=-0.193 maxDD=27.1R
  Aug14→  T=  33 WR= 18% PF= 0.49 sumR= -15.5 exp=-0.471 maxDD=18.2R
  blocks: unfilled=699 exposure=693 killSwitch=519 ddRolling7d=413 cooldown=160 weeklyTrend=92 ddDaily=64 maxOpen=55 groupCap=30

## HONEST floor60 minRR2.0 guards off
  ALL     T=1196 WR= 32% PF= 1.03 sumR=+  31.5 exp=+0.026 maxDD=95.3R  balDD=90.0%
  2026    T= 834 WR= 31% PF= 0.96 sumR= -26.1 exp=-0.031 maxDD=95.3R
  last90d T= 324 WR= 29% PF= 0.88 sumR= -32.0 exp=-0.099 maxDD=40.7R
  Aug14→  T=  68 WR= 22% PF= 0.46 sumR= -30.7 exp=-0.452 maxDD=34.9R
  blocks: unfilled=2055 exposure=1466 cooldown=365 groupCap=206 maxOpen=163 weeklyTrend=93

## HONEST floor60 minRR2.0 rolling10 ks-5/8
  ALL     T= 836 WR= 33% PF= 1.07 sumR=+  43.5 exp=+0.052 maxDD=55.5R  balDD=72.8%
  2026    T= 568 WR= 32% PF= 0.99 sumR=  -4.3 exp=-0.007 maxDD=55.5R
  last90d T= 234 WR= 32% PF= 1.01 sumR=+   2.3 exp=+0.010 maxDD=25.6R
  Aug14→  T=  37 WR= 19% PF= 0.46 sumR= -17.7 exp=-0.479 maxDD=20.3R
  blocks: unfilled=1310 exposure=1092 killSwitch=756 ddRolling7d=677 cooldown=279 ddDaily=274 maxOpen=116 groupCap=106 weeklyTrend=98

## HONEST floor60 minRR2.0 paper params $1000 1% 10x
  ALL     T= 731 WR= 33% PF= 1.07 sumR=+  40.4 exp=+0.055 maxDD=52.7R  balDD=43.0%
  2026    T= 487 WR= 32% PF= 1.02 sumR=+   8.0 exp=+0.016 maxDD=39.6R
  last90d T= 213 WR= 33% PF= 1.07 sumR=+  11.5 exp=+0.054 maxDD=22.5R
  Aug14→  T=  31 WR= 23% PF= 0.40 sumR= -14.4 exp=-0.465 maxDD=15.6R
  blocks: unfilled=1214 exposure=1017 ddRolling7d=939 killSwitch=907 cooldown=247 ddDaily=214 maxOpen=101 weeklyTrend=92 groupCap=82

## LS candidates — sweep-bar offset and stale-entry gap (bps, + = real price is WORSE than reported entry)
  barsAfter=0: n=364 (7%) gap median=0 mean=0 p75=0 p90=0 adverse=0%
  barsAfter=1: n=2279 (47%) gap median=52 mean=66 p75=97 p90=155 adverse=89%
  barsAfter=2: n=2214 (46%) gap median=87 mean=105 p75=152 p90=234 adverse=93%
  conf 60: n=565 stale(barsAfter>0)=97% gap median=63 mean=86 | median stop dist=141bps
  conf 65: n=1357 stale(barsAfter>0)=99% gap median=68 mean=87 | median stop dist=148bps
  conf 70: n=1143 stale(barsAfter>0)=98% gap median=67 mean=86 | median stop dist=145bps
  conf 75: n=764 stale(barsAfter>0)=98% gap median=65 mean=83 | median stop dist=144bps
  conf 80: n=772 stale(barsAfter>0)=76% gap median=35 mean=55 | median stop dist=144bps
  conf 85: n=236 stale(barsAfter>0)=61% gap median=15 mean=47 | median stop dist=151bps
  ALL LS: n=4857 gap median=57 mean=79 p90=190 | gap/stopDist median=0.41

## ENGINE arm — LS trades by confidence band
  [ALL]
    conf 60: T= 176 WR= 44% PF= 1.85 sumR=+95.2 exp=+0.541 CI95=[0.26, 0.83]
    conf 65: T= 393 WR= 44% PF= 1.92 sumR=+230.6 exp=+0.587 CI95=[0.40, 0.79]
    conf 70: T= 285 WR= 47% PF= 2.09 sumR=+189.2 exp=+0.664 CI95=[0.44, 0.89]
    conf 75: T= 185 WR= 47% PF= 2.08 sumR=+122.7 exp=+0.664 CI95=[0.37, 0.95]
    conf 80: T= 168 WR= 43% PF= 1.64 sumR=+70.2 exp=+0.418 CI95=[0.15, 0.71]
    conf 85: T=  50 WR= 22% PF= 0.66 sumR=-15.2 exp=-0.304 CI95=[-0.71, 0.15]
    swing pool: T=846 exp=0.597 PF=1.95 | EQ pool: T=417 exp=0.435 PF=1.65
  [2026]
    conf 60: T= 128 WR= 45% PF= 1.83 sumR=+67.9 exp=+0.530 CI95=[0.20, 0.87]
    conf 65: T= 308 WR= 44% PF= 1.94 sumR=+184.1 exp=+0.598 CI95=[0.37, 0.82]
    conf 70: T= 226 WR= 47% PF= 2.13 sumR=+153.2 exp=+0.678 CI95=[0.42, 0.95]
    conf 75: T= 141 WR= 50% PF= 2.34 sumR=+109.2 exp=+0.774 CI95=[0.45, 1.11]
    conf 80: T= 146 WR= 42% PF= 1.61 sumR=+59.2 exp=+0.406 CI95=[0.10, 0.72]
    conf 85: T=  41 WR= 22% PF= 0.66 sumR=-12.3 exp=-0.301 CI95=[-0.76, 0.22]
    swing pool: T=651 exp=0.623 PF=2.00 | EQ pool: T=345 exp=0.431 PF=1.65
  [last90d]
    conf 60: T=  51 WR= 45% PF= 1.66 sumR=+21.4 exp=+0.421 CI95=[-0.06, 0.91]
    conf 65: T= 112 WR= 45% PF= 1.88 sumR=+62.5 exp=+0.558 CI95=[0.20, 0.94]
    conf 70: T= 103 WR= 44% PF= 1.74 sumR=+49.0 exp=+0.476 CI95=[0.11, 0.84]
    conf 75: T=  66 WR= 50% PF= 2.25 sumR=+49.1 exp=+0.744 CI95=[0.25, 1.22]
    conf 80: T=  63 WR= 43% PF= 1.65 sumR=+27.2 exp=+0.432 CI95=[-0.03, 0.90]
    conf 85: T=  20 WR= 30% PF= 1.02 sumR=+0.4 exp=+0.019 CI95=[-0.74, 0.84]
    swing pool: T=251 exp=0.492 PF=1.76 | EQ pool: T=166 exp=0.507 PF=1.78
  [Aug14→]
    conf 60: T=   7 WR= 43% PF= 0.98 sumR=-0.1 exp=-0.013 CI95=[-0.94, 1.12]
    conf 65: T=  19 WR= 42% PF= 1.50 sumR=+5.9 exp=+0.310 CI95=[-0.40, 1.11]
    conf 70: T=  17 WR= 53% PF= 2.46 sumR=+12.4 exp=+0.732 CI95=[-0.08, 1.54]
    conf 75: T=   7 WR= 57% PF= 2.46 sumR=+5.4 exp=+0.766 CI95=[-0.66, 2.22]
    conf 80: T=  10 WR= 40% PF= 1.70 sumR=+4.7 exp=+0.474 CI95=[-0.76, 1.74]
    conf 85: T=   5 WR= 20% PF= 0.64 sumR=-1.8 exp=-0.354 CI95=[-1.27, 1.40]
    swing pool: T=43 exp=0.268 PF=1.42 | EQ pool: T=22 exp=0.684 PF=2.16

## ENGINE arm — direction × BTC daily
  [ALL    ] LONG  BTC up      T=  70 WR=23% PF=0.61 sumR=-24.5 exp=-0.349
  [ALL    ] LONG  BTC neutral T=  66 WR=27% PF=0.92 sumR=-4.0 exp=-0.060
  [ALL    ] LONG  BTC down    T= 148 WR=37% PF=1.43 sumR=44.7 exp=0.302
  [ALL    ] SHORT BTC up      T= 268 WR=59% PF=3.42 sumR=303.7 exp=1.133
  [ALL    ] SHORT BTC neutral T= 148 WR=44% PF=1.78 sumR=74.5 exp=0.503
  [ALL    ] SHORT BTC down    T= 694 WR=43% PF=1.79 sumR=355.4 exp=0.512
  [last90d] LONG  BTC up      T=  14 WR=21% PF=0.66 sumR=-4.2 exp=-0.301
  [last90d] LONG  BTC neutral T=  17 WR=41% PF=1.54 sumR=6.4 exp=0.375
  [last90d] LONG  BTC down    T=  56 WR=29% PF=0.98 sumR=-0.9 exp=-0.017
  [last90d] SHORT BTC up      T=  97 WR=62% PF=3.43 sumR=102.1 exp=1.052
  [last90d] SHORT BTC neutral T=  67 WR=43% PF=1.74 sumR=33.6 exp=0.501
  [last90d] SHORT BTC down    T= 181 WR=41% PF=1.58 sumR=71.3 exp=0.394
  [Aug14→ ] LONG  BTC up      T=  10 WR=20% PF=0.58 sumR=-3.6 exp=-0.362
  [Aug14→ ] LONG  BTC down    T=   2 WR=50% PF=1.83 sumR=1.1 exp=0.543
  [Aug14→ ] SHORT BTC up      T=  50 WR=48% PF=1.77 sumR=22.1 exp=0.442
  [Aug14→ ] SHORT BTC down    T=   5 WR=60% PF=3.45 sumR=6.0 exp=1.196
