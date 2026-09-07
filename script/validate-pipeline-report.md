# Full-Pipeline Portfolio Validation — 2026-09-07
Capital $500 · base risk 2% · candles 20000 · feed Binance spot · entry slip 0 bps · gates mirror server/routes.ts (drawdown guard 12/6R over 30d, regime gates from the registry)
Entry = signal candle close (since 2026-09-01). Unmodeled: spread/funding filters, engine downtime; slippage only via --slip.

Total raw candidates (post minSL+R:R): 10390

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 566 WR= 39% PF= 1.15 sumR=+54.8 exp=+0.10R pnl=$298  → balance $798 maxDD 50.8%
  2026: T= 120 WR= 41% PF= 1.18 sumR=+13.7 exp=+0.11R pnl=$94
  blocks: regimeGate=5058 exposure=2613 maxOpen=1833 cooldown=138 groupCap=136 ddGuard=46

## CAP maxOpen=8
  ALL:  T= 667 WR= 37% PF= 1.11 sumR=+47.5 exp=+0.07R pnl=$90  → balance $590 maxDD 70.1%
  2026: T= 152 WR= 38% PF= 1.13 sumR=+12.9 exp=+0.08R pnl=$94
  blocks: regimeGate=5529 exposure=2015 maxOpen=1858 cooldown=152 groupCap=107 ddGuard=62

## CAP maxOpen=10
  ALL:  T= 789 WR= 38% PF= 1.20 sumR=+101.2 exp=+0.13R pnl=$1036  → balance $1536 maxDD 70.9%
  2026: T= 174 WR= 40% PF= 1.31 sumR=+34.4 exp=+0.20R pnl=$688
  blocks: regimeGate=5293 exposure=2447 maxOpen=1406 groupCap=192 cooldown=191 ddGuard=72

## CAP perSymbol=2
  ALL:  T= 799 WR= 38% PF= 1.21 sumR=+110.0 exp=+0.14R pnl=$1252  → balance $1752 maxDD 68.0%
  2026: T= 175 WR= 39% PF= 1.31 sumR=+34.6 exp=+0.20R pnl=$790
  blocks: regimeGate=6519 maxOpen=1591 exposure=976 groupCap=219 cooldown=194 ddGuard=92

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 672 WR= 37% PF= 1.14 sumR=+62.5 exp=+0.09R pnl=$339  → balance $839 maxDD 67.5%
  2026: T= 145 WR= 39% PF= 1.20 sumR=+18.4 exp=+0.13R pnl=$231
  blocks: regimeGate=6519 maxOpen=2005 exposure=792 cooldown=158 groupCap=129 ddGuard=115

## CAP LS cooldown 8h
  ALL:  T= 790 WR= 38% PF= 1.20 sumR=+100.9 exp=+0.13R pnl=$1019  → balance $1519 maxDD 71.3%
  2026: T= 174 WR= 40% PF= 1.31 sumR=+34.4 exp=+0.20R pnl=$680
  blocks: regimeGate=5294 exposure=2446 maxOpen=1411 groupCap=192 cooldown=184 ddGuard=73

## CAP LS cooldown 6h
  ALL:  T= 791 WR= 38% PF= 1.20 sumR=+103.8 exp=+0.13R pnl=$1122  → balance $1622 maxDD 69.3%
  2026: T= 174 WR= 40% PF= 1.31 sumR=+34.4 exp=+0.20R pnl=$726
  blocks: regimeGate=5294 exposure=2446 maxOpen=1412 groupCap=192 cooldown=182 ddGuard=73

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 675 WR= 37% PF= 1.13 sumR=+59.9 exp=+0.09R pnl=$291  → balance $791 maxDD 69.6%
  2026: T= 145 WR= 39% PF= 1.20 sumR=+18.4 exp=+0.13R pnl=$218
  blocks: regimeGate=6525 maxOpen=2009 exposure=794 cooldown=149 groupCap=129 ddGuard=109

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 799 WR= 38% PF= 1.21 sumR=+110.0 exp=+0.14R pnl=$1252  → balance $1752 maxDD 68.0%
  2026: T= 175 WR= 39% PF= 1.31 sumR=+34.6 exp=+0.20R pnl=$790
  blocks: regimeGate=6519 maxOpen=1591 exposure=976 groupCap=219 cooldown=194 ddGuard=92

## CAP maxOpen=12
  ALL:  T= 886 WR= 37% PF= 1.13 sumR=+77.3 exp=+0.09R pnl=$95  → balance $595 maxDD 78.4%
  2026: T= 223 WR= 37% PF= 1.10 sumR=+15.1 exp=+0.07R pnl=$-66
  blocks: regimeGate=5093 exposure=2761 maxOpen=1001 groupCap=325 cooldown=221 ddGuard=103

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 793 WR= 36% PF= 1.12 sumR=+63.3 exp=+0.08R pnl=$96  → balance $596 maxDD 83.8%
  2026: T= 181 WR= 40% PF= 1.29 sumR=+33.1 exp=+0.18R pnl=$223
  blocks: regimeGate=5368 exposure=2317 maxOpen=1104 groupCap=547 cooldown=192 ddGuard=69

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 886 WR= 37% PF= 1.13 sumR=+77.3 exp=+0.09R pnl=$95  → balance $595 maxDD 78.4%
  2026: T= 223 WR= 37% PF= 1.10 sumR=+15.1 exp=+0.07R pnl=$-66
  blocks: regimeGate=5093 exposure=2761 maxOpen=1001 groupCap=325 cooldown=221 ddGuard=103

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 841 WR= 37% PF= 1.07 sumR=+36.2 exp=+0.04R pnl=$-134  → balance $366 maxDD 69.1%
  2026: T= 197 WR= 37% PF= 1.06 sumR=+8.0 exp=+0.04R pnl=$-32
  blocks: regimeGate=5191 exposure=2395 maxOpen=1313 cooldown=352 groupCap=224 ddGuard=74

## EXIT tp1Close=50%
  ALL:  T= 789 WR= 38% PF= 1.21 sumR=+110.3 exp=+0.14R pnl=$1254  → balance $1754 maxDD 71.3%
  2026: T= 174 WR= 40% PF= 1.32 sumR=+35.4 exp=+0.20R pnl=$801
  blocks: regimeGate=5293 exposure=2447 maxOpen=1406 groupCap=192 cooldown=191 ddGuard=72

## EXIT tp1Close=75%
  ALL:  T= 788 WR= 38% PF= 1.17 sumR=+85.1 exp=+0.11R pnl=$697  → balance $1197 maxDD 70.3%
  2026: T= 174 WR= 40% PF= 1.30 sumR=+32.9 exp=+0.19R pnl=$518
  blocks: regimeGate=5291 exposure=2447 maxOpen=1406 cooldown=191 groupCap=191 ddGuard=76

## EXIT trail 1.5%
  ALL:  T= 794 WR= 38% PF= 1.18 sumR=+95.6 exp=+0.12R pnl=$884  → balance $1384 maxDD 71.2%
  2026: T= 174 WR= 40% PF= 1.32 sumR=+35.3 exp=+0.20R pnl=$635
  blocks: regimeGate=5293 exposure=2437 maxOpen=1409 cooldown=200 groupCap=185 ddGuard=72

## EXIT trail 3%
  ALL:  T= 789 WR= 37% PF= 1.16 sumR=+80.5 exp=+0.10R pnl=$516  → balance $1016 maxDD 79.3%
  2026: T= 172 WR= 39% PF= 1.26 sumR=+28.6 exp=+0.17R pnl=$402
  blocks: regimeGate=5279 exposure=2463 maxOpen=1423 groupCap=184 cooldown=181 ddGuard=71

## EXIT trail r_multiple 2R
  ALL:  T= 566 WR= 39% PF= 1.15 sumR=+54.8 exp=+0.10R pnl=$298  → balance $798 maxDD 50.8%
  2026: T= 120 WR= 41% PF= 1.18 sumR=+13.7 exp=+0.11R pnl=$94
  blocks: regimeGate=5058 exposure=2613 maxOpen=1833 cooldown=138 groupCap=136 ddGuard=46

## TILT LONG:up 0.75x
  ALL:  T= 566 WR= 39% PF= 1.15 sumR=+54.8 exp=+0.10R pnl=$276  → balance $776 maxDD 49.6%
  2026: T= 120 WR= 41% PF= 1.18 sumR=+13.7 exp=+0.11R pnl=$64
  blocks: regimeGate=5058 exposure=2613 maxOpen=1833 cooldown=138 groupCap=136 ddGuard=46

## TILT LONG:up 0.5x
  ALL:  T= 566 WR= 39% PF= 1.15 sumR=+54.8 exp=+0.10R pnl=$251  → balance $751 maxDD 48.5%
  2026: T= 120 WR= 41% PF= 1.18 sumR=+13.7 exp=+0.11R pnl=$33
  blocks: regimeGate=5058 exposure=2613 maxOpen=1833 cooldown=138 groupCap=136 ddGuard=46

## TILT LONG:up blocked
  ALL:  T= 599 WR= 38% PF= 1.14 sumR=+56.1 exp=+0.09R pnl=$276  → balance $776 maxDD 71.7%
  2026: T= 106 WR= 42% PF= 1.43 sumR=+26.9 exp=+0.25R pnl=$284
  blocks: regimeGate=5096 exposure=2505 maxOpen=1598 groupCap=170 sizeTilt=164 cooldown=136 ddGuard=122

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 566 WR= 39% PF= 1.15 sumR=+54.8 exp=+0.10R pnl=$203  → balance $703 maxDD 56.5%
  2026: T= 120 WR= 41% PF= 1.18 sumR=+13.7 exp=+0.11R pnl=$-0
  blocks: regimeGate=5058 exposure=2613 maxOpen=1833 cooldown=138 groupCap=136 ddGuard=46

## SAMEDIR max 4
  ALL:  T= 367 WR= 41% PF= 1.27 sumR=+60.6 exp=+0.17R pnl=$894  → balance $1394 maxDD 41.1%
  2026: T=  75 WR= 47% PF= 1.57 sumR=+22.8 exp=+0.30R pnl=$568
  blocks: regimeGate=5768 sameDir=2356 exposure=1522 groupCap=260 cooldown=97 ddGuard=20

## SAMEDIR max 5
  ALL:  T= 435 WR= 40% PF= 1.24 sumR=+63.4 exp=+0.15R pnl=$801  → balance $1301 maxDD 46.5%
  2026: T=  92 WR= 43% PF= 1.39 sumR=+20.6 exp=+0.22R pnl=$467
  blocks: regimeGate=5594 sameDir=1829 exposure=1824 groupCap=360 maxOpen=186 cooldown=125 ddGuard=37

## SAMEDIR max 6
  ALL:  T= 468 WR= 40% PF= 1.23 sumR=+65.5 exp=+0.14R pnl=$883  → balance $1383 maxDD 51.0%
  2026: T= 108 WR= 44% PF= 1.46 sumR=+28.8 exp=+0.27R pnl=$621
  blocks: regimeGate=5483 exposure=2008 sameDir=1520 groupCap=405 maxOpen=355 cooldown=129 ddGuard=22

## SAMEDIR max 7
  ALL:  T= 487 WR= 41% PF= 1.25 sumR=+73.9 exp=+0.15R pnl=$870  → balance $1370 maxDD 45.8%
  2026: T= 121 WR= 40% PF= 1.15 sumR=+11.4 exp=+0.09R pnl=$180
  blocks: regimeGate=5319 exposure=2233 sameDir=1191 maxOpen=509 groupCap=487 cooldown=124 ddGuard=40

## VENUE Kraken (−LUNC)
  ALL:  T= 566 WR= 39% PF= 1.15 sumR=+54.8 exp=+0.10R pnl=$298  → balance $798 maxDD 50.8%
  2026: T= 120 WR= 41% PF= 1.18 sumR=+13.7 exp=+0.11R pnl=$94
  blocks: regimeGate=5058 exposure=2613 maxOpen=1833 cooldown=138 groupCap=136 ddGuard=46

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 574 WR= 39% PF= 1.16 sumR=+59.6 exp=+0.10R pnl=$386  → balance $886 maxDD 50.0%
  2026: T= 129 WR= 40% PF= 1.21 sumR=+17.4 exp=+0.14R pnl=$171
  blocks: regimeGate=4601 exposure=2589 maxOpen=1538 groupCap=140 cooldown=133 ddGuard=31

## TRIAGE minus rsi-divergence
  ALL:  T= 560 WR= 31% PF= 0.96 sumR=-15.8 exp=-0.03R pnl=$-424  → balance $76 maxDD 95.2%
  2026: T= 257 WR= 36% PF= 1.17 sumR=+30.4 exp=+0.12R pnl=$9
  blocks: regimeGate=6341 exposure=528 ddGuard=256 cooldown=109 maxOpen=67 groupCap=46

## BASELINE (all gates)
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus dirOverlay
  ALL:  T= 223 WR= 33% PF= 0.96 sumR=-6.8 exp=-0.03R pnl=$-56  → balance $444 maxDD 50.7%
  2026: T=  53 WR= 30% PF= 0.96 sumR=-1.8 exp=-0.03R pnl=$-271
  blocks: regimeGate=5826 atrPct=956 shortConf=934 ddMonthly=736 maxOpen=552 exposure=445 ddRolling7d=339 killSwitch=218 ddDaily=69 cooldown=63 dailyTrend=16 ddGuard=9 groupCap=4

## minus dailyTrend
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1080 shortConf=957 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 groupCap=4

## minus weeklyTrend
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus shortConf
  ALL:  T= 211 WR= 39% PF= 1.21 sumR=+28.1 exp=+0.13R pnl=$24  → balance $524 maxDD 17.4%
  2026: T=  43 WR= 37% PF= 1.22 sumR=+5.9 exp=+0.14R pnl=$-13
  blocks: regimeGate=6140 maxOpen=1666 atrPct=918 exposure=913 dirOverlay=366 killSwitch=66 cooldown=50 groupCap=37 ddRolling7d=14 dailyTrend=9

## minus atrPct
  ALL:  T= 308 WR= 39% PF= 1.19 sumR=+37.0 exp=+0.12R pnl=$-58  → balance $442 maxDD 66.3%
  2026: T=  64 WR= 34% PF= 0.98 sumR=-0.9 exp=-0.01R pnl=$-277
  blocks: regimeGate=5347 ddMonthly=1150 maxOpen=976 shortConf=902 exposure=679 dirOverlay=387 ddRolling7d=386 ddDaily=99 cooldown=93 killSwitch=56 dailyTrend=7

## minus btcCap
  ALL:  T= 205 WR= 40% PF= 1.33 sumR=+42.6 exp=+0.21R pnl=$238  → balance $738 maxDD 61.4%
  2026: T=  57 WR= 32% PF= 1.08 sumR=+3.5 exp=+0.06R pnl=$-361
  blocks: regimeGate=5910 atrPct=1122 shortConf=965 ddMonthly=642 exposure=476 dirOverlay=402 ddRolling7d=338 ddDaily=88 maxOpen=81 cooldown=62 killSwitch=60 groupCap=30 dailyTrend=9

## minus groupCap
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$130  → balance $630 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-316
  blocks: regimeGate=6052 atrPct=1081 shortConf=946 ddMonthly=525 maxOpen=521 exposure=396 dirOverlay=362 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11

## minus killSwitch
  ALL:  T= 164 WR= 39% PF= 1.24 sumR=+24.7 exp=+0.15R pnl=$128  → balance $628 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-316
  blocks: regimeGate=6047 atrPct=1080 shortConf=947 maxOpen=557 ddMonthly=525 exposure=404 dirOverlay=361 ddRolling7d=163 ddDaily=69 cooldown=58 dailyTrend=11 groupCap=4

## minus ddDaily
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6057 atrPct=1112 shortConf=966 ddMonthly=535 maxOpen=520 exposure=396 dirOverlay=362 ddRolling7d=163 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus ddMonthly
  ALL:  T= 170 WR= 39% PF= 1.21 sumR=+23.4 exp=+0.14R pnl=$152  → balance $652 maxDD 48.0%
  2026: T=  53 WR= 28% PF= 0.87 sumR=-5.2 exp=-0.10R pnl=$-353
  blocks: regimeGate=6321 atrPct=1104 shortConf=948 maxOpen=522 exposure=426 dirOverlay=364 ddRolling7d=284 killSwitch=104 ddDaily=69 cooldown=57 dailyTrend=17 groupCap=4

## minus ddRolling
  ALL:  T= 169 WR= 40% PF= 1.32 sumR=+34.0 exp=+0.20R pnl=$373  → balance $873 maxDD 41.3%
  2026: T=  55 WR= 35% PF= 1.20 sumR=+8.0 exp=+0.15R pnl=$-36
  blocks: regimeGate=5921 atrPct=1098 shortConf=923 ddMonthly=765 maxOpen=531 exposure=401 dirOverlay=375 ddDaily=70 killSwitch=68 cooldown=54 dailyTrend=11 groupCap=4

## minus kelly
  ALL:  T= 176 WR= 39% PF= 1.25 sumR=+28.3 exp=+0.16R pnl=$316  → balance $816 maxDD 21.0%
  2026: T=  58 WR= 31% PF= 1.02 sumR=+0.7 exp=+0.01R pnl=$-29
  blocks: regimeGate=6422 atrPct=1168 shortConf=991 maxOpen=531 exposure=427 dirOverlay=426 killSwitch=118 cooldown=56 ddRolling7d=56 dailyTrend=13 groupCap=4 ddDaily=2

## minus riskMult
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$129  → balance $629 maxDD 41.3%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-268
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus ddGuard
  ALL:  T= 160 WR= 39% PF= 1.25 sumR=+25.2 exp=+0.16R pnl=$131  → balance $631 maxDD 44.6%
  2026: T=  47 WR= 30% PF= 0.95 sumR=-1.8 exp=-0.04R pnl=$-317
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus regimeGate
  ALL:  T= 740 WR= 30% PF= 0.94 sumR=-36.1 exp=-0.05R pnl=$-38  → balance $462 maxDD 53.0%
  2026: T= 185 WR= 28% PF= 0.84 sumR=-24.5 exp=-0.13R pnl=$-231
  blocks: killSwitch=2151 maxOpen=1769 atrPct=1655 shortConf=1302 exposure=842 ddMonthly=819 dirOverlay=352 ddGuard=228 ddRolling7d=224 cooldown=185 ddDaily=71 dailyTrend=39 groupCap=13

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T= 823 WR= 36% PF= 1.09 sumR=+51.6 exp=+0.06R pnl=$48  → balance $548 maxDD 78.4%
  2026: T= 175 WR= 37% PF= 1.16 sumR=+19.1 exp=+0.11R pnl=$64
  blocks: regimeGate=5282 exposure=2476 maxOpen=1527 cooldown=190 ddGuard=92

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
  LONG  · BTC daily up      T=  53 WR= 40% PF= 1.14 sumR=+4.6 exp=+0.09R pnl=$86
  LONG  · BTC daily neutral T= 213 WR= 40% PF= 1.14 sumR=+18.8 exp=+0.09R pnl=$83
  LONG  · BTC daily down    T=   7 WR= 14% PF= 0.26 sumR=-4.5 exp=-0.64R pnl=$-77
  SHORT · BTC daily up      T= 151 WR= 34% PF= 1.14 sumR=+15.2 exp=+0.10R pnl=$47
  SHORT · BTC daily neutral T=  97 WR= 43% PF= 1.07 sumR=+4.1 exp=+0.04R pnl=$18
  SHORT · BTC daily down    T=  45 WR= 49% PF= 1.72 sumR=+16.6 exp=+0.37R pnl=$140
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 215 WR= 39% PF= 1.09 sumR=+11.8 exp=+0.05R pnl=$83
  LONG  · BTC weekly neutral T=  22 WR= 36% PF= 1.16 sumR=+2.3 exp=+0.11R pnl=$-21
  LONG  · BTC weekly down    T=  36 WR= 42% PF= 1.22 sumR=+4.8 exp=+0.13R pnl=$31
  SHORT · BTC weekly up      T= 206 WR= 40% PF= 1.20 sumR=+27.1 exp=+0.13R pnl=$60
  SHORT · BTC weekly neutral T=  26 WR= 65% PF= 3.47 sumR=+24.2 exp=+0.93R pnl=$482
  SHORT · BTC weekly down    T=  61 WR= 28% PF= 0.66 sumR=-15.5 exp=-0.25R pnl=$-337

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  liquidity-sweep    ALL:  T= 146 WR= 34% PF= 1.10 sumR=+10.4 exp=+0.07R pnl=$-27
                     2026: T=  63 WR= 38% PF= 1.13 sumR=+5.7 exp=+0.09R pnl=$-46
  tsmom-daily        ALL:  T= 420 WR= 41% PF= 1.18 sumR=+44.4 exp=+0.11R pnl=$325
                     2026: T=  57 WR= 44% PF= 1.25 sumR=+8.0 exp=+0.14R pnl=$140

## Per-strategy — BASELINE (all gates)
  liquidity-sweep    ALL:  T=  32 WR= 34% PF= 1.20 sumR=+4.9 exp=+0.15R pnl=$-22
                     2026: T=  28 WR= 39% PF= 1.48 sumR=+9.4 exp=+0.33R pnl=$13
  tsmom-daily        ALL:  T= 128 WR= 41% PF= 1.26 sumR=+20.3 exp=+0.16R pnl=$154
                     2026: T=  19 WR= 16% PF= 0.32 sumR=-11.1 exp=-0.59R pnl=$-330

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  liquidity-sweep    ALL:  T= 240 WR= 30% PF= 0.97 sumR=-6.4 exp=-0.03R pnl=$-201
                     2026: T=  95 WR= 38% PF= 1.34 sumR=+22.7 exp=+0.24R pnl=$128
  tsmom-daily        ALL:  T= 583 WR= 38% PF= 1.16 sumR=+58.1 exp=+0.10R pnl=$249
                     2026: T=  80 WR= 35% PF= 0.93 sumR=-3.6 exp=-0.05R pnl=$-64

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
  2022-11  $-41.89
  2022-12  $-8.89
  2023-01  +$107.98
  2023-02  $-79.13
  2023-03  $-140.12
  2023-04  $-3.01
  2023-05  $-12.83
  2023-06  +$44.37
  2023-07  $-12.11
  2023-08  $-25.07
  2023-09  +$16.81
  2023-10  +$9.60
  2023-11  +$61.97
  2023-12  +$172.83
  2024-01  $-3.97
  2024-02  +$23.47
  2024-03  $-56.23
  2024-04  $-32.73
  2024-05  $-29.93
  2024-06  $-9.72
  2024-07  $-10.11
  2024-08  +$2.30
  2024-09  $-9.12
  2024-10  +$69.20
  2024-11  $-80.00
  2024-12  +$43.22
  2025-01  $-29.00
  2025-05  $-40.64
  2025-06  +$8.01
  2025-07  +$56.46
  2025-08  $-56.49
  2025-09  +$30.92
  2025-10  +$123.66
  2025-11  +$25.65
  2026-01  +$158.34
  2026-02  +$55.37
  2026-03  $-47.69
  2026-04  +$14.99
  2026-05  +$433.21
  2026-06  $-48.31
  2026-07  +$60.20
  2026-08  $-380.55
  2026-09  $-42.28