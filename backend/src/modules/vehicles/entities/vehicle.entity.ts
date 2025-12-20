import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@Entity('vehicles')
@ObjectType()
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  // Vehicle identification
  @Column({ length: 100 })
  @Field()
  make: string;

  @Column({ length: 100 })
  @Field()
  model: string;

  @Column({ type: 'int' })
  @Field(() => Int)
  year: number;

  @Column({ name: 'license_plate', length: 20, unique: true })
  @Field()
  licensePlate: string;

  @Column({ length: 17, nullable: true })
  @Field({ nullable: true })
  vin?: string;

  // Vehicle specifications
  @Column({ name: 'vehicle_type', length: 50, default: 'van' })
  @Field()
  vehicleType: string;

  @Column({
    name: 'capacity_weight_kg',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  @Field(() => Float, { nullable: true })
  capacityWeightKg?: number;

  @Column({
    name: 'capacity_volume_m3',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  @Field(() => Float, { nullable: true })
  capacityVolumeM3?: number;

  @Column({ name: 'fuel_type', length: 20, default: 'diesel' })
  @Field()
  fuelType: string;

  // Status and tracking
  @Column({ length: 20, default: 'available' })
  @Field()
  status: string;

  @Column({
    name: 'current_location',
    type: 'jsonb',
    nullable: true,
  })
  currentLocation?: any; // Location stored as { lat: number, lng: number }

  @Column({
    name: 'current_odometer_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  @Field(() => Float)
  currentOdometerKm: number;

  @Column({ name: 'last_maintenance_date', type: 'date', nullable: true })
  @Field({ nullable: true })
  lastMaintenanceDate?: Date;

  @Column({
    name: 'next_maintenance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  @Field(() => Float, { nullable: true })
  nextMaintenanceKm?: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
