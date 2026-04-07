import type { Strategy } from "./types";
import { v2SwingStrategy } from "./v2-swing";
import { smcStrategy } from "./smc";
import { breakRetestStrategy } from "./break-retest";

// Mean-reversion and breakout disabled — backtests showed poor performance.
// Files kept for reference: ./mean-reversion.ts, ./breakout.ts

const ALL_STRATEGIES: Strategy[] = [
  v2SwingStrategy,
  smcStrategy,
  breakRetestStrategy,
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
