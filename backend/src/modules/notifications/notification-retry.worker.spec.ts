import { ConfigService } from '@nestjs/config';
import { NotificationRetryWorker } from './notification-retry.worker';
import { NotificationsService } from './notifications.service';

describe('NotificationRetryWorker', () => {
  function createWorker(enableScheduler: string) {
    const notificationsService = {
      retryDueDeliveries: vi.fn().mockResolvedValue({
        attempted: 1,
        sent: 1,
        failed: 0,
      }),
    } as unknown as NotificationsService;
    const configService = {
      get: (key: string, fallback?: string) =>
        key === 'ENABLE_SCHEDULER' ? enableScheduler : fallback,
    } as ConfigService;
    return {
      worker: new NotificationRetryWorker(
        notificationsService,
        configService,
      ),
      notificationsService,
    };
  }

  it('does not run when the embedded scheduler is disabled', async () => {
    const { worker, notificationsService } = createWorker('0');

    await expect(worker.retryDueDeliveries()).resolves.toEqual({
      attempted: 0,
      skipped: true,
    });
    expect(notificationsService.retryDueDeliveries).not.toHaveBeenCalled();
  });

  it('processes due notification deliveries when scheduling is enabled', async () => {
    const { worker, notificationsService } = createWorker('1');

    await expect(worker.retryDueDeliveries()).resolves.toEqual({
      attempted: 1,
      sent: 1,
      failed: 0,
    });
    expect(notificationsService.retryDueDeliveries).toHaveBeenCalledOnce();
  });
});
