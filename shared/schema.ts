// Shared types between frontend and backend
// (No longer uses Drizzle ORM - now using sql.js directly)

export interface Watchlist {
  id: number;
  symbol: string;
  name: string;
  added_at: string;
}

export interface Signal {
  id: number;
  symbol: string;
  type: string;
  price: number;
  confidence: number;
  reason: string;
  indicators: string;
  timestamp: string;
  status: string;
}

export interface TimeframeSignal {
  timeframe: "1h" | "4h" | "1d";
  label: string;
  confluenceScore: number;
  signalType: string;
  trend: string;
  confidence: number;
}

export interface MultiTimeframeSummary {
  timeframes: Record<string, TimeframeSignal>;
  combined: {
    score: number;
    signal: string;
    confidence: number;
    agreement: "strong" | "moderate" | "weak" | "conflicting";
  };
}

export interface BacktestTrade {
  time: number;
  signal: string;
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  outcome: "win" | "loss" | "pending";
  pnlPct: number;
  barsToOutcome: number;
  confluenceScore: number;
}

export interface BacktestResult {
  symbol: string;
  interval: string;
  totalBars: number;
  totalTrades: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  totalReturn: number;
  maxDrawdown: number;
  trades: BacktestTrade[];
}
