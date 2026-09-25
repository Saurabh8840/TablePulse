import { Avatar, Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/** Stitch-exact standalone shell for /login + /register.
 *  No drawer, no AppBar, no sidebar — cream canvas + minimal top bar. */
export default function AuthShell({ children }) {
  return (
    <Box sx={{ bgcolor: '#FFF8F5', minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <Box
        component="header"
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          width: '100%',
          px: { xs: 2, sm: 3 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Avatar
          sx={{
            bgcolor: '#C2410C',
            backgroundImage: 'linear-gradient(135deg, #9B2F00, #C2410C)',
            fontWeight: 800,
            width: 32,
            height: 32,
            borderRadius: 2.5,
            fontSize: 17,
          }}
        >
          T
        </Avatar>
        <Typography variant="subtitle1" fontWeight={800}>
          Table<span style={{ color: '#C2410C' }}>Pulse</span>
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button component={RouterLink} to="/" variant="text" size="small" sx={{ fontWeight: 700 }}>
          ← Back to Website
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
          English (IN)
        </Typography>
        <Button variant="text" size="small" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
          Help Desk
        </Button>
      </Box>
      <Box sx={{ flexGrow: 1, py: { xs: 2, md: 3 } }}>{children}</Box>
      <Box
        component="footer"
        sx={{ borderTop: 1, borderColor: 'divider', py: 2, textAlign: 'center', bgcolor: '#FFF8F5' }}
      >
        <Typography variant="caption" color="text.secondary">
          © 2024 TablePulse Technologies. Built for Indian Hospitality. · Privacy Policy · Terms of Service · System Status
        </Typography>
      </Box>
    </Box>
  );
}
