// ─── Candle feed selection for the research/validation harnesses ────────────
// The engines decide on MEXC FUTURES candles; every harness so far validated on
// Binance SPOT. For a wick-driven strategy those are different signal streams
// (phase 8: only ~55% of LS trades coincide within ±2 bars). This module lets a
// harness fetch the SAME feed the engine trades, behind one switch:
//
//   --feed=mexc            (validate-pipeline.ts)
//   AUDIT_FEED=mexc        (anything that goes through lib.fetchPaginated)
//
// Default stays Binance so existing reports remain reproducible. Cache files are
// keyed by feed (pl_mexc_<SYM>_<iv>_<total>_<day>.json) and never mix.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { OHLCV } from "../../server/analysis";
import { dropOpenCandle } from "../../server/candles";
import { parseMexcKlineData, toMexcContractInterval, MEXC_CONTRACT_OVERRIDES } from "../../server/mexc-market";

export type Feed = "binance" | "mexc";

export function feedFromEnvOrArgv(argv: Record<string, string> = {}): Feed {
  const raw = (argv.feed ?? process.env.AUDIT_FEED ?? "binance").toLowerCase();
  if (raw !== "binance" && raw !== "mexc") throw new Error(`Unknown feed "${raw}" — use binance or mexc`);
  return raw;
}

const MEXC_CONTRACT_BASE = "https://contract.mexc.com";
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchJSON(url: string, retries = 3): Promise<any> {
  let lastErr: unknown;
  for (let a = 0; a <= retries; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 429 || r.status === 418) { await sleep(2000 * (a + 1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { lastErr = e; await sleep(500 * (a + 1)); }
  }
  throw lastErr;
}

function mexcContract(symbol: string): string {
  return MEXC_CONTRACT_OVERRIDES[symbol.toUpperCase()] ?? `${symbol.toUpperCase()}_USDT`;
}

/**
 * MEXC contract klines, newest→oldest pagination by `end` (seconds), 2000 per
 * page (the endpoint's page size), open candle dropped, oldest `total` kept.
 * Mirrors fetchMexcFuturesKlinesPaginated in server/routes.ts.
 */
export async function fetchMexcPaginated(symbol: string, interval: string, total: number, cacheDir: string, dayKey: string): Promise<OHLCV[]> {
  const cachePath = `${cacheDir}/pl_mexc_${symbol}_${interval}_${total}_${dayKey}.json`;
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, "utf-8")) as OHLCV[];
  const iv = toMexcContractInterval(interval);
  if (!iv) throw new Error(`MEXC has no interval for ${interval}`);
  const candles: OHLCV[] = [];
  let end: number | undefined;
  const maxPages = Math.ceil((total + 1) / 2000) + 2;
  for (let p = 0; p < maxPages && candles.length < total + 1; p++) {
    const qs = new URLSearchParams({ interval: iv });
    if (end) qs.set("end", String(end));
    const res = await fetchJSON(`${MEXC_CONTRACT_BASE}/api/v1/contract/kline/${mexcContract(symbol)}?${qs}`);
    if (res?.success === false || !res?.data) throw new Error(`MEXC kline error ${res?.code ?? ""}: ${res?.message ?? "missing data"}`);
    const batch = parseMexcKlineData(res.data);
    if (batch.length === 0) break;
    // pages can overlap by one candle at the boundary — dedupe by time
    const known = new Set(candles.map(c => c.time));
    candles.unshift(...batch.filter(c => !known.has(c.time)));
    if (batch.length < 2000) break;
    end = batch[0].time - 1;
    await sleep(150);
  }
  candles.sort((a, b) => a.time - b.time);
  const result = dropOpenCandle(candles, interval).slice(-total);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(result));
  return result;
}
