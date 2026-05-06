import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { DriversService } from './drivers.service';
import { Driver } from './entities/driver.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

type GraphqlContext = {
  req?: {
    user?: {
      organizationId?: string;
    };
  };
};

@Resolver(() => Driver)
export class DriversResolver {
  constructor(private driversService: DriversService) {}

  @Query(() => [Driver])
  async drivers(@Context() context: GraphqlContext): Promise<Driver[]> {
    return this.driversService.findAll(context.req?.user);
  }

  @Query(() => Driver)
  async driver(
    @Context() context: GraphqlContext,
    @Args('id') id: string,
  ): Promise<Driver> {
    return this.driversService.findOne(id, context.req?.user);
  }

  @Mutation(() => Driver)
  async createDriver(
    @Context() context: GraphqlContext,
    @Args('data') data: CreateDriverDto,
  ): Promise<Driver> {
    return this.driversService.create(data, context.req?.user);
  }

  @Mutation(() => Driver)
  async updateDriver(
    @Context() context: GraphqlContext,
    @Args('id') id: string,
    @Args('data') data: UpdateDriverDto,
  ): Promise<Driver> {
    return this.driversService.update(id, data, context.req?.user);
  }

  @Mutation(() => Boolean)
  async deleteDriver(
    @Context() context: GraphqlContext,
    @Args('id') id: string,
  ): Promise<boolean> {
    await this.driversService.remove(id, context.req?.user);
    return true;
  }
}
