# Full-Pipeline Portfolio Validation — 2026-09-02
Capital $500 · base risk 2% · candles 8000 · feed MEXC futures (engine feed) · gates mirror server/routes.ts paperScan
Entry = signal candle close (since 2026-09-01). Unmodeled: MEXC volume/spread/funding filters, venue slippage, engine downtime.

Total raw candidates (post minSL+R:R): 3557

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 749 WR= 34% PF= 1.11 sumR=+62.4 exp=+0.08R pnl=$359  → balance $859 maxDD 67.0%
  2026: T= 516 WR= 32% PF= 1.03 sumR=+12.2 exp=+0.02R pnl=$-205
  blocks: exposure=839 killSwitch=806 ddRolling7d=569 cooldown=209 maxOpen=117 groupCap=95 ddDaily=88 weeklyTrend=85

## CAP maxOpen=8
  ALL:  T= 780 WR= 34% PF= 1.16 sumR=+92.2 exp=+0.12R pnl=$1073  → balance $1573 maxDD 56.4%
  2026: T= 521 WR= 32% PF= 1.06 sumR=+22.3 exp=+0.04R pnl=$190
  blocks: exposure=872 killSwitch=799 ddRolling7d=423 maxOpen=249 cooldown=197 ddDaily=104 weeklyTrend=86 groupCap=47

## CAP maxOpen=10
  ALL:  T= 735 WR= 32% PF= 1.07 sumR=+37.9 exp=+0.05R pnl=$48  → balance $548 maxDD 71.1%
  2026: T= 504 WR= 31% PF= 0.99 sumR=-5.7 exp=-0.01R pnl=$-419
  blocks: exposure=817 killSwitch=768 ddRolling7d=639 cooldown=203 maxOpen=122 ddDaily=99 groupCap=89 weeklyTrend=85

## CAP perSymbol=2
  ALL:  T= 776 WR= 34% PF= 1.16 sumR=+89.7 exp=+0.12R pnl=$1048  → balance $1548 maxDD 57.6%
  2026: T= 550 WR= 34% PF= 1.13 sumR=+52.6 exp=+0.10R pnl=$637
  blocks: exposure=786 killSwitch=767 ddRolling7d=638 cooldown=209 maxOpen=109 ddDaily=98 groupCap=89 weeklyTrend=85

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 728 WR= 33% PF= 1.11 sumR=+61.3 exp=+0.08R pnl=$485  → balance $985 maxDD 57.4%
  2026: T= 503 WR= 33% PF= 1.08 sumR=+30.7 exp=+0.06R pnl=$224
  blocks: killSwitch=853 exposure=785 ddRolling7d=504 maxOpen=238 cooldown=205 ddDaily=111 weeklyTrend=86 groupCap=47

## CAP LS cooldown 8h
  ALL:  T= 696 WR= 31% PF= 1.05 sumR=+27.1 exp=+0.04R pnl=$-82  → balance $418 maxDD 81.0%
  2026: T= 438 WR= 29% PF= 0.90 sumR=-33.2 exp=-0.08R pnl=$-753
  blocks: killSwitch=828 ddRolling7d=766 exposure=765 cooldown=166 ddDaily=101 weeklyTrend=85 maxOpen=84 groupCap=66

## CAP LS cooldown 6h
  ALL:  T= 691 WR= 31% PF= 1.04 sumR=+18.6 exp=+0.03R pnl=$-128  → balance $372 maxDD 83.1%
  2026: T= 433 WR= 28% PF= 0.88 sumR=-41.7 exp=-0.10R pnl=$-799
  blocks: killSwitch=826 ddRolling7d=797 exposure=762 cooldown=152 ddDaily=101 weeklyTrend=85 maxOpen=79 groupCap=64

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 734 WR= 33% PF= 1.12 sumR=+65.0 exp=+0.09R pnl=$573  → balance $1073 maxDD 62.4%
  2026: T= 509 WR= 33% PF= 1.10 sumR=+37.9 exp=+0.07R pnl=$347
  blocks: killSwitch=812 exposure=789 ddRolling7d=564 maxOpen=213 cooldown=184 ddDaily=128 weeklyTrend=86 groupCap=47

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 776 WR= 34% PF= 1.16 sumR=+89.7 exp=+0.12R pnl=$1048  → balance $1548 maxDD 57.6%
  2026: T= 550 WR= 34% PF= 1.13 sumR=+52.6 exp=+0.10R pnl=$637
  blocks: exposure=786 killSwitch=767 ddRolling7d=638 cooldown=209 maxOpen=109 ddDaily=98 groupCap=89 weeklyTrend=85

## CAP maxOpen=12
  ALL:  T= 818 WR= 34% PF= 1.12 sumR=+74.2 exp=+0.09R pnl=$513  → balance $1013 maxDD 70.4%
  2026: T= 584 WR= 33% PF= 1.06 sumR=+27.7 exp=+0.05R pnl=$6
  blocks: exposure=896 killSwitch=658 ddRolling7d=606 cooldown=213 groupCap=123 ddDaily=103 weeklyTrend=86 maxOpen=54

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 783 WR= 34% PF= 1.13 sumR=+76.8 exp=+0.10R pnl=$887  → balance $1387 maxDD 56.1%
  2026: T= 552 WR= 33% PF= 1.09 sumR=+36.9 exp=+0.07R pnl=$421
  blocks: exposure=886 killSwitch=674 ddRolling7d=436 groupCap=369 cooldown=187 ddDaily=97 weeklyTrend=86 maxOpen=39

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 818 WR= 34% PF= 1.12 sumR=+74.2 exp=+0.09R pnl=$513  → balance $1013 maxDD 70.4%
  2026: T= 584 WR= 33% PF= 1.06 sumR=+27.7 exp=+0.05R pnl=$6
  blocks: exposure=896 killSwitch=658 ddRolling7d=606 cooldown=213 groupCap=123 ddDaily=103 weeklyTrend=86 maxOpen=54

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 783 WR= 33% PF= 1.14 sumR=+80.5 exp=+0.10R pnl=$772  → balance $1272 maxDD 56.2%
  2026: T= 546 WR= 32% PF= 1.07 sumR=+29.0 exp=+0.05R pnl=$132
  blocks: killSwitch=888 exposure=827 ddRolling7d=500 cooldown=213 maxOpen=104 weeklyTrend=88 ddDaily=86 groupCap=68

## EXIT tp1Close=50%
  ALL:  T= 733 WR= 32% PF= 1.09 sumR=+48.0 exp=+0.07R pnl=$127  → balance $627 maxDD 66.9%
  2026: T= 502 WR= 31% PF= 1.01 sumR=+4.5 exp=+0.01R pnl=$-337
  blocks: exposure=803 killSwitch=766 ddRolling7d=670 cooldown=188 maxOpen=124 ddDaily=116 weeklyTrend=85 groupCap=72

## EXIT tp1Close=75%
  ALL:  T= 755 WR= 33% PF= 1.12 sumR=+67.3 exp=+0.09R pnl=$426  → balance $926 maxDD 65.6%
  2026: T= 522 WR= 32% PF= 1.05 sumR=+18.5 exp=+0.04R pnl=$-108
  blocks: exposure=831 killSwitch=747 ddRolling7d=596 cooldown=203 maxOpen=140 ddDaily=111 groupCap=89 weeklyTrend=85

## EXIT trail 1.5%
  ALL:  T= 721 WR= 33% PF= 1.12 sumR=+62.4 exp=+0.09R pnl=$335  → balance $835 maxDD 68.1%
  2026: T= 487 WR= 32% PF= 1.03 sumR=+12.6 exp=+0.03R pnl=$-217
  blocks: killSwitch=844 exposure=791 ddRolling7d=642 cooldown=191 maxOpen=112 ddDaily=97 weeklyTrend=85 groupCap=74

## EXIT trail 3%
  ALL:  T= 719 WR= 32% PF= 1.05 sumR=+27.2 exp=+0.04R pnl=$-71  → balance $429 maxDD 76.3%
  2026: T= 488 WR= 30% PF= 0.94 sumR=-21.6 exp=-0.04R pnl=$-617
  blocks: exposure=793 killSwitch=777 ddRolling7d=677 cooldown=194 maxOpen=140 ddDaily=100 weeklyTrend=85 groupCap=72

## EXIT trail r_multiple 2R
  ALL:  T= 749 WR= 34% PF= 1.11 sumR=+62.4 exp=+0.08R pnl=$359  → balance $859 maxDD 67.0%
  2026: T= 516 WR= 32% PF= 1.03 sumR=+12.2 exp=+0.02R pnl=$-205
  blocks: exposure=839 killSwitch=806 ddRolling7d=569 cooldown=209 maxOpen=117 groupCap=95 ddDaily=88 weeklyTrend=85

## TILT LONG:up 0.75x
  ALL:  T= 769 WR= 35% PF= 1.16 sumR=+90.6 exp=+0.12R pnl=$1243  → balance $1743 maxDD 59.9%
  2026: T= 536 WR= 34% PF= 1.10 sumR=+40.4 exp=+0.08R pnl=$706
  blocks: killSwitch=836 exposure=832 ddRolling7d=554 cooldown=201 maxOpen=109 groupCap=91 weeklyTrend=86 ddDaily=79

## TILT LONG:up 0.5x
  ALL:  T= 756 WR= 33% PF= 1.09 sumR=+50.9 exp=+0.07R pnl=$462  → balance $962 maxDD 63.4%
  2026: T= 523 WR= 32% PF= 1.00 sumR=+0.8 exp=+0.00R pnl=$-47
  blocks: killSwitch=911 exposure=826 ddRolling7d=527 cooldown=201 groupCap=96 maxOpen=91 weeklyTrend=87 ddDaily=62

## TILT LONG:up blocked
  ALL:  T= 765 WR= 36% PF= 1.25 sumR=+135.8 exp=+0.18R pnl=$3001  → balance $3501 maxDD 61.8%
  2026: T= 535 WR= 37% PF= 1.24 sumR=+90.3 exp=+0.17R pnl=$2548
  blocks: exposure=836 killSwitch=689 ddRolling7d=547 sizeTilt=193 cooldown=179 ddDaily=110 weeklyTrend=86 maxOpen=78 groupCap=74

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 763 WR= 34% PF= 1.15 sumR=+84.7 exp=+0.11R pnl=$1382  → balance $1882 maxDD 67.2%
  2026: T= 530 WR= 34% PF= 1.09 sumR=+34.5 exp=+0.07R pnl=$887
  blocks: killSwitch=851 exposure=836 ddRolling7d=556 cooldown=200 maxOpen=103 groupCap=93 weeklyTrend=86 ddDaily=69

## SAMEDIR max 4
  ALL:  T= 746 WR= 35% PF= 1.20 sumR=+105.4 exp=+0.14R pnl=$1970  → balance $2470 maxDD 44.3%
  2026: T= 526 WR= 34% PF= 1.12 sumR=+47.4 exp=+0.09R pnl=$1140
  blocks: exposure=803 killSwitch=587 sameDir=559 ddRolling7d=422 cooldown=201 weeklyTrend=86 ddDaily=86 groupCap=67

## SAMEDIR max 5
  ALL:  T= 776 WR= 33% PF= 1.08 sumR=+48.1 exp=+0.06R pnl=$414  → balance $914 maxDD 71.5%
  2026: T= 577 WR= 33% PF= 1.07 sumR=+31.6 exp=+0.05R pnl=$237
  blocks: exposure=834 killSwitch=692 ddRolling7d=464 sameDir=332 cooldown=188 weeklyTrend=88 ddDaily=87 groupCap=86 maxOpen=10

## SAMEDIR max 6
  ALL:  T= 890 WR= 35% PF= 1.22 sumR=+141.7 exp=+0.16R pnl=$3830  → balance $4330 maxDD 49.1%
  2026: T= 634 WR= 34% PF= 1.14 sumR=+66.8 exp=+0.11R pnl=$2728
  blocks: exposure=976 killSwitch=536 sameDir=284 ddRolling7d=283 cooldown=218 ddDaily=109 groupCap=100 weeklyTrend=88 maxOpen=73

## SAMEDIR max 7
  ALL:  T= 793 WR= 33% PF= 1.11 sumR=+64.6 exp=+0.08R pnl=$438  → balance $938 maxDD 61.4%
  2026: T= 562 WR= 32% PF= 1.06 sumR=+26.6 exp=+0.05R pnl=$23
  blocks: exposure=854 killSwitch=673 ddRolling7d=569 cooldown=187 ddDaily=131 sameDir=127 weeklyTrend=85 groupCap=84 maxOpen=54

## VENUE Kraken (−LUNC)
  ALL:  T= 749 WR= 34% PF= 1.11 sumR=+62.4 exp=+0.08R pnl=$359  → balance $859 maxDD 67.0%
  2026: T= 516 WR= 32% PF= 1.03 sumR=+12.2 exp=+0.02R pnl=$-205
  blocks: exposure=839 killSwitch=806 ddRolling7d=569 cooldown=209 maxOpen=117 groupCap=95 ddDaily=88 weeklyTrend=85

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 800 WR= 35% PF= 1.21 sumR=+120.3 exp=+0.15R pnl=$2177  → balance $2677 maxDD 53.0%
  2026: T= 547 WR= 34% PF= 1.14 sumR=+54.9 exp=+0.10R pnl=$1410
  blocks: exposure=864 killSwitch=650 ddRolling7d=477 cooldown=201 ddDaily=121 groupCap=96 weeklyTrend=86 maxOpen=58

## TRIAGE minus rsi-divergence
  ALL:  T= 752 WR= 33% PF= 1.15 sumR=+80.6 exp=+0.11R pnl=$650  → balance $1150 maxDD 65.4%
  2026: T= 530 WR= 32% PF= 1.08 sumR=+31.3 exp=+0.06R pnl=$93
  blocks: killSwitch=792 exposure=708 ddRolling7d=499 cooldown=139 ddDaily=100 groupCap=88 weeklyTrend=87 maxOpen=82

## BASELINE (all gates)
  ALL:  T= 336 WR= 35% PF= 1.21 sumR=+51.2 exp=+0.15R pnl=$952  → balance $1452 maxDD 42.1%
  2026: T= 214 WR= 34% PF= 1.15 sumR=+23.9 exp=+0.11R pnl=$-210
  blocks: killSwitch=698 maxOpen=514 atrPct=466 exposure=415 ddMonthly=331 dirOverlay=282 shortConf=200 cooldown=131 weeklyTrend=70 dailyTrend=60 ddRolling7d=44 ddDaily=10

## minus dirOverlay
  ALL:  T= 352 WR= 32% PF= 1.05 sumR=+13.3 exp=+0.04R pnl=$690  → balance $1190 maxDD 49.6%
  2026: T= 217 WR= 30% PF= 0.90 sumR=-16.8 exp=-0.08R pnl=$-149
  blocks: killSwitch=803 maxOpen=729 exposure=419 atrPct=396 ddMonthly=331 shortConf=134 cooldown=134 dailyTrend=132 weeklyTrend=73 ddRolling7d=44 ddDaily=10

## minus dailyTrend
  ALL:  T= 341 WR= 34% PF= 1.17 sumR=+44.1 exp=+0.13R pnl=$941  → balance $1441 maxDD 43.1%
  2026: T= 211 WR= 32% PF= 1.04 sumR=+6.6 exp=+0.03R pnl=$-130
  blocks: killSwitch=683 maxOpen=512 atrPct=440 exposure=420 ddMonthly=331 dirOverlay=283 shortConf=216 cooldown=130 ddRolling7d=85 weeklyTrend=70 ddDaily=46

## minus weeklyTrend
  ALL:  T= 367 WR= 34% PF= 1.19 sumR=+50.9 exp=+0.14R pnl=$1351  → balance $1851 maxDD 39.8%
  2026: T= 218 WR= 33% PF= 1.11 sumR=+18.2 exp=+0.08R pnl=$-180
  blocks: killSwitch=704 maxOpen=507 atrPct=469 exposure=460 ddMonthly=313 dirOverlay=282 shortConf=205 cooldown=131 dailyTrend=63 ddRolling7d=55 ddDaily=1

## minus shortConf
  ALL:  T= 395 WR= 34% PF= 1.18 sumR=+52.4 exp=+0.13R pnl=$1123  → balance $1623 maxDD 43.2%
  2026: T= 249 WR= 35% PF= 1.20 sumR=+35.8 exp=+0.14R pnl=$-170
  blocks: maxOpen=815 killSwitch=684 exposure=456 atrPct=400 ddMonthly=277 dirOverlay=222 cooldown=131 weeklyTrend=70 dailyTrend=53 ddRolling7d=44 ddDaily=10

## minus atrPct
  ALL:  T= 341 WR= 33% PF= 1.14 sumR=+36.4 exp=+0.11R pnl=$355  → balance $855 maxDD 64.0%
  2026: T= 219 WR= 31% PF= 0.97 sumR=-4.7 exp=-0.02R pnl=$-588
  blocks: maxOpen=940 killSwitch=572 ddMonthly=536 exposure=449 dirOverlay=247 shortConf=164 cooldown=104 weeklyTrend=84 ddRolling7d=58 dailyTrend=52 ddDaily=10

## minus btcCap
  ALL:  T= 371 WR= 36% PF= 1.27 sumR=+73.4 exp=+0.20R pnl=$617  → balance $1117 maxDD 61.5%
  2026: T= 251 WR= 35% PF= 1.23 sumR=+42.6 exp=+0.17R pnl=$-667
  blocks: ddMonthly=775 killSwitch=509 atrPct=455 exposure=435 dirOverlay=273 shortConf=259 ddDaily=117 cooldown=116 ddRolling7d=78 dailyTrend=70 weeklyTrend=69 groupCap=29 maxOpen=1

## minus groupCap
  ALL:  T= 336 WR= 35% PF= 1.21 sumR=+51.2 exp=+0.15R pnl=$952  → balance $1452 maxDD 42.1%
  2026: T= 214 WR= 34% PF= 1.15 sumR=+23.9 exp=+0.11R pnl=$-210
  blocks: killSwitch=698 maxOpen=514 atrPct=466 exposure=415 ddMonthly=331 dirOverlay=282 shortConf=200 cooldown=131 weeklyTrend=70 dailyTrend=60 ddRolling7d=44 ddDaily=10

## minus killSwitch
  ALL:  T= 425 WR= 32% PF= 1.08 sumR=+26.0 exp=+0.06R pnl=$553  → balance $1053 maxDD 58.0%
  2026: T= 280 WR= 29% PF= 0.91 sumR=-20.8 exp=-0.07R pnl=$-445
  blocks: maxOpen=737 atrPct=556 exposure=495 dirOverlay=327 ddMonthly=313 shortConf=217 cooldown=145 ddRolling7d=143 dailyTrend=82 weeklyTrend=70 ddDaily=44 groupCap=3

## minus ddDaily
  ALL:  T= 336 WR= 35% PF= 1.21 sumR=+51.2 exp=+0.15R pnl=$956  → balance $1456 maxDD 42.1%
  2026: T= 214 WR= 34% PF= 1.15 sumR=+23.9 exp=+0.11R pnl=$-210
  blocks: killSwitch=698 maxOpen=514 atrPct=466 exposure=414 ddMonthly=331 dirOverlay=282 shortConf=200 cooldown=133 weeklyTrend=70 dailyTrend=60 ddRolling7d=53

## minus ddMonthly
  ALL:  T= 370 WR= 34% PF= 1.18 sumR=+49.9 exp=+0.13R pnl=$1014  → balance $1514 maxDD 44.3%
  2026: T= 244 WR= 33% PF= 1.13 sumR=+23.5 exp=+0.10R pnl=$-150
  blocks: killSwitch=783 atrPct=528 maxOpen=516 exposure=450 dirOverlay=293 shortConf=219 cooldown=136 ddRolling7d=110 dailyTrend=72 weeklyTrend=70 ddDaily=10

## minus ddRolling
  ALL:  T= 338 WR= 35% PF= 1.21 sumR=+51.7 exp=+0.15R pnl=$1000  → balance $1500 maxDD 43.0%
  2026: T= 215 WR= 33% PF= 1.14 sumR=+22.7 exp=+0.11R pnl=$-234
  blocks: killSwitch=707 maxOpen=514 atrPct=463 exposure=416 ddMonthly=365 dirOverlay=282 shortConf=201 cooldown=131 weeklyTrend=70 dailyTrend=60 ddDaily=10

## minus kelly
  ALL:  T= 331 WR= 34% PF= 1.20 sumR=+48.6 exp=+0.15R pnl=$458  → balance $958 maxDD 43.4%
  2026: T= 216 WR= 33% PF= 1.13 sumR=+21.6 exp=+0.10R pnl=$104
  blocks: killSwitch=607 maxOpen=512 atrPct=475 ddMonthly=418 exposure=406 dirOverlay=259 shortConf=197 cooldown=121 ddRolling7d=99 weeklyTrend=70 dailyTrend=62

## minus riskMult
  ALL:  T= 334 WR= 34% PF= 1.20 sumR=+49.8 exp=+0.15R pnl=$1135  → balance $1635 maxDD 40.0%
  2026: T= 215 WR= 33% PF= 1.14 sumR=+22.7 exp=+0.11R pnl=$-15
  blocks: killSwitch=690 maxOpen=514 atrPct=454 exposure=415 ddMonthly=361 dirOverlay=282 shortConf=200 cooldown=131 weeklyTrend=70 dailyTrend=60 ddRolling7d=30 ddDaily=16

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1434 WR= 33% PF= 1.11 sumR=+117.1 exp=+0.08R pnl=$605  → balance $1105 maxDD 89.5%
  2026: T=1012 WR= 32% PF= 1.03 sumR=+22.6 exp=+0.02R pnl=$-579
  blocks: exposure=1457 maxOpen=353 cooldown=313

## LS-only BASELINE
  ALL:  T= 288 WR= 30% PF= 0.97 sumR=-8.0 exp=-0.03R pnl=$-69  → balance $431 maxDD 28.6%
  2026: T= 224 WR= 31% PF= 1.05 sumR=+8.4 exp=+0.04R pnl=$-9
  blocks: killSwitch=885 atrPct=469 maxOpen=412 exposure=255 dirOverlay=238 shortConf=236 dailyTrend=63 cooldown=58 ddRolling7d=28

## LS-only LEAN
  ALL:  T=1296 WR= 31% PF= 1.02 sumR=+24.5 exp=+0.02R pnl=$-276  → balance $224 maxDD 90.5%
  2026: T= 986 WR= 31% PF= 1.01 sumR=+5.4 exp=+0.01R pnl=$-221
  blocks: exposure=1112 maxOpen=288 cooldown=236

## LS+RSI LEAN
  ALL:  T=1336 WR= 31% PF= 1.02 sumR=+24.2 exp=+0.02R pnl=$-287  → balance $213 maxDD 90.3%
  2026: T=1015 WR= 31% PF= 1.00 sumR=+3.8 exp=+0.00R pnl=$-242
  blocks: exposure=1284 maxOpen=312 cooldown=310

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 799 WR= 34% PF= 1.17 sumR=+96.4 exp=+0.12R pnl=$371  → balance $871 maxDD 75.1%
  2026: T= 580 WR= 34% PF= 1.14 sumR=+59.7 exp=+0.10R pnl=$-236
  blocks: killSwitch=1309 exposure=873 cooldown=200 ddDaily=149 maxOpen=137 weeklyTrend=90

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 692 WR= 31% PF= 1.00 sumR=+2.0 exp=+0.00R pnl=$-363  → balance $137 maxDD 80.9%
  2026: T= 542 WR= 32% PF= 1.04 sumR=+15.9 exp=+0.03R pnl=$-104
  blocks: killSwitch=1462 exposure=716 cooldown=192 maxOpen=118 ddDaily=62

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 787 WR= 33% PF= 1.10 sumR=+56.8 exp=+0.07R pnl=$393  → balance $893 maxDD 74.7%
  2026: T= 581 WR= 33% PF= 1.07 sumR=+30.5 exp=+0.05R pnl=$-347
  blocks: killSwitch=1373 exposure=876 cooldown=201 groupCap=94 weeklyTrend=89 maxOpen=88 ddDaily=49

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 728 WR= 33% PF= 1.10 sumR=+55.8 exp=+0.08R pnl=$367  → balance $867 maxDD 69.4%
  2026: T= 535 WR= 33% PF= 1.06 sumR=+25.5 exp=+0.05R pnl=$-354
  blocks: killSwitch=1048 exposure=786 ddRolling7d=573 cooldown=162 maxOpen=104 weeklyTrend=88 ddDaily=68

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 727 WR= 33% PF= 1.10 sumR=+56.3 exp=+0.08R pnl=$963  → balance $1463 maxDD 60.1%
  2026: T= 536 WR= 33% PF= 1.06 sumR=+25.7 exp=+0.05R pnl=$211
  blocks: killSwitch=1072 exposure=800 ddRolling7d=479 cooldown=176 maxOpen=95 weeklyTrend=89 groupCap=77 ddDaily=42

## PROPOSED-F (= E without kelly)
  ALL:  T= 735 WR= 32% PF= 1.07 sumR=+37.9 exp=+0.05R pnl=$48  → balance $548 maxDD 71.1%
  2026: T= 504 WR= 31% PF= 0.99 sumR=-5.7 exp=-0.01R pnl=$-419
  blocks: exposure=817 killSwitch=768 ddRolling7d=639 cooldown=203 maxOpen=122 ddDaily=99 groupCap=89 weeklyTrend=85

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  79 WR= 19% PF= 0.56 sumR=-30.5 exp=-0.39R pnl=$-1025
  LONG  · BTC daily neutral T=  40 WR= 30% PF= 0.99 sumR=-0.4 exp=-0.01R pnl=$-89
  LONG  · BTC daily down    T= 118 WR= 25% PF= 0.69 sumR=-30.3 exp=-0.26R pnl=$-538
  SHORT · BTC daily up      T=  72 WR= 46% PF= 1.72 sumR=+31.1 exp=+0.43R pnl=$780
  SHORT · BTC daily neutral T=  96 WR= 43% PF= 1.62 sumR=+38.3 exp=+0.40R pnl=$604
  SHORT · BTC daily down    T= 344 WR= 35% PF= 1.22 sumR=+54.1 exp=+0.16R pnl=$627
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  17 WR= 47% PF= 2.32 sumR=+12.9 exp=+0.76R pnl=$218
  LONG  · BTC weekly neutral T=  36 WR= 17% PF= 0.44 sumR=-18.2 exp=-0.51R pnl=$-444
  LONG  · BTC weekly down    T= 184 WR= 23% PF= 0.64 sumR=-55.9 exp=-0.30R pnl=$-1425
  SHORT · BTC weekly up      T=  78 WR= 42% PF= 1.75 sumR=+36.6 exp=+0.47R pnl=$419
  SHORT · BTC weekly neutral T=  37 WR= 49% PF= 2.10 sumR=+23.3 exp=+0.63R pnl=$380
  SHORT · BTC weekly down    T= 397 WR= 36% PF= 1.23 sumR=+63.7 exp=+0.16R pnl=$1211

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  85 WR= 49% PF= 2.30 sumR=+59.2 exp=+0.70R pnl=$876
                     2026: T=  17 WR= 47% PF= 1.97 sumR=+8.5 exp=+0.50R pnl=$165
  rsi-divergence     ALL:  T=  49 WR= 41% PF= 1.31 sumR=+10.2 exp=+0.21R pnl=$204
                     2026: T=  37 WR= 43% PF= 1.45 sumR=+10.5 exp=+0.28R pnl=$219
  liquidity-sweep    ALL:  T= 615 WR= 31% PF= 0.99 sumR=-7.0 exp=-0.01R pnl=$-721
                     2026: T= 462 WR= 31% PF= 0.98 sumR=-6.8 exp=-0.01R pnl=$-590

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  69 WR= 49% PF= 2.35 sumR=+51.8 exp=+0.75R pnl=$1615
                     2026: T=  15 WR= 33% PF= 1.35 sumR=+3.9 exp=+0.26R pnl=$-14
  rsi-divergence     ALL:  T=  32 WR= 28% PF= 0.76 sumR=-6.5 exp=-0.20R pnl=$-207
                     2026: T=  22 WR= 36% PF= 1.06 sumR=+1.0 exp=+0.04R pnl=$8
  liquidity-sweep    ALL:  T= 235 WR= 31% PF= 1.03 sumR=+5.9 exp=+0.02R pnl=$-456
                     2026: T= 177 WR= 33% PF= 1.14 sumR=+19.1 exp=+0.11R pnl=$-204

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 125 WR= 47% PF= 2.16 sumR=+80.9 exp=+0.65R pnl=$1896
                     2026: T=  24 WR= 42% PF= 1.47 sumR=+6.7 exp=+0.28R pnl=$453
  rsi-divergence     ALL:  T=  57 WR= 37% PF= 1.00 sumR=+0.0 exp=+0.00R pnl=$66
                     2026: T=  41 WR= 41% PF= 1.19 sumR=+5.2 exp=+0.13R pnl=$256
  liquidity-sweep    ALL:  T=1252 WR= 31% PF= 1.04 sumR=+36.2 exp=+0.03R pnl=$-1356
                     2026: T= 947 WR= 31% PF= 1.01 sumR=+10.7 exp=+0.01R pnl=$-1288

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  92 WR= 48% PF= 2.06 sumR=+55.5 exp=+0.60R pnl=$1941
                     2026: T=  23 WR= 43% PF= 1.35 sumR=+4.9 exp=+0.21R pnl=$258
  rsi-divergence     ALL:  T=  58 WR= 38% PF= 1.08 sumR=+3.2 exp=+0.06R pnl=$-301
                     2026: T=  44 WR= 41% PF= 1.19 sumR=+5.5 exp=+0.13R pnl=$-195
  liquidity-sweep    ALL:  T= 649 WR= 32% PF= 1.08 sumR=+37.7 exp=+0.06R pnl=$-1268
                     2026: T= 513 WR= 33% PF= 1.13 sumR=+49.2 exp=+0.10R pnl=$-299

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  58 WR= 40% PF= 1.14 sumR=+5.4 exp=+0.09R pnl=$-55
                     2026: T=  44 WR= 43% PF= 1.28 sumR=+7.7 exp=+0.18R pnl=$-28
  liquidity-sweep    ALL:  T= 634 WR= 30% PF= 0.99 sumR=-3.4 exp=-0.01R pnl=$-309
                     2026: T= 498 WR= 31% PF= 1.02 sumR=+8.2 exp=+0.02R pnl=$-75

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  93 WR= 47% PF= 2.02 sumR=+54.4 exp=+0.58R pnl=$1763
                     2026: T=  24 WR= 42% PF= 1.25 sumR=+3.8 exp=+0.16R pnl=$66
  rsi-divergence     ALL:  T=  59 WR= 41% PF= 1.21 sumR=+8.4 exp=+0.14R pnl=$-291
                     2026: T=  46 WR= 43% PF= 1.33 sumR=+9.7 exp=+0.21R pnl=$-190
  liquidity-sweep    ALL:  T= 635 WR= 30% PF= 0.99 sumR=-6.0 exp=-0.01R pnl=$-1079
                     2026: T= 511 WR= 32% PF= 1.04 sumR=+17.0 exp=+0.03R pnl=$-223

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  86 WR= 49% PF= 2.26 sumR=+59.1 exp=+0.69R pnl=$2044
                     2026: T=  18 WR= 50% PF= 2.16 sumR=+10.2 exp=+0.56R pnl=$456
  rsi-divergence     ALL:  T=  47 WR= 38% PF= 1.14 sumR=+4.6 exp=+0.10R pnl=$-294
                     2026: T=  39 WR= 38% PF= 1.12 sumR=+3.2 exp=+0.08R pnl=$-333
  liquidity-sweep    ALL:  T= 595 WR= 30% PF= 0.98 sumR=-7.9 exp=-0.01R pnl=$-1383
                     2026: T= 478 WR= 31% PF= 1.03 sumR=+12.1 exp=+0.03R pnl=$-477

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  87 WR= 48% PF= 2.21 sumR=+58.1 exp=+0.67R pnl=$2013
                     2026: T=  19 WR= 47% PF= 1.93 sumR=+9.1 exp=+0.48R pnl=$422
  rsi-divergence     ALL:  T=  51 WR= 41% PF= 1.28 sumR=+9.4 exp=+0.18R pnl=$261
                     2026: T=  44 WR= 41% PF= 1.24 sumR=+7.0 exp=+0.16R pnl=$204
  liquidity-sweep    ALL:  T= 589 WR= 30% PF= 0.98 sumR=-11.2 exp=-0.02R pnl=$-1312
                     2026: T= 473 WR= 31% PF= 1.03 sumR=+9.6 exp=+0.02R pnl=$-415

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  82 WR= 49% PF= 2.28 sumR=+58.6 exp=+0.71R pnl=$841
                     2026: T=  15 WR= 47% PF= 2.11 sumR=+9.7 exp=+0.65R pnl=$151
  rsi-divergence     ALL:  T=  48 WR= 40% PF= 1.27 sumR=+8.9 exp=+0.19R pnl=$118
                     2026: T=  36 WR= 42% PF= 1.40 sumR=+9.5 exp=+0.26R pnl=$139
  liquidity-sweep    ALL:  T= 605 WR= 30% PF= 0.94 sumR=-29.6 exp=-0.05R pnl=$-912
                     2026: T= 453 WR= 30% PF= 0.93 sumR=-25.0 exp=-0.06R pnl=$-709

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2023-03  +$46.33
  2023-04  $-34.72
  2023-05  +$35.99
  2023-06  +$31.77
  2023-07  $-2.29
  2023-08  +$89.34
  2023-09  $-14.84
  2023-10  $-13.95
  2023-11  +$68.03
  2023-12  +$26.20
  2024-01  +$16.51
  2024-02  +$71.62
  2024-03  +$46.03
  2024-05  +$25.89
  2024-06  +$157.57
  2024-07  $-22.93
  2024-08  $-19.28
  2024-10  $-24.96
  2024-11  $-7.94
  2024-12  $-20.79
  2025-03  +$32.49
  2025-04  +$75.97
  2025-06  $-55.26
  2025-07  +$42.47
  2025-08  $-16.49
  2025-09  +$99.16
  2025-10  $-38.25
  2025-11  +$30.37
  2025-12  $-106.56
  2026-01  +$626.97
  2026-02  +$109.60
  2026-03  +$318.14
  2026-04  $-873.13
  2026-05  $-353.37
  2026-06  +$111.10
  2026-07  $-139.49
  2026-08  $-14.70
  2026-09  +$56.59