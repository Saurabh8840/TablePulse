import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { createBranch, getRestaurant, listBranches, updateRestaurant } from '../../services/restaurant.js';

const EMPTY_BRANCH = { name: '', address: '', phone: '', openingTime: '', closingTime: '' };

export default function RestaurantDetail() {
  const { id } = useParams();
  const [rest, setRest] = useState(null);
  const [branches, setBranches] = useState(null);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState({ description: '', taxPercentage: '' });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [formError, setFormError] = useState(null);

  const load = () =>
    Promise.all([getRestaurant(id), listBranches(id)])
      .then(([r, b]) => {
        setRest(r.data);
        setBranches(b.data);
        setEdit({ description: r.data.description ?? '', taxPercentage: r.data.taxPercentage });
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSaveDetails(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateRestaurant(id, {
        description: edit.description,
        taxPercentage: Number(edit.taxPercentage) || 0,
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreateBranch(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await createBranch(id, {
        ...form,
        openingTime: form.openingTime || undefined,
        closingTime: form.closingTime || undefined,
      });
      setOpen(false);
      setForm(EMPTY_BRANCH);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!rest) return <CircularProgress />;

  return (
    <Box>
      <PageHeader
        title={rest.name}
        subtitle={`/${rest.slug} · ${rest.currency} · GST ${rest.taxPercentage}% · Service ${rest.serviceChargePercentage}%`}
        actions={
          <>
            <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} variant="text">
              All restaurants
            </Button>
            <Button component={RouterLink} to={`/admin/restaurants/${id}/menu`} variant="contained">
              Manage menu
            </Button>
          </>
        }
      />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' } }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Details
            </Typography>
            <Box component="form" onSubmit={onSaveDetails} sx={{ display: 'grid', gap: 2 }}>
              <TextField
                label="Description"
                multiline
                rows={3}
                value={edit.description}
                onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))}
              />
              <TextField
                label="GST %"
                type="number"
                value={edit.taxPercentage}
                onChange={(e) => setEdit((s) => ({ ...s, taxPercentage: e.target.value }))}
              />
              <Button type="submit" variant="outlined" disabled={saving}>
                {saving ? 'Saving…' : 'Save details'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Branches ({branches?.length ?? 0})
              </Typography>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
                Add branch
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              {(branches ?? []).map((b) => (
                <Box
                  key={b.id}
                  sx={{
                    p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.default',
                    display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'center' },
                  }}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      {b.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[b.address, b.phone, b.openingTime && b.closingTime ? `${b.openingTime}–${b.closingTime}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>
                  <Button component={RouterLink} to={`/admin/branches/${b.id}/tables`} size="small" variant="outlined">
                    Tables & QR
                  </Button>
                </Box>
              ))}
              {branches?.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No branches yet — add your first location.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add branch</DialogTitle>
        <Box component="form" onSubmit={onCreateBranch}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Branch name" required value={form.name} onChange={setF('name')} placeholder="Koramangala Branch" />
            <TextField label="Address" multiline rows={2} value={form.address} onChange={setF('address')} />
            <TextField label="Phone" value={form.phone} onChange={setF('phone')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <TextField label="Opens (HH:mm)" value={form.openingTime} onChange={setF('openingTime')} placeholder="11:00" />
              <TextField label="Closes (HH:mm)" value={form.closingTime} onChange={setF('closingTime')} placeholder="23:00" />
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
