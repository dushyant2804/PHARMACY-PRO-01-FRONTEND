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

  it("falls back to the total risk value when all value buckets are empty", () => {
    const chartData = buildExpiryValueRiskChartData({
      expiry_value_at_risk: 2750,
      expired: 10,
      expiring_30_days: 20,
      expiring_90_days: 30,
    });

    expect(chartData).toEqual([{ name: "Expiry risk", value: 2750 }]);
    expect(hasExpiryValueRiskData(chartData)).toBe(true);
  });

  it("can use the KPI total when the expiry analytics payload omits it", () => {
    expect(buildExpiryValueRiskChartData({}, 900)).toEqual([
      { name: "Expiry risk", value: 900 },
    ]);
  });
});
