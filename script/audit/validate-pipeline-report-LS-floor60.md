# Full-Pipeline Portfolio Validation — 2026-08-14
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 5594

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1614 WR= 44% PF= 1.95 sumR=+939.0 exp=+0.58R pnl=$527197991  → balance $527198491 maxDD 56.0%
  2026: T=1091 WR= 45% PF= 2.03 sumR=+678.9 exp=+0.62R pnl=$527181608
  blocks: exposure=1723 cooldown=501 maxOpen=447 ddRolling7d=407 ddDaily=312 killSwitch=265 groupCap=242 weeklyTrend=83

## CAP maxOpen=8
  ALL:  T=1471 WR= 44% PF= 1.95 sumR=+856.3 exp=+0.58R pnl=$279482005  → balance $279482505 maxDD 41.6%
  2026: T= 968 WR= 45% PF= 2.02 sumR=+597.5 exp=+0.62R pnl=$279463930
  blocks: exposure=1580 maxOpen=793 ddRolling7d=598 cooldown=462 ddDaily=297 killSwitch=195 groupCap=113 weeklyTrend=85

## CAP maxOpen=10
  ALL:  T=1615 WR= 43% PF= 1.90 sumR=+908.0 exp=+0.56R pnl=$368021857  → balance $368022357 maxDD 40.5%
  2026: T=1083 WR= 44% PF= 1.94 sumR=+629.8 exp=+0.58R pnl=$368000724
  blocks: exposure=1700 ddRolling7d=555 cooldown=464 maxOpen=389 ddDaily=362 groupCap=213 killSwitch=210 weeklyTrend=86

## CAP perSymbol=2
  ALL:  T=1583 WR= 43% PF= 1.90 sumR=+887.1 exp=+0.56R pnl=$211687853  → balance $211688353 maxDD 48.6%
  2026: T=1055 WR= 44% PF= 1.92 sumR=+604.7 exp=+0.57R pnl=$211665296
  blocks: exposure=1565 ddRolling7d=659 cooldown=492 maxOpen=402 ddDaily=366 groupCap=222 killSwitch=215 weeklyTrend=90

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1577 WR= 45% PF= 1.99 sumR=+946.2 exp=+0.60R pnl=$1239668797  → balance $1239669297 maxDD 35.0%
  2026: T=1076 WR= 46% PF= 2.07 sumR=+687.2 exp=+0.64R pnl=$1239650601
  blocks: exposure=1553 maxOpen=920 cooldown=529 ddDaily=319 ddRolling7d=302 killSwitch=163 groupCap=142 weeklyTrend=89

## CAP LS cooldown 8h
  ALL:  T=1615 WR= 43% PF= 1.89 sumR=+893.8 exp=+0.55R pnl=$277408578  → balance $277409078 maxDD 40.4%
  2026: T=1079 WR= 44% PF= 1.92 sumR=+619.6 exp=+0.57R pnl=$277387985
  blocks: exposure=1693 ddRolling7d=593 maxOpen=417 cooldown=383 ddDaily=367 killSwitch=228 groupCap=211 weeklyTrend=87

## CAP LS cooldown 6h
  ALL:  T=1560 WR= 43% PF= 1.86 sumR=+844.2 exp=+0.54R pnl=$130252241  → balance $130252741 maxDD 50.9%
  2026: T=1066 WR= 43% PF= 1.91 sumR=+607.3 exp=+0.57R pnl=$130239442
  blocks: exposure=1642 ddRolling7d=777 maxOpen=395 cooldown=325 ddDaily=315 killSwitch=284 groupCap=208 weeklyTrend=88

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1538 WR= 44% PF= 1.93 sumR=+879.0 exp=+0.57R pnl=$497914708  → balance $497915208 maxDD 31.4%
  2026: T=1025 WR= 45% PF= 1.99 sumR=+618.3 exp=+0.60R pnl=$497895052
  blocks: exposure=1526 maxOpen=953 ddRolling7d=439 cooldown=400 ddDaily=343 killSwitch=180 groupCap=126 weeklyTrend=89

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1583 WR= 43% PF= 1.90 sumR=+887.1 exp=+0.56R pnl=$211687853  → balance $211688353 maxDD 48.6%
  2026: T=1055 WR= 44% PF= 1.92 sumR=+604.7 exp=+0.57R pnl=$211665296
  blocks: exposure=1565 ddRolling7d=659 cooldown=492 maxOpen=402 ddDaily=366 groupCap=222 killSwitch=215 weeklyTrend=90

## CAP maxOpen=12
  ALL:  T=1509 WR= 41% PF= 1.78 sumR=+750.5 exp=+0.50R pnl=$18835471  → balance $18835971 maxDD 66.6%
  2026: T= 967 WR= 42% PF= 1.77 sumR=+480.9 exp=+0.50R pnl=$18816607
  blocks: exposure=1574 ddRolling7d=826 cooldown=459 killSwitch=414 ddDaily=324 groupCap=265 maxOpen=139 weeklyTrend=84

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1563 WR= 44% PF= 2.00 sumR=+947.9 exp=+0.61R pnl=$1269670623  → balance $1269671123 maxDD 39.3%
  2026: T=1044 WR= 46% PF= 2.09 sumR=+680.9 exp=+0.65R pnl=$1269648214
  blocks: exposure=1640 groupCap=718 cooldown=481 ddDaily=362 killSwitch=302 ddRolling7d=235 maxOpen=210 weeklyTrend=83

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1509 WR= 41% PF= 1.78 sumR=+750.5 exp=+0.50R pnl=$18835471  → balance $18835971 maxDD 66.6%
  2026: T= 967 WR= 42% PF= 1.77 sumR=+480.9 exp=+0.50R pnl=$18816607
  blocks: exposure=1574 ddRolling7d=826 cooldown=459 killSwitch=414 ddDaily=324 groupCap=265 maxOpen=139 weeklyTrend=84

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1679 WR= 44% PF= 1.99 sumR=+1018.7 exp=+0.61R pnl=$3192103139  → balance $3192103639 maxDD 43.6%
  2026: T=1156 WR= 45% PF= 2.04 sumR=+729.1 exp=+0.63R pnl=$3192070421
  blocks: exposure=1686 cooldown=541 ddRolling7d=524 maxOpen=383 ddDaily=293 groupCap=210 killSwitch=189 weeklyTrend=89

## EXIT tp1Close=50%
  ALL:  T=1574 WR= 43% PF= 1.87 sumR=+854.8 exp=+0.54R pnl=$165788643  → balance $165789143 maxDD 40.5%
  2026: T=1057 WR= 44% PF= 1.90 sumR=+593.4 exp=+0.56R pnl=$165771789
  blocks: exposure=1666 ddRolling7d=513 cooldown=457 maxOpen=388 ddDaily=369 killSwitch=334 groupCap=207 weeklyTrend=86

## EXIT tp1Close=75%
  ALL:  T=1668 WR= 44% PF= 1.94 sumR=+971.7 exp=+0.58R pnl=$1367023916  → balance $1367024416 maxDD 39.4%
  2026: T=1108 WR= 45% PF= 2.01 sumR=+681.9 exp=+0.62R pnl=$1366999065
  blocks: exposure=1721 cooldown=489 maxOpen=431 ddRolling7d=392 ddDaily=350 killSwitch=231 groupCap=225 weeklyTrend=87

## EXIT trail 1.5%
  ALL:  T=1614 WR= 43% PF= 1.93 sumR=+933.7 exp=+0.58R pnl=$499180706  → balance $499181206 maxDD 54.9%
  2026: T=1052 WR= 44% PF= 1.95 sumR=+622.2 exp=+0.59R pnl=$499141607
  blocks: exposure=1684 ddRolling7d=631 cooldown=467 maxOpen=387 ddDaily=372 groupCap=206 killSwitch=147 weeklyTrend=86

## EXIT trail 3%
  ALL:  T=1633 WR= 44% PF= 1.96 sumR=+956.4 exp=+0.59R pnl=$721846490  → balance $721846990 maxDD 53.0%
  2026: T=1090 WR= 45% PF= 2.02 sumR=+674.1 exp=+0.62R pnl=$721823378
  blocks: exposure=1710 ddRolling7d=512 cooldown=502 maxOpen=403 ddDaily=377 groupCap=220 killSwitch=154 weeklyTrend=83

## EXIT trail r_multiple 2R
  ALL:  T=1614 WR= 44% PF= 1.95 sumR=+939.0 exp=+0.58R pnl=$527197991  → balance $527198491 maxDD 56.0%
  2026: T=1091 WR= 45% PF= 2.03 sumR=+678.9 exp=+0.62R pnl=$527181608
  blocks: exposure=1723 cooldown=501 maxOpen=447 ddRolling7d=407 ddDaily=312 killSwitch=265 groupCap=242 weeklyTrend=83

## TILT LONG:up 0.75x
  ALL:  T=1613 WR= 44% PF= 1.96 sumR=+946.0 exp=+0.59R pnl=$585583083  → balance $585583583 maxDD 53.8%
  2026: T=1092 WR= 45% PF= 2.02 sumR=+674.8 exp=+0.62R pnl=$585562995
  blocks: exposure=1729 cooldown=502 maxOpen=449 ddRolling7d=400 ddDaily=286 killSwitch=283 groupCap=250 weeklyTrend=82

## TILT LONG:up 0.5x
  ALL:  T=1623 WR= 44% PF= 1.96 sumR=+950.7 exp=+0.59R pnl=$528196885  → balance $528197385 maxDD 59.1%
  2026: T=1102 WR= 45% PF= 2.01 sumR=+676.8 exp=+0.61R pnl=$528177158
  blocks: exposure=1739 cooldown=502 maxOpen=460 ddRolling7d=390 killSwitch=301 groupCap=250 ddDaily=247 weeklyTrend=82

## TILT LONG:up blocked
  ALL:  T=1489 WR= 45% PF= 2.04 sumR=+934.5 exp=+0.63R pnl=$411350945  → balance $411351445 maxDD 61.5%
  2026: T=1030 WR= 46% PF= 2.13 sumR=+688.9 exp=+0.67R pnl=$411339537
  blocks: exposure=1627 ddRolling7d=612 cooldown=459 maxOpen=380 ddDaily=312 killSwitch=261 groupCap=218 sizeTilt=153 weeklyTrend=83

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1513 WR= 43% PF= 1.88 sumR=+832.6 exp=+0.55R pnl=$149055718  → balance $149056218 maxDD 71.9%
  2026: T= 992 WR= 44% PF= 1.91 sumR=+558.7 exp=+0.56R pnl=$149031841
  blocks: exposure=1612 ddRolling7d=555 cooldown=474 maxOpen=425 killSwitch=422 ddDaily=272 groupCap=239 weeklyTrend=82

## SAMEDIR max 4
  ALL:  T=1253 WR= 43% PF= 1.88 sumR=+690.1 exp=+0.55R pnl=$35863542  → balance $35864042 maxDD 39.0%
  2026: T= 843 WR= 44% PF= 1.91 sumR=+478.8 exp=+0.57R pnl=$35850159
  blocks: sameDir=1670 exposure=1354 cooldown=423 killSwitch=223 groupCap=215 ddDaily=199 ddRolling7d=163 weeklyTrend=94

## SAMEDIR max 5
  ALL:  T=1352 WR= 43% PF= 1.90 sumR=+758.4 exp=+0.56R pnl=$65132220  → balance $65132720 maxDD 56.1%
  2026: T= 892 WR= 44% PF= 1.94 sumR=+521.9 exp=+0.59R pnl=$65113868
  blocks: exposure=1434 sameDir=1174 cooldown=466 ddRolling7d=405 groupCap=231 ddDaily=219 killSwitch=197 weeklyTrend=86 maxOpen=30

## SAMEDIR max 6
  ALL:  T=1531 WR= 44% PF= 1.92 sumR=+873.5 exp=+0.57R pnl=$581830281  → balance $581830781 maxDD 34.0%
  2026: T=1044 WR= 45% PF= 2.00 sumR=+637.5 exp=+0.61R pnl=$581814304
  blocks: exposure=1638 sameDir=895 cooldown=491 ddDaily=261 groupCap=247 killSwitch=195 ddRolling7d=133 maxOpen=115 weeklyTrend=88

## SAMEDIR max 7
  ALL:  T=1552 WR= 43% PF= 1.90 sumR=+866.3 exp=+0.56R pnl=$284325112  → balance $284325612 maxDD 41.5%
  2026: T=1041 WR= 44% PF= 1.96 sumR=+612.7 exp=+0.59R pnl=$284305835
  blocks: exposure=1686 sameDir=610 cooldown=493 ddRolling7d=323 ddDaily=279 groupCap=245 killSwitch=193 maxOpen=124 weeklyTrend=89

## VENUE Kraken (−LUNC)
  ALL:  T=1614 WR= 44% PF= 1.95 sumR=+939.0 exp=+0.58R pnl=$527197991  → balance $527198491 maxDD 56.0%
  2026: T=1091 WR= 45% PF= 2.03 sumR=+678.9 exp=+0.62R pnl=$527181608
  blocks: exposure=1723 cooldown=501 maxOpen=447 ddRolling7d=407 ddDaily=312 killSwitch=265 groupCap=242 weeklyTrend=83

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T=1577 WR= 44% PF= 1.92 sumR=+899.1 exp=+0.57R pnl=$506528949  → balance $506529449 maxDD 36.5%
  2026: T=1096 WR= 45% PF= 1.97 sumR=+654.3 exp=+0.60R pnl=$506513312
  blocks: exposure=1685 cooldown=499 ddRolling7d=373 maxOpen=324 groupCap=260 ddDaily=244 killSwitch=196 weeklyTrend=88

## TRIAGE minus rsi-divergence
  ALL:  T=1623 WR= 44% PF= 1.97 sumR=+960.4 exp=+0.59R pnl=$995143939  → balance $995144439 maxDD 42.7%
  2026: T=1128 WR= 46% PF= 2.07 sumR=+725.3 exp=+0.64R pnl=$995132726
  blocks: exposure=1553 cooldown=411 ddRolling7d=389 maxOpen=379 killSwitch=289 ddDaily=286 groupCap=217 weeklyTrend=83

## BASELINE (all gates)
  ALL:  T= 400 WR= 42% PF= 1.74 sumR=+187.4 exp=+0.47R pnl=$94981  → balance $95481 maxDD 44.1%
  2026: T= 230 WR= 42% PF= 1.66 sumR=+97.1 exp=+0.42R pnl=$90990
  blocks: maxOpen=1187 atrPct=923 shortConf=651 ddRolling7d=538 exposure=480 ddMonthly=365 dirOverlay=349 dailyTrend=214 cooldown=182 ddDaily=117 killSwitch=111 weeklyTrend=74 groupCap=3

## minus dirOverlay
  ALL:  T= 434 WR= 41% PF= 1.71 sumR=+199.2 exp=+0.46R pnl=$106793  → balance $107293 maxDD 55.6%
  2026: T= 251 WR= 41% PF= 1.68 sumR=+110.4 exp=+0.44R pnl=$102568
  blocks: maxOpen=1257 atrPct=787 ddRolling7d=739 shortConf=621 exposure=532 dailyTrend=295 ddMonthly=250 ddDaily=209 cooldown=206 killSwitch=187 weeklyTrend=76 groupCap=1

## minus dailyTrend
  ALL:  T= 399 WR= 39% PF= 1.60 sumR=+160.3 exp=+0.40R pnl=$23773  → balance $24273 maxDD 44.1%
  2026: T= 222 WR= 39% PF= 1.54 sumR=+81.2 exp=+0.37R pnl=$21413
  blocks: maxOpen=1192 atrPct=844 ddRolling7d=819 shortConf=773 exposure=493 dirOverlay=348 ddMonthly=208 cooldown=174 killSwitch=140 ddDaily=130 weeklyTrend=73 groupCap=1

## minus weeklyTrend
  ALL:  T= 433 WR= 43% PF= 1.82 sumR=+219.9 exp=+0.51R pnl=$266150  → balance $266650 maxDD 44.1%
  2026: T= 234 WR= 42% PF= 1.66 sumR=+98.6 exp=+0.42R pnl=$254444
  blocks: maxOpen=1216 atrPct=930 shortConf=662 ddRolling7d=551 exposure=531 dirOverlay=357 ddMonthly=308 dailyTrend=218 cooldown=182 ddDaily=106 killSwitch=97 groupCap=3

## minus shortConf
  ALL:  T= 372 WR= 40% PF= 1.67 sumR=+162.9 exp=+0.44R pnl=$18938  → balance $19438 maxDD 47.3%
  2026: T= 206 WR= 39% PF= 1.53 sumR=+74.0 exp=+0.36R pnl=$15445
  blocks: ddMonthly=1915 maxOpen=1220 ddRolling7d=785 exposure=417 atrPct=395 ddDaily=111 cooldown=105 dirOverlay=100 dailyTrend=87 weeklyTrend=71 killSwitch=16

## minus atrPct
  ALL:  T= 520 WR= 44% PF= 1.92 sumR=+292.1 exp=+0.56R pnl=$1301152  → balance $1301652 maxDD 35.2%
  2026: T= 306 WR= 43% PF= 1.80 sumR=+152.5 exp=+0.50R pnl=$1287332
  blocks: maxOpen=1725 shortConf=806 exposure=655 dirOverlay=428 ddRolling7d=393 dailyTrend=300 cooldown=206 ddMonthly=206 ddDaily=153 killSwitch=118 weeklyTrend=81 groupCap=3

## minus btcCap
  ALL:  T= 428 WR= 40% PF= 1.66 sumR=+184.2 exp=+0.43R pnl=$36410  → balance $36910 maxDD 39.5%
  2026: T= 241 WR= 40% PF= 1.56 sumR=+90.3 exp=+0.37R pnl=$32753
  blocks: ddMonthly=1288 atrPct=864 shortConf=814 exposure=557 ddRolling7d=438 dirOverlay=313 dailyTrend=216 cooldown=185 ddDaily=178 killSwitch=164 groupCap=79 weeklyTrend=70

## minus groupCap
  ALL:  T= 400 WR= 42% PF= 1.74 sumR=+187.4 exp=+0.47R pnl=$94981  → balance $95481 maxDD 44.1%
  2026: T= 230 WR= 42% PF= 1.66 sumR=+97.1 exp=+0.42R pnl=$90990
  blocks: maxOpen=1187 atrPct=923 shortConf=651 ddRolling7d=538 exposure=480 ddMonthly=365 dirOverlay=350 dailyTrend=216 cooldown=182 ddDaily=117 killSwitch=111 weeklyTrend=74

## minus killSwitch
  ALL:  T= 429 WR= 42% PF= 1.79 sumR=+212.5 exp=+0.50R pnl=$202588  → balance $203088 maxDD 45.9%
  2026: T= 257 WR= 43% PF= 1.74 sumR=+120.4 exp=+0.47R pnl=$198389
  blocks: maxOpen=1244 atrPct=996 shortConf=694 ddRolling7d=634 exposure=508 dirOverlay=364 dailyTrend=235 cooldown=183 ddDaily=136 ddMonthly=94 weeklyTrend=74 groupCap=3

## minus ddDaily
  ALL:  T= 400 WR= 40% PF= 1.65 sumR=+170.7 exp=+0.43R pnl=$38646  → balance $39146 maxDD 41.1%
  2026: T= 225 WR= 39% PF= 1.51 sumR=+78.0 exp=+0.35R pnl=$34432
  blocks: maxOpen=1187 atrPct=889 ddRolling7d=719 shortConf=659 exposure=474 dirOverlay=375 ddMonthly=302 dailyTrend=203 cooldown=178 killSwitch=136 weeklyTrend=69 groupCap=3

## minus ddMonthly
  ALL:  T= 425 WR= 42% PF= 1.76 sumR=+205.0 exp=+0.48R pnl=$143289  → balance $143789 maxDD 44.1%
  2026: T= 255 WR= 42% PF= 1.70 sumR=+114.7 exp=+0.45R pnl=$139298
  blocks: maxOpen=1226 atrPct=932 shortConf=688 ddRolling7d=665 exposure=508 dirOverlay=353 dailyTrend=225 cooldown=196 killSwitch=163 ddDaily=136 weeklyTrend=74 groupCap=3

## minus ddRolling
  ALL:  T= 385 WR= 41% PF= 1.73 sumR=+179.4 exp=+0.47R pnl=$74127  → balance $74627 maxDD 43.9%
  2026: T= 209 WR= 41% PF= 1.63 sumR=+85.1 exp=+0.41R pnl=$69582
  blocks: maxOpen=1065 atrPct=865 ddMonthly=791 shortConf=634 exposure=457 killSwitch=445 dirOverlay=344 dailyTrend=209 cooldown=176 ddDaily=144 weeklyTrend=76 groupCap=3

## minus kelly
  ALL:  T= 434 WR= 41% PF= 1.75 sumR=+206.7 exp=+0.48R pnl=$14479  → balance $14979 maxDD 28.2%
  2026: T= 255 WR= 42% PF= 1.67 sumR=+110.5 exp=+0.43R pnl=$12626
  blocks: maxOpen=1251 atrPct=1008 shortConf=678 exposure=513 killSwitch=488 dirOverlay=379 dailyTrend=234 cooldown=197 ddMonthly=178 ddRolling7d=142 weeklyTrend=76 ddDaily=13 groupCap=3

## minus riskMult
  ALL:  T= 388 WR= 41% PF= 1.70 sumR=+174.8 exp=+0.45R pnl=$65292  → balance $65792 maxDD 42.2%
  2026: T= 228 WR= 41% PF= 1.61 sumR=+91.1 exp=+0.40R pnl=$61315
  blocks: maxOpen=1042 atrPct=819 shortConf=595 ddRolling7d=579 exposure=493 ddMonthly=373 dirOverlay=353 ddDaily=320 dailyTrend=219 killSwitch=172 cooldown=162 weeklyTrend=76 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=2081 WR= 44% PF= 1.93 sumR=+1197.8 exp=+0.58R pnl=$62836186682  → balance $62836187182 maxDD 49.7%
  2026: T=1392 WR= 44% PF= 1.91 sumR=+790.8 exp=+0.57R pnl=$62835974040
  blocks: exposure=2180 maxOpen=744 cooldown=589

## LS-only BASELINE
  ALL:  T= 342 WR= 43% PF= 1.83 sumR=+180.8 exp=+0.53R pnl=$78479  → balance $78979 maxDD 36.9%
  2026: T= 241 WR= 44% PF= 1.89 sumR=+134.0 exp=+0.56R pnl=$77582
  blocks: maxOpen=950 atrPct=895 shortConf=722 ddRolling7d=626 dirOverlay=324 exposure=295 ddMonthly=208 dailyTrend=199 ddDaily=127 cooldown=105 killSwitch=69 groupCap=2

## LS-only LEAN
  ALL:  T=1963 WR= 44% PF= 1.95 sumR=+1149.5 exp=+0.59R pnl=$27219795694  → balance $27219796194 maxDD 44.5%
  2026: T=1383 WR= 44% PF= 1.97 sumR=+824.4 exp=+0.60R pnl=$27219741928
  blocks: exposure=1751 maxOpen=644 cooldown=506

## LS+RSI LEAN
  ALL:  T=1983 WR= 44% PF= 1.94 sumR=+1155.0 exp=+0.58R pnl=$30641222392  → balance $30641222892 maxDD 48.6%
  2026: T=1396 WR= 44% PF= 1.95 sumR=+818.1 exp=+0.59R pnl=$30641154673
  blocks: exposure=1950 maxOpen=703 cooldown=592

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1536 WR= 43% PF= 1.88 sumR=+840.8 exp=+0.55R pnl=$316776008611  → balance $316776009111 maxDD 74.9%
  2026: T=1024 WR= 44% PF= 1.92 sumR=+582.6 exp=+0.57R pnl=$316775931680
  blocks: exposure=1616 killSwitch=847 ddDaily=586 cooldown=482 maxOpen=442 weeklyTrend=85

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1467 WR= 43% PF= 1.90 sumR=+819.2 exp=+0.56R pnl=$151582730487  → balance $151582730987 maxDD 70.3%
  2026: T=1028 WR= 44% PF= 1.95 sumR=+600.1 exp=+0.58R pnl=$151582700689
  blocks: exposure=1430 killSwitch=803 ddDaily=661 cooldown=487 maxOpen=380

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1465 WR= 43% PF= 1.87 sumR=+794.0 exp=+0.54R pnl=$122748137823  → balance $122748138323 maxDD 66.9%
  2026: T= 961 WR= 43% PF= 1.85 sumR=+514.5 exp=+0.54R pnl=$122747963755
  blocks: exposure=1537 killSwitch=843 ddDaily=665 cooldown=467 maxOpen=352 groupCap=180 weeklyTrend=85

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1476 WR= 43% PF= 1.90 sumR=+824.7 exp=+0.56R pnl=$214509749958  → balance $214509750458 maxDD 74.0%
  2026: T= 976 WR= 44% PF= 1.93 sumR=+557.0 exp=+0.57R pnl=$214509617001
  blocks: exposure=1543 ddRolling7d=989 ddDaily=535 cooldown=445 maxOpen=426 killSwitch=96 weeklyTrend=84

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1438 WR= 44% PF= 1.93 sumR=+823.0 exp=+0.57R pnl=$320627229420  → balance $320627229920 maxDD 74.9%
  2026: T= 955 WR= 44% PF= 1.95 sumR=+558.4 exp=+0.58R pnl=$320627114182
  blocks: exposure=1488 ddRolling7d=987 ddDaily=518 cooldown=435 maxOpen=371 groupCap=175 killSwitch=97 weeklyTrend=85

## PROPOSED-F (= E without kelly)
  ALL:  T=1615 WR= 43% PF= 1.90 sumR=+908.0 exp=+0.56R pnl=$368021857  → balance $368022357 maxDD 40.5%
  2026: T=1083 WR= 44% PF= 1.94 sumR=+629.8 exp=+0.58R pnl=$368000724
  blocks: exposure=1700 ddRolling7d=555 cooldown=464 maxOpen=389 ddDaily=362 groupCap=213 killSwitch=210 weeklyTrend=86

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T= 111 WR= 36% PF= 1.21 sumR=+17.0 exp=+0.15R pnl=$-1634275
  LONG  · BTC daily neutral T=  82 WR= 29% PF= 1.05 sumR=+2.9 exp=+0.04R pnl=$20547419
  LONG  · BTC daily down    T= 176 WR= 42% PF= 1.88 sumR=+98.0 exp=+0.56R pnl=$13221115
  SHORT · BTC daily up      T= 296 WR= 54% PF= 3.00 sumR=+299.8 exp=+1.01R pnl=$351812090
  SHORT · BTC daily neutral T= 183 WR= 44% PF= 1.81 sumR=+92.0 exp=+0.50R pnl=$118376189
  SHORT · BTC daily down    T= 766 WR= 44% PF= 1.91 sumR=+429.3 exp=+0.56R pnl=$24875452
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  68 WR= 37% PF= 1.38 sumR=+17.6 exp=+0.26R pnl=$-18596
  LONG  · BTC weekly neutral T=  55 WR= 53% PF= 2.62 sumR=+46.2 exp=+0.84R pnl=$1317203
  LONG  · BTC weekly down    T= 246 WR= 34% PF= 1.30 sumR=+54.0 exp=+0.22R pnl=$30835652
  SHORT · BTC weekly up      T= 215 WR= 43% PF= 1.88 sumR=+116.7 exp=+0.54R pnl=$561827
  SHORT · BTC weekly neutral T= 160 WR= 48% PF= 2.31 sumR=+119.6 exp=+0.75R pnl=$9295159
  SHORT · BTC weekly down    T= 870 WR= 47% PF= 2.14 sumR=+584.8 exp=+0.67R pnl=$485206746

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  93 WR= 41% PF= 1.74 sumR=+42.1 exp=+0.45R pnl=$18737231
                     2026: T=  19 WR= 42% PF= 1.70 sumR=+8.1 exp=+0.42R pnl=$18736884
  rsi-divergence     ALL:  T=  45 WR= 42% PF= 1.60 sumR=+16.8 exp=+0.37R pnl=$21858846
                     2026: T=  28 WR= 43% PF= 1.35 sumR=+6.0 exp=+0.21R pnl=$21857841
  liquidity-sweep    ALL:  T=1476 WR= 45% PF= 1.97 sumR=+880.2 exp=+0.60R pnl=$486601914
                     2026: T=1044 WR= 45% PF= 2.05 sumR=+664.9 exp=+0.64R pnl=$486586883

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  75 WR= 45% PF= 2.04 sumR=+44.3 exp=+0.59R pnl=$11297
                     2026: T=  13 WR= 46% PF= 1.70 sumR=+5.2 exp=+0.40R pnl=$10326
  rsi-divergence     ALL:  T=  28 WR= 36% PF= 1.42 sumR=+8.0 exp=+0.29R pnl=$-8809
                     2026: T=  16 WR= 44% PF= 1.48 sumR=+4.8 exp=+0.30R pnl=$-8767
  liquidity-sweep    ALL:  T= 297 WR= 41% PF= 1.70 sumR=+135.1 exp=+0.45R pnl=$92493
                     2026: T= 201 WR= 41% PF= 1.67 sumR=+87.1 exp=+0.43R pnl=$89431

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 130 WR= 44% PF= 2.05 sumR=+77.7 exp=+0.60R pnl=$1958487658
                     2026: T=  22 WR= 36% PF= 1.34 sumR=+5.0 exp=+0.23R pnl=$1958484406
  rsi-divergence     ALL:  T=  54 WR= 43% PF= 1.67 sumR=+22.6 exp=+0.42R pnl=$1966722414
                     2026: T=  35 WR= 43% PF= 1.44 sumR=+9.6 exp=+0.27R pnl=$1966712543
  liquidity-sweep    ALL:  T=1897 WR= 44% PF= 1.93 sumR=+1097.6 exp=+0.58R pnl=$58910976611
                     2026: T=1335 WR= 44% PF= 1.94 sumR=+776.3 exp=+0.58R pnl=$58910777091

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  95 WR= 42% PF= 1.80 sumR=+45.5 exp=+0.48R pnl=$25909406468
                     2026: T=  21 WR= 43% PF= 1.60 sumR=+7.5 exp=+0.36R pnl=$25909402772
  rsi-divergence     ALL:  T=  55 WR= 42% PF= 1.62 sumR=+21.1 exp=+0.38R pnl=$16970237521
                     2026: T=  33 WR= 45% PF= 1.58 sumR=+11.2 exp=+0.34R pnl=$16970235680
  liquidity-sweep    ALL:  T=1386 WR= 43% PF= 1.90 sumR=+774.2 exp=+0.56R pnl=$273896364623
                     2026: T= 970 WR= 44% PF= 1.94 sumR=+563.8 exp=+0.58R pnl=$273896293227

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  55 WR= 42% PF= 1.63 sumR=+21.2 exp=+0.39R pnl=$9416568557
                     2026: T=  33 WR= 45% PF= 1.58 sumR=+11.3 exp=+0.34R pnl=$9416567512
  liquidity-sweep    ALL:  T=1412 WR= 43% PF= 1.91 sumR=+798.0 exp=+0.57R pnl=$142166161930
                     2026: T= 995 WR= 44% PF= 1.96 sumR=+588.7 exp=+0.59R pnl=$142166133177

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  94 WR= 41% PF= 1.79 sumR=+44.9 exp=+0.48R pnl=$8987982518
                     2026: T=  20 WR= 40% PF= 1.55 sumR=+6.9 exp=+0.34R pnl=$8987975970
  rsi-divergence     ALL:  T=  52 WR= 42% PF= 1.69 sumR=+21.8 exp=+0.42R pnl=$7022280250
                     2026: T=  30 WR= 43% PF= 1.49 sumR=+9.0 exp=+0.30R pnl=$7022275981
  liquidity-sweep    ALL:  T=1319 WR= 43% PF= 1.88 sumR=+727.4 exp=+0.55R pnl=$106737875054
                     2026: T= 911 WR= 43% PF= 1.87 sumR=+498.6 exp=+0.55R pnl=$106737711803

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  93 WR= 42% PF= 1.78 sumR=+43.7 exp=+0.47R pnl=$17037792100
                     2026: T=  20 WR= 40% PF= 1.37 sumR=+4.6 exp=+0.23R pnl=$17037782497
  rsi-divergence     ALL:  T=  43 WR= 47% PF= 1.93 sumR=+22.2 exp=+0.52R pnl=$12562393427
                     2026: T=  27 WR= 52% PF= 2.05 sumR=+14.6 exp=+0.54R pnl=$12562398529
  liquidity-sweep    ALL:  T=1340 WR= 43% PF= 1.91 sumR=+758.8 exp=+0.57R pnl=$184909564431
                     2026: T= 929 WR= 44% PF= 1.93 sumR=+537.8 exp=+0.58R pnl=$184909435974

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  88 WR= 42% PF= 1.85 sumR=+45.0 exp=+0.51R pnl=$23067211875
                     2026: T=  15 WR= 40% PF= 1.63 sumR=+5.9 exp=+0.39R pnl=$23067203980
  rsi-divergence     ALL:  T=  40 WR= 48% PF= 2.15 sumR=+25.1 exp=+0.63R pnl=$20273423159
                     2026: T=  23 WR= 52% PF= 2.27 sumR=+15.1 exp=+0.66R pnl=$20273428448
  liquidity-sweep    ALL:  T=1310 WR= 44% PF= 1.93 sumR=+752.9 exp=+0.57R pnl=$277286594386
                     2026: T= 917 WR= 44% PF= 1.95 sumR=+537.5 exp=+0.59R pnl=$277286481754

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  94 WR= 41% PF= 1.80 sumR=+45.7 exp=+0.49R pnl=$17645434
                     2026: T=  19 WR= 42% PF= 1.76 sumR=+8.7 exp=+0.46R pnl=$17645057
  rsi-divergence     ALL:  T=  47 WR= 45% PF= 1.87 sumR=+23.8 exp=+0.51R pnl=$20148023
                     2026: T=  28 WR= 50% PF= 1.93 sumR=+14.1 exp=+0.50R pnl=$20147338
  liquidity-sweep    ALL:  T=1474 WR= 43% PF= 1.91 sumR=+838.5 exp=+0.57R pnl=$330228400
                     2026: T=1036 WR= 44% PF= 1.94 sumR=+607.0 exp=+0.59R pnl=$330208329

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2023-01  $-10.39
  2023-02  $-20.55
  2023-03  +$27.83
  2023-04  $-31.21
  2023-05  +$2.70
  2023-06  +$17.08
  2023-07  $-22.50
  2023-08  +$124.68
  2023-09  +$25.78
  2023-10  $-12.89
  2023-11  +$59.99
  2023-12  +$51.29
  2024-01  $-14.94
  2024-02  +$26.02
  2024-03  +$86.18
  2024-04  $-33.52
  2024-05  $-31.86
  2024-06  +$87.54
  2024-07  $-53.46
  2024-08  $-15.93
  2024-10  $-31.98
  2024-11  $-5.33
  2024-12  $-15.17
  2025-01  $-14.59
  2025-03  +$25.99
  2025-04  +$82.57
  2025-06  $-41.15
  2025-07  +$56.45
  2025-08  $-12.85
  2025-09  +$343.23
  2025-10  +$1638.54
  2025-11  +$13362.81
  2025-12  +$515.33
  2026-01  +$151577.71
  2026-02  +$333245.81
  2026-03  +$1492035.91
  2026-04  $-563809.23
  2026-05  +$5557933.73
  2026-06  +$28448204.84
  2026-07  +$179247501.62
  2026-08  +$312515134.59