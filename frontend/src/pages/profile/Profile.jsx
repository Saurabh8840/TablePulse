import LogoutIcon from '@mui/icons-material/Logout';
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
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useColorMode } from '../../hooks/useColorMode.js';
import { changePassword, updateMe } from '../../services/auth.js';
import {
  SOUNDBOX_LANGS,
  getChime,
  getHaptics,
  getSoundboxLang,
  setChimePref,
  setHapticsPref,
  setSoundboxLangPref,
} from '../../utils/devicePrefs.js';

const ROLE_LABEL = { OWNER: 'Owner', MANAGER: 'Manager', WAITER: 'Waiter', KITCHEN_STAFF: 'Kitchen Staff', PLATFORM_ADMIN: 'Platform Admin' };
const LANGS = ['English (India)', 'Hindi', 'Kannada'];
const LANG_KEY = 'tablepulse-lang';

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

function readLang() {
  try {
    return localStorage.getItem(LANG_KEY) ?? LANGS[0];
  } catch {
    return LANGS[0];
  }
}

const memberSince = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  } catch {
    return '—';
  }
};

const staffIdOf = (userId) => {
  const hex = String(userId ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return hex ? `TP-${hex}` : '—';
};

const initialsOf = (name) =>
  String(name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export default function Profile() {
  const { user, loading, logout, refresh } = useAuth();
  const { choice, setMode } = useColorMode();
  const navigate = useNavigate();
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);

  const [chime, setChime] = useState(getChime);
  const [haptics, setHaptics] = useState(getHaptics);
  const [lang, setLang] = useState(readLang);
  const [sbLang, setSbLang] = useState(getSoundboxLang);

  // Refresh from the server so edits elsewhere never show stale.
  useEffect(() => {
    if (user && !fresh) {
      refresh()
        .then(() => setFresh(true))
        .catch(() => setFresh(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) return <CircularProgress />;
  if (!user) return <Navigate to="/login" replace />;

  const openEdit = () => {
    setEditForm({ fullName: user.fullName ?? '', phone: user.phone ?? '' });
    setEditError(null);
    setEditOpen(true);
  };

  async function onSaveEdit(e) {
    e.preventDefault();
    setEditError(null);
    setEditBusy(true);
    try {
      await updateMe({ fullName: editForm.fullName.trim(), phone: editForm.phone.trim() || null });
      await refresh();
      setEditOpen(false);
      setToast('Profile updated.');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPwError(null);
    setPwBusy(true);
    try {
      await changePassword(pwForm);
      setPwOpen(false);
      setPwForm({ currentPassword: '', newPassword: '' });
      setToast('Password changed.');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  function onExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'TablePulse profile (this device)',
      user: {
        userId: user.userId,
        staffId: staffIdOf(user.userId),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active,
        tenantId: user.tenantId,
        branchId: user.branchId,
        branchName: user.branchName,
        restaurantId: user.restaurantId,
        restaurantName: user.restaurantName,
        createdAt: user.createdAt ?? null,
      },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tablepulse-profile.json';
    a.click();
    URL.revokeObjectURL(url);
    setToast('Account data downloaded.');
  }

  function onLogout() {
    logout();
    navigate('/login');
  }

  const outletLine = user.branchName
    ? `${user.restaurantName ?? ''} · ${user.branchName}`.replace(/^ · /, '')
    : (user.restaurantName ?? 'All outlets');
  const scoped = user.branchId ? 'Locked to home outlet' : 'Full tenant access';

  return (
    <Box sx={{ overflowX: 'clip' }}>
      {/* breadcrumb */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Box>
          <Typography variant="body2" fontSize={12} color="text.secondary">
            Account <strong style={{ color: '#9B2F00' }}>› User Profile</strong>
          </Typography>
          <Typography variant="h4" fontWeight={800} fontSize={28}>
            Universal Profile & Preferences
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Sym name="file_download" size={18} />} onClick={onExport} sx={{ borderRadius: 2, fontWeight: 700, alignSelf: 'flex-start' }}>
          Export Account Data
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* identity card */}
      <Card sx={{ borderRadius: 2, mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 }, display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', minWidth: 0 }}>
            <Avatar sx={{ bgcolor: '#9B2F00', width: 96, height: 96, borderRadius: 2, fontWeight: 800, fontSize: 34 }}>
              {initialsOf(user.fullName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={800} fontSize={28}>
                  {user.fullName}
                </Typography>
                <Chip size="small" label={ROLE_LABEL[user.role] ?? user.role} color="primary" sx={{ fontWeight: 800, fontSize: 10 }} />
                <Chip
                  size="small"
                  icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: user.active ? '#00632B' : '#8D7168', ml: 1 }} />}
                  label={user.active ? 'Active' : 'Disabled'}
                  sx={{ bgcolor: user.active ? 'rgba(17,126,59,.1)' : '#EEE7E3', color: user.active ? '#00632B' : 'text.secondary', fontWeight: 800, fontSize: 10 }}
                />
              </Box>
              <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mt: 0.75, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <span>Staff ID: {staffIdOf(user.userId)}</span>
                <span>{outletLine || '—'}</span>
                <span>Member since {memberSince(user.createdAt)}</span>
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Sym name="edit" size={18} />} onClick={openEdit} sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
              Edit Profile Details
            </Button>
            <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={onLogout} sx={{ borderRadius: 2, fontWeight: 700 }}>
              Log Out
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, '& > *': { minWidth: 0 } }}>
        {/* personal */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Sym name="person" size={20} /> Personal & Contact Info
              </Typography>
              <Button size="small" onClick={openEdit} sx={{ fontWeight: 800, color: '#9B2F00' }}>
                Edit ›
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {[
                ['Full Legal Name', user.fullName],
                ['Email Address', user.email],
                ['Phone Number', user.phone || '—'],
              ].map(([l, v]) => (
                <Box key={l} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
                  <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.06em', display: 'block' }}>
                    {l}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} fontSize={14} noWrap>{v}</Typography>
                </Box>
              ))}
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
                <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', mb: 0.5 }}>
                  Display Language · this device
                </Typography>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={lang}
                  onChange={(e) => {
                    setLang(e.target.value);
                    try {
                      localStorage.setItem(LANG_KEY, e.target.value);
                    } catch {
                      // ignore
                    }
                    setToast('Language saved on this device.');
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
                >
                  {LANGS.map((l) => (
                    <MenuItem key={l} value={l}>{l}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* security */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Sym name="shield" size={20} /> Security & Authentication
              </Typography>
              <Chip size="small" label="Protected" sx={{ bgcolor: 'rgba(17,126,59,.1)', color: '#00632B', fontWeight: 800, fontSize: 10 }} />
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: '#fff', color: '#9B2F00', borderRadius: 2, width: 40, height: 40 }}>
                    <Sym name="password" size={20} />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>Password & OTP Login</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">Email + password sign-in</Typography>
                  </Box>
                </Box>
                <Button size="small" variant="outlined" onClick={() => { setPwForm({ currentPassword: '', newPassword: '' }); setPwError(null); setPwOpen(true); }} sx={{ borderRadius: 2, fontWeight: 800 }}>
                  Update
                </Button>
              </Box>
              {[
                ['Quick Terminal PIN', 'Server PIN login is not available yet.'],
                ['Two-Factor Authentication', 'Authenticator-based 2FA is not available yet.'],
                ['Active Sessions', 'Other-device sign-out is not available yet.'],
              ].map(([t, b]) => (
                <Box key={t} sx={{ p: 1.75, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between', opacity: 0.85 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: '#fff', color: 'text.secondary', borderRadius: 2, width: 40, height: 40 }}>
                      <Sym name="phonelink_lock" size={20} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={800} fontSize={14}>{t}</Typography>
                      <Typography variant="caption" fontSize={10} color="text.secondary">{b}</Typography>
                    </Box>
                  </Box>
                  <Chip size="small" label="Coming soon" sx={{ fontSize: 10, fontWeight: 800 }} />
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* outlet & role */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Sym name="admin_panel_settings" size={20} /> Outlet & Role Access
              </Typography>
              <Chip size="small" label={scoped} sx={{ fontSize: 10, fontWeight: 800 }} />
            </Box>
            <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
              <Avatar sx={{ bgcolor: '#fff', color: '#9B2F00', borderRadius: 2, width: 40, height: 40 }}>
                <Sym name="restaurant" size={20} />
              </Avatar>
              <Box>
                <Typography variant="body2" fontWeight={800} fontSize={14}>{user.restaurantName ?? 'All outlets'}</Typography>
                <Typography variant="caption" fontSize={10} color="text.secondary">
                  {user.branchName ? `${user.branchName} · home outlet` : 'Sees every outlet in the tenant'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
                <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
                  System Role
                </Typography>
                <Typography variant="body2" fontWeight={800} fontSize={14}>{ROLE_LABEL[user.role] ?? user.role}</Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
                <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block' }}>
                  Tenant
                </Typography>
                <Typography variant="body2" fontWeight={700} fontSize={12} noWrap sx={{ fontFamily: 'monospace' }}>
                  {String(user.tenantId ?? '—').slice(0, 8).toUpperCase()}
                </Typography>
              </Box>
            </Box>
            {!user.branchId ? (
              <Button fullWidth variant="outlined" component={RouterLink} to="/admin/restaurants" sx={{ mt: 1.5, borderRadius: 2, fontWeight: 800 }}>
                View outlets
              </Button>
            ) : (
              <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Outlet-locked by design — contact your owner to move outlets.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* preferences */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Sym name="tune" size={20} /> Preferences · this device
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  try {
                    localStorage.removeItem('tablepulse-kds-chime');
                    localStorage.removeItem('tablepulse-haptics');
                    localStorage.removeItem('tablepulse-soundbox-lang');
                    localStorage.removeItem(LANG_KEY);
                  } catch {
                    // ignore
                  }
                  setChime(true);
                  setHaptics(true);
                  setSbLang(SOUNDBOX_LANGS[0]);
                  setLang(LANGS[0]);
                  setMode('auto');
                  setToast('Defaults restored on this device.');
                }}
                sx={{ fontWeight: 700 }}
              >
                Reset Defaults
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Sym name="palette" size={20} />
                  <Box>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>Interface Appearance</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">Terracotta theme · follows system on Auto</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', p: 0.5, borderRadius: 2, bgcolor: '#fff', border: 1, borderColor: 'divider' }}>
                  {['light', 'dark', 'auto'].map((m) => (
                    <Button
                      key={m}
                      size="small"
                      onClick={() => {
                        setMode(m);
                        setToast(m === 'auto' ? 'Theme follows your system now.' : `Theme set to ${m}.`);
                      }}
                      variant={choice === m ? 'contained' : 'text'}
                      sx={{ borderRadius: 1.5, fontSize: 12, fontWeight: 800, textTransform: 'capitalize', minWidth: 0, px: 1.5 }}
                    >
                      {m}
                    </Button>
                  ))}
                </Box>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Sym name="volume_up" size={20} />
                  <Box>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>KDS Order Chimes</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">Bell on new kitchen tickets</Typography>
                  </Box>
                </Box>
                <Switch
                  checked={chime}
                  onChange={(_, v) => {
                    setChime(v);
                    setChimePref(v);
                    setToast(v ? 'Kitchen chimes on.' : 'Kitchen chimes off.');
                  }}
                  slotProps={{ input: { 'aria-label': 'kitchen chimes' } }}
                />
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Sym name="vibration" size={20} />
                  <Box>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>Haptic Feedback</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">Vibrate on kitchen alerts (this device)</Typography>
                  </Box>
                </Box>
                <Switch
                  checked={haptics}
                  onChange={(_, v) => {
                    setHaptics(v);
                    setHapticsPref(v);
                    setToast(v ? 'Haptics on.' : 'Haptics off.');
                  }}
                  slotProps={{ input: { 'aria-label': 'haptic feedback' } }}
                />
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Sym name="campaign" size={20} />
                  <Box>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>Soundbox Announcement</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">Voice language · this device</Typography>
                  </Box>
                </Box>
                <TextField
                  select
                  size="small"
                  value={sbLang}
                  onChange={(e) => {
                    setSbLang(e.target.value);
                    setSoundboxLangPref(e.target.value);
                    setToast('Soundbox language saved on this device.');
                  }}
                  sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
                >
                  {SOUNDBOX_LANGS.map((l) => (
                    <MenuItem key={l} value={l}>{l}</MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* help */}
        <Card sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
              <Sym name="support_agent" size={20} /> Help & Support
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Sym name="chat" size={18} />}
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ borderRadius: 2, fontWeight: 800 }}
            >
              WhatsApp Support · 24×7 Live Desk
            </Button>
            <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block', mt: 1.5, textAlign: 'center' }}>
              Licensed tenant {String(user.tenantId ?? '').slice(0, 8).toUpperCase()} · Cloud Sync Online
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit Profile Details</DialogTitle>
        <Box component="form" onSubmit={onSaveEdit}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Full name" required value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} />
            <TextField label="Phone" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91…" />
            {editError && <Alert severity="error">{editError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={editBusy}>
              {editBusy ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* password dialog */}
      <Dialog open={pwOpen} onClose={() => setPwOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Change Password</DialogTitle>
        <Box component="form" onSubmit={onChangePassword}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Current password" type="password" required value={pwForm.currentPassword} onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))} autoComplete="current-password" />
            <TextField
              label="New password (min 8)"
              type="password"
              required
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              slotProps={{ htmlInput: { minLength: 8 } }}
            />
            {pwError && <Alert severity="error">{pwError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Update'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {toast && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 24 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1400,
            bgcolor: '#1E1B19',
            color: '#fff',
            px: 2.5,
            py: 1.5,
            borderRadius: 999,
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            boxShadow: 4,
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          <Sym name="check_circle" size={18} />
          {toast}
        </Box>
      )}
    </Box>
  );
}
