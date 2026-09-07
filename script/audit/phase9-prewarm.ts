// Pre-warm today's day-keyed candle cache for the phase-9 research agents, so
// that parallel researchers read finished files instead of racing on writes:
// 4h × 8000 (≈3.7y) and 1d × 1500 (≈4y) for every LS-universe coin.
// Run: npx tsx script/audit/phase9-prewarm.ts
import { liquiditySweepStrategy } from "../../server/strategies/liquidity-sweep";
import { fetchPaginated } from "./lib";

async function main() {
  const coins = liquiditySweepStrategy.preferredSymbols ?? [];
  for (const iv of [["4h", 8000], ["1d", 1500]] as Array<[string, number]>) {
    for (const sym of coins) {
      try {
        const c = await fetchPaginated(sym, iv[0], iv[1]);
        console.log(`${sym} ${iv[0]} ${c.length}`);
      } catch (e: any) { console.error(`fetch failed ${sym} ${iv[0]}: ${e?.message ?? e}`); }
    }
  }
  console.log("prewarm done");
}
main().catch(e => { console.error(e); process.exit(1); });
