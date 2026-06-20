import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const themes = {
  classicPharmacyLight: { name: "Classic Pharmacy Light", mode: "Light", bg: "#f6fbf7", card: "rgba(255,255,255,.90)", border: "#cfe3d8", primary: "#087a5b", accent: "#c49a3a", text: "#10231d", muted: "#64756f", tableHeader: "#f0f5f2", activeTab: "#dff4eb" },
  mintGlass: { name: "Mint Glass", mode: "Light", bg: "#eefbf5", card: "rgba(255,255,255,.72)", border: "#bdebd8", primary: "#0f9f75", accent: "#77b255", text: "#0b2f26", muted: "#5a7b70", tableHeader: "#dcf8ec", activeTab: "#c7f2df" },
  warmIvory: { name: "Warm Ivory", mode: "Light", bg: "#fbf6ea", card: "rgba(255,252,246,.92)", border: "#e8dcc3", primary: "#7b5e26", accent: "#b7791f", text: "#2c2417", muted: "#7a6b55", tableHeader: "#f3ead7", activeTab: "#f4dfb7" },
  cleanBlue: { name: "Clean Blue", mode: "Light", bg: "#f3f8ff", card: "rgba(255,255,255,.92)", border: "#cfe0f5", primary: "#2563eb", accent: "#0ea5e9", text: "#102033", muted: "#607088", tableHeader: "#e7f0fb", activeTab: "#dbeafe" },
  paperLedger: { name: "Paper Ledger", mode: "Light", bg: "#f7f2e8", card: "#fffaf0", border: "#dfd3bd", primary: "#36513b", accent: "#9a6a2f", text: "#262014", muted: "#766a58", tableHeader: "#efe5d2", activeTab: "#eadcc2" },
  midnightPharmacy: { name: "Midnight Pharmacy", mode: "Dark", bg: "#06120f", card: "rgba(12,31,26,.92)", border: "#1f4b40", primary: "#34d399", accent: "#fbbf24", text: "#e7f7f1", muted: "#9bb8ae", tableHeader: "#10241f", activeTab: "#113d33" },
  charcoalGreen: { name: "Charcoal Green", mode: "Dark", bg: "#111816", card: "rgba(28,39,36,.94)", border: "#34463f", primary: "#6ee7b7", accent: "#a3e635", text: "#edf7f2", muted: "#aebdb6", tableHeader: "#202d29", activeTab: "#2c473d" },
  deepNavy: { name: "Deep Navy", mode: "Dark", bg: "#071427", card: "rgba(14,31,55,.94)", border: "#243b61", primary: "#60a5fa", accent: "#38bdf8", text: "#e9f2ff", muted: "#9fb3d0", tableHeader: "#10223d", activeTab: "#18345e" },
  slateProfessional: { name: "Slate Professional", mode: "Dark", bg: "#111827", card: "rgba(30,41,59,.94)", border: "#475569", primary: "#94a3b8", accent: "#22c55e", text: "#f8fafc", muted: "#cbd5e1", tableHeader: "#1e293b", activeTab: "#334155" },
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [themeKey, setThemeKey] = useState(localStorage.getItem("app-theme") || "classicPharmacyLight");
  const theme = useMemo(() => themes[themeKey] || themes.classicPharmacyLight, [themeKey]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appTheme = themeKey;
    root.dataset.themeMode = theme.mode.toLowerCase();
    Object.entries({
      "--pharmacy-bg": theme.bg,
      "--pharmacy-card": theme.card,
      "--pharmacy-border": theme.border,
      "--pharmacy-primary": theme.primary,
      "--pharmacy-accent": theme.accent,
      "--pharmacy-text": theme.text,
      "--pharmacy-muted": theme.muted,
      "--pharmacy-table-header": theme.tableHeader,
      "--pharmacy-active-tab": theme.activeTab,
      "--pharmacy-primary-soft": theme.activeTab,
      "--pharmacy-mint": theme.activeTab,
    }).forEach(([key, value]) => root.style.setProperty(key, value));
    localStorage.setItem("app-theme", themeKey);
  }, [theme, themeKey]);

  return <ThemeContext.Provider value={{ themeKey, setThemeKey, theme, themes }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
