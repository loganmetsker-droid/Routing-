import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateRoutingProvenance,
  validateTenantIdentities,
} from './staging-smoke-contracts.mjs';

const valid = {
  solver: 'google-or-tools',
  solver_version: 'ortools-v2-road-matrix',
  matrix_provider: 'contracted-osrm',
  matrix_mode: 'road_network',
  fallback_used: false,
  solve_duration_ms: 18,
  coordinate_coverage_percent: 100,
  location_count: 3,
};

test('accepts complete non-fallback road-network provenance', () => {
  assert.deepEqual(validateRoutingProvenance(valid), []);
});

test('rejects estimated fallback and incomplete provenance', () => {
  const issues = validateRoutingProvenance({
    ...valid,
    matrix_provider: 'trovan-estimated',
    matrix_mode: 'estimated',
    fallback_used: true,
    coordinate_coverage_percent: 66,
  });
  assert.ok(issues.includes('estimated matrix provider is not permitted'));
  assert.ok(issues.includes('matrix_mode must be road_network'));
  assert.ok(issues.includes('fallback_used must be false'));
  assert.ok(issues.includes('coordinate_coverage_percent must be 100'));
});

test('rejects missing evidence', () => {
  assert.deepEqual(validateRoutingProvenance(null), ['provenance is missing']);
});

test('accepts two privileged identities in distinct organizations', () => {
  assert.deepEqual(
    validateTenantIdentities(
      { organizationId: 'org-primary', roles: ['ADMIN'] },
      { organizationId: 'org-secondary', roles: ['OWNER'] },
    ),
    [],
  );
});

test('rejects same-tenant or unprivileged tenant smoke identities', () => {
  const issues = validateTenantIdentities(
    { organizationId: 'org-shared', roles: ['DISPATCHER'] },
    { organizationId: 'org-shared', roles: ['VIEWER'] },
  );
  assert.ok(
    issues.includes('staging tenant identities must belong to different organizations'),
  );
  assert.ok(
    issues.includes('primary staging identity must have OWNER or ADMIN role'),
  );
  assert.ok(
    issues.includes('secondary staging identity must have OWNER or ADMIN role'),
  );
});
