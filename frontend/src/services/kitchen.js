import { api } from './http.js';

// Staff order APIs — JWT required, tenant scoped (Phase 3 OrderController).
// Used by the Kitchen Display (Phase 4) with polling.

export const searchOrders = ({ branchId, status, date, liveOnly } = {}) => {
  const q = new URLSearchParams();
  if (branchId) q.set('branchId', branchId);
  if (status) q.set('status', status);
  if (date) q.set('date', date);
  if (liveOnly) q.set('liveOnly', 'true');
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return api(`/api/orders${suffix}`);
};

export const getStaffOrder = (id) => api(`/api/orders/${id}`);

export const updateOrderStatus = (id, status, reason) =>
  api(`/api/orders/${id}/status`, { method: 'PATCH', body: reason ? { status, reason } : { status } });
