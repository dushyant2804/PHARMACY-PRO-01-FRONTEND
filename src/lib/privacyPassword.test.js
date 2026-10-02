jest.mock("axios", () => ({
  create: () => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }),
}));

import {
  PRIVACY_PASSWORD_PATH,
  buildPrivacyPasswordPayload,
  formatPrivacyPasswordSaveError,
  savePrivacyPasswordRequest,
} from "./privacyPassword";

test("saves Privacy Password with PATCH through the shared API client", async () => {
  const apiClient = { patch: jest.fn().mockResolvedValue({ data: {} }) };

  await savePrivacyPasswordRequest(
    apiClient,
    "current-secret",
    "new-secret"
  );

  expect(apiClient.patch).toHaveBeenCalledWith(PRIVACY_PASSWORD_PATH, {
    current_password: "current-secret",
    new_password: "new-secret",
  });

  expect(
    buildPrivacyPasswordPayload("current-secret", "new-secret")
  ).toEqual({
    current_password: "current-secret",
    new_password: "new-secret",
  });
});

test("shows backend validation messages for Privacy Password save errors", () => {
  expect(
    formatPrivacyPasswordSaveError({
      response: { status: 422, data: { detail: "Privacy Password is too short" } },
    }),
  ).toBe("Privacy Password is too short");
});

test("shows authorization and network-specific Privacy Password save errors", () => {
  expect(formatPrivacyPasswordSaveError({ response: { status: 403, data: {} } })).toBe(
    "You are not authorized to update the Privacy Password. Sign in as an admin and try again.",
  );
  expect(formatPrivacyPasswordSaveError({ request: {}, message: "Network Error" })).toBe(
    "Network Error",
  );
});
