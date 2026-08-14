export interface TradeAccountingState {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  positionSizeUsd?: number | null;
  remainingPositionSizeUsd?: number | null;
  realizedPnlUsd?: number | null;
}

export interface TradeCostConfig {
  takerFeePct?: number;
  slippagePct?: number;
}

/**
 * What a round trip is assumed to cost. Both engines and the backtests share
 * these numbers, so a trade must never be booked against a different set —
 * that is how paper and live silently stop being comparable.
 *
 * takerFeePct raised 0.02% → 0.05% on 2026-08-14 (audit P1.4): 0.05% is
 * Kraken Futures' real taker tier, and the venue we execute on. Measured
 * portfolio impact of the correction: −0.03R/trade (edge survives with room —
 * see script/audit/AUDIT-NOTES.md P1.4). Keep trade-exits.ts defaults in sync.
 *
 * NOTE: `slippagePct` is a MODEL. Measured live slippage belongs in the
 * journal via the venue's real fills (see exitPriceFromFills), not here —
 * script/audit/slippage-fill-vs-trigger.ts measures it once stops accumulate.
 */
export const TRADE_COSTS: Required<TradeCostConfig> = {
  takerFeePct: 0.0005,
  slippagePct: 0.0005,
};

/**
 * Round a price for storage without destroying sub-cent assets.
 *
 * Prices used to be stored as `Math.round(p * 10000) / 10000` — harmless for
 * BTC, catastrophic for PEPE, whose 0.0000027956 rounds to exactly 0. Nine rows
 * in the paper history carry `exit_price: 0`, and LUNC lands 98% off.
 *
 * The P&L on those rows is right, because it is computed from the true price
 * before this rounding — but the stored price is then unusable for auditing a
 * trade or measuring slippage. On the LIVE ENTRY path it is worse than
 * cosmetic: a zero entry price is divided by in every P&L calculation and is
 * what the trailing stop derives the original risk from.
 *
 * Significant digits, not decimal places.
 */
export function roundPriceForJournal(price: number): number {
  if (!Number.isFinite(price) || price === 0) return price;
  return Number(price.toPrecision(8));
}

export interface PartialCloseResult {
  closedSizeUsd: number;
  remainingPositionSizeUsd: number;
  realizedPnlUsd: number;
  realizedPnlPct: number;
  tradingCostUsd: number;
}

export interface FinalTradeAccountingResult {
  pnlUsd: number | null;
  pnlPct: number;
  outcome: "win" | "loss" | "breakeven";
  tradingCostUsd: number;
}

export interface OpenTradePnlEstimate {
  unrealizedPnlUsd: number | null;
  totalOpenPnlUsd: number | null;
  totalOpenPnlPct: number;
}

function round(value: number, digits = 10): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function calcTradingCostUsd(sizeUsd: number, config: TradeCostConfig = {}): number {
  const costPct = Math.max(0, config.takerFeePct ?? 0) + Math.max(0, config.slippagePct ?? 0);
  return round(sizeUsd * costPct * 2);
}

export function pricePnlPct(direction: "LONG" | "SHORT", entryPrice: number, exitPrice: number): number {
  if (entryPrice <= 0) return 0;
  return direction === "LONG"
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;
}

export function getOriginalPositionSizeUsd(state: TradeAccountingState): number | null {
  return state.positionSizeUsd && state.positionSizeUsd > 0 ? state.positionSizeUsd : null;
}

export function getRemainingPositionSizeUsd(state: TradeAccountingState): number | null {
  const originalSize = getOriginalPositionSizeUsd(state);
  if (!originalSize) return null;
  if (state.remainingPositionSizeUsd != null && state.remainingPositionSizeUsd >= 0) {
    return state.remainingPositionSizeUsd;
  }
  return originalSize;
}

export function getRealizedPnlUsd(state: TradeAccountingState): number {
  return state.realizedPnlUsd ?? 0;
}

export function applyPartialClose(
  state: TradeAccountingState,
  exitPrice: number,
  closePct: number,
  config: TradeCostConfig = {},
): PartialCloseResult {
  const originalSize = getOriginalPositionSizeUsd(state);
  const remainingSize = getRemainingPositionSizeUsd(state);
  if (!originalSize || remainingSize == null) {
    return { closedSizeUsd: 0, remainingPositionSizeUsd: 0, realizedPnlUsd: 0, realizedPnlPct: 0, tradingCostUsd: 0 };
  }

  const closeShare = clamp(closePct, 0, 1);
  const closedSizeUsd = round(remainingSize * closeShare);
  const nextRemaining = round(remainingSize - closedSizeUsd);
  const closePnlUsd = closedSizeUsd * (pricePnlPct(state.direction, state.entryPrice, exitPrice) / 100);
  const tradingCostUsd = calcTradingCostUsd(closedSizeUsd, config);
  const realizedPnlUsd = round(getRealizedPnlUsd(state) + closePnlUsd - tradingCostUsd);

  return {
    closedSizeUsd,
    remainingPositionSizeUsd: nextRemaining,
    realizedPnlUsd,
    realizedPnlPct: round((realizedPnlUsd / originalSize) * 100),
    tradingCostUsd,
  };
}

export function finalizeTradeAccounting(
  state: TradeAccountingState,
  exitPrice: number,
  config: TradeCostConfig = {},
): FinalTradeAccountingResult {
  const priceReturnPct = pricePnlPct(state.direction, state.entryPrice, exitPrice);
  const originalSize = getOriginalPositionSizeUsd(state);
  const remainingSize = getRemainingPositionSizeUsd(state);

  if (!originalSize || remainingSize == null) {
    const roundedPct = round(priceReturnPct);
    return {
      pnlUsd: null,
      pnlPct: roundedPct,
      outcome: roundedPct > 0 ? "win" : roundedPct < 0 ? "loss" : "breakeven",
      tradingCostUsd: 0,
    };
  }

  const runnerPnlUsd = remainingSize * (priceReturnPct / 100);
  const tradingCostUsd = calcTradingCostUsd(remainingSize, config);
  const pnlUsd = round(getRealizedPnlUsd(state) + runnerPnlUsd - tradingCostUsd);
  const pnlPct = round((pnlUsd / originalSize) * 100);

  return {
    pnlUsd,
    pnlPct,
    outcome: pnlUsd > 0 ? "win" : pnlUsd < 0 ? "loss" : "breakeven",
    tradingCostUsd,
  };
}

export function estimateOpenTradePnl(
  state: TradeAccountingState,
  currentPrice: number,
): OpenTradePnlEstimate {
  const priceReturnPct = pricePnlPct(state.direction, state.entryPrice, currentPrice);
  const originalSize = getOriginalPositionSizeUsd(state);
  const remainingSize = getRemainingPositionSizeUsd(state);

  if (!originalSize || remainingSize == null) {
    return { unrealizedPnlUsd: null, totalOpenPnlUsd: null, totalOpenPnlPct: round(priceReturnPct) };
  }

  const unrealizedPnlUsd = round(remainingSize * (priceReturnPct / 100));
  const totalOpenPnlUsd = round(getRealizedPnlUsd(state) + unrealizedPnlUsd);

  return {
    unrealizedPnlUsd,
    totalOpenPnlUsd,
    totalOpenPnlPct: round((totalOpenPnlUsd / originalSize) * 100),
  };
}
