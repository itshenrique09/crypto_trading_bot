# Full-Pipeline Portfolio Validation — 2026-09-07
Capital $500 · base risk 2% · candles 20000 · feed MEXC futures (engine feed) · entry slip 0 bps · gates mirror server/routes.ts (drawdown guard 12/6R over 30d, regime gates from the registry)
Entry = signal candle close (since 2026-09-01). Unmodeled: spread/funding filters, engine downtime; slippage only via --slip.

Total raw candidates (post minSL+R:R): 10183

## ENGINE-CURRENT (shipped Jul 2026)
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$59  → balance $559 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-55
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$-63  → balance $437 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-74
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## SLEEVE tsmom maxConcurrent=4
  ALL:  T= 645 WR= 35% PF= 1.06 sumR=+27.9 exp=+0.04R pnl=$1  → balance $501 maxDD 86.5%
  2026: T= 223 WR= 40% PF= 1.36 sumR=+53.7 exp=+0.24R pnl=$259
  blocks: regimeGate=5750 stratCap=1773 exposure=1523 maxOpen=169 cooldown=131 ddGuard=99 groupCap=93

## SLEEVE tsmom maxConcurrent=6
  ALL:  T= 637 WR= 35% PF= 1.04 sumR=+19.0 exp=+0.03R pnl=$40  → balance $540 maxDD 77.8%
  2026: T= 211 WR= 39% PF= 1.41 sumR=+55.5 exp=+0.26R pnl=$295
  blocks: regimeGate=5482 exposure=1932 stratCap=1497 maxOpen=259 cooldown=147 groupCap=122 ddGuard=107

## CAP maxOpen=8
  ALL:  T= 574 WR= 37% PF= 1.13 sumR=+48.7 exp=+0.08R pnl=$279  → balance $779 maxDD 57.0%
  2026: T= 123 WR= 37% PF= 1.21 sumR=+16.9 exp=+0.14R pnl=$160
  blocks: regimeGate=5594 exposure=1891 maxOpen=1877 cooldown=158 groupCap=66 ddGuard=23

## CAP maxOpen=10
  ALL:  T= 748 WR= 36% PF= 1.11 sumR=+56.7 exp=+0.08R pnl=$171  → balance $671 maxDD 61.8%
  2026: T= 146 WR= 36% PF= 1.12 sumR=+11.2 exp=+0.08R pnl=$11
  blocks: regimeGate=5429 exposure=2226 maxOpen=1370 cooldown=181 groupCap=175 ddGuard=54

## CAP perSymbol=2
  ALL:  T= 762 WR= 36% PF= 1.11 sumR=+56.4 exp=+0.07R pnl=$151  → balance $651 maxDD 65.0%
  2026: T= 153 WR= 36% PF= 1.15 sumR=+15.3 exp=+0.10R pnl=$47
  blocks: regimeGate=6576 maxOpen=1547 exposure=864 groupCap=205 cooldown=178 ddGuard=51

## CAP maxOpen=8 + perSymbol=2
  ALL:  T= 594 WR= 37% PF= 1.16 sumR=+61.3 exp=+0.10R pnl=$486  → balance $986 maxDD 55.2%
  2026: T= 134 WR= 37% PF= 1.25 sumR=+21.5 exp=+0.16R pnl=$274
  blocks: regimeGate=6585 maxOpen=2000 exposure=715 cooldown=160 groupCap=88 ddGuard=41

## CAP LS cooldown 8h
  ALL:  T= 750 WR= 36% PF= 1.12 sumR=+57.8 exp=+0.08R pnl=$181  → balance $681 maxDD 60.6%
  2026: T= 146 WR= 36% PF= 1.12 sumR=+11.2 exp=+0.08R pnl=$12
  blocks: regimeGate=5432 exposure=2228 maxOpen=1367 groupCap=175 cooldown=174 ddGuard=57

## CAP LS cooldown 6h
  ALL:  T= 750 WR= 36% PF= 1.12 sumR=+57.8 exp=+0.08R pnl=$180  → balance $680 maxDD 60.6%
  2026: T= 146 WR= 36% PF= 1.12 sumR=+11.3 exp=+0.08R pnl=$11
  blocks: regimeGate=5431 exposure=2229 maxOpen=1369 groupCap=175 cooldown=172 ddGuard=57

## CAP combo (mo8+ps2+LScd8)
  ALL:  T= 594 WR= 37% PF= 1.16 sumR=+61.3 exp=+0.10R pnl=$486  → balance $986 maxDD 55.2%
  2026: T= 134 WR= 37% PF= 1.25 sumR=+21.5 exp=+0.16R pnl=$274
  blocks: regimeGate=6587 maxOpen=2002 exposure=715 cooldown=156 groupCap=88 ddGuard=41

## CAP maxOpen=10 + perSymbol=2
  ALL:  T= 762 WR= 36% PF= 1.11 sumR=+56.4 exp=+0.07R pnl=$151  → balance $651 maxDD 65.0%
  2026: T= 153 WR= 36% PF= 1.15 sumR=+15.3 exp=+0.10R pnl=$47
  blocks: regimeGate=6576 maxOpen=1547 exposure=864 groupCap=205 cooldown=178 ddGuard=51

## CAP maxOpen=12
  ALL:  T= 874 WR= 35% PF= 1.04 sumR=+25.3 exp=+0.03R pnl=$-170  → balance $330 maxDD 79.7%
  2026: T= 210 WR= 35% PF= 1.09 sumR=+12.3 exp=+0.06R pnl=$-3
  blocks: regimeGate=5228 exposure=2549 maxOpen=880 groupCap=367 cooldown=205 ddGuard=80

## CAP groupCap=2 (pre-expansion default)
  ALL:  T= 742 WR= 35% PF= 1.06 sumR=+31.0 exp=+0.04R pnl=$-87  → balance $413 maxDD 74.5%
  2026: T= 164 WR= 35% PF= 1.11 sumR=+12.6 exp=+0.08R pnl=$14
  blocks: regimeGate=5449 exposure=2124 maxOpen=997 groupCap=643 cooldown=161 ddGuard=67

## CAP groupCap=3 + maxOpen=12
  ALL:  T= 874 WR= 35% PF= 1.04 sumR=+25.3 exp=+0.03R pnl=$-170  → balance $330 maxDD 79.7%
  2026: T= 210 WR= 35% PF= 1.09 sumR=+12.3 exp=+0.06R pnl=$-3
  blocks: regimeGate=5228 exposure=2549 maxOpen=880 groupCap=367 cooldown=205 ddGuard=80

## EXIT tp1Close=100% (all out at TP1)
  ALL:  T= 785 WR= 36% PF= 1.02 sumR=+10.8 exp=+0.01R pnl=$-241  → balance $259 maxDD 78.7%
  2026: T= 153 WR= 39% PF= 1.26 sumR=+24.6 exp=+0.16R pnl=$68
  blocks: regimeGate=5233 exposure=2232 maxOpen=1265 cooldown=332 groupCap=216 ddGuard=120

## EXIT tp1Close=50%
  ALL:  T= 738 WR= 36% PF= 1.09 sumR=+46.5 exp=+0.06R pnl=$56  → balance $556 maxDD 70.3%
  2026: T= 146 WR= 36% PF= 1.12 sumR=+11.5 exp=+0.08R pnl=$11
  blocks: regimeGate=5429 exposure=2216 maxOpen=1384 cooldown=179 groupCap=179 ddGuard=58

## EXIT tp1Close=75%
  ALL:  T= 754 WR= 37% PF= 1.11 sumR=+54.9 exp=+0.07R pnl=$205  → balance $705 maxDD 62.1%
  2026: T= 153 WR= 38% PF= 1.26 sumR=+25.6 exp=+0.17R pnl=$197
  blocks: regimeGate=5430 exposure=2230 maxOpen=1380 cooldown=183 groupCap=179 ddGuard=27

## EXIT trail 1.5%
  ALL:  T= 755 WR= 36% PF= 1.13 sumR=+67.0 exp=+0.09R pnl=$353  → balance $853 maxDD 61.6%
  2026: T= 153 WR= 38% PF= 1.28 sumR=+27.4 exp=+0.18R pnl=$260
  blocks: regimeGate=5424 exposure=2221 maxOpen=1376 cooldown=187 groupCap=179 ddGuard=41

## EXIT trail 3%
  ALL:  T= 745 WR= 36% PF= 1.07 sumR=+35.9 exp=+0.05R pnl=$-18  → balance $482 maxDD 73.9%
  2026: T= 156 WR= 36% PF= 1.15 sumR=+15.4 exp=+0.10R pnl=$53
  blocks: regimeGate=5439 exposure=2223 maxOpen=1373 cooldown=176 groupCap=170 ddGuard=57

## EXIT trail r_multiple 2R
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$59  → balance $559 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-55
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## TILT LONG:up 0.75x
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$79  → balance $579 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-42
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## TILT LONG:up 0.5x
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$98  → balance $598 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-30
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## TILT LONG:up blocked
  ALL:  T= 607 WR= 37% PF= 1.13 sumR=+52.5 exp=+0.09R pnl=$244  → balance $744 maxDD 59.0%
  2026: T= 123 WR= 41% PF= 1.41 sumR=+32.2 exp=+0.26R pnl=$252
  blocks: regimeGate=5087 exposure=2462 maxOpen=1427 groupCap=187 sizeTilt=176 cooldown=153 ddGuard=84

## TILT LONG:up 0.5x + SHORT:up 1.25x
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$41  → balance $541 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-42
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## SAMEDIR max 4
  ALL:  T= 358 WR= 40% PF= 1.23 sumR=+50.4 exp=+0.14R pnl=$617  → balance $1117 maxDD 27.4%
  2026: T=  84 WR= 38% PF= 1.33 sumR=+16.9 exp=+0.20R pnl=$266
  blocks: regimeGate=5779 sameDir=2180 exposure=1503 groupCap=264 cooldown=99

## SAMEDIR max 5
  ALL:  T= 424 WR= 38% PF= 1.16 sumR=+41.9 exp=+0.10R pnl=$417  → balance $917 maxDD 35.8%
  2026: T=  94 WR= 39% PF= 1.34 sumR=+19.2 exp=+0.20R pnl=$246
  blocks: regimeGate=5636 exposure=1751 sameDir=1729 groupCap=351 maxOpen=177 cooldown=109 ddGuard=6

## SAMEDIR max 6
  ALL:  T= 443 WR= 38% PF= 1.13 sumR=+36.6 exp=+0.08R pnl=$293  → balance $793 maxDD 37.0%
  2026: T= 112 WR= 35% PF= 1.07 sumR=+5.0 exp=+0.04R pnl=$25
  blocks: regimeGate=5518 exposure=1938 sameDir=1384 groupCap=416 maxOpen=358 cooldown=120 ddGuard=6

## SAMEDIR max 7
  ALL:  T= 467 WR= 37% PF= 1.06 sumR=+18.9 exp=+0.04R pnl=$46  → balance $546 maxDD 45.2%
  2026: T= 108 WR= 32% PF= 0.91 sumR=-6.4 exp=-0.06R pnl=$-113
  blocks: regimeGate=5387 exposure=2101 sameDir=1139 maxOpen=497 groupCap=451 cooldown=118 ddGuard=23

## VENUE Kraken (−LUNC)
  ALL:  T= 522 WR= 38% PF= 1.08 sumR=+27.3 exp=+0.05R pnl=$59  → balance $559 maxDD 44.4%
  2026: T= 101 WR= 36% PF= 0.97 sumR=-2.3 exp=-0.02R pnl=$-55
  blocks: regimeGate=5093 exposure=2514 maxOpen=1722 groupCap=154 cooldown=136 ddGuard=42

## VENUE OKX (−LUNC,FET,RUNE,VET)
  ALL:  T= 511 WR= 38% PF= 1.09 sumR=+29.5 exp=+0.06R pnl=$97  → balance $597 maxDD 45.3%
  2026: T=  98 WR= 37% PF= 1.12 sumR=+7.6 exp=+0.08R pnl=$41
  blocks: regimeGate=4643 exposure=2485 maxOpen=1514 groupCap=167 cooldown=127 ddGuard=14

## TRIAGE minus rsi-divergence
  ALL:  T= 557 WR= 31% PF= 0.99 sumR=-5.1 exp=-0.01R pnl=$-327  → balance $173 maxDD 92.5%
  2026: T= 254 WR= 39% PF= 1.35 sumR=+59.5 exp=+0.23R pnl=$92
  blocks: regimeGate=6369 exposure=518 ddGuard=204 cooldown=88 groupCap=55 maxOpen=27

## BASELINE (all gates)
  ALL:  T= 167 WR= 38% PF= 1.14 sumR=+15.6 exp=+0.09R pnl=$223  → balance $723 maxDD 46.9%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-404
  blocks: regimeGate=6109 atrPct=1064 shortConf=851 maxOpen=483 exposure=419 dirOverlay=354 ddMonthly=283 ddRolling7d=241 killSwitch=83 ddDaily=53 cooldown=48 dailyTrend=15 groupCap=9 ddGuard=4

## minus dirOverlay
  ALL:  T= 236 WR= 36% PF= 1.10 sumR=+16.1 exp=+0.07R pnl=$148  → balance $648 maxDD 47.1%
  2026: T=  62 WR= 29% PF= 0.90 sumR=-4.8 exp=-0.08R pnl=$-385
  blocks: regimeGate=5946 atrPct=964 shortConf=865 ddMonthly=685 maxOpen=492 exposure=487 killSwitch=171 ddRolling7d=169 ddDaily=62 cooldown=56 dailyTrend=28 groupCap=11 ddGuard=11

## minus dailyTrend
  ALL:  T= 167 WR= 38% PF= 1.14 sumR=+15.6 exp=+0.09R pnl=$223  → balance $723 maxDD 46.9%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-404
  blocks: regimeGate=6109 atrPct=1064 shortConf=866 maxOpen=483 exposure=419 dirOverlay=354 ddMonthly=283 ddRolling7d=241 killSwitch=83 ddDaily=53 cooldown=48 groupCap=9 ddGuard=4

## minus weeklyTrend
  ALL:  T= 167 WR= 38% PF= 1.14 sumR=+15.6 exp=+0.09R pnl=$223  → balance $723 maxDD 46.9%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-404
  blocks: regimeGate=6109 atrPct=1064 shortConf=851 maxOpen=483 exposure=419 dirOverlay=354 ddMonthly=283 ddRolling7d=241 killSwitch=83 ddDaily=53 cooldown=48 dailyTrend=15 groupCap=9 ddGuard=4

## minus shortConf
  ALL:  T= 201 WR= 40% PF= 1.27 sumR=+33.2 exp=+0.17R pnl=$264  → balance $764 maxDD 33.6%
  2026: T=  33 WR= 24% PF= 0.66 sumR=-8.4 exp=-0.25R pnl=$-416
  blocks: regimeGate=5998 maxOpen=1477 exposure=857 atrPct=819 ddMonthly=307 dirOverlay=289 cooldown=60 ddRolling7d=60 killSwitch=53 ddDaily=42 groupCap=14 dailyTrend=6

## minus atrPct
  ALL:  T= 306 WR= 38% PF= 1.12 sumR=+22.7 exp=+0.07R pnl=$-7  → balance $493 maxDD 73.7%
  2026: T=  66 WR= 32% PF= 0.74 sumR=-12.6 exp=-0.19R pnl=$-299
  blocks: regimeGate=5589 maxOpen=1063 shortConf=835 ddMonthly=797 exposure=686 dirOverlay=371 ddRolling7d=276 ddDaily=108 cooldown=85 killSwitch=46 ddGuard=9 groupCap=7 dailyTrend=5

## minus btcCap
  ALL:  T= 231 WR= 40% PF= 1.30 sumR=+43.1 exp=+0.19R pnl=$46  → balance $546 maxDD 76.2%
  2026: T=  86 WR= 33% PF= 1.02 sumR=+1.3 exp=+0.01R pnl=$-628
  blocks: regimeGate=5944 atrPct=1074 shortConf=888 exposure=542 ddMonthly=542 dirOverlay=376 ddRolling7d=157 maxOpen=120 ddDaily=98 killSwitch=65 cooldown=60 groupCap=40 dailyTrend=29 ddGuard=17

## minus groupCap
  ALL:  T= 168 WR= 38% PF= 1.16 sumR=+17.6 exp=+0.10R pnl=$228  → balance $728 maxDD 46.9%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-407
  blocks: regimeGate=6109 atrPct=1071 shortConf=853 maxOpen=486 exposure=418 dirOverlay=352 ddMonthly=283 ddRolling7d=241 killSwitch=83 ddDaily=53 cooldown=47 dailyTrend=15 ddGuard=4

## minus killSwitch
  ALL:  T= 172 WR= 35% PF= 1.04 sumR=+4.5 exp=+0.03R pnl=$111  → balance $611 maxDD 53.9%
  2026: T=  57 WR= 19% PF= 0.54 sumR=-23.1 exp=-0.41R pnl=$-485
  blocks: regimeGate=6038 atrPct=1047 shortConf=862 maxOpen=486 ddMonthly=436 exposure=418 dirOverlay=380 ddRolling7d=194 ddDaily=53 cooldown=48 dailyTrend=21 ddGuard=19 groupCap=9

## minus ddDaily
  ALL:  T= 167 WR= 38% PF= 1.14 sumR=+15.6 exp=+0.09R pnl=$223  → balance $723 maxDD 46.9%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-404
  blocks: regimeGate=6115 atrPct=1088 shortConf=871 maxOpen=483 exposure=419 dirOverlay=354 ddMonthly=284 ddRolling7d=243 killSwitch=83 cooldown=48 dailyTrend=15 groupCap=9 ddGuard=4

## minus ddMonthly
  ALL:  T= 170 WR= 38% PF= 1.17 sumR=+18.3 exp=+0.11R pnl=$294  → balance $794 maxDD 46.9%
  2026: T=  54 WR= 24% PF= 0.68 sumR=-14.2 exp=-0.26R pnl=$-443
  blocks: regimeGate=6336 atrPct=1077 shortConf=856 maxOpen=483 exposure=447 dirOverlay=354 ddRolling7d=246 killSwitch=83 ddDaily=53 cooldown=50 dailyTrend=15 groupCap=9 ddGuard=4

## minus ddRolling
  ALL:  T= 169 WR= 37% PF= 1.14 sumR=+15.9 exp=+0.09R pnl=$172  → balance $672 maxDD 55.6%
  2026: T=  56 WR= 23% PF= 0.71 sumR=-13.9 exp=-0.25R pnl=$-454
  blocks: regimeGate=6111 atrPct=1036 shortConf=882 ddMonthly=483 maxOpen=482 exposure=425 dirOverlay=380 killSwitch=76 ddDaily=53 cooldown=45 dailyTrend=26 groupCap=9 ddGuard=6

## minus kelly
  ALL:  T= 172 WR= 38% PF= 1.19 sumR=+21.3 exp=+0.12R pnl=$199  → balance $699 maxDD 32.9%
  2026: T=  56 WR= 25% PF= 0.76 sumR=-11.1 exp=-0.20R pnl=$-227
  blocks: regimeGate=6340 atrPct=1081 shortConf=907 maxOpen=500 exposure=456 dirOverlay=380 ddMonthly=153 killSwitch=79 cooldown=50 dailyTrend=27 ddRolling7d=24 groupCap=9 ddGuard=4 ddDaily=1

## minus riskMult
  ALL:  T= 171 WR= 39% PF= 1.19 sumR=+20.6 exp=+0.12R pnl=$317  → balance $817 maxDD 40.6%
  2026: T=  58 WR= 28% PF= 0.80 sumR=-9.2 exp=-0.16R pnl=$-261
  blocks: regimeGate=6106 atrPct=1069 shortConf=853 maxOpen=507 exposure=432 dirOverlay=354 ddMonthly=283 ddRolling7d=183 killSwitch=90 ddDaily=53 cooldown=50 dailyTrend=19 groupCap=9 ddGuard=4

## minus ddGuard
  ALL:  T= 167 WR= 37% PF= 1.12 sumR=+12.9 exp=+0.08R pnl=$132  → balance $632 maxDD 53.6%
  2026: T=  54 WR= 22% PF= 0.63 sumR=-16.9 exp=-0.31R pnl=$-495
  blocks: regimeGate=6053 atrPct=1031 shortConf=847 maxOpen=487 ddMonthly=436 exposure=417 dirOverlay=353 ddRolling7d=184 killSwitch=83 ddDaily=53 cooldown=48 dailyTrend=15 groupCap=9

## minus regimeGate
  ALL:  T= 780 WR= 31% PF= 0.99 sumR=-5.2 exp=-0.01R pnl=$-63  → balance $437 maxDD 76.0%
  2026: T= 184 WR= 33% PF= 1.08 sumR=+10.8 exp=+0.06R pnl=$-121
  blocks: killSwitch=1761 atrPct=1686 maxOpen=1603 shortConf=1196 ddMonthly=1042 exposure=923 dirOverlay=399 ddRolling7d=332 ddGuard=157 cooldown=145 ddDaily=86 dailyTrend=57 groupCap=16

## LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  ALL:  T= 785 WR= 34% PF= 1.02 sumR=+12.6 exp=+0.02R pnl=$-243  → balance $257 maxDD 86.4%
  2026: T= 158 WR= 36% PF= 1.17 sumR=+17.7 exp=+0.11R pnl=$27
  blocks: regimeGate=5355 exposure=2296 maxOpen=1447 cooldown=188 ddGuard=112

## LS-only BASELINE
  ALL:  T=  60 WR= 35% PF= 1.27 sumR=+11.8 exp=+0.20R pnl=$40  → balance $540 maxDD 28.1%
  2026: T=  56 WR= 38% PF= 1.41 sumR=+16.1 exp=+0.29R pnl=$67
  blocks: regimeGate=6443 dirOverlay=379 atrPct=308 ddMonthly=249 maxOpen=119 killSwitch=75 exposure=61 shortConf=39 dailyTrend=32 ddDaily=22 cooldown=18 ddRolling7d=13

## LS-only LEAN
  ALL:  T= 603 WR= 30% PF= 0.98 sumR=-10.4 exp=-0.02R pnl=$-361  → balance $139 maxDD 93.6%
  2026: T= 271 WR= 38% PF= 1.32 sumR=+58.5 exp=+0.22R pnl=$72
  blocks: regimeGate=6374 exposure=559 ddGuard=159 cooldown=80 maxOpen=43

## LS+RSI LEAN
  ALL:  T= 603 WR= 30% PF= 0.98 sumR=-10.4 exp=-0.02R pnl=$-361  → balance $139 maxDD 93.6%
  2026: T= 271 WR= 38% PF= 1.32 sumR=+58.5 exp=+0.22R pnl=$72
  blocks: regimeGate=6374 exposure=559 ddGuard=159 cooldown=80 maxOpen=43

## PROPOSED-A (LS+RSI+BR, pruned gates)
  ALL:  T= 357 WR= 32% PF= 1.10 sumR=+26.4 exp=+0.07R pnl=$-104  → balance $396 maxDD 47.1%
  2026: T= 188 WR= 40% PF= 1.40 sumR=+50.0 exp=+0.27R pnl=$63
  blocks: regimeGate=6479 killSwitch=477 exposure=345 ddGuard=78 cooldown=48 maxOpen=25 ddDaily=9

## PROPOSED-B (LS+RSI, pruned gates)
  ALL:  T= 357 WR= 32% PF= 1.10 sumR=+26.4 exp=+0.07R pnl=$-104  → balance $396 maxDD 47.1%
  2026: T= 188 WR= 40% PF= 1.40 sumR=+50.0 exp=+0.27R pnl=$63
  blocks: regimeGate=6479 killSwitch=477 exposure=345 ddGuard=78 cooldown=48 maxOpen=25 ddDaily=9

## PROPOSED-C (= A + groupCap kept)
  ALL:  T= 347 WR= 32% PF= 1.05 sumR=+13.4 exp=+0.04R pnl=$-138  → balance $362 maxDD 47.1%
  2026: T= 179 WR= 39% PF= 1.32 sumR=+38.9 exp=+0.22R pnl=$32
  blocks: regimeGate=6481 killSwitch=481 exposure=340 ddGuard=78 cooldown=48 groupCap=21 maxOpen=20 ddDaily=2

## PROPOSED-D (= A + ddRolling kept)
  ALL:  T= 357 WR= 32% PF= 1.10 sumR=+26.4 exp=+0.07R pnl=$-104  → balance $396 maxDD 47.1%
  2026: T= 188 WR= 40% PF= 1.40 sumR=+50.0 exp=+0.27R pnl=$63
  blocks: regimeGate=6331 killSwitch=390 exposure=345 ddRolling7d=235 ddGuard=78 cooldown=48 maxOpen=25 ddDaily=9

## PROPOSED-E (= D + groupCap kept)
  ALL:  T= 347 WR= 32% PF= 1.05 sumR=+13.4 exp=+0.04R pnl=$-138  → balance $362 maxDD 47.1%
  2026: T= 179 WR= 39% PF= 1.32 sumR=+38.9 exp=+0.22R pnl=$32
  blocks: regimeGate=6342 killSwitch=400 exposure=340 ddRolling7d=220 ddGuard=78 cooldown=48 groupCap=21 maxOpen=20 ddDaily=2

## PROPOSED-F (= E without kelly)
  ALL:  T= 341 WR= 33% PF= 1.13 sumR=+33.2 exp=+0.10R pnl=$-47  → balance $453 maxDD 74.5%
  2026: T= 168 WR= 38% PF= 1.22 sumR=+26.1 exp=+0.16R pnl=$111
  blocks: regimeGate=5971 ddRolling7d=830 exposure=336 ddDaily=91 ddGuard=85 killSwitch=82 cooldown=46 maxOpen=19 groupCap=17

## Direction × BTC regime — ENGINE-CURRENT (shipped Jul 2026)
  LONG  · BTC daily up      T=  55 WR= 33% PF= 0.78 sumR=-8.5 exp=-0.15R pnl=$-84
  LONG  · BTC daily neutral T= 215 WR= 38% PF= 1.07 sumR=+9.6 exp=+0.04R pnl=$6
  LONG  · BTC daily down    T=   9 WR= 44% PF= 1.53 sumR=+2.7 exp=+0.30R pnl=$29
  SHORT · BTC daily up      T= 111 WR= 29% PF= 0.86 sumR=-12.8 exp=-0.12R pnl=$-143
  SHORT · BTC daily neutral T=  94 WR= 44% PF= 1.11 sumR=+6.1 exp=+0.07R pnl=$13
  SHORT · BTC daily down    T=  38 WR= 61% PF= 3.26 sumR=+30.2 exp=+0.79R pnl=$238
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 214 WR= 36% PF= 1.02 sumR=+3.1 exp=+0.01R pnl=$-34
  LONG  · BTC weekly neutral T=  25 WR= 36% PF= 0.96 sumR=-0.7 exp=-0.03R pnl=$-11
  LONG  · BTC weekly down    T=  40 WR= 40% PF= 1.06 sumR=+1.4 exp=+0.03R pnl=$-4
  SHORT · BTC weekly up      T= 169 WR= 40% PF= 1.16 sumR=+17.6 exp=+0.10R pnl=$41
  SHORT · BTC weekly neutral T=  27 WR= 41% PF= 1.25 sumR=+4.3 exp=+0.16R pnl=$55
  SHORT · BTC weekly down    T=  47 WR= 36% PF= 1.05 sumR=+1.5 exp=+0.03R pnl=$13

## Direction × BTC regime — ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  LONG  · BTC daily up      T=  55 WR= 33% PF= 0.78 sumR=-8.5 exp=-0.15R pnl=$-94
  LONG  · BTC daily neutral T= 215 WR= 38% PF= 1.07 sumR=+9.6 exp=+0.04R pnl=$6
  LONG  · BTC daily down    T=   9 WR= 44% PF= 1.53 sumR=+2.7 exp=+0.30R pnl=$18
  SHORT · BTC daily up      T= 111 WR= 29% PF= 0.86 sumR=-12.8 exp=-0.12R pnl=$-169
  SHORT · BTC daily neutral T=  94 WR= 44% PF= 1.11 sumR=+6.1 exp=+0.07R pnl=$13
  SHORT · BTC daily down    T=  38 WR= 61% PF= 3.26 sumR=+30.2 exp=+0.79R pnl=$162
  --- by BTC weekly ---
  LONG  · BTC weekly up      T= 214 WR= 36% PF= 1.02 sumR=+3.1 exp=+0.01R pnl=$-39
  LONG  · BTC weekly neutral T=  25 WR= 36% PF= 0.96 sumR=-0.7 exp=-0.03R pnl=$-18
  LONG  · BTC weekly down    T=  40 WR= 40% PF= 1.06 sumR=+1.4 exp=+0.03R pnl=$-13
  SHORT · BTC weekly up      T= 169 WR= 40% PF= 1.16 sumR=+17.6 exp=+0.10R pnl=$-17
  SHORT · BTC weekly neutral T=  27 WR= 41% PF= 1.25 sumR=+4.3 exp=+0.16R pnl=$21
  SHORT · BTC weekly down    T=  47 WR= 36% PF= 1.05 sumR=+1.5 exp=+0.03R pnl=$3

## Per-strategy — ENGINE-CURRENT (shipped Jul 2026)
  liquidity-sweep    ALL:  T= 108 WR= 29% PF= 0.85 sumR=-13.2 exp=-0.12R pnl=$-146
                     2026: T=  46 WR= 33% PF= 0.92 sumR=-2.8 exp=-0.06R pnl=$-48
  tsmom-daily        ALL:  T= 414 WR= 41% PF= 1.16 sumR=+40.5 exp=+0.10R pnl=$205
                     2026: T=  55 WR= 38% PF= 1.02 sumR=+0.5 exp=+0.01R pnl=$-8

## Per-strategy — ENGINE + riskMult ×1.25/×0.75 (legacy sizing)
  liquidity-sweep    ALL:  T= 108 WR= 29% PF= 0.85 sumR=-13.2 exp=-0.12R pnl=$-169
                     2026: T=  46 WR= 33% PF= 0.92 sumR=-2.8 exp=-0.06R pnl=$-47
  tsmom-daily        ALL:  T= 414 WR= 41% PF= 1.16 sumR=+40.5 exp=+0.10R pnl=$106
                     2026: T=  55 WR= 38% PF= 1.02 sumR=+0.5 exp=+0.01R pnl=$-27

## Per-strategy — BASELINE (all gates)
  liquidity-sweep    ALL:  T=  40 WR= 25% PF= 0.76 sumR=-8.3 exp=-0.21R pnl=$-98
                     2026: T=  36 WR= 28% PF= 0.87 sumR=-3.9 exp=-0.11R pnl=$-53
  tsmom-daily        ALL:  T= 127 WR= 42% PF= 1.32 sumR=+23.9 exp=+0.19R pnl=$320
                     2026: T=  18 WR= 17% PF= 0.33 sumR=-10.2 exp=-0.57R pnl=$-350

## Per-strategy — LEAN (only exposure+cooldown+maxOpen6, opinion filters off)
  liquidity-sweep    ALL:  T= 214 WR= 25% PF= 0.76 sumR=-42.7 exp=-0.20R pnl=$-400
                     2026: T=  79 WR= 37% PF= 1.37 sumR=+20.2 exp=+0.26R pnl=$46
  tsmom-daily        ALL:  T= 571 WR= 38% PF= 1.15 sumR=+55.3 exp=+0.10R pnl=$157
                     2026: T=  79 WR= 35% PF= 0.95 sumR=-2.5 exp=-0.03R pnl=$-19

## Per-strategy — PROPOSED-A (LS+RSI+BR, pruned gates)
  liquidity-sweep    ALL:  T= 357 WR= 32% PF= 1.10 sumR=+26.4 exp=+0.07R pnl=$-104
                     2026: T= 188 WR= 40% PF= 1.40 sumR=+50.0 exp=+0.27R pnl=$63

## Per-strategy — PROPOSED-B (LS+RSI, pruned gates)
  liquidity-sweep    ALL:  T= 357 WR= 32% PF= 1.10 sumR=+26.4 exp=+0.07R pnl=$-104
                     2026: T= 188 WR= 40% PF= 1.40 sumR=+50.0 exp=+0.27R pnl=$63

## Per-strategy — PROPOSED-C (= A + groupCap kept)
  liquidity-sweep    ALL:  T= 347 WR= 32% PF= 1.05 sumR=+13.4 exp=+0.04R pnl=$-138
                     2026: T= 179 WR= 39% PF= 1.32 sumR=+38.9 exp=+0.22R pnl=$32

## Per-strategy — PROPOSED-D (= A + ddRolling kept)
  liquidity-sweep    ALL:  T= 357 WR= 32% PF= 1.10 sumR=+26.4 exp=+0.07R pnl=$-104
                     2026: T= 188 WR= 40% PF= 1.40 sumR=+50.0 exp=+0.27R pnl=$63

## Per-strategy — PROPOSED-E (= D + groupCap kept)
  liquidity-sweep    ALL:  T= 347 WR= 32% PF= 1.05 sumR=+13.4 exp=+0.04R pnl=$-138
                     2026: T= 179 WR= 39% PF= 1.32 sumR=+38.9 exp=+0.22R pnl=$32

## Per-strategy — PROPOSED-F (= E without kelly)
  liquidity-sweep    ALL:  T= 341 WR= 33% PF= 1.13 sumR=+33.2 exp=+0.10R pnl=$-47
                     2026: T= 168 WR= 38% PF= 1.22 sumR=+26.1 exp=+0.16R pnl=$111

NOTE: pnl/balance columns assume unlimited liquidity at fixed-fractional sizing —
they are directionally useful, NOT projections. Decide on R metrics (sumR/exp/PF/maxDD).
4h streams (break-retest) span ~3.7y; 1h streams span ~1y — ALL windows differ per strategy.
## Monthly P&L — ENGINE-CURRENT (shipped Jul 2026)
  2022-10  $-20.39
  2022-11  $-61.65
  2022-12  +$0.93
  2023-01  +$33.89
  2023-02  $-23.60
  2023-03  $-130.28
  2023-04  $-2.88
  2023-05  $-12.07
  2023-06  +$50.19
  2023-07  $-24.09
  2023-08  $-16.94
  2023-09  +$8.56
  2023-10  +$14.47
  2023-11  +$50.60
  2023-12  +$108.69
  2024-01  $-25.65
  2024-02  +$0.36
  2024-03  $-31.91
  2024-04  $-33.05
  2024-05  +$2.62
  2024-06  $-23.58
  2024-07  +$2.28
  2024-08  +$0.31
  2024-10  +$64.42
  2024-11  $-18.22
  2024-12  +$12.98
  2025-01  $-25.93
  2025-05  $-21.04
  2025-06  $-13.05
  2025-07  $-10.40
  2025-08  +$40.97
  2025-09  $-37.38
  2025-10  +$79.34
  2025-11  +$35.07
  2026-01  $-28.49
  2026-02  +$21.63
  2026-04  +$97.56
  2026-05  +$11.71
  2026-06  +$26.70
  2026-07  +$28.54
  2026-08  $-23.84
  2026-09  $-48.19