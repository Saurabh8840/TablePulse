import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { listStaff } from '../../services/staff.js';
import { assignTableWaiter, bulkCreateTables, bulkDeleteTables, createTable, fetchQrPng, listTables } from '../../services/tables.js';

const STATUS_COLOR = { AVAILABLE: 'success', OCCUPIED: 'warning', RESERVED: 'info' };

export default function Tables() {
  const { branchId } = useParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [single, setSingle] = useState({ tableNumber: '', seatingCapacity: 4 });
  const [bulk, setBulk] = useState({ prefix: 'T', from: 1, to: 20, seatingCapacity: 4 });
  const [formError, setFormError] = useState(null);
  const [qr, setQr] = useState(null); // { url, payload, number }
  const [waiters, setWaiters] = useState([]);
  const [selected, setSelected] = useState([]); // table ids marked for delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null); // { deleted, blocked }

  const load = () =>
    listTables(branchId)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));

  useEffect(() => {
    if (!branchId) return;
    // Fix 2: only this branch's waiters. Fresh branch shows empty + hint,
    // never workers from other restaurants/branches of the same owner.
    listStaff({ branchId })
      .then((r) => setWaiters((r.data ?? []).filter((u) => u.role === 'WAITER' && u.active)))
      .catch(() => setWaiters([]));
  }, [branchId]);

  useEffect(() => {
    load();
    return () => {
      if (qr?.url) URL.revokeObjectURL(qr.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function onAdd(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await createTable(branchId, { ...single, seatingCapacity: Number(single.seatingCapacity) || 4 });
      setAddOpen(false);
      setSingle({ tableNumber: '', seatingCapacity: 4 });
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function onBulk(e) {
    e.preventDefault();
    setFormError(null);
    try {
      await bulkCreateTables(branchId, {
        prefix: bulk.prefix,
        from: Number(bulk.from),
        to: Number(bulk.to),
        seatingCapacity: Number(bulk.seatingCapacity) || 4,
      });
      setBulkOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function openQr(t) {
    try {
      const blobData = await fetchQrPng(t.id);
      if (qr?.url) URL.revokeObjectURL(qr.url);
      setQr({ url: URL.createObjectURL(blobData), payload: t.qrCodeUrl, number: t.tableNumber });
    } catch (err) {
      setError(err.message);
    }
  }

  const toggleSelect = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));

  const selectedTables = (rows ?? []).filter((t) => selected.includes(t.id));

  async function onConfirmDelete() {
    setDeleting(true);
    try {
      const res = await bulkDeleteTables(branchId, selected);
      setDeleteResult(res.data);
      setSelected([]);
      setDeleteOpen(false);
      load();
    } catch (err) {
      setError(err.message);
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  async function onAssign(t, waiterId) {
    try {
      await assignTableWaiter(t.id, waiterId || null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const activeRows = (rows ?? []).filter((t) => t.active);
  const unassigned = activeRows.filter((t) => !t.assignedWaiterId).length;

  return (
    <Box>
      <PageHeader
        title="Tables & QR codes"
        subtitle={`${activeRows.length} tables · scan a code to open that table's menu`}
        actions={
          <>
            <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} variant="text">
              Restaurants
            </Button>
            <Button variant="outlined" onClick={() => setBulkOpen(true)}>
              Bulk create
            </Button>
            {selected.length > 0 && (
              <Button variant="outlined" color="error" onClick={() => { setDeleteResult(null); setDeleteOpen(true); }}>
                Delete ({selected.length})
              </Button>
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
              Add table
            </Button>
          </>
        }
      />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {deleteResult && (
        <Alert
          severity={deleteResult.blocked?.length > 0 ? 'warning' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setDeleteResult(null)}
        >
          Deleted {deleteResult.deleted?.length ?? 0} table{(deleteResult.deleted?.length ?? 0) === 1 ? '' : 's'}
          {(deleteResult.deleted ?? []).length > 0 && `: ${deleteResult.deleted.join(', ')}`}
          {(deleteResult.blocked ?? []).map((b) => ` · ${b.tableNumber}: ${b.reason}`).join('')}
        </Alert>
      )}
      {rows === null && <CircularProgress />}
      {rows !== null && unassigned > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          ⚠️ {unassigned} table{unassigned === 1 ? ' has' : 's have'} no waiter — house for now, any waiter can serve.
          Assign every table so each waiter owns their floor.
        </Alert>
      )}
      {rows !== null && waiters.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No waiters in this branch yet — add them under Staff (pick this restaurant → branch),
          then assign them here. Workers from your other restaurants are never shown here.
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)', xl: 'repeat(5, 1fr)' } }}>
        {(rows ?? []).filter((t) => t.active).map((t) => (
          <Card key={t.id} sx={{ '&:hover': { boxShadow: 4 }, position: 'relative', ...(selected.includes(t.id) && { borderColor: 'error.main', borderWidth: 2 }) }} variant="outlined">
            <Checkbox
              size="small"
              checked={selected.includes(t.id)}
              onChange={() => toggleSelect(t.id)}
              sx={{ position: 'absolute', top: 4, left: 4 }}
              slotProps={{ input: { 'aria-label': `select table ${t.tableNumber}` } }}
            />
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={800}>
                {t.tableNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t.seatingCapacity} seats
              </Typography>
              <Box sx={{ my: 1 }}>
                <Chip size="small" color={STATUS_COLOR[t.status] ?? 'default'} label={t.status} />
              </Box>
              <TextField
                select
                size="small"
                fullWidth
                label="Waiter"
                value={t.assignedWaiterId ?? ''}
                onChange={(e) => onAssign(t, e.target.value)}
                sx={{ mb: 1 }}
              >
                <MenuItem value="">🏠 House (any waiter)</MenuItem>
                {waiters.map((w) => (
                  <MenuItem key={w.userId} value={w.userId}>{w.fullName}</MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                <Tooltip title="Show QR code">
                  <IconButton size="small" onClick={() => openQr(t)}>
                    <QrCodeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete table (keeps order history)">
                  <IconButton size="small" onClick={() => { setSelected([t.id]); setDeleteResult(null); setDeleteOpen(true); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add table</DialogTitle>
        <Box component="form" onSubmit={onAdd}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField label="Table number" required value={single.tableNumber} onChange={(e) => setSingle((s) => ({ ...s, tableNumber: e.target.value }))} placeholder="T6" />
            <TextField label="Seats" type="number" value={single.seatingCapacity} onChange={(e) => setSingle((s) => ({ ...s, seatingCapacity: e.target.value }))} />
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Bulk create tables</DialogTitle>
        <Box component="form" onSubmit={onBulk}>
          <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Creates {bulk.prefix}
              {bulk.from} … {bulk.prefix}
              {bulk.to}, skipping numbers that already exist.
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr 1fr' }}>
              <TextField label="Prefix" value={bulk.prefix} onChange={(e) => setBulk((s) => ({ ...s, prefix: e.target.value }))} />
              <TextField label="From" type="number" value={bulk.from} onChange={(e) => setBulk((s) => ({ ...s, from: e.target.value }))} />
              <TextField label="To" type="number" value={bulk.to} onChange={(e) => setBulk((s) => ({ ...s, to: e.target.value }))} />
            </Box>
            <TextField label="Seats each" type="number" value={bulk.seatingCapacity} onChange={(e) => setBulk((s) => ({ ...s, seatingCapacity: e.target.value }))} />
            {formError && <Alert severity="error">{formError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          Delete {selectedTables.length} table{selectedTables.length === 1 ? '' : 's'}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {selectedTables.map((t) => t.tableNumber).join(', ')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Past orders and bills are kept. Their QR codes stop working, and the numbers can be
            reused later. Occupied tables are skipped automatically.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={onConfirmDelete}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!qr} onClose={() => setQr(null)} fullWidth maxWidth="xs">
        <DialogTitle>Table {qr?.number} — QR code</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {qr?.url && <Box component="img" src={qr.url} alt={`QR for table ${qr.number}`} sx={{ width: '100%', maxWidth: 320, borderRadius: 2 }} />}
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mt: 1, wordBreak: 'break-all' }}>
            {qr?.payload}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQr(null)}>Close</Button>
          {qr?.url && (
            <Button variant="contained" href={qr.url} download={`table-${qr.number}-qr.png`}>
              Download PNG
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
