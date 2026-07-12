import "@/App.css";

import React, { Suspense, lazy, useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import { Toaster } from "sonner";

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
import PurchaseOrders from "@/pages/PurchaseOrders";
import PurchaseOrderDetail from "@/pages/PurchaseOrderDetail";
import PurchaseReturns from "@/pages/PurchaseReturns";
import RegisterPage from "@/pages/register/RegisterPage";
import DailyClosing from "@/pages/DailyClosing";
import Patients from "@/pages/Patients";
import Onboarding from "@/pages/Onboarding";

import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import UpdateCenter from "@/components/UpdateCenter";
import { getApiMode, isLocalApiUrl, getApiBaseUrl } from "@/lib/api";

const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));

function LazyPageFallback() {
  return <div className="rounded-sm border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading module…</div>;
}

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

  return (
    <Layout>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </Layout>
  );
}


function App() {
  useEffect(() => {
    const applyModeClass = () => {
      const local = getApiMode() === "local";
      document.body.classList.toggle("local-performance-mode", local);
      if (local && !isLocalApiUrl(getApiBaseUrl("local"))) {
        console.error("Local Mode API must resolve to localhost.");
      }
    };
    applyModeClass();
    window.addEventListener("storage", applyModeClass);
    return () => window.removeEventListener("storage", applyModeClass);
  }, []);

  return (
    <div className="App">
      <AuthProvider>
        <UpdateCenter>
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
              path="/register"
              element={
                <Protected>
                  <RegisterPage />
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
                  <Suspense fallback={<LazyPageFallback />}>
                    <Reports />
                  </Suspense>
                </Protected>
              }
            />

            <Route
              path="/settings"
              element={
                <Protected>
                  <Suspense fallback={<LazyPageFallback />}>
                    <Settings />
                  </Suspense>
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
        </UpdateCenter>
      </AuthProvider>
    </div>
  );
}

export default App;
