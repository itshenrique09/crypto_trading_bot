// Single source of truth for every number/date rendered in the app.

/** Adaptive decimals: 64,012.60 · 1.2345 · 0.00001234 */
export function fmtPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const abs = Math.abs(price);
  if (abs >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (abs >= 10) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 0.1) return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export function fmtUsd(v: number | null | undefined, opts: { sign?: boolean; decimals?: number } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const { sign = false, decimals = 2 } = opts;
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const prefix = v < 0 ? "-" : sign && v > 0 ? "+" : "";
  return `${prefix}$${s}`;
}

/** 3.96B · 245M · 30.2K */
export function fmtCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

export function fmtPct(v: number | null | undefined, opts: { sign?: boolean; decimals?: number } = {}): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const { sign = true, decimals = 2 } = opts;
  const prefix = sign && v > 0 ? "+" : "";
  return `${prefix}${v.toFixed(decimals)}%`;
}

export function fmtR(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}R`;
}

export function fmtPF(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

/** Tailwind text class for a signed value. */
export function pnlClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-up" : "text-down";
}

/** "3m ago" / "2h ago" / "5d ago" */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Duration between open and close (or now): "4h" / "2d 3h" */
export function heldFor(createdAt: string, closedAt?: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const ms = end - start;
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** R-multiple of a closed/open trade from journal fields. */
export function tradeR(t: { pnl_usd: number | null; risk_usd: number | null }): number | null {
  if (t.pnl_usd == null || t.risk_usd == null || t.risk_usd <= 0) return null;
  return t.pnl_usd / t.risk_usd;
}

export interface RMetrics {
  count: number;
  wins: number;
  losses: number;
  netR: number;
  winRate: number | null;
  profitFactor: number | null;
}

/** Aggregate R stats over closed journal trades that carry risk_usd. */
export function rMetrics(trades: { pnl_usd: number | null; risk_usd: number | null; outcome: string }[]): RMetrics {
  let wins = 0, losses = 0, netR = 0, grossWin = 0, grossLoss = 0, count = 0;
  for (const t of trades) {
    if (t.outcome === "open") continue;
    const r = tradeR(t);
    if (r == null) continue;
    count++;
    netR += r;
    if (r > 0) { wins++; grossWin += r; }
    else if (r < 0) { losses++; grossLoss += -r; }
  }
  return {
    count,
    wins,
    losses,
    netR,
    winRate: count > 0 ? (wins / count) * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
  };
}
