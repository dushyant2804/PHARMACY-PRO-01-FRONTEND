import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const instance = axios.create({
  baseURL: API,
  withCredentials: true,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
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
