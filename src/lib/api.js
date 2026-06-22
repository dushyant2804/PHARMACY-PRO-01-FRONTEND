import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const LOCAL_BACKEND_URL = process.env.REACT_APP_LOCAL_BACKEND_URL || "http://localhost:8000";
export const API_MODE_STORAGE_KEY = "pharmacyos_api_mode";
export const LOCAL_API_URL_STORAGE_KEY = "pharmacyos_local_api_url";
export const SLOW_API_CALLS_STORAGE_KEY = "pharmacyos_slow_api_calls";
export const SLOW_API_THRESHOLD_MS = 900;

const hasBrowserStorage = () => typeof window !== "undefined" && window.localStorage;

export function getApiMode() {
  if (!hasBrowserStorage()) return "cloud";
  return window.localStorage.getItem(API_MODE_STORAGE_KEY) === "local" ? "local" : "cloud";
}

export function getLocalBackendUrl() {
  if (!hasBrowserStorage()) return LOCAL_BACKEND_URL;
  return window.localStorage.getItem(LOCAL_API_URL_STORAGE_KEY) || LOCAL_BACKEND_URL;
}

export function getApiBaseUrl(mode = getApiMode()) {
  if (mode === "local") return `${getLocalBackendUrl().replace(/\/$/, "")}/api`;
  return BACKEND_URL ? `${BACKEND_URL}/api` : "/api";
}

export function isLocalApiUrl(url = getApiBaseUrl("local")) {
  try {
    const parsed = new URL(url, window.location.origin);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function getSlowApiCalls() {
  if (!hasBrowserStorage()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(SLOW_API_CALLS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function rememberSlowApiCall(entry) {
  if (!hasBrowserStorage()) return;
  const next = [entry, ...getSlowApiCalls()].slice(0, 25);
  window.localStorage.setItem(SLOW_API_CALLS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("pharmacyos:slow-api-calls-updated", { detail: next }));
}

export function setApiMode(mode) {
  if (!hasBrowserStorage()) return getApiBaseUrl(mode);
  window.localStorage.setItem(API_MODE_STORAGE_KEY, mode === "local" ? "local" : "cloud");
  return getApiBaseUrl(mode);
}

export function setLocalBackendUrl(url) {
  const nextUrl = (url || LOCAL_BACKEND_URL).trim().replace(/\/$/, "");
  if (hasBrowserStorage()) window.localStorage.setItem(LOCAL_API_URL_STORAGE_KEY, nextUrl);
  return nextUrl;
}

export const API = getApiBaseUrl();

const instance = axios.create({
  baseURL: API,
  withCredentials: true,
});

instance.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  config.metadata = { ...(config.metadata || {}), startedAt: performance.now() };
  if (getApiMode() === "local" && !isLocalApiUrl(config.baseURL)) {
    throw new Error(`Local Mode blocked non-local API base: ${config.baseURL}`);
  }
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (response) => {
    const durationMs = Math.round(performance.now() - (response.config?.metadata?.startedAt || performance.now()));
    if (durationMs >= SLOW_API_THRESHOLD_MS) {
      rememberSlowApiCall({
        method: String(response.config?.method || "GET").toUpperCase(),
        url: response.config?.url || "—",
        baseURL: response.config?.baseURL || "—",
        durationMs,
        status: response.status,
        at: new Date().toISOString(),
      });
    }
    return response;
  },
  (error) => {
    if (error?.config?.metadata?.startedAt) {
      const durationMs = Math.round(performance.now() - error.config.metadata.startedAt);
      if (durationMs >= SLOW_API_THRESHOLD_MS) {
        rememberSlowApiCall({
          method: String(error.config?.method || "GET").toUpperCase(),
          url: error.config?.url || "—",
          baseURL: error.config?.baseURL || "—",
          durationMs,
          status: error.response?.status || "network",
          at: new Date().toISOString(),
        });
      }
    }
    const authFormEndpoints = [
      "/auth/login",
      "/auth/demo-login",
      "/auth/forgot-password",
      "/auth/verify-otp",
      "/auth/reset-password",
      "/auth/change-password",
    ];
    const isAuthFormRequest = authFormEndpoints.some((endpoint) =>
      error?.config?.url?.endsWith(endpoint)
    );

    if (getApiMode() === "local" && !error?.response && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pharmacyos:local-backend-disconnected"));
    }

    if (error?.response?.status === 401 && !isAuthFormRequest) {
      localStorage.removeItem("token");
      window.location.hash = "#/login";
    }
    return Promise.reject(error);
  }
);

export default instance;

export function formatApiError(err) {
  const response = err?.response?.data;
  const detail = response?.detail ?? response?.message ?? response?.error ?? response?.code;
  if (detail == null) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" ");
  return String(detail);
}

export function formatAuthError(err, fallback = "Authentication request failed.") {
  const raw = formatApiError(err);
  const value = raw.toLowerCase().replace(/[ _-]+/g, " ");

  if (value.includes("invalid") && value.includes("otp")) return "The OTP is invalid. Check the code and try again.";
  if ((value.includes("expired") || value.includes("expire")) && value.includes("otp")) return "The OTP has expired. Request a new code and try again.";
  if (value.includes("weak") && value.includes("password")) return "The new password is too weak. Please use a stronger password.";
  if ((value.includes("old") || value.includes("current")) && value.includes("password") && (value.includes("incorrect") || value.includes("invalid") || value.includes("wrong"))) {
    return "The old password is incorrect.";
  }

  return raw === "Something went wrong" ? fallback : raw;
}

export function fmtINR(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(s) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}
