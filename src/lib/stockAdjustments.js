const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

export const normalizeCollection = (data) => {
  const collection = firstDefined(data?.items, data?.adjustments, data?.data, data?.results, data, []);
  return Array.isArray(collection) ? collection : [];
};

export const getMedicineId = (medicine = {}) =>
  firstDefined(medicine.id, medicine.medicine_id, medicine.medicineId, "");

export const getMedicineName = (medicine = {}) =>
  firstDefined(medicine.name, medicine.medicine_name, medicine.medicine, "");

export const getBatchNumber = (batch = {}) =>
  firstDefined(batch.batch_no, batch.batch_number, batch.batchNo, batch.batch, "");

export const getBatchId = (batch = {}) =>
  firstDefined(batch.id, batch.batch_id, batch.batchId, getBatchNumber(batch));

export const getAvailableStock = (batch = {}) =>
  Number(
    firstDefined(
      batch.available_stock,
      batch.available_quantity,
      batch.available_units,
      batch.quantity_units,
      batch.current_stock,
      batch.total_stock,
      batch.stock,
      0
    )
  );

export const getMedicineBatches = (medicine = {}) => {
  if (Array.isArray(medicine.batches) && medicine.batches.length > 0) {
    return medicine.batches;
  }

  return getBatchNumber(medicine) ? [medicine] : [];
};

export const validateStockAdjustment = ({ date, medicine, batch, adjustmentType, quantity }) => {
  const errors = {};
  const parsedQuantity = Number(quantity);

  if (!date) errors.date = "Choose an adjustment date.";
  if (!medicine) errors.medicine = "Select a medicine from the suggestions.";
  if (!batch) errors.batch = "Select a batch to adjust.";
  if (!adjustmentType) errors.adjustmentType = "Choose an adjustment type.";
  if (quantity === "" || !Number.isFinite(parsedQuantity) || parsedQuantity === 0) {
    errors.quantity = "Enter a non-zero quantity. Use + to add stock and − to reduce stock.";
  } else if (!Number.isInteger(parsedQuantity)) {
    errors.quantity = "Quantity must be a whole number.";
  } else if (batch && parsedQuantity < 0 && Math.abs(parsedQuantity) > getAvailableStock(batch)) {
    errors.quantity = `Cannot reduce more than the available stock (${getAvailableStock(batch)}).`;
  }

  return errors;
};

export const summarizeAdjustments = (adjustments = []) => {
  const totals = { damaged: 0, expired: 0, correction: 0, total: 0 };

  adjustments.forEach((adjustment) => {
    const quantity = Number(firstDefined(adjustment.quantity, adjustment.adjusted_quantity, adjustment.qty, 0));
    const type = String(firstDefined(adjustment.adjustment_type, adjustment.type, adjustment.reason, ""))
      .trim()
      .toLowerCase()
      .replace(/[ -]+/g, "_");

    totals.total += quantity;
    if (type === "damaged") totals.damaged += quantity;
    if (type === "expired") totals.expired += quantity;
    if (["correction", "stock_correction", "inventory_correction"].includes(type)) {
      totals.correction += quantity;
    }
  });

  return totals;
};

export const adjustmentTypeLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_");
  const labels = {
    damaged: "Damaged",
    expired: "Expired",
    correction: "Correction",
    stock_correction: "Correction",
    inventory_correction: "Correction",
    stock_count: "Stock count",
    received: "Received",
    return: "Return",
    other: "Other",
  };
  return labels[normalized] || value || "—";
};
