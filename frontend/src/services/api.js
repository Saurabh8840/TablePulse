// Central API client for TablePulse.
// Phase 0: only health check. Later: auth token, restaurant, menu, order APIs.

const API_BASE = ''; // uses Vite proxy '/api' -> http://localhost:8080

export async function getHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json();
}
