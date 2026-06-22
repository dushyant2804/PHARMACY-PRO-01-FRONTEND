import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarDays,
  Check,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import api, { formatApiError, getApiMode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ACKNOWLEDGED_BUILD_KEY,
  compareVersions,
  EMPTY_RELEASE_NOTES,
  FRONTEND_BUILD,
  FRONTEND_VERSION,
  getFrontendUpdateState,
  getStoredVersion,
  getUpdateType,
  getVersionIdentity,
  hasReleaseNotes,
  normalizeVersionMetadata,
  RELEASE_NOTE_GROUPS,
  removeStoredVersion,
  setStoredVersion,
  UPDATE_COMPLETED_KEY,
} from "@/lib/version";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const defaultMetadata = {
  version: FRONTEND_VERSION,
  build: FRONTEND_BUILD,
  date: null,
  message: "",
  releaseNotes: EMPTY_RELEASE_NOTES,
  updateAvailable: null,
  endpoint: "—",
  fetchedAt: null,
};

const updateCenterEndpoints = [
  { type: "api", url: "/updates/check" },
  { type: "static", url: "/version.json" },
];

const UpdateContext = createContext(null);

export const useUpdateCenter = () => useContext(UpdateContext);

const formatReleaseDate = (date) => {
  if (!date) return "Release date unavailable";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return String(date);
  return parsedDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const fetchUpdateCenterMetadata = async () => {
  let lastError;
  for (const endpoint of updateCenterEndpoints) {
    try {
      let data;
      const timestamp = Date.now();
      if (endpoint.type === "static") {
        const response = await fetch(`${endpoint.url}?t=${timestamp}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        if (!response.ok) throw new Error(`Update metadata request failed (${response.status})`);
        data = await response.json();
      } else {
        ({ data } = await api.get(endpoint.url, {
          params: { current_version: FRONTEND_VERSION, t: timestamp },
          headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
        }));
      }
      const metadata = normalizeVersionMetadata(data);
      if (metadata) return { ...metadata, endpoint: endpoint.url, fetchedAt: new Date().toISOString() };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Unable to fetch update metadata");
};

export default function UpdateCenter({ children }) {
  const [metadata, setMetadata] = useState(defaultMetadata);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState("Ready to check");
  const [justUpdated, setJustUpdated] = useState(
    () => getStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY) === "true",
  );
  const deployedIdentity = getVersionIdentity(metadata.version);
  const {
    loadedBuild,
    latestBuild: deployedBuild,
    updateAvailable,
    buildsDiffer,
  } = getFrontendUpdateState({ metadata });
  const loadedIdentity = getVersionIdentity(FRONTEND_VERSION);
  const updateType = useMemo(
    () => getUpdateType(FRONTEND_VERSION, metadata.version),
    [metadata.version],
  );
  const releaseDate = useMemo(
    () => formatReleaseDate(metadata.date),
    [metadata.date],
  );
  const versionIdentity = useMemo(
    () => getVersionIdentity(metadata.version),
    [metadata.version],
  );

  const checkForUpdates = useCallback(async ({ automatic = false } = {}) => {
    setChecking(true);
    if (!automatic) setCheckStatus("Checking for updates…");

    try {
      const nextMetadata = await fetchUpdateCenterMetadata();
      const latestIdentity = getVersionIdentity(nextMetadata.version);
      const currentIdentity = getVersionIdentity(FRONTEND_VERSION);
      const comparison = compareVersions(nextMetadata.version, FRONTEND_VERSION);
      const nextUpdateState = getFrontendUpdateState({ metadata: nextMetadata });
      const {
        latestBuild,
        loadedBuild: currentBuild,
        updateAvailable: hasUpdate,
        buildsDiffer: buildChanged,
      } = nextUpdateState;
      setMetadata({
        ...nextMetadata,
        build: latestBuild,
        comparison,
        updateAvailable: hasUpdate,
      });
      setCheckStatus(hasUpdate ? "Update available" : "You're up to date");
      console.info("Update Center check", {
        endpoint: nextMetadata.endpoint,
        loadedVersion: currentIdentity.version,
        loadedBuild: currentBuild || "—",
        latestDeployedVersion: latestIdentity.version,
        latestDeployedBuild: latestBuild || "—",
        update_available: hasUpdate,
        comparison,
        buildChanged,
        hasUpdate,
      });
      if (hasUpdate) {
        setWhatsNewOpen(false);
        setUpdateOpen(true);
      }
      return hasUpdate;
    } catch (error) {
      setMetadata(defaultMetadata);
      setCheckStatus(`Update check failed: ${formatApiError(error)}`);
      return false;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (getApiMode() === "local") {
      setCheckStatus("Manual checks only in Local Mode");
      return undefined;
    }
    checkForUpdates({ automatic: true });
    const timer = window.setInterval(
      () => checkForUpdates({ automatic: true }),
      UPDATE_CHECK_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [checkForUpdates]);

  useEffect(() => {
    if (!justUpdated) return undefined;
    removeStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY);
    setCheckStatus("You're up to date");
    const timer = window.setTimeout(() => setJustUpdated(false), 6000);
    return () => window.clearTimeout(timer);
  }, [justUpdated]);

  const applyUpdate = async () => {
    setUpdateOpen(false);
    setWhatsNewOpen(false);
    setUpdating(true);
    setMetadata((current) => ({ ...current, updateAvailable: false }));
    setStoredVersion(sessionStorage, UPDATE_COMPLETED_KEY, "true");
    setStoredVersion(
      localStorage,
      ACKNOWLEDGED_BUILD_KEY,
      deployedBuild || loadedBuild || "",
    );

    try {
      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            await registration.update();
            registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          }),
        );
      }
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.set("updated", Date.now().toString());
      window.location.replace(url.toString());
    }
  };

  return (
    <>
      <UpdateContext.Provider
        value={{
          currentVersion: FRONTEND_VERSION,
          currentBuild: loadedBuild,
          latestVersion: metadata.version,
          latestBuild: deployedBuild,
          updateAvailable,
          justUpdated,
          checking,
          checkStatus,
          checkForUpdates,
          openUpdate: () => {
            setWhatsNewOpen(false);
            setUpdateOpen(true);
          },
          openWhatsNew: () => {
            if (updateAvailable) {
              setWhatsNewOpen(false);
              setUpdateOpen(true);
              return;
            }
            setUpdateOpen(false);
            setWhatsNewOpen(true);
          },
          releaseNotes: metadata.releaseNotes,
          endpoint: metadata.endpoint,
          comparison: metadata.comparison,
          buildsDiffer,
        }}
      >
        {children}
      </UpdateContext.Provider>

      <Dialog open={updateOpen && !updating} onOpenChange={setUpdateOpen}>
        <DialogContent className="update-dialog max-w-lg overflow-hidden border-0 p-0 sm:rounded-3xl">
          <div className="update-dialog-hero px-6 pb-6 pt-8 sm:px-8">
            <div className="mb-5 flex items-start justify-between gap-4 pr-8">
              <div className="update-icon-shell">
                <Rocket className="h-6 w-6" />
              </div>
              <span className="update-type-badge">{updateType} update</span>
            </div>
            <DialogHeader>
              <DialogTitle className="text-left text-2xl text-white sm:text-3xl">
                Update Available: PharmacyOS {versionIdentity.version} is ready
              </DialogTitle>
              {metadata.message && (
                <DialogDescription className="text-left leading-6 text-emerald-50/75">
                  {metadata.message}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
            <VersionDetails identity={versionIdentity} />
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-900">
                <Sparkles className="h-4 w-4 text-amber-500" /> Release notes
              </div>
              <ReleaseNotes releaseNotes={metadata.releaseNotes} compact />
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs leading-5 text-emerald-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your pharmacy data stays safe. PharmacyOS will reload once to
                activate the update.
              </span>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={applyUpdate}
                className="bg-emerald-900 px-6 hover:bg-emerald-800"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Application
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={whatsNewOpen && !updating} onOpenChange={setWhatsNewOpen}>
        <DialogContent className="max-w-md rounded-2xl border-emerald-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-950">
              <Sparkles className="h-5 w-5 text-amber-500" />
              What’s new in PharmacyOS {versionIdentity.version}
            </DialogTitle>
            {metadata.message && (
              <DialogDescription>{metadata.message}</DialogDescription>
            )}
          </DialogHeader>
          <VersionDetails identity={versionIdentity} />
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            Released {releaseDate}
          </div>
          <ReleaseNotes releaseNotes={metadata.releaseNotes} />
          {updateAvailable && (
            <Button
              onClick={applyUpdate}
              className="bg-emerald-900 hover:bg-emerald-800"
            >
              Reload Application
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {updating && (
        <div
          className="update-lock-screen"
          role="alert"
          aria-live="assertive"
          aria-busy="true"
        >
          <div className="update-progress-card">
            <div className="update-orbit">
              <span />
              <RefreshCw className="h-7 w-7 text-amber-300" />
            </div>
            <h2>Updating PharmacyOS…</h2>
            <p>
              Preparing the latest experience securely.
              <br />
              This will only take a moment.
            </p>
            <div className="update-progress-line">
              <span />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function VersionDetails({ identity }) {
  return (
    <div className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
      <div>
        <span className="font-semibold text-slate-900">Version:</span>{" "}
        {identity.version}
      </div>
      {identity.build && (
        <div>
          <span className="font-semibold text-slate-900">Build:</span>{" "}
          {identity.build}
        </div>
      )}
      <div>
        <span className="font-semibold text-slate-900">Full:</span>{" "}
        {identity.full}
      </div>
    </div>
  );
}

function ReleaseNotes({ releaseNotes, compact = false }) {
  if (!hasReleaseNotes(releaseNotes)) {
    return (
      <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">
        No release notes available for this update.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {RELEASE_NOTE_GROUPS.filter(({ key }) => releaseNotes[key]?.length).map(
        ({ key, label }) => (
          <section key={key}>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-900">
              {label}
            </h4>
            <ul className="space-y-2">
              {releaseNotes[key].map((note) => (
                <li
                  key={`${key}-${note}`}
                  className={
                    compact
                      ? "flex gap-2.5 text-sm leading-5 text-slate-600"
                      : "flex gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600"
                  }
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {note}
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

export function UpdatePill() {
  const update = useContext(UpdateContext);
  if (!update) return null;
  const {
    currentVersion,
    latestVersion,
    currentBuild,
    latestBuild,
    updateAvailable,
    checking,
    checkForUpdates,
    openUpdate,
    openWhatsNew,
  } = update;
  const status = updateAvailable ? "Update available" : "You're up to date";
  const currentIdentity = getVersionIdentity(currentVersion);
  const latestIdentity = getVersionIdentity(latestVersion);
  return (
    <div
      className={`update-pill mx-3 mb-3 rounded-xl p-3 text-white ${updateAvailable ? "update-pill-available" : ""}`}
    >
      <button
        type="button"
        onClick={updateAvailable ? openUpdate : openWhatsNew}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">
            Update Center
          </span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
            v{currentIdentity.version}
          </span>
        </div>
        <div
          className={`mt-2 flex items-center gap-1.5 text-[11px] ${updateAvailable ? "font-semibold text-amber-100" : "text-emerald-300"}`}
        >
          <span
            className={`update-status-dot ${updateAvailable ? "bg-amber-300" : "bg-emerald-300"}`}
          />
          {status}
        </div>
        <div
          className="mt-1 truncate text-[9px] text-emerald-100/45"
          title={latestIdentity.full}
        >
          Latest deployed: v{latestIdentity.version}
        </div>
        <dl className="mt-2 grid gap-1 rounded-lg bg-emerald-950/35 p-2 text-[9px] leading-4 text-emerald-50/75">
          <div className="flex justify-between gap-2">
            <dt>Current loaded build:</dt>
            <dd className="truncate font-mono" title={currentBuild || "—"}>{currentBuild || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Latest deployed build:</dt>
            <dd className="truncate font-mono" title={latestBuild || "—"}>{latestBuild || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Update available:</dt>
            <dd className="font-mono">{String(updateAvailable)}</dd>
          </div>
        </dl>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={checking}
          onClick={() => checkForUpdates()}
          className="update-pill-action"
        >
          <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking…" : "Check Updates"}
        </button>
        <button
          type="button"
          onClick={openWhatsNew}
          className="update-pill-action"
        >
          <Sparkles className="h-3 w-3" />
          What’s New
        </button>
      </div>
    </div>
  );
}
