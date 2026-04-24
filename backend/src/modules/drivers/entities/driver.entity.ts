import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

type DriverLocation = {
  lat: number;
  lng: number;
};

@Entity('drivers')
@ObjectType()
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  @Field({ nullable: true })
  organizationId?: string;

  // Personal information
  @Column({ name: 'first_name', length: 100 })
  @Field()
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  @Field()
  lastName: string;

  @Column({ unique: true, length: 255 })
  @Field()
  email: string;

  @Column({ length: 20 })
  @Field()
  phone: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  @Field({ nullable: true })
  dateOfBirth?: Date;

  // Driver credentials
  @Column({ name: 'license_number', length: 50, unique: true })
  @Field()
  licenseNumber: string;

  @Column({ name: 'license_class', length: 10, nullable: true })
  @Field({ nullable: true })
  licenseClass?: string;

  @Column({ name: 'license_expiry_date', type: 'date' })
  @Field()
  licenseExpiryDate: Date;

  @Column({ type: 'jsonb', default: '[]' })
  @Field(() => [String])
  certifications: string[];

  // Employment information
  @Column({ name: 'employee_id', length: 50, unique: true, nullable: true })
  @Field({ nullable: true })
  employeeId?: string;

  @Column({ name: 'hire_date', type: 'date', default: () => 'CURRENT_DATE' })
  @Field()
  hireDate: Date;

  @Column({ name: 'employment_status', length: 20, default: 'active' })
  @Field()
  employmentStatus: string;

  // Current status and location
  @Column({ length: 20, default: 'off_duty' })
  @Field()
  status: string;

  @Column({
    name: 'current_location',
    type: 'jsonb',
    nullable: true,
  })
  currentLocation?: DriverLocation;

  // Roles for permissions
  @Column({ type: 'jsonb', default: '["DRIVER"]' })
  @Field(() => [String])
  roles: string[];

  // Relationship to current vehicle
  @Column({ name: 'current_vehicle_id', type: 'uuid', nullable: true })
  @Field(() => ID, { nullable: true })
  currentVehicleId?: string;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_vehicle_id' })
  @Field(() => Vehicle, { nullable: true })
  currentVehicle?: Vehicle;

  // Performance metrics
  @Column({
    name: 'total_hours_driven',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  @Field(() => Float)
  totalHoursDriven: number;

  @Column({
    name: 'total_distance_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  @Field(() => Float)
  totalDistanceKm: number;

  @Column({ name: 'total_deliveries', type: 'int', default: 0 })
  @Field(() => Int)
  totalDeliveries: number;

  @Column({
    name: 'average_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  @Field(() => Float, { nullable: true })
  averageRating?: number;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  // Virtual field for full name
  @Field()
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
