/**
 * Live venue credentials — one way in, for the server and for scripts.
 *
 * API keys live ENCRYPTED in bot_settings, so `getSetting("kraken_api_secret")`
 * returns ciphertext, not a key. A caller that forgets to decrypt sends the
 * ciphertext to the venue and gets `authenticationError` — which reads like a
 * permissions problem and sends you hunting in the wrong place entirely.
 *
 * That happened, so the logic lives here instead of inside routes.ts where
 * scripts could not reach it.
 *
 * The encryption key derives from APP_PASSWORD. The server has it from pm2's
 * env; a script run by hand does NOT, and would decrypt to garbage. So
 * `loadLiveCredentials` fails loudly with the reason rather than passing junk
 * down to the API.
 */

import crypto from "crypto";
import { getSetting } from "./storage";
import { buildAdapter, isExchangeId, type ExchangeAdapter, type ExchangeId } from "./exchange";

export const DEFAULT_EXCHANGE: ExchangeId = "kraken";

const ENC_KEY = crypto.createHash("sha256")
  .update(process.env.APP_PASSWORD ?? "dev-key-not-secret")
  .digest();

export function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptValue(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) return ciphertext; // not encrypted (legacy plain value)
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, iv);
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}

/** Settings keys holding a venue's credentials. */
export function credentialKeys(exchange: ExchangeId) {
  return { key: `${exchange}_api_key`, secret: `${exchange}_api_secret` };
}

export async function getLiveExchangeId(): Promise<ExchangeId> {
  const stored = await getSetting("live_exchange");
  return isExchangeId(stored) ? stored : DEFAULT_EXCHANGE;
}

export class CredentialError extends Error {}

export async function loadLiveCredentials(): Promise<{ exchange: ExchangeId; apiKey: string; apiSecret: string }> {
  const exchange = await getLiveExchangeId();
  const names = credentialKeys(exchange);
  const storedKey = await getSetting(names.key);
  const storedSecret = await getSetting(names.secret);

  if (!storedKey || !storedSecret) {
    throw new CredentialError(`${exchange.toUpperCase()} API keys not configured. Add them in the bot's Live settings.`);
  }

  try {
    return { exchange, apiKey: decryptValue(storedKey), apiSecret: decryptValue(storedSecret) };
  } catch {
    // Wrong ENC_KEY: the stored values were encrypted under a different
    // APP_PASSWORD than this process has.
    throw new CredentialError(
      `Could not decrypt the ${exchange.toUpperCase()} credentials.\n` +
      `They are encrypted with APP_PASSWORD, which this process does not have.\n` +
      `Run the command with the same value the server uses, e.g.\n` +
      `  APP_PASSWORD="$(node -e "console.log(require('./ecosystem.config.cjs').apps[0].env.APP_PASSWORD)")" npx tsx script/<name>.ts`,
    );
  }
}

/** The adapter the live engine would use, built from stored credentials. */
export async function buildLiveAdapter(): Promise<ExchangeAdapter> {
  const { exchange, apiKey, apiSecret } = await loadLiveCredentials();
  return buildAdapter(exchange, apiKey, apiSecret);
}
