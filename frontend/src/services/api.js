import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // send the httpOnly auth cookie
});

// Also attach bearer token from memory (kept in AuthContext) as a fallback
let inMemoryToken = null;
export function setAuthToken(token) {
  inMemoryToken = token;
}

api.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

// Centralized error normalization so every screen gets a real message
// instead of an unhandled rejection / blank screen.
api.interceptors.response.use(
  (res) => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("teacherhub:api-online"));
    return res;
  },
  (error) => {
    if (typeof window !== "undefined" && !error.response) {
      window.dispatchEvent(new Event("teacherhub:network-error"));
    }
    const requestPath = String(error.config?.url || "");
    if (typeof window !== "undefined" && error.response?.status === 401 && !/\/auth\/(?:login|qr-login)(?:\?|$)/.test(requestPath)) {
      window.dispatchEvent(new Event("teacherhub:auth-expired"));
    }
    const message =
      error.response?.data?.message || "Unable to reach the server. Please check your connection and try again.";
    return Promise.reject({ ...error, message });
  }
);

export default api;
