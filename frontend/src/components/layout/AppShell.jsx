import { Box, Typography } from '@mui/material';
import AdminTopNav from './AdminTopNav.jsx';

/** Product shell — top-nav only, zero sidebar on every route.
 *  Stitch-exact: cream canvas, pill tabs, avatar menu. */
export default function AppShell({ children }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100svh', flexDirection: 'column', bgcolor: '#FFF8F5' }}>
      <AdminTopNav />
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3, lg: 4 } }}>
          <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>{children}</Box>
        </Box>
        <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 2.5, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary">
            TablePulse · Made for restaurants that move fast
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
