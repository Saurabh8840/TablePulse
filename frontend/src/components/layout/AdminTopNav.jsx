import LogoutIcon from '@mui/icons-material/Logout';
import SearchIcon from '@mui/icons-material/Search';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { canSeeKitchen, canSeeWaiter, isManager } from '../../utils/roles.js';
import { listBranches, listRestaurants } from '../../services/restaurant.js';
import ModeToggle from '../ModeToggle.jsx';

/** Global directory header (Stitch-exact): h-16, context tabs, search, soundbox, avatar.
 *  Managers get directory tabs; kitchen/waiter-only staff keep their boards. */
export default function AdminTopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(null);
  const [q, setQ] = useState('');
  const [firstRest, setFirstRest] = useState(null);
  const [firstBranch, setFirstBranch] = useState(null);

  const manager = user && isManager(user);

  useEffect(() => {
    if (!manager) return;
    let alive = true;
    listRestaurants()
      .then((r) => {
        if (!alive) return null;
        const first = (r.data ?? [])[0] ?? null;
        setFirstRest(first);
        return first ? listBranches(first.id).catch(() => ({ data: [] })) : null;
      })
      .then((b) => {
        if (alive && b) setFirstBranch((b.data ?? [])[0] ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [manager, user?.email]);

  const menuTo = firstRest ? `/admin/restaurants/${firstRest.id}/menu` : '/admin/restaurants';
  const tablesTo = firstBranch ? `/admin/branches/${firstBranch.id}/tables` : '/admin/restaurants';

  // Top-level stays at 3 (Zomato rule: max 5, frequency-based). Everything
  // else lives in the grouped More menu; future features land there first.
  const dirTabs = [
    { label: 'Dashboard', to: '/admin', match: (p) => p === '/admin' },
    { label: 'Restaurants', to: '/admin/restaurants', match: (p) => p === '/admin/restaurants' },
    { label: 'Menu Manager', to: menuTo, match: (p) => p.includes('/menu') },
  ];

  const moreGroups = [
    {
      title: 'Operations',
      items: [
        { label: 'Tables & QR', hint: 'Floor plan + QR codes', icon: 'qr_code_2', to: tablesTo, match: (p) => p.includes('/tables') },
        { label: 'Kitchen board', hint: 'Live KDS tickets', icon: 'soup_kitchen', to: '/kitchen', match: (p) => p.startsWith('/kitchen') },
        { label: 'Waiter board', hint: 'Floor + serve flow', icon: 'room_service', to: '/waiter', match: (p) => p.startsWith('/waiter') },
      ],
    },
    {
      title: 'Team',
      items: [
        { label: 'Staff & Waiters', hint: 'Logins per outlet', icon: 'badge', to: '/admin/staff', match: (p) => p.startsWith('/admin/staff') },
      ],
    },
    {
      title: 'Money',
      items: [
        { label: 'Settlements', hint: 'Revenue history', icon: 'payments', to: '/admin/revenue', match: (p) => p.startsWith('/admin/revenue') },
      ],
    },
  ];

  const staffTabs = [];
  if (user && canSeeKitchen(user) && !manager) staffTabs.push({ label: 'Kitchen', to: '/kitchen' });
  if (user && canSeeWaiter(user) && !manager) staffTabs.push({ label: 'Waiter', to: '/waiter' });

  const tabs = manager ? dirTabs : staffTabs;
  const moreActive = manager && moreGroups.some((g) => g.items.some((i) => i.match(location.pathname)));
  const [moreAnchor, setMoreAnchor] = useState(null);
  const mobileTabs = manager
    ? [
        { label: 'Dashboard', to: '/admin' },
        { label: 'Restaurants', to: '/admin/restaurants' },
        { label: 'Menu', to: menuTo },
      ]
    : staffTabs;

  const onLogout = () => {
    setAnchor(null);
    logout();
    navigate('/login');
  };

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/admin/restaurants${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <AppBar position="sticky" elevation={0}>
      <Container maxWidth="xl" disableGutters sx={{ px: { xs: 2, lg: 4 } }}>
        <Box sx={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              component={RouterLink}
              to={manager ? '/admin' : '/'}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'inherit' }}
            >
              <Avatar sx={{ bgcolor: '#C2410C', fontWeight: 800, width: 36, height: 36, borderRadius: 2, fontSize: 19 }}>
                T
              </Avatar>
              <Box sx={{ lineHeight: 1 }}>
                <Typography variant="subtitle1" fontWeight={800} fontSize={18}>
                  TablePulse
                </Typography>
                <Typography variant="caption" fontWeight={700} fontSize={10} sx={{ letterSpacing: '.08em', color: '#9B2F00' }}>
                  ADMIN OS
                </Typography>
              </Box>
            </Box>
            {manager && (
              <Box sx={{ display: { xs: 'none', xl: 'flex' }, alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
                <Button
                  component={RouterLink}
                  to="/admin/restaurants"
                  sx={{ textTransform: 'none', color: 'inherit', borderRadius: 2, px: 1.5, py: 0.5, bgcolor: '#FAF2EE', lineHeight: 1.25, flexShrink: 0 }}
                >
                  <Box sx={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <Typography variant="caption" color="text.secondary" fontSize={10} sx={{ display: 'block', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      My Outlets
                    </Typography>
                    <Typography variant="body2" fontWeight={800} fontSize={12} sx={{ whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      All Restaurants
                    </Typography>
                  </Box>
                </Button>
              </Box>
            )}
          </Box>

          {tabs.length > 0 && (
            <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 0.5, p: 0.5, borderRadius: 2, bgcolor: '#FAF2EE' }}>
              {tabs.map((t) => {
                const active = t.match ? t.match(location.pathname) : location.pathname.startsWith(t.to);
                return (
                  <Button
                    key={t.label}
                    component={RouterLink}
                    to={t.to}
                    sx={{
                      fontWeight: active ? 800 : 600,
                      fontSize: 12,
                      color: active ? '#fff' : 'text.secondary',
                      bgcolor: active ? '#C2410C' : 'transparent',
                      borderRadius: 2,
                      px: 1.75,
                      py: 0.75,
                      boxShadow: active ? 1 : 0,
                      '&:hover': { bgcolor: active ? '#9B2F00' : '#F4ECE8' },
                    }}
                  >
                    {t.label}
                  </Button>
                );
              })}
              {manager && (
                <Button
                  onClick={(e) => setMoreAnchor(e.currentTarget)}
                  sx={{
                    fontWeight: moreActive ? 800 : 600,
                    fontSize: 12,
                    color: moreActive ? '#fff' : 'text.secondary',
                    bgcolor: moreActive ? '#C2410C' : 'transparent',
                    borderRadius: 2,
                    px: 1.75,
                    py: 0.75,
                    '&:hover': { bgcolor: moreActive ? '#9B2F00' : '#F4ECE8' },
                  }}
                >
                  More ▾
                </Button>
              )}
            </Box>
          )}
          <Menu
            anchorEl={moreAnchor}
            open={Boolean(moreAnchor)}
            onClose={() => setMoreAnchor(null)}
            slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 300, p: 1 } } }}
          >
            {moreGroups.map((g) => (
              <Box key={g.title} sx={{ mb: 0.5 }}>
                <Typography variant="caption" fontWeight={800} fontSize={10} color="text.secondary" sx={{ px: 1.5, letterSpacing: '.08em' }}>
                  {g.title.toUpperCase()}
                </Typography>
                {g.items.map((i) => (
                  <MenuItem
                    key={i.label}
                    component={RouterLink}
                    to={i.to}
                    selected={i.match(location.pathname)}
                    onClick={() => setMoreAnchor(null)}
                    sx={{ borderRadius: 2, gap: 1.5 }}
                  >
                    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 20, color: '#9B2F00' }}>
                      {i.icon}
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={800} fontSize={14} sx={{ display: 'block' }}>
                        {i.label}
                      </Typography>
                      <Typography variant="caption" fontSize={10} color="text.secondary" sx={{ display: 'block' }}>
                        {i.hint}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Box>
            ))}
          </Menu>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {manager && (
              <Box
                component="form"
                onSubmit={onSearch}
                sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', position: 'relative' }}
              >
                <SearchIcon fontSize="small" sx={{ position: 'absolute', left: 10, color: 'text.secondary' }} />
                <TextField
                  size="small"
                  placeholder="Search tables, bills, staff..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  sx={{
                    width: { md: 176, lg: 224 },
                    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FAF2EE', pl: 3.5, fontSize: 12 },
                  }}
                />
              </Box>
            )}
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                bgcolor: 'rgba(17,126,59,.08)',
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00632B' }} />
              <Typography variant="caption" fontWeight={700} fontSize={10} sx={{ color: '#00632B' }}>
                Soundbox
              </Typography>
            </Box>
            <ModeToggle />
            {user ? (
              <>
                <Button onClick={(e) => setAnchor(e.currentTarget)} sx={{ minWidth: 0, p: 0.5, borderRadius: 2 }}>
                  <Box sx={{ position: 'relative' }}>
                    <Avatar sx={{ bgcolor: '#9B2F00', fontWeight: 800, width: 32, height: 32, fontSize: 15 }}>
                      {user.fullName?.[0]?.toUpperCase() ?? 'O'}
                    </Avatar>
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: '#00632B',
                        border: '2px solid #FFF8F5',
                      }}
                    />
                  </Box>
                </Button>
                <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2" fontWeight={800} noWrap>
                      {user.fullName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {user.email} · {user.role}
                    </Typography>
                  </Box>
                  <Divider />
                  <MenuItem
                    component={RouterLink}
                    to="/profile"
                    onClick={() => setAnchor(null)}
                  >
                    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: 18, mr: 1 }}>
                      account_circle
                    </Box>
                    Profile
                  </MenuItem>
                  <MenuItem onClick={onLogout}>
                    <LogoutIcon fontSize="small" style={{ marginRight: 8 }} />
                    Sign out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button component={RouterLink} to="/register" variant="contained" size="small" sx={{ borderRadius: 2 }}>
                Start free
              </Button>
            )}
          </Box>
        </Box>

        {/* mobile pill tabs */}
        {(mobileTabs.length > 0 || manager) && (
          <Box className="no-scrollbar" sx={{ display: { xs: 'flex', lg: 'none' }, gap: 1, overflowX: 'auto', pb: 1.25 }}>
            {mobileTabs.map((t) => {
              const active =
                t.to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(t.to);
              return (
                <Button
                  key={t.label}
                  component={RouterLink}
                  to={t.to}
                  sx={{
                    flexShrink: 0,
                    borderRadius: 999,
                    px: 2,
                    py: 0.75,
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    color: active ? '#fff' : 'text.secondary',
                    bgcolor: active ? '#9B2F00' : '#F4ECE8',
                  }}
                >
                  {t.label}
                </Button>
              );
            })}
            {manager && (
              <Button
                onClick={(e) => setMoreAnchor(e.currentTarget)}
                sx={{
                  flexShrink: 0,
                  borderRadius: 999,
                  px: 2,
                  py: 0.75,
                  fontSize: 12,
                  fontWeight: moreActive ? 800 : 600,
                  color: moreActive ? '#fff' : 'text.secondary',
                  bgcolor: moreActive ? '#9B2F00' : '#F4ECE8',
                }}
              >
                More ▾
              </Button>
            )}
          </Box>
        )}
      </Container>
    </AppBar>
  );
}
