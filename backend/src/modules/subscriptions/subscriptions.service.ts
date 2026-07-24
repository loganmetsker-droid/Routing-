import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
} from './entities/subscription.entity';
import { StripeWebhookEvent } from './entities/stripe-webhook-event.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { assistedPilotPlanCatalog } from '../../../../shared/contracts';

type BillingActor = {
  userId?: string;
  email?: string;
  organizationId?: string;
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private stripe: Stripe;
  private readonly planCatalog = assistedPilotPlanCatalog.map((plan) => ({
    ...plan,
    plan: plan.plan as SubscriptionPlan,
  }));

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(StripeWebhookEvent)
    private readonly stripeWebhookEvents: Repository<StripeWebhookEvent>,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    // Only initialize Stripe if a valid API key is provided
    if (stripeSecretKey && !stripeSecretKey.includes('your_stripe_secret_key')) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2026-02-25.clover',
      });
      this.logger.log('Stripe initialized successfully');
    } else {
      this.logger.warn('Stripe API key not configured - subscription features disabled');
      // Create a mock Stripe instance to prevent errors
      this.stripe = null as any;
    }
  }

  private isStripeConfigured() {
    return Boolean(this.stripe);
  }

  private isSelfServeBillingEnabled() {
    return (
      this.configService.get<string>('SELF_SERVE_BILLING_ENABLED', 'false') ===
      'true'
    );
  }

  private getStripePriceId(plan: SubscriptionPlan) {
    if (plan === SubscriptionPlan.STARTER) {
      return (
        this.configService.get<string>('STRIPE_PRICE_LAUNCH') ||
        this.configService.get<string>('STRIPE_PRICE_STARTER')
      );
    }
    if (plan === SubscriptionPlan.PROFESSIONAL) {
      return (
        this.configService.get<string>('STRIPE_PRICE_SCALE') ||
        this.configService.get<string>('STRIPE_PRICE_PROFESSIONAL')
      );
    }
    return undefined;
  }

  private getSerializedPlans() {
    const selfServeEnabled = this.isSelfServeBillingEnabled();
    return this.planCatalog.map((plan) => ({
      ...plan,
      selfServeEnabled:
        selfServeEnabled && plan.plan !== SubscriptionPlan.ENTERPRISE,
      stripePriceConfigured: Boolean(this.getStripePriceId(plan.plan)),
    }));
  }

  private requireOrganizationId(organizationId?: string): string {
    if (!organizationId) {
      throw new BadRequestException('Billing operations require an organization context');
    }
    return organizationId;
  }

  getPlanCatalog() {
    return {
      stripeConfigured: this.isStripeConfigured(),
      billingMode: this.isSelfServeBillingEnabled()
        ? 'self_serve'
        : 'assisted_pilot',
      plans: this.getSerializedPlans(),
    };
  }

  async getBillingOverview({
    userId,
    email,
    organizationId,
  }: {
    userId?: string;
    email?: string;
    organizationId?: string;
  }) {
    const subscriptions = userId
      ? await this.getCustomerSubscriptions(userId, organizationId)
      : [];
    const activeSubscription =
      subscriptions.find((subscription) =>
        [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING].includes(
          subscription.status,
        ),
      ) || subscriptions[0] || null;

    return {
      generatedAt: new Date().toISOString(),
      stripeConfigured: this.isStripeConfigured(),
      organizationId: organizationId || null,
      billingContactEmail: email || null,
      activeSubscription,
      subscriptions,
      billingMode: this.isSelfServeBillingEnabled()
        ? 'self_serve'
        : 'assisted_pilot',
      plans: this.getSerializedPlans(),
      controls: {
        selfServeEnabled: this.isSelfServeBillingEnabled(),
        invoiceAutomationReady:
          this.isSelfServeBillingEnabled() && this.isStripeConfigured(),
        failedPaymentHandlingReady:
          this.isStripeConfigured() &&
          Boolean(this.configService.get<string>('STRIPE_WEBHOOK_SECRET')),
        webhookConfigured: Boolean(
          this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
        ),
      },
      recommendations: this.isSelfServeBillingEnabled()
        ? this.isStripeConfigured()
          ? []
          : [
              'Configure STRIPE_SECRET_KEY and Launch/Scale price IDs before enabling paid self-serve billing.',
            ]
        : [
            'Assisted-pilot billing is active. Public checkout and automated entitlements are intentionally disabled.',
          ],
    };
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    dto: CreateSubscriptionDto,
    actor: BillingActor = {},
  ): Promise<{ subscription: Subscription; clientSecret: string }> {
    if (!this.isSelfServeBillingEnabled()) {
      throw new ForbiddenException(
        'Self-service billing is disabled. Contact Trovan to start or change an assisted pilot.',
      );
    }
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    if (dto.plan === SubscriptionPlan.ENTERPRISE) {
      throw new BadRequestException(
        'Enterprise billing requires a signed custom order form.',
      );
    }
    const stripePriceId = this.getStripePriceId(dto.plan);
    if (!stripePriceId) {
      throw new BadRequestException(
        `Stripe price is not configured for ${dto.plan}`,
      );
    }

    const organizationId = this.requireOrganizationId(actor.organizationId);
    const userId = actor.userId || dto.userId;
    const email = actor.email || dto.email;

    this.logger.log(`Creating subscription for user ${userId}`);

    // Check if customer already exists
    let customer: Stripe.Customer;
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { userId, organizationId },
    });

    if (existingSubscription) {
      customer = await this.stripe.customers.retrieve(
        existingSubscription.stripeCustomerId,
      ) as Stripe.Customer;
    } else {
      // Create Stripe customer
      customer = await this.stripe.customers.create({
        email,
        metadata: { userId, organizationId },
      });
    }

    // Attach payment method to customer
    await this.stripe.paymentMethods.attach(dto.paymentMethodId, {
      customer: customer.id,
    });

    // Set as default payment method
    await this.stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: dto.paymentMethodId,
      },
    });

    // Create Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId, organizationId },
    });

    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

    // Save subscription to database
    const subscription = this.subscriptionRepository.create({
      userId,
      organizationId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      plan: dto.plan,
      status: stripeSubscription.status as SubscriptionStatus,
      currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: (stripeSubscription as any).cancel_at_period_end,
    });

    await this.subscriptionRepository.save(subscription);

    return {
      subscription,
      clientSecret: paymentIntent.client_secret,
    };
  }

  /**
   * Get customer subscriptions
   */
  async getCustomerSubscriptions(
    userId: string,
    organizationId?: string,
  ): Promise<Subscription[]> {
    const scopedOrganizationId = this.requireOrganizationId(organizationId);
    return this.subscriptionRepository.find({
      where: { userId, organizationId: scopedOrganizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string, organizationId?: string): Promise<Subscription> {
    const scopedOrganizationId = this.requireOrganizationId(organizationId);
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, organizationId: scopedOrganizationId },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    id: string,
    organizationId?: string,
  ): Promise<Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    const subscription = await this.getSubscription(id, organizationId);

    // Cancel at period end in Stripe
    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    subscription.cancelAtPeriodEnd = true;
    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (!this.stripe) {
      this.logger.warn('Stripe webhook received but Stripe is not configured');
      return;
    }

    if (event.id) {
      const existing = await this.stripeWebhookEvents.findOne({
        where: { stripeEventId: event.id },
      });
      if (existing?.processedAt) {
        this.logger.log(`Ignoring duplicate Stripe webhook event ${event.type}`);
        return;
      }
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    const webhookRecord = event.id
      ? this.stripeWebhookEvents.create({
          stripeEventId: event.id,
          eventType: event.type,
          livemode: Boolean(event.livemode),
          processedAt: null,
        })
      : null;

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }

      if (webhookRecord) {
        webhookRecord.processedAt = new Date();
        await this.stripeWebhookEvents.save(webhookRecord);
      }
    } catch (error) {
      if (webhookRecord) {
        webhookRecord.errorMessage =
          error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
        await this.stripeWebhookEvents.save(webhookRecord);
      }
      throw error;
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: (invoice as any).subscription as string },
    });

    if (subscription) {
      subscription.status = SubscriptionStatus.ACTIVE;
      await this.subscriptionRepository.save(subscription);
      this.logger.log(`Payment succeeded for subscription ${subscription.id}`);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: (invoice as any).subscription as string },
    });

    if (subscription) {
      subscription.status = SubscriptionStatus.PAST_DUE;
      await this.subscriptionRepository.save(subscription);
      this.logger.warn(`Payment failed for subscription ${subscription.id}`);
    }
  }

  private async handleSubscriptionUpdated(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (subscription) {
      subscription.status = stripeSubscription.status as SubscriptionStatus;
      subscription.currentPeriodStart = new Date(
        (stripeSubscription as any).current_period_start * 1000,
      );
      subscription.currentPeriodEnd = new Date(
        (stripeSubscription as any).current_period_end * 1000,
      );
      subscription.cancelAtPeriodEnd = (stripeSubscription as any).cancel_at_period_end;

      await this.subscriptionRepository.save(subscription);
      this.logger.log(`Subscription ${subscription.id} updated`);
    }
  }

  private async handleSubscriptionDeleted(
    stripeSubscription: Stripe.Subscription,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (subscription) {
      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = new Date();
      await this.subscriptionRepository.save(subscription);
      this.logger.log(`Subscription ${subscription.id} canceled`);
    }
  }
}
