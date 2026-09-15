import DashboardIcon from '@mui/icons-material/Dashboard';
import HomeIcon from '@mui/icons-material/Home';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { canSeeKitchen, canSeeWaiter, isManager } from '../../utils/roles.js';
import ModeToggle from '../ModeToggle.jsx';

const DRAWER_WIDTH = 264;

function SectionLabel({ children }) {
  return (
    <Typography
      variant="overline"
      sx={{ px: 2.5, pt: 2, pb: 0.5, display: 'block', fontWeight: 800, opacity: 0.65 }}
    >
      {children}
    </Typography>
  );
}

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const item = (to, label, icon) => (
    <ListItemButton
      key={to + label}
      component={RouterLink}
      to={to}
      selected={location.pathname === to}
      onClick={() => setOpen(false)}
      sx={{
        borderRadius: 2.5,
        mx: 1.25,
        mb: 0.25,
        width: 'auto',
        '& .MuiListItemIcon-root': { minWidth: 40 },
        '&.Mui-selected': {
          backgroundImage: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
          color: '#fff',
          '& .MuiListItemIcon-root': { color: '#fff' },
          '&:hover': { backgroundImage: 'linear-gradient(135deg, #ea580c 0%, #9a3412 100%)' },
        },
      }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontWeight: 600 }} />
    </ListItemButton>
  );

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', backgroundImage: 'linear-gradient(135deg, #ea580c, #9a3412)', fontWeight: 800, width: 38, height: 38, borderRadius: 3 }}>
          T
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
            TablePulse
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Restaurant OS
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <Box sx={{ overflowY: 'auto', flexGrow: 1, py: 0.5 }}>
        <List dense disablePadding>
          <SectionLabel>General</SectionLabel>
          {item('/', 'Website', <HomeIcon />)}
          {user && isManager(user) && item('/admin', 'Dashboard', <DashboardIcon />)}
          {user && isManager(user) && item('/admin/restaurants', 'Restaurants', <StorefrontIcon />)}
          {user && canSeeKitchen(user) && item('/kitchen', 'Kitchen Display', <SoupKitchenIcon />)}
          {user && canSeeWaiter(user) && item('/waiter', 'Waiter Dashboard', <TableRestaurantIcon />)}
          {user && isManager(user) && item('/admin/staff', 'Staff', <PeopleIcon />)}
          {!user && item('/login', 'Login', <LoginIcon />)}
          {!user && item('/register', 'Register', <PersonAddIcon />)}
        </List>
        {user && (
          <Box sx={{ m: 1.5, mt: 2, p: 2, borderRadius: 3, color: '#fff',
            background: 'linear-gradient(135deg, #431407 0%, #c2410c 100%)' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
              <RocketLaunchIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={800}>
                Phase 6 is next
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1.5 }}>
              Payments & billing — Razorpay/UPI + pay at counter.
            </Typography>
            <Button size="small" variant="contained" disabled
              sx={{ bgcolor: 'rgba(255,255,255,.2)', color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,.6)' } }}>
              Coming soon
            </Button>
          </Box>
        )}
      </Box>
      {user ? (
        <>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', fontWeight: 800 }}>{user.fullName?.[0]?.toUpperCase()}</Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {user.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            </Box>
            <IconButton
              aria-label="sign out"
              size="small"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
        </>
      ) : (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Button component={RouterLink} to="/register" variant="contained" fullWidth>
              Register restaurant
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              Free to start · live in one sitting
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100svh' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="open navigation"
            onClick={() => setOpen(true)}
            sx={{ mr: 1.5, display: { lg: 'none' } }}
            size="large"
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 800 }}
          >
            🍽️ TablePulse
          </Typography>
          {!user && (
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              size="small"
              sx={{ mr: 1, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Start free
            </Button>
          )}
          <ModeToggle />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              // Distinct sheet: tinted + strong edge so it never melts into the page
              backgroundImage: 'none',
              borderRight: 1,
              borderColor: 'divider',
              boxShadow: 2,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              backgroundImage: 'none',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar />
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3, lg: 4 } }}>
          <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>{children}</Box>
        </Box>
        <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 2.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            TablePulse · Made for restaurants that move fast
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
