# Phase 8 — collapse diagnosis — 2026-09-01
candles 8000 · capital $500 · base risk 2% · suite drift
candidates (post minSL+RR): 5544
LS candidates by confidence: 60:565 65:1357 70:1143 75:764 80:772 85:236 | eqPool 1784/4857

## ENGINE floor60 (parity with official report)
  ALL     T=1394 WR= 44% PF= 1.84 sumR=+ 749.8 exp=+0.538 maxDD=47.8R  balDD=66.6%
  2026    T=1041 WR= 45% PF= 1.86 sumR=+ 571.1 exp=+0.549 maxDD=47.8R
  last90d T= 432 WR= 44% PF= 1.75 sumR=+ 208.1 exp=+0.482 maxDD=22.3R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## DRIFT floor60: adverse fill +25bps (SL/TP fixed, right-sized)
  ALL     T=1390 WR= 45% PF= 1.52 sumR=+ 441.6 exp=+0.318 maxDD=29.0R  balDD=46.6%
  2026    T=1012 WR= 45% PF= 1.50 sumR=+ 310.7 exp=+0.307 maxDD=28.6R
  last90d T= 388 WR= 44% PF= 1.32 sumR=+  78.6 exp=+0.203 maxDD=28.6R
  Aug14→  T=  61 WR= 48% PF= 1.63 sumR=+  21.5 exp=+0.353 maxDD=11.3R
  blocks: exposure=1534 ddRolling7d=957 cooldown=395 maxOpen=390 killSwitch=336 ddDaily=262 groupCap=194 weeklyTrend=86

## DRIFT floor60: adverse fill +57bps (SL/TP fixed, right-sized)
  ALL     T=1019 WR= 43% PF= 1.11 sumR=+  71.4 exp=+0.070 maxDD=84.4R  balDD=83.4%
  2026    T= 732 WR= 43% PF= 1.06 sumR=+  27.0 exp=+0.037 maxDD=84.4R
  last90d T= 253 WR= 39% PF= 0.82 sumR= -29.9 exp=-0.118 maxDD=43.7R
  Aug14→  T=  46 WR= 33% PF= 0.61 sumR= -12.6 exp=-0.274 maxDD=15.2R
  blocks: ddRolling7d=1282 exposure=1184 killSwitch=1149 cooldown=282 maxOpen=208 ddDaily=199 groupCap=135 weeklyTrend=86

## DRIFT floor60: adverse fill +84bps (SL/TP fixed, right-sized)
  ALL     T=1012 WR= 43% PF= 0.96 sumR= -23.0 exp=-0.023 maxDD=102.2R  balDD=89.9%
  2026    T= 684 WR= 43% PF= 0.88 sumR= -50.2 exp=-0.073 maxDD=100.1R
  last90d T= 253 WR= 41% PF= 0.74 sumR= -42.3 exp=-0.167 maxDD=53.2R
  Aug14→  T=  59 WR= 39% PF= 0.76 sumR=  -8.9 exp=-0.151 maxDD=15.7R
  blocks: exposure=1187 ddRolling7d=1143 killSwitch=1133 ddDaily=309 cooldown=301 maxOpen=242 groupCap=132 weeklyTrend=85

## DRIFT floor60: adverse fill +120bps (SL/TP fixed, right-sized)
  ALL     T= 947 WR= 45% PF= 0.81 sumR=-107.9 exp=-0.114 maxDD=132.8R  balDD=93.0%
  2026    T= 677 WR= 46% PF= 0.78 sumR= -84.6 exp=-0.125 maxDD=101.9R
  last90d T= 269 WR= 46% PF= 0.70 sumR= -45.9 exp=-0.171 maxDD=46.9R
  Aug14→  T=  57 WR= 39% PF= 0.59 sumR= -14.7 exp=-0.258 maxDD=15.4R
  blocks: killSwitch=1511 exposure=1145 ddRolling7d=927 ddDaily=313 cooldown=282 maxOpen=221 groupCap=113 weeklyTrend=85

## LIMIT floor60: rest at signal close for 1 bar
  ALL     T= 785 WR= 31% PF= 1.07 sumR=+  43.6 exp=+0.056 maxDD=48.0R  balDD=57.7%
  2026    T= 579 WR= 31% PF= 1.06 sumR=+  28.5 exp=+0.049 maxDD=33.1R
  last90d T= 247 WR= 32% PF= 1.04 sumR=+   7.6 exp=+0.031 maxDD=23.1R
  Aug14→  T=  39 WR= 18% PF= 0.49 sumR= -18.6 exp=-0.478 maxDD=22.0R
  blocks: killSwitch=1269 unfilled=931 ddRolling7d=895 exposure=882 ddDaily=287 cooldown=266 maxOpen=89 weeklyTrend=87 groupCap=53

## DRIFT floor60 −RSI +57bps
  ALL     T= 982 WR= 43% PF= 1.12 sumR=+  72.7 exp=+0.074 maxDD=69.3R  balDD=81.5%
  2026    T= 675 WR= 43% PF= 1.07 sumR=+  30.1 exp=+0.045 maxDD=69.3R
  last90d T= 250 WR= 39% PF= 0.81 sumR= -31.1 exp=-0.124 maxDD=44.6R
  Aug14→  T=  45 WR= 31% PF= 0.58 sumR= -13.7 exp=-0.304 maxDD=15.2R
  blocks: ddRolling7d=1252 killSwitch=1112 exposure=1010 ddDaily=251 cooldown=229 maxOpen=198 groupCap=110 weeklyTrend=81

## DRIFT floor68: adverse fill +25bps (SL/TP fixed, right-sized)
  ALL     T= 962 WR= 41% PF= 1.30 sumR=+ 185.0 exp=+0.192 maxDD=38.9R  balDD=60.3%
  2026    T= 709 WR= 41% PF= 1.24 sumR=+ 111.8 exp=+0.158 maxDD=38.9R
  last90d T= 348 WR= 43% PF= 1.30 sumR=+  65.7 exp=+0.189 maxDD=17.0R
  Aug14→  T=  58 WR= 38% PF= 1.15 sumR=+   5.6 exp=+0.097 maxDD=14.5R
  blocks: exposure=996 ddRolling7d=599 killSwitch=402 cooldown=258 groupCap=111 maxOpen=108 weeklyTrend=96 ddDaily=90

## DRIFT floor68: adverse fill +57bps (SL/TP fixed, right-sized)
  ALL     T= 850 WR= 42% PF= 1.08 sumR=+  41.5 exp=+0.049 maxDD=48.4R  balDD=64.6%
  2026    T= 606 WR= 42% PF= 1.01 sumR=+   5.5 exp=+0.009 maxDD=48.4R
  last90d T= 241 WR= 39% PF= 0.88 sumR= -18.9 exp=-0.078 maxDD=47.3R
  Aug14→  T=  56 WR= 45% PF= 1.17 sumR=+   5.3 exp=+0.095 maxDD=13.6R
  blocks: exposure=879 ddRolling7d=702 killSwitch=583 cooldown=228 ddDaily=109 groupCap=97 weeklyTrend=89 maxOpen=85

## DRIFT floor68: adverse fill +84bps (SL/TP fixed, right-sized)
  ALL     T= 775 WR= 42% PF= 0.89 sumR= -54.1 exp=-0.070 maxDD=88.1R  balDD=84.4%
  2026    T= 558 WR= 43% PF= 0.86 sumR= -46.2 exp=-0.083 maxDD=85.1R
  last90d T= 217 WR= 42% PF= 0.77 sumR= -30.9 exp=-0.142 maxDD=44.8R
  Aug14→  T=  55 WR= 45% PF= 0.98 sumR=  -0.6 exp=-0.010 maxDD=14.0R
  blocks: exposure=847 killSwitch=845 ddRolling7d=612 cooldown=213 ddDaily=121 weeklyTrend=91 maxOpen=72 groupCap=46

## DRIFT floor68: adverse fill +120bps (SL/TP fixed, right-sized)
  ALL     T= 720 WR= 43% PF= 0.75 sumR=-107.4 exp=-0.149 maxDD=128.3R  balDD=91.9%
  2026    T= 497 WR= 43% PF= 0.69 sumR= -93.5 exp=-0.188 maxDD=118.5R
  last90d T= 191 WR= 40% PF= 0.53 sumR= -56.4 exp=-0.295 maxDD=63.3R
  Aug14→  T=  51 WR= 45% PF= 0.70 sumR=  -8.5 exp=-0.166 maxDD=15.4R
  blocks: exposure=818 killSwitch=784 ddRolling7d=739 cooldown=191 ddDaily=115 maxOpen=101 weeklyTrend=94 groupCap=60

## LIMIT floor68: rest at signal close for 1 bar
  ALL     T= 663 WR= 32% PF= 1.06 sumR=+  29.7 exp=+0.045 maxDD=34.5R  balDD=52.4%
  2026    T= 491 WR= 33% PF= 1.04 sumR=+  15.4 exp=+0.031 maxDD=31.0R
  last90d T= 218 WR= 33% PF= 1.05 sumR=+   8.1 exp=+0.037 maxDD=20.6R
  Aug14→  T=  38 WR= 26% PF= 0.66 sumR= -10.1 exp=-0.267 maxDD=15.2R
  blocks: exposure=762 killSwitch=702 unfilled=638 ddRolling7d=425 cooldown=191 weeklyTrend=95 ddDaily=75 maxOpen=39 groupCap=32

## DRIFT floor68 −RSI +57bps
  ALL     T= 788 WR= 41% PF= 1.06 sumR=+  29.7 exp=+0.038 maxDD=51.3R  balDD=68.3%
  2026    T= 556 WR= 41% PF= 0.99 sumR=  -2.1 exp=-0.004 maxDD=51.3R
  last90d T= 229 WR= 40% PF= 0.92 sumR= -12.0 exp=-0.052 maxDD=41.1R
  Aug14→  T=  53 WR= 45% PF= 1.22 sumR=+   6.4 exp=+0.121 maxDD=11.4R
  blocks: ddRolling7d=742 exposure=724 killSwitch=536 cooldown=155 ddDaily=114 weeklyTrend=89 maxOpen=79 groupCap=76

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
