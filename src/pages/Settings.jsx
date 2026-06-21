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
    backend: "Checking",
    database: "Checking",
    lastBackupTime: "—",
    pendingSyncCount: 0,
    lastSuccessfulBackup: "—",
    cloudSyncStatus: "Checking",
    pendingUploads: 0,
  });
  const [checkingEnvironment, setCheckingEnvironment] = useState(false);
  const [testingLocalServer, setTestingLocalServer] = useState(false);
  const [backupResult, setBackupResult] = useState({
    status: "Backup pending",
    tone: "text-amber-700",
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

  const normalizeBackupStatus = (data = {}) => ({
    backend: data.backend || data.backend_status || "Connected",
    database: data.database || data.database_status || (data.database_connected === false ? "Offline" : "Connected"),
    lastBackupTime: data.last_backup_time || data.last_backup_at || data.last_successful_backup || "—",
    pendingSyncCount: Number(data.pending_sync_count ?? data.pending_sync ?? data.pending_uploads ?? 0),
    lastSuccessfulBackup: data.last_successful_backup || data.last_backup_time || data.last_backup_at || "—",
    cloudSyncStatus: data.cloud_sync_status || data.sync_status || "Ready",
    pendingUploads: Number(data.pending_uploads ?? data.pending_sync_count ?? 0),
  });

  const refreshEnvironmentStatus = async () => {
    setCheckingEnvironment(true);
    try {
      const [healthResult, backupResult] = await Promise.allSettled([
        api.get("/health"),
        api.get("/backup/status"),
      ]);
      const healthData = healthResult.status === "fulfilled" ? healthResult.value.data || {} : {};
      const backupData = backupResult.status === "fulfilled" ? backupResult.value.data || {} : {};
      if (healthResult.status === "rejected" && environmentMode === "local") {
        toast.warning("Local PharmacyOS server is not running.");
      }
      setEnvironmentStatus({
        ...normalizeBackupStatus({ ...healthData, ...backupData }),
        backend: healthResult.status === "fulfilled" ? "Connected" : "Offline",
        database: healthData.database || healthData.database_status || backupData.database || (healthResult.status === "fulfilled" ? "Connected" : "Offline"),
      });
    } finally {
      setCheckingEnvironment(false);
    }
  };

  const testLocalServer = async (url = localBackendUrl, { showToast = true } = {}) => {
    const normalizedUrl = (url || getLocalBackendUrl()).trim().replace(/\/$/, "");
    setTestingLocalServer(true);
    try {
      const response = await fetch(`${normalizedUrl}/api/health`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Health check failed");
      setLocalBackendUrlState(persistLocalBackendUrl(normalizedUrl));
      if (showToast) toast.success("Local PharmacyOS server is connected.");
      return true;
    } catch (error) {
      if (showToast) toast.error("Local PharmacyOS server is not running.");
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
        toast.error("Local PharmacyOS server is not running.");
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

  const backupNow = async () => {
    setBackupResult({ status: "Backup pending", tone: "text-amber-700" });
    try {
      const { data } = await api.post("/backup/run");
      const lastBackupTime = data?.last_backup_time || data?.last_backup_at || new Date().toISOString();
      setBackupResult({ status: "Backup successful", tone: "text-emerald-700" });
      setEnvironmentStatus((current) => ({
        ...current,
        lastBackupTime,
        lastSuccessfulBackup: lastBackupTime,
        cloudSyncStatus: data?.cloud_sync_status || current.cloudSyncStatus || "Ready",
        pendingUploads: Number(data?.pending_uploads ?? current.pendingUploads ?? 0),
      }));
      toast.success("Backup successful");
      refreshEnvironmentStatus();
    } catch (e) {
      setBackupResult({ status: "Backup failed", tone: "text-red-600" });
      setEnvironmentStatus((current) => ({
        ...current,
        cloudSyncStatus: "Backup pending",
        pendingUploads: Math.max(Number(current.pendingUploads || 0), 1),
      }));
      toast.warning("Saved locally. Cloud backup pending.");
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
              <p className="mt-1 text-xs font-semibold text-amber-700">Changing mode will reload the app. Local mode is saved only after the health check passes.</p>
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
          {environmentMode === "local" && environmentStatus.backend === "Offline" && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Local PharmacyOS server is not running.
            </div>
          )}
        </div>

        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="backup-center-section">
          <div className="font-heading font-semibold mb-1">Backup Center</div>
          <p className="text-sm text-slate-600 mb-4">Run backups, restore data, and monitor cloud sync without interrupting billing.</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div><div className="text-xs uppercase font-semibold text-slate-500">Backup result</div><div className={`font-semibold ${backupResult.tone}`}>{backupResult.status}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Last backup time</div><div className="font-semibold">{environmentStatus.lastSuccessfulBackup}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Cloud sync status</div><div className="font-semibold">{environmentStatus.cloudSyncStatus}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Pending uploads</div><div className="font-semibold">{environmentStatus.pendingUploads}</div></div>
            <div><div className="text-xs uppercase font-semibold text-slate-500">Billing safety</div><div className="font-semibold text-emerald-700">Saved locally. Cloud backup pending.</div></div>
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Do not close the app while backup is running.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={backupNow} className="rounded-sm bg-emerald-700 hover:bg-emerald-800"><HardDrive className="mr-2 h-4 w-4" />Backup now</Button>
            <Button type="button" variant="outline" disabled className="rounded-sm" title="Restore is experimental until backend restore is fully verified."><Upload className="mr-2 h-4 w-4" />Restore backup (Experimental)</Button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={exportBackup}
            className="rounded-sm bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Backup
          </Button>

          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="rounded-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Backup (Experimental)
          </Button>

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
