import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import PinPad from './PinPad.jsx';
import VegMark from './VegMark.jsx';

function Sym({ name, size = 18 }) {
  return (
    <Box component="span" className="material-symbols-outlined" sx={{ fontSize: size, display: 'inline-flex' }}>
      {name}
    </Box>
  );
}

/** Manager override / void approval SHELL (Phase B preview — non-functional).
 *  Incident context (table/order/amounts/reason) is real props; the Approve
 *  path waits on void/discount endpoints + PIN verify. Nothing executes. */
export default function OverrideModal({ open, onClose, table, order }) {
  const [phase, setPhase] = useState('pin'); // pin | done
  const [note, setNote] = useState('');

  const close = () => {
    setPhase('pin');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <Box sx={{ background: 'linear-gradient(90deg, #C2410C, #9B2F00)', color: '#fff', p: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,.15)', borderRadius: 2, width: 48, height: 48 }}>
            <Sym name="shield_person" size={28} />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Chip size="small" label="Manager Override Required" sx={{ bgcolor: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 800, fontSize: 10, mb: 0.5 }} />
            <Typography variant="h6" fontWeight={800} fontSize={20} sx={{ lineHeight: 1.15 }}>
              Authorize Void & Manual Discount
            </Typography>
          </Box>
          <Button size="small" onClick={close} sx={{ color: '#fff', minWidth: 0 }}>
            <Sym name="close" size={20} />
          </Button>
        </Box>
      </Box>

      <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
        <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: '#FAF2EE', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Sym name="receipt_long" size={20} />
          <Typography variant="body1" fontWeight={800} fontSize={16}>
            Table {table?.tableNumber ?? '—'}
          </Typography>
          {order && (
            <Typography variant="body2" fontSize={12} color="text.secondary">
              {order.orderNumber} · ₹{Number(order.totalAmount ?? 0).toFixed(2)}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" label="Phase B preview" sx={{ fontSize: 10, fontWeight: 800 }} />
        </Box>

        {order && (order.items ?? []).length > 0 && (
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {(order.items ?? []).slice(0, 5).map((it, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {typeof it.vegetarian === 'boolean' && <VegMark veg={it.vegetarian} size={12} />}
                <Typography variant="body2" fontSize={12} noWrap sx={{ flexGrow: 1 }}>
                  {it.menuItemName} × {it.quantity}
                </Typography>
                <Typography variant="body2" fontWeight={800} fontSize={12}>
                  ₹{Number(it.totalPrice ?? 0).toFixed(2)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {phase === 'pin' ? (
          <>
            <Typography variant="body2" fontWeight={800} fontSize={14} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Sym name="pin" size={18} /> Enter Manager Override PIN
            </Typography>
            <PinPad onComplete={() => setPhase('done')} />
          </>
        ) : (
          <Alert severity="info">
            PIN accepted locally. Authorization executes in Phase B — void/discount endpoints with audit stamps ship with the backend.
          </Alert>
        )}
        {note && (
          <Alert severity="success" onClose={() => setNote('')}>
            {note}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={close} sx={{ borderRadius: 2 }}>
          Reject Request
        </Button>
        <Button
          variant="contained"
          disabled={phase !== 'done'}
          onClick={() => setNote('Recorded locally — nothing was voided or discounted.')}
          sx={{ borderRadius: 2, fontWeight: 800, backgroundImage: 'linear-gradient(90deg, #C2410C, #9B2F00)' }}
        >
          Authorize (Phase B)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
