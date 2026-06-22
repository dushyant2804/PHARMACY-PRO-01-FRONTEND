import React, { useRef, useState, useEffect } from "react";
import api, {
  formatApiError,
  getApiBaseUrl,
  getApiMode,
  getLocalBackendUrl,
  setApiMode,
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
  AlertTriangle,
  UserPlus,
  Trash2,
  Image as ImageIcon,
  X,
  Building2,
  RefreshCw,
  CheckCircle2,
  Link as LinkIcon,
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
    googleDriveConnectionStatus: "Not connected",
    googleDriveAccount: "—",
    googleDriveLastBackupTime: "—",
    googleDrivePendingUploadCount: 0,
  });
  const [checkingEnvironment, setCheckingEnvironment] = useState(false);
  const [testingLocalServer, setTestingLocalServer] = useState(false);
  const [runningLocalImportGuard, setRunningLocalImportGuard] = useState(false);
  const [confirmingLocalImport, setConfirmingLocalImport] = useState(false);
  const [localImportGuard, setLocalImportGuard] = useState({
    status: "Not started",
    message: "Run dry-run import before switching to Local Mode.",
    dryRunEndpoint: "—",
    importEndpoint: "—",
    requestUrl: "—",
    requestMethod: "—",
    browserErrorName: "—",
    browserErrorMessage: "—",
    responseExists: "—",
    counts: {},
    localUsersReady: false,
    confirmed: false,
  });
  const [testingAtlas, setTestingAtlas] = useState(false);
  const [testingGoogleDrive, setTestingGoogleDrive] = useState(false);
  const [connectingGoogleDrive, setConnectingGoogleDrive] = useState(false);
  const [backupResult, setBackupResult] = useState({
    local: "Local backup pending",
    atlas: "MongoDB Atlas backup pending",
    googleDrive: "Google Drive backup pending",
    message: "Backup pending",
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

  const normalizeConnectionStatus = (value, fallback = "Connected") => {
    if (typeof value === "boolean") return value ? "Connected" : "Offline";
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return fallback;
    if (["ok", "up", "online", "healthy", "ready", "success", "connected", "true"].includes(normalized)) return "Connected";
    if (["down", "offline", "unhealthy", "failed", "error", "false", "disconnected"].includes(normalized)) return "Offline";
    return String(value);
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

  const getLocalImportEndpoint = ({ dryRun, url = localBackendUrl }) => {
    const normalizedUrl = (url || getLocalBackendUrl()).trim().replace(/\/$/, "");
    return `${normalizedUrl}/api/local/import/${dryRun ? "dry-run" : "confirm"}`;
  };

  const flattenImportCounts = (value, prefix = "") => {
    if (!value || typeof value !== "object") return {};
    return Object.entries(value).reduce((acc, [key, entry]) => {
      const label = prefix ? `${prefix}.${key}` : key;
      if (typeof entry === "number" || typeof entry === "string" || typeof entry === "boolean") {
        acc[label] = entry;
      } else if (entry && typeof entry === "object") {
        Object.assign(acc, flattenImportCounts(entry, label));
      }
      return acc;
    }, {});
  };

  const extractImportCounts = (data = {}) => {
    const source = data.counts || data.dry_run_counts || data.imported || data.summary || data;
    return flattenImportCounts(source);
  };

  const hasLocalUsers = (data = {}) => {
    const counts = extractImportCounts(data);
    const userKeys = Object.keys(counts).filter((key) => key.toLowerCase().includes("user"));
    if (userKeys.some((key) => Number(counts[key]) > 0)) return true;
    const userCollections = [data.users, data.local_users, data.imported?.users, data.counts?.users, data.summary?.users];
    return userCollections.some((value) => Array.isArray(value) ? value.length > 0 : Number(value) > 0);
  };

  const callLocalImport = async ({ dryRun, url = localBackendUrl }) => {
    const endpoint = getLocalImportEndpoint({ dryRun, url });
    const method = "POST";
    const token = localStorage.getItem("token");
    const requestDetails = {
      requestUrl: endpoint,
      requestMethod: method,
      responseExists: false,
    };

    try {
      const response = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(dryRun ? { dry_run: true, source: "cloud", target: "local" } : { overwrite_local: true }),
      });
      requestDetails.responseExists = true;
      console.info("Local import request completed", {
        ...requestDetails,
        status: response.status,
        ok: response.ok,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.detail || data?.message || data?.error || `Import ${dryRun ? "dry-run" : "confirm"} failed with ${response.status} at ${endpoint}`;
        const error = new Error(message);
        error.localImportRequest = {
          ...requestDetails,
          browserErrorName: error.name,
          browserErrorMessage: error.message,
          status: response.status,
        };
        throw error;
      }
      return { endpoint, data, requestDetails };
    } catch (error) {
      const responseExists = Boolean(error?.localImportRequest?.responseExists);
      const browserErrorName = error?.name || "Error";
      const browserErrorMessage = error?.message || String(error);
      const localImportRequest = {
        ...requestDetails,
        ...error?.localImportRequest,
        responseExists,
        browserErrorName,
        browserErrorMessage,
      };
      console.error("Local import request failed", localImportRequest);
      error.localImportRequest = localImportRequest;
      if (!responseExists) {
        error.message = "Could not reach local import endpoint. Check CORS or local server logs.";
      }
      throw error;
    }
  };

  const runLocalImportDryRun = async () => {
    setRunningLocalImportGuard(true);
    setLocalImportGuard((current) => ({ ...current, status: "Testing local server", confirmed: false }));
    try {
      const localServerReady = await testLocalServer(localBackendUrl, { showToast: false });
      if (!localServerReady) throw new Error("Local PharmacyOS server is not running.");

      const dryRunEndpoint = getLocalImportEndpoint({ dryRun: true });
      setLocalImportGuard((current) => ({
        ...current,
        status: "Running dry-run import",
        dryRunEndpoint,
        importEndpoint: "—",
        requestUrl: dryRunEndpoint,
        requestMethod: "POST",
        browserErrorName: "—",
        browserErrorMessage: "—",
        responseExists: "Pending",
      }));
      const { endpoint, data } = await callLocalImport({ dryRun: true });
      const counts = extractImportCounts(data);
      const localUsersReady = hasLocalUsers(data);
      setLocalImportGuard({
        status: localUsersReady ? "Dry-run complete" : "Local users missing",
        message: localUsersReady ? "Review counts, then confirm import to enable Local Mode." : "Import cloud data first so your login works locally.",
        dryRunEndpoint: endpoint,
        importEndpoint: "—",
        requestUrl: endpoint,
        requestMethod: "POST",
        browserErrorName: "—",
        browserErrorMessage: "—",
        responseExists: "Yes",
        counts,
        localUsersReady,
        confirmed: false,
      });
      toast[localUsersReady ? "success" : "error"](localUsersReady ? "Dry-run import completed. Review counts before confirming." : "Import cloud data first so your login works locally.");
    } catch (error) {
      const details = error?.localImportRequest || {};
      setLocalImportGuard((current) => ({
        ...current,
        status: "Dry-run failed",
        message: error?.message || "Dry-run import failed.",
        requestUrl: details.requestUrl || current.requestUrl || getLocalImportEndpoint({ dryRun: true }),
        requestMethod: details.requestMethod || "POST",
        browserErrorName: details.browserErrorName || error?.name || "Error",
        browserErrorMessage: details.browserErrorMessage || error?.message || "Dry-run import failed.",
        responseExists: details.responseExists ? "Yes" : "No",
        localUsersReady: false,
        confirmed: false,
      }));
      toast.error(error?.message || "Dry-run import failed.");
    } finally {
      setRunningLocalImportGuard(false);
    }
  };

  const confirmLocalImport = async () => {
    if (!localImportGuard.localUsersReady) {
      toast.error("Import cloud data first so your login works locally.");
      return;
    }
    if (!window.confirm("Import cloud data into the local server now?")) return;
    const importEndpoint = getLocalImportEndpoint({ dryRun: false });
    setConfirmingLocalImport(true);
    setLocalImportGuard((current) => ({
      ...current,
      status: "Confirming import",
      importEndpoint,
      requestUrl: importEndpoint,
      requestMethod: "POST",
      browserErrorName: "—",
      browserErrorMessage: "—",
      responseExists: "Pending",
    }));
    try {
      const { endpoint, data } = await callLocalImport({ dryRun: false });
      const counts = extractImportCounts(data);
      const localUsersReady = hasLocalUsers(data) || localImportGuard.localUsersReady;
      setLocalImportGuard((current) => ({
        ...current,
        status: localUsersReady ? "Import Completed" : "Local users missing",
        message: localUsersReady ? "Import completed. Local Mode switch is now allowed." : "Import cloud data first so your login works locally.",
        importEndpoint: endpoint,
        requestUrl: endpoint,
        requestMethod: "POST",
        browserErrorName: "—",
        browserErrorMessage: "—",
        responseExists: "Yes",
        counts: Object.keys(counts).length ? counts : current.counts,
        localUsersReady,
        confirmed: localUsersReady,
      }));
      toast[localUsersReady ? "success" : "error"](localUsersReady ? "Import completed. You can switch to Local Mode." : "Import cloud data first so your login works locally.");
    } catch (error) {
      const details = error?.localImportRequest || {};
      setLocalImportGuard((current) => ({
        ...current,
        status: "Import failed",
        message: error?.message || "Local import failed.",
        requestUrl: details.requestUrl || current.requestUrl || importEndpoint,
        requestMethod: details.requestMethod || "POST",
        browserErrorName: details.browserErrorName || error?.name || "Error",
        browserErrorMessage: details.browserErrorMessage || error?.message || "Local import failed.",
        responseExists: details.responseExists ? "Yes" : "No",
        confirmed: false,
      }));
      toast.error(error?.message || "Local import failed.");
    } finally {
      setConfirmingLocalImport(false);
    }
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
    cloudSyncStatus: data.cloud_sync_status || data.sync_status || "Ready",
    pendingUploads: Number(data.pending_uploads ?? data.pending_sync_count ?? 0),
    atlasConnectionStatus: data.atlas_connection_status || data.mongodb_atlas_status || data.atlas_status || data.cloud_sync_status || "Ready",
    atlasLastBackupTime: data.atlas_last_backup_time || data.mongodb_atlas_last_backup_at || data.atlas_last_backup_at || data.last_backup_time || "—",
    atlasPendingSyncCount: Number(data.atlas_pending_sync_count ?? data.mongodb_atlas_pending_sync_count ?? data.pending_sync_count ?? 0),
    googleDriveConnectionStatus: data.google_drive_connection_status || data.drive_connection_status || (data.google_drive_account ? "Connected" : "Not connected"),
    googleDriveAccount: data.google_drive_account || data.drive_account_email || data.google_account_email || "—",
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
      const mergedStatus = normalizeBackupStatus({ ...healthData, ...backupData });
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
          failedHealthUrls: localMode ? healthResult.failures : undefined,
        },
        backend: backendStatus,
        database: normalizeConnectionStatus(healthData.database ?? healthData.database_status ?? healthData.db_status ?? healthData.database_connected ?? backupData.database ?? backupData.database_status ?? backupData.db_status ?? backupData.database_connected, backendStatus === "Offline" ? "Offline" : "Connected"),
      });
      console.info("Backup & Restore status response", { healthEndpoint: localMode && healthResult.endpoint ? healthResult.endpoint : healthEndpoint, backupStatusEndpoint, health: healthData, backupStatus: backupData, failedHealthUrls: localMode ? healthResult.failures : undefined });
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

  const saveEnvironmentMode = async (mode) => {
    if (mode === environmentMode) return;
    if (!window.confirm("Changing mode will reload the app.")) return;

    if (mode === "local") {
      const localServerReady = await testLocalServer(localBackendUrl, { showToast: false });
      if (!localServerReady) {
        const failedText = localServerTest.failedEndpoint !== "—" ? ` Last failed endpoint: ${localServerTest.failedEndpoint}. ${localServerTest.error}` : "";
        toast.error(`Local PharmacyOS server is not running after testing all health endpoints.${failedText}`);
        return;
      }
      if (!localImportGuard.confirmed || !localImportGuard.localUsersReady) {
        toast.error("Import cloud data first so your login works locally.");
        setLocalImportGuard((current) => ({
          ...current,
          status: "Local Mode blocked",
          message: "Import cloud data first so your login works locally.",
        }));
        return;
      }
    }

    setApiMode(mode);
    setEnvironmentMode(mode);
    setEnvironmentStatus((current) => ({ ...current, backend: "Checking", database: "Checking" }));
    window.location.reload();
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
      googleDrive: "Google Drive backup pending",
      message: "Backup pending",
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
        nextResult.message = "Saved locally. Cloud backup pending.";
        nextResult.tone = "text-amber-700";
      }
      setBackupResult(nextResult);
      setEnvironmentStatus((current) => ({
        ...current,
        lastBackupTime,
        lastSuccessfulBackup: lastBackupTime,
        cloudSyncStatus: data.cloud_sync_status || (hasPendingCloud ? "Backup pending" : current.cloudSyncStatus || "Ready"),
        pendingUploads: Number(data.pending_uploads ?? current.pendingUploads ?? 0),
        atlasConnectionStatus: data.atlas_connection_status || data.mongodb_atlas_status || current.atlasConnectionStatus,
        atlasLastBackupTime: data.atlas_last_backup_time || data.mongodb_atlas_last_backup_at || lastBackupTime,
        atlasPendingSyncCount: Number(data.atlas_pending_sync_count ?? current.atlasPendingSyncCount ?? 0),
        googleDriveConnectionStatus: data.google_drive_connection_status || current.googleDriveConnectionStatus,
        googleDriveAccount: data.google_drive_account || data.drive_account_email || current.googleDriveAccount,
        googleDriveLastBackupTime: data.google_drive_last_backup_time || data.drive_last_backup_at || lastBackupTime,
        googleDrivePendingUploadCount: Number(data.google_drive_pending_upload_count ?? data.pending_uploads ?? current.googleDrivePendingUploadCount ?? 0),
      }));
      toast[hasPendingCloud ? "warning" : "success"](nextResult.message);
      refreshEnvironmentStatus();
    } catch (e) {
      setBackupResult({
        local: "Local backup successful",
        atlas: "MongoDB Atlas backup pending",
        googleDrive: "Google Drive backup pending",
        message: "Saved locally. Cloud backup pending.",
        tone: "text-amber-700",
      });
      setEnvironmentStatus((current) => ({
        ...current,
        cloudSyncStatus: "Backup pending",
        pendingUploads: Math.max(Number(current.pendingUploads || 0), 1),
        atlasConnectionStatus: "Pending",
        googleDriveConnectionStatus: current.googleDriveConnectionStatus === "Connected" ? "Pending" : current.googleDriveConnectionStatus,
      }));
      toast.warning("Saved locally. Cloud backup pending.");
    }
  };

  const testAtlasConnection = async () => {
    setTestingAtlas(true);
    try {
      const { data = {} } = await api.post("/backup/atlas/test");
      setEnvironmentStatus((current) => ({ ...current, atlasConnectionStatus: data.status || "Connected" }));
      toast.success("MongoDB Atlas backup connection is ready.");
    } catch (e) {
      setEnvironmentStatus((current) => ({ ...current, atlasConnectionStatus: "Failed" }));
      toast.error("MongoDB Atlas backup connection failed.");
    } finally {
      setTestingAtlas(false);
    }
  };

  const connectGoogleDrive = async () => {
    setConnectingGoogleDrive(true);
    try {
      const { data = {} } = await api.post("/backup/google-drive/connect");
      if (data.auth_url) window.location.href = data.auth_url;
      setEnvironmentStatus((current) => ({
        ...current,
        googleDriveConnectionStatus: data.status || "Connected",
        googleDriveAccount: data.account || data.email || current.googleDriveAccount,
      }));
      toast.success("Google Drive connection started.");
    } catch (e) {
      toast.error("Could not connect Google Drive.");
    } finally {
      setConnectingGoogleDrive(false);
    }
  };

  const testGoogleDriveConnection = async () => {
    setTestingGoogleDrive(true);
    try {
      const { data = {} } = await api.post("/backup/google-drive/test");
      setEnvironmentStatus((current) => ({ ...current, googleDriveConnectionStatus: data.status || "Connected" }));
      toast.success("Google Drive backup connection is ready.");
    } catch (e) {
      setEnvironmentStatus((current) => ({ ...current, googleDriveConnectionStatus: "Failed" }));
      toast.error("Google Drive backup connection failed.");
    } finally {
      setTestingGoogleDrive(false);
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
              <p className="mt-1 text-sm text-emerald-900">Switch between the current cloud backend and a local PharmacyOS server without changing API paths.</p>
            </div>
            <Button type="button" variant="outline" onClick={refreshEnvironmentStatus} disabled={checkingEnvironment} className="rounded-sm border-emerald-200 bg-white">
              <RefreshCw className={`mr-2 h-4 w-4 ${checkingEnvironment ? "animate-spin" : ""}`} />
              Refresh status
            </Button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-md border border-white/70 bg-white p-3">
              <Label className="text-xs uppercase font-semibold text-slate-600">Mode</Label>
              <Select value={environmentMode} onValueChange={saveEnvironmentMode}>
                <SelectTrigger className="mt-1 rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>
              <Label className="mt-3 block text-xs uppercase font-semibold text-slate-600">Local backend URL</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Input value={localBackendUrl} onChange={(event) => setLocalBackendUrlState(event.target.value)} className="min-w-64 flex-1 rounded-sm" placeholder="http://localhost:8000" />
                <Button type="button" variant="outline" onClick={() => setLocalBackendUrlState(persistLocalBackendUrl(localBackendUrl))}>Save URL</Button>
                <Button type="button" variant="outline" onClick={() => testLocalServer()} disabled={testingLocalServer}>
                  <Server className="mr-2 h-4 w-4" />
                  {testingLocalServer ? "Testing…" : "Test Local Server"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Active API base: <span className="font-mono">{getApiBaseUrl(environmentMode)}</span></p>
              <p className="mt-1 text-xs text-slate-500">Status endpoint: <span className="font-mono">{environmentStatus.endpoint}</span></p>
              <p className="mt-1 text-xs font-semibold text-amber-700">Changing mode will reload the app. Local mode is saved only after the health check passes.</p>
              {localServerTest.status === "Connected" && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Local Server Connected
                </div>
              )}
              <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3" data-testid="local-import-guard">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-950">Local Mode Import Guard</div>
                    <p className="mt-1 text-xs text-blue-900">Test the local server, run a local import dry-run, review counts, then confirm the import before Local Mode is enabled.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={runLocalImportDryRun} disabled={runningLocalImportGuard || confirmingLocalImport} className="rounded-sm bg-white">
                      <RefreshCw className={`mr-2 h-4 w-4 ${runningLocalImportGuard ? "animate-spin" : ""}`} />
                      {runningLocalImportGuard ? "Running…" : "Run Dry-Run Import"}
                    </Button>
                    <Button type="button" onClick={confirmLocalImport} disabled={confirmingLocalImport || runningLocalImportGuard || !localImportGuard.localUsersReady} className="rounded-sm bg-blue-600 hover:bg-blue-700">
                      {confirmingLocalImport ? "Importing…" : "Confirm Import"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                  <div>Status: <span className="font-semibold">{localImportGuard.status}</span></div>
                  <div>Local users: <span className={localImportGuard.localUsersReady ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{localImportGuard.localUsersReady ? "Found" : "Missing"}</span></div>
                  <div>Dry-run endpoint: <span className="font-mono">{localImportGuard.dryRunEndpoint}</span></div>
                  <div>Import endpoint: <span className="font-mono">{localImportGuard.importEndpoint}</span></div>
                  <div>Request URL: <span className="font-mono">{localImportGuard.requestUrl}</span></div>
                  <div>HTTP method: <span className="font-mono">{localImportGuard.requestMethod}</span></div>
                  <div>Browser error: <span className="font-mono">{localImportGuard.browserErrorName}</span></div>
                  <div>Response object: <span className="font-mono">{localImportGuard.responseExists}</span></div>
                  <div className="md:col-span-2">Browser message: <span className="font-mono">{localImportGuard.browserErrorMessage}</span></div>
                </div>
                <div className={`mt-2 rounded border px-2 py-1 text-xs font-semibold ${localImportGuard.localUsersReady ? "border-emerald-100 bg-white text-emerald-800" : "border-amber-100 bg-amber-50 text-amber-800"}`}>
                  {localImportGuard.message}
                </div>
                {Object.keys(localImportGuard.counts).length > 0 && (
                  <div className="mt-3 rounded border border-blue-100 bg-white p-2">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Dry-run counts</div>
                    <div className="grid gap-1 text-xs sm:grid-cols-2">
                      {Object.entries(localImportGuard.counts).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3 rounded bg-slate-50 px-2 py-1">
                          <span className="font-mono text-slate-600">{key}</span>
                          <span className="font-semibold text-slate-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
          {environmentMode === "local" && environmentStatus.backend === "Offline" && environmentStatus.response?.health?.error && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div>Local PharmacyOS server is not running.</div>
                  <div className="mt-2 font-normal">
                    To use Local Mode:<br />
                    1. Start PharmacyOS Local Server.<br />
                    2. Click Test Local Server.<br />
                    3. Switch to Local Mode after the connection succeeds.
                  </div>
                  {localServerTest.failedEndpoint !== "—" && (
                    <div className="mt-2 font-mono text-xs text-red-700">Failed endpoint: {localServerTest.failedEndpoint} — {localServerTest.error}</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-slate-700">
            <div className="mb-2 flex items-center gap-2 font-semibold text-blue-950"><Server className="h-3.5 w-3.5" />Local Mode Setup Help</div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>Current local server URL: <span className="font-mono">{(localBackendUrl || getLocalBackendUrl()).trim().replace(/\/$/, "")}</span></div>
              <div>Last tested URL: <span className="font-mono">{localServerTest.lastTestedUrl}</span></div>
              <div>Connection status: <span className={localServerTest.status === "Connected" ? "font-semibold text-emerald-700" : localServerTest.status === "Offline" ? "font-semibold text-red-700" : "font-semibold text-slate-700"}>{localServerTest.status}</span></div>
              <div>Health endpoint result: <span className="font-mono">{localServerTest.healthResult}</span></div>
            </div>
            {localServerTest.status === "Offline" && localServerTest.failedEndpoint !== "—" && (
              <div className="mt-2 rounded border border-red-100 bg-white px-2 py-1 text-red-700">
                Test failed at <span className="font-mono">{localServerTest.failedEndpoint}</span>: {localServerTest.error}
              </div>
            )}
          </div>
          <details className="mt-3 rounded-md border border-emerald-100 bg-white p-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-emerald-900">Health/status response</summary>
            <div className="mt-2 grid gap-1">
              <div>Health endpoint: <span className="font-mono">{environmentStatus.healthEndpoint}</span></div>
              <div>Backup endpoint: <span className="font-mono">{environmentStatus.backupStatusEndpoint}</span></div>
              {environmentStatus.response?.failedHealthUrls?.length > 0 && (
                <div>Failed URL: <span className="font-mono text-red-700">{environmentStatus.response.failedHealthUrls[environmentStatus.response.failedHealthUrls.length - 1].endpoint}</span></div>
              )}
            </div>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-950 p-3 text-[11px] text-slate-100">{JSON.stringify(environmentStatus.response, null, 2)}</pre>
          </details>
        </div>

        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="backup-center-section">
          <div className="font-heading font-semibold mb-1">Backup Center</div>
          <p className="text-sm text-slate-600 mb-4">Run backups, restore data, and monitor cloud sync without interrupting billing.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><div className="text-xs uppercase font-semibold text-slate-500">Backup result</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.message}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Last backup time</div><div className="font-semibold">{environmentStatus.lastSuccessfulBackup}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Cloud sync status</div><div className="font-semibold">{environmentStatus.cloudSyncStatus}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Pending uploads</div><div className="font-semibold">{environmentStatus.pendingUploads}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Billing safety</div><div className="font-semibold text-emerald-700">Saved locally. Cloud backup pending.</div></div>
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
              <Button type="button" variant="outline" onClick={testAtlasConnection} disabled={testingAtlas} className="mt-3 rounded-sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${testingAtlas ? "animate-spin" : ""}`} />
                {testingAtlas ? "Testing Atlas…" : "Test Atlas connection"}
              </Button>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center gap-2 font-heading font-semibold text-slate-900"><Cloud className="h-4 w-4" />Google Drive Backup</div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Connected account</span><span className="font-semibold">{environmentStatus.googleDriveAccount}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Connection status</span><span className="font-semibold">{environmentStatus.googleDriveConnectionStatus}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Last backup time</span><span className="font-semibold">{environmentStatus.googleDriveLastBackupTime}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Pending upload count</span><span className="font-semibold">{environmentStatus.googleDrivePendingUploadCount}</span></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={connectGoogleDrive} disabled={connectingGoogleDrive} className="rounded-sm"><LinkIcon className="mr-2 h-4 w-4" />{connectingGoogleDrive ? "Connecting…" : "Connect Google Drive"}</Button>
                <Button type="button" variant="outline" onClick={testGoogleDriveConnection} disabled={testingGoogleDrive} className="rounded-sm"><RefreshCw className={`mr-2 h-4 w-4 ${testingGoogleDrive ? "animate-spin" : ""}`} />{testingGoogleDrive ? "Testing Drive…" : "Test Google Drive connection"}</Button>
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
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div><div className="text-xs uppercase font-semibold text-slate-500">Local backup</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.local}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">MongoDB Atlas backup</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.atlas}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Google Drive backup</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.googleDrive}</div></div>
          </div>
          {environmentMode === "local" && (
            <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">
              Local Mode • Last backup: {environmentStatus.lastSuccessfulBackup}
            </div>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              <Button type="button" variant="outline" disabled className="w-full rounded-sm border-amber-300 text-amber-800" title="Restore is experimental until backend restore is fully verified."><Upload className="mr-2 h-4 w-4" />Restore Backup (Experimental)</Button>
              <p className="mt-2 text-xs text-amber-800">Experimental. Use only after testing.</p>
            </div>
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
        className="rounded-xl border border-slate-200 bg-white p-5"
        id="update-center-section"
        data-testid="update-center-section"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-heading font-semibold">Update Center</div>
            <p className="mt-1 text-sm text-slate-600">
              Version details and the latest improvements available to your
              pharmacy.
            </p>
          </div>
          <div className="rounded-lg bg-emerald-950 px-3 py-2 text-left text-white sm:text-right">
            <div className="text-xs text-emerald-100/70">Current version/build</div>
            <div className="font-mono text-sm">
              v
              {
                getVersionIdentity(updateCenter?.latestVersion || versionInfo?.version || FRONTEND_VERSION)
                  .version
              }
            </div>
            {getVersionIdentity(updateCenter?.latestVersion || versionInfo?.version || FRONTEND_VERSION)
              .build && (
              <div className="mt-1 text-[11px] text-emerald-100/70">
                Build{" "}
                {
                  getVersionIdentity(updateCenter?.latestVersion || versionInfo?.version || FRONTEND_VERSION)
                    .build
                }
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <Button type="button" onClick={() => updateCenter?.checkForUpdates()} disabled={updateCenter?.checking} className="rounded-sm bg-emerald-700 hover:bg-emerald-800">
            <RefreshCw className={`mr-2 h-4 w-4 ${updateCenter?.checking ? "animate-spin" : ""}`} />
            {updateCenter?.checking ? "Checking updates…" : "Check updates"}
          </Button>
          <Button type="button" variant="outline" onClick={() => updateCenter?.openWhatsNew()} className="rounded-sm border-emerald-200">
            What’s New
          </Button>
          <span className="text-sm font-semibold text-emerald-950">Update status: {updateCenter?.checkStatus || "Ready to check"}</span>
        </div>
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <RefreshCw className="h-4 w-4" />
            What’s new / Release notes
          </div>
          {hasReleaseNotes(updateCenter?.releaseNotes || versionInfo?.releaseNotes) ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {RELEASE_NOTE_GROUPS.filter(
                ({ key }) => (updateCenter?.releaseNotes || versionInfo?.releaseNotes)?.[key]?.length,
              ).map(({ key, label }) => (
                <section key={key}>
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                    {label}
                  </div>
                  <ul className="grid gap-2">
                    {(updateCenter?.releaseNotes || versionInfo?.releaseNotes)[key].map((note) => (
                      <li
                        key={`${key}-${note}`}
                        className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No release notes available for this update.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
