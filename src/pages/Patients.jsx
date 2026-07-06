import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  MessageCircle,
  PackageSearch,
  Phone,
  Search,
  Trash2,
  UserRound
} from "lucide-react";
import { toast } from "sonner";
import { patientShareMessage, whatsappUrl } from "@/lib/sharing";

/* ----------------------------- FORM ----------------------------- */

const emptyForm = {
  name: "",
  age: "",
  phone: "",
  address: "",
  medicine_name: "",
  duration_days: "",
  last_refill_date: "",
  condition: ""
};

const trimPatientForm = (patient) =>
  Object.fromEntries(
    Object.keys(emptyForm).map((key) => [
      key,
      String(patient[key] || "").trim()
    ])
  );

/* ----------------------------- HELPERS ----------------------------- */

const collection = (data) =>
  Array.isArray(data) ? data : data?.items || data?.medicines || data?.results || [];

const stockOf = (item) =>
  Number(
    item?.available_stock ??
      item?.available_units ??
      item?.available_quantity ??
      item?.quantity_units ??
      item?.total_stock ??
      item?.stock ??
      0
  );

const medicineName = (item) =>
  item?.name || item?.medicine_name || item?.brand_name || "Unnamed medicine";

const medicineBatches = (item) =>
  Array.isArray(item?.batches) && item.batches.length ? item.batches : [item];

const isLowStock = (item) =>
  item?.is_low_stock === true ||
  ["low", "low_stock", "critical", "sold_out", "out_of_stock"].includes(
    String(item?.stock_status || item?.inventory_status || item?.status || "")
      .toLowerCase()
      .replace(/ /g, "_")
  ) ||
  stockOf(item) <= Number(item?.low_stock_threshold ?? 0);

/* ----------------------------- COMPONENT ----------------------------- */

export default function Patients() {
  const [form, setForm] = useState(emptyForm);
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showMedicineResults, setShowMedicineResults] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

  /* ---------------- REFILL STATES ---------------- */

  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillPatient, setRefillPatient] = useState(null);
  const [refillDate, setRefillDate] = useState("");
  const [refillMeds, setRefillMeds] = useState([]);

  /* ---------------- LOAD DATA ---------------- */

  const loadPatients = async () => {
    try {
      const { data } = await api.get("/patients");
      setPatients(collection(data));
    } catch (err) {
      console.warn(err);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data } = await api.get("/patients/alerts");
      setAlerts(collection(data));
    } catch (err) {
      console.warn(err);
    }
  };

  useEffect(() => {
    loadPatients();
    loadAlerts();
    api
      .get("/medicines")
      .then(({ data }) => setMedicines(collection(data)))
      .catch(console.warn);
  }, []);

  /* ---------------- PATIENT ACTIONS ---------------- */

  const selectForEdit = (p) => {
    setEditingPatient(p);
    setForm(trimPatientForm(p));
    setMedicineSearch(p.medicine_name || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePatient = async () => {
    const trimmed = trimPatientForm(form);

    if (!trimmed.name || !trimmed.phone)
      return toast.error("Patient name and phone are required");

    const payload = {
      ...trimmed,
      age: Number(trimmed.age),
      duration_days: Number(trimmed.duration_days)
    };

    try {
      if (editingPatient) {
        await api.put(
          `/patients/${encodeURIComponent(editingPatient.phone)}`,
          payload
        );
      } else {
        await api.post("/patients", payload);
      }

      toast.success(editingPatient ? "Patient updated" : "Patient saved");

      setForm(emptyForm);
      setEditingPatient(null);
      setMedicineSearch("");

      loadPatients();
      loadAlerts();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const deletePatient = async (phone) => {
    if (!window.confirm("Delete patient?")) return;

    try {
      await api.delete(`/patients/${encodeURIComponent(phone)}`);
      loadPatients();
      loadAlerts();
      toast.success("Deleted");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const markContacted = async (phone) => {
    try {
      await api.post(`/patients/contacted/${phone}`);
      setAlerts((rows) => rows.filter((p) => p.phone !== phone));
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  /* ---------------- MEDICINE SEARCH ---------------- */

  const matches = useMemo(() => {
    const q = medicineSearch.trim().toLowerCase();
    if (!q) return medicines.slice(0, 8);

    return medicines
      .filter((m) =>
        [medicineName(m), m.manufacturer]
          .some((v) => String(v || "").toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [medicines, medicineSearch]);

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">

      {/* HEADER (RESTORED PROPER MODULE FEEL) */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients Module</h1>
          <p className="text-sm text-slate-500">
            Manage refill cycles, patient history, and medicine continuity.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <CheckCircle2 className="h-4 w-4" />
          Active pharmacy tracking system
        </div>
      </header>

      {/* ALERT SECTION (RESTORED FULL BLOCK) */}
      {(alerts.length > 0) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Refill Alerts
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {alerts.map((p) => (
              <div
                key={p.phone}
                className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
              >
                <div className="text-sm">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.medicine_name} — Refill due
                  </div>
                </div>

                <button
                  onClick={() => markContacted(p.phone)}
                  className="text-xs font-semibold text-blue-600"
                >
                  Mark contacted
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================= ADD / EDIT PATIENT (RESTORED FULL FORM UI) ================= */}
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-4 font-bold text-slate-900">
          {editingPatient ? "Edit Patient Details" : "Add New Patient"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["name", "Patient Name *"],
            ["phone", "Phone *"],
            ["age", "Age"],
            ["address", "Address"],
            ["condition", "Condition"],
            ["duration_days", "Refill Cycle (Days)"],
            ["last_refill_date", "Last Refill Date"]
          ].map(([key, label]) => (
            <label key={key}>
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                {label}
              </span>
              <input
                value={form[key]}
                onChange={(e) =>
                  setForm({ ...form, [key]: e.target.value })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={savePatient}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white"
          >
            {editingPatient ? "Update" : "Save"}
          </button>
        </div>
      </section>

      {/* ================= PATIENT LIST (RESTORED STRUCTURE) ================= */}
      <section>
        <h2 className="mb-3 font-bold text-slate-900">
          Patient Records
        </h2>

        <div className="grid gap-3 lg:grid-cols-2">
          {patients.map((p) => (
            <div
              key={p.phone}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              {/* HEADER */}
              <div className="flex justify-between">
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {p.phone}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-2">
                  <button onClick={() => setRefillPatient(p) || setShowRefillModal(true)}>
                    <CalendarClock className="h-4 w-4 text-green-600" />
                  </button>

                  <a
                    href={whatsappUrl(p.phone, patientShareMessage(p))}
                    target="_blank"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                  </a>

                  <button onClick={() => selectForEdit(p)}>
                    <Edit3 className="h-4 w-4 text-blue-600" />
                  </button>

                  <button onClick={() => deletePatient(p.phone)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>

              {/* MEDICINE INFO */}
              <div className="mt-3 rounded-lg bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PackageSearch className="h-4 w-4 text-blue-600" />
                  {p.medicine_name || "No medicine linked"}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {p.duration_days} day cycle · {p.condition}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= REFILL MODAL ================= */}
      {showRefillModal && refillPatient && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-[400px] rounded-xl bg-white p-4">

            <h3 className="mb-3 font-bold">
              Refill - {refillPatient.name}
            </h3>

            <input
              type="date"
              className="w-full border p-2"
              value={refillDate}
              onChange={(e) => setRefillDate(e.target.value)}
            />

            <div className="mt-3 max-h-40 overflow-auto border p-2">
              {medicines.map((m) => (
                <label key={m.id} className="block text-sm">
                  <input
                    type="checkbox"
                    checked={refillMeds.includes(medicineName(m))}
                    onChange={(e) => {
                      if (e.target.checked)
                        setRefillMeds([...refillMeds, medicineName(m)]);
                      else
                        setRefillMeds(
                          refillMeds.filter((x) => x !== medicineName(m))
                        );
                    }}
                  />
                  <span className="ml-2">{medicineName(m)}</span>
                </label>
              ))}
            </div>

            <button
              className="mt-3 w-full bg-green-600 py-2 text-white"
              onClick={async () => {
                await api.post(
                  `/patients/${refillPatient.phone}/refill`,
                  {
                    date: refillDate,
                    medicines: refillMeds
                  }
                );
                toast.success("Refill saved");
                setShowRefillModal(false);
              }}
            >
              Save Refill
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
