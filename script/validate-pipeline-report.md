# Full-Pipeline Portfolio Validation — 2026-07-15
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 3714

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1202 WR= 44% PF= 1.94 sumR=+687.6 exp=+0.57R pnl=$21567432  → balance $21567932 maxDD 31.2%
  2026: T= 706 WR= 44% PF= 1.92 sumR=+397.3 exp=+0.56R pnl=$21531243
  blocks: exposure=1186 cooldown=310 ddRolling7d=273 killSwitch=211 maxOpen=189 groupCap=128 ddDaily=124 weeklyTrend=91

## CAP maxOpen=8
  ALL:  T=1137 WR= 43% PF= 1.83 sumR=+589.9 exp=+0.52R pnl=$4457362  → balance $4457862 maxDD 43.0%
  2026: T= 653 WR= 43% PF= 1.82 sumR=+337.5 exp=+0.52R pnl=$4436920
  blocks: exposure=1090 maxOpen=343 ddRolling7d=297 cooldown=290 killSwitch=260 ddDaily=132 weeklyTrend=89 groupCap=76

## CAP maxOpen=10
  ALL:  T=1226 WR= 43% PF= 1.89 sumR=+677.2 exp=+0.55R pnl=$19657690  → balance $19658190 maxDD 35.8%
  2026: T= 727 WR= 44% PF= 1.92 sumR=+408.8 exp=+0.56R pnl=$19631657
  blocks: exposure=1171 cooldown=292 ddRolling7d=287 killSwitch=221 maxOpen=162 groupCap=135 ddDaily=131 weeklyTrend=89

## CAP perSymbol=2
  ALL:  T=1226 WR= 43% PF= 1.88 sumR=+666.7 exp=+0.54R pnl=$15350443  → balance $15350943 maxDD 37.4%
  2026: T= 718 WR= 44% PF= 1.92 sumR=+407.4 exp=+0.57R pnl=$15328335
  blocks: exposure=1106 ddRolling7d=322 cooldown=308 killSwitch=212 maxOpen=173 groupCap=138 ddDaily=135 weeklyTrend=94

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1127 WR= 43% PF= 1.83 sumR=+584.6 exp=+0.52R pnl=$4360755  → balance $4361255 maxDD 43.1%
  2026: T= 641 WR= 43% PF= 1.82 sumR=+330.1 exp=+0.52R pnl=$4339705
  blocks: exposure=1016 maxOpen=355 ddRolling7d=330 cooldown=295 killSwitch=285 ddDaily=145 weeklyTrend=86 groupCap=75

## CAP LS cooldown 8h
  ALL:  T=1248 WR= 43% PF= 1.87 sumR=+676.4 exp=+0.54R pnl=$21171294  → balance $21171794 maxDD 33.7%
  2026: T= 747 WR= 44% PF= 1.91 sumR=+416.7 exp=+0.56R pnl=$21148374
  blocks: exposure=1197 ddRolling7d=262 cooldown=253 killSwitch=230 maxOpen=162 groupCap=140 ddDaily=133 weeklyTrend=89

## CAP LS cooldown 6h
  ALL:  T=1199 WR= 43% PF= 1.88 sumR=+653.0 exp=+0.54R pnl=$14392484  → balance $14392984 maxDD 33.7%
  2026: T= 690 WR= 44% PF= 1.90 sumR=+385.0 exp=+0.56R pnl=$14365626
  blocks: exposure=1148 ddRolling7d=336 killSwitch=308 cooldown=235 maxOpen=160 ddDaily=123 groupCap=116 weeklyTrend=89

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1116 WR= 42% PF= 1.79 sumR=+559.1 exp=+0.50R pnl=$3310312  → balance $3310812 maxDD 38.4%
  2026: T= 650 WR= 42% PF= 1.80 sumR=+327.9 exp=+0.50R pnl=$3294980
  blocks: exposure=1007 killSwitch=372 maxOpen=343 ddRolling7d=323 cooldown=257 ddDaily=120 groupCap=90 weeklyTrend=86

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1226 WR= 43% PF= 1.88 sumR=+666.7 exp=+0.54R pnl=$15350443  → balance $15350943 maxDD 37.4%
  2026: T= 718 WR= 44% PF= 1.92 sumR=+407.4 exp=+0.57R pnl=$15328335
  blocks: exposure=1106 ddRolling7d=322 cooldown=308 killSwitch=212 maxOpen=173 groupCap=138 ddDaily=135 weeklyTrend=94

## CAP maxOpen=12
  ALL:  T=1200 WR= 43% PF= 1.85 sumR=+637.5 exp=+0.53R pnl=$6004763  → balance $6005263 maxDD 40.0%
  2026: T= 707 WR= 43% PF= 1.88 sumR=+388.6 exp=+0.55R pnl=$5987600
  blocks: exposure=1163 ddRolling7d=344 cooldown=282 killSwitch=257 groupCap=179 ddDaily=131 weeklyTrend=89 maxOpen=69

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1034 WR= 42% PF= 1.77 sumR=+507.3 exp=+0.49R pnl=$974080  → balance $974580 maxDD 38.9%
  2026: T= 582 WR= 43% PF= 1.79 sumR=+290.3 exp=+0.50R pnl=$961435
  blocks: exposure=1000 killSwitch=399 ddRolling7d=376 groupCap=356 cooldown=256 ddDaily=123 weeklyTrend=85 maxOpen=85

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1200 WR= 43% PF= 1.85 sumR=+637.5 exp=+0.53R pnl=$6004763  → balance $6005263 maxDD 40.0%
  2026: T= 707 WR= 43% PF= 1.88 sumR=+388.6 exp=+0.55R pnl=$5987600
  blocks: exposure=1163 ddRolling7d=344 cooldown=282 killSwitch=257 groupCap=179 ddDaily=131 weeklyTrend=89 maxOpen=69

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1257 WR= 44% PF= 1.92 sumR=+711.7 exp=+0.57R pnl=$28563302  → balance $28563802 maxDD 34.6%
  2026: T= 721 WR= 44% PF= 1.92 sumR=+410.4 exp=+0.57R pnl=$28521716
  blocks: exposure=1163 cooldown=325 ddRolling7d=291 maxOpen=183 ddDaily=181 groupCap=113 killSwitch=110 weeklyTrend=91

## EXIT tp1Close=50%
  ALL:  T=1175 WR= 43% PF= 1.83 sumR=+609.2 exp=+0.52R pnl=$4871788  → balance $4872288 maxDD 35.9%
  2026: T= 688 WR= 43% PF= 1.84 sumR=+361.4 exp=+0.53R pnl=$4853314
  blocks: exposure=1130 ddRolling7d=359 cooldown=288 killSwitch=262 maxOpen=151 groupCap=131 ddDaily=127 weeklyTrend=91

## EXIT tp1Close=75%
  ALL:  T=1226 WR= 43% PF= 1.87 sumR=+662.8 exp=+0.54R pnl=$14797539  → balance $14798039 maxDD 38.5%
  2026: T= 731 WR= 44% PF= 1.92 sumR=+412.0 exp=+0.56R pnl=$14779188
  blocks: exposure=1169 cooldown=299 ddRolling7d=269 killSwitch=235 maxOpen=163 groupCap=136 ddDaily=128 weeklyTrend=89

## EXIT trail 1.5%
  ALL:  T=1226 WR= 43% PF= 1.87 sumR=+667.1 exp=+0.54R pnl=$17957901  → balance $17958401 maxDD 36.6%
  2026: T= 737 WR= 44% PF= 1.90 sumR=+408.4 exp=+0.55R pnl=$17934773
  blocks: exposure=1165 cooldown=295 ddRolling7d=266 killSwitch=263 maxOpen=164 groupCap=130 ddDaily=114 weeklyTrend=91

## EXIT trail 3%
  ALL:  T=1171 WR= 43% PF= 1.86 sumR=+623.8 exp=+0.53R pnl=$6623782  → balance $6624282 maxDD 34.1%
  2026: T= 678 WR= 43% PF= 1.84 sumR=+356.7 exp=+0.53R pnl=$6599734
  blocks: exposure=1148 ddRolling7d=334 cooldown=298 killSwitch=227 maxOpen=177 ddDaily=140 groupCap=127 weeklyTrend=92

## EXIT trail r_multiple 2R
  ALL:  T=1202 WR= 44% PF= 1.94 sumR=+687.6 exp=+0.57R pnl=$21567432  → balance $21567932 maxDD 31.2%
  2026: T= 706 WR= 44% PF= 1.92 sumR=+397.3 exp=+0.56R pnl=$21531243
  blocks: exposure=1186 cooldown=310 ddRolling7d=273 killSwitch=211 maxOpen=189 groupCap=128 ddDaily=124 weeklyTrend=91

## TILT LONG:up 0.75x
  ALL:  T=1207 WR= 44% PF= 1.93 sumR=+685.6 exp=+0.57R pnl=$19459418  → balance $19459918 maxDD 33.8%
  2026: T= 709 WR= 44% PF= 1.90 sumR=+393.7 exp=+0.56R pnl=$19421450
  blocks: exposure=1184 cooldown=310 ddRolling7d=259 killSwitch=226 maxOpen=189 groupCap=129 ddDaily=119 weeklyTrend=91

## TILT LONG:up 0.5x
  ALL:  T=1212 WR= 44% PF= 1.92 sumR=+680.3 exp=+0.56R pnl=$16436210  → balance $16436710 maxDD 32.1%
  2026: T= 712 WR= 44% PF= 1.89 sumR=+390.4 exp=+0.55R pnl=$16399166
  blocks: exposure=1191 cooldown=310 killSwitch=240 ddRolling7d=237 maxOpen=189 groupCap=129 ddDaily=115 weeklyTrend=91

## TILT LONG:up blocked
  ALL:  T=1039 WR= 43% PF= 1.86 sumR=+554.9 exp=+0.53R pnl=$1244332  → balance $1244832 maxDD 64.9%
  2026: T= 561 WR= 43% PF= 1.81 sumR=+287.0 exp=+0.51R pnl=$1220715
  blocks: exposure=1033 ddRolling7d=460 cooldown=282 sizeTilt=222 killSwitch=215 maxOpen=141 ddDaily=120 groupCap=113 weeklyTrend=89

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1077 WR= 42% PF= 1.79 sumR=+536.6 exp=+0.50R pnl=$2342495  → balance $2342995 maxDD 60.7%
  2026: T= 577 WR= 41% PF= 1.66 sumR=+246.7 exp=+0.43R pnl=$2291939
  blocks: exposure=1079 killSwitch=418 ddRolling7d=333 cooldown=285 maxOpen=185 ddDaily=133 groupCap=113 weeklyTrend=91

## SAMEDIR max 4
  ALL:  T=1040 WR= 44% PF= 1.91 sumR=+583.6 exp=+0.56R pnl=$5648578  → balance $5649078 maxDD 29.5%
  2026: T= 607 WR= 45% PF= 1.99 sumR=+364.2 exp=+0.60R pnl=$5633183
  blocks: exposure=1036 sameDir=844 cooldown=298 killSwitch=154 ddRolling7d=110 groupCap=101 weeklyTrend=90 ddDaily=41

## SAMEDIR max 5
  ALL:  T=1098 WR= 44% PF= 1.86 sumR=+587.0 exp=+0.53R pnl=$6432073  → balance $6432573 maxDD 30.8%
  2026: T= 661 WR= 45% PF= 1.95 sumR=+379.2 exp=+0.57R pnl=$6420292
  blocks: exposure=1099 sameDir=582 cooldown=310 killSwitch=225 groupCap=113 ddRolling7d=103 weeklyTrend=93 ddDaily=75 maxOpen=16

## SAMEDIR max 6
  ALL:  T=1147 WR= 44% PF= 1.88 sumR=+620.8 exp=+0.54R pnl=$10319475  → balance $10319975 maxDD 31.0%
  2026: T= 711 WR= 45% PF= 1.91 sumR=+397.3 exp=+0.56R pnl=$10305395
  blocks: exposure=1142 sameDir=344 cooldown=312 killSwitch=221 ddRolling7d=157 groupCap=126 ddDaily=104 weeklyTrend=96 maxOpen=65

## SAMEDIR max 7
  ALL:  T=1125 WR= 43% PF= 1.85 sumR=+589.6 exp=+0.52R pnl=$4934316  → balance $4934816 maxDD 31.2%
  2026: T= 681 WR= 44% PF= 1.87 sumR=+363.3 exp=+0.53R pnl=$4920811
  blocks: exposure=1139 cooldown=317 killSwitch=285 sameDir=219 ddRolling7d=214 groupCap=131 ddDaily=121 weeklyTrend=91 maxOpen=72

## BASELINE (all gates)
  ALL:  T= 377 WR= 40% PF= 1.64 sumR=+159.7 exp=+0.42R pnl=$39636  → balance $40136 maxDD 37.9%
  2026: T= 190 WR= 39% PF= 1.57 sumR=+71.9 exp=+0.38R pnl=$34576
  blocks: maxOpen=764 atrPct=532 ddRolling7d=518 exposure=426 dirOverlay=273 shortConf=196 ddMonthly=156 killSwitch=138 cooldown=116 dailyTrend=84 ddDaily=73 weeklyTrend=58 groupCap=3

## minus dirOverlay
  ALL:  T= 397 WR= 39% PF= 1.62 sumR=+162.6 exp=+0.41R pnl=$38054  → balance $38554 maxDD 47.8%
  2026: T= 194 WR= 39% PF= 1.56 sumR=+72.6 exp=+0.37R pnl=$33044
  blocks: maxOpen=793 ddRolling7d=630 exposure=464 atrPct=454 shortConf=177 ddMonthly=161 killSwitch=157 dailyTrend=150 cooldown=136 ddDaily=125 weeklyTrend=70

## minus dailyTrend
  ALL:  T= 387 WR= 40% PF= 1.65 sumR=+164.5 exp=+0.43R pnl=$33221  → balance $33721 maxDD 40.3%
  2026: T= 193 WR= 41% PF= 1.66 sumR=+82.8 exp=+0.43R pnl=$30799
  blocks: maxOpen=775 atrPct=522 ddRolling7d=505 exposure=445 dirOverlay=263 ddMonthly=248 shortConf=220 killSwitch=112 cooldown=101 ddDaily=74 weeklyTrend=60 groupCap=2

## minus weeklyTrend
  ALL:  T= 404 WR= 41% PF= 1.74 sumR=+190.3 exp=+0.47R pnl=$101901  → balance $102401 maxDD 37.9%
  2026: T= 191 WR= 40% PF= 1.56 sumR=+71.2 exp=+0.37R pnl=$90047
  blocks: maxOpen=781 atrPct=532 ddRolling7d=465 exposure=460 dirOverlay=271 ddMonthly=217 shortConf=193 killSwitch=116 cooldown=113 dailyTrend=92 ddDaily=67 groupCap=3

## minus shortConf
  ALL:  T= 364 WR= 41% PF= 1.71 sumR=+165.7 exp=+0.46R pnl=$39452  → balance $39952 maxDD 44.1%
  2026: T= 134 WR= 39% PF= 1.54 sumR=+49.3 exp=+0.37R pnl=$27222
  blocks: ddMonthly=902 maxOpen=670 ddRolling7d=474 exposure=387 atrPct=338 dirOverlay=171 ddDaily=131 cooldown=108 dailyTrend=68 weeklyTrend=58 killSwitch=39 groupCap=4

## minus atrPct
  ALL:  T= 417 WR= 43% PF= 1.89 sumR=+228.9 exp=+0.55R pnl=$233716  → balance $234216 maxDD 35.4%
  2026: T= 159 WR= 41% PF= 1.65 sumR=+66.2 exp=+0.42R pnl=$191654
  blocks: maxOpen=957 ddMonthly=524 exposure=494 ddRolling7d=348 dirOverlay=331 shortConf=242 cooldown=134 dailyTrend=88 ddDaily=80 weeklyTrend=68 killSwitch=27 groupCap=4

## minus btcCap
  ALL:  T= 415 WR= 41% PF= 1.72 sumR=+192.1 exp=+0.46R pnl=$50489  → balance $50989 maxDD 39.5%
  2026: T= 209 WR= 42% PF= 1.68 sumR=+91.6 exp=+0.44R pnl=$44690
  blocks: ddMonthly=989 atrPct=533 exposure=503 ddRolling7d=270 shortConf=265 dirOverlay=233 cooldown=131 ddDaily=104 dailyTrend=98 killSwitch=64 weeklyTrend=57 groupCap=52

## minus groupCap
  ALL:  T= 378 WR= 39% PF= 1.64 sumR=+158.5 exp=+0.42R pnl=$38082  → balance $38582 maxDD 37.9%
  2026: T= 191 WR= 39% PF= 1.55 sumR=+70.7 exp=+0.37R pnl=$33022
  blocks: maxOpen=764 atrPct=532 ddRolling7d=518 exposure=426 dirOverlay=273 shortConf=196 ddMonthly=156 killSwitch=138 cooldown=116 dailyTrend=86 ddDaily=73 weeklyTrend=58

## minus killSwitch
  ALL:  T= 406 WR= 40% PF= 1.71 sumR=+185.5 exp=+0.46R pnl=$87661  → balance $88161 maxDD 33.5%
  2026: T= 217 WR= 41% PF= 1.68 sumR=+95.9 exp=+0.44R pnl=$82344
  blocks: maxOpen=797 atrPct=546 ddRolling7d=533 exposure=444 dirOverlay=271 shortConf=209 ddMonthly=156 cooldown=125 dailyTrend=95 ddDaily=73 weeklyTrend=56 groupCap=3

## minus ddDaily
  ALL:  T= 387 WR= 40% PF= 1.66 sumR=+168.3 exp=+0.43R pnl=$51270  → balance $51770 maxDD 36.1%
  2026: T= 195 WR= 39% PF= 1.60 sumR=+78.0 exp=+0.40R pnl=$45934
  blocks: maxOpen=780 atrPct=560 ddRolling7d=535 exposure=438 dirOverlay=285 shortConf=195 ddMonthly=156 cooldown=116 killSwitch=113 dailyTrend=90 weeklyTrend=56 groupCap=3

## minus ddMonthly
  ALL:  T= 403 WR= 40% PF= 1.67 sumR=+176.2 exp=+0.44R pnl=$55226  → balance $55726 maxDD 38.0%
  2026: T= 190 WR= 39% PF= 1.57 sumR=+71.9 exp=+0.38R pnl=$48097
  blocks: maxOpen=772 atrPct=546 ddRolling7d=529 exposure=448 dirOverlay=287 shortConf=204 killSwitch=138 cooldown=135 ddDaily=98 dailyTrend=90 weeklyTrend=61 groupCap=3

## minus ddRolling
  ALL:  T= 381 WR= 40% PF= 1.69 sumR=+170.7 exp=+0.45R pnl=$56803  → balance $57303 maxDD 43.5%
  2026: T= 186 WR= 40% PF= 1.63 sumR=+77.1 exp=+0.41R pnl=$51608
  blocks: maxOpen=675 atrPct=516 ddMonthly=427 exposure=419 killSwitch=413 dirOverlay=282 shortConf=208 cooldown=138 dailyTrend=95 ddDaily=94 weeklyTrend=63 groupCap=3

## minus kelly
  ALL:  T= 415 WR= 40% PF= 1.70 sumR=+188.2 exp=+0.45R pnl=$10458  → balance $10958 maxDD 21.2%
  2026: T= 218 WR= 41% PF= 1.67 sumR=+95.6 exp=+0.44R pnl=$8798
  blocks: maxOpen=805 atrPct=624 exposure=461 dirOverlay=298 killSwitch=282 shortConf=211 ddMonthly=156 cooldown=148 ddRolling7d=131 dailyTrend=105 weeklyTrend=63 ddDaily=12 groupCap=3

## minus riskMult
  ALL:  T= 395 WR= 40% PF= 1.68 sumR=+176.5 exp=+0.45R pnl=$78925  → balance $79425 maxDD 43.2%
  2026: T= 196 WR= 39% PF= 1.56 sumR=+73.9 exp=+0.38R pnl=$70093
  blocks: ddRolling7d=704 maxOpen=643 atrPct=486 exposure=451 dirOverlay=276 ddDaily=217 shortConf=190 cooldown=134 dailyTrend=99 weeklyTrend=61 killSwitch=39 ddMonthly=16 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1572 WR= 44% PF= 1.91 sumR=+883.0 exp=+0.56R pnl=$721300462  → balance $721300962 maxDD 43.8%
  2026: T= 873 WR= 44% PF= 1.93 sumR=+497.2 exp=+0.57R pnl=$721130849
  blocks: exposure=1481 cooldown=375 maxOpen=286

## LS-only BASELINE
  ALL:  T= 289 WR= 41% PF= 1.69 sumR=+130.2 exp=+0.45R pnl=$19612  → balance $20112 maxDD 33.3%
  2026: T= 167 WR= 43% PF= 1.75 sumR=+80.1 exp=+0.48R pnl=$18486
  blocks: maxOpen=532 atrPct=467 ddMonthly=441 ddRolling7d=417 dirOverlay=241 exposure=220 shortConf=194 dailyTrend=68 ddDaily=65 cooldown=49 killSwitch=17 groupCap=2

## LS-only LEAN
  ALL:  T=1418 WR= 44% PF= 1.92 sumR=+811.0 exp=+0.57R pnl=$220695643  → balance $220696143 maxDD 46.4%
  2026: T= 836 WR= 44% PF= 1.95 sumR=+488.3 exp=+0.58R pnl=$220636520
  blocks: exposure=1081 cooldown=270 maxOpen=233

## LS+RSI LEAN
  ALL:  T=1458 WR= 44% PF= 1.91 sumR=+818.5 exp=+0.56R pnl=$234572375  → balance $234572875 maxDD 45.7%
  2026: T= 860 WR= 44% PF= 1.94 sumR=+496.1 exp=+0.58R pnl=$234516374
  blocks: exposure=1252 cooldown=373 maxOpen=270

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1119 WR= 42% PF= 1.79 sumR=+559.5 exp=+0.50R pnl=$467441313  → balance $467441813 maxDD 60.5%
  2026: T= 660 WR= 43% PF= 1.79 sumR=+327.9 exp=+0.50R pnl=$467339217
  blocks: exposure=1086 killSwitch=639 ddDaily=312 cooldown=298 maxOpen=171 weeklyTrend=89

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1044 WR= 43% PF= 1.87 sumR=+563.7 exp=+0.54R pnl=$478613278  → balance $478613778 maxDD 62.0%
  2026: T= 662 WR= 44% PF= 1.89 sumR=+365.0 exp=+0.55R pnl=$478574580
  blocks: exposure=924 killSwitch=612 ddDaily=308 cooldown=303 maxOpen=162

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1059 WR= 42% PF= 1.77 sumR=+515.9 exp=+0.49R pnl=$170513284  → balance $170513784 maxDD 60.5%
  2026: T= 614 WR= 42% PF= 1.74 sumR=+289.3 exp=+0.47R pnl=$170419901
  blocks: exposure=1038 killSwitch=695 ddDaily=330 cooldown=287 maxOpen=131 weeklyTrend=89 groupCap=85

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1106 WR= 44% PF= 1.96 sumR=+641.7 exp=+0.58R pnl=$8332295805  → balance $8332296305 maxDD 61.6%
  2026: T= 660 WR= 45% PF= 2.01 sumR=+399.4 exp=+0.61R pnl=$8332136148
  blocks: exposure=1038 ddRolling7d=665 cooldown=282 ddDaily=259 maxOpen=185 killSwitch=96 weeklyTrend=83

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1035 WR= 43% PF= 1.87 sumR=+557.3 exp=+0.54R pnl=$995465794  → balance $995466294 maxDD 63.6%
  2026: T= 606 WR= 44% PF= 1.86 sumR=+322.9 exp=+0.53R pnl=$995326845
  blocks: exposure=993 ddRolling7d=708 cooldown=268 ddDaily=261 maxOpen=153 killSwitch=134 weeklyTrend=83 groupCap=79

## PROPOSED-F (= E without kelly)
  ALL:  T=1226 WR= 43% PF= 1.89 sumR=+677.2 exp=+0.55R pnl=$19657690  → balance $19658190 maxDD 35.8%
  2026: T= 727 WR= 44% PF= 1.92 sumR=+408.8 exp=+0.56R pnl=$19631657
  blocks: exposure=1171 cooldown=292 ddRolling7d=287 killSwitch=221 maxOpen=162 groupCap=135 ddDaily=131 weeklyTrend=89

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T= 151 WR= 34% PF= 1.13 sumR=+14.9 exp=+0.10R pnl=$126117
  LONG  · BTC daily neutral T=  70 WR= 37% PF= 1.45 sumR=+20.9 exp=+0.30R pnl=$-172447
  LONG  · BTC daily down    T= 175 WR= 42% PF= 1.86 sumR=+94.2 exp=+0.54R pnl=$3723052
  SHORT · BTC daily up      T= 196 WR= 59% PF= 3.67 sumR=+237.4 exp=+1.21R pnl=$7286433
  SHORT · BTC daily neutral T=  93 WR= 42% PF= 1.69 sumR=+39.6 exp=+0.43R pnl=$-176887
  SHORT · BTC daily down    T= 517 WR= 44% PF= 1.88 sumR=+280.5 exp=+0.54R pnl=$10781165
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  91 WR= 32% PF= 1.16 sumR=+10.9 exp=+0.12R pnl=$-437556
  LONG  · BTC weekly neutral T=  47 WR= 43% PF= 1.80 sumR=+23.7 exp=+0.50R pnl=$435657
  LONG  · BTC weekly down    T= 258 WR= 40% PF= 1.56 sumR=+95.4 exp=+0.37R pnl=$3678621
  SHORT · BTC weekly up      T= 195 WR= 50% PF= 2.52 sumR=+162.0 exp=+0.83R pnl=$997306
  SHORT · BTC weekly neutral T= 108 WR= 50% PF= 2.44 sumR=+86.6 exp=+0.80R pnl=$8272720
  SHORT · BTC weekly down    T= 503 WR= 46% PF= 2.04 sumR=+309.0 exp=+0.61R pnl=$8620685

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.70 sumR=+41.5 exp=+0.43R pnl=$51912
                     2026: T=  18 WR= 33% PF= 1.24 sumR=+3.0 exp=+0.17R pnl=$51678
  rsi-divergence     ALL:  T=  50 WR= 44% PF= 1.90 sumR=+26.1 exp=+0.52R pnl=$-581319
                     2026: T=  31 WR= 45% PF= 1.71 sumR=+12.4 exp=+0.40R pnl=$-583665
  liquidity-sweep    ALL:  T=1056 WR= 45% PF= 1.96 sumR=+620.0 exp=+0.59R pnl=$22096840
                     2026: T= 657 WR= 45% PF= 1.95 sumR=+381.9 exp=+0.58R pnl=$22063231

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  74 WR= 46% PF= 2.07 sumR=+44.8 exp=+0.61R pnl=$3745
                     2026: T=   9 WR= 44% PF= 1.79 sumR=+4.2 exp=+0.46R pnl=$2628
  rsi-divergence     ALL:  T=  27 WR= 30% PF= 1.27 sumR=+5.2 exp=+0.19R pnl=$-4190
                     2026: T=  15 WR= 40% PF= 1.48 sumR=+4.4 exp=+0.29R pnl=$-4165
  liquidity-sweep    ALL:  T= 276 WR= 39% PF= 1.59 sumR=+109.8 exp=+0.40R pnl=$40081
                     2026: T= 166 WR= 39% PF= 1.56 sumR=+63.4 exp=+0.38R pnl=$36113

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 135 WR= 44% PF= 2.02 sumR=+78.9 exp=+0.58R pnl=$-8177878
                     2026: T=  23 WR= 30% PF= 1.09 sumR=+1.5 exp=+0.07R pnl=$-8183722
  rsi-divergence     ALL:  T=  62 WR= 42% PF= 1.70 sumR=+26.1 exp=+0.42R pnl=$-25246067
                     2026: T=  35 WR= 46% PF= 1.72 sumR=+14.2 exp=+0.41R pnl=$-25258831
  liquidity-sweep    ALL:  T=1375 WR= 44% PF= 1.91 sumR=+778.0 exp=+0.57R pnl=$754724407
                     2026: T= 815 WR= 44% PF= 1.96 sumR=+481.5 exp=+0.59R pnl=$754573402

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  98 WR= 41% PF= 1.74 sumR=+44.7 exp=+0.46R pnl=$978843
                     2026: T=  18 WR= 33% PF= 1.34 sumR=+4.2 exp=+0.23R pnl=$977243
  rsi-divergence     ALL:  T=  61 WR= 41% PF= 1.63 sumR=+23.3 exp=+0.38R pnl=$-20999271
                     2026: T=  32 WR= 47% PF= 1.82 sumR=+14.3 exp=+0.45R pnl=$-21006763
  liquidity-sweep    ALL:  T= 960 WR= 43% PF= 1.81 sumR=+491.4 exp=+0.51R pnl=$487461741
                     2026: T= 610 WR= 43% PF= 1.80 sumR=+309.3 exp=+0.51R pnl=$487368737

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  62 WR= 42% PF= 1.69 sumR=+25.6 exp=+0.41R pnl=$-21184639
                     2026: T=  33 WR= 48% PF= 1.95 sumR=+16.6 exp=+0.50R pnl=$-21186896
  liquidity-sweep    ALL:  T= 982 WR= 43% PF= 1.88 sumR=+538.1 exp=+0.55R pnl=$499797917
                     2026: T= 629 WR= 44% PF= 1.89 sumR=+348.4 exp=+0.55R pnl=$499761476

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  98 WR= 41% PF= 1.74 sumR=+44.7 exp=+0.46R pnl=$324923
                     2026: T=  18 WR= 33% PF= 1.34 sumR=+4.2 exp=+0.23R pnl=$323243
  rsi-divergence     ALL:  T=  59 WR= 39% PF= 1.52 sumR=+19.4 exp=+0.33R pnl=$-7448245
                     2026: T=  31 WR= 45% PF= 1.73 sumR=+12.7 exp=+0.41R pnl=$-7450801
  liquidity-sweep    ALL:  T= 902 WR= 42% PF= 1.79 sumR=+451.8 exp=+0.50R pnl=$177636605
                     2026: T= 565 WR= 42% PF= 1.76 sumR=+272.3 exp=+0.48R pnl=$177547459

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.87 sumR=+46.8 exp=+0.52R pnl=$-3029321
                     2026: T=  14 WR= 36% PF= 1.66 sumR=+6.1 exp=+0.44R pnl=$-3039439
  rsi-divergence     ALL:  T=  47 WR= 40% PF= 1.77 sumR=+21.9 exp=+0.47R pnl=$-444091223
                     2026: T=  26 WR= 42% PF= 1.67 sumR=+10.4 exp=+0.40R pnl=$-444097306
  liquidity-sweep    ALL:  T= 969 WR= 45% PF= 1.97 sumR=+572.9 exp=+0.59R pnl=$8779416350
                     2026: T= 620 WR= 46% PF= 2.03 sumR=+382.9 exp=+0.62R pnl=$8779272893

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.87 sumR=+46.8 exp=+0.52R pnl=$-891297
                     2026: T=  14 WR= 36% PF= 1.66 sumR=+6.1 exp=+0.44R pnl=$-901737
  rsi-divergence     ALL:  T=  46 WR= 39% PF= 1.68 sumR=+19.2 exp=+0.42R pnl=$-37964364
                     2026: T=  26 WR= 42% PF= 1.65 sumR=+10.0 exp=+0.39R pnl=$-37968449
  liquidity-sweep    ALL:  T= 899 WR= 43% PF= 1.88 sumR=+491.3 exp=+0.55R pnl=$1034321456
                     2026: T= 566 WR= 44% PF= 1.87 sumR=+306.8 exp=+0.54R pnl=$1034197031

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.72 sumR=+42.6 exp=+0.44R pnl=$71766
                     2026: T=  18 WR= 33% PF= 1.29 sumR=+3.7 exp=+0.20R pnl=$71456
  rsi-divergence     ALL:  T=  50 WR= 44% PF= 1.88 sumR=+25.6 exp=+0.51R pnl=$-613358
                     2026: T=  31 WR= 45% PF= 1.73 sumR=+12.7 exp=+0.41R pnl=$-615642
  liquidity-sweep    ALL:  T=1080 WR= 44% PF= 1.91 sumR=+609.0 exp=+0.56R pnl=$20199283
                     2026: T= 678 WR= 44% PF= 1.94 sumR=+392.4 exp=+0.58R pnl=$20175843

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-12  +$43.86
  2023-01  $-11.30
  2023-02  $-22.35
  2023-03  +$30.27
  2023-04  $-33.95
  2023-05  +$2.93
  2023-06  +$18.58
  2023-07  $-24.47
  2023-08  +$135.61
  2023-09  +$28.05
  2023-10  $-14.02
  2023-11  +$65.25
  2023-12  +$55.79
  2024-01  $-16.25
  2024-02  +$28.31
  2024-03  +$93.74
  2024-04  $-36.46
  2024-05  $-34.66
  2024-06  +$95.23
  2024-07  $-58.15
  2024-08  $-17.33
  2024-10  $-34.79
  2024-11  $-5.80
  2024-12  $-16.50
  2025-01  $-19.84
  2025-03  +$28.13
  2025-04  +$89.34
  2025-06  $-44.53
  2025-07  +$61.08
  2025-08  +$120.44
  2025-09  +$1037.61
  2025-10  +$5092.87
  2025-11  +$18932.37
  2025-12  +$11934.69
  2026-01  +$256392.91
  2026-02  +$97306.14
  2026-03  +$432496.42
  2026-04  +$1142483.10
  2026-05  +$5795836.58
  2026-06  +$11666328.14
  2026-07  +$2139085.23