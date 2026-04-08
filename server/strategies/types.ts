import type { OHLCV } from "../analysis";

export interface StrategySignal {
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  confidence: number;
  confluenceScore: number;
  reason: string;
}

export interface Strategy {
  /** Unique slug, e.g. "v2-swing" */
  id: string;
  /** Display name for UI */
  name: string;
  /** Short description */
  description: string;
  /** Candle interval needed (e.g. "4h", "1d") */
  interval: string;
  /** Minimum candles required */
  minCandles: number;
  /**
   * Symbols that backtest well with this strategy.
   * Used by the scanner to only trade proven coin/strategy combos.
   */
  preferredSymbols?: string[];
  /**
   * Minimum hours to wait after a trade closes before re-entering the same
   * coin with this strategy. Matches the backtest COOLDOWN parameter.
   * Swing 1H: 5h (CD=5×1H). B&R/SMC 4H: 12h (CD=3×4H).
   */
  cooldownHours?: number;
  /** Analyze candles and return a signal or null */
  analyze(candles: OHLCV[]): StrategySignal | null;
}
