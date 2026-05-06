import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

type GraphqlContext = {
  req?: {
    user?: {
      organizationId?: string;
    };
  };
};

@Resolver(() => Vehicle)
export class VehiclesResolver {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Mutation(() => Vehicle, { description: 'Create a new vehicle' })
  async createVehicle(
    @Context() context: GraphqlContext,
    @Args('input') createVehicleDto: CreateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.create(createVehicleDto, context.req?.user);
  }

  @Query(() => [Vehicle], {
    name: 'vehicles',
    description: 'Get all vehicles, optionally filtered by status or type',
  })
  async findAll(
    @Context() context: GraphqlContext,
    @Args('status', { nullable: true, description: 'Filter by status' })
    status?: string,
    @Args('type', { nullable: true, description: 'Filter by vehicle type' })
    type?: string,
  ): Promise<Vehicle[]> {
    if (status) {
      return this.vehiclesService.findByStatus(status, context.req?.user);
    }
    if (type) {
      return this.vehiclesService.findByType(type, context.req?.user);
    }
    return this.vehiclesService.findAll(context.req?.user);
  }

  @Query(() => Vehicle, {
    name: 'vehicle',
    description: 'Get a single vehicle by ID',
  })
  async findOne(
    @Context() context: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Vehicle> {
    return this.vehiclesService.findOne(id, context.req?.user);
  }

  @Query(() => [Vehicle], {
    name: 'vehiclesNeedingMaintenance',
    description: 'Get vehicles that need maintenance',
  })
  async findNeedingMaintenance(
    @Context() context: GraphqlContext,
  ): Promise<Vehicle[]> {
    return this.vehiclesService.findNeedingMaintenance(context.req?.user);
  }

  @Mutation(() => Vehicle, { description: 'Update a vehicle' })
  async updateVehicle(
    @Context() context: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateVehicleDto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.update(id, updateVehicleDto, context.req?.user);
  }

  @Mutation(() => Boolean, { description: 'Delete a vehicle (soft delete)' })
  async deleteVehicle(
    @Context() context: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.vehiclesService.remove(id, context.req?.user);
    return true;
  }
}
