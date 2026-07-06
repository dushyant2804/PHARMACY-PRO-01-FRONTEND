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
  ["low", "low_stock", "critical", "sold_out", "out_of_stock"].includes(
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

  // REFILL
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillPatient, setRefillPatient] = useState(null);
  const [refillDate, setRefillDate] = useState("");
  const [refillMeds, setRefillMeds] = useState([]);

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

  const selectForEdit = (p) => {
    setEditingPatient(p);
    setForm(trimPatientForm(p));
    setMedicineSearch(p.medicine_name || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePatient = async () => {
    const trimmed = trimPatientForm(form);

    if (!trimmed.name || !trimmed.phone)
      return toast.error("Name and phone required");

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

      toast.success("Saved");
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
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

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

  const openRefill = (p) => {
    setRefillPatient(p);
    setRefillDate(new Date().toISOString().split("T")[0]);
    setRefillMeds([]);
    setShowRefillModal(true);
  };

  return (
    <div className="space-y-6">

      {/* FORM */}
      <section className="border p-4 rounded-lg bg-white">
        <h2 className="font-bold mb-3">
          {editingPatient ? "Edit Patient" : "Add Patient"}
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          {Object.keys(emptyForm).map((key) => (
            <input
              key={key}
              placeholder={key}
              value={form[key]}
              onChange={(e) =>
                setForm({ ...form, [key]: e.target.value })
              }
              className="border p-2 rounded"
            />
          ))}
        </div>

        <button
          onClick={savePatient}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save
        </button>
      </section>

      {/* LIST */}
      <section>
        {patients.map((p) => (
          <div key={p.phone} className="border p-3 rounded mb-2">

            <div className="flex justify-between">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-sm">{p.phone}</div>
              </div>

              <div className="flex gap-2">

                <button onClick={() => openRefill(p)}>
                  <CalendarClock />
                </button>

                <a
                  href={whatsappUrl(p.phone, patientShareMessage(p))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle />
                </a>

                <button onClick={() => selectForEdit(p)}>
                  <Edit3 />
                </button>

                <button onClick={() => deletePatient(p.phone)}>
                  <Trash2 />
                </button>

              </div>
            </div>

            <div className="text-sm mt-2">
              {p.medicine_name}
            </div>

          </div>
        ))}
      </section>

      {/* REFILL MODAL */}
      {showRefillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded w-96">

            <h3 className="font-bold mb-2">
              Refill - {refillPatient?.name}
            </h3>

            <input
              type="date"
              value={refillDate}
              onChange={(e) => setRefillDate(e.target.value)}
              className="border p-2 w-full"
            />

            <div className="mt-2 max-h-40 overflow-auto">
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
                          refillMeds.filter(
                            (x) => x !== medicineName(m)
                          )
                        );
                    }}
                  />
                  {medicineName(m)}
                </label>
              ))}
            </div>

            <button
              className="bg-green-600 text-white px-3 py-1 mt-3"
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
      )}

    </div>
  );
}
