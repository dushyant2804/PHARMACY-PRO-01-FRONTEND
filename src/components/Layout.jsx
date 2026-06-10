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
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

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
      <div className="px-5 py-5 border-b border-white/10">
        <BrandLogo compact light />
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
             className={`
              relative flex items-center gap-3 px-3 py-2 rounded-sm
              transition-all duration-300 ease-out
              text-sm

              ${
               active
                ? "bg-slate-800 text-white font-medium shadow-[0_0_12px_rgba(59,130,246,0.15)] border-l-2 border-blue-500"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }
            `}
            >
             <Icon className="w-4 h-4" strokeWidth={1.75} />
             <span>{n.label}</span>

             {active && (
              <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
             )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-amber-200/15 bg-gradient-to-br from-white/[.07] to-emerald-400/[.04] p-3 text-white shadow-inner">
        <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">PharmacyOS</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] text-emerald-300">v2.0</span></div>
        <button onClick={() => setUpdateOpen(true)} className="mt-2 flex w-full items-center justify-between text-left text-[11px] text-slate-300"><span><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-300"/>Update available</span><RefreshCw className="h-3 w-3"/></button>
        <button onClick={() => setWhatsNewOpen(true)} className="mt-2 text-[10px] font-semibold text-amber-200/80 hover:text-amber-200">What’s new →</button>
      </div>

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

      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 text-emerald-700"/>New update available</DialogTitle></DialogHeader><p className="text-sm leading-6 text-slate-600">Refresh to load latest features and improvements.<br/>Your pharmacy data will remain safe.</p><div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><b>Refresh</b> reloads data. <b>Update</b> loads the newest deployed PharmacyOS frontend.</div><Button onClick={() => window.location.reload()} className="bg-emerald-900 hover:bg-emerald-800">Update PharmacyOS</Button></DialogContent></Dialog>
      <Dialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 text-amber-600"/>What’s new in PharmacyOS</DialogTitle></DialogHeader><div className="space-y-3 text-sm">{[["New features","Pharmacy intelligence reports, onboarding, and update center."],["Improvements","Premium workspace, responsive charts, and faster navigation."],["Fixes","Clearer refresh behavior and refined mobile layouts."]].map(([a,b])=><div key={a} className="rounded-xl border bg-slate-50 p-3"><b>{a}</b><p className="mt-1 text-xs text-slate-500">{b}</p></div>)}</div></DialogContent></Dialog>
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
