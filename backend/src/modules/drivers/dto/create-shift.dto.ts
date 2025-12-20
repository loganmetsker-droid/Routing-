import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field, Int, Float } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

export enum ShiftType {
  REGULAR = 'regular',
  OVERTIME = 'overtime',
  SPLIT = 'split',
  ON_CALL = 'on_call',
  EMERGENCY = 'emergency',
}

@InputType()
export class CreateShiftDto {
  @ApiProperty({
    example: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    description: 'Driver ID',
  })
  @Field()
  @IsUUID()
  driverId: string;

  @ApiProperty({
    example: '22222222-2222-2222-2222-222222222222',
    description: 'Vehicle ID',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiProperty({
    example: '2024-12-20',
    description: 'Shift date',
  })
  @Field()
  @IsDateString()
  shiftDate: string;

  @ApiProperty({
    example: '2024-12-20T08:00:00Z',
    description: 'Scheduled start time',
  })
  @Field()
  @IsDateString()
  scheduledStart: string;

  @ApiProperty({
    example: '2024-12-20T16:00:00Z',
    description: 'Scheduled end time',
  })
  @Field()
  @IsDateString()
  scheduledEnd: string;

  @ApiProperty({
    enum: ShiftType,
    example: ShiftType.REGULAR,
    description: 'Type of shift',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;

  @ApiProperty({
    example: 'Morning delivery route',
    description: 'Shift notes',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: { route: 'north_bay' },
    description: 'Additional metadata',
    required: false,
  })
  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;
}
