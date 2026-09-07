# Phase 9 — PORTFOLIO stage — verdicts and reading guide (2026-09-02)

Script: `script/audit/phase9-portfolio.ts` (fork of phase8-collapse.ts; server/ and client/ untouched). Raw run log follows this block verbatim. Summary JSON: `script/.cache/phase9-portfolio-summary.json`; trade dumps (P0, E2, E4 record cells): `script/.cache/phase9-portfolio-trades.json`.

## Decisions taken BEFORE the run (see script header)
- Component inputs: LS SHORT-only & BTC daily UP = literal ACCEPT (regime stage, flagged fragile); TSMOM daily = literal PAPER-CANDIDATE (tsmom stage, flagged order-fragile); Break & Retest and RSI Divergence = REJECT (brrsi stage, selection-bias rule failed).
- Rule "a portfolio containing a REJECTED component is not run except P0/P1 baselines": P2–P4 as written in the brief contain B&R + RSI. They are simulated because the brief named them, but they are REFERENCE ONLY and cannot be recommended (their literal verdicts are recorded and then overridden to REJECT). The promotable set is built from the eligible components only: **E2 = LS-regime alone, E3 = TSMOM alone, E4 = LS-regime + TSMOM**.
- Verdict of record per portfolio = the current-engine cell (trio guards, maxOpen 10, 0 bps), exp@+15 bps from the paired cell. Grid cells are calibration, not verdicts. Guard-grid rule: lowest maxDD(R) X∈{8,12,16} with sumR ≥ 90 % of guards-OFF sumR; ties → larger X.
- Windows: FULL = 2024-05-31 → 2026-09-02 (2.26 y, the 1h decision span; acceptance window), H1/H2 split 2025-07-17, 2026, Aug14→Sep1 (parity only), EXT (all trades from each component's own history: 4h from 2023-01, 1d from 2022-10).
- Params: $500 / 2 % (R metrics are scale-invariant; only the balance-DD % depends on it), honest entry = signal-candle close, fees 0.05 % + slippage model 0.05 %/side, no margin gate.

## Parity
- P0 on the phase8 pool/context (B&R 4h×20000, BTC 1d×600, alts 1d×400): **T=1647 · PF 0.92 · sumR −103.0 · exp −0.063 · maxDD 202.9R — EXACT** match with `phase8-report-core-20000.md` "FLOOR 68", block counts identical. (The first attempt was off by 4 trades because of the same-timestamp tiebreak; the pool is now built in registry order like phase8.)
- E2 record cell reproduces the regime stage's A2 exactly (T=559, +143.9R, exp +0.257, CI [+0.105, +0.419], maxDD 59.8R, halves +0.108 / +0.462). E3 on EXT reproduces the tsmom stage's T0 (T=403, +73.8R, exp +0.183, maxDD 30.0R).
- Aug14→Sep1 (reset window): P0 T=38 exp −0.264 vs realized paper −0.29R/30 and live −0.45R/43 — consistent. E2 in the same window: 13 trades, 0 wins, −14.5R (every LS short in the BTC-up regime lost after the reset).

## Verdicts of record (FULL window, trio guards, maxOpen 10)
| portfolio | T | PF | sumR | exp | CI95 | maxDD R | H1 / H2 | tr/yr | exp @+15 | coins+ | top-5 | PORTFOLIO-PAPER | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 LS both + B&R + RSI (baseline) | 1524 | 0.89 | −130.1 | −0.085 | [−0.165, −0.000] | 208.4 | −0.140 / −0.041 | 675 | −0.174 | 33 % | — | fails 6/7 | REJECT |
| P1 B&R + RSI (baseline) | 223 | 1.09 | +13.7 | +0.061 | [−0.159, +0.289] | 21.2 | +0.007 / +0.110 | 99 | −0.027 | 75 % | 160 % | fails 5/7 | REJECT |
| P2 P1 + LS-regime [reference] | 724 | 1.33 | +169.3 | +0.234 | [+0.098, +0.369] | 63.4 | +0.087 / +0.406 | 321 | +0.137 | 73 % | 20 % | fails halves, maxDD | REJECT (not eligible) |
| P3 P1 + TSMOM [reference] | 229 | 1.28 | +38.8 | +0.170 | [−0.026, +0.376] | 19.0 | +0.264 / +0.111 | 101 | +0.127 | 69 % | 49 % | fails exp, PF, CI | REJECT (not eligible) |
| P4 P2 + TSMOM [reference] | 384 | 1.42 | +99.5 | +0.259 | [+0.097, +0.425] | 17.4 | +0.251 / +0.268 | 170 | +0.145 | 73 % | 21 % | met (literal ACCEPT-LIVE) | REJECT (not eligible: contains rejected B&R/RSI) |
| **E2 LS-regime alone** | 559 | 1.37 | +143.9 | +0.257 | [+0.105, +0.419] | **59.8** | +0.108 / +0.462 | 248 | +0.161 | 73 % | 22 % | fails maxDD ≤ 25R only | REJECT |
| **E3 TSMOM alone** | 160 | 1.42 | +37.2 | +0.233 | [+0.010, +0.454] | 16.2 | +0.343 / +0.147 | **71** | +0.204 | 67 % | 35 % | fails ≥ 80 tr/yr only | REJECT |
| **E4 LS-regime + TSMOM** | 351 | 1.46 | +98.8 | +0.282 | [+0.113, +0.452] | 24.0 | +0.234 / +0.340 | 156 | +0.237 | 73 % | 19 % | **all 7 met** | **ACCEPT-LIVE-CANDIDATE (literal)** |

E4 detail: EXT (3.9 y) T=594 exp +0.228 PF 1.38 maxDD 30.0R; 2026 T=84 exp +0.221 PF 1.38; Aug14→Sep1 T=20 +1.0R; sleeves LS T=197 exp +0.259 (24/40 coins+), TSMOM T=154 exp +0.310 (28/40); balance DD 50.6 % at 2 %/$500; avg hold 17.4 d; longest time under water 79 d; top-5 trades 4.19/4.12/3.49/3.44/3.26R.

## Guard grid (FULL, 0 bps) — pre-stated rule, calibration only
| portfolio | maxOpen | OFF sumR / maxDD | trio sumR / maxDD | dd8 | dd12 | dd16 | pick |
|---|---|---|---|---|---|---|---|
| P0 | 10 | −52.1 / 236.7 | −130.1 / 208.4 | −86.2 / 195.8 | +6.6 / 155.8 | −98.7 / 233.0 | undefined (OFF sumR ≤ 0 — nothing to protect) |
| P1 | 10 | +20.3 / 19.4 | +13.7 / 21.2 | +19.1 / 19.4 | +20.3 / 19.4 | +20.3 / 19.4 | X=16 (never fires) |
| P2 | 10 | +174.2 / 94.3 | +169.3 / 63.4 | +172.1 / 64.5 | +144.6 / 99.1 | +172.0 / 110.9 | X=8 |
| P3 | 10 | +47.8 / 19.0 | +38.8 / 19.0 | +43.9 / 19.0 | +47.8 / 19.0 | +47.8 / 19.0 | X=16 (never fires) |
| P4 | 10 | +99.4 / 22.7 | +99.5 / 17.4 | +94.5 / 32.2 | +108.0 / 18.4 | +86.2 / 27.5 | X=12 |
| E2 | 10 | +131.0 / 87.1 | +143.9 / 59.8 | +111.7 / 67.9 | +135.6 / 95.7 | +148.3 / 98.8 | X=12 by the rule, but the trio (59.8R) beats every X |
| E3 | 10 | +47.0 / 16.2 | +37.2 / 16.2 | +51.6 / 14.2 | +47.0 / 16.2 | +47.0 / 16.2 | X=8 |
| **E4** | 10 | +127.3 / 20.5 | +98.8 / 24.0 | +100.1 / 22.9 | **+126.2 / 16.9** | +121.6 / 22.9 | **X=12** — the only cell that lowers maxDD below OFF while keeping 99 % of sumR; trio costs −28.5R and raises maxDD |
| E4 | 6 | +62.4 / 16.0 | +80.3 / 16.4 | +43.8 / 31.7 | +52.5 / 23.8 | +62.4 / 16.0 | X=16 (never fires); at maxOpen 6 the dd guard hurts |
Time halted (trio → dd12): P0 24.2 % → 6.5 %; E2 31.5 % → 6.4 %; E4 5.1 % → 0.3 % (4 episodes). Across portfolios no single X is best; X=12 is best for the only recommendable book (E4, maxOpen 10) and never worse than OFF for P1/P3. maxOpen 6 lowers maxDD in the LS-heavy books (P0 208→126R, P2 63→61R) at a large sumR cost, and cuts E4's sumR from +98.8 to +80.3 with no maxDD gain (24.0 → 16.4R but H1 exp falls to +0.144).

## POST-HOC (labelled — not used for any verdict)
1. Same-timestamp order (10 seeds, record cells): E4 exp min/med/max +0.142/+0.238/+0.368, maxDD 14.9–37.4R, CI lo > 0 in 9/10, all 6 non-slip PAPER criteria in 6/10 (the maxDD ≤ 25R criterion is the one that flips); E2 exp +0.222…+0.270 (order-robust); E3 exp +0.032…+0.234 (median +0.127, CI lo > 0 in 1/10 — the order fragility found by the tsmom stage); P4 +0.207…+0.295. The E4 default A→Z order sits at the 70th percentile of its seed range, not at the top.
2. Funding −0.03 %/day on every position: E4 exp +0.249 (PF 1.40, CI lo +0.088, maxDD 24.6R); with +15 bps too: exp +0.184, PF 1.30, CI lo +0.029, maxDD 25.6R — under the PAPER bar on exp (0.20) and maxDD (25R) by small margins. E3 +funding +0.171 / +15 bps +0.115; E2 +funding +0.239.
3. Clean OOS slice for the regime hypothesis (PRE-8000 = 2024-05-31 → 2025-10-04, before the window on which the SHORT-BTC-up pattern was first seen): E4 T=247 exp +0.243 PF 1.38 halves +0.269 / +0.210 maxDD 24.0R; LAST-8000 T=104 exp +0.373 PF 1.70. E2 on the same OOS slice: exp +0.088, halves +0.323 / −0.286 (as the regime stage reported). Inside E4 the LS sleeve on PRE-8000 is T=152 exp +0.194 vs E2's T=376 exp +0.088 — E4 takes only ~40 % of the LS-regime trades (maxOpen blocks 2006), and the skipped ones fall disproportionately in the Apr–Sep 2025 drought (E2 May–Jul 2025: −36.7R/95 trades; E4 same months: +1.8R/54). This is a slot-occupancy effect (TSMOM positions loaded during strong trends), i.e. portfolio construction, not signal quality — and it is the mechanism behind the seed sensitivity in (1).
4. Direction × BTC daily (E4): LONG·up T=76 +0.212 (TSMOM), SHORT·up T=212 +0.257 (mostly LS), SHORT·down T=45 +0.632 (TSMOM), LONG·down T=11 −0.464. Monthly: E4 12/28 months negative, worst month −16.1R (2024-12); E2 12/22 negative with a 6-month run Apr–Sep 2025 (−50R); E3 13/24 negative.
5. Sleeve interaction in the reference books: adding TSMOM to P1 (→ P3) starves B&R (56 → 24 trades, sleeve exp +0.228 → −0.189) and RSI (167 → 41); P4's B&R sleeve is −0.270R over 19 trades. Nothing in P2–P4 argues for keeping B&R/RSI.

## Bottom line
- No pre-registered P-portfolio is recommendable: P0/P1 are negative or flat; P2–P4 contain rejected components (P4 would pass every criterion literally, but its B&R/RSI sleeves are the rejected hand-picked lists and contribute +3.5R of its +99.5R).
- **E4 (LS SHORT-only & BTC daily UP + TSMOM daily, 40 coins each) is the only portfolio that passes the PORTFOLIO-PAPER rule, and it passes the general ACCEPT-LIVE rule too — literally.** It should be read as **PAPER-first**: (a) maxDD 24.0R clears the 25R bar by 1.0R and flips in 4/10 arbitrary orderings; (b) with funding + 15 bps it lands at exp +0.184 / maxDD 25.6R; (c) it inherits the regime component's in-sample formation (mitigated: E4 is +0.243 on the clean OOS slice) and the TSMOM component's order fragility; (d) both sleeves are Binance-spot replays (phase 8: only 11/28 paper LS signals reproduced on Binance vs MEXC); (e) the engine has no 1d MAX_HOLD entry, no per-strategy slot cap and its trio guards cost E4 −28.5R vs OFF — the design dd-guard at X=12 is the calibration that fits this book (maxDD 16.9R, 0.3 % time halted).
- Standing gate unchanged: honest paper ≥ +0.3R over ≥ 120 trades before any live. E4 produces ~156 trades/yr in simulation, so the gate is reachable in ~9–10 months of paper.

---
# RAW RUN LOG (generated by script/audit/phase9-portfolio.ts)

# Phase 9 — PORTFOLIO stage — 2026-09-02
capital $500 · base risk 2% · exits {"trailMode":"r_multiple","trailRMultiple":2} · honest entry (signal-candle close) · fees 0.05% + slippage model 0.05%/side inside simulateManagedExit · no margin gate (R metrics are scale-invariant)
data (Binance spot, day cache 20260902): LS 1h×20000 ×40 · B&R 4h×8000 ×6 (parity pool 4h×20000) · RSI 1h×20000 ×2 · TSMOM 1d×1500 ×40 · BTC/alt daily context 1d×1500 (parity: 600/400) · weekly 1w×400

## Pre-registration (fixed before the run — see the header of script/audit/phase9-portfolio.ts)
- Components received: LS SHORT & BTC-daily-UP = ACCEPT (fragile); TSMOM = PAPER-CANDIDATE (order-fragile); B&R = REJECT; RSI = REJECT (selection-bias rule).
- P0/P1 baselines; P2–P4 as written in the brief are simulated but contain REJECTED B&R/RSI → REFERENCE ONLY, not recommendable; eligible set E2 = LS-regime alone, E3 = TSMOM alone, E4 = LS-regime + TSMOM.
- Grid: guards {trio, OFF, dd X∈{8,12,16} resume X/2, 30d peak, 24h max halt} × maxOpen {6,10} × slip {0,+15 bps}. Verdict of record = trio / maxOpen 10 / 0 bps cell (exp@15 from the paired cell).
- Guard-grid rule: lowest maxDD(R) X with sumR ≥ 90% of guards-OFF sumR (defined only when guards-OFF sumR > 0); ties → larger X.
- PORTFOLIO-PAPER acceptance on FULL: exp ≥ +0.20; PF ≥ 1.30; CI95 lo > 0; halves ≥ +0.10 each; ≥ 80 tr/yr; maxDD ≤ 25R; exp@+15bps ≥ +0.10. General ACCEPT-LIVE rule also evaluated.
- POST-HOC (labelled): 10-seed same-timestamp order shuffles; funding drag −0.03%/day; sleeve breakdown.

## Windows
  FULL = 2024-05-31T07:00:00.000Z → 2026-09-02T10:00:00.000Z (2.26y) · MID = 2025-07-17 · 2026 from 2026-01-01 · Aug14→Sep1 = [2026-08-14, 2026-09-02) · EXT = all trades
  streams: BTC:1h 2024-05-22→2026-09-02 (20000) · SOL:4h 2023-01-08→2026-09-02 (8000) · SOL:4h:parity 2020-08-11→2026-09-02 (13279) · BTC:1d 2022-07-25→2026-09-01 (1500) · ATOM:1h 2024-05-22→2026-09-02 (20000)

[LS candidates loaded from script/.cache/phase9-portfolio-ls-20000-20260902.json: 7908]
## Candidate pools (post minSL 0.6% + R:R 1.5)
  master: LS=7908 (SHORT 5069) · B&R(4h×8000)=372 · RSI=810 · TSMOM=2481 · total 11571
  parity: LS=7908 · B&R(4h×20000)=606 · RSI=810 · total 9324

## PARITY — P0 on phase8 pool (B&R 4h×20000, BTC 1d×600, alts 1d×400) vs phase8-report-core-20000 "FLOOR 68": T=1647 WR=29% PF=0.92 sumR=-103.0 exp=-0.063 maxDD=202.9R
  EXT     T=1647 WR= 29% PF= 0.92 sumR= -103.0 exp=-0.063 CI95=[-0.141, +0.020] maxDD=202.9R  balDD=99.5%
  blocks: ddRolling7d=2987 exposure=1856 killSwitch:liquidity-sweep=1493 cooldown=439 ddDaily=369 maxOpen=209 groupCap=194 weeklyTrend=130
  parity: EXACT

# P0 current honest engine: LS floor 68 both dirs + B&R + RSI
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T=1524 WR= 29% PF= 0.89 sumR= -130.1 exp=-0.085 CI95=[-0.165, -0.000] maxDD=208.4R  balDD=99.4%
          H1 T=687 exp=-0.140 sumR=-96.1 | H2 T=837 exp=-0.041 sumR=-34.0 | top5=—% | coins+ 13/40 (33%) | 675 tr/yr over 2.26y
  H1      T= 687 WR= 26% PF= 0.83 sumR=  -96.1 exp=-0.140 CI95=[-0.258, -0.016] maxDD=145.8R
  H2      T= 837 WR= 31% PF= 0.95 sumR=  -34.0 exp=-0.041 CI95=[-0.149, +0.075] maxDD= 66.5R
  2026    T= 561 WR= 33% PF= 1.05 sumR=  +19.3 exp=+0.034 CI95=[-0.101, +0.180] maxDD= 44.6R
  Aug14→  T=  38 WR= 32% PF= 0.65 sumR=  -10.0 exp=-0.264 CI95=[-0.664, +0.162] maxDD= 15.3R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T=1566 WR= 29% PF= 0.91 sumR= -106.8 exp=-0.068 CI95=[-0.150, +0.013] maxDD=208.4R  (3.53y, 444 tr/yr)
  +15bps  FULL T=1445 WR= 28% PF= 0.78 sumR= -251.5 exp=-0.174 CI95=[-0.253, -0.096] maxDD=293.1R | EXT exp=-0.156
  blocks: ddRolling7d=2970 exposure=1745 killSwitch:liquidity-sweep=1478 cooldown=427 ddDaily=427 maxOpen=222 groupCap=189 weeklyTrend=66 | guard time halted 24.2% in 116 episodes
  sleeve break-retest     FULL T=  37 PF=1.72 sumR=+15.5 exp=+0.418 | H1 +0.612 H2 +0.336 | coins+ 5/6
  sleeve liquidity-sweep  FULL T=1382 PF=0.85 sumR=-164.9 exp=-0.119 | H1 -0.169 H2 -0.078 | coins+ 14/40
  sleeve rsi-divergence   FULL T= 105 PF=1.27 sumR=+19.4 exp=+0.185 | H1 +0.026 H2 +0.328 | coins+ 2/2
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER failed: ✗ exp -0.085 ≥ +0.20; ✗ PF 0.89 ≥ 1.30; ✗ CI95 lo -0.165 > 0; ✗ halves -0.140 / -0.041 each ≥ +0.10; ✗ maxDD 208.4R ≤ 25R; ✗ exp @ +15 bps -0.174 ≥ +0.10
    general ACCEPT-LIVE failed on: exp ≥ +0.25; PF ≥ 1.30; CI lo > 0; halves each ≥ +0.10; top-5 ≤ 30% (—%); coins+ ≥ 55% (33%); slip15 ≥ +0.10
    NOT ELIGIBLE for recommendation: contains a component REJECTED by its component stage (B&R / RSI) — reference only
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 1524 | 0.89 | -130.1 | -0.085 | -0.165 | 208.4 | -0.140 | -0.041 | 675 | 24.2 | fail |
| trio | 10 | 15 | 1445 | 0.78 | -251.5 | -0.174 | -0.253 | 293.1 | -0.142 | -0.207 | 640 | 24.6 | — |
| OFF | 10 | 0 | 3266 | 0.98 | -52.1 | -0.016 | -0.074 | 236.7 | -0.077 | +0.047 | 1448 | 0.0 | fail |
| OFF | 10 | 15 | 3261 | 0.88 | -292.1 | -0.090 | -0.143 | 340.0 | -0.136 | -0.042 | 1445 | 0.0 | — |
| dd8 | 10 | 0 | 2800 | 0.96 | -86.2 | -0.031 | -0.091 | 195.8 | -0.059 | -0.003 | 1241 | 10.0 | fail |
| dd8 | 10 | 15 | 2772 | 0.87 | -284.9 | -0.103 | -0.162 | 335.2 | -0.119 | -0.086 | 1229 | 10.6 | — |
| dd12 | 10 | 0 | 2983 | 1.00 | +6.6 | +0.002 | -0.060 | 155.8 | -0.029 | +0.034 | 1322 | 6.5 | fail |
| dd12 | 10 | 15 | 2990 | 0.89 | -254.3 | -0.085 | -0.139 | 288.5 | -0.113 | -0.056 | 1325 | 6.9 | — |
| dd16 | 10 | 0 | 3104 | 0.96 | -98.7 | -0.032 | -0.090 | 233.0 | -0.091 | +0.027 | 1376 | 4.7 | fail |
| dd16 | 10 | 15 | 3084 | 0.87 | -297.5 | -0.096 | -0.151 | 337.8 | -0.144 | -0.049 | 1367 | 5.0 | — |
| trio | 6 | 0 | 1378 | 0.92 | -82.5 | -0.060 | -0.145 | 126.0 | -0.092 | -0.029 | 611 | 18.2 | fail |
| trio | 6 | 15 | 1218 | 0.77 | -226.8 | -0.186 | -0.270 | 259.2 | -0.208 | -0.166 | 540 | 20.6 | — |
| OFF | 6 | 0 | 2519 | 0.96 | -79.0 | -0.031 | -0.094 | 159.6 | -0.055 | -0.007 | 1116 | 0.0 | fail |
| OFF | 6 | 15 | 2504 | 0.87 | -256.8 | -0.103 | -0.162 | 284.6 | -0.109 | -0.096 | 1110 | 0.0 | — |
| dd8 | 6 | 0 | 2306 | 0.96 | -65.9 | -0.029 | -0.097 | 129.1 | -0.053 | -0.005 | 1022 | 8.7 | fail |
| dd8 | 6 | 15 | 2276 | 0.87 | -229.9 | -0.101 | -0.166 | 256.2 | -0.117 | -0.085 | 1009 | 9.1 | — |
| dd12 | 6 | 0 | 2397 | 0.95 | -86.4 | -0.036 | -0.104 | 174.5 | -0.076 | +0.005 | 1062 | 5.2 | fail |
| dd12 | 6 | 15 | 2373 | 0.86 | -262.2 | -0.110 | -0.174 | 287.5 | -0.112 | -0.109 | 1052 | 5.5 | — |
| dd16 | 6 | 0 | 2444 | 0.93 | -125.8 | -0.051 | -0.116 | 176.7 | -0.078 | -0.024 | 1083 | 3.8 | fail |
| dd16 | 6 | 15 | 2431 | 0.81 | -364.1 | -0.150 | -0.210 | 380.6 | -0.164 | -0.135 | 1077 | 4.2 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR -52.1 maxDD 236.7R | trio sumR -130.1 maxDD 208.4R | X=8: sumR -86.2 (166% of OFF) maxDD 195.8R halted 10.0%/106ep · X=12: sumR +6.6 (-13% of OFF) maxDD 155.8R halted 6.5%/69ep · X=16: sumR -98.7 (190% of OFF) maxDD 233.0R halted 4.7%/51ep
    → pick: undefined — guards-OFF sumR -52.1 ≤ 0 (nothing to protect)
  maxOpen 6: OFF sumR -79.0 maxDD 159.6R | trio sumR -82.5 maxDD 126.0R | X=8: sumR -65.9 (83% of OFF) maxDD 129.1R halted 8.7%/88ep · X=12: sumR -86.4 (109% of OFF) maxDD 174.5R halted 5.2%/57ep · X=16: sumR -125.8 (159% of OFF) maxDD 176.7R halted 3.8%/41ep
    → pick: undefined — guards-OFF sumR -79.0 ≤ 0 (nothing to protect)

# P1 B&R + RSI (no LS)
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 223 WR= 34% PF= 1.09 sumR=  +13.7 exp=+0.061 CI95=[-0.159, +0.289] maxDD= 21.2R  balDD=48.1%
          H1 T=105 exp=+0.007 sumR=+0.8 | H2 T=118 exp=+0.110 sumR=+12.9 | top5=160% | coins+ 6/8 (75%) | 99 tr/yr over 2.26y
  H1      T= 105 WR= 32% PF= 1.01 sumR=   +0.8 exp=+0.007 CI95=[-0.305, +0.318] maxDD= 20.9R
  H2      T= 118 WR= 36% PF= 1.16 sumR=  +12.9 exp=+0.110 CI95=[-0.191, +0.440] maxDD= 12.8R
  2026    T=  71 WR= 41% PF= 1.34 sumR=  +15.3 exp=+0.216 CI95=[-0.157, +0.611] maxDD= 12.5R
  Aug14→  T=   8 WR= 25% PF= 0.21 sumR=   -5.3 exp=-0.664 CI95=[-1.125, +0.080] maxDD=  6.7R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 265 WR= 35% PF= 1.20 sumR=  +37.0 exp=+0.140 CI95=[-0.067, +0.355] maxDD= 21.2R  (3.53y, 75 tr/yr)
  +15bps  FULL T= 223 WR= 34% PF= 0.96 sumR=   -6.1 exp=-0.027 CI95=[-0.227, +0.182] maxDD= 30.3R | EXT exp=+0.049
  blocks: exposure=550 cooldown=260 weeklyTrend=95 ddRolling7d=8 killSwitch:rsi-divergence=4 | guard time halted 1.7% in 2 episodes
  sleeve break-retest     FULL T=  56 PF=1.35 sumR=+12.7 exp=+0.228 | H1 +0.336 H2 +0.152 | coins+ 5/6
  sleeve rsi-divergence   FULL T= 167 PF=1.01 sumR=+1.0 exp=+0.006 | H1 -0.085 H2 +0.093 | coins+ 1/2
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER failed: ✗ exp +0.061 ≥ +0.20; ✗ PF 1.09 ≥ 1.30; ✗ CI95 lo -0.159 > 0; ✗ halves +0.007 / +0.110 each ≥ +0.10; ✗ exp @ +15 bps -0.027 ≥ +0.10
    general ACCEPT-LIVE failed on: exp ≥ +0.25; PF ≥ 1.30; CI lo > 0; halves each ≥ +0.10; top-5 ≤ 30% (160%); slip15 ≥ +0.10
    NOT ELIGIBLE for recommendation: contains a component REJECTED by its component stage (B&R / RSI) — reference only
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 223 | 1.09 | +13.7 | +0.061 | -0.156 | 21.2 | +0.007 | +0.110 | 99 | 1.7 | fail |
| trio | 10 | 15 | 223 | 0.96 | -6.1 | -0.027 | -0.227 | 30.3 | -0.053 | -0.005 | 99 | 1.7 | — |
| OFF | 10 | 0 | 227 | 1.13 | +20.3 | +0.089 | -0.131 | 19.4 | +0.022 | +0.149 | 101 | 0.0 | fail |
| OFF | 10 | 15 | 227 | 1.00 | -0.3 | -0.001 | -0.205 | 26.3 | -0.039 | +0.032 | 101 | 0.0 | — |
| dd8 | 10 | 0 | 225 | 1.12 | +19.1 | +0.085 | -0.126 | 19.4 | +0.032 | +0.132 | 100 | 0.2 | fail |
| dd8 | 10 | 15 | 226 | 1.00 | +0.7 | +0.003 | -0.198 | 25.2 | -0.029 | +0.032 | 100 | 0.1 | — |
| dd12 | 10 | 0 | 227 | 1.13 | +20.3 | +0.089 | -0.131 | 19.4 | +0.022 | +0.149 | 101 | 0.0 | fail |
| dd12 | 10 | 15 | 227 | 1.00 | -0.3 | -0.001 | -0.205 | 26.3 | -0.039 | +0.032 | 101 | 0.0 | — |
| dd16 | 10 | 0 | 227 | 1.13 | +20.3 | +0.089 | -0.131 | 19.4 | +0.022 | +0.149 | 101 | 0.0 | fail |
| dd16 | 10 | 15 | 227 | 1.00 | -0.3 | -0.001 | -0.205 | 26.3 | -0.039 | +0.032 | 101 | 0.0 | — |
| trio | 6 | 0 | 223 | 1.09 | +13.7 | +0.061 | -0.156 | 21.2 | +0.007 | +0.110 | 99 | 1.7 | fail |
| trio | 6 | 15 | 223 | 0.96 | -6.1 | -0.027 | -0.227 | 30.3 | -0.053 | -0.005 | 99 | 1.7 | — |
| OFF | 6 | 0 | 227 | 1.13 | +20.3 | +0.089 | -0.131 | 19.4 | +0.022 | +0.149 | 101 | 0.0 | fail |
| OFF | 6 | 15 | 227 | 1.00 | -0.3 | -0.001 | -0.205 | 26.3 | -0.039 | +0.032 | 101 | 0.0 | — |
| dd8 | 6 | 0 | 225 | 1.12 | +19.1 | +0.085 | -0.126 | 19.4 | +0.032 | +0.132 | 100 | 0.2 | fail |
| dd8 | 6 | 15 | 226 | 1.00 | +0.7 | +0.003 | -0.198 | 25.2 | -0.029 | +0.032 | 100 | 0.1 | — |
| dd12 | 6 | 0 | 227 | 1.13 | +20.3 | +0.089 | -0.131 | 19.4 | +0.022 | +0.149 | 101 | 0.0 | fail |
| dd12 | 6 | 15 | 227 | 1.00 | -0.3 | -0.001 | -0.205 | 26.3 | -0.039 | +0.032 | 101 | 0.0 | — |
| dd16 | 6 | 0 | 227 | 1.13 | +20.3 | +0.089 | -0.131 | 19.4 | +0.022 | +0.149 | 101 | 0.0 | fail |
| dd16 | 6 | 15 | 227 | 1.00 | -0.3 | -0.001 | -0.205 | 26.3 | -0.039 | +0.032 | 101 | 0.0 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +20.3 maxDD 19.4R | trio sumR +13.7 maxDD 21.2R | X=8: sumR +19.1 (94% of OFF) maxDD 19.4R halted 0.2%/2ep · X=12: sumR +20.3 (100% of OFF) maxDD 19.4R halted 0.0%/0ep · X=16: sumR +20.3 (100% of OFF) maxDD 19.4R halted 0.0%/0ep
    → pick: X=16 (maxDD 19.4R vs OFF 19.4R vs trio 21.2R; sumR +20.3 vs OFF +20.3 vs trio +13.7)
  maxOpen 6: OFF sumR +20.3 maxDD 19.4R | trio sumR +13.7 maxDD 21.2R | X=8: sumR +19.1 (94% of OFF) maxDD 19.4R halted 0.2%/2ep · X=12: sumR +20.3 (100% of OFF) maxDD 19.4R halted 0.0%/0ep · X=16: sumR +20.3 (100% of OFF) maxDD 19.4R halted 0.0%/0ep
    → pick: X=16 (maxDD 19.4R vs OFF 19.4R vs trio 21.2R; sumR +20.3 vs OFF +20.3 vs trio +13.7)

# P2 B&R + RSI + LS SHORT-only & BTC daily UP  [REFERENCE: contains rejected B&R/RSI]
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 724 WR= 36% PF= 1.33 sumR= +169.3 exp=+0.234 CI95=[+0.098, +0.369] maxDD= 63.4R  balDD=84.1%
          H1 T=391 exp=+0.087 sumR=+34.1 | H2 T=333 exp=+0.406 sumR=+135.2 | top5=20% | coins+ 29/40 (73%) | 321 tr/yr over 2.26y
  H1      T= 391 WR= 31% PF= 1.12 sumR=  +34.1 exp=+0.087 CI95=[-0.091, +0.267] maxDD= 48.9R
  H2      T= 333 WR= 42% PF= 1.63 sumR= +135.2 exp=+0.406 CI95=[+0.201, +0.611] maxDD= 21.6R
  2026    T= 218 WR= 44% PF= 1.64 sumR=  +88.6 exp=+0.406 CI95=[+0.167, +0.648] maxDD= 21.6R
  Aug14→  T=  15 WR=  0% PF= 0.00 sumR=  -17.2 exp=-1.150 CI95=[-1.184, -1.115] maxDD= 17.2R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 766 WR= 37% PF= 1.36 sumR= +192.6 exp=+0.251 CI95=[+0.123, +0.387] maxDD= 63.4R  (3.53y, 217 tr/yr)
  +15bps  FULL T= 718 WR= 36% PF= 1.20 sumR=  +98.2 exp=+0.137 CI95=[+0.013, +0.260] maxDD= 73.0R | EXT exp=+0.154
  blocks: lsRegime=3002 exposure=916 ddRolling7d=821 cooldown=306 ddDaily=149 killSwitch:liquidity-sweep=119 weeklyTrend=77 maxOpen=55 groupCap=37 killSwitch:rsi-divergence=3 | guard time halted 13.4% in 39 episodes
  sleeve break-retest     FULL T=  44 PF=1.78 sumR=+21.1 exp=+0.479 | H1 +0.585 H2 +0.406 | coins+ 6/6
  sleeve liquidity-sweep  FULL T= 546 PF=1.33 sumR=+127.6 exp=+0.234 | H1 +0.070 H2 +0.450 | coins+ 26/40
  sleeve rsi-divergence   FULL T= 134 PF=1.22 sumR=+20.6 exp=+0.153 | H1 +0.026 H2 +0.263 | coins+ 2/2
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER failed: ✗ halves +0.087 / +0.406 each ≥ +0.10; ✗ maxDD 63.4R ≤ 25R
    general ACCEPT-LIVE failed on: exp ≥ +0.25; halves each ≥ +0.10
    NOT ELIGIBLE for recommendation: contains a component REJECTED by its component stage (B&R / RSI) — reference only
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 724 | 1.33 | +169.3 | +0.234 | +0.098 | 63.4 | +0.087 | +0.406 | 321 | 13.4 | fail |
| trio | 10 | 15 | 718 | 1.20 | +98.2 | +0.137 | +0.013 | 73.0 | +0.027 | +0.264 | 318 | 14.1 | — |
| OFF | 10 | 0 | 1217 | 1.20 | +174.2 | +0.143 | +0.039 | 94.3 | +0.109 | +0.190 | 539 | 0.0 | fail |
| OFF | 10 | 15 | 1216 | 1.07 | +61.9 | +0.051 | -0.043 | 111.9 | +0.034 | +0.074 | 539 | 0.0 | — |
| dd8 | 10 | 0 | 1090 | 1.22 | +172.1 | +0.158 | +0.050 | 64.5 | +0.101 | +0.234 | 483 | 4.8 | fail |
| dd8 | 10 | 15 | 1090 | 1.08 | +66.0 | +0.061 | -0.043 | 81.2 | +0.029 | +0.103 | 483 | 4.7 | — |
| dd12 | 10 | 0 | 1109 | 1.18 | +144.6 | +0.130 | +0.033 | 99.1 | +0.110 | +0.158 | 492 | 3.2 | fail |
| dd12 | 10 | 15 | 1108 | 1.04 | +35.4 | +0.032 | -0.064 | 117.2 | +0.026 | +0.040 | 491 | 3.2 | — |
| dd16 | 10 | 0 | 1145 | 1.21 | +172.0 | +0.150 | +0.043 | 110.9 | +0.124 | +0.187 | 507 | 1.9 | fail |
| dd16 | 10 | 15 | 1150 | 1.08 | +64.7 | +0.056 | -0.042 | 125.9 | +0.043 | +0.075 | 510 | 1.9 | — |
| trio | 6 | 0 | 648 | 1.32 | +148.1 | +0.229 | +0.087 | 61.2 | +0.074 | +0.421 | 287 | 12.9 | fail |
| trio | 6 | 15 | 652 | 1.19 | +87.8 | +0.135 | +0.006 | 66.0 | +0.011 | +0.284 | 289 | 12.8 | — |
| OFF | 6 | 0 | 1040 | 1.14 | +104.5 | +0.100 | -0.009 | 85.0 | +0.031 | +0.198 | 461 | 0.0 | fail |
| OFF | 6 | 15 | 1039 | 1.02 | +15.8 | +0.015 | -0.085 | 96.8 | -0.038 | +0.090 | 461 | 0.0 | — |
| dd8 | 6 | 0 | 945 | 1.14 | +100.3 | +0.106 | -0.008 | 66.5 | +0.013 | +0.232 | 419 | 4.5 | fail |
| dd8 | 6 | 15 | 939 | 1.03 | +18.7 | +0.020 | -0.086 | 88.7 | -0.055 | +0.120 | 416 | 4.5 | — |
| dd12 | 6 | 0 | 949 | 1.14 | +99.4 | +0.105 | -0.012 | 95.1 | +0.028 | +0.212 | 421 | 2.4 | fail |
| dd12 | 6 | 15 | 941 | 1.01 | +8.2 | +0.009 | -0.096 | 107.9 | -0.044 | +0.083 | 417 | 2.9 | — |
| dd16 | 6 | 0 | 987 | 1.11 | +81.3 | +0.082 | -0.029 | 122.4 | +0.024 | +0.164 | 437 | 1.7 | fail |
| dd16 | 6 | 15 | 984 | 1.00 | +2.2 | +0.002 | -0.101 | 121.7 | -0.057 | +0.085 | 436 | 1.8 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +174.2 maxDD 94.3R | trio sumR +169.3 maxDD 63.4R | X=8: sumR +172.1 (99% of OFF) maxDD 64.5R halted 4.8%/45ep · X=12: sumR +144.6 (83% of OFF) maxDD 99.1R halted 3.2%/26ep · X=16: sumR +172.0 (99% of OFF) maxDD 110.9R halted 1.9%/17ep
    → pick: X=8 (maxDD 64.5R vs OFF 94.3R vs trio 63.4R; sumR +172.1 vs OFF +174.2 vs trio +169.3)
  maxOpen 6: OFF sumR +104.5 maxDD 85.0R | trio sumR +148.1 maxDD 61.2R | X=8: sumR +100.3 (96% of OFF) maxDD 66.5R halted 4.5%/43ep · X=12: sumR +99.4 (95% of OFF) maxDD 95.1R halted 2.4%/24ep · X=16: sumR +81.3 (78% of OFF) maxDD 122.4R halted 1.7%/16ep
    → pick: X=8 (maxDD 66.5R vs OFF 85.0R vs trio 61.2R; sumR +100.3 vs OFF +104.5 vs trio +148.1)

# P3 B&R + RSI + TSMOM  [REFERENCE: contains rejected B&R/RSI]
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 229 WR= 41% PF= 1.28 sumR=  +38.8 exp=+0.170 CI95=[-0.026, +0.376] maxDD= 19.0R  balDD=41.5%
          H1 T=88 exp=+0.264 sumR=+23.2 | H2 T=141 exp=+0.111 sumR=+15.6 | top5=49% | coins+ 27/39 (69%) | 101 tr/yr over 2.26y
  H1      T=  88 WR= 43% PF= 1.45 sumR=  +23.2 exp=+0.264 CI95=[-0.055, +0.588] maxDD= 19.0R
  H2      T= 141 WR= 39% PF= 1.18 sumR=  +15.6 exp=+0.111 CI95=[-0.137, +0.373] maxDD= 19.5R
  2026    T=  76 WR= 39% PF= 1.07 sumR=   +3.0 exp=+0.039 CI95=[-0.264, +0.366] maxDD= 13.0R
  Aug14→  T=  13 WR= 23% PF= 0.41 sumR=   -5.7 exp=-0.435 CI95=[-0.888, +0.137] maxDD=  8.3R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 499 WR= 42% PF= 1.33 sumR=  +96.1 exp=+0.192 CI95=[+0.061, +0.327] maxDD= 23.8R  (3.89y, 128 tr/yr)
  +15bps  FULL T= 228 WR= 40% PF= 1.21 sumR=  +28.9 exp=+0.127 CI95=[-0.058, +0.314] maxDD= 19.0R | EXT exp=+0.154
  blocks: maxOpen=1389 exposure=1271 cooldown=187 groupCap=173 ddRolling7d=75 weeklyTrend=43 killSwitch:tsmom=17 killSwitch:break-retest=5 ddDaily=4 | guard time halted 1.5% in 6 episodes
  sleeve break-retest     FULL T=  24 PF=0.74 sumR=-4.5 exp=-0.189 | H1 -0.289 H2 -0.139 | coins+ 2/6
  sleeve rsi-divergence   FULL T=  41 PF=1.18 sumR=+5.3 exp=+0.128 | H1 -0.063 H2 +0.398 | coins+ 2/2
  sleeve tsmom            FULL T= 164 PF=1.42 sumR=+38.1 exp=+0.232 | H1 +0.333 H2 +0.155 | coins+ 27/39
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER failed: ✗ exp +0.170 ≥ +0.20; ✗ PF 1.28 ≥ 1.30; ✗ CI95 lo -0.026 > 0
    general ACCEPT-LIVE failed on: exp ≥ +0.25; PF ≥ 1.30; CI lo > 0; top-5 ≤ 30% (49%)
    NOT ELIGIBLE for recommendation: contains a component REJECTED by its component stage (B&R / RSI) — reference only
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 229 | 1.28 | +38.8 | +0.170 | -0.026 | 19.0 | +0.264 | +0.111 | 101 | 1.5 | fail |
| trio | 10 | 15 | 228 | 1.21 | +28.9 | +0.127 | -0.058 | 19.0 | +0.240 | +0.056 | 101 | 1.5 | — |
| OFF | 10 | 0 | 242 | 1.33 | +47.8 | +0.198 | +0.007 | 19.0 | +0.297 | +0.129 | 107 | 0.0 | fail |
| OFF | 10 | 15 | 241 | 1.26 | +37.6 | +0.156 | -0.035 | 19.0 | +0.274 | +0.074 | 107 | 0.0 | — |
| dd8 | 10 | 0 | 237 | 1.31 | +43.9 | +0.185 | -0.010 | 19.0 | +0.277 | +0.120 | 105 | 0.6 | fail |
| dd8 | 10 | 15 | 236 | 1.24 | +33.8 | +0.143 | -0.041 | 19.0 | +0.254 | +0.065 | 105 | 0.6 | — |
| dd12 | 10 | 0 | 242 | 1.33 | +47.8 | +0.198 | +0.007 | 19.0 | +0.297 | +0.129 | 107 | 0.2 | fail |
| dd12 | 10 | 15 | 241 | 1.26 | +37.6 | +0.156 | -0.035 | 19.0 | +0.274 | +0.074 | 107 | 0.2 | — |
| dd16 | 10 | 0 | 242 | 1.33 | +47.8 | +0.198 | +0.007 | 19.0 | +0.297 | +0.129 | 107 | 0.0 | fail |
| dd16 | 10 | 15 | 241 | 1.26 | +37.6 | +0.156 | -0.035 | 19.0 | +0.274 | +0.074 | 107 | 0.0 | — |
| trio | 6 | 0 | 164 | 1.14 | +15.2 | +0.093 | -0.134 | 14.2 | +0.089 | +0.096 | 86 | 1.3 | fail |
| trio | 6 | 15 | 163 | 1.04 | +4.3 | +0.026 | -0.195 | 13.4 | +0.062 | -0.007 | 85 | 1.3 | — |
| OFF | 6 | 0 | 180 | 1.26 | +28.5 | +0.158 | -0.063 | 13.4 | +0.022 | +0.265 | 94 | 0.0 | fail |
| OFF | 6 | 15 | 180 | 1.13 | +14.8 | +0.082 | -0.129 | 14.2 | -0.004 | +0.150 | 94 | 0.0 | — |
| dd8 | 6 | 0 | 169 | 1.26 | +27.5 | +0.163 | -0.065 | 14.2 | +0.194 | +0.134 | 89 | 0.7 | fail |
| dd8 | 6 | 15 | 167 | 1.15 | +16.3 | +0.098 | -0.121 | 14.7 | +0.165 | +0.035 | 87 | 0.7 | — |
| dd12 | 6 | 0 | 180 | 1.26 | +28.5 | +0.158 | -0.063 | 13.4 | +0.022 | +0.265 | 94 | 0.0 | fail |
| dd12 | 6 | 15 | 180 | 1.13 | +14.8 | +0.082 | -0.129 | 14.2 | -0.004 | +0.150 | 94 | 0.0 | — |
| dd16 | 6 | 0 | 180 | 1.26 | +28.5 | +0.158 | -0.063 | 13.4 | +0.022 | +0.265 | 94 | 0.0 | fail |
| dd16 | 6 | 15 | 180 | 1.13 | +14.8 | +0.082 | -0.129 | 14.2 | -0.004 | +0.150 | 94 | 0.0 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +47.8 maxDD 19.0R | trio sumR +38.8 maxDD 19.0R | X=8: sumR +43.9 (92% of OFF) maxDD 19.0R halted 0.6%/7ep · X=12: sumR +47.8 (100% of OFF) maxDD 19.0R halted 0.2%/2ep · X=16: sumR +47.8 (100% of OFF) maxDD 19.0R halted 0.0%/0ep
    → pick: X=16 (maxDD 19.0R vs OFF 19.0R vs trio 19.0R; sumR +47.8 vs OFF +47.8 vs trio +38.8)
  maxOpen 6: OFF sumR +28.5 maxDD 13.4R | trio sumR +15.2 maxDD 14.2R | X=8: sumR +27.5 (97% of OFF) maxDD 14.2R halted 0.7%/7ep · X=12: sumR +28.5 (100% of OFF) maxDD 13.4R halted 0.0%/0ep · X=16: sumR +28.5 (100% of OFF) maxDD 13.4R halted 0.0%/0ep
    → pick: X=16 (maxDD 13.4R vs OFF 13.4R vs trio 14.2R; sumR +28.5 vs OFF +28.5 vs trio +15.2)

# P4 B&R + RSI + LS SHORT-only & BTC UP + TSMOM  [REFERENCE: contains rejected B&R/RSI]
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 384 WR= 42% PF= 1.42 sumR=  +99.5 exp=+0.259 CI95=[+0.097, +0.425] maxDD= 17.4R  balDD=41.5%
          H1 T=205 exp=+0.251 sumR=+51.4 | H2 T=179 exp=+0.268 sumR=+48.0 | top5=21% | coins+ 29/40 (73%) | 170 tr/yr over 2.26y
  H1      T= 205 WR= 40% PF= 1.39 sumR=  +51.4 exp=+0.251 CI95=[+0.024, +0.483] maxDD= 17.4R
  H2      T= 179 WR= 44% PF= 1.45 sumR=  +48.0 exp=+0.268 CI95=[+0.040, +0.511] maxDD= 15.2R
  2026    T=  95 WR= 44% PF= 1.29 sumR=  +16.4 exp=+0.173 CI95=[-0.121, +0.478] maxDD= 19.7R
  Aug14→  T=  23 WR= 48% PF= 1.01 sumR=   +0.2 exp=+0.008 CI95=[-0.471, +0.549] maxDD= 11.6R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 654 WR= 43% PF= 1.40 sumR= +156.7 exp=+0.240 CI95=[+0.121, +0.365] maxDD= 23.8R  (3.89y, 168 tr/yr)
  +15bps  FULL T= 361 WR= 41% PF= 1.23 sumR=  +52.3 exp=+0.145 CI95=[-0.012, +0.302] maxDD= 26.6R | EXT exp=+0.159
  blocks: lsRegime=3002 maxOpen=2312 exposure=1915 ddRolling7d=358 cooldown=200 groupCap=159 ddDaily=45 weeklyTrend=37 killSwitch:liquidity-sweep=26 killSwitch:tsmom=24 | guard time halted 5.1% in 22 episodes
  sleeve break-retest     FULL T=  19 PF=0.63 sumR=-5.1 exp=-0.270 | H1 -0.694 H2 -0.074 | coins+ 2/6
  sleeve liquidity-sweep  FULL T= 185 PF=1.37 sumR=+46.1 exp=+0.249 | H1 +0.275 H2 +0.202 | coins+ 24/40
  sleeve rsi-divergence   FULL T=  35 PF=1.34 sumR=+8.6 exp=+0.246 | H1 +0.073 H2 +0.452 | coins+ 2/2
  sleeve tsmom            FULL T= 145 PF=1.66 sumR=+49.9 exp=+0.344 | H1 +0.285 H2 +0.396 | coins+ 29/40
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER rule met: exp +0.259 ≥ +0.20; PF 1.42 ≥ 1.30; CI95 lo +0.097 > 0; halves +0.251 / +0.268 each ≥ +0.10; 170 tr/yr ≥ 80; maxDD 17.4R ≤ 25R; exp @ +15 bps +0.145 ≥ +0.10
    general ACCEPT-LIVE rule met
    NOT ELIGIBLE for recommendation: contains a component REJECTED by its component stage (B&R / RSI) — reference only
    literal verdict would be ACCEPT-LIVE-CANDIDATE; recorded as REJECT because of the rejected component
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 384 | 1.42 | +99.5 | +0.259 | +0.100 | 17.4 | +0.251 | +0.268 | 170 | 5.1 | PASS |
| trio | 10 | 15 | 361 | 1.23 | +52.3 | +0.145 | -0.012 | 26.6 | +0.116 | +0.175 | 160 | 5.2 | — |
| OFF | 10 | 0 | 484 | 1.32 | +99.4 | +0.205 | +0.058 | 22.7 | +0.269 | +0.136 | 215 | 0.0 | PASS |
| OFF | 10 | 15 | 482 | 1.23 | +72.1 | +0.150 | +0.013 | 22.7 | +0.212 | +0.081 | 214 | 0.0 | — |
| dd8 | 10 | 0 | 484 | 1.30 | +94.5 | +0.195 | +0.047 | 32.2 | +0.228 | +0.161 | 215 | 1.1 | fail |
| dd8 | 10 | 15 | 492 | 1.22 | +67.8 | +0.138 | -0.001 | 34.1 | +0.169 | +0.106 | 218 | 1.1 | — |
| dd12 | 10 | 0 | 478 | 1.35 | +108.0 | +0.226 | +0.082 | 18.4 | +0.284 | +0.161 | 212 | 0.6 | PASS |
| dd12 | 10 | 15 | 476 | 1.27 | +80.1 | +0.168 | +0.029 | 20.4 | +0.226 | +0.103 | 211 | 0.6 | — |
| dd16 | 10 | 0 | 473 | 1.28 | +86.2 | +0.182 | +0.039 | 27.5 | +0.238 | +0.122 | 210 | 0.3 | fail |
| dd16 | 10 | 15 | 471 | 1.20 | +60.4 | +0.128 | -0.011 | 28.3 | +0.184 | +0.068 | 209 | 0.3 | — |
| trio | 6 | 0 | 245 | 1.44 | +67.6 | +0.276 | +0.067 | 16.5 | +0.102 | +0.503 | 128 | 3.7 | PASS |
| trio | 6 | 15 | 246 | 1.33 | +51.0 | +0.207 | +0.016 | 17.9 | +0.067 | +0.380 | 129 | 3.5 | — |
| OFF | 6 | 0 | 272 | 1.39 | +67.9 | +0.250 | +0.051 | 16.6 | +0.142 | +0.397 | 142 | 0.0 | PASS |
| OFF | 6 | 15 | 269 | 1.30 | +50.9 | +0.189 | +0.006 | 17.4 | +0.097 | +0.312 | 141 | 0.0 | — |
| dd8 | 6 | 0 | 260 | 1.43 | +70.3 | +0.271 | +0.068 | 21.2 | +0.093 | +0.505 | 136 | 0.6 | fail |
| dd8 | 6 | 15 | 258 | 1.30 | +48.9 | +0.189 | -0.003 | 28.7 | +0.018 | +0.412 | 135 | 0.7 | — |
| dd12 | 6 | 0 | 264 | 1.32 | +53.7 | +0.203 | +0.009 | 20.4 | +0.098 | +0.340 | 138 | 0.3 | fail |
| dd12 | 6 | 15 | 261 | 1.23 | +37.7 | +0.144 | -0.042 | 23.3 | +0.056 | +0.257 | 137 | 0.3 | — |
| dd16 | 6 | 0 | 272 | 1.39 | +67.9 | +0.250 | +0.051 | 16.6 | +0.142 | +0.397 | 142 | 0.0 | PASS |
| dd16 | 6 | 15 | 264 | 1.24 | +40.8 | +0.154 | -0.034 | 26.6 | +0.033 | +0.312 | 138 | 0.1 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +99.4 maxDD 22.7R | trio sumR +99.5 maxDD 17.4R | X=8: sumR +94.5 (95% of OFF) maxDD 32.2R halted 1.1%/13ep · X=12: sumR +108.0 (109% of OFF) maxDD 18.4R halted 0.6%/7ep · X=16: sumR +86.2 (87% of OFF) maxDD 27.5R halted 0.3%/3ep
    → pick: X=12 (maxDD 18.4R vs OFF 22.7R vs trio 17.4R; sumR +108.0 vs OFF +99.4 vs trio +99.5)
  maxOpen 6: OFF sumR +67.9 maxDD 16.6R | trio sumR +67.6 maxDD 16.5R | X=8: sumR +70.3 (104% of OFF) maxDD 21.2R halted 0.6%/7ep · X=12: sumR +53.7 (79% of OFF) maxDD 20.4R halted 0.3%/3ep · X=16: sumR +67.9 (100% of OFF) maxDD 16.6R halted 0.0%/0ep
    → pick: X=16 (maxDD 16.6R vs OFF 16.6R vs trio 16.5R; sumR +67.9 vs OFF +67.9 vs trio +67.6)

# E2 LS SHORT-only & BTC daily UP (alone)  [eligible]
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 559 WR= 36% PF= 1.37 sumR= +143.9 exp=+0.257 CI95=[+0.105, +0.419] maxDD= 59.8R  balDD=82.4%
          H1 T=323 exp=+0.108 sumR=+34.8 | H2 T=236 exp=+0.462 sumR=+109.1 | top5=22% | coins+ 29/40 (73%) | 248 tr/yr over 2.26y
  H1      T= 323 WR= 31% PF= 1.14 sumR=  +34.8 exp=+0.108 CI95=[-0.089, +0.310] maxDD= 45.0R
  H2      T= 236 WR= 44% PF= 1.73 sumR= +109.1 exp=+0.462 CI95=[+0.221, +0.706] maxDD= 21.9R
  2026    T= 163 WR= 45% PF= 1.70 sumR=  +71.3 exp=+0.437 CI95=[+0.166, +0.715] maxDD= 21.9R
  Aug14→  T=  13 WR=  0% PF= 0.00 sumR=  -14.5 exp=-1.114 CI95=[-1.135, -1.093] maxDD= 14.5R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 559 WR= 36% PF= 1.37 sumR= +143.9 exp=+0.257 CI95=[+0.105, +0.420] maxDD= 59.8R  (2.26y, 248 tr/yr)
  +15bps  FULL T= 556 WR= 37% PF= 1.23 sumR=  +89.6 exp=+0.161 CI95=[+0.018, +0.302] maxDD= 66.0R | EXT exp=+0.161
  blocks: lsRegime=3002 ddRolling7d=681 exposure=412 ddDaily=138 killSwitch:liquidity-sweep=135 cooldown=82 maxOpen=33 groupCap=27 | guard time halted 31.5% in 42 episodes
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER failed: ✗ maxDD 59.8R ≤ 25R
    general ACCEPT-LIVE rule met
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 559 | 1.37 | +143.9 | +0.257 | +0.105 | 59.8 | +0.108 | +0.462 | 248 | 31.5 | fail |
| trio | 10 | 15 | 556 | 1.23 | +89.6 | +0.161 | +0.018 | 66.0 | +0.058 | +0.302 | 246 | 31.3 | — |
| OFF | 10 | 0 | 1029 | 1.17 | +131.0 | +0.127 | +0.015 | 87.1 | +0.105 | +0.160 | 456 | 0.0 | fail |
| OFF | 10 | 15 | 1028 | 1.05 | +39.1 | +0.038 | -0.061 | 109.5 | +0.029 | +0.052 | 456 | 0.0 | — |
| dd8 | 10 | 0 | 889 | 1.17 | +111.7 | +0.126 | +0.007 | 67.9 | +0.077 | +0.196 | 394 | 17.5 | fail |
| dd8 | 10 | 15 | 894 | 1.05 | +31.4 | +0.035 | -0.069 | 84.4 | +0.008 | +0.075 | 396 | 17.6 | — |
| dd12 | 10 | 0 | 928 | 1.20 | +135.6 | +0.146 | +0.030 | 95.7 | +0.143 | +0.152 | 411 | 6.4 | fail |
| dd12 | 10 | 15 | 927 | 1.07 | +49.9 | +0.054 | -0.050 | 109.1 | +0.064 | +0.037 | 411 | 6.4 | — |
| dd16 | 10 | 0 | 965 | 1.21 | +148.3 | +0.154 | +0.037 | 98.8 | +0.129 | +0.191 | 428 | 2.8 | fail |
| dd16 | 10 | 15 | 962 | 1.08 | +53.7 | +0.056 | -0.050 | 114.8 | +0.017 | +0.115 | 426 | 2.7 | — |
| trio | 6 | 0 | 520 | 1.31 | +116.4 | +0.224 | +0.059 | 59.0 | +0.106 | +0.391 | 231 | 28.7 | fail |
| trio | 6 | 15 | 514 | 1.18 | +66.8 | +0.130 | -0.020 | 65.2 | -0.001 | +0.313 | 228 | 29.9 | — |
| OFF | 6 | 0 | 883 | 1.15 | +95.8 | +0.108 | -0.009 | 85.2 | +0.042 | +0.212 | 391 | 0.0 | fail |
| OFF | 6 | 15 | 883 | 1.03 | +19.3 | +0.022 | -0.085 | 98.7 | -0.032 | +0.104 | 391 | 0.0 | — |
| dd8 | 6 | 0 | 784 | 1.19 | +107.0 | +0.136 | +0.013 | 65.1 | +0.039 | +0.286 | 348 | 16.0 | fail |
| dd8 | 6 | 15 | 780 | 1.06 | +35.3 | +0.045 | -0.071 | 78.7 | -0.061 | +0.208 | 346 | 16.3 | — |
| dd12 | 6 | 0 | 801 | 1.09 | +57.5 | +0.072 | -0.052 | 88.1 | +0.065 | +0.083 | 355 | 6.9 | fail |
| dd12 | 6 | 15 | 804 | 0.99 | -3.6 | -0.004 | -0.119 | 100.5 | -0.012 | +0.007 | 356 | 6.9 | — |
| dd16 | 6 | 0 | 843 | 1.14 | +86.7 | +0.103 | -0.020 | 101.8 | +0.056 | +0.176 | 374 | 2.2 | fail |
| dd16 | 6 | 15 | 834 | 1.05 | +28.0 | +0.034 | -0.077 | 111.9 | -0.015 | +0.110 | 370 | 2.5 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +131.0 maxDD 87.1R | trio sumR +143.9 maxDD 59.8R | X=8: sumR +111.7 (85% of OFF) maxDD 67.9R halted 17.5%/41ep · X=12: sumR +135.6 (104% of OFF) maxDD 95.7R halted 6.4%/25ep · X=16: sumR +148.3 (113% of OFF) maxDD 98.8R halted 2.8%/15ep
    → pick: X=12 (maxDD 95.7R vs OFF 87.1R vs trio 59.8R; sumR +135.6 vs OFF +131.0 vs trio +143.9)
  maxOpen 6: OFF sumR +95.8 maxDD 85.2R | trio sumR +116.4 maxDD 59.0R | X=8: sumR +107.0 (112% of OFF) maxDD 65.1R halted 16.0%/34ep · X=12: sumR +57.5 (60% of OFF) maxDD 88.1R halted 6.9%/24ep · X=16: sumR +86.7 (91% of OFF) maxDD 101.8R halted 2.2%/14ep
    → pick: X=8 (maxDD 65.1R vs OFF 85.2R vs trio 59.0R; sumR +107.0 vs OFF +95.8 vs trio +116.4)

# E3 TSMOM daily (alone)  [eligible]
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 160 WR= 45% PF= 1.42 sumR=  +37.2 exp=+0.233 CI95=[+0.010, +0.454] maxDD= 16.2R  balDD=50.6%
          H1 T=72 exp=+0.352 sumR=+25.4 | H2 T=88 exp=+0.135 sumR=+11.9 | top5=35% | coins+ 26/39 (67%) | 71 tr/yr over 2.24y
  H1      T=  70 WR= 47% PF= 1.64 sumR=  +24.0 exp=+0.343 CI95=[+0.005, +0.701] maxDD= 16.2R
  H2      T=  90 WR= 43% PF= 1.26 sumR=  +13.3 exp=+0.147 CI95=[-0.133, +0.435] maxDD=  9.4R
  2026    T=  46 WR= 37% PF= 0.74 sumR=   -7.3 exp=-0.158 CI95=[-0.467, +0.179] maxDD= 13.6R
  Aug14→  T=   7 WR= 29% PF= 0.31 sumR=   -2.4 exp=-0.346 CI95=[-0.796, +0.244] maxDD=  3.5R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 403 WR= 44% PF= 1.32 sumR=  +73.8 exp=+0.183 CI95=[+0.049, +0.319] maxDD= 30.0R  (3.89y, 104 tr/yr)
  +15bps  FULL T= 159 WR= 45% PF= 1.37 sumR=  +32.4 exp=+0.204 CI95=[-0.008, +0.428] maxDD= 16.2R | EXT exp=+0.158
  blocks: maxOpen=1035 exposure=734 cooldown=114 groupCap=82 ddRolling7d=62 killSwitch:tsmom=45 ddDaily=6 | guard time halted 1.2% in 5 episodes
  VERDICT (record cell, FULL): REJECT
    PORTFOLIO-PAPER failed: ✗ 71 tr/yr ≥ 80
    general ACCEPT-LIVE failed on: exp ≥ +0.25; top-5 ≤ 30% (35%)
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 160 | 1.42 | +37.2 | +0.233 | +0.008 | 16.2 | +0.352 | +0.135 | 71 | 1.2 | fail |
| trio | 10 | 15 | 159 | 1.37 | +32.4 | +0.204 | -0.008 | 16.2 | +0.335 | +0.095 | 71 | 1.2 | — |
| OFF | 10 | 0 | 181 | 1.47 | +47.0 | +0.259 | +0.057 | 16.2 | +0.372 | +0.166 | 81 | 0.0 | PASS |
| OFF | 10 | 15 | 180 | 1.42 | +41.6 | +0.231 | +0.027 | 16.2 | +0.355 | +0.128 | 80 | 0.0 | — |
| dd8 | 10 | 0 | 181 | 1.53 | +51.6 | +0.285 | +0.079 | 14.2 | +0.428 | +0.166 | 81 | 0.4 | PASS |
| dd8 | 10 | 15 | 180 | 1.47 | +46.2 | +0.257 | +0.051 | 14.2 | +0.410 | +0.128 | 80 | 0.4 | — |
| dd12 | 10 | 0 | 181 | 1.47 | +47.0 | +0.259 | +0.057 | 16.2 | +0.372 | +0.166 | 81 | 0.1 | PASS |
| dd12 | 10 | 15 | 180 | 1.42 | +41.6 | +0.231 | +0.027 | 16.2 | +0.355 | +0.128 | 80 | 0.1 | — |
| dd16 | 10 | 0 | 181 | 1.47 | +47.0 | +0.259 | +0.057 | 16.2 | +0.372 | +0.166 | 81 | 0.1 | PASS |
| dd16 | 10 | 15 | 180 | 1.42 | +41.6 | +0.231 | +0.027 | 16.2 | +0.355 | +0.128 | 80 | 0.1 | — |
| trio | 6 | 0 | 119 | 1.21 | +14.5 | +0.122 | -0.130 | 13.0 | +0.123 | +0.122 | 62 | 1.2 | fail |
| trio | 6 | 15 | 116 | 1.16 | +11.1 | +0.096 | -0.155 | 12.0 | +0.108 | +0.082 | 61 | 1.2 | — |
| OFF | 6 | 0 | 125 | 1.23 | +16.9 | +0.135 | -0.109 | 11.9 | +0.049 | +0.223 | 65 | 0.0 | fail |
| OFF | 6 | 15 | 124 | 1.16 | +11.8 | +0.095 | -0.149 | 11.9 | +0.035 | +0.158 | 65 | 0.0 | — |
| dd8 | 6 | 0 | 126 | 1.16 | +11.9 | +0.095 | -0.151 | 13.4 | +0.049 | +0.140 | 66 | 0.4 | fail |
| dd8 | 6 | 15 | 125 | 1.12 | +9.4 | +0.075 | -0.160 | 12.7 | +0.035 | +0.117 | 65 | 0.4 | — |
| dd12 | 6 | 0 | 125 | 1.23 | +16.9 | +0.135 | -0.109 | 11.9 | +0.049 | +0.223 | 65 | 0.0 | fail |
| dd12 | 6 | 15 | 124 | 1.16 | +11.8 | +0.095 | -0.149 | 11.9 | +0.035 | +0.158 | 65 | 0.0 | — |
| dd16 | 6 | 0 | 125 | 1.23 | +16.9 | +0.135 | -0.109 | 11.9 | +0.049 | +0.223 | 65 | 0.0 | fail |
| dd16 | 6 | 15 | 124 | 1.16 | +11.8 | +0.095 | -0.149 | 11.9 | +0.035 | +0.158 | 65 | 0.0 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +47.0 maxDD 16.2R | trio sumR +37.2 maxDD 16.2R | X=8: sumR +51.6 (110% of OFF) maxDD 14.2R halted 0.4%/4ep · X=12: sumR +47.0 (100% of OFF) maxDD 16.2R halted 0.1%/2ep · X=16: sumR +47.0 (100% of OFF) maxDD 16.2R halted 0.1%/1ep
    → pick: X=8 (maxDD 14.2R vs OFF 16.2R vs trio 16.2R; sumR +51.6 vs OFF +47.0 vs trio +37.2)
  maxOpen 6: OFF sumR +16.9 maxDD 11.9R | trio sumR +14.5 maxDD 13.0R | X=8: sumR +11.9 (71% of OFF) maxDD 13.4R halted 0.4%/4ep · X=12: sumR +16.9 (100% of OFF) maxDD 11.9R halted 0.0%/0ep · X=16: sumR +16.9 (100% of OFF) maxDD 11.9R halted 0.0%/0ep
    → pick: X=16 (maxDD 11.9R vs OFF 11.9R vs trio 13.0R; sumR +16.9 vs OFF +16.9 vs trio +14.5)

# E4 LS SHORT-only & BTC daily UP + TSMOM  [eligible]
## RECORD cell — trio guards · maxOpen 10 · 0 bps
  FULL    T= 351 WR= 43% PF= 1.46 sumR=  +98.8 exp=+0.282 CI95=[+0.113, +0.452] maxDD= 24.0R  balDD=50.6%
          H1 T=194 exp=+0.234 sumR=+45.4 | H2 T=157 exp=+0.340 sumR=+53.4 | top5=19% | coins+ 29/40 (73%) | 156 tr/yr over 2.26y
  H1      T= 194 WR= 40% PF= 1.36 sumR=  +45.4 exp=+0.234 CI95=[-0.008, +0.466] maxDD= 24.0R
  H2      T= 157 WR= 46% PF= 1.60 sumR=  +53.4 exp=+0.340 CI95=[+0.097, +0.584] maxDD= 11.6R
  2026    T=  84 WR= 45% PF= 1.38 sumR=  +18.6 exp=+0.221 CI95=[-0.092, +0.562] maxDD= 11.6R
  Aug14→  T=  20 WR= 45% PF= 1.09 sumR=   +1.0 exp=+0.052 CI95=[-0.496, +0.646] maxDD= 11.6R   (parity with realized only: paper −0.29R/30, live −0.45R/43)
  EXT     T= 594 WR= 43% PF= 1.38 sumR= +135.4 exp=+0.228 CI95=[+0.105, +0.354] maxDD= 30.0R  (3.89y, 153 tr/yr)
  +15bps  FULL T= 350 WR= 43% PF= 1.39 sumR=  +82.9 exp=+0.237 CI95=[+0.081, +0.402] maxDD= 25.0R | EXT exp=+0.193
  blocks: lsRegime=3002 maxOpen=2006 exposure=1273 ddRolling7d=338 cooldown=142 groupCap=133 ddDaily=33 killSwitch:tsmom=20 killSwitch:liquidity-sweep=9 | guard time halted 5.1% in 18 episodes
  sleeve liquidity-sweep  FULL T= 197 PF=1.39 sumR=+51.1 exp=+0.259 | H1 +0.191 H2 +0.372 | coins+ 24/40
  sleeve tsmom            FULL T= 154 PF=1.58 sumR=+47.7 exp=+0.310 | H1 +0.300 H2 +0.318 | coins+ 28/40
  VERDICT (record cell, FULL): ACCEPT-LIVE-CANDIDATE
    PORTFOLIO-PAPER rule met: exp +0.282 ≥ +0.20; PF 1.46 ≥ 1.30; CI95 lo +0.113 > 0; halves +0.234 / +0.340 each ≥ +0.10; 156 tr/yr ≥ 80; maxDD 24.0R ≤ 25R; exp @ +15 bps +0.237 ≥ +0.10
    general ACCEPT-LIVE rule met
## GRID — FULL window (T · PF · sumR · exp · CI lo · maxDD(R) · halves · tr/yr · time halted%) — PORTFOLIO-PAPER check per cell
| guard | maxOpen | slip | T | PF | sumR | exp | CI lo | maxDD R | H1 | H2 | tr/yr | halted % | paper rule |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| trio | 10 | 0 | 351 | 1.46 | +98.8 | +0.282 | +0.113 | 24.0 | +0.234 | +0.340 | 156 | 5.1 | PASS |
| trio | 10 | 15 | 350 | 1.39 | +82.9 | +0.237 | +0.081 | 25.0 | +0.182 | +0.303 | 155 | 4.7 | — |
| OFF | 10 | 0 | 439 | 1.47 | +127.3 | +0.290 | +0.133 | 20.5 | +0.324 | +0.247 | 195 | 0.0 | PASS |
| OFF | 10 | 15 | 437 | 1.38 | +100.3 | +0.230 | +0.083 | 19.1 | +0.258 | +0.192 | 194 | 0.0 | — |
| dd8 | 10 | 0 | 420 | 1.38 | +100.1 | +0.238 | +0.085 | 22.9 | +0.263 | +0.212 | 186 | 1.3 | PASS |
| dd8 | 10 | 15 | 426 | 1.27 | +72.1 | +0.169 | +0.029 | 25.0 | +0.201 | +0.135 | 189 | 1.2 | — |
| dd12 | 10 | 0 | 430 | 1.48 | +126.2 | +0.293 | +0.142 | 16.9 | +0.329 | +0.246 | 191 | 0.3 | PASS |
| dd12 | 10 | 15 | 434 | 1.36 | +96.1 | +0.221 | +0.077 | 21.5 | +0.264 | +0.166 | 192 | 0.3 | — |
| dd16 | 10 | 0 | 437 | 1.45 | +121.6 | +0.278 | +0.125 | 22.9 | +0.324 | +0.220 | 194 | 0.2 | PASS |
| dd16 | 10 | 15 | 432 | 1.33 | +87.0 | +0.201 | +0.055 | 20.6 | +0.211 | +0.190 | 191 | 0.4 | — |
| trio | 6 | 0 | 228 | 1.58 | +80.3 | +0.352 | +0.133 | 16.4 | +0.144 | +0.709 | 119 | 3.1 | PASS |
| trio | 6 | 15 | 202 | 1.37 | +45.0 | +0.223 | +0.013 | 14.2 | +0.119 | +0.381 | 106 | 2.2 | — |
| OFF | 6 | 0 | 216 | 1.47 | +62.4 | +0.289 | +0.069 | 16.0 | +0.134 | +0.568 | 113 | 0.0 | PASS |
| OFF | 6 | 15 | 213 | 1.39 | +50.8 | +0.238 | +0.024 | 17.2 | +0.095 | +0.491 | 112 | 0.0 | — |
| dd8 | 6 | 0 | 206 | 1.34 | +43.8 | +0.213 | -0.005 | 31.7 | +0.006 | +0.574 | 108 | 0.7 | fail |
| dd8 | 6 | 15 | 204 | 1.31 | +38.7 | +0.190 | -0.014 | 28.3 | +0.010 | +0.499 | 107 | 0.7 | — |
| dd12 | 6 | 0 | 210 | 1.40 | +52.5 | +0.250 | +0.023 | 23.8 | +0.066 | +0.568 | 110 | 0.2 | fail |
| dd12 | 6 | 15 | 205 | 1.35 | +43.9 | +0.214 | +0.003 | 23.6 | +0.048 | +0.491 | 107 | 0.2 | — |
| dd16 | 6 | 0 | 216 | 1.47 | +62.4 | +0.289 | +0.069 | 16.0 | +0.134 | +0.568 | 113 | 0.0 | PASS |
| dd16 | 6 | 15 | 208 | 1.32 | +40.6 | +0.195 | -0.018 | 26.9 | +0.021 | +0.491 | 109 | 0.2 | — |
## GUARD GRID RULE — lowest maxDD X with sumR ≥ 90% of guards-OFF sumR (FULL, 0 bps)
  maxOpen 10: OFF sumR +127.3 maxDD 20.5R | trio sumR +98.8 maxDD 24.0R | X=8: sumR +100.1 (79% of OFF) maxDD 22.9R halted 1.3%/13ep · X=12: sumR +126.2 (99% of OFF) maxDD 16.9R halted 0.3%/4ep · X=16: sumR +121.6 (96% of OFF) maxDD 22.9R halted 0.2%/2ep
    → pick: X=12 (maxDD 16.9R vs OFF 20.5R vs trio 24.0R; sumR +126.2 vs OFF +127.3 vs trio +98.8)
  maxOpen 6: OFF sumR +62.4 maxDD 16.0R | trio sumR +80.3 maxDD 16.4R | X=8: sumR +43.8 (70% of OFF) maxDD 31.7R halted 0.7%/7ep · X=12: sumR +52.5 (84% of OFF) maxDD 23.8R halted 0.2%/1ep · X=16: sumR +62.4 (100% of OFF) maxDD 16.0R halted 0.0%/0ep
    → pick: X=16 (maxDD 16.0R vs OFF 16.0R vs trio 16.4R; sumR +62.4 vs OFF +62.4 vs trio +80.3)

# POST-HOC diagnostics (labelled — not used for any verdict)
## (1) Same-timestamp order sensitivity — 10 random orders vs default A→Z (record cell: trio, maxOpen 10, 0 bps), FULL window
  E2: default exp +0.257 sumR +143.9 maxDD 59.8R | seeds exp min/med/max +0.222/+0.253/+0.270 · sumR +120.7…+152.5 · maxDD 59.8…59.8R · CI lo>0 in 10/10 · paper rule (ex-slip) in 0/10
  E3: default exp +0.233 sumR +37.2 maxDD 16.2R | seeds exp min/med/max +0.032/+0.127/+0.234 · sumR +6.2…+37.9 · maxDD 14.8…19.9R · CI lo>0 in 1/10 · paper rule (ex-slip) in 0/10
  E4: default exp +0.282 sumR +98.8 maxDD 24.0R | seeds exp min/med/max +0.142/+0.238/+0.368 · sumR +53.5…+133.3 · maxDD 14.9…37.4R · CI lo>0 in 9/10 · paper rule (ex-slip) in 6/10
  P4: default exp +0.259 sumR +99.5 maxDD 17.4R | seeds exp min/med/max +0.207/+0.233/+0.295 · sumR +79.4…+124.6 · maxDD 20.6…34.7R · CI lo>0 in 10/10 · paper rule (ex-slip) in 4/10
  P3: default exp +0.170 sumR +38.8 maxDD 19.0R | seeds exp min/med/max +0.090/+0.143/+0.222 · sumR +23.8…+56.1 · maxDD 18.2…23.5R · CI lo>0 in 3/10 · paper rule (ex-slip) in 2/10

## (2) Funding drag −0.03%/day of hold on every position (conservative; matters for TSMOM's multi-week holds) — record cell, FULL
  E3 +funding slip 0: T= 159 WR= 45% PF= 1.30 sumR=  +27.2 exp=+0.171 CI95=[-0.044, +0.399] maxDD= 16.6R | halves +0.287 / +0.075
  E3 +funding slip15: T= 164 WR= 44% PF= 1.20 sumR=  +18.9 exp=+0.115 CI95=[-0.092, +0.324] maxDD= 16.6R | halves +0.271 / -0.006
  E4 +funding slip 0: T= 353 WR= 43% PF= 1.40 sumR=  +87.7 exp=+0.249 CI95=[+0.088, +0.418] maxDD= 24.6R | halves +0.201 / +0.307
  E4 +funding slip15: T= 349 WR= 43% PF= 1.30 sumR=  +64.3 exp=+0.184 CI95=[+0.029, +0.351] maxDD= 25.6R | halves +0.150 / +0.227
  P3 +funding slip 0: T= 226 WR= 41% PF= 1.18 sumR=  +25.9 exp=+0.115 CI95=[-0.083, +0.321] maxDD= 19.7R | halves +0.212 / +0.055
  P3 +funding slip15: T= 224 WR= 41% PF= 1.14 sumR=  +19.7 exp=+0.088 CI95=[-0.099, +0.277] maxDD= 19.7R | halves +0.191 / +0.025
  P4 +funding slip 0: T= 363 WR= 41% PF= 1.28 sumR=  +64.8 exp=+0.179 CI95=[+0.015, +0.343] maxDD= 26.1R | halves +0.138 / +0.221
  P4 +funding slip15: T= 365 WR= 42% PF= 1.19 sumR=  +44.9 exp=+0.123 CI95=[-0.035, +0.285] maxDD= 27.2R | halves +0.082 / +0.165
  E2 +funding slip 0: T= 559 WR= 36% PF= 1.34 sumR= +133.8 exp=+0.239 CI95=[+0.087, +0.400] maxDD= 61.7R | halves +0.094 / +0.438
  E2 +funding slip15: T= 553 WR= 36% PF= 1.20 sumR=  +77.2 exp=+0.140 CI95=[+0.004, +0.283] maxDD= 67.8R | halves +0.045 / +0.270

## (3) Direction × BTC daily (record cells, FULL)
  E2: SHORT·up T=559 exp +0.257
  E3: LONG·up T=80 exp +0.080 · LONG·neutral T=2 exp +1.042 · LONG·down T=10 exp -0.754 · SHORT·up T=20 exp +0.215 · SHORT·neutral T=6 exp +0.915 · SHORT·down T=42 exp +0.632
  E4: LONG·up T=76 exp +0.212 · LONG·neutral T=1 exp -1.020 · LONG·down T=11 exp -0.464 · SHORT·up T=212 exp +0.257 · SHORT·neutral T=6 exp +0.973 · SHORT·down T=45 exp +0.632
## (4) Monthly sumR (record cells, FULL)
  E2 (12/22 months negative): 2024-05:-6.8/6 2024-06:+12.3/15 2024-07:-1.7/22 2024-08:+19.7/8 2024-09:-4.8/8 2024-10:+20.2/49 2024-11:-11.5/48 2024-12:+30.6/31 2025-01:+16.5/44 2025-04:-7.5/7 2025-05:-7.3/35 2025-06:-12.9/39 2025-07:-16.5/21 2025-08:-0.6/19 2025-09:-5.5/12 2025-10:+48.3/32 2026-01:+17.8/31 2026-03:+8.1/4 2026-04:-12.3/36 2026-05:+45.3/45 2026-07:+12.8/18 2026-08:-0.4/29
  E3 (13/24 months negative): 2024-06:+3.0/4 2024-07:-1.0/1 2024-08:-1.0/1 2024-09:-1.0/1 2024-10:-4.7/8 2024-11:+19.5/27 2024-12:-3.9/6 2025-01:+12.9/13 2025-05:+1.4/2 2025-06:-3.0/3 2025-07:+2.2/7 2025-08:-5.6/12 2025-09:+14.8/14 2025-10:+5.9/8 2025-11:+3.7/5 2025-12:+1.2/2 2026-01:+5.2/3 2026-02:-1.0/1 2026-03:-2.0/2 2026-04:-1.0/1 2026-05:-1.5/20 2026-06:-4.5/10 2026-07:+0.1/2 2026-08:-2.4/7
  E4 (12/28 months negative): 2024-05:-4.5/4 2024-06:+5.9/10 2024-07:+2.0/8 2024-08:+0.8/3 2024-09:-1.0/1 2024-10:+6.1/15 2024-11:+22.0/39 2024-12:-16.1/24 2025-01:+28.1/37 2025-02:+0.7/3 2025-03:-1.0/1 2025-04:-2.1/2 2025-05:+4.1/12 2025-06:+2.7/24 2025-07:-5.0/18 2025-08:-6.8/23 2025-09:+21.6/20 2025-10:+12.6/15 2025-11:+6.2/6 2025-12:+4.3/2 2026-01:+9.5/4 2026-03:-1.0/1 2026-04:-6.1/8 2026-05:+18.0/36 2026-06:-2.0/10 2026-07:-0.8/5 2026-08:-3.7/15 2026-09:+4.8/5
