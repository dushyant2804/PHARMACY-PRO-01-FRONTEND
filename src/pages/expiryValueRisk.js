const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

export const buildExpiryValueRiskChartData = (payload) => {
  const source = firstDefined(payload?.expiry_analytics, payload?.expiry, payload, {});
  return [
    { name: "Expired", value: Number(source.expired_value_at_risk || 0) },
    { name: "≤ 30 days", value: Number(source.expiring_30_value_at_risk || 0) },
    { name: "≤ 90 days", value: Number(source.expiring_90_value_at_risk || 0) },
  ];
};

export const hasExpiryValueRiskData = (expiryValueRiskChartData) =>
  expiryValueRiskChartData.some((row) => Number(row.value || 0) > 0);
