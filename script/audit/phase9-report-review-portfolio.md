# Phase 9 — REVIEW of the E4 guard-grid pick cell (dd12 · maxOpen 10 · 0 bps) — 2026-09-02
Same code path as phase9-portfolio.ts (simulate/metrics copied verbatim), same 20260902 candles (cache mirrored). capital $500 · risk 2%
POST-HOC REVIEW diagnostics — labelled; not usable for promotion.

## Windows: FULL 2024-05-31→2026-09-02 · MID 2025-07-17 · PRE-8000 = [FULL_START, 2025-10-04) (clean OOS for the regime rule) · LAST-8000 = [2025-10-04, FULL_END) (regime rule formed here)

## Pool: LS=7908 (SHORT 5069) · TSMOM=2481 (phase9-portfolio: 7908 / 2481)

## R1 — PARITY with phase9-report-portfolio E4 grid (maxOpen 10, 0 bps). Expected: OFF T=439 +127.3 maxDD 20.5 · trio T=351 +98.8 24.0 · dd8 T=420 +100.1 22.9 · dd12 T=430 +126.2 16.9 · dd16 T=437 +121.6 22.9
  OFF   T= 439 WR= 42% PF= 1.47 sumR= +127.3 exp=+0.290 CI95=[+0.133, +0.447] maxDD= 20.5R | H1 T=247 exp=+0.324 sumR=+79.9 | H2 T=192 exp=+0.247 sumR=+47.4 | top5=15% | coins+ 29/40 (73%) | 195 tr/yr over 2.26y | halted 0.0% / 0 ep / 0 blocked entries
  trio  T= 351 WR= 43% PF= 1.46 sumR=  +98.8 exp=+0.282 CI95=[+0.113, +0.452] maxDD= 24.0R | H1 T=194 exp=+0.234 sumR=+45.4 | H2 T=157 exp=+0.340 sumR=+53.4 | top5=19% | coins+ 29/40 (73%) | 156 tr/yr over 2.26y | halted 5.1% / 18 ep / 400 blocked entries
  dd8   T= 420 WR= 41% PF= 1.38 sumR= +100.1 exp=+0.238 CI95=[+0.085, +0.394] maxDD= 22.9R | H1 T=220 exp=+0.263 sumR=+57.8 | H2 T=200 exp=+0.212 sumR=+42.3 | top5=19% | coins+ 27/40 (68%) | 186 tr/yr over 2.26y | halted 1.3% / 13 ep / 87 blocked entries
  dd12  T= 430 WR= 43% PF= 1.48 sumR= +126.2 exp=+0.293 CI95=[+0.142, +0.450] maxDD= 16.9R | H1 T=246 exp=+0.329 sumR=+81.0 | H2 T=184 exp=+0.246 sumR=+45.2 | top5=16% | coins+ 27/40 (68%) | 191 tr/yr over 2.26y | halted 0.3% / 4 ep / 30 blocked entries
  dd16  T= 437 WR= 42% PF= 1.45 sumR= +121.6 exp=+0.278 CI95=[+0.125, +0.433] maxDD= 22.9R | H1 T=247 exp=+0.324 sumR=+79.9 | H2 T=190 exp=+0.220 sumR=+41.7 | top5=16% | coins+ 29/40 (73%) | 194 tr/yr over 2.26y | halted 0.2% / 2 ep / 29 blocked entries
  dd12 (10k bootstrap): exp +0.293 CI [+0.140, +0.449] · OFF: exp +0.290 CI [+0.137, +0.447]
  trade-set overlap dd12 vs OFF (FULL): shared 427 · only-OFF 12 · only-dd12 3 → the pick cell is the OFF book minus/plus a handful of trades

## R2 — Does the guard-grid rule still pick X=12 under arbitrary same-timestamp orderings? (20 seeds, maxOpen 10, 0 bps, FULL)
| seed | OFF sumR / maxDD | trio sumR / maxDD | dd8 sumR / maxDD | dd12 sumR / maxDD | dd16 sumR / maxDD | rule pick | dd12 exp | dd12 CI lo | dd12 H1/H2 | dd12 maxDD<OFF? | dd12 PORTFOLIO-PAPER | dd12 general PAPER |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | +125.9 / 20.3 | +83.7 / 23.8 | +110.0 / 19.2 | +118.6 / 16.5 | +120.5 / 21.9 | X=12 | +0.278 | +0.121 | +0.286 / +0.267 | yes | pass | pass |
| 2 | +78.2 / 25.7 | +53.5 / 28.0 | +49.2 / 27.8 | +79.2 / 21.2 | +77.7 / 26.1 | X=12 | +0.184 | +0.031 | +0.252 / +0.106 | yes | fail | pass |
| 3 | +127.0 / 17.6 | +133.3 / 19.3 | +109.3 / 16.6 | +141.0 / 18.2 | +125.9 / 18.6 | X=12 | +0.320 | +0.180 | +0.332 / +0.307 | NO | pass | pass |
| 4 | +108.5 / 22.5 | +80.5 / 23.8 | +84.0 / 19.2 | +99.9 / 18.2 | +109.3 / 21.8 | X=12 | +0.248 | +0.092 | +0.280 / +0.209 | yes | pass | pass |
| 5 | +97.5 / 29.1 | +88.1 / 24.9 | +67.0 / 37.8 | +110.1 / 20.7 | +96.4 / 30.9 | X=12 | +0.265 | +0.115 | +0.222 / +0.318 | yes | pass | pass |
| 6 | +114.4 / 16.9 | +78.0 / 28.0 | +104.0 / 14.6 | +97.5 / 16.9 | +114.4 / 16.9 | X=8 | +0.233 | +0.077 | +0.270 / +0.187 | NO | pass | pass |
| 7 | +115.8 / 19.7 | +81.6 / 37.4 | +98.0 / 19.6 | +114.4 / 22.2 | +118.7 / 19.3 | X=16 | +0.250 | +0.112 | +0.328 / +0.165 | NO | pass | pass |
| 8 | +106.4 / 22.5 | +121.6 / 14.9 | +101.9 / 21.5 | +99.9 / 21.8 | +113.6 / 20.5 | X=16 | +0.243 | +0.089 | +0.295 / +0.185 | yes | pass | pass |
| 9 | +129.7 / 18.7 | +82.0 / 21.4 | +116.5 / 17.8 | +128.0 / 21.6 | +129.7 / 18.7 | X=16 | +0.294 | +0.135 | +0.333 / +0.253 | NO | pass | pass |
| 10 | +104.2 / 19.5 | +94.1 / 21.4 | +83.1 / 20.5 | +86.8 / 20.9 | +89.1 / 27.5 | none | +0.222 | +0.069 | +0.206 / +0.244 | NO | pass | pass |
| 11 | +123.1 / 22.1 | +104.4 / 21.1 | +125.6 / 19.8 | +113.7 / 22.0 | +119.8 / 21.8 | X=8 | +0.270 | +0.113 | +0.313 / +0.217 | yes | pass | pass |
| 12 | +118.3 / 17.4 | +81.9 / 33.3 | +117.4 / 15.8 | +122.1 / 16.4 | +108.2 / 27.3 | X=8 | +0.287 | +0.132 | +0.324 / +0.247 | yes | pass | pass |
| 13 | +104.2 / 19.6 | +105.1 / 18.0 | +92.5 / 17.5 | +93.6 / 21.3 | +108.4 / 18.8 | X=16 | +0.239 | +0.079 | +0.270 / +0.205 | NO | pass | pass |
| 14 | +112.6 / 24.7 | +140.6 / 12.7 | +93.0 / 24.8 | +122.4 / 28.5 | +106.4 / 24.0 | X=16 | +0.279 | +0.117 | +0.291 / +0.268 | NO | fail | pass |
| 15 | +141.3 / 15.4 | +95.2 / 15.7 | +117.0 / 15.8 | +132.5 / 23.2 | +141.3 / 15.4 | X=16 | +0.303 | +0.151 | +0.271 / +0.338 | NO | pass | pass |
| 16 | +90.0 / 17.1 | +75.7 / 23.7 | +74.7 / 18.5 | +83.5 / 17.7 | +90.0 / 17.1 | X=16 | +0.189 | +0.028 | +0.189 / +0.188 | NO | fail | pass |
| 17 | +122.3 / 22.2 | +114.8 / 21.5 | +84.1 / 18.9 | +108.3 / 21.4 | +123.4 / 22.6 | X=16 | +0.259 | +0.103 | +0.301 / +0.203 | yes | pass | pass |
| 18 | +108.9 / 18.2 | +103.1 / 14.7 | +80.0 / 17.2 | +94.8 / 20.6 | +113.5 / 18.2 | X=16 | +0.235 | +0.074 | +0.250 / +0.221 | NO | pass | pass |
| 19 | +123.5 / 26.5 | +85.3 / 24.2 | +114.4 / 21.8 | +119.9 / 23.3 | +124.5 / 25.5 | X=8 | +0.276 | +0.120 | +0.299 / +0.251 | yes | pass | pass |
| 20 | +89.4 / 31.2 | +108.1 / 20.2 | +86.4 / 29.1 | +89.3 / 29.0 | +92.4 / 32.7 | X=12 | +0.209 | +0.057 | +0.257 / +0.153 | yes | fail | pass |
  pick distribution over 20 seeds: X=12×6 · X=8×4 · X=16×9 · none×1 (default ordering picked X=12)
  dd12 lowers maxDD vs OFF in 10/20 seeds · dd12 maxDD range 16.4–29.0R (OFF 15.4–31.2R) · dd12 exp min/med/max +0.184/+0.259/+0.320 · CI lo>0 in 20/20 · PORTFOLIO-PAPER in 16/20 · general PAPER-CANDIDATE in 20/20

## R3 — dd12 and OFF cells on the slice that predates the regime hypothesis (PRE-8000) vs the slice it was formed on (LAST-8000); sleeves inside
  dd12  PRE-8000  T= 308 WR= 41% PF= 1.44 sumR=  +86.3 exp=+0.280 CI95=[+0.094, +0.464] maxDD= 15.0R | H1 T=194 exp=+0.365 sumR=+70.7 | H2 T=114 exp=+0.137 sumR=+15.6 | top5=21% | coins+ 25/40 (63%) | 229 tr/yr over 1.34y
  dd12  LAST-8000 T= 122 WR= 48% PF= 1.59 sumR=  +39.8 exp=+0.327 CI95=[+0.051, +0.600] maxDD= 16.9R | H1 T=25 exp=+1.145 sumR=+28.6 | H2 T=97 exp=+0.116 sumR=+11.2 | top5=39% | coins+ 24/37 (65%) | 135 tr/yr over 0.91y
        sleeve liquidity-sweep  PRE T=197 exp +0.264 PF 1.38 halves +0.369/+0.085 coins+ 19/40 | LAST T=58 exp +0.414 PF 1.71 halves +1.378/+0.260 coins+ 17/29
        sleeve tsmom            PRE T=111 exp +0.310 PF 1.56 halves +0.371/+0.197 coins+ 25/38 | LAST T=64 exp +0.247 PF 1.47 halves +1.035/-0.038 coins+ 22/33
  OFF   PRE-8000  T= 309 WR= 40% PF= 1.43 sumR=  +85.3 exp=+0.276 CI95=[+0.091, +0.468] maxDD= 16.1R | H1 T=195 exp=+0.357 sumR=+69.7 | H2 T=114 exp=+0.137 sumR=+15.6 | top5=22% | coins+ 25/40 (63%) | 230 tr/yr over 1.34y
  OFF   LAST-8000 T= 130 WR= 47% PF= 1.58 sumR=  +42.0 exp=+0.323 CI95=[+0.060, +0.594] maxDD= 20.5R | H1 T=25 exp=+1.145 sumR=+28.6 | H2 T=105 exp=+0.128 sumR=+13.4 | top5=41% | coins+ 23/39 (59%) | 144 tr/yr over 0.91y
        sleeve liquidity-sweep  PRE T=198 exp +0.257 PF 1.37 halves +0.358/+0.085 coins+ 19/40 | LAST T=66 exp +0.389 PF 1.65 halves +1.378/+0.252 coins+ 17/31
        sleeve tsmom            PRE T=111 exp +0.310 PF 1.56 halves +0.371/+0.197 coins+ 25/38 | LAST T=64 exp +0.256 PF 1.50 halves +1.035/-0.026 coins+ 22/33
  trio  PRE-8000  T= 247 WR= 40% PF= 1.38 sumR=  +60.1 exp=+0.243 CI95=[+0.045, +0.452] maxDD= 24.0R | H1 T=139 exp=+0.269 sumR=+37.4 | H2 T=108 exp=+0.210 sumR=+22.7 | top5=29% | coins+ 28/40 (70%) | 184 tr/yr over 1.34y
  trio  LAST-8000 T= 104 WR= 49% PF= 1.70 sumR=  +38.8 exp=+0.373 CI95=[+0.079, +0.674] maxDD= 11.6R | H1 T=25 exp=+1.145 sumR=+28.6 | H2 T=79 exp=+0.128 sumR=+10.1 | top5=40% | coins+ 26/38 (68%) | 115 tr/yr over 0.91y
        sleeve liquidity-sweep  PRE T=152 exp +0.194 PF 1.28 halves +0.167/+0.230 coins+ 21/38 | LAST T=45 exp +0.478 PF 1.86 halves +1.378/+0.284 coins+ 15/26
        sleeve tsmom            PRE T=95 exp +0.321 PF 1.59 halves +0.419/+0.174 coins+ 24/36 | LAST T=59 exp +0.292 PF 1.56 halves +1.035/-0.009 coins+ 21/33

## R4 — pick cell (dd12, maxOpen 10) under +15 / +30 bps adverse entry and −0.03%/day funding (FULL)
  slip15         T= 434 WR= 43% PF= 1.36 sumR=  +96.1 exp=+0.221 CI95=[+0.077, +0.366] maxDD= 21.5R | halves +0.264 / +0.166 | maxDD 21.5R
  slip30         T= 432 WR= 43% PF= 1.36 sumR=  +93.7 exp=+0.217 CI95=[+0.074, +0.364] maxDD= 19.5R | halves +0.209 / +0.225 | maxDD 19.5R
  slip 0+funding T= 424 WR= 42% PF= 1.41 sumR= +108.4 exp=+0.256 CI95=[+0.101, +0.413] maxDD= 17.1R | halves +0.313 / +0.181 | maxDD 17.1R
  slip15+funding T= 429 WR= 43% PF= 1.31 sumR=  +82.1 exp=+0.191 CI95=[+0.042, +0.337] maxDD= 21.8R | halves +0.246 / +0.121 | maxDD 21.8R

## R5 — finer X grid around the pick (default ordering, maxOpen 10, 0 bps): a real risk control should respond smoothly in X
  X= 6: T=408 sumR +101.5 (80% of OFF) exp +0.249 maxDD 20.7R halted 2.7% / 19 ep / 115 blocked
  X= 8: T=420 sumR +100.1 (79% of OFF) exp +0.238 maxDD 22.9R halted 1.3% / 13 ep / 87 blocked
  X=10: T=422 sumR +116.2 (91% of OFF) exp +0.275 maxDD 18.6R halted 0.7% / 7 ep / 55 blocked
  X=11: T=422 sumR +116.2 (91% of OFF) exp +0.275 maxDD 18.6R halted 0.6% / 7 ep / 51 blocked
  X=12: T=430 sumR +126.2 (99% of OFF) exp +0.293 maxDD 16.9R halted 0.3% / 4 ep / 30 blocked
  X=13: T=436 sumR +122.7 (96% of OFF) exp +0.281 maxDD 22.9R halted 0.3% / 3 ep / 30 blocked
  X=14: T=431 sumR +112.4 (88% of OFF) exp +0.261 maxDD 25.3R halted 0.3% / 3 ep / 64 blocked
  X=16: T=437 sumR +121.6 (96% of OFF) exp +0.278 maxDD 22.9R halted 0.2% / 2 ep / 29 blocked
  X=20: T=440 sumR +127.2 (100% of OFF) exp +0.289 maxDD 20.5R halted 0.1% / 1 ep / 14 blocked
