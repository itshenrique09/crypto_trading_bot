# Full-Pipeline Portfolio Validation — 2026-09-07
Capital $500 · base risk 2% · candles 20000 · feed Binance spot · entry slip 15 bps · gates mirror server/routes.ts (drawdown guard 12/6R over 30d, regime gates from the registry)
Entry = signal candle close (since 2026-09-01). Unmodeled: spread/funding filters, engine downtime; slippage only via --slip.

Total raw candidates (post minSL+R:R): 10298

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$307  → balance $807 maxDD 48.4%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-27
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$232  → balance $732 maxDD 48.6%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-0
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## SLEEVE tsmom maxConcurrent=4
  ALL:  T= 654 WR= 35% PF= 1.03 sumR=+11.5 exp=+0.02R pnl=$-78  → balance $422 maxDD 81.0%
  2026: T= 240 WR= 40% PF= 1.28 sumR=+42.7 exp=+0.18R pnl=$160
  blocks: regimeGate=5743 stratCap=1768 exposure=1546 maxOpen=185 ddGuard=168 cooldown=156 groupCap=78

## SLEEVE tsmom maxConcurrent=6
  ALL:  T= 678 WR= 36% PF= 1.03 sumR=+15.7 exp=+0.02R pnl=$-108  → balance $392 maxDD 68.0%
  2026: T= 220 WR= 37% PF= 1.11 sumR=+15.8 exp=+0.07R pnl=$18
  blocks: regimeGate=5499 exposure=1951 stratCap=1502 maxOpen=312 cooldown=166 groupCap=107 ddGuard=83

## CAP maxOpen=8
  ALL:  T= 623 WR= 37% PF= 1.09 sumR=+38.2 exp=+0.06R pnl=$135  → balance $635 maxDD 59.1%
  2026: T= 144 WR= 40% PF= 1.18 sumR=+16.6 exp=+0.12R pnl=$104
  blocks: regimeGate=5493 exposure=1996 maxOpen=1881 cooldown=167 groupCap=81 ddGuard=57

## CAP maxOpen=10
  ALL:  T= 784 WR= 38% PF= 1.15 sumR=+76.0 exp=+0.10R pnl=$482  → balance $982 maxDD 63.6%
  2026: T= 169 WR= 39% PF= 1.17 sumR=+18.1 exp=+0.11R pnl=$120
  blocks: regimeGate=5296 exposure=2370 maxOpen=1374 cooldown=194 groupCap=178 ddGuard=102

## CAP perSymbol=2
  ALL:  T= 787 WR= 38% PF= 1.16 sumR=+80.5 exp=+0.10R pnl=$530  → balance $1030 maxDD 61.6%
  2026: T= 172 WR= 38% PF= 1.14 sumR=+15.0 exp=+0.09R pnl=$60
  blocks: regimeGate=6537 maxOpen=1613 exposure=921 cooldown=198 groupCap=180 ddGuard=62

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 638 WR= 38% PF= 1.13 sumR=+52.7 exp=+0.08R pnl=$340  → balance $840 maxDD 52.6%
  2026: T= 138 WR= 40% PF= 1.20 sumR=+17.5 exp=+0.13R pnl=$156
  blocks: regimeGate=6546 maxOpen=2034 exposure=743 cooldown=164 groupCap=97 ddGuard=76

## CAP LS cooldown 8h
  ALL:  T= 785 WR= 37% PF= 1.15 sumR=+74.9 exp=+0.10R pnl=$461  → balance $961 maxDD 64.4%
  2026: T= 169 WR= 39% PF= 1.17 sumR=+18.1 exp=+0.11R pnl=$117
  blocks: regimeGate=5302 exposure=2367 maxOpen=1378 cooldown=185 groupCap=178 ddGuard=103

## CAP LS cooldown 6h
  ALL:  T= 786 WR= 38% PF= 1.15 sumR=+77.5 exp=+0.10R pnl=$511  → balance $1011 maxDD 62.5%
  2026: T= 169 WR= 39% PF= 1.17 sumR=+18.1 exp=+0.11R pnl=$123
  blocks: regimeGate=5302 exposure=2367 maxOpen=1379 cooldown=183 groupCap=178 ddGuard=103

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 639 WR= 38% PF= 1.13 sumR=+51.7 exp=+0.08R pnl=$323  → balance $823 maxDD 53.7%
  2026: T= 138 WR= 40% PF= 1.20 sumR=+17.5 exp=+0.13R pnl=$153
  blocks: regimeGate=6549 maxOpen=2036 exposure=744 cooldown=155 groupCap=97 ddGuard=78

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 787 WR= 38% PF= 1.16 sumR=+80.5 exp=+0.10R pnl=$530  → balance $1030 maxDD 61.6%
  2026: T= 172 WR= 38% PF= 1.14 sumR=+15.0 exp=+0.09R pnl=$60
  blocks: regimeGate=6537 maxOpen=1613 exposure=921 cooldown=198 groupCap=180 ddGuard=62

## CAP maxOpen=12
  ALL:  T= 895 WR= 37% PF= 1.12 sumR=+70.8 exp=+0.08R pnl=$236  → balance $736 maxDD 69.6%
  2026: T= 210 WR= 39% PF= 1.13 sumR=+16.9 exp=+0.08R pnl=$21
  blocks: regimeGate=5149 exposure=2685 maxOpen=937 groupCap=310 cooldown=226 ddGuard=96

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 760 WR= 36% PF= 1.06 sumR=+31.8 exp=+0.04R pnl=$-38  → balance $462 maxDD 70.6%
  2026: T= 152 WR= 38% PF= 1.12 sumR=+11.6 exp=+0.08R pnl=$12
  blocks: regimeGate=5373 exposure=2236 maxOpen=1096 groupCap=582 cooldown=186 ddGuard=65

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 895 WR= 37% PF= 1.12 sumR=+70.8 exp=+0.08R pnl=$236  → balance $736 maxDD 69.6%
  2026: T= 210 WR= 39% PF= 1.13 sumR=+16.9 exp=+0.08R pnl=$21
  blocks: regimeGate=5149 exposure=2685 maxOpen=937 groupCap=310 cooldown=226 ddGuard=96

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 823 WR= 38% PF= 1.07 sumR=+35.5 exp=+0.04R pnl=$-73  → balance $427 maxDD 68.7%
  2026: T= 174 WR= 40% PF= 1.18 sumR=+19.2 exp=+0.11R pnl=$68
  blocks: regimeGate=5213 exposure=2328 maxOpen=1359 cooldown=342 groupCap=184 ddGuard=49

## EXIT tp1Close=50%
  ALL:  T= 787 WR= 38% PF= 1.18 sumR=+90.6 exp=+0.12R pnl=$805  → balance $1305 maxDD 63.6%
  2026: T= 172 WR= 40% PF= 1.22 sumR=+23.0 exp=+0.13R pnl=$302
  blocks: regimeGate=5310 exposure=2374 maxOpen=1382 cooldown=193 groupCap=174 ddGuard=78

## EXIT tp1Close=75%
  ALL:  T= 784 WR= 38% PF= 1.12 sumR=+59.8 exp=+0.08R pnl=$257  → balance $757 maxDD 63.5%
  2026: T= 169 WR= 39% PF= 1.16 sumR=+16.5 exp=+0.10R pnl=$74
  blocks: regimeGate=5296 exposure=2370 maxOpen=1374 cooldown=194 groupCap=178 ddGuard=102

## EXIT trail 1.5%
  ALL:  T= 792 WR= 37% PF= 1.13 sumR=+69.0 exp=+0.09R pnl=$353  → balance $853 maxDD 64.0%
  2026: T= 169 WR= 39% PF= 1.18 sumR=+18.8 exp=+0.11R pnl=$116
  blocks: regimeGate=5286 exposure=2372 maxOpen=1371 cooldown=204 groupCap=171 ddGuard=102

## EXIT trail 3%
  ALL:  T= 803 WR= 37% PF= 1.13 sumR=+65.4 exp=+0.08R pnl=$286  → balance $786 maxDD 64.2%
  2026: T= 189 WR= 38% PF= 1.07 sumR=+8.8 exp=+0.05R pnl=$-61
  blocks: regimeGate=5332 exposure=2360 maxOpen=1349 cooldown=189 groupCap=168 ddGuard=97

## EXIT trail r_multiple 2R
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$307  → balance $807 maxDD 48.4%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-27
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## TILT LONG:up 0.75x
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$316  → balance $816 maxDD 48.4%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-26
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## TILT LONG:up 0.5x
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$324  → balance $824 maxDD 48.4%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-27
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## TILT LONG:up blocked
  ALL:  T= 605 WR= 39% PF= 1.17 sumR=+64.2 exp=+0.11R pnl=$437  → balance $937 maxDD 61.5%
  2026: T= 109 WR= 46% PF= 1.46 sumR=+27.9 exp=+0.26R pnl=$272
  blocks: regimeGate=5116 exposure=2476 maxOpen=1535 groupCap=187 sizeTilt=161 cooldown=143 ddGuard=75

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$284  → balance $784 maxDD 48.4%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-30
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## SAMEDIR max 4
  ALL:  T= 363 WR= 42% PF= 1.27 sumR=+57.9 exp=+0.16R pnl=$785  → balance $1285 maxDD 33.5%
  2026: T=  75 WR= 47% PF= 1.50 sumR=+19.7 exp=+0.26R pnl=$370
  blocks: regimeGate=5767 sameDir=2276 exposure=1513 groupCap=254 cooldown=97 ddGuard=28

## SAMEDIR max 5
  ALL:  T= 435 WR= 40% PF= 1.20 sumR=+54.3 exp=+0.12R pnl=$612  → balance $1112 maxDD 44.6%
  2026: T=  92 WR= 43% PF= 1.31 sumR=+16.4 exp=+0.18R pnl=$253
  blocks: regimeGate=5617 exposure=1792 sameDir=1771 groupCap=339 maxOpen=191 cooldown=125 ddGuard=28

## SAMEDIR max 6
  ALL:  T= 465 WR= 41% PF= 1.21 sumR=+59.0 exp=+0.13R pnl=$690  → balance $1190 maxDD 43.3%
  2026: T= 108 WR= 44% PF= 1.35 sumR=+21.7 exp=+0.20R pnl=$339
  blocks: regimeGate=5486 exposure=1993 sameDir=1480 groupCap=364 maxOpen=353 cooldown=130 ddGuard=27

## SAMEDIR max 7
  ALL:  T= 485 WR= 40% PF= 1.19 sumR=+55.0 exp=+0.11R pnl=$528  → balance $1028 maxDD 41.0%
  2026: T= 118 WR= 41% PF= 1.18 sumR=+12.9 exp=+0.11R pnl=$131
  blocks: regimeGate=5335 exposure=2200 sameDir=1233 maxOpen=530 groupCap=362 cooldown=126 ddGuard=27

## VENUE Kraken (−LUNC)
  ALL:  T= 561 WR= 40% PF= 1.15 sumR=+52.9 exp=+0.09R pnl=$307  → balance $807 maxDD 48.4%
  2026: T= 112 WR= 39% PF= 1.08 sumR=+5.5 exp=+0.05R pnl=$-27
  blocks: regimeGate=5066 exposure=2576 maxOpen=1785 cooldown=136 groupCap=132 ddGuard=42

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 544 WR= 40% PF= 1.15 sumR=+50.6 exp=+0.09R pnl=$319  → balance $819 maxDD 48.9%
  2026: T= 112 WR= 41% PF= 1.21 sumR=+14.2 exp=+0.13R pnl=$93
  blocks: regimeGate=4565 exposure=2556 maxOpen=1542 groupCap=153 cooldown=126 ddGuard=37

## TRIAGE minus rsi-divergence
  ALL:  T= 568 WR= 30% PF= 0.86 sumR=-60.4 exp=-0.11R pnl=$-434  → balance $66 maxDD 93.0%
  2026: T= 266 WR= 35% PF= 1.02 sumR=+4.5 exp=+0.02R pnl=$-23
  blocks: regimeGate=6357 exposure=534 ddGuard=223 cooldown=109 maxOpen=72 groupCap=44

## BASELINE (all gates)
  ALL:  T= 160 WR= 39% PF= 1.21 sumR=+21.0 exp=+0.13R pnl=$86  → balance $586 maxDD 44.9%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-300
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus dirOverlay
  ALL:  T= 224 WR= 33% PF= 0.94 sumR=-9.6 exp=-0.04R pnl=$-88  → balance $412 maxDD 51.9%
  2026: T=  53 WR= 30% PF= 0.88 sumR=-4.7 exp=-0.09R pnl=$-264
  blocks: regimeGate=5988 atrPct=955 shortConf=874 ddMonthly=675 maxOpen=553 exposure=452 killSwitch=283 ddRolling7d=145 cooldown=64 ddDaily=60 dailyTrend=18 ddGuard=4 groupCap=3

## minus dailyTrend
  ALL:  T= 160 WR= 39% PF= 1.21 sumR=+21.0 exp=+0.13R pnl=$86  → balance $586 maxDD 44.9%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-300
  blocks: regimeGate=6052 atrPct=1075 shortConf=879 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 groupCap=4

## minus weeklyTrend
  ALL:  T= 160 WR= 39% PF= 1.21 sumR=+21.0 exp=+0.13R pnl=$86  → balance $586 maxDD 44.9%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-300
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus shortConf
  ALL:  T= 217 WR= 39% PF= 1.20 sumR=+26.9 exp=+0.12R pnl=$14  → balance $514 maxDD 18.0%
  2026: T=  43 WR= 37% PF= 1.14 sumR=+3.6 exp=+0.08R pnl=$-34
  blocks: regimeGate=6145 maxOpen=1570 atrPct=936 exposure=874 dirOverlay=383 killSwitch=57 cooldown=51 ddRolling7d=33 groupCap=23 dailyTrend=9

## minus atrPct
  ALL:  T= 315 WR= 40% PF= 1.24 sumR=+45.5 exp=+0.14R pnl=$67  → balance $567 maxDD 60.2%
  2026: T=  71 WR= 39% PF= 1.23 sumR=+10.1 exp=+0.14R pnl=$-73
  blocks: regimeGate=5385 ddMonthly=1062 maxOpen=1039 shortConf=831 exposure=690 dirOverlay=395 ddRolling7d=332 ddDaily=99 cooldown=93 killSwitch=46 dailyTrend=11

## minus btcCap
  ALL:  T= 223 WR= 40% PF= 1.27 sumR=+37.4 exp=+0.17R pnl=$112  → balance $612 maxDD 61.8%
  2026: T=  75 WR= 33% PF= 1.01 sumR=+0.5 exp=+0.01R pnl=$-420
  blocks: regimeGate=5932 atrPct=1118 shortConf=900 ddMonthly=705 exposure=505 dirOverlay=350 ddRolling7d=207 maxOpen=89 killSwitch=83 ddDaily=79 cooldown=67 groupCap=28 dailyTrend=12

## minus groupCap
  ALL:  T= 160 WR= 39% PF= 1.21 sumR=+21.0 exp=+0.13R pnl=$86  → balance $586 maxDD 44.9%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-300
  blocks: regimeGate=6052 atrPct=1076 shortConf=868 ddMonthly=525 maxOpen=521 exposure=396 dirOverlay=362 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11

## minus killSwitch
  ALL:  T= 164 WR= 39% PF= 1.20 sumR=+20.4 exp=+0.12R pnl=$99  → balance $599 maxDD 43.4%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-282
  blocks: regimeGate=6047 atrPct=1075 shortConf=869 maxOpen=557 ddMonthly=525 exposure=404 dirOverlay=361 ddRolling7d=163 ddDaily=60 cooldown=58 dailyTrend=11 groupCap=4

## minus ddDaily
  ALL:  T= 160 WR= 39% PF= 1.21 sumR=+21.0 exp=+0.13R pnl=$86  → balance $586 maxDD 44.9%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-300
  blocks: regimeGate=6057 atrPct=1098 shortConf=888 ddMonthly=535 maxOpen=520 exposure=396 dirOverlay=362 ddRolling7d=163 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus ddMonthly
  ALL:  T= 170 WR= 39% PF= 1.18 sumR=+19.1 exp=+0.11R pnl=$112  → balance $612 maxDD 46.6%
  2026: T=  53 WR= 28% PF= 0.80 sumR=-7.9 exp=-0.15R pnl=$-325
  blocks: regimeGate=6321 atrPct=1099 shortConf=870 maxOpen=522 exposure=426 dirOverlay=364 ddRolling7d=284 killSwitch=104 ddDaily=60 cooldown=57 dailyTrend=17 groupCap=4

## minus ddRolling
  ALL:  T= 169 WR= 40% PF= 1.27 sumR=+28.2 exp=+0.17R pnl=$203  → balance $703 maxDD 41.3%
  2026: T=  55 WR= 35% PF= 1.10 sumR=+3.8 exp=+0.07R pnl=$-148
  blocks: regimeGate=5921 atrPct=1093 shortConf=848 ddMonthly=762 maxOpen=531 exposure=401 dirOverlay=375 killSwitch=68 ddDaily=61 cooldown=54 dailyTrend=11 groupCap=4

## minus kelly
  ALL:  T= 176 WR= 39% PF= 1.21 sumR=+23.2 exp=+0.13R pnl=$250  → balance $750 maxDD 21.0%
  2026: T=  58 WR= 31% PF= 0.94 sumR=-2.8 exp=-0.05R pnl=$-69
  blocks: regimeGate=6422 atrPct=1154 shortConf=913 maxOpen=531 exposure=427 dirOverlay=426 killSwitch=118 cooldown=56 ddRolling7d=56 dailyTrend=13 groupCap=4 ddDaily=2

## minus riskMult
  ALL:  T= 168 WR= 39% PF= 1.20 sumR=+20.8 exp=+0.12R pnl=$129  → balance $629 maxDD 41.3%
  2026: T=  55 WR= 31% PF= 0.88 sumR=-4.7 exp=-0.09R pnl=$-211
  blocks: regimeGate=6106 atrPct=1089 shortConf=868 maxOpen=551 exposure=410 dirOverlay=364 ddMonthly=282 ddRolling7d=219 killSwitch=106 ddDaily=60 cooldown=55 dailyTrend=16 groupCap=4

## minus ddGuard
  ALL:  T= 160 WR= 39% PF= 1.21 sumR=+21.0 exp=+0.13R pnl=$86  → balance $586 maxDD 44.9%
  2026: T=  47 WR= 30% PF= 0.87 sumR=-4.5 exp=-0.10R pnl=$-300
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus regimeGate
  ALL:  T= 751 WR= 30% PF= 0.90 sumR=-57.3 exp=-0.08R pnl=$-109  → balance $391 maxDD 55.3%
  2026: T= 187 WR= 28% PF= 0.80 sumR=-28.6 exp=-0.15R pnl=$-207
  blocks: killSwitch=2175 maxOpen=1803 atrPct=1651 shortConf=1242 exposure=842 ddMonthly=765 dirOverlay=359 ddGuard=217 ddRolling7d=190 cooldown=188 ddDaily=62 dailyTrend=40 groupCap=13

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T= 805 WR= 36% PF= 1.09 sumR=+48.8 exp=+0.06R pnl=$90  → balance $590 maxDD 73.1%
  2026: T= 174 WR= 37% PF= 1.11 sumR=+13.0 exp=+0.07R pnl=$18
  blocks: regimeGate=5305 exposure=2408 maxOpen=1520 cooldown=186 ddGuard=74

## LS-only BASELINE
  ALL:  T=  69 WR= 29% PF= 0.87 sumR=-7.1 exp=-0.10R pnl=$-20  → balance $480 maxDD 11.3%
  2026: T=  65 WR= 31% PF= 0.94 sumR=-2.8 exp=-0.04R pnl=$6
  blocks: regimeGate=6580 dirOverlay=454 atrPct=391 killSwitch=213 maxOpen=77 exposure=57 shortConf=24 dailyTrend=24 cooldown=14 ddGuard=4

## LS-only LEAN
  ALL:  T= 583 WR= 30% PF= 0.91 sumR=-41.1 exp=-0.07R pnl=$-421  → balance $79 maxDD 92.0%
  2026: T= 268 WR= 35% PF= 1.08 sumR=+14.6 exp=+0.05R pnl=$-11
  blocks: regimeGate=6347 exposure=547 ddGuard=238 cooldown=113 maxOpen=79

## LS+RSI LEAN
  ALL:  T= 583 WR= 30% PF= 0.91 sumR=-41.1 exp=-0.07R pnl=$-421  → balance $79 maxDD 92.0%
  2026: T= 268 WR= 35% PF= 1.08 sumR=+14.6 exp=+0.05R pnl=$-11
  blocks: regimeGate=6347 exposure=547 ddGuard=238 cooldown=113 maxOpen=79

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 329 WR= 33% PF= 1.10 sumR=+22.4 exp=+0.07R pnl=$-113  → balance $387 maxDD 43.7%
  2026: T= 161 WR= 41% PF= 1.39 sumR=+40.8 exp=+0.25R pnl=$18
  blocks: regimeGate=6475 killSwitch=558 exposure=308 ddGuard=131 cooldown=73 maxOpen=25 ddDaily=8

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 329 WR= 33% PF= 1.10 sumR=+22.4 exp=+0.07R pnl=$-113  → balance $387 maxDD 43.7%
  2026: T= 161 WR= 41% PF= 1.39 sumR=+40.8 exp=+0.25R pnl=$18
  blocks: regimeGate=6475 killSwitch=558 exposure=308 ddGuard=131 cooldown=73 maxOpen=25 ddDaily=8

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 331 WR= 34% PF= 1.11 sumR=+24.8 exp=+0.07R pnl=$-108  → balance $392 maxDD 45.9%
  2026: T= 165 WR= 42% PF= 1.43 sumR=+44.5 exp=+0.27R pnl=$25
  blocks: regimeGate=6453 killSwitch=532 exposure=313 ddGuard=154 cooldown=72 maxOpen=24 groupCap=20 ddDaily=8

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 332 WR= 35% PF= 1.11 sumR=+26.7 exp=+0.08R pnl=$-77  → balance $423 maxDD 43.7%
  2026: T= 164 WR= 43% PF= 1.45 sumR=+45.0 exp=+0.27R pnl=$54
  blocks: regimeGate=6315 killSwitch=439 exposure=311 ddRolling7d=282 ddGuard=102 cooldown=73 ddDaily=28 maxOpen=25

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 334 WR= 35% PF= 1.12 sumR=+29.1 exp=+0.09R pnl=$-68  → balance $432 maxDD 43.0%
  2026: T= 168 WR= 44% PF= 1.48 sumR=+48.8 exp=+0.29R pnl=$64
  blocks: regimeGate=6293 killSwitch=413 exposure=316 ddRolling7d=282 ddGuard=125 cooldown=72 ddDaily=28 maxOpen=24 groupCap=20

## PROPOSED-F (= E without kelly)
  ALL:  T= 315 WR= 33% PF= 1.08 sumR=+18.6 exp=+0.06R pnl=$-159  → balance $341 maxDD 81.8%
  2026: T= 154 WR= 41% PF= 1.37 sumR=+36.5 exp=+0.24R pnl=$138
  blocks: regimeGate=6049 ddRolling7d=810 exposure=299 ddGuard=162 killSwitch=82 ddDaily=73 cooldown=73 maxOpen=25 groupCap=19

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  57 WR= 35% PF= 0.94 sumR=-2.3 exp=-0.04R pnl=$-48
  LONG  · BTC daily neutral T= 216 WR= 41% PF= 1.20 sumR=+26.1 exp=+0.12R pnl=$135
  LONG  · BTC daily down    T=   8 WR= 25% PF= 0.65 sumR=-2.1 exp=-0.26R pnl=$-68
  SHORT · BTC daily up      T= 143 WR= 34% PF= 1.06 sumR=+6.1 exp=+0.04R pnl=$23
  SHORT · BTC daily neutral T=  96 WR= 44% PF= 1.10 sumR=+5.2 exp=+0.05R pnl=$42
  SHORT · BTC daily down    T=  41 WR= 54% PF= 2.05 sumR=+19.9 exp=+0.49R pnl=$223
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 219 WR= 40% PF= 1.13 sumR=+17.5 exp=+0.08R pnl=$88
  LONG  · BTC weekly neutral T=  25 WR= 40% PF= 1.29 sumR=+4.4 exp=+0.18R pnl=$-2
  LONG  · BTC weekly down    T=  37 WR= 38% PF= 0.99 sumR=-0.3 exp=-0.01R pnl=$-68
  SHORT · BTC weekly up      T= 198 WR= 41% PF= 1.24 sumR=+29.4 exp=+0.15R pnl=$223
  SHORT · BTC weekly neutral T=  25 WR= 56% PF= 2.32 sumR=+15.3 exp=+0.61R pnl=$322
  SHORT · BTC weekly down    T=  57 WR= 30% PF= 0.67 sumR=-13.5 exp=-0.24R pnl=$-257

## Direction × BTC regime — ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  LONG  · BTC daily up      T=  57 WR= 35% PF= 0.94 sumR=-2.3 exp=-0.04R pnl=$-65
  LONG  · BTC daily neutral T= 216 WR= 41% PF= 1.20 sumR=+26.1 exp=+0.12R pnl=$135
  LONG  · BTC daily down    T=   8 WR= 25% PF= 0.65 sumR=-2.1 exp=-0.26R pnl=$-52
  SHORT · BTC daily up      T= 143 WR= 34% PF= 1.06 sumR=+6.1 exp=+0.04R pnl=$12
  SHORT · BTC daily neutral T=  96 WR= 44% PF= 1.10 sumR=+5.2 exp=+0.05R pnl=$43
  SHORT · BTC daily down    T=  41 WR= 54% PF= 2.05 sumR=+19.9 exp=+0.49R pnl=$158
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 219 WR= 40% PF= 1.13 sumR=+17.5 exp=+0.08R pnl=$90
  LONG  · BTC weekly neutral T=  25 WR= 40% PF= 1.29 sumR=+4.4 exp=+0.18R pnl=$10
  LONG  · BTC weekly down    T=  37 WR= 38% PF= 0.99 sumR=-0.3 exp=-0.01R pnl=$-82
  SHORT · BTC weekly up      T= 198 WR= 41% PF= 1.24 sumR=+29.4 exp=+0.15R pnl=$184
  SHORT · BTC weekly neutral T=  25 WR= 56% PF= 2.32 sumR=+15.3 exp=+0.61R pnl=$308
  SHORT · BTC weekly down    T=  57 WR= 30% PF= 0.67 sumR=-13.5 exp=-0.24R pnl=$-279

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  liquidity-sweep    ALL:  T= 139 WR= 33% PF= 1.01 sumR=+0.9 exp=+0.01R pnl=$-43
                     2026: T=  56 WR= 39% PF= 1.16 sumR=+5.6 exp=+0.10R pnl=$28
  tsmom-daily        ALL:  T= 422 WR= 42% PF= 1.21 sumR=+52.0 exp=+0.12R pnl=$350
                     2026: T=  56 WR= 39% PF= 1.00 sumR=-0.1 exp=-0.00R pnl=$-55

## Per-strategy — ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  liquidity-sweep    ALL:  T= 139 WR= 33% PF= 1.01 sumR=+0.9 exp=+0.01R pnl=$-65
                     2026: T=  56 WR= 39% PF= 1.16 sumR=+5.6 exp=+0.10R pnl=$33
  tsmom-daily        ALL:  T= 422 WR= 42% PF= 1.21 sumR=+52.0 exp=+0.12R pnl=$296
                     2026: T=  56 WR= 39% PF= 1.00 sumR=-0.1 exp=-0.00R pnl=$-34

## Per-strategy — BASELINE (all gates)
  liquidity-sweep    ALL:  T=  32 WR= 34% PF= 1.10 sumR=+2.4 exp=+0.07R pnl=$-24
                     2026: T=  28 WR= 39% PF= 1.36 sumR=+6.7 exp=+0.24R pnl=$9
  tsmom-daily        ALL:  T= 128 WR= 41% PF= 1.24 sumR=+18.6 exp=+0.15R pnl=$110
                     2026: T=  19 WR= 16% PF= 0.31 sumR=-11.2 exp=-0.59R pnl=$-309

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  liquidity-sweep    ALL:  T= 221 WR= 32% PF= 1.03 sumR=+5.6 exp=+0.03R pnl=$-48
                     2026: T=  94 WR= 38% PF= 1.27 sumR=+17.3 exp=+0.18R pnl=$104
  tsmom-daily        ALL:  T= 584 WR= 38% PF= 1.12 sumR=+43.2 exp=+0.07R pnl=$138
                     2026: T=  80 WR= 35% PF= 0.91 sumR=-4.3 exp=-0.05R pnl=$-86

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  liquidity-sweep    ALL:  T= 329 WR= 33% PF= 1.10 sumR=+22.4 exp=+0.07R pnl=$-113
                     2026: T= 161 WR= 41% PF= 1.39 sumR=+40.8 exp=+0.25R pnl=$18

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  liquidity-sweep    ALL:  T= 329 WR= 33% PF= 1.10 sumR=+22.4 exp=+0.07R pnl=$-113
                     2026: T= 161 WR= 41% PF= 1.39 sumR=+40.8 exp=+0.25R pnl=$18

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  liquidity-sweep    ALL:  T= 331 WR= 34% PF= 1.11 sumR=+24.8 exp=+0.07R pnl=$-108
                     2026: T= 165 WR= 42% PF= 1.43 sumR=+44.5 exp=+0.27R pnl=$25

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  liquidity-sweep    ALL:  T= 332 WR= 35% PF= 1.11 sumR=+26.7 exp=+0.08R pnl=$-77
                     2026: T= 164 WR= 43% PF= 1.45 sumR=+45.0 exp=+0.27R pnl=$54

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  liquidity-sweep    ALL:  T= 334 WR= 35% PF= 1.12 sumR=+29.1 exp=+0.09R pnl=$-68
                     2026: T= 168 WR= 44% PF= 1.48 sumR=+48.8 exp=+0.29R pnl=$64

## Per-strategy — PROPOSED-F (= E without kelly)
  liquidity-sweep    ALL:  T= 315 WR= 33% PF= 1.08 sumR=+18.6 exp=+0.06R pnl=$-159
                     2026: T= 154 WR= 41% PF= 1.37 sumR=+36.5 exp=+0.24R pnl=$138

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-10  $-20.46
  2022-11  $-42.64
  2022-12  $-8.84
  2023-01  +$103.83
  2023-02  $-79.18
  2023-03  $-138.07
  2023-04  $-3.31
  2023-05  $-12.63
  2023-06  +$42.37
  2023-07  $-12.33
  2023-08  $-24.95
  2023-09  +$16.09
  2023-10  +$7.99
  2023-11  +$65.17
  2023-12  +$153.84
  2024-01  $-5.53
  2024-02  +$31.94
  2024-03  $-57.67
  2024-04  $-41.49
  2024-05  +$3.07
  2024-06  $-19.21
  2024-07  +$2.74
  2024-08  +$11.39
  2024-10  +$52.13
  2024-11  +$4.46
  2024-12  +$40.69
  2025-01  $-34.53
  2025-05  $-30.85
  2025-06  $-2.97
  2025-07  +$48.66
  2025-08  $-45.69
  2025-09  +$16.28
  2025-10  +$77.97
  2025-11  +$47.00
  2026-01  +$81.26
  2026-02  +$52.64
  2026-03  +$8.72
  2026-04  +$33.39
  2026-05  +$330.15
  2026-06  $-25.97
  2026-07  +$31.69
  2026-08  $-338.76
  2026-09  $-11.47