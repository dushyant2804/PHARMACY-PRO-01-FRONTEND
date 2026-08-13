import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  BookOpen,
  Pencil,
  Search,
  WalletCards,
  ShoppingBag,
  CircleDollarSign,
  Users,
  UserRound,
  ReceiptText,
  ArrowUpRight,
  Phone,
  Mail,
  MapPin,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import useDebouncedValue from "@/hooks/useDebouncedValue";

const empty = {
  name: "",
  phone: "",
  email: "",
  gstin: "",
  address: "",
};

const getBalance = (customer) =>
  Number(
    customer.receivable_balance ??
      customer.outstanding_balance ??
      customer.balance ??
      customer.amount_due ??
      0
  );

const getSales = (customer) =>
  Number(customer.total_sales ?? customer.sales_total ?? 0);

const getPaid = (customer) =>
  Number(customer.total_paid ?? customer.paid_total ?? 0);

const getStatus = (customer) => {
  const balance = getBalance(customer);
  const paid = getPaid(customer);

  if (balance <= 0) {
    return {
      label: "Cleared",
      description: "No outstanding balance",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (paid > 0) {
    return {
      label: "Partial",
      description: "Payment pending",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Due",
    description: "Payment pending",
    tone: "border-red-200 bg-red-50 text-red-700",
  };
};

const balanceTone = (balance) => {
  if (balance <= 0) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (balance < 1000) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
};

const formatDate = (value) => {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

export default function Customers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);

  const load = async () => {
    try {
      setLoading(true);

      const response = await api.get("/customers");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.items ||
          response.data?.data ||
          [];

      setList(data);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /*
   * F3 = Open customer transaction/add customer dialog.
   *
   * Do not trigger while the user is typing inside an input,
   * textarea or select-like control.
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = document.activeElement?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();

        setEditing(null);
        setForm(empty);
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredList = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    if (!query) {
      return list;
    }

    return list.filter((customer) =>
      [
        customer.name,
        customer.phone,
        customer.email,
        customer.gstin,
        customer.customer_type,
        customer.type,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [list, debouncedSearch]);

  /*
   * These values are display summaries.
   * The backend remains the source of truth for financial figures.
   */
  const summary = useMemo(() => {
    return {
      receivable: list.reduce(
        (sum, customer) => sum + getBalance(customer),
        0
      ),

      sales: list.reduce(
        (sum, customer) => sum + getSales(customer),
        0
      ),

      paid: list.reduce(
        (sum, customer) => sum + getPaid(customer),
        0
      ),

      withDue: list.filter(
        (customer) => getBalance(customer) > 0
      ).length,

      totalCustomers: list.length,

      cleared: list.filter(
        (customer) => getBalance(customer) <= 0
      ).length,
    };
  }, [list]);

  const save = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        name: String(form.name || "").trim(),
        phone: String(form.phone || "").trim(),
        email: String(form.email || "").trim(),
        gstin: String(form.gstin || "").trim(),
        address: String(form.address || "").trim(),
      };

      if (!payload.name) {
        toast.error("Customer name is required.");
        return;
      }

      if (editing) {
        await api.put(`/customers/${editing.id}`, {
          ...payload,
          id: editing.id,
        });
      } else {
        await api.post("/customers", payload);
      }

      toast.success(
        editing
          ? "Customer updated successfully."
          : "Customer added successfully."
      );

      setOpen(false);
      setEditing(null);
      setForm(empty);

      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);

    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      gstin: customer.gstin || "",
      address: customer.address || "",
    });

    setOpen(true);
  };

  return (
    <div
      className="space-y-6"
      data-testid="customers-page"
    >
      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] font-semibold text-slate-500">
            Customer Accounts
          </div>

          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            Customers
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage customer accounts, outstanding balances and ledgers.
          </p>
        </div>

        <Button
          onClick={openAdd}
          className="rounded-sm bg-blue-600 hover:bg-blue-700"
          data-testid="add-customer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* =========================================================
          SUMMARY CARDS
      ========================================================= */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

        <div className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Customers
            </span>

            <Users className="h-4 w-4 text-slate-500" />
          </div>

          <div className="mt-2 text-xl font-bold font-mono-nums text-slate-800">
            {summary.totalCustomers}
          </div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Sales
            </span>

            <ShoppingBag className="h-4 w-4 text-slate-500" />
          </div>

          <div className="mt-2 text-xl font-bold font-mono-nums text-slate-800">
            {fmtINR(summary.sales)}
          </div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Paid
            </span>

            <CircleDollarSign className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="mt-2 text-xl font-bold font-mono-nums text-emerald-700">
            {fmtINR(summary.paid)}
          </div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Receivable
            </span>

            <WalletCards className="h-4 w-4 text-red-600" />
          </div>

          <div className="mt-2 text-xl font-bold font-mono-nums text-red-700">
            {fmtINR(summary.receivable)}
          </div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customers With Due
            </span>

            <ReceiptText className="h-4 w-4 text-amber-600" />
          </div>

          <div className="mt-2 text-xl font-bold font-mono-nums text-amber-700">
            {summary.withDue}
          </div>
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cleared Accounts
            </span>

            <CreditCard className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="mt-2 text-xl font-bold font-mono-nums text-emerald-700">
            {summary.cleared}
          </div>
        </div>

      </div>

      {/* =========================================================
          SEARCH
      ========================================================= */}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, phone, email, GSTIN..."
            className="rounded-sm bg-white pl-9"
            data-testid="customer-search"
          />
        </div>

        <div className="text-xs text-slate-500">
          {filteredList.length} of {list.length} customers
        </div>
      </div>

      {/* =========================================================
          CUSTOMER TABLE
      ========================================================= */}

      <div className="bg-white border border-slate-200 rounded-sm overflow-x-auto">

        <table className="data-table">

          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>GSTIN</th>
              <th>Status</th>
              <th>Sales</th>
              <th>Paid</th>
              <th className="text-right">
                Outstanding
              </th>
              <th className="text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>

            {filteredList.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-12"
                >
                  <div className="flex flex-col items-center justify-center">

                    <UserRound className="h-10 w-10 text-slate-300" />

                    <div className="mt-3 font-medium text-slate-600">
                      {search
                        ? "No customers match your search."
                        : "No customers yet."}
                    </div>

                    {!search && (
                      <Button
                        onClick={openAdd}
                        variant="outline"
                        className="mt-4 rounded-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Customer
                      </Button>
                    )}

                  </div>
                </td>
              </tr>
            )}

            {filteredList.map((customer) => {
              const balance = getBalance(customer);
              const sales = getSales(customer);
              const paid = getPaid(customer);
              const status = getStatus(customer);

              const customerType =
                customer.customer_type ||
                customer.type;

              const lastTransaction =
                customer.last_transaction_date ||
                customer.last_sale_date ||
                customer.last_transaction_at;

              return (
                <tr key={customer.id}>

                  {/* CUSTOMER */}

                  <td>
                    <div className="flex items-center gap-3">

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <UserRound className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">

                        <div className="font-semibold text-slate-800">
                          {customer.name}
                        </div>

                        {customerType && (
                          <span className="mt-1 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                            {customerType}
                          </span>
                        )}

                        {lastTransaction && (
                          <div className="mt-1 text-[11px] text-slate-400">
                            Last transaction:{" "}
                            {formatDate(lastTransaction)}
                          </div>
                        )}

                      </div>

                    </div>
                  </td>

                  {/* CONTACT */}

                  <td>
                    <div className="space-y-1">

                      {customer.phone ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {customer.phone}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-400">
                          —
                        </div>
                      )}

                      {customer.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </div>
                      )}

                    </div>
                  </td>

                  {/* GSTIN */}

                  <td className="font-mono text-xs">
                    {customer.gstin || "—"}
                  </td>

                  {/* STATUS */}

                  <td>
                    <div className="flex flex-col items-start gap-1">

                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.tone}`}
                      >
                        {status.label}
                      </span>

                      <span className="text-[10px] text-slate-400">
                        {status.description}
                      </span>

                    </div>
                  </td>

                  {/* SALES */}

                  <td className="num-cell">
                    <span className="font-mono-nums text-sm font-medium">
                      {fmtINR(sales)}
                    </span>
                  </td>

                  {/* PAID */}

                  <td className="num-cell">
                    <span className="font-mono-nums text-sm text-emerald-700">
                      {fmtINR(paid)}
                    </span>
                  </td>

                  {/* OUTSTANDING */}

                  <td className="text-right">

                    <span
                      className={`inline-flex rounded-sm border px-2.5 py-1 font-mono-nums font-bold ${balanceTone(
                        balance
                      )}`}
                    >
                      {fmtINR(balance)}
                    </span>

                  </td>

                  {/* ACTIONS */}

                  <td className="text-right">

                    <div className="flex items-center justify-end gap-2">

                      <Link
                        to={`/ledger/customer/${customer.id}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-slate-200 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        title="Open customer ledger"
                      >
                        <BookOpen className="h-3 w-3" />
                        Ledger
                      </Link>

                      <Link
                        to={`/ledger/customer/${customer.id}`}
                        className="inline-flex items-center justify-center rounded-sm border border-slate-200 p-1.5 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        title="Open transactions"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => openEdit(customer)}
                        className="rounded-sm border border-slate-200 p-1.5 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        title="Edit customer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                    </div>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

      {/* =========================================================
          CUSTOMER FORM
      ========================================================= */}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >

        <DialogContent className="rounded-sm max-w-lg">

          <DialogHeader>

            <DialogTitle className="font-heading">
              {editing
                ? "Edit Customer Account"
                : "Add Customer"}
            </DialogTitle>

          </DialogHeader>

          <form
            onSubmit={save}
            className="space-y-4"
          >

            {/* BASIC DETAILS */}

            <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">

              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Customer Details
              </div>

              <div className="space-y-3">

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Name
                  </Label>

                  <Input
                    value={form.name || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name: event.target.value,
                      })
                    }
                    className="rounded-sm mt-1 bg-white"
                    required
                    autoFocus
                    data-testid="cust-name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <div>
                    <Label className="text-xs uppercase font-semibold text-slate-600">
                      Phone
                    </Label>

                    <Input
                      value={form.phone || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          phone: event.target.value,
                        })
                      }
                      className="rounded-sm mt-1 bg-white"
                      data-testid="cust-phone"
                    />
                  </div>

                  <div>
                    <Label className="text-xs uppercase font-semibold text-slate-600">
                      Email
                    </Label>

                    <Input
                      type="email"
                      value={form.email || ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          email: event.target.value,
                        })
                      }
                      className="rounded-sm mt-1 bg-white"
                      data-testid="cust-email"
                    />
                  </div>

                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    GSTIN
                  </Label>

                  <Input
                    value={form.gstin || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        gstin: event.target.value,
                      })
                    }
                    className="rounded-sm mt-1 bg-white"
                    data-testid="cust-gstin"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase font-semibold text-slate-600">
                    Address
                  </Label>

                  <Input
                    value={form.address || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        address: event.target.value,
                      })
                    }
                    className="rounded-sm mt-1 bg-white"
                    data-testid="cust-address"
                  />
                </div>

              </div>

            </div>

            {/* ACCOUNT INFO */}

            {editing && (
              <div className="rounded-sm border border-slate-200 bg-white p-4">

                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Account Summary
                </div>

                <div className="grid grid-cols-3 gap-3">

                  <div>
                    <div className="text-[10px] uppercase text-slate-400">
                      Sales
                    </div>

                    <div className="mt-1 font-mono-nums font-semibold">
                      {fmtINR(getSales(editing))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-slate-400">
                      Paid
                    </div>

                    <div className="mt-1 font-mono-nums font-semibold text-emerald-700">
                      {fmtINR(getPaid(editing))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-slate-400">
                      Outstanding
                    </div>

                    <div className="mt-1 font-mono-nums font-semibold text-red-700">
                      {fmtINR(getBalance(editing))}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* FORM ACTIONS */}

            <div className="flex justify-end gap-2 pt-2">

              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="rounded-sm"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                className="rounded-sm bg-blue-600 hover:bg-blue-700"
              >
                {editing
                  ? "Save Changes"
                  : "Save Customer"}
              </Button>

            </div>

          </form>

        </DialogContent>

      </Dialog>
    </div>
  );
}
