jest.mock("axios", () => ({
  create: () => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }),
}));

import { API, formatAuthError } from "./api";

const apiError = (detail) => ({ response: { data: { detail } } });

test("uses /api as the shared client base path when no backend URL is configured", () => {
  expect(API).toBe("/api");
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
