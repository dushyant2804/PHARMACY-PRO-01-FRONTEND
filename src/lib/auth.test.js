jest.mock("./api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import api from "./api";
import { demoLoginRequest, loginRequest } from "./auth";

describe("authentication requests", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  test("normal login submits real-user credentials to /auth/login", () => {
    loginRequest("user@example.com", "secret");

    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "user@example.com",
      password: "secret",
    });
  });

  test("demo login calls /auth/demo-login without credentials", () => {
    demoLoginRequest();

    expect(api.post).toHaveBeenCalledWith("/auth/demo-login");
    expect(api.post).not.toHaveBeenCalledWith("/auth/login", expect.anything());
  });
});
