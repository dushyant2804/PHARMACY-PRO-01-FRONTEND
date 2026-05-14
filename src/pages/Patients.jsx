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
};

useEffect(() => {
  loadPatients();
  loadAlerts();
}, []);

