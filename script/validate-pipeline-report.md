# Full-Pipeline Portfolio Validation — 2026-08-11
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 3686

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1239 WR= 45% PF= 1.93 sumR=+703.1 exp=+0.57R pnl=$41398439  → balance $41398939 maxDD 31.2%
  2026: T= 840 WR= 45% PF= 1.91 sumR=+466.1 exp=+0.55R pnl=$41380043
  blocks: exposure=1215 cooldown=337 ddRolling7d=235 maxOpen=177 killSwitch=159 groupCap=122 ddDaily=109 weeklyTrend=93

## CAP maxOpen=8
  ALL:  T=1175 WR= 43% PF= 1.86 sumR=+628.0 exp=+0.53R pnl=$12874416  → balance $12874916 maxDD 43.0%
  2026: T= 783 WR= 43% PF= 1.83 sumR=+407.5 exp=+0.52R pnl=$12858934
  blocks: exposure=1127 maxOpen=323 cooldown=312 ddRolling7d=255 killSwitch=199 ddDaily=127 weeklyTrend=93 groupCap=75

## CAP maxOpen=10
  ALL:  T=1250 WR= 44% PF= 1.92 sumR=+702.8 exp=+0.56R pnl=$46341311  → balance $46341811 maxDD 35.8%
  2026: T= 862 WR= 44% PF= 1.91 sumR=+480.8 exp=+0.56R pnl=$46325691
  blocks: exposure=1198 cooldown=316 killSwitch=217 ddRolling7d=216 maxOpen=150 groupCap=127 ddDaily=119 weeklyTrend=93

## CAP perSymbol=2
  ALL:  T=1248 WR= 44% PF= 1.91 sumR=+701.5 exp=+0.56R pnl=$42886363  → balance $42886863 maxDD 35.8%
  2026: T= 853 WR= 44% PF= 1.92 sumR=+479.4 exp=+0.56R pnl=$42870586
  blocks: exposure=1141 cooldown=329 ddRolling7d=264 killSwitch=203 maxOpen=161 groupCap=128 ddDaily=116 weeklyTrend=96

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1165 WR= 43% PF= 1.86 sumR=+622.7 exp=+0.53R pnl=$12571718  → balance $12572218 maxDD 43.1%
  2026: T= 771 WR= 44% PF= 1.83 sumR=+400.1 exp=+0.52R pnl=$12555803
  blocks: exposure=1060 maxOpen=337 cooldown=314 ddRolling7d=288 killSwitch=224 ddDaily=140 weeklyTrend=88 groupCap=70

## CAP LS cooldown 8h
  ALL:  T=1273 WR= 44% PF= 1.90 sumR=+706.8 exp=+0.56R pnl=$53649770  → balance $53650270 maxDD 30.1%
  2026: T= 883 WR= 44% PF= 1.91 sumR=+493.4 exp=+0.56R pnl=$53636051
  blocks: exposure=1224 cooldown=276 killSwitch=215 ddRolling7d=203 maxOpen=149 groupCap=132 ddDaily=121 weeklyTrend=93

## CAP LS cooldown 6h
  ALL:  T=1227 WR= 44% PF= 1.90 sumR=+683.3 exp=+0.56R pnl=$36430931  → balance $36431431 maxDD 32.0%
  2026: T= 829 WR= 44% PF= 1.90 sumR=+461.6 exp=+0.56R pnl=$36414822
  blocks: exposure=1175 killSwitch=294 ddRolling7d=277 cooldown=254 maxOpen=147 ddDaily=111 groupCap=108 weeklyTrend=93

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1155 WR= 43% PF= 1.83 sumR=+599.5 exp=+0.52R pnl=$9729808  → balance $9730308 maxDD 38.4%
  2026: T= 781 WR= 43% PF= 1.81 sumR=+400.2 exp=+0.51R pnl=$9718248
  blocks: exposure=1050 maxOpen=325 killSwitch=312 ddRolling7d=281 cooldown=275 ddDaily=115 weeklyTrend=88 groupCap=85

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1248 WR= 44% PF= 1.91 sumR=+701.5 exp=+0.56R pnl=$42886363  → balance $42886863 maxDD 35.8%
  2026: T= 853 WR= 44% PF= 1.92 sumR=+479.4 exp=+0.56R pnl=$42870586
  blocks: exposure=1141 cooldown=329 ddRolling7d=264 killSwitch=203 maxOpen=161 groupCap=128 ddDaily=116 weeklyTrend=96

## CAP maxOpen=12
  ALL:  T=1235 WR= 44% PF= 1.89 sumR=+682.9 exp=+0.55R pnl=$21228071  → balance $21228571 maxDD 35.6%
  2026: T= 843 WR= 44% PF= 1.88 sumR=+461.8 exp=+0.55R pnl=$21212906
  blocks: exposure=1198 cooldown=304 ddRolling7d=272 killSwitch=236 groupCap=167 ddDaily=119 weeklyTrend=93 maxOpen=62

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1076 WR= 42% PF= 1.80 sumR=+539.4 exp=+0.50R pnl=$2464084  → balance $2464584 maxDD 38.9%
  2026: T= 705 WR= 43% PF= 1.78 sumR=+346.8 exp=+0.49R pnl=$2453218
  blocks: exposure=1040 groupCap=353 killSwitch=338 ddRolling7d=324 cooldown=279 ddDaily=112 weeklyTrend=89 maxOpen=75

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1235 WR= 44% PF= 1.89 sumR=+682.9 exp=+0.55R pnl=$21228071  → balance $21228571 maxDD 35.6%
  2026: T= 843 WR= 44% PF= 1.88 sumR=+461.8 exp=+0.55R pnl=$21212906
  blocks: exposure=1198 cooldown=304 ddRolling7d=272 killSwitch=236 groupCap=167 ddDaily=119 weeklyTrend=93 maxOpen=62

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1278 WR= 44% PF= 1.93 sumR=+733.2 exp=+0.57R pnl=$62903469  → balance $62903969 maxDD 34.6%
  2026: T= 858 WR= 44% PF= 1.92 sumR=+485.4 exp=+0.57R pnl=$62881012
  blocks: exposure=1178 cooldown=353 ddRolling7d=237 maxOpen=172 ddDaily=163 killSwitch=107 groupCap=105 weeklyTrend=93

## EXIT tp1Close=50%
  ALL:  T=1211 WR= 43% PF= 1.87 sumR=+654.6 exp=+0.54R pnl=$15789071  → balance $15789571 maxDD 35.9%
  2026: T= 823 WR= 44% PF= 1.84 sumR=+432.1 exp=+0.53R pnl=$15773374
  blocks: exposure=1167 cooldown=309 ddRolling7d=300 killSwitch=216 maxOpen=137 groupCap=132 ddDaily=119 weeklyTrend=95

## EXIT tp1Close=75%
  ALL:  T=1257 WR= 44% PF= 1.91 sumR=+707.2 exp=+0.56R pnl=$50393573  → balance $50394073 maxDD 35.8%
  2026: T= 866 WR= 44% PF= 1.91 sumR=+485.9 exp=+0.56R pnl=$50378053
  blocks: exposure=1200 cooldown=321 ddRolling7d=216 killSwitch=205 maxOpen=150 groupCap=129 ddDaily=115 weeklyTrend=93

## EXIT trail 1.5%
  ALL:  T=1262 WR= 44% PF= 1.92 sumR=+710.5 exp=+0.56R pnl=$54678315  → balance $54678815 maxDD 36.6%
  2026: T= 872 WR= 44% PF= 1.89 sumR=+480.3 exp=+0.55R pnl=$54660195
  blocks: exposure=1201 cooldown=318 killSwitch=215 ddRolling7d=210 maxOpen=150 groupCap=131 ddDaily=106 weeklyTrend=93

## EXIT trail 3%
  ALL:  T=1203 WR= 44% PF= 1.88 sumR=+651.5 exp=+0.54R pnl=$15552583  → balance $15553083 maxDD 28.8%
  2026: T= 813 WR= 43% PF= 1.83 sumR=+421.5 exp=+0.52R pnl=$15536306
  blocks: exposure=1177 cooldown=315 ddRolling7d=286 killSwitch=202 maxOpen=167 groupCap=124 ddDaily=116 weeklyTrend=96

## EXIT trail r_multiple 2R
  ALL:  T=1239 WR= 45% PF= 1.93 sumR=+703.1 exp=+0.57R pnl=$41398439  → balance $41398939 maxDD 31.2%
  2026: T= 840 WR= 45% PF= 1.91 sumR=+466.1 exp=+0.55R pnl=$41380043
  blocks: exposure=1215 cooldown=337 ddRolling7d=235 maxOpen=177 killSwitch=159 groupCap=122 ddDaily=109 weeklyTrend=93

## TILT LONG:up 0.75x
  ALL:  T=1244 WR= 44% PF= 1.91 sumR=+695.6 exp=+0.56R pnl=$30991927  → balance $30992427 maxDD 33.8%
  2026: T= 844 WR= 44% PF= 1.88 sumR=+459.8 exp=+0.54R pnl=$30975302
  blocks: exposure=1212 cooldown=337 ddRolling7d=231 maxOpen=177 killSwitch=166 groupCap=123 ddDaily=103 weeklyTrend=93

## TILT LONG:up 0.5x
  ALL:  T=1247 WR= 44% PF= 1.91 sumR=+692.4 exp=+0.56R pnl=$24834913  → balance $24835413 maxDD 32.1%
  2026: T= 847 WR= 44% PF= 1.87 sumR=+456.5 exp=+0.54R pnl=$24819662
  blocks: exposure=1216 cooldown=337 ddRolling7d=222 maxOpen=177 killSwitch=171 groupCap=123 ddDaily=100 weeklyTrend=93

## TILT LONG:up blocked
  ALL:  T=1062 WR= 44% PF= 1.89 sumR=+579.5 exp=+0.55R pnl=$2611358  → balance $2611858 maxDD 64.9%
  2026: T= 690 WR= 43% PF= 1.82 sumR=+356.1 exp=+0.52R pnl=$2598562
  blocks: exposure=1059 ddRolling7d=429 cooldown=304 killSwitch=204 sizeTilt=190 maxOpen=130 ddDaily=110 groupCap=107 weeklyTrend=91

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1112 WR= 43% PF= 1.78 sumR=+548.7 exp=+0.49R pnl=$4057350  → balance $4057850 maxDD 60.7%
  2026: T= 712 WR= 42% PF= 1.68 sumR=+312.8 exp=+0.44R pnl=$4038000
  blocks: exposure=1104 killSwitch=349 ddRolling7d=318 cooldown=312 maxOpen=173 ddDaily=118 groupCap=107 weeklyTrend=93

## SAMEDIR max 4
  ALL:  T=1071 WR= 44% PF= 1.91 sumR=+602.9 exp=+0.56R pnl=$9998624  → balance $9999124 maxDD 29.5%
  2026: T= 720 WR= 45% PF= 1.94 sumR=+414.9 exp=+0.58R pnl=$9988489
  blocks: exposure=1060 sameDir=815 cooldown=326 killSwitch=121 weeklyTrend=92 ddRolling7d=85 groupCap=83 ddDaily=33

## SAMEDIR max 5
  ALL:  T=1137 WR= 44% PF= 1.90 sumR=+628.7 exp=+0.55R pnl=$17881370  → balance $17881870 maxDD 30.8%
  2026: T= 786 WR= 45% PF= 1.92 sumR=+442.6 exp=+0.56R pnl=$17871749
  blocks: exposure=1128 sameDir=553 cooldown=341 killSwitch=176 groupCap=105 weeklyTrend=95 ddRolling7d=74 ddDaily=63 maxOpen=14

## SAMEDIR max 6
  ALL:  T=1189 WR= 44% PF= 1.90 sumR=+654.7 exp=+0.55R pnl=$26668292  → balance $26668792 maxDD 26.0%
  2026: T= 841 WR= 45% PF= 1.89 sumR=+459.8 exp=+0.55R pnl=$26657360
  blocks: exposure=1169 cooldown=342 sameDir=333 killSwitch=165 ddRolling7d=128 groupCap=116 weeklyTrend=98 ddDaily=92 maxOpen=54

## SAMEDIR max 7
  ALL:  T=1167 WR= 44% PF= 1.88 sumR=+629.5 exp=+0.54R pnl=$14723071  → balance $14723571 maxDD 31.2%
  2026: T= 812 WR= 44% PF= 1.86 sumR=+431.1 exp=+0.53R pnl=$14712084
  blocks: exposure=1175 cooldown=342 killSwitch=224 sameDir=218 ddRolling7d=174 groupCap=124 ddDaily=108 weeklyTrend=93 maxOpen=61

## VENUE Kraken (−LUNC)
  ALL:  T=1227 WR= 44% PF= 1.90 sumR=+676.3 exp=+0.55R pnl=$28546034  → balance $28546534 maxDD 30.9%
  2026: T= 831 WR= 44% PF= 1.87 sumR=+447.5 exp=+0.54R pnl=$28529402
  blocks: exposure=1192 cooldown=336 ddRolling7d=247 maxOpen=168 killSwitch=141 groupCap=121 ddDaily=106 weeklyTrend=93

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T=1129 WR= 44% PF= 1.87 sumR=+608.4 exp=+0.54R pnl=$11202204  → balance $11202704 maxDD 31.7%
  2026: T= 751 WR= 43% PF= 1.80 sumR=+377.5 exp=+0.50R pnl=$11183707
  blocks: exposure=1131 cooldown=325 killSwitch=223 ddRolling7d=199 groupCap=127 maxOpen=123 weeklyTrend=92 ddDaily=87

## BASELINE (all gates)
  ALL:  T= 408 WR= 41% PF= 1.70 sumR=+186.1 exp=+0.46R pnl=$76676  → balance $77176 maxDD 38.3%
  2026: T= 234 WR= 41% PF= 1.63 sumR=+97.0 exp=+0.41R pnl=$71987
  blocks: maxOpen=770 atrPct=571 exposure=454 ddRolling7d=420 dirOverlay=268 shortConf=208 killSwitch=174 cooldown=161 ddDaily=90 dailyTrend=88 weeklyTrend=71 groupCap=3

## minus dirOverlay
  ALL:  T= 433 WR= 40% PF= 1.66 sumR=+187.7 exp=+0.43R pnl=$93111  → balance $93611 maxDD 47.9%
  2026: T= 243 WR= 40% PF= 1.59 sumR=+96.5 exp=+0.40R pnl=$87832
  blocks: maxOpen=819 ddRolling7d=520 exposure=494 atrPct=491 shortConf=190 cooldown=184 killSwitch=181 dailyTrend=152 ddDaily=142 weeklyTrend=75 ddMonthly=5

## minus dailyTrend
  ALL:  T= 415 WR= 40% PF= 1.68 sumR=+183.7 exp=+0.44R pnl=$62398  → balance $62898 maxDD 38.3%
  2026: T= 234 WR= 41% PF= 1.68 sumR=+103.7 exp=+0.44R pnl=$59805
  blocks: maxOpen=792 atrPct=559 exposure=466 ddRolling7d=417 dirOverlay=257 shortConf=235 cooldown=146 killSwitch=141 ddMonthly=92 ddDaily=91 weeklyTrend=73 groupCap=2

## minus weeklyTrend
  ALL:  T= 438 WR= 42% PF= 1.79 sumR=+216.5 exp=+0.49R pnl=$246183  → balance $246683 maxDD 38.3%
  2026: T= 235 WR= 41% PF= 1.63 sumR=+96.4 exp=+0.41R pnl=$232240
  blocks: maxOpen=785 atrPct=571 exposure=500 ddRolling7d=367 dirOverlay=266 shortConf=206 cooldown=158 killSwitch=152 dailyTrend=96 ddDaily=84 ddMonthly=60 groupCap=3

## minus shortConf
  ALL:  T= 335 WR= 41% PF= 1.73 sumR=+157.2 exp=+0.47R pnl=$26654  → balance $27154 maxDD 43.3%
  2026: T= 150 WR= 39% PF= 1.55 sumR=+55.9 exp=+0.37R pnl=$19814
  blocks: ddMonthly=1144 maxOpen=664 exposure=368 atrPct=329 ddRolling7d=325 dirOverlay=147 cooldown=115 ddDaily=113 weeklyTrend=68 dailyTrend=65 killSwitch=11 groupCap=2

## minus atrPct
  ALL:  T= 402 WR= 42% PF= 1.80 sumR=+202.9 exp=+0.50R pnl=$100314  → balance $100814 maxDD 31.0%
  2026: T= 188 WR= 39% PF= 1.51 sumR=+64.2 exp=+0.34R pnl=$80326
  blocks: maxOpen=957 ddMonthly=660 exposure=469 dirOverlay=308 ddRolling7d=242 shortConf=228 cooldown=153 dailyTrend=87 weeklyTrend=78 ddDaily=73 killSwitch=27 groupCap=2

## minus btcCap
  ALL:  T= 425 WR= 40% PF= 1.67 sumR=+187.0 exp=+0.44R pnl=$45630  → balance $46130 maxDD 39.5%
  2026: T= 231 WR= 40% PF= 1.58 sumR=+89.5 exp=+0.39R pnl=$40263
  blocks: ddMonthly=814 atrPct=539 exposure=508 ddRolling7d=297 shortConf=269 dirOverlay=229 cooldown=167 ddDaily=107 killSwitch=105 dailyTrend=101 weeklyTrend=70 groupCap=55

## minus groupCap
  ALL:  T= 409 WR= 41% PF= 1.70 sumR=+184.9 exp=+0.45R pnl=$73689  → balance $74189 maxDD 38.3%
  2026: T= 235 WR= 40% PF= 1.61 sumR=+95.8 exp=+0.41R pnl=$69000
  blocks: maxOpen=770 atrPct=571 exposure=454 ddRolling7d=420 dirOverlay=268 shortConf=208 killSwitch=174 cooldown=161 dailyTrend=90 ddDaily=90 weeklyTrend=71

## minus killSwitch
  ALL:  T= 414 WR= 40% PF= 1.64 sumR=+174.8 exp=+0.42R pnl=$59722  → balance $60222 maxDD 33.5%
  2026: T= 238 WR= 39% PF= 1.52 sumR=+83.9 exp=+0.35R pnl=$54793
  blocks: maxOpen=784 atrPct=558 exposure=447 ddRolling7d=444 dirOverlay=264 shortConf=215 cooldown=162 ddMonthly=155 dailyTrend=94 ddDaily=77 weeklyTrend=69 groupCap=3

## minus ddDaily
  ALL:  T= 423 WR= 40% PF= 1.68 sumR=+187.2 exp=+0.44R pnl=$75351  → balance $75851 maxDD 36.1%
  2026: T= 244 WR= 40% PF= 1.58 sumR=+95.6 exp=+0.39R pnl=$70404
  blocks: maxOpen=786 atrPct=600 exposure=472 ddRolling7d=445 dirOverlay=280 shortConf=212 cooldown=162 killSwitch=142 dailyTrend=92 weeklyTrend=69 groupCap=3

## minus ddMonthly
  ALL:  T= 408 WR= 41% PF= 1.70 sumR=+186.1 exp=+0.46R pnl=$76676  → balance $77176 maxDD 38.3%
  2026: T= 234 WR= 41% PF= 1.63 sumR=+97.0 exp=+0.41R pnl=$71987
  blocks: maxOpen=770 atrPct=571 exposure=454 ddRolling7d=420 dirOverlay=268 shortConf=208 killSwitch=174 cooldown=161 ddDaily=90 dailyTrend=88 weeklyTrend=71 groupCap=3

## minus ddRolling
  ALL:  T= 386 WR= 40% PF= 1.65 sumR=+165.7 exp=+0.43R pnl=$49142  → balance $49642 maxDD 43.9%
  2026: T= 206 WR= 39% PF= 1.52 sumR=+72.6 exp=+0.35R pnl=$43812
  blocks: maxOpen=673 atrPct=522 ddMonthly=434 exposure=422 killSwitch=323 dirOverlay=271 shortConf=214 cooldown=167 dailyTrend=98 ddDaily=97 weeklyTrend=76 groupCap=3

## minus kelly
  ALL:  T= 448 WR= 40% PF= 1.69 sumR=+200.8 exp=+0.45R pnl=$12220  → balance $12720 maxDD 21.2%
  2026: T= 265 WR= 40% PF= 1.60 sumR=+105.7 exp=+0.40R pnl=$10407
  blocks: maxOpen=816 atrPct=657 exposure=497 killSwitch=300 dirOverlay=292 shortConf=228 cooldown=188 dailyTrend=107 weeklyTrend=76 ddRolling7d=64 ddDaily=10 groupCap=3

## minus riskMult
  ALL:  T= 354 WR= 39% PF= 1.63 sumR=+148.7 exp=+0.42R pnl=$34353  → balance $34853 maxDD 37.2%
  2026: T= 185 WR= 38% PF= 1.50 sumR=+64.0 exp=+0.35R pnl=$29433
  blocks: maxOpen=559 ddMonthly=466 atrPct=450 ddRolling7d=411 exposure=402 dirOverlay=260 ddDaily=209 shortConf=183 cooldown=136 dailyTrend=92 killSwitch=90 weeklyTrend=71 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1553 WR= 44% PF= 1.92 sumR=+879.0 exp=+0.57R pnl=$803777026  → balance $803777526 maxDD 43.8%
  2026: T=1013 WR= 44% PF= 1.90 sumR=+562.8 exp=+0.56R pnl=$803712406
  blocks: exposure=1480 cooldown=388 maxOpen=265

## LS-only BASELINE
  ALL:  T= 311 WR= 42% PF= 1.80 sumR=+158.7 exp=+0.51R pnl=$48057  → balance $48557 maxDD 33.3%
  2026: T= 207 WR= 43% PF= 1.83 sumR=+108.6 exp=+0.52R pnl=$46697
  blocks: maxOpen=542 atrPct=487 ddRolling7d=370 ddMonthly=360 exposure=235 dirOverlay=228 shortConf=208 dailyTrend=72 cooldown=66 ddDaily=64 killSwitch=18 groupCap=2

## LS-only LEAN
  ALL:  T=1401 WR= 44% PF= 1.95 sumR=+814.3 exp=+0.58R pnl=$287096439  → balance $287096939 maxDD 46.4%
  2026: T= 973 WR= 44% PF= 1.92 sumR=+554.7 exp=+0.57R pnl=$287071135
  blocks: exposure=1075 cooldown=273 maxOpen=214

## LS+RSI LEAN
  ALL:  T=1440 WR= 44% PF= 1.93 sumR=+821.8 exp=+0.57R pnl=$305328312  → balance $305328812 maxDD 42.6%
  2026: T=1000 WR= 44% PF= 1.91 sumR=+561.2 exp=+0.56R pnl=$305303528
  blocks: exposure=1245 cooldown=386 maxOpen=251

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1157 WR= 43% PF= 1.80 sumR=+578.9 exp=+0.50R pnl=$1554376418  → balance $1554376918 maxDD 60.5%
  2026: T= 787 WR= 44% PF= 1.83 sumR=+405.7 exp=+0.52R pnl=$1554349424
  blocks: exposure=1135 killSwitch=521 cooldown=321 ddDaily=289 maxOpen=170 weeklyTrend=93

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1085 WR= 44% PF= 1.87 sumR=+586.9 exp=+0.54R pnl=$2195520459  → balance $2195520959 maxDD 62.0%
  2026: T= 788 WR= 45% PF= 1.92 sumR=+442.0 exp=+0.56R pnl=$2195506414
  blocks: exposure=971 killSwitch=495 cooldown=326 ddDaily=284 maxOpen=161

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1102 WR= 42% PF= 1.78 sumR=+538.5 exp=+0.49R pnl=$765769174  → balance $765769674 maxDD 60.5%
  2026: T= 741 WR= 43% PF= 1.80 sumR=+370.3 exp=+0.50R pnl=$765740424
  blocks: exposure=1085 killSwitch=577 cooldown=309 ddDaily=301 maxOpen=132 weeklyTrend=93 groupCap=87

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1094 WR= 44% PF= 1.90 sumR=+604.0 exp=+0.55R pnl=$1430117329  → balance $1430117829 maxDD 66.9%
  2026: T= 787 WR= 46% PF= 2.01 sumR=+477.2 exp=+0.61R pnl=$1430115614
  blocks: exposure=1031 ddRolling7d=740 cooldown=273 ddDaily=199 maxOpen=169 killSwitch=96 weeklyTrend=84

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1083 WR= 43% PF= 1.86 sumR=+578.5 exp=+0.53R pnl=$3557780656  → balance $3557781156 maxDD 63.6%
  2026: T= 733 WR= 45% PF= 1.90 sumR=+404.0 exp=+0.55R pnl=$3557746580
  blocks: exposure=1042 ddRolling7d=580 cooldown=293 ddDaily=234 maxOpen=154 killSwitch=132 weeklyTrend=87 groupCap=81

## PROPOSED-F (= E without kelly)
  ALL:  T=1250 WR= 44% PF= 1.92 sumR=+702.8 exp=+0.56R pnl=$46341311  → balance $46341811 maxDD 35.8%
  2026: T= 862 WR= 44% PF= 1.91 sumR=+480.8 exp=+0.56R pnl=$46325691
  blocks: exposure=1198 cooldown=316 killSwitch=217 ddRolling7d=216 maxOpen=150 groupCap=127 ddDaily=119 weeklyTrend=93

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T= 143 WR= 37% PF= 1.30 sumR=+30.1 exp=+0.21R pnl=$-834502
  LONG  · BTC daily neutral T=  93 WR= 32% PF= 1.16 sumR=+10.6 exp=+0.11R pnl=$391005
  LONG  · BTC daily down    T= 177 WR= 42% PF= 1.87 sumR=+96.8 exp=+0.55R pnl=$2757561
  SHORT · BTC daily up      T= 223 WR= 61% PF= 3.78 sumR=+269.4 exp=+1.21R pnl=$30833478
  SHORT · BTC daily neutral T= 136 WR= 40% PF= 1.52 sumR=+46.7 exp=+0.34R pnl=$2926466
  SHORT · BTC daily down    T= 467 WR= 44% PF= 1.87 sumR=+249.5 exp=+0.53R pnl=$5324431
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  71 WR= 34% PF= 1.31 sumR=+15.8 exp=+0.22R pnl=$-225158
  LONG  · BTC weekly neutral T=  44 WR= 41% PF= 1.68 sumR=+19.4 exp=+0.44R pnl=$224321
  LONG  · BTC weekly down    T= 298 WR= 39% PF= 1.51 sumR=+102.3 exp=+0.34R pnl=$2314901
  SHORT · BTC weekly up      T= 149 WR= 48% PF= 2.32 sumR=+110.8 exp=+0.74R pnl=$513245
  SHORT · BTC weekly neutral T=  84 WR= 56% PF= 3.17 sumR=+88.5 exp=+1.05R pnl=$4260748
  SHORT · BTC weekly down    T= 593 WR= 47% PF= 2.05 sumR=+366.4 exp=+0.62R pnl=$34310382

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  95 WR= 40% PF= 1.66 sumR=+39.1 exp=+0.41R pnl=$2075389
                     2026: T=  20 WR= 40% PF= 1.49 sumR=+6.1 exp=+0.31R pnl=$2075150
  rsi-divergence     ALL:  T=  50 WR= 44% PF= 1.83 sumR=+24.8 exp=+0.50R pnl=$-941626
                     2026: T=  34 WR= 44% PF= 1.54 sumR=+10.9 exp=+0.32R pnl=$-942844
  liquidity-sweep    ALL:  T=1094 WR= 45% PF= 1.96 sumR=+639.2 exp=+0.58R pnl=$40264676
                     2026: T= 786 WR= 45% PF= 1.93 sumR=+449.0 exp=+0.57R pnl=$40247737

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  75 WR= 47% PF= 2.18 sumR=+48.9 exp=+0.65R pnl=$9796
                     2026: T=  13 WR= 54% PF= 2.56 sumR=+9.9 exp=+0.76R pnl=$8851
  rsi-divergence     ALL:  T=  29 WR= 34% PF= 1.37 sumR=+7.4 exp=+0.26R pnl=$-5870
                     2026: T=  17 WR= 41% PF= 1.38 sumR=+4.2 exp=+0.24R pnl=$-5820
  liquidity-sweep    ALL:  T= 304 WR= 40% PF= 1.64 sumR=+129.8 exp=+0.43R pnl=$72750
                     2026: T= 204 WR= 40% PF= 1.60 sumR=+83.0 exp=+0.41R pnl=$68957

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 135 WR= 44% PF= 2.01 sumR=+78.3 exp=+0.58R pnl=$60438396
                     2026: T=  26 WR= 38% PF= 1.40 sumR=+6.7 exp=+0.26R pnl=$60435715
  rsi-divergence     ALL:  T=  60 WR= 43% PF= 1.76 sumR=+27.2 exp=+0.45R pnl=$-30726375
                     2026: T=  38 WR= 45% PF= 1.57 sumR=+12.9 exp=+0.34R pnl=$-30731325
  liquidity-sweep    ALL:  T=1358 WR= 44% PF= 1.92 sumR=+773.5 exp=+0.57R pnl=$774065005
                     2026: T= 949 WR= 44% PF= 1.93 sumR=+543.2 exp=+0.57R pnl=$774008016

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.73 sumR=+43.3 exp=+0.45R pnl=$111719373
                     2026: T=  20 WR= 40% PF= 1.59 sumR=+7.3 exp=+0.37R pnl=$111718541
  rsi-divergence     ALL:  T=  58 WR= 43% PF= 1.73 sumR=+25.5 exp=+0.44R pnl=$-22972543
                     2026: T=  34 WR= 47% PF= 1.73 sumR=+14.1 exp=+0.42R pnl=$-22975170
  liquidity-sweep    ALL:  T=1003 WR= 43% PF= 1.81 sumR=+510.1 exp=+0.51R pnl=$1465629588
                     2026: T= 733 WR= 44% PF= 1.84 sumR=+384.2 exp=+0.52R pnl=$1465606053

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  59 WR= 44% PF= 1.80 sumR=+27.7 exp=+0.47R pnl=$-32451851
                     2026: T=  35 WR= 49% PF= 1.85 sumR=+16.4 exp=+0.47R pnl=$-32452952
  liquidity-sweep    ALL:  T=1026 WR= 43% PF= 1.88 sumR=+559.2 exp=+0.55R pnl=$2227972310
                     2026: T= 753 WR= 44% PF= 1.92 sumR=+425.6 exp=+0.57R pnl=$2227959366

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.73 sumR=+43.3 exp=+0.45R pnl=$53959221
                     2026: T=  20 WR= 40% PF= 1.59 sumR=+7.3 exp=+0.37R pnl=$53958342
  rsi-divergence     ALL:  T=  56 WR= 41% PF= 1.63 sumR=+21.7 exp=+0.39R pnl=$-9255943
                     2026: T=  33 WR= 45% PF= 1.66 sumR=+12.8 exp=+0.39R pnl=$-9258501
  liquidity-sweep    ALL:  T= 950 WR= 43% PF= 1.79 sumR=+473.5 exp=+0.50R pnl=$721065896
                     2026: T= 688 WR= 43% PF= 1.81 sumR=+350.2 exp=+0.51R pnl=$721040584

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.88 sumR=+47.3 exp=+0.53R pnl=$102505456
                     2026: T=  16 WR= 44% PF= 1.99 sumR=+9.2 exp=+0.58R pnl=$102504614
  rsi-divergence     ALL:  T=  41 WR= 41% PF= 1.58 sumR=+14.6 exp=+0.36R pnl=$-22101820
                     2026: T=  28 WR= 43% PF= 1.58 sumR=+10.2 exp=+0.36R pnl=$-22101831
  liquidity-sweep    ALL:  T= 963 WR= 44% PF= 1.92 sumR=+542.1 exp=+0.56R pnl=$1349713693
                     2026: T= 743 WR= 46% PF= 2.03 sumR=+457.8 exp=+0.62R pnl=$1349712830

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.88 sumR=+47.3 exp=+0.53R pnl=$250003070
                     2026: T=  16 WR= 44% PF= 1.99 sumR=+9.2 exp=+0.58R pnl=$250000052
  rsi-divergence     ALL:  T=  45 WR= 40% PF= 1.69 sumR=+19.4 exp=+0.43R pnl=$-41642866
                     2026: T=  28 WR= 43% PF= 1.58 sumR=+10.1 exp=+0.36R pnl=$-41644142
  liquidity-sweep    ALL:  T= 948 WR= 44% PF= 1.87 sumR=+511.8 exp=+0.54R pnl=$3349420452
                     2026: T= 689 WR= 45% PF= 1.91 sumR=+384.7 exp=+0.56R pnl=$3349390670

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.72 sumR=+42.7 exp=+0.44R pnl=$2378143
                     2026: T=  20 WR= 40% PF= 1.54 sumR=+6.8 exp=+0.34R pnl=$2377819
  rsi-divergence     ALL:  T=  50 WR= 44% PF= 1.82 sumR=+24.7 exp=+0.49R pnl=$-985498
                     2026: T=  34 WR= 44% PF= 1.57 sumR=+11.7 exp=+0.34R pnl=$-986897
  liquidity-sweep    ALL:  T=1104 WR= 44% PF= 1.94 sumR=+635.4 exp=+0.58R pnl=$44948666
                     2026: T= 808 WR= 45% PF= 1.93 sumR=+462.4 exp=+0.57R pnl=$44934770

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
  2025-09  +$246.86
  2025-10  +$2623.00
  2025-11  +$9750.82
  2025-12  +$6146.78
  2026-01  +$132051.17
  2026-02  +$50116.01
  2026-03  +$222750.53
  2026-04  +$588418.08
  2026-05  +$2985055.15
  2026-06  +$6008560.18
  2026-07  +$17468861.07
  2026-08  +$13923553.69