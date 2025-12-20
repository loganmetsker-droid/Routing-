import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('telemetry')
@Index(['vehicleId', 'timestamp'])
@Index(['timestamp'])
export class Telemetry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle?: Vehicle;

  @Column({
    type: 'jsonb',
  })
  location: any; // Location stored as { lat: number, lng: number }

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Speed in km/h',
  })
  speed?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Heading/bearing in degrees (0-360)',
  })
  heading?: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Odometer reading in km',
  })
  odometer?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Fuel level percentage (0-100)',
  })
  fuelLevel?: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Engine temperature in Celsius',
  })
  engineTemp?: number;

  @Column({ type: 'timestamp with time zone' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true, comment: 'Additional sensor data' })
  metadata?: any;
}
