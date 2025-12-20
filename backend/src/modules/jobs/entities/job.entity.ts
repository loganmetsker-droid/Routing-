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
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
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

  @Column({ name: 'customer_name', length: 200 })
  @Field()
  customerName: string;

  @Column({ name: 'customer_phone', length: 20, nullable: true })
  @Field({ nullable: true })
  customerPhone?: string;

  @Column({ name: 'customer_email', length: 100, nullable: true })
  @Field({ nullable: true })
  customerEmail?: string;

  @Column({ name: 'pickup_address', length: 500 })
  @Field()
  pickupAddress: string;

  @Column({
    name: 'pickup_location',
    type: 'jsonb',
    nullable: true,
  })
  pickupLocation?: any;

  @Column({ name: 'delivery_address', length: 500 })
  @Field()
  deliveryAddress: string;

  @Column({
    name: 'delivery_location',
    type: 'jsonb',
    nullable: true,
  })
  deliveryLocation?: any;

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

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
