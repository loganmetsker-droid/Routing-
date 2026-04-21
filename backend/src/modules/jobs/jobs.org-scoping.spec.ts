import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobPriority, JobStatus, type Job } from './entities/job.entity';
import { JobsService } from './jobs.service';

type Where = Record<string, unknown>;

describe('JobsService organization scoping', () => {
  function matchesWhere(item: Record<string, any>, where: Where) {
    return Object.entries(where).every(([key, value]) => item[key] === value);
  }

  function createQueryBuilder(items: Record<string, any>[] = []) {
    const state = {
      whereClauses: [] as Array<{ clause: string; params?: Record<string, unknown> }>,
      orderClauses: [] as Array<{ column: string; direction: string }>,
    };

    const builder: any = {
      state,
      andWhere: jest.fn((clause: string, params?: Record<string, unknown>) => {
        state.whereClauses.push({ clause, params });
        return builder;
      }),
      where: jest.fn((clause: string, params?: Record<string, unknown>) => {
        state.whereClauses.push({ clause, params });
        return builder;
      }),
      orderBy: jest.fn((column: string, direction: string) => {
        state.orderClauses.push({ column, direction });
        return builder;
      }),
      addOrderBy: jest.fn((column: string, direction: string) => {
        state.orderClauses.push({ column, direction });
        return builder;
      }),
      getMany: jest.fn(async () => items),
      select: jest.fn(() => builder),
      addSelect: jest.fn(() => builder),
      groupBy: jest.fn(() => builder),
      getRawMany: jest.fn(async () => []),
    };

    return builder;
  }

  function createJobRepo(initial: Record<string, any>[] = []) {
    const items = [...initial];
    const queryBuilder = createQueryBuilder(items);

    return {
      items,
      queryBuilder,
      create: jest.fn((value: Partial<Job>) => ({ id: value.id || 'job-new', ...value })),
      save: jest.fn(async (value: Record<string, any>) => {
        const index = items.findIndex((candidate) => candidate.id === value.id);
        if (index >= 0) items[index] = { ...items[index], ...value };
        else items.push(value);
        return value;
      }),
      findOne: jest.fn(async ({ where }: { where: Where }) => items.find((item) => matchesWhere(item, where)) || null),
      createQueryBuilder: jest.fn(() => queryBuilder),
      softRemove: jest.fn(async (value: Record<string, any>) => value),
      count: jest.fn(async () => items.length),
      find: jest.fn(async () => items),
    } as any;
  }

  function createCustomerRepo(initial: Record<string, any>[] = []) {
    const items = [...initial];
    return {
      findOne: jest.fn(async ({ where }: { where: Where }) => items.find((item) => matchesWhere(item, where)) || null),
    } as any;
  }

  const actor = { userId: 'user-1', organizationId: 'org-1' };

  it('scopes create and findOne to the actor organization', async () => {
    const jobs = createJobRepo([
      { id: 'job-1', organizationId: 'org-1', customerName: 'Org 1', deliveryAddress: 'One St', status: JobStatus.PENDING, priority: JobPriority.NORMAL },
      { id: 'job-2', organizationId: 'org-2', customerName: 'Org 2', deliveryAddress: 'Two St', status: JobStatus.PENDING, priority: JobPriority.NORMAL },
    ]);
    const customers = createCustomerRepo([
      { id: 'customer-1', organizationId: 'org-1', name: 'ACME', phone: '555', email: 'ops@acme.test', defaultAddress: 'Dock 1' },
    ]);

    const service = new JobsService(jobs, customers);

    const created = await service.create(
      {
        customerId: 'customer-1',
        customerName: 'ACME',
        deliveryAddress: 'Dock 1',
        timeWindowStart: '2026-04-16T09:00:00.000Z',
        timeWindowEnd: '2026-04-16T10:00:00.000Z',
      } as any,
      actor,
    );

    expect(created.organizationId).toBe('org-1');
    await expect(service.findOne('job-2', actor)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne('job-1', actor)).resolves.toMatchObject({ id: 'job-1', organizationId: 'org-1' });
  });

  it('rejects linking a job to a customer from another organization', async () => {
    const jobs = createJobRepo();
    const customers = createCustomerRepo([
      { id: 'customer-2', organizationId: 'org-2', name: 'Other Org', defaultAddress: 'Elsewhere' },
    ]);

    const service = new JobsService(jobs, customers);

    await expect(
      service.create(
        {
          customerId: 'customer-2',
          customerName: 'Other Org',
          deliveryAddress: 'Elsewhere',
          timeWindowStart: '2026-04-16T09:00:00.000Z',
          timeWindowEnd: '2026-04-16T10:00:00.000Z',
        } as any,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds organization filters to list queries', async () => {
    const jobs = createJobRepo([{ id: 'job-1', organizationId: 'org-1' }]);
    const customers = createCustomerRepo();
    const service = new JobsService(jobs, customers);

    await service.findAll(undefined, undefined, undefined, undefined, undefined, actor);

    expect(jobs.createQueryBuilder).toHaveBeenCalledWith('job');
    expect(jobs.queryBuilder.state.whereClauses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clause: expect.stringContaining('job.organization_id = :organizationId'),
          params: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      ]),
    );
  });
});
