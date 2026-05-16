import "@/App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Toaster } from "sonner";
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
import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-12 text-center" data-testid="not-found-page">
      <div className="font-heading text-3xl font-bold text-slate-900">404</div>
      <p className="text-sm text-slate-600 mt-2">The page you're looking for doesn't exist.</p>
      <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-sm bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
        Back to Dashboard
      </Link>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><ErrorBoundary>{children}</ErrorBoundary></Layout>;
}

function KeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {

    const handleKey = (e) => {

      // Ignore typing inside inputs
      const tag = document.activeElement?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {

        case "F1":
          e.preventDefault();
          navigate("/");
          break;

        case "F2":
          e.preventDefault();
          navigate("/inventory");
          break;

        case "F3":
          e.preventDefault();
          navigate("/billing");
          break;

        case "F4":
          e.preventDefault();
          navigate("/invoices");
          break;

        case "F5":
          e.preventDefault();
          navigate("/customers");
          break;

        case "F6":
          e.preventDefault();
          navigate("/distributors");
          break;

        case "F7":
          e.preventDefault();
          navigate("/reports");
          break;

        case "F8":
          e.preventDefault();
          navigate("/purchase-orders");
          break;

        default:
          break;
      }
    };

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKey
      );
    };

  }, [navigate]);

  return null;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
            <Route path="/billing" element={<Protected><Billing /></Protected>} />
            <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
            <Route path="/invoices/:id" element={<Protected><InvoiceDetail /></Protected>} />
            <Route path="/distributors" element={<Protected><Distributors /></Protected>} />
            <Route path="/customers" element={<Protected><Customers /></Protected>} />
            <Route path="/purchase-orders" element={<Protected><PurchaseOrders /></Protected>} />
            <Route path="/purchase-orders/:id" element={<Protected><PurchaseOrderDetail /></Protected>} />
            <Route path="/daily-sales" element={<Protected><DailySales /></Protected>} />
            <Route path="/patients" element={<Protected><Patients /></Protected>} /> 
            <Route path="/ledger/:type/:id" element={<Protected><Ledger /></Protected>} />
            <Route path="/reports" element={<Protected><Reports /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<Protected><NotFound /></Protected>} />
          </Routes>
        </BrowserRouter>
       <KeyboardShortcuts />
      </AuthProvider>
    </div>
  );
}

export default App;
