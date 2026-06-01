import React, { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  age: "",
  phone: "",
  address: "",
  medicine_name: "",
  duration_days: "",
  last_refill_date: "",
  condition: "",
};

const trimPatientForm = (patient) => ({
  name: String(patient.name || "").trim(),
  age: String(patient.age || "").trim(),
  phone: String(patient.phone || "").trim(),
  address: String(patient.address || "").trim(),
  medicine_name: String(patient.medicine_name || "").trim(),
  duration_days: String(patient.duration_days || "").trim(),
  last_refill_date: String(patient.last_refill_date || "").trim(),
  condition: String(patient.condition || "").trim(),
});

export default function Patients() {
  const [form, setForm] = useState(emptyForm);

  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [editingPatient, setEditingPatient] = useState(null); 

  // ---------- LOAD PATIENTS ----------
  const loadPatients = async () => {
    try {
      const res = await api.get("/patients");
      const data = res.data || [];

      // show urgent first
      data.sort((a, b) => (b.is_due === true) - (a.is_due === true));

      setPatients(data);
    } catch (err) {
      console.log(err);
    }
  };

  // ---------- LOAD ALERTS ----------
  const loadAlerts = async () => {
    try {
      const res = await api.get("/patients/alerts");
      setAlerts(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  // ---------- SAVE PATIENT ----------
  const savePatient = async () => {
    const trimmedForm = trimPatientForm(form);

    if (!trimmedForm.name || !trimmedForm.phone) {
      toast.error("Patient name and phone are required");
      return;
    }

    try {
      const payload = {
        ...trimmedForm,
        age: Number(trimmedForm.age),
        duration_days: Number(trimmedForm.duration_days),
      };

      if (editingPatient) {
        const originalPhone = String(editingPatient.phone || "").trim();

        if (!originalPhone) {
          toast.error("Cannot update a patient without an original phone. Delete the blank row and create a new patient.");
          return;
        }

        await api.put(
          `/patients/${encodeURIComponent(originalPhone)}`,
          payload
        );
        toast.success("Patient updated");
      } else {
        await api.post(
          "/patients",
          payload
        );
        toast.success("Patient saved");
      }

      setForm(emptyForm);
      setEditingPatient(null);
      loadPatients();
      loadAlerts();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // ---------- DELETE ----------
  const deletePatient = async (phone) => {
    const trimmedPhone = String(phone || "").trim();
    const isCleanup = !trimmedPhone;

    if (!window.confirm(isCleanup ? "Delete blank patient rows?" : "Delete patient?")) return;

    try {
      if (isCleanup) {
        await api.delete("/patients");
      } else {
        await api.delete(`/patients/${encodeURIComponent(trimmedPhone)}`);
      }

      setPatients((prev) => prev.filter((p) => String(p.phone || "").trim() !== trimmedPhone));
      setAlerts((prev) => prev.filter((a) => String(a.phone || "").trim() !== trimmedPhone));
      toast.success(isCleanup ? "Blank patient rows deleted" : "Patient deleted");
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  // ---------- MARK CONTACTED ----------
  const markContacted = async (phone) => {
    try {
      await api.post(`/patients/contacted/${phone}`);
      setAlerts((prev) => prev.filter((p) => p.phone !== phone));
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    loadPatients();
    loadAlerts();
  }, []);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-sm text-slate-500">
          BP / Sugar / Heart medication tracking
        </p>
      </div>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div className="bg-red-100 border border-red-300 p-3 rounded-sm">
          <div className="font-semibold text-red-700 mb-2">
            🔴 Due Medicine Alerts
          </div>

          {alerts.map((p, index) => (
            <div
              key={p.phone || `blank-alert-${index}`}
              className="flex justify-between text-sm py-1"
            >
              <span>
                {p.name} — {p.medicine_name}
              </span>

              <div className="flex gap-3">
                <button
                  onClick={() => markContacted(p.phone)}
                  className="text-blue-600 text-xs"
                >
                  Contacted
                </button>
              
                <button
  className="text-blue-600"
  onClick={() => {

    setEditingPatient(p);

    setForm({
      name: p.name || "",
      age: p.age || "",
      phone: p.phone || "",
      address: p.address || "",
      medicine_name: p.medicine_name || "",
      duration_days: p.duration_days || "",
      last_refill_date: p.last_refill_date || "",
      condition: p.condition || "",
    });
  }}
>
  Edit
</button>

                <button
                  onClick={() => deletePatient(p.phone)}
                  className="text-red-600 text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORM */}
      <div className="border p-4 rounded-sm space-y-2">
        <div className="font-semibold">Add Patient</div>

        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          className="border p-2 w-full"
        />

        <input
          placeholder="Age"
          value={form.age}
          onChange={(e) =>
            setForm({ ...form, age: e.target.value })
          }
          className="border p-2 w-full"
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value })
          }
          className="border p-2 w-full"
        />

        <input
          placeholder="Address"
          value={form.address}
          onChange={(e) =>
            setForm({ ...form, address: e.target.value })
          }
          className="border p-2 w-full"
        />

        <input
          placeholder="Medicine Name"
          value={form.medicine_name}
          onChange={(e) =>
            setForm({ ...form, medicine_name: e.target.value })
          }
          className="border p-2 w-full"
        />

        <input
          placeholder="Condition / Disease"
          value={form.condition}
          onChange={(e) =>
            setForm({ ...form, condition: e.target.value })
      
          }
          className="border p-2 w-full"
        />

        <input
          placeholder="Duration (days)"
          value={form.duration_days}
          onChange={(e) =>
            setForm({ ...form, duration_days: e.target.value })
          }
          className="border p-2 w-full"
        />

        <input
          type="date"
          value={form.last_refill_date}
          onChange={(e) =>
            setForm({ ...form, last_refill_date: e.target.value })
          }
          className="border p-2 w-full"
        />

        <button
          onClick={savePatient}
          className="bg-blue-600 text-white px-4 py-2 rounded-sm"
        >
          Save Patient
        </button>
      </div>

{/* LIST */}
<div className="space-y-2">
  {patients.length === 0 ? (
    <div className="text-slate-500">
      No patients yet
    </div>
  ) : (
    patients.map((p, index) => (
      <div
        key={p.phone || `blank-patient-${index}`}
        className="border p-3 rounded-sm flex justify-between"
      >
        <div>
          <div className="font-semibold">
            {p.name}
          </div>

          <div className="text-sm text-slate-500">
            {p.medicine_name} • {p.condition}
          </div>

          <div className="text-xs mt-1">
            {p.is_due ? (
              <span className="text-red-600 font-semibold">
                🔴 Due
              </span>
            ) : (
              <span className="text-green-600">
                🟢 OK
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">

          <button
            className="text-blue-600 text-xs"
            onClick={() => {

              setEditingPatient(p);

              setForm({
                name: p.name || "",
                age: p.age || "",
                phone: p.phone || "",
                address: p.address || "",
                medicine_name: p.medicine_name || "",
                duration_days: p.duration_days || "",
                last_refill_date: p.last_refill_date || "",
                condition: p.condition || "",
              });
            }}
          >
            Edit
          </button>

          <button
            onClick={() => deletePatient(p.phone)}
            className="text-red-600 text-xs"
          >
            Delete
          </button>

        </div>
      </div>
    ))
  )}
</div>
</div>
 );
}
