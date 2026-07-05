import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { AlertTriangle, Check, Download, RefreshCw, Rocket, Sparkles } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EMPTY_RELEASE_NOTES, FRONTEND_BUILD, FRONTEND_VERSION, getVersionIdentity, hasReleaseNotes, normalizeVersionMetadata, RELEASE_NOTE_GROUPS } from "@/lib/version";
import { startPharmacyOSUpdate, UPDATE_RESTART_WARNING, UPDATE_SAVE_WARNING, UPDATE_STARTING_MESSAGE } from "@/lib/startUpdate";

const UpdateContext = createContext(null);
export const useUpdateCenter = () => useContext(UpdateContext);

const defaultMetadata = {
  version: FRONTEND_VERSION,
  build: FRONTEND_BUILD,
  currentVersion: FRONTEND_VERSION,
  currentBuild: FRONTEND_BUILD,
  latestVersion: FRONTEND_VERSION,
  latestBuild: FRONTEND_BUILD,
  date: null,
  releaseNotes: EMPTY_RELEASE_NOTES,
  whatsNew: [],
  updateAvailable: false,
  updateSizeLabel: "",
  downloadUrl: "",
  channel: "",
  mandatory: false,
  fetchedAt: null,
  unavailable: false,
};

const dedupe = (items = []) => Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)));

const formatReleaseDate = (date) => {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};


export const fetchUpdateCenterMetadata = async () => {
  const response = await api.get("/api/update-check", { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  if (response.status && response.status !== 200) {
    throw new Error(`Update check failed with status ${response.status}`);
  }

  const { data } = response;
  if (data?.status === "unavailable") {
    return { ...defaultMetadata, fetchedAt: new Date().toISOString(), unavailable: true };
  }
  if (data?.status && data.status !== "ok") {
    throw new Error(`Update check failed with backend status ${data.status}`);
  }

  const metadata = normalizeVersionMetadata(data) || defaultMetadata;
  return { ...defaultMetadata, ...metadata, fetchedAt: new Date().toISOString(), unavailable: false };
};

const notesForDisplay = (metadata) => {
  const grouped = RELEASE_NOTE_GROUPS.reduce((acc, { key }) => ({ ...acc, [key]: [] }), {});
  if (metadata.updateAvailable && metadata.whatsNew?.length) grouped.improved = dedupe(metadata.whatsNew);
  else RELEASE_NOTE_GROUPS.forEach(({ key }) => { grouped[key] = dedupe(metadata.releaseNotes?.[key] || []); });
  return grouped;
};

export default function UpdateCenter({ children }) {
  const auth = useAuth();
  const [metadata, setMetadata] = useState(defaultMetadata);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState("Not checked yet");
  const [updateAction, setUpdateAction] = useState({ loading: false, message: "", disabled: false, canOpenDownload: false });
  const popupShownRef = useRef(false);
  const dismissedRef = useRef(false);

  const displayNotes = useMemo(() => notesForDisplay(metadata), [metadata]);
  const updateAvailable = Boolean(metadata.updateAvailable);
  const currentIdentity = getVersionIdentity(metadata.currentVersion || FRONTEND_VERSION);
  const latestIdentity = getVersionIdentity(metadata.latestVersion || metadata.version || FRONTEND_VERSION);

  const checkForUpdates = useCallback(async ({ automatic = false } = {}) => {
    setChecking(true);
    if (!automatic) setCheckStatus("Checking for updates…");
    try {
      const next = await fetchUpdateCenterMetadata();
      setMetadata(next);
      setCheckStatus(next.unavailable ? "Update check unavailable" : next.updateAvailable ? "Update available" : "You are up to date");
      if (next.unavailable) return false;
      if (automatic && next.updateAvailable && !popupShownRef.current && !dismissedRef.current) {
        popupShownRef.current = true;
        setUpdateOpen(true);
      }
      return next.updateAvailable;
    } catch (error) {
      setMetadata((current) => ({ ...current, unavailable: true, fetchedAt: new Date().toISOString() }));
      setCheckStatus(automatic ? "Update check unavailable" : `Update check unavailable: ${formatApiError(error)}`);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!auth || auth.loading || !auth.user || auth.passwordExpired) return;
    checkForUpdates({ automatic: true });
  }, [auth, auth?.loading, auth?.user, auth?.passwordExpired, checkForUpdates]);

  const closeForLater = () => {
    dismissedRef.current = true;
    setUpdateOpen(false);
  };

  const openDownload = useCallback(() => {
    if (metadata.downloadUrl) window.open(metadata.downloadUrl, "_blank", "noopener,noreferrer");
  }, [metadata.downloadUrl]);

  const updateNow = useCallback(async () => {
    setUpdateAction({ loading: true, message: UPDATE_STARTING_MESSAGE, disabled: false, canOpenDownload: false });
    const result = await startPharmacyOSUpdate({ downloadUrl: metadata.downloadUrl });
    if (result.openDownload) openDownload();
    setUpdateAction({
      loading: false,
      message: result.message,
      disabled: Boolean(result.disableUpdateNow),
      canOpenDownload: Boolean(result.canOpenDownload),
    });
    if (result.status === "started" && !metadata.mandatory) {
      window.setTimeout(() => setUpdateOpen(false), 2500);
    }
  }, [metadata.downloadUrl, metadata.mandatory, openDownload]);

  return (
    <>
      <UpdateContext.Provider value={{
        currentVersion: metadata.currentVersion || FRONTEND_VERSION,
        currentBuild: metadata.currentBuild || FRONTEND_BUILD,
        latestVersion: metadata.latestVersion || metadata.version,
        latestBuild: metadata.latestBuild || metadata.build,
        updateAvailable,
        unavailable: metadata.unavailable,
        checking,
        checkStatus,
        checkForUpdates,
        openUpdate: () => setUpdateOpen(true),
        openWhatsNew: () => setWhatsNewOpen(true),
        releaseNotes: displayNotes,
        whatsNew: metadata.whatsNew,
        updateSizeLabel: metadata.updateSizeLabel,
        releaseDate: metadata.date,
        channel: metadata.channel,
        lastCheckedAt: metadata.fetchedAt,
        mandatory: metadata.mandatory,
        updateNow,
        updateAction,
        openDownload,
        hasDownloadUrl: Boolean(metadata.downloadUrl),
      }}>{children}</UpdateContext.Provider>

      <Dialog open={updateOpen} onOpenChange={(open) => (metadata.mandatory ? setUpdateOpen(true) : setUpdateOpen(open))}>
        <DialogContent className="update-dialog max-h-[92vh] max-w-xl overflow-y-auto border-0 p-0 sm:rounded-3xl" data-testid="update-available-modal">
          <div className="update-dialog-hero px-6 pb-6 pt-8 sm:px-8">
            <div className="mb-5 flex items-start justify-between gap-4 pr-8">
              <div className="update-icon-shell"><Rocket className="h-6 w-6" /></div>
              {metadata.mandatory && <span className="update-type-badge">Important Update</span>}
            </div>
            <DialogHeader>
              <DialogTitle className="text-left text-2xl text-white sm:text-3xl">Update Available</DialogTitle>
              <DialogDescription className="text-left text-emerald-50/80">Version {latestIdentity.version} is available</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
            <UpdateFacts currentIdentity={currentIdentity} latestIdentity={latestIdentity} metadata={metadata} />
            <UpdateWarnings />
            {updateAction.message && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100" role="status">
                {updateAction.message}
              </div>
            )}
            <section>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-900"><Sparkles className="h-4 w-4 text-amber-500" /> What’s New</div>
              <PlainNotes notes={dedupe(metadata.whatsNew)} />
            </section>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {!metadata.mandatory && <Button type="button" variant="outline" onClick={closeForLater}>Update Later</Button>}
              {updateAction.canOpenDownload && metadata.downloadUrl && <Button type="button" variant="outline" onClick={openDownload}>Open Download</Button>}
              <Button type="button" onClick={updateNow} disabled={updateAction.loading || updateAction.disabled} className="bg-emerald-900 hover:bg-emerald-800"><Download className="mr-2 h-4 w-4" />{updateAction.loading ? UPDATE_STARTING_MESSAGE : "Update Now"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen}>
        <DialogContent className="max-w-md rounded-2xl border-emerald-100">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-950"><Sparkles className="h-5 w-5 text-amber-500" />What’s New</DialogTitle></DialogHeader>
          <ReleaseNotes releaseNotes={displayNotes} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function UpdateWarnings() {
  return <div className="grid gap-2 text-sm"><div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{UPDATE_SAVE_WARNING}</div><div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{UPDATE_RESTART_WARNING}</div></div>;
}

function UpdateFacts({ currentIdentity, latestIdentity, metadata }) {
  const rows = [
    ["Current version", `v${currentIdentity.version}${metadata.currentBuild ? ` / Build ${metadata.currentBuild}` : ""}`],
    ["Latest version", `v${latestIdentity.version}${metadata.latestBuild ? ` / Build ${metadata.latestBuild}` : ""}`],
    ["Update size", metadata.updateSizeLabel],
    ["Release date", formatReleaseDate(metadata.date)],
    ["Channel", metadata.channel],
  ].filter(([, value]) => value);
  return <dl className="grid gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">{rows.map(([label, value]) => <div key={label} className="flex flex-col gap-1 sm:flex-row sm:justify-between"><dt className="text-slate-500 dark:text-slate-400">{label}</dt><dd className="font-semibold text-slate-900 dark:text-slate-100">{value}</dd></div>)}</dl>;
}

function PlainNotes({ notes }) {
  if (!notes.length) return <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">No release notes available.</p>;
  return <ul className="space-y-2">{notes.map((note) => <li key={note} className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{note}</li>)}</ul>;
}

function ReleaseNotes({ releaseNotes }) {
  if (!hasReleaseNotes(releaseNotes)) return <p className="text-sm text-slate-500">No release notes available.</p>;
  return <div className="space-y-4">{RELEASE_NOTE_GROUPS.filter(({ key }) => releaseNotes[key]?.length).map(({ key, label }) => <section key={key}><h4 className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-900">{label}</h4><PlainNotes notes={releaseNotes[key]} /></section>)}</div>;
}

export function UpdatePill() {
  const update = useContext(UpdateContext);
  if (!update) return null;
  const status = update.unavailable ? "Check unavailable" : update.updateAvailable ? "Update available" : "You are up to date";
  const currentIdentity = getVersionIdentity(update.currentVersion);
  return <div className={`update-pill mx-3 mb-3 rounded-xl p-3 text-white ${update.updateAvailable ? "update-pill-available" : ""}`}><button type="button" onClick={update.updateAvailable ? update.openUpdate : update.openWhatsNew} className="w-full text-left"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">Update Center</span><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">v{currentIdentity.version}</span></div><div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300"><span className={`update-status-dot ${update.updateAvailable ? "bg-amber-300" : "bg-emerald-300"}`} />{status}</div></button><div className="mt-2 grid grid-cols-2 gap-1.5"><button type="button" disabled={update.checking} onClick={() => update.checkForUpdates()} className="update-pill-action"><RefreshCw className={`h-3 w-3 ${update.checking ? "animate-spin" : ""}`} />{update.checking ? "Checking…" : "Check"}</button><button type="button" onClick={update.openWhatsNew} className="update-pill-action"><Sparkles className="h-3 w-3" />What’s New</button></div></div>;
}
