import React, { act } from "react";
import { createRoot } from "react-dom/client";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import StaleSoldUnitsRepair, { normalizeStaleSoldUnitsResponse, STALE_SOLD_UNITS_CONFIRMATION } from "./StaleSoldUnitsRepair";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  Navigate: ({ to }) => <span data-testid="navigate">{to}</span>,
}), { virtual: true });

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  fmtDate: (value) => value || "—",
  formatApiError: (error) => error?.message || "API error",
}));

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(user = { role: "admin" }) {
  useAuth.mockReturnValue({ user });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<StaleSoldUnitsRepair />);
  });
  return { container, root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("StaleSoldUnitsRepair", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    api.get.mockResolvedValue({ data: [
      {
        medicine_id: "med-1",
        medicine_name: "Paracetamol 500",
        batch_no: "B-42",
        expiry: "2027-03-31",
        purchased_units: 100,
        sold_units: 12,
        current_stock: 8,
        stock_after_clear: 20,
        reason: "Sold units not linked to invoice",
      },
    ] });
    api.post.mockResolvedValue({ data: { ok: true } });
  });

  it("normalizes API rows for the repair table", () => {
    expect(normalizeStaleSoldUnitsResponse({ items: [{ medicineName: "Cetirizine", medicineId: 9, batchNo: "A1", soldUnits: 3, currentStock: 4 }] })).toEqual([
      expect.objectContaining({ medicine: "Cetirizine", medicine_id: 9, batch_no: "A1", sold_units: 3, current_stock: 4, stock_after_clear: 7 }),
    ]);
  });

  it("loads the page and displays stale sold units data", async () => {
    const { container, root } = renderPage();
    await flush();

    expect(api.get).toHaveBeenCalledWith("/admin/inventory/stale-sold-units");
    expect(container.textContent).toContain("Temporary repair tool — remove after inventory cleanup is completed.");
    expect(container.textContent).toContain("Paracetamol 500");
    expect(container.textContent).toContain("B-42");
    expect(container.textContent).toContain("20");
    act(() => root.unmount());
  });

  it("confirms before clearing and refreshes the list after repair", async () => {
    const { container, root } = renderPage();
    await flush();

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Clear Stale Sold Units")).click();
      await Promise.resolve();
    });

    expect(window.confirm).toHaveBeenCalledWith(STALE_SOLD_UNITS_CONFIRMATION);
    expect(api.post).toHaveBeenCalledWith("/admin/inventory/stale-sold-units/clear", { medicine_id: "med-1", batch_no: "B-42", confirm: true });
    expect(api.get).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it("does not call the repair API when confirmation is cancelled", async () => {
    window.confirm = jest.fn(() => false);
    const { container, root } = renderPage();
    await flush();

    act(() => {
      [...container.querySelectorAll("button")].find((button) => button.textContent.includes("Clear Stale Sold Units")).click();
    });

    expect(api.post).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("enforces admin-only access before loading data", () => {
    const { root } = renderPage({ role: "cashier" });
    expect(api.get).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
