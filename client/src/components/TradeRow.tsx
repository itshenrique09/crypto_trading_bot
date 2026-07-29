import { memo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Trash2, BarChart2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor, getStratName } from "@/lib/types";
import TradeChartModal from "./TradeChartModal";
import { ConfirmButton } from "./ConfirmButton";

interface TradeRowProps {
  entry: JournalEntry;
  strategies: StrategyInfo[];
  price?: PaperPrice;
  closingId: number | null;
  closeForm: { exit_price: string; outcome: string };
  onStartClose: (id: number) => void;
  onCancelClose: () => void;
  onCloseFormChange: (updates: Partial<{ exit_price: string; outcome: string }>) => void;
  onConfirmClose: (id: number) => void;
  onDelete: (id: number) => void;
}

function TradeRowInner({ entry, strategies, price, closingId, closeForm, onStartClose, onCancelClose, onCloseFormChange, onConfirmClose, onDelete }: TradeRowProps) {
  const sc = getStratColor(entry.strategy);
  const isOpen = entry.outcome === "open";
  const pnl = isOpen ? price?.unrealizedPnl : entry.pnl_pct;
  const [showChart, setShowChart] = useState(false);

  return (
    <div className="p-4 hover:bg-card/20 transition-colors">
      {/* Main row */}
      <div className="flex items-center gap-3">
        <div className={`px-2 py-1.5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
          entry.direction === "LONG" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
        }`}>
          {entry.direction}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/market/${entry.symbol}`} className="text-sm font-bold hover:text-purple-400 transition-colors">{entry.symbol}</Link>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${sc.bg} ${sc.text}`}>
              {getStratName(entry.strategy, strategies)}
            </span>
            {isOpen && <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">Open</Badge>}
            {entry.outcome === "win" && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Win</Badge>}
            {entry.outcome === "loss" && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">Loss</Badge>}
            {entry.outcome === "breakeven" && <Badge variant="outline" className="text-[10px] border-gray-500/30 text-gray-400">BE</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono">Entry ${formatPrice(entry.entry_price)}</span>
            <span className="font-mono text-red-400/70">SL ${formatPrice(entry.stop_loss)}</span>
            <span className="font-mono text-emerald-400/70">TP1 ${formatPrice(entry.take_profit1)}</span>
            {entry.take_profit2 != null && entry.take_profit2 !== entry.take_profit1 && (
              <span className="font-mono text-emerald-300/60">TP2 ${formatPrice(entry.take_profit2)}</span>
            )}
            {entry.confluence_score != null && <span>Score {entry.confluence_score}</span>}
          </div>
        </div>

        <div className="text-right shrink-0">
          {isOpen && price ? (
            <>
              <span className="text-xs text-muted-foreground font-mono">${formatPrice(price.currentPrice)}</span>
              <span className={`block text-sm font-bold ${(pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(pnl ?? 0) > 0 ? "+" : ""}{pnl?.toFixed(2) ?? "--"}%
              </span>
            </>
          ) : !isOpen && pnl != null ? (
            <span className={`text-sm font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {pnl > 0 ? "+" : ""}{pnl}%
            </span>
          ) : null}
          <span className="text-[10px] text-muted-foreground block">
            {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <button onClick={() => setShowChart(true)} className="text-muted-foreground/40 hover:text-purple-400 transition-colors p-1.5 shrink-0" title="View chart">
          <BarChart2 className="w-3.5 h-3.5" />
        </button>
        <ConfirmButton
          onConfirm={() => onDelete(entry.id)}
          title="Delete trade?"
          description={`Permanently remove ${entry.symbol} ${entry.direction} from the journal. This cannot be undone.`}
          confirmText="Delete"
        >
          <button className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1.5 shrink-0" aria-label="Delete trade">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </ConfirmButton>
      </div>

      {/* Live P&L progress bar — SL | Entry | TP1 tick | TP2 (if set) */}
      {isOpen && price && (() => {
        const isLong = entry.direction === "LONG";
        const tp1 = entry.take_profit1;
        // tp2 === tp1 means single-target trade (no structural level beyond TP1) —
        // treat as "no TP2" for display so we don't render a redundant overlapping marker.
        const tp2 = entry.take_profit2 != null && entry.take_profit2 !== tp1 ? entry.take_profit2 : null;
        // Right edge of the bar = the farther TP (TP2 if set, else TP1)
        const farTp = tp2 ?? tp1;
        const tp1Reach   = Math.abs(tp1   - entry.entry_price);
        const farTpReach = Math.abs(farTp - entry.entry_price);
        // Where does TP1 sit on the right half? (0..50% of bar width, measured from center)
        const tp1OffsetPct = farTpReach > 0 ? (tp1Reach / farTpReach) * 50 : 50;
        // Progress of current price toward farTp
        const moveFromEntry = isLong
          ? price.currentPrice - entry.entry_price
          : entry.entry_price - price.currentPrice;
        const upProgressPct = farTpReach > 0 ? Math.max(0, (moveFromEntry / farTpReach) * 50) : 0;
        const pastTp1 = moveFromEntry >= tp1Reach;
        return (
          <div className="mt-3 ml-12">
            <div className="relative h-1.5 rounded-full bg-border/20 overflow-hidden">
              {moveFromEntry >= 0 ? (
                <div
                  className={`absolute left-1/2 h-full rounded-full ${pastTp1 ? "bg-emerald-400/70" : "bg-emerald-500/50"}`}
                  style={{ width: `${Math.min(upProgressPct, 50)}%` }}
                />
              ) : (
                <div className="absolute right-1/2 h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min(price.slProgress, 100) / 2}%` }} />
              )}
              {/* Entry marker (center) */}
              <div className="absolute left-1/2 top-0 w-px h-full bg-muted-foreground/30" />
              {/* TP1 tick — only show if TP2 exists (otherwise TP1 IS the right edge) */}
              {tp2 != null && (
                <div
                  className={`absolute top-[-2px] bottom-[-2px] w-[2px] ${pastTp1 ? "bg-emerald-400" : "bg-emerald-500/60"}`}
                  style={{ left: `calc(50% + ${tp1OffsetPct}%)`, transform: "translateX(-50%)" }}
                  title={`TP1 $${formatPrice(tp1)}`}
                />
              )}
            </div>
            <div className="relative mt-0.5 text-[9px] text-muted-foreground/40 font-mono h-3">
              <span className="absolute left-0">SL ${formatPrice(entry.stop_loss)}</span>
              <span className="absolute left-1/2 -translate-x-1/2 text-muted-foreground/60">Entry</span>
              {tp2 != null && (
                <span
                  className={`absolute -translate-x-1/2 ${pastTp1 ? "text-emerald-300" : "text-muted-foreground/50"}`}
                  style={{ left: `calc(50% + ${tp1OffsetPct}%)` }}
                >
                  TP1
                </span>
              )}
              <span className={`absolute right-0 ${tp2 != null ? "text-emerald-300/70" : ""}`}>
                {tp2 != null ? "TP2 " : "TP "}${formatPrice(farTp)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Risk info + Close button row */}
      <div className="flex items-center justify-between mt-2 ml-12">
        {/* Risk metadata — clean, no debug noise */}
        <div className="flex items-center gap-2">
          {entry.risk_usd != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-card/40 border border-border/15 text-muted-foreground/60 font-mono">
              1R €{entry.risk_usd.toFixed(2)}
            </span>
          )}
          {isOpen && price && (
            <span className={`text-[10px] font-mono font-semibold ${(price.unrealizedPnl ?? 0) >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
              {(() => {
                // R-multiple uses server-side open PnL so partial TP1 accounting stays accurate.
                if (price.unrealizedUsd == null || entry.risk_usd == null || entry.risk_usd <= 0) return null;
                const rMult = price.unrealizedUsd / entry.risk_usd;
                return `${rMult >= 0 ? "+" : ""}${rMult.toFixed(2)}R`;
              })()}
            </span>
          )}
          {!isOpen && entry.pnl_usd != null && (
            <span className={`text-[10px] font-mono font-semibold ${entry.pnl_usd >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
              {entry.pnl_usd >= 0 ? "+" : ""}€{Math.abs(entry.pnl_usd).toFixed(2)}
            </span>
          )}
          {!isOpen && entry.pnl_usd != null && entry.risk_usd != null && entry.risk_usd > 0 && (
            <span className={`text-[10px] font-mono font-semibold ${entry.pnl_usd >= 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>
              {entry.pnl_usd >= 0 ? "+" : ""}{(entry.pnl_usd / entry.risk_usd).toFixed(2)}R
            </span>
          )}
          {!isOpen && entry.created_at && entry.closed_at && (() => {
            const ms = new Date(entry.closed_at).getTime() - new Date(entry.created_at).getTime();
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            return (
              <span className="text-[10px] text-muted-foreground/40 font-mono">
                {h > 0 ? `${h}h ` : ""}{m}m
              </span>
            );
          })()}
        </div>

        {/* Close trade controls */}
        {isOpen && closingId === entry.id ? (
          <div className="flex items-center gap-2">
            <input
              type="number" step="any" placeholder="Exit price"
              value={closeForm.exit_price}
              onChange={e => onCloseFormChange({ exit_price: e.target.value })}
              className="w-28 px-2 py-1.5 text-xs rounded-md bg-background border border-border/50 text-foreground"
            />
            <select
              value={closeForm.outcome}
              onChange={e => onCloseFormChange({ outcome: e.target.value })}
              className="px-2 py-1.5 text-xs rounded-md bg-background border border-border/50 text-foreground"
            >
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">BE</option>
            </select>
            <button onClick={() => onConfirmClose(entry.id)} className="text-xs px-3 py-1.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 font-medium">Save</button>
            <button onClick={onCancelClose} className="text-xs px-2 py-1.5 text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : isOpen ? (
          <button
            onClick={() => onStartClose(entry.id)}
            className="text-[10px] px-3 py-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-card/40 transition-colors"
          >
            Close Trade
          </button>
        ) : entry.exit_price != null ? (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
            <span>Exit <span className="font-mono text-muted-foreground">${formatPrice(entry.exit_price)}</span></span>
            {entry.closed_at && (
              <span>{new Date(entry.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Trade chart modal */}
      {showChart && <TradeChartModal entry={entry} onClose={() => setShowChart(false)} />}
    </div>
  );
}

// Skip re-render when neither this row's data, price tick, nor its close-form state changed.
// With 15s journal polls and 10s price polls over 100+ trades, this turns an O(n) render
// into O(k) where k = rows whose price actually changed.
const TradeRow = memo(TradeRowInner, (prev, next) => {
  if (prev.entry !== next.entry) return false;
  if (prev.price?.unrealizedPnl !== next.price?.unrealizedPnl) return false;
  if (prev.price?.progressPct !== next.price?.progressPct) return false;
  if (prev.price?.slProgress !== next.price?.slProgress) return false;
  const prevActive = prev.closingId === prev.entry.id;
  const nextActive = next.closingId === next.entry.id;
  if (prevActive !== nextActive) return false;
  if (nextActive && prev.closeForm !== next.closeForm) return false;
  if (prev.strategies !== next.strategies) return false;
  return true;
});

export default TradeRow;
