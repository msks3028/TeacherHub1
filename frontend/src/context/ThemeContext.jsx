import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "th-theme";
const ThemeContext = createContext({ theme: "light", toggle: () => {}, setTheme: () => {} });

// localStorage can be blocked (private mode, embedded browsers) — never throw.
function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}
function systemPref() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }) {
  const [stored, setStored] = useState(readStored);
  const [system, setSystem] = useState(systemPref);

  // follow the OS until the user makes an explicit choice
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const onChange = (e) => setSystem(e.matches ? "dark" : "light");
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener?.(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener?.(onChange);
    };
  }, []);

  const theme = stored ?? system;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0B1020" : "#F7F4ED");
  }, [theme]);

  const setTheme = useCallback((t) => {
    setStored(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* not persisted — still applied for this session */
    }
  }, []);
  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
