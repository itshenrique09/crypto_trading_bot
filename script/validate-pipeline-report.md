# Full-Pipeline Portfolio Validation — 2026-08-14
Capital $500 · base risk 2% · candles 8000 · gates mirror server/routes.ts paperScan
Unmodeled: MEXC volume/spread/funding filters, entry drift, engine downtime.

Total raw candidates (post minSL+R:R): 3697

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T=1242 WR= 45% PF= 1.94 sumR=+711.1 exp=+0.57R pnl=$45767626  → balance $45768126 maxDD 31.2%
  2026: T= 851 WR= 45% PF= 1.93 sumR=+479.3 exp=+0.56R pnl=$45751012
  blocks: exposure=1222 cooldown=337 ddRolling7d=235 maxOpen=177 killSwitch=159 groupCap=123 ddDaily=109 weeklyTrend=93

## CAP maxOpen=8
  ALL:  T=1178 WR= 44% PF= 1.87 sumR=+635.8 exp=+0.54R pnl=$14379342  → balance $14379842 maxDD 43.0%
  2026: T= 794 WR= 44% PF= 1.85 sumR=+420.9 exp=+0.53R pnl=$14365496
  blocks: exposure=1132 maxOpen=326 cooldown=312 ddRolling7d=255 killSwitch=199 ddDaily=127 weeklyTrend=93 groupCap=75

## CAP maxOpen=10
  ALL:  T=1254 WR= 44% PF= 1.92 sumR=+708.7 exp=+0.57R pnl=$49799644  → balance $49800144 maxDD 35.8%
  2026: T= 874 WR= 45% PF= 1.92 sumR=+492.4 exp=+0.56R pnl=$49785675
  blocks: exposure=1205 cooldown=316 killSwitch=217 ddRolling7d=216 maxOpen=150 groupCap=127 ddDaily=119 weeklyTrend=93

## CAP perSymbol=2
  ALL:  T=1252 WR= 44% PF= 1.92 sumR=+707.4 exp=+0.56R pnl=$46086866  → balance $46087366 maxDD 35.8%
  2026: T= 865 WR= 45% PF= 1.93 sumR=+491.0 exp=+0.57R pnl=$46072754
  blocks: exposure=1148 cooldown=329 ddRolling7d=264 killSwitch=203 maxOpen=161 groupCap=128 ddDaily=116 weeklyTrend=96

## CAP maxOpen=8 + perSymbol=2
  ALL:  T=1168 WR= 44% PF= 1.87 sumR=+630.4 exp=+0.54R pnl=$14041263  → balance $14041763 maxDD 43.1%
  2026: T= 782 WR= 44% PF= 1.85 sumR=+413.6 exp=+0.53R pnl=$14027028
  blocks: exposure=1065 maxOpen=340 cooldown=314 ddRolling7d=288 killSwitch=224 ddDaily=140 weeklyTrend=88 groupCap=70

## CAP LS cooldown 8h
  ALL:  T=1277 WR= 44% PF= 1.91 sumR=+714.0 exp=+0.56R pnl=$59375410  → balance $59375910 maxDD 30.1%
  2026: T= 895 WR= 45% PF= 1.93 sumR=+506.4 exp=+0.57R pnl=$59363146
  blocks: exposure=1231 cooldown=276 killSwitch=215 ddRolling7d=203 maxOpen=149 groupCap=132 ddDaily=121 weeklyTrend=93

## CAP LS cooldown 6h
  ALL:  T=1230 WR= 44% PF= 1.92 sumR=+691.6 exp=+0.56R pnl=$40978279  → balance $40978779 maxDD 32.0%
  2026: T= 841 WR= 45% PF= 1.92 sumR=+474.6 exp=+0.56R pnl=$40963626
  blocks: exposure=1182 killSwitch=294 ddRolling7d=277 cooldown=255 maxOpen=147 ddDaily=111 groupCap=108 weeklyTrend=93

## CAP combo (mo8+ps2+LScd8)
  ALL:  T=1158 WR= 43% PF= 1.84 sumR=+607.3 exp=+0.52R pnl=$10822895  → balance $10823395 maxDD 38.4%
  2026: T= 792 WR= 44% PF= 1.84 sumR=+413.6 exp=+0.52R pnl=$10812569
  blocks: exposure=1055 maxOpen=328 killSwitch=312 ddRolling7d=281 cooldown=275 ddDaily=115 weeklyTrend=88 groupCap=85

## CAP maxOpen=10 + perSymbol=2
  ALL:  T=1252 WR= 44% PF= 1.92 sumR=+707.4 exp=+0.56R pnl=$46086866  → balance $46087366 maxDD 35.8%
  2026: T= 865 WR= 45% PF= 1.93 sumR=+491.0 exp=+0.57R pnl=$46072754
  blocks: exposure=1148 cooldown=329 ddRolling7d=264 killSwitch=203 maxOpen=161 groupCap=128 ddDaily=116 weeklyTrend=96

## CAP maxOpen=12
  ALL:  T=1238 WR= 44% PF= 1.90 sumR=+689.9 exp=+0.56R pnl=$23630476  → balance $23630976 maxDD 35.6%
  2026: T= 854 WR= 44% PF= 1.90 sumR=+474.5 exp=+0.56R pnl=$23616913
  blocks: exposure=1206 cooldown=304 ddRolling7d=272 killSwitch=236 groupCap=167 ddDaily=119 weeklyTrend=93 maxOpen=62

## CAP groupCap=2 (pre-expansion default)
  ALL:  T=1069 WR= 43% PF= 1.80 sumR=+539.0 exp=+0.50R pnl=$2418073  → balance $2418573 maxDD 38.9%
  2026: T= 715 WR= 43% PF= 1.79 sumR=+356.9 exp=+0.50R pnl=$2409184
  blocks: exposure=1039 killSwitch=357 groupCap=356 ddRolling7d=324 cooldown=276 ddDaily=112 weeklyTrend=89 maxOpen=75

## CAP groupCap=3 + maxOpen=12
  ALL:  T=1238 WR= 44% PF= 1.90 sumR=+689.9 exp=+0.56R pnl=$23630476  → balance $23630976 maxDD 35.6%
  2026: T= 854 WR= 44% PF= 1.90 sumR=+474.5 exp=+0.56R pnl=$23616913
  blocks: exposure=1206 cooldown=304 ddRolling7d=272 killSwitch=236 groupCap=167 ddDaily=119 weeklyTrend=93 maxOpen=62

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T=1283 WR= 44% PF= 1.95 sumR=+741.2 exp=+0.58R pnl=$72016201  → balance $72016701 maxDD 34.6%
  2026: T= 871 WR= 45% PF= 1.94 sumR=+500.1 exp=+0.57R pnl=$71996311
  blocks: exposure=1185 cooldown=352 ddRolling7d=237 maxOpen=172 ddDaily=163 killSwitch=107 groupCap=105 weeklyTrend=93

## EXIT tp1Close=50%
  ALL:  T=1215 WR= 44% PF= 1.88 sumR=+660.7 exp=+0.54R pnl=$17010597  → balance $17011097 maxDD 35.9%
  2026: T= 835 WR= 44% PF= 1.86 sumR=+443.7 exp=+0.53R pnl=$16996508
  blocks: exposure=1174 cooldown=309 ddRolling7d=300 killSwitch=216 maxOpen=137 groupCap=132 ddDaily=119 weeklyTrend=95

## EXIT tp1Close=75%
  ALL:  T=1261 WR= 44% PF= 1.92 sumR=+712.8 exp=+0.57R pnl=$53943374  → balance $53943874 maxDD 35.8%
  2026: T= 878 WR= 45% PF= 1.93 sumR=+497.6 exp=+0.57R pnl=$53929568
  blocks: exposure=1207 cooldown=321 ddRolling7d=216 killSwitch=205 maxOpen=150 groupCap=129 ddDaily=115 weeklyTrend=93

## EXIT trail 1.5%
  ALL:  T=1266 WR= 44% PF= 1.92 sumR=+716.5 exp=+0.57R pnl=$58928891  → balance $58929391 maxDD 36.6%
  2026: T= 884 WR= 44% PF= 1.91 sumR=+492.4 exp=+0.56R pnl=$58912749
  blocks: exposure=1208 cooldown=318 killSwitch=215 ddRolling7d=210 maxOpen=150 groupCap=131 ddDaily=106 weeklyTrend=93

## EXIT trail 3%
  ALL:  T=1207 WR= 44% PF= 1.89 sumR=+658.8 exp=+0.55R pnl=$17469657  → balance $17470157 maxDD 28.8%
  2026: T= 825 WR= 44% PF= 1.85 sumR=+434.0 exp=+0.53R pnl=$17454976
  blocks: exposure=1185 cooldown=314 ddRolling7d=286 killSwitch=202 maxOpen=167 groupCap=124 ddDaily=116 weeklyTrend=96

## EXIT trail r_multiple 2R
  ALL:  T=1242 WR= 45% PF= 1.94 sumR=+711.1 exp=+0.57R pnl=$45767626  → balance $45768126 maxDD 31.2%
  2026: T= 851 WR= 45% PF= 1.93 sumR=+479.3 exp=+0.56R pnl=$45751012
  blocks: exposure=1222 cooldown=337 ddRolling7d=235 maxOpen=177 killSwitch=159 groupCap=123 ddDaily=109 weeklyTrend=93

## TILT LONG:up 0.75x
  ALL:  T=1247 WR= 45% PF= 1.93 sumR=+705.0 exp=+0.57R pnl=$35285730  → balance $35286230 maxDD 33.8%
  2026: T= 855 WR= 45% PF= 1.91 sumR=+474.3 exp=+0.55R pnl=$35270720
  blocks: exposure=1219 cooldown=337 ddRolling7d=231 maxOpen=177 killSwitch=166 groupCap=124 ddDaily=103 weeklyTrend=93

## TILT LONG:up 0.5x
  ALL:  T=1250 WR= 44% PF= 1.92 sumR=+701.7 exp=+0.56R pnl=$28269916  → balance $28270416 maxDD 32.1%
  2026: T= 858 WR= 45% PF= 1.90 sumR=+471.1 exp=+0.55R pnl=$28256150
  blocks: exposure=1223 cooldown=337 ddRolling7d=222 maxOpen=177 killSwitch=171 groupCap=124 ddDaily=100 weeklyTrend=93

## TILT LONG:up blocked
  ALL:  T=1065 WR= 44% PF= 1.90 sumR=+587.4 exp=+0.55R pnl=$2886176  → balance $2886676 maxDD 64.9%
  2026: T= 701 WR= 44% PF= 1.85 sumR=+369.3 exp=+0.53R pnl=$2874634
  blocks: exposure=1066 ddRolling7d=429 cooldown=304 killSwitch=204 sizeTilt=190 maxOpen=130 ddDaily=110 groupCap=108 weeklyTrend=91

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T=1115 WR= 43% PF= 1.80 sumR=+558.0 exp=+0.50R pnl=$4557003  → balance $4557503 maxDD 60.7%
  2026: T= 723 WR= 42% PF= 1.71 sumR=+327.4 exp=+0.45R pnl=$4539525
  blocks: exposure=1111 killSwitch=349 ddRolling7d=318 cooldown=312 maxOpen=173 ddDaily=118 groupCap=108 weeklyTrend=93

## SAMEDIR max 4
  ALL:  T=1071 WR= 44% PF= 1.92 sumR=+607.6 exp=+0.57R pnl=$10666144  → balance $10666644 maxDD 29.5%
  2026: T= 728 WR= 45% PF= 1.96 sumR=+424.8 exp=+0.58R pnl=$10657012
  blocks: exposure=1063 sameDir=823 cooldown=326 killSwitch=121 weeklyTrend=92 ddRolling7d=85 groupCap=83 ddDaily=33

## SAMEDIR max 5
  ALL:  T=1138 WR= 44% PF= 1.91 sumR=+634.9 exp=+0.56R pnl=$19539166  → balance $19539666 maxDD 30.8%
  2026: T= 795 WR= 45% PF= 1.94 sumR=+454.0 exp=+0.57R pnl=$19530500
  blocks: exposure=1131 sameDir=560 cooldown=341 killSwitch=176 groupCap=105 weeklyTrend=95 ddRolling7d=74 ddDaily=63 maxOpen=14

## SAMEDIR max 6
  ALL:  T=1190 WR= 44% PF= 1.91 sumR=+662.0 exp=+0.56R pnl=$29577140  → balance $29577640 maxDD 26.0%
  2026: T= 850 WR= 45% PF= 1.91 sumR=+472.3 exp=+0.56R pnl=$29567286
  blocks: exposure=1172 cooldown=342 sameDir=340 killSwitch=165 ddRolling7d=128 groupCap=116 weeklyTrend=98 ddDaily=92 maxOpen=54

## SAMEDIR max 7
  ALL:  T=1168 WR= 44% PF= 1.89 sumR=+635.6 exp=+0.54R pnl=$15940289  → balance $15940789 maxDD 31.2%
  2026: T= 821 WR= 45% PF= 1.88 sumR=+442.4 exp=+0.54R pnl=$15930384
  blocks: exposure=1178 cooldown=342 sameDir=224 killSwitch=224 ddRolling7d=174 groupCap=125 ddDaily=108 weeklyTrend=93 maxOpen=61

## VENUE Kraken (−LUNC)
  ALL:  T=1230 WR= 44% PF= 1.91 sumR=+684.2 exp=+0.56R pnl=$31558844  → balance $31559344 maxDD 30.9%
  2026: T= 842 WR= 44% PF= 1.89 sumR=+460.7 exp=+0.55R pnl=$31543827
  blocks: exposure=1199 cooldown=336 ddRolling7d=247 maxOpen=168 killSwitch=141 groupCap=122 ddDaily=106 weeklyTrend=93

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T=1132 WR= 44% PF= 1.89 sumR=+617.4 exp=+0.55R pnl=$12964725  → balance $12965225 maxDD 31.7%
  2026: T= 762 WR= 43% PF= 1.82 sumR=+391.7 exp=+0.51R pnl=$12948019
  blocks: exposure=1138 cooldown=325 killSwitch=223 ddRolling7d=199 groupCap=127 maxOpen=123 weeklyTrend=92 ddDaily=87

## BASELINE (all gates)
  ALL:  T= 410 WR= 41% PF= 1.74 sumR=+194.2 exp=+0.47R pnl=$86373  → balance $86873 maxDD 38.3%
  2026: T= 239 WR= 41% PF= 1.68 sumR=+105.3 exp=+0.44R pnl=$82480
  blocks: maxOpen=772 atrPct=574 exposure=455 ddRolling7d=420 dirOverlay=268 shortConf=206 killSwitch=177 cooldown=161 dailyTrend=90 ddDaily=90 weeklyTrend=71 groupCap=3

## minus dirOverlay
  ALL:  T= 435 WR= 40% PF= 1.69 sumR=+195.9 exp=+0.45R pnl=$112289  → balance $112789 maxDD 47.9%
  2026: T= 248 WR= 40% PF= 1.64 sumR=+104.9 exp=+0.42R pnl=$107607
  blocks: maxOpen=819 ddRolling7d=523 exposure=495 atrPct=495 shortConf=189 cooldown=184 killSwitch=181 dailyTrend=154 ddDaily=142 weeklyTrend=75 ddMonthly=5

## minus dailyTrend
  ALL:  T= 418 WR= 41% PF= 1.72 sumR=+194.6 exp=+0.47R pnl=$88789  → balance $89289 maxDD 38.3%
  2026: T= 240 WR= 43% PF= 1.75 sumR=+114.9 exp=+0.48R pnl=$86332
  blocks: maxOpen=792 atrPct=563 exposure=470 ddRolling7d=420 dirOverlay=257 shortConf=232 cooldown=146 killSwitch=141 ddMonthly=92 ddDaily=91 weeklyTrend=73 groupCap=2

## minus weeklyTrend
  ALL:  T= 440 WR= 43% PF= 1.82 sumR=+224.7 exp=+0.51R pnl=$270621  → balance $271121 maxDD 38.3%
  2026: T= 240 WR= 42% PF= 1.68 sumR=+104.6 exp=+0.44R pnl=$259183
  blocks: maxOpen=787 atrPct=574 exposure=501 ddRolling7d=367 dirOverlay=266 shortConf=204 cooldown=158 killSwitch=155 dailyTrend=98 ddDaily=84 ddMonthly=60 groupCap=3

## minus shortConf
  ALL:  T= 336 WR= 42% PF= 1.77 sumR=+164.5 exp=+0.49R pnl=$33675  → balance $34175 maxDD 43.2%
  2026: T= 156 WR= 40% PF= 1.62 sumR=+64.1 exp=+0.41R pnl=$27239
  blocks: ddMonthly=1144 maxOpen=668 exposure=368 atrPct=330 ddRolling7d=325 dirOverlay=147 cooldown=115 ddDaily=115 weeklyTrend=68 dailyTrend=68 killSwitch=11 groupCap=2

## minus atrPct
  ALL:  T= 401 WR= 42% PF= 1.82 sumR=+206.5 exp=+0.52R pnl=$103544  → balance $104044 maxDD 31.0%
  2026: T= 192 WR= 40% PF= 1.56 sumR=+70.4 exp=+0.37R pnl=$86819
  blocks: maxOpen=967 ddMonthly=660 exposure=468 dirOverlay=308 ddRolling7d=242 shortConf=229 cooldown=152 dailyTrend=90 weeklyTrend=78 ddDaily=73 killSwitch=27 groupCap=2

## minus btcCap
  ALL:  T= 427 WR= 41% PF= 1.71 sumR=+195.0 exp=+0.46R pnl=$49479  → balance $49979 maxDD 39.5%
  2026: T= 236 WR= 41% PF= 1.63 sumR=+97.6 exp=+0.41R pnl=$45196
  blocks: ddMonthly=814 atrPct=543 exposure=509 ddRolling7d=300 shortConf=268 dirOverlay=229 cooldown=167 ddDaily=107 killSwitch=105 dailyTrend=103 weeklyTrend=70 groupCap=55

## minus groupCap
  ALL:  T= 411 WR= 41% PF= 1.73 sumR=+193.0 exp=+0.47R pnl=$83010  → balance $83510 maxDD 38.3%
  2026: T= 240 WR= 41% PF= 1.67 sumR=+104.1 exp=+0.43R pnl=$79118
  blocks: maxOpen=772 atrPct=574 exposure=455 ddRolling7d=420 dirOverlay=268 shortConf=206 killSwitch=177 cooldown=161 dailyTrend=92 ddDaily=90 weeklyTrend=71

## minus killSwitch
  ALL:  T= 416 WR= 40% PF= 1.68 sumR=+182.5 exp=+0.44R pnl=$66679  → balance $67179 maxDD 34.4%
  2026: T= 243 WR= 40% PF= 1.57 sumR=+91.8 exp=+0.38R pnl=$62584
  blocks: maxOpen=786 atrPct=561 exposure=448 ddRolling7d=447 dirOverlay=264 shortConf=213 cooldown=162 ddMonthly=155 dailyTrend=96 ddDaily=77 weeklyTrend=69 groupCap=3

## minus ddDaily
  ALL:  T= 425 WR= 41% PF= 1.71 sumR=+195.3 exp=+0.46R pnl=$84855  → balance $85355 maxDD 36.1%
  2026: T= 249 WR= 41% PF= 1.63 sumR=+103.9 exp=+0.42R pnl=$80744
  blocks: maxOpen=788 atrPct=603 exposure=473 ddRolling7d=445 dirOverlay=280 shortConf=210 cooldown=162 killSwitch=145 dailyTrend=94 weeklyTrend=69 groupCap=3

## minus ddMonthly
  ALL:  T= 410 WR= 41% PF= 1.74 sumR=+194.2 exp=+0.47R pnl=$86373  → balance $86873 maxDD 38.3%
  2026: T= 239 WR= 41% PF= 1.68 sumR=+105.3 exp=+0.44R pnl=$82480
  blocks: maxOpen=772 atrPct=574 exposure=455 ddRolling7d=420 dirOverlay=268 shortConf=206 killSwitch=177 cooldown=161 dailyTrend=90 ddDaily=90 weeklyTrend=71 groupCap=3

## minus ddRolling
  ALL:  T= 388 WR= 40% PF= 1.69 sumR=+173.7 exp=+0.45R pnl=$55226  → balance $55726 maxDD 43.9%
  2026: T= 211 WR= 40% PF= 1.57 sumR=+80.8 exp=+0.38R pnl=$50791
  blocks: maxOpen=675 atrPct=525 ddMonthly=434 exposure=423 killSwitch=326 dirOverlay=271 shortConf=212 cooldown=167 dailyTrend=100 ddDaily=97 weeklyTrend=76 groupCap=3

## minus kelly
  ALL:  T= 450 WR= 41% PF= 1.72 sumR=+208.9 exp=+0.46R pnl=$14267  → balance $14767 maxDD 21.2%
  2026: T= 270 WR= 41% PF= 1.64 sumR=+114.0 exp=+0.42R pnl=$12464
  blocks: maxOpen=818 atrPct=660 exposure=498 killSwitch=303 dirOverlay=292 shortConf=226 cooldown=188 dailyTrend=109 weeklyTrend=76 ddRolling7d=64 ddDaily=10 groupCap=3

## minus riskMult
  ALL:  T= 356 WR= 40% PF= 1.67 sumR=+156.7 exp=+0.44R pnl=$40122  → balance $40622 maxDD 37.2%
  2026: T= 190 WR= 39% PF= 1.57 sumR=+72.2 exp=+0.38R pnl=$35900
  blocks: maxOpen=561 ddMonthly=466 atrPct=453 ddRolling7d=414 exposure=403 dirOverlay=260 ddDaily=209 shortConf=181 cooldown=136 dailyTrend=94 killSwitch=90 weeklyTrend=71 groupCap=3

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T=1557 WR= 44% PF= 1.93 sumR=+887.1 exp=+0.57R pnl=$911915656  → balance $911916156 maxDD 43.8%
  2026: T=1025 WR= 44% PF= 1.92 sumR=+576.7 exp=+0.56R pnl=$911857951
  blocks: exposure=1487 cooldown=388 maxOpen=265

## LS-only BASELINE
  ALL:  T= 312 WR= 43% PF= 1.85 sumR=+167.0 exp=+0.54R pnl=$55134  → balance $55634 maxDD 33.3%
  2026: T= 211 WR= 45% PF= 1.89 sumR=+117.1 exp=+0.55R pnl=$54060
  blocks: maxOpen=542 atrPct=491 ddRolling7d=370 ddMonthly=360 exposure=236 dirOverlay=228 shortConf=209 dailyTrend=71 cooldown=66 ddDaily=64 killSwitch=18 groupCap=2

## LS-only LEAN
  ALL:  T=1403 WR= 44% PF= 1.95 sumR=+817.8 exp=+0.58R pnl=$301394119  → balance $301394619 maxDD 46.4%
  2026: T= 983 WR= 44% PF= 1.93 sumR=+563.8 exp=+0.57R pnl=$301371555
  blocks: exposure=1079 cooldown=273 maxOpen=214

## LS+RSI LEAN
  ALL:  T=1444 WR= 44% PF= 1.93 sumR=+827.7 exp=+0.57R pnl=$335167035  → balance $335167535 maxDD 42.6%
  2026: T=1012 WR= 44% PF= 1.92 sumR=+572.8 exp=+0.57R pnl=$335144936
  blocks: exposure=1252 cooldown=386 maxOpen=251

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T=1156 WR= 42% PF= 1.79 sumR=+571.3 exp=+0.49R pnl=$813779534  → balance $813780034 maxDD 62.4%
  2026: T= 799 WR= 44% PF= 1.84 sumR=+417.3 exp=+0.52R pnl=$813769532
  blocks: exposure=1133 killSwitch=544 cooldown=316 ddDaily=286 maxOpen=169 weeklyTrend=93

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T=1084 WR= 43% PF= 1.86 sumR=+579.4 exp=+0.53R pnl=$1183427489  → balance $1183427989 maxDD 62.0%
  2026: T= 800 WR= 45% PF= 1.93 sumR=+453.7 exp=+0.57R pnl=$1183422437
  blocks: exposure=969 killSwitch=518 cooldown=321 ddDaily=281 maxOpen=160

## PROPOSED-C (= A + groupCap kept)
  ALL:  T=1106 WR= 42% PF= 1.78 sumR=+544.4 exp=+0.49R pnl=$792315708  → balance $792316208 maxDD 60.5%
  2026: T= 753 WR= 44% PF= 1.82 sumR=+381.9 exp=+0.51R pnl=$792294128
  blocks: exposure=1092 killSwitch=577 cooldown=309 ddDaily=301 maxOpen=132 weeklyTrend=93 groupCap=87

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T=1143 WR= 44% PF= 1.94 sumR=+653.7 exp=+0.57R pnl=$14383942790  → balance $14383943290 maxDD 61.6%
  2026: T= 799 WR= 46% PF= 2.03 sumR=+488.8 exp=+0.61R pnl=$14383927034
  blocks: exposure=1085 ddRolling7d=542 cooldown=303 ddDaily=237 maxOpen=183 killSwitch=117 weeklyTrend=87

## PROPOSED-E (= D + groupCap kept)
  ALL:  T=1087 WR= 44% PF= 1.87 sumR=+584.4 exp=+0.54R pnl=$3681116384  → balance $3681116884 maxDD 63.6%
  2026: T= 745 WR= 45% PF= 1.92 sumR=+415.6 exp=+0.56R pnl=$3681090783
  blocks: exposure=1049 ddRolling7d=580 cooldown=293 ddDaily=234 maxOpen=154 killSwitch=132 weeklyTrend=87 groupCap=81

## PROPOSED-F (= E without kelly)
  ALL:  T=1254 WR= 44% PF= 1.92 sumR=+708.7 exp=+0.57R pnl=$49799644  → balance $49800144 maxDD 35.8%
  2026: T= 874 WR= 45% PF= 1.92 sumR=+492.4 exp=+0.56R pnl=$49785675
  blocks: exposure=1205 cooldown=316 killSwitch=217 ddRolling7d=216 maxOpen=150 groupCap=127 ddDaily=119 weeklyTrend=93

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T= 143 WR= 37% PF= 1.30 sumR=+30.1 exp=+0.21R pnl=$-755788
  LONG  · BTC daily neutral T=  91 WR= 33% PF= 1.19 sumR=+12.6 exp=+0.14R pnl=$1616920
  LONG  · BTC daily down    T= 177 WR= 42% PF= 1.87 sumR=+96.8 exp=+0.55R pnl=$2497495
  SHORT · BTC daily up      T= 223 WR= 60% PF= 3.68 sumR=+265.9 exp=+1.19R pnl=$25224387
  SHORT · BTC daily neutral T= 143 WR= 42% PF= 1.63 sumR=+56.9 exp=+0.40R pnl=$12362332
  SHORT · BTC daily down    T= 465 WR= 44% PF= 1.87 sumR=+248.8 exp=+0.54R pnl=$4822281
  --- by BTC weekly ---
  LONG  · BTC weekly up      T=  67 WR= 34% PF= 1.34 sumR=+16.0 exp=+0.24R pnl=$-203903
  LONG  · BTC weekly neutral T=  44 WR= 41% PF= 1.68 sumR=+19.4 exp=+0.44R pnl=$203162
  LONG  · BTC weekly down    T= 300 WR= 39% PF= 1.52 sumR=+104.0 exp=+0.35R pnl=$3359368
  SHORT · BTC weekly up      T= 145 WR= 47% PF= 2.27 sumR=+105.3 exp=+0.73R pnl=$464774
  SHORT · BTC weekly neutral T=  84 WR= 56% PF= 3.17 sumR=+88.5 exp=+1.05R pnl=$3858910
  SHORT · BTC weekly down    T= 602 WR= 47% PF= 2.07 sumR=+377.9 exp=+0.63R pnl=$38085315

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  break-retest       ALL:  T=  95 WR= 40% PF= 1.66 sumR=+39.0 exp=+0.41R pnl=$1827970
                     2026: T=  20 WR= 40% PF= 1.48 sumR=+6.0 exp=+0.30R pnl=$1827717
  rsi-divergence     ALL:  T=  51 WR= 45% PF= 1.92 sumR=+27.6 exp=+0.54R pnl=$1065496
                     2026: T=  35 WR= 46% PF= 1.67 sumR=+13.7 exp=+0.39R pnl=$1064394
  liquidity-sweep    ALL:  T=1096 WR= 45% PF= 1.97 sumR=+644.4 exp=+0.59R pnl=$42874160
                     2026: T= 796 WR= 45% PF= 1.95 sumR=+459.5 exp=+0.58R pnl=$42858902

## Per-strategy — BASELINE (all gates)
  break-retest       ALL:  T=  75 WR= 47% PF= 2.18 sumR=+48.9 exp=+0.65R pnl=$8355
                     2026: T=  13 WR= 54% PF= 2.55 sumR=+9.8 exp=+0.76R pnl=$7381
  rsi-divergence     ALL:  T=  30 WR= 33% PF= 1.35 sumR=+7.1 exp=+0.24R pnl=$-5858
                     2026: T=  18 WR= 39% PF= 1.34 sumR=+3.9 exp=+0.21R pnl=$-5817
  liquidity-sweep    ALL:  T= 305 WR= 41% PF= 1.69 sumR=+138.2 exp=+0.45R pnl=$83876
                     2026: T= 208 WR= 41% PF= 1.67 sumR=+91.6 exp=+0.44R pnl=$80916

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  break-retest       ALL:  T= 135 WR= 44% PF= 2.02 sumR=+78.9 exp=+0.58R pnl=$62100498
                     2026: T=  26 WR= 38% PF= 1.44 sumR=+7.3 exp=+0.28R pnl=$62098009
  rsi-divergence     ALL:  T=  62 WR= 44% PF= 1.82 sumR=+29.7 exp=+0.48R pnl=$9247438
                     2026: T=  40 WR= 45% PF= 1.67 sumR=+15.4 exp=+0.39R pnl=$9243014
  liquidity-sweep    ALL:  T=1360 WR= 44% PF= 1.93 sumR=+778.5 exp=+0.57R pnl=$840567719
                     2026: T= 959 WR= 45% PF= 1.94 sumR=+554.0 exp=+0.58R pnl=$840516928

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.73 sumR=+43.2 exp=+0.45R pnl=$41317402
                     2026: T=  20 WR= 40% PF= 1.58 sumR=+7.3 exp=+0.36R pnl=$41316649
  rsi-divergence     ALL:  T=  60 WR= 43% PF= 1.80 sumR=+28.0 exp=+0.47R pnl=$45363866
                     2026: T=  36 WR= 47% PF= 1.85 sumR=+16.6 exp=+0.46R pnl=$45362829
  liquidity-sweep    ALL:  T=1000 WR= 43% PF= 1.79 sumR=+500.1 exp=+0.50R pnl=$727098266
                     2026: T= 743 WR= 44% PF= 1.85 sumR=+393.4 exp=+0.53R pnl=$727090053

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  rsi-divergence     ALL:  T=  61 WR= 44% PF= 1.86 sumR=+30.2 exp=+0.50R pnl=$69653411
                     2026: T=  37 WR= 49% PF= 1.96 sumR=+18.9 exp=+0.51R pnl=$69652977
  liquidity-sweep    ALL:  T=1023 WR= 43% PF= 1.86 sumR=+549.2 exp=+0.54R pnl=$1113774079
                     2026: T= 763 WR= 45% PF= 1.93 sumR=+434.8 exp=+0.57R pnl=$1113769460

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.73 sumR=+43.2 exp=+0.45R pnl=$39412348
                     2026: T=  20 WR= 40% PF= 1.58 sumR=+7.3 exp=+0.36R pnl=$39411505
  rsi-divergence     ALL:  T=  58 WR= 41% PF= 1.69 sumR=+24.2 exp=+0.42R pnl=$45723848
                     2026: T=  35 WR= 46% PF= 1.78 sumR=+15.3 exp=+0.44R pnl=$45721916
  liquidity-sweep    ALL:  T= 952 WR= 43% PF= 1.80 sumR=+477.0 exp=+0.50R pnl=$707179513
                     2026: T= 698 WR= 44% PF= 1.83 sumR=+359.4 exp=+0.51R pnl=$707160707

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.88 sumR=+47.2 exp=+0.52R pnl=$728216144
                     2026: T=  16 WR= 44% PF= 1.98 sumR=+9.1 exp=+0.57R pnl=$728214521
  rsi-divergence     ALL:  T=  47 WR= 40% PF= 1.75 sumR=+21.6 exp=+0.46R pnl=$794740753
                     2026: T=  30 WR= 43% PF= 1.72 sumR=+12.7 exp=+0.42R pnl=$794740229
  liquidity-sweep    ALL:  T=1006 WR= 45% PF= 1.96 sumR=+584.9 exp=+0.58R pnl=$12860985892
                     2026: T= 753 WR= 46% PF= 2.04 sumR=+467.0 exp=+0.62R pnl=$12860972283

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  break-retest       ALL:  T=  90 WR= 42% PF= 1.88 sumR=+47.2 exp=+0.52R pnl=$182587109
                     2026: T=  16 WR= 44% PF= 1.98 sumR=+9.1 exp=+0.57R pnl=$182584651
  rsi-divergence     ALL:  T=  47 WR= 40% PF= 1.77 sumR=+21.9 exp=+0.47R pnl=$213460871
                     2026: T=  30 WR= 43% PF= 1.71 sumR=+12.6 exp=+0.42R pnl=$213459907
  liquidity-sweep    ALL:  T= 950 WR= 44% PF= 1.88 sumR=+515.3 exp=+0.54R pnl=$3285068404
                     2026: T= 699 WR= 45% PF= 1.93 sumR=+393.9 exp=+0.56R pnl=$3285046225

## Per-strategy — PROPOSED-F (= E without kelly)
  break-retest       ALL:  T=  96 WR= 41% PF= 1.72 sumR=+42.6 exp=+0.44R pnl=$2076907
                     2026: T=  20 WR= 40% PF= 1.53 sumR=+6.7 exp=+0.34R pnl=$2076572
  rsi-divergence     ALL:  T=  52 WR= 44% PF= 1.90 sumR=+27.2 exp=+0.52R pnl=$1087517
                     2026: T=  36 WR= 44% PF= 1.68 sumR=+14.2 exp=+0.39R pnl=$1086261
  liquidity-sweep    ALL:  T=1106 WR= 44% PF= 1.94 sumR=+638.9 exp=+0.58R pnl=$46635220
                     2026: T= 818 WR= 45% PF= 1.94 sumR=+471.6 exp=+0.58R pnl=$46622842

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
  2025-09  +$147.59
  2025-10  +$2375.63
  2025-11  +$8831.22
  2025-12  +$5567.07
  2026-01  +$119597.32
  2026-02  +$45389.53
  2026-03  +$201742.77
  2026-04  +$532923.94
  2026-05  +$2703532.41
  2026-06  +$5441888.48
  2026-07  +$15821360.00
  2026-08  +$20883964.65