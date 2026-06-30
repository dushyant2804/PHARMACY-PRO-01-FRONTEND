jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
  formatApiError: (error) => error?.message || "error",
}));

import api from "@/lib/api";
import { startPharmacyOSUpdate, UPDATE_MANUAL_FALLBACK_MESSAGE, UPDATE_STARTED_MESSAGE } from "./startUpdate";

describe("startPharmacyOSUpdate", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it("calls the backend start-update endpoint", async () => {
    api.post.mockResolvedValue({ data: { started: true } });

    await startPharmacyOSUpdate();

    expect(api.post).toHaveBeenCalledWith("/app/start-update");
  });

  it("returns the update started message on success", async () => {
    api.post.mockResolvedValue({ data: { started: true } });

    await expect(startPharmacyOSUpdate()).resolves.toMatchObject({
      status: "started",
      message: UPDATE_STARTED_MESSAGE,
      disableUpdateNow: true,
    });
  });

  it("shows a friendly duplicate/in-progress message", async () => {
    api.post.mockResolvedValue({ data: { started: false, in_progress: true, message: "Update already in progress." } });

    await expect(startPharmacyOSUpdate()).resolves.toMatchObject({
      status: "in-progress",
      message: "Update already in progress.",
      disableUpdateNow: true,
    });
  });

  it("shows manual fallback when backend fails", async () => {
    api.post.mockRejectedValue(new Error("network down"));

    await expect(startPharmacyOSUpdate()).resolves.toMatchObject({
      status: "failed",
      message: UPDATE_MANUAL_FALLBACK_MESSAGE,
    });
  });

  it("falls back to download_url when CLOUD_MODE or non-local mode is rejected", async () => {
    api.post.mockRejectedValue({ response: { status: 403, data: { detail: "not LOCAL_MODE" } } });

    await expect(startPharmacyOSUpdate({ downloadUrl: "https://example.test/download" })).resolves.toMatchObject({
      status: "open-download",
      openDownload: true,
    });
  });
});

describe("Update Center modal safety", () => {
  it("keeps Update Later wired to closeForLater without starting the update", () => {
    const fs = require("fs");
    const path = require("path");
    const source = fs.readFileSync(path.join(__dirname, "../components/UpdateCenter.jsx"), "utf8");
    expect(source).toContain('onClick={closeForLater}>Update Later');
    expect(source).not.toContain('onClick={updateNow}>Update Later');
  });
});
