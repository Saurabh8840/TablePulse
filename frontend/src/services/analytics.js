import { api } from './http.js';

// Owner/manager analytics APIs — JWT required, tenant scoped (Phase 7).
// Order history reuses services/kitchen.js searchOrders (GET /api/orders).

export const getDashboard = (branchId, restaurantId) => {
  const q = new URLSearchParams();
  if (branchId) q.set('branchId', branchId);
  if (restaurantId) q.set('restaurantId', restaurantId);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return api(`/api/analytics/dashboard${suffix}`);
};

export const getRevenue = ({ period = 'week', branchId, restaurantId, month } = {}) => {
  const q = new URLSearchParams({ period });
  if (branchId) q.set('branchId', branchId);
  if (restaurantId) q.set('restaurantId', restaurantId);
  if (month) q.set('month', month);
  return api(`/api/analytics/revenue?${q.toString()}`);
};

export const getTopItems = ({ limit = 5, branchId, restaurantId, date } = {}) => {
  const q = new URLSearchParams({ limit: String(limit) });
  if (branchId) q.set('branchId', branchId);
  if (restaurantId) q.set('restaurantId', restaurantId);
  if (date) q.set('date', date);
  return api(`/api/analytics/top-items?${q.toString()}`);
};

export const getRestaurantSummaries = () => api('/api/analytics/restaurants/summary');
