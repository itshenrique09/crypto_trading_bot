# Phase 9 — ADVERSARIAL REVIEW (statistics lens) of the TSMOM T0 verdict — 2026-09-02
Same pipeline as phase9-tsmom.ts ($1000 @ 1%, honest signal-close entry, engine gates, 200-bar hold cap as in the original). Review arms only — nothing here promotes anything.

candidates=2481 (phase9-tsmom.ts reported 2481)

engine scan order (first 10): UNI ICP AAVE PEPE INJ BCH FIL LTC ATOM AVAX …

## S0 reproduce T0 — default A→Z tie-break
  ALL   T= 403 WR= 44% PF= 1.32 sumR=  +73.8 exp=+0.183 CI95=[+0.049, +0.317] maxDD=30.0R  balDD=29.0%
        H1 T=250 exp=+0.146 PF=1.25 | H2 T=153 exp=+0.244 PF=1.44 | top5=18% | coins+ 24/40 (60%) | 104 tr/yr, +19.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 260/143
        cluster CI95 — by entry-day [+0.020, +0.345] (K=239) · by entry-week [-0.020, +0.382] (K=118) · by entry-month [-0.070, +0.414] (K=44)
        same-day pair sign agreement 65% over 294 pairs (i.i.d. expectation 51%)
  2026  T=  46 WR= 37% PF= 0.74 sumR=   -7.3 exp=-0.158 CI95=[-0.472, +0.172] maxDD=13.6R
  literal verdict: **PAPER-CANDIDATE** — ACCEPT failed: ✗ exp +0.183 ≥ +0.25; ✗ exp @ +15 bps — ≥ +0.10 | PAPER criteria all met
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=64 killSwitch=47 ddDaily=2

## S1 ENGINE tie-break order (SCANNER_COINS = preferredSymbols list)
  ALL   T= 407 WR= 40% PF= 1.12 sumR=  +30.2 exp=+0.074 CI95=[-0.060, +0.207] maxDD=31.0R  balDD=30.6%
        H1 T=240 exp=+0.058 PF=1.10 | H2 T=167 exp=+0.098 PF=1.16 | top5=41% | coins+ 18/40 (45%) | 105 tr/yr, +7.8 R/yr over 3.9y | hold avg 27.3d med 11.0d | L/S 259/148
        cluster CI95 — by entry-day [-0.082, +0.227] (K=250) · by entry-week [-0.110, +0.254] (K=129) · by entry-month [-0.146, +0.282] (K=44)
        same-day pair sign agreement 62% over 293 pairs (i.i.d. expectation 52%)
  2026  T=  52 WR= 37% PF= 0.90 sumR=   -3.1 exp=-0.060 CI95=[-0.394, +0.305] maxDD=11.3R
  literal verdict: **REJECT** — ACCEPT failed: ✗ exp +0.074 ≥ +0.25; ✗ PF 1.12 ≥ 1.30; ✗ CI95 lo -0.060 > 0; ✗ halves +0.058 / +0.098 same sign, each ≥ +0.10; ✗ top-5 share 41% ≤ 30%; ✗ coins positive 18/40 (45%) ≥ 55%; ✗ exp @ +15 bps — ≥ +0.10 | PAPER failed: ✗ exp +0.074 ≥ +0.15; ✗ PF 1.12 ≥ 1.15; ✗ CI95 lo -0.060 > −0.05
  blocks: maxOpen=1055 exposure=707 cooldown=112 groupCap=77 ddRolling7d=65 killSwitch=42 ddDaily=16

## S2 reverse Z→A tie-break
  ALL   T= 419 WR= 41% PF= 1.11 sumR=  +27.2 exp=+0.065 CI95=[-0.064, +0.195] maxDD=30.6R  balDD=29.6%
        H1 T=238 exp=+0.068 PF=1.11 | H2 T=181 exp=+0.061 PF=1.10 | top5=47% | coins+ 21/40 (53%) | 108 tr/yr, +7.0 R/yr over 3.9y | hold avg 27.1d med 10.0d | L/S 272/147
        cluster CI95 — by entry-day [-0.085, +0.217] (K=258) · by entry-week [-0.114, +0.246] (K=128) · by entry-month [-0.153, +0.267] (K=44)
        same-day pair sign agreement 64% over 309 pairs (i.i.d. expectation 52%)
  2026  T=  59 WR= 37% PF= 0.84 sumR=   -5.8 exp=-0.099 CI95=[-0.399, +0.224] maxDD=12.3R
  literal verdict: **REJECT** — ACCEPT failed: ✗ exp +0.065 ≥ +0.25; ✗ PF 1.11 ≥ 1.30; ✗ CI95 lo -0.064 > 0; ✗ halves +0.068 / +0.061 same sign, each ≥ +0.10; ✗ top-5 share 47% ≤ 30%; ✗ coins positive 21/40 (53%) ≥ 55%; ✗ exp @ +15 bps — ≥ +0.10 | PAPER failed: ✗ exp +0.065 ≥ +0.15; ✗ PF 1.11 ≥ 1.15; ✗ CI95 lo -0.064 > −0.05
  blocks: maxOpen=1065 exposure=712 cooldown=108 groupCap=72 ddRolling7d=63 killSwitch=30 ddDaily=12

## S3 ENGINE order + 15 bps adverse entry (ACCEPT slip criterion under engine order)
  ALL   T= 408 WR= 41% PF= 1.11 sumR=  +25.8 exp=+0.063 CI95=[-0.068, +0.194] maxDD=30.7R  balDD=30.2%
        H1 T=238 exp=+0.053 PF=1.09 | H2 T=170 exp=+0.078 PF=1.13 | top5=47% | coins+ 18/40 (45%) | 105 tr/yr, +6.6 R/yr over 3.9y | hold avg 28.0d med 10.0d | L/S 261/147
        cluster CI95 — by entry-day [-0.091, +0.214] (K=246) · by entry-week [-0.126, +0.245] (K=123) · by entry-month [-0.148, +0.264] (K=43)
        same-day pair sign agreement 62% over 310 pairs (i.i.d. expectation 52%)
  2026  T=  56 WR= 36% PF= 0.76 sumR=   -8.4 exp=-0.149 CI95=[-0.445, +0.164] maxDD=11.4R
  literal verdict: **REJECT** — ACCEPT failed: ✗ exp +0.063 ≥ +0.25; ✗ PF 1.11 ≥ 1.30; ✗ CI95 lo -0.068 > 0; ✗ halves +0.053 / +0.078 same sign, each ≥ +0.10; ✗ top-5 share 47% ≤ 30%; ✗ coins positive 18/40 (45%) ≥ 55%; ✗ exp @ +15 bps — ≥ +0.10 | PAPER failed: ✗ exp +0.063 ≥ +0.15; ✗ PF 1.11 ≥ 1.15; ✗ CI95 lo -0.068 > −0.05
  blocks: maxOpen=1076 exposure=695 cooldown=111 groupCap=85 ddRolling7d=66 ddDaily=24 killSwitch=16

## Ordering ensemble — literal PAPER criteria (exp ≥ 0.15, PF ≥ 1.15, CI lo > −0.05, both halves > 0, ≥ 30 tr/yr) across tie-break orders
  23 orderings: exp min/med/max +0.057/+0.125/+0.183 · PAPER literal in 6/23 · iid CI lo>0 in 10/23 · week-cluster CI lo>0 in 0/20 (seeds only)
  per ordering: S0=+0.183✓ S1=+0.074✗ S2=+0.065✗ seed1=+0.120✗ seed2=+0.141✗ seed3=+0.133✗ seed4=+0.096✗ seed5=+0.153✓ seed6=+0.098✗ seed7=+0.078✗ seed8=+0.090✗ seed9=+0.150✗ seed10=+0.083✗ seed11=+0.141✗ seed12=+0.161✓ seed13=+0.164✓ seed14=+0.152✓ seed15=+0.057✗ seed16=+0.102✗ seed17=+0.130✗ seed18=+0.168✓ seed19=+0.108✗ seed20=+0.125✗
  random-seed exp mean +0.1225 sd 0.0320 → default A→Z (+0.183) is z=1.89 above the random-order mean; engine order z=-1.50

## Original T0 dump (script/.cache/phase9-tsmom-t0-trades.json) — recomputed
  T= 403 WR= 44% PF= 1.32 sumR=  +73.8 exp=+0.183 CI95=[+0.049, +0.317] maxDD=30.0R
  H1 T=250 exp=+0.146 PF=1.25 | H2 T=153 exp=+0.244 PF=1.44 | top5=18% | coins+ 24/40 (60%) | 104 tr/yr, +19.0 R/yr over 3.9y | hold avg 27.7d med 10.0d | L/S 260/143
  cluster CI95 — day [+0.020, +0.345] · week [-0.020, +0.382] · month [-0.070, +0.414]
  halves by COUNT: T=201 exp=+0.143 PF=1.25 / T=202 exp=+0.223 PF=1.40 · thirds: T=134 exp=-0.032 PF=0.95 / T=134 exp=+0.246 PF=1.45 / T=135 exp=+0.335 PF=1.66
