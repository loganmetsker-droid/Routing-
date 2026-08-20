import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const root = process.cwd();
const destinationArg =
  process.argv[2] ||
  `.tmp/release-candidate-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`;
const destination = resolve(root, destinationArg);
if (existsSync(destination)) {
  throw new Error(`Release candidate directory already exists: ${destination}`);
}
if (!destination.startsWith(`${resolve(root, '.tmp')}${sep}`)) {
  throw new Error('Release candidates must be created under .tmp/.');
}

const allowedPrefixes = [
  '.github/',
  'backend/',
  'docs/',
  'e2e/',
  'frontend/',
  'infrastructure/',
  'routing-service/',
  'scripts/',
  'shared/',
];
const allowedRootFiles = new Set([
  '.env.example',
  '.gitignore',
  'README.md',
  'TESTING_GUIDE.md',
  'TROUBLESHOOTING.md',
  'SETUP_DATABASE.md',
  'OSRM_SETUP.md',
  'docker-compose.yml',
  'package-lock.json',
  'package.json',
  'playwright.config.ts',
  'render.yaml',
  'wrangler.toml',
]);
const deniedPatterns = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)playwright-report\//,
  /(^|\/)test-results\//,
  /(^|\/)__pycache__\//,
  /(^|\/)\.pytest_cache\//,
  /(^|\/)\.ruff_cache\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.env\.(local|production)$/,
  /^(audit|codex-qa-artifacts|\.artifacts|\.codex|\.tmp)\//,
  /(^|\/)(PRODUCT_UI_.*|SECURITY_HARDENING_REPORT|STEP_\d+_.*|TROVAN_MIGRATION_QA_RESULTS)\.md$/,
];

const listed = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root },
).toString('utf8').split('\0').filter(Boolean);
const included = listed.filter((file) => {
  const allowed = allowedRootFiles.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix));
  return allowed && !deniedPatterns.some((pattern) => pattern.test(file));
}).filter((file) => {
  const source = resolve(root, file);
  return existsSync(source) && statSync(source).isFile();
});

mkdirSync(destination, { recursive: false });
const manifestFiles = [];
for (const file of included.sort()) {
  const source = resolve(root, file);
  const target = resolve(destination, file);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  manifestFiles.push({
    path: file,
    bytes: statSync(source).size,
    sha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
  });
}

const manifest = {
  createdAt: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString('utf8').trim(),
  fileCount: manifestFiles.length,
  files: manifestFiles,
};
writeFileSync(
  resolve(destination, 'release-candidate-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(JSON.stringify({ ok: true, destination, fileCount: manifest.fileCount }, null, 2));
