import { pathToFileURL } from 'node:url';

export const commonReleaseEnvironmentNames = [
  'BACKEND_URL',
  'FRONTEND_URL',
  'ROUTING_SERVICE_URL',
  'WEBSOCKET_URL',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'RENDER_API_KEY',
  'RENDER_BACKEND_SERVICE_ID',
  'RENDER_ROUTING_SERVICE_ID',
];

export const stagingReleaseEnvironmentNames = [
  'STAGING_AUTH_TOKEN',
  'STAGING_SECOND_ORG_AUTH_TOKEN',
  'STAGING_DRIVER_AUTH_TOKEN',
  'STAGING_EXPIRED_AUTH_TOKEN',
  'METRICS_TOKEN',
  'ROUTING_SERVICE_INTERNAL_TOKEN',
  'WORKOS_TEST_EMAIL',
  'WORKOS_TEST_PASSWORD',
  'WORKOS_CLIENT_ID',
  'WORKOS_API_KEY',
  'WORKOS_REDIRECT_URI',
  'WORKOS_LOGOUT_REDIRECT_URI',
  'ROUTING_MATRIX_BASE_URL',
  'ROUTING_MATRIX_PROVIDER_LABEL',
  'ROUTING_MATRIX_TOKEN',
  'TROVAN_SOLVER_VERSION',
  'GEOCODING_API_KEY',
  'ERROR_MONITORING_WEBHOOK_URL',
  'ERROR_MONITORING_WEBHOOK_TOKEN',
  'ERROR_MONITORING_TEST_READBACK_URL',
  'ERROR_MONITORING_TEST_ACK_URL',
  'ACCESS_CODE_ENCRYPTION_KEY',
  'ACCESS_CODE_KEY_VERSION',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_LAUNCH',
  'STRIPE_PRICE_SCALE',
  'STAGING_WEBHOOK_RECEIVER_URL',
  'POSTMARK_SERVER_TOKEN',
  'POSTMARK_FROM_EMAIL',
  'LEAD_INTAKE_EMAIL',
  'LEAD_INTAKE_FROM_EMAIL',
  'POSTMARK_BOUNCE_WEBHOOK_URL',
  'POSTMARK_WEBHOOK_USERNAME',
  'POSTMARK_WEBHOOK_PASSWORD',
  'POSTMARK_BOUNCE_HASH_KEY',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
];

export const productionReleaseEnvironmentNames = [
  'LAUNCH_GATE_EVIDENCE_JSON',
];

export function validateReleaseEnvironment(target, environment = process.env) {
  if (!['staging', 'production'].includes(target)) {
    return {
      ok: false,
      target,
      missing: [],
      issues: ['DEPLOY_TARGET must be staging or production'],
    };
  }

  const required = [
    ...commonReleaseEnvironmentNames,
    ...(target === 'staging'
      ? stagingReleaseEnvironmentNames
      : productionReleaseEnvironmentNames),
  ];
  const missing = required.filter((name) => !String(environment[name] || '').trim());

  return {
    ok: missing.length === 0,
    target,
    missing,
    issues: missing.length
      ? ['Configure every missing name in the protected GitHub environment or an authorized repository/organization scope.']
      : [],
  };
}

export function formatGitHubError(result) {
  if (result.ok) return '';
  const detail = result.missing.length
    ? `Missing names: ${result.missing.join(', ')}`
    : result.issues.join('; ');
  return `::error title=Release environment preflight failed::${detail}`;
}

function main() {
  const target = process.argv[2] || process.env.DEPLOY_TARGET || '';
  const result = validateReleaseEnvironment(target);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.error(formatGitHubError(result));
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
