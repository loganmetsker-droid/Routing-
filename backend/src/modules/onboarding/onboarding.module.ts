import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../common/audit/audit.module';
import { Depot } from '../depots/entities/depot.entity';
import { ProofArtifact } from '../dispatch/entities/proof-artifact.entity';
import { Route } from '../dispatch/entities/route.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Job } from '../jobs/entities/job.entity';
import { AppUser } from '../organizations/entities/app-user.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { OnboardingProgressEntity } from './entities/onboarding-progress.entity';
import { OnboardingController } from './onboarding.controller';
import { OnboardingEmailService } from './onboarding-email.service';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    AuditModule,
    TypeOrmModule.forFeature([
      OnboardingProgressEntity,
      Organization,
      OrganizationMembership,
      AppUser,
      Depot,
      Driver,
      Vehicle,
      Job,
      Route,
      ProofArtifact,
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingEmailService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
