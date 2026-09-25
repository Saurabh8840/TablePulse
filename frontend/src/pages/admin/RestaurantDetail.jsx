import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
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
  Checkbox,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import CuisineField from '../../components/CuisineField.jsx';
import ImageStepPicker from '../../components/ImageStepPicker.jsx';
import SeatCredentialsDialog from '../../components/SeatCredentialsDialog.jsx';
import VegMark from '../../components/VegMark.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getDashboard, getRestaurantSummaries, getRevenue, getTopItems } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';
import { getPublicMenu } from '../../services/ordering.js';
import { createBranch as apiCreateBranch, getRestaurant, listBranches, updateRestaurant, uploadRestaurantCover, uploadRestaurantLogo } from '../../services/restaurant.js';
import { createStaff, listStaff } from '../../services/staff.js';
import { fetchQrPng, listTables } from '../../services/tables.js';
import { countOccupied } from '../../services/waiter.js';
import { randomSeatPassword, seatName } from '../../utils/outletSeat.js';
import { RESTAURANT_CATEGORIES } from '../../utils/restaurantMeta.js';

const COVER_FALLBACK =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC6yI7Wrbyoa73HQRMdDzShB4dockA-umwPWhN1BSLDobwWyXd2bs6e2hx8wEktD6pvRiVY-O7qQpm7yQdomGeOrfgh3_-heWRXvEri8KcLGXlgYhaRoy36XEWRJg98T4bH_1pkGXDR15QEQFhqSdOM4Jl0bshfk7cE0SqiTv5jyYcHYaHrdEi1OBkR4ABsRcInInncIvor7p2LAaVGZUbNYKbLp2QNQ8Akc99Yj45S6brRoAuJHmAe';

const EMPTY_BRANCH = { name: '', address: '', phone: '', openingTime: '', closingTime: '', managerEmail: '' };
const STATUSES = ['ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING'];

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const todayKolkata = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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

function elapsedMin(placedAt) {
  try {
    return Math.max(0, (Date.now() - new Date(placedAt).getTime()) / 60000);
  } catch {
    return 0;
  }
}

function elapsedLabel(placedAt) {
  const m = elapsedMin(placedAt);
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.floor(m)}m ago`;
  return `${Math.floor(m / 60)}h ${Math.floor(m % 60)}m ago`;
}

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

const curMonthKolkata = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: me } = useAuth();
  // Outlet-pinned managers can't create branches (backend 403) — hide the flow.
  const pinned = !!me?.branchId;
  const fromSetup = location.state?.fromSetup === true;
  const [rest, setRest] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [error, setError] = useState(null);

  const [edit, setEdit] = useState({ description: '', taxPercentage: '', category: '', cuisine: '', ownerName: '', ownerPhone: '', ownerEmail: '' });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [formError, setFormError] = useState(null);
  const [makeSeat, setMakeSeat] = useState(true);
  const [creds, setCreds] = useState(null);

  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [revRange, setRevRange] = useState('week'); // today | week | month
  const [revLoading, setRevLoading] = useState(false);
  const [topItems, setTopItems] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [dueTotal, setDueTotal] = useState(0);
  const [loadingOv, setLoadingOv] = useState(true);

  const [history, setHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(todayKolkata());
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyLoading, setHistoryLoading] = useState(false);

  const [staff, setStaff] = useState(null);
  const [setup, setSetup] = useState(null);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [vegByName, setVegByName] = useState({});
  const [scannedAt, setScannedAt] = useState(null);
  const [branchTables, setBranchTables] = useState([]);
  const [printing, setPrinting] = useState(false);
  // Solo-skip is owned by the setup page; detail only reads it for readiness.
  const [teamSkipped] = useState(() => {
    try {
      return localStorage.getItem(`tp_setup_skip_${id}`) === '1';
    } catch {
      return false;
    }
  });
  // Tables-skip (takeaway-only) is owned by the setup page too.
  const [tablesSkipped] = useState(() => {
    try {
      return localStorage.getItem(`tp_setup_skip_tables_${id}`) === '1';
    } catch {
      return false;
    }
  });

  const [photos, setPhotos] = useState([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [fullPhoto, setFullPhoto] = useState(null);
  const [coverFailed, setCoverFailed] = useState(false);

  const scopeKey = branchFilter || `r:${id}`;

  const loadBase = useCallback(() => {
    setError(null);
    return Promise.all([getRestaurant(id), listBranches(id)])
      .then(([r, b]) => {
        setRest(r.data);
        setBranches(b.data ?? []);
        setEdit({
          description: r.data.description ?? '',
          taxPercentage: r.data.taxPercentage,
          category: r.data.category ?? '',
          cuisine: r.data.cuisine ?? '',
          ownerName: r.data.ownerName ?? '',
          ownerPhone: r.data.ownerPhone ?? '',
          ownerEmail: r.data.ownerEmail ?? '',
        });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const loadOverview = useCallback(() => {
    setLoadingOv(true);
    const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
    return Promise.all([
      getDashboard(s.branchId, s.restaurantId),
      getTopItems({ limit: 5, ...s }),
      searchOrders({ liveOnly: true, ...s }),
      getRestaurantSummaries(),
    ])
      .then(([d, t, live, sums]) => {
        setSummary(d.data);
        setTopItems(t.data ?? []);
        setLiveOrders(live.data ?? []);
        const row = (sums.data ?? []).find((x) => x.restaurantId === id);
        setDueTotal(Number(row?.balanceDue ?? 0));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingOv(false));
  }, [branchFilter, id]);

  const loadRevenue = useCallback(() => {
    setRevLoading(true);
    const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
    const p =
      revRange === 'month'
        ? getRevenue({ period: 'month', month: curMonthKolkata(), ...s })
        : getRevenue({ period: 'week', ...s });
    return p
      .then((r) => setRevenue(r.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setRevLoading(false));
  }, [branchFilter, id, revRange]);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
    return searchOrders({
      ...s,
      date: historyDate || undefined,
      status: historyStatus && historyStatus !== 'ALL' ? historyStatus : undefined,
    })
      .then((h) => setHistory((h.data ?? []).slice(0, 30)))
      .catch((e) => setError(e.message))
      .finally(() => setHistoryLoading(false));
  }, [branchFilter, id, historyDate, historyStatus]);

  const loadStaff = useCallback(() => {
    const params = branchFilter ? { branchId: branchFilter } : { restaurantId: id };
    return listStaff(params)
      .then((r) => setStaff(r.data ?? []))
      .catch((e) => setError(e.message));
  }, [branchFilter, id]);

  const loadSetup = useCallback(() => {
    if (!rest) return Promise.resolve();
    const bids = (branchFilter ? branches.filter((b) => b.id === branchFilter) : branches).map((b) => b.id);
    return Promise.all([
      getPublicMenu(rest.slug).catch(() => ({ data: { categories: [] } })),
      Promise.all(bids.map((bid) => listTables(bid).catch(() => ({ data: [] })))),
      listStaff({ restaurantId: id }).catch(() => ({ data: [] })),
      countOccupied(bids).catch(() => 0),
    ]).then(([menu, tableLists, team, occupied]) => {
      const cats = menu.data?.categories ?? [];
      const items = cats.flatMap((c) => c.items ?? []);
      const crew = team.data ?? [];
      const tables = tableLists.flatMap((t) => t.data ?? []);
      setSetup({
        itemCount: items.length,
        photoCount: items.filter((i) => i.imageUrl).length,
        tableCount: tables.filter((t) => t.active !== false).length,
        kitchenCount: crew.filter((u) => u.role === 'KITCHEN_STAFF').length,
        waiterCount: crew.filter((u) => u.role === 'WAITER').length,
      });
      setOccupiedCount(occupied);
      const veg = {};
      for (const c of cats) {
        for (const i of c.items ?? []) {
          if (i?.name && typeof i.vegetarian === 'boolean') veg[i.name] = i.vegetarian;
        }
      }
      setVegByName(veg);
      setScannedAt(new Date());
    }).catch(() => {});
  }, [rest, branches, branchFilter, id]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!rest) return;
    loadOverview();
    loadHistory();
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rest?.slug]);

  useEffect(() => {
    if (!rest) return;
    loadRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rest?.slug, revRange]);

  useEffect(() => {
    if (rest && branches.length > 0) loadSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rest?.slug, branches.length]);

  // Tables of the shown outlet: QR-menu link + floor summary.
  useEffect(() => {
    const bid = branchFilter || branches[0]?.id;
    if (!bid) {
      setBranchTables([]);
      return;
    }
    let alive = true;
    listTables(bid)
      .then((r) => alive && setBranchTables((r.data ?? []).filter((t) => t.active !== false)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [branchFilter, branches]);

  useEffect(() => {
    if (!rest?.slug) return;
    let alive = true;
    getPublicMenu(rest.slug)
      .then((res) => {
        if (!alive) return;
        const seen = new Set();
        const imgs = [];
        for (const c of res.data?.categories ?? []) {
          for (const i of c.items ?? []) {
            if (i.imageUrl && !seen.has(i.imageUrl)) {
              seen.add(i.imageUrl);
              imgs.push({ src: i.imageUrl, name: i.name });
            }
          }
        }
        setPhotos(imgs);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [rest?.slug]);

  // Live orders + occupancy stay fresh while the page is open.
  useEffect(() => {
    if (!rest) return undefined;
    const t = setInterval(() => {
      const s = { ...(branchFilter ? { branchId: branchFilter } : { restaurantId: id }) };
      searchOrders({ liveOnly: true, ...s })
        .then((r) => setLiveOrders(r.data ?? []))
        .catch(() => {});
      const bids = (branchFilter ? branches.filter((b) => b.id === branchFilter) : branches).map((b) => b.id);
      countOccupied(bids)
        .then((n) => setOccupiedCount(n))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [branchFilter, id, rest, branches]);

  // Fresh restaurants (no menu, or no tables without takeaway-only skip)
  // belong on the guided setup page.
  useEffect(() => {
    if (fromSetup || !setup) return;
    if (setup.itemCount === 0 || (setup.tableCount === 0 && !tablesSkipped)) {
      navigate(`/admin/restaurants/${id}/setup`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, fromSetup]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Change-images later: upload straight onto the saved restaurant.
  async function onUploadImage(kind, file) {
    const res = kind === 'logo'
      ? await uploadRestaurantLogo(id, file)
      : await uploadRestaurantCover(id, file);
    const url = kind === 'logo' ? res.data.logoUrl : res.data.coverUrl;
    setRest((r) => (r ? { ...r, ...(kind === 'logo' ? { logoUrl: url } : { coverUrl: url }) } : r));
    return url;
  }

  function onImageUrl(kind, url) {
    setRest((r) => (r ? { ...r, ...(kind === 'logo' ? { logoUrl: url } : { coverUrl: url }) } : r));
    if (url) updateRestaurant(id, { [kind === 'logo' ? 'logoUrl' : 'coverUrl']: url }).catch(() => {});
    else updateRestaurant(id, { [kind === 'logo' ? 'logoUrl' : 'coverUrl']: '' }).catch(() => {});
  }

  async function onSaveDetails(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateRestaurant(id, {
        description: edit.description,
        taxPercentage: Number(edit.taxPercentage) || 0,
        category: edit.category || undefined,
        cuisine: edit.cuisine.trim() || undefined,
        ownerName: edit.ownerName.trim() || undefined,
        ownerPhone: edit.ownerPhone.trim() || undefined,
        ownerEmail: edit.ownerEmail.trim() || undefined,
      });
      loadBase();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreateBranch(e) {
    e.preventDefault();
    try {
      const b = await apiCreateBranch(id, {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        openingTime: form.openingTime || undefined,
        closingTime: form.closingTime || undefined,
      });
      const newBranchId = b.data.id;
      // Manager seat (opt-in): the owner-typed email becomes this location's
      // login. Never auto-invented — unchecked or empty means no seat now.
      if (makeSeat && newBranchId) {
        const seatEmail = form.managerEmail.trim();
        if (!seatEmail) {
          throw new Error('Type the manager email, or uncheck the manager login option.');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seatEmail)) {
          throw new Error('Manager email does not look like a real email address.');
        }
        const password = randomSeatPassword();
        try {
          await createStaff({
            email: seatEmail,
            password,
            fullName: seatName(rest.name, form.name.trim()),
            role: 'MANAGER',
            branchId: newBranchId,
            seat: true,
          });
          setCreds({ email: seatEmail, password, outletName: form.name.trim() });
        } catch (seatErr) {
          if (/already registered/i.test(seatErr.message)) {
            throw new Error('That manager email is already registered — use a different one, or add the manager later from Staff.');
          }
          // Other seat failures — owner creates it later from Staff.
        }
      }
      setOpen(false);
      setForm(EMPTY_BRANCH);
      setMakeSeat(true);
      loadBase();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onPrintAllQr() {
    if (branchTables.length === 0 || printing) return;
    setPrinting(true);
    try {
      for (const t of branchTables) {
        const blob = await fetchQrPng(t.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `table-${t.tableNumber}-qr.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPrinting(false);
    }
  }

  if (!rest) return <CircularProgress />;

  const shownBranch = branches.find((b) => b.id === branchFilter) ?? branches[0] ?? null;
  const isOpen = openNow(shownBranch);
  const maxRevenue = Math.max(1, ...revenue.map((p) => Number(p.revenue ?? 0)));
  const coverSrc = rest.coverUrl || photos[0]?.src || null;
  const showCoverFallback = !coverSrc && !coverFailed;
  const firstTable = branchTables[0] ?? null;
  const qrMenuUrl = firstTable ? `/r/${rest.slug}/t/${firstTable.tableNumber}?b=${firstTable.branchId ?? shownBranch?.id}` : null;

  const todayStr = todayKolkata();
  const revToday = revenue.find((p) => p.date === todayStr);
  const revYesterday = revenue
    .filter((p) => p.date < todayStr)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const delta =
    revToday && revYesterday && Number(revYesterday.revenue) > 0
      ? ((Number(revToday.revenue) - Number(revYesterday.revenue)) / Number(revYesterday.revenue)) * 100
      : null;

  const delayed = liveOrders.filter((o) => LIVE_STATUSES.includes(o.status) && elapsedMin(o.placedAt) >= 10).length;
  const totalTables = setup?.tableCount ?? branchTables.length;
  const vacant = Math.max(0, totalTables - occupiedCount);
  const occPct = totalTables > 0 ? Math.round((occupiedCount / totalTables) * 100) : 0;
  const menuDone = (setup?.itemCount ?? 0) > 0;
  const tablesDone = (setup?.tableCount ?? 0) > 0;

  const chartRows = revRange === 'today' ? (revToday ? [revToday] : []) : revenue.slice(-31);

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* breadcrumb + connectivity strip (full-bleed) */}
      <Box
        sx={{
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          bgcolor: '#FAF2EE',
          py: 1.25,
        }}
      >
        <Box
          sx={{
            maxWidth: 1280,
            mx: 'auto',
            px: { xs: 2, sm: 3, lg: 4 },
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
            <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} size="small" sx={{ bgcolor: '#fff', borderRadius: 2 }}>
              All Restaurants
            </Button>
            <Typography variant="body2" component="span" fontWeight={600} fontSize={12} color="text.secondary" noWrap>
              My restaurants <strong style={{ color: '#1E1B19' }}>› {rest.name}</strong>
              {shownBranch && (
                <Chip component="span" size="small" label={`#${String(shownBranch.id).slice(0, 8).toUpperCase()}`} sx={{ ml: 1, fontFamily: 'monospace', fontSize: 10 }} />
              )}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              size="small"
              icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: liveOrders.length > 0 ? '#00632B' : '#8D7168', ml: 1 }} />}
              label={liveOrders.length > 0 ? 'Live Sync' : 'No live orders'}
              sx={{ bgcolor: liveOrders.length > 0 ? 'rgba(17,126,59,.12)' : '#EEE7E3', color: liveOrders.length > 0 ? '#00632B' : 'text.secondary', fontWeight: 800, fontSize: 10 }}
            />
            <Chip size="small" icon={<Sym name="cloud_done" size={14} />} label="Auto-sync ON · 30s" variant="outlined" sx={{ fontSize: 10 }} />
          </Box>
        </Box>
      </Box>

      {/* cover hero (full-bleed) */}
      <Box
        sx={{
          position: 'relative',
          height: { xs: 220, md: 240 },
          width: '100vw',
          marginLeft: 'calc(-50vw + 50%)',
          overflow: 'hidden',
          bgcolor: '#3A2A20',
        }}
      >
        {coverSrc ? (
          <Box component="img" src={coverSrc} alt={rest.name} loading="lazy" decoding="async"
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : showCoverFallback ? (
          <Box
            component="img"
            src={COVER_FALLBACK}
            alt={rest.name}
            loading="lazy"
            decoding="async"
            onError={() => setCoverFailed(true)}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 800, color: '#C2410C' }}>
            {(rest.name?.[0] ?? '·').toUpperCase()}
          </Box>
        )}
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,12,8,.95) 0%, rgba(20,12,8,.55) 55%, transparent 100%)' }} />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(194,65,12,.2), transparent 60%)' }} />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'flex-end' },
            gap: 1.5,
            maxWidth: 1280,
            mx: 'auto',
            width: '100%',
            p: { xs: 2, md: 3 },
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: '#C2410C', width: 56, height: 56, borderRadius: 2, fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
              {rest.name.slice(0, 2).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="h4" fontWeight={800} fontSize={{ xs: 24, md: 28 }} sx={{ color: '#fff', lineHeight: 1.1 }}>
                  {rest.name}
                </Typography>
                {branches.length > 1 && (
                  <FormControl size="small" sx={{ bgcolor: 'rgba(0,0,0,.45)', borderRadius: 2, minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: 2, color: '#fff', fontSize: 12 }, '& .MuiSvgIcon-root': { color: '#fff' } }}>
                    <Select value={branchFilter} displayEmpty onChange={(e) => setBranchFilter(e.target.value)} sx={{ color: '#fff' }}>
                      <MenuItem value="">All locations</MenuItem>
                      {branches.map((b) => (
                        <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {isOpen !== null && (
                  <Chip
                    size="small"
                    icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isOpen ? '#00632B' : '#8D7168', ml: 1 }} />}
                    label={isOpen ? 'OPEN NOW' : 'CLOSED'}
                    sx={{ bgcolor: isOpen ? '#95F8A7' : '#E9E1DD', color: isOpen ? '#00210A' : '#59413A', fontWeight: 800, fontSize: 10 }}
                  />
                )}
              </Box>
              <Typography variant="body2" fontWeight={600} fontSize={12} sx={{ display: 'block', mt: 0.5, color: '#fff' }}>
                Slug: /r/{rest.slug} · Currency: {rest.currency} (₹) · GST {rest.taxPercentage}%
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-end', flexShrink: 0 }}>
            <Button
              size="small"
              variant="contained"
              endIcon={<Sym name="arrow_outward" size={16} />}
              disabled={!qrMenuUrl}
              title={qrMenuUrl ? 'Open the live customer menu' : 'Add a table first'}
              component={qrMenuUrl ? RouterLink : 'button'}
              to={qrMenuUrl ?? undefined}
              sx={{ bgcolor: '#fff', color: '#1E1B19', backgroundImage: 'none', borderRadius: 2, fontWeight: 800, '&:hover': { bgcolor: '#FFF5ED' } }}
            >
              View Live QR Menu
            </Button>
            <Button size="small" variant="contained" startIcon={<Sym name="qr_code_scanner" size={16} />} onClick={onPrintAllQr} disabled={branchTables.length === 0 || printing}
              sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #9B2F00, #C2410C)' }}>
              {printing ? 'Preparing…' : 'Print All QR Codes'}
            </Button>
            <Button size="small" variant="contained" component={RouterLink} to={`/admin/restaurants/${id}/menu`}
              sx={{ bgcolor: 'rgba(255,255,255,.25)', color: '#fff', backgroundImage: 'none', borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,255,255,.4)' } }}>
              86 Dish
            </Button>
          </Box>
        </Box>
      </Box>

      {/* photo strip */}
      {photos.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 0.5 }}>
            {photos.slice(0, 5).map((p) => (
              <Box
                key={p.src}
                onClick={() => { setFullPhoto(p); setGalleryOpen(true); }}
                sx={{ width: 132, height: 96, flexShrink: 0, borderRadius: 2, overflow: 'hidden', position: 'relative', border: 1, borderColor: 'divider', cursor: 'pointer' }}
              >
                <Box component="img" src={p.src} alt={p.name} loading="lazy" decoding="async"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <Typography variant="caption" fontSize={10} fontWeight={700} sx={{ position: 'absolute', bottom: 6, left: 8, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.7)' }}>
                  {p.name}
                </Typography>
              </Box>
            ))}
            <Button onClick={() => setGalleryOpen(true)} sx={{ width: 132, height: 96, flexShrink: 0, borderRadius: 2, bgcolor: '#EEE7E3', fontWeight: 800 }}>
              + View Gallery ({photos.length})
            </Button>
          </Box>
        </Box>
      )}

      {/* sticky pills */}
      <Box className="sticky-bar" sx={{ bgcolor: '#FFF8F5', py: 1.5, zIndex: 5, scrollMarginTop: 120 }}>
        <Box className="no-scrollbar" sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
          {[
            ['Overview', '#top', null, null, 'dashboard'],
            ['Live Orders', '#live', liveOrders.length > 0 ? `${liveOrders.length} KOTs` : null, 'red', 'receipt_long'],
            ['Menu & Categories', '#menu-sec', setup ? `${setup.itemCount} dishes` : null, 'grey', 'restaurant_menu'],
            ['Tables & Floor', '#tables-sec', totalTables > 0 ? `${occupiedCount}/${totalTables}` : null, 'blue', 'table_restaurant'],
            ['Staff Roster', '#staff-sec', staff ? `${staff.filter((u) => u.active).length} active` : null, 'green', 'badge'],
            ['Settings & GST', '#settings-sec', null, null, 'settings'],
          ].map(([label, href, pill, kind, icon], i) => (
            <Button
              key={label}
              href={href}
              startIcon={<Sym name={icon} size={16} />}
              variant={i === 0 ? 'contained' : 'outlined'}
              sx={{ flexShrink: 0, borderRadius: 2, fontWeight: 800, whiteSpace: 'nowrap', ...(i !== 0 && { bgcolor: '#fff' }) }}
            >
              {label}
              {pill && kind === 'grey' && (
                <Typography component="span" variant="caption" fontSize={10} color="text.secondary" fontWeight={400} sx={{ ml: 0.75 }}>
                  {pill}
                </Typography>
              )}
              {pill && kind === 'red' && (
                <Box component="span" sx={{ ml: 0.75, px: 1, py: 0.25, borderRadius: 999, bgcolor: '#C2410C', color: '#fff', fontSize: 10, fontWeight: 800 }}>
                  {pill}
                </Box>
              )}
              {pill && kind === 'blue' && (
                <Box component="span" sx={{ ml: 0.75, px: 1, py: 0.25, borderRadius: 999, bgcolor: 'rgba(0,106,99,.12)', color: '#006A63', fontSize: 10, fontWeight: 800 }}>
                  {pill}
                </Box>
              )}
              {pill && kind === 'green' && (
                <Box component="span" sx={{ ml: 0.75, fontSize: 10, fontWeight: 800, color: '#00632B' }}>
                  {pill}
                </Box>
              )}
            </Button>
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box id="top" sx={{ scrollMarginTop: 140 }} />

      {/* readiness */}
      {setup && (setup.itemCount === 0 || (setup.tableCount === 0 && !tablesSkipped) || (setup.kitchenCount + setup.waiterCount === 0 && !teamSkipped)) && (
        <Card sx={{ borderRadius: 2, mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Sym name="checklist" size={20} /> Store Readiness & Compliance Check
              </Typography>
              <Typography variant="caption" fontSize={10} color="text.secondary">
                Auto-scanned {scannedAt ? scannedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'just now'}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
              {[
                { ok: menuDone, title: 'Menu CDN & Photos', sub: `${setup.itemCount} items · ${setup.photoCount} with photos`, to: `/admin/restaurants/${id}/menu`, cta: 'Build menu' },
                { ok: tablesDone || tablesSkipped, title: 'Tables & QR Stands', sub: tablesSkipped && setup.tableCount === 0 ? 'Takeaway-only mode' : `${setup.tableCount} tables ready`, to: shownBranch ? `/admin/branches/${shownBranch.id}/tables` : null, cta: 'Add tables' },
                { ok: (setup.kitchenCount + setup.waiterCount) > 0, title: 'Kitchen & Floor Team', sub: `${setup.kitchenCount} kitchen · ${setup.waiterCount} waiters`, to: `/admin/staff?restaurantId=${id}`, cta: 'Add staff' },
              ].map((s) => (
                <Box key={s.title} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.25, alignItems: 'center' }}>
                  {s.ok
                    ? <CheckCircleIcon color="success" />
                    : <Sym name="radio_button_unchecked" size={20} color="#9B2F00" />}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800} fontSize={12}>{s.title}</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">{s.sub}</Typography>
                  </Box>
                  {!s.ok && s.to && (
                    <Button size="small" variant="outlined" component={RouterLink} to={s.to} sx={{ borderRadius: 2, flexShrink: 0 }}>
                      {s.cta}
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 4 metrics */}
      {loadingOv ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' }, mb: 2 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />)}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' }, mb: 2 }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight={600} fontSize={12} color="text.secondary">Today&apos;s GMV (Gross Sales)</Typography>
                <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="currency_rupee" size={18} />
                </Avatar>
              </Box>
              <Typography variant="h4" fontWeight={800} fontSize={28} sx={{ mt: 1 }}>{inr(summary?.todayRevenue)}</Typography>
              <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ color: delta != null && delta >= 0 ? '#00632B' : 'text.secondary' }}>
                {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs yesterday` : `${summary?.paymentsToday ?? 0} payment(s) today`}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight={600} fontSize={12} color="text.secondary">Live Table Occupancy</Typography>
                <Avatar sx={{ bgcolor: 'rgba(0,106,99,.12)', color: '#006A63', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="table_bar" size={18} />
                </Avatar>
              </Box>
              <Typography variant="h4" fontWeight={800} fontSize={28} sx={{ mt: 1 }}>
                {occupiedCount} <Typography component="span" variant="h6" color="text.secondary">/ {totalTables}</Typography>
              </Typography>
              <Box sx={{ height: 6, borderRadius: 999, bgcolor: '#EEE7E3', mt: 1 }}>
                <Box sx={{ height: '100%', width: `${occPct}%`, borderRadius: 999, bgcolor: '#006A63' }} />
              </Box>
              <Typography variant="caption" fontSize={10} color="text.secondary">
                {vacant} vacant · {isOpen === true ? 'Open now' : isOpen === false ? 'Currently closed' : 'Hours not set'}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight={600} fontSize={12} color="text.secondary">Kitchen Live KOTs</Typography>
                <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="skillet" size={18} />
                </Avatar>
              </Box>
              <Typography variant="h4" fontWeight={800} fontSize={28} sx={{ mt: 1 }}>
                {liveOrders.length} <Typography component="span" variant="body2" color="text.secondary">Active</Typography>
              </Typography>
              <Typography variant="caption" fontSize={10} color="text.secondary">
                Avg prep {summary?.avgPrepMinutes != null ? `${summary.avgPrepMinutes} mins` : '—'}
                {delayed > 0 && <strong style={{ color: '#BA1A1A' }}> · {delayed} Delayed</strong>}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontWeight={600} fontSize={12} color="text.secondary">Balance Due</Typography>
                <Avatar sx={{ bgcolor: dueTotal > 0 ? '#FFDAD6' : 'rgba(17,126,59,.12)', color: dueTotal > 0 ? '#93000A' : '#00632B', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="payments" size={18} />
                </Avatar>
              </Box>
              <Typography variant="h4" fontWeight={800} fontSize={28} sx={{ mt: 1, color: dueTotal > 0 ? '#9B2F00' : 'inherit' }}>
                {inr(dueTotal)}
              </Typography>
              <Typography variant="caption" fontSize={10} color="text.secondary">
                {dueTotal > 0 ? 'Collect before closing tables' : 'Nothing outstanding'}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* main 70/30 */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '8fr 4fr' }, mb: 2 }}>
        <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
          {/* revenue */}
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={800} fontSize={22}>Revenue Velocity</Typography>
                  <Typography variant="body2" fontSize={12} color="text.secondary">Completed payments per day</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
                  {[['today', 'Today'], ['week', 'Last 7 Days'], ['month', 'Month']].map(([v, l]) => (
                    <Button key={v} size="small" onClick={() => setRevRange(v)}
                      variant={revRange === v ? 'contained' : 'text'}
                      sx={{ borderRadius: 2, fontWeight: 800, fontSize: 12 }}>
                      {l}
                    </Button>
                  ))}
                </Box>
              </Box>
              {revLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : chartRows.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No revenue yet.</Typography>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 190, minWidth: Math.max(320, chartRows.length * 44), pt: 1 }}>
                    {chartRows.map((p) => (
                      <Box key={p.date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
                        <Typography variant="caption" fontWeight={700} fontSize={10} noWrap>
                          {Number(p.revenue) > 0 ? inr(p.revenue) : ''}
                        </Typography>
                        <Box sx={{
                          width: '100%',
                          maxWidth: 28,
                          height: Math.max(6, (Number(p.revenue ?? 0) / maxRevenue) * 130),
                          borderRadius: 1,
                          bgcolor: p.date === todayStr ? '#9B2F00' : '#C2410C',
                          opacity: Number(p.revenue) > 0 ? 1 : 0.25,
                        }} />
                        <Typography variant="caption" fontSize={10} color={p.date === todayStr ? 'primary.main' : 'text.secondary'} fontWeight={p.date === todayStr ? 800 : 400}>
                          {dayLabel(p.date)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* top dishes */}
          <Card sx={{ borderRadius: 2 }} id="menu-sec" >
            <Box sx={{ scrollMarginTop: 150 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} fontSize={22}>Top Selling Dishes Today</Typography>
                    <Typography variant="body2" fontSize={12} color="text.secondary">Based on live QR orders</Typography>
                  </Box>
                  <Button size="small" component={RouterLink} to={`/admin/restaurants/${id}/menu`} sx={{ fontWeight: 800, color: '#9B2F00' }}>
                    View Full {setup ? `${setup.itemCount} Items` : ''} ›
                  </Button>
                </Box>
                {topItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No sales yet today.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {(() => {
                      const max = Math.max(1, ...topItems.map((t) => Number(t.revenue ?? 0)));
                      return topItems.map((item, i) => (
                        <Box key={item.name}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 0 }}>
                              {item.name in vegByName && <VegMark veg={vegByName[item.name]} size={14} />}
                              <Typography variant="body1" fontWeight={700} fontSize={16} noWrap>
                                {item.name}
                              </Typography>
                              {i === 0 && <Chip size="small" label="Bestseller #1" sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', fontWeight: 800, fontSize: 10 }} />}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
                              <Typography variant="body2" fontSize={12} color="text.secondary">{item.quantity} orders</Typography>
                              <Typography variant="body1" fontWeight={800} fontSize={16}>{inr(item.revenue)}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ height: 8, borderRadius: 999, bgcolor: '#EEE7E3' }}>
                            <Box sx={{ height: '100%', width: `${Math.max(4, (Number(item.revenue) / max) * 100)}%`, borderRadius: 999, bgcolor: '#C2410C' }} />
                          </Box>
                        </Box>
                      ));
                    })()}
                  </Box>
                )}
              </CardContent>
            </Box>
          </Card>

          {/* live orders */}
          <Card sx={{ borderRadius: 2 }} id="live">
            <Box sx={{ scrollMarginTop: 150 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: liveOrders.length > 0 ? '#00632B' : '#8D7168' }} />
                    <Typography variant="h6" fontWeight={800} fontSize={22}>
                      Active Table Tickets & Orders
                    </Typography>
                    <Chip size="small" label="Polling 30s" sx={{ bgcolor: '#F4ECE8', fontSize: 10 }} />
                  </Box>
                  <Button size="small" variant="outlined" startIcon={<Sym name="refresh" size={16} />} onClick={() => { loadOverview(); }} sx={{ borderRadius: 2, fontWeight: 800 }}>
                    Manual Refresh
                  </Button>
                </Box>
                {liveOrders.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No live orders right now.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {liveOrders.slice(0, 10).map((o) => {
                      const mins = elapsedMin(o.placedAt);
                      const isDelayed = LIVE_STATUSES.includes(o.status) && mins >= 10;
                      return (
                        <Box
                          key={o.id}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            bgcolor: isDelayed ? 'rgba(186,26,26,.06)' : '#FAF2EE',
                            borderLeft: isDelayed ? 4 : 0,
                            borderColor: '#BA1A1A',
                            display: 'flex',
                            gap: 1.5,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                            <Avatar sx={{ bgcolor: isDelayed ? '#BA1A1A' : '#006A63', borderRadius: 2, width: 48, height: 48, fontWeight: 800 }}>
                              {o.tableNumber}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body1" fontWeight={800} fontSize={16}>
                                {o.orderNumber} · {elapsedLabel(o.placedAt)} active
                              </Typography>
                              <Typography variant="body2" fontSize={12} color="text.secondary" noWrap>
                                {(o.items ?? []).slice(0, 3).map((it) => `${it.menuItemName} × ${it.quantity}`).join(', ') || o.status}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="body1" fontWeight={800} fontSize={16}>{inr(o.totalAmount)}</Typography>
                              <Chip size="small" label={o.status} color={isDelayed ? 'error' : o.status === 'READY' ? 'success' : 'default'} sx={{ fontSize: 10, fontWeight: 800 }} />
                            </Box>
                            <Button size="small" variant={isDelayed ? 'contained' : 'outlined'} color={isDelayed ? 'error' : 'primary'}
                              onClick={() => navigate('/kitchen')} sx={{ borderRadius: 2, fontWeight: 800 }}>
                              {isDelayed ? 'Open KDS' : 'View KOT'}
                            </Button>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Box>
          </Card>

          {/* order history */}
          <Card sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={800} fontSize={22} sx={{ flexGrow: 1 }}>Order history</Typography>
                <TextField size="small" type="date" label="Date" value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" select label="Status" value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)} sx={{ minWidth: 140 }}
                  slotProps={{ inputLabel: { shrink: true }, select: { native: true } }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </TextField>
              </Box>
              {historyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
              ) : history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No orders match these filters.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  {history.map((o) => (
                    <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="body2" noWrap>{o.orderNumber} · T{o.tableNumber} · {o.status}</Typography>
                      <Typography variant="body2" fontWeight={700}>{inr(o.totalAmount)}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* right 30% */}
        <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
                <Sym name="bolt" size={20} /> Fast Operations
              </Typography>
              {[
                ['Manage Live Menu', 'Update prices & active taxes', 'edit_note', `#C2410C`, `/admin/restaurants/${id}/menu`],
                ['Open Kitchen KDS Display', 'Live station dockets on TV', 'tv', '#006A63', '/kitchen'],
                ['Floor Captain Tablet View', 'Touch grid table assignment', 'tablet_android', '#1E1B19', '/waiter'],
              ].map(([t, b, icon, color, to]) => (
                <Box key={t} component={RouterLink} to={to}
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', mb: 1, textDecoration: 'none', color: 'inherit' }}>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: '#fff', color, borderRadius: 2, width: 36, height: 36 }}>
                      <Sym name={icon} size={18} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={800} fontSize={14}>{t}</Typography>
                      <Typography variant="caption" fontSize={10} color="text.secondary">{b}</Typography>
                    </Box>
                  </Box>
                  <Sym name="chevron_right" size={18} />
                </Box>
              ))}
              <Button fullWidth variant="outlined" startIcon={<Sym name="download" size={18} />} onClick={onPrintAllQr}
                disabled={branchTables.length === 0 || printing} sx={{ borderRadius: 2, fontWeight: 800 }}>
                {printing ? 'Preparing…' : `Batch Download Table QRs (${branchTables.length})`}
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }} id="tables-sec">
            <Box sx={{ scrollMarginTop: 150 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ mb: 1 }}>
                  Tables & Floor — {shownBranch?.name ?? '…'}
                </Typography>
                <Typography variant="body2" fontSize={12} color="text.secondary" sx={{ mb: 1.5 }}>
                  {occupiedCount}/{totalTables} occupied · {vacant} vacant
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {shownBranch && (
                    <Button size="small" variant="contained" component={RouterLink} to={`/admin/branches/${shownBranch.id}/tables`} sx={{ borderRadius: 2, fontWeight: 800 }}>
                      Tables & QR
                    </Button>
                  )}
                  <Button size="small" variant="outlined" component={RouterLink} to={`/admin/restaurants/${id}/menu`} sx={{ borderRadius: 2, fontWeight: 700 }}>
                    Menu
                  </Button>
                </Box>
                {(branches ?? []).filter((b) => b.id !== shownBranch?.id).slice(0, 3).map((b) => (
                  <Box key={b.id} sx={{ mt: 1, p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>{b.name}</Typography>
                      <Typography variant="caption" fontSize={10} color="text.secondary" noWrap>
                        {[b.address, b.phone].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                    <Button component={RouterLink} to={`/admin/branches/${b.id}/tables`} size="small" variant="outlined" sx={{ borderRadius: 2 }}>
                      Tables & QR
                    </Button>
                  </Box>
                ))}
              </CardContent>
            </Box>
          </Card>

          <Card sx={{ borderRadius: 2 }} id="staff-sec">
            <Box sx={{ scrollMarginTop: 150 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={800} fontSize={18}>Staff On-Duty</Typography>
                  <Chip size="small" label={staff ? `${staff.filter((u) => u.active).length} Active` : '…'} sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', fontWeight: 800, fontSize: 10 }} />
                </Box>
                {!staff ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
                ) : staff.length === 0 ? (
                  <EmptyState icon="👥" title="No staff here yet"
                    body="Add a manager for this location — they get a login locked to this location only."
                    actionLabel="Add manager"
                    onAction={() => navigate(`/admin/staff?restaurantId=${id}${branchFilter ? `&branchId=${branchFilter}&create=manager` : ''}`)} />
                ) : (
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {staff.slice(0, 3).map((u) => (
                      <Box key={u.userId} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Box sx={{ position: 'relative' }}>
                          <Avatar sx={{ bgcolor: '#C2410C', fontWeight: 800, width: 40, height: 40 }}>
                            {u.fullName?.[0]?.toUpperCase()}
                          </Avatar>
                          {u.active && <Box sx={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', bgcolor: '#00632B', border: '2px solid #FAF2EE' }} />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>{u.fullName}</Typography>
                          <Typography variant="caption" fontSize={10} color="text.secondary" noWrap>
                            {u.role}{u.branchName ? ` · ${u.branchName}` : ''}{!u.active ? ' · disabled' : ''}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                <Button fullWidth variant="outlined" startIcon={<AddIcon />} sx={{ mt: 1.5, borderRadius: 2, fontWeight: 800 }}
                  onClick={() => navigate(`/admin/staff?restaurantId=${id}${branchFilter ? `&branchId=${branchFilter}&create=manager` : ''}`)}>
                  + Add Manager / Staff
                </Button>
              </CardContent>
            </Box>
          </Card>

          <Card sx={{ borderRadius: 2 }} id="settings-sec">
            <Box sx={{ scrollMarginTop: 150 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} fontSize={18} sx={{ mb: 1.5 }}>Settings & GST</Typography>
                <ImageStepPicker
                  logoUrl={rest.logoUrl ?? ''}
                  coverUrl={rest.coverUrl ?? ''}
                  onLogo={(u) => onImageUrl('logo', u)}
                  onCover={(u) => onImageUrl('cover', u)}
                  onPickLogo={(f) => onUploadImage('logo', f)}
                  onPickCover={(f) => onUploadImage('cover', f)}
                />
                <Box component="form" onSubmit={onSaveDetails} sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
                  <TextField label="Description" multiline rows={2} size="small" value={edit.description}
                    onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))} />
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    <TextField label="Category" select size="small" value={edit.category}
                      onChange={(e) => setEdit((s) => ({ ...s, category: e.target.value }))}>
                      <MenuItem value="">—</MenuItem>
                      {RESTAURANT_CATEGORIES.map((c) => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </TextField>
                    <CuisineField size="small" value={edit.cuisine}
                      onChange={(v) => setEdit((s) => ({ ...s, cuisine: v }))} />
                  </Box>
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                    <TextField label="Owner name" size="small" value={edit.ownerName}
                      onChange={(e) => setEdit((s) => ({ ...s, ownerName: e.target.value }))} />
                    <TextField label="Owner phone" size="small" value={edit.ownerPhone}
                      onChange={(e) => setEdit((s) => ({ ...s, ownerPhone: e.target.value }))} />
                    <TextField label="Owner email" size="small" value={edit.ownerEmail}
                      onChange={(e) => setEdit((s) => ({ ...s, ownerEmail: e.target.value }))} />
                  </Box>
                  <TextField label="GST %" type="number" size="small" value={edit.taxPercentage}
                    onChange={(e) => setEdit((s) => ({ ...s, taxPercentage: e.target.value }))} />
                  <Button type="submit" variant="outlined" size="small" disabled={saving} sx={{ borderRadius: 2, fontWeight: 800 }}>
                    {saving ? 'Saving…' : 'Save details'}
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" fontWeight={800} fontSize={14}>Locations ({branches?.length ?? 0})</Typography>
                  {!pinned && (
                    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>
                      Add location
                    </Button>
                  )}
                </Box>
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {(branches ?? []).map((b) => (
                    <Box key={b.id} sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>{b.name}</Typography>
                        <Typography variant="caption" fontSize={10} color="text.secondary" noWrap>
                          {[b.address, b.phone].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <Button component={RouterLink} to={`/admin/branches/${b.id}/tables`} size="small" variant="outlined" sx={{ borderRadius: 2 }}>
                        Tables & QR
                      </Button>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Box>
          </Card>
        </Box>
      </Box>

      <Box sx={{ mt: 1 }}>
        <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} variant="text">
          All restaurants
        </Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add location</DialogTitle>
        <Box component="form" onSubmit={onCreateBranch}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Location name" required value={form.name} onChange={setF('name')} placeholder="Koramangala" />
            <TextField label="Address" multiline rows={2} value={form.address} onChange={setF('address')} />
            <TextField label="Phone" value={form.phone} onChange={setF('phone')} />
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
              <TextField label="Opens (HH:mm)" value={form.openingTime} onChange={setF('openingTime')} placeholder="11:00" />
              <TextField label="Closes (HH:mm)" value={form.closingTime} onChange={setF('closingTime')} placeholder="23:00" />
            </Box>
            <FormControlLabel
              control={<Checkbox checked={makeSeat} onChange={(e) => setMakeSeat(e.target.checked)} />}
              label={<Typography variant="body2">Also create a manager login for this location</Typography>}
            />
            {makeSeat && (
              <TextField label="Manager email" type="email" required={makeSeat} value={form.managerEmail} onChange={setF('managerEmail')}
                placeholder="e.g. batichokhadelhi@gmail.com"
                helperText="Becomes this location's login — must be a real, unique email." />
            )}
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <SeatCredentialsDialog
        key={creds?.email ?? 'closed'}
        open={!!creds}
        email={creds?.email}
        password={creds?.password}
        outletName={creds?.outletName}
        onDone={() => setCreds(null)}
      />

      <Dialog open={galleryOpen} onClose={() => { setGalleryOpen(false); setFullPhoto(null); }} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" fontWeight={800} sx={{ flexGrow: 1 }}>
            {fullPhoto ? fullPhoto.name : `Photos (${photos.length})`}
          </Typography>
          {fullPhoto && <Button size="small" onClick={() => setFullPhoto(null)}>Grid</Button>}
        </DialogTitle>
        <DialogContent>
          {fullPhoto ? (
            <Box component="img" src={fullPhoto.src} alt={fullPhoto.name}
              sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 2, bgcolor: 'action.hover' }} />
          ) : (
            <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
              {photos.map((p) => (
                <Box key={p.src} onClick={() => setFullPhoto(p)}
                  sx={{ aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', cursor: 'pointer' }}>
                  <Box component="img" src={p.src} alt={p.name} loading="lazy" decoding="async"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setGalleryOpen(false); setFullPhoto(null); }}>Close</Button>
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
          ['space_dashboard', 'Dashboard', '/admin'],
          ['storefront', 'Restaurants', '/admin/restaurants'],
          ['countertops', 'KDS', '/kitchen'],
          ['calendar_month', 'Roster', '/admin/staff'],
        ].map(([icon, label, to]) => (
          <Button key={label} component={RouterLink} to={to}
            sx={{ flexDirection: 'column', gap: 0, minWidth: 56, minHeight: 44, color: 'text.secondary', fontSize: 10 }}>
            <Sym name={icon} size={22} />
            {label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
