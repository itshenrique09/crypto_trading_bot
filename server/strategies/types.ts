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
  /** Analyze candles and return a signal or null */
  analyze(candles: OHLCV[]): StrategySignal | null;
}
