import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

export enum RouteStatus {
  PLANNED = 'planned',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('routes')
@ObjectType()
@Index(['status', 'createdAt'])
export class Route {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  @Field()
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle?: Vehicle;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  @Field({ nullable: true })
  driverId?: string;

  @Column({ type: 'jsonb', comment: 'Array of job UUIDs in optimized order' })
  @Field(() => [String])
  jobIds: string[];

  @Column({
    type: 'jsonb',
    nullable: true,
    comment: 'Full route optimization response from routing-service',
  })
  @Field(() => GraphQLJSON, { nullable: true })
  routeData?: any;

  @Column({
    type: 'enum',
    enum: RouteStatus,
    default: RouteStatus.PLANNED,
  })
  @Field()
  status: RouteStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Total distance in kilometers',
  })
  @Field(() => Float, { nullable: true })
  totalDistanceKm?: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Total estimated duration in minutes',
  })
  @Field(() => Float, { nullable: true })
  totalDurationMinutes?: number;

  @Column({ type: 'int', default: 0 })
  @Field(() => Int)
  jobCount: number;

  @Column({ name: 'planned_start', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  plannedStart?: Date;

  @Column({ name: 'actual_start', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  actualStart?: Date;

  @Column({ name: 'completed_at', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  @Field({ nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
