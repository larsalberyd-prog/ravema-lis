import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import CompanyDetail from "@/pages/CompanyDetail";
import Admin from "@/pages/Admin";
import MySales from "@/pages/MySales";
import GrowthGrid from "@/pages/GrowthGrid";
import Activity from "@/pages/Activity";
import TopNav from "@/components/TopNav";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RoleProvider } from "./contexts/RoleContext";

function Router() {
  const [loc] = useLocation();
  const showNav = loc !== "/"; // landningssidan har egen hero, ingen app-nav
  return (
    <>
      {showNav && <TopNav />}
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/company/:id" component={CompanyDetail} />
        <Route path="/admin" component={Admin} />
        <Route path="/my-sales" component={MySales} />
        <Route path="/growth-grid" component={GrowthGrid} />
        <Route path="/activity" component={Activity} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <RoleProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </RoleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
