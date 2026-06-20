import {
  compareVersions,
  getStoredVersion,
  getUpdateType,
  getVersionIdentity,
  normalizeVersionMetadata,
  setStoredVersion,
} from "./version";

describe("version helpers", () => {
  test("compares semantic versions instead of comparing strings", () => {
    expect(compareVersions("2.10.0", "2.9.9")).toBe(1);
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.9.9", "2.0")).toBe(-1);
    expect(
      compareVersions("0.1.0+20260611-abc1234", "0.1.0+20260610-def5678"),
    ).toBe(1);
    expect(
      compareVersions("0.1.0+20260611-abc1234", "0.1.0+20260611-abc1234"),
    ).toBe(0);
  });

  test.each([
    ["2.0.0", "2.0.1", "patch"],
    ["2.0.0", "2.1.0", "minor"],
    ["2.0.0", "3.0.0", "major"],
  ])("classifies %s to %s as %s", (current, next, type) => {
    expect(getUpdateType(current, next)).toBe(type);
  });

  test("normalizes backend version metadata", () => {
    expect(
      normalizeVersionMetadata({
        app_version: "v2.1",
        update_message: "Ready",
        notes: "Faster\nSafer",
      }),
    ).toEqual({
      version: "2.1",
      date: null,
      message: "Ready",
      releaseNotes: { new: [], improved: ["Faster", "Safer"], fixed: [] },
      updateAvailable: null,
    });
  });

  test("splits semantic version identity from build metadata", () => {
    expect(getVersionIdentity("0.1.1+20260620-7682338")).toEqual({
      version: "0.1.1",
      build: "20260620-7682338",
      full: "0.1.1+20260620-7682338",
    });
  });

  test("handles unavailable browser storage safely", () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(getStoredVersion(unavailableStorage, "version")).toBeNull();
    expect(() =>
      setStoredVersion(unavailableStorage, "version", "2.1"),
    ).not.toThrow();
  });
});
