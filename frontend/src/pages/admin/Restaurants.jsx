import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getRestaurantSummaries } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';
import { getPublicMenu } from '../../services/ordering.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import { listTables } from '../../services/tables.js';
import { countOccupied } from '../../services/waiter.js';

const FALLBACK_COVERS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCuAnXMGr23DaZuRkTYROIbQUJm4DCZ-wDu4NKp6yq4quW0ne76AZLhBTsl8gGhTgZ6yWIbknMVl2s5iavXqLqWQnlDvtPKqRKKhtfPU0IulOxwb4twj8ub_hiPWwDN_c7uyqMZRuxUNIFKDJqnIgA_Xh_kC6W3aCxJKcgD9K0_vOVknzW0rzJlK4pGpsYYHvabi5TSDbRc2hQVcBtjwJuwvxqH03mWlKDzLbShLoVSO3ipZPFBKZYy',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBC-0T8zJjS3RV5WUFQ42EMqkxT12jxAUdwwFcWXQEQ9QAUmvf4dZc6PMs95ANtdIVAUL9vtkTAvGDXKQgN5XHaiXycuVVRkieMKf77x2pWwAeCEXvjKoJ5v4d3KomMXIWXR2sBUbLpjJII_WqlcsrqCcFCEC_wk-Ik2-XyMIELwrzAgFRK5RJQXNDLCJ7G9Va3dOnlhU_UuLTNsx7ux4lwaatHbhiShvZFpWPPl5wSk2jEOz_0Od4F',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB8lXX6NJRSyVlQkTdzWO5GC2FuYOMv3XRv5fBwKV492U9E1OyFzywMziFgDgtYvt-1nMLVdaeMc9EtBpfykkZkmV7-hIBkfVVQL3T2zmXYjN29gRQlHp2VCtSFgcRyBT18PXyu2XiacmFQUBwv5LiSGjMxkmMoftTZi1n1tCgxYLsbMW-yx91daNJlhQ29IL_D331yWEIGgo6Ooe6N7AUjkOfMZf6OhsO4-aV1lT1gCBZlvGCPCTT5',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDfrDKe3vUzepn-pNctPyBS5xvfVlNoHFIxPcICK2F7sMpoSUbCmW_rFsbaRdg9knNMEoI5ivUNrgixumcMuq500eqsSMeY380Xcgj-4qTUb93m_rbBXQ36E9X5_6NMObMdfqFEPiAtm1WJBrcHyhy-cV2v9bAYJy---WXTy4-MEHI68Xi6WE7Kb2AjFUYZNuJ_YL5eyfKE9Z6uy36OPUuWKWAJQXST-JGrmSlbrpgaoLG1PNkSpGAz',
];
const MAP_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBoxqNbJMWZfBeKjVk2IcJXvJGkHotuzMZdiQ_u87nyExlKgFpmrkV_U6tgPg3VSHex4RLCq2wF72dA7oTuGhBCr00c8MrtyGfQ6zzZR2U4ZtgE5GzV4r4_GVFEi576ireLY9U1hStsdQrBRGoG9fkwshfSNfcY9Ib58xpAuWGC0Gb69eFLsR_o0p-f9HlYkNuo6ZBAvUCDuaSErkUD8R-TsyH2vbhszl6Y3mK_BNA6sj2tnWjJmC2x';

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

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

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

/** Cover = restaurant's own cover photo; dish photo; Stitch fallback; monogram last. No fake ratings/GSTIN. */
function CoverPhoto({ slug, cover, tag, name, fallback, badge }) {
  const [dishSrc, setDishSrc] = useState(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (cover) return undefined; // own cover wins — no fetch needed
    let alive = true;
    getPublicMenu(slug)
      .then((res) => {
        if (!alive) return;
        const found = (res.data?.categories ?? [])
          .flatMap((c) => c.items ?? [])
          .map((i) => i.imageUrl)
          .find(Boolean);
        if (alive) setDishSrc(found ?? null);
      })
      .catch(() => alive && setDishSrc(null));
    return () => {
      alive = false;
    };
  }, [slug, cover]);
  const src = cover || dishSrc;
  const showFallback = (src === null || failed) && fallback && !failed;
  return (
    <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: '#F4ECE8', overflow: 'hidden' }}>
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
      ) : showFallback ? (
        <Box
          component="img"
          src={fallback}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : src === undefined && !failed ? (
        <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, height: '100%' }} />
      ) : (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 44,
            fontWeight: 800,
            color: '#9B2F00',
          }}
        >
          {(name?.[0] ?? '·').toUpperCase()}
        </Box>
      )}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.8) 0%, rgba(0,0,0,.2) 45%, transparent 70%)' }} />
      <Box sx={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between' }}>
        {badge}
      </Box>
      <Box sx={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', color: '#fff' }}>
        <Box>
          <Typography variant="caption" fontWeight={800} fontSize={11} sx={{ textTransform: 'uppercase', letterSpacing: '.06em', bgcolor: 'rgba(255,255,255,.2)', px: 1, py: 0.25, borderRadius: 1, display: 'inline-block', mb: 0.5 }}>
            {tag || 'Restaurant'}
          </Typography>
          <Typography variant="h6" fontWeight={800} fontSize={22} sx={{ lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
            {name}
          </Typography>
        </Box>
        <Sym name="verified" size={20} />
      </Box>
    </Box>
  );
}

export default function Restaurants() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Outlet-pinned managers can't create restaurants/branches (backend 403) —
  // hide create flows so the page never promises what the API refuses.
  const pinned = !!user?.branchId;
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [per, setPer] = useState({});
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [chip, setChip] = useState('all');
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    listRestaurants()
      .then(async (r) => {
        const list = r.data ?? [];
        if (!alive) return;
        setRows(list);
        if (list.length === 0 && user) {
          try {
            if (!localStorage.getItem(`tp_welcome_${user.userId ?? user.email}`)) setWelcomeOpen(true);
          } catch {
            setWelcomeOpen(true);
          }
        }
        const sums = await getRestaurantSummaries().catch(() => ({ data: [] }));
        const sumById = Object.fromEntries((sums.data ?? []).map((s) => [s.restaurantId, s]));
        await Promise.all(
          list.map(async (rest) => {
            const [branches, live] = await Promise.all([
              listBranches(rest.id).catch(() => ({ data: [] })),
              searchOrders({ restaurantId: rest.id, liveOnly: true }).catch(() => ({ data: [] })),
            ]);
            const blist = branches.data ?? [];
            const tableLists = await Promise.all(blist.map((b) => listTables(b.id).catch(() => ({ data: [] }))));
            const tables = tableLists.flatMap((t) => t.data ?? []);
            const occupied = await countOccupied(blist.map((b) => b.id)).catch(() => 0);
            if (alive) {
              setPer((m) => ({
                ...m,
                [rest.id]: {
                  branches: blist,
                  tables,
                  occupied,
                  liveOrders: (live.data ?? []).length,
                  summary: sumById[rest.id] ?? null,
                },
              }));
            }
          }),
        );
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
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

  const enriched = useMemo(
    () =>
      (rows ?? []).map((r, i) => {
        const p = per[r.id] ?? { branches: [], tables: [], occupied: 0, liveOrders: 0, summary: null };
        const first = p.branches[0] ?? null;
        const open = first ? openNow(first) : null;
        const live = open === true || p.liveOrders > 0;
        return { r, p, i, first, open, live };
      }),
    [rows, per],
  );

  const totals = useMemo(() => {
    const gmv = enriched.reduce((n, e) => n + Number(e.p.summary?.todayRevenue ?? 0), 0);
    const active = enriched.reduce((n, e) => n + Number(e.p.summary?.activeTables ?? e.p.liveOrders ?? 0), 0);
    const tables = enriched.reduce((n, e) => n + e.p.tables.length, 0);
    const occupied = enriched.reduce((n, e) => n + e.p.occupied, 0);
    const live = enriched.reduce((n, e) => n + e.p.liveOrders, 0);
    const dues = enriched.reduce((n, e) => n + Number(e.p.summary?.balanceDue ?? 0), 0);
    const openCount = enriched.filter((e) => e.live).length;
    return { gmv, active, tables, occupied, live, dues, openCount };
  }, [enriched]);

  const q = query.trim().toLowerCase();
  const visible = enriched.filter(({ r, p, live }) => {
    if (chip === 'active' && !live) return false;
    if (chip === 'offline' && live) return false;
    if (!q) return true;
    const addr = (p.branches[0]?.address ?? '').toLowerCase();
    return r.name.toLowerCase().includes(q) || addr.includes(q) || (r.description ?? '').toLowerCase().includes(q);
  });

  const occPct = totals.tables > 0 ? Math.round((totals.occupied / totals.tables) * 100) : 0;

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* page header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box sx={{ maxWidth: 640 }}>
          <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ letterSpacing: '.15em', color: '#9B2F00', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#C2410C' }} />
            MY RESTAURANTS
          </Typography>
          <Typography variant="h4" fontWeight={800} fontSize={28}>
            My restaurants
          </Typography>
          <Typography variant="body2" fontSize={14} color="text.secondary" sx={{ mt: 0.5 }}>
            Manage your dining venues, monitor live operational shifts, launch digital menus, and deploy QR tables.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignSelf: { md: 'flex-end' }, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => setInfo('Consolidated reports ship with the analytics phase — per-restaurant revenue lives on each dashboard meanwhile.')}
            sx={{ height: 44, borderRadius: 2, fontWeight: 700 }}
          >
            Consolidated Report
          </Button>
          {!pinned && (
            <Button
              variant="contained"
              startIcon={<AddBusinessIcon />}
              onClick={() => navigate('/admin/restaurants/new')}
              sx={{ height: 44, borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #EA580C, #C2410C)' }}
            >
              + Partner a Restaurant
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {info && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}

      {/* multi-tenant strip (visual) */}
      <Card sx={{ borderRadius: 2, mb: 2, bgcolor: '#FAF2EE' }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 48, height: 48 }}>
              <Sym name="domain_verification" size={26} />
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="h6" fontWeight={800} fontSize={18}>Multi-Tenant Architecture Active</Typography>
                <Chip size="small" label="PRO CLUSTER" sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', fontWeight: 800, fontSize: 10 }} />
              </Box>
              <Typography variant="body2" fontSize={12} color="text.secondary">
                Enterprise routing enabled across your restaurants — each fully isolated.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, fontSize: 12 }}>
            {['Instant QR Stand Dispatch', 'Unified GST Invoicing', 'Cross-Branch Roaming', '400ms Menu CDN', 'Audio Soundbox Sync', 'KDS Cloud Auto-Failover'].map((t) => (
              <Box key={t} sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Sym name="check_circle" size={18} />
                {t}
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* stat strip */}
      {rows === null ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' }, mb: 2 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />)}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' }, mb: 2 }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary">TOTAL RESTAURANTS</Typography>
                  <Typography variant="h5" fontWeight={800} fontSize={28}>{rows.length} Restaurant{rows.length === 1 ? '' : 's'}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#F4ECE8', color: '#9B2F00', borderRadius: 2, width: 40, height: 40 }}>
                  <Sym name="storefront" size={22} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 1.5, bgcolor: '#FAF2EE', borderRadius: 2, px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span>{totals.openCount} live now</span>
                <strong>{totals.dues > 0 ? `${inr(totals.dues)} dues` : 'No dues pending'}</strong>
              </Box>
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary">COMBINED GMV TODAY</Typography>
                  <Typography variant="h5" fontWeight={800} fontSize={28}>{inr(totals.gmv)}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', borderRadius: 2, width: 40, height: 40 }}>
                  <Sym name="currency_rupee" size={22} />
                </Avatar>
              </Box>
              <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ color: '#00632B', display: 'block', mt: 1.5 }}>
                Live total across all restaurants
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary">LIVE TABLES STATUS</Typography>
                  <Typography variant="h5" fontWeight={800} fontSize={28}>{totals.occupied} / {totals.tables}</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'rgba(0,106,99,.12)', color: '#006A63', borderRadius: 2, width: 40, height: 40 }}>
                  <Sym name="table_restaurant" size={22} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span>Combined Occupancy</span>
                  <strong style={{ color: '#006A63' }}>{occPct}% Full</strong>
                </Box>
                <Box sx={{ height: 8, borderRadius: 999, bgcolor: '#F4ECE8', mt: 0.5 }}>
                  <Box sx={{ height: '100%', width: `${occPct}%`, borderRadius: 999, bgcolor: '#006A63' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary">ACTIVE KOT TICKETS</Typography>
                  <Typography variant="h5" fontWeight={800} fontSize={28} sx={{ color: '#9B2F00' }}>{totals.live} Live</Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 40, height: 40 }}>
                  <Sym name="receipt_long" size={22} />
                </Avatar>
              </Box>
              <Box sx={{ mt: 1.5, bgcolor: 'rgba(194,65,12,.08)', borderRadius: 2, px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span>Across {rows.length} restaurant{rows.length === 1 ? '' : 's'}</span>
                <strong>{totals.active} active tables</strong>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* search + chips */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <TextField
          size="small"
          placeholder="Search by restaurant name, locality, or cuisine..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ maxWidth: 420, flexGrow: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' } }}
        />
        <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
          {[
            ['all', `All Restaurants (${enriched.length})`],
            ['active', `Active Shift (${enriched.filter((e) => e.live).length})`],
            ['offline', `Offline (${enriched.filter((e) => !e.live).length})`],
          ].map(([v, l]) => (
            <Chip
              key={v}
              label={l}
              clickable
              onClick={() => setChip(v)}
              sx={
                chip === v
                  ? { bgcolor: '#C2410C', color: '#fff', fontWeight: 800, fontSize: 10 }
                  : { bgcolor: '#fff', fontWeight: 600, fontSize: 10 }
              }
            />
          ))}
          {['Dine-in Bistros', 'QSR & Cafés', 'Cloud Kitchens'].map((l) => (
            <Chip
              key={l}
              label={l}
              disabled
              title="Restaurant formats coming soon"
              sx={{ bgcolor: '#fff', fontSize: 10 }}
            />
          ))}
        </Box>
      </Box>

      {/* cards */}
      {rows !== null && rows.length === 0 && (
        <EmptyState
          icon="🍽️"
          title="No restaurants yet"
          body="Partner your first restaurant — menu, tables and QR live in one sitting."
          actionLabel="Partner a restaurant"
          onAction={() => navigate('/admin/restaurants/new')}
        />
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' } }}>
        {visible.map(({ r, p, i, first, live }) => {
          const sales = Number(p.summary?.todayRevenue ?? 0);
          const noTables = p.tables.length === 0;
          const branchId = first?.id ?? null;
          return (
            <Card
              key={r.id}
              role="link"
              tabIndex={0}
              aria-label={`Open ${r.name} dashboard`}
              onClick={() => navigate(`/admin/restaurants/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/admin/restaurants/${r.id}`);
                }
              }}
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                opacity: live ? 1 : 0.95,
                cursor: 'pointer',
                transition: 'transform .18s ease, box-shadow .18s ease',
                '@media (hover: hover)': {
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                },
              }}
            >
              <CoverPhoto
                slug={r.slug}
                cover={r.coverUrl}
                tag={r.cuisine || r.category}
                name={r.name}
                fallback={FALLBACK_COVERS[i % FALLBACK_COVERS.length]}
                badge={
                  <>
                    <Chip
                      size="small"
                      icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: live ? '#95F8A7' : '#8D7168', ml: 1 }} />}
                      label={live ? 'LIVE NOW' : 'OFFLINE'}
                      sx={{ bgcolor: 'rgba(0,0,0,.6)', color: '#fff', fontWeight: 800, fontSize: 10 }}
                    />
                    {!r.active && <Chip size="small" label="Inactive" />}
                  </>
                }
              />
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, flexGrow: 1 }}>
                <Box>
                  <Typography variant="body2" fontSize={12} color="text.secondary" noWrap>
                    📍 {first?.address || `/${r.slug} · ${r.currency} · GST ${r.taxPercentage}%`}
                  </Typography>
                  {r.description && (
                    <Typography variant="body2" fontSize={12} color="text.secondary" noWrap>
                      {r.description}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, bgcolor: '#FAF2EE', borderRadius: 2, p: 1.5, fontSize: 12 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Sym name="table_bar" size={18} />
                    <span><strong>{p.occupied}/{p.tables.length}</strong> Occupied</span>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Sym name="receipt_long" size={18} />
                    <span><strong>{p.liveOrders}</strong> Live KOT</span>
                  </Box>
                  <Box sx={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', borderTop: 1, borderColor: 'divider', pt: 1 }}>
                    <span>Today&apos;s Sales:</span>
                    <strong style={{ color: '#9B2F00', fontSize: 16 }}>{inr(sales)}</strong>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    fontSize: 10,
                    bgcolor: live ? 'rgba(17,126,59,.08)' : '#F4ECE8',
                    color: live ? '#00632B' : 'text.secondary',
                    fontWeight: 700,
                  }}
                >
                  <span>{live ? '● Soundbox Online' : '○ Soundbox in Standby'}</span>
                  <span>{Number(p.summary?.balanceDue ?? 0) > 0 ? `${inr(p.summary.balanceDue)} dues` : live ? 'All settled' : `Auto-on with first order`}</span>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, pt: 1, borderTop: 1, borderColor: 'divider' }} onClick={(e) => e.stopPropagation()}>
                  <Button
                    component={RouterLink}
                    to={`/admin/restaurants/${r.id}`}
                    variant="contained"
                    size="small"
                    endIcon={<Sym name="arrow_forward" size={18} />}
                    sx={{ flex: 1, borderRadius: 2, fontWeight: 800, ...(live && { backgroundImage: 'linear-gradient(90deg, #EA580C, #C2410C)' }) }}
                  >
                    Manage
                  </Button>
                  <Button component={RouterLink} to={`/admin/restaurants/${r.id}/menu`} size="small" variant="outlined" startIcon={<Sym name="restaurant_menu" size={18} />} sx={{ borderRadius: 2, fontWeight: 700 }}>
                    Menu
                  </Button>
                  {noTables ? (
                    <Button component={RouterLink} to={branchId ? `/admin/branches/${branchId}/tables` : `/admin/restaurants/${r.id}`} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>
                      Setup
                    </Button>
                  ) : (
                    <Button component={RouterLink} to={`/admin/branches/${branchId}/tables`} size="small" variant="outlined" title="Live QR & Tables" sx={{ borderRadius: 2, minWidth: 40 }}>
                      <Sym name="qr_code_2" size={18} />
                    </Button>
                  )}
                </Box>
              </Box>
            </Card>
          );
        })}

        {/* dashed add card */}
        {!pinned && rows !== null && rows.length > 0 && (
          <Card
            onClick={() => navigate('/admin/restaurants/new')}
            sx={{
              borderRadius: 2,
              border: '1.5px dashed #8D7168',
              bgcolor: 'rgba(255,255,255,.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: 1.5,
              p: 4,
              minHeight: 360,
              cursor: 'pointer',
              '&:hover': { borderColor: '#C2410C', bgcolor: '#FAF2EE' },
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(194,65,12,.2)', color: '#9B2F00', borderRadius: 2, width: 64, height: 64 }}>
              <Sym name="add_location_alt" size={32} />
            </Avatar>
            <Typography variant="h6" fontWeight={800} fontSize={18}>
              Opening a new restaurant?
            </Typography>
            <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ maxWidth: 280 }}>
              Deploy TablePulse in under 15 minutes with instant QR acrylic stand generation and zero upfront hardware fees.
            </Typography>
            <Button variant="contained" startIcon={<Sym name="add" size={20} />} sx={{ borderRadius: 2, fontWeight: 800 }}>
              Onboard New Restaurant
            </Button>
            <Typography variant="caption" fontSize={10} color="text.secondary">
              Instant Cloud KOT · Zero Lock-in
            </Typography>
          </Card>
        )}
      </Box>

      {visible.length === 0 && rows !== null && rows.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No restaurants match “{query}” in this view.
        </Typography>
      )}

      {/* telemetry (counts real, rates visual) */}
      {rows !== null && rows.length > 0 && (
        <Card sx={{ borderRadius: 2, mt: 2 }}>
          <CardContent sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', borderRadius: 2, width: 40, height: 40 }}>
              <Sym name="hub" size={22} />
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <Typography variant="subtitle1" fontWeight={800} fontSize={18}>Unified Dining Room Network</Typography>
              <Typography variant="body2" fontSize={12} color="text.secondary">
                {totals.openCount}/{rows.length} restaurants live · {totals.live} live KOTs · {inr(totals.gmv)} today
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', width: { xs: '100%', md: 320 }, height: 120, borderRadius: 2, overflow: 'hidden', bgcolor: '#F4ECE8' }}>
              <Box
                component="img"
                src={MAP_IMG}
                alt="Restaurant network map"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8, bgcolor: 'rgba(255,248,245,.9)', borderRadius: 2, px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800 }}>
                <span>{rows.length} Restaurant{rows.length === 1 ? '' : 's'} Tracked</span>
                <span>{inr(totals.gmv)} today</span>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* health footer */}
      {rows !== null && rows.length > 0 && (
        <Box sx={{ mt: 2, bgcolor: '#EEE7E3', borderRadius: 2, p: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, fontSize: 12 }}>
          <Typography variant="body2" fontSize={12} fontWeight={700}>
            ● {totals.openCount}/{rows.length} restaurants live · {totals.dues > 0 ? `${inr(totals.dues)} dues pending` : '0 open alerts'}
          </Typography>
          <Button size="small" onClick={() => setInfo('Restaurant audit ships with the analytics phase — live counts above are real.')} sx={{ fontWeight: 800 }}>
            Audit ›
          </Button>
        </Box>
      )}

      {/* welcome */}
      <Dialog open={welcomeOpen} onClose={dismissWelcome} fullWidth maxWidth="sm">
        <DialogTitle>
          <Typography variant="h5" fontWeight={800}>Welcome to your restaurant workspace</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1, mt: 0.5 }}>
            {['Run live restaurants with QR ordering', 'Build menus with photos and prices', 'Track revenue and top dishes per location'].map((c) => (
              <Box key={c} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'success.main', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* mobile bottom nav */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: 'rgba(255,248,245,0.95)',
          backdropFilter: 'blur(20px)',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 64,
        }}
      >
        {[
          ['space_dashboard', 'Dashboard', '/admin', false],
          ['storefront', 'Restaurants', '/admin/restaurants', true],
          ['countertops', 'KDS', '/kitchen', false],
          ['calendar_month', 'Roster', '/admin/staff', false],
        ].map(([icon, label, to, active]) => (
          <Button
            key={label}
            component={RouterLink}
            to={to}
            sx={{ flexDirection: 'column', gap: 0, minWidth: 56, minHeight: 44, color: active ? '#9B2F00' : 'text.secondary', fontWeight: active ? 800 : 400, fontSize: 10 }}
          >
            <Sym name={icon} size={22} />
            {label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
