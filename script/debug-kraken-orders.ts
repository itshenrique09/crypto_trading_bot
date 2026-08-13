// ─── KRAKEN OPEN ORDER PROBE ─────────────────────────────────────────────
// /api/live/status reports a take-profit but NO stop for every open position,
// and the live engine does not enforce stops in software — it relies entirely
// on a resting order at the venue. So either those stops are missing (real
// money running unprotected) or the code fails to recognise them.
//
// Guessing is not acceptable here, so this dumps what Kraken actually returns
// for /openorders — raw orderType strings included — and cross-checks every
// open position for a stop-like reduce-only order.
//
// Read-only: one authenticated GET, no orders placed, cancelled or modified.
//   APP_PASSWORD="..." npx tsx script/debug-kraken-orders.ts

import crypto from "crypto";
import { loadLiveCredentials, CredentialError } from "../server/live-credentials";
import { computeAuthent, toKrakenSymbol, fromKrakenSymbol } from "../server/kraken-client";
import { buildLiveAdapter } from "../server/live-credentials";

const BASE_URL = "https://futures.kraken.com/derivatives";
const API_PREFIX = "/api/v3";

async function rawGet(endpoint: string, key: string, secret: string): Promise<any> {
  const path = `${API_PREFIX}${endpoint}`;
  const nonce = String(Date.now());
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { APIKey: key, Nonce: nonce, Authent: computeAuthent("", nonce, path, secret) },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`malformed: ${text.slice(0, 200)}`); }
}

async function main() {
  const { apiKey, apiSecret } = await loadLiveCredentials();

  const data = await rawGet("/openorders", apiKey, apiSecret);
  if (data?.result === "error") throw new Error(`Kraken: ${data.error}`);
  const orders: any[] = data?.openOrders ?? [];

  console.log(`\n${orders.length} open order(s) on Kraken\n`);
  console.log("SYMBOL          orderType        side   size        stopPrice    limitPrice   reduceOnly");
  console.log("─".repeat(94));
  const types = new Set<string>();
  for (const o of orders) {
    const t = String(o.orderType ?? o.type ?? "?");
    types.add(t);
    console.log(
      `${String(o.symbol ?? "?").padEnd(15)} ${t.padEnd(16)} ${String(o.side ?? "?").padEnd(6)} ` +
      `${String(o.unfilledSize ?? o.size ?? "?").padEnd(11)} ${String(o.stopPrice ?? "—").padEnd(12)} ` +
      `${String(o.limitPrice ?? "—").padEnd(12)} ${o.reduceOnly}`,
    );
  }

  console.log(`\nDistinct orderType values seen: ${[...types].map(t => `"${t}"`).join(", ")}`);
  console.log(`The reader in exchange.ts matches /stp|take_profit/i — note that "stop" does NOT`);
  console.log(`contain "stp", so an order typed "stop" would be silently discarded.\n`);

  // The question that actually matters: is every open position covered?
  const client = await buildLiveAdapter();
  const positions = await client.getPositions();
  console.log("POSITION COVERAGE");
  console.log("─".repeat(94));
  let naked = 0;
  for (const p of positions) {
    const sym = toKrakenSymbol(p.botSymbol);
    const mine = orders.filter(o => String(o.symbol ?? "").toUpperCase() === sym && o.reduceOnly);
    // A stop is any reduce-only trigger order that is NOT the take-profit.
    const tp = mine.filter(o => /take[_ ]?profit/i.test(String(o.orderType ?? o.type ?? "")));
    const stops = mine.filter(o => !/take[_ ]?profit/i.test(String(o.orderType ?? o.type ?? "")));
    if (stops.length === 0) naked++;
    console.log(
      `${p.botSymbol.padEnd(8)} ${p.direction.padEnd(6)} entry ${String(p.entryPrice).padEnd(12)} ` +
      `stop: ${stops.length ? stops.map(s => s.stopPrice).join(",") : "*** NONE ***"}   ` +
      `tp: ${tp.length ? tp.map(s => s.stopPrice).join(",") : "none"}`,
    );
  }

  console.log("─".repeat(94));
  if (naked > 0) {
    console.log(`\n*** ${naked} of ${positions.length} position(s) have NO stop order at the venue. ***`);
    console.log(`The live engine does not enforce stops in software, so those are unprotected`);
    console.log(`if the bot stops running. Treat as urgent.\n`);
  } else {
    console.log(`\nAll ${positions.length} position(s) have a stop resting at the venue.`);
    console.log(`The missing "stop" in /api/live/status is then a READ bug, not a risk to funds.\n`);
  }
}

main().catch(e => {
  console.error(e instanceof CredentialError ? `\n${e.message}\n` : e);
  process.exit(1);
});
