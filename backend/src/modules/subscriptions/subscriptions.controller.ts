import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import Stripe from 'stripe';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { Request } from 'express';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
    });
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(dto);
  }

  @Get('customers/:userId/subscriptions')
  @ApiOperation({ summary: 'Get all subscriptions for a customer' })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  async getCustomerSubscriptions(@Param('userId') userId: string) {
    return this.subscriptionsService.getCustomerSubscriptions(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  async getSubscription(@Param('id') id: string) {
    return this.subscriptionsService.getSubscription(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled' })
  async cancelSubscription(@Param('id') id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    try {
      await this.subscriptionsService.handleWebhookEvent(event);
      return { received: true };
    } catch (err) {
      this.logger.error(`Error processing webhook: ${err.message}`);
      throw err;
    }
  }
}
