import React, { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  MessageCircle,
  PackageSearch,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
  Save,
  RefreshCcw
} from "lucide-react";
import { toast } from "sonner";
import { patientShareMessage, whatsappUrl } from "@/lib/sharing";


const emptyForm = {
  name: "",
  age: "",
  phone: "",
  address: "",
  condition: "",
  duration_days: "",
  last_refill_date: ""
};


const collection = (data) =>
  Array.isArray(data)
    ? data
    : data?.items || data?.results || [];


const medicineName = (item) =>
  item?.name ||
  item?.medicine_name ||
  item?.brand_name ||
  "Unnamed medicine";


const stockOf = (item) => {
  if (!item) return 0;

  // Direct inventory fields
  const directStock =
    item.available_stock ??
    item.available_units ??
    item.available_quantity ??
    item.quantity_units ??
    item.total_stock ??
    item.stock ??
    item.current_stock;

  if (directStock !== undefined && directStock !== null) {
    return Number(directStock) || 0;
  }

  // Medicine batches stock calculation
  if (Array.isArray(item.batches) && item.batches.length) {
    return item.batches.reduce((sum, batch) => {
      return (
        sum +
        Number(
          batch.available_stock ??
          batch.available_units ??
          batch.quantity ??
          batch.stock ??
          batch.current_stock ??
          0
        )
      );
    }, 0);
  }

  // Purchase based inventory fallback
  if (
    item.purchased_units !== undefined ||
    item.sold_units !== undefined
  ) {
    return (
      Number(item.purchased_units || 0) -
      Number(item.sold_units || 0)
    );
  }

  return 0;
};


export default function Patients() {

  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [medicines, setMedicines] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingPatient, setEditingPatient] = useState(null);

  const [medicineSearch, setMedicineSearch] = useState("");
  const [selectedMedicines, setSelectedMedicines] = useState([]);

  const [showMedicineBox, setShowMedicineBox] = useState(false);


  const [showRefillPanel, setShowRefillPanel] = useState(false);
  const [refillPatient, setRefillPatient] = useState(null);
  const [refillDate, setRefillDate] = useState("");
  const [refillMedicines, setRefillMedicines] = useState([]);



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

    api.get("/medicines")
      .then(({ data }) => setMedicines(collection(data)))
      .catch(console.warn);

  }, []);



  const medicineResults = useMemo(() => {

    const q = medicineSearch.toLowerCase().trim();

    if (!q)
      return medicines.slice(0,10);


    return medicines
      .filter(m =>
        medicineName(m)
          .toLowerCase()
          .includes(q)
      )
      .slice(0,10);


  }, [medicineSearch, medicines]);



  const addMedicine = (medicine) => {

    const name = medicineName(medicine);

    if (
      selectedMedicines.some(
        m => m.medicine_name === name
      )
    ) {
      toast.info("Medicine already added");
      return;
    }


    setSelectedMedicines([
      ...selectedMedicines,
      {
        medicine_name:name,
        medicine_id:medicine.id || "",
        batch:"",
        dosage:"",
        frequency:"",
        duration:""
      }
    ]);

    setMedicineSearch("");
    setShowMedicineBox(false);

  };



  const removeMedicine = (index)=>{

    setSelectedMedicines(
      selectedMedicines.filter(
        (_,i)=>i!==index
      )
    );

  };



  const updateMedicineField = (
    index,
    key,
    value
  )=>{

    const copy=[...selectedMedicines];

    copy[index][key]=value;

    setSelectedMedicines(copy);

  };



  const savePatient = async()=>{

    if(
      !form.name ||
      !form.phone
    ){
      toast.error(
        "Patient name and phone required"
      );
      return;
    }


    if(
      selectedMedicines.length===0
    ){
      toast.error(
        "Add at least one medicine"
      );
      return;
    }


    const payload={

      ...form,

      age:Number(form.age || 0),

      duration_days:Number(
        form.duration_days || 0
      ),

      medicine_name:
        selectedMedicines
          .map(m=>m.medicine_name)
          .join(", "),

      medicines:selectedMedicines

    };


    try{

      if(editingPatient){

        await api.put(
          `/patients/${editingPatient.phone}`,
          payload
        );

      }
      else{

        await api.post(
          "/patients",
          payload
        );

      }


      toast.success(
        editingPatient
        ? "Patient updated"
        : "Patient added"
      );


      setForm(emptyForm);
      setSelectedMedicines([]);
      setEditingPatient(null);

      loadPatients();

    }
    catch(err){

      toast.error(
        formatApiError(err)
      );

    }

  };
    const editPatient = (patient)=>{

    setEditingPatient(patient);

    setForm({
      name: patient.name || "",
      age: patient.age || "",
      phone: patient.phone || "",
      address: patient.address || "",
      condition: patient.condition || "",
      duration_days: patient.duration_days || "",
      last_refill_date: patient.last_refill_date || ""
    });


    if(patient.medicines){

      setSelectedMedicines(
        patient.medicines
      );

    }
    else if(patient.medicine_name){

      setSelectedMedicines([
        {
          medicine_name:
            patient.medicine_name,
          dosage:"",
          frequency:"",
          duration:""
        }
      ]);

    }

    window.scrollTo({
      top:0,
      behavior:"smooth"
    });

  };



  const deletePatient = async(phone)=>{

    if(!window.confirm("Delete patient?"))
      return;


    try{

      await api.delete(
        `/patients/${phone}`
      );

      toast.success(
        "Patient deleted"
      );

      loadPatients();

    }
    catch(err){

      toast.error(
        formatApiError(err)
      );

    }

  };



  const openRefill = (patient)=>{

    setRefillPatient(patient);

    setRefillDate(
      new Date()
      .toISOString()
      .split("T")[0]
    );


    if(patient.medicines){

      setRefillMedicines(
        patient.medicines
      );

    }
    else{

      setRefillMedicines([]);

    }


    setShowRefillPanel(true);

  };



  const saveRefill = async()=>{

    try{

      await api.post(
        `/patients/${refillPatient.phone}/refill`,
        {
          date:refillDate,
          medicines:
            refillMedicines.map(
              m=>m.medicine_name
            )
        }
      );


      toast.success(
        "Refill updated"
      );


      setShowRefillPanel(false);

      loadPatients();
      loadAlerts();

    }
    catch(err){

      toast.error(
        formatApiError(err)
      );

    }

  };



return (

<div className="space-y-6">


{/* HEADER */}

<header className="
flex flex-col sm:flex-row
sm:items-center sm:justify-between
gap-3
">

<div>

<h1 className="
text-2xl font-bold
text-slate-900
">
Patient Management
</h1>


<p className="
text-sm text-slate-500
">
Refill tracking, patient history and medicine continuity
</p>

</div>


<div className="
flex items-center gap-2
rounded-full
bg-blue-50
px-4 py-2
text-xs font-semibold
text-blue-700
">

<CheckCircle2 className="h-4 w-4"/>

Active Patient Records

</div>


</header>




{/* REFILL ALERTS */}

{
alerts.length>0 &&

<section className="
rounded-xl
border border-amber-200
bg-amber-50
p-4
">


<div className="
flex items-center gap-2
font-bold text-amber-900
mb-3
">

<AlertTriangle className="h-5 w-5"/>

Refill Alerts

</div>



<div className="
grid md:grid-cols-2
gap-3
">

{
alerts.map((p)=>(

<div
key={p.phone}
className="
bg-white
border
rounded-lg
p-3
flex
justify-between
items-center
"
>


<div>

<div className="
font-semibold
text-slate-900
">

{p.name}

</div>


<div className="
text-xs text-slate-500
">

{p.medicine_name}

</div>


</div>


<button
onClick={()=>openRefill(p)}
className="
text-xs
font-semibold
text-blue-600
"
>

Update Refill

</button>


</div>


))

}


</div>


</section>

}






{/* ADD PATIENT CARD */}

<section className="
rounded-2xl
border
bg-white
shadow-sm
p-5
">


<div className="
flex items-center justify-between
mb-5
">


<div>

<h2 className="
font-bold
text-lg
text-slate-900
">

{
editingPatient
?
"Edit Patient"
:
"Add New Patient"

}

</h2>


<p className="
text-xs
text-slate-500
">

Maintain patient profile and medicines

</p>


</div>


<UserRound
className="
h-7 w-7
text-blue-600
"/>


</div>





<div className="
grid
sm:grid-cols-2
lg:grid-cols-4
gap-4
">


{
[
["name","Patient Name"],
["phone","Phone"],
["age","Age"],
["address","Address"],
["condition","Condition"],
["duration_days","Refill Cycle Days"],
["last_refill_date","Last Refill Date"]

].map(([key,label])=>(


<label key={key}>

<span className="
block
text-xs
font-semibold
text-slate-600
mb-1
">

{label}

</span>


<input

value={form[key]}

onChange={
e=>
setForm({
...form,
[key]:e.target.value
})
}

type={
key==="last_refill_date"
?
"date"
:
key==="age" ||
key==="duration_days"
?
"number"
:
"text"
}

className="
w-full
rounded-lg
border
px-3
py-2
text-sm
focus:ring-2
focus:ring-blue-100
"
/>


</label>


))

}


</div>
  {/* MULTI MEDICINE SECTION */}

<div className="
mt-6
rounded-xl
border
border-blue-100
bg-blue-50/40
p-4
">


<div className="
flex items-center justify-between
mb-3
">


<div>

<h3 className="
font-bold
text-slate-900
flex items-center gap-2
">

<PackageSearch className="h-5 w-5 text-blue-600"/>

Patient Medicines

</h3>


<p className="
text-xs
text-slate-500
">

Add multiple medicines for refill tracking

</p>


</div>


</div>




<div className="
relative
">


<div className="
flex items-center
rounded-lg
border
bg-white
px-3
">

<Search className="
h-4
w-4
text-slate-400
"/>


<input

value={medicineSearch}

onFocus={()=>setShowMedicineBox(true)}

onChange={
e=>{
setMedicineSearch(e.target.value);
setShowMedicineBox(true);
}
}

placeholder="
Search medicine name...
"

className="
w-full
px-3
py-2
outline-none
text-sm
"

/>


</div>



{
showMedicineBox &&

<div className="
absolute
z-30
mt-2
w-full
max-h-60
overflow-auto
rounded-xl
border
bg-white
shadow-xl
">


{
medicineResults.map((m)=>(


<button

type="button"

key={
m.id ||
medicineName(m)
}

onClick={()=>
addMedicine(m)
}

className="
w-full
flex
justify-between
items-center
px-4
py-3
hover:bg-blue-50
text-left
"


>


<div>

<div className="
font-semibold
text-sm
">

{medicineName(m)}

</div>


<div className="
text-xs
text-slate-500
">

Stock: {stockOf(m)}

</div>


</div>


<Plus
className="
h-4
w-4
text-blue-600
"/>


</button>


))


}


</div>


}


</div>





<div className="
mt-4
space-y-3
">


{
selectedMedicines.map((m,index)=>(


<div

key={index}

className="
rounded-xl
border
bg-white
p-3
"


>


<div className="
flex
items-center
justify-between
mb-3
">


<div className="
font-semibold
text-slate-800
">

{m.medicine_name}

</div>


<button
onClick={()=>
removeMedicine(index)
}

className="
text-red-500
"
>

<X className="h-4 w-4"/>

</button>


</div>



<div className="
grid
sm:grid-cols-3
gap-2
">


<input

placeholder="Dosage"

value={m.dosage}

onChange={
e=>
updateMedicineField(
index,
"dosage",
e.target.value
)
}

className="
border
rounded-lg
px-3
py-2
text-sm
"

/>


<input

placeholder="Frequency"

value={m.frequency}

onChange={
e=>
updateMedicineField(
index,
"frequency",
e.target.value
)
}

className="
border
rounded-lg
px-3
py-2
text-sm
"

/>



<input

placeholder="Duration"

value={m.duration}

onChange={
e=>
updateMedicineField(
index,
"duration",
e.target.value
)
}

className="
border
rounded-lg
px-3
py-2
text-sm
"

/>



</div>


</div>


))


}


</div>


</div>





<div className="
mt-5
flex
gap-3
">


<button

onClick={savePatient}

className="
flex
items-center
gap-2
rounded-lg
bg-blue-600
px-5
py-2
text-white
font-semibold
hover:bg-blue-700
"

>


<Save className="h-4 w-4"/>

{
editingPatient
?
"Update Patient"
:
"Save Patient"

}

</button>




{
editingPatient &&

<button

onClick={()=>{
setEditingPatient(null);
setForm(emptyForm);
setSelectedMedicines([]);
}}

className="
rounded-lg
border
px-5
py-2
font-semibold
"

>

Cancel

</button>


}


</div>



</section>








{/* PATIENT CARDS */}


<section>


<div className="
flex
justify-between
items-center
mb-4
">


<h2 className="
font-bold
text-lg
">

Patient Records

</h2>


<span className="
text-xs
text-slate-500
">

{patients.length} Patients

</span>


</div>





<div className="
grid
lg:grid-cols-2
gap-4
">


{
patients.map((p)=>(


<article

key={p.phone}

className="
rounded-2xl
border
bg-white
shadow-sm
p-5
"


>


<div className="
flex
justify-between
items-start
">


<div>


<div className="
flex
items-center
gap-2
">

<UserRound
className="
h-5
w-5
text-blue-600
"/>


<h3 className="
font-bold
text-lg
">

{p.name}

</h3>


</div>



<div className="
flex
items-center
gap-2
text-sm
text-slate-500
mt-1
">

<Phone className="h-4 w-4"/>

{p.phone}

</div>


</div>





<div className="
flex
items-center
gap-2
">


<button
title="Refill"

onClick={()=>
openRefill(p)
}

className="
p-2
rounded-lg
bg-green-50
text-green-600
"
>

<CalendarClock className="h-4 w-4"/>

</button>



<a

href={
whatsappUrl(
p.phone,
patientShareMessage(p)
)
}

target="_blank"

className="
p-2
rounded-lg
bg-emerald-50
text-emerald-600
"

>

<MessageCircle className="h-4 w-4"/>

</a>



<button
onClick={()=>
editPatient(p)
}

className="
p-2
rounded-lg
bg-blue-50
text-blue-600
"

>

<Edit3 className="h-4 w-4"/>

</button>



<button

onClick={()=>
deletePatient(p.phone)
}

className="
p-2
rounded-lg
bg-red-50
text-red-600
"

>

<Trash2 className="h-4 w-4"/>

</button>


</div>


</div>





<div className="
mt-4
rounded-xl
bg-slate-50
p-4
">


<div className="
flex
gap-2
items-center
font-semibold
">

<PackageSearch className="h-4 w-4 text-blue-600"/>

Medicines

</div>


<p className="
mt-2
text-sm
text-slate-600
">

{p.medicine_name || "No medicine linked"}

</p>


<div className="
text-xs
text-slate-500
mt-2
">

{p.duration_days}-day refill cycle

</div>


</div>


</article>


))

}


</div>


</section>






{/* REFILL PANEL */}


{
showRefillPanel &&
refillPatient &&

<div className="
fixed
right-0
top-0
h-full
w-full
sm:w-[420px]
bg-white
shadow-2xl
z-50
p-5
overflow-auto
">


<div className="
flex
justify-between
items-center
mb-5
">


<h2 className="
font-bold
text-lg
">

Refill -
{refillPatient.name}

</h2>


<button

onClick={()=>
setShowRefillPanel(false)
}

>

<X/>

</button>


</div>




<label className="
block
text-sm
font-semibold
mb-2
">

Refill Date

</label>


<input

type="date"

value={refillDate}

onChange={
e=>setRefillDate(e.target.value)
}

className="
w-full
border
rounded-lg
px-3
py-2
"

/>




<div className="
mt-5
">


<h3 className="
font-semibold
mb-3
">

Medicines

</h3>


{

(refillPatient.medicines || [])
.map((m,i)=>(


<div

key={i}

className="
rounded-lg
border
p-3
mb-2
text-sm
"

>

{m.medicine_name}

</div>


))


}


</div>




<button

onClick={saveRefill}

className="
mt-5
w-full
rounded-lg
bg-green-600
py-3
text-white
font-bold
flex
justify-center
gap-2
"

>

<RefreshCcw className="h-4 w-4"/>

Save Refill

</button>



</div>

}



</div>

);

}
