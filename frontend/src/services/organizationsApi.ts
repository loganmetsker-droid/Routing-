import { unwrapApiData, unwrapListItems } from '@shared/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api.session';
import { isPreview } from './api.preview';
import {
  isRecord,
  type OrganizationBrandingRecord,
  type OrganizationInvitationRecord,
  type OrganizationMemberRecord,
  type OrganizationRecord,
  type OrganizationSettingsRecord,
} from './api.types';
import { queryKeys } from './queryKeys';

const normalizeBranding = (value: unknown): OrganizationBrandingRecord => {
  const record = isRecord(value) ? value : {};
  return {
    brandName:
      typeof record.brandName === 'string' ? record.brandName : undefined,
    primaryColor:
      typeof record.primaryColor === 'string' ? record.primaryColor : undefined,
    accentColor:
      typeof record.accentColor === 'string' ? record.accentColor : undefined,
    supportEmail:
      typeof record.supportEmail === 'string' ? record.supportEmail : undefined,
    supportPhone:
      typeof record.supportPhone === 'string' ? record.supportPhone : undefined,
    trackingHeadline:
      typeof record.trackingHeadline === 'string'
        ? record.trackingHeadline
        : undefined,
    trackingSubtitle:
      typeof record.trackingSubtitle === 'string'
        ? record.trackingSubtitle
        : undefined,
  };
};

const normalizeOrganizationSettings = (
  value: unknown,
): OrganizationSettingsRecord => {
  const settings = isRecord(value) ? value : {};
  const notifications = isRecord(settings.notifications)
    ? settings.notifications
    : {};
  const retention = isRecord(settings.retention) ? settings.retention : {};
  const identity = isRecord(settings.identity) ? settings.identity : {};

  return {
    branding: normalizeBranding(settings.branding),
    notifications: {
      emailEnabled:
        typeof notifications.emailEnabled === 'boolean'
          ? notifications.emailEnabled
          : undefined,
      smsEnabled:
        typeof notifications.smsEnabled === 'boolean'
          ? notifications.smsEnabled
          : undefined,
      replyToEmail:
        typeof notifications.replyToEmail === 'string'
          ? notifications.replyToEmail
          : undefined,
      defaultChannel:
        notifications.defaultChannel === 'email' ||
        notifications.defaultChannel === 'sms' ||
        notifications.defaultChannel === 'both'
          ? notifications.defaultChannel
          : undefined,
      scheduledEnabled:
        typeof notifications.scheduledEnabled === 'boolean'
          ? notifications.scheduledEnabled
          : undefined,
      onTheWayEnabled:
        typeof notifications.onTheWayEnabled === 'boolean'
          ? notifications.onTheWayEnabled
          : undefined,
      onTheWayMinutesBefore:
        typeof notifications.onTheWayMinutesBefore === 'number'
          ? notifications.onTheWayMinutesBefore
          : undefined,
      onTheWayRequirePreviousCompletion:
        typeof notifications.onTheWayRequirePreviousCompletion === 'boolean'
          ? notifications.onTheWayRequirePreviousCompletion
          : undefined,
      completionEnabled:
        typeof notifications.completionEnabled === 'boolean'
          ? notifications.completionEnabled
          : undefined,
      failureEnabled:
        typeof notifications.failureEnabled === 'boolean'
          ? notifications.failureEnabled
          : undefined,
      completionVarianceThresholdMeters:
        typeof notifications.completionVarianceThresholdMeters === 'number'
          ? notifications.completionVarianceThresholdMeters
          : undefined,
    },
    retention: {
      auditDays:
        typeof retention.auditDays === 'number' ? retention.auditDays : undefined,
      operationalDays:
        typeof retention.operationalDays === 'number'
          ? retention.operationalDays
          : undefined,
    },
    identity: {
      workosOrganizationId:
        typeof identity.workosOrganizationId === 'string'
          ? identity.workosOrganizationId
          : undefined,
      workosConnectionId:
        typeof identity.workosConnectionId === 'string'
          ? identity.workosConnectionId
          : undefined,
      domainVerificationStatus:
        identity.domainVerificationStatus === 'verified' ||
        identity.domainVerificationStatus === 'pending' ||
        identity.domainVerificationStatus === 'unverified'
          ? identity.domainVerificationStatus
          : undefined,
      ssoEnforced:
        typeof identity.ssoEnforced === 'boolean'
          ? identity.ssoEnforced
          : undefined,
      mfaEnforced:
        typeof identity.mfaEnforced === 'boolean'
          ? identity.mfaEnforced
          : undefined,
    },
  };
};

const normalizeOrganization = (value: unknown): OrganizationRecord => {
  const record = isRecord(value) ? value : {};
  const membership = isRecord(record.membership) ? record.membership : {};
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : `organization-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof record.name === 'string' ? record.name : 'Unnamed Organization',
    slug: typeof record.slug === 'string' ? record.slug : 'unknown',
    serviceTimezone:
      typeof record.serviceTimezone === 'string'
        ? record.serviceTimezone
        : undefined,
    settings: normalizeOrganizationSettings(record.settings),
    membership:
      Object.keys(membership).length > 0
        ? {
            role:
              typeof membership.role === 'string' ? membership.role : undefined,
            roles: Array.isArray(membership.roles)
              ? membership.roles.filter(
                  (role): role is string => typeof role === 'string',
                )
              : undefined,
          }
        : undefined,
  };
};

const normalizeMember = (value: unknown): OrganizationMemberRecord => {
  const record = isRecord(value) ? value : {};
  const user = isRecord(record.user) ? record.user : {};
  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-member',
    userId: typeof record.userId === 'string' ? record.userId : 'unknown-user',
    organizationId:
      typeof record.organizationId === 'string'
        ? record.organizationId
        : 'unknown-org',
    role: typeof record.role === 'string' ? record.role : 'VIEWER',
    roles: Array.isArray(record.roles)
      ? record.roles.filter((item): item is string => typeof item === 'string')
      : [],
    isDefault: Boolean(record.isDefault),
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    user:
      Object.keys(user).length > 0
        ? {
            id: typeof user.id === 'string' ? user.id : 'unknown-user',
            email: typeof user.email === 'string' ? user.email : 'unknown',
            displayName:
              typeof user.displayName === 'string'
                ? user.displayName
                : 'Unknown User',
            authProvider:
              typeof user.authProvider === 'string'
                ? user.authProvider
                : 'unknown',
            externalId:
              typeof user.externalId === 'string' ? user.externalId : null,
            isActive: Boolean(user.isActive),
          }
        : null,
  };
};

const normalizeInvitation = (value: unknown): OrganizationInvitationRecord => {
  const record = isRecord(value) ? value : {};
  return {
    id: typeof record.id === 'string' ? record.id : 'unknown-invitation',
    organizationId:
      typeof record.organizationId === 'string'
        ? record.organizationId
        : 'unknown-org',
    email: typeof record.email === 'string' ? record.email : 'unknown',
    role: typeof record.role === 'string' ? record.role : 'VIEWER',
    roles: Array.isArray(record.roles)
      ? record.roles.filter((item): item is string => typeof item === 'string')
      : [],
    status: typeof record.status === 'string' ? record.status : 'PENDING',
    provider: typeof record.provider === 'string' ? record.provider : 'local',
    providerInvitationId:
      typeof record.providerInvitationId === 'string'
        ? record.providerInvitationId
        : null,
    acceptUrl:
      typeof record.acceptUrl === 'string' ? record.acceptUrl : null,
    providerState:
      typeof record.providerState === 'string' ? record.providerState : null,
    lastError:
      typeof record.lastError === 'string' ? record.lastError : null,
    invitedByUserId:
      typeof record.invitedByUserId === 'string'
        ? record.invitedByUserId
        : null,
    expiresAt:
      typeof record.expiresAt === 'string' ? record.expiresAt : null,
    acceptedAt:
      typeof record.acceptedAt === 'string' ? record.acceptedAt : null,
    createdAt:
      typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt:
      typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
};

let previewOrganizationStore: OrganizationRecord = {
  id: 'preview-org',
  name: 'Trovan Dispatch',
  slug: 'trovan-preview',
  serviceTimezone: 'America/Chicago',
  settings: {
    branding: {
      brandName: 'Trovan Dispatch',
      primaryColor: '#0D1218',
      accentColor: '#B97129',
      supportEmail: 'support@trovan.local',
      supportPhone: '(555) 010-2026',
      trackingHeadline: 'Your order is on the move',
      trackingSubtitle: 'Reliable route progress and delivery visibility.',
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: false,
      replyToEmail: 'dispatch@trovan.local',
      defaultChannel: 'email',
      scheduledEnabled: true,
      onTheWayEnabled: true,
      onTheWayMinutesBefore: 30,
      onTheWayRequirePreviousCompletion: true,
      completionEnabled: true,
      failureEnabled: true,
      completionVarianceThresholdMeters: 250,
    },
    retention: {
      auditDays: 365,
      operationalDays: 365,
    },
    identity: {
      workosOrganizationId: '',
      workosConnectionId: '',
      domainVerificationStatus: 'unverified',
      ssoEnforced: false,
      mfaEnforced: false,
    },
  },
  membership: {
    role: 'OWNER',
    roles: ['OWNER'],
  },
};

const previewOrganization = (): OrganizationRecord =>
  normalizeOrganization(JSON.parse(JSON.stringify(previewOrganizationStore)));

const previewMembers = (): OrganizationMemberRecord[] => [
  {
    id: 'member-preview-1',
    userId: 'preview-user',
    organizationId: 'preview-org',
    role: 'OWNER',
    roles: ['OWNER'],
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: {
      id: 'preview-user',
      email: 'ops@trovan.local',
      displayName: 'Trovan Admin',
      authProvider: 'local-config',
      externalId: null,
      isActive: true,
    },
  },
];

let previewInvitationStore: OrganizationInvitationRecord[] = [
  {
    id: 'invite-preview-1',
    organizationId: 'preview-org',
    email: 'planner@trovan.local',
    role: 'DISPATCHER',
    roles: ['DISPATCHER'],
    status: 'PENDING',
    provider: 'local',
    providerInvitationId: null,
    acceptUrl: null,
    providerState: 'preview',
    lastError: null,
    invitedByUserId: 'preview-user',
    expiresAt: null,
    acceptedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const previewInvitations = (): OrganizationInvitationRecord[] =>
  previewInvitationStore.map((invitation) => ({
    ...invitation,
    roles: [...invitation.roles],
  }));

export const getOrganizations = async (): Promise<OrganizationRecord[]> => {
  if (isPreview()) {
    return [previewOrganization()];
  }
  const response = await apiFetch('/api/organizations');
  const data = await response.json();
  return unwrapListItems<unknown>(data, ['organizations', 'items']).map(
    normalizeOrganization,
  );
};

export const getCurrentOrganization = async (): Promise<OrganizationRecord | null> => {
  if (isPreview()) {
    return previewOrganization();
  }
  const response = await apiFetch('/api/organizations/current');
  const data = unwrapApiData<{ organization?: unknown }>(await response.json());
  return data.organization ? normalizeOrganization(data.organization) : null;
};

export const getOrganizationMembers = async (): Promise<
  OrganizationMemberRecord[]
> => {
  if (isPreview()) {
    return previewMembers();
  }
  const response = await apiFetch('/api/organizations/current/members');
  const data = unwrapApiData<{ members?: unknown[] }>(await response.json());
  return Array.isArray(data.members) ? data.members.map(normalizeMember) : [];
};

export const getOrganizationInvitations = async (): Promise<
  OrganizationInvitationRecord[]
> => {
  if (isPreview()) {
    return previewInvitations();
  }
  const response = await apiFetch('/api/organizations/current/invitations');
  const data = unwrapApiData<{ invitations?: unknown[] }>(
    await response.json(),
  );
  return Array.isArray(data.invitations)
    ? data.invitations.map(normalizeInvitation)
    : [];
};

export const createOrganization = async (payload: {
  name: string;
  slug?: string;
  serviceTimezone?: string;
}) => {
  if (isPreview()) {
    previewOrganizationStore = normalizeOrganization({
      id: `preview-org-${Date.now()}`,
      name: payload.name,
      slug: payload.slug || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      serviceTimezone: payload.serviceTimezone || 'UTC',
      settings: previewOrganizationStore.settings,
      membership: { role: 'OWNER', roles: ['OWNER'] },
    });
    return previewOrganization();
  }
  const response = await apiFetch('/api/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = unwrapApiData<{ organization?: unknown }>(await response.json());
  return data.organization ? normalizeOrganization(data.organization) : null;
};

export const updateCurrentOrganizationSettings = async (payload: {
  brandName?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
  supportPhone?: string;
  trackingHeadline?: string;
  trackingSubtitle?: string;
  notificationEmailEnabled?: boolean;
  notificationSmsEnabled?: boolean;
  notificationReplyToEmail?: string;
  defaultNotificationChannel?: 'email' | 'sms' | 'both';
  notificationScheduledEnabled?: boolean;
  notificationOnTheWayEnabled?: boolean;
  notificationOnTheWayMinutesBefore?: number;
  notificationOnTheWayRequirePreviousCompletion?: boolean;
  notificationCompletionEnabled?: boolean;
  notificationFailureEnabled?: boolean;
  completionVarianceThresholdMeters?: number;
  auditRetentionDays?: number;
  operationalRetentionDays?: number;
  workosOrganizationId?: string;
  workosConnectionId?: string;
  domainVerificationStatus?: 'unverified' | 'pending' | 'verified';
  ssoEnforced?: boolean;
  mfaEnforced?: boolean;
}) => {
  if (isPreview()) {
    const current: OrganizationSettingsRecord =
      previewOrganizationStore.settings || { branding: {} };
    previewOrganizationStore = {
      ...previewOrganizationStore,
      settings: {
        branding: {
          ...(current.branding || {}),
          brandName: payload.brandName,
          primaryColor: payload.primaryColor,
          accentColor: payload.accentColor,
          supportEmail: payload.supportEmail,
          supportPhone: payload.supportPhone,
          trackingHeadline: payload.trackingHeadline,
          trackingSubtitle: payload.trackingSubtitle,
        },
        notifications: {
          ...(current.notifications || {}),
          emailEnabled: payload.notificationEmailEnabled,
          smsEnabled: payload.notificationSmsEnabled,
          replyToEmail: payload.notificationReplyToEmail,
          defaultChannel: payload.defaultNotificationChannel,
          scheduledEnabled: payload.notificationScheduledEnabled,
          onTheWayEnabled: payload.notificationOnTheWayEnabled,
          onTheWayMinutesBefore: payload.notificationOnTheWayMinutesBefore,
          onTheWayRequirePreviousCompletion:
            payload.notificationOnTheWayRequirePreviousCompletion,
          completionEnabled: payload.notificationCompletionEnabled,
          failureEnabled: payload.notificationFailureEnabled,
          completionVarianceThresholdMeters:
            payload.completionVarianceThresholdMeters,
        },
        retention: {
          ...(current.retention || {}),
          auditDays: payload.auditRetentionDays,
          operationalDays: payload.operationalRetentionDays,
        },
        identity: {
          ...(current.identity || {}),
          workosOrganizationId: payload.workosOrganizationId,
          workosConnectionId: payload.workosConnectionId,
          domainVerificationStatus: payload.domainVerificationStatus,
          ssoEnforced: payload.ssoEnforced,
          mfaEnforced: payload.mfaEnforced,
        },
      },
    };
    return previewOrganization();
  }
  const response = await apiFetch('/api/organizations/current/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  const data = unwrapApiData<{ organization?: unknown }>(await response.json());
  return data.organization ? normalizeOrganization(data.organization) : null;
};

export const createOrganizationInvitation = async (payload: {
  email: string;
  role?: string;
  expiresInDays?: number;
}) => {
  if (isPreview()) {
    const now = new Date().toISOString();
    const invitation = normalizeInvitation({
      id: `invite-preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      organizationId: previewOrganizationStore.id,
      email: payload.email,
      role: payload.role || 'VIEWER',
      roles: [payload.role || 'VIEWER'],
      status: 'PENDING',
      provider: 'local',
      providerInvitationId: null,
      acceptUrl: null,
      providerState: 'preview',
      lastError: null,
      invitedByUserId: 'preview-user',
      expiresAt: null,
      acceptedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    previewInvitationStore = [invitation, ...previewInvitationStore];
    return invitation;
  }
  const response = await apiFetch('/api/organizations/current/invitations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = unwrapApiData<{ invitation?: unknown }>(await response.json());
  return data.invitation ? normalizeInvitation(data.invitation) : null;
};

export const revokeOrganizationInvitation = async (invitationId: string) => {
  if (isPreview()) {
    let revoked: OrganizationInvitationRecord | null = null;
    previewInvitationStore = previewInvitationStore.map((invitation) => {
      if (invitation.id !== invitationId) return invitation;
      revoked = {
        ...invitation,
        status: 'REVOKED',
        updatedAt: new Date().toISOString(),
      };
      return revoked;
    });
    return revoked;
  }
  const response = await apiFetch(
    `/api/organizations/current/invitations/${invitationId}/revoke`,
    {
      method: 'POST',
    },
  );
  const data = unwrapApiData<{ invitation?: unknown }>(await response.json());
  return data.invitation ? normalizeInvitation(data.invitation) : null;
};

export const useOrganizationsQuery = () =>
  useQuery({
    queryKey: queryKeys.organizations,
    queryFn: getOrganizations,
  });

export const useCurrentOrganizationQuery = () =>
  useQuery({
    queryKey: queryKeys.currentOrganization,
    queryFn: getCurrentOrganization,
  });

export const useOrganizationMembersQuery = () =>
  useQuery({
    queryKey: queryKeys.organizationMembers,
    queryFn: getOrganizationMembers,
  });

export const useOrganizationInvitationsQuery = () =>
  useQuery({
    queryKey: queryKeys.organizationInvitations,
    queryFn: getOrganizationInvitations,
  });

export const useCreateOrganizationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentOrganization,
        }),
      ]);
    },
  });
};

export const useUpdateCurrentOrganizationSettingsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCurrentOrganizationSettings,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentOrganization,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations }),
      ]);
    },
  });
};

export const useCreateOrganizationInvitationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganizationInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizationInvitations,
      });
    },
  });
};

export const useRevokeOrganizationInvitationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeOrganizationInvitation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizationInvitations,
      });
    },
  });
};
