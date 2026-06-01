// Strategy selection is now fully automatic — the regime brain (per-symbol ADX
// regime + BTC directional overlay) and the per-strategy drawdown kill-switch
// decide which strategies run on each scan. There are no manual per-strategy
// toggles. Both paper and live therefore default to "all strategies eligible";
// the real master switch for live is having MEXC keys + a running live engine.
export function defaultEnabledStrategyIds(_mode: "paper" | "live", validIds: string[]): string[] {
  return validIds.slice();
}
