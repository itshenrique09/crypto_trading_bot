import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import AppLayout from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import PaperTradingPage from "./pages/PaperTradingPage";
import JournalPage from "./pages/JournalPage";
import ScannerPage from "./pages/ScannerPage";
import AnalysisPage from "./pages/AnalysisPage";
import ComparePage from "./pages/ComparePage";
import NotFound from "./pages/not-found";

function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/paper" component={PaperTradingPage} />
          <Route path="/market" component={ScannerPage} />
          <Route path="/market/:symbol" component={AnalysisPage} />
          <Route path="/analyze/:symbol" component={AnalysisPage} />
          <Route path="/compare" component={ComparePage} />
          <Route path="/journal" component={JournalPage} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
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
