# Full-Pipeline Portfolio Validation — 2026-09-07
Capital $500 · base risk 2% · candles 8000 · feed MEXC futures (engine feed) · entry slip 0 bps · gates mirror server/routes.ts (drawdown guard 12/6R over 30d, regime gates from the registry)
Entry = signal candle close (since 2026-09-01). Unmodeled: spread/funding filters, engine downtime; slippage only via --slip.

Total raw candidates (post minSL+R:R): 5392

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 463 WR= 40% PF= 1.12 sumR=+34.8 exp=+0.08R pnl=$53  → balance $553 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.0 exp=-0.02R pnl=$-90
  blocks: regimeGate=1864 maxOpen=1409 exposure=1378 cooldown=126 groupCap=117 ddGuard=35

## CAP maxOpen=8
  ALL:  T= 534 WR= 39% PF= 1.21 sumR=+70.5 exp=+0.13R pnl=$760  → balance $1260 maxDD 40.4%
  2026: T= 119 WR= 39% PF= 1.24 sumR=+18.0 exp=+0.15R pnl=$384
  blocks: regimeGate=2026 maxOpen=1488 exposure=1141 cooldown=134 groupCap=60 ddGuard=9

## CAP maxOpen=10
  ALL:  T= 641 WR= 39% PF= 1.19 sumR=+77.4 exp=+0.12R pnl=$583  → balance $1083 maxDD 52.1%
  2026: T= 158 WR= 38% PF= 1.21 sumR=+21.9 exp=+0.14R pnl=$299
  blocks: regimeGate=1960 exposure=1314 maxOpen=1153 cooldown=162 groupCap=120 ddGuard=42

## CAP perSymbol=2
  ALL:  T= 647 WR= 38% PF= 1.19 sumR=+78.9 exp=+0.12R pnl=$625  → balance $1125 maxDD 52.1%
  2026: T= 164 WR= 37% PF= 1.22 sumR=+23.4 exp=+0.14R pnl=$340
  blocks: regimeGate=2371 maxOpen=1239 exposure=808 cooldown=164 groupCap=126 ddGuard=37

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 546 WR= 39% PF= 1.22 sumR=+74.1 exp=+0.14R pnl=$881  → balance $1381 maxDD 40.4%
  2026: T= 130 WR= 39% PF= 1.27 sumR=+22.7 exp=+0.17R pnl=$528
  blocks: regimeGate=2377 maxOpen=1534 exposure=706 cooldown=135 groupCap=70 ddGuard=24

## CAP LS cooldown 8h
  ALL:  T= 642 WR= 39% PF= 1.20 sumR=+80.8 exp=+0.13R pnl=$656  → balance $1156 maxDD 52.1%
  2026: T= 159 WR= 38% PF= 1.25 sumR=+25.4 exp=+0.16R pnl=$371
  blocks: regimeGate=1961 exposure=1315 maxOpen=1153 cooldown=157 groupCap=120 ddGuard=44

## CAP LS cooldown 6h
  ALL:  T= 642 WR= 39% PF= 1.20 sumR=+80.8 exp=+0.13R pnl=$656  → balance $1156 maxDD 52.1%
  2026: T= 159 WR= 38% PF= 1.25 sumR=+25.4 exp=+0.16R pnl=$371
  blocks: regimeGate=1961 exposure=1315 maxOpen=1153 cooldown=157 groupCap=120 ddGuard=44

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 546 WR= 39% PF= 1.22 sumR=+74.1 exp=+0.14R pnl=$881  → balance $1381 maxDD 40.4%
  2026: T= 130 WR= 39% PF= 1.27 sumR=+22.7 exp=+0.17R pnl=$528
  blocks: regimeGate=2378 maxOpen=1534 exposure=706 cooldown=134 groupCap=70 ddGuard=24

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 647 WR= 38% PF= 1.19 sumR=+78.9 exp=+0.12R pnl=$625  → balance $1125 maxDD 52.1%
  2026: T= 164 WR= 37% PF= 1.22 sumR=+23.4 exp=+0.14R pnl=$340
  blocks: regimeGate=2371 maxOpen=1239 exposure=808 cooldown=164 groupCap=126 ddGuard=37

## CAP maxOpen=12
  ALL:  T= 739 WR= 38% PF= 1.18 sumR=+83.6 exp=+0.11R pnl=$536  → balance $1036 maxDD 63.7%
  2026: T= 209 WR= 36% PF= 1.10 sumR=+13.7 exp=+0.07R pnl=$56
  blocks: regimeGate=1918 exposure=1497 maxOpen=789 groupCap=252 cooldown=180 ddGuard=17

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 621 WR= 38% PF= 1.19 sumR=+75.4 exp=+0.12R pnl=$653  → balance $1153 maxDD 63.1%
  2026: T= 163 WR= 36% PF= 1.12 sumR=+13.7 exp=+0.08R pnl=$136
  blocks: regimeGate=1982 exposure=1246 maxOpen=912 groupCap=461 cooldown=146 ddGuard=24

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 739 WR= 38% PF= 1.18 sumR=+83.6 exp=+0.11R pnl=$536  → balance $1036 maxDD 63.7%
  2026: T= 209 WR= 36% PF= 1.10 sumR=+13.7 exp=+0.07R pnl=$56
  blocks: regimeGate=1918 exposure=1497 maxOpen=789 groupCap=252 cooldown=180 ddGuard=17

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 632 WR= 39% PF= 1.09 sumR=+36.5 exp=+0.06R pnl=$36  → balance $536 maxDD 61.6%
  2026: T= 128 WR= 41% PF= 1.25 sumR=+19.6 exp=+0.15R pnl=$157
  blocks: regimeGate=1836 exposure=1279 maxOpen=1145 cooldown=304 groupCap=149 ddGuard=47

## EXIT tp1Close=50%
  ALL:  T= 638 WR= 39% PF= 1.23 sumR=+93.0 exp=+0.15R pnl=$996  → balance $1496 maxDD 52.1%
  2026: T= 155 WR= 39% PF= 1.30 sumR=+29.3 exp=+0.19R pnl=$602
  blocks: regimeGate=1962 exposure=1312 maxOpen=1163 cooldown=162 groupCap=120 ddGuard=35

## EXIT tp1Close=75%
  ALL:  T= 641 WR= 39% PF= 1.16 sumR=+64.5 exp=+0.10R pnl=$384  → balance $884 maxDD 52.2%
  2026: T= 158 WR= 38% PF= 1.21 sumR=+21.5 exp=+0.14R pnl=$240
  blocks: regimeGate=1960 exposure=1314 maxOpen=1153 cooldown=162 groupCap=120 ddGuard=42

## EXIT trail 1.5%
  ALL:  T= 642 WR= 39% PF= 1.20 sumR=+81.9 exp=+0.13R pnl=$847  → balance $1347 maxDD 52.1%
  2026: T= 161 WR= 40% PF= 1.31 sumR=+31.2 exp=+0.19R pnl=$611
  blocks: regimeGate=1973 exposure=1310 maxOpen=1153 cooldown=168 groupCap=125 ddGuard=21

## EXIT trail 3%
  ALL:  T= 635 WR= 39% PF= 1.19 sumR=+77.6 exp=+0.12R pnl=$663  → balance $1163 maxDD 51.5%
  2026: T= 155 WR= 38% PF= 1.23 sumR=+22.8 exp=+0.15R pnl=$373
  blocks: regimeGate=1967 exposure=1327 maxOpen=1157 cooldown=154 groupCap=120 ddGuard=32

## EXIT trail r_multiple 2R
  ALL:  T= 463 WR= 40% PF= 1.12 sumR=+34.8 exp=+0.08R pnl=$53  → balance $553 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.0 exp=-0.02R pnl=$-90
  blocks: regimeGate=1864 maxOpen=1409 exposure=1378 cooldown=126 groupCap=117 ddGuard=35

## TILT LONG:up 0.75x
  ALL:  T= 463 WR= 40% PF= 1.12 sumR=+34.8 exp=+0.08R pnl=$86  → balance $586 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.0 exp=-0.02R pnl=$-73
  blocks: regimeGate=1864 maxOpen=1409 exposure=1378 cooldown=126 groupCap=117 ddGuard=35

## TILT LONG:up 0.5x
  ALL:  T= 463 WR= 40% PF= 1.12 sumR=+34.8 exp=+0.08R pnl=$117  → balance $617 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.0 exp=-0.02R pnl=$-58
  blocks: regimeGate=1864 maxOpen=1409 exposure=1378 cooldown=126 groupCap=117 ddGuard=35

## TILT LONG:up blocked
  ALL:  T= 459 WR= 41% PF= 1.22 sumR=+63.1 exp=+0.14R pnl=$481  → balance $981 maxDD 44.4%
  2026: T= 119 WR= 39% PF= 1.33 sumR=+25.4 exp=+0.21R pnl=$315
  blocks: regimeGate=1876 exposure=1330 maxOpen=1258 sizeTilt=190 groupCap=139 cooldown=120 ddGuard=20

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 463 WR= 40% PF= 1.12 sumR=+34.8 exp=+0.08R pnl=$94  → balance $594 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.0 exp=-0.02R pnl=$-78
  blocks: regimeGate=1864 maxOpen=1409 exposure=1378 cooldown=126 groupCap=117 ddGuard=35

## SAMEDIR max 4
  ALL:  T= 299 WR= 43% PF= 1.35 sumR=+60.8 exp=+0.20R pnl=$1009  → balance $1509 maxDD 22.5%
  2026: T=  83 WR= 41% PF= 1.37 sumR=+18.3 exp=+0.22R pnl=$485
  blocks: regimeGate=2112 sameDir=1887 exposure=813 groupCap=191 cooldown=90

## SAMEDIR max 5
  ALL:  T= 345 WR= 43% PF= 1.33 sumR=+66.4 exp=+0.19R pnl=$1070  → balance $1570 maxDD 30.9%
  2026: T=  93 WR= 42% PF= 1.37 sumR=+20.6 exp=+0.22R pnl=$564
  blocks: regimeGate=2071 sameDir=1587 exposure=937 groupCap=334 cooldown=98 maxOpen=20

## SAMEDIR max 6
  ALL:  T= 392 WR= 41% PF= 1.22 sumR=+52.5 exp=+0.13R pnl=$548  → balance $1048 maxDD 30.1%
  2026: T= 111 WR= 37% PF= 1.09 sumR=+6.4 exp=+0.06R pnl=$87
  blocks: regimeGate=2026 sameDir=1290 exposure=1053 groupCap=363 maxOpen=157 cooldown=111

## SAMEDIR max 7
  ALL:  T= 413 WR= 40% PF= 1.16 sumR=+40.5 exp=+0.10R pnl=$239  → balance $739 maxDD 38.0%
  2026: T= 107 WR= 35% PF= 0.93 sumR=-5.0 exp=-0.05R pnl=$-138
  blocks: regimeGate=1970 exposure=1146 sameDir=1092 groupCap=377 maxOpen=264 cooldown=109 ddGuard=21

## VENUE Kraken (−LUNC)
  ALL:  T= 463 WR= 40% PF= 1.12 sumR=+34.8 exp=+0.08R pnl=$53  → balance $553 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.0 exp=-0.02R pnl=$-90
  blocks: regimeGate=1864 maxOpen=1409 exposure=1378 cooldown=126 groupCap=117 ddGuard=35

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 450 WR= 40% PF= 1.14 sumR=+39.5 exp=+0.09R pnl=$177  → balance $677 maxDD 45.3%
  2026: T=  97 WR= 39% PF= 1.15 sumR=+9.0 exp=+0.09R pnl=$67
  blocks: regimeGate=1707 exposure=1364 maxOpen=1227 cooldown=120 groupCap=119 ddGuard=8

## TRIAGE minus rsi-divergence
  ALL:  T= 256 WR= 40% PF= 1.36 sumR=+61.1 exp=+0.24R pnl=$701  → balance $1201 maxDD 66.4%
  2026: T= 253 WR= 40% PF= 1.36 sumR=+60.9 exp=+0.24R pnl=$698
  blocks: regimeGate=2278 exposure=280 cooldown=38 groupCap=36 ddGuard=36 maxOpen=20

## BASELINE (all gates)
  ALL:  T= 163 WR= 39% PF= 1.19 sumR=+20.0 exp=+0.12R pnl=$257  → balance $757 maxDD 47.3%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-432
  blocks: regimeGate=2310 shortConf=918 atrPct=862 maxOpen=456 exposure=247 ddRolling7d=191 ddDaily=57 killSwitch=48 cooldown=42 ddMonthly=39 dirOverlay=36 dailyTrend=15 groupCap=4 ddGuard=4

## minus dirOverlay
  ALL:  T= 146 WR= 39% PF= 1.22 sumR=+20.3 exp=+0.14R pnl=$11  → balance $511 maxDD 64.5%
  2026: T=  36 WR= 19% PF= 0.60 sumR=-12.9 exp=-0.36R pnl=$-652
  blocks: regimeGate=2017 shortConf=919 atrPct=789 ddMonthly=711 maxOpen=326 exposure=235 ddDaily=94 ddRolling7d=89 cooldown=37 dailyTrend=15 killSwitch=10 groupCap=4

## minus dailyTrend
  ALL:  T= 163 WR= 39% PF= 1.19 sumR=+20.0 exp=+0.12R pnl=$257  → balance $757 maxDD 47.3%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-432
  blocks: regimeGate=2310 shortConf=933 atrPct=862 maxOpen=456 exposure=247 ddRolling7d=191 ddDaily=57 killSwitch=48 cooldown=42 ddMonthly=39 dirOverlay=36 groupCap=4 ddGuard=4

## minus weeklyTrend
  ALL:  T= 163 WR= 39% PF= 1.19 sumR=+20.0 exp=+0.12R pnl=$257  → balance $757 maxDD 47.3%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-432
  blocks: regimeGate=2310 shortConf=918 atrPct=862 maxOpen=456 exposure=247 ddRolling7d=191 ddDaily=57 killSwitch=48 cooldown=42 ddMonthly=39 dirOverlay=36 dailyTrend=15 groupCap=4 ddGuard=4

## minus shortConf
  ALL:  T= 200 WR= 40% PF= 1.25 sumR=+30.3 exp=+0.15R pnl=$137  → balance $637 maxDD 33.6%
  2026: T=  33 WR= 24% PF= 0.66 sumR=-8.4 exp=-0.25R pnl=$-347
  blocks: regimeGate=2197 maxOpen=1416 atrPct=692 exposure=461 ddMonthly=198 dirOverlay=58 cooldown=55 killSwitch=49 ddDaily=44 ddRolling7d=10 groupCap=6 dailyTrend=6

## minus atrPct
  ALL:  T= 294 WR= 39% PF= 1.18 sumR=+32.9 exp=+0.11R pnl=$23  → balance $523 maxDD 71.7%
  2026: T=  59 WR= 34% PF= 0.81 sumR=-7.9 exp=-0.13R pnl=$-327
  blocks: regimeGate=2122 shortConf=896 maxOpen=829 ddMonthly=543 exposure=369 ddRolling7d=86 cooldown=78 dirOverlay=70 ddDaily=51 killSwitch=24 ddGuard=21 dailyTrend=5 groupCap=4

## minus btcCap
  ALL:  T= 209 WR= 41% PF= 1.32 sumR=+41.8 exp=+0.20R pnl=$88  → balance $588 maxDD 70.2%
  2026: T=  68 WR= 29% PF= 0.92 sumR=-4.4 exp=-0.06R pnl=$-651
  blocks: regimeGate=2137 shortConf=957 atrPct=868 ddMonthly=415 exposure=318 ddRolling7d=143 maxOpen=84 ddDaily=62 dirOverlay=57 cooldown=52 dailyTrend=30 groupCap=28 ddGuard=17 killSwitch=15

## minus groupCap
  ALL:  T= 164 WR= 39% PF= 1.21 sumR=+21.9 exp=+0.13R pnl=$263  → balance $763 maxDD 47.3%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-435
  blocks: regimeGate=2310 shortConf=920 atrPct=863 maxOpen=456 exposure=248 ddRolling7d=191 ddDaily=57 killSwitch=48 cooldown=41 ddMonthly=39 dirOverlay=36 dailyTrend=15 ddGuard=4

## minus killSwitch
  ALL:  T= 164 WR= 37% PF= 1.12 sumR=+13.3 exp=+0.08R pnl=$125  → balance $625 maxDD 56.5%
  2026: T=  55 WR= 20% PF= 0.57 sumR=-20.9 exp=-0.38R pnl=$-564
  blocks: regimeGate=2221 shortConf=918 atrPct=832 maxOpen=421 exposure=242 ddMonthly=239 ddRolling7d=150 ddDaily=65 dirOverlay=61 cooldown=39 ddGuard=21 dailyTrend=15 groupCap=4

## minus ddDaily
  ALL:  T= 163 WR= 39% PF= 1.19 sumR=+20.0 exp=+0.12R pnl=$257  → balance $757 maxDD 47.3%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-432
  blocks: regimeGate=2312 shortConf=938 atrPct=894 maxOpen=456 exposure=247 ddRolling7d=193 killSwitch=48 cooldown=42 ddMonthly=40 dirOverlay=36 dailyTrend=15 groupCap=4 ddGuard=4

## minus ddMonthly
  ALL:  T= 166 WR= 39% PF= 1.21 sumR=+22.6 exp=+0.14R pnl=$331  → balance $831 maxDD 47.3%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-474
  blocks: regimeGate=2310 shortConf=925 atrPct=875 maxOpen=456 exposure=256 ddRolling7d=196 ddDaily=57 killSwitch=48 cooldown=44 dirOverlay=36 dailyTrend=15 groupCap=4 ddGuard=4

## minus ddRolling
  ALL:  T= 152 WR= 39% PF= 1.23 sumR=+22.7 exp=+0.15R pnl=$119  → balance $619 maxDD 56.7%
  2026: T=  43 WR= 21% PF= 0.70 sumR=-11.4 exp=-0.27R pnl=$-570
  blocks: regimeGate=2115 shortConf=953 atrPct=802 ddMonthly=601 maxOpen=373 exposure=221 ddDaily=73 cooldown=38 dirOverlay=25 dailyTrend=18 killSwitch=17 groupCap=4

## minus kelly
  ALL:  T= 168 WR= 39% PF= 1.24 sumR=+25.7 exp=+0.15R pnl=$238  → balance $738 maxDD 32.9%
  2026: T=  56 WR= 25% PF= 0.76 sumR=-11.1 exp=-0.20R pnl=$-240
  blocks: regimeGate=2260 shortConf=976 atrPct=887 maxOpen=473 exposure=265 ddMonthly=153 dirOverlay=62 cooldown=44 killSwitch=44 dailyTrend=27 ddRolling7d=24 groupCap=4 ddGuard=4 ddDaily=1

## minus riskMult
  ALL:  T= 167 WR= 40% PF= 1.23 sumR=+25.0 exp=+0.15R pnl=$349  → balance $849 maxDD 40.9%
  2026: T=  58 WR= 28% PF= 0.80 sumR=-9.2 exp=-0.16R pnl=$-277
  blocks: regimeGate=2307 shortConf=920 atrPct=867 maxOpen=480 exposure=260 ddRolling7d=133 ddDaily=57 killSwitch=55 cooldown=44 ddMonthly=39 dirOverlay=36 dailyTrend=19 groupCap=4 ddGuard=4

## minus ddGuard
  ALL:  T= 163 WR= 38% PF= 1.16 sumR=+17.2 exp=+0.11R pnl=$161  → balance $661 maxDD 54.0%
  2026: T=  54 WR= 22% PF= 0.63 sumR=-16.9 exp=-0.31R pnl=$-527
  blocks: regimeGate=2254 shortConf=914 atrPct=829 maxOpen=460 exposure=245 ddMonthly=192 ddRolling7d=134 ddDaily=57 killSwitch=48 cooldown=42 dirOverlay=35 dailyTrend=15 groupCap=4

## minus regimeGate
  ALL:  T= 341 WR= 35% PF= 1.09 sumR=+22.2 exp=+0.06R pnl=$234  → balance $734 maxDD 54.7%
  2026: T= 184 WR= 32% PF= 1.07 sumR=+9.7 exp=+0.05R pnl=$-223
  blocks: atrPct=1142 shortConf=1081 maxOpen=1054 killSwitch=543 exposure=408 dirOverlay=249 ddMonthly=246 ddRolling7d=120 cooldown=69 ddDaily=59 dailyTrend=46 ddGuard=32 groupCap=2

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T= 659 WR= 37% PF= 1.15 sumR=+63.7 exp=+0.10R pnl=$282  → balance $782 maxDD 55.8%
  2026: T= 157 WR= 38% PF= 1.18 sumR=+18.9 exp=+0.12R pnl=$98
  blocks: regimeGate=1932 exposure=1366 maxOpen=1238 cooldown=158 ddGuard=39

## LS-only BASELINE
  ALL:  T=  56 WR= 38% PF= 1.41 sumR=+16.1 exp=+0.29R pnl=$79  → balance $579 maxDD 30.2%
  2026: T=  56 WR= 38% PF= 1.41 sumR=+16.1 exp=+0.29R pnl=$79
  blocks: regimeGate=2212 ddMonthly=249 maxOpen=119 atrPct=73 exposure=58 killSwitch=39 shortConf=36 dailyTrend=32 dirOverlay=23 ddDaily=22 ddRolling7d=13 cooldown=12

## LS-only LEAN
  ALL:  T= 273 WR= 39% PF= 1.32 sumR=+60.0 exp=+0.22R pnl=$567  → balance $1067 maxDD 57.9%
  2026: T= 270 WR= 39% PF= 1.33 sumR=+59.9 exp=+0.22R pnl=$566
  blocks: regimeGate=2276 exposure=292 ddGuard=41 cooldown=33 maxOpen=29

## LS+RSI LEAN
  ALL:  T= 273 WR= 39% PF= 1.32 sumR=+60.0 exp=+0.22R pnl=$567  → balance $1067 maxDD 57.9%
  2026: T= 270 WR= 39% PF= 1.33 sumR=+59.9 exp=+0.22R pnl=$566
  blocks: regimeGate=2276 exposure=292 ddGuard=41 cooldown=33 maxOpen=29

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 188 WR= 40% PF= 1.40 sumR=+50.5 exp=+0.27R pnl=$423  → balance $923 maxDD 54.2%
  2026: T= 185 WR= 40% PF= 1.41 sumR=+50.5 exp=+0.27R pnl=$422
  blocks: regimeGate=2292 exposure=218 killSwitch=147 ddGuard=32 cooldown=23 maxOpen=23 ddDaily=21

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 188 WR= 40% PF= 1.40 sumR=+50.5 exp=+0.27R pnl=$423  → balance $923 maxDD 54.2%
  2026: T= 185 WR= 40% PF= 1.41 sumR=+50.5 exp=+0.27R pnl=$422
  blocks: regimeGate=2292 exposure=218 killSwitch=147 ddGuard=32 cooldown=23 maxOpen=23 ddDaily=21

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 179 WR= 40% PF= 1.35 sumR=+42.3 exp=+0.24R pnl=$73  → balance $573 maxDD 46.1%
  2026: T= 176 WR= 40% PF= 1.36 sumR=+42.3 exp=+0.24R pnl=$72
  blocks: regimeGate=2294 exposure=213 killSwitch=151 ddGuard=32 cooldown=23 groupCap=19 maxOpen=18 ddDaily=15

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 163 WR= 40% PF= 1.41 sumR=+44.7 exp=+0.27R pnl=$68  → balance $568 maxDD 50.5%
  2026: T= 160 WR= 41% PF= 1.42 sumR=+44.7 exp=+0.28R pnl=$67
  blocks: regimeGate=2099 ddRolling7d=401 exposure=173 ddGuard=40 ddDaily=26 cooldown=18 maxOpen=16 killSwitch=8

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 151 WR= 42% PF= 1.47 sumR=+46.1 exp=+0.31R pnl=$104  → balance $604 maxDD 52.8%
  2026: T= 148 WR= 42% PF= 1.48 sumR=+46.1 exp=+0.31R pnl=$103
  blocks: regimeGate=2128 ddRolling7d=378 exposure=176 ddGuard=42 killSwitch=18 cooldown=17 maxOpen=17 groupCap=14 ddDaily=3

## PROPOSED-F (= E without kelly)
  ALL:  T= 171 WR= 37% PF= 1.22 sumR=+26.1 exp=+0.15R pnl=$163  → balance $663 maxDD 47.9%
  2026: T= 168 WR= 38% PF= 1.22 sumR=+26.1 exp=+0.16R pnl=$163
  blocks: regimeGate=2167 ddRolling7d=226 exposure=205 killSwitch=55 ddGuard=38 ddDaily=27 cooldown=23 maxOpen=17 groupCap=15

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  56 WR= 32% PF= 0.76 sumR=-9.5 exp=-0.17R pnl=$-125
  LONG  · BTC daily neutral T= 213 WR= 38% PF= 1.09 sumR=+11.6 exp=+0.05R pnl=$19
  LONG  · BTC daily down    T=   9 WR= 44% PF= 1.53 sumR=+2.7 exp=+0.30R pnl=$23
  SHORT · BTC daily up      T=  52 WR= 33% PF= 0.95 sumR=-1.9 exp=-0.04R pnl=$-51
  SHORT · BTC daily neutral T=  96 WR= 42% PF= 1.01 sumR=+0.7 exp=+0.01R pnl=$-27
  SHORT · BTC daily down    T=  37 WR= 62% PF= 3.53 sumR=+31.2 exp=+0.84R pnl=$215
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 213 WR= 37% PF= 1.03 sumR=+4.1 exp=+0.02R pnl=$-33
  LONG  · BTC weekly neutral T=  26 WR= 35% PF= 0.90 sumR=-1.7 exp=-0.06R pnl=$-30
  LONG  · BTC weekly down    T=  39 WR= 41% PF= 1.10 sumR=+2.4 exp=+0.06R pnl=$-21
  SHORT · BTC weekly up      T= 110 WR= 47% PF= 1.41 sumR=+25.1 exp=+0.23R pnl=$84
  SHORT · BTC weekly neutral T=  27 WR= 41% PF= 1.25 sumR=+4.3 exp=+0.16R pnl=$43
  SHORT · BTC weekly down    T=  48 WR= 35% PF= 1.02 sumR=+0.5 exp=+0.01R pnl=$10

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  liquidity-sweep    ALL:  T=  49 WR= 33% PF= 0.94 sumR=-2.3 exp=-0.05R pnl=$-53
                     2026: T=  46 WR= 33% PF= 0.93 sumR=-2.5 exp=-0.06R pnl=$-56
  tsmom-daily        ALL:  T= 414 WR= 40% PF= 1.15 sumR=+37.1 exp=+0.09R pnl=$106
                     2026: T=  55 WR= 38% PF= 1.02 sumR=+0.5 exp=+0.01R pnl=$-34

## Per-strategy — BASELINE (all gates)
  liquidity-sweep    ALL:  T=  36 WR= 28% PF= 0.87 sumR=-3.9 exp=-0.11R pnl=$-60
                     2026: T=  36 WR= 28% PF= 0.87 sumR=-3.9 exp=-0.11R pnl=$-60
  tsmom-daily        ALL:  T= 127 WR= 42% PF= 1.32 sumR=+23.9 exp=+0.19R pnl=$317
                     2026: T=  18 WR= 17% PF= 0.33 sumR=-10.2 exp=-0.57R pnl=$-372

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  liquidity-sweep    ALL:  T=  81 WR= 40% PF= 1.38 sumR=+21.3 exp=+0.26R pnl=$155
                     2026: T=  78 WR= 40% PF= 1.40 sumR=+21.3 exp=+0.27R pnl=$155
  tsmom-daily        ALL:  T= 578 WR= 37% PF= 1.12 sumR=+42.4 exp=+0.07R pnl=$127
                     2026: T=  79 WR= 35% PF= 0.95 sumR=-2.5 exp=-0.03R pnl=$-56

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  liquidity-sweep    ALL:  T= 188 WR= 40% PF= 1.40 sumR=+50.5 exp=+0.27R pnl=$423
                     2026: T= 185 WR= 40% PF= 1.41 sumR=+50.5 exp=+0.27R pnl=$422

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  liquidity-sweep    ALL:  T= 188 WR= 40% PF= 1.40 sumR=+50.5 exp=+0.27R pnl=$423
                     2026: T= 185 WR= 40% PF= 1.41 sumR=+50.5 exp=+0.27R pnl=$422

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  liquidity-sweep    ALL:  T= 179 WR= 40% PF= 1.35 sumR=+42.3 exp=+0.24R pnl=$73
                     2026: T= 176 WR= 40% PF= 1.36 sumR=+42.3 exp=+0.24R pnl=$72

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  liquidity-sweep    ALL:  T= 163 WR= 40% PF= 1.41 sumR=+44.7 exp=+0.27R pnl=$68
                     2026: T= 160 WR= 41% PF= 1.42 sumR=+44.7 exp=+0.28R pnl=$67

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  liquidity-sweep    ALL:  T= 151 WR= 42% PF= 1.47 sumR=+46.1 exp=+0.31R pnl=$104
                     2026: T= 148 WR= 42% PF= 1.48 sumR=+46.1 exp=+0.31R pnl=$103

## Per-strategy — PROPOSED-F (= E without kelly)
  liquidity-sweep    ALL:  T= 171 WR= 37% PF= 1.22 sumR=+26.1 exp=+0.15R pnl=$163
                     2026: T= 168 WR= 38% PF= 1.22 sumR=+26.1 exp=+0.16R pnl=$163

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-10  $-20.39
  2022-11  $-61.58
  2022-12  +$0.93
  2023-01  +$33.89
  2023-02  $-23.61
  2023-03  $-130.30
  2023-04  $-2.88
  2023-05  $-12.07
  2023-06  +$50.20
  2023-07  $-24.10
  2023-08  $-16.95
  2023-09  +$8.57
  2023-10  +$14.47
  2023-11  +$50.61
  2023-12  +$108.70
  2024-01  $-25.65
  2024-02  $-8.82
  2024-03  $-30.88
  2024-04  $-24.60
  2024-05  $-23.04
  2024-06  $-14.84
  2024-07  $-7.78
  2024-08  $-6.88
  2024-09  $-6.71
  2024-10  +$52.51
  2024-11  +$21.91
  2024-12  +$9.51
  2025-01  $-24.97
  2025-05  +$9.08
  2025-06  +$7.18
  2025-07  +$18.01
  2025-08  +$19.40
  2025-09  +$8.33
  2025-10  +$34.63
  2025-11  +$41.78
  2026-01  $-40.25
  2026-02  +$17.62
  2026-04  +$104.10
  2026-05  +$5.97
  2026-06  +$12.96
  2026-07  +$24.65
  2026-08  $-48.57
  2026-09  $-46.88