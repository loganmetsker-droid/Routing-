import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  TRIALING = 'trialing',
  UNPAID = 'unpaid',
}

export enum SubscriptionPlan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

registerEnumType(SubscriptionStatus, { name: 'SubscriptionStatus' });
registerEnumType(SubscriptionPlan, { name: 'SubscriptionPlan' });

@ObjectType()
@Entity('subscriptions')
export class Subscription {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'user_id' })
  userId: string;

  @Field()
  @Column({ name: 'stripe_customer_id' })
  stripeCustomerId: string;

  @Field()
  @Column({ name: 'stripe_subscription_id' })
  stripeSubscriptionId: string;

  @Field(() => SubscriptionPlan)
  @Column({
    type: 'varchar',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.STARTER,
  })
  plan: SubscriptionPlan;

  @Field(() => SubscriptionStatus)
  @Column({
    type: 'varchar',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INCOMPLETE,
  })
  status: SubscriptionStatus;

  @Field()
  @Column({ name: 'current_period_start', type: 'timestamp' })
  currentPeriodStart: Date;

  @Field()
  @Column({ name: 'current_period_end', type: 'timestamp' })
  currentPeriodEnd: Date;

  @Field({ nullable: true })
  @Column({ name: 'cancel_at_period_end', default: false })
  cancelAtPeriodEnd: boolean;

  @Field({ nullable: true })
  @Column({ name: 'canceled_at', type: 'timestamp', nullable: true })
  canceledAt?: Date;

  @Field()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
