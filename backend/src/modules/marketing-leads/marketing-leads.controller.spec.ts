import { MarketingLeadsController } from './marketing-leads.controller';
import { MarketingLeadsService } from './marketing-leads.service';

describe('MarketingLeadsController', () => {
  function createHarness() {
    const service = {
      create: vi.fn().mockResolvedValue({
        id: 'internal-lead-id',
        duplicate: false,
        notificationStatus: 'sent',
      }),
      hasOperatorAccess: vi.fn().mockReturnValue(false),
      assertOperatorAccess: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue({ id: 'lead-1' }),
      retryOperatorNotification: vi
        .fn()
        .mockResolvedValue({ id: 'lead-1' }),
    } as unknown as MarketingLeadsService;
    return {
      controller: new MarketingLeadsController(service),
      service,
      request: { user: { email: 'customer-admin@example.com' } },
    };
  }

  it('returns an opaque public acceptance response', async () => {
    const { controller } = createHarness();

    await expect(
      controller.create({
        name: 'Jordan Lee',
        workEmail: 'jordan@example.com',
        company: 'Example Logistics',
        fleetSize: '16–35',
        requestType: 'Book demo',
      }),
    ).resolves.toEqual({ accepted: true });
  });

  it('reports platform-operator access without exposing lead records', () => {
    const { controller, service, request } = createHarness();

    expect(controller.access(request)).toEqual({ operatorAccess: false });
    expect(service.hasOperatorAccess).toHaveBeenCalledWith(
      'customer-admin@example.com',
    );
    expect(service.list).not.toHaveBeenCalled();
  });

  it('enforces the operator allowlist on every global lead mutation and read', async () => {
    const { controller, service, request } = createHarness();

    await controller.list(request, {});
    await controller.update(request, 'lead-1', { status: 'qualified' });
    await controller.retryNotification(request, 'lead-1');

    expect(service.assertOperatorAccess).toHaveBeenCalledTimes(3);
    expect(service.assertOperatorAccess).toHaveBeenNthCalledWith(
      1,
      'customer-admin@example.com',
    );
    expect(service.assertOperatorAccess).toHaveBeenNthCalledWith(
      2,
      'customer-admin@example.com',
    );
    expect(service.assertOperatorAccess).toHaveBeenNthCalledWith(
      3,
      'customer-admin@example.com',
    );
  });
});
