import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = process.argv[2] || join(
  '/Users/logan/Desktop/Trovan Safety Snapshots',
  `routing-${timestamp}`,
);

mkdirSync(destination, { recursive: true });

const git = (...args) => execFileSync('git', args, {
  cwd: root,
  maxBuffer: 1024 * 1024 * 1024,
});
const trackedPatch = git('diff', '--binary', 'HEAD');
const stagedPatch = git('diff', '--binary', '--cached', 'HEAD');
const untracked = git('ls-files', '--others', '--exclude-standard', '-z')
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const secretPattern = /(^|\/)(\.env(\.|$)|.*\.(pem|key|p12|pfx)|id_rsa|id_ed25519)$/i;
const excludedSecrets = untracked.filter((file) => secretPattern.test(file));
const safeUntracked = untracked.filter((file) => !secretPattern.test(file));

const trackedPatchPath = join(destination, 'tracked-working-tree.patch');
const stagedPatchPath = join(destination, 'staged-index.patch');
writeFileSync(trackedPatchPath, trackedPatch);
writeFileSync(stagedPatchPath, stagedPatch);

let untrackedArchivePath = null;
if (safeUntracked.length) {
  untrackedArchivePath = join(destination, 'untracked-files.tar.gz');
  execFileSync(
    'tar',
    ['-czf', untrackedArchivePath, '--null', '--files-from=-'],
    {
      cwd: root,
      input: Buffer.from(`${safeUntracked.join('\0')}\0`),
      maxBuffer: 1024 * 1024 * 1024,
    },
  );
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const metadata = {
  createdAt: new Date().toISOString(),
  projectRoot: root,
  branch: git('branch', '--show-current').toString('utf8').trim(),
  head: git('rev-parse', 'HEAD').toString('utf8').trim(),
  trackedPatch: {
    file: 'tracked-working-tree.patch',
    sha256: sha256(trackedPatchPath),
  },
  stagedPatch: {
    file: 'staged-index.patch',
    sha256: sha256(stagedPatchPath),
  },
  untrackedArchive: untrackedArchivePath
    ? { file: 'untracked-files.tar.gz', sha256: sha256(untrackedArchivePath) }
    : null,
  untrackedFileCount: safeUntracked.length,
  excludedSecretPaths: excludedSecrets,
  restore: [
    'Apply tracked-working-tree.patch to the recorded HEAD.',
    'Apply staged-index.patch only if staged state is needed.',
    'Extract untracked-files.tar.gz at the project root.',
  ],
};
writeFileSync(
  join(destination, 'snapshot-metadata.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(JSON.stringify({ ok: true, destination, ...metadata }, null, 2));
