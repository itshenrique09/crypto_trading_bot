export interface LiveJournalTrade {
  id: number;
  symbol: string;
  direction: "LONG" | "SHORT";
}

export interface LiveExchangePosition {
  symbol: string;
  positionType: 1 | 2;
  holdVol: number;
}

export function directionToPositionType(direction: "LONG" | "SHORT"): 1 | 2 {
  return direction === "LONG" ? 1 : 2;
}

function exchangeKey(symbol: string, positionType: 1 | 2): string {
  return `${symbol.toUpperCase()}:${positionType}`;
}

function journalKey(trade: LiveJournalTrade): string {
  return exchangeKey(`${trade.symbol.toUpperCase()}_USDT`, directionToPositionType(trade.direction));
}

export function planLiveReconciliation(
  journalTrades: LiveJournalTrade[],
  exchangePositions: LiveExchangePosition[],
) {
  const activePositions = exchangePositions.filter(p => p.holdVol > 0);
  const exchangeKeys = new Set(activePositions.map(p => exchangeKey(p.symbol, p.positionType)));
  const journalKeys = new Set(journalTrades.map(journalKey));

  return {
    missingExchangeTrades: journalTrades.filter(t => !exchangeKeys.has(journalKey(t))),
    unmanagedExchangePositions: activePositions.filter(p => !journalKeys.has(exchangeKey(p.symbol, p.positionType))),
  };
}
