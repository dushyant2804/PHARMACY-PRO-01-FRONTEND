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
  ["low", "low_stock", "critical", "sold_out", "out_of_stock"]
    .includes(
      String(item?.stock_status || item?.inventory_status || item?.status || "")
        .toLowerCase()
        .replace(/ /g, "_")
    ) ||
  stockOf(item) <= Number(item?.low_stock_threshold ?? 0);

export default function Patients() {
  const [form, setForm] = useState(emptyForm);
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showMedicineResults, setShowMedicineResults] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

  // ✅ REFILL STATE
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillPatient, setRefillPatient] = useState(null);
  const [refillDate, setRefillDate] = useState("");
  const [refillMeds, setRefillMeds] = useState([]);

  const loadPatients = async () => {
    try {
      const { data } = await api.get("/patients");
      setPatients(
        collection(data).sort((a, b) => (b.is_due === true) - (a.is_due === true))
      );
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
      .catch((err) =>
        console.warn("Could not load inventory medicines", err)
      );
  }, []);

  const selectForEdit = (patient) => {
    setEditingPatient(patient);
    setForm(trimPatientForm(patient));
    setMedicineSearch(patient.medicine_name || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePatient = async () => {
    const trimmedForm = trimPatientForm(form);
    if (!trimmedForm.name || !trimmedForm.phone)
      return toast.error("Patient name and phone are required");

    const payload = {
      ...trimmedForm,
      age: Number(trimmedForm.age),
      duration_days: Number(trimmedForm.duration_days)
    };

    try {
      if (editingPatient) {
        const phone = String(editingPatient.phone || "").trim();
        if (!phone)
          return toast.error("Cannot update a patient without an original phone.");
        await api.put(`/patients/${encodeURIComponent(phone)}`, payload);
      } else {
        await api.post("/patients", payload);
      }

      toast.success(editingPatient ? "Patient updated" : "Patient saved");
      setForm(emptyForm);
      setMedicineSearch("");
      setEditingPatient(null);
      loadPatients();
      loadAlerts();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const deletePatient = async (phone) => {
    const value = String(phone || "").trim();
    if (!window.confirm(value ? "Delete patient?" : "Delete blank patient rows?"))
      return;

    try {
      await api.delete(
        value ? `/patients/${encodeURIComponent(value)}` : "/patients"
      );
      setPatients((rows) =>
        rows.filter((p) => String(p.phone || "").trim() !== value)
      );
      setAlerts((rows) =>
        rows.filter((p) => String(p.phone || "").trim() !== value)
      );
      toast.success("Patient deleted");
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

  const matches = useMemo(() => {
    const q = medicineSearch.trim().toLowerCase();
    if (!q) return medicines.slice(0, 8);

    return medicines
      .filter((m) =>
        [medicineName(m), m.manufacturer, ...medicineBatches(m).map((b) => b.batch_no || b.batch_number)]
          .some((v) => String(v || "").toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [medicines, medicineSearch]);

  const linkedLowStock = useMemo(() => {
    return medicines
      .filter(isLowStock)
      .map((medicine) => ({
        medicine,
        patients: patients.filter(
          (p) =>
            String(p.medicine_name || "")
              .trim()
              .toLowerCase() === medicineName(medicine).trim().toLowerCase()
        )
      }))
      .filter((row) => row.patients.length);
  }, [medicines, patients]);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Patients</h1>
          <p className="mt-1 text-sm text-slate-500">
            Simple refill and continuity tracking for your pharmacy.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <CheckCircle2 className="h-4 w-4" /> Stock-safe patient records
        </div>
      </header>

      {/* ALERTS */}
      {(alerts.length > 0 || linkedLowStock.length > 0) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Refill attention
          </div>
        </section>
      )}

      {/* PATIENT LIST */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Patient refill list</h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {patients.map((p, i) => (
            <article
              key={p.phone || i}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-slate-400" />
                    <h3 className="truncate font-bold text-slate-900">
                      {p.name || "Unnamed patient"}
                    </h3>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-1">

                  {/* REFILL BUTTON */}
                  <button
                    onClick={() => {
                      setRefillPatient(p);
                      setRefillDate(new Date().toISOString().split("T")[0]);
                      setRefillMeds([]);
                      setShowRefillModal(true);
                    }}
                    className="rounded-lg p-2 text-green-700 hover:bg-green-50"
                  >
                    <CalendarClock className="h-4 w-4" />
                  </button>

                  <button onClick={() => selectForEdit(p)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50">
                    <Edit3 className="h-4 w-4" />
                  </button>

                  <button onClick={() => deletePatient(p.phone)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>

                </div>
              </div>

              {/* MEDICINE INFO */}
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <div className="font-semibold text-slate-800">
                  {p.medicine_name || "No refill medicine linked"}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* REFILL MODAL */}
      {showRefillModal && refillPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-5">

            <h2 className="mb-3 text-lg font-bold">
              Refill - {refillPatient.name}
            </h2>

            <input
              type="date"
              value={refillDate}
              onChange={(e) => setRefillDate(e.target.value)}
              className="mb-3 w-full rounded border p-2"
            />

            <div className="max-h-40 overflow-auto space-y-2 border p-2">
              {medicines.map((m) => {
                const name = medicineName(m);
                return (
                  <label key={name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={refillMeds.includes(name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRefillMeds([...refillMeds, name]);
                        } else {
                          setRefillMeds(refillMeds.filter((x) => x !== name));
                        }
                      }}
                    />
                    {name}
                  </label>
                );
              })}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowRefillModal(false)} className="border px-3 py-1 rounded">
                Cancel
              </button>

              <button
                onClick={() => {
                  console.log("REFILL:", {
                    patient: refillPatient.phone,
                    date: refillDate,
                    medicines: refillMeds
                  });

                  toast.success("Refill saved");

                  setShowRefillModal(false);
                }}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Save
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
