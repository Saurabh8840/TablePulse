import AddIcon from '@mui/icons-material/Add';
import ApartmentIcon from '@mui/icons-material/Apartment';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getPublicMenu } from '../../services/ordering.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';

const CAPABILITIES = [
  'Manage restaurants, brands and outlets',
  'Build menus with photos and prices',
  'Generate table QR codes',
  'Run the kitchen display and waiter board',
  'Follow orders live as they cook',
  'Track revenue and top dishes per outlet',
];

function openNow(branch) {
  if (!branch?.openingTime || !branch?.closingTime) return null;
  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const mins = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = branch.openingTime.split(':').map(Number);
    const [ch, cm] = branch.closingTime.split(':').map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    if (close <= open) return mins >= open || mins < close;
    return mins >= open && mins < close;
  } catch {
    return null;
  }
}

/** Cover = first dish photo from the public menu; monogram when the kitchen has no photos yet. */
function CoverPhoto({ slug, name }) {
  const [src, setSrc] = useState(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getPublicMenu(slug)
      .then((res) => {
        if (!alive) return;
        const found = (res.data?.categories ?? [])
          .flatMap((c) => c.items ?? [])
          .map((i) => i.imageUrl)
          .find(Boolean);
        if (alive) setSrc(found ?? null);
      })
      .catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [slug]);
  return (
    <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'action.hover' }}>
      {src && !failed ? (
        <Box
          component="img"
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : src === undefined && !failed ? (
        <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, height: '100%' }} />
      ) : (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main',
        }}>
          {(name?.[0] ?? '·').toUpperCase()}
        </Box>
      )}
      <Chip
        size="small"
        label="Ratings soon"
        variant="outlined"
        sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper', fontWeight: 700 }}
      />
    </Box>
  );
}

export default function Restaurants() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [areas, setAreas] = useState({});
  const [error, setError] = useState(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const load = () =>
    listRestaurants()
      .then((r) => {
        setRows(r.data);
        // First-time owner: welcome once, then guide the setup choice below.
        if ((r.data ?? []).length === 0 && user) {
          try {
            if (!localStorage.getItem(`tp_welcome_${user.userId ?? user.email}`)) {
              setWelcomeOpen(true);
            }
          } catch {
            setWelcomeOpen(true);
          }
        }
        // Best-effort area line per restaurant (first branch) — owner has few outlets.
        (r.data ?? []).forEach((rest) => {
          listBranches(rest.id)
            .then((b) => {
              const first = (b.data ?? [])[0] ?? null;
              setAreas((m) => ({ ...m, [rest.id]: first }));
            })
            .catch(() => {});
        });
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  function dismissWelcome() {
    setWelcomeOpen(false);
    try {
      if (user) localStorage.setItem(`tp_welcome_${user.userId ?? user.email}`, '1');
    } catch {
      // ignore
    }
  }

  return (
    <Box>
      <PageHeader
        title="Restaurants"
        subtitle="One owner, many restaurants — each fully isolated."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/restaurants/new')}>
            Partner a restaurant
          </Button>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {rows === null && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ borderRadius: 3, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
              <Skeleton variant="rectangular" height={0} sx={{ aspectRatio: '16 / 9' }} />
              <Box sx={{ p: 2 }}>
                <Skeleton variant="text" width="55%" height={28} />
                <Skeleton variant="text" width="90%" height={18} />
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {rows !== null && rows.length === 0 && (
        <>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, mb: 2 }}>
            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }} gutterBottom>
              How do you want to set up?
            </Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <Box
                onClick={() => navigate('/admin/restaurants/new')}
                sx={{
                  p: 2, borderRadius: 3, border: 1, borderColor: 'divider', cursor: 'pointer',
                  transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
                  '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
                }}
              >
                <StorefrontIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1 }}>
                  I have one restaurant
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Independent outlet — profile plus first location in one flow.
                </Typography>
              </Box>
              <Box
                onClick={() => navigate('/admin/restaurants/new?mode=brand')}
                sx={{
                  p: 2, borderRadius: 3, border: 1, borderColor: 'divider', cursor: 'pointer',
                  transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
                  '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
                }}
              >
                <ApartmentIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1 }}>
                  Brand with multiple outlets
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start with one outlet — add the rest later from Settings.
                </Typography>
              </Box>
            </Box>
          </Paper>
          <EmptyState
            icon="🍽️"
            title="No restaurants yet"
            body="Pick a setup above to partner your first outlet."
            actionLabel="Partner a restaurant"
            onAction={() => navigate('/admin/restaurants/new')}
          />
        </>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        {(rows ?? []).map((r) => {
          const area = areas[r.id] ?? null;
          const open = area ? openNow(area) : null;
          return (
            <Card
              key={r.id}
              sx={{
                height: '100%', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', transition: 'transform .18s ease, box-shadow .18s ease',
                '&:hover': { transform: { xs: 'none', sm: 'translateY(-3px)' }, boxShadow: 4 },
              }}
            >
              <Box
                component={RouterLink}
                to={`/admin/restaurants/${r.id}`}
                sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <CoverPhoto slug={r.slug} name={r.name} />
              </Box>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ flexGrow: 1, letterSpacing: '-0.01em' }}>
                    <RouterLink to={`/admin/restaurants/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {r.name}
                    </RouterLink>
                  </Typography>
                  {!r.active && <Chip size="small" label="Inactive" />}
                </Box>
                {r.description && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {r.description}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" noWrap>
                  {[area?.address?.split(',').slice(0, 2).join(','),
                    open === true ? 'Open now' : open === false ? 'Closed' : null,
                  ].filter(Boolean).join(' · ') || `/${r.slug} · ${r.currency} · GST ${r.taxPercentage}%`}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button component={RouterLink} to={`/admin/restaurants/${r.id}`} size="small" variant="outlined" sx={{ fontWeight: 700 }}>
                    Manage
                  </Button>
                  <Button component={RouterLink} to={`/admin/restaurants/${r.id}/menu`} size="small" variant="text" sx={{ fontWeight: 700 }}>
                    Menu
                  </Button>
                </Box>
              </Box>
            </Card>
          );
        })}
      </Box>

      {/* First-login welcome — once per user, never repeats */}
      <Dialog open={welcomeOpen} onClose={dismissWelcome} fullWidth maxWidth="sm">
        <DialogTitle>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
            Welcome to your restaurant workspace
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1, mt: 0.5 }}>
            {CAPABILITIES.map((c) => (
              <Box key={c} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.25,
                  bgcolor: 'success.main', color: '#fff', fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  ✓
                </Box>
                <Typography variant="body2">{c}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={dismissWelcome} sx={{ fontWeight: 600 }}>Maybe later</Button>
          <Button variant="contained" onClick={() => { dismissWelcome(); navigate('/admin/restaurants/new'); }} sx={{ fontWeight: 800 }}>
            Get Started
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
