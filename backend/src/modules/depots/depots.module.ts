import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Depot } from './entities/depot.entity';
import { DepotsController } from './depots.controller';
import { DepotsService } from './depots.service';

@Module({
  imports: [TypeOrmModule.forFeature([Depot])],
  controllers: [DepotsController],
  providers: [DepotsService],
  exports: [DepotsService],
})
export class DepotsModule {}
