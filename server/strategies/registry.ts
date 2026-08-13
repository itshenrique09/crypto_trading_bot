import type { Strategy } from "./types";
import { breakRetestStrategy } from "./break-retest";
import { rsiDivergenceStrategy } from "./rsi-divergence";
import { liquiditySweepStrategy } from "./liquidity-sweep";

// Retired strategies (source files deleted Aug 2026 — recover via git history;
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
//
// Active set = strategies with positive expectancy in the FULL-PIPELINE portfolio
// simulation (all engine gates, sequential capital), not just raw signal backtests.
const ALL_STRATEGIES: Strategy[] = [
  breakRetestStrategy,
  rsiDivergenceStrategy,
  liquiditySweepStrategy,
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
