import { buildExpiryValueRiskChartData, hasExpiryValueRiskData } from "./expiryValueRisk";

describe("expiry value-at-risk chart", () => {
  it("uses INR risk fields and enables the chart when one is positive", () => {
    const chartData = buildExpiryValueRiskChartData({
      expiry_value_at_risk: 1500,
      expired_value_at_risk: null,
      expiring_30_value_at_risk: "1500",
      expiring_90_value_at_risk: undefined,
      expiring_30_days: 0,
    });

    expect(chartData).toEqual([
      { name: "Expired", value: 0 },
      { name: "≤ 30 days", value: 1500 },
      { name: "≤ 90 days", value: 0 },
    ]);
    expect(hasExpiryValueRiskData(chartData)).toBe(true);
  });
});
