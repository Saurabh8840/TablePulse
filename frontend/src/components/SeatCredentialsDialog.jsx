import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

/** Show-once manager credentials: copy buttons + saved-ack gate.
 *  The password is never retrievable afterwards — only resettable. */
export default function SeatCredentialsDialog({ open, email, password, outletName, onDone }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(null);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard unavailable — credentials remain visible for manual copy
    }
  };

  return (
    <Dialog open={open} fullWidth maxWidth="sm" disableEscapeKeyDown>
      <DialogTitle>Manager login ready — {outletName}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          Save these now. The password is shown <strong>exactly once</strong> and can never be
          retrieved again — only reset (which kills every shared copy at once).
        </Alert>
        <TextField
          label="Manager email (login)"
          value={email ?? ''}
          InputProps={{ readOnly: true }}
          fullWidth
        />
        <TextField
          label="Manager password (login)"
          value={password ?? ''}
          InputProps={{ readOnly: true }}
          fullWidth
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => copy(`${email}\n${password}`, 'both')}
          >
            {copied === 'both' ? 'Copied ✓' : 'Copy both'}
          </Button>
          <Button size="small" variant="text" onClick={() => copy(email ?? '', 'email')}>
            {copied === 'email' ? 'Email copied ✓' : 'Copy email'}
          </Button>
          <Button size="small" variant="text" onClick={() => copy(password ?? '', 'pw')}>
            {copied === 'pw' ? 'Password copied ✓' : 'Copy password'}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Hand these to whoever runs this restaurant. They log in at <strong>/login</strong> and see
          only their location — menu, tables, kitchen, orders, revenue. Solo owner? Just close this
          and carry on; nothing changes until you share.
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} />}
          label="I saved the email + password somewhere safe"
        />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" disabled={!saved} onClick={onDone}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
