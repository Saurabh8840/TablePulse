import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import VegMark from '../VegMark.jsx';

export function Sym({ name, size = 20 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

/** Fixed guest header: brand + table chip, search scroll, veg toggle, session sheet. */
export function GuestHeader({ restaurantName, tableLabel, onSearch, diet, onDiet, onPerson }) {
  return (
    <Box
      component="header"
      sx={(t) => ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: 'blur(20px)',
        backgroundColor: t.palette.mode === 'light' ? 'rgba(255,248,245,0.9)' : 'rgba(20,17,16,0.9)',
        boxShadow: '0 1px 12px rgba(30,27,25,0.04)',
      })}
    >
      <Box sx={{ height: 80, maxWidth: 720, mx: 'auto', px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0 }}>
          <Avatar sx={{ bgcolor: '#C2410C', width: 40, height: 40, borderRadius: 2, flexShrink: 0 }}>
            <Sym name="soup_kitchen" size={22} />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} fontSize={18} noWrap sx={{ lineHeight: 1.2 }}>
              {restaurantName ?? '…'}
            </Typography>
            {tableLabel && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25, borderRadius: 999, bgcolor: '#FAF2EE' }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00632B', mr: 0.75 }} />
                <Typography variant="caption" fontWeight={800} fontSize={10} sx={{ color: '#9B2F00' }}>
                  {tableLabel}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', flexShrink: 0 }}>
          {onSearch && (
            <IconButton aria-label="Search menu" onClick={onSearch} sx={{ width: 44, height: 44 }}>
              <Sym name="search" size={22} />
            </IconButton>
          )}
          {onDiet && (
            <IconButton
              aria-label="Toggle veg filter"
              onClick={onDiet}
              sx={{ width: 44, height: 44, color: diet === 'veg' ? '#00632B' : undefined }}
            >
              <VegMark veg size={16} />
            </IconButton>
          )}
          {onPerson && (
            <IconButton aria-label="Table session" onClick={onPerson} sx={{ width: 44, height: 44 }}>
              <Avatar sx={{ bgcolor: '#9B2F00', width: 32, height: 32 }}>
                <Sym name="person" size={18} />
              </Avatar>
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/** Fixed guest bottom nav: Menu / Live KOT / Cart FAB / Bill. */
export function GuestBottomNav({ base, withBranch, cart, latestOrderId, active, onNeedOrder }) {
  const go = (path) => withBranch(`${base}${path}`);
  const item = (icon, label, isActive, onClick, to) => (
    <Button
      key={label}
      component={to ? RouterLink : 'button'}
      to={to ?? undefined}
      onClick={onClick}
      sx={{
        flexDirection: 'column',
        gap: 0,
        flex: 1,
        minWidth: 56,
        height: 56,
        color: isActive ? '#9B2F00' : 'text.secondary',
        fontWeight: isActive ? 800 : 400,
        fontSize: 10,
      }}
    >
      <Sym name={icon} size={24} />
      {label}
    </Button>
  );
  return (
    <Box
      component="nav"
      sx={(t) => ({
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: 'blur(20px)',
        backgroundColor: t.palette.mode === 'light' ? 'rgba(255,248,245,0.95)' : 'rgba(20,17,16,0.95)',
        boxShadow: '0 -4px 20px rgba(28,25,23,0.06)',
      })}
    >
      <Box sx={{ height: 80, maxWidth: 720, mx: 'auto', px: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {item('restaurant_menu', 'Menu', active === 'menu', undefined, go(''))}
        {item(
          'receipt_long',
          'Live KOT',
          active === 'track',
          latestOrderId ? undefined : onNeedOrder,
          latestOrderId ? go(`/track/${latestOrderId}`) : undefined,
        )}
        <Button
          component={RouterLink}
          to={go('/cart')}
          sx={{
            flex: 1.6,
            height: 48,
            borderRadius: 999,
            backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)',
            color: '#fff',
            fontWeight: 800,
            gap: 1,
            boxShadow: '0 4px 16px rgba(194,65,12,0.25)',
          }}
        >
          <Sym name="shopping_bag" size={20} />
          Cart
          {cart && cart.count > 0 && (
            <Box sx={{ bgcolor: '#fff', color: '#9B2F00', borderRadius: 999, px: 1, fontSize: 12, fontWeight: 800 }}>
              {cart.count} · ₹{Number(cart.amount).toFixed(0)}
            </Box>
          )}
        </Button>
        {item('payments', 'Bill', active === 'bill', undefined, go('/bill'))}
      </Box>
    </Box>
  );
}

/** Table session sheet: table, live orders, bill total → bill/track. All real data. */
export function SessionSheet({ open, onClose, table, waiterName, orders, base, withBranch, navigate }) {
  const total = (orders ?? []).reduce((n, o) => n + Number(o.totalAmount ?? 0), 0);
  const latest = [...(orders ?? [])].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))[0];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Table {table} · Session
        <IconButton size="small" onClick={onClose} aria-label="Close session info">
          <Sym name="close" size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" fontSize={12} color="text.secondary">
            Live orders{(waiterName ? ` · Served by ${waiterName}` : '')}
          </Typography>
          <Typography variant="body2" fontWeight={800} fontSize={14}>
            {(orders ?? []).length} · ₹{total.toFixed(2)}
          </Typography>
        </Box>
        {(orders ?? []).length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No orders yet on this table — add dishes from the menu.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 2 }}>
          Close
        </Button>
        {latest && (
          <Button variant="outlined" onClick={() => { onClose(); navigate(withBranch(`${base}/track/${latest.id}`)); }} sx={{ borderRadius: 2, fontWeight: 700 }}>
            Track latest
          </Button>
        )}
        <Button variant="contained" onClick={() => { onClose(); navigate(withBranch(`${base}/bill`)); }} sx={{ borderRadius: 2, fontWeight: 800 }}>
          View Bill
        </Button>
      </DialogActions>
    </Dialog>
  );
}
