import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Avatar,
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
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { createStaff, listStaff, setStaffActive } from '../../services/staff.js';

const ROLE_LABEL = { OWNER: 'Owner', MANAGER: 'Manager', WAITER: 'Waiter', KITCHEN_STAFF: 'Kitchen', PLATFORM_ADMIN: 'Platform' };
const ROLE_COLOR = { OWNER: 'primary', MANAGER: 'secondary', WAITER: 'info', KITCHEN_STAFF: 'warning' };

const EMPTY = { fullName: '', email: '', password: '', phone: '', role: 'KITCHEN_STAFF' };

export default function Staff() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => listStaff().then((r) => setRows(r.data)).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onCreate(e) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createStaff(form);
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(u) {
    try {
      await setStaffActive(u.userId, !u.active);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Staff"
        subtitle="Kitchen + waiter logins for your restaurants. They log in with email + password."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Add staff
          </Button>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {rows === null && <CircularProgress />}
      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon="👥"
          title="No staff yet"
          body="Add your first kitchen or waiter login — they will appear here."
          actionLabel="Add staff"
          onAction={() => setOpen(true)}
        />
      )}
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        {(rows ?? []).map((u) => (
          <Card key={u.userId} sx={{ opacity: u.active ? 1 : 0.6 }}>
            <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 800 }}>
                {u.fullName?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={800} noWrap>
                  {u.fullName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {u.email}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                  <Chip size="small" label={ROLE_LABEL[u.role] ?? u.role} color={ROLE_COLOR[u.role] ?? 'default'} />
                  {!u.active && <Chip size="small" label="Disabled" color="default" />}
                </Box>
              </Box>
              {(u.role === 'WAITER' || u.role === 'KITCHEN_STAFF' || u.role === 'MANAGER') && (
                <Button size="small" variant="text" color={u.active ? 'error' : 'primary'} onClick={() => onToggle(u)}>
                  {u.active ? 'Disable' : 'Enable'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add staff login</DialogTitle>
        <Box component="form" onSubmit={onCreate}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Full name" required value={form.fullName} onChange={set('fullName')} placeholder="Ravi Kumar" />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Email (login)" required type="email" value={form.email} onChange={set('email')} placeholder="ravi@cafezen.in" />
              <TextField label="Phone" value={form.phone} onChange={set('phone')} />
            </Box>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField label="Password (min 8)" required type="password" value={form.password}
                onChange={set('password')} slotProps={{ htmlInput: { minLength: 8 } }} />
              <TextField label="Role" select required value={form.role} onChange={set('role')}>
                <MenuItem value="KITCHEN_STAFF">🔥 Kitchen staff</MenuItem>
                <MenuItem value="WAITER">🧑‍🍳 Waiter</MenuItem>
                <MenuItem value="MANAGER">🧑‍💼 Manager</MenuItem>
              </TextField>
            </Box>
            <Typography variant="caption" color="text.secondary">
              They log in at /login with this email + password. Kitchen sees the KDS board; waiters will get their dashboard in Phase 5.
            </Typography>
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Creating…' : 'Create login'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
