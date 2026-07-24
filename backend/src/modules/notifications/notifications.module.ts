import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Job } from '../jobs/entities/job.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { NotificationRetryWorker } from './notification-retry.worker';

const scheduleImports =
  process.env.ENABLE_SCHEDULER === '1' ? [ScheduleModule.forRoot()] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationDelivery, Job, Customer, Organization]),
    ...scheduleImports,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRetryWorker],
  exports: [NotificationsService, TypeOrmModule],
})
export class NotificationsModule {}
