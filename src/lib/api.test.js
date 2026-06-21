jest.mock("axios", () => ({
  create: () => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }),
}));

import {
  API,
  API_MODE_STORAGE_KEY,
  LOCAL_API_URL_STORAGE_KEY,
  formatAuthError,
  getApiBaseUrl,
  getApiMode,
  setApiMode,
  setLocalBackendUrl,
} from "./api";

const apiError = (detail) => ({ response: { data: { detail } } });

beforeEach(() => {
  window.localStorage.removeItem(API_MODE_STORAGE_KEY);
  window.localStorage.removeItem(LOCAL_API_URL_STORAGE_KEY);
});

test("uses /api as the shared client base path when no backend URL is configured", () => {
  expect(API).toBe("/api");
});

test("keeps cloud mode on the existing API path by default", () => {
  expect(getApiMode()).toBe("cloud");
  expect(getApiBaseUrl()).toBe("/api");
});

test("can select a local backend while preserving the /api path suffix", () => {
  setLocalBackendUrl("http://localhost:9000/");
  setApiMode("local");

  expect(getApiMode()).toBe("local");
  expect(getApiBaseUrl()).toBe("http://localhost:9000/api");
});

describe("formatAuthError", () => {
  test.each([
    ["INVALID_OTP", "The OTP is invalid. Check the code and try again."],
    ["OTP_EXPIRED", "The OTP has expired. Request a new code and try again."],
    ["WEAK_PASSWORD", "The new password is too weak. Please use a stronger password."],
    ["incorrect_old_password", "The old password is incorrect."],
  ])("formats %s clearly", (detail, expected) => {
    expect(formatAuthError(apiError(detail))).toBe(expected);
  });

  test("preserves an unknown server error", () => {
    expect(formatAuthError(apiError("Account is locked"))).toBe("Account is locked");
  });
});
