// ─── BTC REGIME GATE ─────────────────────────────────────────────────────
// Caps concurrent open positions based on BTC's weekly + daily trend.
//
// Why:
//   The strategy suite trades altcoins. Altcoin/BTC correlation typically
//   sits above 0.8 in stress periods — when BTC bleeds, all altcoin longs
//   bleed together. The existing BTC macro filter only adjusts *per-trade*
//   risk (riskMultiplier 0.75x↔1.25x); it does not reduce *aggregate*
//   exposure. With a fixed cap of 6 concurrent trades, a confirmed BTC
//   bear leaves the bot fully loaded long going into the worst scenario.
//
// Decision matrix (single source of truth):
//
//   weekly | daily | regime           | maxOpen
//   -------|-------|------------------|--------
//   up     | up    | risk_on          | 6
//   up     | down  | neutral_bearish  | 4   (weekly intact, daily warning)
//   up     | neut  | neutral_bullish  | 5
//   neut   | up    | neutral_bullish  | 5
//   neut   | neut  | neutral_bullish  | 5
//   neut   | down  | neutral_bearish  | 4
//   down   | up    | volatile_drift   | 3   (mixed signals, low conviction)
//   down   | neut  | neutral_bearish  | 4
//   down   | down  | risk_off         | 2   (clear bear — minimal exposure)
//
// Notes:
//   • Reducing maxOpen is preventive, not corrective: existing positions
//     are not force-closed. Strategies' internal direction filters
//     (Confluence Swing's symmetric macro, SMC's structure-aware shorts)
//     continue to work — the gate only limits how many trades can be open
//     simultaneously.
//   • Off by default. Settings flag: `btc_regime_gate_enabled`.

export type BtcTrend = "up" | "down" | "neutral";

export type BtcRegime =
  | "risk_on"          // weekly up + daily up
  | "neutral_bullish"  // weekly up/neutral, daily up/neutral
  | "neutral_bearish"  // weekly up/neutral with daily down OR weekly down with daily neutral
  | "volatile_drift"   // weekly down + daily up (counter-trend bounce — low conviction)
  | "risk_off";        // weekly down + daily down

export interface BtcTrendInput {
  daily: BtcTrend;
  weekly: BtcTrend;
}

export interface BtcRegimeContext {
  regime: BtcRegime;
  maxOpen: number;
  reason: string;
}

const FALLBACK_MAX_OPEN = 6;

export function classifyBtcRegime(input: BtcTrendInput): BtcRegimeContext {
  const { daily, weekly } = input;

  if (weekly === "down" && daily === "down") {
    return {
      regime: "risk_off",
      maxOpen: 2,
      reason: `BTC weekly down + daily down → risk_off (max_open=2)`,
    };
  }

  if (weekly === "down" && daily === "up") {
    // Counter-trend daily rally inside a weekly downtrend — likely a bull-trap.
    // Worth some exposure (in case it's the early reversal) but treat as low conviction.
    return {
      regime: "volatile_drift",
      maxOpen: 3,
      reason: `BTC weekly down + daily up → volatile_drift (max_open=3, possible bull-trap)`,
    };
  }

  if (weekly === "up" && daily === "up") {
    return {
      regime: "risk_on",
      maxOpen: 6,
      reason: `BTC weekly up + daily up → risk_on (max_open=6)`,
    };
  }

  // Weekly down + daily neutral, OR weekly neutral/up + daily down
  if (daily === "down" || (weekly === "down" && daily === "neutral")) {
    return {
      regime: "neutral_bearish",
      maxOpen: 4,
      reason: `BTC weekly ${weekly} + daily ${daily} → neutral_bearish (max_open=4)`,
    };
  }

  // Everything else: weekly up/neutral + daily up/neutral
  return {
    regime: "neutral_bullish",
    maxOpen: 5,
    reason: `BTC weekly ${weekly} + daily ${daily} → neutral_bullish (max_open=5)`,
  };
}

// Default context used when the gate is disabled or input is unavailable.
// Preserves the original `maxOpen=6` behaviour so toggling the gate off
// returns the engine to its prior limits exactly.
export function defaultBtcContext(): BtcRegimeContext {
  return {
    regime: "neutral_bullish",
    maxOpen: FALLBACK_MAX_OPEN,
    reason: "BTC regime gate disabled — default max_open=6",
  };
}
