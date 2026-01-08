import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEmail, IsOptional, Length } from 'class-validator';

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
