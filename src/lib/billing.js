const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

export const getMedicineStock = (medicine) =>
  Number(
    firstDefined(
      medicine?.available_stock,
      medicine?.available_units,
      medicine?.available_quantity,
      medicine?.quantity_units,
      medicine?.total_stock,
      medicine?.quantity,
      0
    )
  ) || 0;

const getBatchStock = (batch) =>
  Number(
    firstDefined(
      batch?.available_stock,
      batch?.available_units,
      batch?.available_quantity,
      batch?.quantity_units,
      batch?.remaining_quantity,
      batch?.quantity,
      0
    )
  ) || 0;

const expiryTime = (value) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const text = String(value).trim();
  const monthYear = text.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);

  if (monthYear) {
    const month = Number(monthYear[1]);
    const year = Number(monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2]);
    return new Date(year, month, 0, 23, 59, 59, 999).getTime();
  }

  const time = new Date(text).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

export const getFifoBatch = (medicine) => {
  const availableBatches = (Array.isArray(medicine?.batches) ? medicine.batches : [])
    .filter((batch) => getBatchStock(batch) > 0)
    .sort((a, b) => expiryTime(a.expiry_date || a.expiry) - expiryTime(b.expiry_date || b.expiry));

  return availableBatches[0] || null;
};

export const getBatchNumber = (batchOrMedicine) =>
  firstDefined(
    batchOrMedicine?.batch_number,
    batchOrMedicine?.batch_no,
    batchOrMedicine?.batch,
    batchOrMedicine?.batchNo,
    ""
  );

export const getNearestExpiry = (medicine) => {
  const batch = getFifoBatch(medicine);
  return firstDefined(batch?.expiry_date, batch?.expiry, medicine?.expiry_date, medicine?.expiry, "");
};

export const isLowStock = (medicine) => {
  const threshold = firstDefined(medicine?.low_stock_threshold, medicine?.reorder_level);
  return threshold !== undefined && getMedicineStock(medicine) <= Number(threshold);
};

export const searchMedicines = (medicines, query, limit = 8) => {
  const term = String(query || "").trim().toLowerCase();
  if (!term) return [];

  return (medicines || [])
    .map((medicine, index) => {
      const name = String(medicine?.name || medicine?.medicine_name || "").toLowerCase();
      const barcode = String(medicine?.barcode || "").toLowerCase();
      const batch = String(getBatchNumber(medicine)).toLowerCase();
      let rank = Number.POSITIVE_INFINITY;

      if (barcode === term) rank = 0;
      else if (name === term) rank = 1;
      else if (name.startsWith(term)) rank = 2;
      else if (barcode.startsWith(term)) rank = 3;
      else if (name.includes(term)) rank = 4;
      else if (batch.includes(term)) rank = 5;

      return { medicine, rank, index };
    })
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ medicine }) => medicine);
};
