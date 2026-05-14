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
    condition: "bp",
  });

  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const loadPatients = async () => {
    const res = await api.get("/patients");
    setPatients(res.data || []);
  };

  const loadAlerts = async () => {
    const res = await api.get("/patients/alerts");
    setAlerts(res.data || []);
  };

  const savePatient = async () => {
    await api.post("/patients", {
      ...form,
      age: Number(form.age),
      duration_days: Number(form.duration_days),
    });

    setForm({
      name: "",
      age: "",
      phone: "",
      address: "",
      medicine_name: "",
      duration_days: "",
      last_refill_date: "",
      condition: "bp",
    });

    loadPatients();
    loadAlerts();
  };

  const deletePatient = async (phone) => {
    if (!window.confirm("Delete this patient?")) return;
    await api.delete(`/patients/${phone}`);
    loadPatients();
    loadAlerts();
  };

  const markContacted = async (phone) => {
    await api.post(`/patients/contacted/${phone}`);
    loadAlerts();
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
          BP / Sugar / Heart medicine tracking
        </p>
      </div>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div className="bg-red-100 border border-red-300 p-3 rounded-sm">
          <div className="font-semibold text-red-700 mb-2">
            🔴 Due Medicine Alerts
          </div>

          {alerts.map((p) => (
            <div key={p.phone} className="flex justify-between text-sm">
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

        {[
          ["name", "Name"],
          ["age", "Age"],
          ["phone", "Phone"],
          ["address", "Address"],
          ["medicine_name", "Medicine Name"],
          ["duration_days", "Duration (days)"],
        ].map(([key, label]) => (
          <input
            key={key}
            placeholder={label}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="border p-2 w-full"
          />
        ))}

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
            <div key={p.phone} className="border p-3 rounded-sm flex justify-between">

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
