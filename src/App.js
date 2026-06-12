import "@/App.css";

import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";

import { useState, useEffect } from "react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import { Toaster } from "sonner";

/* 🌅 NEW */
import WelcomeScreen from "@/components/WelcomeScreen";

import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import PasswordExpired from "@/pages/PasswordExpired";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import StockAdjustments from "@/pages/StockAdjustments";
import Billing from "@/pages/Billing";
import Invoices from "@/pages/Invoices";
import InvoiceDetail from "@/pages/InvoiceDetail";
import Distributors from "@/pages/Distributors";
import Customers from "@/pages/Customers";
import Ledger from "@/pages/Ledger";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import PurchaseOrders from "@/pages/PurchaseOrders";
import PurchaseOrderDetail from "@/pages/PurchaseOrderDetail";
import PurchaseReturns from "@/pages/PurchaseReturns";
import DailySales from "@/pages/DailySales";
import DailyClosing from "@/pages/DailyClosing";
import Patients from "@/pages/Patients";
import Onboarding from "@/pages/Onboarding";

import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteLoader from "@/components/RouteLoader";
import UpdateCenter from "@/components/UpdateCenter";
import { useLocation } from "react-router-dom";

function NotFound() {
  return (
    <div
      className="bg-white border border-slate-200 rounded-sm p-12 text-center"
      data-testid="not-found-page"
    >
      <div className="font-heading text-3xl font-bold text-slate-900">
        404
      </div>

      <p className="text-sm text-slate-600 mt-2">
        The page you're looking for doesn't exist.
      </p>

      <Link
        to="/"
        className="inline-block mt-4 px-4 py-2 rounded-sm bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading, passwordExpired } = useAuth();
  const location = useLocation();

  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem("welcomeEnabled") !== "false" && !sessionStorage.getItem("welcome-shown"));
  const [showRouteLoader, setShowRouteLoader] = useState(false);

  // LOGIN WELCOME (5 sec only once per session)
  useEffect(() => {
    if (user) {
      const enabled = localStorage.getItem("welcomeEnabled") !== "false";
      const seen = sessionStorage.getItem("welcome-shown");

      if (!enabled || seen) {
        setShowWelcome(false);
        return;
      }

      setShowWelcome(true);

      const t = setTimeout(() => {
        setShowWelcome(false);
        sessionStorage.setItem("welcome-shown", "true");
      }, 5000);

      return () => clearTimeout(t);
    }
  }, [user]);

  // ROUTE CHANGE LOADER (2–3 sec every navigation)
  useEffect(() => {
    if (!user) return;

    setShowRouteLoader(true);

    const t = setTimeout(() => {
      setShowRouteLoader(false);
    }, 2500);

    return () => clearTimeout(t);
  }, [location.pathname, user]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (passwordExpired) {
    return <Navigate to="/password-expired" replace />;
  }

  if (showWelcome) {
    return <WelcomeScreen onFinish={() => setShowWelcome(false)} />;
  }

return (
  <Layout>
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  </Layout>
);
}


function App() {
  return (
    <div className="App">
      <UpdateCenter>
      <AuthProvider>
         <HashRouter>
          <Toaster position="top-right" richColors />

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Onboarding />} />
            <Route path="/verify-otp" element={<Onboarding initialStep={2} />} />
            <Route path="/pharmacy-setup" element={<Onboarding initialStep={3} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/password-expired" element={<PasswordExpired />} />

            <Route
              path="/"
              element={
                <Protected>
                  <Dashboard />
                </Protected>
              }
            />

            <Route
              path="/inventory"
              element={
                <Protected>
                  <Inventory />
                </Protected>
              }
            />

            <Route
              path="/stock-adjustments"
              element={
                <Protected>
                  <StockAdjustments />
                </Protected>
              }
            />

            <Route
              path="/billing"
              element={
                <Protected>
                  <Billing />
                </Protected>
              }
            />

            <Route
              path="/invoices"
              element={
                <Protected>
                  <Invoices />
                </Protected>
              }
            />

            <Route
              path="/invoices/:id"
              element={
                <Protected>
                  <InvoiceDetail />
                </Protected>
              }
            />

            <Route
              path="/distributors"
              element={
                <Protected>
                  <Distributors />
                </Protected>
              }
            />

            <Route
              path="/customers"
              element={
                <Protected>
                  <Customers />
                </Protected>
              }
            />

            <Route
              path="/purchase-orders"
              element={
                <Protected>
                  <PurchaseOrders />
                </Protected>
              }
            />

            <Route
              path="/purchase-orders/:id"
              element={
                <Protected>
                  <PurchaseOrderDetail />
                </Protected>
              }
            />

            <Route
              path="/purchase-returns"
              element={
                <Protected>
                  <PurchaseReturns />
                </Protected>
              }
            />

            <Route
              path="/daily-sales"
              element={
                <Protected>
                  <DailySales />
                </Protected>
              }
            />

            <Route
              path="/daily-closing"
              element={
                <Protected>
                  <DailyClosing />
                </Protected>
              }
            />

            <Route
              path="/patients"
              element={
                <Protected>
                  <Patients />
                </Protected>
              }
            />

            <Route
              path="/ledger/:type/:id"
              element={
                <Protected>
                  <Ledger />
                </Protected>
              }
            />

            <Route
              path="/reports"
              element={
                <Protected>
                  <Reports />
                </Protected>
              }
            />

            <Route
              path="/settings"
              element={
                <Protected>
                  <Settings />
                </Protected>
              }
            />

            <Route
              path="*"
              element={
                <Protected>
                  <NotFound />
                </Protected>
              }
            />
          </Routes>
        </HashRouter>
      </AuthProvider>
      </UpdateCenter>
    </div>
  );
}

export default App;
