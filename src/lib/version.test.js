import {
  ACKNOWLEDGED_BUILD_KEY,
  compareVersions,
  FRONTEND_BUILD,
  getFrontendUpdateState,
  getStoredVersion,
  LOADED_BUILD_KEY,
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
      build: "",
      date: null,
      message: "Ready",
      releaseNotes: { new: [], improved: ["Faster", "Safer"], fixed: [] },
      updateAvailable: null,
    });
  });

  test("detects different builds for the same semantic version", () => {
    expect(
      compareVersions(
        "0.1.0+20260621T120001Z-abc1234",
        "0.1.0+20260621T115959Z-abc1234",
      ),
    ).toBe(1);
    expect(compareVersions("0.1.0+build-b", "0.1.0+build-a")).toBe(1);
  });

  test("combines explicit build ids with unchanged version numbers", () => {
    expect(
      normalizeVersionMetadata({ version: "0.1.0", build: "20260621T120001Z-abc1234" }),
    ).toMatchObject({
      version: "0.1.0+20260621T120001Z-abc1234",
      build: "20260621T120001Z-abc1234",
    });
  });

  test("splits semantic version identity from build metadata", () => {
    expect(getVersionIdentity("0.1.1+20260620-7682338")).toEqual({
      version: "0.1.1",
      build: "20260620-7682338",
      full: "0.1.1+20260620-7682338",
    });
  });

  test("uses frontend build metadata as the update source of truth", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(LOADED_BUILD_KEY, "20260621T120000Z-current");

    expect(
      getFrontendUpdateState({
        metadata: { version: "3.1.1", build: "" },
        storage,
      }),
    ).toMatchObject({
      latestBuild: "",
      loadedBuild: FRONTEND_BUILD || "20260621T120000Z-current",
      updateAvailable: false,
    });

    expect(
      getFrontendUpdateState({
        metadata: {
          version: "0.1.0+20260621T121000Z-next",
          build: "20260621T121000Z-next",
        },
        storage,
      }),
    ).toMatchObject({
      latestBuild: "20260621T121000Z-next",
      loadedBuild: FRONTEND_BUILD || "20260621T120000Z-current",
      updateAvailable: true,
    });
  });

  test("suppresses the same acknowledged frontend build after reload", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(LOADED_BUILD_KEY, "20260621T120000Z-current");
    storage.setItem(ACKNOWLEDGED_BUILD_KEY, "20260621T121000Z-next");

    expect(
      getFrontendUpdateState({
        metadata: {
          version: "0.1.0+20260621T121000Z-next",
          build: "20260621T121000Z-next",
        },
        storage,
      }),
    ).toMatchObject({ updateAvailable: false, buildsDiffer: true });
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
