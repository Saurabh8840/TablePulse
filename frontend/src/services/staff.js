import { api } from './http.js';

export const listStaff = () => api('/api/staff');
export const createStaff = (payload) => api('/api/staff', { method: 'POST', body: payload });
export const setStaffActive = (id, active) => api(`/api/staff/${id}`, { method: 'PATCH', body: { active } });
