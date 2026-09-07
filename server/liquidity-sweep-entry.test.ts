// Regression guard for the 2026-09-01 look-ahead fix in liquiditySweepSignal:
// the reported entry must be the close of the LAST candle handed to the signal
// (the price that exists when the engine decides), never the close of an
// earlier sweep candle. Runs over real cached candles when the research cache
// is present (script/.cache/pl_<SYM>_1h_*.json, written by the validation
// harness) and skips otherwise — a synthetic sweep that passes every internal
// gate is brittle to hand-craft, and the invariant is what matters.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { liquiditySweepSignal, setLiquiditySweepStopMode, getLiquiditySweepStopMode, type OHLCV } from "./analysis";

const CACHE_DIR = join(process.cwd(), "script", ".cache");

function cachedStreams(max = 4): Array<{ sym: string; candles: OHLCV[] }> {
  if (!existsSync(CACHE_DIR)) return [];
  const files = readdirSync(CACHE_DIR).filter(f => /^pl_[A-Z]+_1h_\d+_\d{8}\.json$/.test(f)).sort().reverse();
  const seen = new Set<string>();
  const out: Array<{ sym: string; candles: OHLCV[] }> = [];
  for (const f of files) {
    const sym = f.split("_")[1];
    if (seen.has(sym)) continue;
    seen.add(sym);
    out.push({ sym, candles: JSON.parse(readFileSync(join(CACHE_DIR, f), "utf-8")) as OHLCV[] });
    if (out.length >= max) break;
  }
  return out;
}

test("liquidity sweep entry is the signal candle's close (no stale sweep-bar price)", (t) => {
  const streams = cachedStreams();
  if (streams.length === 0) { t.skip("no cached 1h candles under script/.cache"); return; }
  let fired = 0, confirmationBar = 0;
  for (const { candles } of streams) {
    const start = Math.max(220, candles.length - 2500);
    for (let i = start; i < candles.length; i++) {
      const slice = candles.slice(i - 220, i + 1);
      const sig = liquiditySweepSignal(slice);
      if (sig.type === "NONE") continue;
      fired++;
      assert.equal(sig.entry, slice[slice.length - 1].close, "entry must equal the last close");
      const tag = sig.reason.match(/sweep bar -(\d)/);
      assert.ok(tag, "reason must tag the sweep-bar offset");
      if (Number(tag![1]) > 0) confirmationBar++;
      // Levels stay structural and consistent with the real entry.
      if (sig.type === "LONG") { assert.ok(sig.stopLoss < sig.entry && sig.takeProfit > sig.entry); }
      else { assert.ok(sig.stopLoss > sig.entry && sig.takeProfit < sig.entry); }
      assert.ok(Math.abs(sig.takeProfit - sig.entry) / Math.abs(sig.entry - sig.stopLoss) >= 2.0 - 1e-9, "R:R ≥ 2 measured from the real entry");
    }
  }
  assert.ok(fired > 0, "expected at least one signal in the cached streams");
  // The confirmation-bar rule still produces most signals; the fix only changes WHERE they are priced.
  assert.ok(confirmationBar > 0, "expected confirmation-bar signals to still exist");
});

test("liquidity sweep stop modes: clamp keeps the stop beyond the swept wick, tighten (shipped) does not for a share of signals", (t) => {
  const streams = cachedStreams();
  if (streams.length === 0) { t.skip("no cached 1h candles under script/.cache"); return; }
  const original = getLiquiditySweepStopMode();
  const scan = (): { fired: number; insideWick: number } => {
    let fired = 0, insideWick = 0;
    for (const { candles } of streams) {
      const start = Math.max(220, candles.length - 2500);
      for (let i = start; i < candles.length; i++) {
        const slice = candles.slice(i - 220, i + 1);
        const sig = liquiditySweepSignal(slice);
        if (sig.type === "NONE") continue;
        fired++;
        const k = Number(sig.reason.match(/sweep bar -(\d)/)![1]);
        const sweep = slice[slice.length - 1 - k];
        const inside = sig.type === "LONG" ? sig.stopLoss > sweep.low : sig.stopLoss < sweep.high;
        if (inside) insideWick++;
      }
    }
    return { fired, insideWick };
  };
  try {
    setLiquiditySweepStopMode("clamp");
    const clamped = scan();
    assert.ok(clamped.fired > 0);
    assert.equal(clamped.insideWick, 0, "clamp mode: the stop must stay beyond the sweep extreme");
    // The shipped tighten arm is what the audit caught: with the honest entry it
    // puts a material share of stops inside the wick. The official A/B found no
    // cost (AUDIT-NOTES Fase 9c), so it stays — pin the geometry so the fact is
    // visible, not accidental.
    setLiquiditySweepStopMode("tighten");
    const tightened = scan();
    assert.ok(tightened.insideWick > 0, "tighten mode is expected to breach the wick on real data");
  } finally {
    setLiquiditySweepStopMode(original);
  }
});
