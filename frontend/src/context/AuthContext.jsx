import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { setAuthToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const clearExpiredSession = () => {
      setAuthToken(null);
      setUser(null);
    };
    window.addEventListener("teacherhub:auth-expired", clearExpiredSession);
    return () => window.removeEventListener("teacherhub:auth-expired", clearExpiredSession);
  }, []);

  // Re-read the signed-in user (name, photo…) WITHOUT the full-screen loading
  // state — used after the profile page saves, so the top bar updates at once.
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      /* keep the current user; the next real request will report a dead session */
    }
  }, []);

  async function login(email, password, twoFactorCode) {
    setError(null);
    setTwoFactorRequired(false);
    try {
      const { data } = await api.post("/auth/login", { email, password, twoFactorCode });
      setAuthToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.message);
      const requiresTwoFactor = err.response?.data?.code === "TWO_FACTOR_REQUIRED";
      setTwoFactorRequired(requiresTwoFactor);
      return { ok: false, requiresTwoFactor };
    }
  }

  async function qrLogin(qrCodeToken, twoFactorCode) {
    setError(null);
    try {
      const { data } = await api.post("/auth/qr-login", { qrCodeToken, twoFactorCode });
      setAuthToken(data.token);
      setUser(data.user);
      setTwoFactorRequired(false);
      return true;
    } catch (err) {
      setError(err.message);
      const requiresTwoFactor = err.response?.data?.code === "TWO_FACTOR_REQUIRED";
      setTwoFactorRequired(requiresTwoFactor);
      return { ok: false, requiresTwoFactor };
    }
  }

  async function logout() {
    let serverConfirmed = false;
    try {
      await api.post("/auth/logout");
      serverConfirmed = true;
    } catch (err) {
      // Always clear local credentials; callers can explain that revocation
      // could not be confirmed when the server was unreachable.
      serverConfirmed = err.response?.status === 401;
    } finally {
      // A lost connection must not leave the current screen looking signed in.
      setAuthToken(null);
      setUser(null);
    }
    return { ok: serverConfirmed };
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, twoFactorRequired, login, qrLogin, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
