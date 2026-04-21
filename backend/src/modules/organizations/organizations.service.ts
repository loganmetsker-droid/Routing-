import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { AppUser } from './entities/app-user.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';

const DEFAULT_ORG_SLUG = 'default';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || DEFAULT_ORG_SLUG;
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
  ) {}

  async ensureBootstrapOrganization(email: string, displayName: string, roles: string[]) {
    let organization = await this.organizations.findOne({ where: { slug: DEFAULT_ORG_SLUG } });
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
}
