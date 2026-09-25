import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Skeleton,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Link as RouterLink, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import VegMark from '../../components/VegMark.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getDashboard, getRestaurantSummaries, getRevenue, getTopItems } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';
import { getPublicMenu } from '../../services/ordering.js';
import { listPayments } from '../../services/payment.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import { listTables } from '../../services/tables.js';
import { countOccupied } from '../../services/waiter.js';

const LIVE_STATUSES = ['PLACED', 'ACCEPTED', 'PREPARING'];

const DISH_FALLBACKS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCfLIvhrwPMizxbNeZQzYv8VCUXFLBSXAYVOhkSXq0l8MXO4ddKtw6-YOacmgDNebBb37esaqE0JXLKUHgJhFUKeuZjcxTy5Q1qh477eW4gpuXgYfoxByyEgxVC2jFcqp9I6kIq0mWPmk05BHhc7oRiQQACk6LScPrzBwS5fEPXwm_W-UY3dnuBFZNcsYjYJlWPvFAPhzKqxhcmu631NQmDaUWixVL1v93dsMCbz9P-KiZ4aUiFPjcG',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAwlkFXTQt-vuw2Jii1ow7B8ZuJ8e2KheFbJGYNVl0mEwB_tJLQ_bb_jq3DPeViEzKRerB17wbr2F5VBwgPmkhgkuSjzqpVXdeXoCGcUgn31-DM6X3aFzoEGs5M1cxuqU8JTo9EbR074kVv5BDpfqPLqtWMDFMncUEJxh-p-KY1bk5REj92b7Vgvzy4eixf6Ics_NB5Lv1NlYyrOEQQXdWJi5YEz_hGEr5Fa86LscLTdpjPTNtK0DxZ',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAg0arttNb-nMBXSm_G6PeWbSnB2Oz2Xrg328q1YpAaTdNM85vxYEt18mpOJoUKeOqheEIqeM0hl54KhVM5WrqgnoVwCZ7vrX-isWtpKNIsIL8PPJU_dDmoktAgUaL-Gw0iAzrQQ-SIRb5YMQyHTCy54VvJjbOiGhFEOVy6SUgOfk9iG0MnKy6KM4Aa4FxboSH7YPjx8Og0xzcOdhh3-eLsYQ8k9u7NTlGlPAuchJsKfbyHF_TPYXoe',
];

const todayKolkata = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const inr0 = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const inr2 = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });

const longDate = (iso) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

function elapsedMin(placedAt) {
  try {
    return Math.max(0, (Date.now() - new Date(placedAt).getTime()) / 60000);
  } catch {
    return 0;
  }
}

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

function shiftLabel() {
  try {
    const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    if (h >= 19 && h < 23) return 'Peak Dinner Shift underway';
    if (h >= 12 && h < 16) return 'Lunch rush underway';
    if (h >= 7 && h < 12) return 'Morning service live';
    return 'Live service running';
  } catch {
    return 'Live service running';
  }
}

export default function AdminHome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [todayOrders, setTodayOrders] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [sites, setSites] = useState(null); // [{ rest, summary, branches, tables, occupied }]
  const [vegMap, setVegMap] = useState({});
  const [payCounts, setPayCounts] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [d, r, t, today, live, sums, rests] = await Promise.all([
        getDashboard(),
        getRevenue({ period: 'week' }),
        getTopItems({ limit: 4 }),
        searchOrders({ date: todayKolkata() }).catch(() => ({ data: [] })),
        searchOrders({ liveOnly: true }).catch(() => ({ data: [] })),
        getRestaurantSummaries().catch(() => ({ data: [] })),
        listRestaurants().catch(() => ({ data: [] })),
      ]);
      setSummary(d.data);
      setRevenue(r.data ?? []);
      setTopItems((t.data ?? []).slice(0, 4));
      setTodayOrders((today.data ?? []).slice(0, 200));
      setLiveOrders(live.data ?? []);
      const list = rests.data ?? [];
      const sumById = Object.fromEntries((sums.data ?? []).map((s) => [s.restaurantId, s]));
      const per = await Promise.all(
        list.map(async (rest) => {
          const b = await listBranches(rest.id).catch(() => ({ data: [] }));
          const blist = b.data ?? [];
          const tableLists = await Promise.all(blist.map((x) => listTables(x.id).catch(() => ({ data: [] }))));
          const tables = tableLists.flatMap((x) => (x.data ?? []).filter((tbl) => tbl.active !== false));
          return {
            rest,
            summary: sumById[rest.id] ?? null,
            branches: blist,
            tables,
            occupied: await countOccupied(blist.map((x) => x.id)).catch(() => 0),
          };
        }),
      );
      setSites(per);
      // veg + photo map from the primary outlet's menu (best effort)
      if (list[0]?.slug) {
        getPublicMenu(list[0].slug)
          .then((m) => {
            const map = {};
            for (const c of m.data?.categories ?? []) {
              for (const i of c.items ?? []) {
                if (i?.name) map[i.name] = { veg: i.vegetarian, img: i.imageUrl };
              }
            }
            setVegMap(map);
          })
          .catch(() => {});
      }
      // shift payment split (best effort; hidden when unavailable)
      listPayments({ date: todayKolkata() })
        .then((p) => {
          const arr = p.data ?? [];
          if (arr.length === 0) {
            setPayCounts(null);
            return;
          }
          const counts = { UPI: 0, CARD: 0, CASH: 0, OTHER: 0 };
          for (const pay of arr) {
            const m = String(pay.method ?? pay.paymentMethod ?? pay.mode ?? '').toUpperCase();
            if (m.includes('UPI')) counts.UPI += 1;
            else if (m.includes('CARD')) counts.CARD += 1;
            else if (m.includes('CASH') || m.includes('COUNTER')) counts.CASH += 1;
            else counts.OTHER += 1;
          }
          setPayCounts(counts.UPI + counts.CARD + counts.CASH > 0 ? counts : null);
        })
        .catch(() => setPayCounts(null));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  // Live board stays fresh while the dashboard is open.
  useEffect(() => {
    if (!user) return undefined;
    const t = setInterval(() => {
      searchOrders({ liveOnly: true })
        .then((r) => setLiveOrders(r.data ?? []))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [user]);

  if (loading) return <CircularProgress />;
  if (!user) return <Navigate to="/login" replace />;

  const firstName = user.fullName?.split(' ')[0] ?? 'Owner';
  const todayStr = todayKolkata();
  const revToday = revenue.find((p) => p.date === todayStr);
  const revYesterday = revenue
    .filter((p) => p.date < todayStr)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const delta =
    revToday && revYesterday && Number(revYesterday.revenue) > 0
      ? ((Number(revToday.revenue) - Number(revYesterday.revenue)) / Number(revYesterday.revenue)) * 100
      : null;
  const weekTotal = revenue.reduce((n, p) => n + Number(p.revenue ?? 0), 0);
  const maxRevenue = Math.max(1, ...revenue.map((p) => Number(p.revenue ?? 0)));

  const totalTables = (sites ?? []).reduce((n, s) => n + s.tables.length, 0);
  const totalOccupied = (sites ?? []).reduce((n, s) => n + s.occupied, 0);
  const occPct = totalTables > 0 ? Math.round((totalOccupied / totalTables) * 100) : 0;
  const delayed = liveOrders.filter(
    (o) => LIVE_STATUSES.includes(o.status) && elapsedMin(o.placedAt) >= 10,
  );
  const primary = (sites ?? [])[0] ?? null;
  const primaryBranch = primary?.branches[0] ?? null;
  const floorTables = (primary?.tables ?? []).slice(0, 12);
  const amountByTable = {};
  for (const o of todayOrders) {
    if (o.tableNumber == null) continue;
    amountByTable[o.tableNumber] = (amountByTable[o.tableNumber] ?? 0) + Number(o.totalAmount ?? 0);
  }
  const topShare =
    summary && Number(summary.todayOrderValue) > 0
      ? Math.round(
          (topItems.reduce((n, t) => n + Number(t.revenue ?? 0), 0) / Number(summary.todayOrderValue)) * 100,
        )
      : null;
  const hasData =
    (summary?.ordersToday ?? 0) > 0 || revenue.some((p) => Number(p.revenue) > 0) || (sites ?? []).length > 0;

  const tableChip = (t) => {
    const isDelayed = liveOrders.some(
      (o) => String(o.tableNumber) === String(t.tableNumber) && LIVE_STATUSES.includes(o.status) && elapsedMin(o.placedAt) >= 10,
    );
    if (isDelayed) return { label: 'LATE KOT', bg: '#BA1A1A', fg: '#fff' };
    if (t.status === 'OCCUPIED') return { label: 'OCCUPIED', bg: '#99EFE5', fg: '#006A63' };
    if (t.status === 'RESERVED') return { label: 'RESERVED', bg: '#EEE7E3', fg: '#1E1B19' };
    return { label: 'VACANT', bg: '#95F8A7', fg: '#00210A' };
  };

  return (
    <Box sx={{ pb: { xs: '64px', md: 0 } }}>
      {/* hero greeting */}
      <Card
        sx={{
          borderRadius: 2,
          mb: 2,
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF2EE 55%, rgba(255,219,208,.45) 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', right: -40, bottom: -48, width: 256, height: 256, borderRadius: '50%', bgcolor: 'rgba(255,219,208,.4)', filter: 'blur(48px)' }} />
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <Box sx={{ maxWidth: 640 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
              <Chip size="small" label={`Live Today · ${longDate(todayStr)}`} sx={{ bgcolor: '#FFDBD0', color: '#390C00', fontWeight: 800, fontSize: 10 }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#9B2F00' }} />
              <Typography variant="caption" fontSize={12} color="text.secondary">
                {shiftLabel()}
              </Typography>
            </Box>
            <Typography variant="h4" component="h1" fontWeight={800} fontSize={{ xs: 24, sm: 30 }}>
              Namaste, {firstName} 👋
            </Typography>
            <Typography variant="body2" fontSize={14} color="text.secondary" sx={{ mt: 0.5 }}>
              {primary ? (
                <>
                  {primary.rest.name} is pacing{' '}
                  <strong style={{ color: '#00632B' }}>
                    {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : 'live'}
                  </strong>{' '}
                  today. {summary?.activeTables ?? 0} tables actively ordering; kitchen running with {liveOrders.length} live dockets.
                </>
              ) : (
                <>Here&apos;s what&apos;s happening across your restaurants today.</>
              )}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadDashboard} disabled={loadingData} sx={{ borderRadius: 2, fontWeight: 800, bgcolor: '#fff' }}>
              Refresh Data
            </Button>
            <Button variant="contained" component={RouterLink} to="/admin/restaurants" sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
              Manage {(sites ?? []).length} Restaurant{(sites ?? []).length === 1 ? '' : 's'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loadingData ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={132} sx={{ borderRadius: 2 }} />)}
        </Box>
      ) : !hasData ? (
        <EmptyState
          icon="🧾"
          title="No orders yet"
          body="Once guests start scanning your table codes, live revenue, top dishes and the floor matrix will stream in here."
          actionLabel="Open restaurants"
          onAction={() => navigate('/admin/restaurants')}
        />
      ) : (
        <>
          {/* 4 KPIs */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 2 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ letterSpacing: '.06em' }}>
                    GROSS REVENUE
                  </Typography>
                  <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', borderRadius: 2, width: 36, height: 36 }}>
                    <Sym name="currency_rupee" size={20} />
                  </Avatar>
                </Box>
                <Typography variant="h4" fontWeight={800} fontSize={30} sx={{ mt: 1.5 }}>{inr0(summary?.todayRevenue)}</Typography>
                <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ color: delta != null && delta >= 0 ? '#00632B' : 'text.secondary', display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                  <TrendingUpIcon fontSize="inherit" />
                  {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs yesterday` : `${summary?.paymentsToday ?? 0} payment(s) today`}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ letterSpacing: '.06em' }}>
                    TABLE OCCUPANCY
                  </Typography>
                  <Avatar sx={{ bgcolor: 'rgba(0,106,99,.12)', color: '#006A63', borderRadius: 2, width: 36, height: 36 }}>
                    <Sym name="table_restaurant" size={20} />
                  </Avatar>
                </Box>
                <Typography variant="h4" fontWeight={800} fontSize={30} sx={{ mt: 1.5 }}>
                  {totalOccupied}/{totalTables}{' '}
                  <Typography component="span" variant="caption" fontWeight={800} fontSize={12} sx={{ color: '#006A63' }}>
                    {occPct}% Occupied
                  </Typography>
                </Typography>
                <Box sx={{ height: 8, borderRadius: 999, bgcolor: '#F4ECE8', mt: 1 }}>
                  <Box sx={{ height: '100%', width: `${occPct}%`, borderRadius: 999, bgcolor: '#006A63' }} />
                </Box>
              </CardContent>
            </Card>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ letterSpacing: '.06em' }}>
                    KITCHEN LOAD
                  </Typography>
                  <Avatar sx={{ bgcolor: '#FFDAD6', color: '#BA1A1A', borderRadius: 2, width: 36, height: 36 }}>
                    <Sym name="soup_kitchen" size={20} />
                  </Avatar>
                </Box>
                <Typography variant="h4" fontWeight={800} fontSize={30} sx={{ mt: 1.5 }}>
                  {liveOrders.length} Live KOTs{' '}
                  {delayed.length > 0 && (
                    <Typography component="span" variant="caption" fontWeight={800} fontSize={11} sx={{ bgcolor: '#FFDAD6', color: '#BA1A1A', px: 1, py: 0.25, borderRadius: 1 }}>
                      {delayed.length} Delayed
                    </Typography>
                  )}
                </Typography>
                <Typography variant="caption" fontSize={10} color="text.secondary">
                  Avg prep {summary?.avgPrepMinutes != null ? `${summary.avgPrepMinutes} mins` : '—'}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ letterSpacing: '.06em' }}>
                    AVG TURN TIME
                  </Typography>
                  <Avatar sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', borderRadius: 2, width: 36, height: 36 }}>
                    <Sym name="timelapse" size={20} />
                  </Avatar>
                </Box>
                <Typography variant="h4" fontWeight={800} fontSize={30} sx={{ mt: 1.5 }}>
                  {summary?.avgPrepMinutes != null ? `${summary.avgPrepMinutes} min` : '—'}
                </Typography>
                <Typography variant="caption" fontSize={10} color="text.secondary">
                  {summary?.avgPrepMinutes != null ? 'Kitchen prep average' : 'No prep data yet'}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* revenue + branches */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, mb: 2 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} fontSize={16}>Weekly Revenue Dynamic</Typography>
                    <Typography variant="body2" fontSize={12} color="text.secondary">Comparison across Mon - Sun</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip size="small" label="Last 7 Days" sx={{ bgcolor: '#FAF2EE', fontSize: 10, fontWeight: 700 }} />
                    <Typography variant="body2" fontWeight={800} fontSize={14} sx={{ color: '#9B2F00' }}>
                      {inr0(weekTotal)} Total
                    </Typography>
                  </Box>
                </Box>
                {revenue.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No revenue yet — completed payments will appear here.</Typography>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 200, pt: 3 }}>
                    {revenue.map((p) => {
                      const isToday = p.date === todayStr;
                      return (
                        <Box key={p.date} title={`${p.date}: ${inr2(p.revenue)}`} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0, height: '100%', justifyContent: 'flex-end' }}>
                          <Typography variant="caption" fontWeight={isToday ? 800 : 600} fontSize={10} noWrap sx={{ color: isToday ? '#9B2F00' : 'text.secondary' }}>
                            {Number(p.revenue) > 0 ? inr0(p.revenue) : ''}
                          </Typography>
                          <Box sx={{
                            width: '100%',
                            height: `${Math.max(4, (Number(p.revenue ?? 0) / maxRevenue) * 100)}%`,
                            borderRadius: '6px 6px 0 0',
                            backgroundImage: isToday ? 'linear-gradient(180deg, #9B2F00, #C2410C)' : 'none',
                            bgcolor: isToday ? undefined : '#F4ECE8',
                          }} />
                          <Typography variant="caption" fontSize={10} color={isToday ? '#9B2F00' : 'text.secondary'} fontWeight={isToday ? 800 : 400}>
                            {isToday ? `${dayLabel(p.date)} (Today)` : dayLabel(p.date)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 2, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider', fontSize: 10 }}>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#9B2F00' }} /> Current Daily Volume
                  </Box>
                  <Button size="small" component={RouterLink} to="/admin/revenue" sx={{ fontWeight: 800, color: '#9B2F00', ml: 'auto' }}>
                    Revenue history →
                  </Button>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={800} fontSize={16}>Location Performance</Typography>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#00632B' }} />
                </Box>
                {(sites ?? []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No restaurants yet.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {(sites ?? []).slice(0, 3).map(({ rest, summary: s, tables, occupied }) => {
                      const occ = tables.length > 0 ? Math.round((occupied / tables.length) * 100) : 0;
                      const st = tables.length === 0 ? 'Setup' : occ >= 100 ? 'Full' : occ >= 70 ? 'Peak' : tables.length > 0 && occupied === 0 ? 'Quiet' : 'Active';
                      return (
                        <Box
                          key={rest.id}
                          onClick={() => navigate(`/admin/restaurants/${rest.id}`)}
                          sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { bgcolor: '#F4ECE8' } }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Typography variant="body2" fontWeight={800} fontSize={12} noWrap>{rest.name}</Typography>
                              <Chip size="small" label={st} sx={{ fontSize: 10, fontWeight: 800, height: 20 }} />
                            </Box>
                            <Typography variant="caption" fontSize={10} color="text.secondary">
                              {occupied}/{tables.length} tables · {inr0(s?.todayRevenue)}
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight={800} fontSize={16}>{inr0(s?.todayRevenue)}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
                <Button fullWidth variant="outlined" startIcon={<Sym name="add_circle" size={18} />} onClick={() => navigate('/admin/restaurants/new')} sx={{ mt: 1.5, borderRadius: 2, fontWeight: 800 }}>
                  Add New Restaurant
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* dishes + alerts */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, mb: 2 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={800} fontSize={16}>Hero Menu Velocity</Typography>
                    <Typography variant="body2" fontSize={12} color="text.secondary">
                      Fastest moving items{topShare != null ? ` generating ${topShare}% of shift revenue` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" label={`Top ${topItems.length} Today`} sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', fontWeight: 800, fontSize: 10 }} />
                </Box>
                {topItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No sales yet today.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1, mt: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                    {topItems.map((item, i) => {
                      const meta = vegMap[item.name] ?? {};
                      const img = meta.img ?? DISH_FALLBACKS[i % DISH_FALLBACKS.length];
                      const unit = Number(item.quantity) > 0 ? Number(item.revenue) / Number(item.quantity) : 0;
                      return (
                        <Box key={item.name} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Box sx={{ position: 'relative', width: 48, height: 48, borderRadius: 2, overflow: 'hidden', flexShrink: 0, bgcolor: '#F4ECE8' }}>
                            <Box
                              component="img"
                              src={img}
                              alt={item.name}
                              loading="lazy"
                              onError={(e) => {
                                const fb = DISH_FALLBACKS[(i + 1) % DISH_FALLBACKS.length];
                                if (e.currentTarget.src !== fb) e.currentTarget.src = fb;
                              }}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {typeof meta.veg === 'boolean' && (
                              <Box sx={{ position: 'absolute', bottom: 2, right: 2, bgcolor: '#fff', p: 0.25, borderRadius: 0.5 }}>
                                <VegMark veg={meta.veg} size={10} />
                              </Box>
                            )}
                          </Box>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>{item.name}</Typography>
                            <Typography variant="caption" fontSize={10} color="text.secondary">
                              {item.quantity} orders · {inr0(unit)} ea
                            </Typography>
                          </Box>
                          <Typography variant="body1" fontWeight={800} fontSize={16} sx={{ color: '#9B2F00', flexShrink: 0 }}>
                            {inr0(item.revenue)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="h6" fontWeight={800} fontSize={16}>Urgent Kitchen Alerts</Typography>
                  <Chip size="small" label={`${delayed.length} Action${delayed.length === 1 ? '' : 's'}`} sx={{ bgcolor: delayed.length > 0 ? '#FFDAD6' : 'rgba(17,126,59,.12)', color: delayed.length > 0 ? '#BA1A1A' : '#00632B', fontWeight: 800, fontSize: 10 }} />
                </Box>
                {delayed.length === 0 ? (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(17,126,59,.07)', display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Sym name="check_circle" size={20} />
                    <Typography variant="body2" fontSize={12} fontWeight={700}>Kitchen all clear — no delayed tickets.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {delayed.slice(0, 2).map((o) => (
                      <Box key={o.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(186,26,26,.06)', display: 'flex', gap: 1.5 }}>
                        <Sym name="warning" size={20} />
                        <Box>
                          <Typography variant="body2" fontWeight={800} fontSize={12}>
                            Table {o.tableNumber} Delay Warning
                          </Typography>
                          <Typography variant="caption" fontSize={10} color="text.secondary">
                            {(o.items ?? []).slice(0, 2).map((it) => `${it.menuItemName} × ${it.quantity}`).join(', ')} · waiting {Math.floor(elapsedMin(o.placedAt))} mins
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
                <Button fullWidth variant="contained" endIcon={<Sym name="arrow_forward" size={16} />} onClick={() => navigate('/kitchen')} sx={{ mt: 1.5, borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}>
                  Open Kitchen Display Screen
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* floor matrix */}
          {primary && (
            <Card sx={{ borderRadius: 2, mb: 2 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                  <Box>
                    <Typography variant="h5" fontWeight={800} fontSize={20}>Live Floor Matrix & Smart QR Sync</Typography>
                    <Typography variant="body2" fontSize={12} color="text.secondary">
                      {primaryBranch ? `${primaryBranch.name} · ` : ''}{totalOccupied} Active · synced to Captain Handhelds.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<Sym name="download" size={16} />} sx={{ borderRadius: 2, fontWeight: 800 }}
                      onClick={() => primaryBranch && navigate(`/admin/branches/${primaryBranch.id}/tables`)}>
                      Print All QR Stickers
                    </Button>
                    <Button size="small" variant="contained" startIcon={<Sym name="add" size={16} />} sx={{ borderRadius: 2, fontWeight: 800 }}
                      onClick={() => primaryBranch && navigate(`/admin/branches/${primaryBranch.id}/tables`)}>
                      Add Table
                    </Button>
                  </Box>
                </Box>
                {floorTables.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No tables yet — add them to open the floor.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', xl: 'repeat(6, 1fr)' }, mt: 1.5 }}>
                    {floorTables.map((t) => {
                      const chip = tableChip(t);
                      const amt = amountByTable[t.tableNumber] ?? 0;
                      const waiter = t.assignedWaiterName ?? null;
                      const isLate = chip.label === 'LATE KOT';
                      return (
                        <Box
                          key={t.id}
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            bgcolor: isLate ? 'rgba(186,26,26,.06)' : t.status === 'OCCUPIED' ? '#FAF2EE' : '#fff',
                            border: 1,
                            borderColor: isLate ? '#BA1A1A' : 'divider',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                            <Typography variant="h6" fontWeight={800} fontSize={16} sx={{ color: isLate ? '#BA1A1A' : 'inherit' }}>
                              {t.tableNumber}
                            </Typography>
                            <Chip size="small" label={chip.label} sx={{ bgcolor: chip.bg, color: chip.fg, fontWeight: 800, fontSize: 10, height: 22 }} />
                          </Box>
                          <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block' }}>
                            {t.seatingCapacity} seats{waiter ? ` · ${waiter}` : ''}
                          </Typography>
                          <Typography variant="body2" fontWeight={800} fontSize={12} sx={{ color: amt > 0 ? '#9B2F00' : 'text.secondary' }}>
                            {amt > 0 ? inr0(amt) : t.status === 'OCCUPIED' ? 'Seated' : 'Ready for seating'}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.75, pt: 0.75, borderTop: 1, borderColor: 'divider' }}>
                            <Typography variant="caption" fontSize={10} color="text.secondary">
                              {t.status === 'OCCUPIED' ? 'Live order' : t.status === 'RESERVED' ? 'Reserved' : 'QR standby'}
                            </Typography>
                            <Button
                              size="small"
                              sx={{ fontWeight: 800, fontSize: 12, color: isLate ? '#BA1A1A' : '#9B2F00', minWidth: 0, p: 0 }}
                              onClick={() => navigate(isLate ? '/kitchen' : '/waiter')}
                            >
                              {isLate ? 'Expedite' : t.status === 'OCCUPIED' ? 'Bill →' : 'Inspect'}
                            </Button>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* mobile-only: store switcher, delay alert, pods, insights */}
          <Box sx={{ display: { xs: 'grid', md: 'none' }, gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#FAF2EE', borderRadius: 2, p: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', minWidth: 0 }}>
                <Avatar sx={{ bgcolor: 'rgba(194,65,12,.1)', color: '#9B2F00', borderRadius: 2, width: 32, height: 32 }}>
                  <Sym name="storefront" size={20} />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800} fontSize={14} noWrap>
                    {primary?.rest.name ?? 'No restaurants yet'}
                  </Typography>
                  <Typography variant="caption" fontSize={10} color="text.secondary" noWrap>
                    {primaryBranch?.name ?? ''}{primaryBranch?.address ? ` · ${primaryBranch.address.split(',')[0]}` : ''}
                  </Typography>
                </Box>
              </Box>
              <Chip size="small" icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00632B', ml: 1 }} />} label="Live" sx={{ bgcolor: 'rgba(17,126,59,.12)', color: '#00632B', fontWeight: 800, fontSize: 10 }} />
            </Box>

            {delayed[0] && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#FFDAD6', color: '#93000A', borderRadius: 2, p: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800} fontSize={12} noWrap>
                    Table {delayed[0].tableNumber} · KOT Delay ({Math.floor(elapsedMin(delayed[0].placedAt))}m)
                  </Typography>
                  <Typography variant="caption" fontSize={10} noWrap sx={{ display: 'block' }}>
                    {(delayed[0].items ?? []).slice(0, 2).map((it) => `${it.menuItemName} × ${it.quantity}`).join(', ')}
                  </Typography>
                </Box>
                <Button size="small" variant="contained" color="error" onClick={() => navigate('/kitchen')} sx={{ borderRadius: 2, flexShrink: 0 }}>
                  Open KDS
                </Button>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <Button variant="contained" onClick={() => primaryBranch && navigate(`/admin/branches/${primaryBranch.id}/tables`)} sx={{ borderRadius: 2, flexDirection: 'column', gap: 0.5, py: 1.5, fontWeight: 800, backgroundImage: 'linear-gradient(180deg, #C2410C, #9B2F00)' }}>
                <Sym name="add_circle" size={24} /> + Add Table
              </Button>
              <Button variant="outlined" onClick={() => navigate('/kitchen')} sx={{ borderRadius: 2, flexDirection: 'column', gap: 0.5, py: 1.5, fontWeight: 800, bgcolor: '#fff' }}>
                <Sym name="skillet" size={24} /> Live KDS
              </Button>
              <Button variant="outlined" onClick={() => navigate('/admin/restaurants')} sx={{ borderRadius: 2, flexDirection: 'column', gap: 0.5, py: 1.5, fontWeight: 800, bgcolor: '#fff' }}>
                <Sym name="domain" size={24} /> Restaurants ({(sites ?? []).length})
              </Button>
            </Box>

            {payCounts && (
              <Card sx={{ borderRadius: 2 }}>
                <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'rgba(0,106,99,.12)', color: '#006A63', borderRadius: 2 }}>
                    <Sym name="insights" size={22} />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={800} fontSize={14}>Shift Insights</Typography>
                    <Typography variant="caption" fontSize={10} color="text.secondary">
                      {payCounts.UPI} UPI · {payCounts.CARD} Cards · {payCounts.CASH} Cash payments today
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        </>
      )}

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
          ['dashboard', 'Dashboard', '/admin', true],
          ['restaurant_menu', 'Menu', primary ? `/admin/restaurants/${primary.rest.id}/menu` : '/admin/restaurants', false],
          ['receipt_long', 'Orders', '/kitchen', false],
          ['table_restaurant', 'Tables', primaryBranch ? `/admin/branches/${primaryBranch.id}/tables` : '/admin/restaurants', false],
          ['more_horiz', 'More', '/admin/staff', false],
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
