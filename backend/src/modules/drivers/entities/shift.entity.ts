import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Driver } from './driver.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

type ShiftLocation = {
  lat: number;
  lng: number;
};

@Entity('shifts')
@ObjectType()
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  // Shift associations
  @Column({ name: 'driver_id', type: 'uuid' })
  @Field(() => ID)
  driverId: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  @Field(() => Driver)
  driver: Driver;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  @Field(() => ID, { nullable: true })
  vehicleId?: string;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  @Field(() => Vehicle, { nullable: true })
  vehicle?: Vehicle;

  // Shift timing
  @Column({ name: 'shift_date', type: 'date' })
  @Field()
  shiftDate: Date;

  @Column({ name: 'scheduled_start', type: 'timestamp with time zone' })
  @Field()
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamp with time zone' })
  @Field()
  scheduledEnd: Date;

  @Column({ name: 'actual_start', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  actualStart?: Date;

  @Column({ name: 'actual_end', type: 'timestamp with time zone', nullable: true })
  @Field({ nullable: true })
  actualEnd?: Date;

  // Shift details
  @Column({ name: 'shift_type', length: 20, default: 'regular' })
  @Field()
  shiftType: string;

  @Column({ length: 20, default: 'scheduled' })
  @Field()
  status: string;

  // Location tracking
  @Column({
    name: 'start_location',
    type: 'jsonb',
    nullable: true,
  })
  startLocation?: ShiftLocation;

  @Column({
    name: 'end_location',
    type: 'jsonb',
    nullable: true,
  })
  endLocation?: ShiftLocation;

  // Break tracking
  @Column({ name: 'total_break_minutes', type: 'int', default: 0 })
  @Field(() => Int)
  totalBreakMinutes: number;

  @Column({ type: 'jsonb', default: '[]' })
  breaks?: Array<Record<string, unknown>>;

  // Performance metrics
  @Column({
    name: 'distance_covered_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  @Field(() => Float, { nullable: true })
  distanceCoveredKm?: number;

  @Column({ name: 'deliveries_completed', type: 'int', default: 0 })
  @Field(() => Int)
  deliveriesCompleted: number;

  @Column({
    name: 'fuel_consumed_liters',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  @Field(() => Float, { nullable: true })
  fuelConsumedLiters?: number;

  // Notes and metadata
  @Column({ type: 'text', nullable: true })
  @Field({ nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;
}
