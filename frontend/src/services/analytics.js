import { api } from './http.js';

// Owner/manager analytics APIs — JWT required, tenant scoped (Phase 7).
// Order history reuses services/kitchen.js searchOrders (GET /api/orders).

export const getDashboard = (branchId) => {
  const q = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return api(`/api/analytics/dashboard${q}`);
};

export const getRevenue = ({ period = 'week', branchId, month } = {}) => {
  const q = new URLSearchParams({ period });
  if (branchId) q.set('branchId', branchId);
  if (month) q.set('month', month);
  return api(`/api/analytics/revenue?${q.toString()}`);
};

export const getTopItems = ({ limit = 5, branchId, date } = {}) => {
  const q = new URLSearchParams({ limit: String(limit) });
  if (branchId) q.set('branchId', branchId);
  if (date) q.set('date', date);
  return api(`/api/analytics/top-items?${q.toString()}`);
};
