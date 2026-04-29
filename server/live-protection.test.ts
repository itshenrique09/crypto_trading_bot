import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveTp1JournalUpdate } from "./live-protection";

test("moves journal stop to break-even only after exchange protection update succeeds", () => {
  const update = buildLiveTp1JournalUpdate({
    entryPrice: 100,
    takeProfit1: 110,
    closedFullPosition: false,
    closedVol: 6,
    holdVol: 10,
    remainingPositionSizeUsd: 400,
    realizedPnlUsd: 60,
    realizedPnlPct: 6,
    exchangeProtectionUpdated: true,
  });

  assert.equal(update.tp1_hit, 1);
  assert.equal(update.stop_loss, 100);
  assert.equal(update.remaining_position_size_usd, 400);
  assert.match(update.notesSuffix, /SL moved to break-even on MEXC/);
});

test("keeps original journal stop untouched when exchange protection update fails", () => {
  const update = buildLiveTp1JournalUpdate({
    entryPrice: 100,
    takeProfit1: 110,
    closedFullPosition: false,
    closedVol: 6,
    holdVol: 10,
    remainingPositionSizeUsd: 400,
    realizedPnlUsd: 60,
    realizedPnlPct: 6,
    exchangeProtectionUpdated: false,
    exchangeProtectionError: "No active stop order",
  });

  assert.equal(update.tp1_hit, 1);
  assert.equal(update.stop_loss, undefined);
  assert.match(update.notesSuffix, /SL NOT moved/);
  assert.match(update.notesSuffix, /No active stop order/);
});

test("closes journal entry when TP1 partial consumes the whole exchange position", () => {
  const update = buildLiveTp1JournalUpdate({
    entryPrice: 100,
    takeProfit1: 110,
    closedFullPosition: true,
    closedVol: 1,
    holdVol: 1,
    remainingPositionSizeUsd: 0,
    realizedPnlUsd: 10,
    realizedPnlPct: 10,
    exchangeProtectionUpdated: false,
  });

  assert.equal(update.outcome, "win");
  assert.equal(update.exit_price, 110);
  assert.equal(update.pnl_usd, 10);
  assert.equal(update.remaining_position_size_usd, 0);
});
