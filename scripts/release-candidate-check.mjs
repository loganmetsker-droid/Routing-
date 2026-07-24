import { execFileSync } from 'node:child_process';

const suppliedBase = process.argv[2]?.trim();
const zeroSha = /^0{40}$/;
const base =
  suppliedBase && !zeroSha.test(suppliedBase)
    ? suppliedBase
    : 'HEAD^';

let changedFiles;
try {
  changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${base}...HEAD`],
    { encoding: 'utf8' },
  )
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
  const worktreeFiles = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { encoding: 'utf8' },
  )
    .split('\n')
    .filter((line) => !line.slice(0, 2).includes('D'))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .flatMap((file) => file.split(' -> '));
  changedFiles = [...new Set([...changedFiles, ...worktreeFiles])];
} catch (error) {
  console.error(`Unable to compare release scope against ${base}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const generatedPatterns = [
  /^\.artifacts\//,
  /^\.codex\/launch-audit\//,
  /^\.tmp\//,
  /^audit\//,
  /^codex-qa-artifacts\//,
  /(^|\/)playwright-report\//,
  /(^|\/)test-results\//,
  /(^|\/)\.DS_Store$/,
  /^(PRODUCT_UI_.*|SECURITY_HARDENING_REPORT|STEP_\d+_.*|TROVAN_MIGRATION_QA_RESULTS)\.md$/,
];

const forbidden = changedFiles.filter((file) =>
  generatedPatterns.some((pattern) => pattern.test(file)),
);

if (forbidden.length) {
  console.error('Release candidate contains generated audit or QA artifacts:');
  forbidden.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

console.log(
  `Release scope is clean: ${changedFiles.length} changed path(s), no generated audit or QA artifacts.`,
);
