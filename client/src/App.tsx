import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import AppShell from "@/components/AppShell";
import LivePage from "./pages/live";
import PaperPage from "./pages/paper";
import MarketsPage from "./pages/markets";
import SymbolPage from "./pages/symbol";
import ActivityPage from "./pages/activity";
import SettingsPage from "./pages/settings";
import NotFound from "./pages/not-found";

function LegacySymbolRedirect({ params }: { params: { symbol: string } }) {
  return <Redirect to={`/markets/${params.symbol}`} replace />;
}

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <AppShell>
        <Switch>
          <Route path="/">{() => <Redirect to="/paper" replace />}</Route>
          <Route path="/live" component={LivePage} />
          <Route path="/paper" component={PaperPage} />
          <Route path="/markets" component={MarketsPage} />
          <Route path="/markets/:symbol" component={SymbolPage} />
          <Route path="/activity" component={ActivityPage} />
          <Route path="/settings" component={SettingsPage} />
          {/* Legacy routes from previous UI versions */}
          <Route path="/market">{() => <Redirect to="/markets" replace />}</Route>
          <Route path="/market/:symbol" component={LegacySymbolRedirect} />
          <Route path="/analyze/:symbol" component={LegacySymbolRedirect} />
          <Route path="/journal">{() => <Redirect to="/paper" replace />}</Route>
          <Route path="/compare">{() => <Redirect to="/paper" replace />}</Route>
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
