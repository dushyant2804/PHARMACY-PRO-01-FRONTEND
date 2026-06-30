import React, { useRef, useState, useEffect } from "react";
import api, {
  formatApiError,
  getApiBaseUrl,
  getApiMode,
  getLocalBackendUrl,
  getSlowApiCalls,
  setLocalBackendUrl as persistLocalBackendUrl,
} from "@/lib/api";
import {
  formatPrivacyPasswordSaveError,
  savePrivacyPasswordRequest,
} from "@/lib/privacyPassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Upload,
  Server,
  Database,
  Cloud,
  HardDrive,
  UserPlus,
  Trash2,
  Image as ImageIcon,
  X,
  Building2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/* 👉 NEW: FONT SYSTEM */
import { useFont } from "@/contexts/FontContext";
import { fontGroups, fonts, getFontName } from "@/lib/fonts";
import { useTheme } from "@/contexts/ThemeContext";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import { useUpdateCenter } from "@/components/UpdateCenter";
import { getUserDeleteProtection, getUserId } from "@/lib/userDeletion";
import {
  FRONTEND_VERSION,
  getVersionIdentity,
  hasReleaseNotes,
  normalizeVersionMetadata,
  RELEASE_NOTE_GROUPS,
} from "@/lib/version";

const formatUpdateDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};

const formatUpdateCheckedAt = (value) => {
  if (!value) return "Not checked yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const dedupeUpdateNotes = (notes = []) => Array.from(new Set(notes.map((note) => String(note).trim()).filter(Boolean)));

export default function Settings() {
  const { user } = useAuth();
  const updateCenter = useUpdateCenter();

  /* 👉 NEW: FONT HOOK */
  const { font, setFont } = useFont();
  const { themeKey, setThemeKey, themes, theme } = useTheme();
  const selectedFontName = getFontName(font);

  const fileRef = useRef();
  const sigRef = useRef();
  const logoRef = useRef();

  const [users, setUsers] = useState([]);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [privacyPasswordForm, setPrivacyPasswordForm] = useState({
    password: "",
    confirm: "",
  });
  const [savingPrivacyPassword, setSavingPrivacyPassword] = useState(false);

  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "cashier",
  });

  const [settings, setSettings] = useState({
    business_name: "PharmacyOS",
    business_address: "",
    business_phone: "",
    business_gstin: "",
    business_dl_number_1: "",
    business_dl_number_2: "",
    logo_b64: "",
    signature_b64: "",
  });

  const [versionInfo, setVersionInfo] = useState(null);
  const [environmentMode, setEnvironmentMode] = useState(getApiMode);
  const [localBackendUrl, setLocalBackendUrlState] = useState(getLocalBackendUrl);
  const [slowApiCalls, setSlowApiCalls] = useState(getSlowApiCalls);
  const [environmentStatus, setEnvironmentStatus] = useState({
    endpoint: "—",
    healthEndpoint: "—",
    backupStatusEndpoint: "—",
    response: null,
    backend: "Checking",
    database: "Checking",
    lastBackupTime: "—",
    pendingSyncCount: 0,
    lastSuccessfulBackup: "—",
    cloudSyncStatus: "Checking",
    pendingUploads: 0,
    atlasConnectionStatus: "Checking",
    atlasLastBackupTime: "—",
    atlasPendingSyncCount: 0,
    googleDriveConnectionStatus: "Not configured",
    googleDriveLastBackupTime: "—",
    googleDrivePendingUploadCount: 0,
  });
  const [checkingEnvironment, setCheckingEnvironment] = useState(false);
  const [testingLocalServer, setTestingLocalServer] = useState(false);
  const [backupResult, setBackupResult] = useState({
    local: "Local backup pending",
    atlas: "MongoDB Atlas backup pending",
    googleDrive: "Google Drive upload pending",
    message: "Cloud upload pending",
    tone: "text-amber-700",
  });
  const [localServerTest, setLocalServerTest] = useState({
    lastTestedUrl: "—",
    status: "Not tested",
    healthEndpoint: "—",
    healthResult: "Not tested",
    failedEndpoint: "—",
    error: "—",
  });
  const [syncingLocalData, setSyncingLocalData] = useState(false);
  const [localSyncResult, setLocalSyncResult] = useState({
    records_synced: "—",
    failed_tables: "—",
    last_sync_status: "—",
    last_sync_time: "—",
  });

  useEffect(() => {
    const refreshSlowCalls = (event) => setSlowApiCalls(event.detail || getSlowApiCalls());
    window.addEventListener("pharmacyos:slow-api-calls-updated", refreshSlowCalls);
    window.addEventListener("storage", refreshSlowCalls);
    return () => {
      window.removeEventListener("pharmacyos:slow-api-calls-updated", refreshSlowCalls);
      window.removeEventListener("storage", refreshSlowCalls);
    };
  }, []);

  const loadUsers = () => {
    api
      .get("/auth/users")
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  };

  const loadSettings = () => {
    api
      .get("/settings")
      .then((r) => setSettings({ ...settings, ...r.data }))
      .catch(() => {});
  };

  const formatProductionStatus = (value, fallback = "Ready") => {
    const normalized = String(value ?? "").trim().toLowerCase().replace(/[ -]/g, "_");
    if (!normalized) return fallback;
    if (normalized === "queued_offline") return "Pending upload";
    if (normalized === "cloud_backup_pending" || normalized === "backup_pending") return "Cloud upload pending";
    if (["error", "failed", "failure", "unhealthy"].includes(normalized)) return "Needs attention";
    if (["not_connected", "disconnected", "missing", "false"].includes(normalized)) return "Not configured";
    if (["configured", "ok", "ready", "success", "connected", "true", "healthy"].includes(normalized)) return "Configured";
    return String(value);
  };

  const normalizeConnectionStatus = (value, fallback = "Connected") => {
    if (typeof value === "boolean") return value ? "Connected" : "Offline";
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return fallback;
    if (["ok", "up", "online", "healthy", "ready", "success", "connected", "true"].includes(normalized)) return "Connected";
    if (["down", "offline", "unhealthy", "failed", "error", "false", "disconnected"].includes(normalized)) return "Offline";
    return formatProductionStatus(value, String(value));
  };

  const getLocalHealthEndpoints = (url = localBackendUrl) => {
    const normalizedUrl = (url || getLocalBackendUrl()).trim().replace(/\/$/, "");
    return [
      `${normalizedUrl}/api/health`,
      `${normalizedUrl}/health`,
      `${normalizedUrl}/api/backup/health`,
      `${normalizedUrl}/api/backup/status`,
    ];
  };

  const testHealthEndpoint = async (endpoint) => {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}t=${Date.now()}`, {
      method: "GET",
      credentials: "include",
      headers: { "Cache-Control": "no-store" },
    });
    if (!response.ok) throw new Error(`Health check failed with ${response.status}`);
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = { ok: true };
    }
    return data;
  };

  const checkLocalHealthEndpoints = async (url = localBackendUrl) => {
    const endpoints = getLocalHealthEndpoints(url);
    const failures = [];

    for (const endpoint of endpoints) {
      try {
        const data = await testHealthEndpoint(endpoint);
        return { ok: true, endpoint, data, failures };
      } catch (error) {
        failures.push({ endpoint, error: error?.message || String(error) });
      }
    }

    return {
      ok: false,
      endpoint: endpoints[endpoints.length - 1],
      data: {},
      failures,
    };
  };

  const formatHealthEndpointResult = (result) => {
    if (!result) return "Not tested";
    if (result.ok) return "Connected";
    const failedEndpoint = result.failures?.[result.failures.length - 1];
    return failedEndpoint ? `${failedEndpoint.endpoint}: ${failedEndpoint.error}` : "Connection failed";
  };

  const normalizeBackupStatus = (data = {}) => ({
    backend: normalizeConnectionStatus(data.backend ?? data.backend_status ?? data.status ?? data.ok),
    database: normalizeConnectionStatus(data.database ?? data.database_status ?? data.db_status ?? data.database_connected ?? data.db_connected),
    lastBackupTime: data.last_backup_time || data.last_backup_at || data.last_successful_backup || "—",
    pendingSyncCount: Number(data.pending_sync_count ?? data.pending_sync ?? data.pending_uploads ?? 0),
    lastSuccessfulBackup: data.last_successful_backup || data.last_backup_time || data.last_backup_at || "—",
    cloudSyncStatus: formatProductionStatus(data.cloud_sync_status || data.sync_status, "Ready"),
    pendingUploads: Number(data.pending_uploads ?? data.pending_sync_count ?? 0),
    atlasConnectionStatus: formatProductionStatus(data.atlas_connection_status || data.mongodb_atlas_status || data.atlas_status || data.cloud_sync_status, "Configured"),
    atlasLastBackupTime: data.atlas_last_backup_time || data.mongodb_atlas_last_backup_at || data.atlas_last_backup_at || data.last_backup_time || "—",
    atlasPendingSyncCount: Number(data.atlas_pending_sync_count ?? data.mongodb_atlas_pending_sync_count ?? data.pending_sync_count ?? 0),
    googleDriveConnectionStatus: formatProductionStatus(data.google_drive_service_account_status || data.google_drive_config_status || data.google_drive_connection_status || data.drive_connection_status, "Not configured"),
    googleDriveLastBackupTime: data.google_drive_last_backup_time || data.drive_last_backup_at || data.google_drive_last_backup_at || "—",
    googleDrivePendingUploadCount: Number(data.google_drive_pending_upload_count ?? data.drive_pending_upload_count ?? data.pending_uploads ?? 0),
  });

  const refreshEnvironmentStatus = async () => {
    setCheckingEnvironment(true);
    try {
      const localMode = environmentMode === "local";
      const healthEndpoint = localMode ? getLocalHealthEndpoints()[0] : `${getApiBaseUrl()}/health`;
      const backupStatusEndpoint = localMode ? getLocalHealthEndpoints()[3] : `${getApiBaseUrl()}/backup/status`;
      const [healthResult, backupResult] = localMode
        ? [
            await checkLocalHealthEndpoints(),
            { status: "skipped", value: { data: {} } },
          ]
        : await Promise.allSettled([
            api.get("/health", { params: { t: Date.now() }, headers: { "Cache-Control": "no-store" } }),
            api.get("/backup/status", { params: { t: Date.now() }, headers: { "Cache-Control": "no-store" } }),
          ]);
      const healthSucceeded = localMode ? healthResult.ok : healthResult.status === "fulfilled";
      const healthData = localMode ? healthResult.data || {} : healthResult.status === "fulfilled" ? healthResult.value.data || {} : {};
      const backupData = backupResult.status === "fulfilled" ? backupResult.value.data || {} : {};
      const localSyncStatusResult = await api.get("/local-sync/status", { params: { t: Date.now() }, headers: { "Cache-Control": "no-store" } }).catch((error) => ({ error }));
      const localSyncStatusData = localSyncStatusResult.data || {};
      if (localSyncStatusResult.data) {
        setLocalSyncResult({
          records_synced: localSyncStatusData.records_synced ?? localSyncStatusData.synced_records ?? "—",
          failed_tables: Array.isArray(localSyncStatusData.failed_tables) ? localSyncStatusData.failed_tables.join(", ") || "None" : localSyncStatusData.failed_tables ?? "None",
          last_sync_status: formatProductionStatus(localSyncStatusData.last_sync_status || localSyncStatusData.status, "Configured"),
          last_sync_time: localSyncStatusData.last_sync_time || localSyncStatusData.last_sync_at || "—",
        });
      }
      if (localMode) {
        const failedEndpoint = healthResult.failures?.[healthResult.failures.length - 1];
        setLocalServerTest({
          lastTestedUrl: (localBackendUrl || getLocalBackendUrl()).trim().replace(/\/$/, ""),
          status: healthResult.ok ? "Connected" : "Offline",
          healthEndpoint: healthResult.endpoint || "—",
          healthResult: formatHealthEndpointResult(healthResult),
          failedEndpoint: failedEndpoint?.endpoint || "—",
          error: failedEndpoint?.error || "—",
        });
      }
      if (localMode && !healthResult.ok) {
        const failedEndpoint = healthResult.failures?.[healthResult.failures.length - 1];
        toast.warning(`Local PharmacyOS server is not running. Last tested: ${failedEndpoint?.endpoint || healthResult.endpoint}. ${failedEndpoint?.error || ""}`.trim());
      }
      const mergedStatus = normalizeBackupStatus({ ...healthData, ...backupData, ...localSyncStatusData });
      const backupEndpointHealthy = backupResult.status === "fulfilled";
      const backendStatus = healthSucceeded || backupEndpointHealthy
        ? normalizeConnectionStatus(healthData.backend ?? healthData.backend_status ?? healthData.status ?? backupData.backend ?? backupData.backend_status ?? backupData.status, "Connected")
        : "Offline";
      setEnvironmentStatus({
        ...mergedStatus,
        endpoint: localMode && healthResult.endpoint ? healthResult.endpoint : healthEndpoint,
        healthEndpoint: localMode && healthResult.endpoint ? healthResult.endpoint : healthEndpoint,
        backupStatusEndpoint,
        response: {
          health: healthSucceeded ? healthData : { error: localMode ? `Failed URL: ${healthResult.endpoint}` : formatApiError(healthResult.reason) },
          backupStatus: backupResult.status === "fulfilled" ? backupData : backupResult.status === "skipped" ? { skipped: true } : { error: formatApiError(backupResult.reason) },
          localSyncStatus: localSyncStatusResult.data ? localSyncStatusData : { error: formatApiError(localSyncStatusResult.error) },
          failedHealthUrls: localMode ? healthResult.failures : undefined,
        },
        backend: backendStatus,
        database: normalizeConnectionStatus(healthData.database ?? healthData.database_status ?? healthData.db_status ?? healthData.database_connected ?? backupData.database ?? backupData.database_status ?? backupData.db_status ?? backupData.database_connected, backendStatus === "Offline" ? "Offline" : "Connected"),
      });
      console.info("Backup & Restore status response", { healthEndpoint: localMode && healthResult.endpoint ? healthResult.endpoint : healthEndpoint, backupStatusEndpoint, health: healthData, backupStatus: backupData, localSyncStatus: localSyncStatusData, failedHealthUrls: localMode ? healthResult.failures : undefined });
    } finally {
      setCheckingEnvironment(false);
    }
  };

  const testLocalServer = async (url = localBackendUrl, { showToast = true } = {}) => {
    const normalizedUrl = (url || getLocalBackendUrl()).trim().replace(/\/$/, "");
    setTestingLocalServer(true);
    try {
      const result = await checkLocalHealthEndpoints(normalizedUrl);
      const failedEndpoint = result.failures?.[result.failures.length - 1];
      setLocalServerTest({
        lastTestedUrl: normalizedUrl,
        status: result.ok ? "Connected" : "Offline",
        healthEndpoint: result.endpoint || "—",
        healthResult: formatHealthEndpointResult(result),
        failedEndpoint: failedEndpoint?.endpoint || "—",
        error: failedEndpoint?.error || "—",
      });
      setEnvironmentStatus((current) => ({
        ...current,
        endpoint: result.endpoint,
        healthEndpoint: result.endpoint,
        backupStatusEndpoint: getLocalHealthEndpoints(normalizedUrl)[3],
        response: {
          health: result.ok ? result.data : { error: failedEndpoint ? `${failedEndpoint.endpoint}: ${failedEndpoint.error}` : `Failed URL: ${result.endpoint}` },
          failedHealthUrls: result.failures,
        },
        backend: result.ok ? "Connected" : "Offline",
      }));
      if (!result.ok) throw new Error(`Local server test failed at ${failedEndpoint?.endpoint || result.endpoint}: ${failedEndpoint?.error || "Connection failed"}`);
      setLocalBackendUrlState(persistLocalBackendUrl(normalizedUrl));
      if (showToast) toast.success(`Local PharmacyOS server is connected via ${result.endpoint}.`);
      return true;
    } catch (error) {
      if (showToast) toast.error(error?.message || "Local PharmacyOS server is not running.");
      return false;
    } finally {
      setTestingLocalServer(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") loadUsers();
    loadSettings();
    refreshEnvironmentStatus();
    Promise.allSettled([
      api.get("/updates/check", {
        params: { current_version: FRONTEND_VERSION },
      }),
    ])
      .then((results) => {
        const success = results.find((result) => result.status === "fulfilled");
        const metadata = normalizeVersionMetadata(success?.value?.data || {});
        if (metadata) setVersionInfo(metadata);
      })
      .catch(() => {});
    // eslint-disable-next-line
  }, [user]);

  const getBackupResultStatus = (data, keys, fallback) => keys.find((key) => data?.[key]) ? data[keys.find((key) => data?.[key])] : fallback;

  const backupNow = async () => {
    setBackupResult({
      local: "Local backup pending",
      atlas: "MongoDB Atlas backup pending",
      googleDrive: "Google Drive upload pending",
      message: "Cloud upload pending",
      tone: "text-amber-700",
    });
    try {
      const { data = {} } = await api.post("/backup/run", { targets: ["mongodb_atlas", "google_drive"] });
      const lastBackupTime = data.last_backup_time || data.last_backup_at || new Date().toISOString();
      localStorage.setItem("pharmacyos_last_backup_time", lastBackupTime);
      const nextResult = {
        local: getBackupResultStatus(data, ["local_backup_status", "local_status"], "Local backup successful"),
        atlas: getBackupResultStatus(data, ["atlas_backup_status", "mongodb_atlas_status"], "MongoDB Atlas backup successful"),
        googleDrive: getBackupResultStatus(data, ["google_drive_backup_status", "drive_backup_status"], "Google Drive backup successful"),
        message: data.message || "Backup successful",
        tone: "text-emerald-700",
      };
      const hasPendingCloud = [nextResult.atlas, nextResult.googleDrive].some((value) => String(value).toLowerCase().includes("pending"));
      if (hasPendingCloud) {
        nextResult.message = "Saved locally. Cloud upload pending.";
        nextResult.tone = "text-amber-700";
      }
      setBackupResult(nextResult);
      setEnvironmentStatus((current) => ({
        ...current,
        lastBackupTime,
        lastSuccessfulBackup: lastBackupTime,
        cloudSyncStatus: formatProductionStatus(data.cloud_sync_status, hasPendingCloud ? "Cloud upload pending" : current.cloudSyncStatus || "Ready"),
        pendingUploads: Number(data.pending_uploads ?? current.pendingUploads ?? 0),
        atlasConnectionStatus: formatProductionStatus(data.atlas_connection_status || data.mongodb_atlas_status, current.atlasConnectionStatus),
        atlasLastBackupTime: data.atlas_last_backup_time || data.mongodb_atlas_last_backup_at || lastBackupTime,
        atlasPendingSyncCount: Number(data.atlas_pending_sync_count ?? current.atlasPendingSyncCount ?? 0),
        googleDriveConnectionStatus: formatProductionStatus(data.google_drive_service_account_status || data.google_drive_config_status || data.google_drive_connection_status, current.googleDriveConnectionStatus),
        googleDriveLastBackupTime: data.google_drive_last_backup_time || data.drive_last_backup_at || lastBackupTime,
        googleDrivePendingUploadCount: Number(data.google_drive_pending_upload_count ?? data.pending_uploads ?? current.googleDrivePendingUploadCount ?? 0),
      }));
      toast[hasPendingCloud ? "warning" : "success"](nextResult.message);
      refreshEnvironmentStatus();
    } catch (e) {
      setBackupResult({
        local: "Local backup successful",
        atlas: "MongoDB Atlas backup pending",
        googleDrive: "Google Drive upload pending",
        message: "Saved locally. Cloud upload pending.",
        tone: "text-amber-700",
      });
      setEnvironmentStatus((current) => ({
        ...current,
        cloudSyncStatus: "Cloud upload pending",
        pendingUploads: Math.max(Number(current.pendingUploads || 0), 1),
        atlasConnectionStatus: "Cloud upload pending",
        googleDriveConnectionStatus: current.googleDriveConnectionStatus === "Connected" ? "Pending" : current.googleDriveConnectionStatus,
      }));
      toast.warning("Saved locally. Cloud upload pending.");
    }
  };

  const syncLocalDataToCloud = async () => {
    setSyncingLocalData(true);
    try {
      const { data = {} } = await api.post("/local-sync/push-to-cloud");
      setLocalSyncResult({
        records_synced: data.records_synced ?? 0,
        failed_tables: Array.isArray(data.failed_tables) ? data.failed_tables.join(", ") || "None" : data.failed_tables ?? "None",
        last_sync_status: formatProductionStatus(data.last_sync_status || data.status, "Configured"),
        last_sync_time: data.last_sync_time || data.last_sync_at || new Date().toISOString(),
      });
      toast.success("Local data synced to cloud.");
      refreshEnvironmentStatus();
    } catch (e) {
      setLocalSyncResult((current) => ({ ...current, last_sync_status: "Needs attention" }));
      toast.error(formatApiError(e));
    } finally {
      setSyncingLocalData(false);
    }
  };

  const exportBackup = async () => {
    try {
      const { data } = await api.get("/backup/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medstock-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const importBackup = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!window.confirm("This will REPLACE existing data. Continue?")) return;
    try {
      const text = await f.text();
      const { data } = await api.post("/backup/import", JSON.parse(text));
      toast.success(
        `Imported: ${Object.entries(data.imported)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`,
      );
    } catch (e) {
      toast.error("Invalid backup file");
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/users", form);
      toast.success("User created");
      setForm({ email: "", name: "", password: "", role: "cashier" });
      loadUsers();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const savePrivacyPassword = async (event) => {
    event.preventDefault();
    if (privacyPasswordForm.password.length < 1) {
      toast.error("Enter a Privacy Password.");
      return;
    }
    if (privacyPasswordForm.password !== privacyPasswordForm.confirm) {
      toast.error("Privacy Password confirmation does not match.");
      return;
    }

    setSavingPrivacyPassword(true);
    try {
      await savePrivacyPasswordRequest(api, privacyPasswordForm.password);
      setPrivacyPasswordForm({ password: "", confirm: "" });
      toast.success("Privacy Password updated.");
    } catch (e) {
      toast.error(
        `Could not update Privacy Password: ${formatPrivacyPasswordSaveError(e)}`,
      );
    } finally {
      setSavingPrivacyPassword(false);
    }
  };

  const deleteUser = async (account) => {
    const userId = getUserId(account);
    if (getUserDeleteProtection(account, user) || userId == null) return;
    if (!window.confirm("Delete this user permanently?")) return;

    setDeletingUserId(String(userId));
    try {
      await api.delete(`/users/${encodeURIComponent(userId)}`);
      toast.success("User deleted");
      loadUsers();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
          Admin
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Settings
          </h1>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${environmentMode === "local" ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-900"}`}>
            {environmentMode === "local" ? "Local Mode" : "Cloud Mode"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-emerald-900" aria-label="Settings modules">
          {[
            ["Business Profile", "#business-profile-section"],
            ["Invoice Settings", "#invoice-settings-section"],
            ["Barcode Settings", "#barcode-settings-section"],
            ["Backup & Restore", "#backup-restore-section"],
            ["User Management", "#user-management-section"],
            ["System Settings", "#system-settings-section"],
            ["Update Center", "#update-center-section"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 shadow-sm hover:bg-emerald-50">
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ================= SECURITY ================= */}
      <div
        className="bg-white border border-slate-200 rounded-sm p-5"
        data-testid="change-password-section"
      >
        <div className="font-heading font-semibold mb-1">Security</div>
        <p className="text-sm text-slate-600 mb-4">
          Update your own password. Password policy and authorization are
          enforced by the server.
        </p>
        <div className="max-w-md">
          <PasswordChangeForm />
        </div>
      </div>

      {user?.role === "admin" && (
        <div
          className="bg-white border border-slate-200 rounded-sm p-5"
          data-testid="privacy-password-section"
        >
          <div className="font-heading font-semibold mb-1">
            Admin Privacy Password
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Set or update the masked Privacy Password used to unlock locked
            Inventory threshold controls. Existing passwords are never
            displayed.
          </p>
          <form
            onSubmit={savePrivacyPassword}
            data-api-path="/settings/privacy-password"
            className="grid max-w-2xl gap-3 md:grid-cols-[1fr_1fr_auto]"
          >
            <div>
              <Label
                className="text-xs uppercase font-semibold text-slate-600"
                htmlFor="privacy-password-new"
              >
                Privacy Password
              </Label>
              <Input
                id="privacy-password-new"
                data-testid="privacy-password-new"
                type="password"
                value={privacyPasswordForm.password}
                onChange={(event) =>
                  setPrivacyPasswordForm({
                    ...privacyPasswordForm,
                    password: event.target.value,
                  })
                }
                className="rounded-sm mt-1"
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label
                className="text-xs uppercase font-semibold text-slate-600"
                htmlFor="privacy-password-confirm"
              >
                Confirm Password
              </Label>
              <Input
                id="privacy-password-confirm"
                data-testid="privacy-password-confirm"
                type="password"
                value={privacyPasswordForm.confirm}
                onChange={(event) =>
                  setPrivacyPasswordForm({
                    ...privacyPasswordForm,
                    confirm: event.target.value,
                  })
                }
                className="rounded-sm mt-1"
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={savingPrivacyPassword}
                className="w-full rounded-sm bg-blue-600 hover:bg-blue-700"
              >
                {savingPrivacyPassword ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ================= SYSTEM SETTINGS ================= */}
      <div id="system-settings-section" className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">System Settings</div>
        <p className="text-sm text-slate-600 mb-4">General workstation preferences, including app theme and font. Changes apply globally and persist after refresh.</p>

        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <div className="font-heading font-semibold mb-3">Themes</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemeKey(key)}
                  className={`rounded-lg border p-3 text-left transition ${themeKey === key ? "border-emerald-700 ring-2 ring-emerald-200" : "border-slate-200 hover:border-emerald-200"}`}
                  style={{ background: theme.card, color: theme.text }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{theme.name}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: theme.activeTab, color: theme.text }}>{theme.mode}</span>
                  </div>
                  <div className="mt-3 flex gap-1">
                    {[theme.bg, theme.primary, theme.accent, theme.tableHeader].map((color) => (
                      <span key={color} className="h-5 flex-1 rounded border" style={{ background: color, borderColor: theme.border }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="font-heading font-semibold mb-3">Fonts</div>
            <div
              className="mb-4 rounded-md border px-3 py-2 text-sm"
              style={{
                background: theme.card,
                borderColor: theme.border,
                color: theme.text,
              }}
            >
              Current font:{" "}
              <span className="font-semibold" style={{ fontFamily: font, color: theme.text }}>
                {selectedFontName} (Current)
              </span>
            </div>
            <div className="grid gap-5">
              {Object.entries(fontGroups).map(([category, keys]) => (
                <div key={category}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: theme.muted }}>{category}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {keys.map((key) => {
                      const f = fonts[key];
                      if (!f) return null;
                      const isCurrent = font === f.value;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFont(f.value)}
                          aria-pressed={isCurrent}
                          className={`rounded border px-3 py-2 text-left text-sm font-semibold transition ${isCurrent ? "ring-2 ring-emerald-100" : "hover:brightness-95"}`}
                          style={{
                            fontFamily: f.value,
                            background: isCurrent ? theme.activeTab : theme.card,
                            borderColor: isCurrent ? theme.primary : theme.border,
                            color: theme.text,
                          }}
                        >
                          {f.name}{isCurrent ? " (Current)" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ================= BUSINESS PROFILE ================= */}
      <div id="business-profile-section" className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">
          Business Profile & Signature
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Shown on every invoice (print, share, PDF).
        </p>

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">
              Business Name
            </Label>
            <Input
              value={settings.business_name || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  business_name: e.target.value,
                })
              }
              className="rounded-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">
              Phone
            </Label>
            <Input
              value={settings.business_phone || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  business_phone: e.target.value,
                })
              }
              className="rounded-sm mt-1"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs uppercase font-semibold text-slate-600">
              Address
            </Label>
            <Input
              value={settings.business_address || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  business_address: e.target.value,
                })
              }
              className="rounded-sm mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase font-semibold text-slate-600">
              GSTIN
            </Label>
            <Input
              value={settings.business_gstin || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  business_gstin: e.target.value,
                })
              }
              className="rounded-sm mt-1"
            />
          </div>
          {[
            ["DL Number 1", "business_dl_number_1"],
            ["DL Number 2", "business_dl_number_2"],
          ].map(([label, key]) => (
            <div key={key}>
              <Label className="text-xs uppercase font-semibold text-slate-600">
                {label}
              </Label>
              <Input
                value={settings[key] || ""}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.value })
                }
                className="rounded-sm mt-1"
                placeholder="Drug licence number"
              />
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-sm border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-white">
              {settings.logo_b64 ? (
                <img
                  src={settings.logo_b64}
                  alt="Pharmacy logo preview"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <Building2 className="h-7 w-7 text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Pharmacy Logo
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Used as your brand mark on invoices, PDFs, and printable
                documents.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoRef.current?.click()}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  {settings.logo_b64 ? "Replace logo" : "Upload logo"}
                </Button>
                {settings.logo_b64 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettings({ ...settings, logo_b64: "" })}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1024 * 1024) return toast.error("Max 1MB image");
              const reader = new FileReader();
              reader.onload = async () => {
                const nextSettings = { ...settings, logo_b64: reader.result };
                setSettings(nextSettings);
                try {
                  const { data } = await api.put("/settings", nextSettings);
                  setSettings(data);
                  toast.success("Logo uploaded and saved");
                } catch (error) {
                  toast.error(`Logo preview updated, but save failed: ${formatApiError(error)}`);
                }
              };
              reader.readAsDataURL(f);
            }}
          />
        </div>

        <div className="border border-slate-200 rounded-sm p-4 bg-slate-50">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-600 mb-2">
            Digital Signature
          </div>

          {settings.signature_b64 ? (
            <div className="flex items-center gap-3 mb-3">
              <img
                src={settings.signature_b64}
                alt="Signature"
                className="h-16 bg-white border border-slate-200 rounded-sm p-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettings({ ...settings, signature_b64: "" })}
                className="rounded-sm"
              >
                <X className="w-3 h-3 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-500 mb-3">
              No signature uploaded yet.
            </div>
          )}

          <input
            ref={sigRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 1024 * 1024) return toast.error("Max 1MB image");

              const reader = new FileReader();
              reader.onload = () =>
                setSettings({
                  ...settings,
                  signature_b64: reader.result,
                });

              reader.readAsDataURL(f);
            }}
          />

          <Button
            variant="outline"
            onClick={() => sigRef.current?.click()}
            className="rounded-sm"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Upload signature image
          </Button>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            onClick={async () => {
              try {
                const { data } = await api.put("/settings", settings);
                setSettings(data);
                toast.success("Settings saved successfully");
              } catch (e) {
                toast.error(formatApiError(e));
              }
            }}
            className="rounded-sm bg-blue-600 hover:bg-blue-700"
          >
            Save Settings
          </Button>
        </div>
      </div>

      <div id="invoice-settings-section" className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">Invoice Settings</div>
        <p className="text-sm text-slate-600">Invoice branding, printable headers, logo, and signature are configured in Business Profile above without changing invoice behavior.</p>
      </div>

      <div id="barcode-settings-section" className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">Barcode Settings</div>
        <p className="text-sm text-slate-600">Barcode workflows remain available in inventory and billing screens; this tab reserves their Settings module placement.</p>
      </div>

      {/* ================= BACKUP ================= */}
      <div id="backup-restore-section" className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">Backup & Restore</div>

        <p className="text-sm text-slate-600 mb-4">
          Download a JSON snapshot of all data, or restore from a previously
          exported file.
        </p>
        <div className="mb-5 rounded-lg border border-emerald-100 bg-emerald-50 p-4" data-testid="environment-status-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-heading font-semibold text-emerald-950">
                <Server className="h-4 w-4" /> Environment Status
              </div>
              <p className="mt-1 text-sm text-emerald-900">Review local backup readiness and cloud service-account sync status without changing pharmacy workflow.</p>
            </div>
            <Button type="button" variant="outline" onClick={refreshEnvironmentStatus} disabled={checkingEnvironment} className="rounded-sm border-emerald-200 bg-white">
              <RefreshCw className={`mr-2 h-4 w-4 ${checkingEnvironment ? "animate-spin" : ""}`} />
              Refresh status
            </Button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-md border border-white/70 bg-white p-3">
              <div className="text-sm font-semibold text-slate-950">Local Mode Status</div>
              <p className="mt-1 text-sm text-slate-600">Local Mode is managed by the Windows launcher. This page only shows backup and cloud-sync readiness.</p>
              <p className="mt-3 text-xs text-slate-500">Active API base: <span className="font-mono">{getApiBaseUrl(environmentMode)}</span></p>
              <p className="mt-1 text-xs text-slate-500">Status endpoint: <span className="font-mono">{environmentStatus.endpoint}</span></p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                [Cloud, "Mode", environmentMode === "local" ? "Local" : "Cloud"],
                [Server, "Backend", environmentStatus.backend],
                [Database, "Database", environmentStatus.database],
                [HardDrive, "Last backup time", environmentStatus.lastBackupTime],
                [RefreshCw, "Pending sync count", environmentStatus.pendingSyncCount],
              ].map(([Icon, label, value]) => (
                <div key={label} className="rounded-md border border-white/70 bg-white p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5" />{label}</div>
                  <div className={`mt-1 font-semibold ${String(value).toLowerCase() === "offline" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="backup-center-section">
          <div className="font-heading font-semibold mb-1">Backup Center</div>
          <p className="text-sm text-slate-600 mb-4">Run backups, restore data, and monitor cloud sync without interrupting billing.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><div className="text-xs uppercase font-semibold text-slate-500">Backup result</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.message}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Last backup time</div><div className="font-semibold">{environmentStatus.lastSuccessfulBackup}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Cloud sync status</div><div className="font-semibold">{environmentStatus.cloudSyncStatus}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Pending uploads</div><div className="font-semibold">{environmentStatus.pendingUploads}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Billing safety</div><div className="font-semibold text-emerald-700">Saved locally. Cloud upload pending.</div></div>
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Do not close the app while backup is running.
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center gap-2 font-heading font-semibold text-slate-900"><Database className="h-4 w-4" />MongoDB Atlas Backup</div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Connection status</span><span className="font-semibold">{environmentStatus.atlasConnectionStatus}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Last backup time</span><span className="font-semibold">{environmentStatus.atlasLastBackupTime}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Pending sync count</span><span className="font-semibold">{environmentStatus.atlasPendingSyncCount}</span></div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center gap-2 font-heading font-semibold text-slate-900"><Cloud className="h-4 w-4" />Google Drive Backup</div>
              <p className="mb-3 text-xs text-slate-500">Service-account backup status. No owner login is required.</p>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Service-account status</span><span className="font-semibold">{environmentStatus.googleDriveConnectionStatus}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Last backup time</span><span className="font-semibold">{environmentStatus.googleDriveLastBackupTime}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Pending upload count</span><span className="font-semibold">{environmentStatus.googleDrivePendingUploadCount}</span></div>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-emerald-100 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Backup schedule</div>
            <div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2 lg:grid-cols-4">
              <div>Auto backup every 30 minutes</div>
              <div>Backup after Daily Closing</div>
              <div>Backup on app exit</div>
              <div>Manual backup available</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><div className="text-xs uppercase font-semibold text-slate-500">Local backup</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.local}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">MongoDB Atlas backup</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.atlas}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Google Drive backup</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.googleDrive}</div></div>
          </div>
          {environmentMode === "local" && (
            <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
              Local Mode • Last backup: {environmentStatus.lastSuccessfulBackup}
            </div>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-white p-3">
              <Button type="button" onClick={backupNow} className="w-full rounded-sm bg-emerald-700 hover:bg-emerald-800"><HardDrive className="mr-2 h-4 w-4" />Backup Now</Button>
              <p className="mt-2 text-xs text-slate-600">Creates a local backup and uploads it to Atlas and Google Drive.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <Button
                type="button"
                variant="outline"
                onClick={exportBackup}
                className="w-full rounded-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Backup File
              </Button>
              <p className="mt-2 text-xs text-slate-600">Downloads a manual backup file for pen drive or external storage.</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="w-full rounded-sm border-amber-300 text-amber-800"><Upload className="mr-2 h-4 w-4" />Restore Backup</Button>
              <p className="mt-2 text-xs text-amber-800">Use only after taking a fresh backup.</p>
            </div>
            {user?.role === "admin" && (
              <div className="rounded-lg border border-blue-200 bg-white p-3">
                <Button type="button" variant="outline" onClick={syncLocalDataToCloud} disabled={syncingLocalData} className="w-full rounded-sm border-blue-200 text-blue-800">
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncingLocalData ? "animate-spin" : ""}`} />
                  {syncingLocalData ? "Syncing…" : "Sync Local Data to Cloud"}
                </Button>
                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  <div>records_synced: <span className="font-semibold">{localSyncResult.records_synced}</span></div>
                  <div>failed_tables: <span className="font-semibold">{localSyncResult.failed_tables}</span></div>
                  <div>last_sync_status: <span className="font-semibold">{localSyncResult.last_sync_status}</span></div>
                  <div>last_sync_time: <span className="font-semibold">{localSyncResult.last_sync_time}</span></div>
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={importBackup}
          />
        </div>
      </div>

      {/* ================= USERS ================= */}
      {user?.role === "admin" && (
        <div id="user-management-section" className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="font-heading font-semibold mb-3">User Management</div>

          <form onSubmit={addUser} className="grid md:grid-cols-4 gap-3 mb-4">
            <Input
              placeholder="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <Input
              placeholder="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <Input
              placeholder="Password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <div className="flex gap-2">
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </form>

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => {
                const userId = getUserId(u);
                const deleteProtection = getUserDeleteProtection(u, user);
                const isDeleting = deletingUserId === String(userId);

                return (
                  <tr key={userId ?? u.email}>
                    <td>{u.name}</td>
                    <td className="font-mono text-xs">{u.email}</td>
                    <td className="uppercase text-xs tracking-wider font-semibold">
                      {u.role}
                    </td>
                    <td className="text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={Boolean(deleteProtection) || isDeleting}
                        title={
                          deleteProtection || `Delete ${u.name || u.email}`
                        }
                        aria-label={
                          deleteProtection || `Delete ${u.name || u.email}`
                        }
                        onClick={() => deleteUser(u)}
                      >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? "Deleting..." : "Delete"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <section
        className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-900/40 dark:bg-slate-950"
        id="update-center-section"
        data-testid="update-center-section"
      >
        {(() => {
          const currentIdentity = getVersionIdentity(updateCenter?.currentVersion || versionInfo?.version || FRONTEND_VERSION);
          const latestIdentity = getVersionIdentity(updateCenter?.latestVersion || versionInfo?.version || FRONTEND_VERSION);
          const notes = updateCenter?.releaseNotes || versionInfo?.releaseNotes;
          const status = updateCenter?.unavailable
            ? "Update check unavailable"
            : updateCenter?.updateAvailable
              ? "Update available"
              : updateCenter?.lastCheckedAt
                ? "Up to date"
                : "Not checked yet";
          return (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-heading font-semibold text-slate-950 dark:text-slate-100">Update Center</div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    PharmacyOS checks for desktop updates automatically after sign-in. You can also check manually any time.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-950 px-4 py-3 text-left text-white sm:text-right">
                  <div className="text-xs text-emerald-100/70">Current Version / Build</div>
                  <div className="font-mono text-sm">v{currentIdentity.version}</div>
                  <div className="mt-1 text-[11px] text-emerald-100/70">Build {updateCenter?.currentBuild || currentIdentity.build || "—"}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Latest Version / Build", `v${latestIdentity.version} / Build ${updateCenter?.latestBuild || latestIdentity.build || "—"}`],
                  ["Status", status],
                  ["Update size", updateCenter?.updateSizeLabel || "—"],
                  ["Release date", formatUpdateDate(updateCenter?.releaseDate)],
                  ["Channel", updateCenter?.channel || "—"],
                  ["Last checked", formatUpdateCheckedAt(updateCenter?.lastCheckedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                    <div className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">{label}</div>
                    <div className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => updateCenter?.checkForUpdates()} disabled={updateCenter?.checking} className="rounded-sm bg-emerald-700 hover:bg-emerald-800">
                  <RefreshCw className={`mr-2 h-4 w-4 ${updateCenter?.checking ? "animate-spin" : ""}`} />
                  {updateCenter?.checking ? "Checking updates…" : "Check updates"}
                </Button>
                {updateCenter?.updateAvailable && (
                  <Button type="button" onClick={() => updateCenter?.updateNow()} disabled={updateCenter?.updateAction?.loading || updateCenter?.updateAction?.disabled} className="rounded-sm bg-emerald-900 hover:bg-emerald-800">
                    {updateCenter?.updateAction?.loading ? "Starting update..." : "Update Now"}
                  </Button>
                )}
                {updateCenter?.updateAction?.canOpenDownload && updateCenter?.hasDownloadUrl && (
                  <Button type="button" variant="outline" onClick={() => updateCenter?.openDownload()} className="rounded-sm border-emerald-200">
                    Open Download
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => updateCenter?.openWhatsNew()} className="rounded-sm border-emerald-200">
                  What’s New
                </Button>
              </div>

              {updateCenter?.updateAvailable && (
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-medium text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    Please save any current bill or purchase entry before updating.
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    The app may close and reopen during update.
                  </div>
                  {updateCenter?.updateAction?.message && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 font-medium text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100" role="status">
                      {updateCenter.updateAction.message}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <RefreshCw className="h-4 w-4" />
                  What’s new / Release notes
                </div>
                {hasReleaseNotes(notes) ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {RELEASE_NOTE_GROUPS.filter(({ key }) => notes?.[key]?.length).map(({ key, label }) => (
                      <section key={key}>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">{label}</div>
                        <ul className="grid gap-2">
                          {dedupeUpdateNotes(notes[key]).map((note) => (
                            <li key={`${key}-${note}`} className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              {note}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    No release notes available.
                  </p>
                )}
              </div>
            </>
          );
        })()}
      </section>
    </div>
  );
}
