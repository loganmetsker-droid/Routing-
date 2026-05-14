import { type KeyboardEvent, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowForwardRounded as ArrowForwardRoundedIcon,
  CalendarMonthRounded as CalendarMonthRoundedIcon,
  CheckRounded as CheckRoundedIcon,
  CloseRounded as CloseRoundedIcon,
  LocalShippingRounded as LocalShippingRoundedIcon,
  MapRounded as MapRoundedIcon,
  RouteRounded as RouteRoundedIcon,
  SecurityRounded as SecurityRoundedIcon,
  TimelineRounded as TimelineRoundedIcon,
} from '@mui/icons-material';
import { TopoShellBackground } from '../components/TopoShellBackground';
import { trovanColors, trovanTypography } from '../theme/designTokens';

type FleetSizeKey = '5-15' | '16-35' | '36-75';
type DailyStopsKey = '50' | '125' | '250';
type PainKey = 'planning' | 'updates' | 'etas' | 'windows';

type AuditInputs = {
  fleetSize: FleetSizeKey;
  dailyStops: DailyStopsKey;
  pain: PainKey;
};

type AuditSnapshot = {
  planningHours: string;
  routesToReview: string;
  updateGaps: string;
  nextStep: string;
};

const navItems = [
  { label: 'Platform', href: '#platform' },
  { label: 'Route audit', href: '#route-audit' },
  { label: 'Product', href: '#product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Implementation', href: '#implementation' },
];

const fleetSizeOptions: Array<{ label: FleetSizeKey; description: string }> = [
  { label: '5-15', description: 'Owner-led routes' },
  { label: '16-35', description: 'Growing dispatch team' },
  { label: '36-75', description: 'Multi-route operation' },
];

const dailyStopOptions: Array<{ label: DailyStopsKey; description: string }> = [
  { label: '50', description: 'Light daily plan' },
  { label: '125', description: 'Dense local routes' },
  { label: '250', description: 'High-volume delivery' },
];

const painOptions: Array<{ key: PainKey; label: string; description: string }> = [
  { key: 'planning', label: 'Planning time', description: 'Routes take too long to build.' },
  { key: 'updates', label: 'Driver updates', description: 'Dispatch is chasing route status.' },
  { key: 'etas', label: 'Customer ETAs', description: 'Customers keep asking where orders are.' },
  { key: 'windows', label: 'Missed windows', description: 'Stops slip without early warning.' },
];

const problemOutcomes = [
  {
    icon: RouteRoundedIcon,
    pain: 'Manual route planning',
    outcome: 'Balanced route plans',
    body: 'Build route drafts around capacity, service windows, and delivery density before the day starts.',
  },
  {
    icon: TimelineRoundedIcon,
    pain: 'Dispatcher guesswork',
    outcome: 'Live dispatch board',
    body: 'See route status, exceptions, and assignments without rebuilding the day from text threads.',
  },
  {
    icon: LocalShippingRoundedIcon,
    pain: 'Driver text threads',
    outcome: 'Mobile execution flow',
    body: 'Give drivers a clear stop-by-stop workspace for arrival, proof, notes, and route completion.',
  },
  {
    icon: CheckRoundedIcon,
    pain: 'Customer ETA calls',
    outcome: 'Tracking and proof links',
    body: 'Keep customers informed with tracking links and delivery proof attached to the route run.',
  },
];

const productTabs = [
  {
    key: 'plan',
    label: 'Plan',
    title: 'Plan routes before they become dispatch problems',
    src: '/marketing/routing-workspace.png',
    href: '/routing',
    capabilities: [
      'Objective controls for balanced route drafts',
      'Map-first route inspection',
      'Capacity and unassigned-job visibility',
    ],
  },
  {
    key: 'dispatch',
    label: 'Dispatch',
    title: 'Keep route execution visible after publish',
    src: '/marketing/dispatch-board.png',
    href: '/dispatch',
    capabilities: [
      'Route lanes and exception context',
      'Driver assignment visibility',
      'Dispatch-ready operational board',
    ],
  },
  {
    key: 'drive',
    label: 'Drive',
    title: 'Give drivers a focused mobile route flow',
    src: '/marketing/driver-workspace.png',
    href: '/driver',
    capabilities: [
      'Arrive, proof, depart execution',
      'Stop notes and route progress',
      'Driver-only workspace path',
    ],
  },
  {
    key: 'track',
    label: 'Track',
    title: 'Reduce customer where-is-it calls',
    href: '/track/demo-token',
    capabilities: [
      'Public tracking path',
      'Delivery status timeline',
      'Proof-ready customer updates',
    ],
  },
];

const auditDeliverables = [
  ['Workflow review', 'How jobs become route plans today.'],
  ['Dispatch friction map', 'Where updates and exceptions get stuck.'],
  ['Driver execution check', 'How drivers receive, complete, and prove work.'],
  ['Customer visibility gap', 'Where ETA and proof communication breaks down.'],
  ['Implementation plan', 'What Trovan would need to connect first.'],
];

const plans = [
  {
    name: 'Starter',
    price: '$399',
    cta: 'Get Starter audit',
    body: 'For local delivery teams proving route discipline.',
    features: ['Route planning workspace', 'Driver mobile flow', 'Public tracking links'],
  },
  {
    name: 'Growth',
    price: '$899',
    cta: 'Talk through Growth',
    body: 'For operators that need live dispatch and exception control.',
    features: ['Dispatch command center', 'Customer and fleet records', 'Analytics and route history'],
    featured: true,
  },
  {
    name: 'Operations',
    price: 'Custom',
    cta: 'Plan implementation',
    body: 'For multi-team fleets with stricter controls.',
    features: ['SSO and audit posture', 'Webhook and API access', 'Implementation readiness plan'],
  },
];

const implementationItems = [
  ['Domain and hosting', 'Confirm Cloudflare routing, static asset deploys, and direct app route fallback before launch traffic lands.'],
  ['Auth and user roles', 'Shape the sign-in path around operator, dispatcher, driver, and admin roles.'],
  ['Billing path', 'Prepare Stripe packaging around audit, pilot, and rollout conversations.'],
  ['Email, SMS, and customer updates', 'Map the notification path from route publish through delivery proof.'],
  ['Routing-service verification', 'Smoke the optimizer path and compare outputs against a real route day.'],
  ['Security and tenant controls', 'Keep customer, driver, and route data scoped as the implementation expands.'],
];

function getAuditSnapshot(inputs: AuditInputs): AuditSnapshot {
  const stopFactor = inputs.dailyStops === '50' ? 1 : inputs.dailyStops === '125' ? 2 : 3;
  const fleetFactor = inputs.fleetSize === '5-15' ? 1 : inputs.fleetSize === '16-35' ? 2 : 3;
  const planningHours = 3 + stopFactor + fleetFactor;
  const routesToReview = Math.max(2, fleetFactor + stopFactor);
  const updateGaps =
    inputs.pain === 'etas' ? 'High' : inputs.pain === 'updates' ? 'Medium-high' : 'Medium';

  const nextSteps: Record<PainKey, string> = {
    planning: 'Start with tomorrow route build and compare manual planning time to a dispatch-ready Trovan plan.',
    updates: 'Map the handoff between dispatch and drivers, then replace status chasing with live route progress.',
    etas: 'Review the customer notification path and identify where tracking links can remove ETA calls.',
    windows: 'Review late-risk stops before dispatch so planners can rebalance routes earlier.',
  };

  return {
    planningHours: `${planningHours}-${planningHours + 2} hrs`,
    routesToReview: `${routesToReview}-${routesToReview + 2}`,
    updateGaps,
    nextStep: nextSteps[inputs.pain],
  };
}

function MarketingHeader({
  onStartAudit,
  onBookDemo,
}: {
  onStartAudit: () => void;
  onBookDemo: () => void;
}) {
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        borderBottom: `1px solid ${alpha('#FFF8ED', 0.1)}`,
        bgcolor: alpha(trovanColors.black[950], 0.84),
        backdropFilter: 'blur(18px)',
      }}
    >
      <Box
        sx={{
          width: 'min(1180px, calc(100% - 32px))',
          mx: 'auto',
          minHeight: 68,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          component="a"
          href="/"
          aria-label="Trovan home"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mr: 'auto', textDecoration: 'none' }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.25,
              display: 'grid',
              placeItems: 'center',
              color: trovanColors.copper[200],
              border: `1px solid ${alpha(trovanColors.copper[300], 0.34)}`,
              bgcolor: alpha(trovanColors.copper[500], 0.12),
              fontFamily: trovanTypography.brandFontFamily,
              fontWeight: 800,
            }}
          >
            T
          </Box>
          <Typography
            sx={{
              color: '#FFF8ED',
              fontFamily: trovanTypography.brandFontFamily,
              fontSize: 25,
            }}
          >
            Trovan
          </Typography>
        </Box>
        <Stack
          component="nav"
          direction="row"
          spacing={0.5}
          sx={{ display: { xs: 'none', md: 'flex' } }}
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <Button key={item.href} href={item.href} size="small" sx={{ color: alpha('#FFF8ED', 0.78), px: 1.25 }}>
              {item.label}
            </Button>
          ))}
        </Stack>
        <Button href="/login" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          Sign in
        </Button>
        <Button
          variant="outlined"
          startIcon={<CalendarMonthRoundedIcon />}
          onClick={onBookDemo}
          sx={{ display: { xs: 'none', lg: 'inline-flex' } }}
        >
          Book a demo
        </Button>
        <Button variant="contained" startIcon={<RouteRoundedIcon />} onClick={onStartAudit}>
          Get a routing audit
        </Button>
      </Box>
    </Box>
  );
}

function RouteAuditPreview({
  onStartAudit,
}: {
  onStartAudit: (inputs?: AuditInputs) => void;
}) {
  const [inputs, setInputs] = useState<AuditInputs>({
    fleetSize: '16-35',
    dailyStops: '125',
    pain: 'planning',
  });
  const snapshot = getAuditSnapshot(inputs);

  return (
    <Box
      aria-label="Route audit preview"
      sx={{
        borderRadius: 1.6,
        border: `1px solid ${alpha('#FFF8ED', 0.14)}`,
        bgcolor: alpha(trovanColors.utility.panel, 0.94),
        boxShadow: '0 34px 90px rgba(0,0,0,0.42)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${alpha('#FFF8ED', 0.1)}` }}>
        <Typography variant="h5" sx={{ color: '#FFF8ED', fontWeight: 900 }}>
          Route audit preview
        </Typography>
        <Typography sx={{ mt: 0.5, color: alpha('#FFF8ED', 0.68) }}>
          Tune the snapshot to your operation and see where a first Trovan audit starts.
        </Typography>
      </Box>
      <Box sx={{ p: { xs: 2, md: 2.5 }, display: 'grid', gap: 2 }}>
        <OptionButtons
          label="Fleet size"
          options={fleetSizeOptions}
          active={inputs.fleetSize}
          onSelect={(fleetSize) => setInputs((current) => ({ ...current, fleetSize }))}
        />
        <OptionButtons
          label="Daily stops"
          options={dailyStopOptions}
          active={inputs.dailyStops}
          onSelect={(dailyStops) => setInputs((current) => ({ ...current, dailyStops }))}
        />
        <TextField
          select
          label="Biggest routing pain"
          value={inputs.pain}
          onChange={(event) =>
            setInputs((current) => ({ ...current, pain: event.target.value as PainKey }))
          }
          InputLabelProps={{ sx: { color: alpha('#FFF8ED', 0.72) } }}
          sx={{
            '& .MuiInputBase-root': { color: '#FFF8ED' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#FFF8ED', 0.18) },
            '& .MuiSvgIcon-root': { color: '#FFF8ED' },
          }}
        >
          {painOptions.map((option) => (
            <MenuItem key={option.key} value={option.key}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
          {[
            ['Planning hours at risk', snapshot.planningHours],
            ['Routes needing review', snapshot.routesToReview],
            ['Customer update gaps', snapshot.updateGaps],
          ].map(([label, value]) => (
            <Box key={label} sx={{ p: 1.4, borderRadius: 1.2, bgcolor: alpha('#FFF8ED', 0.06), border: `1px solid ${alpha('#FFF8ED', 0.1)}` }}>
              <Typography sx={{ color: alpha('#FFF8ED', 0.6), fontSize: 12, fontWeight: 800 }}>
                {label}
              </Typography>
              <Typography sx={{ mt: 0.5, color: '#FFF8ED', fontSize: 24, fontWeight: 900 }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
        <Alert
          severity="info"
          icon={false}
          sx={{ bgcolor: alpha(trovanColors.copper[300], 0.12), color: '#FFF8ED', border: `1px solid ${alpha(trovanColors.copper[300], 0.18)}` }}
        >
          {snapshot.nextStep}
        </Alert>
        <Button variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onStartAudit(inputs)}>
          Build my audit
        </Button>
      </Box>
    </Box>
  );
}

function OptionButtons<T extends string>({
  label,
  options,
  active,
  onSelect,
}: {
  label: string;
  options: Array<{ label: T; description: string }>;
  active: T;
  onSelect: (value: T) => void;
}) {
  return (
    <Box>
      <Typography sx={{ color: alpha('#FFF8ED', 0.72), fontWeight: 800, mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {options.map((option) => (
          <Button
            key={option.label}
            variant={active === option.label ? 'contained' : 'outlined'}
            onClick={() => onSelect(option.label)}
            sx={{ minWidth: 74 }}
          >
            {option.label}
          </Button>
        ))}
      </Stack>
    </Box>
  );
}

function ProductProofTabs() {
  const [activeKey, setActiveKey] = useState(productTabs[0].key);
  const activeTab = productTabs.find((tab) => tab.key === activeKey) ?? productTabs[0];
  const panelId = `product-proof-panel-${activeTab.key}`;

  const handleProductTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? productTabs.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % productTabs.length
            : (index - 1 + productTabs.length) % productTabs.length;
    setActiveKey(productTabs[nextIndex].key);
  };

  return (
    <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.42fr 0.58fr' }, gap: 3, alignItems: 'stretch' }}>
      <Box sx={{ display: 'grid', gap: 1.2, alignContent: 'start' }} role="tablist" aria-label="Product proof">
        {productTabs.map((tab, index) => (
          <Button
            key={tab.key}
            id={`product-proof-tab-${tab.key}`}
            role="tab"
            aria-selected={activeKey === tab.key}
            aria-controls={`product-proof-panel-${tab.key}`}
            tabIndex={activeKey === tab.key ? 0 : -1}
            onClick={() => setActiveKey(tab.key)}
            onKeyDown={(event) => handleProductTabKeyDown(event, index)}
            variant={activeKey === tab.key ? 'contained' : 'outlined'}
            sx={{
              justifyContent: 'space-between',
              minHeight: 54,
              color: activeKey === tab.key ? '#FFFFFF' : trovanColors.black[900],
              borderColor: alpha(trovanColors.black[900], 0.24),
              '&:hover': { borderColor: trovanColors.copper[500] },
            }}
            endIcon={<ArrowForwardRoundedIcon />}
          >
            {tab.label}
          </Button>
        ))}
        <Box
          id={panelId}
          role="tabpanel"
          aria-labelledby={`product-proof-tab-${activeTab.key}`}
          tabIndex={0}
          sx={{ mt: 2, p: 2, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}
        >
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {activeTab.title}
          </Typography>
          <List dense sx={{ mt: 1 }}>
            {activeTab.capabilities.map((capability) => (
              <ListItem key={capability} disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckRoundedIcon sx={{ color: trovanColors.semantic.success }} fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={capability} />
              </ListItem>
            ))}
          </List>
          <Button
            href={activeTab.href}
            variant="text"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ color: trovanColors.copper[700], px: 0 }}
          >
            Open screen
          </Button>
        </Box>
      </Box>
      <Box sx={{ borderRadius: 1.8, bgcolor: alpha(trovanColors.black[900], 0.04), border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`, overflow: 'hidden', minHeight: { xs: 360, md: 520 } }}>
        {activeTab.src ? (
          <Box
            component="img"
            src={activeTab.src}
            alt={`${activeTab.label} product screenshot`}
            sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top left' }}
          />
        ) : (
          <TrackingMiniPanel />
        )}
      </Box>
    </Box>
  );
}

function TrackingMiniPanel() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: '100%', display: 'grid', alignContent: 'center', bgcolor: trovanColors.stone[50] }}>
      <Box sx={{ mx: 'auto', width: 'min(100%, 430px)', borderRadius: 2, bgcolor: trovanColors.stone[0], boxShadow: '0 24px 70px rgba(47, 38, 28, 0.18)', overflow: 'hidden', border: `1px solid ${alpha(trovanColors.copper[900], 0.14)}` }}>
        <Box sx={{ p: 2, bgcolor: trovanColors.black[900], color: '#FFF8ED' }}>
          <Typography sx={{ fontWeight: 900 }}>Delivery tracking</Typography>
          <Typography sx={{ color: alpha('#FFF8ED', 0.72), fontSize: 13 }}>Order TRV-1048</Typography>
        </Box>
        <Stack spacing={1.5} sx={{ p: 2 }}>
          {['Route published', 'Driver en route', 'Arriving next', 'Proof ready'].map((event, index) => (
            <Box key={event} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: index < 3 ? trovanColors.semantic.success : alpha(trovanColors.copper[900], 0.2) }} />
              <Typography sx={{ fontWeight: 800 }}>{event}</Typography>
            </Box>
          ))}
          <Alert severity="success">ETA window: 2:10-2:35 PM</Alert>
        </Stack>
      </Box>
    </Box>
  );
}

function RouteAuditDialog({
  open,
  defaults,
  onClose,
}: {
  open: boolean;
  defaults: AuditInputs;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Get a Trovan routing audit
        <IconButton aria-label="Close routing audit form" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {submitted ? (
          <Alert severity="success" sx={{ my: 1 }}>
            Routing audit request captured locally for this rollout. The next implementation pass can connect this form to CRM, email, or calendar booking.
          </Alert>
        ) : (
          <Stack
            key={`${defaults.fleetSize}-${defaults.dailyStops}-${defaults.pain}`}
            component="form"
            spacing={2}
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <Typography color="text.secondary">
              Share your route volume and workflow pain. We will frame the audit around planning time, dispatch handoffs, driver execution, and customer updates.
            </Typography>
            <TextField label="Work email" type="email" required fullWidth />
            <TextField label="Company" required fullWidth />
            <TextField label="Fleet size" select required defaultValue={defaults.fleetSize}>
              {fleetSizeOptions.map((option) => (
                <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Daily stops" select required defaultValue={defaults.dailyStops}>
              {dailyStopOptions.map((option) => (
                <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Biggest routing pain" select required defaultValue={defaults.pain}>
              {painOptions.map((option) => (
                <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Current planning method" placeholder="Spreadsheet, Google Maps, legacy route tool, driver texts..." fullWidth />
            <TextField label="What should we inspect first?" multiline minRows={3} fullWidth />
            <Button type="submit" variant="contained" size="large" startIcon={<RouteRoundedIcon />}>
              Request route audit
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Book a Trovan demo
        <IconButton
          aria-label="Close demo form"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {submitted ? (
          <Alert severity="success" sx={{ my: 1 }}>
            Demo request captured locally for this rollout. The next implementation pass can wire this to CRM, email, or a calendar tool.
          </Alert>
        ) : (
          <Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
            <Typography color="text.secondary">
              Tell us what your dispatch day looks like. We will show the product path for route planning, dispatch, driver execution, and customer tracking.
            </Typography>
            <TextField label="Work email" type="email" required fullWidth />
            <TextField label="Company" required fullWidth />
            <TextField label="Fleet size" select required defaultValue="16-35">
              {fleetSizeOptions.map((option) => (
                <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="What should the demo focus on?" multiline minRows={3} fullWidth />
            <Button type="submit" variant="contained" size="large" startIcon={<CalendarMonthRoundedIcon />}>
              Request demo
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PublicLaunchPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditDefaults, setAuditDefaults] = useState<AuditInputs>({
    fleetSize: '16-35',
    dailyStops: '125',
    pain: 'planning',
  });

  const openAuditDialog = (inputs?: AuditInputs) => {
    if (inputs) {
      setAuditDefaults(inputs);
    }
    setAuditOpen(true);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: trovanColors.black[950], color: '#FFF8ED' }}>
      <MarketingHeader onStartAudit={() => openAuditDialog()} onBookDemo={() => setDemoOpen(true)} />
      <Box component="main">
        <Box id="platform" sx={{ position: 'relative', overflow: 'hidden', minHeight: { xs: 'auto', md: 760 } }}>
          <TopoShellBackground active tone="black" quiet />
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              width: 'min(1180px, calc(100% - 32px))',
              mx: 'auto',
              pt: { xs: 5, md: 5 },
              pb: { xs: 5, md: 5 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' },
              gap: { xs: 4, lg: 5.5 },
              alignItems: 'center',
            }}
          >
            <Box>
              <Typography
                variant="h1"
                sx={{
                  fontFamily: trovanTypography.brandFontFamily,
                  fontWeight: 700,
                  fontSize: { xs: 42, sm: 56, md: 66 },
                  lineHeight: 0.95,
                  maxWidth: 660,
                  color: '#FFF8ED',
                }}
              >
                Find the wasted miles in tomorrow&apos;s routes
              </Typography>
              <Typography sx={{ mt: 2.4, color: alpha('#FFF8ED', 0.72), fontSize: { xs: 18, md: 20 }, lineHeight: 1.55, maxWidth: 630 }}>
                Trovan helps last-mile delivery operators turn spreadsheet plans, map tabs, driver texts, and ETA calls into one route planning and dispatch workspace.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4} sx={{ mt: 3.2 }}>
                <Button variant="contained" size="large" startIcon={<RouteRoundedIcon />} onClick={() => openAuditDialog()}>
                  Get a routing audit
                </Button>
                <Button variant="outlined" size="large" startIcon={<CalendarMonthRoundedIcon />} onClick={() => setDemoOpen(true)}>
                  Book a demo
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
                {['Route audit', 'Dispatch workflow', 'Driver execution', 'Customer tracking'].map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    sx={{
                      color: alpha('#FFF8ED', 0.82),
                      bgcolor: alpha('#FFF8ED', 0.055),
                      border: `1px solid ${alpha('#FFF8ED', 0.1)}`,
                    }}
                  />
                ))}
              </Stack>
            </Box>
            <RouteAuditPreview onStartAudit={openAuditDialog} />
          </Box>
        </Box>

        <Box id="product" sx={{ bgcolor: trovanColors.stone[25], color: trovanColors.black[950], py: { xs: 7, md: 9 } }}>
          <Box sx={{ width: 'min(1180px, calc(100% - 32px))', mx: 'auto' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={3} sx={{ mb: 3.5 }}>
              <Box sx={{ maxWidth: 690 }}>
                <Typography variant="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 54 }, lineHeight: 1 }}>
                  Real product flow from plan to proof
                </Typography>
                <Typography sx={{ mt: 1.4, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
                  The audit points into the actual Trovan workspace: planning, dispatch, driver execution, and customer tracking.
                </Typography>
              </Box>
              <Button href="/routing" variant="contained" endIcon={<ArrowForwardRoundedIcon />} sx={{ alignSelf: { xs: 'flex-start', md: 'end' } }}>
                Open routing screen
              </Button>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              {problemOutcomes.map((item) => (
                <Box key={item.pain} sx={{ p: 2, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
                  <item.icon sx={{ color: trovanColors.semantic.success }} />
                  <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.62), fontSize: 13, fontWeight: 800 }}>
                    {item.pain}
                  </Typography>
                  <Typography variant="h6" sx={{ mt: 0.5, color: trovanColors.black[950], fontWeight: 900 }}>
                    {item.outcome}
                  </Typography>
                  <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68) }}>
                    {item.body}
                  </Typography>
                </Box>
              ))}
            </Box>
            <ProductProofTabs />
          </Box>
        </Box>

        <Box id="route-audit" sx={{ bgcolor: trovanColors.stone[0], color: trovanColors.black[950], py: { xs: 7, md: 9 } }}>
          <Box sx={{ width: 'min(1180px, calc(100% - 32px))', mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.85fr 1.15fr' }, gap: 4, alignItems: 'center' }}>
            <Box>
              <MapRoundedIcon sx={{ color: trovanColors.copper[500], fontSize: 42 }} />
              <Typography variant="h2" sx={{ mt: 1.4, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 54 }, lineHeight: 1 }}>
                What you get in a Trovan route audit
              </Typography>
              <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
                A practical first pass through the route day: how work enters the plan, where dispatch loses visibility, and what should connect first.
              </Typography>
              <Button variant="contained" size="large" sx={{ mt: 3 }} onClick={() => openAuditDialog()}>
                Start my route audit
              </Button>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.2 }}>
              {auditDeliverables.map(([title, body], index) => (
                <Box key={title} sx={{ p: 2, display: 'grid', gridTemplateColumns: '42px 1fr', gap: 1.5, borderRadius: 1.4, border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`, bgcolor: index === 0 ? alpha(trovanColors.copper[50], 0.76) : '#FFFFFF' }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha(trovanColors.copper[500], 0.12), color: trovanColors.copper[700], fontWeight: 900 }}>
                    {index + 1}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: trovanColors.black[950], fontWeight: 900 }}>{title}</Typography>
                    <Typography sx={{ mt: 0.4, color: alpha(trovanColors.black[900], 0.66) }}>{body}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box id="pricing" sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25], color: trovanColors.black[950] }}>
          <Box sx={{ width: 'min(1180px, calc(100% - 32px))', mx: 'auto' }}>
            <Typography variant="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 54 }, lineHeight: 1 }}>
              Pricing that matches launch conversations
            </Typography>
            <Typography sx={{ mt: 1.2, maxWidth: 660, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
              Start with a route audit, prove the product against a real delivery day, then expand into dispatch and customer visibility.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mt: 3 }}>
              {plans.map((plan) => (
                <Box
                  key={plan.name}
                  sx={{
                    p: 2.4,
                    borderRadius: 1.6,
                    border: `1px solid ${plan.featured ? alpha(trovanColors.copper[500], 0.48) : alpha(trovanColors.black[900], 0.13)}`,
                    bgcolor: plan.featured ? alpha(trovanColors.copper[50], 0.8) : '#FFFFFF',
                    boxShadow: plan.featured ? '0 24px 64px rgba(169,99,33,0.16)' : 'none',
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>{plan.name}</Typography>
                  <Typography sx={{ mt: 1, fontSize: 40, fontWeight: 900 }}>{plan.price}</Typography>
                  <Typography sx={{ color: alpha(trovanColors.black[900], 0.66), minHeight: 48 }}>{plan.body}</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    {plan.features.map((feature) => (
                      <Stack key={feature} direction="row" spacing={1} alignItems="center">
                        <CheckRoundedIcon sx={{ color: trovanColors.semantic.success, fontSize: 19 }} />
                        <Typography>{feature}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button
                    fullWidth
                    variant={plan.featured ? 'contained' : 'outlined'}
                    onClick={() => openAuditDialog()}
                    sx={{
                      mt: 2.4,
                      color: plan.featured ? '#FFFFFF' : trovanColors.copper[700],
                      borderColor: alpha(trovanColors.copper[500], 0.5),
                    }}
                  >
                    {plan.cta}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box id="implementation" sx={{ bgcolor: trovanColors.black[950], color: '#FFF8ED', py: { xs: 7, md: 9 }, position: 'relative', overflow: 'hidden' }}>
          <TopoShellBackground active tone="black" quiet />
          <Box sx={{ position: 'relative', zIndex: 1, width: 'min(1180px, calc(100% - 32px))', mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.78fr 1.22fr' }, gap: 4 }}>
            <Box>
              <SecurityRoundedIcon sx={{ color: trovanColors.copper[300], fontSize: 42 }} />
              <Typography variant="h2" sx={{ mt: 1.4, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 54 }, lineHeight: 1 }}>
                A rollout path operators can trust
              </Typography>
              <Typography sx={{ mt: 1.3, color: alpha('#FFF8ED', 0.68), fontSize: 18 }}>
                The site is prepared for the next setup page: domain, provider, billing, notification, routing, and security readiness.
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.4 }}>
              {implementationItems.map(([title, body]) => (
                <Box key={title} sx={{ p: 2.2, borderRadius: 1.4, border: `1px solid ${alpha('#FFF8ED', 0.12)}`, bgcolor: alpha('#FFF8ED', 0.045) }}>
                  <Typography variant="h6" sx={{ color: '#FFF8ED', fontWeight: 850 }}>{title}</Typography>
                  <Typography sx={{ mt: 0.7, color: alpha('#FFF8ED', 0.68) }}>{body}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Box sx={{ bgcolor: trovanColors.stone[0], color: trovanColors.black[950], py: { xs: 7, md: 9 } }}>
          <Box sx={{ width: 'min(960px, calc(100% - 32px))', mx: 'auto', textAlign: 'center' }}>
            <Typography variant="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 40, md: 60 }, lineHeight: 1 }}>
              Bring tomorrow&apos;s routes into one workspace
            </Typography>
            <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
              Start with the audit, see the product flow, and leave with a clear implementation path.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="center" sx={{ mt: 3 }}>
              <Button onClick={() => openAuditDialog()} variant="contained" size="large">Get a routing audit</Button>
              <Button onClick={() => setDemoOpen(true)} variant="outlined" size="large" sx={{ color: trovanColors.copper[700], borderColor: alpha(trovanColors.copper[500], 0.5) }}>Book a demo</Button>
              <Button href="/track/demo-token" variant="text" size="large" sx={{ color: trovanColors.copper[700] }}>View customer tracking</Button>
            </Stack>
          </Box>
        </Box>
      </Box>
      <RouteAuditDialog open={auditOpen} defaults={auditDefaults} onClose={() => setAuditOpen(false)} />
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </Box>
  );
}
