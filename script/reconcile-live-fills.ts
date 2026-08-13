// ─── LIVE FILL RECONCILIATION ────────────────────────────────────────────
// Re-price closed LIVE trades against the venue's real executions.
//
// Why this exists: when a stop or take-profit fires on the exchange, the engine
// never sees the order — it just finds the position gone on the next scan. It
// used to record whatever the MEXC ticker read at that moment, which is a
// different exchange at a later time. So the journal booked a price the account
// never traded at, and real slippage was invisible BY CONSTRUCTION: the number
// it would have shown up in was itself a guess.
//
// routes.ts now prices these from the venue's fills. This script repairs the
// rows that closed BEFORE that fix, and — more usefully — measures the gap, so
// "does live match paper?" gets a number instead of an opinion.
//
// Read-only by default. Pass --apply to write the corrected rows.
//   npx tsx script/reconcile-live-fills.ts
//   npx tsx script/reconcile-live-fills.ts --apply
//
// Kraken's fill window is bounded: trades that closed long ago may no longer be
// recoverable. Those are reported as unrecoverable rather than guessed at.

import { getJournal, updateJournalEntry } from "../server/storage";
import { exitPriceFromFills, type ExchangeFill } from "../server/exchange";
import { buildLiveAdapter, CredentialError } from "../server/live-credentials";
import { finalizeTradeAccounting, TRADE_COSTS } from "../server/trade-accounting";

const APPLY = process.argv.includes("--apply");

function normalizeDirection(d: string): "LONG" | "SHORT" {
  return d === "SHORT" ? "SHORT" : "LONG";
}

function fmt(n: number | null | undefined, digits = 2): string {
  return n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits);
}

async function main() {
  const client = await buildLiveAdapter();
  const exchange = client.id;
  if (!client.getFills) {
    console.error(`${exchange.toUpperCase()} exposes no fill history — nothing to reconcile against.`);
    process.exit(1);
  }

  const closed = (await getJournal(10_000))
    .filter(e => e.mode === "live" && e.outcome && e.outcome !== "open")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (closed.length === 0) {
    console.log("No closed live trades to reconcile.");
    return;
  }

  const oldest = new Date(closed[0].created_at).getTime();
  const fills: ExchangeFill[] = await client.getFills(new Date(oldest - 60 * 60_000));
  console.log(`${exchange.toUpperCase()}: ${fills.length} fills in window, ${closed.length} closed live trades\n`);

  let bookedTotal = 0, realTotal = 0, repaired = 0, unrecoverable = 0;

  console.log("SYMBOL  DIR    BOOKED EXIT   REAL EXIT     DRIFT     BOOKED P&L   REAL P&L    DELTA");
  console.log("─".repeat(84));

  for (const t of closed) {
    const direction = normalizeDirection(t.direction);
    const total = t.position_size_usd ?? 0;
    // No remainingFraction on purpose: a closed row has had its remaining size
    // zeroed, so there is nothing truthful to pass. exitPriceFromFills then
    // prices the last close event, which is exactly the runner.
    const resolved = exitPriceFromFills(fills, {
      botSymbol: t.symbol,
      direction,
      openedAtMs: new Date(t.created_at).getTime(),
    });

    const bookedPnl = t.pnl_usd ?? 0;
    bookedTotal += bookedPnl;

    if (!resolved) {
      unrecoverable++;
      realTotal += bookedPnl;   // nothing better to use
      console.log(
        `${t.symbol.padEnd(7)} ${direction.padEnd(6)} ${fmt(t.exit_price, 6).padStart(11)}   ` +
        `${"no fills".padStart(11)}   ${"—".padStart(7)}   ${fmt(bookedPnl).padStart(10)}   ${"—".padStart(9)}   ${"—".padStart(6)}`,
      );
      continue;
    }

    // Re-price ONLY the portion this close actually covered. Feeding the full
    // size here while realizedPnlUsd already holds the TP1 proceeds books that
    // profit twice — which is how a trade that lost to slippage came out ahead.
    const remainingUsd = resolved.fractionOfPosition != null
      ? total * resolved.fractionOfPosition
      : total;

    // A TP1 partial is left as executed: it filled at the time and its proceeds
    // are in realized_pnl_usd. Only the final exit is corrected here.
    const accounting = finalizeTradeAccounting({
      direction,
      entryPrice: t.entry_price,
      positionSizeUsd: t.position_size_usd,
      remainingPositionSizeUsd: remainingUsd,
      realizedPnlUsd: t.realized_pnl_usd,
    }, resolved.price, TRADE_COSTS);

    const realPnl = accounting.pnlUsd ?? bookedPnl;
    realTotal += realPnl;
    const driftBps = t.exit_price ? ((resolved.price - t.exit_price) / t.exit_price) * 10_000 : 0;
    const delta = realPnl - bookedPnl;

    console.log(
      `${t.symbol.padEnd(7)} ${direction.padEnd(6)} ${fmt(t.exit_price, 6).padStart(11)}   ` +
      `${fmt(resolved.price, 6).padStart(11)}   ${(driftBps >= 0 ? "+" : "") + fmt(driftBps, 1)}bps   ` +
      `${fmt(bookedPnl).padStart(10)}   ${fmt(realPnl).padStart(9)}   ${(delta >= 0 ? "+" : "") + fmt(delta)}`,
    );

    if (APPLY && Math.abs(delta) > 0.005) {
      await updateJournalEntry(t.id, {
        exit_price: Math.round(resolved.price * 1e6) / 1e6,
        pnl_usd: Math.round(realPnl * 100) / 100,
        pnl_pct: Math.round(accounting.pnlPct * 100) / 100,
        outcome: accounting.outcome,
        notes: (t.notes || "") + ` | Re-priced from ${exchange.toUpperCase()} fills (was ${fmt(t.exit_price, 6)})`,
      });
      repaired++;
    }
  }

  const gap = realTotal - bookedTotal;
  console.log("─".repeat(84));
  console.log(`\nBooked P&L:     $${fmt(bookedTotal)}`);
  console.log(`Real P&L:       $${fmt(realTotal)}`);
  console.log(`Execution gap:  $${fmt(gap)}  (${bookedTotal !== 0 ? fmt((gap / Math.abs(bookedTotal)) * 100, 1) : "—"}% of booked)`);

  const priced = closed.length - unrecoverable;
  if (priced > 0) {
    const avgRisk = closed.reduce((s, t) => s + (t.risk_usd ?? 0), 0) / closed.length;
    if (avgRisk > 0) {
      console.log(`Per trade:      ${fmt(gap / priced / avgRisk, 3)}R  (avg risk $${fmt(avgRisk)})`);
      console.log(`\nCompare against paper expectancy. If this per-trade gap is a large`);
      console.log(`fraction of it, the modelled ${(TRADE_COSTS.slippagePct * 100).toFixed(2)}% slippage is too optimistic and`);
      console.log(`the backtests need re-running with the measured number.`);
    }
  }
  if (unrecoverable > 0) console.log(`\n${unrecoverable} trade(s) closed outside the venue's fill window — not recoverable.`);
  console.log(APPLY ? `\n${repaired} row(s) rewritten.` : `\nDry run. Re-run with --apply to write these corrections.`);
}

main().catch(e => {
  console.error(e instanceof CredentialError ? `\n${e.message}\n` : e);
  process.exit(1);
});
