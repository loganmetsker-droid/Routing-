import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const backendDir = join(repoRoot, 'backend');
const envExample = join(backendDir, '.env.local.example');
const envLocal = join(backendDir, '.env.local');

function hasCommand(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function ensureEnvFile() {
  if (existsSync(envLocal)) {
    console.log('backend/.env.local already exists. Leaving it untouched.');
    return;
  }

  if (!existsSync(envExample)) {
    throw new Error('backend/.env.local.example is missing.');
  }

  const secret = randomBytes(32).toString('hex');
  const template = readFileSync(envExample, 'utf8').replace(
    'JWT_SECRET=replace-with-a-strong-secret',
    `JWT_SECRET=${secret}`,
  );
  writeFileSync(envLocal, template, 'utf8');
  console.log('Created backend/.env.local with a generated JWT secret.');
}

function printRuntimeGuidance() {
  const dockerAvailable = hasCommand('docker');
  const providerChecklist = [
    'WorkOS: optional locally, required for staging/prod managed auth',
    'Stripe: required for paid self-serve billing',
    'Postmark/Twilio: required for live customer comms',
    'R2: required for production proof artifact storage',
  ];
  console.log('');
  console.log('Local bootstrap summary');
  console.log('-----------------------');
  console.log(`Repo: ${repoRoot}`);
  console.log(`Docker available: ${dockerAvailable ? 'yes' : 'no'}`);
  console.log('Next steps:');
  console.log('1. Start Postgres and Redis.');
  if (dockerAvailable) {
    console.log(
      '   npm run docker:dev  # or docker compose -f infrastructure/docker/docker-compose.dev.yml up postgres redis',
    );
  } else {
    console.log(
      '   Install Docker Desktop or run Postgres/Redis manually on 127.0.0.1:5432 and 127.0.0.1:6379.',
    );
  }
  console.log('2. Start the backend: npm run dev --workspace=backend');
  console.log('3. Start the frontend: npm run dev --workspace=frontend');
  console.log('4. Verify the stack: npm run smoke:local');
  console.log('5. Provider checklist:');
  providerChecklist.forEach((item) => console.log(`   - ${item}`));
}

ensureEnvFile();
printRuntimeGuidance();
