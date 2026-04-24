import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorkosService } from '../../common/integrations/workos.service';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { AppUser } from './entities/app-user.entity';
import { OrganizationInvitation } from './entities/organization-invitation.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { Organization } from './entities/organization.entity';

const DEFAULT_ORG_SLUG = 'default';

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || DEFAULT_ORG_SLUG
  );
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(AppUser)
    private readonly users: Repository<AppUser>,
    @InjectRepository(OrganizationMembership)
    private readonly memberships: Repository<OrganizationMembership>,
    @InjectRepository(OrganizationInvitation)
    private readonly invitations: Repository<OrganizationInvitation>,
    private readonly workosService: WorkosService,
  ) {}

  private getSettingsRecord(organization?: Organization | null) {
    return organization?.settings &&
      typeof organization.settings === 'object' &&
      !Array.isArray(organization.settings)
      ? (organization.settings as Record<string, unknown>)
      : {};
  }

  private getIdentitySettings(organization?: Organization | null) {
    const settings = this.getSettingsRecord(organization);
    return settings.identity &&
      typeof settings.identity === 'object' &&
      settings.identity !== null &&
      !Array.isArray(settings.identity)
      ? (settings.identity as Record<string, unknown>)
      : {};
  }

  private getDefaultMembershipRoles(role?: string | null) {
    const normalizedRole = String(role || 'ADMIN').trim().toUpperCase();
    if (normalizedRole === 'OWNER') {
      return ['OWNER', 'ADMIN'];
    }
    if (normalizedRole === 'ADMIN') {
      return ['ADMIN'];
    }
    return [normalizedRole];
  }

  private buildOrganizationRecord(
    organization: Organization,
    membership?: OrganizationMembership | null,
  ) {
    return {
      ...organization,
      membership: membership
        ? {
            role: membership.role,
            roles: membership.roles,
          }
        : undefined,
    };
  }

  private buildInvitationRecord(invitation: OrganizationInvitation) {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      roles: invitation.roles,
      status: invitation.status,
      provider: invitation.provider,
      providerInvitationId: invitation.providerInvitationId || null,
      acceptUrl: invitation.acceptUrl || null,
      providerState: invitation.providerState || null,
      lastError: invitation.lastError || null,
      invitedByUserId: invitation.invitedByUserId || null,
      expiresAt: invitation.expiresAt?.toISOString() || null,
      acceptedAt: invitation.acceptedAt?.toISOString() || null,
      createdAt: invitation.createdAt?.toISOString(),
      updatedAt: invitation.updatedAt?.toISOString(),
    };
  }

  private async createOrganizationForIdentity(
    email: string,
    providerOrganizationId?: string,
  ) {
    const emailDomain = email.split('@')[1] || 'trovan.local';
    const baseName = `${emailDomain.replace(/\..+$/, '')} workspace`;
    const slugBase = slugify(baseName);

    let slug = slugBase;
    let counter = 1;
    while (await this.organizations.findOne({ where: { slug } })) {
      counter += 1;
      slug = `${slugBase}-${counter}`;
    }

    return this.organizations.save(
      this.organizations.create({
        name: baseName.replace(/\b\w/g, (value) => value.toUpperCase()),
        slug,
        serviceTimezone: 'UTC',
        settings: {
          identity: providerOrganizationId
            ? {
                workosOrganizationId: providerOrganizationId,
              }
            : {},
        },
      }),
    );
  }

  async ensureBootstrapOrganization(email: string, displayName: string, roles: string[]) {
    let organization = await this.organizations.findOne({
      where: { slug: DEFAULT_ORG_SLUG },
    });
    if (!organization) {
      organization = await this.organizations.save(
        this.organizations.create({
          name: 'Default Organization',
          slug: DEFAULT_ORG_SLUG,
          serviceTimezone: 'UTC',
          settings: {},
        }),
      );
    }

    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      user = await this.users.save(
        this.users.create({
          email,
          displayName,
          authProvider: 'local-config',
          externalId: null,
          isActive: true,
        }),
      );
    }

    let membership = await this.memberships.findOne({
      where: { organizationId: organization.id, userId: user.id },
    });
    if (!membership) {
      membership = await this.memberships.save(
        this.memberships.create({
          organizationId: organization.id,
          userId: user.id,
          role: (roles[0] || 'ADMIN') as any,
          roles,
          isDefault: true,
        }),
      );
    }

    return { organization, user, membership };
  }

  async provisionIdentityUser(options: {
    authProvider: string;
    displayName: string;
    email: string;
    externalUserId?: string | null;
    providerOrganizationId?: string | null;
    requestedRoles?: string[];
  }) {
    const normalizedEmail = options.email.trim().toLowerCase();
    let user = await this.users.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      user = await this.users.save(
        this.users.create({
          email: normalizedEmail,
          displayName: options.displayName,
          authProvider: options.authProvider,
          externalId: options.externalUserId || null,
          isActive: true,
        }),
      );
    } else {
      user.displayName = options.displayName || user.displayName;
      user.authProvider = options.authProvider || user.authProvider;
      user.externalId = options.externalUserId || user.externalId || null;
      user.isActive = true;
      user = await this.users.save(user);
    }

    let organization: Organization | null = null;

    if (options.providerOrganizationId) {
      const allOrganizations = await this.organizations.find();
      organization =
        allOrganizations.find((candidate) => {
          const identity = this.getIdentitySettings(candidate);
          return (
            typeof identity.workosOrganizationId === 'string' &&
            identity.workosOrganizationId === options.providerOrganizationId
          );
        }) || null;
    }

    if (!organization) {
      const existingMemberships = await this.memberships.find({
        where: { userId: user.id },
        order: { createdAt: 'ASC' },
      });
      if (existingMemberships.length > 0) {
        organization =
          (await this.organizations.findOne({
            where: { id: existingMemberships[0].organizationId },
          })) || null;
      }
    }

    if (!organization) {
      organization = await this.createOrganizationForIdentity(
        normalizedEmail,
        options.providerOrganizationId || undefined,
      );
    } else if (options.providerOrganizationId) {
      const settings = this.getSettingsRecord(organization);
      const identity = this.getIdentitySettings(organization);
      if (identity.workosOrganizationId !== options.providerOrganizationId) {
        organization.settings = {
          ...settings,
          identity: {
            ...identity,
            workosOrganizationId: options.providerOrganizationId,
          },
        };
        organization = await this.organizations.save(organization);
      }
    }

    let membership = await this.memberships.findOne({
      where: { organizationId: organization.id, userId: user.id },
    });
    if (!membership) {
      const requestedRole =
        options.requestedRoles?.[0] ||
        ((await this.memberships.count({
          where: { organizationId: organization.id },
        })) === 0
          ? 'OWNER'
          : 'ADMIN');
      membership = await this.memberships.save(
        this.memberships.create({
          organizationId: organization.id,
          userId: user.id,
          role: requestedRole as any,
          roles:
            options.requestedRoles?.length && options.requestedRoles.length > 0
              ? options.requestedRoles
              : this.getDefaultMembershipRoles(requestedRole),
          isDefault: true,
        }),
      );
    }

    return {
      organization,
      user,
      membership,
    };
  }

  async create(dto: CreateOrganizationDto, actorUserId?: string) {
    const slug = slugify(dto.slug || dto.name);
    const exists = await this.organizations.findOne({ where: { slug } });
    if (exists) {
      throw new BadRequestException(`Organization slug already exists: ${slug}`);
    }
    const organization = await this.organizations.save(
      this.organizations.create({
        name: dto.name.trim(),
        slug,
        serviceTimezone: dto.serviceTimezone?.trim() || 'UTC',
        settings: {},
      }),
    );
    if (actorUserId) {
      const membership = await this.memberships.findOne({
        where: { organizationId: organization.id, userId: actorUserId },
      });
      if (!membership) {
        await this.memberships.save(
          this.memberships.create({
            organizationId: organization.id,
            userId: actorUserId,
            role: 'OWNER',
            roles: ['OWNER', 'ADMIN'],
            isDefault: false,
          }),
        );
      }
    }
    return organization;
  }

  async listForUser(userId: string) {
    const memberships = await this.memberships.find({ where: { userId } });
    if (!memberships.length) return [];
    const orgIds = memberships.map((membership) => membership.organizationId);
    const organizations = await this.organizations.find({ where: { id: In(orgIds) } });
    const byId = new Map(organizations.map((organization) => [organization.id, organization]));
    return memberships
      .map((membership) => ({
        membership,
        organization: byId.get(membership.organizationId),
      }))
      .filter((item) => item.organization);
  }

  async getOrganization(organizationId: string) {
    return this.organizations.findOne({ where: { id: organizationId } });
  }

  async getOrganizationContext(organizationId: string, userId: string) {
    const organization = await this.getOrganization(organizationId);
    if (!organization) {
      return null;
    }

    const membership = await this.memberships.findOne({
      where: { organizationId, userId },
    });

    return this.buildOrganizationRecord(organization, membership);
  }

  async listMembers(organizationId: string) {
    const memberships = await this.memberships.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });
    const userIds = memberships.map((membership) => membership.userId);
    const users = userIds.length
      ? await this.users.find({ where: { id: In(userIds) } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return memberships.map((membership) => {
      const user = usersById.get(membership.userId);
      return {
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: membership.role,
        roles: membership.roles,
        isDefault: membership.isDefault,
        createdAt: membership.createdAt?.toISOString(),
        updatedAt: membership.updatedAt?.toISOString(),
        user: user
          ? {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              authProvider: user.authProvider,
              externalId: user.externalId || null,
              isActive: user.isActive,
            }
          : null,
      };
    });
  }

  async listInvitations(organizationId: string) {
    const invitations = await this.invitations.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return invitations.map((invitation) => this.buildInvitationRecord(invitation));
  }

  async createInvitation(
    organizationId: string,
    actorUserId: string,
    dto: CreateOrganizationInvitationDto,
  ) {
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new BadRequestException(`Organization not found: ${organizationId}`);
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.memberships.findOne({
        where: {
          organizationId,
          userId: existingUser.id,
        },
      });
      if (existingMembership) {
        throw new BadRequestException(
          `${email} is already a member of this organization`,
        );
      }
    }

    const role = (dto.role || 'VIEWER').toUpperCase();
    let provider = 'local';
    let providerInvitationId: string | null = null;
    let providerState: string | null = null;
    let acceptUrl: string | null = null;
    let lastError: string | null = null;
    let expiresAt: Date | null = null;

    const identity = this.getIdentitySettings(organization);
    const workosOrganizationId =
      typeof identity.workosOrganizationId === 'string'
        ? identity.workosOrganizationId
        : undefined;

    if (this.workosService.isConfigured()) {
      provider = 'workos';
      try {
        const response = await this.workosService.sendInvitation({
          email,
          expiresInDays: dto.expiresInDays,
          inviterUserId: actorUserId,
          organizationId: workosOrganizationId,
        });
        const invitationResponse = response as {
          acceptInvitationUrl?: unknown;
          expiresAt?: unknown;
          id?: unknown;
          state?: unknown;
        };
        providerInvitationId =
          typeof invitationResponse.id === 'string' ? invitationResponse.id : null;
        providerState =
          typeof invitationResponse.state === 'string'
            ? invitationResponse.state.toUpperCase()
            : 'PENDING';
        acceptUrl =
          typeof invitationResponse.acceptInvitationUrl === 'string'
            ? invitationResponse.acceptInvitationUrl
            : null;
        expiresAt =
          typeof invitationResponse.expiresAt === 'string'
            ? new Date(invitationResponse.expiresAt)
            : null;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    const invitation = await this.invitations.save(
      this.invitations.create({
        organizationId,
        email,
        role,
        roles: this.getDefaultMembershipRoles(role),
        invitedByUserId: actorUserId,
        provider,
        providerInvitationId,
        providerState,
        acceptUrl,
        lastError,
        expiresAt,
      }),
    );

    return this.buildInvitationRecord(invitation);
  }

  async revokeInvitation(organizationId: string, invitationId: string) {
    const invitation = await this.invitations.findOne({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) {
      throw new BadRequestException(`Invitation not found: ${invitationId}`);
    }

    invitation.status = 'REVOKED';
    await this.invitations.save(invitation);
    return this.buildInvitationRecord(invitation);
  }

  async updateCurrentSettings(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationSettingsDto,
  ) {
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new BadRequestException(`Organization not found: ${organizationId}`);
    }

    const membership = await this.memberships.findOne({
      where: { organizationId, userId },
    });
    if (!membership) {
      throw new BadRequestException('Membership not found for organization');
    }

    const currentSettings =
      organization.settings && typeof organization.settings === 'object'
        ? organization.settings
        : {};
    const currentBranding =
      currentSettings.branding &&
      typeof currentSettings.branding === 'object' &&
      !Array.isArray(currentSettings.branding)
        ? (currentSettings.branding as Record<string, unknown>)
        : {};
    const currentNotifications =
      currentSettings.notifications &&
      typeof currentSettings.notifications === 'object' &&
      !Array.isArray(currentSettings.notifications)
        ? (currentSettings.notifications as Record<string, unknown>)
        : {};
    const currentRetention =
      currentSettings.retention &&
      typeof currentSettings.retention === 'object' &&
      !Array.isArray(currentSettings.retention)
        ? (currentSettings.retention as Record<string, unknown>)
        : {};
    const currentIdentity =
      currentSettings.identity &&
      typeof currentSettings.identity === 'object' &&
      !Array.isArray(currentSettings.identity)
        ? (currentSettings.identity as Record<string, unknown>)
        : {};

    organization.settings = {
      ...currentSettings,
      branding: {
        ...currentBranding,
        ...(dto.brandName !== undefined
          ? { brandName: dto.brandName.trim() }
          : {}),
        ...(dto.primaryColor !== undefined
          ? { primaryColor: dto.primaryColor.toUpperCase() }
          : {}),
        ...(dto.accentColor !== undefined
          ? { accentColor: dto.accentColor.toUpperCase() }
          : {}),
        ...(dto.supportEmail !== undefined
          ? { supportEmail: dto.supportEmail.trim().toLowerCase() }
          : {}),
        ...(dto.supportPhone !== undefined
          ? { supportPhone: dto.supportPhone.trim() }
          : {}),
        ...(dto.trackingHeadline !== undefined
          ? { trackingHeadline: dto.trackingHeadline.trim() }
          : {}),
        ...(dto.trackingSubtitle !== undefined
          ? { trackingSubtitle: dto.trackingSubtitle.trim() }
          : {}),
      },
      notifications: {
        ...currentNotifications,
        ...(dto.notificationEmailEnabled !== undefined
          ? { emailEnabled: dto.notificationEmailEnabled }
          : {}),
        ...(dto.notificationSmsEnabled !== undefined
          ? { smsEnabled: dto.notificationSmsEnabled }
          : {}),
        ...(dto.notificationReplyToEmail !== undefined
          ? {
              replyToEmail: dto.notificationReplyToEmail
                .trim()
                .toLowerCase(),
            }
          : {}),
        ...(dto.defaultNotificationChannel !== undefined
          ? { defaultChannel: dto.defaultNotificationChannel }
          : {}),
      },
      retention: {
        ...currentRetention,
        ...(dto.auditRetentionDays !== undefined
          ? { auditDays: dto.auditRetentionDays }
          : {}),
        ...(dto.operationalRetentionDays !== undefined
          ? { operationalDays: dto.operationalRetentionDays }
          : {}),
      },
      identity: {
        ...currentIdentity,
        ...(dto.workosOrganizationId !== undefined
          ? { workosOrganizationId: dto.workosOrganizationId.trim() }
          : {}),
        ...(dto.workosConnectionId !== undefined
          ? { workosConnectionId: dto.workosConnectionId.trim() }
          : {}),
        ...(dto.domainVerificationStatus !== undefined
          ? { domainVerificationStatus: dto.domainVerificationStatus }
          : {}),
        ...(dto.ssoEnforced !== undefined
          ? { ssoEnforced: dto.ssoEnforced }
          : {}),
        ...(dto.mfaEnforced !== undefined
          ? { mfaEnforced: dto.mfaEnforced }
          : {}),
      },
    };

    await this.organizations.save(organization);

    return this.getOrganizationContext(organizationId, userId);
  }
}
