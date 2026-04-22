import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LayoutDashboard, FlaskConical, BarChart3, GitCompareArrows, Bot, Circle, Zap } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/paper", label: "Trades", icon: FlaskConical },
  { path: "/market", label: "Market", icon: BarChart3 },
  { path: "/compare", label: "Compare", icon: GitCompareArrows },
];

function formatAgo(iso?: string | null): string {
  if (!iso) return "never";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 0 || !Number.isFinite(secs)) return "never";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function EngineStatusPill() {
  const { data: paperStatus } = useQuery<any>({
    queryKey: ["/api/paper/status"],
    queryFn: async () => (await apiRequest("GET", "/api/paper/status")).json(),
    refetchInterval: 10000,
  });
  const { data: liveStatus } = useQuery<any>({
    queryKey: ["/api/live/status"],
    queryFn: async () => (await apiRequest("GET", "/api/live/status")).json(),
    refetchInterval: 10000,
  });

  const liveRunning  = liveStatus?.running;
  const paperRunning = paperStatus?.running;
  const lastScan = liveRunning ? liveStatus?.lastScan : paperStatus?.lastScan;

  if (liveRunning) {
    return (
      <div className="flex flex-col gap-1 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30">
        <div className="flex items-center gap-1.5">
          <Circle className="w-1.5 h-1.5 fill-amber-400 text-amber-400 animate-pulse" />
          <span className="text-[10px] font-bold text-amber-400 tracking-wide">LIVE</span>
          <span className="text-[9px] text-amber-400/60 ml-auto">{formatAgo(lastScan)}</span>
        </div>
        <p className="text-[9px] text-amber-400/70 leading-none">Real capital · {liveStatus.openTrades ?? 0} open</p>
      </div>
    );
  }

  if (paperRunning) {
    return (
      <div className="flex flex-col gap-1 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30">
        <div className="flex items-center gap-1.5">
          <Circle className="w-1.5 h-1.5 fill-emerald-400 text-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 tracking-wide">PAPER</span>
          <span className="text-[9px] text-emerald-400/60 ml-auto">{formatAgo(lastScan)}</span>
        </div>
        <p className="text-[9px] text-emerald-400/70 leading-none">Simulation · next scan {paperStatus?.coinsScanned ?? 0}c/3min</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-card/40 border border-border/20">
      <Circle className="w-1.5 h-1.5 text-muted-foreground/40" />
      <span className="text-[10px] text-muted-foreground/70">Engine stopped</span>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.path === "/") return location === "/";
    return location.startsWith(item.path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[200px] flex-col z-50 bg-background border-r border-border/30">
        {/* Logo */}
        <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 px-5 h-14 border-b border-border/20 shrink-0 hover:bg-card/30 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-bold tracking-tight">CryptoBot</span>
        </button>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = isActive(item);
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  active
                    ? "bg-purple-500/15 text-purple-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <item.icon className={`w-4 h-4 ${active ? "text-purple-400" : ""}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer: engine status + quick link to settings */}
        <div className="px-3 py-3 border-t border-border/20 space-y-2">
          <EngineStatusPill />
          <button
            onClick={() => setLocation("/paper")}
            className="w-full flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors px-1"
          >
            <Zap className="w-3 h-3" />
            <span>Configure live trading</span>
          </button>
        </div>
      </aside>

      {/* Page Content — offset for sidebar on desktop */}
      <main className="md:ml-[200px] pb-20 md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Mobile Bottom Bar — taller touch targets (WCAG min 44px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur-xl border-t border-border/40 flex items-center justify-around z-50 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 min-w-[56px] min-h-[48px] transition-all ${
                active ? "text-purple-400" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
