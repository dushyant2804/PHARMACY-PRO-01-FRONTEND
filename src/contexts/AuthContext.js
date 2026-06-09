import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

const hasFlag = (data, keys) => keys.some((key) => data?.[key] === true || data?.user?.[key] === true);
const isPasswordExpired = (data) => hasFlag(data, ["password_expired", "passwordExpired"]);
const isDemoAccount = (data) => hasFlag(data, ["demo", "is_demo", "demo_mode", "read_only", "is_read_only", "readOnly", "readonly"]);
const getUser = (data) => {
  const user = data?.user && typeof data.user === "object" ? data.user : data;
  return user ? { ...user, demo_mode: isDemoAccount(data) } : user;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyAuthResponse = (data) => {
    setUser(getUser(data));
    setPasswordExpired(isPasswordExpired(data));
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    applyAuthResponse(data);
    return data;
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshUser();
      } catch {
        localStorage.removeItem("token");
        setUser(false);
        setPasswordExpired(false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("token", data.token);
    applyAuthResponse(data);
    return data;
  };

  const completePasswordChange = async () => {
    setPasswordExpired(false);
    try {
      await refreshUser();
    } catch {
      // The successful change-password response remains authoritative for this session.
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("token");
    setUser(false);
    setPasswordExpired(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, passwordExpired, completePasswordChange, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
