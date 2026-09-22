import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import BrandPanel from '../../components/BrandPanel.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { listRestaurants } from '../../services/restaurant.js';
import { homeForRole } from '../../utils/roles.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(form);
      const role = res.data?.user?.role;
      let dest = homeForRole(role);
      // First-time owners/managers land on restaurant setup, not a blank dashboard.
      if (role === 'OWNER' || role === 'MANAGER') {
        try {
          const list = await listRestaurants();
          if ((list.data ?? []).length === 0) dest = '/admin/restaurants';
        } catch {
          // Fall through to role home — the page will surface the error.
        }
      }
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
        <BrandPanel />
      </Box>
      <Card sx={{ display: 'flex', alignItems: 'center' }}>
        <CardContent sx={{ width: '100%', p: { xs: 3, sm: 4 } }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to run your floor, kitchen and billing.
          </Typography>
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label="Work email"
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="owner@cafezen.in"
              autoComplete="email"
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
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to dashboard'}
            </Button>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              New restaurant? <RouterLink to="/register">Create your account</RouterLink>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
}
