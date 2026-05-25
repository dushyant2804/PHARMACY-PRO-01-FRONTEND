import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function Patients() {
  const [form, setForm] = useState({
    name: "",
    age: "",
    phone: "",
    address: "",
    medicine_name: "",
    duration_days: "",
    last_refill_date: "",
    condition: "",
  });

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

  try {

    const payload = {
      ...form,
      age: Number(form.age),
      duration_days: Number(form.duration_days),
    };

    if (editingPatient) {

      await api.put(
        `/patients/${editingPatient.id}`,
        payload
      );

    } else {

      await api.post(
        "/patients",
        payload
      );
    }

    setForm({
      name: "",
      age: "",
      phone: "",
      address: "",
      medicine_name: "",
      duration_days: "",
      last_refill_date: "",
      condition: "",
    });

    setEditingPatient(null);

    loadPatients();

    loadAlerts();

  } catch (err) {

    console.log(err);
  }
};

  // ---------- DELETE ----------
  const deletePatient = async (phone) => {
    if (!window.confirm("Delete patient?")) return;

    try {
      await api.delete(`/patients/${phone}`);

      setPatients((prev) => prev.filter((p) => p.phone !== phone));
      setAlerts((prev) => prev.filter((a) => a.phone !== phone));
    } catch (err) {
      console.log(err);
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

          {alerts.map((p) => (
            <div
              key={p.phone}
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
          <div className="text-slate-500">No patients yet</div>
        ) : (
          patients.map((p) => (
            <div
              key={p.phone}
              className="border p-3 rounded-sm flex justify-between"
            >
              <div>
                <div className="font-semibold">{p.name}</div>

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
          ))
        )}
      </div>
    </div>
  );
}
