jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  formatApiError: (error) => error?.message || "error",
}));

import api from "@/lib/api";
import { fetchUpdateCenterMetadata } from "./UpdateCenter";

describe("Update Center update-check handling", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('calls exactly GET /api/update-check and shows "You are up to date" state when update_available is false', async () => {
    api.get.mockResolvedValue({ status: 200, data: { status: "ok", latest_version: "1.0.0", update_available: false } });

    const metadata = await fetchUpdateCenterMetadata();

    expect(api.get).toHaveBeenCalledWith("/api/update-check", { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
    expect(metadata).toMatchObject({ updateAvailable: false, unavailable: false, latestVersion: "1.0.0" });
  });

  it("trusts update_available true so the Update Center can open the update popup", async () => {
    api.get.mockResolvedValue({ status: 200, data: { status: "ok", latest_version: "1.1.0", latest_build: "110", update_available: true, release_notes: ["Ready"] } });

    const metadata = await fetchUpdateCenterMetadata();

    expect(metadata).toMatchObject({ updateAvailable: true, unavailable: false, latestVersion: "1.1.0", latestBuild: "110" });
    expect(metadata.releaseNotes.improved).toEqual(["Ready"]);
  });

  it('returns unavailable metadata only when backend status is "unavailable"', async () => {
    api.get.mockResolvedValue({ status: 200, data: { status: "unavailable" } });

    await expect(fetchUpdateCenterMetadata()).resolves.toMatchObject({ unavailable: true, updateAvailable: false });
  });

  it('throws so UI shows "Update check unavailable" on network/API failure or non-200 response', async () => {
    api.get.mockRejectedValueOnce(new Error("network down"));
    await expect(fetchUpdateCenterMetadata()).rejects.toThrow("network down");

    api.get.mockResolvedValueOnce({ status: 503, data: { status: "ok" } });
    await expect(fetchUpdateCenterMetadata()).rejects.toThrow("503");
  });
});
