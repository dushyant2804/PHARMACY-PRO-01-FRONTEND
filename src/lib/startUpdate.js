import api, { formatApiError } from "@/lib/api";

export const UPDATE_STARTING_MESSAGE = "Starting update...";
export const UPDATE_STARTED_MESSAGE = "Update started. PharmacyOS will restart after update.";
export const UPDATE_MANUAL_FALLBACK_MESSAGE = "Could not start automatic update. Please run Update-PharmacyOS.bat manually.";
export const UPDATE_SAVE_WARNING = "Please save any current bill or purchase entry before updating.";
export const UPDATE_RESTART_WARNING = "The app may close and reopen during update.";

const normalizeText = (value) => String(value || "").toLowerCase();

export const isUpdateAlreadyInProgress = (payload = {}) => {
  const message = normalizeText(payload.message || payload.detail || payload.error || payload.code || payload.status);
  return Boolean(payload.in_progress || payload.inProgress || payload.already_running || payload.alreadyRunning || message.includes("in progress") || message.includes("already"));
};

export const isLocalModeRejection = (errorOrPayload = {}) => {
  const payload = errorOrPayload?.response?.data || errorOrPayload;
  const status = errorOrPayload?.response?.status;
  const message = normalizeText(payload?.detail || payload?.message || payload?.error || payload?.code || errorOrPayload?.message);
  return Boolean(status === 403 || status === 409 || message.includes("local_mode") || message.includes("local mode") || message.includes("not local"));
};

export const friendlyUpdateInProgressMessage = (payload = {}) => (
  payload.message || payload.detail || "An update is already in progress. PharmacyOS will restart after update."
);

export async function startPharmacyOSUpdate({ downloadUrl = "" } = {}) {
  try {
    const { data = {} } = await api.post("/app/start-update");
    if (data.started === true) {
      return { status: "started", message: data.message || UPDATE_STARTED_MESSAGE, disableUpdateNow: true };
    }
    if (isUpdateAlreadyInProgress(data)) {
      return { status: "in-progress", message: friendlyUpdateInProgressMessage(data), disableUpdateNow: true };
    }
    if (isLocalModeRejection(data) && downloadUrl) {
      return { status: "open-download", message: data.message || "Automatic update is only available in Local Mode. Opening the download instead.", openDownload: true };
    }
    return { status: "failed", message: data.message || data.detail || UPDATE_MANUAL_FALLBACK_MESSAGE, canOpenDownload: Boolean(downloadUrl) };
  } catch (error) {
    if (isLocalModeRejection(error) && downloadUrl) {
      return { status: "open-download", message: "Automatic update is only available in Local Mode. Opening the download instead.", openDownload: true };
    }
    return { status: "failed", message: UPDATE_MANUAL_FALLBACK_MESSAGE, detail: formatApiError(error), canOpenDownload: Boolean(downloadUrl) };
  }
}
