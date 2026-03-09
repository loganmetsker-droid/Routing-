import { InputType, Field } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { IsString, IsEmail, IsOptional, Length, IsObject } from 'class-validator';

@InputType()
export class CreateCustomerDto {
  @Field()
  @IsString()
  @Length(1, 200)
  name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @Length(1, 20)
  phone?: string;

  @Field({ nullable: true })
  @IsEmail()
  @IsOptional()
  email?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  defaultAddress?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  defaultAddressStructured?: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };

  // Legacy aliases accepted from existing frontend screens.
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  address?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  addressStructured?: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zip: string;
  };

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  businessName?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  exceptions?: string;
}
