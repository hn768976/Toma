import React, { createContext, useContext } from "react";
import { darkTheme, Theme } from "../theme";

const ThemeContext = createContext<Theme>(darkTheme);

export const ThemeProvider: React.FC<{
  theme: Theme;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
);

export const useTheme = (): Theme => useContext(ThemeContext);
