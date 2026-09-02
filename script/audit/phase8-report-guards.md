# Phase 8 — collapse diagnosis — 2026-09-01
candles 8000 · capital $500 · base risk 2% · suite guards
candidates (post minSL+RR): 5544
LS candidates by confidence: 60:565 65:1357 70:1143 75:764 80:772 85:236 | eqPool 1784/4857

## ENGINE floor60 (parity with official report)
  ALL     T=1394 WR= 44% PF= 1.84 sumR=+ 749.8 exp=+0.538 maxDD=47.8R  balDD=66.6%
  2026    T=1041 WR= 45% PF= 1.86 sumR=+ 571.1 exp=+0.549 maxDD=47.8R
  last90d T= 432 WR= 44% PF= 1.75 sumR=+ 208.1 exp=+0.482 maxDD=22.3R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## GUARDS floor60: engine (daily4 rolling6 ks-3/4, R=base)
  ALL     T=1394 WR= 44% PF= 1.84 sumR=+ 749.8 exp=+0.538 maxDD=47.8R  balDD=66.6%
  2026    T=1041 WR= 45% PF= 1.86 sumR=+ 571.1 exp=+0.549 maxDD=47.8R
  last90d T= 432 WR= 44% PF= 1.75 sumR=+ 208.1 exp=+0.482 maxDD=22.3R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## GUARDS floor60: R unit = trade risk
  ALL     T=1411 WR= 44% PF= 1.85 sumR=+ 760.8 exp=+0.539 maxDD=50.7R  balDD=68.3%
  2026    T=1067 WR= 44% PF= 1.85 sumR=+ 575.3 exp=+0.539 maxDD=50.7R
  last90d T= 428 WR= 44% PF= 1.76 sumR=+ 208.0 exp=+0.486 maxDD=19.9R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1565 ddRolling7d=910 cooldown=425 maxOpen=330 killSwitch=329 ddDaily=284 groupCap=206 weeklyTrend=84

## GUARDS floor60: rolling 8
  ALL     T=1431 WR= 45% PF= 1.89 sumR=+ 801.4 exp=+0.560 maxDD=37.5R  balDD=47.3%
  2026    T=1078 WR= 45% PF= 1.91 sumR=+ 615.2 exp=+0.571 maxDD=30.5R
  last90d T= 432 WR= 44% PF= 1.75 sumR=+ 208.1 exp=+0.482 maxDD=22.3R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1645 killSwitch=596 ddRolling7d=540 cooldown=411 maxOpen=397 ddDaily=230 groupCap=207 weeklyTrend=87

## GUARDS floor60: rolling 10
  ALL     T=1431 WR= 45% PF= 1.89 sumR=+ 801.4 exp=+0.560 maxDD=37.5R  balDD=47.3%
  2026    T=1078 WR= 45% PF= 1.91 sumR=+ 615.2 exp=+0.571 maxDD=30.5R
  last90d T= 432 WR= 44% PF= 1.75 sumR=+ 208.1 exp=+0.482 maxDD=22.3R
  Aug14→  T=  67 WR= 45% PF= 1.62 sumR=+  25.6 exp=+0.382 maxDD=16.3R
  blocks: exposure=1645 killSwitch=762 cooldown=411 maxOpen=398 ddRolling7d=367 ddDaily=230 groupCap=213 weeklyTrend=87

## GUARDS floor60: rolling off
  ALL     T=1439 WR= 44% PF= 1.88 sumR=+ 799.0 exp=+0.555 maxDD=38.3R  balDD=46.5%
  2026    T=1082 WR= 45% PF= 1.90 sumR=+ 613.7 exp=+0.567 maxDD=28.6R
  last90d T= 435 WR= 44% PF= 1.73 sumR=+ 204.8 exp=+0.471 maxDD=24.5R
  Aug14→  T=  68 WR= 44% PF= 1.58 sumR=+  24.5 exp=+0.360 maxDD=16.3R
  blocks: exposure=1656 killSwitch=1094 cooldown=421 maxOpen=398 ddDaily=230 groupCap=219 weeklyTrend=87

## GUARDS floor60: kill-switch off
  ALL     T=1633 WR= 44% PF= 1.87 sumR=+ 899.2 exp=+0.551 maxDD=28.4R  balDD=42.0%
  2026    T=1214 WR= 45% PF= 1.89 sumR=+ 677.9 exp=+0.558 maxDD=22.6R
  last90d T= 476 WR= 45% PF= 1.79 sumR=+ 238.7 exp=+0.501 maxDD=19.0R
  Aug14→  T=  66 WR= 47% PF= 1.68 sumR=+  26.3 exp=+0.398 maxDD=16.3R
  blocks: exposure=1802 ddRolling7d=570 cooldown=475 maxOpen=420 ddDaily=317 groupCap=238 weeklyTrend=89

## GUARDS floor60: kill-switch -5R/8 trades
  ALL     T=1607 WR= 45% PF= 1.89 sumR=+ 897.6 exp=+0.559 maxDD=31.5R  balDD=46.9%
  2026    T=1200 WR= 45% PF= 1.90 sumR=+ 675.7 exp=+0.563 maxDD=24.3R
  last90d T= 476 WR= 45% PF= 1.79 sumR=+ 238.7 exp=+0.501 maxDD=19.0R
  Aug14→  T=  66 WR= 47% PF= 1.68 sumR=+  26.3 exp=+0.398 maxDD=16.3R
  blocks: exposure=1765 cooldown=461 ddRolling7d=458 maxOpen=447 ddDaily=319 groupCap=256 killSwitch=143 weeklyTrend=88

## GUARDS floor60: daily off
  ALL     T=1551 WR= 44% PF= 1.82 sumR=+ 815.0 exp=+0.525 maxDD=34.8R  balDD=60.0%
  2026    T=1142 WR= 44% PF= 1.78 sumR=+ 579.2 exp=+0.507 maxDD=34.8R
  last90d T= 448 WR= 43% PF= 1.67 sumR=+ 197.0 exp=+0.440 maxDD=23.5R
  Aug14→  T=  67 WR= 48% PF= 1.75 sumR=+  28.4 exp=+0.425 maxDD=15.1R
  blocks: exposure=1670 ddRolling7d=785 maxOpen=456 cooldown=448 killSwitch=304 groupCap=244 weeklyTrend=86

## GUARDS floor60: daily 6
  ALL     T=1503 WR= 45% PF= 1.88 sumR=+ 831.5 exp=+0.553 maxDD=41.2R  balDD=59.2%
  2026    T=1104 WR= 45% PF= 1.88 sumR=+ 612.4 exp=+0.555 maxDD=41.2R
  last90d T= 442 WR= 43% PF= 1.70 sumR=+ 202.2 exp=+0.458 maxDD=23.5R
  Aug14→  T=  66 WR= 47% PF= 1.74 sumR=+  28.0 exp=+0.424 maxDD=15.1R
  blocks: exposure=1656 ddRolling7d=834 maxOpen=436 cooldown=430 killSwitch=274 groupCap=237 weeklyTrend=89 ddDaily=85

## GUARDS floor60: rolling 10 + ks -5/8
  ALL     T=1619 WR= 45% PF= 1.89 sumR=+ 902.6 exp=+0.558 maxDD=31.5R  balDD=45.3%
  2026    T=1211 WR= 45% PF= 1.90 sumR=+ 681.9 exp=+0.563 maxDD=24.3R
  last90d T= 477 WR= 45% PF= 1.78 sumR=+ 236.7 exp=+0.496 maxDD=19.0R
  Aug14→  T=  66 WR= 47% PF= 1.68 sumR=+  26.3 exp=+0.398 maxDD=16.3R
  blocks: exposure=1781 cooldown=474 maxOpen=454 ddDaily=319 killSwitch=273 ddRolling7d=271 groupCap=263 weeklyTrend=90

## GUARDS floor60: all portfolio guards off
  ALL     T=1905 WR= 45% PF= 1.85 sumR=+1031.6 exp=+0.542 maxDD=27.5R  balDD=34.3%
  2026    T=1402 WR= 45% PF= 1.84 sumR=+ 752.0 exp=+0.536 maxDD=26.1R
  last90d T= 527 WR= 43% PF= 1.68 sumR=+ 232.6 exp=+0.441 maxDD=24.8R
  Aug14→  T=  88 WR= 44% PF= 1.52 sumR=+  28.4 exp=+0.323 maxDD=15.2R
  blocks: exposure=2046 maxOpen=623 cooldown=544 groupCap=336 weeklyTrend=90

## GUARDS floor68: engine (daily4 rolling6 ks-3/4, R=base)
  ALL     T=1160 WR= 44% PF= 1.78 sumR=+ 579.8 exp=+0.500 maxDD=20.1R  balDD=34.0%
  2026    T= 859 WR= 44% PF= 1.77 sumR=+ 425.2 exp=+0.495 maxDD=20.1R
  last90d T= 358 WR= 42% PF= 1.57 sumR=+ 134.6 exp=+0.376 maxDD=16.2R
  Aug14→  T=  41 WR= 32% PF= 0.90 sumR=  -3.1 exp=-0.077 maxDD=16.2R
  blocks: exposure=1146 ddRolling7d=352 cooldown=298 killSwitch=177 maxOpen=138 groupCap=127 ddDaily=126 weeklyTrend=98

## GUARDS floor68: R unit = trade risk
  ALL     T=1074 WR= 42% PF= 1.66 sumR=+ 468.7 exp=+0.436 maxDD=23.7R  balDD=42.9%
  2026    T= 790 WR= 43% PF= 1.65 sumR=+ 336.5 exp=+0.426 maxDD=20.2R
  last90d T= 357 WR= 42% PF= 1.57 sumR=+ 135.7 exp=+0.380 maxDD=16.2R
  Aug14→  T=  41 WR= 32% PF= 0.90 sumR=  -3.1 exp=-0.077 maxDD=16.2R
  blocks: exposure=1061 ddRolling7d=490 killSwitch=275 cooldown=269 ddDaily=131 groupCap=118 maxOpen=111 weeklyTrend=93

## GUARDS floor68: rolling 8
  ALL     T=1151 WR= 44% PF= 1.76 sumR=+ 563.3 exp=+0.489 maxDD=20.1R  balDD=38.3%
  2026    T= 850 WR= 44% PF= 1.75 sumR=+ 408.6 exp=+0.481 maxDD=20.1R
  last90d T= 358 WR= 42% PF= 1.57 sumR=+ 134.6 exp=+0.376 maxDD=16.2R
  Aug14→  T=  41 WR= 32% PF= 0.90 sumR=  -3.1 exp=-0.077 maxDD=16.2R
  blocks: exposure=1140 cooldown=301 killSwitch=275 ddRolling7d=255 ddDaily=138 maxOpen=138 groupCap=129 weeklyTrend=95

## GUARDS floor68: rolling 10
  ALL     T=1156 WR= 44% PF= 1.76 sumR=+ 565.3 exp=+0.489 maxDD=20.1R  balDD=40.7%
  2026    T= 855 WR= 44% PF= 1.74 sumR=+ 410.7 exp=+0.480 maxDD=20.1R
  last90d T= 358 WR= 42% PF= 1.57 sumR=+ 134.6 exp=+0.376 maxDD=16.2R
  Aug14→  T=  41 WR= 32% PF= 0.90 sumR=  -3.1 exp=-0.077 maxDD=16.2R
  blocks: exposure=1143 killSwitch=345 cooldown=301 ddRolling7d=178 maxOpen=138 ddDaily=137 groupCap=129 weeklyTrend=95

## GUARDS floor68: rolling off
  ALL     T=1169 WR= 44% PF= 1.77 sumR=+ 577.9 exp=+0.494 maxDD=20.2R  balDD=34.9%
  2026    T= 867 WR= 44% PF= 1.76 sumR=+ 421.7 exp=+0.486 maxDD=20.1R
  last90d T= 360 WR= 42% PF= 1.55 sumR=+ 132.4 exp=+0.368 maxDD=17.7R
  Aug14→  T=  43 WR= 30% PF= 0.84 sumR=  -5.3 exp=-0.124 maxDD=17.7R
  blocks: exposure=1167 killSwitch=495 cooldown=304 maxOpen=139 groupCap=130 ddDaily=123 weeklyTrend=95

## GUARDS floor68: kill-switch off
  ALL     T=1218 WR= 43% PF= 1.74 sumR=+ 586.4 exp=+0.481 maxDD=21.4R  balDD=38.5%
  2026    T= 891 WR= 44% PF= 1.76 sumR=+ 437.6 exp=+0.491 maxDD=21.4R
  last90d T= 369 WR= 42% PF= 1.57 sumR=+ 139.6 exp=+0.378 maxDD=18.3R
  Aug14→  T=  43 WR= 33% PF= 0.90 sumR=  -3.0 exp=-0.071 maxDD=18.3R
  blocks: exposure=1184 ddRolling7d=430 cooldown=309 ddDaily=132 maxOpen=130 groupCap=121 weeklyTrend=98

## GUARDS floor68: kill-switch -5R/8 trades
  ALL     T=1201 WR= 44% PF= 1.81 sumR=+ 619.4 exp=+0.516 maxDD=21.3R  balDD=37.2%
  2026    T= 890 WR= 45% PF= 1.82 sumR=+ 462.9 exp=+0.520 maxDD=21.3R
  last90d T= 368 WR= 42% PF= 1.58 sumR=+ 140.7 exp=+0.382 maxDD=18.3R
  Aug14→  T=  43 WR= 33% PF= 0.90 sumR=  -3.0 exp=-0.071 maxDD=18.3R
  blocks: exposure=1178 ddRolling7d=351 cooldown=311 maxOpen=153 ddDaily=126 groupCap=119 weeklyTrend=95 killSwitch=88

## GUARDS floor68: daily off
  ALL     T=1253 WR= 43% PF= 1.74 sumR=+ 597.6 exp=+0.477 maxDD=22.8R  balDD=30.8%
  2026    T= 938 WR= 43% PF= 1.68 sumR=+ 415.8 exp=+0.443 maxDD=21.0R
  last90d T= 355 WR= 39% PF= 1.40 sumR=+  99.3 exp=+0.280 maxDD=21.0R
  Aug14→  T=  64 WR= 38% PF= 1.21 sumR=+   9.4 exp=+0.147 maxDD=15.4R
  blocks: exposure=1216 cooldown=320 ddRolling7d=274 killSwitch=186 maxOpen=160 groupCap=119 weeklyTrend=94

## GUARDS floor68: daily 6
  ALL     T=1151 WR= 43% PF= 1.72 sumR=+ 534.4 exp=+0.464 maxDD=22.8R  balDD=41.0%
  2026    T= 838 WR= 42% PF= 1.63 sumR=+ 350.2 exp=+0.418 maxDD=21.0R
  last90d T= 355 WR= 39% PF= 1.40 sumR=+  99.3 exp=+0.280 maxDD=21.0R
  Aug14→  T=  64 WR= 38% PF= 1.21 sumR=+   9.4 exp=+0.147 maxDD=15.4R
  blocks: exposure=1142 ddRolling7d=401 cooldown=311 killSwitch=212 maxOpen=143 groupCap=119 weeklyTrend=94 ddDaily=49

## GUARDS floor68: rolling 10 + ks -5/8
  ALL     T=1225 WR= 44% PF= 1.80 sumR=+ 625.7 exp=+0.511 maxDD=21.3R  balDD=37.2%
  2026    T= 914 WR= 45% PF= 1.81 sumR=+ 469.3 exp=+0.513 maxDD=21.3R
  last90d T= 370 WR= 42% PF= 1.56 sumR=+ 138.3 exp=+0.374 maxDD=18.3R
  Aug14→  T=  45 WR= 31% PF= 0.84 sumR=  -5.5 exp=-0.121 maxDD=18.3R
  blocks: exposure=1197 cooldown=313 killSwitch=211 ddRolling7d=177 maxOpen=153 ddDaily=126 groupCap=122 weeklyTrend=98

## GUARDS floor68: all portfolio guards off
  ALL     T=1452 WR= 43% PF= 1.73 sumR=+ 685.6 exp=+0.472 maxDD=30.0R  balDD=51.6%
  2026    T=1058 WR= 43% PF= 1.71 sumR=+ 487.4 exp=+0.461 maxDD=30.0R
  last90d T= 422 WR= 40% PF= 1.41 sumR=+ 120.4 exp=+0.285 maxDD=30.0R
  Aug14→  T=  85 WR= 29% PF= 0.86 sumR=  -9.2 exp=-0.108 maxDD=30.0R
  blocks: exposure=1382 cooldown=359 maxOpen=181 groupCap=150 weeklyTrend=98

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
