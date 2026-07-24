import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationsService } from './organizations.service';

function repositoryMock() {
  return {
    count: vi.fn(),
    create: vi.fn((value) => value),
    find: vi.fn(),
    findOne: vi.fn(),
    save: vi.fn(),
  };
}

describe('OrganizationsService', () => {
  let organizations: ReturnType<typeof repositoryMock>;
  let users: ReturnType<typeof repositoryMock>;
  let memberships: ReturnType<typeof repositoryMock>;
  let invitations: ReturnType<typeof repositoryMock>;
  let workos: { isConfigured: ReturnType<typeof vi.fn>; sendInvitation: ReturnType<typeof vi.fn> };
  let service: OrganizationsService;

  beforeEach(() => {
    organizations = repositoryMock();
    users = repositoryMock();
    memberships = repositoryMock();
    invitations = repositoryMock();
    workos = {
      isConfigured: vi.fn().mockReturnValue(false),
      sendInvitation: vi.fn(),
    };
    service = new OrganizationsService(
      organizations as never,
      users as never,
      memberships as never,
      invitations as never,
      workos as never,
    );
  });

  it('returns only membership context for the requested organization and user', async () => {
    const organization = {
      id: 'org-a',
      name: 'Acme',
      slug: 'acme',
      serviceTimezone: 'UTC',
      settings: {},
    };
    const membership = {
      organizationId: 'org-a',
      userId: 'user-a',
      role: 'DISPATCHER',
      roles: ['DISPATCHER'],
    };
    organizations.findOne.mockResolvedValue(organization);
    memberships.findOne.mockResolvedValue(membership);

    await expect(
      service.getOrganizationContext('org-a', 'user-a'),
    ).resolves.toMatchObject({
      id: 'org-a',
      membership: { role: 'DISPATCHER', roles: ['DISPATCHER'] },
    });
    expect(memberships.findOne).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', userId: 'user-a' },
    });
  });

  it('returns null before querying membership when the organization does not exist', async () => {
    organizations.findOne.mockResolvedValue(null);

    await expect(
      service.getOrganizationContext('missing-org', 'user-a'),
    ).resolves.toBeNull();
    expect(memberships.findOne).not.toHaveBeenCalled();
  });

  it('prevents inviting an existing member of the same organization', async () => {
    organizations.findOne.mockResolvedValue({ id: 'org-a', settings: {} });
    users.findOne.mockResolvedValue({ id: 'user-existing', email: 'member@example.com' });
    memberships.findOne.mockResolvedValue({
      organizationId: 'org-a',
      userId: 'user-existing',
    });

    await expect(
      service.createInvitation('org-a', 'owner-a', {
        email: ' Member@Example.com ',
        role: 'VIEWER',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'member@example.com is already a member of this organization',
      ),
    );
    expect(invitations.save).not.toHaveBeenCalled();
  });

  it('fails closed when a non-member attempts to change organization settings', async () => {
    organizations.findOne.mockResolvedValue({
      id: 'org-a',
      settings: {},
    });
    memberships.findOne.mockResolvedValue(null);

    await expect(
      service.updateCurrentSettings('org-a', 'user-from-org-b', {
        brandName: 'Other tenant',
      }),
    ).rejects.toThrow(
      new BadRequestException('Membership not found for organization'),
    );
    expect(organizations.save).not.toHaveBeenCalled();
  });

  it('merges settings without discarding identity data and keeps SMS explicitly disabled', async () => {
    const organization = {
      id: 'org-a',
      settings: {
        identity: { workosOrganizationId: 'workos-org-a' },
        notifications: { replyToEmail: 'ops@old.example' },
        custom: { retained: true },
      },
    };
    organizations.findOne.mockResolvedValue(organization);
    memberships.findOne.mockResolvedValue({
      organizationId: 'org-a',
      userId: 'owner-a',
      role: 'OWNER',
      roles: ['OWNER', 'ADMIN'],
    });
    organizations.save.mockImplementation(async (value) => value);

    await service.updateCurrentSettings('org-a', 'owner-a', {
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      notificationReplyToEmail: ' OPS@EXAMPLE.COM ',
      primaryColor: '#ab7722',
    });

    expect(organization.settings).toMatchObject({
      custom: { retained: true },
      identity: { workosOrganizationId: 'workos-org-a' },
      branding: { primaryColor: '#AB7722' },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        replyToEmail: 'ops@example.com',
      },
    });
  });
});
