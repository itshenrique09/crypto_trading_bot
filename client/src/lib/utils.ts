import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

export function formatCompact(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toFixed(2);
}

export function formatPercent(val: number | null | undefined): string {
  if (val == null) return "—";
  return (val >= 0 ? "+" : "") + val.toFixed(2) + "%";
}

export function getChangeColor(val: number | null | undefined): string {
  if (val == null) return "text-muted-foreground";
  return val >= 0 ? "text-emerald-400" : "text-red-400";
}

export function getSignalColor(type: string): string {
  switch (type) {
    case "STRONG_BUY": return "text-emerald-300";
    case "BUY": return "text-emerald-400";
    case "SELL": return "text-red-400";
    case "STRONG_SELL": return "text-red-300";
    default: return "text-yellow-400";
  }
}

export function getSignalBg(type: string): string {
  switch (type) {
    case "STRONG_BUY": return "bg-emerald-500/10 border-emerald-500/30";
    case "BUY": return "bg-emerald-500/5 border-emerald-500/20";
    case "SELL": return "bg-red-500/5 border-red-500/20";
    case "STRONG_SELL": return "bg-red-500/10 border-red-500/30";
    default: return "bg-yellow-500/5 border-yellow-500/20";
  }
}

export function getBiasColor(bias: string): string {
  if (bias === "bullish") return "text-emerald-400";
  if (bias === "bearish") return "text-red-400";
  return "text-muted-foreground";
}

export function getBiasBg(bias: string): string {
  if (bias === "bullish") return "bg-emerald-500/10";
  if (bias === "bearish") return "bg-red-500/10";
  return "bg-muted/30";
}
