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
  PackagePlus,
  BookMarked,
  RotateCcw,
  SlidersHorizontal,
  CalendarCheck2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LayoutContext } from "@/contexts/LayoutContext";
import api, { getApiMode, getLocalBackendUrl } from "@/lib/api";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/inventory", label: "Inventory", icon: Package, roles: ["admin", "pharmacist"] },
  { to: "/stock-adjustments", label: "Stock Adjustments", icon: SlidersHorizontal, roles: ["admin", "pharmacist"] },
  { to: "/purchase-orders", label: "Purchases", tooltipLabel: "Purchase Orders", icon: PackagePlus, roles: ["admin", "pharmacist"] },
  { to: "/purchase-returns", label: "Purchase Returns", icon: RotateCcw, roles: ["admin", "pharmacist"] },
  { to: "/billing", label: "New Bill", icon: Receipt, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/register", label: "Register", icon: BookMarked, roles: ["admin", "cashier", "pharmacist"] },
  { to: "/daily-closing", label: "Daily Closing", icon: CalendarCheck2, roles: ["admin", "cashier", "pharmacist"] },
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
  const [inspectorMode, setInspectorMode] = useState(false);
  const [exitBackupOpen, setExitBackupOpen] = useState(false);
  const [exitBackupAttempted, setExitBackupAttempted] = useState(false);
  const [exitBackupRunning, setExitBackupRunning] = useState(false);
  const [localBackendConnected, setLocalBackendConnected] = useState(() => getApiMode() !== "local");
  const [lastBackupTime, setLastBackupTime] = useState(() => localStorage.getItem("pharmacyos_last_backup_time") || "—");

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (getApiMode() === "local" && !exitBackupAttempted) {
        event.preventDefault();
        event.returnValue = "Backup your data before exit";
        setExitBackupOpen(true);
        return event.returnValue;
      }
      return undefined;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        const closeBtn = document.querySelector('[data-radix-dialog-content] button[aria-label="Close"]');
        if (closeBtn) closeBtn.click();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [exitBackupAttempted]);


  useEffect(() => {
    if (getApiMode() !== "local") return undefined;

    let cancelled = false;
    const normalizedUrl = () => (getLocalBackendUrl() || "http://localhost:8000").trim().replace(/\/$/, "");
    const healthEndpoints = () => {
      const baseUrl = normalizedUrl();
      return [`${baseUrl}/api/health`, `${baseUrl}/health`, `${baseUrl}/api/backup/health`, `${baseUrl}/api/backup/status`];
    };

    const checkLocalBackend = async () => {
      for (const endpoint of healthEndpoints()) {
        try {
          const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}t=${Date.now()}`, {
            method: "GET",
            credentials: "include",
            headers: { "Cache-Control": "no-store" },
          });
          if (response.ok) {
            if (!cancelled) setLocalBackendConnected(true);
            return;
          }
        } catch {
          // Try the next known Local Desktop health endpoint before showing an offline state.
        }
      }
      if (!cancelled) setLocalBackendConnected(false);
    };

    const handleLocalBackendDisconnected = () => setLocalBackendConnected(false);
    const handleStorage = (event) => {
      if (event.key === "pharmacyos_last_backup_time") setLastBackupTime(event.newValue || "—");
    };

    checkLocalBackend();
    const intervalId = window.setInterval(checkLocalBackend, 15000);
    window.addEventListener("pharmacyos:local-backend-disconnected", handleLocalBackendDisconnected);
    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("pharmacyos:local-backend-disconnected", handleLocalBackendDisconnected);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const role = user?.role || "cashier";
  const visibleNav = nav.filter((n) => n.roles.includes(role));

  const businessName = user?.business_name || user?.businessName || user?.pharmacy_name || user?.pharmacyName || "SHREE SHYAM PHARMACY";
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Admin";

  const runExitBackup = async ({ exitAfter = false } = {}) => {
    setExitBackupRunning(true);
    setExitBackupAttempted(true);
    try {
      const { data = {} } = await api.post("/backup/run", { reason: "app_exit", targets: ["mongodb_atlas", "google_drive"] });
      const cloudPending = [data.atlas_backup_status, data.mongodb_atlas_status, data.google_drive_backup_status, data.drive_backup_status, data.cloud_sync_status]
        .some((value) => String(value || "").toLowerCase().includes("pending"));
      const backupTime = data.last_backup_time || data.last_backup_at || new Date().toISOString();
      localStorage.setItem("pharmacyos_last_backup_time", backupTime);
      setLastBackupTime(backupTime);
      toast[cloudPending ? "warning" : "success"](cloudPending ? "Saved locally. Cloud backup pending." : "Backup completed before exit.");
      if (exitAfter) {
        await logout();
        navigate("/login");
      }
    } catch {
      toast.warning("Saved locally. Cloud backup pending.");
      if (exitAfter) {
        await logout();
        navigate("/login");
      }
    } finally {
      setExitBackupRunning(false);
    }
  };

  const handleLogout = async () => {
    if (getApiMode() === "local" && !exitBackupAttempted) {
      setExitBackupOpen(true);
      return;
    }
    await logout();
    navigate("/login");
  };

  const renderTaskbarLink = (n) => {
    const Icon = n.icon;
    const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
    const tooltipLabel = n.tooltipLabel || n.label;
    return (
      <Link
        key={n.to}
        to={n.to}
        onClick={() => setOpen(false)}
        data-testid={`nav-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
        aria-label={tooltipLabel}
        title={tooltipLabel}
        className={`taskbar-icon ${active ? "taskbar-icon--active" : ""}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.85} />
        <span className="taskbar-tooltip" role="tooltip">{tooltipLabel}</span>
      </Link>
    );
  };

  const localBackendStatusLabel = localBackendConnected ? "Connected" : "Disconnected";
  const localModeDetailText = localBackendConnected
    ? `localhost connected • Last backup: ${lastBackupTime}`
    : "Local PharmacyOS server stopped. Please restart PharmacyOS.";

  const taskbar = (
    <nav className="counter-taskbar" aria-label="Primary modules">
      <div className="counter-taskbar-scroll">{visibleNav.map(renderTaskbarLink)}</div>
      {getApiMode() === "local" && (
        <div
          className={`local-mode-badge ${localBackendConnected ? "local-mode-badge--connected" : "local-mode-badge--offline"}`}
          data-testid="local-mode-badge"
          tabIndex={0}
          aria-label={`Local Mode ${localBackendStatusLabel}. ${localModeDetailText}`}
          title={`Local Mode ${localBackendStatusLabel}. ${localModeDetailText}`}
        >
          <span className="local-mode-badge-main">Local Mode</span>
          <span className="local-mode-badge-dot" aria-hidden="true">●</span>
          <span className="local-mode-badge-status">{localBackendStatusLabel}</span>
          <span className="local-mode-popover" role="tooltip">
            <span>localhost status: {localBackendStatusLabel}</span>
            <span>Last backup: {lastBackupTime}</span>
          </span>
        </div>
      )}
      <div className="counter-account" aria-label="Current account">
        <div className="counter-account-avatar" aria-hidden="true"><UserRound className="h-5 w-5" strokeWidth={2} /></div>
        <div className="counter-account-text">
          <div className="counter-account-name">{businessName}</div>
          <div className="counter-account-role">{roleLabel}</div>
        </div>
        <Button onClick={handleLogout} variant="ghost" aria-label="Log out" title="Log out" className="taskbar-icon taskbar-icon--logout h-10 w-10 p-0" data-testid="logout-btn">
          <LogOut className="h-5 w-5" />
          <span className="taskbar-tooltip" role="tooltip">Log out</span>
        </Button>
      </div>
    </nav>
  );

  return (
    <LayoutContext.Provider value={{ inspectorMode, setInspectorMode }}>
      <div className="min-h-screen app-canvas counter-layout">
        {!inspectorMode && taskbar}
        <main className="counter-main min-h-screen flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <button onClick={() => setOpen((value) => !value)} className="p-1" data-testid="mobile-menu-btn">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="font-heading font-bold text-emerald-950">PharmacyOS</div>
            <div className="w-7" />
          </header>

          {open && (
            <div className="border-b border-emerald-100 bg-white/95 px-3 py-2 shadow-sm md:hidden">
              <div className="grid grid-cols-7 gap-2">{visibleNav.map(renderTaskbarLink)}</div>
            </div>
          )}

          <div key={location.pathname} className="app-page page-transition p-3 md:p-3 xl:p-4 2xl:p-6">
            {children}
          </div>
        </main>
      </div>
      <Dialog open={exitBackupOpen} onOpenChange={(openValue) => exitBackupAttempted && setExitBackupOpen(openValue)}>
        <DialogContent className="max-w-md rounded-sm" onEscapeKeyDown={(event) => !exitBackupAttempted && event.preventDefault()} onPointerDownOutside={(event) => !exitBackupAttempted && event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Backup your data before exit</DialogTitle>
            <DialogDescription>
              Local Mode requires an attempted local and cloud backup before logout, close, or exit.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Do not allow silent exit if backup has not been attempted. If internet is unavailable, data is saved locally and cloud backup is queued.
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={exitBackupRunning} onClick={() => runExitBackup()}>
              {exitBackupRunning ? "Backing up…" : "Backup Now"}
            </Button>
            <Button type="button" disabled={exitBackupRunning} onClick={() => runExitBackup({ exitAfter: true })} className="bg-emerald-700 hover:bg-emerald-800">
              Exit after backup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </LayoutContext.Provider>
  );
}
