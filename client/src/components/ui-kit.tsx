// Small shared primitives — the whole app builds its pages from these so
// spacing, typography and alignment stay identical everywhere.

import { cn } from "@/lib/utils";
import { pnlClass } from "@/lib/format";
import type { ReactNode } from "react";

/** Uniform page container: same width and padding on every page. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1560px] space-y-4 px-4 py-5 md:px-6", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title, subtitle, actions,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card with an optional uniform header row. */
export function Panel({
  title, aside, children, className, bodyClassName, noPadding,
}: {
  title?: ReactNode; aside?: ReactNode; children: ReactNode;
  className?: string; bodyClassName?: string; noPadding?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || aside) && (
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-4 py-1.5">
          <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
          {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
        </header>
      )}
      <div className={cn(noPadding ? "" : "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StatCard({
  label, value, sub, tone,
}: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("num mt-1.5 text-xl font-semibold leading-none", tone !== undefined && pnlClass(tone))}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** The one segmented control. */
export function Segmented<T extends string>({
  value, onChange, options, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-md border border-border bg-card-2 p-0.5", className)}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs transition-colors",
            o.value === value
              ? "bg-accent/15 text-accent font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Signed number with up/down colour, mono font. */
export function Pnl({ value, format, className }: {
  value: number | null | undefined;
  format: (v: number | null | undefined) => string;
  className?: string;
}) {
  return <span className={cn("num", pnlClass(value), className)}>{format(value)}</span>;
}

export function DirectionBadge({ direction }: { direction: string }) {
  const long = direction === "LONG";
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
      long ? "bg-up/10 text-up" : "bg-down/10 text-down",
    )}>
      {long ? "LONG" : "SHORT"}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const live = mode === "live";
  return (
    <span className={cn(
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
      live ? "bg-warn/10 text-warn" : "bg-accent/10 text-accent",
    )}>
      {live ? "Live" : "Paper"}
    </span>
  );
}

/** Small "source of truth" label — every data panel says where its data comes from. */
export function SourceTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-card-2/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center">
      {icon && <div className="text-muted-foreground/50">{icon}</div>}
      <div className="text-sm text-muted-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground/60">{hint}</div>}
    </div>
  );
}

/** Consistent table primitives. */
export function Th({ children, className, right, title }: { children?: ReactNode; className?: string; right?: boolean; title?: string }) {
  return (
    <th
      title={title}
      className={cn(
        "whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
        right ? "text-right" : "text-left",
        title && "cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, right }: { children?: ReactNode; className?: string; right?: boolean }) {
  return (
    <td className={cn(
      "whitespace-nowrap px-3 py-2.5 text-[13px]",
      right ? "text-right" : "text-left",
      className,
    )}>
      {children}
    </td>
  );
}
