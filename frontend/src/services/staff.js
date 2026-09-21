import { api } from './http.js';

// Fix 2: per-branch scoping. Pass branchId to only fetch that branch's staff
// (fresh restaurant/branch returns [] instead of other hotels' workers).
// restaurantId fetches all branches of one restaurant. No args = all (owner view).
export const listStaff = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.branchId) qs.set('branchId', params.branchId);
  else if (typeof params === 'string' && params) qs.set('branchId', params);
  if (params.restaurantId) qs.set('restaurantId', params.restaurantId);
  const q = qs.toString();
  return api(q ? `/api/staff?${q}` : '/api/staff');
};
export const createStaff = (payload) => api('/api/staff', { method: 'POST', body: payload });
export const setStaffActive = (id, active) => api(`/api/staff/${id}`, { method: 'PATCH', body: { active } });
export const setStaffTables = (id, tableIds) => api(`/api/staff/${id}`, { method: 'PATCH', body: { tableIds } });
export const moveStaffBranch = (id, branchId) => api(`/api/staff/${id}`, { method: 'PATCH', body: { branchId } });
