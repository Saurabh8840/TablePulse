// TablePulse auth API client (Phase 1).
// Token lives in localStorage under 'tablepulse_token'.

const TOKEN_KEY = 'tablepulse_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (!token) throw new Error('Not logged in (missing token)');
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Request failed: ${res.status}`);
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// Backend wraps success payloads as { success, message, data }
export async function registerOwner(payload) {
  return request('/api/auth/register', { method: 'POST', body: payload });
}

export async function login(payload) {
  const res = await request('/api/auth/login', { method: 'POST', body: payload });
  if (res?.data?.token) setToken(res.data.token);
  return res;
}

export async function fetchMe() {
  return request('/api/auth/me', { auth: true });
}

export async function updateMe(payload) {
  return request('/api/auth/me', { method: 'PUT', body: payload, auth: true });
}

export async function changePassword(payload) {
  return request('/api/auth/change-password', { method: 'POST', body: payload, auth: true });
}

export function logout() {
  setToken(null);
}
