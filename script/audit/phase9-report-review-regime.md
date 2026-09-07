# Phase 9 — ADVERSARIAL REVIEW of "regime" A2 (LS SHORT-only AND BTC daily UP) — 2026-09-02
Pipeline re-read (phase9-regime.ts): decision at signal-candle close, entry = that close, exits from bar i+1, BTC daily tag from CLOSED daily candles only (candle.time+86400 ≤ decision time), guards on closed trades only. No code-level look-ahead found. This script tests the VERDICT for selection leakage (hypothesis formed on the last 8000 candles = phase8 "direction × BTC daily" table), multiple comparison (best of 6 cells) and placebo (lagged tag).

data: first decision 2024-05-31 → 2026-09-02; halves split 2025-07-17; 8000-candle (hypothesis-generating) slice starts 2025-10-04 → POST-8000 is 40% of the window and 81% of H2.
LS candidates (floor 68, post minSL+RR): 7908 · SHORT 5069

# R1 — A2 reproduction and in-sample / out-of-sample attribution
  FULL       T= 559 WR= 36% PF= 1.37 sumR= +143.9 exp=+0.257 CI95=[+0.104, +0.414] maxDD=58.8R | halves +0.108 (T=323) / +0.462 (T=236) | top5=22% coins+=29/40 T/yr=248
  H1         T= 323 WR= 31% PF= 1.14 sumR=  +34.8 exp=+0.108 CI95=[-0.086, +0.309] maxDD=46.2R | halves +0.326 (T=185) / -0.185 (T=138) | top5=71% coins+=19/40 T/yr=286
  H2         T= 236 WR= 44% PF= 1.73 sumR= +109.1 exp=+0.462 CI95=[+0.217, +0.711] maxDD=22.2R | halves +0.535 (T=104) / +0.405 (T=132) | top5=25% coins+=30/40 T/yr=209
  PRE-8000   T= 376 WR= 31% PF= 1.12 sumR=  +33.2 exp=+0.088 CI95=[-0.091, +0.271] maxDD=58.8R | halves +0.323 (T=231) / -0.286 (T=145) | top5=75% coins+=22/40 T/yr=280
  POST-8000  T= 183 WR= 48% PF= 2.02 sumR= +110.7 exp=+0.605 CI95=[+0.325, +0.900] maxDD=22.2R | halves +1.189 (T=55) / +0.354 (T=128) | top5=25% coins+=30/40 T/yr=201
  attribution: FULL sumR +143.9 = PRE-8000 +33.2 (T=376, exp +0.088) + POST-8000 +110.7 (T=183, exp +0.605) → 77% of the FULL sumR comes from the 33% of trades in the hypothesis-generating slice.
  literal verdict (slippage criterion taken as passed): FULL → ACCEPT-LIVE-CANDIDATE · PRE-8000 (clean OOS) → REJECT · POST-8000 (in-sample) → ACCEPT-LIVE-CANDIDATE
  H2 (2025-07-17→) T=236: 183 trades (78%) are in the in-sample slice; H2 exp without them = -0.031 (T=53).
  PRE-8000 in thirds: +0.275 (T=122) · +0.302 (T=115) · -0.252 (T=139)

# R2 — the 6 direction × BTC-daily cells as standalone arms (A2 = SHORT·up is one of six; it was picked on POST-8000)
  cell           | POST-8000 (in-sample)         | PRE-8000 (clean OOS)          | FULL
  LONG·up        | exp -0.264 T=125 PF 0.69 | exp -0.185 T=386 PF 0.77 CI[-0.33,-0.03] | exp -0.204 T=511 PF 0.75
  LONG·neutral   | exp -0.080 T= 71 PF 0.90 | exp +0.062 T= 61 PF 1.08 CI[-0.35,+0.50] | exp -0.014 T=132 PF 0.98
  LONG·down      | exp +0.002 T=149 PF 1.00 | exp -0.016 T=138 PF 0.98 CI[-0.28,+0.27] | exp -0.007 T=287 PF 0.99
  SHORT·up       | exp +0.605 T=183 PF 2.02 | exp +0.088 T=376 PF 1.12 CI[-0.09,+0.27] | exp +0.257 T=559 PF 1.37
  SHORT·neutral  | exp -0.180 T= 93 PF 0.79 | exp +0.192 T=130 PF 1.27 CI[-0.11,+0.50] | exp +0.037 T=223 PF 1.05
  SHORT·down     | exp -0.028 T=328 PF 0.96 | exp -0.329 T=248 PF 0.62 CI[-0.51,-0.14] | exp -0.157 T=576 PF 0.80
  rank of SHORT·up: #1/6 on POST-8000 (where it was chosen) · #2/6 on PRE-8000 (best OOS cell: SHORT·neutral +0.192)
  cells with PRE-8000 CI95 lower > 0: none

# R3 — placebo: A2 with the BTC daily tag LAGGED by k days (same series, same coverage; no contemporaneous information)
  47 lags (k=30…720 step 15). Placebo FULL exp: median +0.003 · p90 +0.127 · max +0.167 · share ≥ real (+0.257) = 0% · share with CI lower > 0 = 9% · share passing literal ACCEPT (no slip) = 0%
  Placebo PRE-8000 exp: median -0.026 · p90 +0.107 · max +0.148 · share ≥ real PRE-8000 (+0.088) = 15%
  SHORT-only unconditioned (A1 in the regime report) FULL exp +0.012 — the placebo median tells what a random 43%-coverage regime mask does to the SHORT book under the guards.
  per lag (k: FULL exp/T · PRE exp/T): 30:+0.08/533·+0.14/405  45:+0.05/495·+0.01/368  60:-0.01/531·-0.03/377  75:-0.17/508·-0.17/346  90:-0.06/585·-0.03/429  105:+0.09/679·+0.07/468  120:-0.11/576·-0.17/402  135:-0.02/586·-0.08/373  150:-0.06/583·-0.07/379  165:-0.09/601·-0.02/386  180:+0.06/650·+0.05/404  195:+0.15/666·+0.13/415  210:+0.00/655·-0.06/428  225:+0.00/717·-0.04/478  240:+0.10/724·+0.03/486  255:+0.16/757·+0.04/476  270:+0.04/665·-0.00/417  285:-0.01/675·-0.14/398  300:+0.13/707·+0.11/406  315:-0.14/737·-0.07/446  330:+0.11/737·+0.09/427  345:+0.02/734·+0.03/422  360:-0.04/776·-0.02/439  375:+0.16/732·+0.10/388  390:+0.01/663·+0.07/358  405:+0.07/706·+0.07/355  420:+0.01/737·-0.02/435  435:-0.04/698·-0.03/414  450:+0.17/817·+0.15/490  465:-0.04/773·-0.06/490  480:+0.04/709·-0.03/457  495:+0.02/748·-0.01/476  510:-0.15/680·-0.10/449  525:-0.11/658·-0.21/413  540:-0.12/630·-0.30/379  555:-0.04/713·-0.13/394  570:+0.03/711·-0.07/368  585:+0.12/746·+0.14/389  600:-0.01/663·-0.03/354  615:+0.02/672·-0.05/345  630:-0.15/599·-0.17/320  645:-0.11/624·-0.09/319  660:-0.05/562·-0.17/247  675:+0.12/610·-0.02/276  690:-0.03/573·-0.14/255  705:-0.04/603·-0.14/271  720:+0.07/602·+0.02/255

# R4 — verdict stability: stratified bootstrap of A2 trades (resample within H1 and within H2, 10k)
  P(exp ≥ 0.25) = 53% · P(PF ≥ 1.30) = 70% · P(both halves ≥ 0.10) = 53% · P(all three) = 42% — the ACCEPT verdict is a coin flip on resampling of its own trades.

# REVIEW SUMMARY
- Code: clean (no look-ahead in entry, exits, tag or guards; parity with phase8 established by the regime script).
- Selection leakage: H1/A2 is the best of 6 direction×regime cells chosen on the last 8000 candles; FULL includes that slice (33% of A2's trades, 77% of its sumR). The pre-registered criteria were applied to a window that contains the hypothesis-generating data. On the clean OOS slice the same rules give REJECT (exp +0.088, CI [-0.091, +0.271], halves +0.323/-0.286).
- Placebo: 0% of lagged-tag placebos reach the real FULL exp; 15% reach the real PRE-8000 exp.
- Verdict ACCEPT-LIVE-CANDIDATE is REFUTED as evidence of live-grade edge; the honest classification of A2 is the PRE-8000 verdict above, with the caveat that even that slice is non-monotone (halves +0.323/-0.286).
# R5 — additional checks run by the reviewer from the A2 trade dump (script/.cache/phase9-regime-trades-20000.json) and the day-keyed candle cache
- Entry verification: for 559/559 A2 trades the recorded entry equals the close of the 1h candle whose close time is the decision time (`openedSec − 3600`) in `pl_<sym>_1h_20000_20260902.json` (0 mismatches). `barsAfter` {0:76, 1:320, 2:163} is the sweep offset tag only — the fill is never the sweep candle's close.
- BTC tag verification: recomputing `dailyTrendAt` independently at the decision time and at UTC midnight of the decision day gives identical tags for all 559 trades (0 mismatches); hours since the last CLOSED daily candle range 0–23. All 559 tags are "up". Formula matches the engine's `getDailyTrend` (55 daily closes, EMA50 seeded on the first close, ±1%), and the engine's `fetchStrategyKlines` → `dropOpenCandle` also drops the forming daily candle. No same-day close is used anywhere.
- Clustering (why the iid CI overstates certainty): 559 trades fall on 174 UTC days / 67 weeks / 53 contiguous BTC-up episodes; up to 12 entries per day and 10 simultaneous positions (all alt shorts in the same BTC regime). Cluster bootstrap CI95 of FULL exp: iid [+0.105, +0.419] · by day [+0.017, +0.506] · by week [−0.032, +0.535] · by month [−0.026, +0.550] · by episode [−0.030, +0.538]. The pre-registered "CI95 lower > 0" criterion holds only under the iid assumption. On PRE-8000 the week-cluster CI is [−0.231, +0.419] (P(exp ≤ 0) ≈ 30%).
- Margin sensitivity: FULL exp +0.257 → +0.242 without the single best trade (ATOM 2025-10-10 +8.97R, in-sample) → fails exp ≥ 0.25. H1 exp +0.108 → +0.091 without the best H1 trade → fails both-halves ≥ 0.10. Two individual trades therefore decide the literal verdict.
- Multiple comparison: 4 arms were pre-registered for verdicts (A1–A4) and the A2 cell was the best of 6 direction×regime cells on the selection slice. Bonferroni iid CI (α = 0.05/4) [+0.059, +0.460]; (α = 0.05/6) [+0.048, +0.469]; week-cluster Bonferroni-4 [−0.108, +0.615].
- In-sample share of the "both halves" criterion: 183/236 H2 trades (78%) are in the hypothesis-generating slice; H2 restricted to OOS trades is exp −0.031 (T=53).
- Episode table (contiguous BTC-up runs, gap > 3 days): the FULL sumR +143.9 is carried by 4 episodes — 2024-12-07→09 (+36.9R, 11 trades), 2025-10-03→10 (+42.8R, 27), 2026-05-26 (+23.5R, 11), 2024-10-25→11-08 (+23.7R, 42); 27 of 53 episodes are negative.

# REVIEWER VERDICT
REFUTED as ACCEPT-LIVE-CANDIDATE. The pipeline has no code-level look-ahead, but the verdict window contains the data that generated the hypothesis (best-of-6 cell picked on the last 8000 candles), the in-sample slice supplies 77% of sumR, the clean OOS slice is REJECT by the same rules (exp +0.088, halves +0.323/−0.286), the CI-lower-bound criterion fails under any clustering-aware bootstrap, and both threshold margins (0.007R and 0.008R) flip on a single trade. Corrected classification: REJECT (pre-registered rules on clean OOS); a forward PAPER hypothesis at most, subject to the standing honest-paper gate (≥ +0.3R over ≥ 120 trades). The robust *removal* finding stands: LONG·BTC-up is negative in every window (PRE −0.185, POST −0.264, FULL −0.204).
