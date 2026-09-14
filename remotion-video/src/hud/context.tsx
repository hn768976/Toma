import React, { createContext, useContext } from "react";
import type { HudTheme } from "./theme";

const ThemeContext = createContext<HudTheme | null>(null);

export const ThemeProvider: React.FC<{
  theme: HudTheme;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

export const useTheme = (): HudTheme => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("HUD components must be rendered inside a <ThemeProvider>");
  }
  return theme;
};
