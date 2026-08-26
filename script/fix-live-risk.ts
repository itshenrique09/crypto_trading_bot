// ─── FIX OPEN LIVE risk_usd — one-off repair (audit 2026-08-15) ─────────────
// Until today the live engine booked risk_usd from the PRE-ORDER plan while
// entry_price stored the real fill and the stop stayed at the signal's level —
// so R was divided by the wrong number (a −118bps fill booked a −1R stop-out
// as −2.39R). New entries book the real risk at open; this repairs rows that
// are still OPEN so their eventual close computes an honest R.
//
// Only touches: mode=live, outcome=open, tp1 not hit, stop != entry (a moved
// break-even stop would make the recomputation meaningless). Closed rows are
// history — left as booked.
//
// Dry-run by default; --apply requires the bot to be STOPPED (sql.js persist
// would silently revert external writes — same guard as reset-journal.ts).
//   pm2 stop all && npx tsx script/fix-live-risk.ts --apply && pm2 start all

import { getJournal, updateJournalEntry } from "../server/storage";

const APPLY = process.argv.includes("--apply");

async function assertServerStopped(): Promise<void> {
  const ports = Array.from(new Set([process.env.PORT || "5000", "5000", "5001"]));
  for (const port of ports) {
    const reachable = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    }).then(() => true).catch(() => false);
    if (reachable) {
      console.error(`\nRECUSADO: há um bot a responder em localhost:${port}. Para-o primeiro (pm2 stop all).\n`);
      process.exit(1);
    }
  }
}

async function main() {
  if (APPLY) await assertServerStopped();

  const rows = (await getJournal(10_000)).filter(e =>
    e.mode === "live" && e.outcome === "open" && (e.tp1_hit ?? 0) !== 1 &&
    e.entry_price > 0 && e.stop_loss > 0 && e.stop_loss !== e.entry_price &&
    (e.position_size_usd ?? 0) > 0 &&
    // Rows booked with the trim-as-partial-close scheme keep the PRE-trim
    // notional in position_size_usd — recomputing risk from it would inflate
    // risk_usd back to pre-trim levels. Their risk_usd is already honest.
    !/trim booked as partial close/.test(e.notes || ""),
  );

  console.log(`# Fix live risk_usd ${APPLY ? "(APPLY)" : "(dry-run)"} — ${rows.length} open live rows eligible`);
  let changed = 0;
  for (const t of rows) {
    const dist = Math.abs(t.entry_price - t.stop_loss) / t.entry_price;
    const realRisk = Math.round((t.position_size_usd ?? 0) * dist * 100) / 100;
    const booked = t.risk_usd ?? 0;
    const delta = booked > 0 ? realRisk / booked : NaN;
    const material = booked > 0 && Math.abs(realRisk - booked) / booked > 0.02;
    console.log(`  #${String(t.id).padEnd(5)} ${t.symbol.padEnd(7)} ${t.direction.padEnd(5)} risco booked=$${booked.toFixed(2)} real=$${realRisk.toFixed(2)} (${Number.isFinite(delta) ? delta.toFixed(2) + "×" : "—"}) ${material ? "→ corrigir" : "→ ok"}`);
    if (APPLY && material) {
      await updateJournalEntry(t.id, {
        risk_usd: realRisk,
        notes: (t.notes || "") + ` | risk_usd re-booked from fill ${realRisk.toFixed(2)} (was ${booked.toFixed(2)}; audit 2026-08-15)`,
      });
      changed++;
    }
  }
  console.log(APPLY ? `\n${changed} rows corrigidas.` : `\nDry-run — re-corre com --apply (bot parado) para escrever.`);
}

main().catch(e => { console.error(e); process.exit(1); });
