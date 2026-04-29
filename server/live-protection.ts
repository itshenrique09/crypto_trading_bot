export interface LiveTp1JournalUpdateInput {
  entryPrice: number;
  takeProfit1: number;
  closedFullPosition: boolean;
  closedVol: number;
  holdVol: number;
  remainingPositionSizeUsd: number;
  realizedPnlUsd: number;
  realizedPnlPct: number;
  exchangeProtectionUpdated: boolean;
  exchangeProtectionError?: string;
}

export function buildLiveTp1JournalUpdate(input: LiveTp1JournalUpdateInput) {
  const base = {
    tp1_hit: 1,
    remaining_position_size_usd: input.remainingPositionSizeUsd,
    realized_pnl_usd: input.realizedPnlUsd,
  };

  const notesSuffix = input.closedFullPosition
    ? `Live TP1 partial close ${input.closedVol}/${input.holdVol} contracts | full position closed`
    : input.exchangeProtectionUpdated
      ? `Live TP1 partial close ${input.closedVol}/${input.holdVol} contracts | SL moved to break-even on MEXC`
      : `Live TP1 partial close ${input.closedVol}/${input.holdVol} contracts | WARNING: SL NOT moved to break-even on MEXC${input.exchangeProtectionError ? ` (${input.exchangeProtectionError})` : ""}`;

  if (input.closedFullPosition) {
    return {
      ...base,
      outcome: input.realizedPnlUsd > 0 ? "win" : input.realizedPnlUsd < 0 ? "loss" : "breakeven",
      exit_price: Math.round(input.takeProfit1 * 10000) / 10000,
      pnl_pct: Math.round(input.realizedPnlPct * 100) / 100,
      pnl_usd: Math.round(input.realizedPnlUsd * 100) / 100,
      closed_at: new Date().toISOString(),
      notesSuffix,
    };
  }

  return {
    ...base,
    stop_loss: input.exchangeProtectionUpdated ? input.entryPrice : undefined,
    notesSuffix,
  };
}
