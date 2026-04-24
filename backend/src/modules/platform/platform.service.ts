import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';

type WebhookEventInput = {
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  requestId?: string | null;
};

const DEFAULT_API_SCOPES = [
  'jobs:read',
  'customers:read',
  'drivers:read',
  'vehicles:read',
  'route-runs:read',
  'exceptions:read',
];

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeys: Repository<ApiKey>,
    @InjectRepository(WebhookEndpoint)
    private readonly webhookEndpoints: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookDelivery)
    private readonly webhookDeliveries: Repository<WebhookDelivery>,
    private readonly configService: ConfigService,
  ) {}

  private hashSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private constantTimeEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private normalizeScopes(scopes?: string[]) {
    const normalized = (scopes || DEFAULT_API_SCOPES)
      .map((scope) => String(scope || '').trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }

  private buildApiKeyRecord(apiKey: ApiKey) {
    return {
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes || [],
      lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
      revokedAt: apiKey.revokedAt?.toISOString() || null,
      createdByUserId: apiKey.createdByUserId || null,
      createdAt: apiKey.createdAt?.toISOString(),
      updatedAt: apiKey.updatedAt?.toISOString(),
    };
  }

  private buildWebhookEndpointRecord(endpoint: WebhookEndpoint) {
    return {
      id: endpoint.id,
      organizationId: endpoint.organizationId,
      name: endpoint.name,
      url: endpoint.url,
      subscribedEvents: endpoint.subscribedEvents || [],
      status: endpoint.status,
      lastDeliveryAt: endpoint.lastDeliveryAt?.toISOString() || null,
      lastFailure: endpoint.lastFailure || null,
      createdByUserId: endpoint.createdByUserId || null,
      createdAt: endpoint.createdAt?.toISOString(),
      updatedAt: endpoint.updatedAt?.toISOString(),
    };
  }

  private buildWebhookDeliveryRecord(delivery: WebhookDelivery) {
    return {
      id: delivery.id,
      endpointId: delivery.endpointId,
      organizationId: delivery.organizationId,
      eventType: delivery.eventType,
      status: delivery.status,
      requestId: delivery.requestId || null,
      attempts: delivery.attempts,
      responseStatus: delivery.responseStatus ?? null,
      failureReason: delivery.failureReason || null,
      payload: delivery.payload || {},
      deliveredAt: delivery.deliveredAt?.toISOString() || null,
      createdAt: delivery.createdAt?.toISOString(),
      updatedAt: delivery.updatedAt?.toISOString(),
    };
  }

  async getOverview(organizationId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [apiKeys, activeWebhooks, failedDeliveries, delivered24h] =
      await Promise.all([
        this.apiKeys.count({
          where: { organizationId, revokedAt: null },
        }),
        this.webhookEndpoints.count({
          where: { organizationId, status: 'ACTIVE' },
        }),
        this.webhookDeliveries.count({
          where: {
            organizationId,
            status: 'FAILED',
            createdAt: MoreThan(since),
          },
        }),
        this.webhookDeliveries.count({
          where: {
            organizationId,
            status: 'DELIVERED',
            createdAt: MoreThan(since),
          },
        }),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      authMode: this.configService.get<string>('AUTH_PROVIDER', 'local-config'),
      apiKeysActive: apiKeys,
      webhooksActive: activeWebhooks,
      deliveriesLast24Hours: delivered24h,
      failuresLast24Hours: failedDeliveries,
      controls: {
        externalApiEnabled: true,
        signedWebhooksEnabled: true,
        requestIdsEnabled: true,
      },
    };
  }

  async createApiKey(
    organizationId: string,
    dto: CreateApiKeyDto,
    createdByUserId?: string,
  ) {
    const prefix = randomBytes(5).toString('hex');
    const secretPart = randomBytes(24).toString('hex');
    const rawKey = `trovan_${prefix}_${secretPart}`;
    const apiKey = await this.apiKeys.save(
      this.apiKeys.create({
        organizationId,
        name: dto.name.trim(),
        prefix,
        keyHash: this.hashSecret(rawKey),
        scopes: this.normalizeScopes(dto.scopes),
        createdByUserId: createdByUserId || null,
      }),
    );

    return {
      apiKey: this.buildApiKeyRecord(apiKey),
      secret: rawKey,
    };
  }

  async listApiKeys(organizationId: string) {
    const items = await this.apiKeys.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.buildApiKeyRecord(item));
  }

  async revokeApiKey(id: string, organizationId: string) {
    const apiKey = await this.apiKeys.findOne({ where: { id, organizationId } });
    if (!apiKey) {
      throw new NotFoundException(`API key not found: ${id}`);
    }
    apiKey.revokedAt = new Date();
    await this.apiKeys.save(apiKey);
    return this.buildApiKeyRecord(apiKey);
  }

  async authenticateApiKey(rawKey: string) {
    const trimmed = String(rawKey || '').trim();
    const parts = trimmed.split('_');
    if (parts.length < 3 || parts[0] !== 'trovan') {
      return null;
    }

    const prefix = parts[1];
    const apiKey = await this.apiKeys.findOne({ where: { prefix } });
    if (!apiKey || apiKey.revokedAt) {
      return null;
    }

    const hash = this.hashSecret(trimmed);
    if (!this.constantTimeEquals(apiKey.keyHash, hash)) {
      return null;
    }

    apiKey.lastUsedAt = new Date();
    await this.apiKeys.save(apiKey);
    return this.buildApiKeyRecord(apiKey);
  }

  async createWebhookEndpoint(
    organizationId: string,
    dto: CreateWebhookEndpointDto,
    createdByUserId?: string,
  ) {
    const generatedSecret =
      dto.signingSecret?.trim() || randomBytes(24).toString('hex');
    const endpoint = await this.webhookEndpoints.save(
      this.webhookEndpoints.create({
        organizationId,
        name: dto.name.trim(),
        url: dto.url.trim(),
        signingSecret: generatedSecret,
        subscribedEvents: Array.from(
          new Set((dto.subscribedEvents || ['*']).map((event) => event.trim())),
        ),
        createdByUserId: createdByUserId || null,
      }),
    );

    return {
      endpoint: this.buildWebhookEndpointRecord(endpoint),
      signingSecret: generatedSecret,
    };
  }

  async listWebhookEndpoints(organizationId: string) {
    const items = await this.webhookEndpoints.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return items.map((item) => this.buildWebhookEndpointRecord(item));
  }

  async updateWebhookEndpoint(
    id: string,
    organizationId: string,
    dto: UpdateWebhookEndpointDto,
  ) {
    const endpoint = await this.webhookEndpoints.findOne({
      where: { id, organizationId },
    });
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint not found: ${id}`);
    }

    if (dto.name !== undefined) endpoint.name = dto.name.trim();
    if (dto.url !== undefined) endpoint.url = dto.url.trim();
    if (dto.subscribedEvents !== undefined) {
      endpoint.subscribedEvents = Array.from(
        new Set(dto.subscribedEvents.map((event) => event.trim()).filter(Boolean)),
      );
    }
    if (dto.status !== undefined) endpoint.status = dto.status;

    await this.webhookEndpoints.save(endpoint);
    return this.buildWebhookEndpointRecord(endpoint);
  }

  async rotateWebhookSigningSecret(id: string, organizationId: string) {
    const endpoint = await this.webhookEndpoints.findOne({
      where: { id, organizationId },
    });
    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint not found: ${id}`);
    }

    endpoint.signingSecret = randomBytes(24).toString('hex');
    await this.webhookEndpoints.save(endpoint);

    return {
      webhook: this.buildWebhookEndpointRecord(endpoint),
      signingSecret: endpoint.signingSecret,
    };
  }

  async listWebhookDeliveries(organizationId: string, endpointId?: string) {
    const items = await this.webhookDeliveries.find({
      where: endpointId
        ? { organizationId, endpointId }
        : { organizationId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return items.map((item) => this.buildWebhookDeliveryRecord(item));
  }

  async dispatchWebhookEvent(input: WebhookEventInput) {
    const endpoints = await this.webhookEndpoints.find({
      where: {
        organizationId: input.organizationId,
        status: 'ACTIVE',
      },
    });

    const eligible = endpoints.filter((endpoint) =>
      (endpoint.subscribedEvents || []).includes('*') ||
      (endpoint.subscribedEvents || []).includes(input.eventType),
    );

    if (eligible.length === 0) {
      return { delivered: 0, skipped: 0, failed: 0 };
    }

    const results = await Promise.all(
      eligible.map(async (endpoint) => {
        const delivery = await this.webhookDeliveries.save(
          this.webhookDeliveries.create({
            endpointId: endpoint.id,
            organizationId: endpoint.organizationId,
            eventType: input.eventType,
            requestId: input.requestId || null,
            payload: input.payload,
            status: 'PENDING',
            attempts: 0,
          }),
        );

        const payload = {
          id: delivery.id,
          type: input.eventType,
          createdAt: delivery.createdAt.toISOString(),
          requestId: input.requestId || null,
          data: input.payload,
        };
        const body = JSON.stringify(payload);
        const timestamp = Date.now().toString();
        const signature = createHmac('sha256', endpoint.signingSecret)
          .update(`${timestamp}.${body}`)
          .digest('hex');

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'user-agent': 'trovan-webhooks/1.0',
              'x-trovan-event': input.eventType,
              'x-trovan-signature': signature,
              'x-trovan-timestamp': timestamp,
              'x-request-id': input.requestId || delivery.id,
            },
            body,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          delivery.attempts = 1;
          delivery.responseStatus = response.status;
          delivery.responseBody = await response.text();
          if (!response.ok) {
            delivery.status = 'FAILED';
            delivery.failureReason = `Webhook returned ${response.status}`;
            endpoint.lastFailure = delivery.failureReason;
          } else {
            delivery.status = 'DELIVERED';
            delivery.deliveredAt = new Date();
            endpoint.lastDeliveryAt = delivery.deliveredAt;
            endpoint.lastFailure = null;
          }
          await this.webhookDeliveries.save(delivery);
          await this.webhookEndpoints.save(endpoint);
          return delivery.status;
        } catch (error) {
          delivery.attempts = 1;
          delivery.status = 'FAILED';
          delivery.failureReason =
            error instanceof Error ? error.message : String(error);
          endpoint.lastFailure = delivery.failureReason;
          await this.webhookDeliveries.save(delivery);
          await this.webhookEndpoints.save(endpoint);
          this.logger.warn(
            `Webhook delivery failed for ${endpoint.url}: ${delivery.failureReason}`,
          );
          return 'FAILED';
        }
      }),
    );

    return {
      delivered: results.filter((result) => result === 'DELIVERED').length,
      skipped: 0,
      failed: results.filter((result) => result === 'FAILED').length,
    };
  }

  async replayWebhookDelivery(organizationId: string, deliveryId: string) {
    const delivery = await this.webhookDeliveries.findOne({
      where: { id: deliveryId, organizationId },
    });
    if (!delivery) {
      throw new NotFoundException(`Webhook delivery not found: ${deliveryId}`);
    }

    const endpoint = await this.webhookEndpoints.findOne({
      where: { id: delivery.endpointId, organizationId },
    });
    if (!endpoint) {
      throw new NotFoundException(
        `Webhook endpoint not found for delivery: ${delivery.endpointId}`,
      );
    }

    const payload = {
      id: delivery.id,
      type: delivery.eventType,
      createdAt: delivery.createdAt.toISOString(),
      requestId: delivery.requestId || delivery.id,
      data: delivery.payload || {},
    };
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', endpoint.signingSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'trovan-webhooks/1.0',
          'x-trovan-event': delivery.eventType,
          'x-trovan-signature': signature,
          'x-trovan-timestamp': timestamp,
          'x-request-id': delivery.requestId || delivery.id,
        },
        body,
      });

      delivery.attempts = (delivery.attempts || 0) + 1;
      delivery.responseStatus = response.status;
      delivery.responseBody = await response.text();
      if (!response.ok) {
        delivery.status = 'FAILED';
        delivery.failureReason = `Webhook returned ${response.status}`;
        endpoint.lastFailure = delivery.failureReason;
      } else {
        delivery.status = 'DELIVERED';
        delivery.deliveredAt = new Date();
        delivery.failureReason = null;
        endpoint.lastFailure = null;
        endpoint.lastDeliveryAt = delivery.deliveredAt;
      }
    } catch (error) {
      delivery.attempts = (delivery.attempts || 0) + 1;
      delivery.status = 'FAILED';
      delivery.failureReason =
        error instanceof Error ? error.message : String(error);
      endpoint.lastFailure = delivery.failureReason;
    }

    await this.webhookDeliveries.save(delivery);
    await this.webhookEndpoints.save(endpoint);
    return this.buildWebhookDeliveryRecord(delivery);
  }
}
