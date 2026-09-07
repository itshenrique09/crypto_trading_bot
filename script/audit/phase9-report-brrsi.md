# SUMMARY — phase 9 "brrsi" (written after the run; the pre-registered rules are in the script header)

**Both components REJECT under the pre-registered acceptance rules and the selection-bias rule.**

| Arm | Coins | Window | T | PF | exp | CI95 | H1 / H2 exp | +15 bps exp | coins+ | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 B&R preferred | 6 | 4h 2023-02→2026-09 (3.58y) | 98 | 1.58 | +0.368 | [+0.01, +0.73] | +0.40 / +0.32 | +0.287 | 5/6 | REJECT (27.4 trades/yr < 30; T=98 < 100; top-5 = 52% of sumR) |
| B2 B&R universe | 40 | same | 430 | 0.98 | −0.016 | [−0.17, +0.14] | −0.00 / −0.03 | −0.051 | 20/40 | REJECT — **selection-bias rule FAILED** (needs ≥ +0.15) |
| B3 B&R non-preferred | 34 | same | 349 | 0.83 | −0.124 | [−0.28, +0.05] | −0.18 / −0.08 | −0.158 | 16/34 | REJECT |
| R1 RSI preferred | 2 | 1h 2024-06→2026-09 (2.25y) | 169 | 1.05 | +0.034 | [−0.21, +0.29] | −0.05 / +0.12 | −0.053 | 1/2 | REJECT |
| R2 RSI universe | 40 | same | 1207 | 0.84 | −0.125 | [−0.21, −0.04] | +0.01 / −0.27 | −0.234 | 11/40 | REJECT — **selection-bias rule FAILED** |
| R3 RSI non-preferred | 38 | same | 1128 | 0.78 | −0.175 | [−0.26, −0.09] | +0.01 / −0.41 | −0.220 | 11/38 | REJECT |

- **Parity (P0)**: registry system on the last 8000×1h + 8000×4h with the harness trend context reproduces the official rows — LS T=631 exp −0.031 (official 632 / −0.03), B&R T=93 +0.447 (92 / +0.45), RSI T=42 +0.438 (46 / +0.48; the 1h slice differs by a few candles from yesterday's fetch). The wiring is the official harness.
- **H1 NOT SUPPORTED**: B&R with identical parameters and the weekly gate on all 40 coins is exactly zero (PF 0.98, exp −0.016, 20/40 coins positive, both halves ≈ 0, every year alternating sign: 2023 +0.14 / 2024 −0.25 / 2025 +0.16 / 2026 −0.18). On the 34 coins never used to pick the list it is negative (PF 0.83, −0.124R). The 6-coin result (+0.37R, T=98) is therefore what a top-6-of-40 pick of a zero-mean strategy looks like — the B&R comment block in `server/strategies/break-retest.ts` documents exactly that pick (25→3→6 coins on past PF). Note B1 alone would not even reach PAPER-CANDIDATE: 27 trades/yr and the top-5 trades carry 52% of sumR.
- **H2 NOT SUPPORTED**: RSI on all 40 coins is clearly negative (PF 0.84, −0.125R, CI95 entirely below zero, 11/40 coins positive) and decaying (H1 +0.01 → H2 −0.27; 2026 −0.26R). On ATOM/INJ over the full 2.25y it is +0.034R (PF 1.05) — the official +0.48R (T=46) lives entirely in the last ~11 months (2026: +0.32R, T=47; 2025: −0.13R, T=80). ATOM/INJ were kept in Jun 2026 precisely because they were "strong in 2026" — the same in-sample pick. Under +15 bps RSI is negative on every coin list.
- **H3**: B1 is stable across halves (+0.40 / +0.32) but that stability is inherited from the coin pick, not from the strategy (B2 −0.00 / −0.03). RSI is unstable everywhere (R1 −0.05 / +0.12, R2 +0.01 / −0.27).
- **Slippage**: B1 survives +15/+30 bps (+0.29 / +0.23R) — irrelevant given the selection-bias failure. RSI does not survive +15 bps on any list.
- **Live-relevance**: at Kraken (taker 0.05%, ~$110 equity, 0.5% risk) neither component would be tradeable anyway: B&R yields ~27 trades/yr on 6 coins; RSI on 2 coins ~75 trades/yr with zero expectancy.

**POST-HOC diagnostics (labelled; not used for any verdict)**
- Guards off: B&R ×6 T=98 +0.368 (identical — guards never fired on 6 coins); B&R ×40 T=472 −0.021 (guards were not hiding an edge); RSI ×2 T=171 +0.044; RSI ×40 T=2524 −0.090.
- B&R LONG vs SHORT: ×6 LONG +0.32 (29) / SHORT +0.39 (69); ×40 LONG −0.08 (114) / SHORT +0.01 (316). No directional edge.
- Direction × BTC daily, B&R ×40: LONG·up +0.02 (99), LONG·neutral −0.98 (11), SHORT·up −0.14 (90), SHORT·neutral +0.20 (57), SHORT·down +0.02 (169). RSI ×40: LONG·up −0.10 (325), LONG·down −0.35 (124), SHORT·up +0.12 (232), SHORT·down −0.23 (404); guards-off RSI ×40 SHORT·BTC-up +0.24 (473) is the only positive cell of size — it is a post-hoc cut of a negative population and would need its own pre-registration to mean anything.
- Per-coin breadth: B&R ×40 top coins SAND/ETC/SOL (the preferred ones) plus SUI/HBAR/RUNE on ≤10 trades; BTC (−13.4/26), UNI (−12.6/16), SEI (−9.0/11) worst. RSI ×40: GRT +12/33, ATOM +9.7/40 best; CRV −20.6, BTC −20.1, ETH −18.3 worst — 29/40 coins negative.

**Caveats**: Binance spot klines stand in for MEXC/Kraken futures (wick geometry differs — Fase 8 showed only 11/28 LS signals replay). Ten universe coins have < 8000 4h candles (ONDO 3053, POL 4314, RENDER 4608, ENA 5298, TIA 6220 …) so the 40-coin B&R window is 134 coin-years, not 143. Daily-trend context uses 1d×1500 (full-window) for the component arms and the harness's 600/400 only for P0 — this changes only the ×1.25/×0.75 sizing multiplier, never R. Trades/yr is measured against the pool's decision-time span (first candle after the warm-up window → last closed candle). Halves are split at the midpoint of that span, not by trade count. INSUFFICIENT-DATA threshold (T < 30) was declared in the script header, not in the brief.

---

# Phase 9 — brrsi: Break & Retest and RSI Divergence vs the selection-bias rule — 2026-09-02
4h candles 8000 · 1h candles 20000 · capital $500 · base risk 2% · fees 0.05%+0.05%/side (engine defaults) · daily-trend context 1500d
universe (40): UNI ICP AAVE PEPE INJ BCH FIL LTC ATOM AVAX XRP DOGE SOL ETC NEAR DOT SAND LINK APT HBAR SEI ETH SUI BNB ARB TIA BTC FET RENDER ONDO ENA WLD CRV GALA RUNE GRT IMX POL VET ADA
B&R preferred: SOL SAND BNB XRP AVAX ETC · RSI preferred: ATOM INJ

4h coverage: 2023-02-02 → 2026-09-02 (3.58y; 134 coin-years over 40 coins)
1h coverage: 2024-06-01 → 2026-09-02 (2.25y; 89 coin-years over 40 coins)
coins with < 8000 4h candles on Binance: PEPE:7294 SEI:6683 SUI:7307 ARB:7553 TIA:6220 RENDER:4608 ONDO:3053 ENA:5298 WLD:6816 POL:4314

pool br40: 1803 candidates (post minSL+RR) on 40 coins
pool rsi40: 13784 candidates (post minSL+RR) on 40 coins
pool br6: 372 candidates (post minSL+RR) on 6 coins
pool rsi2: 810 candidates (post minSL+RR) on 2 coins
pool P0 (registry, last 8000×1h + 8000×4h): 3725 candidates

## P0 parity — registry system (expects LS T=632 −0.03R · B&R T=92 +0.45R · RSI T=46 +0.48R)
  liquidity-sweep  T= 631 WR=31% PF=0.96 sumR=-19.3 exp=-0.031
  break-retest     T=  93 WR=42% PF=1.74 sumR=+41.6 exp=+0.447
  rsi-divergence   T=  42 WR=45% PF=1.72 sumR=+18.4 exp=+0.438
  SYSTEM           T= 766 WR=33% PF=1.07 sumR=+40.7 exp=+0.053

## B1 — B&R ×6 preferred (SOL SAND BNB XRP AVAX ETC), 4h
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T=  98 WR= 40% PF= 1.58 sumR=  +36.0 exp=+0.368 CI95=[+0.01, +0.73] maxDD=9.1R top5=52% coins+ 5/6 T/yr=27.4  balDD=17.4%
  H1    T=  55 WR= 40% PF= 1.63 sumR=  +22.1 exp=+0.401 CI95=[-0.10, +0.93] maxDD=7.0R top5=80% coins+ 4/6 T/yr=30.7
  H2    T=  43 WR= 40% PF= 1.52 sumR=  +13.9 exp=+0.324 CI95=[-0.20, +0.86] maxDD=6.9R top5=112% coins+ 5/6 T/yr=24.0
  2026  T=  25 WR= 36% PF= 1.16 sumR=   +2.6 exp=+0.104 CI95=[-0.49, +0.77] maxDD=6.9R top5=561% coins+ 3/6 T/yr=37.4
  slip  +15bps exp=+0.287 (T=98, PF 1.46, CI lo -0.05) · +30bps exp=+0.228 (PF 1.36)
  LONG  T=29 exp=+0.321 · SHORT T=69 exp=+0.387
  exits loss=56 (avg -1.08R)  tp2=23 (avg +2.93R)  timeout=12 (avg +0.73R)  trailing=6 (avg +2.99R)  tp1=1 (avg +2.49R)
  years 2023: T=33 PF=2.11 exp=+0.628 sumR=+20.7 | 2024: T=23 PF=1.02 exp=+0.012 sumR=+0.3 | 2025: T=17 PF=2.30 exp=+0.730 sumR=+12.4 | 2026: T=25 PF=1.16 exp=+0.104 sumR=+2.6
  coins SAND +11.8/21  ETC +10.8/13  SOL +9.1/11  AVAX +3.1/15  XRP +1.3/16  BNB -0.0/22
  LONG  · BTC up      T=  26 WR=35% PF=1.47 sumR=+8.5 exp=+0.327
  LONG  · BTC neutral T=   2 WR=0% PF=0.00 sumR=-2.1 exp=-1.071
  LONG  · BTC down    T=   1 WR=100% PF=— sumR=+3.0 exp=+2.950
  SHORT · BTC up      T=  30 WR=43% PF=1.53 sumR=+8.8 exp=+0.292
  SHORT · BTC neutral T=   9 WR=67% PF=4.56 sumR=+11.9 exp=+1.325
  SHORT · BTC down    T=  30 WR=33% PF=1.28 sumR=+6.0 exp=+0.201
  blocks exposure=168 weeklyTrend=95 cooldown=6 ddRolling7d=5
  VERDICT REJECT — ACCEPT failed: 27.4 trades/yr < 50 and T=98 < 100; top-5 share 52% > 30% | PAPER failed: 27.4 trades/yr < 30

## B2 — B&R ×40 universe, 4h, identical params + weekly gate
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T= 430 WR= 31% PF= 0.98 sumR=   -6.7 exp=-0.016 CI95=[-0.17, +0.14] maxDD=41.5R top5=—% coins+ 20/40 T/yr=120.1  balDD=71.0%
  H1    T= 197 WR= 30% PF= 1.00 sumR=   -0.6 exp=-0.003 CI95=[-0.23, +0.24] maxDD=24.5R top5=—% coins+ 16/38 T/yr=110.0
  H2    T= 233 WR= 31% PF= 0.96 sumR=   -6.1 exp=-0.026 CI95=[-0.23, +0.18] maxDD=39.5R top5=—% coins+ 19/40 T/yr=130.1
  2026  T= 117 WR= 28% PF= 0.76 sumR=  -20.5 exp=-0.175 CI95=[-0.44, +0.09] maxDD=39.5R top5=—% coins+ 15/38 T/yr=175.0
  slip  +15bps exp=-0.051 (T=424, PF 0.93, CI lo -0.19) · +30bps exp=-0.087 (PF 0.88)
  LONG  T=114 exp=-0.079 · SHORT T=316 exp=+0.007
  exits loss=285 (avg -1.07R)  tp2=77 (avg +2.79R)  timeout=47 (avg +0.75R)  trailing=20 (avg +2.32R)  tp1=1 (avg +2.49R)
  years 2023: T=124 PF=1.20 exp=+0.142 sumR=+17.7 | 2024: T=83 PF=0.69 exp=-0.250 sumR=-20.7 | 2025: T=106 PF=1.23 exp=+0.159 sumR=+16.9 | 2026: T=117 PF=0.76 exp=-0.175 sumR=-20.5
  coins ETC +13.2/12  SAND +12.8/20  SUI +9.4/6  HBAR +8.3/10  RUNE +5.9/8  AVAX +5.6/13  SOL +5.4/10  LINK +4.8/9  CRV +4.0/3  TIA +3.5/12  DOGE +3.1/16  FET +2.7/5  ARB +2.6/5  ADA +2.5/17  ETH +2.4/19  DOT +2.3/15  NEAR +1.8/5  PEPE +1.2/6  XRP +1.0/16  AAVE +0.6/10  ONDO -0.9/2  BNB -1.8/20  GALA -1.9/4  IMX -2.2/7  BCH -2.2/12  ICP -2.4/6  ENA -2.4/3  WLD -2.9/7  VET -3.3/8  RENDER -3.5/6  POL -4.2/8  INJ -4.2/4  ATOM -4.4/17  LTC -5.9/21  FIL -7.2/12  APT -7.7/12  GRT -7.9/11  SEI -9.0/11  UNI -12.6/16  BTC -13.4/26
  LONG  · BTC up      T=  99 WR=28% PF=1.03 sumR=+1.9 exp=+0.019
  LONG  · BTC neutral T=  11 WR=0% PF=0.00 sumR=-10.8 exp=-0.979
  LONG  · BTC down    T=   4 WR=25% PF=0.94 sumR=-0.2 exp=-0.046
  SHORT · BTC up      T=  90 WR=31% PF=0.80 sumR=-12.8 exp=-0.142
  SHORT · BTC neutral T=  57 WR=37% PF=1.31 sumR=+11.6 exp=+0.204
  SHORT · BTC down    T= 169 WR=32% PF=1.03 sumR=+3.5 exp=+0.021
  blocks exposure=662 weeklyTrend=431 killSwitch=131 ddRolling7d=87 cooldown=39 ddDaily=9 maxOpen=8 groupCap=6
  VERDICT REJECT — ACCEPT failed: exp -0.016 < +0.25; PF 0.98 < 1.30; CI95 lower -0.17 ≤ 0; halves H1 -0.003 / H2 -0.026 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 20/40 = 50% < 55%; exp under +15 bps -0.051 < +0.10 | PAPER failed: exp -0.016 < +0.15; PF 0.98 < 1.15; CI95 lower -0.17 ≤ −0.05; halves not both positive (H1 -0.003 / H2 -0.026)

## B3 — B&R ×34 non-preferred only (out-of-sample coins)
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T= 349 WR= 28% PF= 0.83 sumR=  -43.2 exp=-0.124 CI95=[-0.28, +0.05] maxDD=51.4R top5=—% coins+ 16/34 T/yr=97.4  balDD=75.3%
  H1    T= 152 WR= 26% PF= 0.77 sumR=  -26.6 exp=-0.175 CI95=[-0.41, +0.07] maxDD=29.9R top5=—% coins+ 12/32 T/yr=84.9
  H2    T= 197 WR= 29% PF= 0.88 sumR=  -16.6 exp=-0.084 CI95=[-0.30, +0.14] maxDD=32.4R top5=—% coins+ 14/34 T/yr=110.0
  2026  T=  98 WR= 27% PF= 0.74 sumR=  -18.6 exp=-0.190 CI95=[-0.47, +0.10] maxDD=32.4R top5=—% coins+ 12/32 T/yr=146.6
  slip  +15bps exp=-0.158 (T=343, PF 0.79, CI lo -0.32) · +30bps exp=-0.188 (PF 0.75)
  LONG  T=90 exp=-0.177 · SHORT T=259 exp=-0.105
  exits loss=240 (avg -1.07R)  tp2=58 (avg +2.75R)  timeout=36 (avg +0.69R)  trailing=14 (avg +2.01R)  tp1=1 (avg +1.32R)
  years 2023: T=95 PF=0.84 exp=-0.125 sumR=-11.9 | 2024: T=66 PF=0.69 exp=-0.245 sumR=-16.2 | 2025: T=90 PF=1.05 exp=+0.038 sumR=+3.4 | 2026: T=98 PF=0.74 exp=-0.190 sumR=-18.6
  coins HBAR +8.3/10  SUI +6.8/6  RUNE +5.9/8  CRV +4.0/3  ARB +3.9/5  LINK +3.7/10  TIA +3.5/12  DOGE +3.1/16  FET +2.7/5  DOT +2.3/15  AAVE +1.7/9  ADA +1.4/18  PEPE +1.2/6  ETH +1.0/20  NEAR +0.8/6  GALA +0.5/5  ONDO -0.9/2  ICP -1.0/7  BCH -1.9/14  IMX -2.2/7  ENA -2.4/3  WLD -2.9/7  INJ -3.1/3  VET -3.3/8  RENDER -3.5/6  POL -5.2/9  ATOM -5.5/18  LTC -5.8/21  FIL -7.2/12  APT -7.7/12  GRT -7.9/11  SEI -9.0/11  BTC -11.8/28  UNI -12.6/16
  LONG  · BTC up      T=  78 WR=27% PF=0.93 sumR=-4.2 exp=-0.053
  LONG  · BTC neutral T=   9 WR=0% PF=0.00 sumR=-8.6 exp=-0.959
  LONG  · BTC down    T=   3 WR=0% PF=0.00 sumR=-3.1 exp=-1.045
  SHORT · BTC up      T=  68 WR=24% PF=0.51 sumR=-25.8 exp=-0.380
  SHORT · BTC neutral T=  48 WR=25% PF=0.72 sumR=-10.6 exp=-0.222
  SHORT · BTC down    T= 143 WR=34% PF=1.09 sumR=+9.1 exp=+0.064
  blocks exposure=527 weeklyTrend=375 killSwitch=88 ddRolling7d=44 cooldown=35 groupCap=7 ddDaily=6
  VERDICT REJECT — ACCEPT failed: exp -0.124 < +0.25; PF 0.83 < 1.30; CI95 lower -0.28 ≤ 0; halves H1 -0.175 / H2 -0.084 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 16/34 = 47% < 55%; exp under +15 bps -0.158 < +0.10 | PAPER failed: exp -0.124 < +0.15; PF 0.83 < 1.15; CI95 lower -0.28 ≤ −0.05; halves not both positive (H1 -0.175 / H2 -0.084)

## B4a — B&R ×6 preferred, +15 bps adverse entry
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T=  98 WR= 40% PF= 1.46 sumR=  +28.2 exp=+0.287 CI95=[-0.05, +0.63] maxDD=9.1R top5=59% coins+ 5/6 T/yr=27.4  balDD=18.1%
  H1    T=  55 WR= 40% PF= 1.50 sumR=  +17.3 exp=+0.315 CI95=[-0.15, +0.81] maxDD=7.0R top5=94% coins+ 4/6 T/yr=30.7
  H2    T=  43 WR= 40% PF= 1.40 sumR=  +10.8 exp=+0.252 CI95=[-0.25, +0.76] maxDD=7.1R top5=133% coins+ 5/6 T/yr=24.0
  2026  T=  25 WR= 36% PF= 1.05 sumR=   +0.8 exp=+0.031 CI95=[-0.53, +0.66] maxDD=7.1R top5=1743% coins+ 3/6 T/yr=37.4
  LONG  T=29 exp=+0.278 · SHORT T=69 exp=+0.291
  exits loss=56 (avg -1.08R)  tp2=23 (avg +2.76R)  timeout=12 (avg +0.65R)  trailing=6 (avg +2.47R)  tp1=1 (avg +2.41R)
  years 2023: T=33 PF=1.89 exp=+0.506 sumR=+16.7 | 2024: T=23 PF=0.97 exp=-0.019 sumR=-0.4 | 2025: T=17 PF=2.17 exp=+0.656 sumR=+11.1 | 2026: T=25 PF=1.05 exp=+0.031 sumR=+0.8
  coins SAND +10.3/21  ETC +9.0/13  SOL +8.1/11  AVAX +2.4/15  XRP +0.4/16  BNB -2.1/22
  LONG  · BTC up      T=  26 WR=35% PF=1.41 sumR=+7.4 exp=+0.284
  LONG  · BTC neutral T=   2 WR=0% PF=0.00 sumR=-2.1 exp=-1.067
  LONG  · BTC down    T=   1 WR=100% PF=— sumR=+2.8 exp=+2.809
  SHORT · BTC up      T=  30 WR=43% PF=1.34 sumR=+5.7 exp=+0.189
  SHORT · BTC neutral T=   9 WR=67% PF=4.19 sumR=+10.6 exp=+1.177
  SHORT · BTC down    T=  30 WR=33% PF=1.18 sumR=+3.8 exp=+0.127
  blocks exposure=168 weeklyTrend=95 cooldown=6 ddRolling7d=5
  VERDICT REJECT — ACCEPT failed: CI95 lower -0.05 ≤ 0; 27.4 trades/yr < 50 and T=98 < 100; top-5 share 59% > 30% | PAPER failed: CI95 lower -0.05 ≤ −0.05; 27.4 trades/yr < 30

## B4b — B&R ×40 universe, +15 bps adverse entry
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T= 424 WR= 31% PF= 0.93 sumR=  -21.8 exp=-0.051 CI95=[-0.19, +0.10] maxDD=43.4R top5=—% coins+ 20/40 T/yr=118.4  balDD=69.1%
  H1    T= 197 WR= 30% PF= 0.92 sumR=  -11.7 exp=-0.060 CI95=[-0.27, +0.17] maxDD=25.5R top5=—% coins+ 15/38 T/yr=110.0
  H2    T= 227 WR= 32% PF= 0.94 sumR=  -10.1 exp=-0.045 CI95=[-0.24, +0.15] maxDD=33.9R top5=—% coins+ 19/40 T/yr=126.8
  2026  T= 111 WR= 29% PF= 0.76 sumR=  -19.0 exp=-0.171 CI95=[-0.42, +0.10] maxDD=33.9R top5=—% coins+ 15/38 T/yr=166.0
  LONG  T=114 exp=-0.114 · SHORT T=310 exp=-0.028
  exits loss=279 (avg -1.07R)  tp2=77 (avg +2.61R)  timeout=47 (avg +0.68R)  trailing=20 (avg +2.01R)  tp1=1 (avg +2.41R)
  years 2023: T=124 PF=1.10 exp=+0.071 sumR=+8.8 | 2024: T=83 PF=0.65 exp=-0.278 sumR=-23.1 | 2025: T=106 PF=1.16 exp=+0.109 sumR=+11.5 | 2026: T=111 PF=0.76 exp=-0.171 sumR=-19.0
  coins SAND +12.4/19  ETC +11.4/12  SUI +8.7/6  HBAR +7.7/10  SOL +6.2/9  RUNE +5.3/8  AVAX +4.8/13  LINK +4.0/9  CRV +3.7/3  TIA +2.7/12  DOT +2.4/14  ETH +2.3/18  FET +2.2/5  ARB +1.9/5  DOGE +1.9/16  ADA +1.7/17  NEAR +1.7/5  PEPE +0.8/6  AAVE +0.3/10  XRP +0.2/16  ONDO -0.9/2  ENA -1.3/2  GALA -2.0/4  IMX -2.3/7  ICP -2.6/6  BCH -2.8/12  WLD -3.0/7  VET -3.4/8  BNB -3.4/20  RENDER -3.6/6  INJ -4.2/4  POL -4.5/8  ATOM -5.4/17  FIL -6.3/11  LTC -6.6/21  GRT -7.9/11  APT -7.9/12  SEI -9.1/11  UNI -12.6/16  BTC -14.3/26
  LONG  · BTC up      T=  99 WR=28% PF=0.97 sumR=-1.9 exp=-0.020
  LONG  · BTC neutral T=  11 WR=0% PF=0.00 sumR=-10.8 exp=-0.980
  LONG  · BTC down    T=   4 WR=25% PF=0.90 sumR=-0.3 exp=-0.080
  SHORT · BTC up      T=  84 WR=32% PF=0.80 sumR=-11.3 exp=-0.135
  SHORT · BTC neutral T=  57 WR=37% PF=1.21 sumR=+7.7 exp=+0.134
  SHORT · BTC down    T= 169 WR=32% PF=0.96 sumR=-5.2 exp=-0.030
  blocks exposure=656 weeklyTrend=430 killSwitch=190 ddRolling7d=59 cooldown=37 groupCap=5 ddDaily=2
  VERDICT REJECT — ACCEPT failed: exp -0.051 < +0.25; PF 0.93 < 1.30; CI95 lower -0.19 ≤ 0; halves H1 -0.060 / H2 -0.045 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 20/40 = 50% < 55%; exp under +15 bps -0.051 < +0.10 | PAPER failed: exp -0.051 < +0.15; PF 0.93 < 1.15; CI95 lower -0.19 ≤ −0.05; halves not both positive (H1 -0.060 / H2 -0.045)

## B4c — B&R ×6 preferred, +30 bps adverse entry
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T=  98 WR= 39% PF= 1.36 sumR=  +22.3 exp=+0.228 CI95=[-0.10, +0.55] maxDD=9.1R top5=68% coins+ 4/6 T/yr=27.4  balDD=18.7%
  H1    T=  55 WR= 40% PF= 1.41 sumR=  +14.2 exp=+0.258 CI95=[-0.19, +0.73] maxDD=7.0R top5=107% coins+ 4/6 T/yr=30.7
  H2    T=  43 WR= 37% PF= 1.30 sumR=   +8.1 exp=+0.189 CI95=[-0.28, +0.67] maxDD=7.3R top5=166% coins+ 5/6 T/yr=24.0
  2026  T=  25 WR= 32% PF= 0.95 sumR=   -0.8 exp=-0.033 CI95=[-0.55, +0.55] maxDD=7.3R top5=—% coins+ 3/6 T/yr=37.4
  LONG  T=29 exp=+0.239 · SHORT T=69 exp=+0.223
  exits loss=56 (avg -1.07R)  tp2=24 (avg +2.59R)  timeout=12 (avg +0.57R)  trailing=5 (avg +2.16R)  tp1=1 (avg +2.34R)
  years 2023: T=33 PF=1.77 exp=+0.431 sumR=+14.2 | 2024: T=23 PF=0.93 exp=-0.049 sumR=-1.1 | 2025: T=17 PF=2.05 exp=+0.589 sumR=+10.0 | 2026: T=25 PF=0.95 exp=-0.033 sumR=-0.8
  coins SAND +9.8/21  ETC +7.6/13  SOL +7.4/11  AVAX +1.7/15  XRP -0.4/16  BNB -3.7/22
  LONG  · BTC up      T=  26 WR=35% PF=1.35 sumR=+6.4 exp=+0.245
  LONG  · BTC neutral T=   2 WR=0% PF=0.00 sumR=-2.1 exp=-1.064
  LONG  · BTC down    T=   1 WR=100% PF=— sumR=+2.7 exp=+2.677
  SHORT · BTC up      T=  30 WR=40% PF=1.23 sumR=+3.9 exp=+0.130
  SHORT · BTC neutral T=   9 WR=67% PF=3.90 sumR=+9.5 exp=+1.061
  SHORT · BTC down    T=  30 WR=33% PF=1.09 sumR=+1.9 exp=+0.064
  blocks exposure=169 weeklyTrend=95 cooldown=5 ddRolling7d=5
  VERDICT REJECT — ACCEPT failed: exp +0.228 < +0.25; CI95 lower -0.10 ≤ 0; 27.4 trades/yr < 50 and T=98 < 100; top-5 share 68% > 30% | PAPER failed: CI95 lower -0.10 ≤ −0.05; 27.4 trades/yr < 30

## B4d — B&R ×40 universe, +30 bps adverse entry
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T= 421 WR= 31% PF= 0.88 sumR=  -36.7 exp=-0.087 CI95=[-0.23, +0.05] maxDD=50.9R top5=—% coins+ 19/40 T/yr=117.5  balDD=72.7%
  H1    T= 197 WR= 30% PF= 0.87 sumR=  -18.9 exp=-0.096 CI95=[-0.30, +0.12] maxDD=26.5R top5=—% coins+ 15/38 T/yr=110.0
  H2    T= 224 WR= 32% PF= 0.89 sumR=  -17.9 exp=-0.080 CI95=[-0.27, +0.11] maxDD=34.6R top5=—% coins+ 19/40 T/yr=125.1
  2026  T= 108 WR= 29% PF= 0.72 sumR=  -21.8 exp=-0.202 CI95=[-0.44, +0.06] maxDD=34.6R top5=—% coins+ 13/38 T/yr=161.6
  LONG  T=112 exp=-0.137 · SHORT T=309 exp=-0.069
  exits loss=278 (avg -1.06R)  tp2=80 (avg +2.44R)  timeout=45 (avg +0.66R)  trailing=15 (avg +1.95R)  tp1=1 (avg +2.34R)  breakeven=2 (avg +0.92R)
  years 2023: T=124 PF=1.03 exp=+0.023 sumR=+2.8 | 2024: T=83 PF=0.63 exp=-0.295 sumR=-24.5 | 2025: T=106 PF=1.09 exp=+0.063 sumR=+6.7 | 2026: T=108 PF=0.72 exp=-0.202 sumR=-21.8
  coins SAND +11.8/19  ETC +9.9/12  SUI +8.1/6  HBAR +7.2/10  SOL +5.8/9  RUNE +4.9/7  AVAX +4.0/13  CRV +3.4/3  LINK +3.4/9  TIA +2.8/12  ARB +2.3/5  FET +1.8/5  DOT +1.6/14  NEAR +1.5/5  ETH +1.2/18  AAVE +1.1/9  ADA +1.0/17  DOGE +0.9/16  PEPE +0.5/6  XRP -0.6/16  ONDO -0.9/2  ENA -1.3/2  GALA -2.1/4  IMX -2.4/7  ICP -2.5/5  WLD -3.2/7  BCH -3.2/12  VET -3.5/8  RENDER -3.6/6  INJ -4.2/4  BNB -4.7/20  POL -4.7/8  ATOM -6.1/17  FIL -6.5/11  LTC -7.2/21  GRT -8.0/11  APT -8.2/12  SEI -9.1/11  UNI -12.7/16  BTC -15.1/26
  LONG  · BTC up      T=  99 WR=28% PF=0.93 sumR=-5.4 exp=-0.055
  LONG  · BTC neutral T=   9 WR=0% PF=0.00 sumR=-9.5 exp=-1.052
  LONG  · BTC down    T=   4 WR=25% PF=0.86 sumR=-0.4 exp=-0.112
  SHORT · BTC up      T=  84 WR=31% PF=0.74 sumR=-14.8 exp=-0.176
  SHORT · BTC neutral T=  56 WR=38% PF=1.15 sumR=+5.4 exp=+0.096
  SHORT · BTC down    T= 169 WR=32% PF=0.90 sumR=-12.0 exp=-0.071
  blocks exposure=656 weeklyTrend=434 killSwitch=197 ddRolling7d=52 cooldown=36 groupCap=5 ddDaily=2
  VERDICT REJECT — ACCEPT failed: exp -0.087 < +0.25; PF 0.88 < 1.30; CI95 lower -0.23 ≤ 0; halves H1 -0.096 / H2 -0.080 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 19/40 = 48% < 55%; exp under +15 bps -0.087 < +0.10 | PAPER failed: exp -0.087 < +0.15; PF 0.88 < 1.15; CI95 lower -0.23 ≤ −0.05; halves not both positive (H1 -0.096 / H2 -0.080)

## R1 — RSI ×2 preferred (ATOM INJ), 1h
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T= 169 WR= 34% PF= 1.05 sumR=   +5.8 exp=+0.034 CI95=[-0.21, +0.29] maxDD=24.8R top5=369% coins+ 1/2 T/yr=75.0  balDD=47.3%
  H1    T=  83 WR= 31% PF= 0.93 sumR=   -4.3 exp=-0.051 CI95=[-0.39, +0.29] maxDD=17.6R top5=—% coins+ 1/2 T/yr=73.7
  H2    T=  86 WR= 36% PF= 1.17 sumR=  +10.1 exp=+0.117 CI95=[-0.24, +0.49] maxDD=15.5R top5=212% coins+ 2/2 T/yr=76.3
  2026  T=  47 WR= 45% PF= 1.51 sumR=  +14.9 exp=+0.317 CI95=[-0.16, +0.80] maxDD=8.7R top5=108% coins+ 2/2 T/yr=70.2
  slip  +15bps exp=-0.053 (T=169, PF 0.93, CI lo -0.27) · +30bps exp=-0.123 (PF 0.83)
  LONG  T=66 exp=-0.040 · SHORT T=103 exp=+0.082
  exits loss=111 (avg -1.11R)  tp2=42 (avg +2.50R)  trailing=12 (avg +1.75R)  tp1=1 (avg +1.60R)  timeout=3 (avg +0.44R)
  years 2024: T=42 PF=1.04 exp=+0.028 sumR=+1.2 | 2025: T=80 PF=0.84 exp=-0.128 sumR=-10.2 | 2026: T=47 PF=1.51 exp=+0.317 sumR=+14.9
  coins ATOM +9.7/96  INJ -3.8/73
  LONG  · BTC up      T=  47 WR=26% PF=0.66 sumR=-13.0 exp=-0.277
  LONG  · BTC neutral T=   5 WR=60% PF=2.90 sumR=+4.3 exp=+0.858
  LONG  · BTC down    T=  14 WR=50% PF=1.81 sumR=+6.1 exp=+0.434
  SHORT · BTC up      T=  32 WR=34% PF=1.02 sumR=+0.5 exp=+0.015
  SHORT · BTC neutral T=  12 WR=25% PF=0.74 sumR=-2.6 exp=-0.214
  SHORT · BTC down    T=  59 WR=36% PF=1.26 sumR=+10.6 exp=+0.179
  blocks exposure=383 cooldown=254 killSwitch=4
  VERDICT REJECT — ACCEPT failed: exp +0.034 < +0.25; PF 1.05 < 1.30; CI95 lower -0.21 ≤ 0; halves H1 -0.051 / H2 +0.117 (need same sign, each ≥ +0.10); top-5 share 369% > 30%; coins positive 1/2 = 50% < 55%; exp under +15 bps -0.053 < +0.10 | PAPER failed: exp +0.034 < +0.15; PF 1.05 < 1.15; CI95 lower -0.21 ≤ −0.05; halves not both positive (H1 -0.051 / H2 +0.117)

## R2 — RSI ×40 universe, 1h, identical params
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T=1207 WR= 30% PF= 0.84 sumR= -151.4 exp=-0.125 CI95=[-0.21, -0.04] maxDD=178.0R top5=—% coins+ 11/40 T/yr=535.8  balDD=99.0%
  H1    T= 632 WR= 34% PF= 1.01 sumR=   +4.1 exp=+0.006 CI95=[-0.12, +0.13] maxDD=113.8R top5=501% coins+ 18/40 T/yr=561.1
  H2    T= 575 WR= 26% PF= 0.67 sumR= -155.4 exp=-0.270 CI95=[-0.39, -0.15] maxDD=167.6R top5=—% coins+ 9/40 T/yr=510.5
  2026  T= 336 WR= 28% PF= 0.68 sumR=  -86.0 exp=-0.256 CI95=[-0.41, -0.10] maxDD=100.6R top5=—% coins+ 10/40 T/yr=502.2
  slip  +15bps exp=-0.234 (T=1125, PF 0.70, CI lo -0.31) · +30bps exp=-0.309 (PF 0.60)
  LONG  T=526 exp=-0.142 · SHORT T=681 exp=-0.113
  exits loss=833 (avg -1.11R)  trailing=99 (avg +1.82R)  tp2=254 (avg +2.29R)  timeout=21 (avg +0.49R)
  years 2024: T=324 PF=0.90 exp=-0.074 sumR=-24.0 | 2025: T=547 PF=0.90 exp=-0.076 sumR=-41.4 | 2026: T=336 PF=0.68 exp=-0.256 sumR=-86.0
  coins GRT +12.0/33  ATOM +9.7/40  ICP +9.3/24  HBAR +7.0/27  ARB +3.8/20  POL +3.6/27  RENDER +1.4/22  UNI +1.1/31  SUI +0.6/21  GALA +0.4/27  AAVE +0.1/27  SOL -0.2/33  ADA -0.9/32  PEPE -1.1/17  TIA -1.7/23  VET -1.7/29  SEI -1.8/28  NEAR -1.8/27  SAND -2.5/36  ENA -2.7/22  AVAX -2.8/29  XRP -3.5/33  DOT -3.5/41  BCH -3.6/47  LTC -3.7/32  INJ -3.8/27  LINK -5.7/31  FIL -5.7/30  IMX -6.3/36  ETC -7.8/36  FET -9.2/30  ONDO -9.4/14  RUNE -11.5/39  WLD -11.6/28  APT -11.8/31  DOGE -13.5/37  BNB -13.6/40  ETH -18.3/32  BTC -20.1/37  CRV -20.6/31
  LONG  · BTC up      T= 325 WR=31% PF=0.87 sumR=-31.3 exp=-0.096
  LONG  · BTC neutral T=  77 WR=32% PF=0.99 sumR=-0.4 exp=-0.006
  LONG  · BTC down    T= 124 WR=23% PF=0.59 sumR=-42.9 exp=-0.346
  SHORT · BTC up      T= 232 WR=38% PF=1.17 sumR=+27.0 exp=+0.117
  SHORT · BTC neutral T=  45 WR=27% PF=0.68 sumR=-11.7 exp=-0.260
  SHORT · BTC down    T= 404 WR=28% PF=0.71 sumR=-92.1 exp=-0.228
  blocks killSwitch=3380 ddRolling7d=3353 exposure=2789 cooldown=1395 ddDaily=910 maxOpen=609 groupCap=141
  VERDICT REJECT — ACCEPT failed: exp -0.125 < +0.25; PF 0.84 < 1.30; CI95 lower -0.21 ≤ 0; halves H1 +0.006 / H2 -0.270 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 11/40 = 28% < 55%; exp under +15 bps -0.234 < +0.10 | PAPER failed: exp -0.125 < +0.15; PF 0.84 < 1.15; CI95 lower -0.21 ≤ −0.05; halves not both positive (H1 +0.006 / H2 -0.270)

## R3 — RSI ×38 non-preferred only (out-of-sample coins)
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T=1128 WR= 29% PF= 0.78 sumR= -196.9 exp=-0.175 CI95=[-0.26, -0.09] maxDD=214.1R top5=—% coins+ 11/38 T/yr=500.7  balDD=99.6%
  H1    T= 624 WR= 34% PF= 1.02 sumR=   +8.3 exp=+0.013 CI95=[-0.11, +0.14] maxDD=105.5R top5=244% coins+ 14/38 T/yr=554.0
  H2    T= 504 WR= 22% PF= 0.53 sumR= -205.3 exp=-0.407 CI95=[-0.52, -0.29] maxDD=209.1R top5=—% coins+ 7/38 T/yr=447.4
  2026  T= 312 WR= 23% PF= 0.54 sumR= -122.5 exp=-0.393 CI95=[-0.53, -0.24] maxDD=122.5R top5=—% coins+ 6/38 T/yr=466.3
  slip  +15bps exp=-0.220 (T=1132, PF 0.71, CI lo -0.30) · +30bps exp=-0.304 (PF 0.61)
  LONG  T=468 exp=-0.220 · SHORT T=660 exp=-0.143
  exits loss=796 (avg -1.11R)  trailing=86 (avg +1.80R)  tp2=229 (avg +2.29R)  timeout=17 (avg +0.46R)
  years 2024: T=309 PF=0.86 exp=-0.108 sumR=-33.5 | 2025: T=507 PF=0.89 exp=-0.081 sumR=-40.9 | 2026: T=312 PF=0.54 exp=-0.393 sumR=-122.5
  coins GRT +15.2/36  ICP +6.0/24  POL +5.9/28  VET +5.4/30  HBAR +4.9/31  SOL +3.4/29  SEI +2.4/27  GALA +1.2/23  ARB +1.1/22  SUI +0.6/22  TIA +0.5/24  RENDER -0.4/24  ENA -0.6/20  BCH -0.8/45  ADA -1.3/34  UNI -3.0/29  AVAX -3.5/29  DOT -3.8/38  NEAR -4.1/26  FIL -5.1/33  LTC -6.4/33  PEPE -6.7/20  IMX -6.8/31  XRP -7.3/30  WLD -7.5/24  AAVE -8.8/32  SAND -9.9/35  DOGE -11.2/38  LINK -11.7/31  FET -12.7/29  ETH -12.9/29  ETC -13.2/38  RUNE -13.7/33  BNB -14.6/38  ONDO -15.6/17  BTC -16.2/34  APT -20.5/29  CRV -25.0/33
  LONG  · BTC up      T= 303 WR=27% PF=0.71 sumR=-72.3 exp=-0.239
  LONG  · BTC neutral T=  40 WR=43% PF=1.63 sumR=+15.9 exp=+0.398
  LONG  · BTC down    T= 125 WR=22% PF=0.57 sumR=-46.5 exp=-0.372
  SHORT · BTC up      T= 222 WR=36% PF=1.09 sumR=+14.8 exp=+0.067
  SHORT · BTC neutral T=  47 WR=23% PF=0.56 sumR=-17.7 exp=-0.376
  SHORT · BTC down    T= 391 WR=28% PF=0.71 sumR=-91.2 exp=-0.233
  blocks killSwitch=3207 ddRolling7d=3109 exposure=2649 cooldown=1349 ddDaily=875 maxOpen=501 groupCap=156
  VERDICT REJECT — ACCEPT failed: exp -0.175 < +0.25; PF 0.78 < 1.30; CI95 lower -0.26 ≤ 0; halves H1 +0.013 / H2 -0.407 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 11/38 = 29% < 55%; exp under +15 bps -0.220 < +0.10 | PAPER failed: exp -0.175 < +0.15; PF 0.78 < 1.15; CI95 lower -0.26 ≤ −0.05; halves not both positive (H1 +0.013 / H2 -0.407)

## R4a — RSI ×2 preferred, +15 bps adverse entry
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T= 169 WR= 34% PF= 0.93 sumR=   -9.0 exp=-0.053 CI95=[-0.27, +0.18] maxDD=30.3R top5=—% coins+ 1/2 T/yr=75.0  balDD=53.1%
  H1    T=  83 WR= 31% PF= 0.84 sumR=   -9.7 exp=-0.117 CI95=[-0.43, +0.20] maxDD=21.1R top5=—% coins+ 0/2 T/yr=73.7
  H2    T=  86 WR= 36% PF= 1.01 sumR=   +0.7 exp=+0.008 CI95=[-0.31, +0.34] maxDD=16.5R top5=2666% coins+ 1/2 T/yr=76.3
  2026  T=  47 WR= 45% PF= 1.31 sumR=   +9.0 exp=+0.192 CI95=[-0.24, +0.63] maxDD=10.1R top5=150% coins+ 2/2 T/yr=70.2
  LONG  T=66 exp=-0.109 · SHORT T=103 exp=-0.018
  exits loss=111 (avg -1.10R)  tp2=42 (avg +2.20R)  trailing=12 (avg +1.46R)  tp1=1 (avg +1.50R)  timeout=3 (avg +0.39R)
  years 2024: T=42 PF=0.94 exp=-0.041 sumR=-1.7 | 2025: T=80 PF=0.74 exp=-0.204 sumR=-16.3 | 2026: T=47 PF=1.31 exp=+0.192 sumR=+9.0
  coins ATOM +0.5/96  INJ -9.5/73
  LONG  · BTC up      T=  47 WR=26% PF=0.59 sumR=-15.5 exp=-0.331
  LONG  · BTC neutral T=   5 WR=60% PF=2.53 sumR=+3.4 exp=+0.681
  LONG  · BTC down    T=  14 WR=50% PF=1.66 sumR=+4.9 exp=+0.352
  SHORT · BTC up      T=  32 WR=34% PF=0.91 sumR=-2.1 exp=-0.067
  SHORT · BTC neutral T=  12 WR=25% PF=0.67 sumR=-3.2 exp=-0.270
  SHORT · BTC down    T=  59 WR=36% PF=1.09 sumR=+3.6 exp=+0.060
  blocks exposure=383 cooldown=254 killSwitch=4
  VERDICT REJECT — ACCEPT failed: exp -0.053 < +0.25; PF 0.93 < 1.30; CI95 lower -0.27 ≤ 0; halves H1 -0.117 / H2 +0.008 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 1/2 = 50% < 55%; exp under +15 bps -0.053 < +0.10 | PAPER failed: exp -0.053 < +0.15; PF 0.93 < 1.15; CI95 lower -0.27 ≤ −0.05; halves not both positive (H1 -0.117 / H2 +0.008)

## R4b — RSI ×40 universe, +15 bps adverse entry
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T=1125 WR= 29% PF= 0.70 sumR= -263.0 exp=-0.234 CI95=[-0.31, -0.15] maxDD=275.6R top5=—% coins+ 7/40 T/yr=499.4  balDD=99.8%
  H1    T= 582 WR= 33% PF= 0.85 sumR=  -64.5 exp=-0.111 CI95=[-0.23, +0.01] maxDD=133.1R top5=—% coins+ 10/40 T/yr=516.7
  H2    T= 543 WR= 25% PF= 0.55 sumR= -198.5 exp=-0.366 CI95=[-0.47, -0.26] maxDD=201.9R top5=—% coins+ 10/40 T/yr=482.0
  2026  T= 305 WR= 25% PF= 0.55 sumR= -112.1 exp=-0.367 CI95=[-0.50, -0.22] maxDD=116.0R top5=—% coins+ 7/40 T/yr=455.9
  LONG  T=488 exp=-0.242 · SHORT T=637 exp=-0.227
  exits loss=793 (avg -1.10R)  breakeven=13 (avg +0.91R)  trailing=73 (avg +1.60R)  tp2=230 (avg +2.07R)  timeout=16 (avg +0.23R)
  years 2024: T=310 PF=0.80 exp=-0.151 sumR=-46.9 | 2025: T=510 PF=0.74 exp=-0.204 sumR=-104.1 | 2026: T=305 PF=0.55 exp=-0.367 sumR=-112.1
  coins ICP +8.4/25  GRT +7.7/32  POL +5.1/23  ATOM +4.1/36  HBAR +3.6/27  ARB +1.6/22  GALA +0.1/25  SUI -0.6/20  VET -0.7/22  TIA -0.8/20  SOL -2.2/32  AAVE -2.8/31  SEI -3.6/26  RENDER -3.6/21  ENA -4.4/22  FIL -4.7/25  NEAR -6.0/26  LTC -6.2/25  DOT -6.3/36  BCH -6.9/41  SAND -7.1/29  UNI -7.2/27  ETC -8.1/32  ADA -9.0/30  PEPE -9.2/16  LINK -9.4/30  IMX -9.6/35  INJ -9.9/24  WLD -10.5/23  FET -11.2/23  AVAX -11.7/30  ONDO -12.0/16  RUNE -12.5/36  XRP -13.6/33  BNB -13.7/38  DOGE -14.3/37  APT -15.3/28  BTC -17.4/38  ETH -18.9/31  CRV -24.4/32
  LONG  · BTC up      T= 296 WR=30% PF=0.75 sumR=-57.2 exp=-0.193
  LONG  · BTC neutral T=  75 WR=31% PF=0.86 sumR=-8.0 exp=-0.107
  LONG  · BTC down    T= 117 WR=21% PF=0.47 sumR=-53.1 exp=-0.454
  SHORT · BTC up      T= 200 WR=34% PF=0.93 sumR=-9.4 exp=-0.047
  SHORT · BTC neutral T=  41 WR=24% PF=0.53 sumR=-16.2 exp=-0.396
  SHORT · BTC down    T= 396 WR=28% PF=0.62 sumR=-119.1 exp=-0.301
  blocks ddRolling7d=3947 killSwitch=3131 exposure=2612 cooldown=1367 ddDaily=911 maxOpen=568 groupCap=123
  VERDICT REJECT — ACCEPT failed: exp -0.234 < +0.25; PF 0.70 < 1.30; CI95 lower -0.31 ≤ 0; halves H1 -0.111 / H2 -0.366 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 7/40 = 18% < 55%; exp under +15 bps -0.234 < +0.10 | PAPER failed: exp -0.234 < +0.15; PF 0.70 < 1.15; CI95 lower -0.31 ≤ −0.05; halves not both positive (H1 -0.111 / H2 -0.366)

## R4c — RSI ×2 preferred, +30 bps adverse entry
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T= 169 WR= 34% PF= 0.83 sumR=  -20.8 exp=-0.123 CI95=[-0.33, +0.09] maxDD=35.2R top5=—% coins+ 0/2 T/yr=75.0  balDD=57.3%
  H1    T=  83 WR= 31% PF= 0.77 sumR=  -14.2 exp=-0.171 CI95=[-0.47, +0.13] maxDD=24.3R top5=—% coins+ 0/2 T/yr=73.7
  H2    T=  86 WR= 36% PF= 0.89 sumR=   -6.6 exp=-0.077 CI95=[-0.36, +0.22] maxDD=17.3R top5=—% coins+ 0/2 T/yr=76.3
  2026  T=  47 WR= 45% PF= 1.16 sumR=   +4.5 exp=+0.096 CI95=[-0.30, +0.49] maxDD=11.0R top5=261% coins+ 2/2 T/yr=70.2
  LONG  T=66 exp=-0.165 · SHORT T=103 exp=-0.096
  exits loss=111 (avg -1.09R)  tp2=42 (avg +1.97R)  trailing=8 (avg +1.41R)  breakeven=4 (avg +0.91R)  tp1=1 (avg +1.40R)  timeout=3 (avg +0.34R)
  years 2024: T=42 PF=0.87 exp=-0.097 sumR=-4.1 | 2025: T=80 PF=0.66 exp=-0.265 sumR=-21.2 | 2026: T=47 PF=1.16 exp=+0.096 sumR=+4.5
  coins ATOM -6.7/96  INJ -14.1/73
  LONG  · BTC up      T=  47 WR=26% PF=0.54 sumR=-17.6 exp=-0.374
  LONG  · BTC neutral T=   5 WR=60% PF=2.22 sumR=+2.7 exp=+0.541
  LONG  · BTC down    T=  14 WR=50% PF=1.53 sumR=+4.0 exp=+0.283
  SHORT · BTC up      T=  32 WR=34% PF=0.82 sumR=-4.3 exp=-0.133
  SHORT · BTC neutral T=  12 WR=25% PF=0.61 sumR=-3.8 exp=-0.318
  SHORT · BTC down    T=  59 WR=36% PF=0.96 sumR=-1.8 exp=-0.031
  blocks exposure=383 cooldown=254 killSwitch=4
  VERDICT REJECT — ACCEPT failed: exp -0.123 < +0.25; PF 0.83 < 1.30; CI95 lower -0.33 ≤ 0; halves H1 -0.171 / H2 -0.077 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 0/2 = 0% < 55%; exp under +15 bps -0.123 < +0.10 | PAPER failed: exp -0.123 < +0.15; PF 0.83 < 1.15; CI95 lower -0.33 ≤ −0.05; halves not both positive (H1 -0.171 / H2 -0.077)

## R4d — RSI ×40 universe, +30 bps adverse entry
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T=1080 WR= 28% PF= 0.60 sumR= -334.1 exp=-0.309 CI95=[-0.38, -0.23] maxDD=344.8R top5=—% coins+ 3/40 T/yr=479.4  balDD=100.0%
  H1    T= 572 WR= 32% PF= 0.76 sumR= -101.8 exp=-0.178 CI95=[-0.29, -0.07] maxDD=161.8R top5=—% coins+ 9/40 T/yr=507.8
  H2    T= 508 WR= 23% PF= 0.45 sumR= -232.2 exp=-0.457 CI95=[-0.56, -0.35] maxDD=235.2R top5=—% coins+ 5/40 T/yr=451.0
  2026  T= 292 WR= 25% PF= 0.47 sumR= -126.0 exp=-0.431 CI95=[-0.56, -0.29] maxDD=126.8R top5=—% coins+ 6/40 T/yr=436.4
  LONG  T=470 exp=-0.336 · SHORT T=610 exp=-0.289
  exits loss=770 (avg -1.09R)  breakeven=31 (avg +0.89R)  tp2=214 (avg +1.88R)  trailing=49 (avg +1.48R)  timeout=16 (avg +0.18R)
  years 2024: T=304 PF=0.70 exp=-0.222 sumR=-67.4 | 2025: T=484 PF=0.63 exp=-0.291 sumR=-140.7 | 2026: T=292 PF=0.47 exp=-0.431 sumR=-126.0
  coins GRT +11.0/30  ICP +4.4/24  ATOM +1.9/36  POL -1.5/21  ARB -1.6/21  GALA -1.7/26  SUI -2.0/20  AAVE -2.5/27  TIA -2.5/18  VET -2.6/21  HBAR -2.8/27  SEI -3.4/25  SOL -3.8/32  ENA -4.5/21  RENDER -4.5/21  FIL -4.9/24  BCH -5.0/37  NEAR -6.6/26  AVAX -8.8/27  SAND -9.1/27  DOT -9.4/34  PEPE -9.6/16  WLD -10.9/23  ETC -11.2/31  FET -11.8/23  IMX -11.8/30  LTC -11.8/26  UNI -12.2/25  LINK -12.8/29  RUNE -13.0/33  ADA -13.4/28  APT -13.8/28  BNB -13.8/36  ONDO -14.6/16  XRP -14.8/32  INJ -16.2/23  DOGE -16.6/35  ETH -20.6/32  BTC -21.0/37  CRV -24.7/32
  LONG  · BTC up      T= 292 WR=29% PF=0.62 sumR=-85.4 exp=-0.293
  LONG  · BTC neutral T=  73 WR=32% PF=0.81 sumR=-10.4 exp=-0.142
  LONG  · BTC down    T= 105 WR=17% PF=0.34 sumR=-62.1 exp=-0.591
  SHORT · BTC up      T= 194 WR=34% PF=0.83 sumR=-23.6 exp=-0.121
  SHORT · BTC neutral T=  38 WR=24% PF=0.46 sumR=-17.2 exp=-0.453
  SHORT · BTC down    T= 378 WR=27% PF=0.55 sumR=-135.4 exp=-0.358
  blocks ddRolling7d=3870 killSwitch=3507 exposure=2522 cooldown=1323 ddDaily=917 maxOpen=431 groupCap=134
  VERDICT REJECT — ACCEPT failed: exp -0.309 < +0.25; PF 0.60 < 1.30; CI95 lower -0.38 ≤ 0; halves H1 -0.178 / H2 -0.457 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 3/40 = 8% < 55%; exp under +15 bps -0.309 < +0.10 | PAPER failed: exp -0.309 < +0.15; PF 0.60 < 1.15; CI95 lower -0.38 ≤ −0.05; halves not both positive (H1 -0.178 / H2 -0.457)

## PH-B1g — POST-HOC B&R ×6 preferred, portfolio guards off  [POST-HOC]
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T=  98 WR= 40% PF= 1.58 sumR=  +36.0 exp=+0.368 CI95=[+0.01, +0.73] maxDD=9.1R top5=52% coins+ 5/6 T/yr=27.4  balDD=17.4%
  H1    T=  55 WR= 40% PF= 1.63 sumR=  +22.1 exp=+0.401 CI95=[-0.10, +0.93] maxDD=7.0R top5=80% coins+ 4/6 T/yr=30.7
  H2    T=  43 WR= 40% PF= 1.52 sumR=  +13.9 exp=+0.324 CI95=[-0.20, +0.86] maxDD=6.9R top5=112% coins+ 5/6 T/yr=24.0
  2026  T=  25 WR= 36% PF= 1.16 sumR=   +2.6 exp=+0.104 CI95=[-0.49, +0.77] maxDD=6.9R top5=561% coins+ 3/6 T/yr=37.4
  slip  +15bps exp=+0.287 (T=98, PF 1.46, CI lo -0.05) · +30bps exp=+0.228 (PF 1.36)
  LONG  T=29 exp=+0.321 · SHORT T=69 exp=+0.387
  exits loss=56 (avg -1.08R)  tp2=23 (avg +2.93R)  timeout=12 (avg +0.73R)  trailing=6 (avg +2.99R)  tp1=1 (avg +2.49R)
  years 2023: T=33 PF=2.11 exp=+0.628 sumR=+20.7 | 2024: T=23 PF=1.02 exp=+0.012 sumR=+0.3 | 2025: T=17 PF=2.30 exp=+0.730 sumR=+12.4 | 2026: T=25 PF=1.16 exp=+0.104 sumR=+2.6
  coins SAND +11.8/21  ETC +10.8/13  SOL +9.1/11  AVAX +3.1/15  XRP +1.3/16  BNB -0.0/22
  LONG  · BTC up      T=  26 WR=35% PF=1.47 sumR=+8.5 exp=+0.327
  LONG  · BTC neutral T=   2 WR=0% PF=0.00 sumR=-2.1 exp=-1.071
  LONG  · BTC down    T=   1 WR=100% PF=— sumR=+3.0 exp=+2.950
  SHORT · BTC up      T=  30 WR=43% PF=1.53 sumR=+8.8 exp=+0.292
  SHORT · BTC neutral T=   9 WR=67% PF=4.56 sumR=+11.9 exp=+1.325
  SHORT · BTC down    T=  30 WR=33% PF=1.28 sumR=+6.0 exp=+0.201
  blocks exposure=168 weeklyTrend=100 cooldown=6
  VERDICT REJECT (post-hoc — not for promotion) — ACCEPT failed: 27.4 trades/yr < 50 and T=98 < 100; top-5 share 52% > 30% | PAPER failed: 27.4 trades/yr < 30

## PH-B2g — POST-HOC B&R ×40, portfolio guards off  [POST-HOC]
  window 2023-02-02→2026-09-02 (4h×8000)
  FULL  T= 472 WR= 31% PF= 0.97 sumR=  -10.1 exp=-0.021 CI95=[-0.17, +0.12] maxDD=46.0R top5=—% coins+ 20/40 T/yr=131.8  balDD=70.7%
  H1    T= 221 WR= 30% PF= 0.99 sumR=   -1.5 exp=-0.007 CI95=[-0.22, +0.22] maxDD=27.2R top5=—% coins+ 17/38 T/yr=123.4
  H2    T= 251 WR= 31% PF= 0.95 sumR=   -8.6 exp=-0.034 CI95=[-0.22, +0.16] maxDD=46.0R top5=—% coins+ 19/40 T/yr=140.2
  2026  T= 131 WR= 28% PF= 0.78 sumR=  -20.6 exp=-0.158 CI95=[-0.41, +0.11] maxDD=46.0R top5=—% coins+ 14/39 T/yr=196.0
  slip  +15bps exp=-0.071 (T=471, PF 0.90, CI lo -0.21) · +30bps exp=-0.112 (PF 0.84)
  LONG  T=125 exp=-0.077 · SHORT T=347 exp=-0.001
  exits loss=314 (avg -1.07R)  tp2=85 (avg +2.80R)  timeout=49 (avg +0.71R)  trailing=22 (avg +2.29R)  tp1=2 (avg +1.90R)
  years 2023: T=142 PF=1.12 exp=+0.084 sumR=+11.9 | 2024: T=89 PF=0.77 exp=-0.178 sumR=-15.9 | 2025: T=110 PF=1.19 exp=+0.132 sumR=+14.5 | 2026: T=131 PF=0.78 exp=-0.158 sumR=-20.6
  coins SAND +12.8/20  ETC +10.8/13  SOL +10.2/10  SUI +9.3/7  HBAR +8.3/10  RUNE +8.0/9  ARB +5.6/6  AVAX +4.4/14  CRV +4.0/3  LINK +3.7/10  TIA +3.5/12  DOT +3.4/14  GALA +2.3/7  DOGE +1.9/17  FET +1.7/6  XRP +1.3/16  AAVE +0.6/10  ADA +0.3/19  PEPE +0.1/7  ETH +0.1/21  BNB -0.0/22  NEAR -0.2/7  ONDO -0.9/2  ICP -1.0/7  LTC -2.2/25  ENA -2.4/3  WLD -2.9/7  IMX -3.3/8  RENDER -3.5/6  VET -4.4/9  POL -5.2/9  INJ -5.2/5  BCH -5.8/15  FIL -6.6/14  ATOM -6.6/19  APT -7.7/12  GRT -8.1/13  SEI -9.0/11  UNI -13.7/17  BTC -13.9/30
  LONG  · BTC up      T= 108 WR=29% PF=1.04 sumR=+3.4 exp=+0.031
  LONG  · BTC neutral T=  11 WR=0% PF=0.00 sumR=-10.8 exp=-0.979
  LONG  · BTC down    T=   6 WR=17% PF=0.57 sumR=-2.3 exp=-0.377
  SHORT · BTC up      T= 102 WR=29% PF=0.72 sumR=-20.5 exp=-0.201
  SHORT · BTC neutral T=  61 WR=34% PF=1.17 sumR=+7.2 exp=+0.118
  SHORT · BTC down    T= 184 WR=33% PF=1.10 sumR=+12.9 exp=+0.070
  blocks exposure=741 weeklyTrend=513 cooldown=39 maxOpen=25 groupCap=13
  VERDICT REJECT (post-hoc — not for promotion) — ACCEPT failed: exp -0.021 < +0.25; PF 0.97 < 1.30; CI95 lower -0.17 ≤ 0; halves H1 -0.007 / H2 -0.034 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 20/40 = 50% < 55%; exp under +15 bps -0.071 < +0.10 | PAPER failed: exp -0.021 < +0.15; PF 0.97 < 1.15; CI95 lower -0.17 ≤ −0.05; halves not both positive (H1 -0.007 / H2 -0.034)

## PH-R1g — POST-HOC RSI ×2 preferred, portfolio guards off  [POST-HOC]
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T= 171 WR= 34% PF= 1.06 sumR=   +7.5 exp=+0.044 CI95=[-0.20, +0.30] maxDD=23.2R top5=286% coins+ 1/2 T/yr=75.9  balDD=46.5%
  H1    T=  84 WR= 31% PF= 0.92 sumR=   -5.4 exp=-0.064 CI95=[-0.39, +0.28] maxDD=18.7R top5=—% coins+ 1/2 T/yr=74.6
  H2    T=  87 WR= 37% PF= 1.21 sumR=  +12.9 exp=+0.148 CI95=[-0.23, +0.53] maxDD=12.6R top5=166% coins+ 2/2 T/yr=77.2
  2026  T=  47 WR= 45% PF= 1.51 sumR=  +14.9 exp=+0.317 CI95=[-0.16, +0.80] maxDD=8.7R top5=108% coins+ 2/2 T/yr=70.2
  slip  +15bps exp=-0.044 (T=171, PF 0.94, CI lo -0.27) · +30bps exp=-0.113 (PF 0.84)
  LONG  T=67 exp=-0.057 · SHORT T=104 exp=+0.109
  exits loss=112 (avg -1.11R)  tp2=43 (avg +2.50R)  trailing=12 (avg +1.75R)  tp1=1 (avg +1.60R)  timeout=3 (avg +0.44R)
  years 2024: T=42 PF=1.04 exp=+0.028 sumR=+1.2 | 2025: T=82 PF=0.87 exp=-0.104 sumR=-8.5 | 2026: T=47 PF=1.51 exp=+0.317 sumR=+14.9
  coins ATOM +12.5/97  INJ -5.0/74
  LONG  · BTC up      T=  47 WR=26% PF=0.66 sumR=-13.0 exp=-0.277
  LONG  · BTC neutral T=   6 WR=50% PF=1.93 sumR=+3.2 exp=+0.527
  LONG  · BTC down    T=  14 WR=50% PF=1.81 sumR=+6.1 exp=+0.434
  SHORT · BTC up      T=  32 WR=34% PF=1.02 sumR=+0.5 exp=+0.015
  SHORT · BTC neutral T=  13 WR=31% PF=1.03 sumR=+0.3 exp=+0.020
  SHORT · BTC down    T=  59 WR=36% PF=1.26 sumR=+10.6 exp=+0.179
  blocks exposure=385 cooldown=254
  VERDICT REJECT (post-hoc — not for promotion) — ACCEPT failed: exp +0.044 < +0.25; PF 1.06 < 1.30; CI95 lower -0.20 ≤ 0; halves H1 -0.064 / H2 +0.148 (need same sign, each ≥ +0.10); top-5 share 286% > 30%; coins positive 1/2 = 50% < 55%; exp under +15 bps -0.044 < +0.10 | PAPER failed: exp +0.044 < +0.15; PF 1.06 < 1.15; CI95 lower -0.20 ≤ −0.05; halves not both positive (H1 -0.064 / H2 +0.148)

## PH-R2g — POST-HOC RSI ×40, portfolio guards off  [POST-HOC]
  window 2024-06-01→2026-09-02 (1h×20000)
  FULL  T=2524 WR= 31% PF= 0.88 sumR= -226.1 exp=-0.090 CI95=[-0.15, -0.03] maxDD=272.3R top5=—% coins+ 12/40 T/yr=1120.3  balDD=100.0%
  H1    T=1195 WR= 34% PF= 1.04 sumR=  +31.3 exp=+0.026 CI95=[-0.06, +0.11] maxDD=114.2R top5=73% coins+ 19/40 T/yr=1060.9
  H2    T=1329 WR= 29% PF= 0.76 sumR= -257.4 exp=-0.194 CI95=[-0.27, -0.11] maxDD=265.3R top5=—% coins+ 11/40 T/yr=1179.8
  2026  T= 739 WR= 28% PF= 0.68 sumR= -192.2 exp=-0.260 CI95=[-0.36, -0.16] maxDD=210.5R top5=—% coins+ 7/40 T/yr=1104.5
  slip  +15bps exp=-0.154 (T=2520, PF 0.80, CI lo -0.21) · +30bps exp=-0.208 (PF 0.72)
  LONG  T=1088 exp=-0.210 · SHORT T=1436 exp=+0.002
  exits loss=1726 (avg -1.11R)  trailing=210 (avg +1.79R)  tp2=547 (avg +2.35R)  timeout=37 (avg +0.54R)  tp1=4 (avg +1.73R)
  years 2024: T=642 PF=0.93 exp=-0.050 sumR=-32.2 | 2025: T=1143 PF=1.00 exp=-0.001 sumR=-1.7 | 2026: T=739 PF=0.68 exp=-0.260 sumR=-192.2
  coins GRT +28.1/78  ATOM +19.3/91  POL +14.6/47  AAVE +10.5/74  RUNE +9.1/68  SOL +8.4/61  ICP +8.0/49  BCH +7.9/81  ARB +7.9/65  PEPE +6.4/58  INJ +2.1/56  TIA +0.1/47  HBAR -0.5/60  RENDER -0.5/56  GALA -1.1/63  AVAX -1.7/63  WLD -4.4/58  APT -5.0/67  FIL -6.3/60  SAND -7.5/75  IMX -8.5/63  UNI -8.8/71  SUI -9.2/43  NEAR -9.2/49  DOGE -9.4/77  DOT -11.1/70  VET -11.5/63  FET -11.9/62  ONDO -12.7/43  ETC -14.7/67  ADA -15.2/61  XRP -15.9/58  SEI -17.1/58  LINK -21.3/65  ETH -21.6/65  BTC -21.7/72  BNB -22.4/79  CRV -22.5/59  ENA -24.8/51  LTC -31.9/71
  LONG  · BTC up      T= 633 WR=28% PF=0.76 sumR=-119.5 exp=-0.189
  LONG  · BTC neutral T= 124 WR=28% PF=0.72 sumR=-27.5 exp=-0.221
  LONG  · BTC down    T= 331 WR=27% PF=0.69 sumR=-82.0 exp=-0.248
  SHORT · BTC up      T= 473 WR=40% PF=1.36 sumR=+112.5 exp=+0.238
  SHORT · BTC neutral T= 179 WR=30% PF=0.78 sumR=-30.5 exp=-0.171
  SHORT · BTC down    T= 784 WR=31% PF=0.87 sumR=-79.2 exp=-0.101
  blocks exposure=6055 cooldown=3017 maxOpen=1739 groupCap=449
  VERDICT REJECT (post-hoc — not for promotion) — ACCEPT failed: exp -0.090 < +0.25; PF 0.88 < 1.30; CI95 lower -0.15 ≤ 0; halves H1 +0.026 / H2 -0.194 (need same sign, each ≥ +0.10); top-5 share —% > 30%; coins positive 12/40 = 30% < 55%; exp under +15 bps -0.154 < +0.10 | PAPER failed: exp -0.090 < +0.15; PF 0.88 < 1.15; CI95 lower -0.15 ≤ −0.05; halves not both positive (H1 +0.026 / H2 -0.194)

## COMPONENT VERDICTS (selection-bias rule applied literally)
  break-retest: REJECT
    - B1 (preferred) verdict REJECT: ACCEPT failed: 27.4 trades/yr < 50 and T=98 < 100; top-5 share 52% > 30% | PAPER failed: 27.4 trades/yr < 30
    - B2 (40-coin universe) exp -0.016 < +0.15 → selection-bias rule FAILED
    - B3 (non-preferred coins only) exp -0.124 PF 0.83 T=349 coins+ 16/34
  rsi-divergence: REJECT
    - R1 (preferred) verdict REJECT: ACCEPT failed: exp +0.034 < +0.25; PF 1.05 < 1.30; CI95 lower -0.21 ≤ 0; halves H1 -0.051 / H2 +0.117 (need same sign, each ≥ +0.10); top-5 share 369% > 30%; coins positive 1/2 = 50% < 55%; exp under +15 bps -0.053 < +0.10 | PAPER failed: exp +0.034 < +0.15; PF 1.05 < 1.15; CI95 lower -0.21 ≤ −0.05; halves not both positive (H1 -0.051 / H2 +0.117)
    - R2 (40-coin universe) exp -0.125 < +0.15 → selection-bias rule FAILED
    - R3 (non-preferred coins only) exp -0.175 PF 0.78 T=1128 coins+ 11/38

## Hypotheses
  H1 (B&R holds on 40 coins, exp ≥ +0.15R): NOT SUPPORTED — B2 exp -0.016 (T=430), B3 exp -0.124 (T=349)
  H2 (RSI holds on 40 coins, exp ≥ +0.15R): NOT SUPPORTED — R2 exp -0.125 (T=1207), R3 exp -0.175 (T=1128)
  H3 (stable across halves): B1 yes (H1 +0.401 / H2 +0.324), B2 no (H1 -0.003 / H2 -0.026), R1 no (H1 -0.051 / H2 +0.117), R2 no (H1 +0.006 / H2 -0.270)
