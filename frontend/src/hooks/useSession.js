import { useEffect, useState } from 'react';
import { createSession, getSession } from '../services/ordering.js';

const skey = (slug, table) => `tp_session_${slug}_${table}`;

/** Resolve (or create) the table session for this QR visit.
 *  Persists the token so refreshes and round-2 orders keep one bill. */
export function useSession(slug, table, branchId) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = localStorage.getItem(skey(slug, table));
        if (stored) {
          try {
            await getSession(stored);
            if (alive) {
              setToken(stored);
              return;
            }
          } catch {
            localStorage.removeItem(skey(slug, table));
          }
        }
        if (!branchId) throw new Error('This QR link is missing its branch. Please re-scan the table code.');
        const res = await createSession({ branchId, tableNumber: table });
        localStorage.setItem(skey(slug, table), res.data.sessionToken);
        if (alive) setToken(res.data.sessionToken);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, table, branchId]);

  return { token, loading, error };
}
