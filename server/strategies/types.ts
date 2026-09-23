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
  /**
   * Direction × BTC-daily-regime gate, applied identically by both engines and
   * the validation harness AFTER the signal fires. For each direction, the list
   * of BTC daily trends (EMA50 ±1% on closed daily candles) in which the entry
   * is allowed; an EMPTY list means the direction is never traded; undefined
   * means always allowed. Example (Liquidity Sweep, phase 9): LONG never,
   * SHORT only when BTC daily is "up".
   */
  regimeGate?: { long?: BtcDailyTrend[]; short?: BtcDailyTrend[] };
  /**
   * Whether the strategy starts paused in each mode. Applied to bot_settings at
   * boot ONCE per `pausePolicyRev` (server/engine-lifecycle.ts) — for a strategy
   * never seen by this install, or whenever the revision is bumped because the
   * registry re-decided. Between revisions the Settings UI toggles rule.
   */
  defaultPaused?: { paper?: boolean; live?: boolean };
  /** Bump when `defaultPaused` is re-decided so existing installs pick it up. Defaults to 1. */
  pausePolicyRev?: number;
  /**
   * Maximum concurrent open positions for THIS strategy (a slot sleeve inside
   * the portfolio cap). Multi-week strategies otherwise occupy every slot and
   * starve the intraday ones — the phase-6/9 TSMOM "cannibalisation". Applied
   * identically by both engines and the harness; undefined = only the global cap.
   */
  maxConcurrent?: number;
  /** Analyze candles and return a signal or null */
  analyze(candles: OHLCV[]): StrategySignal | null;
}

/** BTC daily trend classes shared by the regime gate and the engines. */
export type BtcDailyTrend = "up" | "neutral" | "down";

/** True when `direction` may be traded under `btcDaily` according to the strategy's regime gate. */
export function regimeAllows(strategy: Pick<Strategy, "regimeGate">, direction: "LONG" | "SHORT", btcDaily: BtcDailyTrend): boolean {
  const gate = strategy.regimeGate;
  if (!gate) return true;
  const allowed = direction === "LONG" ? gate.long : gate.short;
  if (allowed === undefined) return true;
  return allowed.includes(btcDaily);
}
