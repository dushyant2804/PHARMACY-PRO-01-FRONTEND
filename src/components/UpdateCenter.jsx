import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ACKNOWLEDGED_VERSION_KEY,
  compareVersions,
  FRONTEND_VERSION,
  getStoredVersion,
  getUpdateType,
  normalizeVersionMetadata,
  removeStoredVersion,
  setStoredVersion,
  UPDATE_COMPLETED_KEY,
} from "@/lib/version";

const defaultMetadata = {
  version: FRONTEND_VERSION,
  message: "You have the latest PharmacyOS experience.",
  releaseNotes: ["Performance, reliability, and experience improvements."],
};

const UpdateContext = createContext(null);

export default function UpdateCenter({ children }) {
  const [metadata, setMetadata] = useState(defaultMetadata);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [justUpdated, setJustUpdated] = useState(() => getStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY) === "true");
  const acknowledgedVersion = getStoredVersion(localStorage, ACKNOWLEDGED_VERSION_KEY);
  const updateAvailable = compareVersions(metadata.version, FRONTEND_VERSION) > 0 && acknowledgedVersion !== metadata.version;
  const displayedVersion = acknowledgedVersion && compareVersions(acknowledgedVersion, FRONTEND_VERSION) > 0
    ? acknowledgedVersion
    : FRONTEND_VERSION;
  const updateType = useMemo(() => getUpdateType(FRONTEND_VERSION, metadata.version), [metadata.version]);

  useEffect(() => {
    let active = true;
    fetch(`/api/version?check=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Version check failed")))
      .then((payload) => {
        const nextMetadata = normalizeVersionMetadata(payload);
        if (!active || !nextMetadata) return;
        setMetadata(nextMetadata);
        if (compareVersions(nextMetadata.version, FRONTEND_VERSION) > 0 && getStoredVersion(localStorage, ACKNOWLEDGED_VERSION_KEY) !== nextMetadata.version) {
          setUpdateOpen(true);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!justUpdated) return undefined;
    removeStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY);
    const timer = window.setTimeout(() => setJustUpdated(false), 6000);
    return () => window.clearTimeout(timer);
  }, [justUpdated]);

  const applyUpdate = async () => {
    setUpdateOpen(false);
    setUpdating(true);
    setStoredVersion(localStorage, ACKNOWLEDGED_VERSION_KEY, metadata.version);
    setStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY, "true");

    try {
      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.update()));
      }
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set("updated", Date.now().toString());
      window.location.replace(url.toString());
    }
  };

  return (
    <>
      <UpdateContext.Provider value={{ currentVersion: displayedVersion, updateAvailable, justUpdated, openUpdate: () => setUpdateOpen(true), openWhatsNew: () => setWhatsNewOpen(true) }}>
        {children}
      </UpdateContext.Provider>

      <Dialog open={updateOpen && !updating} onOpenChange={setUpdateOpen}>
        <DialogContent className="update-dialog max-w-lg overflow-hidden border-0 p-0 sm:rounded-3xl">
          <div className="update-dialog-hero px-6 pb-6 pt-8 sm:px-8">
            <div className="mb-5 flex items-start justify-between gap-4 pr-8">
              <div className="update-icon-shell"><Rocket className="h-6 w-6" /></div>
              <span className="update-type-badge">{updateType} update</span>
            </div>
            <DialogHeader>
              <DialogTitle className="text-left text-2xl text-white sm:text-3xl">PharmacyOS {metadata.version} is ready</DialogTitle>
              <DialogDescription className="text-left leading-6 text-emerald-50/75">{metadata.message}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-900"><Sparkles className="h-4 w-4 text-amber-500" /> Release notes</div>
              <ul className="space-y-2.5">
                {metadata.releaseNotes.map((note) => <li key={note} className="flex gap-2.5 text-sm leading-5 text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{note}</li>)}
              </ul>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Your pharmacy data stays safe. PharmacyOS will reload once to activate the update.</span></div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => { setUpdateOpen(false); setWhatsNewOpen(true); }}>What’s New</Button>
              <Button onClick={applyUpdate} className="bg-emerald-900 px-6 hover:bg-emerald-800"><RefreshCw className="mr-2 h-4 w-4" />Update PharmacyOS</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={whatsNewOpen && !updating} onOpenChange={setWhatsNewOpen}>
        <DialogContent className="max-w-md rounded-2xl border-emerald-100">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-950"><Sparkles className="h-5 w-5 text-amber-500" />What’s new in PharmacyOS {metadata.version}</DialogTitle><DialogDescription>{metadata.message}</DialogDescription></DialogHeader>
          <ul className="space-y-2">{metadata.releaseNotes.map((note) => <li key={note} className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{note}</li>)}</ul>
          {updateAvailable && <Button onClick={applyUpdate} className="bg-emerald-900 hover:bg-emerald-800">Update PharmacyOS</Button>}
        </DialogContent>
      </Dialog>

      {updating && <div className="update-lock-screen" role="alert" aria-live="assertive" aria-busy="true"><div className="update-progress-card"><div className="update-orbit"><span /><RefreshCw className="h-7 w-7 text-amber-300" /></div><h2>Updating PharmacyOS…</h2><p>Preparing the latest experience securely.<br />This will only take a moment.</p><div className="update-progress-line"><span /></div></div></div>}
    </>
  );
}

export function UpdatePill() {
  const update = useContext(UpdateContext);
  if (!update) return null;
  const { currentVersion, updateAvailable, justUpdated, openUpdate, openWhatsNew } = update;
  return (
    <div className={`update-pill mx-3 mb-3 rounded-xl p-3 text-white ${updateAvailable ? "update-pill-available" : ""}`}>
      <button type="button" onClick={updateAvailable ? openUpdate : openWhatsNew} className="w-full text-left">
        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">PharmacyOS</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">v{currentVersion}</span></div>
        {updateAvailable ? <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-amber-100"><span className="flex items-center gap-1.5"><span className="update-status-dot bg-amber-300" />Update Available</span><span aria-hidden="true">→</span></div> : <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300"><span className="update-status-dot bg-emerald-300" />{justUpdated ? "You’re up to date" : "PharmacyOS is up to date"}</div>}
      </button>
      <button type="button" onClick={openWhatsNew} className="mt-2 text-[10px] font-semibold text-amber-200/80 transition-colors hover:text-amber-100">What’s New →</button>
    </div>
  );
}
