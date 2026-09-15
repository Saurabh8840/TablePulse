import { useCallback, useMemo, useState } from 'react';
import { ColorModeContext } from './color-mode-context.js';

const STORAGE_KEY = 'tablepulse-color-mode';

/** Owns light/dark state (plain React + localStorage) and hands the
 *  active mode string to the MUI ThemeProvider in main.jsx. */
export function ColorModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const setMode = useCallback((next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setModeState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage unavailable — theme still works for the session
    }
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const value = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // ignore
      }
      return value;
    });
  }, []);

  const value = useMemo(() => ({ mode, setMode, toggleMode }), [mode, setMode, toggleMode]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}
