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
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
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
import DailySales from "@/pages/DailySales";
import Patients from "@/pages/Patients";

import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteLoader from "@/components/RouteLoader";
import { useLocation } from "react-router-dom";
import PageTransition from "@/components/PageTransition";

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
  const { user, loading } = useAuth();
  const location = useLocation();

  const [showWelcome, setShowWelcome] = useState(false);
  const [showRouteLoader, setShowRouteLoader] = useState(false);

  // LOGIN WELCOME (5 sec only once per session)
  useEffect(() => {
    if (user) {
      const seen = sessionStorage.getItem("welcome-shown");

      if (!seen) {
        setShowWelcome(true);

        setTimeout(() => {
          setShowWelcome(false);
          sessionStorage.setItem("welcome-shown", "true");
        }, 5000);
      }
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
  }, [location.pathname]);

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

  if (showWelcome) {
    return <WelcomeScreen onFinish={() => setShowWelcome(false)} />;
  }

return (
  <PageTransition>
    <Layout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Layout>
  </PageTransition>
);
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
         <HashRouter>
          <Toaster position="top-right" richColors />

          <Routes>
            <Route path="/login" element={<Login />} />

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
              path="/daily-sales"
              element={
                <Protected>
                  <DailySales />
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
    </div>
  );
}

export default App;
