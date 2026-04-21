import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

export enum JobStatus {
  UNSCHEDULED = 'unscheduled', // new lifecycle state
  SCHEDULED = 'scheduled',     // new lifecycle state
  PENDING = 'pending',          // legacy - maps to unscheduled
  ASSIGNED = 'assigned',        // legacy - maps to scheduled
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',        // new lifecycle state
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum BillingStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
}

export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('jobs')
@ObjectType()
@Index(['status', 'priority'])
@Index(['timeWindowStart', 'timeWindowEnd'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  @Field({ nullable: true })
  organizationId?: string;

  @Column({ name: 'customer_name', length: 200 })
  @Field()
  customerName: string;

  @Column({ name: 'customer_phone', length: 20, nullable: true })
  @Field({ nullable: true })
  customerPhone?: string;

  @Column({ name: 'customer_email', length: 100, nullable: true })
  @Field({ nullable: true })
  customerEmail?: string;

  // Legacy address fields (kept for backward compatibility)
  @Column({ name: 'pickup_address', length: 500 })
  @Field()
  pickupAddress: string;

  @Column({ name: 'delivery_address', length: 500 })
  @Field()
  deliveryAddress: string;

  // Structured address fields
  @Column({
    name: 'pickup_address_structured',
    type: 'jsonb',
    nullable: true,
    comment: 'Structured pickup address: { line1, line2, city, state, zip }',
  })
  pickupAddressStructured?: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  };

  @Column({
    name: 'delivery_address_structured',
    type: 'jsonb',
    nullable: true,
    comment: 'Structured delivery address: { line1, line2, city, state, zip }',
  })
  deliveryAddressStructured?: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  };

  // Geocoded locations
  @Column({
    name: 'pickup_location',
    type: 'jsonb',
    nullable: true,
    comment: 'Pickup coordinates: { lat, lng }',
  })
  pickupLocation?: { lat: number; lng: number };

  @Column({
    name: 'delivery_location',
    type: 'jsonb',
    nullable: true,
    comment: 'Delivery coordinates: { lat, lng }',
  })
  deliveryLocation?: { lat: number; lng: number };

  @Column({ name: 'time_window_start', type: 'timestamp with time zone' })
  @Field()
  timeWindowStart: Date;

  @Column({ name: 'time_window_end', type: 'timestamp with time zone' })
  @Field()
  timeWindowEnd: Date;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Weight in kg',
  })
  @Field(() => Float, { nullable: true })
  weight?: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Volume in cubic meters',
  })
  @Field(() => Float, { nullable: true })
  volume?: number;

  @Column({ type: 'int', nullable: true, comment: 'Number of packages/items' })
  @Field(() => Int, { nullable: true })
  quantity?: number;

  @Column({
    type: 'enum',
    enum: JobPriority,
    default: JobPriority.NORMAL,
  })
  @Field()
  priority: JobPriority;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  @Field()
  status: JobStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Estimated duration in minutes',
  })
  @Field(() => Float, { nullable: true })
  estimatedDuration?: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Actual duration in minutes',
  })
  @Field(() => Float, { nullable: true })
  actualDuration?: number;

  @Column({ type: 'text', nullable: true })
  @Field({ nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true, comment: 'Special handling instructions' })
  @Field({ nullable: true })
  specialInstructions?: string;

  @Column({ name: 'assigned_route_id', type: 'uuid', nullable: true })
  @Field({ nullable: true })
  assignedRouteId?: string;

  // Multi-day job support
  @Column({
    name: 'start_date',
    type: 'timestamp with time zone',
    nullable: true,
    comment: 'Actual start date/time for multi-day jobs',
  })
  @Field({ nullable: true })
  startDate?: Date;

  @Column({
    name: 'end_date',
    type: 'timestamp with time zone',
    nullable: true,
    comment: 'End date/time for multi-day jobs (null = same-day)',
  })
  @Field({ nullable: true })
  endDate?: Date;

  // Billing tracking (no payment processing)
  @Column({
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.UNPAID,
    name: 'billing_status',
  })
  @Field()
  billingStatus: BillingStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'billing_amount',
    comment: 'Amount to bill (no payment processing)',
  })
  @Field(() => Float, { nullable: true })
  billingAmount?: number;

  @Column({ type: 'text', nullable: true, name: 'billing_notes' })
  @Field({ nullable: true })
  billingNotes?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'invoice_ref' })
  @Field({ nullable: true })
  invoiceRef?: string;

  // Customer reference for reuse
  @Column({ type: 'uuid', nullable: true, name: 'customer_id' })
  @Field({ nullable: true })
  customerId?: string;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  completedAt?: Date;

  @Column({ name: 'archived_at', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  archivedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
