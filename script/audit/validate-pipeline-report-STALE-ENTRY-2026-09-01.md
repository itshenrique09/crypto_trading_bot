# Full-Pipeline Portfolio Validation — 2026-09-01
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 5544

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1394 WR= 44% PF= 1.84 sumR=+749.8 exp=+0.54R pnl=$27994848  → balance $27995348 maxDD 66.6%
  2026: T=1041 WR= 45% PF= 1.86 sumR=+571.1 exp=+0.55R pnl=$27990020
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## CAP maxOpen=8
  ALL:  T=1327 WR= 45% PF= 1.89 sumR=+746.0 exp=+0.56R pnl=$29974827  → balance $29975327 maxDD 42.7%
  2026: T= 983 WR= 45% PF= 1.89 sumR=+552.2 exp=+0.56R pnl=$29968254
  blocks: exposure=1473 ddRolling7d=825 maxOpen=770 cooldown=354 killSwitch=345 ddDaily=249 groupCap=115 weeklyTrend=86

## CAP maxOpen=10
  ALL:  T=1437 WR= 44% PF= 1.83 sumR=+760.2 exp=+0.53R pnl=$31059245  → balance $31059745 maxDD 63.0%
  2026: T=1067 WR= 44% PF= 1.81 sumR=+556.9 exp=+0.52R pnl=$31052464
  blocks: exposure=1557 ddRolling7d=901 maxOpen=402 cooldown=397 killSwitch=281 ddDaily=276 groupCap=205 weeklyTrend=88

## CAP perSymbol=2
  ALL:  T=1440 WR= 44% PF= 1.82 sumR=+759.3 exp=+0.53R pnl=$29430109  → balance $29430609 maxDD 63.0%
  2026: T=1070 WR= 44% PF= 1.81 sumR=+556.0 exp=+0.52R pnl=$29423328
  blocks: exposure=1464 ddRolling7d=925 maxOpen=428 cooldown=411 ddDaily=288 killSwitch=278 groupCap=222 weeklyTrend=88

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1252 WR= 44% PF= 1.85 sumR=+674.7 exp=+0.54R pnl=$6887614  → balance $6888114 maxDD 63.8%
  2026: T= 908 WR= 44% PF= 1.82 sumR=+480.8 exp=+0.53R pnl=$6881036
  blocks: exposure=1321 ddRolling7d=965 maxOpen=759 killSwitch=439 cooldown=351 ddDaily=255 groupCap=114 weeklyTrend=88

## CAP LS cooldown 8h
  ALL:  T=1465 WR= 44% PF= 1.84 sumR=+784.8 exp=+0.54R pnl=$42642416  → balance $42642916 maxDD 63.0%
  2026: T=1083 WR= 44% PF= 1.82 sumR=+573.5 exp=+0.53R pnl=$42634849
  blocks: exposure=1579 ddRolling7d=927 maxOpen=379 cooldown=336 ddDaily=300 killSwitch=262 groupCap=208 weeklyTrend=88

## CAP LS cooldown 6h
  ALL:  T=1462 WR= 43% PF= 1.81 sumR=+761.2 exp=+0.52R pnl=$26512249  → balance $26512749 maxDD 63.0%
  2026: T=1081 WR= 43% PF= 1.78 sumR=+549.6 exp=+0.51R pnl=$26504621
  blocks: exposure=1584 ddRolling7d=941 maxOpen=376 ddDaily=320 cooldown=289 killSwitch=275 groupCap=209 weeklyTrend=88

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1246 WR= 43% PF= 1.79 sumR=+637.0 exp=+0.51R pnl=$3765240  → balance $3765740 maxDD 63.8%
  2026: T= 890 WR= 43% PF= 1.76 sumR=+443.8 exp=+0.50R pnl=$3758385
  blocks: exposure=1337 ddRolling7d=951 maxOpen=799 killSwitch=462 cooldown=279 ddDaily=271 groupCap=111 weeklyTrend=88

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1440 WR= 44% PF= 1.82 sumR=+759.3 exp=+0.53R pnl=$29430109  → balance $29430609 maxDD 63.0%
  2026: T=1070 WR= 44% PF= 1.81 sumR=+556.0 exp=+0.52R pnl=$29423328
  blocks: exposure=1464 ddRolling7d=925 maxOpen=428 cooldown=411 ddDaily=288 killSwitch=278 groupCap=222 weeklyTrend=88

## CAP maxOpen=12
  ALL:  T=1427 WR= 43% PF= 1.79 sumR=+726.2 exp=+0.51R pnl=$11346074  → balance $11346574 maxDD 70.1%
  2026: T=1033 WR= 43% PF= 1.74 sumR=+499.9 exp=+0.48R pnl=$11337412
  blocks: exposure=1539 ddRolling7d=1076 cooldown=409 ddDaily=299 killSwitch=285 groupCap=268 maxOpen=155 weeklyTrend=86

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1350 WR= 43% PF= 1.80 sumR=+691.8 exp=+0.51R pnl=$9574948  → balance $9575448 maxDD 50.1%
  2026: T= 999 WR= 43% PF= 1.78 sumR=+504.3 exp=+0.50R pnl=$9568830
  blocks: exposure=1484 ddRolling7d=743 groupCap=632 cooldown=404 killSwitch=339 ddDaily=301 maxOpen=206 weeklyTrend=85

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1427 WR= 43% PF= 1.79 sumR=+726.2 exp=+0.51R pnl=$11346074  → balance $11346574 maxDD 70.1%
  2026: T=1033 WR= 43% PF= 1.74 sumR=+499.9 exp=+0.48R pnl=$11337412
  blocks: exposure=1539 ddRolling7d=1076 cooldown=409 ddDaily=299 killSwitch=285 groupCap=268 maxOpen=155 weeklyTrend=86

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1563 WR= 43% PF= 1.81 sumR=+819.9 exp=+0.52R pnl=$114946910  → balance $114947410 maxDD 45.5%
  2026: T=1176 WR= 43% PF= 1.80 sumR=+609.9 exp=+0.52R pnl=$114939382
  blocks: exposure=1613 ddRolling7d=746 cooldown=444 maxOpen=348 ddDaily=283 killSwitch=235 groupCap=223 weeklyTrend=89

## EXIT tp1Close=50%
  ALL:  T=1423 WR= 43% PF= 1.75 sumR=+700.4 exp=+0.49R pnl=$10951668  → balance $10952168 maxDD 53.9%
  2026: T=1058 WR= 43% PF= 1.74 sumR=+512.2 exp=+0.48R pnl=$10946432
  blocks: exposure=1566 ddRolling7d=935 cooldown=392 maxOpen=342 killSwitch=321 ddDaily=276 groupCap=200 weeklyTrend=89

## EXIT tp1Close=75%
  ALL:  T=1451 WR= 43% PF= 1.81 sumR=+760.2 exp=+0.52R pnl=$36083677  → balance $36084177 maxDD 52.6%
  2026: T=1086 WR= 44% PF= 1.82 sumR=+571.8 exp=+0.53R pnl=$36078155
  blocks: exposure=1546 ddRolling7d=921 cooldown=406 ddDaily=324 maxOpen=323 killSwitch=291 groupCap=196 weeklyTrend=86

## EXIT trail 1.5%
  ALL:  T=1379 WR= 42% PF= 1.72 sumR=+657.6 exp=+0.48R pnl=$4419189  → balance $4419689 maxDD 63.6%
  2026: T=1015 WR= 42% PF= 1.68 sumR=+464.2 exp=+0.46R pnl=$4413264
  blocks: exposure=1500 ddRolling7d=999 cooldown=389 killSwitch=348 maxOpen=327 ddDaily=319 groupCap=194 weeklyTrend=89

## EXIT trail 3%
  ALL:  T=1512 WR= 44% PF= 1.86 sumR=+826.8 exp=+0.55R pnl=$114344152  → balance $114344652 maxDD 50.1%
  2026: T=1124 WR= 45% PF= 1.88 sumR=+625.9 exp=+0.56R pnl=$114337507
  blocks: exposure=1694 ddRolling7d=655 cooldown=436 maxOpen=420 ddDaily=296 killSwitch=226 groupCap=218 weeklyTrend=87

## EXIT trail r_multiple 2R
  ALL:  T=1394 WR= 44% PF= 1.84 sumR=+749.8 exp=+0.54R pnl=$27994848  → balance $27995348 maxDD 66.6%
  2026: T=1041 WR= 45% PF= 1.86 sumR=+571.1 exp=+0.55R pnl=$27990020
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## TILT LONG:up 0.75x
  ALL:  T=1415 WR= 44% PF= 1.86 sumR=+774.0 exp=+0.55R pnl=$45908349  → balance $45908849 maxDD 59.3%
  2026: T=1062 WR= 45% PF= 1.89 sumR=+595.3 exp=+0.56R pnl=$45903678
  blocks: exposure=1587 ddRolling7d=868 cooldown=409 maxOpen=384 killSwitch=381 ddDaily=208 groupCap=203 weeklyTrend=89

## TILT LONG:up 0.5x
  ALL:  T=1399 WR= 44% PF= 1.83 sumR=+742.8 exp=+0.53R pnl=$32712386  → balance $32712886 maxDD 67.0%
  2026: T=1046 WR= 44% PF= 1.84 sumR=+564.2 exp=+0.54R pnl=$32707869
  blocks: exposure=1597 ddRolling7d=870 cooldown=405 killSwitch=394 maxOpen=368 ddDaily=228 groupCap=199 weeklyTrend=84

## TILT LONG:up blocked
  ALL:  T=1358 WR= 45% PF= 1.90 sumR=+767.3 exp=+0.57R pnl=$33890268  → balance $33890768 maxDD 54.0%
  2026: T=1008 WR= 46% PF= 1.94 sumR=+593.3 exp=+0.59R pnl=$33886069
  blocks: exposure=1546 ddRolling7d=972 cooldown=385 killSwitch=360 maxOpen=326 ddDaily=200 groupCap=175 sizeTilt=138 weeklyTrend=84

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1342 WR= 44% PF= 1.82 sumR=+705.6 exp=+0.53R pnl=$28402381  → balance $28402881 maxDD 68.9%
  2026: T= 989 WR= 44% PF= 1.84 sumR=+527.0 exp=+0.53R pnl=$28397474
  blocks: exposure=1531 ddRolling7d=978 killSwitch=432 cooldown=393 maxOpen=373 ddDaily=217 groupCap=189 weeklyTrend=89

## SAMEDIR max 4
  ALL:  T=1168 WR= 43% PF= 1.74 sumR=+564.7 exp=+0.48R pnl=$3784647  → balance $3785147 maxDD 35.7%
  2026: T= 825 WR= 43% PF= 1.74 sumR=+400.6 exp=+0.49R pnl=$3779449
  blocks: sameDir=1519 exposure=1321 killSwitch=391 cooldown=361 ddRolling7d=281 groupCap=222 ddDaily=183 weeklyTrend=98

## SAMEDIR max 5
  ALL:  T=1332 WR= 43% PF= 1.75 sumR=+655.7 exp=+0.49R pnl=$10609683  → balance $10610183 maxDD 46.7%
  2026: T= 953 WR= 43% PF= 1.76 sumR=+471.9 exp=+0.50R pnl=$10603185
  blocks: exposure=1444 sameDir=1125 ddRolling7d=432 cooldown=395 ddDaily=249 groupCap=243 killSwitch=206 weeklyTrend=88 maxOpen=30

## SAMEDIR max 6
  ALL:  T=1493 WR= 43% PF= 1.81 sumR=+777.7 exp=+0.52R pnl=$93988027  → balance $93988527 maxDD 36.2%
  2026: T=1098 WR= 44% PF= 1.85 sumR=+590.9 exp=+0.54R pnl=$93981911
  blocks: exposure=1629 sameDir=853 cooldown=463 ddDaily=275 killSwitch=245 groupCap=237 ddRolling7d=172 weeklyTrend=89 maxOpen=88

## SAMEDIR max 7
  ALL:  T=1363 WR= 43% PF= 1.76 sumR=+674.8 exp=+0.50R pnl=$8037539  → balance $8038039 maxDD 68.1%
  2026: T= 986 WR= 43% PF= 1.77 sumR=+493.6 exp=+0.50R pnl=$8031786
  blocks: exposure=1514 ddRolling7d=765 sameDir=533 cooldown=430 killSwitch=281 ddDaily=255 groupCap=228 maxOpen=90 weeklyTrend=85

## VENUE Kraken (−LUNC)
  ALL:  T=1394 WR= 44% PF= 1.84 sumR=+749.8 exp=+0.54R pnl=$27994848  → balance $27995348 maxDD 66.6%
  2026: T=1041 WR= 45% PF= 1.86 sumR=+571.1 exp=+0.55R pnl=$27990020
  blocks: exposure=1579 ddRolling7d=891 cooldown=409 killSwitch=368 maxOpen=368 ddDaily=256 groupCap=195 weeklyTrend=84

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T=1410 WR= 43% PF= 1.81 sumR=+732.3 exp=+0.52R pnl=$31789520  → balance $31790020 maxDD 42.8%
  2026: T=1049 WR= 44% PF= 1.80 sumR=+543.3 exp=+0.52R pnl=$31783771
  blocks: exposure=1548 ddRolling7d=556 cooldown=413 killSwitch=384 ddDaily=285 maxOpen=281 groupCap=215 weeklyTrend=89

## TRIAGE minus rsi-divergence
  ALL:  T=1533 WR= 45% PF= 1.90 sumR=+864.1 exp=+0.56R pnl=$280605832  → balance $280606332 maxDD 43.1%
  2026: T=1169 WR= 45% PF= 1.92 sumR=+675.0 exp=+0.58R pnl=$280600157
  blocks: exposure=1540 ddRolling7d=486 maxOpen=429 cooldown=388 killSwitch=271 ddDaily=269 groupCap=225 weeklyTrend=84

## BASELINE (all gates)
  ALL:  T= 378 WR= 39% PF= 1.50 sumR=+131.2 exp=+0.35R pnl=$12094  → balance $12594 maxDD 45.6%
  2026: T= 231 WR= 37% PF= 1.33 sumR=+55.6 exp=+0.24R pnl=$9683
  blocks: maxOpen=1190 atrPct=759 ddRolling7d=715 shortConf=631 exposure=460 ddMonthly=379 dirOverlay=301 killSwitch=234 dailyTrend=162 cooldown=149 ddDaily=112 weeklyTrend=73 groupCap=1

## minus dirOverlay
  ALL:  T= 422 WR= 39% PF= 1.50 sumR=+146.9 exp=+0.35R pnl=$10676  → balance $11176 maxDD 54.4%
  2026: T= 269 WR= 38% PF= 1.40 sumR=+76.6 exp=+0.28R pnl=$8891
  blocks: maxOpen=1184 ddRolling7d=800 atrPct=697 shortConf=544 exposure=508 ddMonthly=475 dailyTrend=295 ddDaily=206 cooldown=165 killSwitch=165 weeklyTrend=80 groupCap=3

## minus dailyTrend
  ALL:  T= 391 WR= 40% PF= 1.60 sumR=+158.1 exp=+0.40R pnl=$18751  → balance $19251 maxDD 54.1%
  2026: T= 245 WR= 42% PF= 1.59 sumR=+97.1 exp=+0.40R pnl=$17853
  blocks: maxOpen=1219 atrPct=784 shortConf=751 ddMonthly=597 ddRolling7d=541 exposure=476 dirOverlay=282 killSwitch=155 cooldown=149 ddDaily=119 weeklyTrend=80

## minus weeklyTrend
  ALL:  T= 405 WR= 40% PF= 1.58 sumR=+159.1 exp=+0.39R pnl=$33277  → balance $33777 maxDD 45.6%
  2026: T= 231 WR= 37% PF= 1.33 sumR=+55.8 exp=+0.24R pnl=$26001
  blocks: maxOpen=1197 atrPct=757 ddRolling7d=715 shortConf=635 exposure=502 ddMonthly=380 dirOverlay=301 killSwitch=234 dailyTrend=160 cooldown=148 ddDaily=109 groupCap=1

## minus shortConf
  ALL:  T= 306 WR= 39% PF= 1.50 sumR=+105.7 exp=+0.35R pnl=$2635  → balance $3135 maxDD 57.6%
  2026: T= 130 WR= 37% PF= 1.36 sumR=+33.9 exp=+0.26R pnl=$605
  blocks: ddMonthly=2363 maxOpen=969 ddRolling7d=758 exposure=338 atrPct=319 ddDaily=167 cooldown=107 dirOverlay=105 weeklyTrend=69 dailyTrend=40 killSwitch=2 groupCap=1

## minus atrPct
  ALL:  T= 462 WR= 41% PF= 1.63 sumR=+193.3 exp=+0.42R pnl=$60846  → balance $61346 maxDD 39.8%
  2026: T= 282 WR= 39% PF= 1.40 sumR=+79.5 exp=+0.28R pnl=$53007
  blocks: maxOpen=1699 shortConf=732 ddRolling7d=692 exposure=603 dirOverlay=341 ddMonthly=246 dailyTrend=221 killSwitch=181 cooldown=153 ddDaily=130 weeklyTrend=83 groupCap=1

## minus btcCap
  ALL:  T= 422 WR= 39% PF= 1.53 sumR=+152.8 exp=+0.36R pnl=$15489  → balance $15989 maxDD 44.2%
  2026: T= 266 WR= 38% PF= 1.38 sumR=+72.2 exp=+0.27R pnl=$12792
  blocks: ddMonthly=1386 atrPct=808 shortConf=792 exposure=557 ddRolling7d=466 dirOverlay=304 ddDaily=201 dailyTrend=189 cooldown=157 killSwitch=118 weeklyTrend=74 groupCap=70

## minus groupCap
  ALL:  T= 375 WR= 39% PF= 1.50 sumR=+130.7 exp=+0.35R pnl=$11806  → balance $12306 maxDD 45.6%
  2026: T= 228 WR= 37% PF= 1.33 sumR=+55.1 exp=+0.24R pnl=$9395
  blocks: maxOpen=1179 atrPct=759 ddRolling7d=715 shortConf=631 exposure=458 ddMonthly=379 dirOverlay=310 killSwitch=234 dailyTrend=162 cooldown=151 ddDaily=118 weeklyTrend=73

## minus killSwitch
  ALL:  T= 403 WR= 40% PF= 1.53 sumR=+147.1 exp=+0.36R pnl=$24999  → balance $25499 maxDD 47.4%
  2026: T= 254 WR= 39% PF= 1.41 sumR=+73.7 exp=+0.29R pnl=$22836
  blocks: maxOpen=1217 atrPct=890 ddRolling7d=650 shortConf=649 exposure=483 ddMonthly=421 dirOverlay=293 dailyTrend=192 cooldown=150 ddDaily=118 weeklyTrend=78

## minus ddDaily
  ALL:  T= 357 WR= 39% PF= 1.54 sumR=+133.8 exp=+0.37R pnl=$11465  → balance $11965 maxDD 44.2%
  2026: T= 210 WR= 37% PF= 1.39 sumR=+58.2 exp=+0.28R pnl=$9054
  blocks: maxOpen=1156 ddMonthly=787 atrPct=753 ddRolling7d=635 shortConf=607 exposure=434 dirOverlay=300 killSwitch=154 dailyTrend=150 cooldown=138 weeklyTrend=73

## minus ddMonthly
  ALL:  T= 412 WR= 39% PF= 1.51 sumR=+146.8 exp=+0.36R pnl=$16335  → balance $16835 maxDD 45.6%
  2026: T= 265 WR= 38% PF= 1.37 sumR=+71.2 exp=+0.27R pnl=$13924
  blocks: maxOpen=1218 ddRolling7d=874 atrPct=791 shortConf=669 exposure=497 dirOverlay=320 killSwitch=188 dailyTrend=187 cooldown=170 ddDaily=142 weeklyTrend=73 groupCap=3

## minus ddRolling
  ALL:  T= 409 WR= 40% PF= 1.55 sumR=+153.7 exp=+0.38R pnl=$29214  → balance $29714 maxDD 50.6%
  2026: T= 259 WR= 39% PF= 1.41 sumR=+74.6 exp=+0.29R pnl=$26615
  blocks: maxOpen=1233 atrPct=830 killSwitch=687 shortConf=636 exposure=488 ddMonthly=405 dirOverlay=318 dailyTrend=186 cooldown=153 ddDaily=118 weeklyTrend=80 groupCap=1

## minus kelly
  ALL:  T= 440 WR= 41% PF= 1.61 sumR=+181.5 exp=+0.41R pnl=$8674  → balance $9174 maxDD 29.1%
  2026: T= 292 WR= 40% PF= 1.51 sumR=+103.6 exp=+0.35R pnl=$7454
  blocks: maxOpen=1266 atrPct=925 killSwitch=752 shortConf=685 exposure=528 dirOverlay=347 dailyTrend=191 cooldown=169 ddRolling7d=129 weeklyTrend=80 ddDaily=31 groupCap=1

## minus riskMult
  ALL:  T= 348 WR= 38% PF= 1.50 sumR=+122.1 exp=+0.35R pnl=$8710  → balance $9210 maxDD 45.1%
  2026: T= 214 WR= 37% PF= 1.34 sumR=+53.9 exp=+0.25R pnl=$6552
  blocks: maxOpen=999 ddRolling7d=740 ddMonthly=705 atrPct=650 shortConf=570 exposure=445 dirOverlay=283 ddDaily=261 killSwitch=181 dailyTrend=170 cooldown=119 weeklyTrend=73

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=2049 WR= 44% PF= 1.81 sumR=+1065.8 exp=+0.52R pnl=$6857627970  → balance $6857628470 maxDD 51.7%
  2026: T=1483 WR= 43% PF= 1.76 sumR=+733.4 exp=+0.49R pnl=$6857557886
  blocks: exposure=2181 maxOpen=760 cooldown=554

## LS-only BASELINE
  ALL:  T= 325 WR= 41% PF= 1.57 sumR=+128.0 exp=+0.39R pnl=$12864  → balance $13364 maxDD 44.2%
  2026: T= 254 WR= 42% PF= 1.63 sumR=+107.0 exp=+0.42R pnl=$12682
  blocks: maxOpen=902 atrPct=779 ddRolling7d=745 shortConf=659 ddMonthly=362 exposure=287 dirOverlay=287 dailyTrend=181 ddDaily=135 cooldown=101 killSwitch=93 groupCap=1

## LS-only LEAN
  ALL:  T=1933 WR= 44% PF= 1.81 sumR=+1013.2 exp=+0.52R pnl=$2566310357  → balance $2566310857 maxDD 46.8%
  2026: T=1475 WR= 44% PF= 1.80 sumR=+767.3 exp=+0.52R pnl=$2566295781
  blocks: exposure=1762 maxOpen=658 cooldown=504

## LS+RSI LEAN
  ALL:  T=1952 WR= 44% PF= 1.81 sumR=+1021.8 exp=+0.52R pnl=$3021566367  → balance $3021566867 maxDD 50.1%
  2026: T=1488 WR= 44% PF= 1.79 sumR=+762.5 exp=+0.51R pnl=$3021547532
  blocks: exposure=1950 maxOpen=717 cooldown=557

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1414 WR= 44% PF= 1.82 sumR=+737.2 exp=+0.52R pnl=$13422772756  → balance $13422773256 maxDD 75.5%
  2026: T=1037 WR= 44% PF= 1.79 sumR=+527.0 exp=+0.51R pnl=$13422746061
  blocks: exposure=1541 killSwitch=1194 ddDaily=545 cooldown=407 maxOpen=356 weeklyTrend=87

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1329 WR= 43% PF= 1.80 sumR=+681.4 exp=+0.51R pnl=$2879611047  → balance $2879611547 maxDD 78.7%
  2026: T=1025 WR= 43% PF= 1.76 sumR=+508.6 exp=+0.50R pnl=$2879601938
  blocks: exposure=1360 killSwitch=1210 ddDaily=592 cooldown=394 maxOpen=291

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1291 WR= 42% PF= 1.73 sumR=+614.2 exp=+0.48R pnl=$242512326  → balance $242512826 maxDD 86.3%
  2026: T= 925 WR= 42% PF= 1.67 sumR=+412.1 exp=+0.45R pnl=$242492439
  blocks: exposure=1470 killSwitch=1121 ddDaily=677 cooldown=390 maxOpen=325 groupCap=181 weeklyTrend=89

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1321 WR= 42% PF= 1.71 sumR=+614.0 exp=+0.46R pnl=$270773636  → balance $270774136 maxDD 76.1%
  2026: T= 959 WR= 42% PF= 1.67 sumR=+427.5 exp=+0.45R pnl=$270758294
  blocks: exposure=1414 ddRolling7d=1273 ddDaily=553 cooldown=381 maxOpen=332 killSwitch=184 weeklyTrend=86

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1286 WR= 43% PF= 1.78 sumR=+651.6 exp=+0.51R pnl=$1806548734  → balance $1806549234 maxDD 76.3%
  2026: T= 937 WR= 43% PF= 1.78 sumR=+473.6 exp=+0.51R pnl=$1806538390
  blocks: exposure=1411 ddRolling7d=1142 ddDaily=534 cooldown=370 maxOpen=297 killSwitch=237 groupCap=181 weeklyTrend=86

## PROPOSED-F (= E without kelly)
  ALL:  T=1437 WR= 44% PF= 1.83 sumR=+760.2 exp=+0.53R pnl=$31059245  → balance $31059745 maxDD 63.0%
  2026: T=1067 WR= 44% PF= 1.81 sumR=+556.9 exp=+0.52R pnl=$31052464
  blocks: exposure=1557 ddRolling7d=901 maxOpen=402 cooldown=397 killSwitch=281 ddDaily=276 groupCap=205 weeklyTrend=88

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  70 WR= 23% PF= 0.61 sumR=-24.5 exp=-0.35R pnl=$-2519521
  LONG  · BTC daily neutral T=  66 WR= 27% PF= 0.92 sumR=-4.0 exp=-0.06R pnl=$817816
  LONG  · BTC daily down    T= 148 WR= 37% PF= 1.43 sumR=+44.7 exp=+0.30R pnl=$388524
  SHORT · BTC daily up      T= 268 WR= 59% PF= 3.42 sumR=+303.7 exp=+1.13R pnl=$22370398
  SHORT · BTC daily neutral T= 148 WR= 44% PF= 1.78 sumR=+74.5 exp=+0.50R pnl=$3940944
  SHORT · BTC daily down    T= 694 WR= 43% PF= 1.79 sumR=+355.4 exp=+0.51R pnl=$2996687
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  43 WR= 37% PF= 1.39 sumR=+11.7 exp=+0.27R pnl=$-2499348
  LONG  · BTC weekly neutral T=  33 WR= 36% PF= 1.34 sumR=+8.0 exp=+0.24R pnl=$581
  LONG  · BTC weekly down    T= 208 WR= 29% PF= 0.98 sumR=-3.4 exp=-0.02R pnl=$1185586
  SHORT · BTC weekly up      T= 162 WR= 49% PF= 2.29 sumR=+117.8 exp=+0.73R pnl=$13328369
  SHORT · BTC weekly neutral T= 118 WR= 53% PF= 2.56 sumR=+100.9 exp=+0.85R pnl=$702006
  SHORT · BTC weekly down    T= 830 WR= 46% PF= 2.00 sumR=+514.9 exp=+0.62R pnl=$15277654

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  91 WR= 43% PF= 1.79 sumR=+43.4 exp=+0.48R pnl=$-11336
                     2026: T=  19 WR= 47% PF= 1.83 sumR=+8.9 exp=+0.47R pnl=$-11816
  rsi-divergence     ALL:  T=  40 WR= 45% PF= 1.86 sumR=+20.6 exp=+0.51R pnl=$957090
                     2026: T=  26 WR= 46% PF= 1.51 sumR=+7.9 exp=+0.30R pnl=$956739
  liquidity-sweep    ALL:  T=1263 WR= 44% PF= 1.85 sumR=+685.8 exp=+0.54R pnl=$27049093
                     2026: T= 996 WR= 44% PF= 1.87 sumR=+554.4 exp=+0.56R pnl=$27045098

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  73 WR= 45% PF= 2.01 sumR=+42.9 exp=+0.59R pnl=$1672
                     2026: T=  12 WR= 42% PF= 1.57 sumR=+4.4 exp=+0.36R pnl=$661
  rsi-divergence     ALL:  T=  28 WR= 39% PF= 1.70 sumR=+13.1 exp=+0.47R pnl=$-1045
                     2026: T=  17 WR= 41% PF= 1.33 sumR=+3.8 exp=+0.22R pnl=$-1296
  liquidity-sweep    ALL:  T= 277 WR= 37% PF= 1.37 sumR=+75.2 exp=+0.27R pnl=$11467
                     2026: T= 202 WR= 37% PF= 1.32 sumR=+47.5 exp=+0.23R pnl=$10318

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 131 WR= 44% PF= 1.98 sumR=+74.9 exp=+0.57R pnl=$-27526708
                     2026: T=  25 WR= 36% PF= 1.14 sumR=+2.4 exp=+0.10R pnl=$-27528620
  rsi-divergence     ALL:  T=  50 WR= 46% PF= 1.83 sumR=+25.4 exp=+0.51R pnl=$352317347
                     2026: T=  36 WR= 44% PF= 1.46 sumR=+10.4 exp=+0.29R pnl=$352313621
  liquidity-sweep    ALL:  T=1868 WR= 43% PF= 1.80 sumR=+965.6 exp=+0.52R pnl=$6532837332
                     2026: T=1422 WR= 43% PF= 1.78 sumR=+720.5 exp=+0.51R pnl=$6532772884

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.67 sumR=+40.5 exp=+0.42R pnl=$83503319
                     2026: T=  22 WR= 36% PF= 1.28 sumR=+4.2 exp=+0.19R pnl=$83502287
  rsi-divergence     ALL:  T=  55 WR= 42% PF= 1.54 sumR=+18.8 exp=+0.34R pnl=$531463609
                     2026: T=  38 WR= 42% PF= 1.28 sumR=+6.9 exp=+0.18R pnl=$531462423
  liquidity-sweep    ALL:  T=1263 WR= 44% PF= 1.84 sumR=+677.9 exp=+0.54R pnl=$12807805828
                     2026: T= 977 WR= 44% PF= 1.82 sumR=+515.9 exp=+0.53R pnl=$12807781350

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  55 WR= 42% PF= 1.54 sumR=+18.8 exp=+0.34R pnl=$79244031
                     2026: T=  38 WR= 42% PF= 1.28 sumR=+6.9 exp=+0.18R pnl=$79243510
  liquidity-sweep    ALL:  T=1274 WR= 43% PF= 1.81 sumR=+662.6 exp=+0.52R pnl=$2800367016
                     2026: T= 987 WR= 43% PF= 1.78 sumR=+501.7 exp=+0.51R pnl=$2800358428

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  93 WR= 41% PF= 1.67 sumR=+39.3 exp=+0.42R pnl=$10459444
                     2026: T=  20 WR= 35% PF= 1.14 sumR=+1.9 exp=+0.10R pnl=$10458275
  rsi-divergence     ALL:  T=  49 WR= 43% PF= 1.68 sumR=+20.8 exp=+0.43R pnl=$16941208
                     2026: T=  31 WR= 42% PF= 1.32 sumR=+6.5 exp=+0.21R pnl=$16940690
  liquidity-sweep    ALL:  T=1149 WR= 42% PF= 1.73 sumR=+554.1 exp=+0.48R pnl=$215111673
                     2026: T= 874 WR= 42% PF= 1.70 sumR=+403.7 exp=+0.46R pnl=$215093475

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  92 WR= 41% PF= 1.68 sumR=+39.1 exp=+0.42R pnl=$-6708225
                     2026: T=  20 WR= 35% PF= 1.04 sumR=+0.5 exp=+0.03R pnl=$-6710342
  rsi-divergence     ALL:  T=  39 WR= 46% PF= 1.87 sumR=+19.7 exp=+0.50R pnl=$12241576
                     2026: T=  24 WR= 50% PF= 1.83 sumR=+11.0 exp=+0.46R pnl=$12241339
  liquidity-sweep    ALL:  T=1190 WR= 42% PF= 1.71 sumR=+555.3 exp=+0.47R pnl=$265240285
                     2026: T= 915 WR= 42% PF= 1.69 sumR=+416.0 exp=+0.45R pnl=$265227297

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  91 WR= 42% PF= 1.75 sumR=+42.1 exp=+0.46R pnl=$45517028
                     2026: T=  20 WR= 35% PF= 1.18 sumR=+2.5 exp=+0.13R pnl=$45515043
  rsi-divergence     ALL:  T=  37 WR= 49% PF= 2.14 sumR=+23.2 exp=+0.63R pnl=$183312835
                     2026: T=  24 WR= 54% PF= 2.22 sumR=+14.8 exp=+0.62R pnl=$183314038
  liquidity-sweep    ALL:  T=1158 WR= 43% PF= 1.78 sumR=+586.3 exp=+0.51R pnl=$1577718870
                     2026: T= 893 WR= 43% PF= 1.78 sumR=+456.3 exp=+0.51R pnl=$1577709310

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  90 WR= 44% PF= 1.93 sumR=+49.1 exp=+0.55R pnl=$340750
                     2026: T=  18 WR= 50% PF= 2.12 sumR=+10.7 exp=+0.59R pnl=$340201
  rsi-divergence     ALL:  T=  36 WR= 47% PF= 2.06 sumR=+22.2 exp=+0.62R pnl=$1348320
                     2026: T=  23 WR= 48% PF= 1.71 sumR=+9.4 exp=+0.41R pnl=$1347932
  liquidity-sweep    ALL:  T=1311 WR= 44% PF= 1.81 sumR=+688.9 exp=+0.53R pnl=$29370175
                     2026: T=1026 WR= 44% PF= 1.81 sumR=+536.9 exp=+0.52R pnl=$29364331

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
  2025-10  +$371.92
  2025-11  +$5661.65
  2025-12  $-1612.59
  2026-01  +$32046.64
  2026-02  +$62027.15
  2026-03  +$253921.16
  2026-04  $-156881.58
  2026-05  +$397439.42
  2026-06  +$2061757.94
  2026-07  +$5343019.21
  2026-08  +$20297020.57
  2026-09  $-300330.10