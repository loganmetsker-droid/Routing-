import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Resolver(() => Vehicle)
export class VehiclesResolver {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Mutation(() => Vehicle, { description: 'Create a new vehicle' })
  async createVehicle(
    @Args('input') createVehicleDto: CreateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Query(() => [Vehicle], {
    name: 'vehicles',
    description: 'Get all vehicles, optionally filtered by status or type',
  })
  async findAll(
    @Args('status', { nullable: true, description: 'Filter by status' })
    status?: string,
    @Args('type', { nullable: true, description: 'Filter by vehicle type' })
    type?: string,
  ): Promise<Vehicle[]> {
    if (status) {
      return this.vehiclesService.findByStatus(status);
    }
    if (type) {
      return this.vehiclesService.findByType(type);
    }
    return this.vehiclesService.findAll();
  }

  @Query(() => Vehicle, {
    name: 'vehicle',
    description: 'Get a single vehicle by ID',
  })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Vehicle> {
    return this.vehiclesService.findOne(id);
  }

  @Query(() => [Vehicle], {
    name: 'vehiclesNeedingMaintenance',
    description: 'Get vehicles that need maintenance',
  })
  async findNeedingMaintenance(): Promise<Vehicle[]> {
    return this.vehiclesService.findNeedingMaintenance();
  }

  @Mutation(() => Vehicle, { description: 'Update a vehicle' })
  async updateVehicle(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateVehicleDto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.update(id, updateVehicleDto);
  }

  @Mutation(() => Boolean, { description: 'Delete a vehicle (soft delete)' })
  async deleteVehicle(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.vehiclesService.remove(id);
    return true;
  }
}
