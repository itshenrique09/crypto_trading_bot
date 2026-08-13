import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  toKrakenSymbol,
  fromKrakenSymbol,
  roundSize,
  roundPrice,
  sizeForNotional,
  openSide,
  closeSide,
  computeAuthent,
  selectPosition,
  KrakenClient,
  type KrakenPosition,
} from "./kraken-client";

// Valid base64 — computeAuthent decodes the secret before keying the HMAC.
const FAKE_SECRET = Buffer.from("not-a-real-secret").toString("base64");

/** Run `fn` with fetch stubbed, capturing the URLs requested. */
async function withStubbedFetch(body: unknown, fn: (urls: string[]) => Promise<void>): Promise<void> {
  const urls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any) => {
    urls.push(String(url));
    return { ok: true, status: 200, text: async () => JSON.stringify(body) } as any;
  }) as any;
  try { await fn(urls); } finally { globalThis.fetch = realFetch; }
}

const FILLS_RESPONSE = {
  result: "success",
  fills: [
    { fill_id: "sei",  symbol: "PF_SEIUSD", side: "buy",  size: 1853, price: 0.03968, fillTime: "2026-08-12T22:00:28.000Z", fillType: "taker" },
    { fill_id: "fet",  symbol: "PF_FETUSD", side: "buy",  size: 242,  price: 0.13491, fillTime: "2026-08-13T03:45:50.000Z", fillType: "taker" },
    { fill_id: "old",  symbol: "PF_ADAUSD", side: "sell", size: 10,   price: 1.0,     fillTime: "2026-07-01T00:00:00.000Z", fillType: "maker" },
    { fill_id: "junk", symbol: "PF_XBTUSD", side: "buy",  size: 0,    price: 0,       fillTime: "2026-08-12T10:00:00.000Z", fillType: "taker" },
  ],
};

test("getFills never sends lastFillTime — it pages BACKWARDS on Kraken", async () => {
  // The bug this guards: lastFillTime returns fills recorded BEFORE the given
  // time, so using it as a "since" filter returned zero rows on an account
  // with 24 fills. Every exit would have fallen back to a ticker estimate
  // while the feature looked like it worked.
  await withStubbedFetch(FILLS_RESPONSE, async urls => {
    await new KrakenClient("key", FAKE_SECRET).getFills(new Date("2026-08-01T00:00:00.000Z"));
    assert.equal(urls.length, 1);
    assert.ok(!urls[0].includes("lastFillTime"), `must not send lastFillTime — got ${urls[0]}`);
    assert.ok(urls[0].endsWith("/derivatives/api/v3/fills"), urls[0]);
  });
});

test("getFills applies `since` locally, drops empty fills, and sorts oldest first", async () => {
  await withStubbedFetch(FILLS_RESPONSE, async () => {
    const fills = await new KrakenClient("key", FAKE_SECRET).getFills(new Date("2026-08-01T00:00:00.000Z"));
    assert.deepEqual(fills.map(f => f.fillId), ["sei", "fet"]);   // July fill excluded, zero-size dropped
    assert.equal(fills[0].price, 0.03968);
    assert.equal(fills[1].symbol, "PF_FETUSD");
  });
});

test("getFills without `since` returns the whole recent window", async () => {
  await withStubbedFetch(FILLS_RESPONSE, async () => {
    const fills = await new KrakenClient("key", FAKE_SECRET).getFills();
    assert.deepEqual(fills.map(f => f.fillId), ["old", "sei", "fet"]);
  });
});

test("toKrakenSymbol builds PF_<BASE>USD and maps BTC to Kraken's XBT ticker", () => {
  assert.equal(toKrakenSymbol("SOL"), "PF_SOLUSD");
  assert.equal(toKrakenSymbol("BTC"), "PF_XBTUSD");
  assert.equal(toKrakenSymbol("pepe"), "PF_PEPEUSD");
});

test("fromKrakenSymbol round-trips, including the XBT alias", () => {
  assert.equal(fromKrakenSymbol("PF_SOLUSD"), "SOL");
  assert.equal(fromKrakenSymbol("PF_XBTUSD"), "BTC");
  for (const s of ["BTC", "SOL", "ADA", "PEPE"]) {
    assert.equal(fromKrakenSymbol(toKrakenSymbol(s)), s);
  }
});

test("roundSize rounds DOWN so rounding can never inflate risk", () => {
  assert.equal(roundSize(0.123456, 4), 0.1234);
  assert.equal(roundSize(1.9999, 2), 1.99);
  assert.equal(roundSize(7.7, 0), 7);
});

test("roundSize handles NEGATIVE precision (PF_PEPEUSD is −3 → nearest 1000)", () => {
  assert.equal(roundSize(12_345, -3), 12_000);
  assert.equal(roundSize(999, -3), 0);       // below one tradeable step
  assert.equal(roundSize(1_000_500, -3), 1_000_000);
});

test("roundSize rejects non-positive or non-finite sizes", () => {
  assert.equal(roundSize(0, 2), 0);
  assert.equal(roundSize(-5, 2), 0);
  assert.equal(roundSize(NaN, 2), 0);
});

test("roundPrice snaps to tick size without float dust", () => {
  assert.equal(roundPrice(64_101.8, 1), 64_102);
  assert.equal(roundPrice(1.23456, 0.01), 1.23);
  assert.equal(roundPrice(0.16512, 0.00001), 0.16512);
});

test("sizeForNotional converts USD notional to base units at instrument precision", () => {
  // $1000 of BTC at $50k = 0.02 BTC, precision 4
  assert.equal(sizeForNotional(1000, 50_000, 4), 0.02);
  // $100 of a $0.16 coin = 625 units, precision 0
  assert.equal(sizeForNotional(100, 0.16, 0), 625);
  // guards
  assert.equal(sizeForNotional(100, 0, 2), 0);
  assert.equal(sizeForNotional(0, 100, 2), 0);
});

test("open/close sides are inverse per direction", () => {
  assert.equal(openSide("LONG"), "buy");
  assert.equal(openSide("SHORT"), "sell");
  assert.equal(closeSide("LONG"), "sell");
  assert.equal(closeSide("SHORT"), "buy");
});

test("computeAuthent follows sha256 → hmac-sha512(base64-decoded secret) → base64", () => {
  const secret = Buffer.from("super-secret-key").toString("base64");
  const postData = "orderType=mkt&symbol=PF_XBTUSD";
  const nonce = "1700000000000";
  const path = "/api/v3/sendorder";

  const expected = crypto
    .createHmac("sha512", Buffer.from(secret, "base64"))
    .update(crypto.createHash("sha256").update(postData + nonce + path).digest())
    .digest("base64");

  assert.equal(computeAuthent(postData, nonce, path, secret), expected);
});

test("computeAuthent is sensitive to every input (no silent mismatch)", () => {
  const secret = Buffer.from("k").toString("base64");
  const base = computeAuthent("a=1", "1", "/api/v3/x", secret);
  assert.notEqual(base, computeAuthent("a=2", "1", "/api/v3/x", secret));
  assert.notEqual(base, computeAuthent("a=1", "2", "/api/v3/x", secret));
  assert.notEqual(base, computeAuthent("a=1", "1", "/api/v3/y", secret));
  assert.notEqual(base, computeAuthent("a=1", "1", "/api/v3/x", Buffer.from("j").toString("base64")));
});

const positions: KrakenPosition[] = [
  { symbol: "PF_XBTUSD", side: "short", size: 0.01, price: 64_000, unrealizedPnl: 5 },
  { symbol: "PF_SOLUSD", side: "long", size: 12, price: 74, unrealizedPnl: -2 },
  { symbol: "PF_ADAUSD", side: "long", size: 0, price: 0.16, unrealizedPnl: 0 },
];

test("selectPosition matches by bot symbol, honouring the XBT alias", () => {
  assert.equal(selectPosition(positions, "BTC")?.symbol, "PF_XBTUSD");
  assert.equal(selectPosition(positions, "SOL")?.side, "long");
  assert.equal(selectPosition(positions, "DOGE"), null);
});

test("selectPosition can filter by direction and ignores zero-size rows", () => {
  assert.equal(selectPosition(positions, "BTC", "SHORT")?.size, 0.01);
  assert.equal(selectPosition(positions, "BTC", "LONG"), null);
  assert.equal(selectPosition(positions, "ADA"), null); // size 0 = not a position
});
