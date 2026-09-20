import React, { createContext, useContext } from 'react';
import { THEMES, type Theme, type ThemeKey } from '../lib/palette';

const ThemeContext = createContext<Theme>(THEMES.standard);

/**
 * The provider is mounted INSIDE the three.js canvas (see Stage), because
 * React context does not cross from the DOM tree into the react-three-fiber
 * reconciler on its own.
 */
export const ThemeProvider: React.FC<{
  theme: ThemeKey;
  children: React.ReactNode;
}> = ({ theme, children }) => (
  <ThemeContext.Provider value={THEMES[theme]}>{children}</ThemeContext.Provider>
);

export const useTheme = () => useContext(ThemeContext);
export const usePalette = () => useContext(ThemeContext).palette;
