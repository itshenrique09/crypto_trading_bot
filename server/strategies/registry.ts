import type { Strategy } from "./types";
import { v2SwingStrategy } from "./v2-swing";
import { meanReversionStrategy } from "./mean-reversion";
import { breakoutStrategy } from "./breakout";

const ALL_STRATEGIES: Strategy[] = [
  v2SwingStrategy,
  meanReversionStrategy,
  breakoutStrategy,
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
