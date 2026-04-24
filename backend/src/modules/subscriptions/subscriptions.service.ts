import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionPlan,
} from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private stripe: Stripe;
  private readonly planCatalog = [
    {
      plan: SubscriptionPlan.STARTER,
      label: 'Starter',
      monthlyPriceUsd: 149,
      dispatcherSeats: 3,
      features: [
        'Dispatcher web workspace',
        'Driver PWA',
        'Public tracking links',
        'Core analytics',
      ],
    },
    {
      plan: SubscriptionPlan.PROFESSIONAL,
      label: 'Professional',
      monthlyPriceUsd: 399,
      dispatcherSeats: 15,
      features: [
        'Advanced analytics',
        'Exception workflows',
        'Route history and audit exports',
        'Priority support',
      ],
    },
    {
      plan: SubscriptionPlan.ENTERPRISE,
      label: 'Enterprise',
      monthlyPriceUsd: 999,
      dispatcherSeats: 999,
      features: [
        'SSO-ready deployment',
        'Tenant branding controls',
        'Audit and security posture visibility',
        'Enterprise rollout support',
      ],
    },
  ] as const;

  // Price IDs from Stripe Dashboard
  private readonly priceMap = {
    [SubscriptionPlan.STARTER]: process.env.STRIPE_PRICE_STARTER,
    [SubscriptionPlan.PROFESSIONAL]: process.env.STRIPE_PRICE_PROFESSIONAL,
    [SubscriptionPlan.ENTERPRISE]: process.env.STRIPE_PRICE_ENTERPRISE,
  };

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
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

  getPlanCatalog() {
    return {
      stripeConfigured: this.isStripeConfigured(),
      plans: this.planCatalog.map((plan) => ({
        ...plan,
        stripePriceConfigured: Boolean(this.priceMap[plan.plan]),
      })),
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
      ? await this.getCustomerSubscriptions(userId)
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
      plans: this.planCatalog.map((plan) => ({
        ...plan,
        stripePriceConfigured: Boolean(this.priceMap[plan.plan]),
      })),
      controls: {
        invoiceAutomationReady: this.isStripeConfigured(),
        failedPaymentHandlingReady: this.isStripeConfigured(),
        webhookConfigured: Boolean(
          this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
        ),
      },
      recommendations: this.isStripeConfigured()
        ? []
        : [
            'Configure STRIPE_SECRET_KEY and plan price IDs before enabling paid self-serve billing.',
          ],
    };
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    dto: CreateSubscriptionDto,
  ): Promise<{ subscription: Subscription; clientSecret: string }> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    this.logger.log(`Creating subscription for user ${dto.userId}`);

    // Check if customer already exists
    let customer: Stripe.Customer;
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { userId: dto.userId },
    });

    if (existingSubscription) {
      customer = await this.stripe.customers.retrieve(
        existingSubscription.stripeCustomerId,
      ) as Stripe.Customer;
    } else {
      // Create Stripe customer
      customer = await this.stripe.customers.create({
        email: dto.email,
        metadata: { userId: dto.userId },
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
      items: [{ price: this.priceMap[dto.plan] }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

    // Save subscription to database
    const subscription = this.subscriptionRepository.create({
      userId: dto.userId,
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
  async getCustomerSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(id: string): Promise<Subscription> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }

    const subscription = await this.getSubscription(id);

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

    this.logger.log(`Processing webhook event: ${event.type}`);

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
