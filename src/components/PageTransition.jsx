import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const routeNames = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/billing": "Billing",
  "/invoices": "Invoices",
  "/distributors": "Distributors",
  "/customers": "Customers",
  "/purchase-orders": "Purchase Orders",
  "/daily-sales": "Daily Sales",
  "/patients": "Patients",
  "/reports": "Reports",
  "/settings": "Settings",
};

export default function PageTransition({ children }) {
  const location = useLocation();
  const [show, setShow] = useState(true);

  const currentTab = routeNames[location.pathname] || "Loading";

  useEffect(() => {
    setShow(false);

    const t = setTimeout(() => {
      setShow(true);
    }, 180);

    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div className="relative">
      {/* CLASSIC TRANSITION LAYER */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500 ${
          show ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="text-center space-y-2">
          
          {/* Classic subtle spinner (not modern flashy) */}
          <div className="w-6 h-6 border border-slate-400 border-t-transparent rounded-full animate-spin mx-auto" />

          {/* Tab name instead of loading text */}
          <div className="text-sm text-slate-600 tracking-wider uppercase">
            {currentTab}
          </div>

          <div className="text-[11px] text-slate-400">
            opening…
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <div
        className={`transition-opacity duration-500 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
