import { Alert, Box, Button, Card, CardContent, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import BrandPanel from '../../components/BrandPanel.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', businessName: '', phone: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      await login({ email: form.email, password: form.password });
      // Brand-new owners start at restaurant setup, not an empty dashboard.
      navigate('/admin/restaurants');
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
            Open your restaurant on TablePulse
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Free to start. Menu, tables and QR codes live in one sitting.
          </Typography>
          <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2 }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Full name"
                required
                value={form.fullName}
                onChange={set('fullName')}
                placeholder="Aarav Sharma"
                autoComplete="name"
              />
              <TextField
                label="Phone (optional)"
                value={form.phone}
                onChange={set('phone')}
                placeholder="98765 43210"
                autoComplete="tel"
              />
            </div>
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
              label="Password (min 8 chars)"
              type="password"
              required
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              autoComplete="new-password"
              slotProps={{ htmlInput: { minLength: 8 } }}
            />
            <TextField
              label="Restaurant / business name"
              required
              value={form.businessName}
              onChange={set('businessName')}
              placeholder="Cafe Zen"
              autoComplete="organization"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Creating your account…' : 'Create account'}
            </Button>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Have an account? <RouterLink to="/login">Sign in</RouterLink>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </div>
  );
}
