import { compareVersions, getStoredVersion, getUpdateType, normalizeVersionMetadata, setStoredVersion } from "./version";

describe("version helpers", () => {
  test("compares semantic versions instead of comparing strings", () => {
    expect(compareVersions("2.10.0", "2.9.9")).toBe(1);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.9.9", "2.0")).toBe(-1);
  });

  test.each([
    ["2.0.0", "2.0.1", "patch"],
    ["2.0.0", "2.1.0", "minor"],
    ["2.0.0", "3.0.0", "major"],
  ])("classifies %s to %s as %s", (current, next, type) => {
    expect(getUpdateType(current, next)).toBe(type);
  });

  test("normalizes backend version metadata", () => {
    expect(normalizeVersionMetadata({ app_version: "v2.1", update_message: "Ready", notes: "Faster\nSafer" })).toEqual({
      version: "2.1",
      message: "Ready",
      releaseNotes: ["Faster", "Safer"],
    });
  });

  test("handles unavailable browser storage safely", () => {
    const unavailableStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(getStoredVersion(unavailableStorage, "version")).toBeNull();
    expect(() => setStoredVersion(unavailableStorage, "version", "2.1")).not.toThrow();
  });
});
