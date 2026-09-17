// Public customer payment APIs — session token, no login. Mock only (Phase 6).

import { api } from './http.js';

async function pub(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Request failed: ${res.status}`);
  }
  if (!res.ok) throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
  return data;
}

export const confirmMockPayment = (sessionToken, method) =>
  pub('/api/public/payments/mock-confirm', { method: 'POST', body: { sessionToken, method } });

export const payAtCounter = (sessionToken) =>
  pub('/api/public/payments/pay-at-counter', { method: 'POST', body: { sessionToken } });

// Staff payment APIs — JWT required, tenant scoped.
export const listPayments = ({ branchId, date } = {}) => {
  const q = new URLSearchParams();
  if (branchId) q.set('branchId', branchId);
  if (date) q.set('date', date);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return api(`/api/payments${suffix}`);
};

export const completeCashPayment = (id) => api(`/api/payments/${id}/complete`, { method: 'PATCH' });
