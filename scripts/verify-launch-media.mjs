#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repositoryRoot = process.cwd();
const mediaRoot = path.join(repositoryRoot, 'frontend/public/marketing');
const manifestPath = path.join(mediaRoot, 'launch-media-manifest.json');
const failures = [];

function fail(message) {
  failures.push(message);
}

function git(args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
}

if (!existsSync(manifestPath)) {
  fail(`Missing launch media manifest: ${manifestPath}`);
}

let manifest;
if (!failures.length) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail(
      `Launch media manifest is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

if (manifest) {
  if (manifest.sourceDirty !== false) {
    fail('Launch media manifest must record sourceDirty=false.');
  }
  if (!/^[0-9a-f]{40}$/i.test(String(manifest.sourceSha || ''))) {
    fail('Launch media manifest must contain a full 40-character source SHA.');
  } else {
    try {
      git(['cat-file', '-e', `${manifest.sourceSha}^{commit}`]);
      execFileSync(
        'git',
        ['merge-base', '--is-ancestor', manifest.sourceSha, 'HEAD'],
        { cwd: repositoryRoot, stdio: 'ignore' },
      );
      const headSha = git(['rev-parse', 'HEAD']);
      if (headSha !== manifest.sourceSha) {
        const changedSinceCapture = git([
          'diff',
          '--name-only',
          manifest.sourceSha,
          'HEAD',
        ])
          .split('\n')
          .filter(Boolean);
        const nonMediaChanges = changedSinceCapture.filter(
          (filename) => !filename.startsWith('frontend/public/marketing/'),
        );
        if (nonMediaChanges.length) {
          fail(
            `Non-media files changed after the capture source SHA: ${nonMediaChanges.join(', ')}`,
          );
        }
      }
    } catch {
      fail('Launch media source SHA must exist and be an ancestor of HEAD.');
    }
  }

  const artifacts = Array.isArray(manifest.artifacts)
    ? manifest.artifacts
    : [];
  if (!artifacts.length) {
    fail('Launch media manifest does not list any artifacts.');
  }

  const seenArtifacts = new Set();
  for (const artifact of artifacts) {
    const filename = String(artifact?.filename || '');
    if (!filename || filename !== path.basename(filename)) {
      fail(`Invalid launch media artifact filename: ${filename || '(empty)'}`);
      continue;
    }
    if (seenArtifacts.has(filename)) {
      fail(`Duplicate launch media artifact: ${filename}`);
      continue;
    }
    seenArtifacts.add(filename);

    const artifactPath = path.join(mediaRoot, filename);
    if (!existsSync(artifactPath)) {
      fail(`Missing launch media artifact: ${filename}`);
      continue;
    }
    const bytes = statSync(artifactPath).size;
    const sha256 = createHash('sha256')
      .update(readFileSync(artifactPath))
      .digest('hex');
    if (bytes !== artifact.bytes) {
      fail(
        `Launch media byte count mismatch for ${filename}: expected ${artifact.bytes}, received ${bytes}`,
      );
    }
    if (sha256 !== artifact.sha256) {
      fail(`Launch media SHA-256 mismatch for ${filename}.`);
    }
  }

  for (const requiredArtifact of [
    'product-routing.png',
    'product-jobs.png',
    'product-exceptions.png',
    'trovan-product-tour.mp4',
    'trovan-product-tour.vtt',
  ]) {
    if (!seenArtifacts.has(requiredArtifact)) {
      fail(`Launch media manifest is missing ${requiredArtifact}.`);
    }
  }
}

if (failures.length) {
  console.error('Launch media verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Launch media verified: ${manifest.artifacts.length} artifacts match source ${manifest.sourceSha}.`,
);
