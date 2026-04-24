import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  ApartmentOutlined as ApartmentOutlinedIcon,
  CreditCardOutlined as CreditCardOutlinedIcon,
  GroupsOutlined as GroupsOutlinedIcon,
  HubOutlined as HubOutlinedIcon,
  PaletteOutlined as PaletteOutlinedIcon,
  ShieldOutlined as ShieldOutlinedIcon,
  TuneOutlined as TuneOutlinedIcon,
  VpnKeyOutlined as VpnKeyOutlinedIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PageHeader } from '../components/PageHeader';
import { StatusPill, type StatusPillTone } from '../components/StatusPill';
import { SurfacePanel } from '../components/SurfacePanel';
import {
  useAuthConfigQuery,
  useAuthSessionsQuery,
  useRevokeAuthSessionMutation,
} from '../services/api.session';
import { useAuditOverviewQuery } from '../services/auditApi';
import { useDriversQuery, useVehiclesQuery } from '../services/fleetApi';
import {
  useCreateOrganizationInvitationMutation,
  useCreateOrganizationMutation,
  useCurrentOrganizationQuery,
  useOrganizationInvitationsQuery,
  useOrganizationMembersQuery,
  useOrganizationsQuery,
  useRevokeOrganizationInvitationMutation,
  useUpdateCurrentOrganizationSettingsMutation,
} from '../services/organizationsApi';
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useCreateWebhookMutation,
  usePlatformOverviewQuery,
  useReplayWebhookDeliveryMutation,
  useRevokeApiKeyMutation,
  useRotateWebhookSecretMutation,
  useWebhookDeliveriesQuery,
  useWebhooksQuery,
  useUpdateWebhookMutation,
} from '../services/platformApi';
import { useBillingOverviewQuery } from '../services/subscriptionsApi';
import { useTrackingReadinessQuery } from '../services/trackingApi';
import { useNotificationsOverviewQuery } from '../services/notificationsApi';
import { getErrorMessage, type TrackingReadiness } from '../services/api.types';
import { trovanColors } from '../theme/designTokens';

const roles = ['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER'];
const webhookEventOptions = [
  'job.created',
  'job.updated',
  'route.published',
  'route-run.started',
  'route-run.completed',
  'stop.arrived',
  'stop.serviced',
  'stop.failed',
  'proof.captured',
  'exception.opened',
  'exception.resolved',
];
const dividerItemSx = { borderBottom: '1px solid', borderColor: 'divider' } as const;

type SettingsSectionId =
  | 'overview'
  | 'identity'
  | 'brand'
  | 'team'
  | 'security'
  | 'billing'
  | 'platform'
  | 'operations';

type SettingsSectionMeta = {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: SvgIconComponent;
};

const settingsSections: SettingsSectionMeta[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Workspace status, organization context, and launch readiness.',
    icon: ApartmentOutlinedIcon,
  },
  {
    id: 'identity',
    label: 'Identity',
    description: 'WorkOS wiring, session inventory, and access posture.',
    icon: VpnKeyOutlinedIcon,
  },
  {
    id: 'brand',
    label: 'Brand & Notifications',
    description: 'Branding, public tracking copy, channels, and retention.',
    icon: PaletteOutlinedIcon,
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Members, role assignments, and invitation management.',
    icon: GroupsOutlinedIcon,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Audit controls, redaction coverage, and recent activity.',
    icon: ShieldOutlinedIcon,
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Plan readiness, Stripe posture, and commercial status.',
    icon: CreditCardOutlinedIcon,
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'API keys, webhook endpoints, delivery replay, and comms.',
    icon: HubOutlinedIcon,
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Roles, tracking setup, and operational execution guidance.',
    icon: TuneOutlinedIcon,
  },
];

function SettingsSummaryCard({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string;
  note: string;
  tone?: StatusPillTone;
}) {
  return (
    <SurfacePanel variant="subtle" padding={1.45} sx={{ height: '100%' }}>
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Typography variant="body2" component="div" color="text.secondary">
            {label}
          </Typography>
          <StatusPill label={tone === 'default' ? 'stable' : tone} tone={tone} />
        </Stack>
        <Typography variant="h5" component="div">
          {value}
        </Typography>
        <Typography variant="body2" component="div" color="text.secondary">
          {note}
        </Typography>
      </Stack>
    </SurfacePanel>
  );
}

function SettingsSectionButton({
  section,
  active,
  onSelect,
}: {
  section: SettingsSectionMeta;
  active: boolean;
  onSelect: (id: SettingsSectionId) => void;
}) {
  const Icon = section.icon;

  return (
    <Button
      fullWidth
      onClick={() => onSelect(section.id)}
      startIcon={<Icon fontSize="small" />}
      sx={{
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.05,
        py: 0.95,
        borderRadius: 1.2,
        textTransform: 'none',
        border: '1px solid',
        borderColor: active
          ? alpha(trovanColors.copper[500], 0.3)
          : trovanColors.utility.border,
        bgcolor: active
          ? alpha(trovanColors.copper[500], 0.08)
          : '#FFFFFF',
        color: active ? trovanColors.copper[700] : trovanColors.stone[700],
        '&:hover': {
          bgcolor: active
            ? alpha(trovanColors.copper[500], 0.12)
            : trovanColors.utility.panelMuted,
          borderColor: active
            ? alpha(trovanColors.copper[500], 0.36)
            : trovanColors.utility.borderStrong,
        },
        '& .MuiButton-startIcon': {
          mt: 0.15,
          mr: 0,
        },
      }}
    >
      <Box sx={{ textAlign: 'left' }}>
        <Typography variant="body2" component="div" sx={{ fontWeight: 700, color: 'inherit' }}>
          {section.label}
        </Typography>
        <Typography
          variant="caption"
          component="div"
          sx={{
            mt: 0.35,
            color: active ? alpha(trovanColors.copper[700], 0.86) : 'text.secondary',
            whiteSpace: 'normal',
            lineHeight: 1.35,
          }}
        >
          {section.description}
        </Typography>
      </Box>
    </Button>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('overview');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1F1A17');
  const [accentColor, setAccentColor] = useState('#C87441');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [trackingHeadline, setTrackingHeadline] = useState('');
  const [trackingSubtitle, setTrackingSubtitle] = useState('');
  const [notificationEmailEnabled, setNotificationEmailEnabled] = useState(true);
  const [notificationSmsEnabled, setNotificationSmsEnabled] = useState(true);
  const [notificationReplyToEmail, setNotificationReplyToEmail] = useState('');
  const [defaultNotificationChannel, setDefaultNotificationChannel] = useState<
    'email' | 'sms' | 'both'
  >('both');
  const [auditRetentionDays, setAuditRetentionDays] = useState('365');
  const [operationalRetentionDays, setOperationalRetentionDays] = useState('365');
  const [workosOrganizationId, setWorkosOrganizationId] = useState('');
  const [workosConnectionId, setWorkosConnectionId] = useState('');
  const [domainVerificationStatus, setDomainVerificationStatus] = useState<
    'unverified' | 'pending' | 'verified'
  >('unverified');
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('VIEWER');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyScopes, setApiKeyScopes] = useState(
    'jobs:read,customers:read,drivers:read,vehicles:read,route-runs:read,exceptions:read',
  );
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState(
    'job.created,route-run.completed,proof.captured',
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastApiKeySecret, setLastApiKeySecret] = useState<string | null>(null);
  const [lastWebhookSecret, setLastWebhookSecret] = useState<string | null>(null);

  const authConfigQuery = useAuthConfigQuery();
  const authSessionsQuery = useAuthSessionsQuery();
  const currentOrganizationQuery = useCurrentOrganizationQuery();
  const organizationsQuery = useOrganizationsQuery();
  const organizationMembersQuery = useOrganizationMembersQuery();
  const organizationInvitationsQuery = useOrganizationInvitationsQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const trackingReadinessQuery = useTrackingReadinessQuery();
  const auditOverviewQuery = useAuditOverviewQuery();
  const billingOverviewQuery = useBillingOverviewQuery();
  const notificationsOverviewQuery = useNotificationsOverviewQuery();
  const platformOverviewQuery = usePlatformOverviewQuery();
  const apiKeysQuery = useApiKeysQuery();
  const webhooksQuery = useWebhooksQuery();
  const webhookDeliveriesQuery = useWebhookDeliveriesQuery();

  const createOrganizationMutation = useCreateOrganizationMutation();
  const updateSettingsMutation = useUpdateCurrentOrganizationSettingsMutation();
  const revokeSessionMutation = useRevokeAuthSessionMutation();
  const createInvitationMutation = useCreateOrganizationInvitationMutation();
  const revokeInvitationMutation = useRevokeOrganizationInvitationMutation();
  const createApiKeyMutation = useCreateApiKeyMutation();
  const revokeApiKeyMutation = useRevokeApiKeyMutation();
  const createWebhookMutation = useCreateWebhookMutation();
  const updateWebhookMutation = useUpdateWebhookMutation();
  const rotateWebhookSecretMutation = useRotateWebhookSecretMutation();
  const replayWebhookDeliveryMutation = useReplayWebhookDeliveryMutation();

  const currentOrganization = currentOrganizationQuery.data ?? null;
  const organizations = organizationsQuery.data ?? [];
  const members = organizationMembersQuery.data ?? [];
  const invitations = organizationInvitationsQuery.data ?? [];
  const sessions = authSessionsQuery.data ?? [];
  const driverCount = (driversQuery.data ?? []).length;
  const vehicleCount = (vehiclesQuery.data ?? []).length;
  const trackingReadiness: TrackingReadiness | null = trackingReadinessQuery.data ?? null;
  const auditOverview = auditOverviewQuery.data ?? null;
  const billingOverview = billingOverviewQuery.data ?? null;
  const notificationsOverview = notificationsOverviewQuery.data ?? null;
  const platformOverview = platformOverviewQuery.data ?? null;
  const apiKeys = apiKeysQuery.data ?? [];
  const webhooks = webhooksQuery.data ?? [];
  const webhookDeliveries = webhookDeliveriesQuery.data ?? [];
  const authConfig = authConfigQuery.data ?? null;
  const currentSection = settingsSections.find((section) => section.id === activeSection) ?? settingsSections[0];

  useEffect(() => {
    const settings = currentOrganization?.settings;
    const branding = settings?.branding;
    const notifications = settings?.notifications;
    const retention = settings?.retention;
    const identity = settings?.identity;
    if (!currentOrganization) {
      return;
    }
    setBrandName(branding?.brandName || currentOrganization.name || '');
    setPrimaryColor(branding?.primaryColor || '#1F1A17');
    setAccentColor(branding?.accentColor || '#C87441');
    setSupportEmail(branding?.supportEmail || '');
    setSupportPhone(branding?.supportPhone || '');
    setTrackingHeadline(branding?.trackingHeadline || 'Your delivery is in motion');
    setTrackingSubtitle(
      branding?.trackingSubtitle ||
        'Follow the route live, monitor stop progress, and review delivery proof once the run completes.',
    );
    setNotificationEmailEnabled(notifications?.emailEnabled ?? true);
    setNotificationSmsEnabled(notifications?.smsEnabled ?? true);
    setNotificationReplyToEmail(notifications?.replyToEmail || '');
    setDefaultNotificationChannel(notifications?.defaultChannel || 'both');
    setAuditRetentionDays(String(retention?.auditDays ?? 365));
    setOperationalRetentionDays(String(retention?.operationalDays ?? 365));
    setWorkosOrganizationId(identity?.workosOrganizationId || '');
    setWorkosConnectionId(identity?.workosConnectionId || '');
    setDomainVerificationStatus(identity?.domainVerificationStatus || 'unverified');
    setSsoEnforced(Boolean(identity?.ssoEnforced));
    setMfaEnforced(Boolean(identity?.mfaEnforced));
  }, [currentOrganization]);

  const sortedFailedDeliveries = useMemo(
    () => webhookDeliveries.filter((delivery) => delivery.status === 'FAILED').slice(0, 5),
    [webhookDeliveries],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Workspace',
        value: currentOrganization?.name || 'No organization',
        note: currentOrganization?.membership
          ? `${currentOrganization.membership.role} access • ${currentOrganization.serviceTimezone || 'UTC'}`
          : 'Create or select an organization to unlock full admin controls.',
        tone: currentOrganization ? 'accent' : 'warning',
      },
      {
        label: 'Identity',
        value: authConfig?.configured ? 'WorkOS ready' : 'Local dev mode',
        note: `${sessions.length} active sessions • ${authConfig?.localLoginAllowed ? 'local login allowed' : 'local login disabled'}`,
        tone: authConfig?.configured ? 'success' : 'warning',
      },
      {
        label: 'Operations',
        value: `${driverCount} drivers / ${vehicleCount} vehicles`,
        note: trackingReadiness
          ? `${trackingReadiness.summary.activeVehicles} active telemetry sources`
          : 'Tracking readiness unavailable',
        tone: trackingReadiness?.summary.activeVehicles ? 'success' : 'info',
      },
      {
        label: 'Platform',
        value: `${platformOverview?.apiKeysActive ?? 0} keys • ${platformOverview?.webhooksActive ?? 0} hooks`,
        note: billingOverview?.stripeConfigured
          ? 'Billing provider configured'
          : 'Stripe still needs live configuration',
        tone:
          platformOverview?.controls.signedWebhooksEnabled && billingOverview?.stripeConfigured
            ? 'success'
            : 'warning',
      },
    ] satisfies Array<{
      label: string;
      value: string;
      note: string;
      tone: StatusPillTone;
    }>,
    [
      authConfig,
      billingOverview?.stripeConfigured,
      currentOrganization,
      driverCount,
      platformOverview,
      sessions.length,
      trackingReadiness,
      vehicleCount,
    ],
  );

  const handleCreate = async () => {
    setError(null);
    setNotice(null);
    try {
      await createOrganizationMutation.mutateAsync({
        name,
        slug: slug || undefined,
        serviceTimezone: timezone || undefined,
      });
      setName('');
      setSlug('');
      setNotice('Organization created.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create organization.'));
    }
  };

  const handleSettingsSave = async () => {
    setError(null);
    setNotice(null);
    try {
      await updateSettingsMutation.mutateAsync({
        brandName,
        primaryColor,
        accentColor,
        supportEmail,
        supportPhone,
        trackingHeadline,
        trackingSubtitle,
        notificationEmailEnabled,
        notificationSmsEnabled,
        notificationReplyToEmail,
        defaultNotificationChannel,
        auditRetentionDays: Number(auditRetentionDays),
        operationalRetentionDays: Number(operationalRetentionDays),
        workosOrganizationId,
        workosConnectionId,
        domainVerificationStatus,
        ssoEnforced,
        mfaEnforced,
      });
      setNotice('Organization settings saved.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save organization settings.'));
    }
  };

  const handleInvite = async () => {
    setError(null);
    setNotice(null);
    try {
      await createInvitationMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteRole('VIEWER');
      setNotice('Invitation created.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create invitation.'));
    }
  };

  const handleCreateApiKey = async () => {
    setError(null);
    setNotice(null);
    try {
      const created = await createApiKeyMutation.mutateAsync({
        name: apiKeyName,
        scopes: apiKeyScopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean),
      });
      setApiKeyName('');
      setLastApiKeySecret(created.secret);
      setNotice('API key created. Copy the secret now.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create API key.'));
    }
  };

  const handleCreateWebhook = async () => {
    setError(null);
    setNotice(null);
    try {
      const created = await createWebhookMutation.mutateAsync({
        name: webhookName,
        url: webhookUrl,
        subscribedEvents: webhookEvents
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setWebhookName('');
      setWebhookUrl('');
      setLastWebhookSecret(created.signingSecret);
      setNotice('Webhook endpoint created. Copy the signing secret now.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to create webhook endpoint.'));
    }
  };

  const sectionContent = (() => {
    switch (activeSection) {
      case 'overview':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SurfacePanel variant="command" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Current organization
                </Typography>
                <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 1 }}>
                  {currentOrganization
                    ? `${currentOrganization.name} (${currentOrganization.slug})`
                    : 'No organization selected.'}
                </Typography>
                {currentOrganization?.membership ? (
                  <StatusPill
                    label={`${currentOrganization.membership.role} access`}
                    tone="accent"
                    sx={{ mt: 1.5 }}
                  />
                ) : null}
                <List disablePadding sx={{ mt: 1.5 }}>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Timezone"
                      secondary={currentOrganization?.serviceTimezone || 'UTC'}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Support contact"
                      secondary={supportEmail || 'Support contact not set'}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Tracking message"
                      secondary={trackingHeadline || 'Your delivery is in motion'}
                    />
                  </ListItem>
                </List>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} md={6}>
              <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Create organization
                </Typography>
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  <TextField
                    label="Organization name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <TextField label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
                  <TextField
                    label="Timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  />
                  <Button
                    variant="contained"
                    onClick={handleCreate}
                    disabled={createOrganizationMutation.isPending || !name.trim()}
                  >
                    Create organization
                  </Button>
                </Stack>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} md={7}>
              <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Operational readiness
                </Typography>
                <List disablePadding sx={{ mt: 1.5 }}>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Drivers"
                      secondary={`${driverCount} active driver records available for routing and dispatch`}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Vehicles"
                      secondary={`${vehicleCount} fleet records available for assignment and tracking`}
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Telemetry"
                      secondary={
                        trackingReadiness
                          ? `${trackingReadiness.summary.vehiclesTracked} vehicles reporting • ${trackingReadiness.summary.activeVehicles} active now`
                          : 'Telemetry readiness unavailable'
                      }
                    />
                  </ListItem>
                </List>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
                  <Button component={RouterLink} to="/drivers" variant="outlined">
                    Drivers
                  </Button>
                  <Button component={RouterLink} to="/vehicles" variant="outlined">
                    Vehicles
                  </Button>
                  <Button component={RouterLink} to="/tracking" variant="contained">
                    Open tracking
                  </Button>
                </Stack>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} md={5}>
              <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Organization footprint
                </Typography>
                <List disablePadding sx={{ mt: 1.5 }}>
                  {organizations.map((organization) => (
                    <ListItem key={organization.id} disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary={organization.name}
                        secondary={`${organization.slug} • ${organization.membership?.role || 'member'}`}
                      />
                    </ListItem>
                  ))}
                  {organizations.length === 0 ? (
                    <ListItem disableGutters>
                      <ListItemText
                        primary="No organizations yet"
                        secondary="Create the first workspace to unlock settings, team management, and API access."
                      />
                    </ListItem>
                  ) : null}
                </List>
              </SurfacePanel>
            </Grid>
          </Grid>
        );

      case 'identity':
        return (
          <Stack spacing={2}>
            <SurfacePanel variant="command">
              <Typography variant="h5" component="div">
                Identity and access
              </Typography>
              <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 1 }}>
                WorkOS is the preferred managed identity path for staging and production. Local admin login remains a development-only escape hatch when explicitly enabled.
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={4}>
                  <List disablePadding>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Preferred provider"
                        secondary={authConfig?.preferredProvider || 'unknown'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="WorkOS configured"
                        secondary={authConfig?.configured ? 'Yes' : 'No'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Local admin login"
                        secondary={authConfig?.localLoginAllowed ? 'Allowed' : 'Disabled'}
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText primary="Active sessions" secondary={`${sessions.length}`} />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="WorkOS organization ID"
                        value={workosOrganizationId}
                        onChange={(event) => setWorkosOrganizationId(event.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="WorkOS connection ID"
                        value={workosConnectionId}
                        onChange={(event) => setWorkosConnectionId(event.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        select
                        fullWidth
                        label="Domain verification"
                        value={domainVerificationStatus}
                        onChange={(event) =>
                          setDomainVerificationStatus(
                            event.target.value as 'unverified' | 'pending' | 'verified',
                          )
                        }
                      >
                        <MenuItem value="unverified">Unverified</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="verified">Verified</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={ssoEnforced}
                            onChange={(event) => setSsoEnforced(event.target.checked)}
                          />
                        }
                        label="Enforce SSO"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={mfaEnforced}
                            onChange={(event) => setMfaEnforced(event.target.checked)}
                          />
                        }
                        label="Enforce MFA"
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleSettingsSave}
                  disabled={updateSettingsMutation.isPending}
                >
                  Save identity settings
                </Button>
              </Stack>
            </SurfacePanel>

            <SurfacePanel variant="panel">
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                spacing={1}
              >
                <Typography variant="h5" component="div">
                  Sessions and devices
                </Typography>
                <StatusPill
                  label={sessions.length ? `${sessions.length} active` : 'No sessions'}
                  tone={sessions.length ? 'success' : 'warning'}
                />
              </Stack>
              <List disablePadding sx={{ mt: 1.5 }}>
                {sessions.map((session) => (
                  <ListItem
                    key={session.id}
                    disableGutters
                    sx={dividerItemSx}
                    secondaryAction={
                      !session.current ? (
                        <Button
                          size="small"
                          color="inherit"
                          onClick={async () => {
                            setError(null);
                            try {
                              await revokeSessionMutation.mutateAsync(session.id);
                              setNotice('Session revoked.');
                            } catch (err: unknown) {
                              setError(getErrorMessage(err, 'Failed to revoke session.'));
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      ) : undefined
                    }
                  >
                    <ListItemText
                      primary={`${session.authProvider}${session.current ? ' • current' : ''}`}
                      secondary={`${session.userAgent || 'Unknown device'} • ${session.ipAddress || 'Unknown IP'} • ${session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : 'Never seen'}`}
                    />
                  </ListItem>
                ))}
                {sessions.length === 0 ? (
                  <ListItem disableGutters>
                    <ListItemText
                      primary="No active sessions found"
                      secondary="Sign in through WorkOS or local admin to create session records."
                    />
                  </ListItem>
                ) : null}
              </List>
            </SurfacePanel>
          </Stack>
        );

      case 'brand':
        return (
          <Stack spacing={2}>
            <SurfacePanel variant="command">
              <Typography variant="h5" component="div">
                Brand and public tracking
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Brand name"
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Primary color"
                    value={primaryColor}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Accent color"
                    value={accentColor}
                    onChange={(event) => setAccentColor(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Support email"
                    value={supportEmail}
                    onChange={(event) => setSupportEmail(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Support phone"
                    value={supportPhone}
                    onChange={(event) => setSupportPhone(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tracking headline"
                    value={trackingHeadline}
                    onChange={(event) => setTrackingHeadline(event.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Tracking subtitle"
                    value={trackingSubtitle}
                    onChange={(event) => setTrackingSubtitle(event.target.value)}
                  />
                </Grid>
              </Grid>
            </SurfacePanel>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                  <Typography variant="h5" component="div">
                    Customer notifications
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationEmailEnabled}
                          onChange={(event) => setNotificationEmailEnabled(event.target.checked)}
                        />
                      }
                      label="Email notifications"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={notificationSmsEnabled}
                          onChange={(event) => setNotificationSmsEnabled(event.target.checked)}
                        />
                      }
                      label="SMS notifications"
                    />
                    <TextField
                      fullWidth
                      label="Reply-to email"
                      value={notificationReplyToEmail}
                      onChange={(event) => setNotificationReplyToEmail(event.target.value)}
                    />
                    <TextField
                      select
                      fullWidth
                      label="Default channel"
                      value={defaultNotificationChannel}
                      onChange={(event) =>
                        setDefaultNotificationChannel(
                          event.target.value as 'email' | 'sms' | 'both',
                        )
                      }
                    >
                      <MenuItem value="both">Both</MenuItem>
                      <MenuItem value="email">Email</MenuItem>
                      <MenuItem value="sms">SMS</MenuItem>
                    </TextField>
                  </Stack>
                </SurfacePanel>
              </Grid>

              <Grid item xs={12} md={6}>
                <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                  <Typography variant="h5" component="div">
                    Retention
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                    <TextField
                      fullWidth
                      label="Audit retention days"
                      type="number"
                      value={auditRetentionDays}
                      onChange={(event) => setAuditRetentionDays(event.target.value)}
                    />
                    <TextField
                      fullWidth
                      label="Operational retention days"
                      type="number"
                      value={operationalRetentionDays}
                      onChange={(event) => setOperationalRetentionDays(event.target.value)}
                    />
                    <Alert severity="info">
                      Retention settings apply to audit trails, operational records, and public tracking content.
                    </Alert>
                  </Stack>
                </SurfacePanel>
              </Grid>
            </Grid>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <Button
                variant="contained"
                onClick={handleSettingsSave}
                disabled={updateSettingsMutation.isPending}
              >
                Save settings
              </Button>
              <Button component={RouterLink} to="/driver" variant="outlined">
                Open driver workspace
              </Button>
            </Stack>
          </Stack>
        );

      case 'team':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <SurfacePanel variant="command" sx={{ height: '100%' }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography variant="h5" component="div">
                    Team members
                  </Typography>
                  <StatusPill
                    label={`${members.length} members`}
                    tone={members.length ? 'success' : 'warning'}
                  />
                </Stack>
                <List disablePadding sx={{ mt: 1.5 }}>
                  {members.map((member) => (
                    <ListItem key={member.id} disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary={`${member.user?.displayName || member.user?.email || member.userId} • ${member.role}`}
                        secondary={`${member.user?.email || 'Unknown email'} • ${member.user?.authProvider || 'unknown'}${member.isDefault ? ' • default workspace' : ''}`}
                      />
                    </ListItem>
                  ))}
                  {members.length === 0 ? (
                    <ListItem disableGutters>
                      <ListItemText
                        primary="No organization members yet"
                        secondary="Invite dispatchers, viewers, or drivers to this workspace."
                      />
                    </ListItem>
                  ) : null}
                </List>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} md={5}>
              <Stack spacing={2}>
                <SurfacePanel variant="panel">
                  <Typography variant="h5" component="div">
                    Invite teammate
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                    <TextField
                      label="Email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                    <TextField
                      select
                      label="Role"
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value)}
                    >
                      {roles.map((role) => (
                        <MenuItem key={role} value={role}>
                          {role}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={handleInvite}
                      disabled={!inviteEmail.trim() || createInvitationMutation.isPending}
                    >
                      Send invitation
                    </Button>
                  </Stack>
                </SurfacePanel>

                <SurfacePanel variant="panel">
                  <Typography variant="h5" component="div">
                    Pending invitations
                  </Typography>
                  <List disablePadding sx={{ mt: 1.5 }}>
                    {invitations.map((invitation) => (
                      <ListItem
                        key={invitation.id}
                        disableGutters
                        sx={dividerItemSx}
                        secondaryAction={
                          invitation.status === 'PENDING' ? (
                            <Button
                              size="small"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await revokeInvitationMutation.mutateAsync(invitation.id);
                                  setNotice('Invitation revoked.');
                                } catch (err: unknown) {
                                  setError(getErrorMessage(err, 'Failed to revoke invitation.'));
                                }
                              }}
                            >
                              Revoke
                            </Button>
                          ) : undefined
                        }
                      >
                        <ListItemText
                          primary={`${invitation.email} • ${invitation.role}`}
                          secondary={`${invitation.provider} • ${invitation.status}${invitation.lastError ? ` • ${invitation.lastError}` : ''}`}
                        />
                      </ListItem>
                    ))}
                    {invitations.length === 0 ? (
                      <ListItem disableGutters>
                        <ListItemText
                          primary="No invitations yet"
                          secondary="WorkOS invitations created here will appear with provider status and acceptance metadata."
                        />
                      </ListItem>
                    ) : null}
                  </List>
                </SurfacePanel>
              </Stack>
            </Grid>
          </Grid>
        );

      case 'security':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SurfacePanel variant="command" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Security posture
                </Typography>
                <List disablePadding sx={{ mt: 1.5 }}>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Auth mode"
                      secondary={auditOverview?.controls.authMode || 'Unknown'}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Request IDs"
                      secondary={
                        auditOverview?.controls.requestIdsEnabled
                          ? 'Enabled on all backend responses'
                          : 'Unavailable'
                      }
                    />
                  </ListItem>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Sensitive field redaction"
                      secondary={
                        auditOverview?.controls.sensitiveFieldRedaction
                          ? 'Passwords, tokens, emails, phones, and payment identifiers are redacted in request logs'
                          : 'Not configured'
                      }
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="Audit retention"
                      secondary={`${auditOverview?.controls.auditRetentionDays ?? 0} days`}
                    />
                  </ListItem>
                </List>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} md={6}>
              <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Recent audit activity
                </Typography>
                <List disablePadding sx={{ mt: 1.5 }}>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Entries last 24h"
                      secondary={`${auditOverview?.counts.last24hEntries ?? 0} persisted audit events`}
                    />
                  </ListItem>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="Entries last 7d"
                      secondary={`${auditOverview?.counts.last7dEntries ?? 0} persisted audit events`}
                    />
                  </ListItem>
                  {(auditOverview?.recentEntries ?? []).slice(0, 4).map((entry) => (
                    <ListItem key={entry.id} disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary={entry.action}
                        secondary={`${entry.entityType} • ${entry.actorId} • ${new Date(entry.createdAt).toLocaleString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </SurfacePanel>
            </Grid>
          </Grid>
        );

      case 'billing':
        return (
          <Stack spacing={2}>
            <SurfacePanel variant="command">
              <Typography variant="h5" component="div">
                Billing readiness
              </Typography>
              <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 1 }}>
                Billing exposes the truth first: plan catalog, current readiness, and whether Stripe webhooks are actually wired.
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={4}>
                  <List disablePadding>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Stripe configured"
                        secondary={billingOverview?.stripeConfigured ? 'Yes' : 'No'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Webhook ready"
                        secondary={billingOverview?.controls.webhookConfigured ? 'Yes' : 'No'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Invoice automation"
                        secondary={
                          billingOverview?.controls.invoiceAutomationReady ? 'Ready' : 'Blocked'
                        }
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Billing contact"
                        secondary={billingOverview?.billingContactEmail || 'Unavailable'}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Grid container spacing={1.5}>
                    {(billingOverview?.plans ?? []).map((plan) => (
                      <Grid item xs={12} md={4} key={plan.plan}>
                        <SurfacePanel variant="subtle" sx={{ height: '100%' }}>
                          <Typography variant="h6" component="div">
                            {plan.label}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="div"
                            color="text.secondary"
                            sx={{ mt: 0.75 }}
                          >
                            ${plan.monthlyPriceUsd}/month •{' '}
                            {plan.dispatcherSeats === 999
                              ? 'Unlimited'
                              : plan.dispatcherSeats}{' '}
                            dispatcher seats
                          </Typography>
                          <List dense disablePadding sx={{ mt: 1 }}>
                            {plan.features.slice(0, 4).map((feature) => (
                              <ListItem key={feature} disableGutters>
                                <ListItemText primary={feature} />
                              </ListItem>
                            ))}
                          </List>
                        </SurfacePanel>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
              {(billingOverview?.recommendations ?? []).length > 0 ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  {(billingOverview?.recommendations ?? []).join(' ')}
                </Alert>
              ) : null}
            </SurfacePanel>
          </Stack>
        );

      case 'platform':
        return (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <SurfacePanel variant="command" sx={{ height: '100%' }}>
                  <Typography variant="h5" component="div">
                    Customer communications
                  </Typography>
                  <List disablePadding sx={{ mt: 1.5 }}>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Email provider"
                        secondary={notificationsOverview?.emailProvider || 'disabled'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="SMS provider"
                        secondary={notificationsOverview?.smsProvider || 'disabled'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Sent last 24h"
                        secondary={`${notificationsOverview?.sentLast24Hours ?? 0} deliveries`}
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Failed last 24h"
                        secondary={`${notificationsOverview?.failedLast24Hours ?? 0} deliveries`}
                      />
                    </ListItem>
                  </List>
                  <Alert
                    severity={
                      notificationsOverview?.controls.emailReady ||
                      notificationsOverview?.controls.smsReady
                        ? 'success'
                        : 'warning'
                    }
                    sx={{ mt: 2 }}
                  >
                    {notificationsOverview?.controls.emailReady ||
                    notificationsOverview?.controls.smsReady
                      ? 'At least one outbound notification channel is configured.'
                      : 'Outbound email and SMS providers are still unconfigured, so customer comms will be logged but not delivered.'}
                  </Alert>
                </SurfacePanel>
              </Grid>

              <Grid item xs={12} md={6}>
                <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                  <Typography variant="h5" component="div">
                    External API and webhooks
                  </Typography>
                  <List disablePadding sx={{ mt: 1.5 }}>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Auth mode"
                        secondary={platformOverview?.authMode || 'unknown'}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Active API keys"
                        secondary={`${platformOverview?.apiKeysActive ?? 0}`}
                      />
                    </ListItem>
                    <ListItem disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary="Active webhook endpoints"
                        secondary={`${platformOverview?.webhooksActive ?? 0}`}
                      />
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemText
                        primary="Webhook deliveries last 24h"
                        secondary={`${platformOverview?.deliveriesLast24Hours ?? 0} delivered / ${platformOverview?.failuresLast24Hours ?? 0} failed`}
                      />
                    </ListItem>
                  </List>
                  <Alert
                    severity={platformOverview?.controls.signedWebhooksEnabled ? 'info' : 'warning'}
                    sx={{ mt: 2 }}
                  >
                    Signed outbound webhooks and scoped API-key authentication are active platform contracts, not placeholder copy.
                  </Alert>
                </SurfacePanel>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                  <Typography variant="h5" component="div">
                    API keys
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                    <TextField
                      label="Key name"
                      value={apiKeyName}
                      onChange={(event) => setApiKeyName(event.target.value)}
                    />
                    <TextField
                      label="Scopes (comma separated)"
                      value={apiKeyScopes}
                      onChange={(event) => setApiKeyScopes(event.target.value)}
                    />
                    <Button
                      variant="contained"
                      onClick={handleCreateApiKey}
                      disabled={!apiKeyName.trim() || createApiKeyMutation.isPending}
                    >
                      Create API key
                    </Button>
                  </Stack>
                  <List disablePadding sx={{ mt: 2 }}>
                    {apiKeys.map((apiKey) => (
                      <ListItem
                        key={apiKey.id}
                        disableGutters
                        sx={dividerItemSx}
                        secondaryAction={
                          !apiKey.revokedAt ? (
                            <Button
                              size="small"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await revokeApiKeyMutation.mutateAsync(apiKey.id);
                                  setNotice('API key revoked.');
                                } catch (err: unknown) {
                                  setError(getErrorMessage(err, 'Failed to revoke API key.'));
                                }
                              }}
                            >
                              Revoke
                            </Button>
                          ) : undefined
                        }
                      >
                        <ListItemText
                          primary={`${apiKey.name} • ${apiKey.prefix}`}
                          secondary={`${apiKey.scopes.join(', ') || 'No scopes'}${apiKey.revokedAt ? ' • revoked' : ''}`}
                        />
                      </ListItem>
                    ))}
                    {apiKeys.length === 0 ? (
                      <ListItem disableGutters>
                        <ListItemText
                          primary="No API keys yet"
                          secondary="Create scoped keys for ERP, warehouse, and customer integration flows."
                        />
                      </ListItem>
                    ) : null}
                  </List>
                </SurfacePanel>
              </Grid>

              <Grid item xs={12} md={7}>
                <SurfacePanel variant="panel">
                  <Typography variant="h5" component="div">
                    Webhook endpoints
                  </Typography>
                  <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                    <TextField
                      label="Webhook name"
                      value={webhookName}
                      onChange={(event) => setWebhookName(event.target.value)}
                    />
                    <TextField
                      label="Webhook URL"
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                    />
                    <TextField
                      label="Subscribed events"
                      value={webhookEvents}
                      onChange={(event) => setWebhookEvents(event.target.value)}
                      helperText={`Examples: ${webhookEventOptions.slice(0, 4).join(', ')}`}
                    />
                    <Button
                      variant="contained"
                      onClick={handleCreateWebhook}
                      disabled={
                        !webhookName.trim() ||
                        !webhookUrl.trim() ||
                        createWebhookMutation.isPending
                      }
                    >
                      Create webhook
                    </Button>
                  </Stack>
                  <List disablePadding sx={{ mt: 2 }}>
                    {webhooks.map((webhook) => (
                      <ListItem
                        key={webhook.id}
                        disableGutters
                        sx={dividerItemSx}
                        secondaryAction={
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              onClick={async () => {
                                setError(null);
                                try {
                                  const result = await rotateWebhookSecretMutation.mutateAsync(
                                    webhook.id,
                                  );
                                  setLastWebhookSecret(result.signingSecret);
                                  setNotice('Webhook signing secret rotated.');
                                } catch (err: unknown) {
                                  setError(
                                    getErrorMessage(err, 'Failed to rotate webhook secret.'),
                                  );
                                }
                              }}
                            >
                              Rotate
                            </Button>
                            <Button
                              size="small"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await updateWebhookMutation.mutateAsync({
                                    webhookId: webhook.id,
                                    payload: {
                                      status:
                                        webhook.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                                    },
                                  });
                                  setNotice(
                                    `Webhook ${webhook.status === 'ACTIVE' ? 'paused' : 'resumed'}.`,
                                  );
                                } catch (err: unknown) {
                                  setError(getErrorMessage(err, 'Failed to update webhook.'));
                                }
                              }}
                            >
                              {webhook.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                            </Button>
                          </Stack>
                        }
                      >
                        <ListItemText
                          primary={`${webhook.name} • ${webhook.status}`}
                          secondary={`${webhook.url} • ${webhook.subscribedEvents.join(', ') || '*'}${webhook.lastFailure ? ` • ${webhook.lastFailure}` : ''}`}
                        />
                      </ListItem>
                    ))}
                    {webhooks.length === 0 ? (
                      <ListItem disableGutters>
                        <ListItemText
                          primary="No webhook endpoints yet"
                          secondary="Create signed callbacks for partner updates and downstream status sync."
                        />
                      </ListItem>
                    ) : null}
                  </List>

                  <Typography variant="subtitle1" component="div" sx={{ mt: 2.5 }}>
                    Recent failed deliveries
                  </Typography>
                  <List disablePadding sx={{ mt: 1 }}>
                    {sortedFailedDeliveries.map((delivery) => (
                      <ListItem
                        key={delivery.id}
                        disableGutters
                        sx={dividerItemSx}
                        secondaryAction={
                          <Button
                            size="small"
                            onClick={async () => {
                              setError(null);
                              try {
                                await replayWebhookDeliveryMutation.mutateAsync(delivery.id);
                                setNotice('Webhook delivery replayed.');
                              } catch (err: unknown) {
                                setError(
                                  getErrorMessage(err, 'Failed to replay webhook delivery.'),
                                );
                              }
                            }}
                          >
                            Replay
                          </Button>
                        }
                      >
                        <ListItemText
                          primary={`${delivery.eventType} • ${delivery.status}`}
                          secondary={`${delivery.failureReason || 'Unknown failure'} • attempts ${delivery.attempts}`}
                        />
                      </ListItem>
                    ))}
                    {sortedFailedDeliveries.length === 0 ? (
                      <ListItem disableGutters>
                        <ListItemText
                          primary="No failed deliveries"
                          secondary="Recent webhook failures will show up here with replay controls."
                        />
                      </ListItem>
                    ) : null}
                  </List>
                </SurfacePanel>
              </Grid>
            </Grid>
          </Stack>
        );

      case 'operations':
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <SurfacePanel variant="command" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Roles
                </Typography>
                <List disablePadding sx={{ mt: 1.5 }}>
                  {roles.map((role) => (
                    <ListItem key={role} disableGutters sx={dividerItemSx}>
                      <ListItemText
                        primary={role}
                        secondary="Permission-enforced in backend routes and planner actions"
                      />
                    </ListItem>
                  ))}
                </List>
              </SurfacePanel>
            </Grid>

            <Grid item xs={12} md={6}>
              <SurfacePanel variant="panel" sx={{ height: '100%' }}>
                <Typography variant="h5" component="div">
                  Tracking setup
                </Typography>
                <List disablePadding sx={{ mt: 1.5 }}>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="1. Prepare drivers and vehicles"
                      secondary="Make sure every active driver has a vehicle assignment path before dispatch."
                    />
                  </ListItem>
                  <ListItem disableGutters sx={dividerItemSx}>
                    <ListItemText
                      primary="2. Send telemetry"
                      secondary="Post GPS pings to `/api/tracking/ingest` from mobile or device middleware using the assigned vehicle ID."
                    />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText
                      primary="3. Monitor execution"
                      secondary="Use Tracking for live signals and Dispatch for route-run status, stop progress, and exception handling."
                    />
                  </ListItem>
                </List>
              </SurfacePanel>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  })();

  return (
    <Stack spacing={2.25}>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        subtitle="Identity, notifications, platform access, retention, and operational readiness are managed through a sectioned control console."
        actions={
          <>
            <Button component={RouterLink} to="/tracking" variant="outlined">
              Open tracking
            </Button>
            <Button component={RouterLink} to="/driver" variant="contained">
              Driver workspace
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}
      {lastApiKeySecret ? (
        <Alert severity="warning">
          New API key secret: <strong>{lastApiKeySecret}</strong>
        </Alert>
      ) : null}
      {lastWebhookSecret ? (
        <Alert severity="warning">
          New webhook signing secret: <strong>{lastWebhookSecret}</strong>
        </Alert>
      ) : null}

      <Grid container spacing={1.5}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} xl={3} key={card.label}>
            <SettingsSummaryCard
              label={card.label}
              value={card.value}
              note={card.note}
              tone={card.tone}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={3}>
          <SurfacePanel
            variant="command"
            sx={{
              position: { lg: 'sticky' },
              top: { lg: 88 },
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2" component="div" sx={{ color: trovanColors.copper[600] }}>
                  Control console
                </Typography>
                <Typography variant="h5" component="div" sx={{ mt: 0.5 }}>
                  Workspace settings
                </Typography>
                <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 0.75 }}>
                  Use the left rail to switch between focused admin workspaces instead of scrolling one long document.
                </Typography>
              </Box>

              <Stack spacing={0.85}>
                {settingsSections.map((section) => (
                  <SettingsSectionButton
                    key={section.id}
                    section={section}
                    active={section.id === activeSection}
                    onSelect={setActiveSection}
                  />
                ))}
              </Stack>
            </Stack>
          </SurfacePanel>
        </Grid>

        <Grid item xs={12} lg={9}>
          <Stack spacing={2}>
            <SurfacePanel variant="panel" padding={1.75}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Typography variant="subtitle2" component="div" sx={{ color: trovanColors.copper[600] }}>
                    {currentSection.label}
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ mt: 0.35 }}>
                    {currentSection.label}
                  </Typography>
                  <Typography variant="body2" component="div" color="text.secondary" sx={{ mt: 0.75 }}>
                    {currentSection.description}
                  </Typography>
                </Box>
                <StatusPill
                  label={currentSection.label}
                  tone={activeSection === 'security' ? 'info' : activeSection === 'billing' ? 'accent' : 'default'}
                />
              </Stack>
            </SurfacePanel>

            {sectionContent}
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
