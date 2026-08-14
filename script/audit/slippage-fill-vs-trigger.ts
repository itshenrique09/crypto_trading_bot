// ─── SLIPPAGE: FILL vs TRIGGER (audit follow-up, Aug 2026) ──────────────────
// The reconcile script measures fill-vs-BOOKED price (bookkeeping drift). This
// measures fill-vs-TRIGGER: for each closed LIVE trade, derive the price level
// the protective order was SET at (stop_loss / entry after BE / TP1 / trail
// level reconstructed from peak_price) and compare it to the venue fill the
// engine recorded. That isolates true execution slippage — the number that
// gates the minSL 0.4% decision and calibrates the -0.12R penalty.
//
// Read-only. Sources, in order of preference:
//   --file=path.json   a journal export envelope ({trades: [...]}) — runs anywhere
//   (default)          the local data.db journal
//
// Classification is tolerance-based on stored levels; trades that fit no
// template are reported as UNCLASSIFIED and excluded from the aggregates —
// never guessed. Trail triggers assume the production r_multiple 2.0R
// (trailing_r_multiple setting); pass --trail-r=1.5 to override.
// Run: npx tsx script/audit/slippage-fill-vs-trigger.ts [--file=export.json] [--trail-r=2]

import { readFileSync } from "fs";

interface Row {
  id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit1: number;
  take_profit2: number | null;
  mode: string;
  outcome: string;
  exit_price: number | null;
  notes: string;
  created_at: string;
  closed_at: string | null;
  risk_usd: number | null;
  peak_price?: number | null;
  tp1_hit?: number | null;
}

const argv = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const TRAIL_R = parseFloat(argv["trail-r"] ?? "2.0");

type ExitKind = "sl" | "breakeven" | "tp" | "trailing" | "manual/unclassified";

interface Measured {
  row: Row;
  kind: ExitKind;
  trigger: number | null;
  fill: number | null;
  /** adverse slippage in bps of trigger (positive = worse than trigger) */
  slipBps: number | null;
  slipR: number | null;
  assumed?: string;
}

function adverseBps(direction: string, trigger: number, fill: number): number {
  // Exits REDUCE the position: LONG exit sells (fill below trigger = adverse),
  // SHORT exit buys (fill above trigger = adverse).
  const raw = direction === "LONG" ? (trigger - fill) / trigger : (fill - trigger) / trigger;
  return raw * 10_000;
}

function classify(t: Row): Measured {
  const notes = t.notes ?? "";
  const dir = t.direction === "SHORT" ? "SHORT" : "LONG";
  const risk = Math.abs(t.entry_price - t.stop_loss) || null;
  // The engine's close bookkeeping embeds the venue fill in the notes; the
  // journal exit_price is re-priced from fills since the Aug-13 fix. Prefer the
  // explicit "@ fill X" capture when present.
  const fillMatch = /Closed on \w+ @ fill ([\d.eE+-]+)/.exec(notes);
  const fill = fillMatch ? parseFloat(fillMatch[1]) : (t.exit_price ?? null);
  if (fill == null || !Number.isFinite(fill) || fill <= 0) {
    return { row: t, kind: "manual/unclassified", trigger: null, fill: null, slipBps: null, slipR: null };
  }
  const beMoved = /SL moved to break-even/i.test(notes);
  const tp1Hit = (t.tp1_hit ?? 0) === 1;
  const riskAbs = Math.abs(t.entry_price - t.stop_loss);
  const tol = (level: number) => Math.abs(fill - level) <= Math.max(0.35 * riskAbs, level * 0.002);

  // Max-hold market close — no trigger to compare against.
  if (/Max-hold timeout/i.test(notes)) {
    return { row: t, kind: "manual/unclassified", trigger: null, fill, slipBps: null, slipR: null, assumed: "max-hold market close" };
  }

  // 1) original SL (only meaningful if BE never moved the stop)
  if (!beMoved && !tp1Hit && riskAbs > 0 && tol(t.stop_loss)) {
    const slipBps = adverseBps(dir, t.stop_loss, fill);
    return { row: t, kind: "sl", trigger: t.stop_loss, fill, slipBps, slipR: risk ? (slipBps / 10_000) * t.stop_loss / risk : null };
  }
  // 2) break-even stop (post-TP1 or post-BE-move): trigger = entry
  if ((beMoved || tp1Hit) && tol(t.entry_price)) {
    const slipBps = adverseBps(dir, t.entry_price, fill);
    return { row: t, kind: "breakeven", trigger: t.entry_price, fill, slipBps, slipR: risk ? (slipBps / 10_000) * t.entry_price / risk : null };
  }
  // 3) take-profit levels (runner TP2, or full TP1 close)
  for (const tp of [t.take_profit2, t.take_profit1]) {
    if (tp != null && tp > 0 && tol(tp)) {
      const slipBps = adverseBps(dir, tp, fill);
      return { row: t, kind: "tp", trigger: tp, fill, slipBps, slipR: risk ? (slipBps / 10_000) * tp / risk : null };
    }
  }
  // 4) trailing stop reconstructed from peak: trigger = peak ∓ TRAIL_R × risk
  if (tp1Hit && t.peak_price != null && t.peak_price > 0 && riskAbs > 0) {
    const trigger = dir === "LONG" ? t.peak_price - TRAIL_R * riskAbs : t.peak_price + TRAIL_R * riskAbs;
    if (tol(trigger)) {
      const slipBps = adverseBps(dir, trigger, fill);
      return { row: t, kind: "trailing", trigger, fill, slipBps, slipR: risk ? (slipBps / 10_000) * trigger / risk : null, assumed: `trail=${TRAIL_R}R from peak ${t.peak_price}` };
    }
  }
  return { row: t, kind: "manual/unclassified", trigger: null, fill, slipBps: null, slipR: null };
}

// TP1 partial fills are a second, independent sample: the engine logs
// "Live TP1 partial close ... @ fill X". Trigger = take_profit1.
function tp1Partials(rows: Row[]): Measured[] {
  const out: Measured[] = [];
  for (const t of rows) {
    const m = /TP1 partial close [^@|]*@ fill ([\d.eE+-]+)/.exec(t.notes ?? "");
    if (!m) continue;
    const fill = parseFloat(m[1]);
    if (!Number.isFinite(fill) || fill <= 0 || !t.take_profit1) continue;
    const dir = t.direction === "SHORT" ? "SHORT" : "LONG";
    const risk = Math.abs(t.entry_price - t.stop_loss) || null;
    const slipBps = adverseBps(dir, t.take_profit1, fill);
    out.push({ row: t, kind: "tp", trigger: t.take_profit1, fill, slipBps, slipR: risk ? (slipBps / 10_000) * t.take_profit1 / risk : null, assumed: "TP1 partial" });
  }
  return out;
}

async function loadRows(): Promise<Row[]> {
  if (argv.file) {
    const j = JSON.parse(readFileSync(argv.file, "utf-8"));
    const trades: Row[] = Array.isArray(j) ? j : j.trades;
    return trades.filter(t => t.mode === "live");
  }
  const { getJournal } = await import("../../server/storage");
  return (await getJournal(10_000)).filter((e: any) => e.mode === "live") as unknown as Row[];
}

function summarize(label: string, ms: Measured[]) {
  const valid = ms.filter(m => m.slipBps != null);
  if (!valid.length) { console.log(`  ${label.padEnd(12)} n=0`); return; }
  const bps = valid.map(m => m.slipBps!);
  const rs = valid.filter(m => m.slipR != null).map(m => m.slipR!);
  const mean = bps.reduce((a, b) => a + b, 0) / bps.length;
  const sorted = [...bps].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const meanR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN;
  console.log(`  ${label.padEnd(12)} n=${String(valid.length).padStart(3)}  mean=${(mean >= 0 ? "+" : "") + mean.toFixed(1)}bps  median=${(med >= 0 ? "+" : "") + med.toFixed(1)}bps  worst=${(Math.max(...bps)).toFixed(1)}bps  meanR=${Number.isFinite(meanR) ? (meanR >= 0 ? "+" : "") + meanR.toFixed(4) : "—"}R  (positive = adverso)`);
}

async function main() {
  const rows = (await loadRows()).filter(t => t.outcome && t.outcome !== "open");
  if (!rows.length) { console.log("Sem trades live fechados na fonte escolhida."); return; }
  console.log(`# Slippage fill-vs-trigger — ${rows.length} trades live fechados (${argv.file ? argv.file : "data.db"})`);
  console.log(`Modelo atual: taker 0.02% + slippage 0.05% por lado. Trail assumido: ${TRAIL_R}R.\n`);

  const finals = rows.map(classify);
  const partials = tp1Partials(rows);

  console.log("EXIT FINAL           TIPO        TRIGGER        FILL          SLIP");
  console.log("─".repeat(78));
  for (const m of [...finals, ...partials]) {
    const t = m.row;
    console.log(
      `${t.symbol.padEnd(7)} ${t.direction.padEnd(5)} #${String(t.id).padEnd(5)} ${m.kind.padEnd(11)} ` +
      `${m.trigger != null ? m.trigger.toPrecision(6).padStart(12) : "—".padStart(12)} ` +
      `${m.fill != null ? m.fill.toPrecision(6).padStart(12) : "—".padStart(12)} ` +
      `${m.slipBps != null ? ((m.slipBps >= 0 ? "+" : "") + m.slipBps.toFixed(1) + "bps").padStart(10) : "—".padStart(10)}` +
      `${m.assumed ? `  [${m.assumed}]` : ""}`,
    );
  }

  console.log("\n== agregados por tipo de trigger (positivo = pior que o trigger) ==");
  summarize("sl", finals.filter(m => m.kind === "sl"));
  summarize("breakeven", finals.filter(m => m.kind === "breakeven"));
  summarize("trailing", finals.filter(m => m.kind === "trailing"));
  summarize("tp (final)", finals.filter(m => m.kind === "tp"));
  summarize("tp1 partial", partials);
  const un = finals.filter(m => m.kind === "manual/unclassified");
  console.log(`  unclassified n=${un.length}${un.length ? " — excluídos dos agregados: " + un.map(m => `${m.row.symbol}#${m.row.id}`).join(", ") : ""}`);

  // slippage vs distância do stop — a evidência que o gate minSL 0.6% pede
  const stopish = [...finals.filter(m => (m.kind === "sl" || m.kind === "breakeven" || m.kind === "trailing") && m.slipBps != null)];
  if (stopish.length >= 3) {
    console.log("\n== slippage (R) vs distância do stop — decide o floor minSL ==");
    for (const m of stopish.sort((a, b) => (a.row.risk_usd ?? 0) - (b.row.risk_usd ?? 0))) {
      const slDist = Math.abs(m.row.entry_price - m.row.stop_loss) / m.row.entry_price;
      console.log(`  ${m.row.symbol.padEnd(7)} slDist=${(slDist * 100).toFixed(2)}%  slip=${(m.slipR! >= 0 ? "+" : "") + m.slipR!.toFixed(4)}R`);
    }
    console.log("  (com n≥30 por bucket, comparar slip médio em R para slDist <0.8% vs ≥0.8%)");
  }
  console.log(`\nNOTA: n pequeno = inconclusivo por regra da auditoria (<30). Acumular fechos live e re-correr.`);
}

main().catch(e => { console.error(e); process.exit(1); });
