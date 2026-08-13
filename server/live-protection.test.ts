import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveTp1JournalUpdate } from "./live-protection";

const BASE = {
  entryPrice: 100,
  fillPrice: 110,
  closedFullPosition: false,
  closedVol: 6,
  holdVol: 10,
  remainingPositionSizeUsd: 400,
  realizedPnlUsd: 60,
  realizedPnlPct: 6,
  exchangeProtectionUpdated: true,
  venue: "KRAKEN",
};

test("moves journal stop to break-even only after exchange protection update succeeds", () => {
  const update = buildLiveTp1JournalUpdate(BASE);

  assert.equal(update.tp1_hit, 1);
  assert.equal(update.stop_loss, 100);
  assert.equal(update.remaining_position_size_usd, 400);
  assert.match(update.notesSuffix, /SL moved to break-even on KRAKEN/);
});

test("keeps original journal stop untouched when exchange protection update fails", () => {
  const update = buildLiveTp1JournalUpdate({
    ...BASE,
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
    ...BASE,
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

test("exit_price is the venue fill, never the planned TP1 level", () => {
  // The partial goes out as a MARKET order after a ticker crosses TP1, so it
  // fills where the book is — booking the planned level records a price that
  // was never traded, in the flattering direction.
  const update = buildLiveTp1JournalUpdate({
    ...BASE,
    closedFullPosition: true,
    fillPrice: 109.62,          // what the venue actually gave
    remainingPositionSizeUsd: 0,
  });
  assert.equal(update.exit_price, 109.62);
});

test("the note names the venue that was actually traded on", () => {
  // This used to say MEXC unconditionally, including on Kraken orders.
  const update = buildLiveTp1JournalUpdate({ ...BASE, venue: "MEXC" });
  assert.match(update.notesSuffix, /break-even on MEXC/);
});

test("the note records how the fill price was obtained", () => {
  const measured = buildLiveTp1JournalUpdate({ ...BASE, priceNote: "fill 109.620 (1 exec, vs ticker -34.5bps)" });
  assert.match(measured.notesSuffix, /fill 109\.620/);

  const guessed = buildLiveTp1JournalUpdate({ ...BASE, priceNote: "ticker ESTIMATE — fill not visible in time" });
  assert.match(guessed.notesSuffix, /ticker ESTIMATE/);
});
