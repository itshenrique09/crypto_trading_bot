export interface LiveJournalTrade {
  id: number;
  symbol: string;
  direction: "LONG" | "SHORT";
}

/**
 * A venue-neutral open position.
 *
 * Was MEXC-shaped ({ symbol: "BTC_USDT", positionType: 1|2 }) until Aug 2026,
 * when Kraken was added — its tickers are PF_XBTUSD and its sides are
 * "long"/"short", so keying on MEXC's conventions silently failed to match.
 * Reconciliation now works in the bot's own vocabulary and each exchange
 * adapter translates on the way in.
 */
export interface LiveExchangePosition {
  botSymbol: string;
  direction: "LONG" | "SHORT";
  size: number;
}

export function directionToPositionType(direction: "LONG" | "SHORT"): 1 | 2 {
  return direction === "LONG" ? 1 : 2;
}

function positionKey(botSymbol: string, direction: "LONG" | "SHORT"): string {
  return `${botSymbol.toUpperCase()}:${direction}`;
}

export function planLiveReconciliation(
  journalTrades: LiveJournalTrade[],
  exchangePositions: LiveExchangePosition[],
) {
  const activePositions = exchangePositions.filter(p => p.size > 0);
  const exchangeKeys = new Set(activePositions.map(p => positionKey(p.botSymbol, p.direction)));
  const journalKeys = new Set(journalTrades.map(t => positionKey(t.symbol, t.direction)));

  return {
    missingExchangeTrades: journalTrades.filter(t => !exchangeKeys.has(positionKey(t.symbol, t.direction))),
    unmanagedExchangePositions: activePositions.filter(p => !journalKeys.has(positionKey(p.botSymbol, p.direction))),
  };
}
