const groups = {
  renderAccess: {
    anyOf: ['RENDER_API_KEY', 'RENDER_API_TOKEN', 'RENDER_TOKEN'],
  },
  staging: {
    allOf: [
      'STAGING_FRONTEND_URL',
      'STAGING_BACKEND_URL',
      'STAGING_ROUTING_SERVICE_URL',
      'STAGING_AUTH_TOKEN',
      'STAGING_SECOND_ORG_AUTH_TOKEN',
      'STAGING_DRIVER_AUTH_TOKEN',
      'METRICS_TOKEN',
    ],
  },
  workosSmoke: {
    allOf: [
      'WORKOS_TEST_EMAIL',
      'WORKOS_TEST_PASSWORD',
      'STAGING_EXPIRED_AUTH_TOKEN',
    ],
  },
  workosHosted: {
    allOf: [
      'WORKOS_CLIENT_ID',
      'WORKOS_API_KEY',
      'WORKOS_REDIRECT_URI',
      'WORKOS_LOGOUT_REDIRECT_URI',
    ],
  },
  routingProvider: {
    allOf: [
      'ROUTING_MATRIX_PROVIDER',
      'ROUTING_MATRIX_BASE_URL',
      'ROUTING_MATRIX_PROVIDER_LABEL',
      'ROUTING_MATRIX_TOKEN',
      'TROVAN_SOLVER_VERSION',
    ],
  },
  geocodingProvider: {
    allOf: ['GEOCODING_PROVIDER', 'GEOCODING_API_KEY'],
  },
  errorMonitoring: {
    allOf: [
      'ERROR_MONITORING_WEBHOOK_URL',
      'ERROR_MONITORING_WEBHOOK_TOKEN',
      'ERROR_MONITORING_TEST_READBACK_URL',
      'ERROR_MONITORING_TEST_ACK_URL',
    ],
  },
  accessCodeProtection: {
    allOf: ['ACCESS_CODE_ENCRYPTION_KEY', 'ACCESS_CODE_KEY_VERSION'],
  },
  stripeSmoke: {
    allOf: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_LAUNCH',
      'STRIPE_PRICE_SCALE',
      'STRIPE_ALLOW_TEST_EXERCISE',
    ],
  },
  webhookSmoke: {
    allOf: ['STAGING_WEBHOOK_RECEIVER_URL'],
  },
  emailSmoke: {
    allOf: [
      'POSTMARK_SERVER_TOKEN',
      'POSTMARK_FROM_EMAIL',
      'LEAD_INTAKE_EMAIL',
      'LEAD_INTAKE_FROM_EMAIL',
      'POSTMARK_BOUNCE_WEBHOOK_URL',
      'POSTMARK_WEBHOOK_USERNAME',
      'POSTMARK_WEBHOOK_PASSWORD',
      'POSTMARK_BOUNCE_HASH_KEY',
    ],
  },
  storageSmoke: {
    allOf: [
      'R2_BUCKET',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_ENDPOINT',
    ],
  },
};

const status = Object.fromEntries(
  Object.entries(groups).map(([group, requirement]) => {
    const names = requirement.allOf || requirement.anyOf || [];
    return [
      group,
      Object.fromEntries(
        names.map((name) => [name, Boolean(process.env[name]?.trim())]),
      ),
    ];
  }),
);

const missing = Object.entries(groups).flatMap(([group, requirement]) => {
  if (requirement.anyOf) {
    const satisfied = requirement.anyOf.some((name) => status[group][name]);
    return satisfied ? [] : [`${group}:one of ${requirement.anyOf.join('|')}`];
  }

  return requirement.allOf
    .filter((name) => !status[group][name])
    .map((name) => `${group}:${name}`);
});

console.log(
  JSON.stringify(
    {
      ok: missing.length === 0,
      missing,
      status,
    },
    null,
    2,
  ),
);

if (missing.length) {
  process.exitCode = 1;
}
