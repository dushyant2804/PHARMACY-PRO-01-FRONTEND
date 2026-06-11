import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, RefreshCw, Rocket, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  compareVersions,
  FRONTEND_VERSION,
  getStoredVersion,
  getUpdateType,
  normalizeVersionMetadata,
  removeStoredVersion,
  setStoredVersion,
  UPDATE_COMPLETED_KEY,
} from "@/lib/version";

const fallbackReleaseNote = "Performance, reliability, and experience improvements.";
const defaultMetadata = {
  version: FRONTEND_VERSION,
  date: null,
  message: "You have the latest PharmacyOS experience.",
  releaseNotes: [fallbackReleaseNote],
};

const UpdateContext = createContext(null);

const formatReleaseDate = (date) => {
  if (!date) return "Release date unavailable";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return String(date);
  return parsedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const fetchJson = async (path) => {
  const response = await fetch(`${path}?check=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error(`Unable to fetch ${path}`);
  return response.json();
};

export default function UpdateCenter({ children }) {
  const [metadata, setMetadata] = useState(defaultMetadata);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState("Ready to check");
  const [justUpdated, setJustUpdated] = useState(() => getStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY) === "true");
  const updateAvailable = compareVersions(metadata.version, FRONTEND_VERSION) > 0;
  const updateType = useMemo(() => getUpdateType(FRONTEND_VERSION, metadata.version), [metadata.version]);
  const releaseDate = useMemo(() => formatReleaseDate(metadata.date), [metadata.date]);

  const checkForUpdates = useCallback(async ({ automatic = false } = {}) => {
    setChecking(true);
    if (!automatic) setCheckStatus("Checking for updates…");

    try {
      const [versionPayload, releaseNotesPayload] = await Promise.all([
        fetchJson("/version.json"),
        fetchJson("/release-notes.json").catch(() => null),
      ]);
      const versionMetadata = normalizeVersionMetadata(versionPayload);
      if (!versionMetadata) throw new Error("Invalid version metadata");
      const releaseMetadata = releaseNotesPayload ? normalizeVersionMetadata(releaseNotesPayload) : null;
      const nextMetadata = {
        ...versionMetadata,
        date: releaseMetadata?.date || versionMetadata.date,
        releaseNotes: releaseMetadata?.releaseNotes?.length ? releaseMetadata.releaseNotes : versionMetadata.releaseNotes,
      };
      const hasUpdate = compareVersions(nextMetadata.version, FRONTEND_VERSION) > 0;
      setMetadata(nextMetadata);
      setCheckStatus(hasUpdate ? "Update available" : "You’re up to date");
      if (hasUpdate) setUpdateOpen(true);
      return hasUpdate;
    } catch {
      setCheckStatus("Couldn’t check for updates");
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkForUpdates({ automatic: true });
  }, [checkForUpdates]);

  useEffect(() => {
    if (!justUpdated) return undefined;
    removeStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY);
    setCheckStatus("You’re up to date");
    const timer = window.setTimeout(() => setJustUpdated(false), 6000);
    return () => window.clearTimeout(timer);
  }, [justUpdated]);

  const applyUpdate = async () => {
    setUpdateOpen(false);
    setWhatsNewOpen(false);
    setUpdating(true);
    setStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY, "true");

    try {
      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async (registration) => {
          await registration.update();
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        }));
      }
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set("updated", Date.now().toString());
      window.location.replace(url.toString());
    }
  };

  return (
    <>
      <UpdateContext.Provider value={{
        currentVersion: FRONTEND_VERSION,
        latestVersion: metadata.version,
        updateAvailable,
        justUpdated,
        checking,
        checkStatus,
        checkForUpdates,
        openUpdate: () => setUpdateOpen(true),
        openWhatsNew: () => setWhatsNewOpen(true),
      }}>
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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-950"><Sparkles className="h-5 w-5 text-amber-500" />What’s new in PharmacyOS {metadata.version}</DialogTitle>
            <DialogDescription>{metadata.message}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><CalendarDays className="h-4 w-4 text-emerald-600" />Released {releaseDate}</div>
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
  const { currentVersion, latestVersion, updateAvailable, justUpdated, checking, checkStatus, checkForUpdates, openUpdate, openWhatsNew } = update;
  const status = justUpdated ? "You’re up to date" : checkStatus;
  return (
    <div className={`update-pill mx-3 mb-3 rounded-xl p-3 text-white ${updateAvailable ? "update-pill-available" : ""}`}>
      <button type="button" onClick={updateAvailable ? openUpdate : openWhatsNew} className="w-full text-left">
        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">Update Center</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">v{currentVersion}</span></div>
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${updateAvailable ? "font-semibold text-amber-100" : "text-emerald-300"}`}><span className={`update-status-dot ${updateAvailable ? "bg-amber-300" : "bg-emerald-300"}`} />{status}</div>
        <div className="mt-1 truncate text-[9px] text-emerald-100/45" title={latestVersion}>Latest deployed: v{latestVersion}</div>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button type="button" disabled={checking} onClick={() => checkForUpdates()} className="update-pill-action"><RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />{checking ? "Checking…" : "Check Updates"}</button>
        <button type="button" onClick={openWhatsNew} className="update-pill-action"><Sparkles className="h-3 w-3" />What’s New</button>
      </div>
    </div>
  );
}
