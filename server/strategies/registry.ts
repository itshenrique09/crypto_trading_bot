import type { Strategy } from "./types";
import { v2SwingStrategy } from "./v2-swing";
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
//
// Active set = the four backtest-proven strategies.
const ALL_STRATEGIES: Strategy[] = [
  v2SwingStrategy,
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
