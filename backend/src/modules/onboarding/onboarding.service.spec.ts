import { describe, expect, it, vi } from 'vitest';
import { OnboardingService, type OnboardingActor } from './onboarding.service';

const actor: OnboardingActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'owner@example.com',
  role: 'OWNER',
  roles: ['OWNER'],
};

const repository = () => ({
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
  count: vi.fn().mockResolvedValue(0),
  create: vi.fn((value) => value),
  save: vi.fn(async (value) => ({
    id: 'progress-1',
    createdAt: new Date('2026-08-18T00:00:00.000Z'),
    updatedAt: new Date('2026-08-18T00:00:00.000Z'),
    ...value,
  })),
  createQueryBuilder: vi.fn(),
});

const harness = () => {
  const progress = repository();
  const organizations = repository();
  const memberships = repository();
  const users = repository();
  const depots = repository();
  const drivers = repository();
  const vehicles = repository();
  const jobs = repository();
  const routes = repository();
  const proofs = repository();
  const audit = { record: vi.fn() };
  const email = { send: vi.fn().mockResolvedValue({ status: 'SKIPPED' }) };
  const service = new OnboardingService(
    progress as never,
    organizations as never,
    memberships as never,
    users as never,
    depots as never,
    drivers as never,
    vehicles as never,
    jobs as never,
    routes as never,
    proofs as never,
    audit as never,
    email as never,
  );
  return { service, progress, organizations, memberships, audit, email };
};

describe('OnboardingService tenant and completion behavior', () => {
  it('always scopes personal progress to the active organization and user', async () => {
    const { service, progress } = harness();
    await service.getMyProgress(actor);
    expect(progress.find).toHaveBeenCalledWith({
      where: { organizationId: actor.organizationId, userId: actor.userId },
      order: { updatedAt: 'DESC' },
    });
  });

  it('persists a passing current-version module and records a scoped audit event', async () => {
    const { service, progress, audit } = harness();
    progress.count.mockResolvedValue(1);

    const result = await service.updateProgress(
      'start-here',
      { status: 'COMPLETED', score: 100 },
      actor,
    );

    expect(progress.findOne).toHaveBeenCalledWith({
      where: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        moduleKey: 'start-here',
        contentVersion: '1.2.0',
      },
    });
    expect(result.status).toBe('COMPLETED');
    expect(result.score).toBe(100);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'pilot.activation.training-completed',
      metadata: { organizationId: actor.organizationId },
    }));
  });

  it('does not complete Go-Live until the customer signoff is acknowledged', async () => {
    const { service, progress } = harness();
    progress.count.mockResolvedValue(1);

    const unsigned = await service.updateProgress(
      'go-live',
      { status: 'COMPLETED', score: 100, signoffAcknowledged: false },
      actor,
    );
    expect(unsigned.status).toBe('IN_PROGRESS');
    expect(unsigned.signoffAcknowledged).toBe(false);

    const signed = await service.updateProgress(
      'go-live',
      { status: 'COMPLETED', score: 100, signoffAcknowledged: true },
      actor,
    );
    expect(signed.status).toBe('COMPLETED');
    expect(signed.signoffAcknowledged).toBe(true);
  });

  it('rejects a Champion who is not an Owner or Admin in the same organization', async () => {
    const { service, organizations, memberships } = harness();
    organizations.findOne.mockResolvedValue({ id: actor.organizationId, settings: {} });
    memberships.findOne.mockResolvedValue({
      organizationId: actor.organizationId,
      userId: '22222222-2222-4222-8222-222222222222',
      role: 'DRIVER',
    });

    await expect(service.setChampion(
      { userId: '22222222-2222-4222-8222-222222222222' },
      actor,
    )).rejects.toThrow('must be an Owner or Admin');
    expect(memberships.findOne).toHaveBeenCalledWith({
      where: {
        organizationId: actor.organizationId,
        userId: '22222222-2222-4222-8222-222222222222',
      },
    });
  });
});
