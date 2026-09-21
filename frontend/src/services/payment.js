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
  if (!res.ok) {
    // Backend validation errors carry a `fields` map (e.g. { customerPhone: "phone must be..." }) —
    // flatten it so the customer sees WHAT to fix instead of a bare "Validation failed".
    const fields = data?.fields;
    if (fields && typeof fields === 'object' && Object.keys(fields).length > 0) {
      const detail = Object.entries(fields)
        .map(([k, v]) => `${k} — ${v}`)
        .join('; ');
      throw new Error(`${data?.error ?? 'Validation failed'}: ${detail}`);
    }
    throw new Error(data?.error || data?.message || `Request failed: ${res.status}`);
  }
  return data;
}

export const confirmMockPayment = (sessionToken, method, extra = {}) =>
  pub('/api/public/payments/mock-confirm', {
    method: 'POST',
    body: { sessionToken, method, ...extra },
  });

export const payAtCounter = (sessionToken, extra = {}) =>
  pub('/api/public/payments/pay-at-counter', { method: 'POST', body: { sessionToken, ...extra } });

export const getPaymentStatus = (sessionToken) =>
  pub(`/api/public/payments/sessions/${encodeURIComponent(sessionToken)}/payment-status`);

// Staff payment APIs — JWT required, tenant scoped.
export const listPayments = ({ branchId, date, restaurantId } = {}) => {
  const q = new URLSearchParams();
  if (branchId) q.set('branchId', branchId);
  if (date) q.set('date', date);
  if (restaurantId) q.set('restaurantId', restaurantId);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return api(`/api/payments${suffix}`);
};

export const completeCashPayment = (id) => api(`/api/payments/${id}/complete`, { method: 'PATCH' });
