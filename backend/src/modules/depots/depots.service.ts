import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Depot } from './entities/depot.entity';
import { CreateDepotDto } from './dto/create-depot.dto';

@Injectable()
export class DepotsService {
  constructor(@InjectRepository(Depot) private readonly depots: Repository<Depot>) {}

  create(dto: CreateDepotDto) {
    return this.depots.save(this.depots.create(dto));
  }

  findAll(organizationId?: string) {
    return this.depots.find({ where: organizationId ? { organizationId } : {}, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string, organizationId?: string) {
    const depot = await this.depots.findOne({ where: { id, ...(organizationId ? { organizationId } : {}) } as any });
    if (!depot) throw new NotFoundException(`Depot not found: ${id}`);
    return depot;
  }
}
