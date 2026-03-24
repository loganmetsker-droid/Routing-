import { Route } from './entities/route.entity';
import { Job } from '../jobs/entities/job.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { RerouteAction } from './entities/reroute-request.entity';

export type PackDiagnosticReasonCode = string;

export type PackDiagnostics = {
  packId: string;
  feasible: boolean;
  reasonCodes: PackDiagnosticReasonCode[];
  warnings: string[];
  details?: Record<string, any>;
};

export type PackConstraintContext = {
  route: Pick<Route, 'id' | 'status' | 'routeData'>;
  action: RerouteAction;
  payload?: Record<string, any>;
  beforeSnapshot: { jobIds?: string[] };
  afterSnapshot: { jobIds?: string[]; dataQuality?: string };
  jobs: Job[];
  vehicle: Vehicle | null;
  driver: Driver | null;
};

export interface ConstraintPack {
  id: string;
  label: string;
  applies: (ctx: PackConstraintContext) => boolean;
  evaluate: (ctx: PackConstraintContext) => PackDiagnostics;
}

const registry = new Map<string, ConstraintPack>();

export const registerConstraintPack = (pack: ConstraintPack) => {
  registry.set(pack.id, pack);
};

export const getConstraintPack = (id?: string | null): ConstraintPack | null => {
  if (!id) return null;
  return registry.get(id) || null;
};

export const getRegisteredConstraintPacks = (): ConstraintPack[] =>
  Array.from(registry.values());

