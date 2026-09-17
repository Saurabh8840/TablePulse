import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import LogoutIcon from '@mui/icons-material/Logout';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import ReceiptIcon from '@mui/icons-material/Receipt';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import TableBarIcon from '@mui/icons-material/TableBar';
import TimerIcon from '@mui/icons-material/Timer';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Link as RouterLink, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/EmptyState.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import StatCard from '../../components/StatCard.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { getDashboard, getRevenue, getTopItems } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';

const QUICK_ACTIONS = [
  { icon: <RestaurantMenuIcon />, label: 'Build menu', hint: 'Categories & items', to: '/admin/restaurants' },
  { icon: <TableBarIcon />, label: 'Add tables', hint: 'Bulk + QR', to: '/admin/restaurants' },
  { icon: <QrCodeIcon />, label: 'Print QR codes', hint: 'Per table PNG', to: '/admin/restaurants' },
  { icon: <SoupKitchenIcon />, label: 'Live orders', hint: 'KDS board', to: '/kitchen' },
];

const STATUSES = ['ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'];

const todayKolkata = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });

export default function AdminHome() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(todayKolkata());
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [loadingData, setLoadingData] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [d, r, t, h] = await Promise.all([
        getDashboard(),
        getRevenue({ period: 'week' }),
        getTopItems({ limit: 5 }),
        searchOrders({ date: todayKolkata() }),
      ]);
      setSummary(d.data);
      setRevenue(r.data ?? []);
      setTopItems(t.data ?? []);
      setHistory((h.data ?? []).slice(0, 20));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user, loadDashboard]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const h = await searchOrders({
        date: historyDate || undefined,
        status: historyStatus && historyStatus !== 'ALL' ? historyStatus : undefined,
      });
      setHistory((h.data ?? []).slice(0, 20));
    } catch (e) {
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDate, historyStatus]);

  useEffect(() => {
    if (user && !loadingData) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDate, historyStatus]);

  if (loading) return <CircularProgress />;
  if (!user) return <Navigate to="/login" replace />;

  const firstName = user.fullName?.split(' ')[0] ?? 'Owner';
  const hasData = (summary?.ordersToday ?? 0) > 0 || revenue.some((p) => Number(p.revenue) > 0);
  const maxRevenue = Math.max(1, ...revenue.map((p) => Number(p.revenue ?? 0)));

  return (
    <Box>
      <PageHeader
        title={`Namaste, ${firstName} 👋`}
        subtitle="Here's what's happening at your restaurant today."
        actions={
          <>
            <Button variant="outlined" onClick={loadDashboard} disabled={loadingData}>
              Refresh
            </Button>
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout}>
              Sign out
            </Button>
          </>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loadingData ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Box
              onClick={() => navigate('/admin/revenue')}
              sx={{ cursor: 'pointer' }}
              title="Open revenue history"
            >
              <StatCard
                icon={<CurrencyRupeeIcon />}
                label="Today's revenue"
                value={inr(summary?.todayRevenue)}
                hint={`${summary?.paymentsToday ?? 0} payment(s) · ${inr(summary?.todayOrderValue)} in orders — tap for history`}
              />
            </Box>
            <StatCard
              icon={<ReceiptIcon />}
              label="Orders today"
              value={String(summary?.ordersToday ?? 0)}
              hint="All statuses"
            />
            <StatCard
              icon={<TableBarIcon />}
              label="Active tables"
              value={String(summary?.activeTables ?? 0)}
              hint="Open sessions"
            />
            <StatCard
              icon={<TimerIcon />}
              label="Avg. prep time"
              value={summary?.avgPrepMinutes != null ? `${summary.avgPrepMinutes} min` : '—'}
              hint="Placed → ready"
            />
          </div>

          <div className="grid gap-4 mt-4 lg:grid-cols-5">
            <Box sx={{ gridColumn: { lg: 'span 3' } }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Revenue this week
                  </Typography>
                  {revenue.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No revenue yet — completed payments will appear here.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 180, pt: 1 }}>
                      {revenue.map((p) => (
                        <Box key={p.date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                          <Typography variant="caption" fontWeight={700} noWrap title={`${p.orders} orders`}>
                            {Number(p.revenue) > 0 ? inr(p.revenue) : ''}
                          </Typography>
                          <Box
                            title={`${p.date}: ${inr(p.revenue)} · ${p.orders} orders — open history`}
                            onClick={() => navigate(`/admin/revenue?date=${p.date}`)}
                            sx={{
                              width: '100%',
                              height: Math.max(6, (Number(p.revenue ?? 0) / maxRevenue) * 120),
                              borderRadius: 1.5,
                              bgcolor: 'primary.main',
                              opacity: Number(p.revenue) > 0 ? 1 : 0.25,
                              cursor: 'pointer',
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {dayLabel(p.date)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ gridColumn: { lg: 'span 2' } }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top dishes today
                  </Typography>
                  {topItems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No sales yet today.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {topItems.map((item, i) => (
                        <Box key={item.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography variant="body2" noWrap>
                            {i + 1}. {item.name} ({item.quantity})
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {inr(item.revenue)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </div>

          <div className="grid gap-4 mt-4 lg:grid-cols-5">
            <Box sx={{ gridColumn: { lg: 'span 3' } }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      Order history
                    </Typography>
                    <TextField
                      size="small"
                      type="date"
                      label="Date"
                      value={historyDate}
                      onChange={(e) => setHistoryDate(e.target.value)}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                      size="small"
                      select
                      label="Status"
                      value={historyStatus}
                      onChange={(e) => setHistoryStatus(e.target.value)}
                      sx={{ minWidth: 140 }}
                      slotProps={{ inputLabel: { shrink: true }, select: { native: true } }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </TextField>
                  </Box>
                  {historyLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : history.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No orders match these filters.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {history.map((o) => (
                        <Box
                          key={o.id}
                          sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
                        >
                          <Typography variant="body2" noWrap>
                            {o.orderNumber} · T{o.tableNumber} · {o.status}
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {inr(o.totalAmount)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ gridColumn: { lg: 'span 2' }, display: 'grid', gap: 2, alignContent: 'start' }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Quick actions
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    {QUICK_ACTIONS.map((a) => (
                      <Button
                        key={a.label}
                        component={RouterLink}
                        to={a.to}
                        variant="outlined"
                        sx={{ flexDirection: 'column', gap: 0.5, py: 2, textTransform: 'none' }}
                      >
                        {a.icon}
                        <Typography variant="body2" fontWeight={700}>
                          {a.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {a.hint}
                        </Typography>
                      </Button>
                    ))}
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Signed in as
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={800}>
                    {user.fullName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email} · {user.role}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    tenant {user.tenantId}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </div>

          {!hasData && (
            <Box sx={{ mt: 2 }}>
              <EmptyState
                icon="🧾"
                title="No orders yet"
                body="Once guests start scanning your table codes, live revenue, top dishes and order history will stream in here."
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
