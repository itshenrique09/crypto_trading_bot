import { useLocation } from "wouter";
import { LayoutDashboard, FlaskConical, BarChart3, GitCompareArrows, Bot } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/paper", label: "Trades", icon: FlaskConical },
  { path: "/market", label: "Market", icon: BarChart3 },
  { path: "/compare", label: "Compare", icon: GitCompareArrows },
];

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

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground/50">Paper Trading Bot</p>
        </div>
      </aside>

      {/* Page Content — offset for sidebar on desktop */}
      <main className="md:ml-[200px] pb-16 md:pb-0 min-h-screen">
        {children}
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-xl border-t border-border/40 flex items-center justify-around z-50">
        {NAV_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-all ${
                active ? "text-purple-400" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
