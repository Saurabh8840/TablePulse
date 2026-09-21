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

  const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Fix 4: same item + same modifiers + same note merge into one line.
  // 1 Small + 2 Large = 2 lines; adding Small again bumps Small to qty 2.
  const sameLine = (a, b) =>
    a.menuItemId === b.menuItemId &&
    (a.note ?? '') === (b.note ?? '') &&
    JSON.stringify((a.modifiers ?? []).map((m) => m.id).sort()) ===
      JSON.stringify((b.modifiers ?? []).map((m) => m.id).sort());

  const addLine = useCallback(
    (line) => {
      const qty = Math.max(1, Math.min(20, line.qty ?? 1));
      const incoming = { ...line, qty };
      const idx = lines.findIndex((l) => sameLine(l, incoming));
      if (idx >= 0) {
        const next = lines.map((l, i) =>
          i === idx ? { ...l, qty: Math.min(20, l.qty + qty) } : l,
        );
        persist(next);
      } else {
        persist([...lines, { ...incoming, key: newKey() }]);
      }
    },
    [lines, persist],
  );

  const addLines = useCallback(
    (arr) => {
      let next = [...lines];
      for (const raw of arr ?? []) {
        const qty = Math.max(1, Math.min(20, raw.qty ?? 1));
        const incoming = { ...raw, qty };
        const idx = next.findIndex((l) => sameLine(l, incoming));
        if (idx >= 0) {
          next = next.map((l, i) =>
            i === idx ? { ...l, qty: Math.min(20, l.qty + qty) } : l,
          );
        } else {
          next = [...next, { ...incoming, key: newKey() }];
        }
      }
      persist(next);
    },
    [lines, persist],
  );

  const updateQty = useCallback(
    (k, qty) => {
      if (qty <= 0) {
        persist(lines.filter((l) => l.key !== k));
        return;
      }
      persist(lines.map((l) => (l.key === k ? { ...l, qty: Math.max(1, Math.min(20, qty)) } : l)));
    },
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
    () => ({ lines, addLine, addLines, updateQty, removeLine, clear, totals }),
    [lines, addLine, addLines, updateQty, removeLine, clear, totals],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
