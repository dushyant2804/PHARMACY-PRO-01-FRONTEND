export const BILLING_SHORTCUTS = [
  { keys: "F1", action: "newBill", label: "New bill" },
  { keys: "F2", action: "focusMedicineSearch", label: "Medicine search" },
  { keys: "F3", action: "focusCustomerSearch", label: "Customer search" },
  { keys: "F4", action: "focusQuantity", label: "Quantity" },
  { keys: "F6", action: "createInvoice", label: "Create invoice" },
  { keys: "Esc", action: "clearMedicineSearch", label: "Clear search" },
  { keys: "Ctrl+Delete", action: "removeSelectedRow", label: "Remove row" },
];

export const getBillingShortcut = ({
  key,
  ctrlKey = false,
  metaKey = false,
}) => {
  if ((ctrlKey || metaKey) && key === "Delete") return "removeSelectedRow";

  switch (key) {
    case "F1":
      return "newBill";
    case "F2":
      return "focusMedicineSearch";
    case "F3":
      return "focusCustomerSearch";
    case "F4":
      return "focusQuantity";
    case "F6":
      return "createInvoice";
    case "Escape":
      return "clearMedicineSearch";
    default:
      return null;
  }
};

export const getNextCartRow = (currentIndex, direction, rowCount) => {
  if (rowCount <= 0) return -1;
  if (currentIndex < 0) return direction === "up" ? rowCount - 1 : 0;

  const offset = direction === "up" ? -1 : 1;
  return Math.min(Math.max(currentIndex + offset, 0), rowCount - 1);
};

export const getSelectedRowAfterRemoval = (removedIndex, rowCount) => {
  const remainingCount = rowCount - 1;
  if (remainingCount <= 0) return -1;
  return Math.min(Math.max(removedIndex, 0), remainingCount - 1);
};

export const removeCartRow = (cart, rowIndex) =>
  cart.filter((_, index) => index !== rowIndex);
