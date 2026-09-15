import { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const CartContext = createContext(null);

const key = (slug, table) => `tp_cart_${slug}_${table}`;

export function CartProvider({ slug, table, children }) {
  const [lines, setLines] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key(slug, table)) ?? '[]');
    } catch {
      return [];
    }
  });

  const persist = useCallback(
    (next) => {
      setLines(next);
      try {
        localStorage.setItem(key(slug, table), JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [slug, table],
  );

  const addLine = useCallback(
    (line) => persist([...lines, { ...line, key: `${Date.now()}-${Math.random().toString(36).slice(2)}` }]),
    [lines, persist],
  );

  const removeLine = useCallback((k) => persist(lines.filter((l) => l.key !== k)), [lines, persist]);

  const clear = useCallback(() => persist([]), [persist]);

  const totals = useMemo(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const amount = lines.reduce((n, l) => n + (l.unitPrice + l.modsTotal) * l.qty, 0);
    return { count, amount };
  }, [lines]);

  const value = useMemo(
    () => ({ lines, addLine, removeLine, clear, totals }),
    [lines, addLine, removeLine, clear, totals],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
