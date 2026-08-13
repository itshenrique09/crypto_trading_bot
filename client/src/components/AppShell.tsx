import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Banknote, FlaskConical, CandlestickChart, Radio, Settings2, Bot, AlertTriangle,
} from "lucide-react";
import { usePaperStatus, useLiveStatus } from "@/lib/api";
import { startSse, useSseConnected } from "@/lib/sse";
import { fmtUsd, ago } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Bot;
  /** Active-state colour class. */
  activeCls: string;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Trading",
    items: [
      { href: "/live", label: "Live", icon: Banknote, activeCls: "bg-warn/10 text-warn" },
      { href: "/paper", label: "Paper", icon: FlaskConical, activeCls: "bg-accent/12 text-accent" },
    ],
  },
  {
    title: "Mercado",
    items: [
      { href: "/markets", label: "Mercados", icon: CandlestickChart, activeCls: "bg-accent/12 text-accent" },
    ],
  },
  {
    title: "Bot",
    items: [
      { href: "/activity", label: "Atividade", icon: Radio, activeCls: "bg-accent/12 text-accent" },
      { href: "/settings", label: "Definições", icon: Settings2, activeCls: "bg-accent/12 text-accent" },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);

function isActive(location: string, href: string) {
  return location === href || location.startsWith(`${href}/`);
}

function EngineDot({ on, tone = "up" }: { on: boolean; tone?: "up" | "warn" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        on ? (tone === "warn" ? "bg-warn pulse-dot" : "bg-up pulse-dot") : "bg-muted-foreground/40",
      )}
    />
  );
}

function EngineStatus() {
  const { data: paper } = usePaperStatus();
  const { data: live } = useLiveStatus();

  return (
    <div className="mx-3 mb-3 rounded-lg border border-border bg-card-2/60 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-muted-foreground">
          <EngineDot on={!!paper?.running} /> Paper
        </span>
        <span className={paper?.running ? "text-foreground" : "text-muted-foreground"}>
          {paper ? (paper.running ? "a correr" : "parado") : "…"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-muted-foreground">
          <EngineDot on={!!live?.running} tone="warn" /> Live
        </span>
        <span className={live?.running ? "text-warn" : "text-muted-foreground"}>
          {live ? (live.running ? "a correr" : live.hasKeys ? "parado" : "sem chaves") : "…"}
        </span>
      </div>
      {live?.unmanagedPositions ? (
        <Link href="/live" className="flex items-center gap-1.5 text-down hover:underline">
          <AlertTriangle className="h-3 w-3" /> {live.unmanagedPositions} posição(ões) não gerida(s)
        </Link>
      ) : null}
      {paper?.lastScan && (
        <div className="flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
          <span>Último scan</span>
          <span>{ago(paper.lastScan)}</span>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { data: live } = useLiveStatus();
  const { data: paper } = usePaperStatus();
  const sseConnected = useSseConnected();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-end gap-4 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <span
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
        title={sseConnected
          ? "Ligado ao servidor — atualizações em tempo real (SSE)"
          : "Sem stream — a atualizar por polling até a ligação voltar"}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", sseConnected ? "bg-up pulse-dot" : "bg-muted-foreground/40")} />
        {sseConnected ? "tempo real" : "polling"}
      </span>
      {live?.account && (
        <Link href="/live" className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[11px] uppercase tracking-wider text-warn/80">Live</span>
          <span className="num text-sm">{fmtUsd(live.account.equity)}</span>
        </Link>
      )}
      {paper?.capital && (
        <Link href="/paper" className="flex items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-accent/80">Paper</span>
          <span className="num text-sm">{fmtUsd(paper.capital.balance)}</span>
        </Link>
      )}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            live?.running ? "bg-warn/10 text-warn" : "bg-muted text-muted-foreground/60",
          )}
          title={live?.running ? "Live engine a correr" : "Live engine parado"}
        >
          Live
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            paper?.running ? "bg-accent/12 text-accent" : "bg-muted text-muted-foreground/60",
          )}
          title={paper?.running ? "Paper engine a correr" : "Paper engine parado"}
        >
          Paper
        </span>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  useEffect(() => { startSse(); }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-card md:flex">
        <Link href="/paper" className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Bot className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">CryptoTrader Pro</span>
        </Link>

        <nav className="flex-1 space-y-4 px-3 pt-1">
          {NAV_GROUPS.map(group => (
            <div key={group.title}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, activeCls }) => {
                  const active = isActive(location, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors",
                        active
                          ? `${activeCls} font-medium`
                          : "text-muted-foreground hover:bg-card-2 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <EngineStatus />
      </aside>

      {/* Main column */}
      <div className="md:pl-56">
        <TopBar />
        <main className="pb-20 md:pb-6">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-card md:hidden">
        {ALL_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(location, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px]",
                active ? (href === "/live" ? "text-warn" : "text-accent") : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
