import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Job } from '../../jobs/entities/job.entity';

@Entity('customers')
@ObjectType()
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ length: 200 })
  @Field()
  name: string;

  @Column({ length: 20, nullable: true })
  @Field({ nullable: true })
  phone?: string;

  @Column({ length: 100, nullable: true })
  @Field({ nullable: true })
  email?: string;

  // Default/primary address (legacy string format)
  @Column({ type: 'text', nullable: true, name: 'default_address' })
  @Field({ nullable: true })
  defaultAddress?: string;

  // Structured default address
  @Column({
    name: 'default_address_structured',
    type: 'jsonb',
    nullable: true,
    comment: 'Structured default address: { line1, line2, city, state, zip }',
  })
  defaultAddressStructured?: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    zip: string;
  };

  @Column({ type: 'text', nullable: true, name: 'business_name' })
  @Field({ nullable: true })
  businessName?: string;

  @Column({ type: 'text', nullable: true })
  @Field({ nullable: true })
  notes?: string;

  @Column({ type: 'text', nullable: true })
  @Field({ nullable: true })
  exceptions?: string;

  // Relationship to jobs
  @OneToMany(() => Job, job => job.customerId)
  jobs?: Job[];

  @CreateDateColumn({ name: 'created_at' })
  @Field()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  @Field()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
