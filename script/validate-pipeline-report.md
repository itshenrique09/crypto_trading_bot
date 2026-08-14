# Full-Pipeline Portfolio Validation — 2026-08-14
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 5594

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1479 WR= 43% PF= 1.80 sumR=+766.6 exp=+0.52R pnl=$33124527  → balance $33125027 maxDD 66.6%
  2026: T= 974 WR= 45% PF= 1.88 sumR=+544.3 exp=+0.56R pnl=$33115686
  blocks: exposure=1611 ddRolling7d=765 cooldown=459 maxOpen=399 killSwitch=319 ddDaily=298 groupCap=182 weeklyTrend=82

## CAP maxOpen=8
  ALL:  T=1417 WR= 44% PF= 1.87 sumR=+780.2 exp=+0.55R pnl=$52818525  → balance $52819025 maxDD 42.7%
  2026: T= 930 WR= 45% PF= 1.92 sumR=+537.5 exp=+0.58R pnl=$52804727
  blocks: exposure=1542 maxOpen=809 ddRolling7d=609 cooldown=417 killSwitch=320 ddDaily=274 groupCap=122 weeklyTrend=84

## CAP maxOpen=10
  ALL:  T=1522 WR= 43% PF= 1.80 sumR=+786.9 exp=+0.52R pnl=$45030571  → balance $45031071 maxDD 63.0%
  2026: T= 996 WR= 44% PF= 1.83 sumR=+531.5 exp=+0.53R pnl=$45015938
  blocks: exposure=1594 ddRolling7d=754 cooldown=444 maxOpen=423 ddDaily=321 killSwitch=255 groupCap=195 weeklyTrend=86

## CAP perSymbol=2
  ALL:  T=1520 WR= 43% PF= 1.81 sumR=+791.6 exp=+0.52R pnl=$46468284  → balance $46468784 maxDD 63.0%
  2026: T= 999 WR= 44% PF= 1.82 sumR=+530.6 exp=+0.53R pnl=$46452335
  blocks: exposure=1494 ddRolling7d=770 cooldown=472 maxOpen=456 ddDaily=330 killSwitch=252 groupCap=212 weeklyTrend=88

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1339 WR= 44% PF= 1.83 sumR=+710.4 exp=+0.53R pnl=$12463172  → balance $12463672 maxDD 63.8%
  2026: T= 855 WR= 44% PF= 1.85 sumR=+466.2 exp=+0.55R pnl=$12448997
  blocks: exposure=1372 maxOpen=800 ddRolling7d=749 cooldown=428 killSwitch=414 ddDaily=280 groupCap=124 weeklyTrend=88

## CAP LS cooldown 8h
  ALL:  T=1523 WR= 43% PF= 1.81 sumR=+796.4 exp=+0.52R pnl=$52742523  → balance $52743023 maxDD 63.0%
  2026: T=1005 WR= 44% PF= 1.86 sumR=+552.4 exp=+0.55R pnl=$52729919
  blocks: exposure=1585 ddRolling7d=889 maxOpen=402 cooldown=387 ddDaily=318 killSwitch=214 groupCap=190 weeklyTrend=86

## CAP LS cooldown 6h
  ALL:  T=1522 WR= 43% PF= 1.79 sumR=+781.4 exp=+0.51R pnl=$40478566  → balance $40479066 maxDD 63.0%
  2026: T=1006 WR= 44% PF= 1.83 sumR=+537.0 exp=+0.53R pnl=$40465338
  blocks: exposure=1601 ddRolling7d=888 maxOpen=402 cooldown=334 ddDaily=325 killSwitch=242 groupCap=194 weeklyTrend=86

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1331 WR= 43% PF= 1.78 sumR=+671.8 exp=+0.50R pnl=$8046926  → balance $8047426 maxDD 63.8%
  2026: T= 849 WR= 44% PF= 1.82 sumR=+449.3 exp=+0.53R pnl=$8035710
  blocks: exposure=1369 maxOpen=845 ddRolling7d=809 killSwitch=400 cooldown=349 ddDaily=294 groupCap=109 weeklyTrend=88

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1520 WR= 43% PF= 1.81 sumR=+791.6 exp=+0.52R pnl=$46468284  → balance $46468784 maxDD 63.0%
  2026: T= 999 WR= 44% PF= 1.82 sumR=+530.6 exp=+0.53R pnl=$46452335
  blocks: exposure=1494 ddRolling7d=770 cooldown=472 maxOpen=456 ddDaily=330 killSwitch=252 groupCap=212 weeklyTrend=88

## CAP maxOpen=12
  ALL:  T=1488 WR= 43% PF= 1.76 sumR=+737.6 exp=+0.50R pnl=$13587134  → balance $13587634 maxDD 70.1%
  2026: T= 959 WR= 43% PF= 1.74 sumR=+467.9 exp=+0.49R pnl=$13569693
  blocks: exposure=1564 ddRolling7d=970 cooldown=466 ddDaily=314 killSwitch=277 groupCap=267 maxOpen=164 weeklyTrend=84

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1432 WR= 43% PF= 1.80 sumR=+740.7 exp=+0.52R pnl=$22887191  → balance $22887691 maxDD 50.1%
  2026: T= 943 WR= 44% PF= 1.81 sumR=+495.8 exp=+0.53R pnl=$22871166
  blocks: exposure=1546 groupCap=675 ddRolling7d=569 cooldown=452 ddDaily=313 killSwitch=299 maxOpen=226 weeklyTrend=82

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1488 WR= 43% PF= 1.76 sumR=+737.6 exp=+0.50R pnl=$13587134  → balance $13587634 maxDD 70.1%
  2026: T= 959 WR= 43% PF= 1.74 sumR=+467.9 exp=+0.49R pnl=$13569693
  blocks: exposure=1564 ddRolling7d=970 cooldown=466 ddDaily=314 killSwitch=277 groupCap=267 maxOpen=164 weeklyTrend=84

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1617 WR= 43% PF= 1.83 sumR=+864.7 exp=+0.53R pnl=$274673543  → balance $274674043 maxDD 45.5%
  2026: T=1097 WR= 44% PF= 1.83 sumR=+591.2 exp=+0.54R pnl=$274648922
  blocks: exposure=1616 ddRolling7d=719 cooldown=477 maxOpen=367 ddDaily=289 killSwitch=217 groupCap=205 weeklyTrend=87

## EXIT tp1Close=50%
  ALL:  T=1508 WR= 42% PF= 1.73 sumR=+727.3 exp=+0.48R pnl=$15933350  → balance $15933850 maxDD 53.9%
  2026: T= 987 WR= 43% PF= 1.75 sumR=+487.0 exp=+0.49R pnl=$15921960
  blocks: exposure=1603 ddRolling7d=788 cooldown=439 maxOpen=363 ddDaily=321 killSwitch=295 groupCap=190 weeklyTrend=87

## EXIT tp1Close=75%
  ALL:  T=1536 WR= 43% PF= 1.79 sumR=+786.6 exp=+0.51R pnl=$52035528  → balance $52036028 maxDD 52.6%
  2026: T=1015 WR= 44% PF= 1.83 sumR=+546.1 exp=+0.54R pnl=$52023466
  blocks: exposure=1583 ddRolling7d=774 cooldown=453 ddDaily=369 maxOpen=344 killSwitch=265 groupCap=186 weeklyTrend=84

## EXIT trail 1.5%
  ALL:  T=1470 WR= 42% PF= 1.73 sumR=+713.1 exp=+0.49R pnl=$12188922  → balance $12189422 maxDD 63.6%
  2026: T= 949 WR= 42% PF= 1.71 sumR=+452.7 exp=+0.48R pnl=$12170272
  blocks: exposure=1542 ddRolling7d=856 cooldown=433 ddDaily=352 maxOpen=349 killSwitch=318 groupCap=188 weeklyTrend=86

## EXIT trail 3%
  ALL:  T=1575 WR= 44% PF= 1.83 sumR=+836.5 exp=+0.53R pnl=$127979190  → balance $127979690 maxDD 50.1%
  2026: T=1056 WR= 45% PF= 1.90 sumR=+600.6 exp=+0.57R pnl=$127968129
  blocks: exposure=1707 ddRolling7d=568 cooldown=491 maxOpen=441 ddDaily=300 killSwitch=218 groupCap=209 weeklyTrend=85

## EXIT trail r_multiple 2R
  ALL:  T=1479 WR= 43% PF= 1.80 sumR=+766.6 exp=+0.52R pnl=$33124527  → balance $33125027 maxDD 66.6%
  2026: T= 974 WR= 45% PF= 1.88 sumR=+544.3 exp=+0.56R pnl=$33115686
  blocks: exposure=1611 ddRolling7d=765 cooldown=459 maxOpen=399 killSwitch=319 ddDaily=298 groupCap=182 weeklyTrend=82

## TILT LONG:up 0.75x
  ALL:  T=1500 WR= 44% PF= 1.84 sumR=+803.2 exp=+0.54R pnl=$69668345  → balance $69668845 maxDD 59.3%
  2026: T= 995 WR= 45% PF= 1.90 sumR=+568.5 exp=+0.57R pnl=$69656963
  blocks: exposure=1622 ddRolling7d=735 cooldown=459 maxOpen=417 killSwitch=332 ddDaily=244 groupCap=199 weeklyTrend=86

## TILT LONG:up 0.5x
  ALL:  T=1485 WR= 43% PF= 1.80 sumR=+772.3 exp=+0.52R pnl=$46771315  → balance $46771815 maxDD 67.0%
  2026: T= 980 WR= 44% PF= 1.85 sumR=+535.0 exp=+0.55R pnl=$46760060
  blocks: exposure=1630 ddRolling7d=741 cooldown=458 maxOpen=399 killSwitch=344 ddDaily=266 groupCap=190 weeklyTrend=81

## TILT LONG:up blocked
  ALL:  T=1399 WR= 45% PF= 1.90 sumR=+797.4 exp=+0.57R pnl=$51719289  → balance $51719789 maxDD 54.0%
  2026: T= 958 WR= 46% PF= 1.98 sumR=+583.1 exp=+0.61R pnl=$51712091
  blocks: exposure=1538 ddRolling7d=930 cooldown=424 maxOpen=339 killSwitch=317 ddDaily=248 groupCap=169 sizeTilt=150 weeklyTrend=80

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1430 WR= 43% PF= 1.79 sumR=+734.5 exp=+0.51R pnl=$41443242  → balance $41443742 maxDD 68.9%
  2026: T= 925 WR= 44% PF= 1.84 sumR=+497.1 exp=+0.54R pnl=$41429703
  blocks: exposure=1566 ddRolling7d=841 cooldown=446 maxOpen=405 killSwitch=389 ddDaily=249 groupCap=182 weeklyTrend=86

## SAMEDIR max 4
  ALL:  T=1195 WR= 43% PF= 1.79 sumR=+608.5 exp=+0.51R pnl=$9900634  → balance $9901134 maxDD 35.7%
  2026: T= 785 WR= 44% PF= 1.81 sumR=+412.6 exp=+0.53R pnl=$9890295
  blocks: sameDir=1627 exposure=1324 cooldown=394 killSwitch=337 ddRolling7d=231 groupCap=204 ddDaily=186 weeklyTrend=96

## SAMEDIR max 5
  ALL:  T=1355 WR= 43% PF= 1.79 sumR=+697.2 exp=+0.51R pnl=$26715490  → balance $26715990 maxDD 46.7%
  2026: T= 896 WR= 44% PF= 1.82 sumR=+477.4 exp=+0.53R pnl=$26701564
  blocks: exposure=1442 sameDir=1205 cooldown=436 ddRolling7d=401 ddDaily=259 groupCap=236 killSwitch=144 weeklyTrend=86 maxOpen=30

## SAMEDIR max 6
  ALL:  T=1519 WR= 44% PF= 1.84 sumR=+813.2 exp=+0.54R pnl=$206379261  → balance $206379761 maxDD 36.2%
  2026: T=1032 WR= 45% PF= 1.91 sumR=+594.0 exp=+0.58R pnl=$206367182
  blocks: exposure=1624 sameDir=886 cooldown=505 ddDaily=289 groupCap=231 killSwitch=210 ddRolling7d=134 maxOpen=109 weeklyTrend=87

## SAMEDIR max 7
  ALL:  T=1428 WR= 43% PF= 1.79 sumR=+728.4 exp=+0.51R pnl=$19987856  → balance $19988356 maxDD 68.1%
  2026: T= 916 WR= 44% PF= 1.83 sumR=+492.1 exp=+0.54R pnl=$19973267
  blocks: exposure=1528 ddRolling7d=672 sameDir=554 cooldown=477 ddDaily=299 groupCap=226 killSwitch=217 maxOpen=110 weeklyTrend=83

## VENUE Kraken (−LUNC)
  ALL:  T=1479 WR= 43% PF= 1.80 sumR=+766.6 exp=+0.52R pnl=$33124527  → balance $33125027 maxDD 66.6%
  2026: T= 974 WR= 45% PF= 1.88 sumR=+544.3 exp=+0.56R pnl=$33115686
  blocks: exposure=1611 ddRolling7d=765 cooldown=459 maxOpen=399 killSwitch=319 ddDaily=298 groupCap=182 weeklyTrend=82

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T=1468 WR= 43% PF= 1.79 sumR=+751.2 exp=+0.51R pnl=$46675281  → balance $46675781 maxDD 42.8%
  2026: T= 985 WR= 44% PF= 1.82 sumR=+524.2 exp=+0.53R pnl=$46663692
  blocks: exposure=1586 ddRolling7d=499 cooldown=449 killSwitch=349 maxOpen=303 ddDaily=293 groupCap=213 weeklyTrend=86

## TRIAGE minus rsi-divergence
  ALL:  T=1551 WR= 44% PF= 1.86 sumR=+845.7 exp=+0.55R pnl=$194223744  → balance $194224244 maxDD 44.4%
  2026: T=1101 WR= 45% PF= 1.94 sumR=+649.9 exp=+0.59R pnl=$194218099
  blocks: exposure=1530 ddRolling7d=532 maxOpen=450 cooldown=385 killSwitch=260 ddDaily=222 groupCap=220 weeklyTrend=80

## BASELINE (all gates)
  ALL:  T= 380 WR= 40% PF= 1.56 sumR=+143.8 exp=+0.38R pnl=$18044  → balance $18544 maxDD 45.6%
  2026: T= 211 WR= 39% PF= 1.42 sumR=+62.1 exp=+0.29R pnl=$15189
  blocks: maxOpen=1148 atrPct=822 ddRolling7d=743 shortConf=638 exposure=465 ddMonthly=379 dirOverlay=349 dailyTrend=194 cooldown=177 ddDaily=117 killSwitch=110 weeklyTrend=69 groupCap=3

## minus dirOverlay
  ALL:  T= 426 WR= 41% PF= 1.62 sumR=+176.3 exp=+0.41R pnl=$44958  → balance $45458 maxDD 55.9%
  2026: T= 243 WR= 41% PF= 1.57 sumR=+94.4 exp=+0.39R pnl=$41781
  blocks: maxOpen=1198 atrPct=782 ddRolling7d=696 shortConf=597 exposure=525 ddMonthly=428 dailyTrend=294 ddDaily=228 cooldown=205 killSwitch=138 weeklyTrend=76 groupCap=1

## minus dailyTrend
  ALL:  T= 415 WR= 41% PF= 1.60 sumR=+168.3 exp=+0.41R pnl=$37135  → balance $37635 maxDD 45.6%
  2026: T= 238 WR= 42% PF= 1.60 sumR=+96.0 exp=+0.40R pnl=$35463
  blocks: maxOpen=1223 atrPct=857 shortConf=767 ddRolling7d=669 exposure=507 dirOverlay=348 ddMonthly=307 cooldown=175 ddDaily=130 killSwitch=117 weeklyTrend=78 groupCap=1

## minus weeklyTrend
  ALL:  T= 409 WR= 41% PF= 1.65 sumR=+174.5 exp=+0.43R pnl=$48824  → balance $49324 maxDD 45.6%
  2026: T= 211 WR= 39% PF= 1.42 sumR=+62.3 exp=+0.30R pnl=$40260
  blocks: maxOpen=1168 atrPct=825 ddRolling7d=741 shortConf=639 exposure=510 ddMonthly=380 dirOverlay=349 dailyTrend=196 cooldown=176 ddDaily=106 killSwitch=92 groupCap=3

## minus shortConf
  ALL:  T= 292 WR= 40% PF= 1.61 sumR=+120.6 exp=+0.41R pnl=$4943  → balance $5443 maxDD 59.2%
  2026: T= 126 WR= 38% PF= 1.42 sumR=+37.8 exp=+0.30R pnl=$2207
  blocks: ddMonthly=2679 maxOpen=948 ddRolling7d=617 exposure=330 atrPct=288 ddDaily=133 cooldown=100 dirOverlay=92 weeklyTrend=68 dailyTrend=45 killSwitch=2

## minus atrPct
  ALL:  T= 477 WR= 42% PF= 1.71 sumR=+221.2 exp=+0.46R pnl=$105318  → balance $105818 maxDD 39.8%
  2026: T= 263 WR= 41% PF= 1.50 sumR=+89.4 exp=+0.34R pnl=$95097
  blocks: maxOpen=1685 shortConf=742 exposure=618 ddRolling7d=614 dirOverlay=430 dailyTrend=257 ddMonthly=246 cooldown=193 ddDaily=135 killSwitch=115 weeklyTrend=79 groupCap=3

## minus btcCap
  ALL:  T= 421 WR= 41% PF= 1.61 sumR=+172.3 exp=+0.41R pnl=$27554  → balance $28054 maxDD 37.7%
  2026: T= 231 WR= 41% PF= 1.50 sumR=+78.9 exp=+0.34R pnl=$24019
  blocks: ddMonthly=1386 atrPct=878 shortConf=796 exposure=553 ddRolling7d=404 dirOverlay=308 dailyTrend=214 ddDaily=186 cooldown=181 killSwitch=118 groupCap=79 weeklyTrend=70

## minus groupCap
  ALL:  T= 380 WR= 40% PF= 1.56 sumR=+143.8 exp=+0.38R pnl=$18044  → balance $18544 maxDD 45.6%
  2026: T= 211 WR= 39% PF= 1.42 sumR=+62.1 exp=+0.29R pnl=$15189
  blocks: maxOpen=1148 atrPct=822 ddRolling7d=743 shortConf=638 exposure=465 ddMonthly=379 dirOverlay=350 dailyTrend=196 cooldown=177 ddDaily=117 killSwitch=110 weeklyTrend=69

## minus killSwitch
  ALL:  T= 404 WR= 41% PF= 1.63 sumR=+168.0 exp=+0.42R pnl=$50807  → balance $51307 maxDD 47.4%
  2026: T= 233 WR= 42% PF= 1.54 sumR=+84.6 exp=+0.36R pnl=$47800
  blocks: maxOpen=1192 atrPct=929 shortConf=656 ddRolling7d=618 exposure=482 ddMonthly=379 dirOverlay=349 dailyTrend=217 cooldown=174 ddDaily=117 weeklyTrend=74 groupCap=3

## minus ddDaily
  ALL:  T= 382 WR= 39% PF= 1.55 sumR=+143.7 exp=+0.38R pnl=$15511  → balance $16011 maxDD 42.2%
  2026: T= 208 WR= 38% PF= 1.40 sumR=+59.7 exp=+0.29R pnl=$12506
  blocks: maxOpen=1162 atrPct=833 ddRolling7d=750 shortConf=621 ddMonthly=489 exposure=456 dirOverlay=369 dailyTrend=189 cooldown=175 killSwitch=96 weeklyTrend=69 groupCap=3

## minus ddMonthly
  ALL:  T= 404 WR= 40% PF= 1.58 sumR=+158.3 exp=+0.39R pnl=$25389  → balance $25889 maxDD 45.6%
  2026: T= 235 WR= 40% PF= 1.47 sumR=+76.6 exp=+0.33R pnl=$22534
  blocks: maxOpen=1185 ddRolling7d=889 atrPct=831 shortConf=677 exposure=488 dirOverlay=353 dailyTrend=205 cooldown=191 killSwitch=163 ddDaily=136 weeklyTrend=69 groupCap=3

## minus ddRolling
  ALL:  T= 411 WR= 41% PF= 1.62 sumR=+170.0 exp=+0.41R pnl=$52323  → balance $52823 maxDD 50.6%
  2026: T= 236 WR= 41% PF= 1.53 sumR=+84.6 exp=+0.36R pnl=$49086
  blocks: maxOpen=1208 atrPct=899 shortConf=653 killSwitch=569 exposure=494 ddMonthly=405 dirOverlay=344 dailyTrend=218 cooldown=191 ddDaily=123 weeklyTrend=76 groupCap=3

## minus kelly
  ALL:  T= 447 WR= 42% PF= 1.68 sumR=+200.9 exp=+0.45R pnl=$12332  → balance $12832 maxDD 29.1%
  2026: T= 269 WR= 42% PF= 1.63 sumR=+113.6 exp=+0.42R pnl=$10798
  blocks: maxOpen=1253 atrPct=1001 shortConf=692 killSwitch=614 exposure=537 dirOverlay=374 dailyTrend=227 cooldown=207 ddRolling7d=147 weeklyTrend=76 ddDaily=16 groupCap=3

## minus riskMult
  ALL:  T= 369 WR= 39% PF= 1.53 sumR=+135.5 exp=+0.37R pnl=$16557  → balance $17057 maxDD 44.2%
  2026: T= 209 WR= 38% PF= 1.39 sumR=+57.8 exp=+0.28R pnl=$13528
  blocks: maxOpen=949 atrPct=766 ddRolling7d=753 shortConf=584 exposure=465 ddMonthly=448 dirOverlay=350 ddDaily=320 dailyTrend=207 killSwitch=157 cooldown=154 weeklyTrend=69 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=2081 WR= 44% PF= 1.83 sumR=+1105.6 exp=+0.53R pnl=$11959263839  → balance $11959264339 maxDD 51.7%
  2026: T=1392 WR= 44% PF= 1.80 sumR=+724.7 exp=+0.52R pnl=$11959131450
  blocks: exposure=2180 maxOpen=744 cooldown=589

## LS-only BASELINE
  ALL:  T= 315 WR= 43% PF= 1.75 sumR=+154.3 exp=+0.49R pnl=$35543  → balance $36043 maxDD 40.1%
  2026: T= 221 WR= 45% PF= 1.81 sumR=+115.1 exp=+0.52R pnl=$34918
  blocks: maxOpen=864 atrPct=821 ddRolling7d=712 shortConf=658 ddMonthly=440 dirOverlay=310 exposure=278 dailyTrend=193 ddDaily=122 cooldown=92 killSwitch=57 groupCap=2

## LS-only LEAN
  ALL:  T=1963 WR= 44% PF= 1.84 sumR=+1058.9 exp=+0.54R pnl=$5335148122  → balance $5335148622 maxDD 46.8%
  2026: T=1383 WR= 44% PF= 1.85 sumR=+757.5 exp=+0.55R pnl=$5335113249
  blocks: exposure=1751 maxOpen=644 cooldown=506

## LS+RSI LEAN
  ALL:  T=1983 WR= 44% PF= 1.83 sumR=+1063.8 exp=+0.54R pnl=$5981321398  → balance $5981321898 maxDD 50.1%
  2026: T=1396 WR= 44% PF= 1.83 sumR=+751.1 exp=+0.54R pnl=$5981277702
  blocks: exposure=1950 maxOpen=703 cooldown=592

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1489 WR= 44% PF= 1.81 sumR=+775.7 exp=+0.52R pnl=$31453032695  → balance $31453033195 maxDD 75.5%
  2026: T= 985 WR= 44% PF= 1.85 sumR=+531.5 exp=+0.54R pnl=$31452995600
  blocks: exposure=1569 killSwitch=1022 ddDaily=554 cooldown=464 maxOpen=411 weeklyTrend=85

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1404 WR= 43% PF= 1.79 sumR=+714.6 exp=+0.51R pnl=$6067114841  → balance $6067115341 maxDD 78.7%
  2026: T= 974 WR= 44% PF= 1.81 sumR=+506.7 exp=+0.52R pnl=$6067098682
  blocks: exposure=1383 killSwitch=1038 ddDaily=603 cooldown=452 maxOpen=348

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1365 WR= 42% PF= 1.72 sumR=+643.8 exp=+0.47R pnl=$576133766  → balance $576134266 maxDD 86.3%
  2026: T= 865 WR= 42% PF= 1.71 sumR=+402.9 exp=+0.47R pnl=$576088813
  blocks: exposure=1486 killSwitch=1029 ddDaily=675 cooldown=447 maxOpen=343 groupCap=162 weeklyTrend=87

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1384 WR= 42% PF= 1.71 sumR=+646.6 exp=+0.47R pnl=$712615265  → balance $712615765 maxDD 76.1%
  2026: T= 902 WR= 42% PF= 1.69 sumR=+411.3 exp=+0.46R pnl=$712562935
  blocks: exposure=1460 ddRolling7d=1227 ddDaily=566 cooldown=415 maxOpen=369 killSwitch=89 weeklyTrend=84

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1374 WR= 43% PF= 1.82 sumR=+722.3 exp=+0.53R pnl=$14991541588  → balance $14991542088 maxDD 68.0%
  2026: T= 906 WR= 44% PF= 1.84 sumR=+489.7 exp=+0.54R pnl=$14991497639
  blocks: exposure=1434 ddRolling7d=1011 ddDaily=534 cooldown=415 maxOpen=324 killSwitch=247 groupCap=171 weeklyTrend=84

## PROPOSED-F (= E without kelly)
  ALL:  T=1522 WR= 43% PF= 1.80 sumR=+786.9 exp=+0.52R pnl=$45030571  → balance $45031071 maxDD 63.0%
  2026: T= 996 WR= 44% PF= 1.83 sumR=+531.5 exp=+0.53R pnl=$45015938
  blocks: exposure=1594 ddRolling7d=754 cooldown=444 maxOpen=423 ddDaily=321 killSwitch=255 groupCap=195 weeklyTrend=86

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  91 WR= 27% PF= 0.75 sumR=-19.2 exp=-0.21R pnl=$-359299
  LONG  · BTC daily neutral T=  68 WR= 26% PF= 0.89 sumR=-6.2 exp=-0.09R pnl=$1434010
  LONG  · BTC daily down    T= 150 WR= 38% PF= 1.49 sumR=+51.8 exp=+0.35R pnl=$274742
  SHORT · BTC daily up      T= 264 WR= 58% PF= 3.35 sumR=+300.6 exp=+1.14R pnl=$23284022
  SHORT · BTC daily neutral T= 162 WR= 42% PF= 1.60 sumR=+64.6 exp=+0.40R pnl=$5983147
  SHORT · BTC daily down    T= 744 WR= 43% PF= 1.78 sumR=+374.9 exp=+0.50R pnl=$2507905
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  75 WR= 37% PF= 1.34 sumR=+17.7 exp=+0.24R pnl=$-1965
  LONG  · BTC weekly neutral T=  33 WR= 36% PF= 1.34 sumR=+8.0 exp=+0.24R pnl=$1047
  LONG  · BTC weekly down    T= 201 WR= 30% PF= 1.00 sumR=+0.8 exp=+0.00R pnl=$1350372
  SHORT · BTC weekly up      T= 237 WR= 45% PF= 1.91 sumR=+135.4 exp=+0.57R pnl=$283266
  SHORT · BTC weekly neutral T= 118 WR= 53% PF= 2.56 sumR=+100.9 exp=+0.85R pnl=$1231003
  SHORT · BTC weekly down    T= 815 WR= 46% PF= 2.00 sumR=+503.8 exp=+0.62R pnl=$30260805

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.78 sumR=+43.2 exp=+0.48R pnl=$1193845
                     2026: T=  17 WR= 47% PF= 2.02 sumR=+9.8 exp=+0.57R pnl=$1193331
  rsi-divergence     ALL:  T=  45 WR= 42% PF= 1.55 sumR=+15.7 exp=+0.35R pnl=$1276002
                     2026: T=  26 WR= 46% PF= 1.45 sumR=+7.0 exp=+0.27R pnl=$1275527
  liquidity-sweep    ALL:  T=1344 WR= 43% PF= 1.81 sumR=+707.7 exp=+0.53R pnl=$30654680
                     2026: T= 931 WR= 44% PF= 1.88 sumR=+527.5 exp=+0.57R pnl=$30646828

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  74 WR= 46% PF= 2.02 sumR=+43.5 exp=+0.59R pnl=$2774
                     2026: T=  12 WR= 50% PF= 1.93 sumR=+6.0 exp=+0.50R pnl=$1910
  rsi-divergence     ALL:  T=  28 WR= 36% PF= 1.34 sumR=+6.7 exp=+0.24R pnl=$-1759
                     2026: T=  16 WR= 44% PF= 1.39 sumR=+4.1 exp=+0.26R pnl=$-1712
  liquidity-sweep    ALL:  T= 278 WR= 38% PF= 1.48 sumR=+93.6 exp=+0.34R pnl=$17029
                     2026: T= 183 WR= 38% PF= 1.40 sumR=+52.1 exp=+0.28R pnl=$14991

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 130 WR= 44% PF= 1.98 sumR=+74.7 exp=+0.57R pnl=$385399379
                     2026: T=  22 WR= 36% PF= 1.30 sumR=+4.4 exp=+0.20R pnl=$385396860
  rsi-divergence     ALL:  T=  54 WR= 43% PF= 1.58 sumR=+20.4 exp=+0.38R pnl=$299894799
                     2026: T=  35 WR= 43% PF= 1.37 sumR=+8.3 exp=+0.24R pnl=$299888051
  liquidity-sweep    ALL:  T=1897 WR= 44% PF= 1.83 sumR=+1010.5 exp=+0.53R pnl=$11273969661
                     2026: T=1335 WR= 44% PF= 1.82 sumR=+712.0 exp=+0.53R pnl=$11273846539

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  96 WR= 42% PF= 1.71 sumR=+42.1 exp=+0.44R pnl=$2687942070
                     2026: T=  21 WR= 43% PF= 1.54 sumR=+6.9 exp=+0.33R pnl=$2687941276
  rsi-divergence     ALL:  T=  57 WR= 40% PF= 1.43 sumR=+16.2 exp=+0.28R pnl=$1433815300
                     2026: T=  35 WR= 43% PF= 1.35 sumR=+7.8 exp=+0.22R pnl=$1433815149
  liquidity-sweep    ALL:  T=1336 WR= 44% PF= 1.84 sumR=+717.3 exp=+0.54R pnl=$27331275325
                     2026: T= 929 WR= 44% PF= 1.87 sumR=+516.7 exp=+0.56R pnl=$27331239175

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  57 WR= 40% PF= 1.43 sumR=+16.2 exp=+0.28R pnl=$315348044
                     2026: T=  35 WR= 43% PF= 1.35 sumR=+7.8 exp=+0.22R pnl=$315347802
  liquidity-sweep    ALL:  T=1347 WR= 43% PF= 1.80 sumR=+698.4 exp=+0.52R pnl=$5751766797
                     2026: T= 939 WR= 44% PF= 1.82 sumR=+498.9 exp=+0.53R pnl=$5751750881

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  94 WR= 40% PF= 1.64 sumR=+38.1 exp=+0.41R pnl=$53484894
                     2026: T=  19 WR= 37% PF= 1.23 sumR=+2.9 exp=+0.15R pnl=$53483792
  rsi-divergence     ALL:  T=  53 WR= 42% PF= 1.53 sumR=+18.1 exp=+0.34R pnl=$45433617
                     2026: T=  30 WR= 43% PF= 1.36 sumR=+6.8 exp=+0.23R pnl=$45433290
  liquidity-sweep    ALL:  T=1218 WR= 42% PF= 1.73 sumR=+587.7 exp=+0.48R pnl=$477215256
                     2026: T= 816 WR= 42% PF= 1.73 sumR=+393.2 exp=+0.48R pnl=$477171731

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  91 WR= 42% PF= 1.72 sumR=+40.6 exp=+0.45R pnl=$58204327
                     2026: T=  18 WR= 39% PF= 1.27 sumR=+3.2 exp=+0.18R pnl=$58199668
  rsi-divergence     ALL:  T=  40 WR= 45% PF= 1.79 sumR=+18.6 exp=+0.47R pnl=$40822837
                     2026: T=  24 WR= 50% PF= 1.83 sumR=+11.0 exp=+0.46R pnl=$40824095
  liquidity-sweep    ALL:  T=1253 WR= 42% PF= 1.71 sumR=+587.4 exp=+0.47R pnl=$613588101
                     2026: T= 860 WR= 42% PF= 1.70 sumR=+397.1 exp=+0.46R pnl=$613539172

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  92 WR= 41% PF= 1.72 sumR=+40.9 exp=+0.44R pnl=$1393324933
                     2026: T=  19 WR= 37% PF= 1.27 sumR=+3.5 exp=+0.18R pnl=$1393320910
  rsi-divergence     ALL:  T=  41 WR= 49% PF= 2.04 sumR=+23.3 exp=+0.57R pnl=$1437203764
                     2026: T=  24 WR= 54% PF= 2.15 sumR=+14.0 exp=+0.58R pnl=$1437205649
  liquidity-sweep    ALL:  T=1241 WR= 43% PF= 1.82 sumR=+658.1 exp=+0.53R pnl=$12161012891
                     2026: T= 863 WR= 44% PF= 1.85 sumR=+472.2 exp=+0.55R pnl=$12160971080

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  90 WR= 43% PF= 1.89 sumR=+47.9 exp=+0.53R pnl=$2299855
                     2026: T=  16 WR= 50% PF= 2.37 sumR=+11.6 exp=+0.72R pnl=$2299262
  rsi-divergence     ALL:  T=  41 WR= 44% PF= 1.70 sumR=+17.8 exp=+0.44R pnl=$2280963
                     2026: T=  23 WR= 48% PF= 1.65 sumR=+8.6 exp=+0.37R pnl=$2280320
  liquidity-sweep    ALL:  T=1391 WR= 43% PF= 1.80 sumR=+721.2 exp=+0.52R pnl=$40449753
                     2026: T= 957 WR= 44% PF= 1.82 sumR=+511.4 exp=+0.53R pnl=$40436357

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2023-01  $-10.56
  2023-02  $-21.04
  2023-03  +$27.65
  2023-04  $-31.76
  2023-05  +$0.81
  2023-06  +$16.26
  2023-07  $-23.13
  2023-08  +$120.25
  2023-09  +$25.00
  2023-10  $-12.95
  2023-11  +$58.68
  2023-12  +$49.66
  2024-01  $-14.97
  2024-02  +$25.11
  2024-03  +$84.29
  2024-04  $-33.35
  2024-05  $-31.71
  2024-06  +$84.37
  2024-07  $-54.17
  2024-08  $-15.70
  2024-10  $-31.94
  2024-11  $-5.56
  2024-12  $-15.05
  2025-01  $-14.37
  2025-03  +$25.20
  2025-04  +$79.71
  2025-06  $-40.62
  2025-07  +$54.52
  2025-08  $-12.70
  2025-09  +$307.58
  2025-10  +$1152.15
  2025-11  +$9927.77
  2025-12  $-2827.69
  2026-01  +$56194.12
  2026-02  +$108765.25
  2026-03  +$445253.37
  2026-04  $-275093.47
  2026-05  +$696914.11
  2026-06  +$3615313.79
  2026-07  +$9369039.24
  2026-08  +$19099299.21