import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColorModeContext } from './color-mode-context.js';

const STORAGE_KEY = 'tablepulse-color-mode';

const systemDark = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

/** Owns light/dark/auto (plain React + localStorage). `mode` is always the
 *  resolved active scheme for MUI; `choice` is what the user picked. */
export function ColorModeProvider({ children }) {
  const [choice, setChoiceState] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'dark' || v === 'light' || v === 'auto' ? v : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [systemIsDark, setSystemIsDark] = useState(systemDark);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const mode = choice === 'auto' ? (systemIsDark ? 'dark' : 'light') : choice;

  const setMode = useCallback((next) => {
    const value = next === 'dark' || next === 'light' || next === 'auto' ? next : 'light';
    setChoiceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage unavailable — theme still works for the session
    }
  }, []);

  const toggleMode = useCallback(() => {
    setChoiceState((prevChoice) => {
      const resolved = prevChoice === 'auto' ? systemDark() : prevChoice;
      const value = resolved === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // ignore
      }
      return value;
    });
  }, []);

  const value = useMemo(() => ({ mode, choice, setMode, toggleMode }), [mode, choice, setMode, toggleMode]);

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}
