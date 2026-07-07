# Full-Pipeline Portfolio Validation — 2026-07-07
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 3658

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1200 WR= 45% PF= 1.99 sumR=+715.5 exp=+0.60R pnl=$34580832  → balance $34581332 maxDD 31.2%
  2026: T= 670 WR= 45% PF= 2.00 sumR=+399.5 exp=+0.60R pnl=$34524560
  blocks: exposure=1190 cooldown=301 ddRolling7d=255 killSwitch=188 maxOpen=179 groupCap=130 ddDaily=119 weeklyTrend=96

## CAP maxOpen=8
  ALL:  T=1122 WR= 43% PF= 1.82 sumR=+576.6 exp=+0.51R pnl=$4106410  → balance $4106910 maxDD 43.0%
  2026: T= 606 WR= 43% PF= 1.79 sumR=+303.7 exp=+0.50R pnl=$4076523
  blocks: exposure=1083 maxOpen=333 ddRolling7d=297 cooldown=278 killSwitch=260 ddDaily=115 weeklyTrend=94 groupCap=76

## CAP maxOpen=10
  ALL:  T=1211 WR= 44% PF= 1.90 sumR=+674.3 exp=+0.56R pnl=$20601339  → balance $20601839 maxDD 35.8%
  2026: T= 678 WR= 44% PF= 1.92 sumR=+380.2 exp=+0.56R pnl=$20561036
  blocks: exposure=1166 ddRolling7d=287 cooldown=278 killSwitch=217 maxOpen=154 groupCap=137 ddDaily=114 weeklyTrend=94

## CAP perSymbol=2
  ALL:  T=1211 WR= 43% PF= 1.89 sumR=+663.8 exp=+0.55R pnl=$15985734  → balance $15986234 maxDD 37.4%
  2026: T= 668 WR= 44% PF= 1.93 sumR=+379.8 exp=+0.57R pnl=$15952204
  blocks: exposure=1099 ddRolling7d=322 cooldown=294 killSwitch=210 maxOpen=165 groupCap=140 ddDaily=118 weeklyTrend=99

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1113 WR= 43% PF= 1.82 sumR=+570.2 exp=+0.51R pnl=$3932264  → balance $3932764 maxDD 43.1%
  2026: T= 594 WR= 43% PF= 1.79 sumR=+296.3 exp=+0.50R pnl=$3902157
  blocks: exposure=1008 maxOpen=345 ddRolling7d=330 killSwitch=285 cooldown=283 ddDaily=128 weeklyTrend=91 groupCap=75

## CAP LS cooldown 8h
  ALL:  T=1230 WR= 44% PF= 1.89 sumR=+674.6 exp=+0.55R pnl=$22514293  → balance $22514793 maxDD 33.7%
  2026: T= 694 WR= 44% PF= 1.92 sumR=+390.2 exp=+0.56R pnl=$22479318
  blocks: exposure=1188 ddRolling7d=262 cooldown=241 killSwitch=224 maxOpen=153 groupCap=142 ddDaily=124 weeklyTrend=94

## CAP LS cooldown 6h
  ALL:  T=1181 WR= 43% PF= 1.89 sumR=+651.2 exp=+0.55R pnl=$15304761  → balance $15305261 maxDD 33.7%
  2026: T= 637 WR= 44% PF= 1.92 sumR=+358.5 exp=+0.56R pnl=$15263822
  blocks: exposure=1138 ddRolling7d=336 killSwitch=302 cooldown=224 maxOpen=151 groupCap=118 ddDaily=114 weeklyTrend=94

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1102 WR= 42% PF= 1.79 sumR=+549.3 exp=+0.50R pnl=$3178346  → balance $3178846 maxDD 38.4%
  2026: T= 602 WR= 43% PF= 1.79 sumR=+299.8 exp=+0.50R pnl=$3156706
  blocks: exposure=999 killSwitch=368 maxOpen=329 ddRolling7d=323 cooldown=245 ddDaily=111 weeklyTrend=91 groupCap=90

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1211 WR= 43% PF= 1.89 sumR=+663.8 exp=+0.55R pnl=$15985734  → balance $15986234 maxDD 37.4%
  2026: T= 668 WR= 44% PF= 1.93 sumR=+379.8 exp=+0.57R pnl=$15952204
  blocks: exposure=1099 ddRolling7d=322 cooldown=294 killSwitch=210 maxOpen=165 groupCap=140 ddDaily=118 weeklyTrend=99

## CAP maxOpen=12
  ALL:  T=1189 WR= 43% PF= 1.87 sumR=+644.9 exp=+0.54R pnl=$7313004  → balance $7313504 maxDD 40.0%
  2026: T= 662 WR= 44% PF= 1.91 sumR=+370.2 exp=+0.56R pnl=$7286341
  blocks: exposure=1155 ddRolling7d=340 cooldown=280 killSwitch=250 groupCap=172 ddDaily=114 weeklyTrend=94 maxOpen=64

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1027 WR= 42% PF= 1.79 sumR=+510.4 exp=+0.50R pnl=$1108898  → balance $1109398 maxDD 38.9%
  2026: T= 542 WR= 43% PF= 1.80 sumR=+270.4 exp=+0.50R pnl=$1089911
  blocks: exposure=996 killSwitch=388 ddRolling7d=376 groupCap=338 cooldown=252 ddDaily=113 weeklyTrend=90 maxOpen=78

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1189 WR= 43% PF= 1.87 sumR=+644.9 exp=+0.54R pnl=$7313004  → balance $7313504 maxDD 40.0%
  2026: T= 662 WR= 44% PF= 1.91 sumR=+370.2 exp=+0.56R pnl=$7286341
  blocks: exposure=1155 ddRolling7d=340 cooldown=280 killSwitch=250 groupCap=172 ddDaily=114 weeklyTrend=94 maxOpen=64

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1240 WR= 44% PF= 1.93 sumR=+706.8 exp=+0.57R pnl=$29545713  → balance $29546213 maxDD 34.6%
  2026: T= 671 WR= 44% PF= 1.93 sumR=+382.0 exp=+0.57R pnl=$29482109
  blocks: exposure=1159 cooldown=308 ddRolling7d=291 maxOpen=175 ddDaily=164 groupCap=115 killSwitch=110 weeklyTrend=96

## EXIT tp1Close=50%
  ALL:  T=1160 WR= 43% PF= 1.84 sumR=+606.1 exp=+0.52R pnl=$5089340  → balance $5089840 maxDD 35.9%
  2026: T= 639 WR= 43% PF= 1.83 sumR=+332.9 exp=+0.52R pnl=$5060841
  blocks: exposure=1125 ddRolling7d=359 cooldown=274 killSwitch=258 maxOpen=143 groupCap=133 ddDaily=110 weeklyTrend=96

## EXIT tp1Close=75%
  ALL:  T=1210 WR= 43% PF= 1.88 sumR=+661.2 exp=+0.55R pnl=$15819699  → balance $15820199 maxDD 38.5%
  2026: T= 681 WR= 44% PF= 1.92 sumR=+384.1 exp=+0.56R pnl=$15790940
  blocks: exposure=1163 cooldown=285 ddRolling7d=269 killSwitch=233 maxOpen=155 groupCap=138 ddDaily=111 weeklyTrend=94

## EXIT trail 1.5%
  ALL:  T=1210 WR= 43% PF= 1.89 sumR=+669.0 exp=+0.55R pnl=$20043937  → balance $20044437 maxDD 36.6%
  2026: T= 687 WR= 44% PF= 1.91 sumR=+383.9 exp=+0.56R pnl=$20007668
  blocks: exposure=1161 cooldown=279 ddRolling7d=266 killSwitch=261 maxOpen=156 groupCap=132 ddDaily=97 weeklyTrend=96

## EXIT trail 3%
  ALL:  T=1157 WR= 44% PF= 1.87 sumR=+622.1 exp=+0.54R pnl=$7147485  → balance $7147985 maxDD 34.1%
  2026: T= 630 WR= 43% PF= 1.84 sumR=+330.1 exp=+0.52R pnl=$7110696
  blocks: exposure=1134 ddRolling7d=334 cooldown=296 killSwitch=221 maxOpen=168 ddDaily=130 groupCap=121 weeklyTrend=97

## EXIT trail r_multiple 2R
  ALL:  T=1200 WR= 45% PF= 1.99 sumR=+715.5 exp=+0.60R pnl=$34580832  → balance $34581332 maxDD 31.2%
  2026: T= 670 WR= 45% PF= 2.00 sumR=+399.5 exp=+0.60R pnl=$34524560
  blocks: exposure=1190 cooldown=301 ddRolling7d=255 killSwitch=188 maxOpen=179 groupCap=130 ddDaily=119 weeklyTrend=96

## TILT LONG:up 0.75x
  ALL:  T=1205 WR= 45% PF= 1.98 sumR=+713.5 exp=+0.59R pnl=$31652089  → balance $31652589 maxDD 33.8%
  2026: T= 673 WR= 45% PF= 1.98 sumR=+395.8 exp=+0.59R pnl=$31592205
  blocks: exposure=1188 cooldown=301 ddRolling7d=241 killSwitch=203 maxOpen=179 groupCap=131 ddDaily=114 weeklyTrend=96

## TILT LONG:up 0.5x
  ALL:  T=1210 WR= 45% PF= 1.97 sumR=+708.2 exp=+0.59R pnl=$27118486  → balance $27118986 maxDD 32.1%
  2026: T= 676 WR= 45% PF= 1.96 sumR=+392.6 exp=+0.58R pnl=$27059206
  blocks: exposure=1195 cooldown=301 ddRolling7d=219 killSwitch=217 maxOpen=179 groupCap=131 ddDaily=110 weeklyTrend=96

## TILT LONG:up blocked
  ALL:  T=1035 WR= 44% PF= 1.93 sumR=+585.1 exp=+0.57R pnl=$2112106  → balance $2112606 maxDD 64.9%
  2026: T= 525 WR= 44% PF= 1.89 sumR=+289.1 exp=+0.55R pnl=$2073106
  blocks: exposure=1037 ddRolling7d=442 cooldown=273 sizeTilt=224 killSwitch=192 maxOpen=131 groupCap=115 ddDaily=115 weeklyTrend=94

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1075 WR= 43% PF= 1.84 sumR=+564.5 exp=+0.53R pnl=$3973024  → balance $3973524 maxDD 60.7%
  2026: T= 541 WR= 42% PF= 1.72 sumR=+248.9 exp=+0.46R pnl=$3889960
  blocks: exposure=1083 killSwitch=395 ddRolling7d=315 cooldown=276 maxOpen=175 ddDaily=128 groupCap=115 weeklyTrend=96

## BASELINE (all gates)
  ALL:  T= 385 WR= 40% PF= 1.68 sumR=+171.5 exp=+0.45R pnl=$49734  → balance $50234 maxDD 38.3%
  2026: T= 184 WR= 41% PF= 1.63 sumR=+76.5 exp=+0.42R pnl=$44610
  blocks: maxOpen=725 atrPct=533 ddRolling7d=516 exposure=434 dirOverlay=248 shortConf=179 ddMonthly=156 killSwitch=134 cooldown=120 dailyTrend=88 ddDaily=73 weeklyTrend=64 groupCap=3

## minus dirOverlay
  ALL:  T= 401 WR= 39% PF= 1.63 sumR=+168.3 exp=+0.42R pnl=$40111  → balance $40611 maxDD 47.9%
  2026: T= 181 WR= 39% PF= 1.59 sumR=+71.1 exp=+0.39R pnl=$34823
  blocks: maxOpen=747 ddRolling7d=619 exposure=469 atrPct=462 shortConf=167 ddMonthly=161 killSwitch=157 dailyTrend=138 cooldown=136 ddDaily=125 weeklyTrend=76

## minus dailyTrend
  ALL:  T= 396 WR= 40% PF= 1.69 sumR=+178.5 exp=+0.45R pnl=$45554  → balance $46054 maxDD 38.3%
  2026: T= 186 WR= 42% PF= 1.75 sumR=+88.5 exp=+0.48R pnl=$42733
  blocks: maxOpen=753 atrPct=528 ddRolling7d=482 exposure=453 ddMonthly=248 dirOverlay=237 shortConf=206 killSwitch=108 cooldown=105 ddDaily=74 weeklyTrend=66 groupCap=2

## minus weeklyTrend
  ALL:  T= 415 WR= 42% PF= 1.77 sumR=+201.8 exp=+0.49R pnl=$142530  → balance $143030 maxDD 38.3%
  2026: T= 185 WR= 41% PF= 1.63 sumR=+75.8 exp=+0.41R pnl=$129086
  blocks: maxOpen=742 atrPct=533 exposure=471 ddRolling7d=463 dirOverlay=246 ddMonthly=217 shortConf=176 cooldown=117 killSwitch=112 dailyTrend=96 ddDaily=67 groupCap=3

## minus shortConf
  ALL:  T= 380 WR= 42% PF= 1.79 sumR=+188.8 exp=+0.50R pnl=$59022  → balance $59522 maxDD 44.1%
  2026: T= 129 WR= 40% PF= 1.59 sumR=+51.0 exp=+0.39R pnl=$42217
  blocks: ddMonthly=823 maxOpen=705 exposure=405 ddRolling7d=387 atrPct=369 dirOverlay=179 ddDaily=131 cooldown=107 dailyTrend=68 weeklyTrend=64 killSwitch=36 groupCap=4

## minus atrPct
  ALL:  T= 422 WR= 44% PF= 1.93 sumR=+240.6 exp=+0.57R pnl=$281377  → balance $281877 maxDD 35.4%
  2026: T= 146 WR= 42% PF= 1.69 sumR=+64.1 exp=+0.44R pnl=$228651
  blocks: maxOpen=938 ddMonthly=524 exposure=501 ddRolling7d=344 dirOverlay=294 shortConf=219 cooldown=139 dailyTrend=92 ddDaily=80 weeklyTrend=74 killSwitch=27 groupCap=4

## minus btcCap
  ALL:  T= 427 WR= 42% PF= 1.76 sumR=+207.5 exp=+0.49R pnl=$73490  → balance $73990 maxDD 39.5%
  2026: T= 204 WR= 43% PF= 1.74 sumR=+96.0 exp=+0.47R pnl=$66597
  blocks: ddMonthly=916 atrPct=545 exposure=515 ddRolling7d=268 shortConf=253 dirOverlay=225 cooldown=135 ddDaily=104 dailyTrend=102 weeklyTrend=63 killSwitch=53 groupCap=52

## minus groupCap
  ALL:  T= 386 WR= 40% PF= 1.68 sumR=+170.3 exp=+0.44R pnl=$47789  → balance $48289 maxDD 38.3%
  2026: T= 185 WR= 41% PF= 1.62 sumR=+75.3 exp=+0.41R pnl=$42666
  blocks: maxOpen=725 atrPct=533 ddRolling7d=516 exposure=434 dirOverlay=248 shortConf=179 ddMonthly=156 killSwitch=134 cooldown=120 dailyTrend=90 ddDaily=73 weeklyTrend=64

## minus killSwitch
  ALL:  T= 411 WR= 41% PF= 1.73 sumR=+193.9 exp=+0.47R pnl=$98521  → balance $99021 maxDD 33.5%
  2026: T= 208 WR= 42% PF= 1.72 sumR=+97.0 exp=+0.47R pnl=$93138
  blocks: maxOpen=758 atrPct=547 ddRolling7d=531 exposure=451 dirOverlay=246 shortConf=192 ddMonthly=156 cooldown=129 dailyTrend=99 ddDaily=73 weeklyTrend=62 groupCap=3

## minus ddDaily
  ALL:  T= 395 WR= 40% PF= 1.70 sumR=+180.0 exp=+0.46R pnl=$63840  → balance $64340 maxDD 36.1%
  2026: T= 189 WR= 41% PF= 1.67 sumR=+82.5 exp=+0.44R pnl=$58437
  blocks: maxOpen=741 atrPct=561 ddRolling7d=529 exposure=446 dirOverlay=260 shortConf=178 ddMonthly=156 cooldown=120 killSwitch=113 dailyTrend=94 weeklyTrend=62 groupCap=3

## minus ddMonthly
  ALL:  T= 414 WR= 41% PF= 1.72 sumR=+192.8 exp=+0.47R pnl=$86694  → balance $87194 maxDD 38.3%
  2026: T= 186 WR= 41% PF= 1.65 sumR=+79.1 exp=+0.43R pnl=$78081
  blocks: maxOpen=737 atrPct=553 ddRolling7d=504 exposure=457 dirOverlay=262 shortConf=187 killSwitch=140 cooldown=139 ddDaily=98 dailyTrend=97 weeklyTrend=67 groupCap=3

## minus ddRolling
  ALL:  T= 390 WR= 41% PF= 1.74 sumR=+184.7 exp=+0.47R pnl=$77504  → balance $78004 maxDD 43.9%
  2026: T= 179 WR= 42% PF= 1.72 sumR=+82.8 exp=+0.46R pnl=$71651
  blocks: maxOpen=652 atrPct=522 exposure=427 ddMonthly=427 killSwitch=390 dirOverlay=252 shortConf=191 cooldown=142 dailyTrend=99 ddDaily=94 weeklyTrend=69 groupCap=3

## minus kelly
  ALL:  T= 424 WR= 41% PF= 1.74 sumR=+202.2 exp=+0.48R pnl=$13260  → balance $13760 maxDD 21.2%
  2026: T= 211 WR= 42% PF= 1.75 sumR=+101.3 exp=+0.48R pnl=$11277
  blocks: maxOpen=782 atrPct=630 exposure=469 dirOverlay=268 killSwitch=259 shortConf=194 ddMonthly=156 cooldown=152 ddRolling7d=131 dailyTrend=109 weeklyTrend=69 ddDaily=12 groupCap=3

## minus riskMult
  ALL:  T= 355 WR= 40% PF= 1.70 sumR=+161.9 exp=+0.46R pnl=$47956  → balance $48456 maxDD 37.2%
  2026: T= 162 WR= 41% PF= 1.66 sumR=+69.8 exp=+0.43R pnl=$42541
  blocks: ddMonthly=555 maxOpen=538 atrPct=448 exposure=402 ddRolling7d=402 dirOverlay=243 ddDaily=187 shortConf=169 cooldown=110 dailyTrend=93 killSwitch=89 weeklyTrend=64 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1551 WR= 44% PF= 1.93 sumR=+885.6 exp=+0.57R pnl=$774872531  → balance $774873031 maxDD 43.8%
  2026: T= 814 WR= 45% PF= 1.97 sumR=+479.7 exp=+0.59R pnl=$774629579
  blocks: exposure=1470 cooldown=359 maxOpen=278

## LS-only BASELINE
  ALL:  T= 294 WR= 41% PF= 1.70 sumR=+133.9 exp=+0.46R pnl=$18732  → balance $19232 maxDD 33.3%
  2026: T= 157 WR= 44% PF= 1.83 sumR=+81.2 exp=+0.52R pnl=$17756
  blocks: maxOpen=492 atrPct=469 ddMonthly=441 ddRolling7d=417 dirOverlay=228 exposure=221 shortConf=173 dailyTrend=70 ddDaily=65 cooldown=53 killSwitch=17 groupCap=2

## LS-only LEAN
  ALL:  T=1395 WR= 44% PF= 1.93 sumR=+803.7 exp=+0.58R pnl=$196475021  → balance $196475521 maxDD 46.4%
  2026: T= 781 WR= 45% PF= 1.98 sumR=+467.3 exp=+0.60R pnl=$196400456
  blocks: exposure=1059 cooldown=263 maxOpen=225

## LS+RSI LEAN
  ALL:  T=1433 WR= 44% PF= 1.92 sumR=+816.2 exp=+0.57R pnl=$228841071  → balance $228841571 maxDD 45.7%
  2026: T= 802 WR= 45% PF= 1.98 sumR=+477.5 exp=+0.60R pnl=$228766663
  blocks: exposure=1235 cooldown=357 maxOpen=262

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1087 WR= 42% PF= 1.79 sumR=+540.5 exp=+0.50R pnl=$292154519  → balance $292155019 maxDD 60.5%
  2026: T= 610 WR= 43% PF= 1.78 sumR=+300.3 exp=+0.49R pnl=$292031304
  blocks: exposure=1066 killSwitch=646 ddDaily=321 cooldown=281 maxOpen=163 weeklyTrend=94

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1010 WR= 43% PF= 1.86 sumR=+540.6 exp=+0.54R pnl=$282887329  → balance $282887829 maxDD 62.0%
  2026: T= 612 WR= 44% PF= 1.90 sumR=+337.4 exp=+0.55R pnl=$282843194
  blocks: exposure=901 killSwitch=620 ddDaily=316 cooldown=286 maxOpen=154

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1028 WR= 42% PF= 1.76 sumR=+495.9 exp=+0.48R pnl=$104112453  → balance $104112953 maxDD 60.5%
  2026: T= 565 WR= 42% PF= 1.73 sumR=+260.6 exp=+0.46R pnl=$103998364
  blocks: exposure=1019 killSwitch=700 ddDaily=339 cooldown=270 maxOpen=123 weeklyTrend=94 groupCap=85

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1073 WR= 44% PF= 1.96 sumR=+625.2 exp=+0.58R pnl=$5942188231  → balance $5942188731 maxDD 61.6%
  2026: T= 610 WR= 46% PF= 2.02 sumR=+371.8 exp=+0.61R pnl=$5941968359
  blocks: exposure=1018 ddRolling7d=679 ddDaily=267 cooldown=265 maxOpen=177 killSwitch=94 weeklyTrend=85

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1003 WR= 43% PF= 1.87 sumR=+539.7 exp=+0.54R pnl=$686518125  → balance $686518625 maxDD 63.6%
  2026: T= 557 WR= 44% PF= 1.86 sumR=+294.2 exp=+0.53R pnl=$686326380
  blocks: exposure=974 ddRolling7d=720 ddDaily=269 cooldown=251 maxOpen=145 killSwitch=132 weeklyTrend=85 groupCap=79

## PROPOSED-F (= E without kelly)
  ALL:  T=1211 WR= 44% PF= 1.90 sumR=+674.3 exp=+0.56R pnl=$20601339  → balance $20601839 maxDD 35.8%
  2026: T= 678 WR= 44% PF= 1.92 sumR=+380.2 exp=+0.56R pnl=$20561036
  blocks: exposure=1166 ddRolling7d=287 cooldown=278 killSwitch=217 maxOpen=154 groupCap=137 ddDaily=114 weeklyTrend=94

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T= 153 WR= 33% PF= 1.11 sumR=+12.6 exp=+0.08R pnl=$195058
  LONG  · BTC daily neutral T=  77 WR= 35% PF= 1.34 sumR=+18.2 exp=+0.24R pnl=$-266918
  LONG  · BTC daily down    T= 163 WR= 44% PF= 2.02 sumR=+99.2 exp=+0.61R pnl=$7594291
  SHORT · BTC daily up      T= 202 WR= 58% PF= 3.62 sumR=+242.2 exp=+1.20R pnl=$11274996
  SHORT · BTC daily neutral T= 107 WR= 46% PF= 1.94 sumR=+59.2 exp=+0.55R pnl=$-98911
  SHORT · BTC daily down    T= 498 WR= 45% PF= 1.94 sumR=+284.0 exp=+0.57R pnl=$15882314
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 102 WR= 30% PF= 1.10 sumR=+7.6 exp=+0.07R pnl=$-677225
  LONG  · BTC weekly neutral T=  47 WR= 43% PF= 1.80 sumR=+23.7 exp=+0.50R pnl=$674141
  LONG  · BTC weekly down    T= 244 WR= 41% PF= 1.63 sumR=+98.8 exp=+0.40R pnl=$7525516
  SHORT · BTC weekly up      T= 216 WR= 51% PF= 2.62 sumR=+186.8 exp=+0.86R pnl=$1543616
  SHORT · BTC weekly neutral T= 108 WR= 50% PF= 2.44 sumR=+86.6 exp=+0.80R pnl=$12801018
  SHORT · BTC weekly down    T= 483 WR= 47% PF= 2.11 sumR=+312.0 exp=+0.65R pnl=$12713766

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  98 WR= 42% PF= 1.77 sumR=+45.7 exp=+0.47R pnl=$80192
                     2026: T=  18 WR= 33% PF= 1.24 sumR=+3.0 exp=+0.17R pnl=$79965
  rsi-divergence     ALL:  T=  49 WR= 47% PF= 2.08 sumR=+30.0 exp=+0.61R pnl=$189247
                     2026: T=  28 WR= 50% PF= 1.99 sumR=+14.8 exp=+0.53R pnl=$185588
  liquidity-sweep    ALL:  T=1053 WR= 45% PF= 2.01 sumR=+639.8 exp=+0.61R pnl=$34311392
                     2026: T= 624 WR= 46% PF= 2.02 sumR=+381.7 exp=+0.61R pnl=$34259008

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  74 WR= 47% PF= 2.18 sumR=+48.1 exp=+0.65R pnl=$4106
                     2026: T=   9 WR= 44% PF= 1.79 sumR=+4.2 exp=+0.46R pnl=$2724
  rsi-divergence     ALL:  T=  27 WR= 33% PF= 1.42 sumR=+7.9 exp=+0.29R pnl=$-3220
                     2026: T=  14 WR= 43% PF= 1.53 sumR=+4.6 exp=+0.33R pnl=$-3080
  liquidity-sweep    ALL:  T= 284 WR= 39% PF= 1.60 sumR=+115.5 exp=+0.41R pnl=$48848
                     2026: T= 161 WR= 40% PF= 1.64 sumR=+67.7 exp=+0.42R pnl=$44966

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 139 WR= 45% PF= 2.07 sumR=+83.8 exp=+0.60R pnl=$2255077
                     2026: T=  22 WR= 32% PF= 1.17 sumR=+2.6 exp=+0.12R pnl=$2247002
  rsi-divergence     ALL:  T=  61 WR= 44% PF= 1.84 sumR=+30.0 exp=+0.49R pnl=$-2590160
                     2026: T=  32 WR= 50% PF= 1.97 sumR=+16.7 exp=+0.52R pnl=$-2608475
  liquidity-sweep    ALL:  T=1351 WR= 44% PF= 1.93 sumR=+771.8 exp=+0.57R pnl=$775207613
                     2026: T= 760 WR= 45% PF= 2.00 sumR=+460.4 exp=+0.61R pnl=$774991052

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T= 100 WR= 42% PF= 1.81 sumR=+48.9 exp=+0.49R pnl=$1180217
                     2026: T=  18 WR= 33% PF= 1.34 sumR=+4.2 exp=+0.23R pnl=$1178406
  rsi-divergence     ALL:  T=  60 WR= 43% PF= 1.76 sumR=+27.1 exp=+0.45R pnl=$-559443
                     2026: T=  29 WR= 52% PF= 2.12 sumR=+16.8 exp=+0.58R pnl=$-568000
  liquidity-sweep    ALL:  T= 927 WR= 42% PF= 1.79 sumR=+464.5 exp=+0.50R pnl=$291533745
                     2026: T= 563 WR= 42% PF= 1.78 sumR=+279.3 exp=+0.50R pnl=$291420898

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  61 WR= 44% PF= 1.82 sumR=+29.4 exp=+0.48R pnl=$-180163
                     2026: T=  30 WR= 53% PF= 2.27 sumR=+19.0 exp=+0.63R pnl=$-182605
  liquidity-sweep    ALL:  T= 949 WR= 43% PF= 1.86 sumR=+511.2 exp=+0.54R pnl=$283067493
                     2026: T= 582 WR= 43% PF= 1.88 sumR=+318.4 exp=+0.55R pnl=$283025799

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T= 100 WR= 42% PF= 1.81 sumR=+48.9 exp=+0.49R pnl=$396456
                     2026: T=  18 WR= 33% PF= 1.34 sumR=+4.2 exp=+0.23R pnl=$394536
  rsi-divergence     ALL:  T=  58 WR= 41% PF= 1.65 sumR=+23.2 exp=+0.40R pnl=$53420
                     2026: T=  28 WR= 50% PF= 2.01 sumR=+15.2 exp=+0.54R pnl=$49111
  liquidity-sweep    ALL:  T= 870 WR= 42% PF= 1.77 sumR=+423.8 exp=+0.49R pnl=$103662577
                     2026: T= 519 WR= 42% PF= 1.73 sumR=+241.2 exp=+0.46R pnl=$103554717

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  91 WR= 44% PF= 2.01 sumR=+53.4 exp=+0.59R pnl=$-4168421
                     2026: T=  14 WR= 36% PF= 1.66 sumR=+6.1 exp=+0.44R pnl=$-4182197
  rsi-divergence     ALL:  T=  46 WR= 43% PF= 1.95 sumR=+25.7 exp=+0.56R pnl=$-107374847
                     2026: T=  23 WR= 48% PF= 1.99 sumR=+12.8 exp=+0.56R pnl=$-107383384
  liquidity-sweep    ALL:  T= 936 WR= 45% PF= 1.96 sumR=+546.0 exp=+0.58R pnl=$6053731499
                     2026: T= 573 WR= 46% PF= 2.03 sumR=+352.9 exp=+0.62R pnl=$6053533939

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  91 WR= 44% PF= 2.01 sumR=+53.4 exp=+0.59R pnl=$-1228892
                     2026: T=  14 WR= 36% PF= 1.66 sumR=+6.1 exp=+0.44R pnl=$-1243135
  rsi-divergence     ALL:  T=  45 WR= 42% PF= 1.85 sumR=+23.0 exp=+0.51R pnl=$7952792
                     2026: T=  23 WR= 48% PF= 1.96 sumR=+12.5 exp=+0.54R pnl=$7946981
  liquidity-sweep    ALL:  T= 867 WR= 43% PF= 1.86 sumR=+463.3 exp=+0.53R pnl=$679794225
                     2026: T= 520 WR= 44% PF= 1.86 sumR=+275.7 exp=+0.53R pnl=$679622534

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  98 WR= 42% PF= 1.79 sumR=+46.8 exp=+0.48R pnl=$110205
                     2026: T=  18 WR= 33% PF= 1.29 sumR=+3.7 exp=+0.20R pnl=$109888
  rsi-divergence     ALL:  T=  49 WR= 47% PF= 2.06 sumR=+29.4 exp=+0.60R pnl=$-96158
                     2026: T=  28 WR= 50% PF= 2.02 sumR=+15.2 exp=+0.54R pnl=$-99700
  liquidity-sweep    ALL:  T=1064 WR= 44% PF= 1.91 sumR=+598.1 exp=+0.56R pnl=$20587292
                     2026: T= 632 WR= 44% PF= 1.93 sumR=+361.3 exp=+0.57R pnl=$20550848

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-12  +$90.99
  2023-01  $-12.28
  2023-02  $-24.29
  2023-03  +$32.89
  2023-04  $-36.89
  2023-05  +$3.19
  2023-06  +$20.19
  2023-07  $-26.60
  2023-08  +$147.36
  2023-09  +$30.48
  2023-10  $-15.24
  2023-11  +$70.91
  2023-12  +$60.62
  2024-01  $-17.66
  2024-02  +$30.76
  2024-03  +$101.86
  2024-04  $-39.62
  2024-05  $-37.66
  2024-06  +$103.48
  2024-07  $-63.19
  2024-08  $-18.83
  2024-10  $-37.80
  2024-11  $-6.30
  2024-12  $-17.93
  2025-01  $-21.56
  2025-03  +$30.56
  2025-04  +$97.09
  2025-06  $-48.38
  2025-07  +$66.37
  2025-08  +$609.65
  2025-09  +$1590.38
  2025-10  +$7880.58
  2025-11  +$29295.48
  2025-12  +$18467.44
  2026-01  +$396736.01
  2026-02  +$150569.10
  2026-03  +$669234.21
  2026-04  +$1767849.94
  2026-05  +$8968333.39
  2026-06  +$18052186.06
  2026-07  +$4517617.04