import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { JournalEntry, PaperPrice, StrategyInfo } from "@/lib/types";
import { getStratColor, getStratName } from "@/lib/types";

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

export default function TradeRow({ entry, strategies, price, closingId, closeForm, onStartClose, onCancelClose, onCloseFormChange, onConfirmClose, onDelete }: TradeRowProps) {
  const sc = getStratColor(entry.strategy || "confluence-swing");
  const isOpen = entry.outcome === "open";
  const pnl = isOpen ? price?.unrealizedPnl : entry.pnl_pct;

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
              {getStratName(entry.strategy || "confluence-swing", strategies)}
            </span>
            {isOpen && <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-400">Open</Badge>}
            {entry.outcome === "win" && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">Win</Badge>}
            {entry.outcome === "loss" && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">Loss</Badge>}
            {entry.outcome === "breakeven" && <Badge variant="outline" className="text-[10px] border-gray-500/30 text-gray-400">BE</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">Entry ${formatPrice(entry.entry_price)}</span>
            <span className="font-mono text-red-400/70">SL ${formatPrice(entry.stop_loss)}</span>
            <span className="font-mono text-emerald-400/70">TP ${formatPrice(entry.take_profit1)}</span>
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
            {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>

        <button onClick={() => onDelete(entry.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1.5 shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Live P&L progress bar */}
      {isOpen && price && (
        <div className="mt-3 ml-12">
          <div className="relative h-1.5 rounded-full bg-border/20 overflow-hidden">
            {price.progressPct >= 0 ? (
              <div className="absolute left-1/2 h-full bg-emerald-500/50 rounded-full" style={{ width: `${Math.min(price.progressPct, 100) / 2}%` }} />
            ) : (
              <div className="absolute right-1/2 h-full bg-red-500/50 rounded-full" style={{ width: `${Math.min(price.slProgress, 100) / 2}%` }} />
            )}
            <div className="absolute left-1/2 top-0 w-px h-full bg-muted-foreground/30" />
          </div>
          <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground/60">
            <span>SL</span>
            <span>Entry</span>
            <span>TP</span>
          </div>
        </div>
      )}

      {/* Close trade form */}
      {isOpen && closingId === entry.id && (
        <div className="flex items-center gap-2 mt-3 ml-12">
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
          <button onClick={onCancelClose} className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}

      {isOpen && closingId !== entry.id && (
        <div className="flex justify-end mt-2">
          <button
            onClick={() => onStartClose(entry.id)}
            className="text-[10px] px-3 py-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-card/40 transition-colors"
          >
            Close Trade
          </button>
        </div>
      )}

      {/* Closed info */}
      {!isOpen && entry.exit_price != null && (
        <div className="flex items-center gap-3 mt-2 ml-12 text-xs text-muted-foreground">
          <span>Exit: <span className="font-mono text-foreground">${formatPrice(entry.exit_price)}</span></span>
          {entry.closed_at && <span>{new Date(entry.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        </div>
      )}

      {entry.notes && <p className="text-xs text-muted-foreground mt-2 ml-12 italic">"{entry.notes}"</p>}
    </div>
  );
}
