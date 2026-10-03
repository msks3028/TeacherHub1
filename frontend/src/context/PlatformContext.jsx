import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { applyBrand } from "../lib/theme";

const PlatformContext = createContext({ settings: null, name: "TeacherHub", refresh: () => {} });

/**
 * Loads the teacher's saved branding once, applies the colours as CSS
 * variables (so every screen restyles without a rebuild) and shares the name /
 * logo with the layout and login page. `refresh()` re-applies after the
 * Appearance page saves, so changes show instantly.
 */
export function PlatformProvider({ children }) {
  const [settings, setSettings] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      const s = data.settings;
      if (!s) return;
      setSettings(s);
      applyBrand(s.primaryColor, s.sidebarColor);
      if (s.platformName) document.title = s.platformName;
      if (s.faviconUrl) {
        let link = document.querySelector('link[rel="icon"]');
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.removeAttribute("type");
        link.href = s.faviconUrl;
      }
    } catch {
      /* branding is cosmetic — silently keep the built-in identity */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ settings, name: settings?.platformName || "TeacherHub", refresh }),
    [settings, refresh]
  );
  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export const usePlatform = () => useContext(PlatformContext);
