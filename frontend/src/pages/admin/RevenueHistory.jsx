import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { getDashboard, getRevenue } from '../../services/analytics.js';
import { searchOrders } from '../../services/kitchen.js';

const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00+05:30`).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  });

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function OrderCard({ order }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5, mb: 1 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ flexGrow: 1 }}>
            {order.orderNumber} · Table {order.tableNumber} · {timeOf(order.placedAt)}
          </Typography>
          <Chip size="small" label={order.status} />
        </Box>
        {(order.items ?? []).map((it, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {it.menuItemName} × {it.quantity}
              {(it.modifiers ?? []).length > 0 &&
                ` (${(it.modifiers ?? []).map((m) => m.modifierName).join(', ')})`}
            </Typography>
            <Typography variant="body2">₹{Number(it.totalPrice).toFixed(2)}</Typography>
          </Box>
        ))}
        <Divider sx={{ my: 0.75 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Waiter: {order.servedBy ?? '—'}
          </Typography>
          <Typography variant="body2" fontWeight={800}>
            {inr(order.totalAmount)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function useDayOrders() {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const load = useCallback(async (date) => {
    if (cache[date]) return;
    setLoading((m) => ({ ...m, [date]: true }));
    try {
      const res = await searchOrders({ date });
      setCache((m) => ({ ...m, [date]: res.data ?? [] }));
      setErrors((m) => ({ ...m, [date]: null }));
    } catch (e) {
      setErrors((m) => ({ ...m, [date]: e.message }));
    } finally {
      setLoading((m) => ({ ...m, [date]: false }));
    }
  }, [cache]);
  return { cache, loading, errors, load };
}

function DayRow({ date, revenue, orders, orderValue, dayOrders }) {
  const [open, setOpen] = useState(false);
  const { cache, loading, errors, load } = dayOrders;
  const toggle = () => {
    if (!open) load(date);
    setOpen((o) => !o);
  };
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}>
      <Box
        onClick={toggle}
        sx={{ display: 'flex', gap: 1, alignItems: 'center', cursor: 'pointer', py: 0.5 }}
      >
        <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
          {open ? '▾' : '▸'} {dayLabel(date)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {orders} order{orders === 1 ? '' : 's'} · {inr(orderValue)} value
        </Typography>
        <Typography variant="body2" fontWeight={800}>
          {inr(revenue)} paid
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box sx={{ pl: 2, pt: 1 }}>
          {loading[date] ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : errors[date] ? (
            <Alert severity="error" sx={{ mb: 1 }}>{errors[date]}</Alert>
          ) : (cache[date] ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ pb: 1 }}>
              No orders that day.
            </Typography>
          ) : (
            (cache[date] ?? []).map((o) => <OrderCard key={o.id} order={o} />)
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function RevenueHistory() {
  const [searchParams] = useSearchParams();
  const pinnedDate = searchParams.get('date');
  const [summary, setSummary] = useState(null);
  const [week, setWeek] = useState([]);
  const [year, setYear] = useState([]);
  const [monthDays, setMonthDays] = useState({});
  const [openMonths, setOpenMonths] = useState({});
  const [loadingMonths, setLoadingMonths] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const dayOrders = useDayOrders();

  useEffect(() => {
    (async () => {
      try {
        const [d, w, y] = await Promise.all([
          getDashboard(),
          getRevenue({ period: 'week' }),
          getRevenue({ period: 'year' }),
        ]);
        setSummary(d.data);
        setWeek([...(w.data ?? [])].reverse());
        setYear([...(y.data ?? [])].reverse());
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (pinnedDate) dayOrders.load(pinnedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedDate]);

  const toggleMonth = async (ym) => {
    const willOpen = !openMonths[ym];
    setOpenMonths((m) => ({ ...m, [ym]: willOpen }));
    if (willOpen && !monthDays[ym]) {
      setLoadingMonths((m) => ({ ...m, [ym]: true }));
      try {
        const res = await getRevenue({ period: 'month', month: ym });
        setMonthDays((m) => ({ ...m, [ym]: [...(res.data ?? [])].reverse() }));
      } catch (e) {
        setError(e.message);
        setOpenMonths((m) => ({ ...m, [ym]: false }));
      } finally {
        setLoadingMonths((m) => ({ ...m, [ym]: false }));
      }
    }
  };

  return (
    <Box>
      <PageHeader
        title="Revenue history"
        subtitle="Paid revenue and orders — today, last 7 days, months, year."
        actions={
          <Button component={RouterLink} to="/admin" variant="outlined">
            Back to dashboard
          </Button>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {pinnedDate && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {dayLabel(pinnedDate)}
                </Typography>
                <DayRow
                  date={pinnedDate}
                  revenue={(week.find((p) => p.date === pinnedDate)?.revenue) ?? 0}
                  orders={(week.find((p) => p.date === pinnedDate)?.orders) ?? (dayOrders.cache[pinnedDate]?.length ?? 0)}
                  orderValue={(week.find((p) => p.date === pinnedDate)?.orderValue) ?? 0}
                  dayOrders={dayOrders}
                />
              </CardContent>
            </Card>
          )}

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Today — {inr(summary?.todayRevenue)} paid · {inr(summary?.todayOrderValue)} in orders ·{' '}
                {summary?.ordersToday ?? 0} orders · {summary?.paymentsToday ?? 0} payments
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Revenue counts completed payments only — unpaid orders don't add to it.{' '}
                {summary?.activeTables ?? 0} tables active right now.
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Last 7 days
              </Typography>
              {week.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No data yet.</Typography>
              ) : (
                week.map((p) => (
                  <DayRow key={p.date} date={p.date} revenue={p.revenue} orders={p.orders} orderValue={p.orderValue} dayOrders={dayOrders} />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                By month — last 12 months
              </Typography>
              {year.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No data yet.</Typography>
              ) : (
                year.map((m) => (
                  <Box key={m.month} sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}>
                    <Box
                      onClick={() => toggleMonth(m.month)}
                      sx={{ display: 'flex', gap: 1, alignItems: 'center', cursor: 'pointer', py: 0.5 }}
                    >
                      <Typography variant="body2" fontWeight={700} sx={{ flexGrow: 1 }}>
                        {openMonths[m.month] ? '▾' : '▸'} {monthLabel(m.month)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.orders} order{m.orders === 1 ? '' : 's'} · {inr(m.orderValue)} value
                      </Typography>
                      <Typography variant="body2" fontWeight={800}>
                        {inr(m.revenue)} paid
                      </Typography>
                    </Box>
                    <Collapse in={!!openMonths[m.month]}>
                      <Box sx={{ pl: 2, pt: 1 }}>
                        {loadingMonths[m.month] ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <CircularProgress size={20} />
                          </Box>
                        ) : (
                          (monthDays[m.month] ?? []).map((p) => (
                            <DayRow key={p.date} date={p.date} revenue={p.revenue} orders={p.orders} orderValue={p.orderValue} dayOrders={dayOrders} />
                          ))
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
