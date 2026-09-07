# Phase 9 — engine architecture research — 2026-09-02
candles 20000 · capital $500 · base risk 2% · entry = signal candle close (fixed strategy code) · exits ENGINE (TP1 60% → BE → 2R trail)

universe: 40 coins (LS 40)

## A. Live-scale realism — Kraken Futures, 1.5% stop, taker 0.05% × 2 legs (data 20260902)
Baseline fee share of 1R at a 1.5% stop = 0.10% ÷ 1.5% = 6.7% before lot rounding. Lot rounding is FLOOR (kraken-client roundSize), so real risk ≤ planned.

### $110 / 0.5% — risk $0.55 → planned notional $36.67
| coin | price | prec | contracts (raw → lot) | lot err % | real risk $ | fee % of 1R | TP1 60% lot | runner lot | tradeable | partial ok |
|---|---|---|---|---|---|---|---|---|---|---|
| SOL | 99.48 | 2 | 0.3686 → 0.36 | 2.3 | 0.54 | 6.5 | 0.21 | 0.15 | yes | yes |
| SAND | 0.03872 | 0 | 946.9697 → 946 | 0.1 | 0.55 | 6.7 | 567 | 379 | yes | yes |
| BNB | 687.39 | 2 | 0.0533 → 0.05 | 6.3 | 0.52 | 6.2 | 0.03 | 0.020000000000000004 | yes | yes |
| XRP | 1.3419 | 0 | 27.3244 → 27 | 1.2 | 0.54 | 6.6 | 16 | 11 | yes | yes |
| AVAX | 7.169 | 2 | 5.1146 → 5.11 | 0.1 | 0.55 | 6.7 | 3.06 | 2.0500000000000003 | yes | yes |
| ETC | 7.23 | 1 | 5.0715 → 5 | 1.4 | 0.54 | 6.6 | 3 | 2 | yes | yes |
| ATOM | 1.459 | 1 | 25.1314 → 25.1 | 0.1 | 0.55 | 6.7 | 15 | 10.100000000000001 | yes | yes |
| INJ | 4.746 | 1 | 7.7258 → 7.7 | 0.3 | 0.55 | 6.6 | 4.6 | 3.1000000000000005 | yes | yes |
| UNI | 5.822 | 1 | 6.2980 → 6.2 | 1.6 | 0.54 | 6.6 | 3.7 | 2.5 | yes | yes |
| ICP | 2.482 | 1 | 14.7730 → 14.7 | 0.5 | 0.55 | 6.6 | 8.8 | 5.899999999999999 | yes | yes |
| AAVE | 127.08 | 2 | 0.2885 → 0.28 | 3.0 | 0.53 | 6.5 | 0.16 | 0.12000000000000002 | yes | yes |
| PEPE | 0.00000339 | -3 | 10816125.8604 → 10816000 | 0.0 | 0.55 | 6.7 | 6489000 | 4327000 | yes | yes |
| BCH | 243.7 | 2 | 0.1505 → 0.15 | 0.3 | 0.55 | 6.6 | 0.09 | 0.06 | yes | yes |
| FIL | 0.8043 | 1 | 45.5883 → 45.5 | 0.2 | 0.55 | 6.7 | 27.3 | 18.2 | yes | yes |
| LTC | 49.56 | 2 | 0.7398 → 0.73 | 1.3 | 0.54 | 6.6 | 0.43 | 0.3 | yes | yes |
| DOGE | 0.08159 | 0 | 449.4015 → 449 | 0.1 | 0.55 | 6.7 | 269 | 180 | yes | yes |
| NEAR | 1.851 | 0 | 19.8091 → 19 | 4.1 | 0.53 | 6.4 | 11 | 8 | yes | yes |
| DOT | 0.859 | 1 | 42.6853 → 42.6 | 0.2 | 0.55 | 6.7 | 25.5 | 17.1 | yes | yes |
| LINK | 11.143 | 1 | 3.2906 → 3.2 | 2.8 | 0.53 | 6.5 | 1.9 | 1.3000000000000003 | yes | yes |
| APT | 0.56 | 1 | 65.4762 → 65.4 | 0.1 | 0.55 | 6.7 | 39.2 | 26.200000000000003 | yes | yes |
| HBAR | 0.07399 | 0 | 495.5625 → 495 | 0.1 | 0.55 | 6.7 | 297 | 198 | yes | yes |
| SEI | 0.04855 | 0 | 755.2352 → 755 | 0.0 | 0.55 | 6.7 | 453 | 302 | yes | yes |
| ETH | 2396.16 | 3 | 0.0153 → 0.015 | 2.0 | 0.54 | 6.5 | 0.009 | 0.006 | yes | yes |
| SUI | 0.7264 | 0 | 50.4772 → 50 | 0.9 | 0.54 | 6.6 | 30 | 20 | yes | yes |
| ARB | 0.1247 | 0 | 294.0390 → 294 | 0.0 | 0.55 | 6.7 | 176 | 118 | yes | yes |
| TIA | 0.3533 | 1 | 103.7834 → 103.7 | 0.1 | 0.55 | 6.7 | 62.2 | 41.5 | yes | yes |
| BTC | 77450.93 | 4 | 0.0005 → 0.0004 | 15.5 | 0.46 | 5.6 | 0.0002 | 0.0002 | yes | yes |
| FET | 0.1514 | 0 | 242.1841 → 242 | 0.1 | 0.55 | 6.7 | 145 | 97 | yes | yes |
| RENDER | 1.411 | 1 | 25.9863 → 25.9 | 0.3 | 0.55 | 6.6 | 15.5 | 10.399999999999999 | yes | yes |
| ONDO | 0.3409 | 0 | 107.5584 → 107 | 0.5 | 0.55 | 6.6 | 64 | 43 | yes | yes |
| ENA | 0.15 | 0 | 244.4444 → 244 | 0.2 | 0.55 | 6.7 | 146 | 98 | yes | yes |
| WLD | 0.3597 | 0 | 101.9368 → 101 | 0.9 | 0.54 | 6.6 | 60 | 41 | yes | yes |
| CRV | 0.3569 | 0 | 102.7365 → 102 | 0.7 | 0.55 | 6.6 | 61 | 41 | yes | yes |
| GALA | 0.001749 | 0 | 20964.3606 → 20964 | 0.0 | 0.55 | 6.7 | 12578 | 8386 | yes | yes |
| RUNE | 0.474 | 0 | 77.3558 → 77 | 0.5 | 0.55 | 6.6 | 46 | 31 | yes | yes |
| GRT | 0.01616 | 0 | 2268.9769 → 2268 | 0.0 | 0.55 | 6.7 | 1360 | 908 | yes | yes |
| IMX | 0.1236 | 0 | 296.6559 → 296 | 0.2 | 0.55 | 6.7 | 177 | 119 | yes | yes |
| POL | 0.09157 | 0 | 400.4223 → 400 | 0.1 | 0.55 | 6.7 | 240 | 160 | yes | yes |
| VET | 0.00656 | 0 | 5589.4309 → 5589 | 0.0 | 0.55 | 6.7 | 3353 | 2236 | yes | yes |
| ADA | 0.1971 | 0 | 186.0308 → 186 | 0.0 | 0.55 | 6.7 | 111 | 75 | yes | yes |

Untradeable at $110 / 0.5% (lot rounds to zero or >25% under-size): none
Tradeable but TP1 60% partial / runner rounds to zero: none
Lot rounding error > 10% (risk materially under the plan): BTC 16%

### $1000 / 1% — risk $10.00 → planned notional $666.67
| coin | price | prec | contracts (raw → lot) | lot err % | real risk $ | fee % of 1R | TP1 60% lot | runner lot | tradeable | partial ok |
|---|---|---|---|---|---|---|---|---|---|---|
| SOL | 99.48 | 2 | 6.7015 → 6.7 | 0.0 | 10.00 | 6.7 | 4.01 | 2.6900000000000004 | yes | yes |
| SAND | 0.03872 | 0 | 17217.6309 → 17217 | 0.0 | 10.00 | 6.7 | 10330 | 6887 | yes | yes |
| BNB | 687.39 | 2 | 0.9699 → 0.96 | 1.0 | 9.90 | 6.6 | 0.57 | 0.39 | yes | yes |
| XRP | 1.3419 | 0 | 496.8080 → 496 | 0.2 | 9.98 | 6.7 | 297 | 199 | yes | yes |
| AVAX | 7.169 | 2 | 92.9930 → 92.99 | 0.0 | 10.00 | 6.7 | 55.79 | 37.199999999999996 | yes | yes |
| ETC | 7.23 | 1 | 92.2084 → 92.2 | 0.0 | 10.00 | 6.7 | 55.3 | 36.900000000000006 | yes | yes |
| ATOM | 1.459 | 1 | 456.9340 → 456.9 | 0.0 | 10.00 | 6.7 | 274.1 | 182.79999999999995 | yes | yes |
| INJ | 4.746 | 1 | 140.4692 → 140.4 | 0.0 | 10.00 | 6.7 | 84.2 | 56.2 | yes | yes |
| UNI | 5.822 | 1 | 114.5082 → 114.5 | 0.0 | 10.00 | 6.7 | 68.7 | 45.8 | yes | yes |
| ICP | 2.482 | 1 | 268.6006 → 268.6 | 0.0 | 10.00 | 6.7 | 161.1 | 107.50000000000003 | yes | yes |
| AAVE | 127.08 | 2 | 5.2460 → 5.24 | 0.1 | 9.99 | 6.7 | 3.14 | 2.1 | yes | yes |
| PEPE | 0.00000339 | -3 | 196656833.8250 → 196656000 | 0.0 | 10.00 | 6.7 | 117993000 | 78663000 | yes | yes |
| BCH | 243.7 | 2 | 2.7356 → 2.73 | 0.2 | 9.98 | 6.7 | 1.63 | 1.1 | yes | yes |
| FIL | 0.8043 | 1 | 828.8781 → 828.8 | 0.0 | 10.00 | 6.7 | 497.2 | 331.59999999999997 | yes | yes |
| LTC | 49.56 | 2 | 13.4517 → 13.45 | 0.0 | 10.00 | 6.7 | 8.06 | 5.389999999999999 | yes | yes |
| DOGE | 0.08159 | 0 | 8170.9360 → 8170 | 0.0 | 10.00 | 6.7 | 4902 | 3268 | yes | yes |
| NEAR | 1.851 | 0 | 360.1657 → 360 | 0.0 | 10.00 | 6.7 | 216 | 144 | yes | yes |
| DOT | 0.859 | 1 | 776.0962 → 776 | 0.0 | 10.00 | 6.7 | 465.6 | 310.4 | yes | yes |
| LINK | 11.143 | 1 | 59.8283 → 59.8 | 0.0 | 10.00 | 6.7 | 35.8 | 24 | yes | yes |
| APT | 0.56 | 1 | 1190.4762 → 1190.4 | 0.0 | 10.00 | 6.7 | 714.2 | 476.20000000000005 | yes | yes |
| HBAR | 0.07399 | 0 | 9010.2266 → 9010 | 0.0 | 10.00 | 6.7 | 5406 | 3604 | yes | yes |
| SEI | 0.04855 | 0 | 13731.5482 → 13731 | 0.0 | 10.00 | 6.7 | 8238 | 5493 | yes | yes |
| ETH | 2396.16 | 3 | 0.2782 → 0.278 | 0.1 | 9.99 | 6.7 | 0.166 | 0.11200000000000002 | yes | yes |
| SUI | 0.7264 | 0 | 917.7680 → 917 | 0.1 | 9.99 | 6.7 | 550 | 367 | yes | yes |
| ARB | 0.1247 | 0 | 5346.1641 → 5346 | 0.0 | 10.00 | 6.7 | 3207 | 2139 | yes | yes |
| TIA | 0.3533 | 1 | 1886.9705 → 1886.9 | 0.0 | 10.00 | 6.7 | 1132.1 | 754.8000000000002 | yes | yes |
| BTC | 77450.93 | 4 | 0.0086 → 0.0086 | 0.1 | 9.99 | 6.7 | 0.0051 | 0.0034999999999999996 | yes | yes |
| FET | 0.1514 | 0 | 4403.3465 → 4403 | 0.0 | 10.00 | 6.7 | 2641 | 1762 | yes | yes |
| RENDER | 1.411 | 1 | 472.4781 → 472.4 | 0.0 | 10.00 | 6.7 | 283.4 | 189 | yes | yes |
| ONDO | 0.3409 | 0 | 1955.6077 → 1955 | 0.0 | 10.00 | 6.7 | 1173 | 782 | yes | yes |
| ENA | 0.15 | 0 | 4444.4444 → 4444 | 0.0 | 10.00 | 6.7 | 2666 | 1778 | yes | yes |
| WLD | 0.3597 | 0 | 1853.3963 → 1853 | 0.0 | 10.00 | 6.7 | 1111 | 742 | yes | yes |
| CRV | 0.3569 | 0 | 1867.9369 → 1867 | 0.1 | 9.99 | 6.7 | 1120 | 747 | yes | yes |
| GALA | 0.001749 | 0 | 381170.1925 → 381170 | 0.0 | 10.00 | 6.7 | 228702 | 152468 | yes | yes |
| RUNE | 0.474 | 0 | 1406.4698 → 1406 | 0.0 | 10.00 | 6.7 | 843 | 563 | yes | yes |
| GRT | 0.01616 | 0 | 41254.1254 → 41254 | 0.0 | 10.00 | 6.7 | 24752 | 16502 | yes | yes |
| IMX | 0.1236 | 0 | 5393.7433 → 5393 | 0.0 | 10.00 | 6.7 | 3235 | 2158 | yes | yes |
| POL | 0.09157 | 0 | 7280.4048 → 7280 | 0.0 | 10.00 | 6.7 | 4368 | 2912 | yes | yes |
| VET | 0.00656 | 0 | 101626.0163 → 101626 | 0.0 | 10.00 | 6.7 | 60975 | 40651 | yes | yes |
| ADA | 0.1971 | 0 | 3382.3778 → 3382 | 0.0 | 10.00 | 6.7 | 2029 | 1353 | yes | yes |

Untradeable at $1000 / 1% (lot rounds to zero or >25% under-size): none
Tradeable but TP1 60% partial / runner rounds to zero: none
Lot rounding error > 10% (risk materially under the plan): none

### Kraken-side liquidity (public /tickers) vs the engine's $30M MEXC volume filter
| coin | Kraken vol24h $ | OI $ | spread bps | impactMid $ | stop in ticks | retail IM (EEA) |
|---|---|---|---|---|---|---|
| SOL | 51.31M | 29.64M | 2.0 | 12.9k | 149 | 0.1 |
| SAND | 0.08M | 0.27M | 79.2 | 2.4k | 58 | 0.1 |
| BNB | 0.91M | 1.79M | 2.5 | 4.1k | 1031 | 0.1 |
| XRP | 55.31M | 15.32M | 0.7 | 4.7k | 201 | 0.1 |
| AVAX | 0.79M | 2.21M | 4.2 | 3.2k | 108 | 0.1 |
| ETC | 0.10M | 1.43M | 20.8 | 4.6k | 108 | 0.1 |
| ATOM | 0.26M | 2.54M | 13.7 | 5.1k | 22 | 0.1 |
| INJ | 0.81M | 0.70M | 10.5 | 3.8k | 71 | 0.1 |
| UNI | 10.80M | 4.15M | 6.9 | 9.9k | 87 | 0.1 |
| ICP | 0.46M | 0.56M | 12.1 | 5.5k | 37 | 0.1 |
| AAVE | 1.99M | 2.99M | 4.7 | 8.1k | 191 | 0.1 |
| PEPE | 1.99M | 1.91M | 5.3 | 3.9k | 509 | 0.1 |
| BCH | 0.38M | 0.87M | 11.1 | 4.4k | 366 | 0.1 |
| FIL | 3.13M | 0.81M | 6.2 | 6.0k | 121 | 0.1 |
| LTC | 0.91M | 4.07M | 2.0 | 3.5k | 74 | 0.1 |
| DOGE | 8.28M | 4.09M | 1.2 | 3.7k | 122 | 0.1 |
| NEAR | 1.98M | 3.19M | 10.8 | 4.0k | 278 | 0.1 |
| DOT | 1.44M | 3.46M | 4.7 | 3.8k | 129 | 0.1 |
| LINK | 2.09M | 5.22M | 3.6 | 5.0k | 167 | 0.1 |
| APT | 0.21M | 0.45M | 8.9 | 3.1k | 84 | 0.1 |
| HBAR | 0.33M | 0.97M | 10.8 | 5.6k | 111 | 0.1 |
| SEI | 0.33M | 0.23M | 8.2 | 3.6k | 73 | 0.1 |
| ETH | 150.40M | 61.32M | 0.4 | 12.2k | 359 | 0.1 |
| SUI | 5.06M | 3.53M | 5.5 | 3.3k | 109 | 0.1 |
| ARB | 6.03M | 1.97M | 21.6 | 8.4k | 187 | 0.1 |
| TIA | 0.31M | 0.33M | 14.1 | 6.0k | 53 | 0.1 |
| BTC | 618.37M | 150.45M | 0.1 | 6.2k | 1162 | 0.1 |
| FET | 0.63M | 1.01M | 13.2 | 6.2k | 227 | 0.1 |
| RENDER | 0.33M | 0.22M | 12.8 | 5.5k | 212 | 0.1 |
| ONDO | 0.86M | 2.34M | 5.9 | 3.4k | 51 | 0.1 |
| ENA | 1.47M | 1.30M | 9.3 | 8.7k | 225 | 0.1 |
| WLD | 0.39M | 0.64M | 5.6 | 2.7k | 54 | 0.1 |
| CRV | 2.78M | 2.58M | 11.2 | 8.6k | 54 | 0.1 |
| GALA | 0.15M | 0.51M | 5.7 | 2.6k | 26 | 0.1 |
| RUNE | 0.06M | 0.12M | 10.6 | 2.3k | 71 | 0.1 |
| GRT | 0.02M | 0.24M | 18.5 | 1.5k | 24 | 0.1 |
| IMX | 0.00M | 0.07M | 65.8 | 1.5k | 185 | 0.1 |
| POL | 0.37M | 1.04M | 4.4 | 4.9k | 137 | 0.1 |
| VET | 0.07M | 0.12M | 24.4 | 0.5k | 98 | 0.1 |
| ADA | 4.26M | 4.41M | 4.6 | 3.0k | 296 | 0.1 |

Kraken coins under $30M/24h: 36/40 — the MEXC $30M filter, if applied to the venue that executes, would kill most of the universe. Under $5M: SAND, BNB, AVAX, ETC, ATOM, INJ, ICP, AAVE, PEPE, BCH, FIL, LTC, NEAR, DOT, LINK, APT, HBAR, SEI, TIA, FET, RENDER, ONDO, ENA, WLD, CRV, GALA, RUNE, GRT, IMX, POL, VET, ADA.
Kraken spread > 20 bps right now: SAND 79bps, ETC 21bps, ARB 22bps, IMX 66bps, VET 24bps (engine MAX_SPREAD = 20 bps, but measured on MEXC).

## C1. Minutes after the hourly close at which real paper 1h entries were booked (trades-paper-2026-08-14.json, n=176)
   0– 3 min: 165 (94%)
   3– 6 min:   1 (1%)
   6–10 min:   1 (1%)
  10–20 min:   3 (2%)
  20–30 min:   0 (0%)
  30–60 min:   6 (3%)
  median 2.0 min · p90 2.9 min. A free-running 3-min interval lands 0–3 min after the close only when the interval happens to be phased right; the tail is restarts/un-halts/slot-frees.

candidates (post minSL+RR): 9324

# B. Guard redesign — honest entries, 20000×1h (≈2.3y on 1h streams)
Reading guide: the no-guard row is the system's own P&L; a guard can only remove trades. A good guard removes a losing cluster's tail at a small cost in sumR and cuts maxDD; a bad one removes the recovery too. halt/cluster = halt duration ÷ time from the equity peak to the halt.

## G0 no portfolio guards (strategy gates only)
  ALL     T=3379 WR= 31% PF= 0.99 sumR=  -30.8 exp=-0.009 maxDD=236.7R  balDD=99.9%
  2026    T= 939 WR= 33% PF= 1.07 sumR=  +51.0 exp=+0.054 maxDD=63.5R
  Aug14→  T=  71 WR= 31% PF= 0.75 sumR=  -13.3 exp=-0.187 maxDD=34.9R
  CI95(exp)=[-0.067, +0.048]  H1 exp=-0.053 (T=1689, to 2025-06-23)  H2 exp=+0.034 (T=1690)
  portfolio halts: episodes=0 median=—h mean=—h max=—h | time halted=0.0% | halt ÷ (peak→halt) median=—× | halt ÷ loss-span median=—× | guard-blocked entries=0 co-fired=0
  blocks: exposure=3571 maxOpen=881 cooldown:liquidity-sweep=614 groupCap=507 cooldown:rsi-divergence=220 weeklyTrend=144 cooldown:break-retest=8

## G1 ENGINE trio: daily −4R · rolling-7d −6R · kill-switch −3R/4 (R = balance×base%)
  ALL     T=1647 WR= 29% PF= 0.92 sumR= -103.0 exp=-0.063 maxDD=202.9R  balDD=99.5%
  2026    T= 561 WR= 33% PF= 1.05 sumR=  +19.3 exp=+0.034 maxDD=44.6R
  Aug14→  T=  39 WR= 31% PF= 0.64 sumR=  -10.2 exp=-0.261 maxDD=15.3R
  CI95(exp)=[-0.143, +0.017]  H1 exp=-0.087 (T=823, to 2025-07-26)  H2 exp=-0.038 (T=824)
  portfolio halts: episodes=113 median=36h mean=65h max=230h | time halted=9.8% | halt ÷ (peak→halt) median=0.4× | halt ÷ loss-span median=0.3× | guard-blocked entries=4882 co-fired=2818
  ks:liquidity-sweep halts: episodes=123 median=70h max=208h | time halted=14.4%
  blocks: killSwitch:liquidity-sweep=4317 ddRolling7d=3183 exposure=1856 ddDaily=369 cooldown:liquidity-sweep=280 maxOpen=209 groupCap=161 cooldown:rsi-divergence=151 weeklyTrend=130 cooldown:break-retest=8

## G1b ENGINE trio, R = actual trade risk (base×BTC multiplier)
  ALL     T=1631 WR= 29% PF= 0.92 sumR= -105.4 exp=-0.065 maxDD=206.0R  balDD=99.6%
  2026    T= 534 WR= 34% PF= 1.06 sumR=  +23.2 exp=+0.043 maxDD=47.2R
  Aug14→  T=  40 WR= 33% PF= 0.68 sumR=   -9.2 exp=-0.231 maxDD=15.3R
  CI95(exp)=[-0.143, +0.017]  H1 exp=-0.079 (T=815, to 2025-07-07)  H2 exp=-0.050 (T=816)
  portfolio halts: episodes=123 median=29h mean=57h max=193h | time halted=9.5% | halt ÷ (peak→halt) median=0.4× | halt ÷ loss-span median=0.3× | guard-blocked entries=4878 co-fired=2589
  ks:liquidity-sweep halts: episodes=122 median=75h max=208h | time halted=14.3%
  blocks: killSwitch:liquidity-sweep=4319 ddRolling7d=2980 exposure=1875 ddDaily=333 cooldown:liquidity-sweep=276 maxOpen=213 groupCap=184 cooldown:rsi-divergence=131 weeklyTrend=128 cooldown:break-retest=8

## G1c trio minus kill-switch
  ALL     T=2016 WR= 30% PF= 0.97 sumR=  -38.5 exp=-0.019 maxDD=160.2R  balDD=99.2%
  2026    T= 613 WR= 34% PF= 1.07 sumR=  +29.5 exp=+0.048 maxDD=79.3R
  Aug14→  T=  42 WR= 40% PF= 1.12 sumR=   +3.1 exp=+0.074 maxDD=11.9R
  CI95(exp)=[-0.091, +0.056]  H1 exp=+0.015 (T=1008, to 2025-07-03)  H2 exp=-0.053 (T=1008)
  portfolio halts: episodes=153 median=21h mean=55h max=207h | time halted=11.3% | halt ÷ (peak→halt) median=0.3× | halt ÷ loss-span median=0.2× | guard-blocked entries=3956 co-fired=222
  blocks: ddRolling7d=3739 exposure=2158 ddDaily=439 cooldown:liquidity-sweep=367 maxOpen=339 groupCap=232 cooldown:rsi-divergence=134 weeklyTrend=116 cooldown:break-retest=6

## G1d kill-switch only
  ALL     T=1952 WR= 30% PF= 0.97 sumR=  -50.5 exp=-0.026 maxDD=181.9R  balDD=99.3%
  2026    T= 632 WR= 34% PF= 1.11 sumR=  +50.1 exp=+0.079 maxDD=39.1R
  Aug14→  T=  43 WR= 33% PF= 0.65 sumR=  -11.1 exp=-0.259 maxDD=19.7R
  CI95(exp)=[-0.098, +0.048]  H1 exp=-0.043 (T=976, to 2025-07-07)  H2 exp=-0.008 (T=976)
  portfolio halts: episodes=0 median=—h mean=—h max=—h | time halted=0.0% | halt ÷ (peak→halt) median=—× | halt ÷ loss-span median=—× | guard-blocked entries=4007 co-fired=0
  ks:liquidity-sweep halts: episodes=124 median=56h max=208h | time halted=13.1%
  ks:rsi-divergence halts: episodes=1 median=144h max=144h | time halted=0.2%
  blocks: killSwitch:liquidity-sweep=4006 exposure=2197 cooldown:liquidity-sweep=315 maxOpen=242 cooldown:rsi-divergence=242 groupCap=207 weeklyTrend=154 cooldown:break-retest=8 killSwitch:rsi-divergence=1

## G2 DD guard X=6R resume 3R · 30d peak · no per-strategy · pure hysteresis
  ALL     T= 607 WR= 30% PF= 0.94 sumR=  -26.7 exp=-0.044 maxDD=83.8R  balDD=86.1%
  2026    T= 184 WR= 34% PF= 1.15 sumR=  +19.8 exp=+0.108 maxDD=27.0R
  Aug14→  T=  14 WR= 29% PF= 0.83 sumR=   -1.9 exp=-0.137 maxDD=6.7R
  CI95(exp)=[-0.176, +0.094]  H1 exp=-0.102 (T=303, to 2025-06-11)  H2 exp=+0.013 (T=304)
  portfolio halts: episodes=29 median=700h mean=577h max=744h | time halted=22.6% | halt ÷ (peak→halt) median=6.2× | halt ÷ loss-span median=2.5× | guard-blocked entries=7720 co-fired=0
  blocks: ddPortfolio=7720 exposure=660 weeklyTrend=115 cooldown:liquidity-sweep=70 maxOpen=64 groupCap=49 cooldown:rsi-divergence=33 cooldown:break-retest=6

## G2 DD guard X=8R resume 4R · 30d peak · no per-strategy · pure hysteresis
  ALL     T= 762 WR= 29% PF= 0.94 sumR=  -34.4 exp=-0.045 maxDD=84.7R  balDD=86.6%
  2026    T= 219 WR= 29% PF= 0.87 sumR=  -22.6 exp=-0.103 maxDD=39.8R
  Aug14→  T=  31 WR= 23% PF= 0.56 sumR=  -11.4 exp=-0.367 maxDD=15.8R
  CI95(exp)=[-0.165, +0.082]  H1 exp=-0.077 (T=381, to 2025-06-25)  H2 exp=-0.014 (T=381)
  portfolio halts: episodes=31 median=692h mean=518h max=744h | time halted=21.7% | halt ÷ (peak→halt) median=4.1× | halt ÷ loss-span median=1.6× | guard-blocked entries=7244 co-fired=0
  blocks: ddPortfolio=7244 exposure=862 maxOpen=107 weeklyTrend=106 cooldown:liquidity-sweep=97 groupCap=85 cooldown:rsi-divergence=55 cooldown:break-retest=6

## G2 DD guard X=10R resume 5R · 30d peak · no per-strategy · pure hysteresis
  ALL     T= 891 WR= 28% PF= 0.91 sumR=  -63.3 exp=-0.071 maxDD=88.7R  balDD=94.7%
  2026    T= 247 WR= 26% PF= 0.74 sumR=  -54.4 exp=-0.220 maxDD=61.0R
  Aug14→  T=  16 WR=  0% PF= 0.00 sumR=  -17.5 exp=-1.094 maxDD=17.5R
  CI95(exp)=[-0.181, +0.039]  H1 exp=-0.054 (T=445, to 2025-06-17)  H2 exp=-0.088 (T=446)
  portfolio halts: episodes=26 median=700h mean=576h max=742h | time halted=20.2% | halt ÷ (peak→halt) median=5.5× | halt ÷ loss-span median=2.6× | guard-blocked entries=6983 co-fired=0
  blocks: ddPortfolio=6983 exposure=975 weeklyTrend=114 cooldown:liquidity-sweep=106 maxOpen=101 groupCap=99 cooldown:rsi-divergence=49 cooldown:break-retest=6

## G2 DD guard X=12R resume 6R · 30d peak · no per-strategy · pure hysteresis
  ALL     T= 976 WR= 28% PF= 0.87 sumR= -104.2 exp=-0.107 maxDD=148.1R  balDD=97.9%
  2026    T= 296 WR= 30% PF= 0.88 sumR=  -28.8 exp=-0.097 maxDD=37.7R
  Aug14→  T=  20 WR= 55% PF= 1.29 sumR=   +3.1 exp=+0.154 maxDD=5.8R
  CI95(exp)=[-0.210, -0.001]  H1 exp=-0.167 (T=488, to 2025-06-25)  H2 exp=-0.047 (T=488)
  portfolio halts: episodes=24 median=693h mean=600h max=720h | time halted=19.5% | halt ÷ (peak→halt) median=5.2× | halt ÷ loss-span median=1.8× | guard-blocked entries=6674 co-fired=0
  blocks: ddPortfolio=6674 exposure=1110 cooldown:liquidity-sweep=143 maxOpen=134 weeklyTrend=119 groupCap=95 cooldown:rsi-divergence=65 cooldown:break-retest=8

## G2 DD guard X=15R resume 7.5R · 30d peak · no per-strategy · pure hysteresis
  ALL     T=1249 WR= 30% PF= 0.97 sumR=  -25.1 exp=-0.020 maxDD=119.1R  balDD=94.9%
  2026    T= 306 WR= 33% PF= 1.01 sumR=   +3.4 exp=+0.011 maxDD=53.6R
  Aug14→  T=  20 WR= 55% PF= 1.29 sumR=   +3.1 exp=+0.154 maxDD=5.8R
  CI95(exp)=[-0.114, +0.076]  H1 exp=+0.028 (T=624, to 2025-02-12)  H2 exp=-0.068 (T=625)
  portfolio halts: episodes=22 median=673h mean=581h max=747h | time halted=17.3% | halt ÷ (peak→halt) median=3.7× | halt ÷ loss-span median=1.8× | guard-blocked entries=5839 co-fired=0
  blocks: ddPortfolio=5839 exposure=1411 maxOpen=225 cooldown:liquidity-sweep=207 groupCap=152 cooldown:rsi-divergence=118 weeklyTrend=115 cooldown:break-retest=8

## G2 DD guard X=10R resume 5R · 7d peak · pure hysteresis
  ALL     T=2161 WR= 31% PF= 1.04 sumR=  +59.2 exp=+0.027 maxDD=149.2R  balDD=97.6%
  2026    T= 656 WR= 34% PF= 1.10 sumR=  +47.3 exp=+0.072 maxDD=53.0R
  Aug14→  T=  43 WR= 30% PF= 0.61 sumR=  -12.5 exp=-0.291 maxDD=19.8R
  CI95(exp)=[-0.045, +0.100]  H1 exp=-0.053 (T=1080, to 2025-07-21)  H2 exp=+0.108 (T=1081)
  portfolio halts: episodes=57 median=149h mean=127h max=190h | time halted=9.8% | halt ÷ (peak→halt) median=1.3× | halt ÷ loss-span median=1.0× | guard-blocked entries=3619 co-fired=0
  blocks: ddPortfolio=3619 exposure=2272 cooldown:liquidity-sweep=374 maxOpen=327 groupCap=264 cooldown:rsi-divergence=177 weeklyTrend=122 cooldown:break-retest=8

## G2 DD guard X=10R resume 5R · 14d peak · pure hysteresis
  ALL     T=1409 WR= 30% PF= 0.98 sumR=  -17.0 exp=-0.012 maxDD=111.5R  balDD=94.3%
  2026    T= 464 WR= 32% PF= 1.03 sumR=  +11.5 exp=+0.025 maxDD=48.1R
  Aug14→  T=  28 WR= 36% PF= 0.73 sumR=   -5.3 exp=-0.189 maxDD=10.1R
  CI95(exp)=[-0.099, +0.077]  H1 exp=-0.104 (T=704, to 2025-08-24)  H2 exp=+0.079 (T=705)
  portfolio halts: episodes=45 median=304h mean=252h max=351h | time halted=15.3% | halt ÷ (peak→halt) median=2.2× | halt ÷ loss-span median=1.1× | guard-blocked entries=5649 co-fired=0
  blocks: ddPortfolio=5649 exposure=1506 cooldown:liquidity-sweep=229 maxOpen=155 groupCap=146 cooldown:rsi-divergence=119 weeklyTrend=103 cooldown:break-retest=8

## G2 DD guard X=8R resume 4R · 30d peak · maxHalt 24h (re-base)
  ALL     T=2913 WR= 30% PF= 0.97 sumR=  -65.0 exp=-0.022 maxDD=195.8R  balDD=99.8%
  2026    T= 835 WR= 32% PF= 1.01 sumR=   +9.0 exp=+0.011 maxDD=87.7R
  Aug14→  T=  54 WR= 31% PF= 0.74 sumR=  -10.0 exp=-0.185 maxDD=26.9R
  CI95(exp)=[-0.085, +0.040]  H1 exp=-0.036 (T=1456, to 2025-06-27)  H2 exp=-0.008 (T=1457)
  portfolio halts: episodes=106 median=26h mean=29h max=123h | time halted=4.2% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.0× | guard-blocked entries=1492 co-fired=0
  blocks: exposure=3117 ddPortfolio=1492 maxOpen=603 cooldown:liquidity-sweep=536 groupCap=372 cooldown:rsi-divergence=142 weeklyTrend=140 cooldown:break-retest=9

## G2 DD guard X=8R resume 4R · 30d peak · maxHalt 72h (re-base)
  ALL     T=2393 WR= 30% PF= 0.98 sumR=  -30.7 exp=-0.013 maxDD=169.6R  balDD=99.2%
  2026    T= 701 WR= 33% PF= 1.06 sumR=  +28.9 exp=+0.041 maxDD=70.0R
  Aug14→  T=  52 WR= 29% PF= 0.57 sumR=  -18.3 exp=-0.352 maxDD=27.2R
  CI95(exp)=[-0.082, +0.057]  H1 exp=-0.048 (T=1196, to 2025-07-02)  H2 exp=+0.022 (T=1197)
  portfolio halts: episodes=92 median=74h mean=71h max=123h | time halted=8.9% | halt ÷ (peak→halt) median=0.2× | halt ÷ loss-span median=0.1× | guard-blocked entries=3214 co-fired=0
  blocks: ddPortfolio=3214 exposure=2419 cooldown:liquidity-sweep=461 maxOpen=287 groupCap=279 weeklyTrend=138 cooldown:rsi-divergence=125 cooldown:break-retest=8

## G2 DD guard X=10R resume 5R · 30d peak · maxHalt 24h (re-base)
  ALL     T=3058 WR= 30% PF= 0.99 sumR=  -24.6 exp=-0.008 maxDD=187.1R  balDD=99.7%
  2026    T= 887 WR= 32% PF= 1.01 sumR=   +3.8 exp=+0.004 maxDD=94.9R
  Aug14→  T=  71 WR= 24% PF= 0.43 sumR=  -34.0 exp=-0.478 maxDD=44.8R
  CI95(exp)=[-0.068, +0.052]  H1 exp=-0.043 (T=1529, to 2025-06-30)  H2 exp=+0.027 (T=1529)
  portfolio halts: episodes=85 median=26h mean=29h max=65h | time halted=3.3% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.0× | guard-blocked entries=1069 co-fired=0
  blocks: exposure=3257 ddPortfolio=1069 maxOpen=637 cooldown:liquidity-sweep=537 groupCap=441 cooldown:rsi-divergence=173 weeklyTrend=144 cooldown:break-retest=8

## G2 DD guard X=10R resume 5R · 30d peak · maxHalt 72h (re-base)
  ALL     T=2561 WR= 30% PF= 0.98 sumR=  -42.0 exp=-0.016 maxDD=186.4R  balDD=99.5%
  2026    T= 763 WR= 33% PF= 1.07 sumR=  +38.1 exp=+0.050 maxDD=67.8R
  Aug14→  T=  62 WR= 35% PF= 0.86 sumR=   -6.2 exp=-0.100 maxDD=23.8R
  CI95(exp)=[-0.081, +0.050]  H1 exp=-0.068 (T=1280, to 2025-07-08)  H2 exp=+0.035 (T=1281)
  portfolio halts: episodes=76 median=74h mean=72h max=123h | time halted=7.3% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.1× | guard-blocked entries=2710 co-fired=0
  blocks: ddPortfolio=2710 exposure=2608 cooldown:liquidity-sweep=443 maxOpen=372 groupCap=335 cooldown:rsi-divergence=154 weeklyTrend=133 cooldown:break-retest=8

## G2 DD guard X=12R resume 6R · 30d peak · maxHalt 24h (re-base)
  ALL     T=3096 WR= 31% PF= 1.01 sumR=  +27.9 exp=+0.009 maxDD=155.8R  balDD=99.3%
  2026    T= 876 WR= 33% PF= 1.07 sumR=  +44.1 exp=+0.050 maxDD=67.1R
  Aug14→  T=  66 WR= 27% PF= 0.61 sumR=  -20.8 exp=-0.316 maxDD=34.7R
  CI95(exp)=[-0.050, +0.070]  H1 exp=-0.010 (T=1548, to 2025-06-29)  H2 exp=+0.028 (T=1548)
  portfolio halts: episodes=69 median=26h mean=29h max=91h | time halted=2.7% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.0× | guard-blocked entries=1021 co-fired=0
  blocks: exposure=3254 ddPortfolio=1021 maxOpen=625 cooldown:liquidity-sweep=559 groupCap=432 cooldown:rsi-divergence=186 weeklyTrend=143 cooldown:break-retest=8

## G2 DD guard X=12R resume 6R · 30d peak · maxHalt 72h (re-base)
  ALL     T=2706 WR= 30% PF= 0.98 sumR=  -42.9 exp=-0.016 maxDD=216.0R  balDD=99.8%
  2026    T= 773 WR= 34% PF= 1.09 sumR=  +53.9 exp=+0.070 maxDD=58.1R
  Aug14→  T=  55 WR= 25% PF= 0.58 sumR=  -18.4 exp=-0.335 maxDD=30.0R
  CI95(exp)=[-0.078, +0.050]  H1 exp=-0.080 (T=1353, to 2025-07-01)  H2 exp=+0.048 (T=1353)
  portfolio halts: episodes=62 median=74h mean=74h max=93h | time halted=6.2% | halt ÷ (peak→halt) median=0.2× | halt ÷ loss-span median=0.1× | guard-blocked entries=2228 co-fired=0
  blocks: exposure=2753 ddPortfolio=2228 cooldown:liquidity-sweep=497 maxOpen=438 groupCap=362 cooldown:rsi-divergence=191 weeklyTrend=141 cooldown:break-retest=8

## G3 DD guard X=10R + per-strategy switch Xs=4R (resume Xs/2) · maxHalt 72h
  ALL     T=1777 WR= 29% PF= 0.92 sumR= -113.7 exp=-0.064 maxDD=174.8R  balDD=99.4%
  2026    T= 490 WR= 30% PF= 0.88 sumR=  -44.4 exp=-0.091 maxDD=104.9R
  Aug14→  T=  34 WR= 24% PF= 0.50 sumR=  -13.3 exp=-0.392 maxDD=15.7R
  CI95(exp)=[-0.141, +0.013]  H1 exp=-0.082 (T=888, to 2025-06-14)  H2 exp=-0.046 (T=889)
  portfolio halts: episodes=45 median=74h mean=77h max=97h | time halted=4.7% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.1× | guard-blocked entries=4646 co-fired=930
  dd:liquidity-sweep halts: episodes=135 median=74h max=152h | time halted=12.7%
  dd:rsi-divergence halts: episodes=10 median=149h max=538h | time halted=2.7%
  blocks: ddStrategy:liquidity-sweep=3928 exposure=1975 ddPortfolio=1561 cooldown:liquidity-sweep=304 maxOpen=187 cooldown:rsi-divergence=174 weeklyTrend=139 ddStrategyHalts:liquidity-sweep=135 groupCap=114 ddStrategy:rsi-divergence=87 ddStrategyHalts:rsi-divergence=10 cooldown:break-retest=8

## G3 DD guard X=10R + per-strategy switch Xs=6R (resume Xs/2) · maxHalt 72h
  ALL     T=2039 WR= 30% PF= 0.96 sumR=  -59.0 exp=-0.029 maxDD=161.4R  balDD=99.1%
  2026    T= 605 WR= 30% PF= 0.93 sumR=  -34.8 exp=-0.058 maxDD=97.0R
  Aug14→  T=  48 WR= 38% PF= 1.05 sumR=   +1.7 exp=+0.035 maxDD=19.8R
  CI95(exp)=[-0.102, +0.045]  H1 exp=-0.038 (T=1019, to 2025-07-04)  H2 exp=-0.020 (T=1020)
  portfolio halts: episodes=55 median=75h mean=76h max=123h | time halted=5.7% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.1× | guard-blocked entries=3772 co-fired=1015
  dd:liquidity-sweep halts: episodes=100 median=74h max=123h | time halted=9.7%
  dd:rsi-divergence halts: episodes=2 median=120h max=120h | time halted=0.3%
  blocks: ddStrategy:liquidity-sweep=2980 exposure=2240 ddPortfolio=1803 cooldown:liquidity-sweep=373 maxOpen=322 groupCap=226 cooldown:rsi-divergence=195 weeklyTrend=149 ddStrategyHalts:liquidity-sweep=100 cooldown:break-retest=8 ddStrategy:rsi-divergence=4 ddStrategyHalts:rsi-divergence=2

## G3 DD guard X=12R + per-strategy switch Xs=4R (resume Xs/2) · maxHalt 72h
  ALL     T=1765 WR= 29% PF= 0.92 sumR= -114.1 exp=-0.065 maxDD=214.3R  balDD=99.7%
  2026    T= 521 WR= 32% PF= 1.00 sumR=   -1.1 exp=-0.002 maxDD=90.9R
  Aug14→  T=  47 WR= 38% PF= 1.09 sumR=   +2.7 exp=+0.058 maxDD=18.8R
  CI95(exp)=[-0.141, +0.014]  H1 exp=-0.081 (T=882, to 2025-06-17)  H2 exp=-0.048 (T=883)
  portfolio halts: episodes=41 median=75h mean=78h max=123h | time halted=4.3% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.1× | guard-blocked entries=4575 co-fired=739
  dd:liquidity-sweep halts: episodes=131 median=76h max=152h | time halted=12.8%
  dd:rsi-divergence halts: episodes=9 median=198h max=429h | time halted=2.8%
  blocks: ddStrategy:liquidity-sweep=3785 exposure=2027 ddPortfolio=1447 cooldown:liquidity-sweep=321 maxOpen=218 cooldown:rsi-divergence=149 weeklyTrend=147 ddStrategyHalts:liquidity-sweep=131 groupCap=113 ddStrategy:rsi-divergence=82 cooldown:break-retest=9 ddStrategyHalts:rsi-divergence=9

## G3 DD guard X=12R + per-strategy switch Xs=6R (resume Xs/2) · maxHalt 72h
  ALL     T=2015 WR= 31% PF= 0.99 sumR=  -13.1 exp=-0.006 maxDD=137.3R  balDD=98.5%
  2026    T= 577 WR= 32% PF= 0.97 sumR=  -11.8 exp=-0.020 maxDD=113.6R
  Aug14→  T=  49 WR= 37% PF= 1.02 sumR=   +0.6 exp=+0.012 maxDD=20.9R
  CI95(exp)=[-0.080, +0.069]  H1 exp=-0.026 (T=1007, to 2025-06-29)  H2 exp=+0.013 (T=1008)
  portfolio halts: episodes=46 median=75h mean=77h max=99h | time halted=4.8% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.1× | guard-blocked entries=3947 co-fired=870
  dd:liquidity-sweep halts: episodes=103 median=74h max=123h | time halted=10.3%
  dd:rsi-divergence halts: episodes=1 median=129h max=129h | time halted=0.2%
  blocks: ddStrategy:liquidity-sweep=3128 exposure=2183 ddPortfolio=1669 cooldown:liquidity-sweep=367 maxOpen=289 groupCap=200 cooldown:rsi-divergence=164 weeklyTrend=150 ddStrategyHalts:liquidity-sweep=103 ddStrategy:rsi-divergence=20 cooldown:break-retest=9 ddStrategyHalts:rsi-divergence=1

## G1 ENGINE trio +15 bps adverse fill
  ALL     T=1552 WR= 28% PF= 0.81 sumR= -234.7 exp=-0.151 maxDD=290.9R  balDD=99.9%
  2026    T= 464 WR= 30% PF= 0.80 sumR=  -71.8 exp=-0.155 maxDD=106.4R
  Aug14→  T=  39 WR= 31% PF= 0.56 sumR=  -12.3 exp=-0.316 maxDD=16.2R
  CI95(exp)=[-0.226, -0.072]  H1 exp=-0.092 (T=776, to 2025-06-09)  H2 exp=-0.210 (T=776)
  portfolio halts: episodes=118 median=38h mean=64h max=230h | time halted=10.2% | halt ÷ (peak→halt) median=0.4× | halt ÷ loss-span median=0.3× | guard-blocked entries=5131 co-fired=2867
  ks:liquidity-sweep halts: episodes=121 median=85h max=208h | time halted=15.5%
  blocks: killSwitch:liquidity-sweep=4618 ddRolling7d=3166 exposure=1785 ddDaily=358 cooldown:liquidity-sweep=248 maxOpen=183 cooldown:rsi-divergence=168 groupCap=125 weeklyTrend=121 cooldown:break-retest=9 unfilled=2

## G3 DD X=10 Xs=6 maxHalt 72h +15 bps adverse fill
  ALL     T=1970 WR= 30% PF= 0.88 sumR= -173.9 exp=-0.088 maxDD=240.3R  balDD=99.8%
  2026    T= 544 WR= 31% PF= 0.82 sumR=  -75.1 exp=-0.138 maxDD=118.7R
  Aug14→  T=  47 WR= 38% PF= 0.96 sumR=   -1.1 exp=-0.024 maxDD=19.7R
  CI95(exp)=[-0.158, -0.018]  H1 exp=-0.104 (T=985, to 2025-06-20)  H2 exp=-0.072 (T=985)
  portfolio halts: episodes=58 median=74h mean=76h max=123h | time halted=5.9% | halt ÷ (peak→halt) median=0.1× | halt ÷ loss-span median=0.1× | guard-blocked entries=4001 co-fired=991
  dd:liquidity-sweep halts: episodes=99 median=75h max=123h | time halted=10.0%
  dd:rsi-divergence halts: episodes=2 median=120h max=120h | time halted=0.3%
  blocks: ddStrategy:liquidity-sweep=3087 exposure=2174 ddPortfolio=1901 cooldown:liquidity-sweep=332 maxOpen=303 groupCap=214 cooldown:rsi-divergence=182 weeklyTrend=138 ddStrategyHalts:liquidity-sweep=99 cooldown:break-retest=8 ddStrategy:rsi-divergence=4 unfilled=2 ddStrategyHalts:rsi-divergence=2

## G0 no guards +15 bps adverse fill
  ALL     T=3374 WR= 30% PF= 0.89 sumR= -277.9 exp=-0.082 maxDD=340.0R  balDD=100.0%
  2026    T= 937 WR= 33% PF= 0.96 sumR=  -31.0 exp=-0.033 maxDD=116.2R
  Aug14→  T=  71 WR= 31% PF= 0.67 sumR=  -17.6 exp=-0.247 maxDD=35.4R
  CI95(exp)=[-0.134, -0.030]  H1 exp=-0.112 (T=1687, to 2025-06-23)  H2 exp=-0.053 (T=1687)
  portfolio halts: episodes=0 median=—h mean=—h max=—h | time halted=0.0% | halt ÷ (peak→halt) median=—× | halt ÷ loss-span median=—× | guard-blocked entries=0 co-fired=0
  blocks: exposure=3572 maxOpen=879 cooldown:liquidity-sweep=612 groupCap=515 cooldown:rsi-divergence=219 weeklyTrend=143 cooldown:break-retest=8 unfilled=2

## B-summary (ALL window)
| arm | T | PF | sumR | ΔsumR vs G0 | exp | maxDD R | ΔmaxDD | portfolio halts | median halt h | max halt h | time halted % | strategy-switch halts | co-fired |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G0 no portfolio guards (strategy gates only) | 3379 | 0.99 | -30.8 | +0.0 | -0.009 | 236.7 | +0.0 | 0 | — | — | 0.0 | 0 | 0 |
| G1 ENGINE trio: daily −4R · rolling-7d −6R · kill-switch −3R/4 (R = balance×base%) | 1647 | 0.92 | -103.0 | -72.2 | -0.063 | 202.9 | -33.8 | 113 | 36 | 230 | 9.8 | 123 | 2818 |
| G1b ENGINE trio, R = actual trade risk (base×BTC multiplier) | 1631 | 0.92 | -105.4 | -74.6 | -0.065 | 206.0 | -30.7 | 123 | 29 | 193 | 9.5 | 122 | 2589 |
| G1c trio minus kill-switch | 2016 | 0.97 | -38.5 | -7.7 | -0.019 | 160.2 | -76.5 | 153 | 21 | 207 | 11.3 | 0 | 222 |
| G1d kill-switch only | 1952 | 0.97 | -50.5 | -19.7 | -0.026 | 181.9 | -54.8 | 0 | — | — | 0.0 | 125 | 0 |
| G2 DD guard X=6R resume 3R · 30d peak · no per-strategy · pure hysteresis | 607 | 0.94 | -26.7 | +4.1 | -0.044 | 83.8 | -152.9 | 29 | 700 | 744 | 22.6 | 0 | 0 |
| G2 DD guard X=8R resume 4R · 30d peak · no per-strategy · pure hysteresis | 762 | 0.94 | -34.4 | -3.5 | -0.045 | 84.7 | -152.0 | 31 | 692 | 744 | 21.7 | 0 | 0 |
| G2 DD guard X=10R resume 5R · 30d peak · no per-strategy · pure hysteresis | 891 | 0.91 | -63.3 | -32.5 | -0.071 | 88.7 | -148.0 | 26 | 700 | 742 | 20.2 | 0 | 0 |
| G2 DD guard X=12R resume 6R · 30d peak · no per-strategy · pure hysteresis | 976 | 0.87 | -104.2 | -73.4 | -0.107 | 148.1 | -88.6 | 24 | 693 | 720 | 19.5 | 0 | 0 |
| G2 DD guard X=15R resume 7.5R · 30d peak · no per-strategy · pure hysteresis | 1249 | 0.97 | -25.1 | +5.7 | -0.020 | 119.1 | -117.6 | 22 | 673 | 747 | 17.3 | 0 | 0 |
| G2 DD guard X=10R resume 5R · 7d peak · pure hysteresis | 2161 | 1.04 | +59.2 | +90.0 | +0.027 | 149.2 | -87.5 | 57 | 149 | 190 | 9.8 | 0 | 0 |
| G2 DD guard X=10R resume 5R · 14d peak · pure hysteresis | 1409 | 0.98 | -17.0 | +13.8 | -0.012 | 111.5 | -125.2 | 45 | 304 | 351 | 15.3 | 0 | 0 |
| G2 DD guard X=8R resume 4R · 30d peak · maxHalt 24h (re-base) | 2913 | 0.97 | -65.0 | -34.2 | -0.022 | 195.8 | -40.9 | 106 | 26 | 123 | 4.2 | 0 | 0 |
| G2 DD guard X=8R resume 4R · 30d peak · maxHalt 72h (re-base) | 2393 | 0.98 | -30.7 | +0.2 | -0.013 | 169.6 | -67.1 | 92 | 74 | 123 | 8.9 | 0 | 0 |
| G2 DD guard X=10R resume 5R · 30d peak · maxHalt 24h (re-base) | 3058 | 0.99 | -24.6 | +6.2 | -0.008 | 187.1 | -49.6 | 85 | 26 | 65 | 3.3 | 0 | 0 |
| G2 DD guard X=10R resume 5R · 30d peak · maxHalt 72h (re-base) | 2561 | 0.98 | -42.0 | -11.2 | -0.016 | 186.4 | -50.3 | 76 | 74 | 123 | 7.3 | 0 | 0 |
| G2 DD guard X=12R resume 6R · 30d peak · maxHalt 24h (re-base) | 3096 | 1.01 | +27.9 | +58.7 | +0.009 | 155.8 | -80.9 | 69 | 26 | 91 | 2.7 | 0 | 0 |
| G2 DD guard X=12R resume 6R · 30d peak · maxHalt 72h (re-base) | 2706 | 0.98 | -42.9 | -12.0 | -0.016 | 216.0 | -20.7 | 62 | 74 | 93 | 6.2 | 0 | 0 |
| G3 DD guard X=10R + per-strategy switch Xs=4R (resume Xs/2) · maxHalt 72h | 1777 | 0.92 | -113.7 | -82.9 | -0.064 | 174.8 | -61.9 | 45 | 74 | 97 | 4.7 | 145 | 930 |
| G3 DD guard X=10R + per-strategy switch Xs=6R (resume Xs/2) · maxHalt 72h | 2039 | 0.96 | -59.0 | -28.2 | -0.029 | 161.4 | -75.3 | 55 | 75 | 123 | 5.7 | 102 | 1015 |
| G3 DD guard X=12R + per-strategy switch Xs=4R (resume Xs/2) · maxHalt 72h | 1765 | 0.92 | -114.1 | -83.3 | -0.065 | 214.3 | -22.5 | 41 | 75 | 123 | 4.3 | 140 | 739 |
| G3 DD guard X=12R + per-strategy switch Xs=6R (resume Xs/2) · maxHalt 72h | 2015 | 0.99 | -13.1 | +17.7 | -0.006 | 137.3 | -99.4 | 46 | 75 | 99 | 4.8 | 104 | 870 |
| G1 ENGINE trio +15 bps adverse fill | 1552 | 0.81 | -234.7 | -203.9 | -0.151 | 290.9 | +54.2 | 118 | 38 | 230 | 10.2 | 121 | 2867 |
| G3 DD X=10 Xs=6 maxHalt 72h +15 bps adverse fill | 1970 | 0.88 | -173.9 | -143.1 | -0.088 | 240.3 | +3.6 | 58 | 74 | 123 | 5.9 | 101 | 991 |
| G0 no guards +15 bps adverse fill | 3374 | 0.89 | -277.9 | -247.1 | -0.082 | 340.0 | +103.3 | 0 | — | — | 0.0 | 0 | 0 |

# C. Structural diagnostics — POST-HOC (not used to promote anything; each says whether a backtest is needed before shipping)

## D0 ENGINE trio (reference)
  ALL     T=1647 WR= 29% PF= 0.92 sumR= -103.0 exp=-0.063 maxDD=202.9R  balDD=99.5%
  2026    T= 561 WR= 33% PF= 1.05 sumR=  +19.3 exp=+0.034 maxDD=44.6R
  Aug14→  T=  39 WR= 31% PF= 0.64 sumR=  -10.2 exp=-0.261 maxDD=15.3R
  CI95(exp)=[-0.143, +0.017]  H1 exp=-0.087 (T=823, to 2025-07-26)  H2 exp=-0.038 (T=824)
  portfolio halts: episodes=113 median=36h mean=65h max=230h | time halted=9.8% | halt ÷ (peak→halt) median=0.4× | halt ÷ loss-span median=0.3× | guard-blocked entries=4882 co-fired=2818
  ks:liquidity-sweep halts: episodes=123 median=70h max=208h | time halted=14.4%
  blocks: killSwitch:liquidity-sweep=4317 ddRolling7d=3183 exposure=1856 ddDaily=369 cooldown:liquidity-sweep=280 maxOpen=209 groupCap=161 cooldown:rsi-divergence=151 weeklyTrend=130 cooldown:break-retest=8

## D1 ENGINE trio, BTC risk multiplier OFF (flat 1.0×)
  ALL     T=1707 WR= 30% PF= 0.96 sumR=  -58.6 exp=-0.034 maxDD=175.5R  balDD=98.8%
  2026    T= 542 WR= 34% PF= 1.07 sumR=  +28.5 exp=+0.052 maxDD=48.3R
  Aug14→  T=  41 WR= 32% PF= 0.65 sumR=  -10.4 exp=-0.253 maxDD=16.5R
  CI95(exp)=[-0.116, +0.048]  H1 exp=-0.103 (T=853, to 2025-08-12)  H2 exp=+0.035 (T=854)
  portfolio halts: episodes=125 median=27h mean=54h max=191h | time halted=9.2% | halt ÷ (peak→halt) median=0.3× | halt ÷ loss-span median=0.2× | guard-blocked entries=4697 co-fired=2584
  ks:liquidity-sweep halts: episodes=127 median=69h max=208h | time halted=13.6%
  blocks: killSwitch:liquidity-sweep=4208 ddRolling7d=2902 exposure=1917 ddDaily=326 cooldown:liquidity-sweep=285 maxOpen=218 groupCap=184 cooldown:rsi-divergence=179 weeklyTrend=129 cooldown:break-retest=8

## D2 ENGINE trio, correlation-group cap OFF
  ALL     T=1665 WR= 29% PF= 0.91 sumR= -119.4 exp=-0.072 maxDD=205.8R  balDD=99.5%
  2026    T= 514 WR= 32% PF= 0.99 sumR=   -2.0 exp=-0.004 maxDD=58.3R
  Aug14→  T=  28 WR= 14% PF= 0.35 sumR=  -17.9 exp=-0.638 maxDD=19.2R
  CI95(exp)=[-0.152, +0.008]  H1 exp=-0.081 (T=832, to 2025-07-07)  H2 exp=-0.063 (T=833)
  portfolio halts: episodes=117 median=42h mean=65h max=191h | time halted=10.4% | halt ÷ (peak→halt) median=0.4× | halt ÷ loss-span median=0.3× | guard-blocked entries=5051 co-fired=3005
  ks:liquidity-sweep halts: episodes=122 median=68h max=208h | time halted=14.5%
  blocks: killSwitch:liquidity-sweep=4468 ddRolling7d=3403 exposure=1827 ddDaily=400 cooldown:liquidity-sweep=291 maxOpen=208 cooldown:rsi-divergence=142 weeklyTrend=134 cooldown:break-retest=6

## D3 ENGINE trio, weekly-trend filter OFF (4h)
  ALL     T=1698 WR= 29% PF= 0.92 sumR= -111.0 exp=-0.065 maxDD=218.4R  balDD=99.6%
  2026    T= 563 WR= 33% PF= 1.05 sumR=  +20.4 exp=+0.036 maxDD=44.4R
  Aug14→  T=  39 WR= 31% PF= 0.64 sumR=  -10.2 exp=-0.261 maxDD=15.3R
  CI95(exp)=[-0.144, +0.013]  H1 exp=-0.083 (T=849, to 2025-07-07)  H2 exp=-0.048 (T=849)
  portfolio halts: episodes=114 median=35h mean=63h max=230h | time halted=9.7% | halt ÷ (peak→halt) median=0.3× | halt ÷ loss-span median=0.3× | guard-blocked entries=4869 co-fired=2742
  ks:break-retest halts: episodes=1 median=484h max=484h | time halted=0.7%
  ks:liquidity-sweep halts: episodes=124 median=69h max=208h | time halted=14.2%
  blocks: killSwitch:liquidity-sweep=4299 ddRolling7d=3096 exposure=1939 ddDaily=382 cooldown:liquidity-sweep=277 maxOpen=210 groupCap=170 cooldown:rsi-divergence=151 cooldown:break-retest=10 killSwitch:break-retest=5

## D4 ENGINE trio, LS only
  ALL     T=1494 WR= 28% PF= 0.90 sumR= -117.6 exp=-0.079 maxDD=175.3R  balDD=98.9%
  2026    T= 510 WR= 32% PF= 1.00 sumR=   +1.4 exp=+0.003 maxDD=55.7R
  Aug14→  T=  35 WR= 34% PF= 0.77 sumR=   -5.8 exp=-0.165 maxDD=13.1R
  CI95(exp)=[-0.164, +0.008]  H1 exp=-0.139 (T=747, to 2025-08-30)  H2 exp=-0.018 (T=747)
  portfolio halts: episodes=109 median=28h mean=57h max=191h | time halted=31.7% | halt ÷ (peak→halt) median=0.3× | halt ÷ loss-span median=0.3× | guard-blocked entries=4461 co-fired=2447
  ks:liquidity-sweep halts: episodes=129 median=65h max=208h | time halted=52.7%
  blocks: killSwitch:liquidity-sweep=4319 ddRolling7d=2408 exposure=1337 ddDaily=356 cooldown:liquidity-sweep=291 maxOpen=174 groupCap=151

## D5 ENGINE trio, B&R + RSI only (LS removed)
  ALL     T= 337 WR= 34% PF= 1.16 sumR=  +37.6 exp=+0.112 maxDD=18.5R  balDD=43.3%
  2026    T=  71 WR= 41% PF= 1.34 sumR=  +15.3 exp=+0.216 maxDD=12.5R
  Aug14→  T=   9 WR= 22% PF= 0.20 sumR=   -5.5 exp=-0.608 maxDD=6.8R
  CI95(exp)=[-0.070, +0.293]  H1 exp=+0.127 (T=168, to 2024-12-24)  H2 exp=+0.097 (T=169)
  portfolio halts: episodes=1 median=261h mean=261h max=261h | time halted=0.4% | halt ÷ (peak→halt) median=1.6× | halt ÷ loss-span median=1.6× | guard-blocked entries=11 co-fired=5
  ks:rsi-divergence halts: episodes=2 median=429h max=429h | time halted=0.8%
  ks:break-retest halts: episodes=1 median=292h max=292h | time halted=0.4%
  blocks: exposure=647 cooldown:rsi-divergence=254 weeklyTrend=158 cooldown:break-retest=9 ddRolling7d=7 killSwitch:break-retest=5 killSwitch:rsi-divergence=4

## D6 no guards, B&R + RSI only
  ALL     T= 340 WR= 35% PF= 1.17 sumR=  +41.5 exp=+0.122 maxDD=19.4R  balDD=43.1%
  2026    T=  72 WR= 42% PF= 1.39 sumR=  +17.5 exp=+0.243 maxDD=10.3R
  Aug14→  T=   9 WR= 22% PF= 0.20 sumR=   -5.5 exp=-0.608 maxDD=6.8R
  CI95(exp)=[-0.060, +0.309]  H1 exp=+0.111 (T=170, to 2025-01-08)  H2 exp=+0.133 (T=170)
  portfolio halts: episodes=0 median=—h mean=—h max=—h | time halted=0.0% | halt ÷ (peak→halt) median=—× | halt ÷ loss-span median=—× | guard-blocked entries=0 co-fired=0
  blocks: exposure=650 cooldown:rsi-divergence=254 weeklyTrend=163 cooldown:break-retest=9

## C2. BTC daily-trend risk multiplier — where the extra 25% risk went (D0, ALL)
  LONG  · BTC up      T= 143 exp=-0.566 PF=0.40 sumR=-80.9 · sized ×1.25 → sumR in base-R units=-101.1
  LONG  · BTC neutral T= 273 exp=-0.136 PF=0.83 sumR=-37.2 · sized ×1 → sumR in base-R units=-37.2
  LONG  · BTC down    T= 112 exp=-0.052 PF=0.93 sumR=-5.8 · sized ×0.75 → sumR in base-R units=-4.4
  SHORT · BTC up      T= 220 exp=+0.107 PF=1.15 sumR=+23.5 · sized ×1.25 → sumR in base-R units=+29.3
  SHORT · BTC neutral T= 491 exp=+0.055 PF=1.07 sumR=+27.2 · sized ×1 → sumR in base-R units=+27.2
  SHORT · BTC down    T= 408 exp=-0.073 PF=0.91 sumR=-29.8 · sized ×0.75 → sumR in base-R units=-22.3

## C3. Exit outcomes (D0) — is the 200h/240h max-hold doing anything?
  1h: T=1495 loss=1061 (avg -1.11R)  trailing=109 (avg +2.17R)  tp2=287 (avg +2.69R)  timeout=38 (avg +0.76R)
      barsHeld p50=13 p90=73 p99=200 max=200 (cap 200)
  4h: T=152 trailing=11 (avg +2.60R)  loss=93 (avg -1.07R)  tp2=32 (avg +2.84R)  timeout=15 (avg +0.74R)  tp1=1 (avg +3.64R)
      barsHeld p50=15 p90=59 p99=60 max=60 (cap 60)

## C4. Cooldown / kill-switch blocks by strategy (D0)
  cooldown:break-retest = 8
  cooldown:liquidity-sweep = 280
  cooldown:rsi-divergence = 151
  killSwitch:liquidity-sweep = 4317


[raw run written to script/audit/phase9-design-run-20000.md]
