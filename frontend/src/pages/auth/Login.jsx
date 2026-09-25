import { Alert, Box, Button, Card, CardContent, Chip, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import BrandPanel from '../../components/BrandPanel.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listRestaurants } from '../../services/restaurant.js';
import { homeForRole } from '../../utils/roles.js';

const ROLE_TABS = [
  { label: 'Owner / Manager', roles: ['OWNER', 'MANAGER'], hint: 'Dashboard, outlets, revenue' },
  { label: 'Kitchen Display', roles: ['KITCHEN_STAFF'], hint: 'KDS tickets, 86-board' },
  { label: 'Waiter & Captain', roles: ['WAITER'], hint: 'Floor, serve, close' },
];

const TAB_KEY = 'tablepulse-login-tab';

function readTab() {
  try {
    const v = Number(localStorage.getItem(TAB_KEY));
    return v >= 0 && v < ROLE_TABS.length ? v : 0;
  } catch {
    return 0;
  }
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  if (pw.length >= 12) s += 1;
  return s;
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [roleTab, setRoleTab] = useState(readTab);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState(null); // { role, dest }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickTab = (i) => {
    setRoleTab(i);
    setMismatch(null);
    try {
      localStorage.setItem(TAB_KEY, String(i));
    } catch {
      // ignore
    }
  };

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  async function destFor(role) {
    let dest = homeForRole(role);
    if (role === 'OWNER' || role === 'MANAGER') {
      try {
        const list = await listRestaurants();
        if ((list.data ?? []).length === 0) dest = '/admin/restaurants';
      } catch {
        // fall through
      }
    }
    return dest;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setMismatch(null);
    setBusy(true);
    try {
      const res = await login(form);
      const role = res.data?.user?.role;
      if (!ROLE_TABS[roleTab].roles.includes(role)) {
        setMismatch({ role, dest: await destFor(role) });
        return;
      }
      navigate(await destFor(role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, justifyContent: 'flex-end' }}>
        <Chip size="small" label="POS v4.2 Live" color="success" sx={{ fontWeight: 700 }} />
      </Box>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <BrandPanel variant="login" />
          </Box>
          <Card sx={{ display: 'flex', alignItems: 'center', borderRadius: 2 }}>
            <CardContent sx={{ width: '100%', p: { xs: 3, sm: 4 } }}>
              <Typography variant="h4" component="h1" fontWeight={800}>
                Welcome back
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, mt: 0.5 }}>
                Sign in to access your outlet dashboard, live KDS, or captain roster.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, p: 0.5, borderRadius: 2, bgcolor: 'action.hover', mb: 1 }}>
                {ROLE_TABS.map((t, i) => (
                  <Button
                    key={t.label}
                    size="small"
                    variant={i === roleTab ? 'contained' : 'text'}
                    onClick={() => pickTab(i)}
                    sx={{ flex: 1, borderRadius: 2.5, fontWeight: 700 }}
                  >
                    {t.label}
                  </Button>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {ROLE_TABS[roleTab].hint}
              </Typography>
              {mismatch && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  action={
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const i = ROLE_TABS.findIndex((t) => t.roles.includes(mismatch.role));
                          if (i >= 0) pickTab(i);
                          setMismatch(null);
                        }}
                      >
                        Switch tab
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {
                          const { dest } = mismatch;
                          setMismatch(null);
                          navigate(dest, { replace: true });
                        }}
                      >
                        Continue to my board →
                      </Button>
                    </Box>
                  }
                >
                  This login belongs to a <strong>{mismatch.role}</strong> account — you&apos;re on the {ROLE_TABS[roleTab].label} tab.
                </Alert>
              )}
              <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2 }}>
                <TextField
                  label="Work Email or Phone"
                  type="text"
                  required
                  value={form.email}
                  onChange={set('email')}
                  placeholder="vikram@spicecraft.in or 9876543210"
                  autoComplete="email"
                  helperText="SMS OTP enabled"
                />
                <TextField
                  label="Password"
                  type="password"
                  required
                  value={form.password}
                  onChange={set('password')}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember this device for 30 days
                </label>
                {form.password && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <Box key={i} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: i < strength(form.password) ? 'success.main' : 'action.hover' }} />
                    ))}
                  </Box>
                )}
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ borderRadius: 2 }}>
                  {busy ? 'Signing in…' : 'Sign in to TablePulse →'}
                </Button>
                <Button variant="outlined" sx={{ borderRadius: 2 }} onClick={() => setError('Terminal/passcode login is coming soon — use email + password for now.')}>
                  Staff Passcode / Terminal Login
                </Button>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  New to TablePulse? <RouterLink to="/register">Register your restaurant (14-day free pilot)</RouterLink>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </div>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
          Cloud Sync · Priority Support +91 80 4719 2200 · UPI Intent Compliant · 256-Bit Encrypted
        </Typography>
    </Box>
  );
}
