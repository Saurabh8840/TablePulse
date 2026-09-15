import { Avatar, Box, Button, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import ModeToggle from '../ModeToggle.jsx';

const LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Status', href: '#status' },
];

/** Public marketing navbar — no sidebar, just brand + anchors + auth CTAs. */
export default function PublicNav() {
  const { user } = useAuth();

  return (
    <Box
      component="header"
      sx={(t) => ({
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        backdropFilter: 'blur(14px)',
        backgroundColor:
          t.palette.mode === 'light' ? 'rgba(250,247,242,0.88)' : 'rgba(20,17,16,0.88)',
        color: t.palette.text.primary,
        borderBottom: 1,
        borderColor: 'divider',
      })}
    >
      <Toolbar sx={{ maxWidth: 1200, mx: 'auto', width: '100%', gap: 1 }}>
        <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 800, width: 34, height: 34, borderRadius: 2.5 }}>
          T
        </Avatar>
        <Typography variant="h6" fontWeight={800} sx={{ mr: 2 }}>
          TablePulse
        </Typography>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
          {LINKS.map((l) => (
            <Button key={l.label} href={l.href} color="inherit" sx={{ fontWeight: 600 }}>
              {l.label}
            </Button>
          ))}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <ModeToggle />
        {user ? (
          <Button component={RouterLink} to="/admin" variant="contained">
            Open dashboard
          </Button>
        ) : (
          <>
            <Button
              component={RouterLink}
              to="/login"
              color="inherit"
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 700 }}
            >
              Login
            </Button>
            <Button component={RouterLink} to="/register" variant="contained">
              Start free
            </Button>
          </>
        )}
      </Toolbar>
    </Box>
  );
}
