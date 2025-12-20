import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { DriversService } from './drivers.service';
import { Driver } from './entities/driver.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Resolver(() => Driver)
export class DriversResolver {
  constructor(private driversService: DriversService) {}

  @Query(() => [Driver])
  async drivers(): Promise<Driver[]> {
    return this.driversService.findAll();
  }

  @Query(() => Driver)
  async driver(@Args('id') id: string): Promise<Driver> {
    return this.driversService.findOne(id);
  }

  @Mutation(() => Driver)
  async createDriver(@Args('data') data: CreateDriverDto): Promise<Driver> {
    return this.driversService.create(data);
  }

  @Mutation(() => Driver)
  async updateDriver(
    @Args('id') id: string,
    @Args('data') data: UpdateDriverDto,
  ): Promise<Driver> {
    return this.driversService.update(id, data);
  }

  @Mutation(() => Boolean)
  async deleteDriver(@Args('id') id: string): Promise<boolean> {
    await this.driversService.remove(id);
    return true;
  }
}
