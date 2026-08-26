// ── Journal ──────────────────────────────────────────────────────────

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
  pnl_usd: number | null;
  risk_usd: number | null;
  position_size_usd: number | null;
  remaining_position_size_usd: number | null;
  realized_pnl_usd: number | null;
  notes: string;
  created_at: string;
  closed_at: string | null;
  /** 1 once TP1 filled — the runner is then trailing. */
  tp1_hit?: number | null;
  /** Best price seen in the trade's favour, used by the trailing stop. */
  peak_price?: number | null;
  /** |entry − SL| / entry at fill — original stop distance (survives BE moves). */
  entry_risk_dist?: number | null;
}

export interface PaperPrice {
  id: number;
  symbol: string;
  strategy: string;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedUsd: number | null;
  riskUsd: number | null;
  positionSizeUsd: number | null;
  remainingPositionSizeUsd: number | null;
  realizedPnlUsd: number;
  tp1Hit: boolean;
  peakPrice: number | null;
  progressPct: number;
  slProgress: number;
}

// ── Engines ──────────────────────────────────────────────────────────

export interface GuardState {
  /** Breach is ACTIVE right now (independent of any override). */
  halted: boolean;
  /** Estimated natural end of the halt (daily reset / losses aging out). */
  endsAt: string | null;
  /** Manual one-shot override active until this instant, if any. */
  overrideUntil: string | null;
}

export interface GuardsState {
  daily: GuardState;
  rolling: GuardState;
}

export interface PaperStatus {
  running: boolean;
  lastCheck: string | null;
  lastScan: string | null;
  coinsScanned: number;
  intelligence: {
    btcRegime: string;
    btcRegimeReason: string;
    maxOpen: number;
    direction: { long: boolean; short: boolean; sizeMultiplier: number; reason: string };
    pausedStrategies: string[];
    updatedAt: string;
  } | null;
  openTrades: number;
  totalPaperTrades: number;
  guards?: GuardsState;
  strategyCounts: Record<string, { open: number; total: number }>;
  capital: {
    initial: number;
    balance: number;
    totalPnlUsd: number;
    riskPct: number;
    leverage: number;
    oneR: number;
    todayPnlUsd: number;
    todayR: number;
    /** Notional currently held by open paper positions. */
    openNotionalUsd?: number;
    /** balance × leverage — what checkMarginCapacity gates against. */
    capacityUsd?: number;
  };
}

export interface LivePosition {
  botSymbol: string;
  direction: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  markPrice?: number;
  notionalUsd?: number;
  unrealizedFunding?: number | null;
  protection?: { stop?: number; takeProfit?: number };
}

export interface LiveStatus {
  running: boolean;
  lastCheck: string | null;
  lastScan: string | null;
  balance: number | null;
  openPositions: number;
  unmanagedPositions: number;
  error: string | null;
  account: {
    equity: number;
    available: number;
    usedMargin?: number;
    unrealizedPnl?: number;
  } | null;
  positions: LivePosition[];
  snapshotAt: string | null;
  /** Kill-switch state from the last liveScan (empty while engine stopped). */
  pausedStrategies: string[];
  hasKeys: boolean;
  guards?: GuardsState;
  exchange: "kraken" | "mexc";
  exchanges: { id: string; name: string; note: string }[];
  configured: { kraken: boolean; mexc: boolean };
  riskPct: number;
  leverage: number;
  openTrades: number;
  totalLiveTrades: number;
  closedLiveTrades: number;
  totalPnlUsd: number;
  todayPnlUsd: number;
}

// ── Market data ──────────────────────────────────────────────────────

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
  fundingRate: number | null;
  /** Bid/ask spread as a fraction of price (MEXC futures book). */
  spreadPct: number | null;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  symbol: string;
  interval: string;
  /** Which venue actually served the data. */
  source: "mexc-futures" | "binance-spot";
  candles: OHLCV[];
}

// ── Strategies / signals ─────────────────────────────────────────────

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
  interval: string;
  preferredSymbols: string[];
  minCandles: number;
  cooldownHours: number | null;
  /** Manual pause switch — false blocks NEW entries on both engines. */
  enabled: boolean;
  paperEnabled?: boolean;
  liveEnabled?: boolean;
  /** Automatic drawdown kill-switch state per engine (read-only). */
  killSwitchPaused?: { paper: boolean; live: boolean };
}

export interface UniverseSymbol {
  symbol: string;
  strategies: string[];
  /** false = operational blocklist (blocks NEW entries on both modes/engines). */
  enabled: boolean;
}

export interface UniverseResponse {
  symbols: UniverseSymbol[];
}

export interface EngineConfig {
  riskGates: {
    minVolumeUsdt: number;
    maxSpreadPct: number;
    fundingLongMax: number;
    fundingShortMin: number;
    minSlDistancePct: number;
    minRiskReward: number;
  };
  portfolio: {
    maxOpenPositions: number;
    maxPerCorrelationGroup: number;
    onePositionPerSymbol: boolean;
    dailyDrawdownHaltR: number;
    rollingWindowDays: number;
    rollingDrawdownHaltR: number;
    killSwitchMinTrades: number;
    killSwitchMaxNetR: number;
  };
  exits: {
    tp1PartialClosePct: number;
    maxHoldHoursByInterval: Record<string, number>;
    /** Frozen at the validated optimum — reported for display only. */
    trailingMode?: "r_multiple" | "fixed_pct";
    trailingRMultiple?: number;
  };
  scan: {
    checkEverySeconds: number;
    scanEveryMinutes: number;
  };
}

export interface StrategySignal {
  id: string;
  name: string;
  interval: string;
  inUniverse: boolean;
  signal: "BUY" | "SELL" | "HOLD";
  score: number;
  confidence: number;
  reason: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  takeProfit2?: number;
}

export interface SignalsResponse {
  symbol: string;
  currentPrice: number;
  strategies: StrategySignal[];
}

export interface ScanLogEntry {
  time: string;
  symbol: string;
  strategy: string;
  result: "opened" | "filtered" | "no_signal";
  reason: string;
  signal?: string;
  confidence?: number;
}

// ── Strategy colours (active registry + neutral legacy fallback) ─────

export const STRATEGY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "liquidity-sweep": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30" },
  "rsi-divergence":  { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/30" },
  "break-retest":    { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/30" },
};

export function getStratColor(id: string) {
  return STRATEGY_COLORS[id] || { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/30" };
}

const LEGACY_NAMES: Record<string, string> = {
  "v2-swing": "Confluence Swing",
  "confluence-swing": "Confluence Swing",
  "smc": "SMC",
  "bollinger-mr": "Bollinger MR",
  "mean-reversion": "Mean Reversion",
  "breakout": "Breakout",
};

/** Old journal rows carry legacy strategy ids — collapse aliases before grouping/filtering. */
export function canonicalStratId(id: string): string {
  return id === "v2-swing" ? "confluence-swing" : id;
}

export function getStratName(id: string, strategies?: { id: string; name: string }[]): string {
  const found = strategies?.find(s => s.id === id);
  if (found) return found.name;
  return LEGACY_NAMES[id] || id;
}
