import type { Strategy } from "./types";
import { liquiditySweepStrategy } from "./liquidity-sweep";
import { tsmomStrategy } from "./tsmom";

// Retired strategies (source files kept where noted — recover via git history;
// full retirement rationale and thresholds live in STRATEGIES.md):
//   mean-reversion, breakout — old, poor performance.
//   smc — retired May 2026: marginal edge (PF 1.06, ~2R/yr over 3.7y) and the
//     BTC soft overlay made it net-negative. smcSignal() in analysis.ts still
//     powers the /api/backtest-smc research endpoint.
//   bollinger-mean-reversion — retired May 2026: PF 0.91 / +2R over 32 trades
//     on its own target coins — no demonstrated edge.
//   v2-swing (confluence-swing) — retired Jul 2026: full-pipeline harness showed
//     PF 1.05-1.07 / exp +0.04R in every configuration — fee fodder that also
//     displaced higher-expectancy Liquidity Sweep entries via the one-position-
//     per-symbol guard. Its apparent 2026 strength was selection bias.
//   break-retest (4h, 6 coins) — RETIRED 2026-09-03 (phase 9, selection-bias
//     rule): +0.37R on its hand-picked 6 coins but −0.02R (PF 0.98) on the
//     full 40-coin universe with identical parameters and −0.12R on the 34
//     non-preferred coins; 27 trades/yr; top-5 trades = 52% of its profit.
//     The 6-coin figure is a top-6-of-40 pick of a zero-mean strategy. File
//     kept (break-retest.ts) for research.
//   rsi-divergence (1h, ATOM/INJ) — RETIRED 2026-09-03 (phase 9, selection-
//     bias rule): +0.03R on ATOM/INJ over 2.25y (the +0.48R quoted in Aug 2026
//     was the last 11 months only), −0.13R with CI95 entirely below zero on
//     the full universe, negative under +15 bps slippage on every list. File
//     kept (rsi-divergence.ts) for research.
//
// Active set (2026-09-03, phase 9 — honest harness, entry = signal candle
// close, 2.3y of 1h data / 3.9y of daily data, engine gates, real fees):
//   • Liquidity Sweep, SHORT-only while BTC daily trend is UP (regimeGate):
//     T=559 exp +0.26R PF 1.37 CI95 [+0.11, +0.42], 248 trades/yr.
//   • Trend Breakout 1D (TSMOM): T=403 exp +0.18R PF 1.32 CI95 [+0.05, +0.32].
//   Together (E4 in script/audit/phase9-report-portfolio.md): T=351 exp
//   +0.28R PF 1.46 CI95 [+0.11, +0.45], both halves positive, 29/40 coins
//   positive, +0.24R under +15 bps slippage, maxDD 24R (trio guards) /
//   16.9R (drawdown guard X=12). Verdict of record: literal ACCEPT, treated
//   as PAPER-FIRST because the margins are thin and the regime pattern was
//   formed on recent data. Live stays paused (defaultPaused.live) until the
//   standing gate is met: ≥ +0.3R over ≥ 120 honest paper trades.
//
// 2026-09-23 (Fase 10, real fills): the Liquidity Sweep cell above did NOT
//   survive contact with the venue — LIVE −0.23R over 53 trades, PAPER −0.51R
//   over 20, engine feed in the harness −0.12R over 108; only Binance spot said
//   +0.26R. It is PAUSED in both modes by policy (defaultPaused, rev 2) and
//   stays in the registry for research and the Settings toggle. The paper book
//   is TSMOM alone from here; TSMOM stays paused on live until the gate is met.
//   Pause defaults are applied per strategy and per revision at boot
//   (server/engine-lifecycle.ts) — the previous "only when no list exists"
//   rule let both strategies trade live from the first scan after the deploy.
const ALL_STRATEGIES: Strategy[] = [
  liquiditySweepStrategy,
  tsmomStrategy,
];

export function getAllStrategies(): Strategy[] {
  return ALL_STRATEGIES;
}

export function getStrategy(id: string): Strategy | undefined {
  return ALL_STRATEGIES.find(s => s.id === id);
}

export function getStrategyIds(): string[] {
  return ALL_STRATEGIES.map(s => s.id);
}
