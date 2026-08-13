import { roundPriceForJournal } from "./trade-accounting";

export interface LiveTp1JournalUpdateInput {
  entryPrice: number;
  /**
   * Price the partial ACTUALLY filled at.
   *
   * Not the planned TP1 level: the engine detects the level from a ticker and
   * then sends a MARKET order, so the fill lands wherever the book is at that
   * moment. Booking the planned level instead records a price nobody traded at,
   * and since the partial is the larger share of the position it is the bigger
   * of the two places that error can hide.
   */
  fillPrice: number;
  closedFullPosition: boolean;
  closedVol: number;
  holdVol: number;
  remainingPositionSizeUsd: number;
  realizedPnlUsd: number;
  realizedPnlPct: number;
  exchangeProtectionUpdated: boolean;
  exchangeProtectionError?: string;
  /** Venue name for the note, e.g. "KRAKEN". */
  venue: string;
  /** How the fill price was obtained, for the audit trail. */
  priceNote?: string;
}

export function buildLiveTp1JournalUpdate(input: LiveTp1JournalUpdateInput) {
  const base = {
    tp1_hit: 1,
    remaining_position_size_usd: input.remainingPositionSizeUsd,
    realized_pnl_usd: input.realizedPnlUsd,
  };

  const head = `Live TP1 partial close ${input.closedVol}/${input.holdVol}`
    + (input.priceNote ? ` @ ${input.priceNote}` : "");

  const notesSuffix = input.closedFullPosition
    ? `${head} | full position closed`
    : input.exchangeProtectionUpdated
      ? `${head} | SL moved to break-even on ${input.venue}`
      : `${head} | WARNING: SL NOT moved to break-even on ${input.venue}${input.exchangeProtectionError ? ` (${input.exchangeProtectionError})` : ""}`;

  if (input.closedFullPosition) {
    return {
      ...base,
      outcome: input.realizedPnlUsd > 0 ? "win" : input.realizedPnlUsd < 0 ? "loss" : "breakeven",
      exit_price: roundPriceForJournal(input.fillPrice),
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
