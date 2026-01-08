// Central enum registration for GraphQL
// Import this file once in jobs.module.ts to register all enums
import { registerEnumType } from '@nestjs/graphql';
import { JobStatus, JobPriority, BillingStatus } from './entities/job.entity';

// Register all job-related enums
registerEnumType(JobStatus, {
  name: 'JobStatus',
  description: 'Job lifecycle status',
});

registerEnumType(JobPriority, {
  name: 'JobPriority',
  description: 'Job priority level',
});

registerEnumType(BillingStatus, {
  name: 'BillingStatus',
  description: 'Billing payment status',
});
