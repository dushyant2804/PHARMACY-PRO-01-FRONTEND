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
  Array.isArray(data)
    ? data
    : data?.items || data?.medicines || data?.results || [];

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

  // REFILL STATE
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
        await api.put(`/patients/${encodeURIComponent(phone)}`, payload);
      } else {
        await api.post("/patients", payload);
      }

      toast.success(editingPatient ? "Patient updated" : "Patient saved");
      setForm(emptyForm);
      setEditingPatient(null);
      loadPatients();
      loadAlerts();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const deletePatient = async (phone) => {
    const value = String(phone || "").trim();
    if (!window.confirm("Delete patient?")) return;

    try {
      await api.delete(`/patients/${encodeURIComponent(value)}`);
      loadPatients();
      loadAlerts();
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

  return (
    <div className="space-y-6">

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
        </div>
      </header>

      {/* PATIENT LIST */}
      <section>
        <div className="grid gap-3 lg:grid-cols-2">
          {patients.map((p, i) => (
            <article key={p.phone || i} className="rounded-xl border p-4">

              <div className="flex justify-between">

                <div>
                  <h3 className="font-bold">{p.name}</h3>
                </div>

                <div className="flex gap-1">

                  {/* REFILL BUTTON */}
                  <button
                    onClick={() => {
                      setRefillPatient(p);
                      setRefillDate(new Date().toISOString().split("T")[0]);
                      setRefillMeds([]);
                      setShowRefillModal(true);
                    }}
                  >
                    <CalendarClock />
                  </button>

                  <button onClick={() => selectForEdit(p)}>
                    <Edit3 />
                  </button>

                  <button onClick={() => deletePatient(p.phone)}>
                    <Trash2 />
                  </button>

                </div>
              </div>

            </article>
          ))}
        </div>
      </section>

      {/* REFILL MODAL */}
      {showRefillModal && refillPatient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-4 rounded-xl w-[400px]">

            <h2 className="font-bold mb-2">
              Refill - {refillPatient.name}
            </h2>

            <input
              type="date"
              value={refillDate}
              onChange={(e) => setRefillDate(e.target.value)}
              className="border p-2 w-full mb-2"
            />

            <div className="max-h-40 overflow-auto">
              {medicines.map((m) => {
                const name = medicineName(m);

                return (
                  <label key={name} className="flex gap-2">
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

            <div className="flex justify-end gap-2 mt-3">

              <button onClick={() => setShowRefillModal(false)}>
                Cancel
              </button>

              <button
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
                Save
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
