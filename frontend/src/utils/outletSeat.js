/** Seat display name: restaurant name, suffixed so owners spot shared logins. */
export function seatName(outletName, branchName) {
  const base = branchName && branchName !== outletName ? `${outletName} — ${branchName}` : outletName;
  return `${base} (Outlet Seat)`;
}

/** Strong 12-char secret shown exactly once (never stored, never returned). */
export function randomSeatPassword() {
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
  return Array.from(buf, (n) => chars[n % chars.length]).join('');
}

/**
 * Shared restaurant seat: branch-pinned MANAGER flagged at creation.
 * Legacy generated seats (pre-real-email era) match by their old domain.
 */
export function isOutletSeat(u) {
  if (!u || u.role !== 'MANAGER' || !u.branchId) return false;
  if (u.seat === true) return true;
  return String(u.email ?? '').toLowerCase().endsWith('@outlets.tablepulse.local');
}
