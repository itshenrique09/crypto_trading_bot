// One-off: verify all LS-universe symbols have an active MEXC futures contract.
import { liquiditySweepStrategy } from "../server/strategies/liquidity-sweep";
import { breakRetestStrategy } from "../server/strategies/break-retest";
import { rsiDivergenceStrategy } from "../server/strategies/rsi-divergence";

async function main() {
  const res = await fetch("https://contract.mexc.com/api/v1/contract/detail");
  const data: any = await res.json();
  const contracts = new Set<string>((data?.data ?? []).map((c: any) => c.symbol));
  console.log(`MEXC futures contracts: ${contracts.size}`);

  for (const strat of [liquiditySweepStrategy, rsiDivergenceStrategy, breakRetestStrategy]) {
    const missing: string[] = [];
    for (const sym of strat.preferredSymbols ?? []) {
      if (!contracts.has(`${sym}_USDT`)) missing.push(sym);
    }
    console.log(`${strat.id}: ${(strat.preferredSymbols ?? []).length} coins, missing on MEXC: ${missing.length ? missing.join(", ") : "none"}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
