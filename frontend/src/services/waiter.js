import { api } from './http.js';

// Phase 5 — waiter floor APIs (JWT required, tenant scoped).
// Order actions (search / mark served) live in services/kitchen.js and are shared.

export const getTableStatus = (branchId) => api(`/api/branches/${branchId}/tables/status`);

export const closeSession = (sessionId, force = false) =>
  api(`/api/sessions/${sessionId}/close${force ? '?force=true' : ''}`, { method: 'POST' });
