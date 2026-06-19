import { formatApiError } from "./api";

export const PRIVACY_PASSWORD_PATH = "/settings/privacy-password";
export const PRIVACY_PASSWORD_PAYLOAD_FIELD = "privacy_password";

export const buildPrivacyPasswordPayload = (value) => ({
  [PRIVACY_PASSWORD_PAYLOAD_FIELD]: value,
});

export const savePrivacyPasswordRequest = (apiClient, value) =>
  apiClient.patch(PRIVACY_PASSWORD_PATH, buildPrivacyPasswordPayload(value));

export function formatPrivacyPasswordSaveError(error) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    return "You are not authorized to update the Privacy Password. Sign in as an admin and try again.";
  }
  if (status === 400 || status === 422) {
    return formatApiError(error);
  }
  if (error?.response) {
    return formatApiError(error);
  }
  if (error?.request || error?.message === "Network Error") {
    return "Network Error";
  }
  return formatApiError(error);
}
