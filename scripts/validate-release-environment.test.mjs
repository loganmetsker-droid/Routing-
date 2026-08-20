import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commonReleaseEnvironmentNames,
  productionReleaseEnvironmentNames,
  stagingReleaseEnvironmentNames,
  validateReleaseEnvironment,
} from './validate-release-environment.mjs';

const configuredEnvironment = (names) =>
  Object.fromEntries(names.map((name) => [name, `configured-${name}`]));

test('accepts a complete staging release environment without returning values', () => {
  const environment = configuredEnvironment([
    ...commonReleaseEnvironmentNames,
    ...stagingReleaseEnvironmentNames,
  ]);
  environment.RENDER_API_KEY = 'super-secret-render-value';

  const result = validateReleaseEnvironment('staging', environment);

  assert.deepEqual(result, {
    ok: true,
    target: 'staging',
    missing: [],
    issues: [],
  });
  assert.doesNotMatch(JSON.stringify(result), /super-secret-render-value/);
});

test('reports only missing staging names in stable order', () => {
  const environment = configuredEnvironment([
    ...commonReleaseEnvironmentNames,
    ...stagingReleaseEnvironmentNames,
  ]);
  delete environment.CLOUDFLARE_API_TOKEN;
  environment.RENDER_ROUTING_SERVICE_ID = '   ';
  delete environment.STAGING_SECOND_ORG_AUTH_TOKEN;

  const result = validateReleaseEnvironment('staging', environment);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'CLOUDFLARE_API_TOKEN',
    'RENDER_ROUTING_SERVICE_ID',
    'STAGING_SECOND_ORG_AUTH_TOKEN',
  ]);
});

test('production requires common deployment inputs and current launch evidence', () => {
  const environment = configuredEnvironment([
    ...commonReleaseEnvironmentNames,
    ...productionReleaseEnvironmentNames,
  ]);
  assert.equal(validateReleaseEnvironment('production', environment).ok, true);

  delete environment.LAUNCH_GATE_EVIDENCE_JSON;
  assert.deepEqual(
    validateReleaseEnvironment('production', environment).missing,
    ['LAUNCH_GATE_EVIDENCE_JSON'],
  );
});

test('rejects an unknown release target', () => {
  assert.deepEqual(validateReleaseEnvironment('preview', {}), {
    ok: false,
    target: 'preview',
    missing: [],
    issues: ['DEPLOY_TARGET must be staging or production'],
  });
});
