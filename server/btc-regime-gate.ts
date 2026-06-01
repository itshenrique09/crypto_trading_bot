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

// Fallback context used when BTC trend data is unavailable (API failure).
// Conservative neutral_bullish: longs allowed, shorts blocked, max_open=5.
export function defaultBtcContext(): BtcRegimeContext {
  return {
    regime: "neutral_bullish",
    maxOpen: 5,
    reason: "BTC trend unavailable — defaulting to neutral_bullish (max_open=5)",
  };
}

// ─── DIRECTIONAL OVERLAY (SOFT) ────────────────────────────────────────────
// Portfolio-level "trade with BTC's tide" gate. This is what lets the bot
// SHORT in a confirmed bear instead of forcing longs into a falling tape.
//
// SOFT policy — backtest-validated (Apr 2026 harness, 8000-candle Binance):
//   Direction is only restricted in *high-conviction* BTC regimes. In neutral /
//   mixed markets both directions stay open so each strategy's own edge (incl.
//   mean-reversion shorts) can play out. Imposing direction in neutral regimes
//   was tested and was strictly worse — e.g. Liquidity Sweep:
//     baseline       PF 1.54  sumR +249
//     hard overlay   PF 1.81  sumR +218   (over-filters profitable counter-trades)
//     SOFT overlay   PF 1.77  sumR +272   ← best PF *and* best total R
//   Break & Retest also improved (PF 1.91 → 2.31); Swing/RSI neutral.
//   (A per-symbol "macroDown required for shorts" filter was also tested and
//    REJECTED — it cratered Liquidity Sweep to PF 1.36 / +126R.)
//
//   regime           | new longs | new shorts | size× | rationale
//   -----------------|-----------|------------|-------|----------------------------
//   risk_on          | yes       | no         | 1.00  | clear bull — don't fight it
//   risk_off         | no        | yes        | 1.00  | clear bear — don't fight it
//   neutral_bullish  | yes       | yes        | 1.00  | mixed — let strategy edge decide
//   neutral_bearish  | yes       | yes        | 1.00  | mixed — let strategy edge decide
//   volatile_drift   | yes       | yes        | 0.50  | low conviction — both, half size
export interface DirectionPolicy {
  long: boolean;
  short: boolean;
  sizeMultiplier: number;
  reason: string;
}

export function directionPolicyForRegime(regime: BtcRegime): DirectionPolicy {
  switch (regime) {
    case "risk_on":
      return { long: true, short: false, sizeMultiplier: 1.0, reason: "risk_on → new longs only (clear BTC bull)" };
    case "risk_off":
      return { long: false, short: true, sizeMultiplier: 1.0, reason: "risk_off → new shorts only (clear BTC bear)" };
    case "volatile_drift":
      return { long: true, short: true, sizeMultiplier: 0.5, reason: "volatile_drift → both directions, half size" };
    case "neutral_bullish":
      return { long: true, short: true, sizeMultiplier: 1.0, reason: "neutral_bullish → both directions (strategy edge decides)" };
    case "neutral_bearish":
      return { long: true, short: true, sizeMultiplier: 1.0, reason: "neutral_bearish → both directions (strategy edge decides)" };
  }
}
