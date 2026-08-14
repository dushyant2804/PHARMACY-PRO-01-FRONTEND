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
  X,
  UserRound,
  Phone,
  Mail,
  MapPin,
  FileText,
  IndianRupee,
  ArrowUpRight,
  ArrowDownRight,
  UserPlus,
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

export default function Customers() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  const customerBalance = (customer) =>
    Number(
      customer.receivable_balance ??
        customer.outstanding_balance ??
        customer.balance ??
        customer.amount_due ??
        0,
    );

  const customerSales = (customer) =>
    Number(customer.total_sales ?? customer.sales_total ?? 0);

  const customerPaid = (customer) =>
    Number(customer.total_paid ?? customer.paid_total ?? 0);

  const load = async () => {
    try {
      const response = await api.get("/customers");
      const data = response.data;

      setList(Array.isArray(data) ? data : data?.items || data?.data || []);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  /*
   * F3 opens the customer form.
   * It intentionally does nothing while the user is typing.
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = document.activeElement?.tagName;

      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
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

    if (!query) return list;

    return list.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.gstin].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
      ),
    );
  }, [list, debouncedSearch]);

  const summary = useMemo(
    () => ({
      receivable: list.reduce(
        (sum, customer) => sum + customerBalance(customer),
        0,
      ),
      sales: list.reduce((sum, customer) => sum + customerSales(customer), 0),
      paid: list.reduce((sum, customer) => sum + customerPaid(customer), 0),
      withDue: list.filter((customer) => customerBalance(customer) > 0).length,
    }),
    [list],
  );

  const openAddForm = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEditForm = (customer) => {
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

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    setForm(empty);
  };

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
        toast.error("Customer name is required");
        return;
      }

      if (editing) {
        await api.put(`/customers/${editing.id}`, {
          ...payload,
          id: editing.id,
        });

        toast.success("Customer updated successfully");
      } else {
        await api.post("/customers", payload);

        toast.success("Customer added successfully");
      }

      closeForm();
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const balanceTone = (balance) => {
    if (balance <= 0) {
      return {
        wrapper: "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
        label: "Cleared",
      };
    }

    if (balance < 1000) {
      return {
        wrapper: "border-amber-200 bg-amber-50 text-amber-700",
        dot: "bg-amber-500",
        label: "Due",
      };
    }

    return {
      wrapper: "border-red-200 bg-red-50 text-red-700",
      dot: "bg-red-500",
      label: "Due",
    };
  };

  const paymentStatus = (customer) => {
    const balance = customerBalance(customer);

    if (balance <= 0) {
      return {
        label: "Cleared",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (customerPaid(customer) > 0) {
      return {
        label: "Partial",
        tone: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    return {
      label: "Due",
      tone: "border-red-200 bg-red-50 text-red-700",
    };
  };

  const stats = [
    {
      label: "Total Receivable",
      value: fmtINR(summary.receivable),
      icon: WalletCards,
      description: "Outstanding from customers",
      tone: "text-red-700",
      iconTone: "bg-red-50 text-red-600",
    },
    {
      label: "Total Sales",
      value: fmtINR(summary.sales),
      icon: ShoppingBag,
      description: "Sales recorded against customers",
      tone: "text-slate-900",
      iconTone: "bg-slate-100 text-slate-700",
    },
    {
      label: "Total Paid",
      value: fmtINR(summary.paid),
      icon: CircleDollarSign,
      description: "Payments received",
      tone: "text-emerald-700",
      iconTone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Customers With Due",
      value: summary.withDue,
      icon: Users,
      description: "Accounts requiring collection",
      tone: "text-amber-700",
      iconTone: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="min-h-full space-y-6 pb-8" data-testid="customers-page">
      {/* =========================================================
          PAGE HEADER
         ========================================================= */}
      <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-blue-50 text-blue-700">
              <UserRound className="h-6 w-6" />
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Customer Accounts
              </div>

              <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Customers
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage customer accounts, receivables and ledger history.
              </p>
            </div>
          </div>

          <Button
            onClick={openAddForm}
            className="h-10 rounded-sm bg-blue-600 px-4 font-semibold shadow-sm hover:bg-blue-700"
            data-testid="add-customer"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Customer
            <span className="ml-3 hidden border-l border-blue-400 pl-3 text-[10px] font-medium opacity-80 sm:inline">
              F3
            </span>
          </Button>
        </div>
      </section>

      {/* =========================================================
          SUMMARY
         ========================================================= */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </div>

                  <div
                    className={`mt-2 text-xl font-bold tracking-tight ${item.tone}`}
                  >
                    {item.value}
                  </div>

                  <div className="mt-1 text-[11px] text-slate-400">
                    {item.description}
                  </div>
                </div>

                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm ${item.iconTone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* =========================================================
          SEARCH / TOOLBAR
         ========================================================= */}
      <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer by name, phone, email or GSTIN..."
              className="h-10 rounded-sm border-slate-200 bg-slate-50 pl-9 pr-9 focus:bg-white"
              data-testid="customer-search"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {filteredList.length}
            </span>

            <span>{filteredList.length === 1 ? "customer" : "customers"}</span>
          </div>
        </div>
      </section>

      {/* =========================================================
          CUSTOMER LIST
         ========================================================= */}
      <section className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Customer Accounts
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Customer balances and account status
            </p>
          </div>

          <div className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live account data
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Customer
                </th>

                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Contact
                </th>

                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  GSTIN
                </th>

                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Account Status
                </th>

                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Receivable
                </th>

                <th className="w-[180px] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Users className="h-5 w-5" />
                      </div>

                      <div className="mt-3 text-sm font-semibold text-slate-700">
                        {search ? "No customers found" : "No customers yet"}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {search
                          ? "Try a different name, phone number, email or GSTIN."
                          : "Add your first customer to start maintaining customer accounts."}
                      </p>

                      {!search && (
                        <Button
                          onClick={openAddForm}
                          className="mt-4 h-9 rounded-sm bg-blue-600 text-xs hover:bg-blue-700"
                        >
                          <Plus className="mr-2 h-3.5 w-3.5" />
                          Add Customer
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {filteredList.map((customer) => {
                const balance = customerBalance(customer);
                const status = paymentStatus(customer);
                const customerType = customer.customer_type || customer.type;
                const tone = balanceTone(balance);

                return (
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/70"
                  >
                    {/* CUSTOMER */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-blue-50 text-sm font-bold text-blue-700">
                          {String(customer.name || "?")
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {customer.name}
                          </div>

                          {customerType && (
                            <span className="mt-1 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                              {customerType}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CONTACT */}
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-700">
                        {customer.phone || "—"}
                      </div>

                      <div className="mt-0.5 max-w-[220px] truncate text-xs text-slate-400">
                        {customer.email || "No email"}
                      </div>
                    </td>

                    {/* GSTIN */}
                    <td className="px-4 py-4">
                      <span className="font-mono text-[11px] text-slate-600">
                        {customer.gstin || "—"}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status.tone}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {status.label}
                      </span>
                    </td>

                    {/* BALANCE */}
                    <td className="px-4 py-4 text-right">
                      <div
                        className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono-nums text-sm font-bold ${tone.wrapper}`}
                      >
                        {balance > 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}

                        {fmtINR(balance)}
                      </div>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/ledger/customer/${customer.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-blue-200 bg-blue-50 px-3 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          Ledger
                        </Link>

                        <button
                          type="button"
                          onClick={() => openEditForm(customer)}
                          className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
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
      </section>

      {/* =========================================================
          ADD / EDIT CUSTOMER DIALOG
         ========================================================= */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-sm border-slate-200 p-0 shadow-2xl sm:max-w-xl">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-blue-100 text-blue-700">
                {editing ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </div>

              <div>
                <DialogTitle className="font-heading text-lg font-bold text-slate-900">
                  {editing ? "Edit Customer" : "Add Customer"}
                </DialogTitle>

                <p className="mt-1 text-xs text-slate-500">
                  {editing
                    ? "Update customer master information."
                    : "Create a customer account for sales and ledger tracking."}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={save}>
            <div className="space-y-6 px-5 py-5 sm:px-6">
              {/* CUSTOMER INFORMATION */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-blue-600" />

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Customer Information
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Basic customer identification
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label
                      htmlFor="customer-name"
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-600"
                    >
                      Customer Name <span className="text-red-500">*</span>
                    </Label>

                    <div className="relative mt-1.5">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <Input
                        id="customer-name"
                        value={form.name}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            name: event.target.value,
                          })
                        }
                        placeholder="Enter customer name"
                        className="h-10 rounded-sm border-slate-200 pl-9"
                        required
                        autoFocus
                        data-testid="cust-name"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label
                        htmlFor="customer-phone"
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-600"
                      >
                        Phone
                      </Label>

                      <div className="relative mt-1.5">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                        <Input
                          id="customer-phone"
                          value={form.phone}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              phone: event.target.value,
                            })
                          }
                          placeholder="Phone number"
                          className="h-10 rounded-sm border-slate-200 pl-9"
                          data-testid="cust-phone"
                        />
                      </div>
                    </div>

                    <div>
                      <Label
                        htmlFor="customer-email"
                        className="text-[10px] font-bold uppercase tracking-wider text-slate-600"
                      >
                        Email
                      </Label>

                      <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                        <Input
                          id="customer-email"
                          type="email"
                          value={form.email}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              email: event.target.value,
                            })
                          }
                          placeholder="Email address"
                          className="h-10 rounded-sm border-slate-200 pl-9"
                          data-testid="cust-email"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TAX INFORMATION */}
              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-600" />

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Tax Information
                    </div>

                    <div className="text-[11px] text-slate-400">
                      GST and billing details
                    </div>
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="customer-gstin"
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-600"
                  >
                    GSTIN
                  </Label>

                  <div className="relative mt-1.5">
                    <FileText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <Input
                      id="customer-gstin"
                      value={form.gstin}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          gstin: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Enter GSTIN if applicable"
                      className="h-10 rounded-sm border-slate-200 pl-9 font-mono text-sm uppercase"
                      data-testid="cust-gstin"
                    />
                  </div>
                </div>
              </div>

              {/* ADDRESS */}
              <div className="border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-600" />

                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Address
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Billing or customer address
                    </div>
                  </div>
                </div>

                <textarea
                  id="customer-address"
                  value={form.address}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      address: event.target.value,
                    })
                  }
                  placeholder="Enter customer address"
                  rows={3}
                  className="w-full resize-none rounded-sm border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  data-testid="cust-address"
                />
              </div>
            </div>

            {/* FORM FOOTER */}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                className="h-10 rounded-sm border-slate-300 bg-white px-5"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                className="h-10 rounded-sm bg-blue-600 px-6 font-semibold hover:bg-blue-700"
              >
                {editing ? (
                  <>
                    <Pencil className="mr-2 h-4 w-4" />
                    Update Customer
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Save Customer
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
