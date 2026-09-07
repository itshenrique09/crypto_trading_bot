# Full-Pipeline Portfolio Validation — 2026-09-07
Capital $500 · base risk 2% · candles 20000 · feed Binance spot · entry slip 15 bps · gates mirror server/routes.ts (drawdown guard 12/6R over 30d, regime gates from the registry)
Entry = signal candle close (since 2026-09-01). Unmodeled: spread/funding filters, engine downtime; slippage only via --slip.

Total raw candidates (post minSL+R:R): 10390

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 559 WR= 39% PF= 1.08 sumR=+26.8 exp=+0.05R pnl=$-30  → balance $470 maxDD 52.1%
  2026: T= 113 WR= 40% PF= 1.09 sumR=+6.1 exp=+0.05R pnl=$-0
  blocks: regimeGate=5049 exposure=2606 maxOpen=1848 groupCap=135 cooldown=134 ddGuard=59

## CAP maxOpen=8
  ALL:  T= 667 WR= 37% PF= 1.06 sumR=+26.4 exp=+0.04R pnl=$-119  → balance $381 maxDD 74.6%
  2026: T= 152 WR= 38% PF= 1.05 sumR=+4.8 exp=+0.03R pnl=$0
  blocks: regimeGate=5529 exposure=2015 maxOpen=1858 cooldown=152 groupCap=107 ddGuard=62

## CAP maxOpen=10
  ALL:  T= 786 WR= 38% PF= 1.14 sumR=+72.6 exp=+0.09R pnl=$366  → balance $866 maxDD 75.2%
  2026: T= 174 WR= 40% PF= 1.21 sumR=+23.6 exp=+0.14R pnl=$267
  blocks: regimeGate=5288 exposure=2445 maxOpen=1406 cooldown=191 groupCap=189 ddGuard=85

## CAP perSymbol=2
  ALL:  T= 798 WR= 38% PF= 1.15 sumR=+76.9 exp=+0.10R pnl=$397  → balance $897 maxDD 74.7%
  2026: T= 175 WR= 39% PF= 1.21 sumR=+23.0 exp=+0.13R pnl=$271
  blocks: regimeGate=6513 maxOpen=1591 exposure=976 groupCap=218 cooldown=194 ddGuard=100

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 674 WR= 37% PF= 1.06 sumR=+28.8 exp=+0.04R pnl=$-92  → balance $408 maxDD 79.6%
  2026: T= 145 WR= 39% PF= 1.11 sumR=+10.3 exp=+0.07R pnl=$58
  blocks: regimeGate=6524 maxOpen=2004 exposure=792 cooldown=159 groupCap=128 ddGuard=109

## CAP LS cooldown 8h
  ALL:  T= 787 WR= 38% PF= 1.14 sumR=+72.0 exp=+0.09R pnl=$352  → balance $852 maxDD 75.7%
  2026: T= 174 WR= 40% PF= 1.21 sumR=+23.6 exp=+0.14R pnl=$263
  blocks: regimeGate=5289 exposure=2444 maxOpen=1411 groupCap=189 cooldown=184 ddGuard=86

## CAP LS cooldown 6h
  ALL:  T= 788 WR= 38% PF= 1.15 sumR=+74.6 exp=+0.09R pnl=$404  → balance $904 maxDD 74.2%
  2026: T= 174 WR= 40% PF= 1.21 sumR=+23.6 exp=+0.14R pnl=$279
  blocks: regimeGate=5289 exposure=2444 maxOpen=1412 groupCap=189 cooldown=182 ddGuard=86

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 673 WR= 37% PF= 1.08 sumR=+36.4 exp=+0.05R pnl=$-20  → balance $480 maxDD 75.4%
  2026: T= 145 WR= 39% PF= 1.11 sumR=+10.3 exp=+0.07R pnl=$68
  blocks: regimeGate=6523 maxOpen=2015 exposure=793 cooldown=148 groupCap=128 ddGuard=110

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 798 WR= 38% PF= 1.15 sumR=+76.9 exp=+0.10R pnl=$397  → balance $897 maxDD 74.7%
  2026: T= 175 WR= 39% PF= 1.21 sumR=+23.0 exp=+0.13R pnl=$271
  blocks: regimeGate=6513 maxOpen=1591 exposure=976 groupCap=218 cooldown=194 ddGuard=100

## CAP maxOpen=12
  ALL:  T= 899 WR= 37% PF= 1.07 sumR=+40.8 exp=+0.05R pnl=$-244  → balance $256 maxDD 87.6%
  2026: T= 234 WR= 35% PF= 0.97 sumR=-5.5 exp=-0.02R pnl=$-237
  blocks: regimeGate=5104 exposure=2757 maxOpen=987 groupCap=313 cooldown=223 ddGuard=107

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 787 WR= 36% PF= 1.05 sumR=+25.9 exp=+0.03R pnl=$-236  → balance $264 maxDD 87.1%
  2026: T= 181 WR= 39% PF= 1.13 sumR=+14.7 exp=+0.08R pnl=$5
  blocks: regimeGate=5364 exposure=2314 maxOpen=1088 groupCap=553 cooldown=189 ddGuard=95

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 899 WR= 37% PF= 1.07 sumR=+40.8 exp=+0.05R pnl=$-244  → balance $256 maxDD 87.6%
  2026: T= 234 WR= 35% PF= 0.97 sumR=-5.5 exp=-0.02R pnl=$-237
  blocks: regimeGate=5104 exposure=2757 maxOpen=987 groupCap=313 cooldown=223 ddGuard=107

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 838 WR= 37% PF= 1.02 sumR=+9.4 exp=+0.01R pnl=$-278  → balance $222 maxDD 76.2%
  2026: T= 196 WR= 37% PF= 1.01 sumR=+1.4 exp=+0.01R pnl=$-47
  blocks: regimeGate=5177 exposure=2403 maxOpen=1329 cooldown=351 groupCap=217 ddGuard=75

## EXIT tp1Close=50%
  ALL:  T= 786 WR= 38% PF= 1.16 sumR=+81.6 exp=+0.10R pnl=$490  → balance $990 maxDD 75.6%
  2026: T= 174 WR= 40% PF= 1.22 sumR=+24.6 exp=+0.14R pnl=$317
  blocks: regimeGate=5288 exposure=2445 maxOpen=1406 cooldown=191 groupCap=189 ddGuard=85

## EXIT tp1Close=75%
  ALL:  T= 786 WR= 38% PF= 1.12 sumR=+59.0 exp=+0.08R pnl=$206  → balance $706 maxDD 74.7%
  2026: T= 174 WR= 40% PF= 1.20 sumR=+22.1 exp=+0.13R pnl=$205
  blocks: regimeGate=5288 exposure=2445 maxOpen=1406 cooldown=191 groupCap=189 ddGuard=85

## EXIT trail 1.5%
  ALL:  T= 791 WR= 38% PF= 1.13 sumR=+67.0 exp=+0.08R pnl=$279  → balance $779 maxDD 75.5%
  2026: T= 174 WR= 40% PF= 1.22 sumR=+24.4 exp=+0.14R pnl=$251
  blocks: regimeGate=5288 exposure=2435 maxOpen=1409 cooldown=200 groupCap=182 ddGuard=85

## EXIT trail 3%
  ALL:  T= 791 WR= 38% PF= 1.12 sumR=+59.9 exp=+0.08R pnl=$172  → balance $672 maxDD 81.1%
  2026: T= 172 WR= 39% PF= 1.17 sumR=+18.2 exp=+0.11R pnl=$167
  blocks: regimeGate=5286 exposure=2466 maxOpen=1432 groupCap=184 cooldown=181 ddGuard=50

## EXIT trail r_multiple 2R
  ALL:  T= 559 WR= 39% PF= 1.08 sumR=+26.8 exp=+0.05R pnl=$-30  → balance $470 maxDD 52.1%
  2026: T= 113 WR= 40% PF= 1.09 sumR=+6.1 exp=+0.05R pnl=$-0
  blocks: regimeGate=5049 exposure=2606 maxOpen=1848 groupCap=135 cooldown=134 ddGuard=59

## TILT LONG:up 0.75x
  ALL:  T= 559 WR= 39% PF= 1.08 sumR=+26.8 exp=+0.05R pnl=$-23  → balance $477 maxDD 50.9%
  2026: T= 113 WR= 40% PF= 1.09 sumR=+6.1 exp=+0.05R pnl=$1
  blocks: regimeGate=5049 exposure=2606 maxOpen=1848 groupCap=135 cooldown=134 ddGuard=59

## TILT LONG:up 0.5x
  ALL:  T= 559 WR= 39% PF= 1.08 sumR=+26.8 exp=+0.05R pnl=$-17  → balance $483 maxDD 49.7%
  2026: T= 113 WR= 40% PF= 1.09 sumR=+6.1 exp=+0.05R pnl=$1
  blocks: regimeGate=5049 exposure=2606 maxOpen=1848 groupCap=135 cooldown=134 ddGuard=59

## TILT LONG:up blocked
  ALL:  T= 597 WR= 38% PF= 1.09 sumR=+34.4 exp=+0.06R pnl=$29  → balance $529 maxDD 74.5%
  2026: T= 104 WR= 43% PF= 1.33 sumR=+19.6 exp=+0.19R pnl=$144
  blocks: regimeGate=5096 exposure=2504 maxOpen=1600 groupCap=170 sizeTilt=164 cooldown=137 ddGuard=122

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 559 WR= 39% PF= 1.08 sumR=+26.8 exp=+0.05R pnl=$-67  → balance $433 maxDD 56.4%
  2026: T= 113 WR= 40% PF= 1.09 sumR=+6.1 exp=+0.05R pnl=$-7
  blocks: regimeGate=5049 exposure=2606 maxOpen=1848 groupCap=135 cooldown=134 ddGuard=59

## SAMEDIR max 4
  ALL:  T= 364 WR= 41% PF= 1.24 sumR=+52.5 exp=+0.14R pnl=$674  → balance $1174 maxDD 43.2%
  2026: T=  75 WR= 47% PF= 1.48 sumR=+19.0 exp=+0.25R pnl=$419
  blocks: regimeGate=5765 sameDir=2356 exposure=1522 groupCap=257 cooldown=98 ddGuard=28

## SAMEDIR max 5
  ALL:  T= 432 WR= 41% PF= 1.19 sumR=+50.5 exp=+0.12R pnl=$487  → balance $987 maxDD 52.8%
  2026: T=  92 WR= 43% PF= 1.29 sumR=+15.3 exp=+0.17R pnl=$278
  blocks: regimeGate=5594 sameDir=1829 exposure=1826 groupCap=360 maxOpen=186 cooldown=126 ddGuard=37

## SAMEDIR max 6
  ALL:  T= 465 WR= 40% PF= 1.16 sumR=+46.4 exp=+0.10R pnl=$441  → balance $941 maxDD 56.6%
  2026: T= 108 WR= 44% PF= 1.32 sumR=+20.2 exp=+0.19R pnl=$321
  blocks: regimeGate=5479 exposure=2008 sameDir=1523 groupCap=400 maxOpen=353 cooldown=131 ddGuard=31

## SAMEDIR max 7
  ALL:  T= 488 WR= 41% PF= 1.18 sumR=+54.3 exp=+0.11R pnl=$429  → balance $929 maxDD 47.3%
  2026: T= 121 WR= 40% PF= 1.07 sumR=+5.5 exp=+0.05R pnl=$21
  blocks: regimeGate=5319 exposure=2231 sameDir=1205 maxOpen=509 groupCap=471 cooldown=127 ddGuard=40

## VENUE Kraken (−LUNC)
  ALL:  T= 559 WR= 39% PF= 1.08 sumR=+26.8 exp=+0.05R pnl=$-30  → balance $470 maxDD 52.1%
  2026: T= 113 WR= 40% PF= 1.09 sumR=+6.1 exp=+0.05R pnl=$-0
  blocks: regimeGate=5049 exposure=2606 maxOpen=1848 groupCap=135 cooldown=134 ddGuard=59

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 559 WR= 39% PF= 1.10 sumR=+36.0 exp=+0.06R pnl=$70  → balance $570 maxDD 57.1%
  2026: T= 116 WR= 41% PF= 1.18 sumR=+12.5 exp=+0.11R pnl=$82
  blocks: regimeGate=4589 exposure=2584 maxOpen=1555 groupCap=146 cooldown=128 ddGuard=45

## TRIAGE minus rsi-divergence
  ALL:  T= 557 WR= 31% PF= 0.85 sumR=-64.8 exp=-0.12R pnl=$-470  → balance $30 maxDD 96.9%
  2026: T= 256 WR= 36% PF= 1.03 sumR=+6.2 exp=+0.02R pnl=$-13
  blocks: regimeGate=6342 exposure=531 ddGuard=251 cooldown=108 maxOpen=72 groupCap=46

## BASELINE (all gates)
  ALL:  T= 160 WR= 39% PF= 1.19 sumR=+19.3 exp=+0.12R pnl=$67  → balance $567 maxDD 45.0%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-291
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus dirOverlay
  ALL:  T= 225 WR= 33% PF= 0.92 sumR=-13.5 exp=-0.06R pnl=$-131  → balance $369 maxDD 56.1%
  2026: T=  53 WR= 30% PF= 0.85 sumR=-5.9 exp=-0.11R pnl=$-244
  blocks: regimeGate=5910 atrPct=957 shortConf=932 ddMonthly=736 maxOpen=553 exposure=449 killSwitch=267 ddRolling7d=200 ddDaily=69 cooldown=63 dailyTrend=16 ddGuard=9 groupCap=4

## minus dailyTrend
  ALL:  T= 160 WR= 39% PF= 1.19 sumR=+19.3 exp=+0.12R pnl=$67  → balance $567 maxDD 45.0%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-291
  blocks: regimeGate=6052 atrPct=1080 shortConf=957 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 groupCap=4

## minus weeklyTrend
  ALL:  T= 160 WR= 39% PF= 1.19 sumR=+19.3 exp=+0.12R pnl=$67  → balance $567 maxDD 45.0%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-291
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus shortConf
  ALL:  T= 211 WR= 39% PF= 1.17 sumR=+22.5 exp=+0.11R pnl=$-10  → balance $490 maxDD 16.9%
  2026: T=  43 WR= 37% PF= 1.11 sumR=+2.9 exp=+0.07R pnl=$-40
  blocks: regimeGate=6140 maxOpen=1666 atrPct=918 exposure=913 dirOverlay=366 killSwitch=66 cooldown=50 groupCap=37 ddRolling7d=14 dailyTrend=9

## minus atrPct
  ALL:  T= 314 WR= 40% PF= 1.25 sumR=+47.3 exp=+0.15R pnl=$86  → balance $586 maxDD 61.0%
  2026: T=  70 WR= 41% PF= 1.30 sumR=+13.1 exp=+0.19R pnl=$-17
  blocks: regimeGate=5386 ddMonthly=1057 maxOpen=1046 shortConf=904 exposure=690 dirOverlay=395 ddRolling7d=335 ddDaily=108 cooldown=93 killSwitch=53 dailyTrend=9

## minus btcCap
  ALL:  T= 213 WR= 41% PF= 1.27 sumR=+35.7 exp=+0.17R pnl=$156  → balance $656 maxDD 60.5%
  2026: T=  65 WR= 34% PF= 0.99 sumR=-0.3 exp=-0.01R pnl=$-347
  blocks: regimeGate=5938 atrPct=1121 shortConf=969 ddMonthly=623 exposure=495 dirOverlay=403 ddRolling7d=267 killSwitch=90 maxOpen=89 ddDaily=82 cooldown=63 groupCap=28 dailyTrend=9

## minus groupCap
  ALL:  T= 160 WR= 39% PF= 1.19 sumR=+19.3 exp=+0.12R pnl=$67  → balance $567 maxDD 45.0%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-291
  blocks: regimeGate=6052 atrPct=1081 shortConf=946 ddMonthly=525 maxOpen=521 exposure=396 dirOverlay=362 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11

## minus killSwitch
  ALL:  T= 164 WR= 39% PF= 1.18 sumR=+18.6 exp=+0.11R pnl=$90  → balance $590 maxDD 42.5%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-263
  blocks: regimeGate=6047 atrPct=1080 shortConf=947 maxOpen=557 ddMonthly=525 exposure=404 dirOverlay=361 ddRolling7d=163 ddDaily=69 cooldown=58 dailyTrend=11 groupCap=4

## minus ddDaily
  ALL:  T= 160 WR= 39% PF= 1.19 sumR=+19.3 exp=+0.12R pnl=$67  → balance $567 maxDD 45.0%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-291
  blocks: regimeGate=6057 atrPct=1112 shortConf=966 ddMonthly=535 maxOpen=520 exposure=396 dirOverlay=362 ddRolling7d=163 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus ddMonthly
  ALL:  T= 170 WR= 39% PF= 1.16 sumR=+17.3 exp=+0.10R pnl=$92  → balance $592 maxDD 46.3%
  2026: T=  53 WR= 28% PF= 0.78 sumR=-9.0 exp=-0.17R pnl=$-314
  blocks: regimeGate=6321 atrPct=1104 shortConf=948 maxOpen=522 exposure=426 dirOverlay=364 ddRolling7d=284 killSwitch=104 ddDaily=69 cooldown=57 dailyTrend=17 groupCap=4

## minus ddRolling
  ALL:  T= 169 WR= 40% PF= 1.25 sumR=+26.3 exp=+0.16R pnl=$143  → balance $643 maxDD 41.6%
  2026: T=  55 WR= 35% PF= 1.07 sumR=+2.6 exp=+0.05R pnl=$-181
  blocks: regimeGate=5921 atrPct=1098 shortConf=924 ddMonthly=765 maxOpen=531 exposure=401 dirOverlay=375 ddDaily=69 killSwitch=68 cooldown=54 dailyTrend=11 groupCap=4

## minus kelly
  ALL:  T= 176 WR= 39% PF= 1.19 sumR=+21.1 exp=+0.12R pnl=$224  → balance $724 maxDD 21.1%
  2026: T=  58 WR= 31% PF= 0.90 sumR=-4.2 exp=-0.07R pnl=$-85
  blocks: regimeGate=6422 atrPct=1168 shortConf=991 maxOpen=531 exposure=427 dirOverlay=426 killSwitch=118 cooldown=56 ddRolling7d=56 dailyTrend=13 groupCap=4 ddDaily=2

## minus riskMult
  ALL:  T= 168 WR= 39% PF= 1.18 sumR=+19.0 exp=+0.11R pnl=$112  → balance $612 maxDD 41.6%
  2026: T=  55 WR= 31% PF= 0.86 sumR=-5.8 exp=-0.11R pnl=$-203
  blocks: regimeGate=6106 atrPct=1094 shortConf=946 maxOpen=551 exposure=410 dirOverlay=364 ddMonthly=282 ddRolling7d=219 killSwitch=106 ddDaily=69 cooldown=55 dailyTrend=16 groupCap=4

## minus ddGuard
  ALL:  T= 160 WR= 39% PF= 1.19 sumR=+19.3 exp=+0.12R pnl=$67  → balance $567 maxDD 45.0%
  2026: T=  47 WR= 30% PF= 0.85 sumR=-5.5 exp=-0.12R pnl=$-291
  blocks: regimeGate=6052 atrPct=1080 shortConf=946 ddMonthly=525 maxOpen=520 exposure=396 dirOverlay=360 ddRolling7d=163 ddDaily=69 cooldown=54 killSwitch=50 dailyTrend=11 groupCap=4

## minus regimeGate
  ALL:  T= 728 WR= 30% PF= 0.86 sumR=-78.3 exp=-0.11R pnl=$-155  → balance $345 maxDD 59.6%
  2026: T= 179 WR= 27% PF= 0.73 sumR=-39.2 exp=-0.22R pnl=$-210
  blocks: killSwitch=2284 maxOpen=1736 atrPct=1615 shortConf=1281 ddMonthly=836 exposure=825 dirOverlay=336 ddGuard=260 ddRolling7d=213 cooldown=187 ddDaily=38 dailyTrend=35 groupCap=16

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T= 822 WR= 36% PF= 1.04 sumR=+22.5 exp=+0.03R pnl=$-187  → balance $313 maxDD 83.9%
  2026: T= 174 WR= 37% PF= 1.09 sumR=+10.0 exp=+0.06R pnl=$-10
  blocks: regimeGate=5281 exposure=2474 maxOpen=1522 cooldown=189 ddGuard=102

## LS-only BASELINE
  ALL:  T=  69 WR= 29% PF= 0.83 sumR=-9.6 exp=-0.14R pnl=$-25  → balance $475 maxDD 11.9%
  2026: T=  65 WR= 31% PF= 0.90 sumR=-5.2 exp=-0.08R pnl=$2
  blocks: regimeGate=6581 dirOverlay=454 atrPct=391 killSwitch=205 maxOpen=77 exposure=57 shortConf=24 dailyTrend=24 cooldown=14 ddGuard=11

## LS-only LEAN
  ALL:  T= 585 WR= 31% PF= 0.92 sumR=-37.7 exp=-0.06R pnl=$-414  → balance $86 maxDD 90.9%
  2026: T= 267 WR= 36% PF= 1.05 sumR=+10.2 exp=+0.04R pnl=$-18
  blocks: regimeGate=6351 exposure=548 ddGuard=234 cooldown=114 maxOpen=75

## LS+RSI LEAN
  ALL:  T= 585 WR= 31% PF= 0.92 sumR=-37.7 exp=-0.06R pnl=$-414  → balance $86 maxDD 90.9%
  2026: T= 267 WR= 36% PF= 1.05 sumR=+10.2 exp=+0.04R pnl=$-18
  blocks: regimeGate=6351 exposure=548 ddGuard=234 cooldown=114 maxOpen=75

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 320 WR= 32% PF= 0.97 sumR=-6.6 exp=-0.02R pnl=$-135  → balance $365 maxDD 45.4%
  2026: T= 151 WR= 38% PF= 1.16 sumR=+16.7 exp=+0.11R pnl=$9
  blocks: regimeGate=6488 killSwitch=580 exposure=305 ddGuard=115 cooldown=70 maxOpen=25 ddDaily=4

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 320 WR= 32% PF= 0.97 sumR=-6.6 exp=-0.02R pnl=$-135  → balance $365 maxDD 45.4%
  2026: T= 151 WR= 38% PF= 1.16 sumR=+16.7 exp=+0.11R pnl=$9
  blocks: regimeGate=6488 killSwitch=580 exposure=305 ddGuard=115 cooldown=70 maxOpen=25 ddDaily=4

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 334 WR= 34% PF= 1.05 sumR=+12.7 exp=+0.04R pnl=$-134  → balance $366 maxDD 44.6%
  2026: T= 167 WR= 41% PF= 1.34 sumR=+37.4 exp=+0.22R pnl=$11
  blocks: regimeGate=6460 killSwitch=518 exposure=318 ddGuard=155 cooldown=70 maxOpen=24 groupCap=20 ddDaily=8

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 320 WR= 32% PF= 0.97 sumR=-6.6 exp=-0.02R pnl=$-135  → balance $365 maxDD 45.4%
  2026: T= 151 WR= 38% PF= 1.16 sumR=+16.7 exp=+0.11R pnl=$9
  blocks: regimeGate=6378 killSwitch=522 exposure=305 ddRolling7d=168 ddGuard=115 cooldown=70 maxOpen=25 ddDaily=4

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 333 WR= 34% PF= 1.06 sumR=+13.7 exp=+0.04R pnl=$-129  → balance $371 maxDD 44.6%
  2026: T= 166 WR= 42% PF= 1.35 sumR=+38.4 exp=+0.23R pnl=$16
  blocks: regimeGate=6326 killSwitch=434 exposure=318 ddRolling7d=219 ddGuard=155 cooldown=70 maxOpen=24 groupCap=20 ddDaily=8

## PROPOSED-F (= E without kelly)
  ALL:  T= 313 WR= 34% PF= 1.06 sumR=+12.8 exp=+0.04R pnl=$-206  → balance $294 maxDD 83.8%
  2026: T= 151 WR= 42% PF= 1.36 sumR=+35.5 exp=+0.23R pnl=$115
  blocks: regimeGate=5953 ddRolling7d=945 exposure=303 ddGuard=168 ddDaily=74 cooldown=70 killSwitch=37 maxOpen=25 groupCap=19

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  55 WR= 35% PF= 0.93 sumR=-2.6 exp=-0.05R pnl=$-56
  LONG  · BTC daily neutral T= 213 WR= 40% PF= 1.11 sumR=+14.9 exp=+0.07R pnl=$50
  LONG  · BTC daily down    T=   7 WR= 14% PF= 0.26 sumR=-4.5 exp=-0.65R pnl=$-47
  SHORT · BTC daily up      T= 142 WR= 34% PF= 1.00 sumR=+0.4 exp=+0.00R pnl=$-56
  SHORT · BTC daily neutral T=  98 WR= 43% PF= 1.03 sumR=+1.9 exp=+0.02R pnl=$-14
  SHORT · BTC daily down    T=  44 WR= 50% PF= 1.76 sumR=+16.8 exp=+0.38R pnl=$93
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 217 WR= 38% PF= 1.04 sumR=+5.3 exp=+0.02R pnl=$-18
  LONG  · BTC weekly neutral T=  22 WR= 36% PF= 1.13 sumR=+1.9 exp=+0.09R pnl=$-6
  LONG  · BTC weekly down    T=  36 WR= 39% PF= 1.02 sumR=+0.6 exp=+0.02R pnl=$-30
  SHORT · BTC weekly up      T= 197 WR= 40% PF= 1.12 sumR=+14.5 exp=+0.07R pnl=$-5
  SHORT · BTC weekly neutral T=  26 WR= 65% PF= 3.20 sumR=+21.4 exp=+0.82R pnl=$259
  SHORT · BTC weekly down    T=  61 WR= 28% PF= 0.63 sumR=-16.9 exp=-0.28R pnl=$-231

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  liquidity-sweep    ALL:  T= 138 WR= 33% PF= 0.95 sumR=-4.8 exp=-0.03R pnl=$-107
                     2026: T=  55 WR= 40% PF= 1.14 sumR=+4.8 exp=+0.09R pnl=$11
  tsmom-daily        ALL:  T= 421 WR= 41% PF= 1.13 sumR=+31.6 exp=+0.08R pnl=$76
                     2026: T=  58 WR= 40% PF= 1.04 sumR=+1.3 exp=+0.02R pnl=$-11

## Per-strategy — BASELINE (all gates)
  liquidity-sweep    ALL:  T=  32 WR= 34% PF= 1.06 sumR=+1.4 exp=+0.04R pnl=$-22
                     2026: T=  28 WR= 39% PF= 1.30 sumR=+5.8 exp=+0.21R pnl=$11
  tsmom-daily        ALL:  T= 128 WR= 41% PF= 1.23 sumR=+17.9 exp=+0.14R pnl=$89
                     2026: T=  19 WR= 16% PF= 0.31 sumR=-11.3 exp=-0.59R pnl=$-302

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  liquidity-sweep    ALL:  T= 239 WR= 30% PF= 0.85 sumR=-27.4 exp=-0.11R pnl=$-338
                     2026: T=  94 WR= 38% PF= 1.23 sumR=+14.7 exp=+0.16R pnl=$42
  tsmom-daily        ALL:  T= 583 WR= 38% PF= 1.14 sumR=+49.9 exp=+0.09R pnl=$151
                     2026: T=  80 WR= 35% PF= 0.91 sumR=-4.7 exp=-0.06R pnl=$-52

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  liquidity-sweep    ALL:  T= 320 WR= 32% PF= 0.97 sumR=-6.6 exp=-0.02R pnl=$-135
                     2026: T= 151 WR= 38% PF= 1.16 sumR=+16.7 exp=+0.11R pnl=$9

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  liquidity-sweep    ALL:  T= 320 WR= 32% PF= 0.97 sumR=-6.6 exp=-0.02R pnl=$-135
                     2026: T= 151 WR= 38% PF= 1.16 sumR=+16.7 exp=+0.11R pnl=$9

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  liquidity-sweep    ALL:  T= 334 WR= 34% PF= 1.05 sumR=+12.7 exp=+0.04R pnl=$-134
                     2026: T= 167 WR= 41% PF= 1.34 sumR=+37.4 exp=+0.22R pnl=$11

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  liquidity-sweep    ALL:  T= 320 WR= 32% PF= 0.97 sumR=-6.6 exp=-0.02R pnl=$-135
                     2026: T= 151 WR= 38% PF= 1.16 sumR=+16.7 exp=+0.11R pnl=$9

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  liquidity-sweep    ALL:  T= 333 WR= 34% PF= 1.06 sumR=+13.7 exp=+0.04R pnl=$-129
                     2026: T= 166 WR= 42% PF= 1.35 sumR=+38.4 exp=+0.23R pnl=$16

## Per-strategy — PROPOSED-F (= E without kelly)
  liquidity-sweep    ALL:  T= 313 WR= 34% PF= 1.06 sumR=+12.8 exp=+0.04R pnl=$-206
                     2026: T= 151 WR= 42% PF= 1.36 sumR=+35.5 exp=+0.23R pnl=$115

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-10  $-20.62
  2022-11  $-42.99
  2022-12  $-8.86
  2023-01  +$102.92
  2023-02  $-79.67
  2023-03  $-137.97
  2023-04  $-3.45
  2023-05  $-12.61
  2023-06  +$41.81
  2023-07  $-12.54
  2023-08  $-25.05
  2023-09  +$15.90
  2023-10  +$7.44
  2023-11  +$63.81
  2023-12  +$151.48
  2024-01  $-6.09
  2024-02  +$19.35
  2024-03  $-56.12
  2024-04  $-30.77
  2024-05  $-27.85
  2024-06  $-9.04
  2024-07  $-9.41
  2024-08  +$1.82
  2024-09  $-8.49
  2024-10  +$63.42
  2024-11  $-76.71
  2024-12  +$37.73
  2025-01  $-26.62
  2025-05  $-37.38
  2025-06  $-5.74
  2025-07  +$35.91
  2025-08  $-68.49
  2025-09  +$16.08
  2025-10  +$30.81
  2025-11  +$16.12
  2026-01  +$93.41
  2026-02  +$35.57
  2026-03  $-30.80
  2026-04  +$10.18
  2026-05  +$229.53
  2026-06  $-30.75
  2026-07  +$37.86
  2026-08  $-266.65
  2026-09  $-6.90