import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import BrandPanel from '../../components/BrandPanel.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { RESTAURANT_CATEGORIES as OUTLET_TYPES } from '../../utils/restaurantMeta.js';

const CITIES = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Enter manually'];

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  if (pw.length >= 12) s += 1;
  return s;
}

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', businessName: '', phone: '',
    outletType: OUTLET_TYPES[0], city: CITIES[0], cityManual: '', agreed: false,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const pwScore = strength(form.password);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.agreed) {
      setError('Please accept the Merchant Terms to continue.');
      return;
    }
    setBusy(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        phone: form.phone || undefined,
      });
      await login({ email: form.email, password: form.password });
      navigate('/admin/restaurants');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>1</strong> Account Setup / Outlet Details / Menu Upload
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Chip size="small" label="Instant OTP Activated" color="success" sx={{ fontWeight: 700 }} />
      </Box>
        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <BrandPanel variant="register" />
          </Box>
          <Card sx={{ display: 'flex', alignItems: 'center', borderRadius: 2 }}>
            <CardContent sx={{ width: '100%', p: { xs: 3, sm: 4 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h4" component="h1" fontWeight={800} sx={{ flexGrow: 1 }}>
                  Open your restaurant
                </Typography>
                <Chip size="small" label="Step 1 of 3" color="info" sx={{ fontWeight: 700 }} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Get instant access to your digital menu builder, QR tables, and KDS.
              </Typography>
              <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2 }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Full Name" required value={form.fullName} onChange={set('fullName')} placeholder="e.g. Vikram Joshi" autoComplete="name" helperText="Primary Contact" />
                  <TextField label="WhatsApp / Phone" required value={form.phone} onChange={set('phone')} placeholder="98765 43210" autoComplete="tel" helperText="Instant OTP" />
                </div>
                <TextField label="Restaurant / Brand Name" required value={form.businessName} onChange={set('businessName')} placeholder="e.g. Spice Garden Bistro & Bar" autoComplete="organization" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Outlet Type" select value={form.outletType} onChange={set('outletType')}>
                    {OUTLET_TYPES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                  <TextField label="City / Region" select value={form.city} onChange={set('city')}>
                    {CITIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </div>
                {form.city === 'Enter manually' && (
                  <TextField label="City (type manually)" required value={form.cityManual ?? ''} onChange={set('cityManual')} placeholder="Enter your city" />
                )}
                <TextField label="Work Email" type="email" required value={form.email} onChange={set('email')} placeholder="owner@spicegarden.com" autoComplete="email" helperText="For Reports & GST Invoicing" />
                <TextField label="Create Password" type="password" required value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete="new-password" slotProps={{ htmlInput: { minLength: 8 } }} />
                {form.password && (
                  <Box>
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <Box key={i} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: i < pwScore ? 'success.main' : 'action.hover' }} />
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Min. 8 characters with letters & numbers · Strength: {pwScore >= 3 ? 'Strong' : pwScore === 2 ? 'Good' : 'Weak'}
                    </Typography>
                  </Box>
                )}
                <label style={{ display: 'flex', gap: 8, fontSize: 14, cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={form.agreed} onChange={set('agreed')} style={{ marginTop: 3 }} />
                  <span>I agree to TablePulse Merchant Terms, FSSAI compliance notices, and Indian GST privacy guidelines.</span>
                </label>
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ borderRadius: 2 }}>
                  {busy ? 'Creating your account…' : 'Create Restaurant Account →'}
                </Button>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Already registered? <RouterLink to="/login">Sign in to Captain / POS →</RouterLink>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </div>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, mt: 3 }}>
          {[
            ['Under 60s QR Scans', 'No guest app download needed'],
            ['3-Tap KOT Printing', 'Direct kitchen ticket routing'],
            ['Direct UPI Settlement', 'Instant money to your bank'],
            ['24/7 Desk Support', 'Hindi, English, Kannada, Tamil'],
          ].map(([t, b]) => (
            <Card key={t} sx={{ borderRadius: 2, textAlign: 'center' }}>
              <CardContent>
                <Typography variant="body2" fontWeight={800}>{t}</Typography>
                <Typography variant="caption" color="text.secondary">{b}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
    </Box>
  );
}
