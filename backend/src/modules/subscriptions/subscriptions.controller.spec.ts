import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionsController } from './subscriptions.controller';
import type { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  describe('handleWebhook', () => {
    function createController() {
      const subscriptionsService = {
        handleWebhookEvent: vi.fn(async () => undefined),
      } as unknown as SubscriptionsService;

      const configService = {
        get: (key: string) => {
          if (key === 'STRIPE_SECRET_KEY') return 'sk_test_configured';
          if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_configured';
          return undefined;
        },
      } as unknown as ConfigService;

      const controller = new SubscriptionsController(
        subscriptionsService,
        configService,
      );

      (controller as any).stripe = {
        webhooks: {
          constructEvent: vi.fn(() => {
            throw new Error('signature invalid: details should not leak');
          }),
        },
      };
      (controller as any).webhookSecret = 'whsec_configured';

      return { controller, subscriptionsService };
    }

    it('returns a generic bad request on signature verification failure', async () => {
      const { controller } = createController();

      try {
        await controller.handleWebhook('sig', {
          rawBody: Buffer.from('payload'),
        } as any);
        throw new Error('expected handleWebhook to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as any;
        expect(response?.message).toBe('Webhook signature verification failed');
        expect(String(response?.message)).not.toContain('details should not leak');
      }
    });
  });
});

