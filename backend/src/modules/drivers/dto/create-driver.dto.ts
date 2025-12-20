import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  IsArray,
  IsUUID,
  Length,
  Matches,
  IsObject,
} from 'class-validator';

export enum EmploymentStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

@InputType()
export class CreateDriverDto {
  @ApiProperty({ example: 'John', description: 'Driver first name' })
  @Field()
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Martinez', description: 'Driver last name' })
  @Field()
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({
    example: 'john.martinez@example.com',
    description: 'Driver email address',
  })
  @Field()
  @IsEmail()
  @Length(1, 255)
  email: string;

  @ApiProperty({
    example: '+1-415-555-0101',
    description: 'Driver phone number',
  })
  @Field()
  @IsString()
  @Length(1, 20)
  phone: string;

  @ApiProperty({
    example: '1985-03-15',
    description: 'Driver date of birth',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({
    example: 'DL-CA-1234567',
    description: 'Driver license number',
  })
  @Field()
  @IsString()
  @Length(1, 50)
  licenseNumber: string;

  @ApiProperty({
    example: 'C',
    description: 'Driver license class',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  licenseClass?: string;

  @ApiProperty({
    example: '2027-06-30',
    description: 'License expiry date',
  })
  @Field()
  @IsDateString()
  licenseExpiryDate: string;

  @ApiProperty({
    example: ['CDL', 'Hazmat', 'Forklift'],
    description: 'Driver certifications',
    required: false,
    type: [String],
  })
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @ApiProperty({
    example: 'EMP-001',
    description: 'Employee ID',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  employeeId?: string;

  @ApiProperty({
    example: '2020-01-15',
    description: 'Hire date',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @ApiProperty({
    enum: EmploymentStatus,
    example: EmploymentStatus.ACTIVE,
    description: 'Employment status',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'Current vehicle ID',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  currentVehicleId?: string;

  @ApiProperty({
    example: { preferred_routes: ['north_bay'], languages: ['en', 'es'] },
    description: 'Additional metadata',
    required: false,
  })
  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
