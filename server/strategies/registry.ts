import type { Strategy } from "./types";
import { breakRetestStrategy } from "./break-retest";
import { rsiDivergenceStrategy } from "./rsi-divergence";
import { liquiditySweepStrategy } from "./liquidity-sweep";

// Files kept for reference but NOT traded (no backtested edge):
//   ./mean-reversion.ts, ./breakout.ts — old, poor performance.
//   ./smc.ts — removed May 2026: marginal edge (PF 1.06, ~2R/yr over 3.7y) and
//     the BTC soft overlay made it net-negative. smcSignal()/api kept for analysis.
//   ./bollinger-mean-reversion.ts — removed May 2026: backtest harness on its own
//     target coins (BTC/ETH/SOL/BNB/DOGE, 1y) gave PF 0.91 / +2R over 32 trades —
//     no demonstrated edge. Was silently trading in paper without validation.
//   ./v2-swing.ts (confluence-swing) — removed Jul 2026: full-pipeline portfolio
//     harness (script/validate-pipeline.ts) showed PF 1.05-1.07 / exp +0.04R over
//     the full window in every configuration — fee fodder. Worse, it shares 9 of
//     its coins with Liquidity Sweep on the same 1h interval and the one-position-
//     per-symbol exposure guard let it displace higher-expectancy LS entries
//     (392 slots in the LEAN run). Its apparent 2026 strength is selection bias:
//     its preferred coins were re-picked on 2026 data on Jun 26.
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
