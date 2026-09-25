import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import ImagePicker from '../../components/ImagePicker.jsx';
import CuisineField from '../../components/CuisineField.jsx';import PageHeader from '../../components/layout/PageHeader.jsx';
import SeatCredentialsDialog from '../../components/SeatCredentialsDialog.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import {
  createBranch,
  createRestaurant,
  listRestaurants,
  uploadRestaurantCover,
  uploadRestaurantLogo,
} from '../../services/restaurant.js';
import { createStaff } from '../../services/staff.js';
import { randomSeatPassword, seatName } from '../../utils/outletSeat.js';
import { RESTAURANT_CATEGORIES } from '../../utils/restaurantMeta.js';

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
    title: 'Per-location analytics',
    body: 'Revenue, top dishes and dues for every location — owners see all, managers see home.',
  },
];

const FAQS = [
  {
    q: 'What does the pilot cost?',
    a: 'Nothing during the pilot. You get the full product — QR ordering, kitchen display, waiter board and analytics — while we learn from your floor.',
  },
  {
    q: 'How fast can my restaurant go live?',
    a: 'Same day. Complete the form below, print your table QR codes from the Tables page, and your menu is orderable tonight.',
  },
  {
    q: 'What happens after I launch?',
    a: 'Add your menu with photos, assign tables to waiters, and create logins for your team. Your dashboard starts filling from the first order.',
  },
  {
    q: 'I have more than one location — where do the rest go?',
    a: 'Open your restaurant, then add locations from Settings. Each location gets its own tables, staff, QR codes and manager login.',
  },
];

export default function RestaurantOnboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [frontDeskPhone, setFrontDeskPhone] = useState('');
  const [shop, setShop] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [taxPercentage, setTaxPercentage] = useState('5');
  const [serviceChargePercentage, setServiceChargePercentage] = useState('0');
  const [managerEmail, setManagerEmail] = useState('');
  const [skipSeat, setSkipSeat] = useState(false);

  // Files picked before the restaurant exists — uploaded right after create.
  const pendingLogo = useRef(null);
  const pendingCover = useRef(null);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [creds, setCreds] = useState(null); // { email, password, outletName, restaurantId }

  // Prefill owner details from the signed-in account (editable, stored as snapshot).
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !user) return;
    prefilled.current = true;
    if (user.fullName) setOwnerName((v) => v || user.fullName);
    if (user.phone) {
      setOwnerPhone((v) => v || user.phone);
      setFrontDeskPhone((v) => v || user.phone);
    }
    if (user.email) setOwnerEmail((v) => v || user.email);
  }, [user]);

  const valid =
    name.trim().length >= 2 &&
    category !== '' &&
    cuisine.trim().length >= 2 &&
    ownerName.trim().length >= 2 &&
    (shop.trim() !== '' || locality.trim() !== '' || city.trim() !== '');

  // Location-pinned managers can't create restaurants (backend 403) — send them home.
  useEffect(() => {
    if (!user?.branchId) return;
    listRestaurants()
      .then((r) => {
        const home = (r.data ?? [])[0];
        navigate(home ? `/admin/restaurants/${home.id}/setup` : '/admin/restaurants', { replace: true });
      })
      .catch(() => navigate('/admin/restaurants', { replace: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branchId]);

  // Before create: show an instant local preview and stash the File.
  function previewAndStash(slot) {
    return async (file) => {
      const url = URL.createObjectURL(file);
      if (slot === 'logo') {
        if (logoUrl.startsWith('blob:')) URL.revokeObjectURL(logoUrl);
        pendingLogo.current = file;
        setLogoUrl(url);
      } else {
        if (coverUrl.startsWith('blob:')) URL.revokeObjectURL(coverUrl);
        pendingCover.current = file;
        setCoverUrl(url);
      }
      return url;
    };
  }

  async function onLaunch(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const address = [shop.trim(), locality.trim(), city.trim(), pincode.trim()]
        .filter(Boolean)
        .join(', ');
      const r = await createRestaurant({
        name: name.trim(),
        category,
        cuisine: cuisine.trim(),
        description: description.trim() || undefined,
        currency: (currency || 'INR').toUpperCase(),
        taxPercentage: Number(taxPercentage) || 0,
        serviceChargePercentage: Number(serviceChargePercentage) || 0,
        ...(logoUrl.trim() && !logoUrl.startsWith('blob:') ? { logoUrl: logoUrl.trim() } : {}),
        ...(coverUrl.trim() && !coverUrl.startsWith('blob:') ? { coverUrl: coverUrl.trim() } : {}),
        ownerName: ownerName.trim(),
        ...(ownerPhone.trim() ? { ownerPhone: ownerPhone.trim() } : {}),
        ...(ownerEmail.trim() ? { ownerEmail: ownerEmail.trim() } : {}),
      });
      const restaurantId = r.data.id;
      const restaurantName = name.trim();
      // Upload stashed files now that the restaurant exists (best effort —
      // Settings covers the rest if this fails).
      if (pendingLogo.current) {
        try {
          await uploadRestaurantLogo(restaurantId, pendingLogo.current);
        } catch {
          // Owner re-uploads later from Settings.
        }
      }
      if (pendingCover.current) {
        try {
          await uploadRestaurantCover(restaurantId, pendingCover.current);
        } catch {
          // Owner re-uploads later from Settings.
        }
      }
      let branchId = null;
      try {
        // The first location carries the restaurant's own name —
        // one restaurant, one name, no brand-vs-location confusion.
        const b = await createBranch(restaurantId, {
          name: restaurantName,
          address: address || undefined,
          phone: (frontDeskPhone.trim() || ownerPhone.trim()) || undefined,
          openingTime: openingTime || undefined,
          closingTime: closingTime || undefined,
        });
        branchId = b.data.id;
      } catch (branchErr) {
        // Restaurant exists but the location failed — land on setup so the owner
        // can finish the location from there instead of losing everything.
        navigate(`/admin/restaurants/${restaurantId}/setup`);
        throw new Error(`Restaurant created, but the location failed: ${branchErr.message}`);
      }
      // Manager seat: the owner-typed email IS the restaurant's login.
      // Skipped → no seat now; one tap in Staff later. Never auto-invented.
      const seatEmail = skipSeat ? '' : managerEmail.trim();
      if (seatEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seatEmail)) {
        throw new Error('Manager email does not look like a real email address.');
      }
      if (seatEmail && branchId) {
        const password = randomSeatPassword();
        try {
          await createStaff({
            email: seatEmail,
            password,
            fullName: seatName(restaurantName, restaurantName),
            role: 'MANAGER',
            branchId,
            seat: true,
          });
          setCreds({ email: seatEmail, password, outletName: restaurantName, restaurantId });
          return;
        } catch (seatErr) {
          if (/already registered/i.test(seatErr.message)) {
            throw new Error('That manager email is already registered — use a different one, skip for now, or reset its password from Staff later.');
          }
          // Other seat failures — owner creates it later from Staff.
        }
      }
      navigate(`/admin/restaurants/${restaurantId}/setup`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Box>
      <PageHeader
        title="Partner with TablePulse"
        subtitle="One form — your restaurant, live tonight. More locations join later from Settings."
        actions={
          <Button component={RouterLink} to="/admin/restaurants" startIcon={<ArrowBackIcon />} variant="text">
            All restaurants
          </Button>
        }
      />

      {/* Pilot checklist + value props — all true, all shipped */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
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
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              What happens next
            </Typography>
            <Typography variant="body2" color="text.secondary">
              One tap creates your restaurant and its manager login. Then you add the menu,
              print QR codes, and go live — tonight.
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', gap: 1.5 }}>
            <SupportAgentIcon color="primary" />
            <Box>
              <Typography variant="subtitle2" fontWeight={800}>Stuck anywhere?</Typography>
              <Typography variant="body2" color="text.secondary">
                Write to us from the dashboard after launch — a human replies during the pilot.
              </Typography>
            </Box>
          </Paper>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={onLaunch} sx={{ display: 'grid', gap: 3 }}>
            {/* 1 — Images first */}
            <Box>
              <Typography variant="h6" fontWeight={800}>Restaurant images</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload from this device or paste a link. Guests and staff see these everywhere.
              </Typography>
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '280px 1fr' } }}>
                <ImagePicker kind="logo" value={logoUrl} onChange={setLogoUrl} onPickFile={previewAndStash('logo')} disabled={creating} />
                <ImagePicker kind="cover" value={coverUrl} onChange={setCoverUrl} onPickFile={previewAndStash('cover')} disabled={creating} />
              </Box>
            </Box>

            {/* 2 — Restaurant identity */}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2.5, display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Your restaurant</Typography>
                <Typography variant="body2" color="text.secondary">
                  Guests see this name on your QR menu and bills.
                </Typography>
              </Box>
              <TextField label="Restaurant name *" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="BihariMess" inputProps={{ maxLength: 100 }} />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label="Category *" select required value={category}
                  onChange={(e) => setCategory(e.target.value)}>
                  {RESTAURANT_CATEGORIES.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </TextField>
                <CuisineField value={cuisine} onChange={setCuisine} required disabled={creating} />
              </Box>
              <TextField label="Description" multiline rows={2} value={description}
                onChange={(e) => setDescription(e.target.value)} placeholder="Cuisines, vibe, what you're known for" />
            </Box>

            {/* 3 — Owner & contact (prefilled from account) */}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2.5, display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Owner & contact</Typography>
                <Typography variant="body2" color="text.secondary">
                  Prefilled from your account — confirm or correct. Stored with the restaurant.
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label="Owner name *" required value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)} placeholder="Your full name" />
                <TextField label="Owner phone *" required value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+91…" />
              </Box>
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                <TextField label="Owner email" type="email" value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@example.com" />
                <TextField label="Front-desk phone" value={frontDeskPhone}
                  onChange={(e) => setFrontDeskPhone(e.target.value)} placeholder="+91…"
                  helperText="Guests and staff call this number. Defaults to owner phone." />
              </Box>
            </Box>

            {/* 4 — Manager login (the restaurant's own email, typed by owner) */}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2.5, display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Manager login</Typography>
                <Typography variant="body2" color="text.secondary">
                  This email becomes the restaurant&apos;s login — whoever holds it runs this
                  location. Must be a real, unique email; it can back a Google login later.
                </Typography>
              </Box>
              <TextField label="Manager email" type="email" value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)} placeholder="e.g. batichokhadelhi@gmail.com"
                disabled={skipSeat} helperText="Shown once with its password after launch. You can reset it anytime." />
              <FormControlLabel
                control={<Checkbox checked={skipSeat} onChange={(e) => setSkipSeat(e.target.checked)} />}
                label={<Typography variant="body2">I&apos;ll add a manager later — skip for now</Typography>}
              />
            </Box>

            {/* 5 — Location */}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2.5, display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Restaurant location</Typography>
                <Typography variant="body2" color="text.secondary">
                  Where guests will scan. More locations join later from Settings.
                </Typography>
              </Box>
              <TextField label="Shop / building *" value={shop}
                onChange={(e) => setShop(e.target.value)} placeholder="Shop 14, Ground Floor" />
              <TextField label="Area / locality" value={locality}
                onChange={(e) => setLocality(e.target.value)} placeholder="Indiranagar Stage 2" />
              <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' } }}>
                <TextField label="City" value={city}
                  onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
                <TextField label="Pincode" value={pincode}
                  onChange={(e) => setPincode(e.target.value)} placeholder="560038" slotProps={{ htmlInput: { maxLength: 6 } }} />
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr', gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
                  <TextField label="Opens" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} placeholder="11:00" />
                  <TextField label="Closes" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} placeholder="23:00" />
                </Box>
              </Box>
            </Box>

            {/* 6 — Billing basics */}
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2.5 }}>
              <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2" fontWeight={700}>Billing basics (currency, GST, service)</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' } }}>
                  <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
                    slotProps={{ htmlInput: { maxLength: 3 } }} />
                  <TextField label="GST %" type="number" value={taxPercentage} onChange={(e) => setTaxPercentage(e.target.value)} />
                  <TextField label="Service %" type="number" value={serviceChargePercentage} onChange={(e) => setServiceChargePercentage(e.target.value)} />
                </AccordionDetails>
              </Accordion>
            </Box>

            <Alert severity="info">
              Document verification (FSSAI, GST, payouts) unlocks online payments — coming soon.
              QR ordering, kitchen and analytics work from day one.
            </Alert>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flexGrow: 1 }} />
              <Button type="submit" variant="contained" disabled={!valid || creating} sx={{ fontWeight: 800 }}>
                {creating ? 'Launching…' : 'Launch restaurant'}
              </Button>
            </Box>
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

      <SeatCredentialsDialog
        key={creds?.email ?? 'closed'}
        open={!!creds}
        email={creds?.email}
        password={creds?.password}
        outletName={creds?.outletName}
        onDone={() => {
          const rid = creds?.restaurantId;
          setCreds(null);
          navigate(`/admin/restaurants/${rid}/setup`);
        }}
      />
    </Box>
  );
}
