// Public customer APIs — session token, no login.

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

export const getPublicRestaurant = (slug) => pub(`/api/public/restaurants/${slug}`);
export const getPublicMenu = (slug) => pub(`/api/public/restaurants/${slug}/menu`);

export const createSession = (payload) => pub('/api/public/sessions', { method: 'POST', body: payload });
export const getSession = (token) => pub(`/api/public/sessions/${token}`);

export const placeOrder = (payload) => pub('/api/public/orders', { method: 'POST', body: payload });
export const getOrder = (id, token) => pub(`/api/public/orders/${id}?token=${encodeURIComponent(token)}`);
export const cancelOrder = (id, sessionToken, reason) =>
  pub(`/api/public/orders/${id}/cancel`, { method: 'POST', body: { sessionToken, reason } });
export const listSessionOrders = (token) => pub(`/api/public/sessions/${token}/orders`);
export const getBill = (token) => pub(`/api/public/sessions/${token}/bill`);
