// ─── KRAKEN /fills AUTH PROBE ────────────────────────────────────────────
// /fills returns authenticationError while /openpositions and /accounts work
// on the same key. The difference: /fills is the first GET the client sends
// WITH a query parameter, so the suspect is how that parameter is folded into
// the signature — Kraken signs SHA256(postData + nonce + path), and if its
// idea of `postData` differs from ours by so much as a percent-escape, the
// HMAC misses.
//
// This tries each candidate encoding against the live API and reports which
// the server accepts. Read-only: every call is a GET, no orders, no money.
//   npx tsx script/debug-kraken-fills.ts

import { computeAuthent } from "../server/kraken-client";
import { loadLiveCredentials, CredentialError } from "../server/live-credentials";

const BASE_URL = "https://futures.kraken.com/derivatives";
const API_PREFIX = "/api/v3";

async function attempt(label: string, endpoint: string, postData: string, key: string, secret: string): Promise<boolean> {
  // Space the calls out: the nonce is Date.now() and must stay unique. Do NOT
  // inflate its magnitude to force uniqueness — the running bot would then be
  // issuing smaller nonces than this probe did.
  await new Promise(r => setTimeout(r, 250));

  const path = `${API_PREFIX}${endpoint}`;
  const nonce = String(Date.now());
  const headers = { APIKey: key, Nonce: nonce, Authent: computeAuthent(postData, nonce, path, secret) };
  const url = `${BASE_URL}${path}${postData ? `?${postData}` : ""}`;

  let res: Response, text: string;
  try {
    res = await fetch(url, { headers });
    text = await res.text();
  } catch (e: any) {
    console.log(`❌ ${label}\n   network: ${e.message}\n`);
    return false;
  }

  let body: any = null;
  try { body = JSON.parse(text); } catch { /* keep raw */ }
  const ok = res.ok && body?.result === "success";

  console.log(`${ok ? "✅" : "❌"} ${label}`);
  console.log(`   query : ${postData || "(none)"}`);
  console.log(`   status: ${res.status} · ${body?.error ?? body?.result ?? text.slice(0, 120)}`);
  if (ok && Array.isArray(body?.fills)) {
    console.log(`   fills : ${body.fills.length}`);
    for (const f of body.fills.slice(0, 3)) {
      console.log(`           ${f.symbol} ${f.side} ${f.size} @ ${f.price}  ${f.fillTime}  (${f.fillType})`);
    }
  }
  console.log();
  return ok;
}

async function main() {
  // Credentials are stored encrypted — loadLiveCredentials is the only correct
  // way to read them. Reading them raw was what made the CONTROL call fail and
  // dressed a decryption mistake up as a Kraken permissions problem.
  const { apiKey: key, apiSecret: secret } = await loadLiveCredentials();

  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const encoded = new URLSearchParams({ lastFillTime: since }).toString();   // colons as %3A
  const raw = `lastFillTime=${since}`;                                       // colons literal

  console.log(`Probing Kraken /fills — lastFillTime = ${since}\n`);

  // Control: a GET with no params on the same key. If this fails the problem
  // is the credential itself, not the encoding.
  const control = await attempt("CONTROL  /openpositions (no params)", "/openpositions", "", key, secret);

  const noParams = await attempt("A  /fills with no params", "/fills", "", key, secret);
  const withEnc  = await attempt("B  /fills, percent-encoded param (what the client sends today)", "/fills", encoded, key, secret);
  const withRaw  = await attempt("C  /fills, unencoded param", "/fills", raw, key, secret);

  console.log("─".repeat(70));
  if (!noParams && !withEnc && !withRaw && !control) {
    console.log("VERDICT: even the control failed — the credentials are not reaching Kraken");
    console.log("intact. This is an auth-plumbing problem, not an endpoint problem.");
  } else if (noParams && !withEnc && !withRaw) {
    console.log("VERDICT: the endpoint is fine, the query parameter breaks the signature.");
    console.log("Fix: drop lastFillTime — the client already filters by symbol and time.");
  } else if (withRaw && !withEnc) {
    console.log("VERDICT: Kraken signs the UNENCODED query string. Fix the signature, keep the param.");
  } else if (noParams && (withEnc || withRaw)) {
    console.log("VERDICT: /fills authenticates fine either way — check the ROW COUNTS above.");
    console.log("If the parameterless call returned fills and the others returned zero, then");
    console.log("lastFillTime pages BACKWARDS (fills BEFORE that time), and must never be used");
    console.log("as a 'since' filter. Filter client-side instead.");
  } else {
    console.log("VERDICT: no variant worked. The key most likely lacks the permission that");
    console.log("covers fill history — check the key's General API access on Kraken.");
  }
}

main().catch(e => {
  console.error(e instanceof CredentialError ? `\n${e.message}\n` : e);
  process.exit(1);
});
