#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.TROVAN_PDF_PYTHON,
  path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'),
  'python3',
].filter(Boolean);

const python = candidates.find((candidate) => {
  const probe = spawnSync(candidate, ['-c', 'import reportlab'], { stdio: 'ignore' });
  return probe.status === 0;
});

if (!python) {
  throw new Error('No Python runtime with reportlab is available. Set TROVAN_PDF_PYTHON to a compatible Python executable.');
}

const result = spawnSync(python, [path.join(root, 'scripts/build-launch-docket.py')], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
