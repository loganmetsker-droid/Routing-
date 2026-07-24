import { ConfigService } from '@nestjs/config';
import { MarketingLeadRetryWorker } from './marketing-lead-retry.worker';
import { MarketingLeadsService } from './marketing-leads.service';

describe('MarketingLeadRetryWorker', () => {
  function createWorker(enableScheduler: string) {
    const marketingLeads = {
      retryDueOperatorNotifications: vi.fn().mockResolvedValue({
        attempted: 1,
        sent: 1,
        failed: 0,
      }),
    } as unknown as MarketingLeadsService;
    const config = {
      get: (key: string, fallback?: string) =>
        key === 'ENABLE_SCHEDULER' ? enableScheduler : fallback,
    } as ConfigService;

    return {
      worker: new MarketingLeadRetryWorker(marketingLeads, config),
      marketingLeads,
    };
  }

  it('does not run while the embedded scheduler is disabled', async () => {
    const { worker, marketingLeads } = createWorker('0');

    await expect(worker.retryDueNotifications()).resolves.toEqual({
      attempted: 0,
      skipped: true,
    });
    expect(
      marketingLeads.retryDueOperatorNotifications,
    ).not.toHaveBeenCalled();
  });

  it('processes due lead notifications while scheduling is enabled', async () => {
    const { worker, marketingLeads } = createWorker('1');

    await expect(worker.retryDueNotifications()).resolves.toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
    });
    expect(
      marketingLeads.retryDueOperatorNotifications,
    ).toHaveBeenCalledOnce();
  });
});
