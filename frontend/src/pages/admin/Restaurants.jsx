import AddIcon from '@mui/icons-material/Add';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { createRestaurant, listRestaurants } from '../../services/restaurant.js';

const EMPTY = { name: '', description: '', currency: 'INR', taxPercentage: 5, serviceChargePercentage: 0 };

export default function Restaurants() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () =>
    listRestaurants()
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createRestaurant({
        ...form,
        taxPercentage: Number(form.taxPercentage) || 0,
        serviceChargePercentage: Number(form.serviceChargePercentage) || 0,
      });
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Restaurants"
        subtitle="One owner, many restaurants — each fully isolated."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            New restaurant
          </Button>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {rows === null && <CircularProgress />}
      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon="🍽️"
          title="No restaurants yet"
          body="Create your first restaurant, then add branches, tables and a menu."
          actionLabel="Create restaurant"
          onAction={() => setOpen(true)}
        />
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        {(rows ?? []).map((r) => (
          <Card key={r.id} sx={{ height: '100%', '&:hover': { boxShadow: 4 } }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <StorefrontIcon color="primary" />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  <RouterLink to={`/admin/restaurants/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {r.name}
                  </RouterLink>
                </Typography>
                {!r.active && <Chip size="small" label="Inactive" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', mb: 1 }}>
                /{r.slug} · {r.currency} · GST {r.taxPercentage}%
              </Typography>
              {r.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {r.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button component={RouterLink} to={`/admin/restaurants/${r.id}`} size="small" variant="outlined">
                  Manage
                </Button>
                <Button component={RouterLink} to={`/admin/restaurants/${r.id}/menu`} size="small" variant="text">
                  Menu
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New restaurant</DialogTitle>
        <Box component="form" onSubmit={onCreate}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Name" required value={form.name} onChange={set('name')} placeholder="Cafe Zen" />
            <TextField label="Description" multiline rows={2} value={form.description} onChange={set('description')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
              <TextField label="Currency" value={form.currency} onChange={set('currency')} slotProps={{ htmlInput: { maxLength: 3 } }} />
              <TextField label="GST %" type="number" value={form.taxPercentage} onChange={set('taxPercentage')} />
              <TextField label="Service %" type="number" value={form.serviceChargePercentage} onChange={set('serviceChargePercentage')} />
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
