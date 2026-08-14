// ─── JOURNAL RESET — start a clean measurement window ───────────────────────
// Deletes journal rows so realized stats restart from zero (e.g. day 0 of the
// 90-day confirmation window, 2026-08-14). Settings, encrypted API keys and
// everything else in bot_settings are UNTOUCHED — this only removes journal rows.
//
// Rules:
//   • --mode=paper (default): deletes ALL paper rows, open included — paper
//     positions are simulations, wiping them is the point of a reset. The paper
//     balance goes back to `capital inicial` on the next status read.
//   • --mode=live: deletes CLOSED live rows only. OPEN live rows are NEVER
//     deleted — they are the bot's link to real positions on the venue
//     (entry, stop, TP1 state); deleting them orphans real money.
//   • --mode=all: both, with the same live protection.
//
// Dry-run by default — prints what would be deleted. Pass --apply to write.
//
// THE APP MUST BE STOPPED to --apply (same reason as reconcile-live-fills.ts):
// storage is sql.js — the server holds the whole database in memory and
// overwrites data.db wholesale on its next write, silently reverting anything
// written here. Export your JSONs and copy data.db BEFORE applying:
//   1. UI → exportar journal (paper e live) e guardar os ficheiros
//   2. copy data.db data-backup-YYYY-MM-DD.db
//   3. pm2 stop all   (ou parar o processo do bot)
//   4. npx tsx script/reset-journal.ts            (ver o que apagaria)
//      npx tsx script/reset-journal.ts --apply
//   5. pm2 start all
//
// Runs against ./data.db in the CURRENT working directory (same as the server).

import { getJournal, deleteJournalEntry } from "../server/storage";

const APPLY = process.argv.includes("--apply");
const modeArg = process.argv.find(a => a.startsWith("--mode="))?.split("=")[1] ?? "paper";
if (!["paper", "live", "all"].includes(modeArg)) {
  console.error(`--mode inválido: ${modeArg} (usa paper | live | all)`);
  process.exit(1);
}

async function assertServerStopped(): Promise<void> {
  const ports = Array.from(new Set([process.env.PORT || "5000", "5000", "5001"]));
  for (const port of ports) {
    const reachable = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    }).then(() => true).catch(() => false);
    if (reachable) {
      console.error(
        `\nRECUSADO: há um bot a responder em localhost:${port}.\n` +
        `O storage é sql.js — o servidor tem a base de dados inteira em memória e\n` +
        `reescreve o data.db por cima na próxima escrita, revertendo isto em silêncio.\n` +
        `Para o processo primeiro (pm2 stop all), aplica, e volta a arrancar.\n`,
      );
      process.exit(1);
    }
  }
}

async function main() {
  if (APPLY) await assertServerStopped();

  const journal = await getJournal(100_000);
  const paperRows = journal.filter(e => e.mode === "paper");
  const liveClosed = journal.filter(e => e.mode === "live" && e.outcome !== "open");
  const liveOpen = journal.filter(e => e.mode === "live" && e.outcome === "open");

  const toDelete = [
    ...(modeArg === "paper" || modeArg === "all" ? paperRows : []),
    ...(modeArg === "live" || modeArg === "all" ? liveClosed : []),
  ];

  console.log(`# Journal reset — modo=${modeArg} ${APPLY ? "(APPLY)" : "(dry-run)"}`);
  console.log(`  paper:       ${paperRows.length} rows ${modeArg !== "live" ? "→ apagar (abertas incluídas — são simulação)" : "→ manter"}`);
  console.log(`  live fechadas: ${liveClosed.length} rows ${modeArg === "live" || modeArg === "all" ? "→ apagar" : "→ manter"}`);
  console.log(`  live ABERTAS:  ${liveOpen.length} rows → NUNCA apagadas (posições reais na exchange)`);
  if (liveOpen.length && (modeArg === "live" || modeArg === "all")) {
    for (const t of liveOpen) console.log(`    mantida: #${t.id} ${t.symbol} ${t.direction} (${t.strategy})`);
  }

  if (!APPLY) {
    console.log(`\nDry-run: ${toDelete.length} rows seriam apagadas. Re-corre com --apply (bot parado) para escrever.`);
    return;
  }

  let deleted = 0;
  for (const t of toDelete) {
    await deleteJournalEntry(t.id);
    deleted++;
  }
  console.log(`\n${deleted} rows apagadas. Settings e chaves intactas.`);
  if (modeArg !== "live") {
    console.log(`O balance do paper volta ao capital inicial na próxima leitura de /api/paper/status.`);
  }
  console.log(`Arranca o bot de novo (pm2 start all) — dia 0 da janela limpa.`);
}

main().catch(e => { console.error(e); process.exit(1); });
