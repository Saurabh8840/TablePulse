import { useEffect, useState } from 'react';
import { createSession, getSession } from '../services/ordering.js';

const skey = (slug, table) => `tp_session_${slug}_${table}`;
const cartKey = (slug, table) => `tp_cart_${slug}_${table}`;

/** Resolve (or create) the table session for this QR visit.
 *  Persists the token so refreshes and round-2 orders keep one bill.
 *  A stored CLOSED session is retired (token + stale cart dropped) and a
 *  fresh sitting starts — unless `reuseClosed` (order tracker history). */
export function useSession(slug, table, branchId, opts = {}) {
  const { reuseClosed = false } = opts;
  const [token, setToken] = useState(null);
  const [waiterName, setWaiterName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = localStorage.getItem(skey(slug, table));
        if (stored) {
          try {
            const existing = await getSession(stored);
            const status = existing.data?.status;
            if (status && status !== 'ACTIVE' && !reuseClosed) {
              // Sitting was closed (paid + waiter-closed) — retire it so the
              // customer starts fresh instead of seeing the old orders.
              localStorage.removeItem(skey(slug, table));
              try {
                localStorage.removeItem(cartKey(slug, table));
              } catch {
                // ignore
              }
            } else {
              if (alive) {
                setToken(stored);
                setWaiterName(existing.data?.waiterName ?? null);
                return;
              }
            }
          } catch {
            localStorage.removeItem(skey(slug, table));
          }
        }
        if (!branchId) throw new Error('This QR link is missing its branch. Please re-scan the table code.');
        const res = await createSession({ branchId, tableNumber: table });
        localStorage.setItem(skey(slug, table), res.data.sessionToken);
        if (alive) {
          setToken(res.data.sessionToken);
          setWaiterName(res.data?.waiterName ?? null);
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, table, branchId, reuseClosed]);

  return { token, waiterName, loading, error };
}
