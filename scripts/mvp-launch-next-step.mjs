const secretNames = new Set([
  'METRICS_TOKEN',
  'ROUTING_SERVICE_INTERNAL_TOKEN',
  'STAGING_ROUTING_SERVICE_INTERNAL_TOKEN',
  'WORKOS_TEST_PASSWORD',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'POSTMARK_SERVER_TOKEN',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'STAGING_AUTH_TOKEN',
  'STAGING_DRIVER_AUTH_TOKEN',
  'LAUNCH_AUDIT_AUTH_TOKEN',
]);

const steps = [
  {
    id: 'render-staging',
    title: 'Render staging URLs',
    handoff:
      'Provision the Render data/backend/routing Blueprint, deploy an immutable release SHA with the Promote Trovan Release workflow, and provide the Cloudflare frontend plus two Render service URLs.',
    required: [
      'STAGING_FRONTEND_URL',
      'STAGING_BACKEND_URL',
      'STAGING_ROUTING_SERVICE_URL',
    ],
    optional: [],
    verify: [
      'npm run launch:env-status',
      'curl -fsS "$STAGING_BACKEND_URL/health/readiness"',
      'curl -fsS "$STAGING_ROUTING_SERVICE_URL/health"',
    ],
  },
  {
    id: 'render-env',
    title: 'Render environment values',
    handoff:
      'Configure Render dashboard env values for backend and routing-service, plus protected GitHub environment values for the Cloudflare frontend release. Keep secrets in provider stores, not chat.',
    required: [
      'METRICS_TOKEN',
      'ROUTING_SERVICE_INTERNAL_TOKEN',
    ],
    optional: ['STAGING_ROUTING_SERVICE_INTERNAL_TOKEN'],
    verify: ['npm run launch:env-status'],
  },
  {
    id: 'workos',
    title: 'WorkOS staging auth',
    handoff:
      'Create a staging WorkOS app/test user and confirm redirect/logout URLs point at the staging frontend/backend.',
    required: [
      'WORKOS_TEST_EMAIL',
      'WORKOS_TEST_PASSWORD',
      'STAGING_DRIVER_AUTH_TOKEN',
    ],
    requiredAnyOf: [['STAGING_AUTH_TOKEN', 'LAUNCH_AUDIT_AUTH_TOKEN']],
    optional: [],
    verify: ['npm run staging:smoke'],
  },
  {
    id: 'stripe-test',
    title: 'Stripe test billing',
    handoff:
      'Create Stripe test products/prices for Launch and Scale, then configure the staging webhook secret. Enterprise remains custom and sales-assisted.',
    required: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_LAUNCH',
      'STRIPE_PRICE_SCALE',
      'STAGING_WEBHOOK_RECEIVER_URL',
    ],
    optional: [],
    verify: ['npm run staging:smoke'],
  },
  {
    id: 'provider-sandboxes',
    title: 'Provider sandboxes',
    handoff:
      'Configure Postmark and Cloudflare R2 sandbox/test resources for staging proof files and email notifications. SMS is intentionally disabled.',
    required: [
      'POSTMARK_SERVER_TOKEN',
      'POSTMARK_FROM_EMAIL',
      'LEAD_INTAKE_EMAIL',
      'LEAD_INTAKE_FROM_EMAIL',
      'R2_BUCKET',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_ENDPOINT',
    ],
    optional: [],
    verify: ['npm run staging:smoke'],
  },
  {
    id: 'seed-data',
    title: 'MVP seed dataset',
    handoff:
      'Load or recreate the MVP dataset from docs/launch/mvp-seed-dataset.json in staging: one org, dispatcher, driver, vehicle, and eight jobs.',
    required: ['MVP_SEED_DATASET_READY'],
    optional: [],
    verify: ['npm run staging:smoke', 'npm run launch:audit'],
  },
  {
    id: 'optimizer-proof',
    title: 'Hosted optimizer proof',
    handoff:
      'Prove the hosted routing service returns live ordered stops using the same internal token as the backend.',
    required: [
      'STAGING_ROUTING_SERVICE_URL',
      'ROUTING_SERVICE_INTERNAL_TOKEN',
    ],
    optional: ['STAGING_ROUTING_SERVICE_INTERNAL_TOKEN'],
    verify: [
      'ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer',
    ],
  },
  {
    id: 'launch-audit',
    title: 'Full staging launch audit',
    handoff:
      'Run the complete staging smoke and launch audit with provider checks enabled. Public launch remains blocked until both pass.',
    required: [
      'STAGING_FRONTEND_URL',
      'STAGING_BACKEND_URL',
      'STAGING_ROUTING_SERVICE_URL',
      'METRICS_TOKEN',
      'ROUTING_SERVICE_INTERNAL_TOKEN',
      'WORKOS_TEST_EMAIL',
      'WORKOS_TEST_PASSWORD',
      'STAGING_DRIVER_AUTH_TOKEN',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'POSTMARK_SERVER_TOKEN',
      'LEAD_INTAKE_EMAIL',
      'LEAD_INTAKE_FROM_EMAIL',
      'R2_BUCKET',
    ],
    requiredAnyOf: [['STAGING_AUTH_TOKEN', 'LAUNCH_AUDIT_AUTH_TOKEN']],
    optional: [],
    verify: [
      'npm run launch:env-status',
      'npm run staging:smoke',
      'ROUTING_SERVICE_URL="$STAGING_ROUTING_SERVICE_URL" npm run smoke:optimizer',
      'npm run launch:audit',
    ],
  },
];

function configured(name) {
  return Boolean(process.env[name]?.trim());
}

function displayName(name) {
  if (Array.isArray(name)) return `one of ${name.map(displayName).join(' or ')}`;
  if (secretNames.has(name)) return `${name} (secret/local only)`;
  return name;
}

function stepStatus(step) {
  const missing = step.required.filter((name) => !configured(name));
  const present = step.required.filter(configured);
  const anyOf = step.requiredAnyOf || [];
  const missingAnyOf = anyOf.filter(
    (group) => !group.some((name) => configured(name)),
  );
  const presentAnyOf = anyOf.flatMap((group) => group.filter(configured));
  return {
    ...step,
    complete: missing.length === 0 && missingAnyOf.length === 0,
    missing: [...missing, ...missingAnyOf],
    present: [...present, ...presentAnyOf],
    optionalPresent: step.optional.filter(configured),
    optionalMissing: step.optional.filter((name) => !configured(name)),
  };
}

function renderText(statuses) {
  const next = statuses.find((step) => !step.complete);
  const completed = statuses.filter((step) => step.complete).length;

  console.log('# Trovan MVP Launch Next Step');
  console.log('');
  console.log(`Progress: ${completed}/${statuses.length} launch handoffs complete`);
  console.log('Launch posture: assisted paid pilots, Launch/Scale monthly pricing, email-first notifications, and self-service disabled.');
  console.log('');

  if (!next) {
    console.log('Next handoff: staging appears fully configured from local env.');
    console.log('');
    console.log('Run these final gates:');
    statuses.at(-1).verify.forEach((command) => console.log(`- ${command}`));
    return;
  }

  console.log(`Next handoff: ${next.title}`);
  console.log(next.handoff);
  console.log('');
  console.log('Need from you now:');
  next.missing.forEach((name) => console.log(`- ${displayName(name)}`));
  console.log('');
  if (next.present.length) {
    console.log('Already present locally:');
    next.present.forEach((name) => console.log(`- ${displayName(name)}`));
    console.log('');
  }
  if (next.optional.length) {
    console.log('Optional for this step:');
    next.optional.forEach((name) => {
      const marker = configured(name) ? 'present' : 'missing';
      console.log(`- ${displayName(name)}: ${marker}`);
    });
    console.log('');
  }
  console.log('Verify after this handoff:');
  next.verify.forEach((command) => console.log(`- ${command}`));
  console.log('');
  console.log('Secret rule: configure secrets in Render/provider dashboards or local shell env only. Do not paste secret values in chat.');
}

const statuses = steps.map(stepStatus);
const json = process.argv.includes('--json');
const strict = process.argv.includes('--strict');

if (json) {
  console.log(JSON.stringify({ ok: statuses.every((step) => step.complete), steps: statuses }, null, 2));
} else {
  renderText(statuses);
}

if (strict && statuses.some((step) => !step.complete)) {
  process.exitCode = 1;
}
