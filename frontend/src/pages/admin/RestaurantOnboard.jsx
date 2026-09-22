import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader.jsx';
import { createBranch, createRestaurant } from '../../services/restaurant.js';

const STEPS = ['Restaurant profile', 'First outlet', 'Review & launch'];

const VALUE_PROPS = [
  {
    icon: <QrCodeIcon color="primary" />,
    title: 'QR ordering in minutes',
    body: 'Guests scan, order and pay from their phones. No app download, no hardware.',
  },
  {
    icon: <SoupKitchenIcon color="primary" />,
    title: 'Kitchen that keeps pace',
    body: 'Live KDS board with urgency ramp, 86-board and rush-hour triage built in.',
  },
  {
    icon: <RestaurantMenuIcon color="primary" />,
    title: 'Per-outlet analytics',
    body: 'Revenue, top dishes and dues for every outlet — owners see all, managers see home.',
  },
];

const FAQS = [
  {
    q: 'What does the pilot cost?',
    a: 'Nothing during the pilot. You get the full product — QR ordering, kitchen display, waiter board and analytics — while we learn from your floor.',
  },
  {
    q: 'How fast can my restaurant go live?',
    a: 'Same day. Complete the two steps below, print your table QR codes from the Tables page, and your menu is orderable tonight.',
  },
  {
    q: 'What happens after I launch?',
    a: 'Add your menu with photos, assign tables to waiters, and create logins for your outlet manager. Your dashboard starts filling from the first order.',
  },
  {
    q: 'Do my outlet managers see my other restaurants?',
    a: 'No. Staff logins are locked to their home outlet — orders, payments and analytics included. Only you (and all-branch managers) see everything.',
  },
];

const EMPTY_REST = { name: '', description: '', currency: 'INR', taxPercentage: '5', serviceChargePercentage: '0', logoUrl: '' };
const EMPTY_BRANCH = { name: '', address: '', phone: '', openingTime: '', closingTime: '' };

export default function RestaurantOnboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBrandMode = searchParams.get('mode') === 'brand';
  const [step, setStep] = useState(0);
  const [rest, setRest] = useState(EMPTY_REST);
  const [branch, setBranch] = useState(EMPTY_BRANCH);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const setR = (k) => (e) => setRest((f) => ({ ...f, [k]: e.target.value }));
  const setB = (k) => (e) => setBranch((f) => ({ ...f, [k]: e.target.value }));

  const stepValid =
    step === 0
      ? rest.name.trim().length >= 2
      : step === 1
        ? branch.name.trim().length >= 2
        : true;

  async function onLaunch() {
    setCreating(true);
    setError(null);
    try {
      const r = await createRestaurant({
        name: rest.name.trim(),
        description: rest.description.trim() || undefined,
        currency: (rest.currency || 'INR').toUpperCase(),
        taxPercentage: Number(rest.taxPercentage) || 0,
        serviceChargePercentage: Number(rest.serviceChargePercentage) || 0,
        ...(rest.logoUrl.trim() ? { logoUrl: rest.logoUrl.trim() } : {}),
      });
      const restaurantId = r.data.id;
      try {
        await createBranch(restaurantId, {
          name: branch.name.trim(),
          address: branch.address.trim() || undefined,
          phone: branch.phone.trim() || undefined,
          openingTime: branch.openingTime || undefined,
          closingTime: branch.closingTime || undefined,
        });
      } catch (branchErr) {
        // Restaurant exists but the outlet failed — land there so the owner
        // can add the outlet from Settings instead of losing everything.
        navigate(`/admin/restaurants/${restaurantId}`);
        throw new Error(`Restaurant created, but the outlet failed: ${branchErr.message}`);
      }
      navigate(`/admin/restaurants/${restaurantId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title={isBrandMode ? 'Partner your brand' : 'Partner with TablePulse'}
        subtitle={isBrandMode
          ? 'Register the brand now — add the rest of its outlets later from Settings.'
          : 'Grow your dine-in business — live tonight, not next quarter.'}
        actions={
          <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} variant="text">
            All restaurants
          </Button>
        }
      />

      {/* Pilot checklist + value props — all true, all shipped */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 4, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={800} gutterBottom>
          Get started in minutes
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {['Free pilot', 'QR stickers in days', 'Live support on call'].map((t) => (
            <Chip key={t} size="small" icon={<CheckCircleIcon />} label={t} color="success" variant="outlined" />
          ))}
        </Box>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' } }}>
          {VALUE_PROPS.map((v) => (
            <Box key={v.title} sx={{ display: 'flex', gap: 1.5 }}>
              <Box sx={{ flexShrink: 0 }}>{v.icon}</Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={800}>{v.title}</Typography>
                <Typography variant="body2" color="text.secondary">{v.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '280px 1fr' }, alignItems: 'start' }}>
        {/* Stepper rail + helper */}
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              Complete your registration
            </Typography>
            <Stepper activeStep={step} orientation="vertical" sx={{ mt: 1 }}>
              {STEPS.map((label, i) => (
                <Step key={label} completed={i < step}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, display: 'flex', gap: 1.5 }}>
            <SupportAgentIcon color="primary" />
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>Stuck anywhere?</Typography>
              <Typography variant="body2" color="text.secondary">
                Write to us from the dashboard after launch — a human replies during the pilot.
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Step content */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {step === 0 && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Restaurant profile</Typography>
                <Typography variant="body2" color="text.secondary">
                  Guests will see this name on your QR menu.
                </Typography>
              </Box>
              <TextField label="Restaurant name *" required fullWidth value={rest.name}
                onChange={setR('name')} placeholder="MamaBhanje" inputProps={{ maxLength: 100 }} />
              <TextField label="Description" fullWidth multiline rows={2} value={rest.description}
                onChange={setR('description')} placeholder="Cuisines, vibe, what you're known for" />
              <TextField label="Logo image URL (optional)" fullWidth value={rest.logoUrl}
                onChange={setR('logoUrl')} placeholder="https://…" />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                <TextField label="Currency" value={rest.currency} onChange={setR('currency')}
                  slotProps={{ htmlInput: { maxLength: 3 } }} />
                <TextField label="GST %" type="number" value={rest.taxPercentage} onChange={setR('taxPercentage')} />
                <TextField label="Service %" type="number" value={rest.serviceChargePercentage} onChange={setR('serviceChargePercentage')} />
              </Box>
            </Box>
          )}

          {step === 1 && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>First outlet</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isBrandMode
                    ? 'Where guests will scan first. More brand outlets join later from Settings.'
                    : 'Where guests will scan. More branches can join later from Settings.'}
                </Typography>
              </Box>
              <TextField label="Outlet name *" required fullWidth value={branch.name}
                onChange={setB('name')} placeholder="Koramangala Branch" inputProps={{ maxLength: 100 }} />
              <TextField label="Address" fullWidth multiline rows={2} value={branch.address}
                onChange={setB('address')} placeholder="Shop, street, area, city" />
              <TextField label="Phone" fullWidth value={branch.phone}
                onChange={setB('phone')} placeholder="+91…" />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
                <TextField label="Opens (HH:mm)" value={branch.openingTime} onChange={setB('openingTime')} placeholder="11:00" />
                <TextField label="Closes (HH:mm)" value={branch.closingTime} onChange={setB('closingTime')} placeholder="23:00" />
              </Box>
            </Box>
          )}

          {step === 2 && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Review & launch</Typography>
                <Typography variant="body2" color="text.secondary">
                  One tap creates the restaurant and its first outlet.
                </Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                <Typography variant="subtitle1" fontWeight={800}>{rest.name || '—'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[rest.description, `${rest.currency} · GST ${Number(rest.taxPercentage) || 0}%`]
                    .filter(Boolean).join(' · ')}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Outlet: <strong>{branch.name || '—'}</strong>
                  {[branch.address, branch.phone,
                    branch.openingTime && branch.closingTime ? `${branch.openingTime}–${branch.closingTime}` : null,
                  ].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Alert severity="info">
                Document verification (FSSAI, GST, payouts) unlocks online payments — coming soon.
                QR ordering, kitchen and analytics work from day one.
              </Alert>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
            <Button disabled={step === 0 || creating} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            {step < 2 ? (
              <Button variant="contained" disabled={!stepValid} onClick={() => setStep((s) => s + 1)} sx={{ fontWeight: 800 }}>
                Next
              </Button>
            ) : (
              <Button variant="contained" disabled={creating} onClick={onLaunch} sx={{ fontWeight: 800 }}>
                {creating ? 'Launching…' : 'Launch restaurant'}
              </Button>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Honest FAQ — real pilot answers only */}
      <Box sx={{ mt: 3, maxWidth: 760, mx: 'auto' }}>
        <Typography variant="h6" fontWeight={800} sx={{ textAlign: 'center', mb: 1.5 }}>
          Frequently asked questions
        </Typography>
        {FAQS.map((f) => (
          <Accordion key={f.q} disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" fontWeight={700}>{f.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">{f.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
}
