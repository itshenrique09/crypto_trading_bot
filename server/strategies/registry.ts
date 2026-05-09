import type { Strategy } from "./types";
import { v2SwingStrategy } from "./v2-swing";
import { smcStrategy } from "./smc";
import { breakRetestStrategy } from "./break-retest";
import { rsiDivergenceStrategy } from "./rsi-divergence";
import { liquiditySweepStrategy } from "./liquidity-sweep";
import { bollingerMeanReversionStrategy } from "./bollinger-mean-reversion";

// Old mean-reversion / breakout disabled — earlier backtests showed poor performance.
// Files kept for reference: ./mean-reversion.ts, ./breakout.ts
// New BB mean-reversion (bollinger-mr) is EXPERIMENTAL — paper-only until backtested.

const ALL_STRATEGIES: Strategy[] = [
  v2SwingStrategy,
  smcStrategy,
  breakRetestStrategy,
  rsiDivergenceStrategy,
  liquiditySweepStrategy,
  bollingerMeanReversionStrategy,
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
