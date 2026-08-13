import test from "node:test";
import assert from "node:assert/strict";
import { MexcAdapter, KrakenAdapter, venueSymbol, isExchangeId, buildAdapter, exitPriceFromFills, type ExchangeFill } from "./exchange";
import type { MexcClient } from "./mexc-client";
import type { KrakenClient } from "./kraken-client";

// Minimal fakes — the adapters are thin, so what matters is that symbols,
// directions and sizes survive the translation intact.
function fakeMexc(overrides: Partial<Record<string, any>> = {}): MexcClient {
  return {
    getBalance: async () => ({ currency: "USDT", availableBalance: 80, frozenBalance: 0, equity: 100 }),
    getPositions: async () => ([
      { positionId: 7, symbol: "BTC_USDT", holdVol: 12, positionType: 1, openAvgPrice: 64000, closeAvgPrice: 0, realised: 0, unrealised: 3.5, leverage: 5, im: 10 },
      { positionId: 8, symbol: "SOL_USDT", holdVol: 0, positionType: 2, openAvgPrice: 74, closeAvgPrice: 0, realised: 0, unrealised: 0, leverage: 5, im: 1 },
    ]),
    ...overrides,
  } as unknown as MexcClient;
}

function fakeKraken(overrides: Partial<Record<string, any>> = {}): KrakenClient {
  return {
    getBalance: async () => ({ equity: 100, availableBalance: 80, currency: "USD", usedMargin: 5, unrealizedPnl: -0.8 }),
    getPositions: async () => ([
      { symbol: "PF_XBTUSD", side: "short", size: 0.0031, price: 64000, unrealizedPnl: -1.2, unrealizedFunding: 0.02 },
      { symbol: "PF_SOLUSD", side: "long", size: 2.7, price: 74, unrealizedPnl: 0.4, unrealizedFunding: null },
    ]),
    getTickers: async () => new Map([
      ["PF_XBTUSD", { symbol: "PF_XBTUSD", markPrice: 64_400, last: 64_390, fundingRate: 0.00001, fundingRatePrediction: null, vol24h: 1 }],
    ]),
    // orderType strings copied from a live account: Kraken echoes a stop back
    // as "stop" even though /sendorder was given "stp". Both appear here so a
    // reader that understands only one spelling fails this fixture.
    getOpenOrders: async () => ([
      { orderId: "o1", symbol: "PF_XBTUSD", side: "buy", orderType: "stop", size: 0.0031, stopPrice: 65_000, reduceOnly: true },
      { orderId: "o2", symbol: "PF_XBTUSD", side: "buy", orderType: "take_profit", size: 0.0031, stopPrice: 62_000, reduceOnly: true },
      { orderId: "o3", symbol: "PF_SOLUSD", side: "buy", orderType: "lmt", size: 1, reduceOnly: false },
      { orderId: "o4", symbol: "PF_SOLUSD", side: "sell", orderType: "stp", size: 2.7, stopPrice: 70, reduceOnly: true },
    ]),
    ...overrides,
  } as unknown as KrakenClient;
}

test("MexcAdapter maps contracts/positionType into venue-neutral positions", async () => {
  const positions = await new MexcAdapter(fakeMexc()).getPositions();
  assert.equal(positions.length, 1);            // zero-size row dropped
  assert.deepEqual(
    { s: positions[0].botSymbol, d: positions[0].direction, sz: positions[0].size },
    { s: "BTC", d: "LONG", sz: 12 },
  );
  // positionId must survive — MEXC needs it to set TP/SL
  assert.equal((positions[0].raw as any).positionId, 7);
});

test("KrakenAdapter maps PF_ symbols and long/short into the same shape", async () => {
  const positions = await new KrakenAdapter(fakeKraken()).getPositions();
  assert.deepEqual(positions.map(p => [p.botSymbol, p.direction, p.size]), [
    ["BTC", "SHORT", 0.0031],   // XBT alias resolved back to BTC
    ["SOL", "LONG", 2.7],
  ]);
});

test("both adapters report balance with the same field names", async () => {
  const mexc = await new MexcAdapter(fakeMexc()).getBalance();
  const kraken = await new KrakenAdapter(fakeKraken()).getBalance();
  assert.equal(mexc.equity, 100);
  assert.equal(mexc.available, 80);
  assert.equal(kraken.equity, 100);
  assert.equal(kraken.available, 80);
  // Kraken also surfaces margin detail for the dashboard.
  assert.equal(kraken.usedMargin, 5);
  assert.equal(kraken.unrealizedPnl, -0.8);
});

test("Kraken positions are marked against the venue's own mark price", async () => {
  const [btc, sol] = await new KrakenAdapter(fakeKraken()).getPositions();
  assert.equal(btc.markPrice, 64_400);                       // from the ticker feed
  assert.ok(Math.abs(btc.notionalUsd! - 0.0031 * 64_400) < 1e-6);
  assert.equal(btc.unrealizedFunding, 0.02);
  // No ticker for SOL → falls back to entry rather than reporting a bogus mark.
  assert.equal(sol.markPrice, 74);
});

test("getProtection reads BOTH of Kraken's stop spellings, and only reduce-only orders", async () => {
  // The bug this pins: reading with /stp|take_profit/ silently dropped every
  // order typed "stop", so the app showed 8 live positions with a take-profit
  // and NO stop loss. The stops were resting at the venue the whole time — the
  // safety display was blind, which is worse than useless on a live account.
  const prot = await new KrakenAdapter(fakeKraken()).getProtection();
  assert.deepEqual(prot, [
    { botSymbol: "BTC", kind: "stop", price: 65_000, size: 0.0031 },        // "stop"
    { botSymbol: "BTC", kind: "take_profit", price: 62_000, size: 0.0031 },
    { botSymbol: "SOL", kind: "stop", price: 70, size: 2.7 },               // "stp"
  ]);
  // the non-reduce-only limit order is not protection
  assert.ok(!prot.some(p => p.price === 1));
});

test("Kraken open converts USD notional to base units and refuses a zero-rounded size", async () => {
  const calls: any[] = [];
  const adapter = new KrakenAdapter(fakeKraken({
    sizeForNotional: async (_s: string, notional: number, price: number) => notional / price,
    openPosition: async (s: string, d: string, size: number) => { calls.push({ s, d, size }); return { orderId: "K1", size }; },
  }));
  const r = await adapter.openPosition("BTC", "SHORT", 200, 64_000, 7);
  assert.equal(r.orderId, "K1");
  assert.equal(calls[0].d, "SHORT");
  assert.ok(Math.abs(r.notionalUsd - 200) < 1e-6);

  const zero = new KrakenAdapter(fakeKraken({ sizeForNotional: async () => 0 }));
  await assert.rejects(() => zero.openPosition("PEPE", "LONG", 1, 0.0000028, 7), /rounds to zero/);
});

test("MEXC open refuses a zero-contract size rather than sending a bad order", async () => {
  const adapter = new MexcAdapter(fakeMexc({ calcContractVol: async () => 0 }));
  await assert.rejects(() => adapter.openPosition("BTC", "LONG", 5, 64_000, 5), /rounds to zero/);
});

test("closePartial forwards the venue's own size units", async () => {
  const seen: any = {};
  const adapter = new KrakenAdapter(fakeKraken({
    closePartialPosition: async (s: string, d: string, hold: number, pct: number) => {
      Object.assign(seen, { s, d, hold, pct });
      return { orderId: "K2", size: hold * pct };
    },
  }));
  const [pos] = await adapter.getPositions();
  const r = await adapter.closePartial(pos, 0.6);
  assert.deepEqual(seen, { s: "BTC", d: "SHORT", hold: 0.0031, pct: 0.6 });
  assert.ok(Math.abs(r.size - 0.00186) < 1e-9);
});

test("venueSymbol renders the right ticker per venue", () => {
  assert.equal(venueSymbol("mexc", "BTC"), "BTC_USDT");
  assert.equal(venueSymbol("kraken", "BTC"), "PF_XBTUSD");
  assert.equal(venueSymbol("mexc", "FIL"), "FILECOIN_USDT");  // MEXC alias preserved
});

// ── exitPriceFromFills ────────────────────────────────────────────────────
// The engine cannot see a stop or take-profit fire on the venue; it only finds
// the position gone. These fills are the sole record of what price it got, so
// getting this wrong means the journal reports profit the account never made.

const T0 = Date.parse("2026-08-12T18:00:00Z");
const HOUR = 3_600_000;

function fill(botSymbol: string, side: "buy" | "sell", size: number, price: number, atMs: number, fillType = "taker"): ExchangeFill {
  return { botSymbol, side, size, price, timeMs: atMs, fillType };
}

// A SHORT that took its TP1 partial and later closed the runner.
const SEI_WITH_PARTIAL: ExchangeFill[] = [
  fill("SEI", "sell", 1000, 0.0401, T0),               // entry
  fill("SEI", "buy",   600, 0.0394, T0 + 2 * HOUR),    // TP1 partial
  fill("SEI", "buy",   400, 0.0397, T0 + 5 * HOUR),    // runner
];

test("exitPriceFromFills prices the runner only, not the already-booked TP1 partial", () => {
  const r = exitPriceFromFills(SEI_WITH_PARTIAL, {
    botSymbol: "SEI", direction: "SHORT", openedAtMs: T0, remainingFraction: 0.4,
  });
  assert.ok(r);
  assert.equal(r.price, 0.0397);
  assert.equal(r.size, 400);
  assert.equal(r.fillCount, 1);
  assert.equal(r.incomplete, false);
});

test("exitPriceFromFills falls back to the LAST CLOSE EVENT, never to everything", () => {
  // A closed journal row has had remaining_position_size_usd zeroed, so the
  // caller cannot supply a fraction. The old fallback took every closing fill,
  // which averaged TP1's proceeds — already counted in realized_pnl_usd — back
  // into the exit and inflated the result by roughly the execution cost this
  // function exists to measure. The runner alone is the honest answer.
  const noFraction = exitPriceFromFills(SEI_WITH_PARTIAL, {
    botSymbol: "SEI", direction: "SHORT", openedAtMs: T0,
  });
  assert.ok(noFraction);
  assert.equal(noFraction.price, 0.0397);
  assert.equal(noFraction.size, 400);
  assert.ok(Math.abs(noFraction.fractionOfPosition! - 0.4) < 1e-12);

  // A zero fraction (what a closed row actually holds) must behave the same,
  // not silently degrade to "take everything".
  const zeroFraction = exitPriceFromFills(SEI_WITH_PARTIAL, {
    botSymbol: "SEI", direction: "SHORT", openedAtMs: T0, remainingFraction: 0,
  });
  assert.deepEqual(zeroFraction, noFraction);
});

test("exitPriceFromFills groups a close split across several fills seconds apart", () => {
  // One close, filled in three pieces against the book — all of it belongs to
  // the same exit, unlike a TP1 partial hours earlier.
  const r = exitPriceFromFills([
    fill("ONDO", "sell", 900, 0.3363, T0),
    fill("ONDO", "buy",  540, 0.3300, T0 + 3 * HOUR),          // TP1 partial
    fill("ONDO", "buy",  120, 0.3294, T0 + 5 * HOUR),          // runner, piece 1
    fill("ONDO", "buy",  240, 0.3292, T0 + 5 * HOUR + 4_000),  // runner, piece 2
  ], { botSymbol: "ONDO", direction: "SHORT", openedAtMs: T0 });
  assert.ok(r);
  assert.equal(r.size, 360);          // both runner pieces, not the TP1 partial
  assert.equal(r.fillCount, 2);
  assert.ok(Math.abs(r.price - (0.3292 * 240 + 0.3294 * 120) / 360) < 1e-12);
});

test("exitPriceFromFills volume-weights a close split across several fills", () => {
  const r = exitPriceFromFills([
    fill("ENA", "sell", 1000, 0.0886, T0),
    fill("ENA", "buy",   500, 0.0400, T0 + HOUR),
    fill("ENA", "buy",   500, 0.0396, T0 + 2 * HOUR),
  ], { botSymbol: "ENA", direction: "SHORT", openedAtMs: T0, remainingFraction: 1 });
  assert.ok(r);
  assert.ok(Math.abs(r.price - 0.0398) < 1e-12);
  assert.equal(r.fillCount, 2);
});

test("exitPriceFromFills handles LONG (entry buys, exit sells)", () => {
  const r = exitPriceFromFills([
    fill("SOL", "buy",  2.7, 76.00, T0),
    fill("SOL", "sell", 2.7, 76.30, T0 + HOUR),
  ], { botSymbol: "SOL", direction: "LONG", openedAtMs: T0, remainingFraction: 1 });
  assert.ok(r);
  assert.equal(r.price, 76.30);
  assert.equal(r.size, 2.7);
});

test("exitPriceFromFills ignores other symbols and an earlier trade on the same one", () => {
  const r = exitPriceFromFills([
    fill("SEI", "buy", 5000, 0.9999, T0 - 30 * 60_000),  // previous SEI trade, outside the grace window
    fill("RUNE", "buy", 999, 0.5000, T0 + HOUR),         // different symbol
    ...SEI_WITH_PARTIAL,
  ], { botSymbol: "SEI", direction: "SHORT", openedAtMs: T0, remainingFraction: 0.4 });
  assert.ok(r);
  assert.equal(r.price, 0.0397);
});

test("exitPriceFromFills returns null with no closing fill, so the caller falls back", () => {
  assert.equal(exitPriceFromFills([fill("SEI", "sell", 1000, 0.0401, T0)], {
    botSymbol: "SEI", direction: "SHORT", openedAtMs: T0,
  }), null);
  assert.equal(exitPriceFromFills([], { botSymbol: "SEI", direction: "SHORT", openedAtMs: T0 }), null);
});

test("exitPriceFromFills flags an incomplete match instead of silently under-reporting", () => {
  const r = exitPriceFromFills([
    fill("SEI", "sell", 1000, 0.0401, T0),
    fill("SEI", "buy",   300, 0.0397, T0 + HOUR),   // only part of the close is visible
  ], { botSymbol: "SEI", direction: "SHORT", openedAtMs: T0, remainingFraction: 1 });
  assert.ok(r);
  assert.equal(r.incomplete, true);
  assert.equal(r.size, 300);
});

test("exitPriceFromFills copes when the entry fill has aged out of the window", () => {
  const r = exitPriceFromFills([fill("SEI", "buy", 400, 0.0397, T0 + 5 * HOUR)], {
    botSymbol: "SEI", direction: "SHORT", openedAtMs: T0, remainingFraction: 0.4,
  });
  assert.ok(r);
  assert.equal(r.price, 0.0397);
  assert.equal(r.incomplete, false);   // nothing to be short OF without an entry size
});

test("exitPriceFromFills surfaces a liquidation", () => {
  const r = exitPriceFromFills([
    fill("SUI", "sell", 104, 0.6844, T0),
    fill("SUI", "buy",  104, 0.7500, T0 + HOUR, "liquidation"),
  ], { botSymbol: "SUI", direction: "SHORT", openedAtMs: T0, remainingFraction: 1 });
  assert.ok(r);
  assert.equal(r.liquidation, true);
});

test("KrakenAdapter.getFills maps PF_ tickers back to bot symbols", async () => {
  const adapter = new KrakenAdapter(fakeKraken({
    getFills: async () => ([
      { fillId: "f1", symbol: "PF_XBTUSD", side: "buy", size: 0.003, price: 64_000, timeMs: T0, fillType: "taker" },
      { fillId: "f2", symbol: "PF_SEIUSD", side: "sell", size: 1000, price: 0.0401, timeMs: T0, fillType: "maker" },
    ]),
  }));
  const fills = await adapter.getFills!();
  assert.deepEqual(fills.map(f => [f.botSymbol, f.side, f.price]), [
    ["BTC", "buy", 64_000],
    ["SEI", "sell", 0.0401],
  ]);
});

test("isExchangeId gates unknown venue ids and buildAdapter honours the choice", () => {
  assert.ok(isExchangeId("kraken"));
  assert.ok(isExchangeId("mexc"));
  assert.ok(!isExchangeId("binance"));
  assert.equal(buildAdapter("kraken", "k", "s").id, "kraken");
  assert.equal(buildAdapter("mexc", "k", "s").id, "mexc");
});
