import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  Receipt,
  FileText,
  Truck,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Pill,
  PackagePlus,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";
import { UpdatePill } from "@/components/UpdateCenter";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "pharmacist"] },
  { to: "/purchase-orders", label: "Purchases", icon: PackagePlus, roles: ["admin", "pharmacist"] },
  { to: "/purchase-returns", label: "Purchase Returns", icon: RotateCcw, roles: ["admin", "pharmacist"] },
  { to: "/billing", label: "New Bill", icon: Receipt, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/daily-sales", label: "Daily Sales", icon: BookOpen, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/invoices", label: "Invoices", icon: FileText, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/patients", label: "Patients", icon: Users, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/distributors", label: "Distributors", icon: Truck, roles: ["admin", "pharmacist"] },
  { to: "/customers", label: "Customers", icon: Users, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "pharmacist"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, roles: ["admin", "cashier", "pharmacist"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loadingScreen, setLoadingScreen] = useState(false);
  const [loadingText, setLoadingText] = useState("Dashboard");
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
  
        const closeBtn = document.querySelector(
          '[data-radix-dialog-content] button[aria-label="Close"]'
        );

        if (closeBtn) closeBtn.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  
 useEffect(() => {
   const currentPage =
    nav.find((n) => n.to === location.pathname)?.label ||
    "Module";

   setLoadingText(currentPage);
   setLoadingScreen(true);

   const timer = setTimeout(() => {
    setLoadingScreen(false);
   }, 250);

   return () => clearTimeout(timer);
  }, [location.pathname]); 

  const role = user?.role || "cashier";
  const visibleNav = nav.filter((n) => n.roles.includes(role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarContent = (
    <>
      {/* BRAND */}
      <div className="sidebar-branding px-5 py-5">
        <BrandLogo compact light className="sidebar-brand-logo" />
        {user?.demo_mode && <div className="mt-3 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-200" data-testid="demo-mode-badge">Demo Mode</div>}
      </div>

      {/* NAV */}
      <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
        {visibleNav.map((n) => {
          const Icon = n.icon;

          const active =
            location.pathname === n.to ||
            (n.to !== "/" && location.pathname.startsWith(n.to));

          return (
            <Link
             key={n.to}
             to={n.to}
             onClick={() => setOpen(false)}
             data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
             className={`sidebar-nav-link ${active ? "sidebar-nav-link--active" : ""}`}
            >
             <Icon className="w-4 h-4" strokeWidth={1.75} />
             <span>{n.label}</span>

             {active && (
              <span className="sidebar-nav-indicator" />
             )}
            </Link>
          );
        })}
      </nav>

      <UpdatePill />

      {/* FOOTER */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="text-xs text-slate-400">{user?.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          {user?.role}
        </div>

        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 px-2 h-8 transition-all"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen app-canvas flex">
      {loadingScreen && (
    <div className="fixed inset-0 z-[999] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">

    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black opacity-100" />

    <div className="relative z-10 flex flex-col items-center">

      <div className="mb-8 relative">
        <div className="w-16 h-16 rounded-full border border-blue-500/30" />

        <div className="absolute inset-0 rounded-full border-t-2 border-blue-400 animate-spin" />
      </div>

      <div className="text-blue-100 text-xl tracking-wide font-light">
        Loading {loadingText}
      </div>

      <div className="mt-3 text-slate-500 text-sm tracking-[0.3em] uppercase">
        Please Wait
      </div>
    </div>
  </div>
)}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-60 sidebar-premium flex-col fixed inset-y-0 left-0">
        {SidebarContent}
      </aside>

      {/* MOBILE SIDEBAR */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-slate-900/50 z-40"
            onClick={() => setOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-60 sidebar-premium z-50 flex flex-col">
            {SidebarContent}
          </aside>
        </>
      )}

      {/* MAIN */}
      <main className="flex-1 md:ml-60 min-h-screen">
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="p-1"
            data-testid="mobile-menu-btn"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="font-heading font-bold text-emerald-950">PharmacyOS</div>

          <div className="w-7" />
        </header>

        <div
         key={location.pathname}
         className="p-4 md:p-8 page-transition"
        >
         {children}
        </div>
      </main>
    </div>
  );
}
