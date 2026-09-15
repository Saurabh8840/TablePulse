import { api, blob } from './http.js';

export const listTables = (branchId) => api(`/api/branches/${branchId}/tables`);
export const createTable = (branchId, payload) =>
  api(`/api/branches/${branchId}/tables`, { method: 'POST', body: payload });
export const bulkCreateTables = (branchId, payload) =>
  api(`/api/branches/${branchId}/tables/bulk`, { method: 'POST', body: payload });
export const bulkDeleteTables = (branchId, tableIds) =>
  api(`/api/branches/${branchId}/tables/bulk-delete`, { method: 'POST', body: { tableIds } });
export const updateTable = (id, payload) => api(`/api/tables/${id}`, { method: 'PUT', body: payload });
export const assignTableWaiter = (id, assignedWaiterId) =>
  api(`/api/tables/${id}/assignment`, { method: 'PUT', body: { assignedWaiterId } });
export const deactivateTable = (id) => api(`/api/tables/${id}`, { method: 'DELETE' });
export const fetchQrPng = (id) => blob(`/api/tables/${id}/qr-code`);
