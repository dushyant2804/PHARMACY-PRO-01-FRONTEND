import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Package, Receipt, FileText, Truck, Users,
  BarChart3, Settings as SettingsIcon, LogOut, Menu, X, Pill, PackagePlus, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "pharmacist"] },
  { to: "/purchase-orders", label: "Purchases", icon: PackagePlus, roles: ["admin", "pharmacist"] },
  { to: "/billing", label: "New Bill", icon: Receipt, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/daily-sales", label: "Daily Sales", icon: BookOpen, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/patients", label: "Patients", icon: Users, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/distributors", label: "Distributors", icon: Truck, roles: ["admin", "pharmacist"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "pharmacist"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
  const handleKeyDown = (e) => {
    // Esc → close any open dialog
    if (e.key === "Escape") {
      // close sidebar if open
      setOpen(false);

      // close any dialog in app
      const closeBtn = document.querySelector(
        '[data-radix-dialog-content] button[aria-label="Close"]'
      );

      if (closeBtn) {
        closeBtn.click();
      }
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, []);

  const role = user?.role || "cashier";
  const visibleNav = nav.filter((n) => n.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-sm">
          <Pill className="w-5 h-5 text-white" strokeWidth={1.75} />
        </div>
        <div>
          <div className="font-heading font-bold text-white text-base leading-none">MedStock</div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-400 mt-0.5">Pharmacy OS</div>
        </div>
      </div>
      <nav className="px-3 py-4 space-y-0.5 flex-1 overflow-y-auto">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={`sidebar-link ${active ? "active" : ""}`}
              data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="text-xs text-slate-400">{user?.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{user?.role}</div>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 px-2 h-8"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4 mr-2" />Log out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-slate-900 flex-col fixed inset-y-0 left-0">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <>
          <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40" onClick={() => setOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 w-60 bg-slate-900 z-50 flex flex-col">
            {SidebarContent}
          </aside>
        </>
      )}

      <main className="flex-1 md:ml-60 min-h-screen">
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setOpen(true)} className="p-1" data-testid="mobile-menu-btn">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="font-heading font-bold text-slate-900">MedStock</div>
          <div className="w-7" />
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
