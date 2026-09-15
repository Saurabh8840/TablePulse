// Shared HTTP client for TablePulse APIs.
// - JSON helper `api()` unwraps nothing (backend wraps as {success,message,data}).
// - `upload()` sends FormData (photo upload) with the JWT.
// - `blob()` fetches binary (QR PNG) with the JWT.

import { getToken } from './auth.js';

function errMessage(res, data) {
  return data?.error || data?.message || `Request failed: ${res.status}`;
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Request failed: ${res.status}`);
  }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (!token) throw new Error('Not logged in (missing token)');
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(res, data));
  return data;
}

export async function upload(path, file) {
  const token = getToken();
  if (!token) throw new Error('Not logged in (missing token)');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(res, data));
  return data;
}

export async function blob(path) {
  const token = getToken();
  if (!token) throw new Error('Not logged in (missing token)');
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.blob();
}
