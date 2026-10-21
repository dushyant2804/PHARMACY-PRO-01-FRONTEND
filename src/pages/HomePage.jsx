import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getApiMode } from "@/lib/api";
import {
  Activity, BookOpen, Boxes, ClipboardList, FileBarChart2,
  FileText, Home, Receipt, Settings, ShieldCheck,
  ShoppingCart, Truck, Users,
} from "lucide-react";

const MODULES = [
  { label: "Dashboard", description: "Monthly financial overview and alerts", path: "/dashboard", icon: Activity, tone: "bg-emerald-50 text-emerald-700" },
  { label: "Register", description: "Daily sales, collection and expenses", path: "/register", icon: BookOpen, tone: "bg-blue-50 text-blue-700" },
  { label: "New Bill", description: "Create a customer bill", path: "/billing", icon: Receipt, tone: "bg-violet-50 text-violet-700" },
  { label: "Inventory", description: "Stock, batches and expiry dates", path: "/inventory", icon: Boxes, tone: "bg-amber-50 text-amber-700" },
  { label: "Purchase Orders", description: "Distributor purchases and returns", path: "/purchase-orders", icon: ShoppingCart, tone: "bg-orange-50 text-orange-700" },
  { label: "Customers", description: "Customer records and dues", path: "/customers", icon: Users, tone: "bg-cyan-50 text-cyan-700" },
  { label: "Distributors", description: "Supplier accounts and balances", path: "/distributors", icon: Truck, tone: "bg-rose-50 text-rose-700" },
  { label: "Invoices", description: "Issued bills and invoice history", path: "/invoices", icon: FileText, tone: "bg-indigo-50 text-indigo-700" },
  { label: "Reports", description: "Business reports and analytics", path: "/reports", icon: FileBarChart2, tone: "bg-teal-50 text-teal-700" },
  { label: "Daily Closing", description: "Cash reconciliation and closing", path: "/daily-closing", icon: ClipboardList, tone: "bg-slate-100 text-slate-700" },
  { label: "Patients", description: "Patient profiles and refill alerts", path: "/patients", icon: Users, tone: "bg-lime-50 text-lime-700" },
  { label: "Settings", description: "Application and pharmacy settings", path: "/settings", icon: Settings, tone: "bg-slate-100 text-slate-700" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const businessName = user?.business_name || user?.businessName || user?.pharmacy_name || user?.pharmacyName || "Your Pharmacy";
  const userName = user?.name || user?.full_name || user?.fullName || user?.username || "there";
  const localMode = getApiMode() === "local";
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="mx-auto max-w-7xl space-y-8 pb-8" data-testid="pharmacyos-home">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl md:p-10">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border-[32px] border-white/5" />
        <div className="pointer-events-none absolute bottom-[-100px] right-[25%] h-52 w-52 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
              <Home className="h-3.5 w-3.5" /> PharmacyOS workspace
            </div>
            <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-4xl">{greeting}, {userName}</h1>
            <p className="mt-2 text-lg font-semibold text-emerald-100">{businessName}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100/80">Your pharmacy workspace is ready. Choose a module to get started, or open the dashboard for a quick business overview.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <span className={`h-2.5 w-2.5 rounded-full ${localMode ? "bg-emerald-300" : "bg-sky-300"}`} />
            <div>
              <p className="text-sm font-bold">{localMode ? "Local Mode" : "Connected Mode"}</p>
              <p className="text-xs text-emerald-100/75">{localMode ? "Running with local data" : "Connected application mode"}</p>
            </div>
            <ShieldCheck className="ml-2 h-5 w-5 text-emerald-200" />
          </div>
        </div>
        <div className="relative mt-7 flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate("/dashboard")} className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-emerald-950 shadow transition hover:bg-emerald-50">Open Dashboard <Activity className="ml-2 inline h-4 w-4" /></button>
          <button type="button" onClick={() => navigate("/register")} className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">Open Register <BookOpen className="ml-2 inline h-4 w-4" /></button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Your workspace</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">Quick access</h2><p className="mt-1 text-sm text-slate-500">Jump straight to the task you need.</p></div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">{MODULES.length} modules</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MODULES.map(({ label, description, path, icon: Icon, tone }) => (
            <button key={label} type="button" onClick={() => navigate(path)} className="group flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900 group-hover:text-emerald-800">{label}</span><span className="mt-1.5 block text-xs leading-5 text-slate-500">{description}</span><span className="mt-3 block text-xs font-bold text-emerald-700">Open module →</span></span>
            </button>
          ))}
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-400"><span>PharmacyOS · Pharmacy management workspace</span><button type="button" onClick={() => navigate("/dashboard")} className="font-bold text-emerald-700 hover:text-emerald-900">Go to dashboard →</button></footer>
    </main>
  );
}
