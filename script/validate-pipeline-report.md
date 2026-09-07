# Full-Pipeline Portfolio Validation — 2026-09-07
Capital $500 · base risk 2% · candles 20000 · feed Binance spot · entry slip 0 bps · gates mirror server/routes.ts (drawdown guard 12/6R over 30d, regime gates from the registry)
Entry = signal candle close (since 2026-09-01). Unmodeled: spread/funding filters, engine downtime; slippage only via --slip.

Total raw candidates (post minSL+R:R): 10298

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$625  → balance $1125 maxDD 48.5%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$53
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$585  → balance $1085 maxDD 50.8%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$97
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## SLEEVE tsmom maxConcurrent=4
  ALL:  T= 650 WR= 36% PF= 1.13 sumR=+58.6 exp=+0.09R pnl=$348  → balance $848 maxDD 77.2%
  2026: T= 240 WR= 40% PF= 1.39 sumR=+61.0 exp=+0.25R pnl=$455
  blocks: regimeGate=5731 stratCap=1768 exposure=1533 ddGuard=208 maxOpen=174 cooldown=155 groupCap=79

## SLEEVE tsmom maxConcurrent=6
  ALL:  T= 648 WR= 37% PF= 1.16 sumR=+69.2 exp=+0.11R pnl=$540  → balance $1040 maxDD 66.0%
  2026: T= 198 WR= 42% PF= 1.45 sumR=+55.8 exp=+0.28R pnl=$572
  blocks: regimeGate=5487 exposure=1956 stratCap=1509 maxOpen=325 cooldown=167 groupCap=116 ddGuard=90

## CAP maxOpen=8
  ALL:  T= 623 WR= 37% PF= 1.12 sumR=+50.5 exp=+0.08R pnl=$281  → balance $781 maxDD 57.3%
  2026: T= 144 WR= 40% PF= 1.24 sumR=+22.3 exp=+0.16R pnl=$187
  blocks: regimeGate=5492 exposure=1997 maxOpen=1881 cooldown=167 groupCap=81 ddGuard=57

## CAP maxOpen=10
  ALL:  T= 784 WR= 38% PF= 1.19 sumR=+95.4 exp=+0.12R pnl=$847  → balance $1347 maxDD 60.4%
  2026: T= 169 WR= 39% PF= 1.24 sumR=+25.5 exp=+0.15R pnl=$300
  blocks: regimeGate=5296 exposure=2370 maxOpen=1374 cooldown=194 groupCap=178 ddGuard=102

## CAP perSymbol=2
  ALL:  T= 789 WR= 37% PF= 1.17 sumR=+88.3 exp=+0.11R pnl=$648  → balance $1148 maxDD 67.3%
  2026: T= 172 WR= 38% PF= 1.20 sumR=+22.3 exp=+0.13R pnl=$191
  blocks: regimeGate=6522 maxOpen=1590 exposure=919 cooldown=199 groupCap=182 ddGuard=97

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 638 WR= 38% PF= 1.16 sumR=+66.0 exp=+0.10R pnl=$551  → balance $1051 maxDD 49.8%
  2026: T= 138 WR= 40% PF= 1.26 sumR=+23.1 exp=+0.17R pnl=$273
  blocks: regimeGate=6545 maxOpen=2034 exposure=744 cooldown=164 groupCap=97 ddGuard=76

## CAP LS cooldown 8h
  ALL:  T= 784 WR= 38% PF= 1.19 sumR=+95.5 exp=+0.12R pnl=$845  → balance $1345 maxDD 60.5%
  2026: T= 169 WR= 39% PF= 1.24 sumR=+25.5 exp=+0.15R pnl=$300
  blocks: regimeGate=5302 exposure=2367 maxOpen=1378 cooldown=185 groupCap=178 ddGuard=104

## CAP LS cooldown 6h
  ALL:  T= 785 WR= 38% PF= 1.19 sumR=+98.4 exp=+0.13R pnl=$923  → balance $1423 maxDD 58.1%
  2026: T= 169 WR= 39% PF= 1.24 sumR=+25.5 exp=+0.15R pnl=$317
  blocks: regimeGate=5302 exposure=2367 maxOpen=1379 cooldown=183 groupCap=178 ddGuard=104

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 638 WR= 37% PF= 1.15 sumR=+62.3 exp=+0.10R pnl=$487  → balance $987 maxDD 53.1%
  2026: T= 138 WR= 40% PF= 1.26 sumR=+23.1 exp=+0.17R pnl=$257
  blocks: regimeGate=6535 maxOpen=2023 exposure=744 cooldown=155 ddGuard=106 groupCap=97

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 789 WR= 37% PF= 1.17 sumR=+88.3 exp=+0.11R pnl=$648  → balance $1148 maxDD 67.3%
  2026: T= 172 WR= 38% PF= 1.20 sumR=+22.3 exp=+0.13R pnl=$191
  blocks: regimeGate=6522 maxOpen=1590 exposure=919 cooldown=199 groupCap=182 ddGuard=97

## CAP maxOpen=12
  ALL:  T= 897 WR= 37% PF= 1.14 sumR=+82.9 exp=+0.09R pnl=$366  → balance $866 maxDD 68.7%
  2026: T= 210 WR= 38% PF= 1.14 sumR=+19.0 exp=+0.09R pnl=$35
  blocks: regimeGate=5134 exposure=2684 maxOpen=932 groupCap=309 cooldown=225 ddGuard=117

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 759 WR= 36% PF= 1.10 sumR=+48.5 exp=+0.06R pnl=$108  → balance $608 maxDD 67.8%
  2026: T= 152 WR= 38% PF= 1.17 sumR=+17.0 exp=+0.11R pnl=$65
  blocks: regimeGate=5373 exposure=2236 maxOpen=1096 groupCap=582 cooldown=186 ddGuard=66

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 897 WR= 37% PF= 1.14 sumR=+82.9 exp=+0.09R pnl=$366  → balance $866 maxDD 68.7%
  2026: T= 210 WR= 38% PF= 1.14 sumR=+19.0 exp=+0.09R pnl=$35
  blocks: regimeGate=5134 exposure=2684 maxOpen=932 groupCap=309 cooldown=225 ddGuard=117

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 824 WR= 38% PF= 1.10 sumR=+53.8 exp=+0.07R pnl=$82  → balance $582 maxDD 66.2%
  2026: T= 173 WR= 40% PF= 1.24 sumR=+26.6 exp=+0.15R pnl=$153
  blocks: regimeGate=5205 exposure=2329 maxOpen=1348 cooldown=346 groupCap=190 ddGuard=56

## EXIT tp1Close=50%
  ALL:  T= 784 WR= 38% PF= 1.21 sumR=+106.4 exp=+0.14R pnl=$1097  → balance $1597 maxDD 60.5%
  2026: T= 169 WR= 39% PF= 1.25 sumR=+26.6 exp=+0.16R pnl=$378
  blocks: regimeGate=5296 exposure=2370 maxOpen=1374 cooldown=194 groupCap=178 ddGuard=102

## EXIT tp1Close=75%
  ALL:  T= 784 WR= 38% PF= 1.15 sumR=+79.0 exp=+0.10R pnl=$537  → balance $1037 maxDD 60.4%
  2026: T= 169 WR= 39% PF= 1.22 sumR=+23.8 exp=+0.14R pnl=$208
  blocks: regimeGate=5296 exposure=2370 maxOpen=1374 cooldown=194 groupCap=178 ddGuard=102

## EXIT trail 1.5%
  ALL:  T= 792 WR= 37% PF= 1.17 sumR=+88.4 exp=+0.11R pnl=$670  → balance $1170 maxDD 61.0%
  2026: T= 169 WR= 39% PF= 1.24 sumR=+26.3 exp=+0.16R pnl=$275
  blocks: regimeGate=5286 exposure=2372 maxOpen=1371 cooldown=204 groupCap=171 ddGuard=102

## EXIT trail 3%
  ALL:  T= 803 WR= 37% PF= 1.16 sumR=+85.4 exp=+0.11R pnl=$595  → balance $1095 maxDD 61.1%
  2026: T= 189 WR= 38% PF= 1.13 sumR=+16.6 exp=+0.09R pnl=$64
  blocks: regimeGate=5332 exposure=2360 maxOpen=1349 cooldown=189 groupCap=168 ddGuard=97

## EXIT trail r_multiple 2R
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$625  → balance $1125 maxDD 48.5%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$53
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## TILT LONG:up 0.75x
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$600  → balance $1100 maxDD 48.5%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$18
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## TILT LONG:up 0.5x
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$573  → balance $1073 maxDD 48.5%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$-18
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## TILT LONG:up blocked
  ALL:  T= 606 WR= 39% PF= 1.21 sumR=+81.1 exp=+0.13R pnl=$698  → balance $1198 maxDD 60.0%
  2026: T= 111 WR= 45% PF= 1.53 sumR=+34.3 exp=+0.31R pnl=$423
  blocks: regimeGate=5113 exposure=2475 maxOpen=1527 groupCap=186 sizeTilt=161 cooldown=142 ddGuard=88

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$537  → balance $1037 maxDD 48.5%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$-47
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## SAMEDIR max 4
  ALL:  T= 366 WR= 41% PF= 1.28 sumR=+62.7 exp=+0.17R pnl=$898  → balance $1398 maxDD 34.4%
  2026: T=  75 WR= 47% PF= 1.57 sumR=+22.8 exp=+0.30R pnl=$456
  blocks: regimeGate=5770 sameDir=2276 exposure=1513 groupCap=257 cooldown=96 ddGuard=20

## SAMEDIR max 5
  ALL:  T= 436 WR= 40% PF= 1.24 sumR=+65.1 exp=+0.15R pnl=$844  → balance $1344 maxDD 39.4%
  2026: T=  92 WR= 43% PF= 1.39 sumR=+20.6 exp=+0.22R pnl=$380
  blocks: regimeGate=5617 exposure=1788 sameDir=1771 groupCap=339 maxOpen=186 cooldown=124 ddGuard=37

## SAMEDIR max 6
  ALL:  T= 467 WR= 41% PF= 1.25 sumR=+71.2 exp=+0.15R pnl=$969  → balance $1469 maxDD 40.4%
  2026: T= 108 WR= 44% PF= 1.46 sumR=+28.8 exp=+0.27R pnl=$538
  blocks: regimeGate=5488 exposure=1993 sameDir=1477 groupCap=368 maxOpen=355 cooldown=128 ddGuard=22

## SAMEDIR max 7
  ALL:  T= 482 WR= 41% PF= 1.27 sumR=+80.2 exp=+0.17R pnl=$1093  → balance $1593 maxDD 38.4%
  2026: T= 118 WR= 41% PF= 1.24 sumR=+17.2 exp=+0.15R pnl=$297
  blocks: regimeGate=5335 exposure=2202 sameDir=1219 maxOpen=520 groupCap=377 cooldown=123 ddGuard=40

## VENUE Kraken (−LUNC)
  ALL:  T= 567 WR= 40% PF= 1.21 sumR=+74.5 exp=+0.13R pnl=$625  → balance $1125 maxDD 48.5%
  2026: T= 119 WR= 40% PF= 1.15 sumR=+11.7 exp=+0.10R pnl=$53
  blocks: regimeGate=5068 exposure=2583 maxOpen=1770 cooldown=140 groupCap=133 ddGuard=37

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 557 WR= 40% PF= 1.19 sumR=+66.9 exp=+0.12R pnl=$545  → balance $1045 maxDD 48.5%
  2026: T= 124 WR= 40% PF= 1.23 sumR=+17.7 exp=+0.14R pnl=$148
  blocks: regimeGate=4570 exposure=2561 maxOpen=1525 groupCap=148 cooldown=131 ddGuard=31

## TRIAGE minus rsi-divergence
  ALL:  T= 560 WR= 31% PF= 0.96 sumR=-15.8 exp=-0.03R pnl=$-363  → balance $137 maxDD 90.2%
  2026: T= 257 WR= 36% PF= 1.17 sumR=+30.4 exp=+0.12R pnl=$23
  blocks: regimeGate=6341 exposure=528 ddGuard=256 cooldown=109 maxOpen=67 groupCap=46

## BASELINE (all gates)
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus dirOverlay
  ALL:  T= 223 WR= 33% PF= 0.96 sumR=-6.8 exp=-0.03R pnl=$-56  → balance $444 maxDD 50.7%
  2026: T=  53 WR= 30% PF= 0.96 sumR=-1.8 exp=-0.03R pnl=$-271
  blocks: regimeGate=5826 atrPct=951 shortConf=857 ddMonthly=735 maxOpen=552 exposure=445 ddRolling7d=339 killSwitch=218 cooldown=63 ddDaily=60 dailyTrend=16 ddGuard=9 groupCap=4

## minus dailyTrend
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1075 shortConf=879 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 groupCap=4

## minus weeklyTrend
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus shortConf
  ALL:  T= 217 WR= 39% PF= 1.23 sumR=+31.2 exp=+0.14R pnl=$55  → balance $555 maxDD 18.7%
  2026: T=  43 WR= 37% PF= 1.22 sumR=+5.9 exp=+0.14R pnl=$-14
  blocks: regimeGate=6145 maxOpen=1570 atrPct=936 exposure=874 dirOverlay=381 killSwitch=57 cooldown=51 ddRolling7d=33 groupCap=23 dailyTrend=9 ddDaily=2

## minus atrPct
  ALL:  T= 308 WR= 39% PF= 1.19 sumR=+37.0 exp=+0.12R pnl=$-58  → balance $442 maxDD 66.3%
  2026: T=  64 WR= 34% PF= 0.98 sumR=-0.9 exp=-0.01R pnl=$-277
  blocks: regimeGate=5347 ddMonthly=1146 maxOpen=976 shortConf=830 exposure=679 dirOverlay=387 ddRolling7d=383 cooldown=93 ddDaily=90 killSwitch=52 dailyTrend=7

## minus btcCap
  ALL:  T= 205 WR= 40% PF= 1.33 sumR=+42.6 exp=+0.21R pnl=$238  → balance $738 maxDD 61.4%
  2026: T=  57 WR= 32% PF= 1.08 sumR=+3.5 exp=+0.06R pnl=$-361
  blocks: regimeGate=5910 atrPct=1117 shortConf=887 ddMonthly=642 exposure=476 dirOverlay=402 ddRolling7d=338 maxOpen=81 ddDaily=79 cooldown=62 killSwitch=60 groupCap=30 dailyTrend=9

## minus groupCap
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$130  → balance $630 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-316
  blocks: regimeGate=6052 atrPct=1076 shortConf=868 ddMonthly=525 maxOpen=521 exposure=396 dirOverlay=362 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11

## minus killSwitch
  ALL:  T= 164 WR= 39% PF= 1.24 sumR=+24.7 exp=+0.15R pnl=$128  → balance $628 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-316
  blocks: regimeGate=6047 atrPct=1075 shortConf=869 maxOpen=557 ddMonthly=525 exposure=404 dirOverlay=361 ddRolling7d=163 ddDaily=60 cooldown=58 dailyTrend=11 groupCap=4

## minus ddDaily
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6057 atrPct=1098 shortConf=888 ddMonthly=535 maxOpen=520 exposure=396 dirOverlay=362 ddRolling7d=163 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus ddMonthly
  ALL:  T= 170 WR= 39% PF= 1.21 sumR=+23.4 exp=+0.14R pnl=$152  → balance $652 maxDD 48.0%
  2026: T=  53 WR= 28% PF= 0.87 sumR=-5.2 exp=-0.10R pnl=$-353
  blocks: regimeGate=6321 atrPct=1099 shortConf=870 maxOpen=522 exposure=426 dirOverlay=364 ddRolling7d=284 killSwitch=104 ddDaily=60 cooldown=57 dailyTrend=17 groupCap=4

## minus ddRolling
  ALL:  T= 169 WR= 40% PF= 1.32 sumR=+34.0 exp=+0.20R pnl=$373  → balance $873 maxDD 41.3%
  2026: T=  55 WR= 35% PF= 1.20 sumR=+8.0 exp=+0.15R pnl=$-36
  blocks: regimeGate=5921 atrPct=1093 shortConf=848 ddMonthly=762 maxOpen=531 exposure=401 dirOverlay=375 killSwitch=68 ddDaily=61 cooldown=54 dailyTrend=11 groupCap=4

## minus kelly
  ALL:  T= 176 WR= 39% PF= 1.25 sumR=+28.3 exp=+0.16R pnl=$316  → balance $816 maxDD 21.0%
  2026: T=  58 WR= 31% PF= 1.02 sumR=+0.7 exp=+0.01R pnl=$-29
  blocks: regimeGate=6422 atrPct=1154 shortConf=913 maxOpen=531 exposure=427 dirOverlay=426 killSwitch=118 cooldown=56 ddRolling7d=56 dailyTrend=13 groupCap=4 ddDaily=2

## minus riskMult
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$129  → balance $629 maxDD 41.3%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-268
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus ddGuard
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1075 shortConf=868 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=60 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus regimeGate
  ALL:  T= 740 WR= 30% PF= 0.94 sumR=-36.1 exp=-0.05R pnl=$-38  → balance $462 maxDD 53.0%
  2026: T= 185 WR= 28% PF= 0.84 sumR=-24.5 exp=-0.13R pnl=$-231
  blocks: killSwitch=2151 maxOpen=1768 atrPct=1650 shortConf=1231 exposure=842 ddMonthly=813 dirOverlay=352 ddGuard=228 ddRolling7d=224 cooldown=185 ddDaily=62 dailyTrend=39 groupCap=13

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T= 803 WR= 36% PF= 1.11 sumR=+60.6 exp=+0.08R pnl=$203  → balance $703 maxDD 74.0%
  2026: T= 175 WR= 37% PF= 1.16 sumR=+19.1 exp=+0.11R pnl=$81
  blocks: regimeGate=5304 exposure=2406 maxOpen=1518 cooldown=186 ddGuard=81

## LS-only BASELINE
  ALL:  T=  69 WR= 29% PF= 0.95 sumR=-3.0 exp=-0.04R pnl=$-28  → balance $472 maxDD 12.1%
  2026: T=  65 WR= 31% PF= 1.03 sumR=+1.5 exp=+0.02R pnl=$-1
  blocks: regimeGate=6580 dirOverlay=454 atrPct=391 killSwitch=213 maxOpen=77 exposure=57 shortConf=24 dailyTrend=24 cooldown=14 ddGuard=4

## LS-only LEAN
  ALL:  T= 582 WR= 31% PF= 1.02 sumR=+9.2 exp=+0.02R pnl=$-312  → balance $188 maxDD 88.8%
  2026: T= 264 WR= 36% PF= 1.20 sumR=+38.5 exp=+0.15R pnl=$48
  blocks: regimeGate=6350 exposure=548 ddGuard=238 cooldown=114 maxOpen=75

## LS+RSI LEAN
  ALL:  T= 582 WR= 31% PF= 1.02 sumR=+9.2 exp=+0.02R pnl=$-312  → balance $188 maxDD 88.8%
  2026: T= 264 WR= 36% PF= 1.20 sumR=+38.5 exp=+0.15R pnl=$48
  blocks: regimeGate=6350 exposure=548 ddGuard=238 cooldown=114 maxOpen=75

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 345 WR= 34% PF= 1.20 sumR=+51.0 exp=+0.15R pnl=$19  → balance $519 maxDD 62.5%
  2026: T= 169 WR= 43% PF= 1.60 sumR=+66.0 exp=+0.39R pnl=$145
  blocks: regimeGate=6458 killSwitch=544 exposure=320 ddGuard=132 cooldown=72 maxOpen=25 ddDaily=11

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 345 WR= 34% PF= 1.20 sumR=+51.0 exp=+0.15R pnl=$19  → balance $519 maxDD 62.5%
  2026: T= 169 WR= 43% PF= 1.60 sumR=+66.0 exp=+0.39R pnl=$145
  blocks: regimeGate=6458 killSwitch=544 exposure=320 ddGuard=132 cooldown=72 maxOpen=25 ddDaily=11

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 338 WR= 34% PF= 1.17 sumR=+42.9 exp=+0.13R pnl=$-55  → balance $445 maxDD 58.5%
  2026: T= 165 WR= 42% PF= 1.54 sumR=+58.3 exp=+0.35R pnl=$70
  blocks: regimeGate=6438 killSwitch=530 exposure=312 ddGuard=160 cooldown=74 maxOpen=24 groupCap=20 ddDaily=11

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 343 WR= 34% PF= 1.21 sumR=+53.2 exp=+0.15R pnl=$64  → balance $564 maxDD 59.2%
  2026: T= 167 WR= 43% PF= 1.63 sumR=+68.2 exp=+0.41R pnl=$191
  blocks: regimeGate=6288 killSwitch=424 exposure=318 ddRolling7d=282 ddGuard=134 cooldown=72 maxOpen=25 ddDaily=21

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 336 WR= 34% PF= 1.18 sumR=+45.1 exp=+0.13R pnl=$-22  → balance $478 maxDD 55.3%
  2026: T= 163 WR= 42% PF= 1.57 sumR=+60.5 exp=+0.37R pnl=$103
  blocks: regimeGate=6269 killSwitch=410 exposure=311 ddRolling7d=280 ddGuard=162 cooldown=74 maxOpen=24 ddDaily=21 groupCap=20

## PROPOSED-F (= E without kelly)
  ALL:  T= 327 WR= 33% PF= 1.14 sumR=+33.1 exp=+0.10R pnl=$-75  → balance $425 maxDD 82.1%
  2026: T= 159 WR= 41% PF= 1.44 sumR=+46.9 exp=+0.29R pnl=$215
  blocks: regimeGate=6017 ddRolling7d=832 exposure=310 ddGuard=148 ddDaily=76 cooldown=76 killSwitch=76 maxOpen=25 groupCap=20

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  55 WR= 40% PF= 1.14 sumR=+4.6 exp=+0.08R pnl=$117
  LONG  · BTC daily neutral T= 216 WR= 41% PF= 1.23 sumR=+29.3 exp=+0.14R pnl=$166
  LONG  · BTC daily down    T=   8 WR= 25% PF= 0.66 sumR=-2.1 exp=-0.26R pnl=$-94
  SHORT · BTC daily up      T= 151 WR= 34% PF= 1.15 sumR=+16.0 exp=+0.11R pnl=$85
  SHORT · BTC daily neutral T=  95 WR= 44% PF= 1.13 sumR=+7.1 exp=+0.07R pnl=$70
  SHORT · BTC daily down    T=  42 WR= 52% PF= 1.97 sumR=+19.5 exp=+0.47R pnl=$281
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 217 WR= 41% PF= 1.18 sumR=+23.2 exp=+0.11R pnl=$193
  LONG  · BTC weekly neutral T=  25 WR= 40% PF= 1.31 sumR=+4.8 exp=+0.19R pnl=$-10
  LONG  · BTC weekly down    T=  37 WR= 41% PF= 1.17 sumR=+3.8 exp=+0.10R pnl=$5
  SHORT · BTC weekly up      T= 206 WR= 41% PF= 1.29 sumR=+38.2 exp=+0.19R pnl=$292
  SHORT · BTC weekly neutral T=  25 WR= 56% PF= 2.42 sumR=+16.9 exp=+0.68R pnl=$482
  SHORT · BTC weekly down    T=  57 WR= 30% PF= 0.70 sumR=-12.4 exp=-0.22R pnl=$-337

## Direction × BTC regime — ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  LONG  · BTC daily up      T=  55 WR= 40% PF= 1.14 sumR=+4.6 exp=+0.08R pnl=$137
  LONG  · BTC daily neutral T= 216 WR= 41% PF= 1.23 sumR=+29.3 exp=+0.14R pnl=$166
  LONG  · BTC daily down    T=   8 WR= 25% PF= 0.66 sumR=-2.1 exp=-0.26R pnl=$-77
  SHORT · BTC daily up      T= 151 WR= 34% PF= 1.15 sumR=+16.0 exp=+0.11R pnl=$80
  SHORT · BTC daily neutral T=  95 WR= 44% PF= 1.13 sumR=+7.1 exp=+0.07R pnl=$71
  SHORT · BTC daily down    T=  42 WR= 52% PF= 1.97 sumR=+19.5 exp=+0.47R pnl=$209
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 217 WR= 41% PF= 1.18 sumR=+23.2 exp=+0.11R pnl=$209
  LONG  · BTC weekly neutral T=  25 WR= 40% PF= 1.31 sumR=+4.8 exp=+0.19R pnl=$6
  LONG  · BTC weekly down    T=  37 WR= 41% PF= 1.17 sumR=+3.8 exp=+0.10R pnl=$10
  SHORT · BTC weekly up      T= 206 WR= 41% PF= 1.29 sumR=+38.2 exp=+0.19R pnl=$256
  SHORT · BTC weekly neutral T=  25 WR= 56% PF= 2.42 sumR=+16.9 exp=+0.68R pnl=$500
  SHORT · BTC weekly down    T=  57 WR= 30% PF= 0.70 sumR=-12.4 exp=-0.22R pnl=$-397

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  liquidity-sweep    ALL:  T= 146 WR= 34% PF= 1.10 sumR=+11.2 exp=+0.08R pnl=$5
                     2026: T=  64 WR= 38% PF= 1.12 sumR=+5.4 exp=+0.08R pnl=$-40
  tsmom-daily        ALL:  T= 421 WR= 43% PF= 1.26 sumR=+63.3 exp=+0.15R pnl=$620
                     2026: T=  55 WR= 44% PF= 1.20 sumR=+6.2 exp=+0.11R pnl=$93

## Per-strategy — ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  liquidity-sweep    ALL:  T= 146 WR= 34% PF= 1.10 sumR=+11.2 exp=+0.08R pnl=$-20
                     2026: T=  64 WR= 38% PF= 1.12 sumR=+5.4 exp=+0.08R pnl=$-62
  tsmom-daily        ALL:  T= 421 WR= 43% PF= 1.26 sumR=+63.3 exp=+0.15R pnl=$605
                     2026: T=  55 WR= 44% PF= 1.20 sumR=+6.2 exp=+0.11R pnl=$159

## Per-strategy — BASELINE (all gates)
  liquidity-sweep    ALL:  T=  32 WR= 34% PF= 1.20 sumR=+4.9 exp=+0.15R pnl=$-22
                     2026: T=  28 WR= 39% PF= 1.48 sumR=+9.4 exp=+0.33R pnl=$13
  tsmom-daily        ALL:  T= 128 WR= 41% PF= 1.26 sumR=+20.3 exp=+0.16R pnl=$154
                     2026: T=  19 WR= 16% PF= 0.32 sumR=-11.1 exp=-0.59R pnl=$-330

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  liquidity-sweep    ALL:  T= 220 WR= 31% PF= 1.06 sumR=+10.7 exp=+0.05R pnl=$-12
                     2026: T=  95 WR= 38% PF= 1.34 sumR=+22.7 exp=+0.24R pnl=$164
  tsmom-daily        ALL:  T= 583 WR= 38% PF= 1.14 sumR=+49.9 exp=+0.09R pnl=$215
                     2026: T=  80 WR= 35% PF= 0.93 sumR=-3.6 exp=-0.05R pnl=$-83

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  liquidity-sweep    ALL:  T= 345 WR= 34% PF= 1.20 sumR=+51.0 exp=+0.15R pnl=$19
                     2026: T= 169 WR= 43% PF= 1.60 sumR=+66.0 exp=+0.39R pnl=$145

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  liquidity-sweep    ALL:  T= 345 WR= 34% PF= 1.20 sumR=+51.0 exp=+0.15R pnl=$19
                     2026: T= 169 WR= 43% PF= 1.60 sumR=+66.0 exp=+0.39R pnl=$145

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  liquidity-sweep    ALL:  T= 338 WR= 34% PF= 1.17 sumR=+42.9 exp=+0.13R pnl=$-55
                     2026: T= 165 WR= 42% PF= 1.54 sumR=+58.3 exp=+0.35R pnl=$70

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  liquidity-sweep    ALL:  T= 343 WR= 34% PF= 1.21 sumR=+53.2 exp=+0.15R pnl=$64
                     2026: T= 167 WR= 43% PF= 1.63 sumR=+68.2 exp=+0.41R pnl=$191

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  liquidity-sweep    ALL:  T= 336 WR= 34% PF= 1.18 sumR=+45.1 exp=+0.13R pnl=$-22
                     2026: T= 163 WR= 42% PF= 1.57 sumR=+60.5 exp=+0.37R pnl=$103

## Per-strategy — PROPOSED-F (= E without kelly)
  liquidity-sweep    ALL:  T= 327 WR= 33% PF= 1.14 sumR=+33.1 exp=+0.10R pnl=$-75
                     2026: T= 159 WR= 41% PF= 1.44 sumR=+46.9 exp=+0.29R pnl=$215

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-10  $-20.37
  2022-11  $-41.95
  2022-12  $-8.89
  2023-01  +$107.96
  2023-02  $-79.12
  2023-03  $-140.10
  2023-04  $-3.01
  2023-05  $-12.82
  2023-06  +$44.36
  2023-07  $-12.10
  2023-08  $-25.06
  2023-09  +$16.81
  2023-10  +$9.60
  2023-11  +$61.96
  2023-12  +$172.81
  2024-01  $-3.97
  2024-02  +$35.79
  2024-03  $-57.93
  2024-04  $-43.68
  2024-05  +$3.40
  2024-06  $-20.41
  2024-07  +$3.18
  2024-08  +$12.38
  2024-10  +$55.70
  2024-11  +$8.08
  2024-12  +$45.53
  2025-01  $-37.01
  2025-05  $-33.86
  2025-06  +$5.90
  2025-07  +$65.29
  2025-08  $-43.36
  2025-09  +$25.93
  2025-10  +$173.16
  2025-11  +$62.04
  2026-01  +$115.02
  2026-02  +$69.00
  2026-03  +$22.52
  2026-04  +$42.49
  2026-05  +$503.29
  2026-06  $-35.57
  2026-07  +$40.07
  2026-08  $-399.91
  2026-09  $-57.99