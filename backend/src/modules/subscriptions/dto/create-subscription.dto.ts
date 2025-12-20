import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsEnum, IsEmail } from 'class-validator';
import { SubscriptionPlan } from '../entities/subscription.entity';

@InputType()
export class CreateSubscriptionDto {
  @Field()
  @IsString()
  userId: string;

  @Field()
  @IsEmail()
  email: string;

  @Field(() => SubscriptionPlan)
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @Field()
  @IsString()
  paymentMethodId: string;
}
