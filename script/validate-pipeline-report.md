# Full-Pipeline Portfolio Validation — 2026-07-02
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 3629

## ENGINE-CURRENT (shipped Jul 2026 = PROPOSED-F)
  ALL:  T=1201 WR= 44% PF= 1.93 sumR=+687.8 exp=+0.57R pnl=$28343117  → balance $28343617 maxDD 35.8%
  2026: T= 645 WR= 44% PF= 1.94 sumR=+370.8 exp=+0.57R pnl=$28279405
  blocks: exposure=1160 ddRolling7d=287 cooldown=265 killSwitch=217 maxOpen=154 groupCap=137 ddDaily=114 weeklyTrend=94

## CAP maxOpen=8
  ALL:  T=1114 WR= 43% PF= 1.85 sumR=+590.5 exp=+0.53R pnl=$5674923  → balance $5675423 maxDD 43.0%
  2026: T= 575 WR= 43% PF= 1.81 sumR=+294.7 exp=+0.51R pnl=$5627604
  blocks: exposure=1078 maxOpen=331 ddRolling7d=297 cooldown=265 killSwitch=260 ddDaily=115 weeklyTrend=94 groupCap=75

## CAP maxOpen=10
  ALL:  T=1201 WR= 44% PF= 1.93 sumR=+687.8 exp=+0.57R pnl=$28343117  → balance $28343617 maxDD 35.8%
  2026: T= 645 WR= 44% PF= 1.94 sumR=+370.8 exp=+0.57R pnl=$28279405
  blocks: exposure=1160 ddRolling7d=287 cooldown=265 killSwitch=217 maxOpen=154 groupCap=137 ddDaily=114 weeklyTrend=94

## CAP perSymbol=2
  ALL:  T=1202 WR= 44% PF= 1.91 sumR=+676.2 exp=+0.56R pnl=$21623254  → balance $21623754 maxDD 37.4%
  2026: T= 636 WR= 44% PF= 1.95 sumR=+369.3 exp=+0.58R pnl=$21570202
  blocks: exposure=1093 ddRolling7d=322 cooldown=281 killSwitch=209 maxOpen=165 groupCap=140 ddDaily=118 weeklyTrend=99

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1105 WR= 43% PF= 1.85 sumR=+584.1 exp=+0.53R pnl=$5434268  → balance $5434768 maxDD 43.1%
  2026: T= 563 WR= 43% PF= 1.81 sumR=+287.4 exp=+0.51R pnl=$5386601
  blocks: exposure=1003 maxOpen=343 ddRolling7d=330 killSwitch=285 cooldown=270 ddDaily=128 weeklyTrend=91 groupCap=74

## CAP LS cooldown 8h
  ALL:  T=1226 WR= 44% PF= 1.91 sumR=+686.8 exp=+0.56R pnl=$29729534  → balance $29730034 maxDD 33.7%
  2026: T= 665 WR= 45% PF= 1.94 sumR=+381.7 exp=+0.57R pnl=$29677191
  blocks: exposure=1182 ddRolling7d=262 cooldown=228 killSwitch=220 maxOpen=153 groupCap=140 ddDaily=124 weeklyTrend=94

## CAP LS cooldown 6h
  ALL:  T=1177 WR= 44% PF= 1.92 sumR=+663.4 exp=+0.56R pnl=$20204088  → balance $20204588 maxDD 33.7%
  2026: T= 608 WR= 44% PF= 1.94 sumR=+350.0 exp=+0.58R pnl=$20142860
  blocks: exposure=1131 ddRolling7d=336 killSwitch=297 cooldown=213 maxOpen=151 groupCap=116 ddDaily=114 weeklyTrend=94

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1099 WR= 42% PF= 1.81 sumR=+562.9 exp=+0.51R pnl=$4284664  → balance $4285164 maxDD 38.4%
  2026: T= 574 WR= 43% PF= 1.81 sumR=+292.8 exp=+0.51R pnl=$4252184
  blocks: exposure=994 killSwitch=364 maxOpen=329 ddRolling7d=323 cooldown=232 ddDaily=111 weeklyTrend=91 groupCap=86

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1202 WR= 44% PF= 1.91 sumR=+676.2 exp=+0.56R pnl=$21623254  → balance $21623754 maxDD 37.4%
  2026: T= 636 WR= 44% PF= 1.95 sumR=+369.3 exp=+0.58R pnl=$21570202
  blocks: exposure=1093 ddRolling7d=322 cooldown=281 killSwitch=209 maxOpen=165 groupCap=140 ddDaily=118 weeklyTrend=99

## CAP maxOpen=12
  ALL:  T=1180 WR= 43% PF= 1.90 sumR=+657.2 exp=+0.56R pnl=$9889351  → balance $9889851 maxDD 40.0%
  2026: T= 630 WR= 44% PF= 1.93 sumR=+359.7 exp=+0.57R pnl=$9847105
  blocks: exposure=1149 ddRolling7d=340 cooldown=267 killSwitch=249 groupCap=172 ddDaily=114 weeklyTrend=94 maxOpen=64

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1019 WR= 42% PF= 1.81 sumR=+517.6 exp=+0.51R pnl=$1377082  → balance $1377582 maxDD 38.9%
  2026: T= 513 WR= 43% PF= 1.81 sumR=+260.1 exp=+0.51R pnl=$1349492
  blocks: exposure=993 killSwitch=388 ddRolling7d=376 groupCap=333 cooldown=239 ddDaily=113 weeklyTrend=90 maxOpen=78

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1180 WR= 43% PF= 1.90 sumR=+657.2 exp=+0.56R pnl=$9889351  → balance $9889851 maxDD 40.0%
  2026: T= 630 WR= 44% PF= 1.93 sumR=+359.7 exp=+0.57R pnl=$9847105
  blocks: exposure=1149 ddRolling7d=340 cooldown=267 killSwitch=249 groupCap=172 ddDaily=114 weeklyTrend=94 maxOpen=64

## BASELINE (all gates)
  ALL:  T= 382 WR= 41% PF= 1.72 sumR=+178.0 exp=+0.47R pnl=$72090  → balance $72590 maxDD 38.3%
  2026: T= 177 WR= 41% PF= 1.64 sumR=+74.8 exp=+0.42R pnl=$64048
  blocks: maxOpen=711 atrPct=546 ddRolling7d=516 exposure=427 dirOverlay=245 shortConf=175 ddMonthly=156 killSwitch=134 cooldown=109 dailyTrend=88 ddDaily=73 weeklyTrend=64 groupCap=3

## minus dirOverlay
  ALL:  T= 392 WR= 39% PF= 1.65 sumR=+167.8 exp=+0.43R pnl=$45863  → balance $46363 maxDD 47.9%
  2026: T= 174 WR= 39% PF= 1.58 sumR=+67.5 exp=+0.39R pnl=$38960
  blocks: maxOpen=715 ddRolling7d=619 atrPct=463 exposure=458 shortConf=166 ddMonthly=161 killSwitch=159 ddDaily=154 dailyTrend=141 cooldown=125 weeklyTrend=76

## minus dailyTrend
  ALL:  T= 393 WR= 41% PF= 1.73 sumR=+185.0 exp=+0.47R pnl=$75864  → balance $76364 maxDD 38.3%
  2026: T= 179 WR= 42% PF= 1.76 sumR=+86.8 exp=+0.48R pnl=$70622
  blocks: maxOpen=738 atrPct=541 ddRolling7d=483 exposure=446 ddMonthly=248 dirOverlay=234 shortConf=202 killSwitch=108 cooldown=94 ddDaily=74 weeklyTrend=66 groupCap=2

## minus weeklyTrend
  ALL:  T= 412 WR= 42% PF= 1.81 sumR=+208.2 exp=+0.51R pnl=$206184  → balance $206684 maxDD 38.3%
  2026: T= 178 WR= 41% PF= 1.64 sumR=+74.1 exp=+0.42R pnl=$185504
  blocks: maxOpen=728 atrPct=546 exposure=464 ddRolling7d=463 dirOverlay=243 ddMonthly=217 shortConf=172 killSwitch=112 cooldown=106 dailyTrend=96 ddDaily=67 groupCap=3

## minus shortConf
  ALL:  T= 371 WR= 43% PF= 1.85 sumR=+195.3 exp=+0.53R pnl=$80705  → balance $81205 maxDD 44.1%
  2026: T= 125 WR= 41% PF= 1.67 sumR=+55.5 exp=+0.44R pnl=$60461
  blocks: ddMonthly=770 maxOpen=697 exposure=397 atrPct=390 ddRolling7d=387 dirOverlay=184 ddDaily=152 cooldown=100 dailyTrend=67 weeklyTrend=64 killSwitch=46 groupCap=4

## minus atrPct
  ALL:  T= 412 WR= 44% PF= 1.95 sumR=+238.7 exp=+0.58R pnl=$296062  → balance $296562 maxDD 35.4%
  2026: T= 137 WR= 42% PF= 1.74 sumR=+63.8 exp=+0.47R pnl=$240544
  blocks: maxOpen=913 ddMonthly=524 exposure=479 ddRolling7d=377 dirOverlay=291 shortConf=209 cooldown=126 ddDaily=109 dailyTrend=84 weeklyTrend=74 killSwitch=27 groupCap=4

## minus btcCap
  ALL:  T= 427 WR= 42% PF= 1.81 sumR=+218.2 exp=+0.51R pnl=$120039  → balance $120539 maxDD 39.5%
  2026: T= 200 WR= 43% PF= 1.78 sumR=+98.4 exp=+0.49R pnl=$109437
  blocks: ddMonthly=916 atrPct=559 exposure=513 ddRolling7d=268 shortConf=253 dirOverlay=230 cooldown=125 ddDaily=104 dailyTrend=102 weeklyTrend=63 groupCap=52 killSwitch=17

## minus groupCap
  ALL:  T= 383 WR= 40% PF= 1.71 sumR=+176.7 exp=+0.46R pnl=$69280  → balance $69780 maxDD 38.3%
  2026: T= 178 WR= 40% PF= 1.63 sumR=+73.5 exp=+0.41R pnl=$61238
  blocks: maxOpen=711 atrPct=546 ddRolling7d=516 exposure=427 dirOverlay=245 shortConf=175 ddMonthly=156 killSwitch=134 cooldown=109 dailyTrend=90 ddDaily=73 weeklyTrend=64

## minus killSwitch
  ALL:  T= 408 WR= 41% PF= 1.77 sumR=+200.3 exp=+0.49R pnl=$142590  → balance $143090 maxDD 33.5%
  2026: T= 201 WR= 42% PF= 1.74 sumR=+95.3 exp=+0.47R pnl=$134154
  blocks: maxOpen=744 atrPct=560 ddRolling7d=531 exposure=444 dirOverlay=243 shortConf=188 ddMonthly=156 cooldown=118 dailyTrend=99 ddDaily=73 weeklyTrend=62 groupCap=3

## minus ddDaily
  ALL:  T= 392 WR= 41% PF= 1.73 sumR=+186.5 exp=+0.48R pnl=$92474  → balance $92974 maxDD 36.1%
  2026: T= 182 WR= 41% PF= 1.68 sumR=+80.8 exp=+0.44R pnl=$84008
  blocks: maxOpen=727 atrPct=574 ddRolling7d=529 exposure=439 dirOverlay=257 shortConf=174 ddMonthly=156 killSwitch=113 cooldown=109 dailyTrend=94 weeklyTrend=62 groupCap=3

## minus ddMonthly
  ALL:  T= 411 WR= 41% PF= 1.76 sumR=+199.3 exp=+0.48R pnl=$130650  → balance $131150 maxDD 38.3%
  2026: T= 179 WR= 41% PF= 1.66 sumR=+77.4 exp=+0.43R pnl=$116742
  blocks: maxOpen=723 atrPct=566 ddRolling7d=504 exposure=450 dirOverlay=259 shortConf=183 killSwitch=140 cooldown=128 ddDaily=98 dailyTrend=97 weeklyTrend=67 groupCap=3

## minus ddRolling
  ALL:  T= 387 WR= 41% PF= 1.77 sumR=+191.1 exp=+0.49R pnl=$112826  → balance $113326 maxDD 43.9%
  2026: T= 172 WR= 42% PF= 1.73 sumR=+81.1 exp=+0.47R pnl=$103676
  blocks: maxOpen=638 atrPct=535 ddMonthly=427 exposure=420 killSwitch=390 dirOverlay=249 shortConf=187 cooldown=131 dailyTrend=99 ddDaily=94 weeklyTrend=69 groupCap=3

## minus kelly
  ALL:  T= 421 WR= 41% PF= 1.77 sumR=+208.7 exp=+0.50R pnl=$15661  → balance $16161 maxDD 21.2%
  2026: T= 204 WR= 42% PF= 1.76 sumR=+99.6 exp=+0.49R pnl=$13169
  blocks: maxOpen=768 atrPct=643 exposure=462 dirOverlay=265 killSwitch=259 shortConf=190 ddMonthly=156 cooldown=141 ddRolling7d=131 dailyTrend=109 weeklyTrend=69 ddDaily=12 groupCap=3

## minus riskMult
  ALL:  T= 352 WR= 41% PF= 1.75 sumR=+170.7 exp=+0.49R pnl=$73272  → balance $73772 maxDD 37.2%
  2026: T= 155 WR= 41% PF= 1.70 sumR=+70.5 exp=+0.45R pnl=$65043
  blocks: ddMonthly=555 maxOpen=525 atrPct=461 ddRolling7d=402 exposure=397 dirOverlay=240 ddDaily=179 shortConf=166 cooldown=103 dailyTrend=93 killSwitch=89 weeklyTrend=64 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1543 WR= 44% PF= 1.96 sumR=+904.3 exp=+0.59R pnl=$989267649  → balance $989268149 maxDD 43.8%
  2026: T= 780 WR= 45% PF= 1.98 sumR=+466.6 exp=+0.60R pnl=$988867252
  blocks: exposure=1463 cooldown=345 maxOpen=278

## LS-only BASELINE
  ALL:  T= 279 WR= 41% PF= 1.69 sumR=+127.3 exp=+0.46R pnl=$19189  → balance $19689 maxDD 33.3%
  2026: T= 149 WR= 43% PF= 1.79 sumR=+74.7 exp=+0.50R pnl=$17888
  blocks: atrPct=478 maxOpen=473 ddMonthly=441 ddRolling7d=431 dirOverlay=229 exposure=206 shortConf=168 ddDaily=91 dailyTrend=68 cooldown=45 killSwitch=17 groupCap=2

## LS-only LEAN
  ALL:  T=1389 WR= 44% PF= 1.96 sumR=+821.0 exp=+0.59R pnl=$244131590  → balance $244132090 maxDD 46.4%
  2026: T= 749 WR= 45% PF= 1.99 sumR=+452.8 exp=+0.60R pnl=$244008480
  blocks: exposure=1058 cooldown=256 maxOpen=225

## LS+RSI LEAN
  ALL:  T=1425 WR= 44% PF= 1.95 sumR=+833.3 exp=+0.58R pnl=$282763487  → balance $282763987 maxDD 45.7%
  2026: T= 768 WR= 45% PF= 1.99 sumR=+462.8 exp=+0.60R pnl=$282640634
  blocks: exposure=1228 cooldown=343 maxOpen=262

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1082 WR= 43% PF= 1.82 sumR=+554.4 exp=+0.51R pnl=$337245958  → balance $337246458 maxDD 60.5%
  2026: T= 580 WR= 43% PF= 1.78 sumR=+286.0 exp=+0.49R pnl=$337030739
  blocks: exposure=1060 killSwitch=640 ddDaily=323 cooldown=267 maxOpen=163 weeklyTrend=94

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1005 WR= 43% PF= 1.89 sumR=+552.8 exp=+0.55R pnl=$311058488  → balance $311058988 maxDD 62.0%
  2026: T= 582 WR= 44% PF= 1.89 sumR=+321.4 exp=+0.55R pnl=$310981156
  blocks: exposure=895 killSwitch=614 ddDaily=318 cooldown=272 maxOpen=154

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1017 WR= 42% PF= 1.79 sumR=+505.7 exp=+0.50R pnl=$125081453  → balance $125081953 maxDD 60.5%
  2026: T= 532 WR= 42% PF= 1.74 sumR=+251.2 exp=+0.47R pnl=$124903394
  blocks: exposure=1012 killSwitch=700 ddDaily=341 cooldown=257 maxOpen=123 weeklyTrend=94 groupCap=85

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1069 WR= 45% PF= 1.99 sumR=+640.3 exp=+0.60R pnl=$7107674327  → balance $7107674827 maxDD 61.6%
  2026: T= 581 WR= 46% PF= 2.04 sumR=+358.8 exp=+0.62R pnl=$7107290570
  blocks: exposure=1017 ddRolling7d=660 ddDaily=269 cooldown=258 maxOpen=177 killSwitch=94 weeklyTrend=85

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 992 WR= 44% PF= 1.90 sumR=+549.5 exp=+0.55R pnl=$824787268  → balance $824787768 maxDD 63.6%
  2026: T= 524 WR= 44% PF= 1.88 sumR=+284.9 exp=+0.54R pnl=$824488201
  blocks: exposure=967 ddRolling7d=720 ddDaily=271 cooldown=238 maxOpen=145 killSwitch=132 weeklyTrend=85 groupCap=79

## PROPOSED-F (= E without kelly)
  ALL:  T=1201 WR= 44% PF= 1.93 sumR=+687.8 exp=+0.57R pnl=$28343117  → balance $28343617 maxDD 35.8%
  2026: T= 645 WR= 44% PF= 1.94 sumR=+370.8 exp=+0.57R pnl=$28279405
  blocks: exposure=1160 ddRolling7d=287 cooldown=265 killSwitch=217 maxOpen=154 groupCap=137 ddDaily=114 weeklyTrend=94

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026 = PROPOSED-F)
  break-retest       ALL:  T=  98 WR= 43% PF= 1.83 sumR=+48.4 exp=+0.49R pnl=$861099
                     2026: T=  18 WR= 39% PF= 1.45 sumR=+5.3 exp=+0.29R pnl=$860901
  rsi-divergence     ALL:  T=  47 WR= 47% PF= 2.10 sumR=+29.2 exp=+0.62R pnl=$-208469
                     2026: T=  26 WR= 50% PF= 2.08 sumR=+15.0 exp=+0.58R pnl=$-214043
  liquidity-sweep    ALL:  T=1056 WR= 44% PF= 1.94 sumR=+610.2 exp=+0.58R pnl=$27690487
                     2026: T= 601 WR= 44% PF= 1.95 sumR=+350.6 exp=+0.58R pnl=$27632548

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  74 WR= 49% PF= 2.27 sumR=+50.4 exp=+0.68R pnl=$10024
                     2026: T=   9 WR= 56% PF= 2.53 sumR=+6.5 exp=+0.72R pnl=$8791
  rsi-divergence     ALL:  T=  26 WR= 31% PF= 1.35 sumR=+6.7 exp=+0.26R pnl=$-7517
                     2026: T=  13 WR= 38% PF= 1.38 sumR=+3.4 exp=+0.26R pnl=$-7270
  liquidity-sweep    ALL:  T= 282 WR= 39% PF= 1.64 sumR=+120.9 exp=+0.43R pnl=$69582
                     2026: T= 155 WR= 40% PF= 1.63 sumR=+64.9 exp=+0.42R pnl=$62527

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 139 WR= 45% PF= 2.10 sumR=+85.4 exp=+0.61R pnl=$37213332
                     2026: T=  22 WR= 36% PF= 1.28 sumR=+4.2 exp=+0.19R pnl=$37200712
  rsi-divergence     ALL:  T=  59 WR= 44% PF= 1.86 sumR=+29.8 exp=+0.50R pnl=$-4945222
                     2026: T=  30 WR= 50% PF= 2.01 sumR=+16.5 exp=+0.55R pnl=$-4975382
  liquidity-sweep    ALL:  T=1345 WR= 44% PF= 1.95 sumR=+789.2 exp=+0.59R pnl=$956999539
                     2026: T= 728 WR= 45% PF= 2.01 sumR=+445.9 exp=+0.61R pnl=$956641923

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T= 100 WR= 43% PF= 1.85 sumR=+50.5 exp=+0.50R pnl=$19623823
                     2026: T=  18 WR= 39% PF= 1.50 sumR=+5.8 exp=+0.32R pnl=$19621472
  rsi-divergence     ALL:  T=  58 WR= 43% PF= 1.78 sumR=+26.9 exp=+0.46R pnl=$-258198
                     2026: T=  27 WR= 52% PF= 2.19 sumR=+16.5 exp=+0.61R pnl=$-273117
  liquidity-sweep    ALL:  T= 924 WR= 43% PF= 1.82 sumR=+477.0 exp=+0.52R pnl=$317880333
                     2026: T= 535 WR= 42% PF= 1.77 sumR=+263.6 exp=+0.49R pnl=$317682383

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  59 WR= 44% PF= 1.84 sumR=+29.2 exp=+0.49R pnl=$676937
                     2026: T=  28 WR= 54% PF= 2.35 sumR=+18.8 exp=+0.67R pnl=$672680
  liquidity-sweep    ALL:  T= 946 WR= 43% PF= 1.89 sumR=+523.7 exp=+0.55R pnl=$310381551
                     2026: T= 554 WR= 43% PF= 1.88 sumR=+302.6 exp=+0.55R pnl=$310308477

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T= 100 WR= 43% PF= 1.85 sumR=+50.5 exp=+0.50R pnl=$6581229
                     2026: T=  18 WR= 39% PF= 1.50 sumR=+5.8 exp=+0.32R pnl=$6578845
  rsi-divergence     ALL:  T=  56 WR= 41% PF= 1.66 sumR=+22.9 exp=+0.41R pnl=$-69605
                     2026: T=  26 WR= 50% PF= 2.07 sumR=+14.9 exp=+0.57R pnl=$-76319
  liquidity-sweep    ALL:  T= 861 WR= 42% PF= 1.79 sumR=+432.3 exp=+0.50R pnl=$118569829
                     2026: T= 488 WR= 42% PF= 1.74 sumR=+230.5 exp=+0.47R pnl=$118400867

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  91 WR= 45% PF= 2.06 sumR=+55.0 exp=+0.60R pnl=$362960085
                     2026: T=  14 WR= 43% PF= 1.91 sumR=+7.7 exp=+0.55R pnl=$362936976
  rsi-divergence     ALL:  T=  45 WR= 44% PF= 2.03 sumR=+26.8 exp=+0.59R pnl=$72128538
                     2026: T=  22 WR= 50% PF= 2.16 sumR=+13.9 exp=+0.63R pnl=$72113654
  liquidity-sweep    ALL:  T= 933 WR= 45% PF= 1.99 sumR=+558.5 exp=+0.60R pnl=$6672585705
                     2026: T= 545 WR= 46% PF= 2.03 sumR=+337.2 exp=+0.62R pnl=$6672239941

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  91 WR= 45% PF= 2.06 sumR=+55.0 exp=+0.60R pnl=$37411240
                     2026: T=  14 WR= 43% PF= 1.91 sumR=+7.7 exp=+0.55R pnl=$37389730
  rsi-divergence     ALL:  T=  43 WR= 42% PF= 1.87 sumR=+22.8 exp=+0.53R pnl=$11384644
                     2026: T=  21 WR= 48% PF= 2.03 sumR=+12.2 exp=+0.58R pnl=$11375591
  liquidity-sweep    ALL:  T= 858 WR= 43% PF= 1.89 sumR=+471.7 exp=+0.55R pnl=$775991385
                     2026: T= 489 WR= 44% PF= 1.87 sumR=+264.9 exp=+0.54R pnl=$775722880

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  98 WR= 43% PF= 1.83 sumR=+48.4 exp=+0.49R pnl=$861099
                     2026: T=  18 WR= 39% PF= 1.45 sumR=+5.3 exp=+0.29R pnl=$860901
  rsi-divergence     ALL:  T=  47 WR= 47% PF= 2.10 sumR=+29.2 exp=+0.62R pnl=$-208469
                     2026: T=  26 WR= 50% PF= 2.08 sumR=+15.0 exp=+0.58R pnl=$-214043
  liquidity-sweep    ALL:  T=1056 WR= 44% PF= 1.94 sumR=+610.2 exp=+0.58R pnl=$27690487
                     2026: T= 601 WR= 44% PF= 1.95 sumR=+350.6 exp=+0.58R pnl=$27632548

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026 = PROPOSED-F)
  2022-12  +$91.51
  2023-01  $-12.29
  2023-02  $-24.31
  2023-03  +$36.39
  2023-04  $-37.14
  2023-05  +$1.70
  2023-06  +$32.30
  2023-07  +$1.85
  2023-08  +$140.18
  2023-09  +$37.74
  2023-10  $-16.14
  2023-11  +$74.62
  2023-12  +$63.57
  2024-01  $-18.68
  2024-02  +$28.85
  2024-03  +$105.88
  2024-04  $-41.68
  2024-05  $-39.62
  2024-06  +$117.46
  2024-07  $-67.03
  2024-08  $-19.98
  2024-10  $-40.10
  2024-11  $-6.69
  2024-12  $-19.02
  2025-01  $-22.87
  2025-03  +$37.77
  2025-04  +$105.73
  2025-06  $-51.74
  2025-07  +$67.06
  2025-08  +$1626.04
  2025-09  +$1777.72
  2025-10  +$11711.21
  2025-11  +$43605.02
  2025-12  +$7004.52
  2026-01  +$419501.75
  2026-02  +$138369.14
  2026-03  +$567824.58
  2026-04  +$2013653.24
  2026-05  +$9532556.63
  2026-06  +$16652179.86
  2026-07  $-1047217.79