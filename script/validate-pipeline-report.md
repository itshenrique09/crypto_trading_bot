# Full-Pipeline Portfolio Validation — 2026-09-01
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 3729

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 770 WR= 33% PF= 1.08 sumR=+45.0 exp=+0.06R pnl=$124  → balance $624 maxDD 67.0%
  2026: T= 561 WR= 33% PF= 1.05 sumR=+19.9 exp=+0.04R pnl=$-69
  blocks: exposure=963 ddRolling7d=692 killSwitch=640 cooldown=188 ddDaily=146 maxOpen=140 groupCap=101 weeklyTrend=89

## CAP maxOpen=8
  ALL:  T= 710 WR= 33% PF= 1.09 sumR=+49.7 exp=+0.07R pnl=$174  → balance $674 maxDD 73.9%
  2026: T= 509 WR= 31% PF= 1.01 sumR=+4.5 exp=+0.01R pnl=$-322
  blocks: exposure=851 killSwitch=738 ddRolling7d=688 maxOpen=215 cooldown=199 ddDaily=150 weeklyTrend=94 groupCap=84

## CAP maxOpen=10
  ALL:  T= 781 WR= 34% PF= 1.13 sumR=+74.5 exp=+0.10R pnl=$537  → balance $1037 maxDD 70.5%
  2026: T= 574 WR= 33% PF= 1.07 sumR=+30.1 exp=+0.05R pnl=$74
  blocks: exposure=975 ddRolling7d=673 killSwitch=620 cooldown=188 ddDaily=145 maxOpen=132 groupCap=123 weeklyTrend=92

## CAP perSymbol=2
  ALL:  T= 797 WR= 34% PF= 1.14 sumR=+81.4 exp=+0.10R pnl=$751  → balance $1251 maxDD 72.8%
  2026: T= 588 WR= 33% PF= 1.09 sumR=+39.4 exp=+0.07R pnl=$323
  blocks: exposure=909 killSwitch=661 ddRolling7d=623 cooldown=215 maxOpen=155 ddDaily=140 groupCap=135 weeklyTrend=94

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 711 WR= 32% PF= 1.03 sumR=+18.7 exp=+0.03R pnl=$-63  → balance $437 maxDD 82.5%
  2026: T= 508 WR= 30% PF= 0.94 sumR=-24.1 exp=-0.05R pnl=$-523
  blocks: exposure=791 killSwitch=732 ddRolling7d=725 maxOpen=214 cooldown=207 ddDaily=169 weeklyTrend=94 groupCap=86

## CAP LS cooldown 8h
  ALL:  T= 751 WR= 33% PF= 1.10 sumR=+55.2 exp=+0.07R pnl=$173  → balance $673 maxDD 67.4%
  2026: T= 542 WR= 33% PF= 1.03 sumR=+12.9 exp=+0.02R pnl=$-259
  blocks: exposure=941 killSwitch=719 ddRolling7d=691 ddDaily=170 cooldown=149 groupCap=112 maxOpen=104 weeklyTrend=92

## CAP LS cooldown 6h
  ALL:  T= 730 WR= 32% PF= 1.07 sumR=+38.0 exp=+0.05R pnl=$-10  → balance $490 maxDD 67.4%
  2026: T= 520 WR= 31% PF= 0.99 sumR=-3.2 exp=-0.01R pnl=$-427
  blocks: exposure=895 ddRolling7d=738 killSwitch=716 ddDaily=187 cooldown=155 groupCap=118 maxOpen=96 weeklyTrend=94

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 712 WR= 32% PF= 1.09 sumR=+48.2 exp=+0.07R pnl=$157  → balance $657 maxDD 72.6%
  2026: T= 508 WR= 31% PF= 1.02 sumR=+6.3 exp=+0.01R pnl=$-288
  blocks: exposure=801 killSwitch=748 ddRolling7d=698 maxOpen=253 cooldown=174 ddDaily=168 weeklyTrend=94 groupCap=81

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 797 WR= 34% PF= 1.14 sumR=+81.4 exp=+0.10R pnl=$751  → balance $1251 maxDD 72.8%
  2026: T= 588 WR= 33% PF= 1.09 sumR=+39.4 exp=+0.07R pnl=$323
  blocks: exposure=909 killSwitch=661 ddRolling7d=623 cooldown=215 maxOpen=155 ddDaily=140 groupCap=135 weeklyTrend=94

## CAP maxOpen=12
  ALL:  T= 794 WR= 34% PF= 1.13 sumR=+73.1 exp=+0.09R pnl=$446  → balance $946 maxDD 68.0%
  2026: T= 585 WR= 33% PF= 1.06 sumR=+26.9 exp=+0.05R pnl=$-28
  blocks: exposure=988 ddRolling7d=744 killSwitch=572 cooldown=184 groupCap=159 ddDaily=132 weeklyTrend=92 maxOpen=64

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 707 WR= 34% PF= 1.12 sumR=+63.0 exp=+0.09R pnl=$475  → balance $975 maxDD 64.0%
  2026: T= 498 WR= 33% PF= 1.05 sumR=+17.9 exp=+0.04R pnl=$-7
  blocks: exposure=882 killSwitch=783 ddRolling7d=625 groupCap=345 cooldown=179 ddDaily=98 weeklyTrend=85 maxOpen=25

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 794 WR= 34% PF= 1.13 sumR=+73.1 exp=+0.09R pnl=$446  → balance $946 maxDD 68.0%
  2026: T= 585 WR= 33% PF= 1.06 sumR=+26.9 exp=+0.05R pnl=$-28
  blocks: exposure=988 ddRolling7d=744 killSwitch=572 cooldown=184 groupCap=159 ddDaily=132 weeklyTrend=92 maxOpen=64

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 778 WR= 34% PF= 1.15 sumR=+83.0 exp=+0.11R pnl=$630  → balance $1130 maxDD 70.2%
  2026: T= 547 WR= 33% PF= 1.08 sumR=+33.5 exp=+0.06R pnl=$97
  blocks: exposure=950 killSwitch=687 ddRolling7d=625 cooldown=196 groupCap=139 maxOpen=133 ddDaily=130 weeklyTrend=91

## EXIT tp1Close=50%
  ALL:  T= 787 WR= 34% PF= 1.13 sumR=+77.0 exp=+0.10R pnl=$560  → balance $1060 maxDD 71.3%
  2026: T= 580 WR= 33% PF= 1.07 sumR=+32.0 exp=+0.06R pnl=$91
  blocks: exposure=979 ddRolling7d=681 killSwitch=600 cooldown=188 ddDaily=145 maxOpen=135 groupCap=122 weeklyTrend=92

## EXIT tp1Close=75%
  ALL:  T= 779 WR= 34% PF= 1.15 sumR=+83.9 exp=+0.11R pnl=$867  → balance $1367 maxDD 69.8%
  2026: T= 572 WR= 33% PF= 1.10 sumR=+40.6 exp=+0.07R pnl=$412
  blocks: exposure=962 killSwitch=728 ddRolling7d=556 cooldown=195 maxOpen=146 ddDaily=136 groupCap=133 weeklyTrend=94

## EXIT trail 1.5%
  ALL:  T= 808 WR= 35% PF= 1.18 sumR=+102.2 exp=+0.13R pnl=$1220  → balance $1720 maxDD 69.9%
  2026: T= 602 WR= 35% PF= 1.14 sumR=+61.5 exp=+0.10R pnl=$809
  blocks: exposure=996 ddRolling7d=656 killSwitch=532 cooldown=209 maxOpen=147 ddDaily=145 groupCap=144 weeklyTrend=92

## EXIT trail 3%
  ALL:  T= 761 WR= 34% PF= 1.13 sumR=+69.5 exp=+0.09R pnl=$511  → balance $1011 maxDD 67.2%
  2026: T= 557 WR= 33% PF= 1.07 sumR=+27.9 exp=+0.05R pnl=$95
  blocks: exposure=940 ddRolling7d=699 killSwitch=644 cooldown=201 ddDaily=150 maxOpen=132 groupCap=110 weeklyTrend=92

## EXIT trail r_multiple 2R
  ALL:  T= 770 WR= 33% PF= 1.08 sumR=+45.0 exp=+0.06R pnl=$124  → balance $624 maxDD 67.0%
  2026: T= 561 WR= 33% PF= 1.05 sumR=+19.9 exp=+0.04R pnl=$-69
  blocks: exposure=963 ddRolling7d=692 killSwitch=640 cooldown=188 ddDaily=146 maxOpen=140 groupCap=101 weeklyTrend=89

## TILT LONG:up 0.75x
  ALL:  T= 782 WR= 33% PF= 1.08 sumR=+45.8 exp=+0.06R pnl=$317  → balance $817 maxDD 58.4%
  2026: T= 572 WR= 33% PF= 1.05 sumR=+21.8 exp=+0.04R pnl=$148
  blocks: exposure=968 killSwitch=673 ddRolling7d=673 cooldown=188 maxOpen=141 ddDaily=116 groupCap=99 weeklyTrend=89

## TILT LONG:up 0.5x
  ALL:  T= 778 WR= 33% PF= 1.07 sumR=+41.1 exp=+0.05R pnl=$378  → balance $878 maxDD 55.7%
  2026: T= 568 WR= 33% PF= 1.04 sumR=+17.2 exp=+0.03R pnl=$219
  blocks: exposure=964 killSwitch=807 ddRolling7d=557 cooldown=185 maxOpen=138 ddDaily=114 groupCap=97 weeklyTrend=89

## TILT LONG:up blocked
  ALL:  T= 783 WR= 35% PF= 1.20 sumR=+114.8 exp=+0.15R pnl=$1244  → balance $1744 maxDD 71.8%
  2026: T= 553 WR= 35% PF= 1.18 sumR=+71.9 exp=+0.13R pnl=$864
  blocks: exposure=953 ddRolling7d=736 killSwitch=437 cooldown=202 sizeTilt=144 maxOpen=135 groupCap=127 ddDaily=120 weeklyTrend=92

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 782 WR= 33% PF= 1.08 sumR=+48.1 exp=+0.06R pnl=$839  → balance $1339 maxDD 58.8%
  2026: T= 572 WR= 33% PF= 1.06 sumR=+24.2 exp=+0.04R pnl=$663
  blocks: exposure=968 ddRolling7d=668 killSwitch=648 cooldown=185 ddDaily=149 maxOpen=141 groupCap=99 weeklyTrend=89

## SAMEDIR max 4
  ALL:  T= 605 WR= 31% PF= 1.00 sumR=-1.1 exp=-0.00R pnl=$-179  → balance $321 maxDD 76.3%
  2026: T= 399 WR= 29% PF= 0.85 sumR=-47.0 exp=-0.12R pnl=$-720
  blocks: killSwitch=958 exposure=752 ddRolling7d=530 sameDir=492 cooldown=173 weeklyTrend=85 ddDaily=84 groupCap=50

## SAMEDIR max 5
  ALL:  T= 667 WR= 33% PF= 1.09 sumR=+43.1 exp=+0.06R pnl=$317  → balance $817 maxDD 67.6%
  2026: T= 477 WR= 33% PF= 1.02 sumR=+6.8 exp=+0.01R pnl=$-65
  blocks: killSwitch=933 exposure=825 ddRolling7d=496 sameDir=347 cooldown=173 ddDaily=104 weeklyTrend=93 groupCap=65 maxOpen=26

## SAMEDIR max 6
  ALL:  T= 706 WR= 32% PF= 1.04 sumR=+20.2 exp=+0.03R pnl=$13  → balance $513 maxDD 65.6%
  2026: T= 518 WR= 32% PF= 1.01 sumR=+3.1 exp=+0.01R pnl=$-141
  blocks: exposure=886 killSwitch=810 ddRolling7d=617 sameDir=215 cooldown=188 ddDaily=97 groupCap=93 weeklyTrend=89 maxOpen=28

## SAMEDIR max 7
  ALL:  T= 702 WR= 33% PF= 1.06 sumR=+29.1 exp=+0.04R pnl=$46  → balance $546 maxDD 70.0%
  2026: T= 518 WR= 33% PF= 1.02 sumR=+8.6 exp=+0.02R pnl=$-130
  blocks: exposure=881 killSwitch=830 ddRolling7d=649 cooldown=179 sameDir=130 ddDaily=115 groupCap=115 weeklyTrend=89 maxOpen=39

## VENUE Kraken (−LUNC)
  ALL:  T= 770 WR= 33% PF= 1.08 sumR=+45.0 exp=+0.06R pnl=$124  → balance $624 maxDD 67.0%
  2026: T= 561 WR= 33% PF= 1.05 sumR=+19.9 exp=+0.04R pnl=$-69
  blocks: exposure=963 ddRolling7d=692 killSwitch=640 cooldown=188 ddDaily=146 maxOpen=140 groupCap=101 weeklyTrend=89

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 690 WR= 33% PF= 1.09 sumR=+46.6 exp=+0.07R pnl=$262  → balance $762 maxDD 59.8%
  2026: T= 477 WR= 33% PF= 1.04 sumR=+14.2 exp=+0.03R pnl=$-47
  blocks: exposure=872 ddRolling7d=773 killSwitch=539 cooldown=186 groupCap=130 maxOpen=130 ddDaily=104 weeklyTrend=92

## TRIAGE minus rsi-divergence
  ALL:  T= 674 WR= 30% PF= 0.92 sumR=-40.0 exp=-0.06R pnl=$-354  → balance $146 maxDD 89.6%
  2026: T= 477 WR= 29% PF= 0.85 sumR=-55.4 exp=-0.12R pnl=$-441
  blocks: killSwitch=749 exposure=741 ddRolling7d=712 ddDaily=145 cooldown=119 maxOpen=111 weeklyTrend=89 groupCap=70

## BASELINE (all gates)
  ALL:  T= 331 WR= 35% PF= 1.27 sumR=+64.3 exp=+0.19R pnl=$1038  → balance $1538 maxDD 54.0%
  2026: T= 192 WR= 33% PF= 1.05 sumR=+7.2 exp=+0.04R pnl=$-56
  blocks: maxOpen=892 exposure=419 atrPct=411 ddMonthly=362 ddRolling7d=335 killSwitch=328 dirOverlay=204 shortConf=173 cooldown=98 weeklyTrend=75 ddDaily=60 dailyTrend=36 groupCap=5

## minus dirOverlay
  ALL:  T= 364 WR= 36% PF= 1.29 sumR=+73.8 exp=+0.20R pnl=$1161  → balance $1661 maxDD 55.4%
  2026: T= 219 WR= 35% PF= 1.12 sumR=+19.4 exp=+0.09R pnl=$88
  blocks: maxOpen=861 exposure=441 killSwitch=428 ddRolling7d=397 atrPct=387 ddMonthly=382 shortConf=142 cooldown=112 dailyTrend=95 weeklyTrend=82 ddDaily=33 groupCap=5

## minus dailyTrend
  ALL:  T= 337 WR= 36% PF= 1.32 sumR=+77.4 exp=+0.23R pnl=$1128  → balance $1628 maxDD 64.0%
  2026: T= 192 WR= 35% PF= 1.17 sumR=+24.0 exp=+0.13R pnl=$-81
  blocks: maxOpen=945 ddMonthly=612 exposure=451 atrPct=411 killSwitch=196 dirOverlay=194 ddRolling7d=187 shortConf=186 cooldown=101 weeklyTrend=73 ddDaily=35 groupCap=1

## minus weeklyTrend
  ALL:  T= 367 WR= 38% PF= 1.39 sumR=+98.7 exp=+0.27R pnl=$3651  → balance $4151 maxDD 54.2%
  2026: T= 200 WR= 34% PF= 1.10 sumR=+14.7 exp=+0.07R pnl=$110
  blocks: maxOpen=855 exposure=472 atrPct=420 ddRolling7d=363 ddMonthly=339 killSwitch=299 dirOverlay=210 shortConf=186 cooldown=110 ddDaily=62 dailyTrend=41 groupCap=5

## minus shortConf
  ALL:  T= 377 WR= 33% PF= 1.18 sumR=+50.6 exp=+0.13R pnl=$920  → balance $1420 maxDD 41.3%
  2026: T= 236 WR= 32% PF= 1.04 sumR=+7.8 exp=+0.03R pnl=$-241
  blocks: maxOpen=988 killSwitch=748 exposure=459 atrPct=394 dirOverlay=210 ddMonthly=157 ddRolling7d=136 cooldown=133 weeklyTrend=75 dailyTrend=37 ddDaily=10 groupCap=5

## minus atrPct
  ALL:  T= 371 WR= 35% PF= 1.24 sumR=+64.4 exp=+0.17R pnl=$832  → balance $1332 maxDD 62.1%
  2026: T= 222 WR= 32% PF= 1.01 sumR=+1.0 exp=+0.00R pnl=$-438
  blocks: maxOpen=1086 ddRolling7d=576 exposure=460 ddMonthly=277 dirOverlay=242 killSwitch=206 shortConf=185 cooldown=119 weeklyTrend=83 ddDaily=65 dailyTrend=55 groupCap=4

## minus btcCap
  ALL:  T= 388 WR= 39% PF= 1.48 sumR=+125.7 exp=+0.32R pnl=$5502  → balance $6002 maxDD 58.3%
  2026: T= 236 WR= 39% PF= 1.40 sumR=+64.5 exp=+0.27R pnl=$4197
  blocks: ddMonthly=810 ddRolling7d=562 exposure=507 atrPct=496 shortConf=237 dirOverlay=201 ddDaily=131 cooldown=122 killSwitch=93 weeklyTrend=75 dailyTrend=62 groupCap=45

## minus groupCap
  ALL:  T= 326 WR= 36% PF= 1.30 sumR=+69.6 exp=+0.21R pnl=$1112  → balance $1612 maxDD 52.3%
  2026: T= 187 WR= 34% PF= 1.09 sumR=+12.5 exp=+0.07R pnl=$18
  blocks: maxOpen=844 ddMonthly=473 exposure=424 atrPct=396 ddRolling7d=358 killSwitch=254 dirOverlay=206 shortConf=174 cooldown=101 weeklyTrend=75 ddDaily=61 dailyTrend=37

## minus killSwitch
  ALL:  T= 342 WR= 36% PF= 1.32 sumR=+79.1 exp=+0.23R pnl=$1700  → balance $2200 maxDD 66.2%
  2026: T= 192 WR= 33% PF= 1.11 sumR=+15.8 exp=+0.08R pnl=$311
  blocks: maxOpen=903 ddMonthly=563 atrPct=436 exposure=424 ddRolling7d=391 dirOverlay=195 shortConf=180 cooldown=105 weeklyTrend=73 ddDaily=67 dailyTrend=49 groupCap=1

## minus ddDaily
  ALL:  T= 319 WR= 34% PF= 1.25 sumR=+57.5 exp=+0.18R pnl=$896  → balance $1396 maxDD 63.4%
  2026: T= 180 WR= 31% PF= 1.00 sumR=+0.4 exp=+0.00R pnl=$-198
  blocks: maxOpen=952 ddMonthly=538 atrPct=420 exposure=412 ddRolling7d=270 killSwitch=244 dirOverlay=201 shortConf=173 cooldown=93 weeklyTrend=73 dailyTrend=33 groupCap=1

## minus ddMonthly
  ALL:  T= 362 WR= 33% PF= 1.15 sumR=+42.0 exp=+0.12R pnl=$873  → balance $1373 maxDD 65.1%
  2026: T= 223 WR= 30% PF= 0.92 sumR=-15.1 exp=-0.07R pnl=$-221
  blocks: maxOpen=930 killSwitch=453 exposure=441 ddRolling7d=426 atrPct=416 dirOverlay=224 shortConf=188 cooldown=121 weeklyTrend=73 ddDaily=57 dailyTrend=38

## minus ddRolling
  ALL:  T= 322 WR= 34% PF= 1.23 sumR=+55.0 exp=+0.17R pnl=$904  → balance $1404 maxDD 62.3%
  2026: T= 178 WR= 31% PF= 0.98 sumR=-3.2 exp=-0.02R pnl=$-207
  blocks: maxOpen=942 ddMonthly=565 killSwitch=450 exposure=420 atrPct=394 dirOverlay=198 shortConf=176 cooldown=95 weeklyTrend=75 ddDaily=56 dailyTrend=35 groupCap=1

## minus kelly
  ALL:  T= 333 WR= 34% PF= 1.22 sumR=+55.1 exp=+0.17R pnl=$577  → balance $1077 maxDD 53.2%
  2026: T= 191 WR= 31% PF= 0.99 sumR=-1.9 exp=-0.01R pnl=$-199
  blocks: maxOpen=946 atrPct=446 exposure=435 killSwitch=413 ddMonthly=308 dirOverlay=221 ddRolling7d=208 shortConf=184 cooldown=104 weeklyTrend=75 dailyTrend=37 ddDaily=18 groupCap=1

## minus riskMult
  ALL:  T= 322 WR= 35% PF= 1.29 sumR=+67.2 exp=+0.21R pnl=$1574  → balance $2074 maxDD 58.6%
  2026: T= 186 WR= 33% PF= 1.10 sumR=+13.5 exp=+0.07R pnl=$619
  blocks: maxOpen=870 exposure=427 ddRolling7d=417 ddMonthly=411 atrPct=389 killSwitch=248 dirOverlay=199 shortConf=172 cooldown=99 weeklyTrend=75 ddDaily=58 dailyTrend=41 groupCap=1

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1427 WR= 33% PF= 1.14 sumR=+143.0 exp=+0.10R pnl=$868  → balance $1368 maxDD 91.3%
  2026: T=1012 WR= 32% PF= 1.04 sumR=+26.8 exp=+0.03R pnl=$-1048
  blocks: exposure=1547 maxOpen=431 cooldown=324

## LS-only BASELINE
  ALL:  T= 285 WR= 30% PF= 0.97 sumR=-6.3 exp=-0.02R pnl=$-187  → balance $313 maxDD 45.8%
  2026: T= 212 WR= 30% PF= 0.93 sumR=-12.5 exp=-0.06R pnl=$-82
  blocks: killSwitch=791 maxOpen=563 atrPct=433 exposure=236 dirOverlay=197 shortConf=196 ddRolling7d=123 ddMonthly=109 cooldown=62 dailyTrend=39 ddDaily=4 groupCap=4

## LS-only LEAN
  ALL:  T=1282 WR= 32% PF= 1.04 sumR=+38.6 exp=+0.03R pnl=$-289  → balance $211 maxDD 91.0%
  2026: T= 981 WR= 32% PF= 1.02 sumR=+12.4 exp=+0.01R pnl=$-272
  blocks: exposure=1146 maxOpen=353 cooldown=261

## LS+RSI LEAN
  ALL:  T=1315 WR= 33% PF= 1.08 sumR=+74.0 exp=+0.06R pnl=$-100  → balance $400 maxDD 90.9%
  2026: T=1002 WR= 32% PF= 1.04 sumR=+27.6 exp=+0.03R pnl=$-298
  blocks: exposure=1317 maxOpen=401 cooldown=328

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 799 WR= 35% PF= 1.19 sumR=+111.1 exp=+0.14R pnl=$526  → balance $1026 maxDD 70.6%
  2026: T= 589 WR= 34% PF= 1.14 sumR=+58.3 exp=+0.10R pnl=$-8
  blocks: killSwitch=1357 exposure=944 cooldown=208 ddDaily=183 maxOpen=143 weeklyTrend=95

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 707 WR= 34% PF= 1.15 sumR=+79.4 exp=+0.11R pnl=$-96  → balance $404 maxDD 77.1%
  2026: T= 580 WR= 35% PF= 1.15 sumR=+63.5 exp=+0.11R pnl=$26
  blocks: killSwitch=1357 exposure=770 cooldown=202 ddDaily=173 maxOpen=152

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 784 WR= 34% PF= 1.15 sumR=+85.6 exp=+0.11R pnl=$310  → balance $810 maxDD 76.0%
  2026: T= 596 WR= 34% PF= 1.09 sumR=+37.8 exp=+0.06R pnl=$-298
  blocks: killSwitch=1348 exposure=926 cooldown=213 ddDaily=132 groupCap=126 maxOpen=105 weeklyTrend=95

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 736 WR= 34% PF= 1.17 sumR=+90.6 exp=+0.12R pnl=$483  → balance $983 maxDD 73.0%
  2026: T= 544 WR= 34% PF= 1.12 sumR=+48.4 exp=+0.09R pnl=$55
  blocks: ddRolling7d=897 exposure=888 killSwitch=596 cooldown=192 ddDaily=173 maxOpen=153 weeklyTrend=94

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 709 WR= 32% PF= 1.05 sumR=+28.3 exp=+0.04R pnl=$457  → balance $957 maxDD 70.5%
  2026: T= 513 WR= 31% PF= 0.96 sumR=-15.2 exp=-0.03R pnl=$-48
  blocks: killSwitch=977 exposure=870 ddRolling7d=611 cooldown=205 maxOpen=117 groupCap=100 weeklyTrend=88 ddDaily=52

## PROPOSED-F (= E without kelly)
  ALL:  T= 781 WR= 34% PF= 1.13 sumR=+74.5 exp=+0.10R pnl=$537  → balance $1037 maxDD 70.5%
  2026: T= 574 WR= 33% PF= 1.07 sumR=+30.1 exp=+0.05R pnl=$74
  blocks: exposure=975 ddRolling7d=673 killSwitch=620 cooldown=188 ddDaily=145 maxOpen=132 groupCap=123 weeklyTrend=92

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  83 WR= 19% PF= 0.48 sumR=-38.3 exp=-0.46R pnl=$-789
  LONG  · BTC daily neutral T=  67 WR= 24% PF= 0.74 sumR=-14.1 exp=-0.21R pnl=$-246
  LONG  · BTC daily down    T= 100 WR= 29% PF= 0.94 sumR=-4.3 exp=-0.04R pnl=$-153
  SHORT · BTC daily up      T= 126 WR= 52% PF= 2.15 sumR=+77.4 exp=+0.61R pnl=$1256
  SHORT · BTC daily neutral T=  93 WR= 34% PF= 1.17 sumR=+11.2 exp=+0.12R pnl=$52
  SHORT · BTC daily down    T= 301 WR= 32% PF= 1.06 sumR=+13.2 exp=+0.04R pnl=$4
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  41 WR= 27% PF= 0.98 sumR=-0.5 exp=-0.01R pnl=$18
  LONG  · BTC weekly neutral T=  13 WR= 23% PF= 0.69 sumR=-3.4 exp=-0.26R pnl=$-62
  LONG  · BTC weekly down    T= 196 WR= 24% PF= 0.68 sumR=-52.8 exp=-0.27R pnl=$-1145
  SHORT · BTC weekly up      T=  81 WR= 43% PF= 1.58 sumR=+28.4 exp=+0.35R pnl=$348
  SHORT · BTC weekly neutral T=  54 WR= 48% PF= 2.15 sumR=+36.2 exp=+0.67R pnl=$577
  SHORT · BTC weekly down    T= 385 WR= 35% PF= 1.13 sumR=+37.1 exp=+0.10R pnl=$387

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  92 WR= 42% PF= 1.74 sumR=+41.7 exp=+0.45R pnl=$514
                     2026: T=  20 WR= 45% PF= 1.61 sumR=+7.2 exp=+0.36R pnl=$111
  rsi-divergence     ALL:  T=  46 WR= 46% PF= 1.79 sumR=+22.1 exp=+0.48R pnl=$367
                     2026: T=  33 WR= 45% PF= 1.68 sumR=+13.6 exp=+0.41R pnl=$229
  liquidity-sweep    ALL:  T= 632 WR= 31% PF= 0.96 sumR=-18.8 exp=-0.03R pnl=$-757
                     2026: T= 508 WR= 32% PF= 1.00 sumR=-0.8 exp=-0.00R pnl=$-409

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  75 WR= 44% PF= 1.91 sumR=+40.8 exp=+0.54R pnl=$1141
                     2026: T=  14 WR= 36% PF= 1.22 sumR=+2.2 exp=+0.16R pnl=$45
  rsi-divergence     ALL:  T=  27 WR= 33% PF= 1.46 sumR=+9.1 exp=+0.34R pnl=$150
                     2026: T=  16 WR= 31% PF= 0.99 sumR=-0.2 exp=-0.01R pnl=$-125
  liquidity-sweep    ALL:  T= 229 WR= 32% PF= 1.08 sumR=+14.4 exp=+0.06R pnl=$-253
                     2026: T= 162 WR= 33% PF= 1.04 sumR=+5.2 exp=+0.03R pnl=$25

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 135 WR= 44% PF= 1.93 sumR=+73.7 exp=+0.55R pnl=$1504
                     2026: T=  28 WR= 36% PF= 1.12 sumR=+2.3 exp=+0.08R pnl=$221
  rsi-divergence     ALL:  T=  55 WR= 44% PF= 1.79 sumR=+26.8 exp=+0.49R pnl=$1968
                     2026: T=  38 WR= 42% PF= 1.43 sumR=+10.6 exp=+0.28R pnl=$1359
  liquidity-sweep    ALL:  T=1237 WR= 32% PF= 1.05 sumR=+42.5 exp=+0.03R pnl=$-2605
                     2026: T= 946 WR= 32% PF= 1.02 sumR=+13.9 exp=+0.01R pnl=$-2629

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  97 WR= 41% PF= 1.67 sumR=+40.9 exp=+0.42R pnl=$1133
                     2026: T=  23 WR= 39% PF= 1.30 sumR=+4.6 exp=+0.20R pnl=$231
  rsi-divergence     ALL:  T=  56 WR= 46% PF= 1.91 sumR=+29.8 exp=+0.53R pnl=$1128
                     2026: T=  39 WR= 46% PF= 1.60 sumR=+14.1 exp=+0.36R pnl=$711
  liquidity-sweep    ALL:  T= 646 WR= 33% PF= 1.08 sumR=+40.4 exp=+0.06R pnl=$-1735
                     2026: T= 527 WR= 33% PF= 1.10 sumR=+39.6 exp=+0.08R pnl=$-950

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  57 WR= 47% PF= 1.96 sumR=+31.4 exp=+0.55R pnl=$422
                     2026: T=  40 WR= 48% PF= 1.67 sumR=+15.8 exp=+0.39R pnl=$274
  liquidity-sweep    ALL:  T= 650 WR= 33% PF= 1.10 sumR=+48.0 exp=+0.07R pnl=$-518
                     2026: T= 540 WR= 34% PF= 1.12 sumR=+47.7 exp=+0.09R pnl=$-248

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  96 WR= 42% PF= 1.71 sumR=+42.1 exp=+0.44R pnl=$1004
                     2026: T=  22 WR= 41% PF= 1.41 sumR=+5.7 exp=+0.26R pnl=$104
  rsi-divergence     ALL:  T=  55 WR= 47% PF= 1.98 sumR=+31.8 exp=+0.58R pnl=$1366
                     2026: T=  40 WR= 45% PF= 1.60 sumR=+14.8 exp=+0.37R pnl=$889
  liquidity-sweep    ALL:  T= 633 WR= 32% PF= 1.02 sumR=+11.8 exp=+0.02R pnl=$-2061
                     2026: T= 534 WR= 32% PF= 1.04 sumR=+17.3 exp=+0.03R pnl=$-1292

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  88 WR= 42% PF= 1.80 sumR=+42.8 exp=+0.49R pnl=$1253
                     2026: T=  15 WR= 47% PF= 2.02 sumR=+8.4 exp=+0.56R pnl=$412
  rsi-divergence     ALL:  T=  44 WR= 41% PF= 1.67 sumR=+19.1 exp=+0.43R pnl=$445
                     2026: T=  30 WR= 40% PF= 1.31 sumR=+6.4 exp=+0.21R pnl=$168
  liquidity-sweep    ALL:  T= 604 WR= 32% PF= 1.06 sumR=+28.7 exp=+0.05R pnl=$-1215
                     2026: T= 499 WR= 33% PF= 1.09 sumR=+33.7 exp=+0.07R pnl=$-526

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  93 WR= 43% PF= 1.82 sumR=+46.1 exp=+0.50R pnl=$1297
                     2026: T=  20 WR= 50% PF= 2.09 sumR=+11.7 exp=+0.59R pnl=$461
  rsi-divergence     ALL:  T=  48 WR= 40% PF= 1.56 sumR=+18.1 exp=+0.38R pnl=$598
                     2026: T=  36 WR= 36% PF= 1.16 sumR=+4.1 exp=+0.11R pnl=$271
  liquidity-sweep    ALL:  T= 568 WR= 30% PF= 0.92 sumR=-36.0 exp=-0.06R pnl=$-1438
                     2026: T= 457 WR= 30% PF= 0.91 sumR=-31.1 exp=-0.07R pnl=$-781

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  92 WR= 42% PF= 1.77 sumR=+43.3 exp=+0.47R pnl=$621
                     2026: T=  20 WR= 45% PF= 1.66 sumR=+7.9 exp=+0.39R pnl=$195
  rsi-divergence     ALL:  T=  46 WR= 48% PF= 2.13 sumR=+30.5 exp=+0.66R pnl=$653
                     2026: T=  33 WR= 45% PF= 1.71 sumR=+14.2 exp=+0.43R pnl=$395
  liquidity-sweep    ALL:  T= 643 WR= 32% PF= 1.00 sumR=+0.7 exp=+0.00R pnl=$-736
                     2026: T= 521 WR= 32% PF= 1.02 sumR=+8.1 exp=+0.02R pnl=$-516

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2023-02  $-10.45
  2023-03  +$28.90
  2023-04  $-33.19
  2023-05  +$0.85
  2023-06  +$16.99
  2023-07  $-24.17
  2023-08  +$125.68
  2023-09  +$26.13
  2023-10  $-13.53
  2023-11  +$61.33
  2023-12  +$51.90
  2024-01  $-15.65
  2024-02  +$26.25
  2024-03  +$88.10
  2024-04  $-34.86
  2024-05  $-33.14
  2024-06  +$88.18
  2024-07  $-56.62
  2024-08  $-16.41
  2024-10  $-33.38
  2024-11  $-5.81
  2024-12  $-15.73
  2025-01  $-15.02
  2025-03  +$35.11
  2025-04  +$84.30
  2025-06  $-42.96
  2025-07  +$57.67
  2025-08  $-13.44
  2025-09  +$79.43
  2025-10  $-263.47
  2025-11  +$203.54
  2025-12  $-151.19
  2026-01  +$382.84
  2026-02  +$144.54
  2026-03  $-139.53
  2026-04  $-313.73
  2026-05  +$126.39
  2026-06  +$330.70
  2026-07  $-453.22
  2026-08  $-181.43
  2026-09  +$31.92