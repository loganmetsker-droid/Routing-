export function validateRoutingProvenance(provenance) {
  const issues = [];
  if (!provenance || typeof provenance !== 'object') {
    return ['provenance is missing'];
  }
  if (provenance.solver !== 'google-or-tools') {
    issues.push('solver must be google-or-tools');
  }
  if (!String(provenance.solver_version || '').trim()) {
    issues.push('solver_version is missing');
  }
  if (!String(provenance.matrix_provider || '').trim()) {
    issues.push('matrix_provider is missing');
  }
  if (provenance.matrix_provider === 'trovan-estimated') {
    issues.push('estimated matrix provider is not permitted');
  }
  if (provenance.matrix_mode !== 'road_network') {
    issues.push('matrix_mode must be road_network');
  }
  if (provenance.fallback_used !== false) {
    issues.push('fallback_used must be false');
  }
  if (
    !Number.isInteger(provenance.solve_duration_ms) ||
    provenance.solve_duration_ms < 0
  ) {
    issues.push('solve_duration_ms must be a non-negative integer');
  }
  if (provenance.coordinate_coverage_percent !== 100) {
    issues.push('coordinate_coverage_percent must be 100');
  }
  if (!Number.isInteger(provenance.location_count) || provenance.location_count < 3) {
    issues.push('location_count must include the depot and smoke stops');
  }
  return issues;
}

export function validateTenantIdentities(primaryUser, secondaryUser) {
  const issues = [];
  const primaryOrganizationId = String(primaryUser?.organizationId || '').trim();
  const secondaryOrganizationId = String(secondaryUser?.organizationId || '').trim();
  const privileged = new Set(['OWNER', 'ADMIN']);
  const hasPrivilegedRole = (user) =>
    Array.isArray(user?.roles) &&
    user.roles.some((role) => privileged.has(String(role).trim().toUpperCase()));

  if (!primaryOrganizationId) issues.push('primary organization id is missing');
  if (!secondaryOrganizationId) issues.push('secondary organization id is missing');
  if (
    primaryOrganizationId &&
    secondaryOrganizationId &&
    primaryOrganizationId === secondaryOrganizationId
  ) {
    issues.push('staging tenant identities must belong to different organizations');
  }
  if (!hasPrivilegedRole(primaryUser)) {
    issues.push('primary staging identity must have OWNER or ADMIN role');
  }
  if (!hasPrivilegedRole(secondaryUser)) {
    issues.push('secondary staging identity must have OWNER or ADMIN role');
  }
  return issues;
}
