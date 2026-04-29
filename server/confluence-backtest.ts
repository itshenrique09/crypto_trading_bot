import type { TradeSignal } from "./analysis";

export function isConfluenceBacktestEligible(signal: TradeSignal): boolean {
  return (
    signal.type !== "HOLD" &&
    Math.abs(signal.confluenceScore) >= 4 &&
    Boolean(signal.entry && signal.stopLoss && signal.takeProfit1)
  );
}

export function confluenceBacktestDirection(signal: TradeSignal): "LONG" | "SHORT" {
  return signal.type === "BUY" || signal.type === "STRONG_BUY" ? "LONG" : "SHORT";
}
