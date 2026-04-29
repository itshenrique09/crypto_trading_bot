export interface OpenExposure {
  symbol: string;
  strategy?: string | null;
  outcome?: string | null;
}

export interface ExposureDecision {
  skip: boolean;
  reason?: string;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function shouldSkipSymbolForOpenExposure(
  openExposures: OpenExposure[],
  symbol: string,
  _nextStrategy?: string,
): ExposureDecision {
  const normalizedSymbol = normalizeSymbol(symbol);
  const existing = openExposures.find((exposure) =>
    normalizeSymbol(exposure.symbol) === normalizedSymbol &&
    (exposure.outcome == null || exposure.outcome === "open")
  );

  if (!existing) return { skip: false };

  const strategy = existing.strategy ? ` via ${existing.strategy}` : "";
  return {
    skip: true,
    reason: `Open exposure already exists for ${normalizedSymbol}${strategy}`,
  };
}
