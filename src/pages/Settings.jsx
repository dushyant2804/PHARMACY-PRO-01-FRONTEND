import React, { useRef, useState, useEffect } from "react";
import api, { formatApiError } from "@/lib/api";
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
  UserPlus,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/* 👉 NEW: FONT SYSTEM */
import { useFont } from "@/contexts/FontContext";
import { fonts } from "@/lib/fonts";

export default function Settings() {
  const { user } = useAuth();

  /* 👉 NEW: FONT HOOK */
  const { font, setFont } = useFont();

  const fileRef = useRef();
  const sigRef = useRef();

  const [users, setUsers] = useState([]);

  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "cashier",
  });

  const [settings, setSettings] = useState({
    business_name: "MedStock Pharmacy",
    business_address: "",
    business_phone: "",
    business_gstin: "",
    signature_b64: "",
  });

  const [welcomeText, setWelcomeText] = useState(
    localStorage.getItem("welcomeText") || 
    "WELCOME TO YOUR PHARMACY" 
  );

  const [welcomeLogo, setWelcomeLogo] = useState(
    localStorage.getItem("welcomeLogo") || "💊"
  );

  const [welcomeEffect, setWelcomeEffect] = useState(
    localStorage.getItem("welcomeEffect") || "typing"
  );

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

  useEffect(() => {
    if (user?.role === "admin") loadUsers();
    loadSettings();
    // eslint-disable-next-line
  }, [user]);

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
          .join(", ")}`
      );
    } catch (e) {
      toast.error("Invalid backup file");
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", form);
      toast.success("User created");
      setForm({ email: "", name: "", password: "", role: "cashier" });
      loadUsers();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const saveWelcomeSettings = () => {
    localStorage.setItem(
      "welcomeText",
      welcomeText
    );

    localStorage.setItem(
      "welcomeLogo",
      welcomeLogo
    );

    localStorage.setItem(
      "welcomeEffect",
      welcomeEffect
    );

    toast.success("Welcome screen updated");
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
          Admin
        </div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          Settings
        </h1>
      </div>

      {/* ================= FONT SETTINGS (NEW SECTION) ================= */}
      <div className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">
          Font Style
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Change how your app feels instantly.
        </p>

        <div className="grid gap-2">
          {Object.entries(fonts).map(([key, f]) => (
            <button
              key={key}
              onClick={() => setFont(f.value)}
              className={`px-4 py-2 border rounded text-left transition ${
                font === f.value
                  ? "bg-black text-white"
                  : "hover:bg-slate-100"
              }`}
              style={{ fontFamily: f.value }}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* ================= BUSINESS PROFILE ================= */}
      <div className="bg-white border border-slate-200 rounded-sm p-5">
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
                onClick={() =>
                  setSettings({ ...settings, signature_b64: "" })
                }
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
              if (f.size > 1024 * 1024)
                return toast.error("Max 1MB image");

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
                toast.success("Settings saved");
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

      {/* ================= BACKUP ================= */}
      <div className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="font-heading font-semibold mb-3">
          Backup & Restore
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Download a JSON snapshot of all data, or restore from a
          previously exported file.
        </p>

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
            Import Backup
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
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="font-heading font-semibold mb-3">
            User Management
          </div>

          <form
            onSubmit={addUser}
            className="grid md:grid-cols-4 gap-3 mb-4"
          >
            <Input
              placeholder="Name"
              required
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <Input
              placeholder="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <Input
              placeholder="Password"
              type="password"
              required
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />

            <div className="flex gap-2">
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v })
                }
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="pharmacist">
                    Pharmacist
                  </SelectItem>
                  <SelectItem value="cashier">
                    Cashier
                  </SelectItem>
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
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="font-mono text-xs">
                    {u.email}
                  </td>
                  <td className="uppercase text-xs tracking-wider font-semibold">
                    {u.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="bg-white border rounded-xl p-5 space-y-5">

        <div className="text-xl font-semibold">
          Welcome Screen Customization
        </div>

        <div>
          <label className="text-sm font-medium">
            Welcome Text
          </label>

        <Input
          value={welcomeText}
          onChange={(e) =>
            setWelcomeText(e.target.value)
          }
          placeholder="WELCOME TO YOUR PHARMACY"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Logo / Emoji
        </label>

        <Input
          value={welcomeLogo}
          onChange={(e) =>
            setWelcomeLogo(e.target.value)
          }
          placeholder="💊"
        />
      </div>

      <div>
        <label className="text-sm font-medium">
          Welcome Effect
        </label>

        <select
          value={welcomeEffect}
          onChange={(e) =>
            setWelcomeEffect(e.target.value)
          }
          className="w-full border rounded-md h-10 px-3"
        >
          <option value="typing">
            Typing Effect
          </option>

          <option value="fade">
            Fade Effect
          </option>

          <option value="glow">
            Glow Effect
          </option>

          <option value="terminal">
            Terminal Effect
          </option>
        </select>
      </div>

      <Button onClick={saveWelcomeSettings}>
        Save Welcome Screen
      </Button>

    </div>
    </div>
  );
}
