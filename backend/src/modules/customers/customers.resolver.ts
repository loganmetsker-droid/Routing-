import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CustomersService } from './customers.service';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type GraphqlContext = {
  req?: {
    user?: {
      organizationId?: string;
    };
  };
};

@Resolver(() => Customer)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Mutation(() => Customer, { description: 'Create a new customer' })
  async createCustomer(
    @Context() context: GraphqlContext,
    @Args('input') createCustomerDto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.create(createCustomerDto, context.req?.user);
  }

  @Query(() => [Customer], {
    name: 'customers',
    description: 'Get all customers',
  })
  async findAll(@Context() context: GraphqlContext): Promise<Customer[]> {
    return this.customersService.findAll(context.req?.user);
  }

  @Query(() => Customer, {
    name: 'customer',
    description: 'Get a single customer by ID',
  })
  async findOne(
    @Context() context: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Customer> {
    return this.customersService.findOne(id, context.req?.user);
  }

  @Query(() => [Customer], {
    name: 'searchCustomers',
    description: 'Search customers by name, email, phone, or business name',
  })
  async search(
    @Context() context: GraphqlContext,
    @Args('query') query: string,
  ): Promise<Customer[]> {
    return this.customersService.search(query, context.req?.user);
  }

  @Mutation(() => Customer, { description: 'Update a customer' })
  async updateCustomer(
    @Context() context: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(id, updateCustomerDto, context.req?.user);
  }

  @Mutation(() => Boolean, { description: 'Delete a customer (soft delete)' })
  async deleteCustomer(
    @Context() context: GraphqlContext,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    await this.customersService.remove(id, context.req?.user);
    return true;
  }
}
