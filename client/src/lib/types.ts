export interface JournalEntry {
  id: number;
  symbol: string;
  direction: string;
  entry_price: number;
  stop_loss: number;
  take_profit1: number;
  take_profit2: number | null;
  confluence_score: number | null;
  mode: string;
  strategy: string;
  followed: string;
  outcome: string;
  exit_price: number | null;
  pnl_pct: number | null;
  notes: string;
  created_at: string;
  closed_at: string | null;
}

export interface PaperPrice {
  id: number;
  symbol: string;
  strategy: string;
  currentPrice: number;
  unrealizedPnl: number;
  progressPct: number;
  slProgress: number;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  interval: string;
  enabled: boolean;
}

export interface CoinData {
  symbol: string;
  name: string;
  price: number;
  change1h: number | null;
  change24h: number;
  change7d: number | null;
  marketCap: number;
  volume24h: number;
  sparkline: number[];
  image: string;
  high24h: number;
  low24h: number;
  rank: number;
}

export const STRATEGY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "confluence-swing": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  "v2-swing":         { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },  // legacy alias
  "smc":              { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  "break-retest":     { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  "rsi-divergence":   { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30" },
};

export function getStratColor(id: string) {
  return STRATEGY_COLORS[id] || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/30" };
}

const LEGACY_NAMES: Record<string, string> = {
  "v2-swing": "Confluence Swing",
  "mean-reversion": "Mean Reversion",
  "breakout": "Breakout",
};

export function getStratName(id: string, strategies?: { id: string; name: string }[]): string {
  const found = strategies?.find(s => s.id === id);
  if (found) return found.name;
  return LEGACY_NAMES[id] || id;
}
