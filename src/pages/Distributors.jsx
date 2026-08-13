import React, { useEffect, useMemo, useState } from "react";
import api, { fmtINR, formatApiError } from "@/lib/api";
import { getDistributorBalanceLabel } from "@/lib/sharing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Plus,
  BookOpen,
  Pencil,
  Search,
  Truck,
  WalletCards,
  ShoppingCart,
  BadgeIndianRupee,
  CircleDollarSign,
  Scale,
  Building2,
  Phone,
  Mail,
  MapPin,
  ReceiptText,
  IndianRupee,
  CheckCircle2,
  Save,
  UserRound,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import useDebouncedValue from "@/hooks/useDebouncedValue";

const empty = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gstin: "",
  opening_balance: 0
};

const getCurrentBalance = (distributor) =>
  Number(
    distributor.current_balance ??
      distributor.outstanding_balance ??
      0
  );

const getStatus = (distributor) =>
  distributor.status || distributor.distributor_status;

const getLastPurchaseDate = (distributor) =>
  distributor.last_purchase_date || distributor.last_purchase_at;

const getTotalPurchases = (distributor) =>
  Number(
    distributor.total_purchases ??
      distributor.purchase_total ??
      0
  );

const getTotalPaidAdjusted = (distributor) =>
  Number(
    distributor.total_paid_adjusted ??
      distributor.total_paid ??
      distributor.paid_total ??
      0
  );

const getTotalPayable = (distributor) =>
  Number(
    distributor.total_payable ??
      Math.max(0, getCurrentBalance(distributor))
  );

const getDistributorReceivable = (distributor) =>
  Number(
    distributor.total_receivable_from_distributors ??
      Math.max(0, -getCurrentBalance(distributor))
  );

const getNetDistributorBalance = (distributor) =>
  Number(
    distributor.net_distributor_balance ??
      (getTotalPayable(distributor) -
        getDistributorReceivable(distributor))
  );

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      })
    : "—";

const statusTone = (status) => {
  const value = String(status || "")
    .toLowerCase()
    .replace(/[_-]/g, " ");

  if (value === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "return heavy") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
};

const balanceTone = (balance) => {
  const value = Number(balance || 0);

  if (value <= 0) {
    return {
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      amount: "text-emerald-700"
    };
  }

  if (value >= 100000) {
    return {
      badge:
        "border-red-200 bg-red-50 text-red-700",
      amount: "text-red-700"
    };
  }

  return {
    badge:
      "border-amber-200 bg-amber-50 text-amber-700",
    amount: "text-amber-700"
  };
};

export default function Distributors() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const debouncedSearch = useDebouncedValue(search, 250);

  const load = () =>
    api
      .get("/distributors")
      .then((r) => {
        const data = Array.isArray(r.data)
          ? r.data
          : r.data?.items ||
            r.data?.data ||
            [];

        setList(data);
      })
      .catch((error) => {
        toast.error(formatApiError(error));
      });

  useEffect(() => {
    load();
  }, []);

  /*
   * F4 opens the Add Distributor form.
   *
   * We intentionally ignore the shortcut while the user
   * is typing inside an input or textarea.
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;

      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();

        setEditing(null);
        setForm(empty);
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  const openAddDistributor = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEditDistributor = (distributor) => {
    setEditing(distributor);

    setForm({
      name: distributor.name || "",
      phone: distributor.phone || "",
      email: distributor.email || "",
      address: distributor.address || "",
      gstin: distributor.gstin || "",
      opening_balance:
        distributor.opening_balance ?? 0
    });

    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...form,
        opening_balance: Number(
          form.opening_balance || 0
        )
      };

      if (editing) {
        await api.put(
          `/distributors/${editing.id}`,
          {
            ...payload,
            id: editing.id
          }
        );

        toast.success(
          "Distributor updated successfully"
        );
      } else {
        await api.post(
          "/distributors",
          payload
        );

        toast.success(
          "Distributor created successfully"
        );
      }

      setOpen(false);
      setEditing(null);
      setForm(empty);

      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const filteredList = useMemo(() => {
    const query = debouncedSearch
      .trim()
      .toLowerCase();

    if (!query) {
      return list;
    }

    return list.filter((distributor) =>
      [
        distributor.name,
        distributor.phone,
        distributor.email,
        distributor.gstin,
        distributor.address
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [list, debouncedSearch]);

  const summary = useMemo(
    () => ({
      payable: list.reduce(
        (sum, distributor) =>
          sum + getTotalPayable(distributor),
        0
      ),

      receivable: list.reduce(
        (sum, distributor) =>
          sum +
          getDistributorReceivable(
            distributor
          ),
        0
      ),

      netBalance: list.reduce(
        (sum, distributor) =>
          sum +
          getNetDistributorBalance(
            distributor
          ),
        0
      ),

      purchases: list.reduce(
        (sum, distributor) =>
          sum +
          getTotalPurchases(distributor),
        0
      ),

      paidAdjusted: list.reduce(
        (sum, distributor) =>
          sum +
          getTotalPaidAdjusted(distributor),
        0
      ),

      active: list.filter(
        (distributor) =>
          String(
            getStatus(distributor) ||
              "active"
          ).toLowerCase() === "active"
      ).length
    }),
    [list]
  );

  const summaryCards = [
    {
      label: "Total Payable",
      value: fmtINR(summary.payable),
      icon: WalletCards,
      tone: "text-red-700",
      bg: "bg-red-50",
      iconBg: "bg-red-100",
      iconTone: "text-red-600"
    },
    {
      label: "Total Purchases",
      value: fmtINR(summary.purchases),
      icon: ShoppingCart,
      tone: "text-slate-900",
      bg: "bg-slate-50",
      iconBg: "bg-slate-100",
      iconTone: "text-slate-700"
    },
    {
      label: "Total Paid / Adjusted",
      value: fmtINR(summary.paidAdjusted),
      icon: BadgeIndianRupee,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
      iconBg: "bg-emerald-100",
      iconTone: "text-emerald-700"
    },
    {
      label: "Distributor Receivable",
      value: fmtINR(summary.receivable),
      icon: CircleDollarSign,
      tone: "text-emerald-700",
      bg: "bg-emerald-50",
      iconBg: "bg-emerald-100",
      iconTone: "text-emerald-700"
    },
    {
      label: "Net Distributor Balance",
      value: fmtINR(summary.netBalance),
      icon: Scale,
      tone:
        summary.netBalance < 0
          ? "text-emerald-700"
          : "text-slate-900",
      bg: "bg-blue-50",
      iconBg: "bg-blue-100",
      iconTone: "text-blue-700"
    },
    {
      label: "Active Distributors",
      value: summary.active,
      icon: Truck,
      tone: "text-slate-900",
      bg: "bg-violet-50",
      iconBg: "bg-violet-100",
      iconTone: "text-violet-700"
    }
  ];

  return (
    <div
      className="space-y-7"
      data-testid="distributors-page"
    >
      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Suppliers & Accounts
          </div>

          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Distributors
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage supplier profiles, purchases,
            outstanding balances and distributor
            ledgers from one place.
          </p>
        </div>

        <Button
          onClick={openAddDistributor}
          className="
            h-11
            rounded-xl
            bg-blue-600
            px-5
            font-semibold
            shadow-sm
            hover:bg-blue-700
          "
          data-testid="add-distributor"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Distributor
        </Button>
      </div>

      {/* =========================================================
          SUMMARY CARDS
      ========================================================= */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map(
          ({
            label,
            value,
            icon: Icon,
            tone,
            bg,
            iconBg,
            iconTone
          }) => (
            <div
              key={label}
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-4
                shadow-sm
                transition
                hover:-translate-y-0.5
                hover:shadow-md
              "
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg} ${iconTone}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div
                  className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${bg} ${tone}`}
                >
                  {label === "Active Distributors"
                    ? "Live"
                    : "Summary"}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </div>

                <div
                  className={`mt-1 break-words text-xl font-bold font-mono-nums ${tone}`}
                >
                  {value}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* =========================================================
          SEARCH / TOOLBAR
      ========================================================= */}

      <div
        className="
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-3
          shadow-sm
        "
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search distributor, phone, email, GSTIN..."
              className="
                h-11
                rounded-xl
                border-slate-200
                bg-slate-50
                pl-10
                pr-4
                focus:bg-white
              "
              data-testid="distributor-search"
            />
          </div>

          <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
            <span>
              Showing{" "}
              <strong className="text-slate-800">
                {filteredList.length}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-800">
                {list.length}
              </strong>{" "}
              distributors
            </span>

            <span className="hidden rounded-lg bg-slate-100 px-2.5 py-1 font-semibold sm:inline-flex">
              F4 · Add Distributor
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================
          DISTRIBUTOR LIST
      ========================================================= */}

      {filteredList.length === 0 ? (
        <div
          className="
            rounded-2xl
            border
            border-dashed
            border-slate-300
            bg-white
            px-6
            py-14
            text-center
          "
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Truck className="h-7 w-7" />
          </div>

          <h3 className="mt-4 text-lg font-bold text-slate-800">
            {search
              ? "No distributors found"
              : "No distributors yet"}
          </h3>

          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {search
              ? "Try searching with a different name, phone number, email or GSTIN."
              : "Add your first distributor to start tracking purchases, payments and balances."}
          </p>

          {!search && (
            <Button
              onClick={openAddDistributor}
              className="mt-5 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Distributor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredList.map((d) => {
            const currentBalance =
              getCurrentBalance(d);

            const balance =
              balanceTone(currentBalance);

            const status =
              getStatus(d) || "Active";

            const totalPurchases =
              getTotalPurchases(d);

            const totalPaid =
              getTotalPaidAdjusted(d);

            const payable =
              getTotalPayable(d);

            const receivable =
              getDistributorReceivable(d);

            return (
              <div
                key={d.id}
                className="
                  group
                  overflow-hidden
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  shadow-sm
                  transition-all
                  duration-200
                  hover:-translate-y-0.5
                  hover:border-blue-200
                  hover:shadow-lg
                "
              >
                {/* CARD HEADER */}

                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
                        <Building2 className="h-6 w-6" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-bold text-slate-900">
                            {d.name ||
                              "Unnamed Distributor"}
                          </h2>

                          <span
                            className={`
                              inline-flex
                              rounded-full
                              border
                              px-2
                              py-0.5
                              text-[9px]
                              font-bold
                              uppercase
                              tracking-wider
                              ${statusTone(status)}
                            `}
                          >
                            {String(status).replace(
                              /[_-]/g,
                              " "
                            )}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          {d.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {d.phone}
                            </span>
                          )}

                          {d.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {d.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openEditDistributor(d)
                      }
                      className="
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-slate-200
                        text-slate-500
                        transition
                        hover:border-blue-200
                        hover:bg-blue-50
                        hover:text-blue-600
                      "
                      title="Edit Distributor"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>

                  {/* GST / ADDRESS */}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {d.gstin && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">
                        <ReceiptText className="h-3 w-3" />
                        GSTIN:{" "}
                        <span className="font-mono text-slate-800">
                          {d.gstin}
                        </span>
                      </span>
                    )}

                    {d.address && (
                      <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-medium text-slate-600">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {d.address}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* BALANCE AREA */}

                <div className="grid grid-cols-1 border-b border-slate-100 sm:grid-cols-3">
                  <div className="border-b border-slate-100 p-4 sm:border-b-0 sm:border-r">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Current Balance
                    </div>

                    <div
                      className={`mt-1 text-xl font-bold font-mono-nums ${balance.amount}`}
                    >
                      {fmtINR(currentBalance)}
                    </div>

                    <div
                      className={`mt-1 inline-flex rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${balance.badge}`}
                    >
                      {getDistributorBalanceLabel(
                        currentBalance
                      )}
                    </div>
                  </div>

                  <div className="border-b border-slate-100 p-4 sm:border-b-0 sm:border-r">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Total Purchases
                    </div>

                    <div className="mt-1 text-lg font-bold font-mono-nums text-slate-900">
                      {fmtINR(
                        totalPurchases
                      )}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-500">
                      Lifetime purchases
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Paid / Adjusted
                    </div>

                    <div className="mt-1 text-lg font-bold font-mono-nums text-emerald-700">
                      {fmtINR(totalPaid)}
                    </div>

                    <div className="mt-1 text-[10px] text-slate-500">
                      Payments & adjustments
                    </div>
                  </div>
                </div>

                {/* ACCOUNT BREAKDOWN */}

                <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-4">
                  <div className="rounded-xl border border-red-100 bg-white p-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <CreditCard className="h-3 w-3" />
                      Payable
                    </div>

                    <div className="mt-1 font-mono-nums text-sm font-bold text-red-700">
                      {fmtINR(payable)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-white p-3">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <CircleDollarSign className="h-3 w-3" />
                      Receivable
                    </div>

                    <div className="mt-1 font-mono-nums text-sm font-bold text-emerald-700">
                      {fmtINR(receivable)}
                    </div>
                  </div>
                </div>

                {/* FOOTER */}

                <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-4 w-4 text-slate-400" />

                    <span>
                      Last purchase{" "}
                      <strong className="font-semibold text-slate-700">
                        {formatDate(
                          getLastPurchaseDate(d)
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      className="
                        h-9
                        rounded-xl
                        border-slate-200
                        px-3
                        text-xs
                        font-semibold
                        hover:border-blue-200
                        hover:bg-blue-50
                        hover:text-blue-700
                      "
                    >
                      <Link
                        to={`/ledger/distributor/${d.id}`}
                      >
                        <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                        Ledger
                      </Link>
                    </Button>

                    <Button
                      type="button"
                      onClick={() =>
                        openEditDistributor(d)
                      }
                      className="
                        h-9
                        rounded-xl
                        bg-slate-900
                        px-3
                        text-xs
                        font-semibold
                        hover:bg-slate-800
                      "
                    >
                      Edit
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          ADD / EDIT DISTRIBUTOR DIALOG
      ========================================================= */}

      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent
          className="
            w-[calc(100vw-2rem)]
            max-w-4xl
            max-h-[90vh]
            overflow-y-auto
            rounded-2xl
            border-0
            bg-slate-50
            p-0
            shadow-2xl
          "
        >
          {/* HEADER */}

          <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-6 py-7 text-white">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 right-32 h-36 w-36 rounded-full bg-white/5" />

            <DialogHeader className="relative">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
                  {editing ? (
                    <Pencil className="h-7 w-7" />
                  ) : (
                    <Building2 className="h-7 w-7" />
                  )}
                </div>

                <div>
                  <DialogTitle className="font-heading text-2xl font-bold text-white sm:text-3xl">
                    {editing
                      ? "Edit Distributor"
                      : "Add Distributor"}
                  </DialogTitle>

                  <p className="mt-1 max-w-xl text-sm text-blue-100">
                    {editing
                      ? "Update the distributor's business and contact information."
                      : "Create a distributor profile for purchases, payments, and ledger tracking."}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form
            onSubmit={save}
            className="space-y-6 p-6"
          >
            {/* BUSINESS IDENTITY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Business Identity
                  </div>

                  <div className="text-xs text-slate-500">
                    Basic information about the distributor
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <UserRound className="h-3.5 w-3.5" />
                    Distributor Name
                  </Label>

                  <Input
                    value={form.name || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value
                      })
                    }
                    placeholder="Enter distributor / company name"
                    required
                    className="
                      mt-2
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      text-base
                      font-medium
                      focus:bg-white
                    "
                    data-testid="dist-name"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </Label>

                  <Input
                    value={form.phone || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        phone: e.target.value
                      })
                    }
                    placeholder="Mobile / phone number"
                    className="
                      mt-2
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      focus:bg-white
                    "
                    data-testid="dist-phone"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Label>

                  <Input
                    type="email"
                    value={form.email || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: e.target.value
                      })
                    }
                    placeholder="Email address"
                    className="
                      mt-2
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      focus:bg-white
                    "
                    data-testid="dist-email"
                  />
                </div>
              </div>
            </section>

            {/* BUSINESS DETAILS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <ReceiptText className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Business Details
                  </div>

                  <div className="text-xs text-slate-500">
                    Tax and address information
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div>
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <ReceiptText className="h-3.5 w-3.5" />
                    GSTIN
                  </Label>

                  <Input
                    value={form.gstin || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gstin:
                          e.target.value.toUpperCase()
                      })
                    }
                    placeholder="Enter GSTIN"
                    className="
                      mt-2
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      uppercase
                      focus:bg-white
                    "
                    data-testid="dist-gstin"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <MapPin className="h-3.5 w-3.5" />
                    Address
                  </Label>

                  <Input
                    value={form.address || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: e.target.value
                      })
                    }
                    placeholder="Distributor address"
                    className="
                      mt-2
                      h-12
                      rounded-xl
                      border-slate-200
                      bg-slate-50
                      focus:bg-white
                    "
                    data-testid="dist-address"
                  />
                </div>
              </div>
            </section>

            {/* OPENING BALANCE */}

            <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <WalletCards className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="text-sm font-bold uppercase tracking-wider text-amber-900">
                      Opening Balance
                    </div>

                    <div className="mt-1 max-w-xl text-xs leading-5 text-amber-800/80">
                      Enter any existing amount already payable to this distributor.
                      Leave it at zero if there is no opening balance.
                    </div>
                  </div>
                </div>

                <div className="w-full sm:w-[260px]">
                  <Label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                    <IndianRupee className="h-3.5 w-3.5" />
                    Opening Amount
                  </Label>

                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-600">
                      ₹
                    </span>

                    <Input
                      type="number"
                      step="0.01"
                      value={
                        form.opening_balance ??
                        0
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          opening_balance:
                            e.target.value
                        })
                      }
                      className="
                        h-12
                        rounded-xl
                        border-amber-200
                        bg-white
                        pl-9
                        text-lg
                        font-bold
                        text-slate-900
                      "
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* QUICK SUMMARY */}

            {(form.name ||
              Number(
                form.opening_balance || 0
              ) !== 0) && (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Distributor Preview
                    </div>

                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {form.name ||
                        "New Distributor"}
                    </div>

                    <div className="text-sm text-slate-500">
                      {form.phone ||
                        "No phone number added"}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Opening Balance
                    </div>

                    <div className="mt-1 text-2xl font-bold font-mono-nums text-slate-900">
                      {fmtINR(
                        Number(
                          form.opening_balance ||
                            0
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ACTIONS */}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setOpen(false)
                }
                className="h-11 rounded-xl px-6"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                className="
                  h-11
                  rounded-xl
                  bg-blue-600
                  px-7
                  font-semibold
                  shadow-sm
                  hover:bg-blue-700
                "
              >
                {editing ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Distributor
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
