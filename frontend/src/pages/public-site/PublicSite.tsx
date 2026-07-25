import {
  type ElementType,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowForwardRounded as ArrowForwardRoundedIcon,
  ArticleRounded as ArticleRoundedIcon,
  CheckRounded as CheckRoundedIcon,
  CloseRounded as CloseRoundedIcon,
  CookieRounded as CookieRoundedIcon,
  GroupsRounded as GroupsRoundedIcon,
  KeyboardArrowDownRounded as KeyboardArrowDownRoundedIcon,
  LocalShippingRounded as LocalShippingRoundedIcon,
  RocketLaunchRounded as RocketLaunchRoundedIcon,
  SupportAgentRounded as SupportAgentRoundedIcon,
  MenuRounded as MenuRoundedIcon,
  WarehouseRounded as WarehouseRoundedIcon,
} from '@mui/icons-material';
import { TopoShellBackground } from '../../components/TopoShellBackground';
import { trovanRoutePalette } from '../../components/maps/mapPresentation';
import { trovanBrandAssets, trovanColors, trovanTypography } from '../../theme/designTokens';
import {
  type AuditInputs,
  type FleetSizeKey,
  type RequestModalDefaults,
  type RequestType,
  careersPublicCopy,
  cookiePreferenceDefaults,
  downloadCards,
  fleetSizeOptions,
  footerGroups,
  getWorkflowByPath,
  legalPages,
  missionGoals,
  painOptions,
  pricingPlans,
  requestTypeOptions,
  resourceCards,
  securityControlCopy,
  securityControls,
  supportTopics,
  workflowPages,
} from './publicSiteData';

type RequestFormState = {
  name: string;
  workEmail: string;
  company: string;
  fleetSize: FleetSizeKey;
  exactFleetSize: string;
  requestType: RequestType;
  notes: string;
  website: string;
};

type CookiePreferences = typeof cookiePreferenceDefaults;

const COOKIE_STORAGE_KEY = 'trovan-cookie-preferences';
const sectionWidth = 'min(1180px, calc(100% - 32px))';
const BOOK_DEMO_CTA = 'Book demo';
const ROUTE_AUDIT_CTA = 'Get a free route audit';
const PRODUCT_WALKTHROUGH_CTA = 'Watch a Demo';
const PRODUCT_TOUR_VIDEO_SRC = '/marketing/trovan-product-tour.mp4';
const PRODUCT_TOUR_POSTER_SRC = '/marketing/trovan-product-tour-poster.webp';
const PRODUCT_TOUR_CAPTIONS_SRC = '/marketing/trovan-product-tour.vtt';
const PUBLIC_SITE_ORIGIN = 'https://trytrovan.com';
const SOCIAL_PREVIEW_URL = `${PUBLIC_SITE_ORIGIN}/marketing/product-routing.webp`;
const LEAD_SUBMISSION_TIMEOUT_MS = 10_000;

function normalizePathname(pathname: string) {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function getPageSeo(pathname: string) {
  const workflow = getWorkflowByPath(pathname);
  if (workflow) {
    return {
      title: `TryTrovan | ${workflow.navLabel} for route planning and dispatch`,
      description: workflow.body,
    };
  }

  const seo: Record<string, { title: string; description: string }> = {
    '/': {
      title: 'TryTrovan | Route planning, dispatch, driver app, tracking, and proof',
      description: 'Trovan helps delivery and distribution teams plan routes, dispatch live, guide drivers, update customers, and prove every stop.',
    },
    '/platform': {
      title: 'TryTrovan Platform | Route-day control from plan to proof',
      description: 'Explore the Trovan platform across planning, dispatch, driver app, customer tracking, and proof of delivery.',
    },
    '/demo': {
      title: 'TryTrovan Demo | Product walkthrough for a full route day',
      description: 'Watch and click through a Trovan route day from imported stops to dispatch, driver proof, customer tracking, and route summary.',
    },
    '/pricing': {
      title: 'TryTrovan Pricing | Route-day ROI and rollout packages',
      description: 'Estimate route-day savings and review Trovan Launch, Scale, and Enterprise rollout packages.',
    },
    '/testimonials': {
      title: 'TryTrovan Testimonials | Route operation scenarios',
      description: 'Review realistic delivery, distribution, and support scenarios for route-day planning, dispatch, customer status, and proof.',
    },
    '/security': {
      title: 'TryTrovan Security | RBAC, audit logs, and route data controls',
      description: 'Review Trovan security posture for route operations, including RBAC, audit logs, request IDs, redaction, and vendor-review paths.',
    },
    '/resources': {
      title: 'TryTrovan Resources | Route audit, buyer guide, and rollout tools',
      description: 'Use route audit, dispatch readiness, buyer guide, implementation, pricing ROI, security, and support resources.',
    },
    '/resources/downloads': {
      title: 'TryTrovan Downloads | Route audit and implementation checklists',
      description: 'Open route audit, dispatch readiness, implementation, ROI, policy, and workflow resources.',
    },
    '/support': {
      title: 'TryTrovan Support | Login, implementation, and security help',
      description: 'Request login help, implementation guidance, sales follow-up, or security review support.',
    },
    '/company': {
      title: 'TryTrovan Company | Route operations software',
      description: 'Learn why Trovan exists for delivery teams that need to plan the day, run the day, and prove every stop.',
    },
    '/mission': {
      title: 'TryTrovan Mission | Make route days easier to run and prove',
      description: 'Trovan exists to make route days easier to run and easier to prove for delivery and distribution teams.',
    },
    '/careers': {
      title: 'TryTrovan Careers | Route operations software roles',
      description: careersPublicCopy.seoDescription,
    },
    '/legal/privacy': {
      title: 'TryTrovan Privacy Policy | Route and delivery data',
      description: 'Review how Trovan describes route, driver, customer, proof, cookie, and rights-request data for public diligence.',
    },
    '/legal/terms': {
      title: 'TryTrovan Terms of Service | Route operations SaaS',
      description: 'Review public service usage boundaries for Trovan route planning, dispatch, tracking, proof, and support workflows.',
    },
    '/legal/cookies': {
      title: 'TryTrovan Cookie Policy | Cookie preferences',
      description: 'Review Trovan cookie categories and update preferences for essential, analytics, and marketing storage.',
    },
    '/legal/exercise-rights': {
      title: 'TryTrovan Privacy Rights Request | Data access and deletion',
      description: 'Request access, correction, deletion, export, or review of personal or operational information associated with Trovan.',
    },
  };

  return seo[pathname] ?? seo['/'];
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function upsertCanonicalLink(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function updatePublicSeoMetadata(pathname: string, title: string, description: string) {
  const canonicalUrl = new URL(pathname, PUBLIC_SITE_ORIGIN).toString();
  upsertMeta('meta[name="description"]', 'name', 'description', description);
  upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
  upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'Trovan');
  upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
  upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
  upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
  upsertMeta('meta[property="og:image"]', 'property', 'og:image', SOCIAL_PREVIEW_URL);
  upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', SOCIAL_PREVIEW_URL);
  upsertCanonicalLink(canonicalUrl);
}

function productWebpStem(imageSrc: string) {
  if (!imageSrc.startsWith('/marketing/product-') || !imageSrc.endsWith('.png')) {
    return undefined;
  }
  return imageSrc.slice(0, -4);
}

function buildAuditNotes(inputs: AuditInputs) {
  const painLabel = painOptions.find((option) => option.key === inputs.pain)?.label ?? 'Planning time';
  return `Audit snapshot: ${inputs.fleetSize} vehicles, ${inputs.dailyStops} daily stops, focus on ${painLabel.toLowerCase()}.`;
}

function buildRequestMailtoHref(form: RequestFormState, intakeEmail: string) {
  const lines = [
    `Name: ${form.name}`,
    `Work email: ${form.workEmail}`,
    `Company: ${form.company}`,
    `Fleet size: ${form.fleetSize}`,
    form.exactFleetSize ? `Exact fleet size: ${form.exactFleetSize}` : '',
    `Request type: ${form.requestType}`,
    form.notes ? `Notes: ${form.notes}` : '',
  ].filter(Boolean);

  const subject = encodeURIComponent(`Trovan ${form.requestType} request from ${form.company || form.name || 'operator'}`);
  const body = encodeURIComponent(lines.join('\n'));

  return `mailto:${intakeEmail}?subject=${subject}&body=${body}`;
}

function getLeadIntakeUrl() {
  const webhookUrl = import.meta.env.VITE_LEAD_INTAKE_WEBHOOK_URL?.trim();
  if (webhookUrl) return webhookUrl;

  const apiUrl = (import.meta.env.VITE_REST_API_URL || import.meta.env.VITE_API_URL)?.trim();
  if (!apiUrl) return '';
  return `${apiUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api/marketing-leads`;
}

function readCookiePreferences(): CookiePreferences {
  try {
    const raw = window.localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!raw) return cookiePreferenceDefaults;
    const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
    return {
      essential: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return cookiePreferenceDefaults;
  }
}

function saveCookiePreferences(preferences: CookiePreferences) {
  window.localStorage.setItem(
    COOKIE_STORAGE_KEY,
    JSON.stringify({ ...preferences, essential: true }),
  );
}

function RequestModal({
  open,
  defaults,
  onClose,
}: {
  open: boolean;
  defaults: RequestModalDefaults;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState<RequestFormState>({
    name: '',
    workEmail: '',
    company: '',
    fleetSize: defaults.fleetSize ?? '16–35',
    exactFleetSize: '',
    requestType: defaults.requestType,
    notes: defaults.notes ?? '',
    website: '',
  });
  const intakeEmail = import.meta.env.VITE_LEAD_INTAKE_EMAIL || 'sales@trytrovan.com';
  const intakeWebhookUrl = getLeadIntakeUrl();
  const isPreviewCapture = import.meta.env.DEV || import.meta.env.VITE_MOCK_PREVIEW === 'true';
  const mailtoHref = useMemo(() => buildRequestMailtoHref(form, intakeEmail), [form, intakeEmail]);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setSubmitting(false);
    setSubmitError('');
    setForm({
      name: '',
      workEmail: '',
      company: '',
      fleetSize: defaults.fleetSize ?? '16–35',
      exactFleetSize: '',
      requestType: defaults.requestType,
      notes: defaults.notes ?? '',
      website: '',
    });
  }, [defaults, open]);

  const updateForm = <K extends keyof RequestFormState>(key: K, value: RequestFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    if (!intakeWebhookUrl) {
      setSubmitError(
        'Online request delivery is temporarily unavailable. Use the email option below so Trovan can follow up.',
      );
      return;
    }

    try {
      setSubmitting(true);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), LEAD_SUBMISSION_TIMEOUT_MS);
      const response = await fetch(intakeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          source: 'trytrovan.com',
          pagePath: window.location.pathname,
          ...form,
          exactFleetSize: form.exactFleetSize ? Number(form.exactFleetSize) : undefined,
        }),
      }).finally(() => window.clearTimeout(timeout));
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setSubmitted(true);
    } catch {
      setSubmitError('We could not send the request automatically. Use the email option below or try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Talk to Trovan
        <IconButton aria-label="Close request form" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        {submitted ? (
          <Stack spacing={2} sx={{ my: 1 }}>
            <Alert severity={intakeWebhookUrl ? 'success' : 'info'} data-testid="request-success">
              {intakeWebhookUrl
                ? 'Thanks. Your request is securely in Trovan’s follow-up queue. A member of the team will respond with next steps.'
                : isPreviewCapture
                  ? 'Preview request saved for QA. No customer email was sent from this environment.'
                  : 'Your request details are ready. Send them to Trovan sales to complete the request.'}
            </Alert>
            {!intakeWebhookUrl ? (
              <Button component="a" href={mailtoHref} variant="contained">
                Email Trovan sales
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <Typography color="text.secondary">
              Share where your routing operation is today. Trovan will route the request to the right audit, demo, implementation, security, support, or careers follow-up.
            </Typography>
            {isPreviewCapture && !intakeWebhookUrl ? (
              <Alert severity="info">
                Preview intake is not connected to the lead API or CRM. Configure VITE_REST_API_URL or a dedicated VITE_LEAD_INTAKE_WEBHOOK_URL before production automation.
              </Alert>
            ) : null}
            <TextField label="Name" required fullWidth value={form.name} onChange={(event) => updateForm('name', event.target.value)} />
            <TextField label="Work email" type="email" required fullWidth value={form.workEmail} onChange={(event) => updateForm('workEmail', event.target.value)} />
            <TextField label="Company" required fullWidth value={form.company} onChange={(event) => updateForm('company', event.target.value)} />
            <TextField label="Fleet size" select required fullWidth value={form.fleetSize} onChange={(event) => updateForm('fleetSize', event.target.value as FleetSizeKey)}>
              {fleetSizeOptions.map((option) => (
                <MenuItem key={option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Exact fleet size (optional)"
              type="number"
              fullWidth
              value={form.exactFleetSize}
              onChange={(event) => updateForm('exactFleetSize', event.target.value)}
              inputProps={{ min: 1 }}
            />
            <TextField label="Request type" select required fullWidth value={form.requestType} onChange={(event) => updateForm('requestType', event.target.value as RequestType)}>
              {requestTypeOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Optional notes"
              multiline
              minRows={3}
              fullWidth
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="Current tools, markets served, route volume, timing, or what the demo should focus on."
            />
            <TextField
              label="Website"
              value={form.website}
              onChange={(event) => updateForm('website', event.target.value)}
              autoComplete="off"
              inputProps={{ tabIndex: -1 }}
              sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}
              aria-hidden="true"
            />
            {submitError ? (
              <Alert severity="error">
                {submitError}
                <Button component="a" href={mailtoHref} sx={{ ml: 1 }}>
                  Email instead
                </Button>
              </Alert>
            ) : null}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send request'}
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CookiePreferencesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [preferences, setPreferences] = useState<CookiePreferences>(cookiePreferenceDefaults);

  useEffect(() => {
    if (open) {
      setPreferences(readCookiePreferences());
    }
  }, [open]);

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === 'essential') return;
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Cookie preferences
        <IconButton aria-label="Close cookie preferences" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        <Stack spacing={2}>
          <Typography color="text.secondary">
            Essential browser storage supports auth, preview state, and saved preferences. Analytics and marketing preferences stay off until those tools are configured.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked disabled />}
            label="Essential cookies and storage"
          />
          <FormControlLabel
            control={<Checkbox checked={preferences.analytics} onChange={() => togglePreference('analytics')} />}
            label="Analytics cookies"
          />
          <FormControlLabel
            control={<Checkbox checked={preferences.marketing} onChange={() => togglePreference('marketing')} />}
            label="Marketing cookies"
          />
          <Button
            variant="contained"
            onClick={() => {
              saveCookiePreferences(preferences);
              onClose();
            }}
          >
            Save preferences
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function BrandLockup({ width = 184 }: { width?: number }) {
  const height = Math.round((width * 260) / 1120);
  return (
    <Box
      component="img"
      src={trovanBrandAssets.logoHorizontal}
      alt="Trovan Dispatch"
      width={width}
      height={height}
      sx={{
        width,
        height,
        display: 'block',
        filter: `drop-shadow(0 12px 28px ${alpha(trovanColors.copper[700], 0.22)})`,
      }}
    />
  );
}

const solutionMenuItems = [
  {
    label: 'Delivery operations',
    href: '/platform/plan',
    body: 'Plan, adjust, and prove daily local delivery without spreadsheets, texts, and manual follow-up.',
    icon: LocalShippingRoundedIcon,
  },
  {
    label: 'Distribution teams',
    href: '/platform/dispatch',
    body: 'Coordinate recurring routes, depots, territories, driver workload, and delivery proof cycles.',
    icon: WarehouseRoundedIcon,
  },
  {
    label: 'Fleet managers',
    href: '/platform/track',
    body: 'Review capacity, route progress, utilization, exceptions, and proof without waiting for end-of-day reports.',
    icon: GroupsRoundedIcon,
  },
  {
    label: 'Rollout & onboarding',
    href: '/support',
    body: 'Start with a route audit, pilot one route day, train teams, then expand with route KPIs.',
    icon: RocketLaunchRoundedIcon,
  },
];

const resourceMegaMenuItems = [
  {
    label: 'Product walkthrough',
    href: '/demo',
    body: 'Watch the route-day walkthrough and click through the guided product tour when you need detail.',
    icon: ArrowForwardRoundedIcon,
  },
  {
    label: 'Route audit checklist',
    href: '/resources/downloads',
    body: 'Prepare one real route day for a free audit of wasted miles, late risk, and dispatcher bottlenecks.',
    icon: ArticleRoundedIcon,
  },
  {
    label: 'Buyer guide',
    href: '/resources',
    body: 'Evaluate route planning software by planning quality, live dispatch, driver proof, and customer visibility.',
    icon: GroupsRoundedIcon,
  },
  {
    label: 'Support',
    href: '/support',
    body: 'Get login help, implementation help, sales follow-up, or a security review path.',
    icon: SupportAgentRoundedIcon,
  },
];

function MegaMenuCard({
  href,
  title,
  body,
  icon: Icon,
  onClick,
}: {
  href: string;
  title: string;
  body: string;
  icon: ElementType;
  onClick: () => void;
}) {
  return (
    <Box
      component={RouterLink}
      to={href}
      role="menuitem"
      onClick={onClick}
      sx={{
        display: 'grid',
        gridTemplateColumns: '34px 1fr',
        gap: 1.2,
        p: 1.5,
        borderRadius: 1.2,
        color: trovanColors.black[950],
        textDecoration: 'none',
        border: `1px solid ${alpha(trovanColors.black[900], 0.08)}`,
        bgcolor: '#FFFFFF',
        transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: alpha(trovanColors.copper[500], 0.45),
          boxShadow: '0 14px 34px rgba(31,26,23,0.09)',
        },
        '&:focus-visible': {
          outline: `3px solid ${alpha(trovanColors.copper[500], 0.32)}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(trovanColors.copper[50], 0.9),
          color: trovanColors.copper[700],
        }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{title}</Typography>
        <Typography sx={{ mt: 0.5, color: alpha(trovanColors.black[900], 0.66), fontSize: 13.5, lineHeight: 1.38 }}>
          {body}
        </Typography>
      </Box>
    </Box>
  );
}

function PublicHeader({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  const [productAnchor, setProductAnchor] = useState<HTMLElement | null>(null);
  const [solutionsAnchor, setSolutionsAnchor] = useState<HTMLElement | null>(null);
  const [resourcesAnchor, setResourcesAnchor] = useState<HTMLElement | null>(null);
  const [companyAnchor, setCompanyAnchor] = useState<HTMLElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenus = () => {
    setProductAnchor(null);
    setSolutionsAnchor(null);
    setResourcesAnchor(null);
    setCompanyAnchor(null);
    setMobileOpen(false);
  };

  const primaryLinks = [
    { label: 'Pricing', href: '/pricing' },
    { label: 'Demo', href: '/demo' },
    { label: 'Security', href: '/security' },
  ];
  const companyLinks = [
    { label: 'About', href: '/company' },
    { label: 'Mission', href: '/mission' },
    { label: 'Careers', href: '/careers' },
  ];
  const mobileSections = [
    {
      title: 'Route overview',
      links: [{ label: 'Platform overview', href: '/platform' }, ...workflowPages.map((item) => ({ label: item.navLabel, href: item.path }))],
    },
    {
      title: 'Who it is for',
      links: solutionMenuItems.map((item) => ({ label: item.label, href: item.href })),
    },
    {
      title: 'Go deeper',
      links: [...primaryLinks, ...resourceMegaMenuItems.map((item) => ({ label: item.label, href: item.href }))],
    },
    {
      title: 'Company',
      links: companyLinks,
    },
  ];

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        borderBottom: `1px solid ${alpha('#FFF8ED', 0.1)}`,
        bgcolor: alpha(trovanColors.black[950], 0.88),
        backdropFilter: 'blur(18px)',
      }}
    >
      <Box sx={{ width: sectionWidth, mx: 'auto', minHeight: 68, display: 'flex', alignItems: 'center', gap: 1.2 }}>
        <Box component={RouterLink} to="/" aria-label="Trovan home" sx={{ display: 'flex', alignItems: 'center', mr: 'auto', textDecoration: 'none' }}>
          <BrandLockup />
        </Box>

        <Stack component="nav" direction="row" spacing={0.5} sx={{ display: { xs: 'none', lg: 'flex' } }} aria-label="Main navigation">
          <Button color="inherit" endIcon={<KeyboardArrowDownRoundedIcon />} onClick={(event) => setProductAnchor(event.currentTarget)} sx={{ color: alpha('#FFF8ED', 0.82) }}>
            Product
          </Button>
          <Button color="inherit" endIcon={<KeyboardArrowDownRoundedIcon />} onClick={(event) => setSolutionsAnchor(event.currentTarget)} sx={{ color: alpha('#FFF8ED', 0.82) }}>
            Solutions
          </Button>
          {primaryLinks.map((item) => (
            <Button key={item.href} component={RouterLink} to={item.href} color="inherit" sx={{ color: alpha('#FFF8ED', 0.82) }}>
              {item.label}
            </Button>
          ))}
          <Button color="inherit" endIcon={<KeyboardArrowDownRoundedIcon />} onClick={(event) => setResourcesAnchor(event.currentTarget)} sx={{ color: alpha('#FFF8ED', 0.82) }}>
            Resources
          </Button>
          <Button color="inherit" endIcon={<KeyboardArrowDownRoundedIcon />} onClick={(event) => setCompanyAnchor(event.currentTarget)} sx={{ color: alpha('#FFF8ED', 0.82) }}>
            Company
          </Button>
        </Stack>

        <Button
          variant="contained"
          onClick={() => onOpenRequest('Book demo')}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          {BOOK_DEMO_CTA}
        </Button>
        <Button component="a" href="/login" variant="outlined" sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
          Sign in
        </Button>
        <IconButton aria-label="Open navigation" onClick={() => setMobileOpen(true)} sx={{ display: { xs: 'inline-flex', lg: 'none' }, color: '#FFF8ED' }}>
          <MenuRoundedIcon />
        </IconButton>
      </Box>

      <Menu
        anchorEl={productAnchor}
        open={Boolean(productAnchor)}
        onClose={closeMenus}
        MenuListProps={{ sx: { p: 0 } }}
        PaperProps={{ sx: { mt: 1, width: 760, maxWidth: 'calc(100vw - 32px)', borderRadius: 2, overflow: 'hidden' } }}
      >
        <Box sx={{ p: 2.4, bgcolor: trovanColors.stone[0], color: trovanColors.black[950] }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Typography component="h2" sx={{ color: trovanColors.black[950], fontFamily: trovanTypography.brandFontFamily, fontSize: 28, lineHeight: 1 }}>
                Route day workflows
              </Typography>
              <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.66), maxWidth: 510 }}>
                Plan, dispatch, driver execution, tracking, and proof stay connected across the whole route day.
              </Typography>
            </Box>
            <Button component={RouterLink} to="/platform" onClick={closeMenus} variant="outlined" endIcon={<ArrowForwardRoundedIcon />} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, color: trovanColors.copper[700], borderColor: alpha(trovanColors.copper[600], 0.44) }}>
              Platform overview
            </Button>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
            {workflowPages.map((item) => (
              <MegaMenuCard key={item.path} href={item.path} title={item.navLabel} body={item.outcome} icon={item.icon} onClick={closeMenus} />
            ))}
          </Box>
        </Box>
      </Menu>
      <Menu
        anchorEl={solutionsAnchor}
        open={Boolean(solutionsAnchor)}
        onClose={closeMenus}
        MenuListProps={{ sx: { p: 0 } }}
        PaperProps={{ sx: { mt: 1, width: 720, maxWidth: 'calc(100vw - 32px)', borderRadius: 2, overflow: 'hidden' } }}
      >
        <Box sx={{ p: 2.4, bgcolor: trovanColors.stone[0], color: trovanColors.black[950] }}>
          <Typography component="h2" sx={{ color: trovanColors.black[950], fontFamily: trovanTypography.brandFontFamily, fontSize: 28, lineHeight: 1 }}>
            Built for route-heavy operators
          </Typography>
          <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.66), maxWidth: 540 }}>
            Match the public story to the teams evaluating Trovan: delivery operators, distribution teams, fleet managers, and implementation leads.
          </Typography>
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
            {solutionMenuItems.map((item) => (
              <MegaMenuCard key={item.href} href={item.href} title={item.label} body={item.body} icon={item.icon} onClick={closeMenus} />
            ))}
          </Box>
        </Box>
      </Menu>
      <Menu
        anchorEl={resourcesAnchor}
        open={Boolean(resourcesAnchor)}
        onClose={closeMenus}
        MenuListProps={{ sx: { p: 0 } }}
        PaperProps={{ sx: { mt: 1, width: 720, maxWidth: 'calc(100vw - 32px)', borderRadius: 2, overflow: 'hidden' } }}
      >
        <Box sx={{ p: 2.4, bgcolor: trovanColors.stone[0], color: trovanColors.black[950] }}>
          <Typography component="h2" sx={{ color: trovanColors.black[950], fontFamily: trovanTypography.brandFontFamily, fontSize: 28, lineHeight: 1 }}>
            Launch resources
          </Typography>
          <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.66), maxWidth: 540 }}>
            Useful public pages for route audit prep, product walkthroughs, implementation planning, security review, and support.
          </Typography>
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
            {resourceMegaMenuItems.map((item) => (
              <MegaMenuCard key={item.href} href={item.href} title={item.label} body={item.body} icon={item.icon} onClick={closeMenus} />
            ))}
          </Box>
        </Box>
      </Menu>
      <Menu anchorEl={companyAnchor} open={Boolean(companyAnchor)} onClose={closeMenus}>
        {companyLinks.map((item) => (
          <MenuItem key={item.href} component={RouterLink} to={item.href} onClick={closeMenus}>
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 310, p: 2.5, bgcolor: trovanColors.black[950], color: '#FFF8ED', minHeight: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <BrandLockup width={154} />
            <IconButton aria-label="Close navigation" onClick={() => setMobileOpen(false)} sx={{ color: '#FFF8ED' }}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <Stack spacing={1.5} sx={{ mt: 3 }}>
            {mobileSections.map((section) => (
              <Box key={section.title} sx={{ p: 1.2, borderRadius: 1.5, border: `1px solid ${alpha('#FFF8ED', 0.1)}`, bgcolor: alpha('#FFF8ED', 0.04) }}>
                <Typography sx={{ px: 1, color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                  {section.title}
                </Typography>
                <Stack spacing={0.2} sx={{ mt: 0.8 }}>
                  {section.links.map((item) => (
                    <Button key={`${section.title}-${item.href}-${item.label}`} component={RouterLink} to={item.href} onClick={closeMenus} sx={{ justifyContent: 'flex-start', color: '#FFF8ED' }}>
                      {item.label}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}
            <Divider sx={{ borderColor: alpha('#FFF8ED', 0.15), my: 1 }} />
            <Button
              variant="contained"
              onClick={() => {
                closeMenus();
                onOpenRequest('Book demo');
              }}
            >
              {BOOK_DEMO_CTA}
            </Button>
            <Button component="a" href="/login" onClick={closeMenus} variant="outlined">Sign in</Button>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}

function PublicFooter({
  onCookiePreferences,
  onContact,
}: {
  onCookiePreferences: () => void;
  onContact: () => void;
}) {
  return (
    <Box component="footer" data-testid="public-footer" sx={{ bgcolor: trovanColors.black[950], color: '#FFF8ED', py: { xs: 6, md: 7 }, borderTop: `1px solid ${alpha('#FFF8ED', 0.1)}` }}>
      <Box sx={{ width: sectionWidth, mx: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.4fr' }, gap: 4 }}>
          <Box>
            <BrandLockup width={172} />
            <Typography sx={{ mt: 2, color: alpha('#FFF8ED', 0.68), maxWidth: 430 }}>
              Route planning, dispatch, driver execution, customer tracking, and proof for delivery and distribution operators.
            </Typography>
            <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
              <Button variant="contained" onClick={onContact}>Contact</Button>
              <Button variant="outlined" startIcon={<CookieRoundedIcon />} onClick={onCookiePreferences}>Cookie preferences</Button>
            </Stack>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2.4 }}>
            {footerGroups.map((group) => (
              <Box key={group.label}>
                <Typography sx={{ fontWeight: 900, color: '#FFF8ED', mb: 1 }}>{group.label}</Typography>
                <Stack spacing={0.4}>
                  {group.links.map((link) => (
                    <Button
                      key={link.href}
                      component={RouterLink}
                      to={link.href}
                      sx={{ justifyContent: 'flex-start', px: 0, color: alpha('#FFF8ED', 0.66), fontSize: 14, textTransform: 'none' }}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>
        <Divider sx={{ my: 3, borderColor: alpha('#FFF8ED', 0.12) }} />
        <Typography sx={{ color: alpha('#FFF8ED', 0.5), fontSize: 13 }}>
          © 2026 Trovan. Route planning and dispatch software for delivery teams.
        </Typography>
      </Box>
    </Box>
  );
}

function MarketingShell({
  children,
  onOpenRequest,
  onCookiePreferences,
}: {
  children: ReactNode;
  onOpenRequest: (requestType: RequestType, inputs?: AuditInputs, notes?: string) => void;
  onCookiePreferences: () => void;
}) {
  return (
    <Box data-testid="public-site-shell" sx={{ minHeight: '100vh', bgcolor: trovanColors.stone[0], color: trovanColors.black[950] }}>
      <PublicHeader onOpenRequest={(requestType) => onOpenRequest(requestType)} />
      <Box component="main">{children}</Box>
      <PublicFooter
        onCookiePreferences={onCookiePreferences}
        onContact={() => onOpenRequest('Book demo')}
      />
    </Box>
  );
}

function Kicker({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <Typography sx={{ color: dark ? trovanColors.copper[200] : trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
      {children}
    </Typography>
  );
}

function SectionHeader({
  kicker,
  title,
  body,
  dark = false,
  titleComponent,
  titleSx,
}: {
  kicker?: string;
  title: string;
  body: string;
  dark?: boolean;
  titleComponent?: ElementType;
  titleSx?: Record<string, unknown>;
}) {
  const TitleComponent: ElementType = titleComponent ?? 'h2';

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={3} sx={{ mb: 3.5 }}>
      <Box sx={{ maxWidth: 720 }}>
        {kicker ? <Kicker dark={dark}>{kicker}</Kicker> : null}
        <Typography component={TitleComponent} variant="h2" sx={{ mt: kicker ? 0.8 : 0, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 56 }, lineHeight: 1, ...titleSx }}>
          {title}
        </Typography>
      </Box>
      <Typography sx={{ color: dark ? alpha('#FFF8ED', 0.68) : alpha(trovanColors.black[900], 0.68), fontSize: 18, maxWidth: 440 }}>
        {body}
      </Typography>
    </Stack>
  );
}

function ProductFrameHeader({
  detail = 'Route ops view',
}: {
  detail?: string;
}) {
  return (
    <Box
      sx={{
        minHeight: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.2,
        px: 1.4,
        borderBottom: `1px solid ${alpha('#FFF8ED', 0.1)}`,
      }}
    >
      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 20,
            height: 20,
            borderRadius: 0.7,
            display: 'grid',
            placeItems: 'center',
            bgcolor: trovanColors.copper[600],
            color: '#FFF8ED',
            fontSize: 12,
            fontWeight: 900,
            fontFamily: trovanTypography.uiFontFamily,
            flex: '0 0 auto',
          }}
        >
          T
        </Box>
        <Typography sx={{ color: '#FFF8ED', fontSize: 12.5, fontWeight: 900, whiteSpace: 'nowrap' }}>
          Live Trovan workspace
        </Typography>
      </Stack>
      <Typography
        sx={{
          display: { xs: 'none', sm: 'block' },
          color: alpha('#FFF8ED', 0.58),
          fontSize: 12,
          fontWeight: 800,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {detail}
      </Typography>
    </Box>
  );
}

type MarketingScreenshotCallout = {
  label: string;
  x: number;
  y: number;
  align?: 'left' | 'right' | 'center';
};

function MarketingScreenshotFrame({
  title,
  caption,
  imageSrc,
  imageAvifSrc,
  imageWebpSrc,
  imageAlt,
  variant = 'desktop',
  callouts = [],
  badges = [],
  priority = false,
  overlay,
}: {
  title: string;
  caption?: string;
  imageSrc: string;
  imageAvifSrc?: string;
  imageWebpSrc?: string;
  imageAlt: string;
  variant?: 'desktop' | 'mobile' | 'split' | 'map';
  callouts?: MarketingScreenshotCallout[];
  badges?: string[];
  priority?: boolean;
  overlay?: ReactNode;
}) {
  const isMobile = variant === 'mobile';
  const aspectRatio = isMobile ? '9 / 13' : variant === 'map' ? '16 / 10' : '16 / 10';
  const generatedWebpStem = imageWebpSrc ? undefined : productWebpStem(imageSrc);
  const imageSizes = isMobile ? '(max-width: 600px) 84vw, 350px' : '(max-width: 900px) 94vw, 980px';
  return (
    <Box
      data-testid="product-app-frame"
      sx={{
        borderRadius: 2,
        bgcolor: '#151210',
        border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`,
        boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
        overflow: 'hidden',
      }}
    >
      <ProductFrameHeader detail={title} />
      <Box
        sx={{
          position: 'relative',
          aspectRatio: { xs: isMobile ? '9 / 13' : '4 / 3', sm: aspectRatio },
          bgcolor: trovanColors.black[800],
          overflow: 'hidden',
        }}
      >
        <Box
          component="picture"
          sx={{
            display: 'block',
            width: '100%',
            height: '100%',
          }}
        >
          {imageAvifSrc ? <source srcSet={imageAvifSrc} type="image/avif" /> : null}
          {generatedWebpStem ? (
            <>
              <source
                media="(max-width: 600px)"
                srcSet={`${generatedWebpStem}-640.webp 640w, ${generatedWebpStem}-768.webp 768w`}
                sizes={isMobile ? '84vw' : '94vw'}
                type="image/webp"
              />
              <source
                srcSet={`${generatedWebpStem}-768.webp 768w, ${generatedWebpStem}.webp 1440w`}
                sizes={imageSizes}
                type="image/webp"
              />
            </>
          ) : imageWebpSrc ? <source srcSet={imageWebpSrc} sizes={imageSizes} type="image/webp" /> : null}
          <Box
            component="img"
            src={imageSrc}
            srcSet={`${imageSrc} 1x`}
            sizes={imageSizes}
            alt={imageAlt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            width={isMobile ? 390 : 1440}
            height={isMobile ? 844 : 900}
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              objectFit: 'contain',
              objectPosition: 'top center',
              p: isMobile ? 0.8 : { xs: 1, md: 1.4 },
            }}
          />
        </Box>
        {overlay ? (
          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {overlay}
          </Box>
        ) : null}
        {callouts.map((callout) => (
          <Box
            key={`${callout.label}-${callout.x}-${callout.y}`}
            sx={{
              position: 'absolute',
              left: `${callout.x}%`,
              top: `${callout.y}%`,
              display: { xs: 'none', sm: 'block' },
              transform: callout.align === 'right' ? 'translateX(-100%)' : callout.align === 'center' ? 'translateX(-50%)' : 'none',
              px: 1,
              py: 0.55,
              borderRadius: 1,
              bgcolor: alpha('#0A0705', 0.84),
              border: `1px solid ${alpha('#FFF8ED', 0.18)}`,
              color: '#FFF8ED',
              fontSize: 12,
              fontWeight: 900,
              boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
              maxWidth: 180,
            }}
          >
            {callout.label}
          </Box>
        ))}
      </Box>
      {caption || badges.length ? (
        <Box sx={{ px: 1.5, py: 1.2, borderTop: `1px solid ${alpha('#FFF8ED', 0.1)}`, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {caption ? <Typography sx={{ color: alpha('#FFF8ED', 0.7), fontSize: 13 }}>{caption}</Typography> : null}
          {badges.map((badge) => (
            <Box key={badge} sx={{ px: 0.9, py: 0.4, borderRadius: 999, bgcolor: alpha(trovanColors.copper[300], 0.14), color: trovanColors.copper[100], fontSize: 11, fontWeight: 900 }}>
              {badge}
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function ScreenshotFrame({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
  fit?: 'cover' | 'contain';
}) {
  return (
    <MarketingScreenshotFrame
      title={caption ?? 'Product view'}
      imageSrc={src}
      imageAlt={alt}
      variant="desktop"
    />
  );
}

function MobileAppProofFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <Box
      aria-label="Trovan Driver mobile app preview"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '0.72fr 0.28fr' },
        gap: { xs: 2, md: 2.4 },
        alignItems: 'center',
        borderRadius: 2,
        bgcolor: '#151210',
        border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`,
        boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
        p: { xs: 2, md: 2.6 },
      }}
    >
      <Box
        sx={{
          mx: 'auto',
          width: { xs: 'min(320px, 100%)', md: 350 },
          borderRadius: 4,
          bgcolor: '#080706',
          border: `1px solid ${alpha('#FFF8ED', 0.14)}`,
          boxShadow: '0 22px 70px rgba(0,0,0,0.42)',
          p: 1.1,
        }}
      >
        <Box sx={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 74, height: 5, borderRadius: 999, bgcolor: alpha('#FFF8ED', 0.26) }} />
        </Box>
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          sx={{
            display: 'block',
            width: '100%',
            aspectRatio: '9 / 13',
            objectFit: 'contain',
            objectPosition: 'top center',
            bgcolor: trovanColors.black[900],
            borderRadius: 2.8,
          }}
        />
      </Box>
      <Box>
        <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
          Driver mobile app proof
        </Typography>
        <Typography variant="h4" component="h2" sx={{ mt: 1, color: '#FFF8ED', fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 30, md: 38 }, lineHeight: 1 }}>
          Built for the phone in the cab
        </Typography>
        <Typography sx={{ mt: 1.2, color: alpha('#FFF8ED', 0.68), lineHeight: 1.55 }}>
          Stops, proof, notes, and dispatch context stay readable in a focused mobile route view.
        </Typography>
      </Box>
    </Box>
  );
}

function TrackingProofFrame() {
  return (
    <Box
      aria-label="Customer tracking preview"
      sx={{
        borderRadius: 2,
        bgcolor: '#151210',
        border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`,
        boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
        overflow: 'hidden',
      }}
    >
      <ProductFrameHeader detail="Customer tracking page" />
      <Box sx={{ p: { xs: 1.2, md: 1.6 }, bgcolor: trovanColors.black[900] }}>
        <Box
          sx={{
            borderRadius: 2.2,
            bgcolor: '#FFFDF8',
            overflow: 'hidden',
            minHeight: { xs: 360, md: 420 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '0.95fr 1.05fr' },
          }}
        >
          <Box
            sx={{
              p: 2.2,
              background: `linear-gradient(180deg, ${alpha(trovanColors.copper[100], 0.7)}, #FFFDF8 48%)`,
              borderRight: { xs: 'none', md: `1px solid ${alpha(trovanColors.black[900], 0.08)}` },
              borderBottom: { xs: `1px solid ${alpha(trovanColors.black[900], 0.08)}`, md: 'none' },
            }}
          >
            <Typography sx={{ color: trovanColors.copper[700], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              Customer tracking
            </Typography>
            <Typography variant="h4" component="p" sx={{ mt: 0.8, fontWeight: 900, color: trovanColors.black[950], lineHeight: 1.08 }}>
              Your delivery is on the way
            </Typography>
            <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68), lineHeight: 1.5 }}>
              Customers see the ETA, route progress, and proof status without calling dispatch.
            </Typography>

            <Stack spacing={1} sx={{ mt: 2 }}>
              {[
                ['Route status', 'Out for delivery'],
                ['ETA window', '11:20 AM - 11:45 AM'],
                ['Current stop', '2 of 8 completed'],
                ['Proof status', 'Photo + note after drop-off'],
              ].map(([label, value]) => (
                <Box
                  key={label}
                  sx={{
                    p: 1.2,
                    borderRadius: 1.2,
                    bgcolor: '#FFFFFF',
                    border: `1px solid ${alpha(trovanColors.black[900], 0.08)}`,
                  }}
                >
                  <Typography sx={{ color: alpha(trovanColors.black[900], 0.54), fontSize: 12, fontWeight: 800 }}>
                    {label}
                  </Typography>
                  <Typography sx={{ mt: 0.35, color: trovanColors.black[950], fontWeight: 900 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box sx={{ p: 2.2, display: 'grid', alignContent: 'start', gap: 1.2, bgcolor: '#FFFFFF' }}>
            {[
              ['10:42 AM', 'Driver left the previous stop'],
              ['11:08 AM', 'Delivery window confirmed'],
              ['11:26 AM', 'Driver is 9 minutes away'],
              ['Next', 'Photo proof and drop-off note appear here'],
            ].map(([time, event], index) => (
              <Box
                key={`${time}-${event}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '72px 1fr',
                  gap: 1.1,
                  alignItems: 'start',
                  p: 1.15,
                  borderRadius: 1.2,
                  bgcolor: index === 2 ? alpha(trovanColors.copper[50], 0.78) : trovanColors.stone[0],
                  border: `1px solid ${alpha(trovanColors.black[900], 0.08)}`,
                }}
              >
                <Typography sx={{ color: trovanColors.copper[700], fontSize: 12, fontWeight: 900 }}>{time}</Typography>
                <Typography sx={{ color: trovanColors.black[950], lineHeight: 1.4 }}>{event}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function DispatchWorkflowFrame() {
  return (
    <Box
      aria-label="Dispatch workflow preview"
      data-testid="product-app-frame"
      sx={{
        borderRadius: 2,
        bgcolor: '#151210',
        border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`,
        boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
        overflow: 'hidden',
      }}
    >
      <ProductFrameHeader detail="Dispatch workflow" />
      <Box sx={{ p: { xs: 1.2, md: 1.6 }, bgcolor: trovanColors.black[900] }}>
        <Box sx={{ display: 'grid', gap: 1.2 }}>
          <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
            <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              Live board
            </Typography>
            <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
              Dispatch sees multiple route lanes, active assignments, and the current route detail together.
            </Typography>
            <Box
              component="img"
              src="/marketing/product-dispatch.png"
              alt="Current Trovan dispatch board with unassigned jobs, active routes, live map, and exception communications"
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>
            <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
              <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                Jobs waiting
              </Typography>
              <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
                The queue shows the work already staged for routing and dispatch.
              </Typography>
              <Box
                component="img"
                src="/marketing/jobs-queue.png"
                alt="Trovan jobs queue showing staged work already in the routing system"
                loading="lazy"
                decoding="async"
                sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
              />
            </Box>
            <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
              <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
                Exception context
              </Typography>
              <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
                Route issues stay attached to the lane, not in a separate text thread.
              </Typography>
              <Box
                component="img"
                src="/marketing/dispatch-exceptions.png"
                alt="Trovan exception queue showing route risk, operator actions, and route context"
                loading="lazy"
                decoding="async"
                sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
              />
            </Box>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {[
              '6 jobs visible in queue',
              '4 route lanes on screen',
              'exceptions tied to the route record',
            ].map((badge) => (
              <Box key={badge} sx={{ px: 1.1, py: 0.7, borderRadius: 999, bgcolor: alpha(trovanColors.copper[300], 0.14), color: trovanColors.copper[100], fontSize: 11, fontWeight: 900 }}>
                {badge}
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function PlatformOverviewFrame() {
  return (
    <Box
      aria-label="Platform overview preview"
      data-testid="product-app-frame"
      sx={{
        borderRadius: 2,
        bgcolor: '#151210',
        border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`,
        boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
        overflow: 'hidden',
      }}
    >
      <ProductFrameHeader detail="Platform overview" />
      <Box sx={{ p: { xs: 1.2, md: 1.6 }, bgcolor: trovanColors.black[900], display: 'grid', gap: 1.2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>
          <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
            <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              Planning
            </Typography>
            <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
              Build, balance, and review routes before dispatch takes over.
            </Typography>
            <Box
              component="img"
              src="/marketing/product-routing-exceptions.png"
              alt="Current Trovan route planning workspace showing route exceptions, stops, and publish-ready totals"
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
            />
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
            <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              Dispatch
            </Typography>
            <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
              Run active routes, watch the queue, and resolve issues in one view.
            </Typography>
            <Box
              component="img"
              src="/marketing/product-dispatch.png"
              alt="Current Trovan dispatch board with unassigned jobs, active routes, live map, and exception communications"
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>
          <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
            <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              Tracking
            </Typography>
            <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
              Keep support and customers aligned with live route progress.
            </Typography>
            <Box
              component="img"
              src="/marketing/product-tracking.png"
              alt="Current Trovan tracking workspace showing live telemetry and route visibility"
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
            />
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: alpha('#FFF8ED', 0.04), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
            <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 12, textTransform: 'uppercase' }}>
              Proof
            </Typography>
            <Typography sx={{ mt: 0.45, color: '#FFF8ED', fontWeight: 900 }}>
              Review notes, timestamps, and delivery evidence after every stop.
            </Typography>
            <Box
              component="img"
              src="/marketing/product-proof.png"
              alt="Current Trovan proof-of-delivery workspace with delivery status, route links, filters, and evidence details"
              loading="lazy"
              decoding="async"
              sx={{ display: 'block', width: '100%', mt: 1, borderRadius: 1.2, border: `1px solid ${alpha('#FFF8ED', 0.08)}`, objectFit: 'contain', objectPosition: 'top center' }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function productProofTitle(key: string) {
  if (key === 'dispatch') return 'Keep route execution visible after publish';
  if (key === 'drive') return 'Give drivers the next best action';
  if (key === 'track') return 'Reduce customer where-is-it calls';
  return 'Plan routes before they become dispatch problems';
}

function workflowCtaLabel(key: string) {
  if (key === 'plan') return 'See planning workflow';
  if (key === 'dispatch') return 'See dispatch workflow';
  if (key === 'drive') return 'See driver flow';
  if (key === 'track') return 'See tracking page';
  if (key === 'proof') return 'See proof record';
  return 'See workflow';
}

const quickDemoSteps = [
  {
    key: 'plan',
    label: 'Plan routes',
    status: 'Planning',
    headline: '46 stops imported and shaped into route drafts',
    body: 'Trovan starts with the jobs already on the board, then groups stops around density, capacity, and service-window risk before anything leaves planning.',
    operatorView: 'Planner sees unassigned jobs, route density, and review flags before publishing.',
    eventLog: ['46 stops imported', '7 stops need review', '4 route drafts balanced'],
    stats: [
      ['Stops', '46'],
      ['Draft routes', '4'],
      ['Review flags', '7'],
    ],
  },
  {
    key: 'dispatch',
    label: 'Dispatch routes',
    status: 'Dispatch',
    headline: 'Routes published to dispatch with assignment context',
    body: 'Published routes become dispatch lanes with driver assignment, progress, exception notes, and same-day change context in one operating view.',
    operatorView: 'Dispatch sees route lanes, driver assignments, and exceptions without rebuilding the day from texts.',
    eventLog: ['Routes published to dispatch', 'Driver assignments visible', 'Route 12 flagged for dock delay'],
    stats: [
      ['Live lanes', '4'],
      ['Assigned drivers', '4'],
      ['Open exceptions', '1'],
    ],
  },
  {
    key: 'drive',
    label: 'Driver mobile app',
    status: 'Driver',
    headline: 'Driver opens the mobile app and works stop by stop',
    body: 'The field view stays focused on the next stop, route sequence, arrival/departure actions, notes, proof, and dispatch messages.',
    operatorView: 'Driver sees the next stop and completion steps without touching dispatcher-only controls.',
    eventLog: ['Driver opens the mobile app', 'Stop 08 marked arrived', 'Photo proof requested'],
    stats: [
      ['Next stop', '08'],
      ['Proof mode', 'Photo'],
      ['Route progress', '34%'],
    ],
  },
  {
    key: 'track',
    label: 'Customer tracking',
    status: 'Tracking',
    headline: 'Customer updates reflect route progress automatically',
    body: 'Tracking links translate route events into useful ETA and support context without exposing internal dispatch tools.',
    operatorView: 'Support sees the same delivery timeline customers can understand.',
    eventLog: ['ETA refreshed for customers', 'Delivery window updated', 'Support context attached'],
    stats: [
      ['Customer link', 'Live'],
      ['ETA status', 'Updated'],
      ['Support notes', 'Attached'],
    ],
  },
  {
    key: 'proof',
    label: 'Proof of delivery',
    status: 'Proof',
    headline: 'Proof, notes, and route history are attached',
    body: 'Completion evidence lands back on the route run so dispatch, support, and operations can review what happened after the day ends.',
    operatorView: 'Operations reviews proof, exceptions, and route history from the same route record.',
    eventLog: ['Proof captured', 'No-proof decision logged', 'Route history ready for review'],
    stats: [
      ['Proof items', '18'],
      ['Exceptions', '2'],
      ['Review state', 'Ready'],
    ],
  },
] as const;

type QuickDemoStepKey = (typeof quickDemoSteps)[number]['key'];

const routePreviewCopy: Record<QuickDemoStepKey, { label: string; title: string; body: string; metric: string }> = {
  plan: {
    label: 'Planning map',
    title: 'Route lines connect every planned stop',
    body: 'Dispatch can drag a stop from one lane to another and see the route path update before the day is handed off.',
    metric: 'Stop 13 moved / RT-4 updated',
  },
  dispatch: {
    label: 'Dispatch map',
    title: 'Dispatch sees connected route lanes before drivers roll',
    body: 'Published routes show live lanes, stop order, driver assignment, and exception context on one map.',
    metric: '5 live lanes / 50 mapped stops',
  },
  drive: {
    label: 'Driver mobile map',
    title: 'Mobile app shows the next stop in sequence',
    body: 'The driver view narrows the path to the next action without exposing dispatcher controls.',
    metric: 'Stop 08 active / 34% complete',
  },
  track: {
    label: 'Tracking map',
    title: 'Tracking keeps customers tied to the live route',
    body: 'Route progress becomes ETA context customers and support teams can understand.',
    metric: 'ETA live / customer link active',
  },
  proof: {
    label: 'Proof map',
    title: 'Proof stays attached to the completed route path',
    body: 'Completion evidence is reviewed against the route sequence, stops, and exception history.',
    metric: '18 proof items / route ready',
  },
};

const routeMapRoutes = [
  {
    id: 'route-a',
    label: 'RT-1',
    driver: 'North dock / Van 12',
    color: trovanColors.copper[600],
    vehicle: 'DEN-112',
    path: 'M94 120 C146 86 198 88 238 116 C280 146 322 108 366 80 C416 48 480 72 540 122',
    stops: [
      { id: 'A1', x: 94, y: 120, name: 'Jane & Sons Bakery' },
      { id: 'A2', x: 190, y: 96, name: 'Riverfront Catering' },
      { id: 'A3', x: 288, y: 140, name: 'Omega Medical' },
      { id: 'A4', x: 392, y: 82, name: 'Northline Supply' },
      { id: 'A5', x: 540, y: 122, name: 'Bakery Drop' },
      { id: 'A6', x: 138, y: 104, name: 'Union Wholesale' },
      { id: 'A7', x: 238, y: 118, name: 'Market Annex' },
      { id: 'A8', x: 338, y: 108, name: 'North Dock' },
      { id: 'A9', x: 456, y: 94, name: 'Cafe Receiving' },
      { id: 'A10', x: 504, y: 108, name: 'Bakery Annex' },
    ],
  },
  {
    id: 'route-b',
    label: 'RT-2',
    driver: 'Central / Van 07',
    color: '#4F7A54',
    vehicle: 'DEN-220',
    path: 'M72 210 C142 176 198 194 258 226 C318 262 372 230 426 196 C482 162 526 190 565 228',
    stops: [
      { id: 'B1', x: 72, y: 210, name: 'Union Station' },
      { id: 'B2', x: 170, y: 192, name: 'Main Street Cold' },
      { id: 'B3', x: 290, y: 236, name: 'Civic Center' },
      { id: 'B4', x: 430, y: 196, name: 'Warehouse 4' },
      { id: 'B5', x: 565, y: 228, name: 'East Market' },
      { id: 'B6', x: 118, y: 196, name: 'Central Supply' },
      { id: 'B7', x: 226, y: 210, name: 'Depot Transfer' },
      { id: 'B8', x: 354, y: 244, name: 'Union Cold' },
      { id: 'B9', x: 486, y: 202, name: 'East Dock' },
      { id: 'B10', x: 530, y: 216, name: 'Market Annex' },
    ],
  },
  {
    id: 'route-c',
    label: 'RT-3',
    driver: 'South loop / Van 03',
    color: '#8D5D9C',
    vehicle: 'DEN-331',
    path: 'M92 328 C150 308 206 340 252 366 C308 402 374 374 436 338 C492 306 526 336 560 372',
    stops: [
      { id: 'C1', x: 92, y: 328, name: 'South Depot' },
      { id: 'C2', x: 198, y: 350, name: 'Cedar Pharmacy' },
      { id: 'C3', x: 314, y: 386, name: 'Hillcrest Foods' },
      { id: 'C4', x: 440, y: 336, name: 'Broadway Clinic' },
      { id: 'C5', x: 560, y: 372, name: 'Pine Center' },
      { id: 'C6', x: 146, y: 334, name: 'Southline Depot' },
      { id: 'C7', x: 254, y: 366, name: 'Cedar Annex' },
      { id: 'C8', x: 374, y: 370, name: 'Wash Park Market' },
      { id: 'C9', x: 492, y: 344, name: 'Broadway Foods' },
      { id: 'C10', x: 524, y: 358, name: 'Pine Receiving' },
    ],
  },
  {
    id: 'route-d',
    label: 'RT-4',
    driver: 'West ridge / Van 18',
    color: '#2F6F9F',
    vehicle: 'DEN-418',
    path: 'M120 70 C142 134 144 170 188 224 C228 274 220 322 286 390',
    stops: [
      { id: 'D1', x: 120, y: 70, name: 'Highland Grocer' },
      { id: 'D2', x: 148, y: 150, name: 'Sloan Dock' },
      { id: 'D3', x: 194, y: 228, name: 'Federal Market' },
      { id: 'D4', x: 230, y: 306, name: 'Westside Clinic' },
      { id: 'D5', x: 286, y: 390, name: 'Lakewood Labs' },
      { id: 'D6', x: 132, y: 112, name: 'Highland Annex' },
      { id: 'D7', x: 158, y: 186, name: 'Sloan Pharmacy' },
      { id: 'D8', x: 214, y: 266, name: 'Federal Cold' },
      { id: 'D9', x: 254, y: 346, name: 'Westside Market' },
      { id: 'D10', x: 276, y: 374, name: 'Lakewood Drop' },
    ],
  },
  {
    id: 'route-e',
    label: 'RT-5',
    driver: 'East loop / Van 44',
    color: '#B74D47',
    vehicle: 'DEN-544',
    path: 'M372 372 C414 318 424 298 482 246 C528 206 532 156 578 102',
    stops: [
      { id: 'E1', x: 372, y: 372, name: 'Cherry Creek Cold' },
      { id: 'E2', x: 424, y: 300, name: 'Speer Pharmacy' },
      { id: 'E3', x: 482, y: 246, name: 'Colfax Supply' },
      { id: 'E4', x: 534, y: 180, name: 'City Park Foods' },
      { id: 'E5', x: 578, y: 102, name: 'East Dock' },
      { id: 'E6', x: 398, y: 336, name: 'Cherry Annex' },
      { id: 'E7', x: 452, y: 274, name: 'Speer Medical' },
      { id: 'E8', x: 510, y: 218, name: 'Colfax Market' },
      { id: 'E9', x: 546, y: 150, name: 'City Park Clinic' },
      { id: 'E10', x: 568, y: 124, name: 'Eastside Drop' },
    ],
  },
] as const;

const routeMapUnassignedJobs = [
  { name: 'Riverfront Catering', address: '870 W Evans Ave', priority: 'Low' },
  { name: 'Larimer Office Supply', address: '1010 Platte St', priority: 'Low' },
] as const;

const routeMapTiles = [
  'https://a.basemaps.cartocdn.com/light_all/13/1706/3109.png',
  'https://a.basemaps.cartocdn.com/light_all/13/1707/3109.png',
  'https://a.basemaps.cartocdn.com/light_all/13/1706/3110.png',
  'https://a.basemaps.cartocdn.com/light_all/13/1707/3110.png',
] as const;

function RouteLinePreview({
  activeKey,
  dark = false,
}: {
  activeKey: QuickDemoStepKey;
  dark?: boolean;
}) {
  const copy = routePreviewCopy[activeKey];
  const surface = dark ? '#17110D' : '#FFFFFF';
  const border = dark ? alpha('#FFF8ED', 0.14) : alpha(trovanColors.black[900], 0.1);
  const primaryText = dark ? '#FFF8ED' : trovanColors.black[950];
  const secondaryText = dark ? alpha('#FFF8ED', 0.68) : alpha(trovanColors.black[900], 0.66);
  const useActualRoutingCapture = copy.label.length > 0;

  if (useActualRoutingCapture) {
    return (
      <Box
        aria-label="Actual connected route preview"
        sx={{
          minHeight: '100%',
          borderRadius: 1.4,
          overflow: 'hidden',
          border: `1px solid ${border}`,
          bgcolor: surface,
          color: primaryText,
          boxShadow: dark ? '0 28px 70px rgba(0,0,0,0.28)' : '0 22px 56px rgba(31,26,23,0.08)',
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${border}` }}>
          <Typography sx={{ color: dark ? trovanColors.copper[200] : trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
            {copy.label}
          </Typography>
          <Typography variant="h4" component="p" sx={{ mt: 0.8, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 28, md: 34 }, lineHeight: 1 }}>
            {copy.title}
          </Typography>
          <Typography sx={{ mt: 1, color: secondaryText, lineHeight: 1.55 }}>
            {copy.body}
          </Typography>
        </Box>

        <Box sx={{ p: 1.2, bgcolor: dark ? alpha('#0A0705', 0.92) : trovanColors.stone[25] }}>
          <ScreenshotFrame
            src="/marketing/product-routing-all-routes.png"
            alt="Current Trovan all-routes planning map with unassigned jobs, route summaries, and connected map context"
            caption="Current routing UI: jobs, lanes, constraints, and map context"
            fit="contain"
          />
        </Box>

        <Box sx={{ p: 1.8, display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', borderTop: `1px solid ${border}` }}>
          {['DEN-112 Run 1', 'DEN-220 Run 2', 'DEN-331 Run 3'].map((lane, index) => (
            <Box key={lane} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 9, height: 9, borderRadius: 999, bgcolor: trovanRoutePalette[index % trovanRoutePalette.length], flex: '0 0 auto' }} />
              <Typography sx={{ color: secondaryText, fontSize: 12, fontWeight: 900 }}>{lane} · 10 stops</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      aria-label="Connected route preview"
      sx={{
        minHeight: '100%',
        borderRadius: 1.4,
        overflow: 'hidden',
        border: `1px solid ${border}`,
        bgcolor: surface,
        color: primaryText,
        boxShadow: dark ? '0 28px 70px rgba(0,0,0,0.28)' : '0 22px 56px rgba(31,26,23,0.08)',
      }}
    >
      <Box sx={{ p: 2, borderBottom: `1px solid ${border}` }}>
        <Typography sx={{ color: dark ? trovanColors.copper[200] : trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
          {copy.label}
        </Typography>
        <Typography variant="h4" component="p" sx={{ mt: 0.8, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 28, md: 34 }, lineHeight: 1 }}>
          {copy.title}
        </Typography>
        <Typography sx={{ mt: 1, color: secondaryText, lineHeight: 1.55 }}>
          {copy.body}
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', bgcolor: dark ? alpha('#0A0705', 0.92) : trovanColors.stone[25], px: 1.4, pt: 1.2, pb: 1.6 }}>
        <Box
          data-testid="operational-map-preview"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 1,
            minHeight: { xs: 520, md: 610, lg: 660 },
            bgcolor: '#17110D',
            border: `1px solid ${dark ? alpha('#FFF8ED', 0.08) : alpha(trovanColors.black[900], 0.08)}`,
            p: { xs: 1, md: 1.15 },
            containerType: 'inline-size',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage: [
                'linear-gradient(110deg, transparent 0 34%, rgba(64, 116, 153, 0.16) 34% 38%, transparent 38% 100%)',
                'linear-gradient(18deg, transparent 0 46%, rgba(255,255,255,0.68) 46% 48%, transparent 48% 100%)',
                'linear-gradient(91deg, transparent 0 32%, rgba(255,255,255,0.7) 32% 33%, transparent 33% 100%)',
                'linear-gradient(0deg, transparent 0 63%, rgba(255,255,255,0.65) 63% 65%, transparent 65% 100%)',
              ].join(', '),
              backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%',
              backgroundPosition: 'center',
              filter: dark ? 'saturate(0.65) brightness(0.52)' : 'saturate(0.9) brightness(1.04)',
              opacity: dark ? 0.4 : 0.78,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: dark
                ? 'linear-gradient(180deg, rgba(20,17,15,0.1), rgba(20,17,15,0.58))'
                : 'linear-gradient(180deg, rgba(255,248,237,0.04), rgba(255,248,237,0.24))',
            },
            '@keyframes trovan-stop-reassign': {
              '0%, 18%': { transform: 'translate3d(0, 0, 0) scale(1)' },
              '28%': { transform: 'translate3d(0, 0, 0) scale(1.08)' },
              '64%, 100%': { transform: 'translate3d(112px, -108px, 0) scale(1)' },
            },
            '@keyframes trovan-pointer-reassign': {
              '0%, 12%': { opacity: 0, transform: 'translate3d(0, 0, 0)' },
              '20%': { opacity: 1, transform: 'translate3d(0, 0, 0)' },
              '64%': { opacity: 1, transform: 'translate3d(112px, -108px, 0)' },
              '80%, 100%': { opacity: 0, transform: 'translate3d(112px, -108px, 0)' },
            },
            '@keyframes trovan-drop-confirm': {
              '0%, 58%': { opacity: 0, transform: 'translateY(8px)' },
              '68%, 92%': { opacity: 1, transform: 'translateY(0)' },
              '100%': { opacity: 0, transform: 'translateY(-4px)' },
            },
            '@keyframes trovan-target-pulse': {
              '0%, 48%': { opacity: 0, transform: 'scale(0.72)' },
              '64%': { opacity: 1, transform: 'scale(1)' },
              '100%': { opacity: 0, transform: 'scale(1.42)' },
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr)',
              gap: 1,
              minHeight: { xs: 500, md: 590, lg: 640 },
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
                gap: 1,
                alignItems: 'center',
                borderRadius: 1,
                border: `1px solid ${alpha('#FFF8ED', 0.14)}`,
                bgcolor: alpha('#0A0705', 0.6),
                p: 1,
              }}
            >
              <Box>
                <Typography sx={{ color: '#FFF8ED', fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  Planning
                </Typography>
                <Typography sx={{ color: '#FFF8ED', fontSize: 15, fontWeight: 900, lineHeight: 1.1 }}>
                  Routing
                </Typography>
                <Typography sx={{ color: alpha('#FFF8ED', 0.72), fontSize: 12, lineHeight: 1.35 }}>
                  Build an optimized route draft, then rebalance lanes without losing sight of the map.
                </Typography>
              </Box>
              <Stack direction="row" flexWrap="wrap" gap={0.8} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                {['Generate route draft', 'Reoptimize plan', 'Publish plan'].map((action, index) => (
                  <Box
                    key={action}
                    sx={{
                      px: 1.2,
                      py: 0.75,
                      borderRadius: 1,
                      bgcolor: index === 0 ? trovanColors.copper[600] : alpha('#FFF8ED', 0.05),
                      border: `1px solid ${index === 0 ? alpha(trovanColors.copper[400], 0.5) : alpha('#FFF8ED', 0.18)}`,
                      color: '#FFF8ED',
                      fontSize: 12,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    {action}
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 1,
                minHeight: 0,
                '@container (min-width: 920px)': {
                  gridTemplateColumns: '170px minmax(0, 1fr) 176px',
                },
              }}
            >
              <Box
                sx={{
                  display: 'none',
                  gridTemplateRows: 'auto 1fr auto',
                  gap: 0.75,
                  '@container (min-width: 920px)': {
                    display: 'grid',
                  },
                }}
              >
                <Box sx={{ p: 1, borderRadius: 1, bgcolor: alpha('#0A0705', 0.66), border: `1px solid ${alpha('#FFF8ED', 0.14)}` }}>
                  <Typography sx={{ color: '#FFF8ED', fontSize: 12, fontWeight: 900 }}>Unassigned jobs</Typography>
                  <Typography sx={{ color: alpha('#FFF8ED', 0.64), fontSize: 10, lineHeight: 1.25 }}>Select work for the next draft.</Typography>
                  <Stack spacing={0.7} sx={{ mt: 1 }}>
                    {routeMapUnassignedJobs.map((job) => (
                      <Box key={job.name} sx={{ display: 'grid', gridTemplateColumns: '13px 1fr auto', gap: 0.6, alignItems: 'center' }}>
                        <Box sx={{ width: 13, height: 13, borderRadius: 0.35, bgcolor: trovanColors.copper[600], display: 'grid', placeItems: 'center', color: '#160F0B', fontSize: 10, fontWeight: 900 }}>✓</Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ color: '#FFF8ED', fontSize: 11, fontWeight: 900 }}>{job.name}</Typography>
                          <Typography noWrap sx={{ color: alpha('#FFF8ED', 0.58), fontSize: 9 }}>{job.address}</Typography>
                        </Box>
                        <Typography sx={{ color: '#FFF8ED', fontSize: 9, fontWeight: 900, border: `1px solid ${alpha('#FFF8ED', 0.15)}`, borderRadius: 0.5, px: 0.45 }}>
                          {job.priority}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ p: 1, borderRadius: 1, bgcolor: alpha('#0A0705', 0.66), border: `1px solid ${alpha('#FFF8ED', 0.14)}`, minHeight: 0 }}>
                  <Typography sx={{ color: '#FFF8ED', fontSize: 12, fontWeight: 900 }}>Routes</Typography>
                  <Stack spacing={0.65} sx={{ mt: 0.8 }}>
                    {routeMapRoutes.map((route, index) => (
                      <Box
                        key={route.id}
                        sx={{
                          p: 0.75,
                          borderRadius: 0.8,
                          bgcolor: index === 0 ? alpha(route.color, 0.28) : alpha('#FFF8ED', 0.035),
                          border: `1px solid ${index === 0 ? alpha(route.color, 0.58) : alpha('#FFF8ED', 0.1)}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ color: '#FFF8ED', fontSize: 12, fontWeight: 900 }}>{route.label}</Typography>
                          <Typography sx={{ color: alpha('#FFF8ED', 0.8), fontSize: 9, fontWeight: 900 }}>{index === 0 ? 'ACTIVE' : 'READY'}</Typography>
                        </Box>
                        <Typography sx={{ color: alpha('#FFF8ED', 0.58), fontSize: 10 }}>{route.stops.length} stops · {route.vehicle}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ p: 1, borderRadius: 1, bgcolor: alpha('#0A0705', 0.66), border: `1px solid ${alpha('#FFF8ED', 0.14)}` }}>
                  <Typography sx={{ color: '#FFF8ED', fontSize: 12, fontWeight: 900 }}>Vehicles in play</Typography>
                  {routeMapRoutes.slice(0, 4).map((route) => (
                    <Box key={route.vehicle} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35 }}>
                      <Typography sx={{ color: alpha('#FFF8ED', 0.76), fontSize: 10 }}>{route.vehicle}</Typography>
                      <Box sx={{ width: 9, height: 9, borderRadius: 999, bgcolor: route.color, mt: 0.3 }} />
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateRows: 'auto minmax(0, 1fr) auto',
                  minHeight: { xs: 400, md: 540 },
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: alpha('#0A0705', 0.66),
                  border: `1px solid ${alpha('#FFF8ED', 0.14)}`,
                  '@container (min-width: 920px)': {
                    minHeight: 600,
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, p: 1, borderBottom: `1px solid ${alpha('#FFF8ED', 0.12)}` }}>
                  <Box>
                    <Typography sx={{ color: '#FFF8ED', fontSize: 13, fontWeight: 900 }}>Route map</Typography>
                    <Typography sx={{ color: alpha('#FFF8ED', 0.64), fontSize: 11 }}>Map-first planning canvas with selected-lane focus.</Typography>
                  </Box>
                  <Typography sx={{ alignSelf: 'start', color: '#FFF8ED', fontSize: 10, fontWeight: 900, border: `1px solid ${alpha(trovanColors.copper[400], 0.38)}`, borderRadius: 0.5, px: 0.65, py: 0.35 }}>
                    {routeMapRoutes[0].label}
                  </Typography>
                </Box>
                <Box
                  data-testid="route-map-canvas"
                  sx={{
                    position: 'relative',
                    minHeight: { xs: 270, md: 340, lg: 380 },
                    overflow: 'hidden',
                    bgcolor: '#F7F0E6',
                  }}
                >
                  <Box
                    aria-hidden="true"
                    data-testid="route-map-tile-layer"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 0,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                      opacity: dark ? 0.58 : 0.86,
                      filter: 'saturate(0.88) contrast(0.98) brightness(1.04)',
                    }}
                  >
                    {routeMapTiles.map((tile) => (
                      <Box
                        key={tile}
                        component="img"
                        src={tile}
                        alt=""
                        draggable={false}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ))}
                  </Box>
                  <Box
                    component="svg"
                    data-testid="route-line-preview"
                    viewBox="0 0 620 430"
                    role="img"
                    aria-hidden="true"
                    sx={{ position: 'absolute', inset: 0, zIndex: 1, display: 'block', width: '100%', height: '100%' }}
                  >
                    <path d="M32 74 C128 116 186 88 264 126 C346 166 396 102 586 142" fill="none" stroke={alpha(trovanColors.black[900], 0.14)} strokeWidth="10" strokeLinecap="round" />
                    <path d="M36 294 C138 260 222 288 304 260 C386 234 470 262 586 238" fill="none" stroke={alpha(trovanColors.black[900], 0.12)} strokeWidth="8" strokeLinecap="round" />
                    <path d="M198 20 C180 126 212 216 190 410" fill="none" stroke={alpha(trovanColors.black[900], 0.12)} strokeWidth="7" strokeLinecap="round" />
                    <path d="M456 24 C434 126 464 240 432 408" fill="none" stroke={alpha(trovanColors.black[900], 0.12)} strokeWidth="7" strokeLinecap="round" />
                    {routeMapRoutes.map((route, index) => (
                      <path
                        key={route.id}
                        data-route-line="true"
                        d={route.path}
                        fill="none"
                        stroke={route.color}
                        strokeWidth={activeKey === 'drive' && index !== 0 ? 4 : 7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={index === 0 ? '12 8' : 'none'}
                        opacity={activeKey === 'drive' && index !== 0 ? 0.28 : 0.92}
                      />
                    ))}
                    {routeMapRoutes.flatMap((route, routeIndex) => route.stops.map((stop, stopIndex) => {
                      const isActiveStop = activeKey === 'drive' && routeIndex === 0 && stopIndex === 2;
                      return (
                        <g key={stop.id} data-route-stop="true">
                          <title>{`${route.label} stop ${stopIndex + 1}: ${stop.name}`}</title>
                          <circle
                            cx={stop.x}
                            cy={stop.y}
                            r={isActiveStop ? 16 : 10}
                            fill={isActiveStop ? trovanColors.copper[500] : '#FFFFFF'}
                            stroke={isActiveStop ? '#FFF8ED' : route.color}
                            strokeWidth={isActiveStop ? 4 : 3}
                          />
                          <text
                            x={stop.x}
                            y={stop.y + 4}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="900"
                            fill={isActiveStop ? '#FFF8ED' : trovanColors.black[900]}
                          >
                            {stopIndex + 1}
                          </text>
                        </g>
                      );
                    }))}
                  </Box>

                  {activeKey === 'plan' ? (
                    <>
                      <Box
                        aria-hidden="true"
                        sx={{
                          position: 'absolute',
                          zIndex: 2,
                          left: '57%',
                          top: '34%',
                          width: 34,
                          height: 34,
                          borderRadius: 999,
                          border: `2px solid ${routeMapRoutes[3].color}`,
                          boxShadow: `0 0 0 8px ${alpha(routeMapRoutes[3].color, 0.16)}`,
                          '@media (prefers-reduced-motion: no-preference)': {
                            animation: 'trovan-target-pulse 4.6s ease-in-out infinite',
                          },
                        }}
                      />
                      <Box
                        data-testid="route-reassign-animation"
                        aria-label="Animated stop reassignment"
                        sx={{
                          position: 'absolute',
                          zIndex: 3,
                          left: '43%',
                          top: '55%',
                          display: 'grid',
                          placeItems: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          color: '#FFF8ED',
                          bgcolor: routeMapRoutes[1].color,
                          border: '3px solid #FFF8ED',
                          boxShadow: '0 16px 34px rgba(31,26,23,0.28)',
                          fontWeight: 900,
                          fontSize: 12,
                          '@media (prefers-reduced-motion: no-preference)': {
                            animation: 'trovan-stop-reassign 4.6s ease-in-out infinite',
                          },
                        }}
                      >
                        13
                      </Box>
                      <Box
                        aria-hidden="true"
                        sx={{
                          position: 'absolute',
                          zIndex: 4,
                          left: '47%',
                          top: '60%',
                          width: 20,
                          height: 20,
                          borderLeft: `12px solid ${trovanColors.black[950]}`,
                          borderTop: '8px solid transparent',
                          borderBottom: '8px solid transparent',
                          filter: 'drop-shadow(0 8px 12px rgba(31,26,23,0.28))',
                          '@media (prefers-reduced-motion: no-preference)': {
                            animation: 'trovan-pointer-reassign 4.6s ease-in-out infinite',
                          },
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          zIndex: 4,
                          left: { xs: 12, sm: 18 },
                          bottom: { xs: 12, sm: 16 },
                          px: 1.2,
                          py: 0.8,
                          borderRadius: 1,
                          bgcolor: alpha('#0A0705', 0.82),
                          border: `1px solid ${alpha('#FFF8ED', 0.14)}`,
                          boxShadow: '0 12px 28px rgba(31,26,23,0.14)',
                          color: '#FFF8ED',
                          fontSize: 12,
                          fontWeight: 900,
                          '@media (prefers-reduced-motion: no-preference)': {
                            animation: 'trovan-drop-confirm 4.6s ease-in-out infinite',
                          },
                        }}
                      >
                        Stop 13 moved to RT-4
                      </Box>
                    </>
                  ) : null}
                </Box>

                <Box sx={{ p: 1, borderTop: `1px solid ${alpha('#FFF8ED', 0.12)}` }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.8 }}>
                    <Box>
                      <Typography sx={{ color: '#FFF8ED', fontSize: 13, fontWeight: 900 }}>Manual route editor</Typography>
                      <Typography sx={{ color: alpha('#FFF8ED', 0.62), fontSize: 11 }}>Drag stops between lanes, reorder within a lane, or lock critical stops.</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 0.75 }}>
                    {routeMapRoutes.map((route) => (
                      <Box key={route.id} sx={{ minWidth: 0, p: 0.75, borderRadius: 0.9, border: `1px dashed ${alpha(route.color, 0.48)}`, bgcolor: alpha(route.color, 0.11) }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.6 }}>
                          <Typography sx={{ color: '#FFF8ED', fontSize: 12, fontWeight: 900 }}>{route.label}</Typography>
                          <Typography sx={{ color: '#FFF8ED', fontSize: 9, fontWeight: 900, px: 0.55, py: 0.25, borderRadius: 0.5, bgcolor: alpha('#FFF8ED', 0.08) }}>{route.stops.length} stops</Typography>
                        </Box>
                        <Stack spacing={0.45} sx={{ mt: 0.65 }}>
                          {route.stops.slice(0, 2).map((stop, index) => (
                            <Box key={stop.id} sx={{ borderRadius: 0.8, p: 0.6, bgcolor: alpha('#0A0705', 0.44), border: `1px solid ${alpha('#FFF8ED', 0.08)}` }}>
                              <Typography noWrap sx={{ color: '#FFF8ED', fontSize: 10.5, fontWeight: 900 }}>{index + 1}. {stop.name}</Typography>
                              <Typography noWrap sx={{ color: alpha('#FFF8ED', 0.55), fontSize: 9 }}>{route.vehicle}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'none', gridTemplateRows: 'auto 1fr auto', borderRadius: 1, overflow: 'hidden', bgcolor: alpha('#0A0705', 0.66), border: `1px solid ${alpha('#FFF8ED', 0.14)}`, '@container (min-width: 920px)': { display: 'grid' } }}>
                <Box sx={{ p: 1, borderBottom: `1px solid ${alpha('#FFF8ED', 0.12)}` }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ color: '#FFF8ED', fontSize: 13, fontWeight: 900 }}>{routeMapRoutes[0].label}</Typography>
                    <Typography sx={{ color: '#FFF8ED', fontSize: 10, fontWeight: 900, border: `1px solid ${alpha('#FFF8ED', 0.12)}`, borderRadius: 0.5, px: 0.55 }}>DRAFT READY</Typography>
                  </Box>
                  <Typography sx={{ color: alpha('#FFF8ED', 0.7), fontSize: 11, mt: 0.45 }}>{routeMapRoutes[0].stops.length} stops · 26.5 mi</Typography>
                </Box>
                <Box sx={{ p: 1 }}>
                  <Typography sx={{ color: alpha('#FFF8ED', 0.7), fontSize: 11 }}>Service date: Jun 2, 2026</Typography>
                  <Typography sx={{ color: alpha('#FFF8ED', 0.7), fontSize: 11, mt: 0.35 }}>Objective: Balanced</Typography>
                  <Typography sx={{ color: alpha('#FFF8ED', 0.7), fontSize: 11, mt: 0.35 }}>Routes: 5 · Stops: 25</Typography>
                  <Box sx={{ mt: 1.2, p: 0.8, borderRadius: 0.8, border: `1px solid ${alpha('#FFF8ED', 0.14)}` }}>
                    <Typography sx={{ color: alpha('#FFF8ED', 0.54), fontSize: 10 }}>Vehicle</Typography>
                    <Typography sx={{ color: '#FFF8ED', fontSize: 12, fontWeight: 900 }}>{routeMapRoutes[0].vehicle}</Typography>
                  </Box>
                  <Stack spacing={0.65} sx={{ mt: 1 }}>
                    {routeMapRoutes[0].stops.slice(0, 4).map((stop, index) => (
                      <Box key={stop.id} sx={{ p: 0.75, borderRadius: 0.8, border: `1px solid ${alpha('#FFF8ED', 0.1)}`, bgcolor: alpha('#FFF8ED', 0.035) }}>
                        <Typography noWrap sx={{ color: '#FFF8ED', fontSize: 10.5, fontWeight: 900 }}>{index + 1}. {stop.name}</Typography>
                        <Typography noWrap sx={{ color: alpha('#FFF8ED', 0.55), fontSize: 9 }}>Denver, CO</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ p: 1, borderTop: `1px solid ${alpha('#FFF8ED', 0.12)}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.6 }}>
                  <Box sx={{ textAlign: 'center', py: 0.8, borderRadius: 0.8, border: `1px solid ${alpha('#FFF8ED', 0.16)}`, color: '#FFF8ED', fontSize: 11, fontWeight: 900 }}>Reoptimize plan</Box>
                  <Box sx={{ textAlign: 'center', py: 0.8, borderRadius: 0.8, bgcolor: trovanColors.copper[600], color: '#FFF8ED', fontSize: 11, fontWeight: 900 }}>Publish plan</Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.3 }}>
          {routeMapRoutes.map((route) => (
            <Box key={route.id} sx={{ px: 1.2, py: 0.8, borderRadius: 1, flex: 1, bgcolor: dark ? alpha('#FFF8ED', 0.07) : '#FFFFFF', border: `1px solid ${border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 9, height: 9, borderRadius: 999, bgcolor: route.color, flex: '0 0 auto' }} />
                <Box>
                  <Typography sx={{ color: primaryText, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0, lineHeight: 1.1 }}>{route.label}</Typography>
                  <Typography sx={{ color: secondaryText, fontSize: 10, lineHeight: 1.1 }}>{route.vehicle}</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box sx={{ p: 1.8, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ color: secondaryText }}>Connected route evidence</Typography>
        <Typography sx={{ color: dark ? trovanColors.copper[200] : trovanColors.copper[700], fontWeight: 900 }}>{copy.metric}</Typography>
      </Box>
    </Box>
  );
}

function RouteMotionVideo() {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    if (shouldLoadVideo) return undefined;
    const section = sectionRef.current;
    if (!section || !('IntersectionObserver' in window)) {
      setShouldLoadVideo(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShouldLoadVideo(true);
        observer.disconnect();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [shouldLoadVideo]);

  return (
    <Box ref={sectionRef} sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25], color: trovanColors.black[950] }}>
      <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.72fr 1.28fr' }, gap: 3, alignItems: 'center' }}>
        <Box>
          <Kicker>Real product recording</Kicker>
          <Typography variant="h2" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 52 }, lineHeight: 1 }}>
            See the route day move through the actual Trovan UI.
          </Typography>
          <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.68), fontSize: 18, lineHeight: 1.55 }}>
            This 35-second tour was recorded from the current product preview. It moves from the operations dashboard through planning, dispatch, route execution, tracking, proof, and the customer status page.
          </Typography>
          <Stack spacing={1} sx={{ mt: 2.2 }}>
            {[
              'Current Trovan screens—not recreated marketing mockups.',
              'Chapter labels explain what each team sees during the route day.',
              'Muted playback, controls, captions, and a reduced-motion-safe poster.',
            ].map((item) => (
              <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                <CheckRoundedIcon sx={{ color: trovanColors.semantic.success, fontSize: 18, mt: '2px' }} />
                <Typography sx={{ color: alpha(trovanColors.black[900], 0.72), lineHeight: 1.5 }}>{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Box sx={{ borderRadius: 2, bgcolor: '#151210', border: `1px solid ${alpha(trovanColors.copper[300], 0.16)}`, boxShadow: '0 30px 90px rgba(0,0,0,0.32)', overflow: 'hidden' }}>
          <ProductFrameHeader detail="Recorded in the current Trovan preview" />
          <Box
            component="video"
            controls
            autoPlay={shouldLoadVideo && !reduceMotion}
            muted
            loop
            playsInline
            preload={shouldLoadVideo ? 'metadata' : 'none'}
            poster={PRODUCT_TOUR_POSTER_SRC}
            aria-label="Trovan product tour recording from dashboard through customer tracking"
            sx={{ display: 'block', width: '100%', aspectRatio: '16 / 10', bgcolor: '#0C0907' }}
          >
            {shouldLoadVideo ? <source src={PRODUCT_TOUR_VIDEO_SRC} type="video/mp4" /> : null}
            <track kind="captions" src={PRODUCT_TOUR_CAPTIONS_SRC} srcLang="en" label="English" />
            Your browser does not support the Trovan product-tour video.
          </Box>
          <Stack
            direction="row"
            spacing={0.8}
            flexWrap="wrap"
            sx={{ p: 1.4, borderTop: `1px solid ${alpha('#FFF8ED', 0.12)}` }}
          >
            {['Dashboard', 'Planning', 'Dispatch', 'Execution', 'Tracking', 'Proof', 'Customer view'].map((chapter) => (
              <Box key={chapter} sx={{ px: 1, py: 0.45, borderRadius: 999, color: alpha('#FFF8ED', 0.78), border: `1px solid ${alpha('#FFF8ED', 0.16)}`, fontSize: 11, fontWeight: 900 }}>
                {chapter}
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function ConnectedRouteProofSection() {
  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ p: 2.4, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
        <Typography sx={{ color: trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
          Route visualization
        </Typography>
        <Typography variant="h3" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 34, md: 44 }, lineHeight: 1 }}>
          Rebalance routes without losing operational context.
        </Typography>
        <Typography sx={{ mt: 1.4, color: alpha(trovanColors.black[900], 0.68), fontSize: 18, lineHeight: 1.55 }}>
          See the impacted stops, route lanes, and map context before you publish a route change.
        </Typography>
      </Box>
      <Box sx={{ mt: 2.2 }}>
        <ScreenshotFrame
          src="/marketing/product-routing-all-routes.png"
          alt="Current Trovan all-routes planning map with unassigned jobs, route summaries, and connected map context"
          caption="Route planning workspace"
        />
      </Box>
    </Box>
  );
}

function ProductProofTabs() {
  const tabs = workflowPages.slice(0, 4);
  const [activeKey, setActiveKey] = useState(tabs[0].key);
  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  const panelId = `product-proof-panel-${activeTab.key}`;

  const handleProductTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length;
    setActiveKey(tabs[nextIndex].key);
  };

  return (
    <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.42fr 0.58fr' }, gap: 3, alignItems: 'stretch' }}>
      <Box sx={{ display: 'grid', gap: 1.2, alignContent: 'start' }}>
        <Box sx={{ display: 'grid', gap: 1.2 }} role="tablist" aria-label="Product proof">
          {tabs.map((tab, index) => (
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
              sx={{ justifyContent: 'space-between', minHeight: 54, color: activeKey === tab.key ? '#FFFFFF' : trovanColors.black[900], borderColor: alpha(trovanColors.black[900], 0.24), '&:hover': { borderColor: trovanColors.copper[500] } }}
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {tab.navLabel}
            </Button>
          ))}
        </Box>
        <Box id={panelId} role="tabpanel" aria-labelledby={`product-proof-tab-${activeTab.key}`} tabIndex={0} sx={{ mt: 2, p: 2, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
          <Typography variant="h5" component="h3" sx={{ fontWeight: 900 }}>{productProofTitle(activeTab.key)}</Typography>
          <List dense sx={{ mt: 1 }}>
            {activeTab.capabilities.map((capability) => (
              <ListItem key={capability} disableGutters>
                <ListItemIcon sx={{ minWidth: 32 }}><CheckRoundedIcon sx={{ color: trovanColors.semantic.success }} fontSize="small" /></ListItemIcon>
                <ListItemText primary={capability} />
              </ListItem>
            ))}
          </List>
          <Button component={RouterLink} to={activeTab.path} variant="text" endIcon={<ArrowForwardRoundedIcon />} sx={{ color: trovanColors.copper[700], px: 0 }}>
            {workflowCtaLabel(activeTab.key)}
          </Button>
        </Box>
      </Box>
      {activeTab.key === 'drive' ? (
        <MobileAppProofFrame src={activeTab.image} alt={activeTab.imageAlt} />
      ) : activeTab.key === 'dispatch' ? (
        <DispatchWorkflowFrame />
      ) : activeTab.key === 'track' ? (
        <TrackingProofFrame />
      ) : (
        <ScreenshotFrame
          src={activeTab.image}
          alt={activeTab.imageAlt}
          caption={`${activeTab.navLabel} workspace`}
        />
      )}
    </Box>
  );
}

function QuickProductDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const active = quickDemoSteps[activeIndex];
  const activeWorkflow = workflowPages.find((item) => item.key === active.key) ?? workflowPages[0];
  const quickDemoImage = active.key === 'plan'
    ? '/marketing/product-routing-exceptions.png'
    : activeWorkflow.image;
  const quickDemoImageAlt = active.key === 'plan'
    ? 'Current Trovan route planning workspace showing route exceptions, stops, and publish-ready totals'
    : activeWorkflow.imageAlt;
  const progressPercent = ((activeIndex + 1) / quickDemoSteps.length) * 100;

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => {
        if (current >= quickDemoSteps.length - 1) {
          setRunning(false);
          return current;
        }
        return current + 1;
      });
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [activeIndex, running]);

  const resetDemo = () => {
    setRunning(false);
    setActiveIndex(0);
  };

  const runDemo = () => {
    if (activeIndex === quickDemoSteps.length - 1) {
      setActiveIndex(0);
    }
    setRunning(true);
  };

  return (
    <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[0] }}>
      <Box sx={{ width: sectionWidth, mx: 'auto' }}>
        <SectionHeader
          kicker="Guided walkthrough"
          title="Click through the route day loop"
          body="Click through the route day loop or let it play: import work, publish routes, guide drivers, update customers, and review proof."
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' },
            gap: 3,
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              borderRadius: 1.6,
              border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`,
              bgcolor: '#FFFFFF',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2.2, borderBottom: `1px solid ${alpha(trovanColors.black[900], 0.08)}` }}>
              <Stack spacing={1.8}>
                <Box>
                  <Typography aria-label="Quick demo status" sx={{ color: trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
                    {active.status} stage
                  </Typography>
                  <Typography variant="h3" sx={{ mt: 0.8, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 30, md: 38 }, lineHeight: 1 }}>
                    {active.headline}
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignSelf: 'flex-start' }}>
                  <Button variant="contained" onClick={runDemo} sx={{ minWidth: 148, whiteSpace: 'nowrap' }}>
                    {running ? 'Running demo' : 'Run quick demo'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={resetDemo}
                    sx={{ minWidth: 124, whiteSpace: 'nowrap', color: trovanColors.copper[700], borderColor: alpha(trovanColors.copper[600], 0.5), '&:hover': { borderColor: trovanColors.copper[700], bgcolor: alpha(trovanColors.copper[50], 0.6) } }}
                  >
                    Replay demo
                  </Button>
                </Stack>
              </Stack>
              <Box sx={{ mt: 2.2, height: 8, borderRadius: 999, bgcolor: alpha(trovanColors.black[900], 0.08), overflow: 'hidden' }} aria-hidden="true">
                <Box sx={{ width: `${progressPercent}%`, height: '100%', bgcolor: trovanColors.copper[600], transition: 'width 220ms ease' }} />
              </Box>
            </Box>

            <Box sx={{ p: 2.2 }}>
              <Box aria-label="Quick route day demo steps" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {quickDemoSteps.map((step, index) => (
                  <Button
                    key={step.key}
                    aria-pressed={index === activeIndex}
                    variant="text"
                    onClick={() => {
                      setRunning(false);
                      setActiveIndex(index);
                    }}
                    sx={{
                      flex: { xs: '1 1 100%', sm: '1 1 calc(33.333% - 8px)', md: '1 1 calc(20% - 8px)' },
                      minHeight: 58,
                      color: index === activeIndex ? '#FFF8ED' : '#17110D',
                      bgcolor: index === activeIndex ? trovanColors.copper[700] : '#FFFFFF',
                      border: `1px solid ${index === activeIndex ? trovanColors.copper[700] : alpha(trovanColors.black[900], 0.22)}`,
                      fontSize: 13,
                      fontWeight: 900,
                      lineHeight: 1.15,
                      whiteSpace: 'normal',
                      opacity: 1,
                      '&:hover': {
                        bgcolor: index === activeIndex ? trovanColors.copper[800] : alpha(trovanColors.copper[50], 0.72),
                        borderColor: trovanColors.copper[600],
                      },
                    }}
                  >
                    {step.label}
                  </Button>
                ))}
              </Box>

              <Box aria-live="polite" sx={{ mt: 2.4 }}>
                <Typography sx={{ color: alpha(trovanColors.black[900], 0.7), fontSize: 17, lineHeight: 1.55 }}>
                  {active.body}
                </Typography>
                <Alert severity="info" icon={false} sx={{ mt: 2, bgcolor: alpha(trovanColors.copper[50], 0.78), color: trovanColors.black[950] }}>
                  {active.operatorView}
                </Alert>
                <Box sx={{ mt: 2.2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
                  {active.stats.map(([label, value]) => (
                    <Box key={label} sx={{ p: 1.5, borderRadius: 1, bgcolor: trovanColors.stone[25], border: `1px solid ${alpha(trovanColors.black[900], 0.08)}` }}>
                      <Typography sx={{ color: alpha(trovanColors.black[900], 0.58), fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>
                        {label}
                      </Typography>
                      <Typography sx={{ mt: 0.4, fontSize: 24, fontWeight: 900 }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              gap: 1.4,
            }}
          >
            <Box>
              <ScreenshotFrame
                src={quickDemoImage}
                alt={quickDemoImageAlt}
                caption={`${active.label} view`}
                fit="contain"
              />
            </Box>
            <RouteLinePreview activeKey={active.key} dark />
            <Box
              sx={{
                borderRadius: 1.4,
                bgcolor: trovanColors.black[950],
                color: '#FFF8ED',
                border: `1px solid ${alpha(trovanColors.copper[200], 0.16)}`,
                p: 2,
              }}
            >
              <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
                Live route day log
              </Typography>
              <Stack spacing={1.2} sx={{ mt: 1.4 }}>
                {active.eventLog.map((event, index) => (
                  <Stack key={event} direction="row" spacing={1.2} alignItems="center">
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: alpha(trovanColors.copper[300], index === 0 ? 0.28 : 0.14), color: trovanColors.copper[100], fontSize: 12, fontWeight: 900 }}>
                      {index + 1}
                    </Box>
                    <Typography sx={{ color: alpha('#FFF8ED', 0.78) }}>{event}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function HeroProductShowcase() {
  return (
    <MarketingScreenshotFrame
      title="Route-day command center"
      caption="Route map, selected lane, and publish-ready route context."
      imageSrc="/marketing/product-routing.png"
      imageWebpSrc="/marketing/product-routing-768.webp"
      imageAlt="Current Trovan route planning workspace with unassigned jobs, route lanes, map context, and publish controls"
      variant="map"
      priority
      badges={['30 jobs planned', '3 routes balanced', '0 unassigned']}
    />
  );
}

type RoiInputs = {
  routesPerDay: number;
  stopsPerRoute: number;
  deliveryDaysPerWeek: number;
  avgDriverHourlyCost: number;
  avgMilesPerRoute: number;
  estimatedMinutesSavedPerRoute: number;
  estimatedMilesSavedPerRoute: number;
  failedDeliveryCost: number;
  failedDeliveriesAvoidedPerWeek: number;
  costPerMile: number;
};

const defaultRoiInputs: RoiInputs = {
  routesPerDay: 12,
  stopsPerRoute: 18,
  deliveryDaysPerWeek: 5,
  avgDriverHourlyCost: 28,
  avgMilesPerRoute: 42,
  estimatedMinutesSavedPerRoute: 18,
  estimatedMilesSavedPerRoute: 6,
  failedDeliveryCost: 85,
  failedDeliveriesAvoidedPerWeek: 3,
  costPerMile: 0.67,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.max(0, value));
}

function RoiCalculator({ titleComponent = 'h3' }: { titleComponent?: ElementType }) {
  const [inputs, setInputs] = useState<RoiInputs>(defaultRoiInputs);
  const updateInput = (key: keyof RoiInputs, value: string) => {
    const nextValue = Number(value);
    setInputs((current) => ({ ...current, [key]: Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0 }));
  };

  const weeklyLaborSavings =
    inputs.routesPerDay * inputs.deliveryDaysPerWeek * (inputs.estimatedMinutesSavedPerRoute / 60) * inputs.avgDriverHourlyCost;
  const monthlyLaborSavings = weeklyLaborSavings * 4.33;
  const effectiveMilesSavedPerRoute = Math.min(
    inputs.estimatedMilesSavedPerRoute,
    inputs.avgMilesPerRoute,
  );
  const weeklyMileageSavings =
    inputs.routesPerDay * inputs.deliveryDaysPerWeek * effectiveMilesSavedPerRoute * inputs.costPerMile;
  const monthlyMileageSavings = weeklyMileageSavings * 4.33;
  const monthlyFailedDeliverySavings =
    inputs.failedDeliveryCost * inputs.failedDeliveriesAvoidedPerWeek * 4.33;
  const totalEstimatedMonthlySavings = monthlyLaborSavings + monthlyMileageSavings + monthlyFailedDeliverySavings;
  const routeDaysPerMonth = inputs.routesPerDay * inputs.deliveryDaysPerWeek * 4.33;
  const estimatedSavingsPerRoute = routeDaysPerMonth > 0 ? totalEstimatedMonthlySavings / routeDaysPerMonth : 0;
  const growthPlanReference = 899;
  const breakEvenRouteDays =
    estimatedSavingsPerRoute > 0 ? Math.max(1, Math.ceil(growthPlanReference / estimatedSavingsPerRoute)) : null;
  const totalStopsPerWeek = inputs.routesPerDay * inputs.stopsPerRoute * inputs.deliveryDaysPerWeek;

  const fields: Array<{ key: keyof RoiInputs; label: string; helper?: string; step?: string }> = [
    { key: 'routesPerDay', label: 'Routes per day' },
    { key: 'stopsPerRoute', label: 'Stops per route' },
    { key: 'deliveryDaysPerWeek', label: 'Delivery days per week' },
    { key: 'avgDriverHourlyCost', label: 'Average driver hourly cost' },
    { key: 'avgMilesPerRoute', label: 'Average miles per route' },
    { key: 'estimatedMinutesSavedPerRoute', label: 'Estimated minutes saved per route' },
    { key: 'estimatedMilesSavedPerRoute', label: 'Estimated miles saved per route' },
    { key: 'failedDeliveryCost', label: 'Failed delivery cost' },
    { key: 'failedDeliveriesAvoidedPerWeek', label: 'Failed deliveries avoided per week' },
    { key: 'costPerMile', label: 'Cost per mile', step: '0.01' },
  ];

  return (
    <Box
      data-testid="roi-calculator"
      sx={{
        mt: 3,
        mb: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
        gap: 2,
        alignItems: 'stretch',
      }}
    >
      <Box sx={{ p: 2.4, borderRadius: 1.6, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
        <Typography variant="h3" component={titleComponent} sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 32, md: 42 }, lineHeight: 1 }}>
          See what one route day costs you.
        </Typography>
        <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68), lineHeight: 1.55 }}>
          Use your current route data for a more accurate audit. These numbers are estimates, not guaranteed savings.
        </Typography>
        <Box sx={{ mt: 2.2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
          {fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              type="number"
              value={inputs[field.key]}
              inputProps={{ min: 0, step: field.step ?? '1' }}
              onChange={(event) => updateInput(field.key, event.target.value)}
              size="small"
              sx={{
                '& .MuiInputLabel-root': {
                  color: alpha(trovanColors.black[900], 0.68),
                  fontWeight: 800,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: trovanColors.copper[700],
                },
                '& .MuiInputBase-input': {
                  color: trovanColors.black[950],
                  fontWeight: 850,
                },
                '& .MuiOutlinedInput-root': {
                  bgcolor: trovanColors.stone[0],
                  '& fieldset': {
                    borderColor: alpha(trovanColors.black[900], 0.16),
                  },
                  '&:hover fieldset': {
                    borderColor: alpha(trovanColors.copper[600], 0.5),
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: trovanColors.copper[600],
                  },
                },
              }}
            />
          ))}
        </Box>
        {inputs.estimatedMilesSavedPerRoute > inputs.avgMilesPerRoute ? (
          <Alert severity="warning" sx={{ mt: 1.4 }}>
            Estimated miles saved is capped at the average miles per route so savings cannot exceed the route itself.
          </Alert>
        ) : null}
      </Box>

      <Box sx={{ p: 2.4, borderRadius: 1.6, bgcolor: trovanColors.black[950], color: '#FFF8ED', border: `1px solid ${alpha(trovanColors.copper[300], 0.18)}`, boxShadow: '0 22px 64px rgba(31,26,23,0.18)' }}>
        <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
          Estimated monthly savings from your inputs
        </Typography>
        <Typography sx={{ mt: 0.7, fontSize: { xs: 42, md: 56 }, lineHeight: 1, fontWeight: 950 }}>
          {formatCurrency(totalEstimatedMonthlySavings)}
        </Typography>
        <Typography sx={{ mt: 1, color: alpha('#FFF8ED', 0.66), lineHeight: 1.55 }}>
          Based on {Math.round(totalStopsPerWeek).toLocaleString()} weekly stops, current labor assumptions, mileage assumptions, and failed-delivery avoidance.
        </Typography>
        <Typography sx={{ mt: 0.8, color: alpha('#FFF8ED', 0.58), fontSize: 13.5, lineHeight: 1.45 }}>
          This is an estimate based on the values entered. A route audit uses your actual route data.
        </Typography>
        <Divider sx={{ my: 2, borderColor: alpha('#FFF8ED', 0.12) }} />
        <Stack spacing={1.2}>
          {[
            ['Labor savings', monthlyLaborSavings],
            ['Mileage/fuel savings', monthlyMileageSavings],
            ['Avoided failed-delivery cost', monthlyFailedDeliverySavings],
            ['Estimated savings per route', estimatedSavingsPerRoute],
          ].map(([label, value]) => (
            <Stack key={label as string} direction="row" justifyContent="space-between" gap={2}>
              <Typography sx={{ color: alpha('#FFF8ED', 0.68) }}>{label}</Typography>
              <Typography sx={{ fontWeight: 900 }}>{formatCurrency(value as number)}</Typography>
            </Stack>
          ))}
        </Stack>
        <Alert severity="info" icon={false} sx={{ mt: 2, bgcolor: alpha(trovanColors.copper[100], 0.13), color: '#FFF8ED', border: `1px solid ${alpha(trovanColors.copper[100], 0.2)}` }}>
          Break-even estimate against the Scale package: {breakEvenRouteDays ? `${breakEvenRouteDays} route day${breakEvenRouteDays === 1 ? '' : 's'}` : 'needs route data'}.
        </Alert>
      </Box>
    </Box>
  );
}

function PricingSection({
  onOpenRequest,
  compact = false,
  showCalculator = true,
  titleComponent,
}: {
  onOpenRequest: (requestType: RequestType) => void;
  compact?: boolean;
  showCalculator?: boolean;
  titleComponent?: ElementType;
}) {
  return (
    <Box id="pricing" sx={{ py: { xs: compact ? 6 : 7, md: compact ? 7 : 9 }, bgcolor: trovanColors.stone[25], color: trovanColors.black[950] }}>
      <Box sx={{ width: sectionWidth, mx: 'auto' }}>
        <SectionHeader
          kicker="Pricing"
          title={compact ? 'Assisted-pilot pricing' : 'Pricing built around route volume and operational impact'}
          body={compact
            ? 'Launch at $399/month, Scale at $899/month, or a custom Enterprise rollout. Activation follows onboarding approval.'
            : 'Start with the cost of the route day: planning time, miles, failed deliveries, dispatcher follow-up, and proof gaps. Then pick the rollout package that fits.'}
          titleComponent={titleComponent}
        />
        {showCalculator ? <RoiCalculator titleComponent={titleComponent === 'h1' ? 'h2' : 'h3'} /> : null}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          {pricingPlans.map((plan) => (
            <Box key={plan.name} sx={{ p: 2.4, borderRadius: 1.6, border: `1px solid ${plan.featured ? alpha(trovanColors.copper[500], 0.48) : alpha(trovanColors.black[900], 0.13)}`, bgcolor: plan.featured ? alpha(trovanColors.copper[50], 0.8) : '#FFFFFF', boxShadow: plan.featured ? '0 24px 64px rgba(169,99,33,0.16)' : 'none' }}>
              <Typography variant="h5" component={titleComponent === 'h1' ? 'h2' : 'h3'} sx={{ fontWeight: 900 }}>{plan.name}</Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: 40, fontWeight: 900 }}>{plan.price}</Typography>
                {plan.cadence ? (
                  <Typography sx={{ color: alpha(trovanColors.black[900], 0.62), fontWeight: 800 }}>
                    {plan.cadence}
                  </Typography>
                ) : null}
              </Stack>
              <Typography sx={{ color: alpha(trovanColors.black[900], 0.66), minHeight: 48 }}>{plan.body}</Typography>
              {!compact ? (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={1}>
                    {plan.features.map((feature) => (
                      <Stack key={feature} direction="row" spacing={1} alignItems="center">
                        <CheckRoundedIcon sx={{ color: trovanColors.semantic.success, fontSize: 19 }} />
                        <Typography>{feature}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              ) : null}
              <Button fullWidth variant={plan.featured ? 'contained' : 'outlined'} onClick={() => onOpenRequest(plan.requestType)} sx={{ mt: compact ? 1.5 : 2.4, color: plan.featured ? '#FFFFFF' : trovanColors.copper[700], borderColor: alpha(trovanColors.copper[500], 0.5) }}>
                {plan.cta}
              </Button>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function FinalCta({ onOpenRequest, title = 'Watch a full route day in Trovan' }: { onOpenRequest: (requestType: RequestType) => void; title?: string }) {
  return (
    <Box sx={{ bgcolor: trovanColors.stone[0], color: trovanColors.black[950], py: { xs: 7, md: 9 } }}>
      <Box sx={{ width: 'min(960px, calc(100% - 32px))', mx: 'auto', textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 40, md: 60 }, lineHeight: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
          Walk through planning, dispatch, the driver mobile app, customer tracking, and proof in one focused demo.
        </Typography>
        <Button onClick={() => onOpenRequest('Book demo')} variant="contained" size="large" sx={{ mt: 3 }}>
          {BOOK_DEMO_CTA}
        </Button>
      </Box>
    </Box>
  );
}

type HomepageProofCard = {
  key: 'plan' | 'dispatch' | 'proof';
  title: string;
  body: string;
  metric: string;
  accent: string;
  glow: string;
  surface: string;
};

const homepageProofCards: HomepageProofCard[] = [
  {
    key: 'plan',
    title: 'Planning sees risk before dispatch',
    body: 'Operators see unassigned work, route density, capacity pressure, and late-risk stops before the plan reaches the road.',
    metric: '7 review flags',
    accent: trovanColors.copper[600],
    glow: alpha(trovanColors.copper[300], 0.22),
    surface: `linear-gradient(135deg, ${alpha(trovanColors.copper[50], 0.96)} 0%, #FFFFFF 58%)`,
  },
  {
    key: 'dispatch',
    title: 'Dispatch sees progress without chasing drivers',
    body: 'Route lanes, driver status, exceptions, and same-day changes stay visible in one repeated-action board.',
    metric: '4 live lanes',
    accent: trovanRoutePalette[1] ?? '#4E7BFF',
    glow: alpha(trovanRoutePalette[1] ?? '#4E7BFF', 0.2),
    surface: `linear-gradient(135deg, ${alpha(trovanRoutePalette[1] ?? '#4E7BFF', 0.09)} 0%, #FFFFFF 58%)`,
  },
  {
    key: 'proof',
    title: 'Managers see proof after every stop',
    body: 'Driver notes, ETA context, proof, no-proof decisions, and route events remain attached to the route record.',
    metric: 'Proof tied to route',
    accent: trovanColors.semantic.success,
    glow: alpha(trovanColors.semantic.success, 0.2),
    surface: `linear-gradient(135deg, ${alpha(trovanColors.semantic.success, 0.08)} 0%, #FFFFFF 58%)`,
  },
];

function HomepageProofVisual({ card }: { card: HomepageProofCard }) {
  if (card.key === 'plan') {
    return (
      <Box
        sx={{
          position: 'relative',
          p: 1.5,
          borderRadius: 1.4,
          bgcolor: alpha('#FFFFFF', 0.86),
          border: `1px solid ${alpha(card.accent, 0.14)}`,
          overflow: 'hidden',
          '@keyframes trovan-plan-scan': {
            '0%': { transform: 'translateX(-120%)' },
            '100%': { transform: 'translateX(120%)' },
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '42%',
            background: `linear-gradient(90deg, transparent, ${alpha(card.accent, 0.12)}, transparent)`,
            '@media (prefers-reduced-motion: no-preference)': {
              animation: 'trovan-plan-scan 2.8s linear infinite',
            },
          }}
        />
        <Stack spacing={1} sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ p: 1.05, borderRadius: 1.15, bgcolor: '#FFFFFF', border: `1px solid ${alpha(card.accent, 0.12)}` }}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              <Box>
                <Typography sx={{ color: alpha(trovanColors.black[900], 0.58), fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
                  Selected route
                </Typography>
                <Typography sx={{ color: trovanColors.black[950], fontWeight: 900 }}>DEN-220 Run 2</Typography>
              </Box>
              <Box sx={{ px: 0.8, py: 0.35, borderRadius: 999, bgcolor: alpha(card.accent, 0.1), color: trovanColors.copper[800], fontSize: 11, fontWeight: 900 }}>
                Before publish
              </Box>
            </Stack>
          </Box>
          {[
            ['Omega Medical', 'Unassigned work', 'Needs lane'],
            ['North cluster', 'Route density', 'Review'],
            ['Stop 14', 'Late-risk stop', '11:40 AM'],
          ].map(([label, signal, status]) => (
            <Box key={label} sx={{ p: 1, borderRadius: 1.1, bgcolor: '#FFFFFF', border: `1px solid ${alpha(card.accent, 0.1)}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
              <Box>
                <Typography sx={{ color: trovanColors.black[950], fontWeight: 800 }}>{label}</Typography>
                <Typography sx={{ color: alpha(trovanColors.black[900], 0.62), fontSize: 12 }}>{signal}</Typography>
              </Box>
              <Box sx={{ px: 0.8, py: 0.35, borderRadius: 999, bgcolor: alpha(card.accent, 0.1), color: trovanColors.copper[800], fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>{status}</Box>
            </Box>
          ))}
          <Box sx={{ p: 1.1, borderRadius: 1.1, bgcolor: alpha(card.accent, 0.07), border: `1px solid ${alpha(card.accent, 0.12)}` }}>
            <Typography sx={{ color: alpha(trovanColors.black[900], 0.58), fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
              Planner review
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} sx={{ mt: 0.8 }}>
              {['3 lanes balanced', '1 stop at risk', 'Dispatch not notified yet'].map((item) => (
                <Box key={item} sx={{ flex: 1, px: 0.8, py: 0.65, borderRadius: 0.9, bgcolor: '#FFFFFF', color: trovanColors.black[950], fontSize: 11, fontWeight: 800, border: `1px solid ${alpha(card.accent, 0.1)}` }}>
                  {item}
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    );
  }

  if (card.key === 'dispatch') {
    return (
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.4,
          bgcolor: alpha('#FFFFFF', 0.88),
          border: `1px solid ${alpha(card.accent, 0.14)}`,
          '@keyframes trovan-dispatch-focus': {
            '0%, 24%': { opacity: 1, transform: 'translateY(0)', borderColor: alpha(card.accent, 0.28), boxShadow: `0 0 0 3px ${alpha(card.accent, 0.1)}` },
            '33%, 100%': { opacity: 0.78, transform: 'translateY(0)', borderColor: alpha(card.accent, 0.1), boxShadow: 'none' },
          },
          '@keyframes trovan-dispatch-alert': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.82 },
            '50%': { transform: 'scale(1.04)', opacity: 1 },
          },
          '@keyframes trovan-dispatch-log': {
            '0%, 24%': { opacity: 0.45 },
            '33%, 57%': { opacity: 1 },
            '66%, 100%': { opacity: 0.45 },
          },
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            {['Driver status', 'Open exceptions', 'Same-day changes'].map((item) => (
              <Box key={item} sx={{ px: 0.9, py: 0.45, borderRadius: 999, bgcolor: alpha(card.accent, 0.08), border: `1px solid ${alpha(card.accent, 0.12)}`, color: trovanColors.black[950], fontSize: 11, fontWeight: 800 }}>
                {item}
              </Box>
            ))}
          </Stack>
          {[
            ['Route lane A', 'Anna Quinn checked in', 'Driver live', 'stable'],
            ['Route lane B', 'Delay exception raised', 'Open exception', 'alert'],
            ['Route lane C', 'Stop 7 completed', 'Proof incoming', 'proof'],
          ].map(([label, sublabel, badge, kind], index) => (
            <Box
              key={label}
              sx={{
                p: 1,
                borderRadius: 1.1,
                bgcolor: '#FFFFFF',
                border: `1px solid ${alpha(card.accent, 0.1)}`,
                '@media (prefers-reduced-motion: no-preference)': {
                  animation: 'trovan-dispatch-focus 6s ease-in-out infinite',
                  animationDelay: `${index * 2}s`,
                },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Box>
                  <Typography sx={{ color: trovanColors.black[950], fontWeight: 800 }}>{label}</Typography>
                  <Typography sx={{ color: alpha(trovanColors.black[900], 0.62), fontSize: 12 }}>{sublabel}</Typography>
                </Box>
                <Box
                  sx={{
                    px: 0.8,
                    py: 0.35,
                    borderRadius: 999,
                    bgcolor: kind === 'alert' ? alpha('#D95C45', 0.12) : kind === 'proof' ? alpha(trovanColors.semantic.success, 0.12) : alpha(card.accent, 0.1),
                    color: kind === 'alert' ? '#9F3427' : kind === 'proof' ? '#166534' : '#1D4ED8',
                    fontSize: 11,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    '@media (prefers-reduced-motion: no-preference)': kind === 'alert' ? { animation: 'trovan-dispatch-alert 1.8s ease-in-out infinite' } : undefined,
                  }}
                >
                  {badge}
                </Box>
              </Stack>
              <Box sx={{ mt: 0.9, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.6 }}>
                {[
                  'Lane visible',
                  kind === 'alert' ? 'Driver waiting' : 'Driver assigned',
                  kind === 'proof' ? 'Proof syncing' : kind === 'alert' ? 'Exception open' : 'ETA current',
                  'Dispatch updated',
                ].map((item, itemIndex) => (
                  <Box
                    key={item}
                    sx={{
                      px: 0.55,
                      py: 0.55,
                      borderRadius: 0.8,
                      bgcolor: itemIndex === 2 && kind === 'alert' ? alpha('#D95C45', 0.1) : alpha(card.accent, 0.06),
                      color: itemIndex === 2 && kind === 'alert' ? '#9F3427' : alpha(trovanColors.black[900], 0.82),
                      fontSize: 10,
                      fontWeight: 800,
                      textAlign: 'center',
                    }}
                  >
                    {item}
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
          <Box sx={{ p: 1, borderRadius: 1.1, bgcolor: alpha(card.accent, 0.06), border: `1px solid ${alpha(card.accent, 0.1)}` }}>
            <Typography sx={{ color: alpha(trovanColors.black[900], 0.58), fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
              Dispatch activity
            </Typography>
            <Stack spacing={0.55} sx={{ mt: 0.75 }}>
              {[
                'Anna Quinn checked in on Route lane A',
                'Delay exception opened on Route lane B',
                'Stop 7 completed on Route lane C',
              ].map((item, index) => (
                <Box
                  key={item}
                  sx={{
                    px: 0.8,
                    py: 0.7,
                    borderRadius: 0.8,
                    bgcolor: '#FFFFFF',
                    color: trovanColors.black[950],
                    fontSize: 11,
                    fontWeight: 700,
                    border: `1px solid ${alpha(card.accent, 0.08)}`,
                    '@media (prefers-reduced-motion: no-preference)': {
                      animation: 'trovan-dispatch-log 6s ease-in-out infinite',
                      animationDelay: `${index * 2}s`,
                    },
                  }}
                >
                  {item}
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.4,
        bgcolor: alpha('#FFFFFF', 0.88),
        border: `1px solid ${alpha(card.accent, 0.14)}`,
        '@keyframes trovan-proof-pan': {
          '0%, 22%': { transform: 'translateY(0)' },
          '33%, 55%': { transform: 'translateY(-64px)' },
          '66%, 88%': { transform: 'translateY(-128px)' },
          '100%': { transform: 'translateY(0)' },
        },
        '@keyframes trovan-proof-row': {
          '0%, 22%': { borderColor: alpha(card.accent, 0.24), boxShadow: `0 0 0 4px ${alpha(card.accent, 0.08)}` },
          '33%, 100%': { borderColor: alpha(card.accent, 0.1), boxShadow: 'none' },
        },
        '@keyframes trovan-proof-dot': {
          '0%, 22%': { transform: 'scale(1)', opacity: 1 },
          '33%, 100%': { transform: 'scale(0.82)', opacity: 0.45 },
        },
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 1, alignItems: 'start' }}>
        <Stack spacing={0} sx={{ pt: 0.2 }}>
          {[0, 1, 2].map((index) => (
            <Box key={index} sx={{ width: 22, display: 'grid', justifyItems: 'center' }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  bgcolor: card.accent,
                  '@media (prefers-reduced-motion: no-preference)': {
                    animation: 'trovan-proof-dot 6s ease-in-out infinite',
                    animationDelay: `${index * 2}s`,
                  },
                }}
              />
              {index < 2 ? <Box sx={{ width: 2, minHeight: 52, bgcolor: alpha(card.accent, 0.22) }} /> : null}
            </Box>
          ))}
        </Stack>
        <Box sx={{ overflow: 'hidden', height: 188 }}>
          <Stack
            spacing={1}
            sx={{
              '@media (prefers-reduced-motion: no-preference)': {
                animation: 'trovan-proof-pan 6s ease-in-out infinite',
              },
            }}
          >
            {[
              ['Stop completed', '11:24 AM'],
              ['Photo proof attached', '1 image + note'],
              ['Route record updated', 'Proof visible to ops'],
            ].map(([label, meta], index) => (
              <Box
                key={label}
                sx={{
                  p: 1,
                  borderRadius: 1.1,
                  bgcolor: '#FFFFFF',
                  border: `1px solid ${alpha(card.accent, 0.1)}`,
                  minHeight: 56,
                  '@media (prefers-reduced-motion: no-preference)': {
                    animation: 'trovan-proof-row 6s ease-in-out infinite',
                    animationDelay: `${index * 2}s`,
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ color: trovanColors.black[950], fontWeight: 800 }}>{label}</Typography>
                  <Typography sx={{ color: alpha(trovanColors.black[900], 0.72), fontSize: 12, fontWeight: 800 }}>{meta}</Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Box sx={{ mt: 0.4, p: 1, borderRadius: 1.1, bgcolor: alpha(card.accent, 0.08), border: `1px solid ${alpha(card.accent, 0.12)}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
          <Box>
            <Typography sx={{ color: alpha(trovanColors.black[900], 0.58), fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
              Audit trail
            </Typography>
            <Typography sx={{ color: trovanColors.black[950], fontWeight: 800 }}>Driver note, ETA snapshot, and proof event remain on the route.</Typography>
          </Box>
          <Box sx={{ px: 0.8, py: 0.4, borderRadius: 999, bgcolor: '#FFFFFF', color: '#166534', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
            Route-linked
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

function HomepageProofStory() {
  return (
    <Box sx={{ bgcolor: trovanColors.stone[0], color: trovanColors.black[950], py: { xs: 7, md: 9 } }}>
      <Box sx={{ width: sectionWidth, mx: 'auto' }}>
        <SectionHeader
          kicker="Route day clarity"
          title="Route days run better when every team sees the same route-day picture."
          body="Trovan sells one operating promise: plan the route, run the day, and prove every stop without rebuilding the truth from spreadsheets, text threads, and end-of-day guesses."
        />
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          {homepageProofCards.map((card, index) => (
            <Box
              key={card.title}
              data-motion="scroll-reveal"
              sx={{
                minHeight: 260,
                p: { xs: 2.1, md: 2.4 },
                borderRadius: 1.6,
                bgcolor: '#FFFFFF',
                background: card.surface,
                border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`,
                boxShadow: `0 18px 48px ${card.glow}`,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '0.92fr 1.08fr' },
                gap: 2.2,
                alignItems: 'center',
                transition: 'transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
                '@media (prefers-reduced-motion: no-preference)': {
                  animation: 'trovan-proof-rise 640ms ease both',
                  animationDelay: `${index * 70}ms`,
                },
                '@keyframes trovan-proof-rise': {
                  from: { opacity: 0.72, transform: 'translateY(14px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
                '@keyframes trovan-proof-pulse': {
                  '0%, 100%': { transform: 'scaleX(0.72)', opacity: 0.72 },
                  '50%': { transform: 'scaleX(1)', opacity: 1 },
                },
                '@keyframes trovan-proof-float': {
                  '0%, 100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-4px)' },
                },
                '&:hover': {
                  transform: 'translateY(-5px)',
                  borderColor: alpha(card.accent, 0.42),
                  boxShadow: `0 26px 56px ${card.glow}`,
                },
              }}
            >
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ color: trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
                    0{index + 1}
                  </Typography>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.55,
                      borderRadius: 999,
                      bgcolor: alpha(card.accent, 0.12),
                      color: card.accent,
                      fontSize: 11,
                      fontWeight: 900,
                      border: `1px solid ${alpha(card.accent, 0.18)}`,
                      '@media (prefers-reduced-motion: no-preference)': {
                        animation: 'trovan-proof-float 2.8s ease-in-out infinite',
                        animationDelay: `${index * 160}ms`,
                      },
                    }}
                  >
                    {card.metric}
                  </Box>
                </Stack>
                <Typography variant="h4" component="h3" sx={{ mt: 1, fontWeight: 900, lineHeight: 1.08, fontSize: { xs: 30, md: 36 } }}>
                  {card.title}
                </Typography>
                <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68), lineHeight: 1.55, fontSize: { xs: 17, md: 18 } }}>
                  {card.body}
                </Typography>
              </Box>
              <HomepageProofVisual card={card} />
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            mt: { xs: 4, md: 5 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' },
            gap: 3,
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ p: { xs: 2.4, md: 3 }, borderRadius: 1.6, bgcolor: trovanColors.black[950], color: '#FFF8ED', position: 'relative', overflow: 'hidden' }}>
            <TopoShellBackground active tone="black" quiet />
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Kicker dark>Product story</Kicker>
              <Typography component="h2" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 36, md: 52 }, lineHeight: 1 }}>
                One workspace for the route day
              </Typography>
              <Typography sx={{ mt: 1.4, color: alpha('#FFF8ED', 0.72), fontSize: 18, lineHeight: 1.58 }}>
                Plans, route lanes, driver assignments, map context, and stop-level proof stay connected from draft to delivery.
              </Typography>
            </Box>
          </Box>
          <ScreenshotFrame
            src="/marketing/product-dashboard.png"
            alt="Trovan operations dashboard showing live routes, jobs waiting, route risk, and daily readiness"
            caption="Route-day dashboard"
          />
        </Box>
      </Box>
    </Box>
  );
}

function HomePage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType, inputs?: AuditInputs, notes?: string) => void }) {
  return (
    <>
      <Box id="platform" sx={{ position: 'relative', overflow: 'hidden', bgcolor: trovanColors.black[950], color: '#FFF8ED' }}>
        <TopoShellBackground active tone="black" quiet />
        <Box sx={{ position: 'relative', zIndex: 1, width: sectionWidth, mx: 'auto', pt: { xs: 5, md: 7 }, pb: { xs: 6, md: 7 }, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.82fr 1.18fr' }, gap: { xs: 4, lg: 5.5 }, alignItems: 'center' }}>
          <Box>
            <Kicker dark>Route-day control</Kicker>
            <Typography variant="h1" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontWeight: 700, fontSize: { xs: 40, sm: 58, md: 72 }, lineHeight: 0.95, maxWidth: 720, color: '#FFF8ED' }}>
              Plan the route. Run the day. Prove every stop.
            </Typography>
            <Typography sx={{ mt: 2.4, color: alpha('#FFF8ED', 0.74), fontSize: { xs: 18, md: 21 }, lineHeight: 1.55, maxWidth: 660 }}>
              Trovan helps delivery and distribution teams turn messy route days into a live operating system - from planning and dispatch to driver execution, customer tracking, and proof of delivery.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4} sx={{ mt: 3.2 }}>
              <Button variant="contained" size="large" onClick={() => onOpenRequest('Book demo')}>
                {BOOK_DEMO_CTA}
              </Button>
              <Button
                variant="outlined"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => onOpenRequest('Route audit')}
              >
                {ROUTE_AUDIT_CTA}
              </Button>
            </Stack>
            <Typography sx={{ mt: 1.6, color: alpha('#FFF8ED', 0.66), fontSize: 15.5, lineHeight: 1.45, maxWidth: 620 }}>
              Send us one real route day and we will show wasted miles, late-risk stops, and dispatch bottlenecks.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4} sx={{ display: { xs: 'none', sm: 'flex' }, mt: 4, maxWidth: 720 }}>
              {[
                ['Plan routes', 'Route density, capacity, and review risk before dispatch.'],
                ['Dispatch live', 'Driver status, exceptions, and same-day changes in one board.'],
                ['Prove stops', 'Proof, notes, and route history tied to every delivery.'],
              ].map(([label, body]) => (
                <Box key={label} sx={{ flex: 1, borderTop: `1px solid ${alpha(trovanColors.copper[200], 0.26)}`, pt: 1.2 }}>
                  <Typography sx={{ color: '#FFF8ED', fontWeight: 900 }}>{label}</Typography>
                  <Typography sx={{ mt: 0.4, color: alpha('#FFF8ED', 0.58), fontSize: 14, lineHeight: 1.45 }}>{body}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          <HeroProductShowcase />
        </Box>
      </Box>

      <HomepageProofStory />

      <Box sx={{ bgcolor: trovanColors.stone[25], color: trovanColors.black[950], py: { xs: 7, md: 8 } }}>
        <Box sx={{ width: sectionWidth, mx: 'auto' }}>
          <SectionHeader
            kicker="Route day operating loop"
            title="One flow from plan to proof"
            body="Plan the work, dispatch the routes, guide drivers in the mobile app, keep customers updated, and review proof without rebuilding the day across separate tools."
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, 1fr)' }, gap: 1.4 }}>
            {workflowPages.map((item) => (
              <Box key={item.path} component={RouterLink} to={item.path} sx={{ minHeight: { xs: 166, md: 188 }, p: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`, color: trovanColors.black[950], textDecoration: 'none', display: 'grid', alignContent: 'space-between', transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease', '&:hover': { transform: 'translateY(-3px)', borderColor: alpha(trovanColors.copper[500], 0.5), boxShadow: '0 18px 40px rgba(31,26,23,0.08)' } }}>
                <Box>
                  <item.icon sx={{ color: trovanColors.copper[700] }} />
                  <Typography variant="h6" component="h3" sx={{ mt: 1.2, fontWeight: 900 }}>{item.navLabel}</Typography>
                  <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.66), fontSize: 14 }}>{item.outcome}</Typography>
                </Box>
                <Typography sx={{ mt: 1.4, color: trovanColors.copper[700], fontSize: 13, fontWeight: 900 }}>{workflowCtaLabel(item.key)}</Typography>
              </Box>
            ))}
          </Box>
          <ConnectedRouteProofSection />
          <ProductProofTabs />
        </Box>
      </Box>

      <SecurityStrip />
      <PricingSection onOpenRequest={(requestType) => onOpenRequest(requestType)} compact showCalculator={false} />
      <FinalCta onOpenRequest={(requestType) => onOpenRequest(requestType)} />
    </>
  );
}

function SecurityStrip() {
  return (
    <Box sx={{ bgcolor: trovanColors.black[950], color: '#FFF8ED', py: { xs: 5, md: 7 }, position: 'relative', overflow: 'hidden' }}>
      <TopoShellBackground active tone="black" quiet />
      <Box sx={{ position: 'relative', zIndex: 1, width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.75fr 1.25fr' }, gap: 3 }}>
        <Box>
          <Kicker dark>Security</Kicker>
          <Typography variant="h2" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 36, md: 52 }, lineHeight: 1 }}>
            Security practices for route operations
          </Typography>
          <Typography sx={{ mt: 1.2, color: alpha('#FFF8ED', 0.68), fontSize: 18 }}>
            Trovan keeps route-day access, operational records, and proof workflows controlled with role-based permissions, audit trails, data handling practices, and review-ready operational logs.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: '1fr 1fr' }, gap: 1.2 }}>
          {securityControls.map((item) => (
            <Box key={item.title} sx={{ p: { xs: 1.35, sm: 2 }, borderRadius: 1.4, border: `1px solid ${alpha('#FFF8ED', 0.12)}`, bgcolor: alpha('#FFF8ED', 0.045) }}>
              <Typography variant="h6" component="h3" sx={{ color: '#FFF8ED', fontWeight: 850, fontSize: { xs: 15, sm: 20 } }}>{item.title}</Typography>
              <Typography sx={{ mt: 0.7, color: alpha('#FFF8ED', 0.68), fontSize: { xs: 12.5, sm: 16 }, lineHeight: 1.45 }}>{item.body}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function ScenarioPreview() {
  return (
    <Box sx={{ bgcolor: trovanColors.stone[0], py: { xs: 7, md: 9 } }}>
      <Box sx={{ width: sectionWidth, mx: 'auto' }}>
        <SectionHeader
          kicker="Buyer clarity"
          title="What buyers usually want to confirm before rollout."
          body="What the team sees before the route leaves, what dispatch sees during the day, and what proof exists after completion."
        />
        <Box sx={{ p: 2.6, borderRadius: 1.6, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
          <Stack spacing={1.2}>
            {[
              'Planning stays tied to route lanes, map context, and publish-ready decisions.',
              'Dispatch can run the day from one board instead of bouncing between tools.',
              'Drivers, customers, and proof records stay attached to the same route history.',
            ].map((item) => (
              <Stack key={item} direction="row" spacing={1.1} alignItems="flex-start">
                <CheckRoundedIcon sx={{ color: trovanColors.semantic.success, fontSize: 18, mt: '2px' }} />
                <Typography sx={{ color: alpha(trovanColors.black[900], 0.72), lineHeight: 1.55 }}>{item}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function PlatformPage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  return (
    <>
      <HeroLayout
        kicker="Platform"
        title="Trovan platform for delivery and distribution route days"
        body="Plan work, dispatch routes, guide drivers, track customers, and preserve proof from one last-mile operating picture."
        image="/marketing/product-dashboard.png"
        imageAlt="Current Trovan operations dashboard with live map, route performance, exceptions, and savings metrics"
        primaryCta={BOOK_DEMO_CTA}
        secondaryCta={PRODUCT_WALKTHROUGH_CTA}
        onPrimary={() => onOpenRequest('Book demo')}
        secondaryHref="/demo"
        media={<PlatformOverviewFrame />}
      />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto' }}>
          <SectionHeader kicker="Workflow pages" title="Five product surfaces, one route day" body="Each public workflow page uses real UI imagery and a specific operating story instead of repeating feature cards." />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 1.5 }}>
            {workflowPages.map((item) => (
              <Box key={item.path} component={RouterLink} to={item.path} sx={{ p: 2, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`, color: trovanColors.black[950], textDecoration: 'none', display: 'grid', alignContent: 'start', minHeight: 190 }}>
                <item.icon sx={{ color: trovanColors.copper[600] }} />
                <Typography sx={{ mt: 1.5, fontWeight: 900 }}>{item.navLabel}</Typography>
                <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.68), fontSize: 14 }}>{item.outcome}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <FinalCta onOpenRequest={(requestType) => onOpenRequest(requestType)} />
    </>
  );
}

function HeroLayout({
  kicker,
  title,
  body,
  image,
  imageAlt,
  primaryCta,
  secondaryCta,
  onPrimary,
  secondaryHref,
  media,
}: {
  kicker: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  primaryCta: string;
  secondaryCta: string;
  onPrimary: () => void;
  secondaryHref: string;
  media?: ReactNode;
}) {
  return (
    <Box sx={{ bgcolor: trovanColors.black[950], color: '#FFF8ED', position: 'relative', overflow: 'hidden', py: { xs: 6, md: 8 } }}>
      <TopoShellBackground active tone="black" quiet />
      <Box sx={{ position: 'relative', zIndex: 1, width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.88fr 1.12fr' }, gap: 4.5, alignItems: 'center' }}>
        <Box>
          <Kicker dark>{kicker}</Kicker>
          <Typography variant="h1" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontWeight: 700, fontSize: { xs: 42, sm: 56, md: 66 }, lineHeight: 0.96, color: '#FFF8ED' }}>
            {title}
          </Typography>
          <Typography sx={{ mt: 2.2, color: alpha('#FFF8ED', 0.72), fontSize: { xs: 18, md: 20 }, lineHeight: 1.55 }}>{body}</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4} sx={{ mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              onClick={onPrimary}
            >
              {primaryCta}
            </Button>
            <Button component={RouterLink} to={secondaryHref} variant="outlined" size="large" endIcon={<ArrowForwardRoundedIcon />}>{secondaryCta}</Button>
          </Stack>
        </Box>
        {media ?? <ScreenshotFrame src={image} alt={imageAlt} caption="Real Trovan UI" />}
      </Box>
    </Box>
  );
}

function WorkflowPageView({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  const location = useLocation();
  const workflow = getWorkflowByPath(normalizePathname(location.pathname)) ?? workflowPages[0];

  return (
    <>
      <HeroLayout
        kicker={workflow.eyebrow}
        title={workflow.heading}
        body={workflow.body}
        image={workflow.image}
        imageAlt={workflow.imageAlt}
        primaryCta={BOOK_DEMO_CTA}
        secondaryCta={PRODUCT_WALKTHROUGH_CTA}
        secondaryHref="/demo"
        onPrimary={() => onOpenRequest('Book demo')}
        media={workflow.key === 'drive' ? <MobileAppProofFrame src={workflow.image} alt={workflow.imageAlt} /> : workflow.key === 'dispatch' ? <DispatchWorkflowFrame /> : undefined}
      />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[0] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' }, gap: 4, alignItems: 'start' }}>
          <Box>
            <SectionHeader
              kicker="Operating problem"
              title={workflow.problem}
              body={workflow.outcome}
              titleSx={{ fontSize: { xs: 32, md: 44 }, lineHeight: { xs: 1.02, md: 1.04 }, maxWidth: 640 }}
            />
            <Button variant="contained" onClick={() => onOpenRequest('Book demo')}>Book demo</Button>
          </Box>
          <Box sx={{ display: 'grid', gap: 1.4 }}>
            {workflow.capabilities.map((capability, index) => (
              <Box key={capability} sx={{ p: 2, borderRadius: 1.4, border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`, bgcolor: index === 0 ? alpha(trovanColors.copper[50], 0.76) : '#FFFFFF' }}>
                <Typography sx={{ color: trovanColors.copper[700], fontWeight: 900 }}>0{index + 1}</Typography>
                <Typography variant="h6" component="h3" sx={{ mt: 0.5, fontWeight: 900 }}>{capability}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <FinalCta onOpenRequest={(requestType) => onOpenRequest(requestType)} />
    </>
  );
}

const demoVideoChapters = [
  'Operations dashboard',
  'Route planning',
  'Dispatch board',
  'Route execution',
  'Live tracking',
  'Proof of delivery',
  'Customer tracking',
];

function DemoVideoSection() {
  return (
    <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[0], color: trovanColors.black[950] }}>
      <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.18fr 0.82fr' }, gap: 3, alignItems: 'stretch' }}>
        <Box sx={{ borderRadius: 1.6, bgcolor: '#151210', border: `1px solid ${alpha(trovanColors.black[900], 0.14)}`, boxShadow: '0 24px 70px rgba(31,26,23,0.14)', overflow: 'hidden' }}>
          <ProductFrameHeader detail="Product walkthrough video" />
          <Box
            component="video"
            controls
            playsInline
            preload="metadata"
            poster={PRODUCT_TOUR_POSTER_SRC}
            aria-label="Trovan full route day product walkthrough video"
            sx={{ display: 'block', width: '100%', aspectRatio: '16 / 10', bgcolor: '#0C0907' }}
          >
            <source src={PRODUCT_TOUR_VIDEO_SRC} type="video/mp4" />
            <track kind="captions" src={PRODUCT_TOUR_CAPTIONS_SRC} srcLang="en" label="English" />
          </Box>
        </Box>
        <Box sx={{ p: 2.4, borderRadius: 1.6, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
          <Typography sx={{ color: trovanColors.copper[700], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
            Walkthrough chapters
          </Typography>
          <Typography variant="h3" component="h2" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 34, md: 44 }, lineHeight: 1 }}>
            A complete route day, not a generic dashboard loop.
          </Typography>
          <List sx={{ mt: 1.6 }}>
            {demoVideoChapters.map((chapter, index) => (
              <ListItem key={chapter} disableGutters>
                <ListItemIcon sx={{ minWidth: 34 }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: alpha(trovanColors.copper[600], 0.13), color: trovanColors.copper[700], fontSize: 12, fontWeight: 900 }}>
                    {index + 1}
                  </Box>
                </ListItemIcon>
                <ListItemText primary={chapter} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </Box>
  );
}

function DemoPage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  const [activeKey, setActiveKey] = useState(workflowPages[0].key);
  const active = workflowPages.find((item) => item.key === activeKey) ?? workflowPages[0];

  return (
    <>
      <HeroLayout
        kicker="Product walkthrough"
        title="Watch a full route day in Trovan."
        body="See how a team imports stops, builds routes, dispatches drivers, tracks progress, handles changes, and captures proof."
        image="/marketing/product-routing.png"
        imageAlt="Current Trovan route planning workspace with unassigned jobs, route lanes, map context, and publish controls"
        primaryCta={BOOK_DEMO_CTA}
        secondaryCta="See pricing"
        secondaryHref="/pricing"
        onPrimary={() => onOpenRequest('Book demo')}
      />
      <DemoVideoSection />
      <RouteMotionVideo />
      <QuickProductDemo />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto' }}>
          <Box role="tablist" aria-label="Demo product tour" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {workflowPages.map((item) => (
              <Button
                key={item.key}
                role="tab"
                aria-selected={activeKey === item.key}
                variant={activeKey === item.key ? 'contained' : 'outlined'}
                onClick={() => setActiveKey(item.key)}
                sx={{
                  color: activeKey === item.key ? '#FFFFFF' : '#17110D',
                  bgcolor: activeKey === item.key ? undefined : '#FFFFFF',
                  borderColor: activeKey === item.key ? 'transparent' : alpha(trovanColors.black[900], 0.24),
                  '&:hover': {
                    borderColor: trovanColors.copper[500],
                    bgcolor: activeKey === item.key ? undefined : alpha(trovanColors.copper[50], 0.82),
                  },
                  '&:focus-visible': {
                    boxShadow: `0 0 0 3px ${alpha(trovanColors.copper[500], 0.24)}`,
                  },
                }}
              >
                {item.navLabel}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.8fr 1.2fr' }, gap: 3, alignItems: 'stretch' }}>
            <Box sx={{ p: 2.5, borderRadius: 1.6, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
              <Typography variant="h3" component="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 34, md: 44 }, lineHeight: 1 }}>
                {active.key === 'dispatch' ? 'Dispatch board walkthrough' : active.heading}
              </Typography>
              <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>{active.outcome}</Typography>
              <List sx={{ mt: 2 }}>
                {active.capabilities.map((item) => (
                  <ListItem key={item} disableGutters>
                    <ListItemIcon sx={{ minWidth: 34 }}><CheckRoundedIcon sx={{ color: trovanColors.semantic.success }} /></ListItemIcon>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
              <Button component={RouterLink} to={active.path} variant="text" endIcon={<ArrowForwardRoundedIcon />} sx={{ mt: 2, px: 0, color: trovanColors.copper[700] }}>
                {workflowCtaLabel(active.key)}
              </Button>
            </Box>
            {active.key === 'drive' ? (
              <MobileAppProofFrame src={active.image} alt={active.imageAlt} />
            ) : active.key === 'track' ? (
              <TrackingProofFrame />
            ) : (
              <ScreenshotFrame
                src={active.image}
                alt={active.imageAlt}
                caption={`${active.navLabel} tour`}
              />
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}

function TestimonialsPage() {
  return (
    <>
      <SimpleHero
        kicker="Scenario proof"
        title="Operator scenarios for route-day problems"
        body="Trovan is presented through delivery and distribution workflows buyers already recognize: planning handoff, dispatch visibility, customer status, and proof after delivery."
      />
      <ScenarioPreview />
    </>
  );
}

function SecurityPage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  return (
    <>
      <SimpleHero
        kicker="Security"
        title="Security and control for route operations."
        body="Trovan is built to help delivery teams manage operational data, driver access, customer delivery information, and proof records with clear controls."
      />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto' }}>
          <SectionHeader
            kicker="Verified posture"
            title="Plain security controls for route operations"
            body="This page intentionally avoids unsupported formal audit, healthcare, uptime, data residency, encryption, or SSO/SAML claims unless those details are confirmed in a customer agreement or security review."
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
            {securityControls.map((item) => (
              <Box key={item.title} sx={{ p: 2.2, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
                <Typography variant="h6" component="h3" sx={{ fontWeight: 900 }}>{item.title}</Typography>
                <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.68) }}>{item.body}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mt: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.88fr 1.12fr' }, gap: 2 }}>
            <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
              <Typography variant="h5" component="h3" sx={{ fontWeight: 900 }}>Controls described plainly</Typography>
              <List>
                {securityControlCopy.map((item) => (
                  <ListItem key={item} disableGutters alignItems="flex-start">
                    <ListItemIcon sx={{ minWidth: 34, pt: 0.35 }}><CheckRoundedIcon sx={{ color: trovanColors.semantic.success }} /></ListItemIcon>
                    <ListItemText primary={item} />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Box sx={{ p: 2.5, borderRadius: 1.5, bgcolor: trovanColors.black[950], color: '#FFF8ED', border: `1px solid ${alpha(trovanColors.copper[200], 0.16)}` }}>
              <Typography sx={{ color: trovanColors.copper[200], fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0 }}>
                Need a security review?
              </Typography>
              <Typography variant="h3" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 34, md: 46 }, lineHeight: 1 }}>
                Send your vendor questionnaire and we will route it to the right person.
              </Typography>
              <Typography sx={{ mt: 1.3, color: alpha('#FFF8ED', 0.68), lineHeight: 1.55 }}>
                Use this path for RBAC questions, audit logs, DPA requests, subprocessors, retention, mobile access controls, webhook handling, and production environment expectations.
              </Typography>
              <Button variant="contained" onClick={() => onOpenRequest('Security review')} sx={{ mt: 2.4 }}>Request security review</Button>
            </Box>
          </Box>
          <Box sx={{ mt: 2, p: 2.5, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
            <Typography variant="h5" component="h3" sx={{ fontWeight: 900 }}>Security review topics</Typography>
            <List>
              {[
                'Role-based access control',
                'Audit logs and route-event history',
                'Secure authentication posture',
                'Driver mobile access and session boundaries',
                'Customer tracking privacy and public-link exposure',
                'Data ownership, retention, deletion, DPA, and subprocessors',
                'Incident response contact and support escalation',
              ].map((item) => (
                <ListItem key={item} disableGutters>
                  <ListItemIcon sx={{ minWidth: 34 }}><CheckRoundedIcon sx={{ color: trovanColors.semantic.success }} /></ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      </Box>
    </>
  );
}

function SimpleHero({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <Box sx={{ bgcolor: trovanColors.black[950], color: '#FFF8ED', position: 'relative', overflow: 'hidden', py: { xs: 6, md: 8 } }}>
      <TopoShellBackground active tone="black" quiet />
      <Box sx={{ position: 'relative', zIndex: 1, width: 'min(920px, calc(100% - 32px))', mx: 'auto', textAlign: 'center' }}>
        <Kicker dark>{kicker}</Kicker>
        <Typography variant="h1" sx={{ mt: 1, fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 42, md: 66 }, lineHeight: 0.96, color: '#FFF8ED' }}>{title}</Typography>
        <Typography sx={{ mt: 2, color: alpha('#FFF8ED', 0.72), fontSize: { xs: 18, md: 20 }, lineHeight: 1.55 }}>{body}</Typography>
      </Box>
    </Box>
  );
}

function ResourcesPage() {
  return (
    <>
      <SimpleHero kicker="Resources" title="Resources for route audit and rollout planning" body="A real resource hub with internal pages and guides, not dead PDF links." />
      <CardGrid items={resourceCards} />
    </>
  );
}

function DownloadsPage() {
  return (
    <>
      <SimpleHero kicker="Downloads" title="Downloads and public resources" body="Use web resources first: route audit checklist, implementation readiness, policy center, and workflow pages." />
      <CardGrid items={downloadCards} />
    </>
  );
}

function CardGrid({ items }: { items: Array<{ icon: ElementType; title: string; body: string; href?: string }> }) {
  return (
    <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
      <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        {items.map((item) => (
          <Box key={item.title} component={item.href ? RouterLink : 'div'} to={item.href || undefined} sx={{ p: 2.4, borderRadius: 1.6, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}`, color: trovanColors.black[950], textDecoration: 'none' }}>
            <item.icon sx={{ color: trovanColors.copper[700] }} />
            <Typography variant="h5" component="h2" sx={{ mt: 1.2, fontWeight: 900 }}>{item.title}</Typography>
            <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68) }}>{item.body}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SupportPage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  return (
    <>
      <SimpleHero kicker="Support" title="Support for access, rollout, and route operations" body="Get help without a fake ticket system. Route your question to access support, implementation, sales, or security review." />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          {supportTopics.map((topic) => (
            <Box key={topic.title} sx={{ p: 2.4, borderRadius: 1.6, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
              <topic.icon sx={{ color: trovanColors.copper[700] }} />
              <Typography variant="h5" component="h2" sx={{ mt: 1.2, fontWeight: 900 }}>{topic.title}</Typography>
              <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68) }}>{topic.body}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ width: sectionWidth, mx: 'auto', mt: 3, textAlign: 'center' }}>
          <Button variant="contained" onClick={() => onOpenRequest('Support')}>Request access/support</Button>
        </Box>
      </Box>
    </>
  );
}

function CompanyPage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  return (
    <>
      <SimpleHero kicker="About Trovan" title="Built for the route day operators actually run" body="Trovan is a founder-led route planning and dispatch product for delivery teams that need one place to plan the day, run the day, and prove every stop." />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[0] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.85fr 1.15fr' }, gap: 4 }}>
          <Box>
            <Typography variant="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 38, md: 54 }, lineHeight: 1 }}>Why Trovan exists</Typography>
            <Typography sx={{ mt: 1.5, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
              Delivery teams should not need spreadsheets, text threads, paper notes, and end-of-day guesswork to understand what happened on the road. Trovan starts with a route audit because operators should see real route-day friction before committing to a platform rollout.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ mt: 3 }}>
              <Button variant="contained" onClick={() => onOpenRequest('Book demo')}>{BOOK_DEMO_CTA}</Button>
              <Button variant="outlined" onClick={() => onOpenRequest('Route audit')}>{ROUTE_AUDIT_CTA}</Button>
            </Stack>
          </Box>
          <Box sx={{ display: 'grid', gap: 1.3 }}>
            {missionGoals.map((item) => (
              <Box key={item.title} sx={{ p: 2, borderRadius: 1.4, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
                <Typography variant="h6" component="h3" sx={{ fontWeight: 900 }}>{item.title}</Typography>
                <Typography sx={{ mt: 0.7, color: alpha(trovanColors.black[900], 0.68) }}>{item.body}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </>
  );
}

function MissionPage() {
  return (
    <>
      <SimpleHero kicker="Mission" title="Trovan exists to make route days easier to run and easier to prove." body="Delivery teams should not need spreadsheets, text threads, paper notes, and end-of-day guesswork to understand what happened on the road." />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: sectionWidth, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {missionGoals.map((goal) => (
            <Box key={goal.title} sx={{ p: 2, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 900 }}>{goal.title}</Typography>
              <Typography sx={{ mt: 0.8, color: alpha(trovanColors.black[900], 0.68) }}>{goal.body}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}

function CareersPage({ onOpenRequest }: { onOpenRequest: (requestType: RequestType) => void }) {
  return (
    <>
      <SimpleHero kicker="Careers" title="Careers at Trovan" body={careersPublicCopy.heroBody} />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: 'min(850px, calc(100% - 32px))', mx: 'auto', textAlign: 'center' }}>
          <Typography variant="h3" component="h2" sx={{ fontFamily: trovanTypography.brandFontFamily, fontSize: { xs: 34, md: 46 }, lineHeight: 1 }}>
            {careersPublicCopy.sectionTitle}
          </Typography>
          <Typography sx={{ mt: 1.4, color: alpha(trovanColors.black[900], 0.68), fontSize: 18 }}>
            {careersPublicCopy.sectionBody}
          </Typography>
          <Button variant="contained" onClick={() => onOpenRequest('Careers')} sx={{ mt: 3 }}>{careersPublicCopy.callToAction}</Button>
        </Box>
      </Box>
    </>
  );
}

function LegalPage({ kind, onCookiePreferences }: { kind: keyof typeof legalPages; onCookiePreferences: () => void }) {
  const page = legalPages[kind];
  return (
    <>
      <SimpleHero kicker="Legal" title={page.heading} body={page.body} />
      <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: trovanColors.stone[25] }}>
        <Box sx={{ width: 'min(920px, calc(100% - 32px))', mx: 'auto', display: 'grid', gap: 1.5 }}>
          {page.sections.map(([title, body]) => (
            <Box key={title} sx={{ p: 2.4, borderRadius: 1.5, bgcolor: '#FFFFFF', border: `1px solid ${alpha(trovanColors.black[900], 0.1)}` }}>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 900 }}>{title}</Typography>
              <Typography sx={{ mt: 1, color: alpha(trovanColors.black[900], 0.68) }}>{body}</Typography>
            </Box>
          ))}
          {kind === 'cookies' ? (
            <Button variant="contained" startIcon={<CookieRoundedIcon />} onClick={onCookiePreferences} sx={{ justifySelf: 'start', mt: 1 }}>
              Cookie preferences
            </Button>
          ) : null}
        </Box>
      </Box>
    </>
  );
}

function renderPage({
  pathname,
  onOpenRequest,
  onCookiePreferences,
}: {
  pathname: string;
  onOpenRequest: (requestType: RequestType, inputs?: AuditInputs, notes?: string) => void;
  onCookiePreferences: () => void;
}) {
  if (pathname === '/') return <HomePage onOpenRequest={onOpenRequest} />;
  if (pathname === '/platform') return <PlatformPage onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (getWorkflowByPath(pathname)) return <WorkflowPageView onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (pathname === '/demo') return <DemoPage onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (pathname === '/pricing') return <><PricingSection onOpenRequest={(requestType) => onOpenRequest(requestType)} titleComponent="h1" /><FinalCta onOpenRequest={(requestType) => onOpenRequest(requestType)} title="Talk through the right package" /></>;
  if (pathname === '/testimonials') return <TestimonialsPage />;
  if (pathname === '/security') return <SecurityPage onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (pathname === '/resources') return <ResourcesPage />;
  if (pathname === '/resources/downloads') return <DownloadsPage />;
  if (pathname === '/support') return <SupportPage onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (pathname === '/company') return <CompanyPage onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (pathname === '/mission') return <MissionPage />;
  if (pathname === '/careers') return <CareersPage onOpenRequest={(requestType) => onOpenRequest(requestType)} />;
  if (pathname === '/legal/privacy') return <LegalPage kind="privacy" onCookiePreferences={onCookiePreferences} />;
  if (pathname === '/legal/terms') return <LegalPage kind="terms" onCookiePreferences={onCookiePreferences} />;
  if (pathname === '/legal/cookies') return <LegalPage kind="cookies" onCookiePreferences={onCookiePreferences} />;
  if (pathname === '/legal/exercise-rights') return <LegalPage kind="rights" onCookiePreferences={onCookiePreferences} />;
  return <HomePage onOpenRequest={onOpenRequest} />;
}

export default function PublicSite() {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const [requestOpen, setRequestOpen] = useState(false);
  const [cookiePreferencesOpen, setCookiePreferencesOpen] = useState(false);
  const [requestDefaults, setRequestDefaults] = useState<RequestModalDefaults>({
    requestType: 'Route audit',
    fleetSize: '16–35',
  });

  useEffect(() => {
    const seo = getPageSeo(pathname);
    document.title = seo.title;
    updatePublicSeoMetadata(pathname, seo.title, seo.description);
    window.scrollTo(0, 0);
  }, [pathname]);

  const openRequest = (requestType: RequestType, inputs?: AuditInputs, notes?: string) => {
    setRequestDefaults({
      requestType,
      fleetSize: inputs?.fleetSize ?? '16–35',
      notes: notes ?? (inputs ? buildAuditNotes(inputs) : ''),
    });
    setRequestOpen(true);
  };

  return (
    <MarketingShell
      onOpenRequest={openRequest}
      onCookiePreferences={() => setCookiePreferencesOpen(true)}
    >
      {renderPage({
        pathname,
        onOpenRequest: openRequest,
        onCookiePreferences: () => setCookiePreferencesOpen(true),
      })}
      <RequestModal open={requestOpen} defaults={requestDefaults} onClose={() => setRequestOpen(false)} />
      <CookiePreferencesModal open={cookiePreferencesOpen} onClose={() => setCookiePreferencesOpen(false)} />
    </MarketingShell>
  );
}
