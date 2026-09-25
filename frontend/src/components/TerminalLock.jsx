import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import PinPad from './PinPad.jsx';

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

/** POS terminal lockscreen SHELL (Phase B preview — non-functional).
 *  Frame data (outlet/branch/staff count/clock) is real; PIN validation is
 *  inert until the Phase B unlock endpoint lands. No demo PINs, ever. */
export default function TerminalLock({ open, onClose, outletName, branchName, staffCount }) {
  const [notice, setNotice] = useState(false);
  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ bgcolor: '#FAF2EE', px: 3, pt: 2.5, pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Chip-like outlet={outletName} branch={branchName} />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 10, color: 'text.secondary' }}>
              <Sym name="schedule" size={16} />
              {now}
            </Box>
          </Box>
          <Typography variant="h6" fontWeight={800} fontSize={18}>
            POS Terminal · Staff Quick-PIN Unlock
          </Typography>
          <Typography variant="caption" fontSize={10} color="text.secondary">
            {staffCount ?? 0} staff on roster · enter your 4-digit PIN
          </Typography>
        </Box>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Avatar sx={{ bgcolor: '#FFDBD0', color: '#9B2F00', width: 56, height: 56, borderRadius: 2 }}>
              <Sym name="lock" size={28} />
            </Avatar>
          </Box>
          <PinPad onComplete={() => setNotice(true)} />
          {notice && (
            <Alert severity="info" onClose={() => setNotice(false)}>
              PIN unlock connects in Phase B — terminal sessions, lockout and audit trail ship with the backend.
            </Alert>
          )}
        </DialogContent>
        <Box sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
          <Button fullWidth variant="outlined" onClick={onClose} sx={{ borderRadius: 2 }}>
            Close preview
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
