# Phase 9 — Engine architecture redesign (design component) — 2026-09-02

Scope: server/routes.ts (paperScan/paperCheck/liveScan/liveCheck), server/portfolio-guards.ts, server/exposure-guards.ts, server/kraken-client.ts, server/exchange.ts, server/strategies/registry.ts, script/validate-pipeline.ts. Nothing under server/ or client/ was modified; every item below is a patch plan for the lead. Research script: `script/audit/phase9-design.ts` (raw run: `script/audit/phase9-design-run-20000.md`).

Data: Binance spot 1h × 20000 (≈2.3 y, 2024-05 → 2026-09) for the 40-coin universe, 4h × 20000 for the six B&R coins (≈3.7 y is the 4h ceiling; both streams end 2026-09-02), 1d/1w for trend. Entry = signal candle close (the fixed strategy code — honest by construction), exits = engine (TP1 60% → BE → 2R trail, 200/60 bars max hold), fees 0.05% + slippage 0.05% per side. $500 · 2% base risk (the official harness defaults; guards are in R so the capital only matters for the margin model, which is off here as in the official harness).

**Framing, before any number**: over 2.3 years the honest system without any portfolio guard is T=3379 · PF 0.99 · exp −0.009R · maxDD 237R (G0 below). A guard can only remove trades from a zero-edge stream, so every guard arm's sumR difference is noise. The guard grid is therefore read ONLY for *halt dynamics* (how often, how long, how redundant); nothing in section B is promoted on P&L, and the guard threshold X is left to the portfolio stage, whose final strategy mix determines the R-scale of normal variance (B&R+RSI alone has maxDD ≈ 19R over 3.7 y — D6 — so an X calibrated on the LS-heavy stream would never fire there).

---

## A. Live-scale realism — Kraken Futures (public /instruments + /tickers, Binance prices, 2026-09-02)

Method: risk$ = equity × risk%; notional = risk$ ÷ 1.5% stop; contracts = notional ÷ price floored to `contractValueTradePrecision` (kraken-client `roundSize`, floor — so real risk ≤ plan); fee share of 1R = 0.05% × 2 legs × real notional ÷ risk$; TP1 partial = `roundSize(contracts × 0.6)`, runner = remainder; "tradeable" = lot > 0 and under-size ≤ 25%.

### $110 / 0.5% — risk $0.55 → notional $36.67
| coin | price | prec | contracts raw → lot | lot err % | real risk $ | fee % of 1R | TP1 lot | runner lot | tradeable | partial ok |
|---|---|---|---|---|---|---|---|---|---|---|
| SOL | 99.48 | 2 | 0.3686 → 0.36 | 2.3 | 0.54 | 6.5 | 0.21 | 0.15 | yes | yes |
| SAND | 0.03872 | 0 | 946.97 → 946 | 0.1 | 0.55 | 6.7 | 567 | 379 | yes | yes |
| BNB | 687.39 | 2 | 0.0533 → 0.05 | 6.3 | 0.52 | 6.3 | 0.03 | 0.02 | yes | yes |
| XRP | 1.3419 | 0 | 27.32 → 27 | 1.2 | 0.54 | 6.6 | 16 | 11 | yes | yes |
| AVAX | 7.169 | 2 | 5.115 → 5.11 | 0.1 | 0.55 | 6.7 | 3.06 | 2.05 | yes | yes |
| ETC | 7.23 | 1 | 5.071 → 5.0 | 1.4 | 0.54 | 6.6 | 3.0 | 2.0 | yes | yes |
| ATOM | 1.459 | 1 | 25.13 → 25.1 | 0.1 | 0.55 | 6.7 | 15.0 | 10.1 | yes | yes |
| INJ | 4.746 | 1 | 7.726 → 7.7 | 0.3 | 0.55 | 6.7 | 4.6 | 3.1 | yes | yes |
| UNI | 5.822 | 1 | 6.298 → 6.2 | 1.6 | 0.54 | 6.6 | 3.7 | 2.5 | yes | yes |
| ICP | 2.482 | 1 | 14.77 → 14.7 | 0.5 | 0.55 | 6.6 | 8.8 | 5.9 | yes | yes |
| AAVE | 127.08 | 2 | 0.2885 → 0.28 | 3.0 | 0.53 | 6.5 | 0.16 | 0.12 | yes | yes |
| PEPE | 0.00000339 | −3 | 10 816 125 → 10 816 000 | 0.0 | 0.55 | 6.7 | 6 489 000 | 4 327 000 | yes | yes |
| BCH | 243.7 | 2 | 0.1505 → 0.15 | 0.3 | 0.55 | 6.6 | 0.09 | 0.06 | yes | yes |
| FIL | 0.8043 | 1 | 45.59 → 45.5 | 0.2 | 0.55 | 6.7 | 27.3 | 18.2 | yes | yes |
| LTC | 49.56 | 2 | 0.7398 → 0.73 | 1.3 | 0.54 | 6.6 | 0.43 | 0.30 | yes | yes |
| DOGE | 0.08159 | 0 | 449.4 → 449 | 0.1 | 0.55 | 6.7 | 269 | 180 | yes | yes |
| NEAR | 1.851 | 0 | 19.81 → 19 | 4.1 | 0.53 | 6.4 | 11 | 8 | yes | yes |
| DOT | 0.859 | 1 | 42.69 → 42.6 | 0.2 | 0.55 | 6.7 | 25.5 | 17.1 | yes | yes |
| LINK | 11.143 | 1 | 3.291 → 3.2 | 2.8 | 0.53 | 6.5 | 1.9 | 1.3 | yes | yes |
| APT | 0.56 | 1 | 65.48 → 65.4 | 0.1 | 0.55 | 6.7 | 39.2 | 26.2 | yes | yes |
| HBAR | 0.07399 | 0 | 495.6 → 495 | 0.1 | 0.55 | 6.7 | 297 | 198 | yes | yes |
| SEI | 0.04855 | 0 | 755.2 → 755 | 0.0 | 0.55 | 6.7 | 453 | 302 | yes | yes |
| ETH | 2396.16 | 3 | 0.0153 → 0.015 | 2.0 | 0.54 | 6.5 | 0.009 | 0.006 | yes | yes |
| SUI | 0.7264 | 0 | 50.48 → 50 | 0.9 | 0.54 | 6.6 | 30 | 20 | yes | yes |
| ARB | 0.1247 | 0 | 294.0 → 294 | 0.0 | 0.55 | 6.7 | 176 | 118 | yes | yes |
| TIA | 0.3533 | 1 | 103.78 → 103.7 | 0.1 | 0.55 | 6.7 | 62.2 | 41.5 | yes | yes |
| BTC | 77450.93 | 4 | 0.000473 → 0.0004 | 15.5 | 0.46 | 5.6 | 0.0002 | 0.0002 | yes | yes |
| FET | 0.1514 | 0 | 242.2 → 242 | 0.1 | 0.55 | 6.7 | 145 | 97 | yes | yes |
| RENDER | 1.411 | 1 | 25.99 → 25.9 | 0.3 | 0.55 | 6.6 | 15.5 | 10.4 | yes | yes |
| ONDO | 0.3409 | 0 | 107.56 → 107 | 0.5 | 0.55 | 6.6 | 64 | 43 | yes | yes |
| ENA | 0.15 | 0 | 244.4 → 244 | 0.2 | 0.55 | 6.7 | 146 | 98 | yes | yes |
| WLD | 0.3597 | 0 | 101.94 → 101 | 0.9 | 0.54 | 6.6 | 60 | 41 | yes | yes |
| CRV | 0.3569 | 0 | 102.74 → 102 | 0.7 | 0.55 | 6.6 | 61 | 41 | yes | yes |
| GALA | 0.001749 | 0 | 20 964 → 20 964 | 0.0 | 0.55 | 6.7 | 12 578 | 8 386 | yes | yes |
| RUNE | 0.474 | 0 | 77.36 → 77 | 0.5 | 0.55 | 6.6 | 46 | 31 | yes | yes |
| GRT | 0.01616 | 0 | 2269.0 → 2268 | 0.0 | 0.55 | 6.7 | 1360 | 908 | yes | yes |
| IMX | 0.1236 | 0 | 296.7 → 296 | 0.2 | 0.55 | 6.7 | 177 | 119 | yes | yes |
| POL | 0.09157 | 0 | 400.4 → 400 | 0.1 | 0.55 | 6.7 | 240 | 160 | yes | yes |
| VET | 0.00656 | 0 | 5589.4 → 5589 | 0.0 | 0.55 | 6.7 | 3353 | 2236 | yes | yes |
| ADA | 0.1971 | 0 | 186.0 → 186 | 0.0 | 0.55 | 6.7 | 111 | 75 | yes | yes |

Untradeable at $110/0.5%: **none** (Kraken sizes in base units, so even $37 notional rounds cleanly). Lot error > 10%: **BTC 15.5%** (0.0004 vs 0.000473 BTC → real risk $0.46 instead of $0.55). TP1 60% partial and 40% runner both non-zero for all 40. Fee share of 1R at a 1.5% stop: 6.3–6.7% everywhere (5.6% BTC because it is under-sized) — the cost problem at this scale is not lot rounding.

### Compact per-coin table (both scales)
| coin | price | Kraken prec | notional @$110/0.5% (planned $36.67) | lot err % | fee % of 1R | TP1/runner lots | tradeable | notional @$1000/1% (planned $666.67) | lot err % | fee % of 1R | tradeable | Kraken vol24h | Kraken spread bps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL | 99.48 | 2 | $35.81 (0.36) | 2.3 | 6.5 | 0.21/0.150 | yes | $666.52 (6.7) | 0.0 | 6.7 | yes | 51.31M | 2.0 |
| SAND | 0.03872 | 0 | $36.63 (946) | 0.1 | 6.7 | 567/379 | yes | $666.64 (17217) | 0.0 | 6.7 | yes | 0.08M | 79.2 |
| BNB | 687.39 | 2 | $34.37 (0.05) | 6.3 | 6.2 | 0.03/0.0200 | yes | $659.89 (0.96) | 1.0 | 6.6 | yes | 0.91M | 2.5 |
| XRP | 1.3419 | 0 | $36.23 (27) | 1.2 | 6.6 | 16/11.0 | yes | $665.58 (496) | 0.2 | 6.7 | yes | 55.31M | 0.7 |
| AVAX | 7.169 | 2 | $36.63 (5.11) | 0.1 | 6.7 | 3.06/2.05 | yes | $666.65 (92.99) | 0.0 | 6.7 | yes | 0.79M | 4.2 |
| ETC | 7.23 | 1 | $36.15 (5) | 1.4 | 6.6 | 3/2.00 | yes | $666.61 (92.2) | 0.0 | 6.7 | yes | 0.10M | 20.8 |
| ATOM | 1.459 | 1 | $36.62 (25.1) | 0.1 | 6.7 | 15/10.1 | yes | $666.62 (456.9) | 0.0 | 6.7 | yes | 0.26M | 13.7 |
| INJ | 4.746 | 1 | $36.54 (7.7) | 0.3 | 6.6 | 4.6/3.10 | yes | $666.34 (140.4) | 0.0 | 6.7 | yes | 0.81M | 10.5 |
| UNI | 5.822 | 1 | $36.10 (6.2) | 1.6 | 6.6 | 3.7/2.50 | yes | $666.62 (114.5) | 0.0 | 6.7 | yes | 10.80M | 6.9 |
| ICP | 2.482 | 1 | $36.49 (14.7) | 0.5 | 6.6 | 8.8/5.90 | yes | $666.67 (268.6) | 0.0 | 6.7 | yes | 0.46M | 12.1 |
| AAVE | 127.08 | 2 | $35.58 (0.28) | 3.0 | 6.5 | 0.16/0.120 | yes | $665.90 (5.24) | 0.1 | 6.7 | yes | 1.99M | 4.7 |
| PEPE | 0.00000339 | -3 | $36.67 (10816000) | 0.0 | 6.7 | 6489000/4.33e+6 | yes | $666.66 (196656000) | 0.0 | 6.7 | yes | 1.99M | 5.3 |
| BCH | 243.7 | 2 | $36.55 (0.15) | 0.3 | 6.6 | 0.09/0.0600 | yes | $665.30 (2.73) | 0.2 | 6.7 | yes | 0.38M | 11.1 |
| FIL | 0.8043 | 1 | $36.60 (45.5) | 0.2 | 6.7 | 27.3/18.2 | yes | $666.60 (828.8) | 0.0 | 6.7 | yes | 3.13M | 6.2 |
| LTC | 49.56 | 2 | $36.18 (0.73) | 1.3 | 6.6 | 0.43/0.300 | yes | $666.58 (13.45) | 0.0 | 6.7 | yes | 0.91M | 2.0 |
| DOGE | 0.08159 | 0 | $36.63 (449) | 0.1 | 6.7 | 269/180 | yes | $666.59 (8170) | 0.0 | 6.7 | yes | 8.28M | 1.2 |
| NEAR | 1.851 | 0 | $35.17 (19) | 4.1 | 6.4 | 11/8.00 | yes | $666.36 (360) | 0.0 | 6.7 | yes | 1.98M | 10.8 |
| DOT | 0.859 | 1 | $36.59 (42.6) | 0.2 | 6.7 | 25.5/17.1 | yes | $666.58 (776) | 0.0 | 6.7 | yes | 1.44M | 4.7 |
| LINK | 11.143 | 1 | $35.66 (3.2) | 2.8 | 6.5 | 1.9/1.30 | yes | $666.35 (59.8) | 0.0 | 6.7 | yes | 2.09M | 3.6 |
| APT | 0.56 | 1 | $36.62 (65.4) | 0.1 | 6.7 | 39.2/26.2 | yes | $666.62 (1190.4) | 0.0 | 6.7 | yes | 0.21M | 8.9 |
| HBAR | 0.07399 | 0 | $36.63 (495) | 0.1 | 6.7 | 297/198 | yes | $666.65 (9010) | 0.0 | 6.7 | yes | 0.33M | 10.8 |
| SEI | 0.04855 | 0 | $36.66 (755) | 0.0 | 6.7 | 453/302 | yes | $666.64 (13731) | 0.0 | 6.7 | yes | 0.33M | 8.2 |
| ETH | 2396.16 | 3 | $35.94 (0.015) | 2.0 | 6.5 | 0.009/0.00600 | yes | $666.13 (0.278) | 0.1 | 6.7 | yes | 150.40M | 0.4 |
| SUI | 0.7264 | 0 | $36.32 (50) | 0.9 | 6.6 | 30/20.0 | yes | $666.11 (917) | 0.1 | 6.7 | yes | 5.06M | 5.5 |
| ARB | 0.1247 | 0 | $36.66 (294) | 0.0 | 6.7 | 176/118 | yes | $666.65 (5346) | 0.0 | 6.7 | yes | 6.03M | 21.6 |
| TIA | 0.3533 | 1 | $36.64 (103.7) | 0.1 | 6.7 | 62.2/41.5 | yes | $666.64 (1886.9) | 0.0 | 6.7 | yes | 0.31M | 14.1 |
| BTC | 77450.93 | 4 | $30.98 (0.0004) | 15.5 | 5.6 | 0.0002/0.000200 | yes | $666.08 (0.0086) | 0.1 | 6.7 | yes | 618.37M | 0.1 |
| FET | 0.1514 | 0 | $36.64 (242) | 0.1 | 6.7 | 145/97.0 | yes | $666.61 (4403) | 0.0 | 6.7 | yes | 0.63M | 13.2 |
| RENDER | 1.411 | 1 | $36.54 (25.9) | 0.3 | 6.6 | 15.5/10.4 | yes | $666.56 (472.4) | 0.0 | 6.7 | yes | 0.33M | 12.8 |
| ONDO | 0.3409 | 0 | $36.48 (107) | 0.5 | 6.6 | 64/43.0 | yes | $666.46 (1955) | 0.0 | 6.7 | yes | 0.86M | 5.9 |
| ENA | 0.15 | 0 | $36.60 (244) | 0.2 | 6.7 | 146/98.0 | yes | $666.60 (4444) | 0.0 | 6.7 | yes | 1.47M | 9.3 |
| WLD | 0.3597 | 0 | $36.33 (101) | 0.9 | 6.6 | 60/41.0 | yes | $666.52 (1853) | 0.0 | 6.7 | yes | 0.39M | 5.6 |
| CRV | 0.3569 | 0 | $36.40 (102) | 0.7 | 6.6 | 61/41.0 | yes | $666.33 (1867) | 0.1 | 6.7 | yes | 2.78M | 11.2 |
| GALA | 0.001749 | 0 | $36.67 (20964) | 0.0 | 6.7 | 12578/8.39e+3 | yes | $666.67 (381170) | 0.0 | 6.7 | yes | 0.15M | 5.7 |
| RUNE | 0.474 | 0 | $36.50 (77) | 0.5 | 6.6 | 46/31.0 | yes | $666.44 (1406) | 0.0 | 6.7 | yes | 0.06M | 10.6 |
| GRT | 0.01616 | 0 | $36.65 (2268) | 0.0 | 6.7 | 1360/908 | yes | $666.66 (41254) | 0.0 | 6.7 | yes | 0.02M | 18.5 |
| IMX | 0.1236 | 0 | $36.59 (296) | 0.2 | 6.7 | 177/119 | yes | $666.57 (5393) | 0.0 | 6.7 | yes | 0.00M | 65.8 |
| POL | 0.09157 | 0 | $36.63 (400) | 0.1 | 6.7 | 240/160 | yes | $666.63 (7280) | 0.0 | 6.7 | yes | 0.37M | 4.4 |
| VET | 0.00656 | 0 | $36.66 (5589) | 0.0 | 6.7 | 3353/2.24e+3 | yes | $666.67 (101626) | 0.0 | 6.7 | yes | 0.07M | 24.4 |
| ADA | 0.1971 | 0 | $36.66 (186) | 0.0 | 6.7 | 111/75.0 | yes | $666.59 (3382) | 0.0 | 6.7 | yes | 4.26M | 4.6 |

Untradeable at $110/0.5%: none. Lot error >10%: BTC 15.5% (0.0004 BTC lot vs 0.000473; real risk $0.46 of $0.55). Untradeable at $1000/1%: none (max lot error BNB 1.0%). Fee share of 1R = 0.05% x 2 legs x notional / risk = 6.7% at a 1.5% stop at both scales (5.6% for BTC because under-sized). TP1 60% partial and 40% runner round to non-zero lots for all 40 coins at both scales. Real constraint is venue liquidity: 36/40 coins under $30M/24h on Kraken, 32/40 under $5M; spreads >20 bps now on SAND (79), IMX (66), VET (24), ARB (22), ETC (21); IMX vol24h $0.

### $1000 / 1% — risk $10 → notional $667
All 40 coins tradeable, lot error ≤ 1.0% (BNB 1.0%, all others ≤ 0.2%), fee share 6.6–6.7% of 1R, partial/runner non-zero everywhere. (Full per-coin rows in `phase9-design-run-20000.md`.)

### Where the live-scale problem actually is: Kraken liquidity, not lot size
| coin | Kraken vol24h $ | OI $ | spread bps (now) | impactMid $ | 1.5% stop in ticks |
|---|---|---|---|---|---|
| BTC | 618M | 150M | 0.1 | 6.2k | 1162 |
| ETH | 150M | 61M | 0.4 | 12.2k | 359 |
| XRP | 55M | 15M | 0.7 | 4.7k | 201 |
| SOL | 51M | 30M | 2.0 | 12.9k | 149 |
| UNI | 10.8M | 4.2M | 6.9 | 9.9k | 87 |
| DOGE | 8.3M | 4.1M | 1.2 | 3.7k | 122 |
| ARB | 6.0M | 2.0M | 21.6 | 8.4k | 187 |
| SUI | 5.1M | 3.5M | 5.5 | 3.3k | 109 |
| ADA | 4.3M | 4.4M | 4.6 | 3.0k | 296 |
| FIL | 3.1M | 0.8M | 6.2 | 6.0k | 121 |
| CRV | 2.8M | 2.6M | 11.2 | 8.6k | 54 |
| LINK | 2.1M | 5.2M | 3.6 | 5.0k | 167 |
| AAVE | 2.0M | 3.0M | 4.7 | 8.1k | 191 |
| PEPE | 2.0M | 1.9M | 5.3 | 3.9k | 509 |
| NEAR | 2.0M | 3.2M | 10.8 | 4.0k | 278 |
| ENA | 1.5M | 1.3M | 9.3 | 8.7k | 225 |
| DOT | 1.4M | 3.5M | 4.7 | 3.8k | 129 |
| BNB | 0.9M | 1.8M | 2.5 | 4.1k | 1031 |
| LTC | 0.9M | 4.1M | 2.0 | 3.5k | 74 |
| ONDO | 0.9M | 2.3M | 5.9 | 3.4k | 51 |
| INJ | 0.8M | 0.7M | 10.5 | 3.8k | 71 |
| AVAX | 0.8M | 2.2M | 4.2 | 3.2k | 108 |
| FET | 0.6M | 1.0M | 13.2 | 6.2k | 227 |
| ICP | 0.5M | 0.6M | 12.1 | 5.5k | 37 |
| WLD | 0.4M | 0.6M | 5.6 | 2.7k | 54 |
| BCH | 0.4M | 0.9M | 11.1 | 4.4k | 366 |
| POL | 0.4M | 1.0M | 4.4 | 4.9k | 137 |
| HBAR | 0.3M | 1.0M | 10.8 | 5.6k | 111 |
| SEI | 0.3M | 0.2M | 8.2 | 3.6k | 73 |
| RENDER | 0.3M | 0.2M | 12.8 | 5.5k | 212 |
| TIA | 0.3M | 0.3M | 14.1 | 6.0k | 53 |
| ATOM | 0.3M | 2.5M | 13.7 | 5.1k | 22 |
| APT | 0.2M | 0.5M | 8.9 | 3.1k | 84 |
| GALA | 0.15M | 0.5M | 5.7 | 2.6k | 26 |
| ETC | 0.10M | 1.4M | 20.8 | 4.6k | 108 |
| SAND | 0.08M | 0.27M | **79.2** | 2.4k | 58 |
| VET | 0.07M | 0.12M | 24.4 | 0.5k | 98 |
| RUNE | 0.06M | 0.12M | 10.6 | 2.3k | 71 |
| GRT | 0.02M | 0.24M | 18.5 | 1.5k | 24 |
| IMX | **0.00M** | 0.07M | **65.8** | 1.5k | 185 |

36/40 coins trade under $30M/24h on Kraken; 32/40 under $5M; SAND, IMX, VET, ETC, ARB are outside the engine's own 20 bps spread cap *right now*, measured on the venue that executes. The engine measures spread on MEXC and exempts every coin from the $30M volume gate because every coin is "preferred". The spread alone on a ~145 bps median LS stop is 5–10 bps of unavoidable half-spread + impact per side on most of the book — a second-order but real contributor to the live gap after the stale entry (which was first-order).

## C1. Scan timing — real paper entries, minutes after the hourly close (pre-reset export, n=176 1h trades)
| bucket | n | share |
|---|---|---|
| 0–3 min | 165 | 94% |
| 3–6 min | 1 | 1% |
| 6–10 min | 1 | 1% |
| 10–20 min | 3 | 2% |
| 30–60 min | 6 | 3% |

Median 2.0 min, p90 2.9 min. The free-running 3-min interval happens to have been phased well; the 6% tail (10–60 min) is exactly the restart/un-halt/slot-free population the freshness gate now rejects. Close-aligned scans make the entry latency a constant (~30–60 s) instead of a uniform 0–3 min draw, and make the freshness gate a safety net instead of a routine filter.

---

## B. Guard redesign — honest entries, 20000×1h

Reading guide: G0 = system without any portfolio guard. "time halted" = share of calendar time with the portfolio halt active. "halt ÷ (peak→halt)" = halt duration ÷ time from the in-window equity peak to the halt. "halt ÷ loss-span" = halt duration ÷ span of the losing trades inside the guard window at halt time (the "box window makes the halt outlast the cluster" measure). co-fired = entries blocked with ≥ 2 guards firing at once.

| arm | T | PF | sumR | ΔsumR vs G0 | exp | maxDD R | ΔmaxDD | portfolio halts | median halt h | max halt h | time halted % | strategy-switch halts | co-fired |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G0 no portfolio guards (strategy gates only) | 3379 | 0.99 | −30.8 | 0 | −0.009 | 236.7 | 0 | 0 | — | — | 0.0 | 0 | 0 |
| G1 ENGINE trio: daily −4R · rolling-7d −6R · kill-switch −3R/4 (R = balance×base%) | 1647 | 0.92 | −103.0 | −72.2 | −0.063 | 202.9 | −33.8 | 113 | 36 | 230 | 9.8 | 123 (LS) | 2818 |
| G1b trio, R = actual trade risk (base × BTC multiplier) | 1631 | 0.92 | −105.4 | −74.6 | −0.065 | 206.0 | −30.7 | 123 | 29 | 193 | 9.5 | 122 | 2589 |
| G1c trio minus kill-switch | 2016 | 0.97 | −38.5 | −7.7 | −0.019 | 160.2 | −76.5 | 153 | 21 | 207 | 11.3 | 0 | 222 |
| G1d kill-switch only | 1952 | 0.97 | −50.5 | −19.7 | −0.026 | 181.9 | −54.8 | 0 | — | — | 0.0 | 125 | 0 |
| G2 DD X=6R resume 3R · 30d peak · pure hysteresis | 607 | 0.94 | −26.7 | +4.1 | −0.044 | 83.8 | −152.9 | 29 | 700 | 744 | 22.6 | 0 | 0 |
| G2 DD X=8R resume 4R · 30d peak · pure hysteresis | 762 | 0.94 | −34.4 | −3.5 | −0.045 | 84.7 | −152.0 | 31 | 692 | 744 | 21.7 | 0 | 0 |
| G2 DD X=10R resume 5R · 30d peak · pure hysteresis | 891 | 0.91 | −63.3 | −32.5 | −0.071 | 88.7 | −148.0 | 26 | 700 | 742 | 20.2 | 0 | 0 |
| G2 DD X=12R resume 6R · 30d peak · pure hysteresis | 976 | 0.87 | −104.2 | −73.4 | −0.107 | 148.1 | −88.6 | 24 | 693 | 720 | 19.5 | 0 | 0 |
| G2 DD X=15R resume 7.5R · 30d peak · pure hysteresis | 1249 | 0.97 | −25.1 | +5.7 | −0.020 | 119.1 | −117.6 | 22 | 673 | 747 | 17.3 | 0 | 0 |
| G2 DD X=10R resume 5R · **7d** peak · pure hysteresis | 2161 | 1.04 | +59.2 | +90.0 | +0.027 | 149.2 | −87.5 | 57 | 149 | 190 | 9.8 | 0 | 0 |
| G2 DD X=10R resume 5R · **14d** peak · pure hysteresis | 1409 | 0.98 | −17.0 | +13.8 | −0.012 | 111.5 | −125.2 | 45 | 304 | 351 | 15.3 | 0 | 0 |
| G2 DD X=8R · 30d peak · **maxHalt 24h** (re-base) | 2913 | 0.97 | −65.0 | −34.2 | −0.022 | 195.8 | −40.9 | 106 | 26 | 123 | 4.2 | 0 | 0 |
| G2 DD X=8R · 30d peak · maxHalt 72h (re-base) | 2393 | 0.98 | −30.7 | +0.2 | −0.013 | 169.6 | −67.1 | 92 | 74 | 123 | 8.9 | 0 | 0 |
| G2 DD X=10R · 30d peak · maxHalt 24h (re-base) | 3058 | 0.99 | −24.6 | +6.2 | −0.008 | 187.1 | −49.6 | 85 | 26 | 65 | 3.3 | 0 | 0 |
| G2 DD X=10R · 30d peak · maxHalt 72h (re-base) | 2561 | 0.98 | −42.0 | −11.2 | −0.016 | 186.4 | −50.3 | 76 | 74 | 123 | 7.3 | 0 | 0 |
| G2 DD X=12R · 30d peak · maxHalt 24h (re-base) | 3096 | 1.01 | +27.9 | +58.7 | +0.009 | 155.8 | −80.9 | 69 | 26 | 91 | 2.7 | 0 | 0 |
| G2 DD X=12R · 30d peak · maxHalt 72h (re-base) | 2706 | 0.98 | −42.9 | −12.0 | −0.016 | 216.0 | −20.7 | 62 | 74 | 93 | 6.2 | 0 | 0 |
| G3 DD X=10R + per-strategy Xs=4R · maxHalt 72h | 1777 | 0.92 | −113.7 | −82.9 | −0.064 | 174.8 | −61.9 | 45 | 74 | 97 | 4.7 | 145 (LS 135, RSI 10) | 930 |
| G3 DD X=10R + per-strategy Xs=6R · maxHalt 72h | 2039 | 0.96 | −59.0 | −28.2 | −0.029 | 161.4 | −75.3 | 55 | 75 | 123 | 5.7 | 102 (LS 100, RSI 2) | 1015 |
| G3 DD X=12R + per-strategy Xs=4R · maxHalt 72h | 1765 | 0.92 | −114.1 | −83.3 | −0.065 | 214.3 | −22.5 | 41 | 75 | 123 | 4.3 | 140 | 739 |
| G3 DD X=12R + per-strategy Xs=6R · maxHalt 72h | 2015 | 0.99 | −13.1 | +17.7 | −0.006 | 137.3 | −99.4 | 46 | 75 | 99 | 4.8 | 104 | 870 |
| G1 ENGINE trio **+15 bps** adverse fill | 1552 | 0.81 | −234.7 | −203.9 | −0.151 | 290.9 | +54.2 | 118 | 38 | 230 | 10.2 | 121 | 2867 |
| G3 DD X=10 Xs=6 maxHalt 72h **+15 bps** | 1970 | 0.88 | −173.9 | −143.1 | −0.088 | 240.3 | +3.6 | 58 | 74 | 123 | 5.9 | 101 | 991 |
| G0 no guards **+15 bps** | 3374 | 0.89 | −277.9 | −247.1 | −0.082 | 340.0 | +103.3 | 0 | — | — | 0.0 | 0 | 0 |

Equal-count halves (G0): H1 exp −0.053 (T=1689, to 2025-06-23) · H2 +0.034 (T=1690). CI95(exp) G0 = [−0.067, +0.048]. Every arm's CI95 straddles zero except the +15 bps arms (all negative). G1 co-fired 2818 of 4882 guard-blocked entries (58%).

Per-arm detail (CI95, equal-count halves, per-scope halt episodes): `script/audit/phase9-design-run-20000.md`.

### What the grid shows (halt dynamics only — the P&L columns are noise around a zero-edge stream)
1. **The kill-switch is a second portfolio guard, not a per-strategy one.** With LS at ~85% of trades, `killSwitch:liquidity-sweep` is the single largest blocker in the engine (4317 blocks vs 3183 for rolling-7d and 369 for daily) and it halted LS 123 times for a median 70 h — 14.4% of the calendar. 58% of all guard-blocked entries had ≥ 2 guards firing at once. Removing the kill-switch alone (G1c) puts 369 trades back and cuts maxDD from 203R to 160R over the same zero-edge stream — i.e. the ks was removing recoveries as often as losses. The trio is three thresholds on one process.
2. **The R-unit mismatch is real but immaterial to outcomes** (G1 vs G1b: T 1647 vs 1631, maxDD 203 vs 206). It is a correctness/simplicity problem, not a P&L one; the fix is to measure in trade-R (Σ pnl_usd ÷ risk_usd), which makes the guard independent of the balance and of any sizing multiplier — and then the multiplier itself becomes removable (C2).
3. **Box-window halt length**: the trio's median portfolio halt is 36 h (mean 65 h, max 230 h = 9.6 days); median halt ÷ loss-span 0.3× — the typical halt is *shorter* than the losing run that caused it. The "7×" over-run happens for compact clusters (a day of losses → 7 days of rolling-window halt), which is the max-230 h tail, not the median. The redesign's motivation is therefore redundancy and unit coherence first, tail-duration second.
4. **Pure hysteresis with a 30-day peak does not work on a zero-edge stream**: once halted, new entries are blocked, nothing recovers, and the halt lasts until the peak ages out of the window — median 700 h (29 days), 17–23% of the calendar for every X. A 7-day peak window gives 149 h halts (9.8% of time), 14-day gives 304 h. Hysteresis needs a bounded halt: with `maxHalt` + peak re-base the halt is a clean 24 h or 72 h block (median 26 h / 74 h) and total halted time is 2.7–4.2% (24 h) or 6–9% (72 h) — one quarter to one half of the current engine's 9.8%, with **zero** co-firing.
5. **A per-strategy switch is only meaningful for minority strategies.** At Xs=4R the LS switch fired 131–145 times (12.7% of the calendar) and co-fired with the portfolio guard 739–1015 times — it is the same guard twice. At Xs=6R still 100 episodes. The switch should be opt-in per strategy (registry field), sized to that strategy's trade rate, and OFF for whichever strategy dominates the book.
6. **Execution dominates everything here**: +15 bps adverse fill costs 0.07–0.09 R/trade on every arm (G0 −0.009 → −0.082); no guard configuration moves exp by more than ±0.06R. Guards are risk controls; they are not where the missing edge is.
7. **Calibration of X belongs to the portfolio stage.** On the LS-heavy stream the 30-day peak-to-valley drawdown of the no-guard curve has a long tail (maxDD 237R); on B&R+RSI alone (D6) maxDD is 19R over 3.7 y — X=10 would essentially never fire there. Suggested rule (run on the FINAL mix's honest simulation, both windows): `haltR = quantile(rolling-30d peak-to-valley dd of the no-guard curve, 0.95)`, `resumeR = haltR/2`, `maxHalt = 24h` for 1h-dominated mixes / `72h` for 4h+daily mixes; accept if time-halted ≤ 5% and the guard blocks ≤ 10% of entries. Function signatures in D.1.

---

## C. Structural diagnostics — POST-HOC (each labelled; none promotes anything)

| arm | T | PF | sumR | exp | maxDD R | note |
|---|---|---|---|---|---|---|
| D0 ENGINE trio (reference) | 1647 | 0.92 | −103.0 | −0.063 | 202.9 | H1 −0.087 / H2 −0.038 |
| D1 BTC risk multiplier OFF (flat 1.0×) | 1707 | 0.96 | −58.6 | −0.034 | 175.5 | +44R, −27R maxDD vs D0 |
| D2 correlation-group cap OFF | 1665 | 0.91 | −119.4 | −0.072 | 205.8 | within noise (161 blocks in D0) |
| D3 weekly-trend filter OFF (4h) | 1698 | 0.92 | −111.0 | −0.065 | 218.4 | filter worth +8R over 2.3 y (130 blocks) — the "+45R in 2026" was a stale-entry number |
| D4 LS only | 1494 | 0.90 | −117.6 | −0.079 | 175.3 | halted 31.7% of the time (LS ks + portfolio) |
| D5 B&R + RSI only, trio on | 337 | 1.16 | +37.6 | +0.112 | 18.5 | CI95 [−0.070, +0.293]; H1 +0.127 / H2 +0.097; 1 halt in 3.7 y |
| D6 B&R + RSI only, no guards | 340 | 1.17 | +41.5 | +0.122 | 19.4 | CI95 [−0.060, +0.309]; H1 +0.111 / H2 +0.133 |

**C2 — BTC daily-trend risk multiplier (D0, ALL).** LONG·BTC-up: T=143, exp −0.566R, PF 0.40, sumR −80.9 → sized ×1.25 → −101R in base units. SHORT·BTC-up: T=220, +0.107R, ×1.25 → +29R. LONG·down (×0.75): −5.8R; SHORT·down (×0.75): −29.8R. The multiplier adds 25% size to the single worst cell in the book and trims the two cells that are merely flat. POST-HOC: D1 (flat) is +44R / −27R maxDD better; not adopted here — it is a sizing change and needs the official A/B (pre-registered hypothesis: "removing the multiplier does not lower exp and lowers maxDD on ALL and 2026"). Removing it also dissolves the guard R-unit mismatch.

**C3 — max-hold (D0).** 1h: 38 of 1495 trades (2.5%) hit the 200-bar cap, avg +0.76R (post-TP1 runners drifting); barsHeld p50 13, p90 73. 4h: 15 of 152 (10%) hit 60 bars, avg +0.74R; p50 15, p90 59. The cap is slot turnover + harness parity, not a P&L lever; keep, but express it in BARS in one shared module (200 × 1h, 60 × 4h = 240 h — identical to today) so the engine and harness cannot drift.

**C4 — cooldowns (D0).** LS 12h: 280 blocks; RSI 20h: 151 blocks (vs ≈100 RSI trades taken — a 20 h cooldown on a 1 h strategy removes more candidates than it keeps); B&R 12h = 3 bars: 8 blocks (a no-op). All three were tuned on the stale-entry harness; frozen for now — only re-validate the RSI one if RSI survives the portfolio stage.

**C5 — correlation groups.** The cap binds 161–507 times depending on arm and is neutral on P&L (D2). The map has dead entries (MATIC, SHIB, OP — not in the universe), VET is alone in "infra" (a group of one can never bind), ATOM/FIL are labelled "defi". Keep cap 3 as a cheap structural limit, prune the map, and hold ONE copy of it (it is currently copied in routes.ts, validate-pipeline.ts and audit/lib.ts).

**C6 — exit outcomes (D0, 1h).** loss 1061 (avg −1.11R: the 0.20% round-trip cost model on a ~145 bps stop is ≈0.11R), tp2 287 (+2.69R), trailing 109 (+2.17R), timeout 38 (+0.76R), tp1-only 0. WR 29%. The exit stack is not the problem either; nothing here to change without edge.

---

## D. Redesign — patch plans

Ordered by priority. "needs_backtest" = must go through `script/validate-pipeline.ts` (ALL + 2026, honest entry) with a pre-stated hypothesis before shipping; "no" = structural/bookkeeping change that does not alter which trades are taken, or that the pipeline cannot model.

### D.1 GUARD-1 — one drawdown guard in trade-R replaces the trio (fix · priority 1 · needs calibration run · risk medium)
**Now**: `server/routes.ts` L77–89 constants; paperScan L2436–2457 (daily, rolling) + L2497–2508 (kill-switch); liveScan L3534–3556; status endpoints L2905–2925 (paper) / L4088–4100 (live); overrides L1892–1918 + L2127–2150; `server/portfolio-guards.ts` `sumPnlUsdSince/sumNetRSince/isRollingDrawdownBreached/rollingHaltClearsAt/strategiesToPause`. Three thresholds, two units (daily/rolling in balance×base% USD, ks in netR), 58% co-firing, ks acting as a portfolio guard.
**New** (`server/portfolio-guards.ts`, pure, tested):
```ts
export interface DrawdownGuardOpts { peakWindowMs: number; haltR: number; resumeR: number; maxHaltMs: number; now?: number }
export interface DrawdownGuardState { halted: boolean; haltedSinceMs: number | null; rebasedAtCumR: number | null; rebasedAtMs: number | null }
export const INITIAL_GUARD_STATE: DrawdownGuardState;
export function evaluateDrawdownGuard(trades: ClosedTradeLite[], prev: DrawdownGuardState, opts: DrawdownGuardOpts):
  { state: DrawdownGuardState; cumR: number; peakR: number; ddR: number; transition: "none" | "halt" | "resume" | "expire" };
export function calibrateHaltR(trades: ClosedTradeLite[], opts: { peakWindowMs: number; quantile: number }): number; // p-quantile of rolling peak-to-valley dd in trade-R
```
Semantics (reference implementation: `script/audit/phase9-design.ts` `evaluateDrawdownGuard`): cumR = Σ pnl_usd/risk_usd of closed trades (each in its own R — sizing multipliers, balance and mode drop out); peak = max cum among points closed within `peakWindowMs` AND at/after the last re-base (origin counts if the curve started inside that span; a re-base pins the peak at its level until it ages out); dd = peak − cum; `!halted && dd ≥ haltR → halt`; `halted && dd ≤ resumeR → resume`; `halted && now − haltedSince ≥ maxHaltMs → expire`: resume with `rebasedAtCumR = cum, rebasedAtMs = now`. Per-strategy switch = the same function on `trades.filter(strategy === id)` with the strategy's own `haltR`, declared in the registry (`Strategy.guard?: { haltR: number; resumeR?: number }`, default absent = no switch); OFF for LS while LS is the majority of trades.
**Engine wiring**: one `GUARD` config in the shared constants module (D.6) `{ peakWindowMs: 30d, haltR: X, resumeR: X/2, maxHaltMs: 24h }` with X from `calibrateHaltR` on the portfolio stage's final mix (until then keep X=10 as a placeholder flagged UNCALIBRATED in /api/engine/config). paperScan/liveScan: replace the three blocks with `const g = evaluateDrawdownGuard(closedTrades, guardState[mode], {...GUARD, now})`; persist `guardState[mode]` to `bot_settings` (`guard_state_paper|live`, JSON) on every transition so a restart does not forget a halt or a re-base; log every transition to the scan log with cumR/peakR/ddR. Remove the daily guard (calendar boundary; server-local midnight vs the harness's UTC), the rolling guard, the kill-switch and `KILL_SWITCH_*`, `ROLLING_*`, `DAILY_*`. Status endpoints: `guards: { halted, haltedSince, expiresAt, cumR, peakR, ddR, haltR, resumeR, strategies: { [id]: same } }` (drop `rolling.endsAt` estimates). Overrides: replace `POST/DELETE /api/guards/override` and the two `dd_override_*` keys per mode with ONE `POST /api/guards/rebase { mode }` that applies the `expire` transition immediately (re-base to current cum) — same semantics as the automatic expiry, one code path, logged.
**Harness**: `script/validate-pipeline.ts` simulate() — replace `ddDaily/ddMonthly/ddRolling/killSwitch` gates (L419–433, L469–475) with one `ddGuard` gate calling `evaluateDrawdownGuard` with a per-run state object (+ per-strategy states); same in `script/audit/lib.ts` `simulateEngineCurrent`. Report time-halted % and episode count per run (code in phase9-design.ts `onGuard`).
**Backtest**: yes — not for P&L (guards cannot create edge) but to calibrate X and verify time-halted ≤ 5% / entries blocked ≤ 10% on the final mix, ALL + 2026, honest entry, +15 bps arm.

### D.2 SCAN-1 — scans aligned to the candle close (fix · priority 2 · no backtest · risk low)
**Now**: `startPaperEngine` L2851–2861 and `startLiveEngine` L3931–3940 use `setInterval(scan, 3 min)` free-running; each scan iterates every interval's strategies; entry latency is a uniform 0–3 min draw (94% of real paper entries landed within 3 min, 6% at 10–60 min after restarts/un-halts — now rejected by the 10-min freshness gate). `/api/engine/config` advertises `scanEveryMinutes: 3`.
**New**: `server/scan-scheduler.ts` (pure helper, tested): `nextCloseMs(interval, nowMs)` (1h → next hh:00 UTC; 4h → next 00/04/08/12/16/20:00 UTC; 1d → next 00:00 UTC; use `intervalToMs`) and `scheduleAtCloses(intervals: string[], offsetMs = 30_000, run: (dueIntervals: string[]) => Promise<void>)` — a `setTimeout` chain (never `setInterval`) that fires at close + offset with the set of intervals whose close just passed, coalesces 1h/4h/1d that coincide, and never overlaps runs (in-flight flag; a late run is skipped, not queued). `paperScan(intervals)` / `liveScan(intervals)` take the due set and only build `byInterval` for those. Candle-lag retry: if the feed's last CLOSED candle is still the previous one (`candles.at(-1).time + ivMs < closeMs`), retry that symbol at +30 s, max 3 (MEXC can lag a few seconds after the close). Boot: run one immediate full scan (the freshness gate rejects anything > 10 min old). Check loops stay at 30 s. `/api/engine/config.scan = { alignedToClose: true, offsetSeconds: 30, intervals: [...] }`. The freshness gate stays as the safety net; with aligned scans `MAX_SIGNAL_AGE_MIN` can drop to 5.
**Harness**: no change — the harness already decides at the close with zero latency; document that paper now fills ~30–60 s after the close (D.7 makes it fill at the venue's mark).

### D.3 STRAT-1 — registry-driven pause defaults materialised at boot (fix · priority 3 · no backtest · risk low)
**Now**: `routes.ts` L2098–2125: `DEFAULT_DISABLED_STRATEGIES = ["rsi-divergence"]` applies only when the settings row is absent, with a legacy single-list fallback (`disabled_strategies`) that resurrects a stale value; the Aug-14 install already had a row, so "paused by default" never happened (5 RSI trades, −2.4R). `server/strategy-settings.ts` (`defaultEnabledStrategyIds`) is unreferenced.
**New**: `server/strategies/types.ts`: `Strategy.defaultPaused?: { paper?: boolean; live?: boolean }` (registry is the single source of what runs by default; the lead sets RSI's value from the portfolio stage — honest RSI is positive on a small sample, so the Aug audit's rationale for pausing it is void). `routes.ts`: delete `LEGACY_DISABLED_STRATEGIES_KEY`, `DEFAULT_DISABLED_STRATEGIES`; `getDisabledStrategyIds(mode)` becomes parse-only — missing row → `[]` (nothing paused), malformed row → log error + `[]` (fail loud, never silently substitute a default). Add `materialiseStrategyDefaults()` called in the auto-start block (L4126–4141) BEFORE `startPaperEngine/startLiveEngine`: for each mode, if the row is absent write `JSON.stringify(registry.filter(s => s.defaultPaused?.[mode]).map(s => s.id))`; if present, prune ids that are no longer in the registry and keep the operator's choices (operator wins over registry); log both lists at boot. `/api/strategies` (L1806–1828) gains `defaultPaused` per mode so the UI can show "paused by default / by operator / by guard". Delete `server/strategy-settings.ts` if `grep -r defaultEnabledStrategyIds` confirms no caller.

### D.4 LIQ-1 — kill the dead $30M volume gate, gate on the executing venue (remove + convert · priority 4 · no backtest possible · risk medium)
**Now**: `MIN_VOLUME_USDT` L1983 checked at L2606–2618 (paper) / L3622–3632 (live) behind `!isPreferred` — every universe coin is preferred (`SCANNER_COINS` = union of preferredSymbols, L179–182), so the gate has never fired; the ICP paper trade of Aug 14 notes `vol24h=$5M`. `getVolumeMap/cachedVolumes` L1987–2001 has no caller (dead). Spread gate L2620–2627 / L3634–3641 uses MEXC's book; live executes on Kraken, where 36/40 coins trade < $30M/24h, 32/40 < $5M, and SAND (79 bps), IMX (66), VET (24), ARB (22), ETC (21) are outside the 20 bps cap right now.
**New**: delete `MIN_VOLUME_USDT`, both volume blocks, `getVolumeMap/cachedVolumes`, and the `minVolumeUsdt` field in `/api/engine/config`. Add to `ExchangeAdapter` (`server/exchange.ts` L98–115) `getLiquidity?(): Promise<Map<string, { spreadPct: number; vol24hUsd: number; openInterestUsd: number; impactUsd: number }>>`; `KrakenAdapter` implements it from `client.getTickers()` (extend `KrakenTicker` at `kraken-client.ts` L340–360 with `bid, ask, openInterest`; spread = (ask−bid)/last, vol24hUsd = vol24h×last, impactUsd = instrument.impactMidSize×last); `MexcAdapter` from `buildMexcContractTickerMaps`. liveScan: replace the MEXC spread gate with the venue gate — skip when `spreadPct > MAX_SPREAD_PCT` OR `impactUsd < 5 × posSize` (the order would move the mid); log the reason with the measured numbers. paperScan: paper is a Kraken simulation → apply the SAME gate from Kraken's public tickers (no keys needed, 5 s cache) so paper = live; keep MEXC for candles/prices only where D.7 does not replace it. Track blocks per coin in the scan log for 30 days; if a coin is blocked > 50% of its signals it is an operational blocklist candidate (existing `disabled_symbols`), not a parameter change.

### D.5 HARNESS-1 — feed + fill semantics parity in the validation harness (parity · priority 5 · n/a · risk low)
**Now**: `--feed=mexc` is already in the working tree (`script/audit/feed.ts`, `lib.ts` L10/L58–60, `validate-pipeline.ts` L38/L76–77/L146–147 — uncommitted, written in parallel; day-keyed `pl_mexc_*` cache). The harness enters at the close with no slippage arm and no fill re-gate; the engines now re-gate on the fill's R:R and stop distance and pay measured fees only on real fills; `checkMarginCapacity` exists in both engines but not in the official harness.
**New** (`script/validate-pipeline.ts`): commit the feed switch; add `--slip=<bps>` (default 0) applied in `resolveExits` (L285–305) as `entry = close × (1 ± slip)`, SL/TP structural, re-gate `riskH/entry ≥ MIN_SL_DISTANCE_PCT && rewardH/riskH ≥ MIN_RR` else count `unfilled` (port of `phase9-design.ts` `resolveExits`); report the ENGINE row at slip 0 and 15 by default; add `--leverage=<x>` margin gate (lib.ts already has `marginLeverage`); import all gate constants from the shared module (D.6) instead of the mirrored block L39–63; equal-count halves + bootstrap CI95 per row (helpers in `script/audit/lib.ts`); keep `MAX_BARS` in bars (200/60) from the shared module. Document the residual, unmodelable gap: candle-close → fill latency (30–60 s once D.2 lands) and venue spread (D.4 measures it live).

### D.6 CONST-1 — one module for every engine constant (simplify/parity · priority 6 · no backtest · risk low)
**Now**: gate constants live in `routes.ts` (L40–103, L1965–1984, L2006–2007), mirrored by hand in `script/validate-pipeline.ts` L39–63 and `script/audit/lib.ts` L16–39 (three copies of `COIN_GROUP` with dead entries MATIC/SHIB/OP and a one-coin "infra" group); `DEFAULT_STRATEGY = "confluence-swing"` (L175) is a retired id; `MAX_HOLD_HOURS_BY_INTERVAL` is in hours while the harness uses bars.
**New**: `server/engine-config.ts` exporting `COIN_GROUP` (pruned to the universe; VET → "L1" or dropped), `MAX_PER_GROUP=3`, `FIXED_MAX_OPEN=10`, `MIN_SL_DISTANCE_PCT`, `MIN_RISK_REWARD`, `MAX_SPREAD_PCT`, `FUNDING_LONG_MAX/SHORT_MIN`, `TP1_PARTIAL_CLOSE_PCT`, `MAX_HOLD_BARS = { "1h": 200, "4h": 60 }` (+ `maxHoldHours(interval)` derived), `GUARD` (D.1), `SCAN = { offsetMs: 30_000, maxSignalAgeMin }`, re-export `TRADE_COSTS`, `ENGINE_EXIT = { trailMode: "r_multiple", trailRMultiple: 2 }`. `routes.ts`, `validate-pipeline.ts`, `audit/lib.ts`, `phase8/9` import it; `/api/engine/config` serialises the module verbatim. Delete `DEFAULT_STRATEGY`. One vitest asserting the harness's imported values are identical objects makes drift impossible.

### D.7 FILL-1 — paper fills and both engines' marks come from the executing venue (parity · priority 7 · no backtest · risk low)
**Now**: paperScan fills at the MEXC ticker (L2770–2785); paperCheck/liveCheck mark and trigger TP1/trail/soft-stop on MEXC last (L2190, L3127) while Kraken fills and triggers on its mark; the audit measured MEXC vs Binance wick divergence — the same applies MEXC vs Kraken.
**New**: a `getPublicMarks(): Map<symbol, mark>` on the adapter (Kraken public `/tickers` markPrice, no auth); paper fill = Kraken mark at scan time (fallback MEXC), paperCheck and liveCheck mark at Kraken mark; journal note records the source. Keeps one price source between the two engines and the venue's own stop logic.

### D.8 RISKMULT-1 — remove the BTC daily-trend risk multiplier (remove · priority 8 · needs backtest · risk low)
**Now**: `routes.ts` L2460–2466 (paper) / L3523–3525 (live): risk × 1.25 when BTC daily EMA50 says up, × 0.75 when down; also the `riskMult` gate in the harness. Honest data: LONG·BTC-up is the worst cell in the book (T=143, exp −0.57R, PF 0.40, 8000-bar brief: −0.46R) and gets the ×1.25; the multiplier is also the origin of the guard R-unit mismatch.
**New**: `riskPctUsed = baseRiskPct`; keep `btcDailyTrend` for the UI/regime panel only; remove `riskMult` from the harness gates. Pre-registered hypothesis for the official A/B (ALL + 2026, honest entry, slip 0 and 15): "flat sizing does not lower exp and does not raise maxDD". Phase-9 POST-HOC on 20000×1h: sumR −58.6 vs −103.0, maxDD 175 vs 203 (D1 vs D0). Not adopted here.

### D.9 TP1-1 — venue-aware TP1 partial and minimum manageable size (fix · priority 9 · no backtest · risk low)
**Now**: liveCheck L3328 `closePartial(pos, 0.6)` throws when `roundSize(size×0.6)` is 0; the 40% runner can be dust; setProtection already floors (kraken-client L501). At $110/0.5% every coin survives today (table A) but BTC sits at the limit (lot 0.0004 → 0.0002/0.0002, −16% under-size).
**New**: pre-entry in liveScan (after sizing, L3737–3745): compute `lot = roundSize(posSize/price, prec)`, `tp1 = roundSize(lot×0.6, prec)`, `runner = roundSize(lot − tp1, prec)`; skip the entry with reason "position too small to manage (lot/tp1/runner)" if any is 0 or if the lot under-sizes risk by > 25%; log the lot error % in the journal note. In liveCheck: if `runner` would be 0, close 100% at TP1 (`closedFullPosition` path already exists) instead of leaving unprotectable dust. Paper mirrors the same check using Kraken instrument precision (public) so paper cannot take a trade live could not.

### D.10 GROUP/WEEKLY/MAXHOLD/COOLDOWN — keep, but stop citing stale numbers (ops · priority 10 · no backtest)
Correlation cap 3 (D2 neutral), weekly filter (D3: +8R over 2.3 y, not +45R), max-hold 200/60 bars (C3: 2.5%/10% of trades, +0.75R avg — turnover only), cooldowns (C4). No behaviour change; only move to `engine-config.ts` (D.6) and rewrite the comments in `routes.ts` L1977–1980, L2722–2728, L99–103 and `strategies/*.ts` that quote pre-Sep-2026 R figures as evidence.
