import api from "./api";

export const loginRequest = (email, password) =>
  api.post("/auth/login", { email, password });

export const demoLoginRequest = () => api.post("/auth/demo-login");
