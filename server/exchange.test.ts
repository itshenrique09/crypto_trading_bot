import test from "node:test";
import assert from "node:assert/strict";
import { MexcAdapter, KrakenAdapter, venueSymbol, isExchangeId, buildAdapter } from "./exchange";
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
    getOpenOrders: async () => ([
      { orderId: "o1", symbol: "PF_XBTUSD", side: "buy", orderType: "stp", size: 0.0031, stopPrice: 65_000, reduceOnly: true },
      { orderId: "o2", symbol: "PF_XBTUSD", side: "buy", orderType: "take_profit", size: 0.0031, stopPrice: 62_000, reduceOnly: true },
      { orderId: "o3", symbol: "PF_SOLUSD", side: "buy", orderType: "lmt", size: 1, reduceOnly: false },
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

test("getProtection reports only resting reduce-only stop/TP orders", async () => {
  const prot = await new KrakenAdapter(fakeKraken()).getProtection();
  assert.deepEqual(prot, [
    { botSymbol: "BTC", kind: "stop", price: 65_000, size: 0.0031 },
    { botSymbol: "BTC", kind: "take_profit", price: 62_000, size: 0.0031 },
  ]);
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

test("isExchangeId gates unknown venue ids and buildAdapter honours the choice", () => {
  assert.ok(isExchangeId("kraken"));
  assert.ok(isExchangeId("mexc"));
  assert.ok(!isExchangeId("binance"));
  assert.equal(buildAdapter("kraken", "k", "s").id, "kraken");
  assert.equal(buildAdapter("mexc", "k", "s").id, "mexc");
});
