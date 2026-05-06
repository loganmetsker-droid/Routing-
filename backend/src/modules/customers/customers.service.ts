import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

type Actor = {
  organizationId?: string;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

  private requireOrganizationId(actor?: Actor) {
    if (!actor?.organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    return actor.organizationId;
  }

  private scopedWhere(
    actor: Actor | undefined,
    where: FindOptionsWhere<Customer> = {},
  ): FindOptionsWhere<Customer> {
    return {
      ...where,
      organizationId: this.requireOrganizationId(actor),
    };
  }

  private normalizeCustomerPayload(
    payload: CreateCustomerDto | UpdateCustomerDto,
  ): CreateCustomerDto | UpdateCustomerDto {
    const normalized = {
      ...payload,
      defaultAddress: payload.defaultAddress ?? payload.address,
      defaultAddressStructured:
        payload.defaultAddressStructured ?? payload.addressStructured,
    } as any;

    delete normalized.address;
    delete normalized.addressStructured;

    return normalized;
  }

  async create(createCustomerDto: CreateCustomerDto, actor?: Actor): Promise<Customer> {
    const customer = this.customerRepository.create(
      {
        ...this.normalizeCustomerPayload(createCustomerDto),
        organizationId: this.requireOrganizationId(actor),
      },
    );
    return this.customerRepository.save(customer);
  }

  async findAll(actor?: Actor): Promise<Customer[]> {
    return this.customerRepository.find({
      where: this.scopedWhere(actor),
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, actor?: Actor): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: this.scopedWhere(actor, { id }),
      relations: ['jobs'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async search(query: string, actor?: Actor): Promise<Customer[]> {
    const organizationId = this.requireOrganizationId(actor);
    return this.customerRepository.find({
      where: [
        { organizationId, name: ILike(`%${query}%`) },
        { organizationId, email: ILike(`%${query}%`) },
        { organizationId, phone: ILike(`%${query}%`) },
        { organizationId, businessName: ILike(`%${query}%`) },
      ],
      order: { name: 'ASC' },
    });
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    actor?: Actor,
  ): Promise<Customer> {
    const customer = await this.findOne(id, actor);
    Object.assign(customer, this.normalizeCustomerPayload(updateCustomerDto));
    return this.customerRepository.save(customer);
  }

  async remove(id: string, actor?: Actor): Promise<void> {
    const customer = await this.findOne(id, actor);
    await this.customerRepository.softRemove(customer);
  }
}
