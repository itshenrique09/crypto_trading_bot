// ─── EXCHANGE UNIVERSE COVERAGE CHECK ────────────────────────────────────
// MEXC closed to Portuguese residents (no MiCA licence; PT missing from KYC
// country list, Aug 2026). Before writing a connector for any replacement
// venue, answer the cheap question first: how much of the validated universe
// actually EXISTS there as a perpetual?
//
// If a venue only lists half the coins, the edge measured in
// script/validate-pipeline.ts no longer applies — it would have to be
// re-validated on the surviving subset before any code gets written.
// (This is the same trap FIL exposed on MEXC: a coin the backtest counted
// but the engine could never trade.)
//
// Public endpoints only — no account, no keys, no money.
// Run: npx tsx script/check-exchange-universe.ts

import { getAllStrategies } from "../server/strategies/registry";

interface Venue {
  name: string;
  url: string;
  /** Extract the set of base assets that trade as PERPETUAL futures. */
  extract: (json: any) => Set<string>;
  note: string;
}

// Normalise venue-specific aliases back to the bot's symbol vocabulary.
// (e.g. Kraken quotes XBT for BTC; several venues prefix 1000x for cheap coins.)
function normalise(raw: string): string {
  let s = raw.toUpperCase();
  if (s === "XBT") return "BTC";
  s = s.replace(/^(1000000|10000|1000)/, ""); // 1000PEPE -> PEPE
  return s;
}

const VENUES: Venue[] = [
  {
    name: "Kraken Futures",
    url: "https://futures.kraken.com/derivatives/api/v3/instruments",
    note: "perpetuals are tradeable=true with symbol PF_<BASE>USD",
    extract: (json) => {
      const out = new Set<string>();
      for (const i of json?.instruments ?? []) {
        // PF_ = perpetual linear futures (PI_ = legacy inverse perp)
        const sym: string = i?.symbol ?? "";
        if (!i?.tradeable) continue;
        const m = /^(PF|PI)_(.+?)(USD|USDT)$/i.exec(sym);
        if (m) out.add(normalise(m[2]));
      }
      return out;
    },
  },
  {
    name: "OKX Swaps",
    url: "https://www.okx.com/api/v5/public/instruments?instType=SWAP",
    note: "SWAP instruments, live state, USDT-margined",
    extract: (json) => {
      const out = new Set<string>();
      for (const i of json?.data ?? []) {
        if (i?.state !== "live") continue;
        if (i?.settleCcy !== "USDT") continue; // linear only
        if (i?.ctType && i.ctType !== "linear") continue;
        if (i?.ctVal == null && !i?.instId) continue;
        const base: string = i?.ctValCcy || (i?.instId ?? "").split("-")[0];
        if (base) out.add(normalise(base));
      }
      return out;
    },
  },
];

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const strategies = getAllStrategies();
  const bySymbol = new Map<string, string[]>(); // symbol -> strategy ids
  for (const s of strategies) {
    for (const sym of s.preferredSymbols ?? []) {
      bySymbol.set(sym, [...(bySymbol.get(sym) ?? []), s.id]);
    }
  }
  const universe = [...bySymbol.keys()].sort();

  console.log(`# Exchange universe coverage — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Bot universe: ${universe.length} distinct symbols across ${strategies.length} strategies\n`);

  const results: { venue: string; have: Set<string>; err?: string }[] = [];
  for (const v of VENUES) {
    try {
      const json = await fetchJSON(v.url);
      const have = v.extract(json);
      results.push({ venue: v.name, have });
      console.log(`${v.name}: ${have.size} perpetual bases listed (${v.note})`);
    } catch (e: any) {
      results.push({ venue: v.name, have: new Set(), err: e?.message ?? String(e) });
      console.log(`${v.name}: FETCH FAILED — ${e?.message ?? e}`);
    }
  }
  console.log();

  // ── Per-symbol matrix ──
  const header = `${"SYMBOL".padEnd(9)}${"STRATEGIES".padEnd(34)}${results.map(r => r.venue.padEnd(18)).join("")}`;
  console.log(header);
  console.log("-".repeat(header.length));
  for (const sym of universe) {
    const strats = (bySymbol.get(sym) ?? []).map(s => s.replace("liquidity-sweep", "LS").replace("rsi-divergence", "RSI").replace("break-retest", "B&R")).join(",");
    const cells = results.map(r => (r.have.has(sym) ? "yes" : "—").padEnd(18)).join("");
    console.log(`${sym.padEnd(9)}${strats.padEnd(34)}${cells}`);
  }
  console.log();

  // ── Coverage summary, overall and per strategy ──
  for (const r of results) {
    if (r.err) { console.log(`${r.venue}: unavailable (${r.err})`); continue; }
    const covered = universe.filter(s => r.have.has(s));
    const missing = universe.filter(s => !r.have.has(s));
    console.log(`## ${r.venue}`);
    console.log(`   overall: ${covered.length}/${universe.length} (${Math.round(covered.length / universe.length * 100)}%)`);
    for (const s of strategies) {
      const syms = s.preferredSymbols ?? [];
      const ok = syms.filter(x => r.have.has(x));
      console.log(`   ${s.id.padEnd(18)} ${ok.length}/${syms.length}  missing: ${syms.filter(x => !r.have.has(x)).join(", ") || "none"}`);
    }
    console.log(`   → missing overall: ${missing.join(", ") || "none"}`);
    console.log();
  }

  console.log("NOTE: listing != tradeable by an EEA retail client. Venue-side eligibility");
  console.log("(MiFID II appropriateness test, leverage caps, regional product gating)");
  console.log("must be confirmed on the account itself before any connector work.");
}

main().catch(e => { console.error(e); process.exit(1); });
