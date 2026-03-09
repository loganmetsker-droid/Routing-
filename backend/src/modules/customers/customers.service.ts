import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
  ) {}

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

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customerRepository.create(
      this.normalizeCustomerPayload(createCustomerDto),
    );
    return this.customerRepository.save(customer);
  }

  async findAll(): Promise<Customer[]> {
    return this.customerRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['jobs'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async search(query: string): Promise<Customer[]> {
    return this.customerRepository.find({
      where: [
        { name: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) },
        { phone: ILike(`%${query}%`) },
        { businessName: ILike(`%${query}%`) },
      ],
      order: { name: 'ASC' },
    });
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, this.normalizeCustomerPayload(updateCustomerDto));
    return this.customerRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customerRepository.softRemove(customer);
  }
}
