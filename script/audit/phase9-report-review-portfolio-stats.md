# Phase 9 — REVIEW (statistics) of the portfolio researcher's E4 dd12/maxOpen10 grid cell — 2026-09-02
data: researcher's snapshot 20260902 read directly from script/.cache (pl_*_20260902.json + phase9-portfolio-ls-20000-20260902.json); $500 / 2%; ENGINE_EXIT {"trailMode":"r_multiple","trailRMultiple":2}

FULL = 2024-05-31 → 2026-09-02 (MID 2025-07-17) — must equal the researcher's 2024-05-31 → 2026-09-02 / 2025-07-17
pool: LS=7908 (expect 7908) · TSMOM=2481 (expect 2481)

## 1. Reproduction — E4 grid, FULL window (researcher's report values in brackets)
  trio maxOpen 10 slip  0: T=351 exp=+0.282 PF=1.46 sumR=+98.8 maxDD=24.0R CIlo=+0.113 H1/H2 +0.234/+0.340 halted 5.08%/18ep blocked 400  [ref T=351 exp +0.282 maxDD 24.0 sumR +98.8] MATCH
  trio maxOpen 10 slip 15: T=350 exp=+0.237 PF=1.39 sumR=+82.9 maxDD=25.0R CIlo=+0.081 H1/H2 +0.182/+0.303 halted 4.65%/19ep blocked 365  [ref T=350 exp +0.237 maxDD 25.0 sumR +82.9] MATCH
  OFF  maxOpen 10 slip  0: T=439 exp=+0.290 PF=1.47 sumR=+127.3 maxDD=20.5R CIlo=+0.137 H1/H2 +0.324/+0.247 halted 0.00%/0ep blocked 0  [ref T=439 exp +0.290 maxDD 20.5 sumR +127.3] MATCH
  OFF  maxOpen 10 slip 15: T=437 exp=+0.230 PF=1.38 sumR=+100.3 maxDD=19.1R CIlo=+0.083 H1/H2 +0.258/+0.192 halted 0.00%/0ep blocked 0  [ref T=437 exp +0.230 maxDD 19.1 sumR +100.3] MATCH
  dd8  maxOpen 10 slip  0: T=420 exp=+0.238 PF=1.38 sumR=+100.1 maxDD=22.9R CIlo=+0.088 H1/H2 +0.263/+0.212 halted 1.26%/13ep blocked 87  [ref T=420 exp +0.238 maxDD 22.9 sumR +100.1] MATCH
  dd8  maxOpen 10 slip 15: T=426 exp=+0.169 PF=1.27 sumR=+72.1 maxDD=25.0R CIlo=+0.029 H1/H2 +0.201/+0.135 halted 1.23%/13ep blocked 83  [ref T=426 exp +0.169 maxDD 25.0 sumR +72.1] MATCH
  dd12 maxOpen 10 slip  0: T=430 exp=+0.293 PF=1.48 sumR=+126.2 maxDD=16.9R CIlo=+0.140 H1/H2 +0.329/+0.246 halted 0.32%/4ep blocked 30  [ref T=430 exp +0.293 maxDD 16.9 sumR +126.2] MATCH
  dd12 maxOpen 10 slip 15: T=434 exp=+0.221 PF=1.36 sumR=+96.1 maxDD=21.5R CIlo=+0.077 H1/H2 +0.264/+0.166 halted 0.34%/4ep blocked 31  [ref T=434 exp +0.221 maxDD 21.5 sumR +96.1] MATCH
  dd16 maxOpen 10 slip  0: T=437 exp=+0.278 PF=1.45 sumR=+121.6 maxDD=22.9R CIlo=+0.127 H1/H2 +0.324/+0.220 halted 0.23%/2ep blocked 29  [ref T=437 exp +0.278 maxDD 22.9 sumR +121.6] MATCH
  dd16 maxOpen 10 slip 15: T=432 exp=+0.201 PF=1.33 sumR=+87.0 maxDD=20.6R CIlo=+0.055 H1/H2 +0.211/+0.190 halted 0.43%/3ep blocked 32  [ref T=432 exp +0.201 maxDD 20.6 sumR +87.0] MATCH
  trio maxOpen 6 slip  0: T=228 exp=+0.352 PF=1.58 sumR=+80.3 maxDD=16.4R CIlo=+0.136 H1/H2 +0.228/+0.474 halted 3.11%/13ep blocked 328  [ref T=228 exp +0.352 maxDD 16.4 sumR +80.3] MATCH
  trio maxOpen 6 slip 15: T=202 exp=+0.223 PF=1.37 sumR=+45.0 maxDD=14.2R CIlo=+0.013 H1/H2 +0.173/+0.274 halted 2.20%/10ep blocked 245
  OFF  maxOpen 6 slip  0: T=216 exp=+0.289 PF=1.47 sumR=+62.4 maxDD=16.0R CIlo=+0.070 H1/H2 +0.293/+0.284 halted 0.00%/0ep blocked 0  [ref T=216 exp +0.289 maxDD 16.0 sumR +62.4] MATCH
  OFF  maxOpen 6 slip 15: T=213 exp=+0.238 PF=1.39 sumR=+50.8 maxDD=17.2R CIlo=+0.024 H1/H2 +0.254/+0.222 halted 0.00%/0ep blocked 0
  dd8  maxOpen 6 slip  0: T=206 exp=+0.213 PF=1.34 sumR=+43.8 maxDD=31.7R CIlo=-0.008 H1/H2 +0.182/+0.245 halted 0.75%/7ep blocked 77  [ref T=206 exp +0.213 maxDD 31.7 sumR +43.8] MATCH
  dd8  maxOpen 6 slip 15: T=204 exp=+0.190 PF=1.31 sumR=+38.7 maxDD=28.3R CIlo=-0.014 H1/H2 +0.193/+0.186 halted 0.74%/7ep blocked 43
  dd12 maxOpen 6 slip  0: T=210 exp=+0.250 PF=1.40 sumR=+52.5 maxDD=23.8R CIlo=+0.033 H1/H2 +0.218/+0.284 halted 0.19%/1ep blocked 17  [ref T=210 exp +0.250 maxDD 23.8 sumR +52.5] MATCH
  dd12 maxOpen 6 slip 15: T=205 exp=+0.214 PF=1.35 sumR=+43.9 maxDD=23.6R CIlo=+0.003 H1/H2 +0.207/+0.222 halted 0.20%/1ep blocked 19
  dd16 maxOpen 6 slip  0: T=216 exp=+0.289 PF=1.47 sumR=+62.4 maxDD=16.0R CIlo=+0.070 H1/H2 +0.293/+0.284 halted 0.00%/0ep blocked 0  [ref T=216 exp +0.289 maxDD 16.0 sumR +62.4] MATCH
  dd16 maxOpen 6 slip 15: T=208 exp=+0.195 PF=1.32 sumR=+40.6 maxDD=26.9R CIlo=-0.018 H1/H2 +0.170/+0.222 halted 0.16%/1ep blocked 13
  → reproduction of the researcher's grid: EXACT (all referenced cells match)

## 2. Cell under review — E4 · DESIGN dd-guard X=12 (resume 6, 30d, 24h) · maxOpen 10 · 0 bps — FULL, independent recompute (bootstrap 10k, seed 42)
  dd12 : T=430 WR=43% PF=1.48 sumR=+126.2 exp=+0.293 CI95=[+0.140, +0.449] maxDD=16.9R (engine-R 21.2R) | H1 T=246 exp +0.329 PF 1.53 | H2 T=184 exp +0.246 PF 1.41 | top5 16% [4.19, 4.12, 3.95, 3.82, 3.49] | coins+ 27/40 (68%) | 191 tr/yr  balDD 49.3%
  +15bp: T=434 WR=43% PF=1.36 sumR=+96.1 exp=+0.221 CI95=[+0.076, +0.366] maxDD=21.5R (engine-R 26.9R) | H1 T=246 exp +0.264 PF 1.42 | H2 T=188 exp +0.166 PF 1.28 | top5 18% [3.81, 3.62, 3.59, 3.47, 3.17] | coins+ 26/40 (65%) | 192 tr/yr
  OFF  : T=439 WR=42% PF=1.47 sumR=+127.3 exp=+0.290 CI95=[+0.137, +0.447] maxDD=20.5R (engine-R 25.6R) | H1 T=247 exp +0.324 PF 1.52 | H2 T=192 exp +0.247 PF 1.41 | top5 15% [4.19, 4.12, 3.95, 3.82, 3.55] | coins+ 29/40 (73%) | 195 tr/yr  balDD 48.2%
  trio : T=351 WR=43% PF=1.46 sumR=+98.8 exp=+0.282 CI95=[+0.113, +0.452] maxDD=24.0R (engine-R 30.0R) | H1 T=194 exp +0.234 PF 1.36 | H2 T=157 exp +0.340 PF 1.60 | top5 19% [4.19, 4.12, 3.49, 3.44, 3.26] | coins+ 29/40 (73%) | 156 tr/yr  balDD 50.6%
  dd12 sleeve liquidity-sweep  T=255 exp=+0.298 PF=1.45 sumR=+76.0 coins+ 20/40
  dd12 sleeve tsmom            T=175 exp=+0.287 PF=1.53 sumR=+50.2 coins+ 28/40
  claimed vs recomputed: T 430.000(430) · exp 0.293(0.293) · PF 1.478(1.48) · CI lo 0.140(0.142) · CI hi 0.449(0.45) · H1 0.329(0.329) · H2 0.246(0.246) · coins+% 67.500(68) · top5% 15.518(16) · slip15 0.221(0.221) · maxDD 16.932(16.9) · sumR 126.179(126.2) · tr/yr 190.575(191)
  → headline numbers REPRODUCE (within rounding; CI differs only by bootstrap iteration count 4000 vs 10000)
  brief ACCEPT-FOR-LIVE (literal): all 8 met
  brief PAPER-CANDIDATE (literal): all 5 met
  researcher's PORTFOLIO-PAPER (literal): all 7 met
  maxDD in ENGINE-R (pnl / (balance × 2%), i.e. with the ×1.25 BTC-up multiplier the LS sleeve always carries): dd12 21.2R · OFF 25.6R · trio 30.0R  (trade-R: 16.9 / 20.5 / 24.0)

## 3. What dd12 changed relative to guards-OFF (same book, same order)
  trades in OFF not in dd12: 12 (sumR +1.2, exp +0.104) · trades in dd12 not in OFF: 3 (sumR +0.1, exp +0.036) · guard-blocked evaluations 30 in 4 episodes, 0.32% of calendar
  removed: 2024-12-23 PEPE LS -1.06; 2026-08-27 IMX LS -1.13; 2026-08-27 DOT LS -1.17; 2026-08-27 UNI LS -1.09; 2026-08-27 INJ LS -1.07; 2026-08-27 AAVE LS -1.06; 2026-08-27 TIA LS -1.13; 2026-08-27 SAND LS +3.55; 2026-08-29 ATOM LS +1.66; 2026-08-27 VET TS -0.15; 2026-08-27 ETC LS +3.11; 2026-09-01 ONDO LS +0.80
  added:   2026-08-28 VET TS -0.72; 2026-08-28 AAVE LS -1.05; 2026-08-28 BTC LS +1.88
  net effect: sumR -1.1, exp +0.003, maxDD -3.5R — the cell's exp/PF/CI are those of the unguarded E4 book ± noise from 15 trade substitutions
  grid-rule neighbours: dd8 maxDD 22.9R, dd16 maxDD 22.9R vs OFF 20.5R — both neighbours are WORSE than OFF; only X=12 improves it (non-monotonic response)

## 4. POST-HOC (labelled) — same-timestamp order shuffles, 10 seeds × {OFF, dd8, dd12, dd16}, maxOpen 10, 0 bps, FULL
  seed  1: OFF exp +0.287 maxDD 20.3 | dd8 +0.257/19.2 | dd12 +0.278/16.5 CIlo +0.121 H +0.29/+0.27 | dd16 +0.276/21.9 → pick dd12; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) pass
  seed  2: OFF exp +0.177 maxDD 25.7 | dd8 +0.110/27.8 | dd12 +0.184/21.2 CIlo +0.031 H +0.25/+0.11 | dd16 +0.177/26.1 → pick dd12; dd12 PORTFOLIO-PAPER FAIL, ACCEPT(ex-slip) FAIL
  seed  3: OFF exp +0.287 maxDD 17.6 | dd8 +0.255/16.6 | dd12 +0.320/18.2 CIlo +0.180 H +0.33/+0.31 | dd16 +0.285/18.6 → pick dd12; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) pass
  seed  4: OFF exp +0.261 maxDD 22.5 | dd8 +0.215/19.2 | dd12 +0.248/18.2 CIlo +0.092 H +0.28/+0.21 | dd16 +0.263/21.8 → pick dd12; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) FAIL
  seed  5: OFF exp +0.230 maxDD 29.1 | dd8 +0.166/37.8 | dd12 +0.265/20.7 CIlo +0.115 H +0.22/+0.32 | dd16 +0.226/30.9 → pick dd12; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) pass
  seed  6: OFF exp +0.276 maxDD 16.9 | dd8 +0.263/14.6 | dd12 +0.233/16.9 CIlo +0.077 H +0.27/+0.19 | dd16 +0.276/16.9 → pick dd8; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) FAIL
  seed  7: OFF exp +0.253 maxDD 19.7 | dd8 +0.224/19.6 | dd12 +0.250/22.2 CIlo +0.112 H +0.33/+0.17 | dd16 +0.258/19.3 → pick dd16; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) pass
  seed  8: OFF exp +0.252 maxDD 22.5 | dd8 +0.250/21.5 | dd12 +0.243/21.8 CIlo +0.089 H +0.29/+0.19 | dd16 +0.269/20.5 → pick dd16; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) FAIL
  seed  9: OFF exp +0.293 maxDD 18.7 | dd8 +0.261/17.8 | dd12 +0.294/21.6 CIlo +0.135 H +0.33/+0.25 | dd16 +0.293/18.7 → pick dd16; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) pass
  seed 10: OFF exp +0.263 maxDD 19.5 | dd8 +0.211/20.5 | dd12 +0.222/20.9 CIlo +0.069 H +0.21/+0.24 | dd16 +0.228/27.5 → pick none; dd12 PORTFOLIO-PAPER pass, ACCEPT(ex-slip) FAIL
  summary: grid rule picks X=12 in 5/10 orderings; dd12 maxDD < OFF maxDD in 5/10; dd12 exp min/med/max +0.184/+0.250/+0.320; dd12 maxDD min/med/max 16.5/20.9/22.2R (OFF maxDD 16.9…29.1R); CI lo > 0 in 10/10; PORTFOLIO-PAPER in 9/10; ACCEPT(ex-slip) in 5/10; default A→Z order exp +0.293 maxDD 16.9R

## 5. POST-HOC (labelled) — dd12 cell: halves by trade-count median, yearly slices, monthly sign count
  by trade count: first 215 exp +0.362 PF 1.60 | last 215 exp +0.225 PF 1.36
  2024: T=151 exp +0.240 PF 1.38 sumR +36.2
  2025: T=177 exp +0.397 PF 1.65 sumR +70.3
  2026: T=102 exp +0.193 PF 1.33 sumR +19.7
  months: 27 traded, 9 negative; worst 2025-08 -12.6351774569R
