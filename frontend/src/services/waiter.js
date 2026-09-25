import { api } from './http.js';

// Phase 5 — waiter floor APIs (JWT required, tenant scoped).
// Order actions (search / mark served) live in services/kitchen.js and are shared.

export const getTableStatus = (branchId) => api(`/api/branches/${branchId}/tables/status`);

/**
 * Live occupancy across branches: a table counts as occupied when it has an
 * active session or live orders (displayStatus !== 'EMPTY').
 * Never count the static RestaurantTable.status column — it is manual-only
 * and nothing on the guest flow updates it.
 */
export const countOccupied = async (branchIds) => {
  let n = 0;
  await Promise.all(
    (branchIds ?? []).map(async (bid) => {
      try {
        const r = await getTableStatus(bid);
        n += (r.data ?? []).filter((t) => t.displayStatus && t.displayStatus !== 'EMPTY').length;
      } catch {
        // best effort per branch — a failed branch counts 0, never blocks
      }
    }),
  );
  return n;
};

export const closeSession = (sessionId, force = false) =>
  api(`/api/sessions/${sessionId}/close${force ? '?force=true' : ''}`, { method: 'POST' });
