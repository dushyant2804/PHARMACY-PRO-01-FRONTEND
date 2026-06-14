const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

export const buildExpiryValueRiskChartData = (payload, totalValueAtRisk) => {
  const source = firstDefined(payload?.expiry_analytics, payload?.expiry, payload, {});
  const buckets = [
    { name: "Expired", value: Number(source.expired_value_at_risk || 0) },
    { name: "≤ 30 days", value: Number(source.expiring_30_value_at_risk || 0) },
    { name: "≤ 90 days", value: Number(source.expiring_90_value_at_risk || 0) },
  ];
  const bucketSum = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const total = Number(firstDefined(totalValueAtRisk, source.expiry_value_at_risk, 0) || 0);

  return bucketSum === 0 && total > 0
    ? [{ name: "Expiry risk", value: total }]
    : buckets;
};

export const hasExpiryValueRiskData = (expiryValueRiskChartData) =>
  expiryValueRiskChartData.some((row) => Number(row.value || 0) > 0);
