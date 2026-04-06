import { useLocation } from "wouter";
import { Activity, FlaskConical, BarChart3, GitCompareArrows, Bot } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: Activity },
  { path: "/paper", label: "Paper Trading", icon: FlaskConical },
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
      {/* Desktop Top Navigation Bar — hidden on mobile */}
      <header className="hidden sm:block sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/40">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center h-12">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 mr-8 shrink-0">
            <Bot className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-bold tracking-tight">CryptoBot</span>
          </button>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const active = isActive(item);
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-purple-500/15 text-purple-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="pb-16 sm:pb-4">
        {children}
      </main>

      {/* Mobile Bottom Bar — only on mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-xl border-t border-border/40 flex items-center justify-around z-50">
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
