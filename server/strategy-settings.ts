export function defaultEnabledStrategyIds(mode: "paper" | "live", validIds: string[]): string[] {
  return mode === "paper" ? validIds.slice() : [];
}
