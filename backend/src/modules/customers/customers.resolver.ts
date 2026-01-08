import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { CustomersService } from './customers.service';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Resolver(() => Customer)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Mutation(() => Customer, { description: 'Create a new customer' })
  async createCustomer(@Args('input') createCustomerDto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(createCustomerDto);
  }

  @Query(() => [Customer], {
    name: 'customers',
    description: 'Get all customers',
  })
  async findAll(): Promise<Customer[]> {
    return this.customersService.findAll();
  }

  @Query(() => Customer, {
    name: 'customer',
    description: 'Get a single customer by ID',
  })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Customer> {
    return this.customersService.findOne(id);
  }

  @Query(() => [Customer], {
    name: 'searchCustomers',
    description: 'Search customers by name, email, phone, or business name',
  })
  async search(@Args('query') query: string): Promise<Customer[]> {
    return this.customersService.search(query);
  }

  @Mutation(() => Customer, { description: 'Update a customer' })
  async updateCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Mutation(() => Boolean, { description: 'Delete a customer (soft delete)' })
  async deleteCustomer(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    await this.customersService.remove(id);
    return true;
  }
}
