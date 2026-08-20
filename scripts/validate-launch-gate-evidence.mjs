import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

const exerciseNames = [
  'postgresRestore',
  'r2Recovery',
  'rollback',
  'alertAcknowledgement',
  'incident',
  'stripeBilling',
  'postmarkDeliveryBounce',
];

const approvalNames = [
  'repositorySecurity',
  'privacyRetention',
  'subprocessors',
  'pilotAgreement',
  'launchOwner',
];

function validEvidenceUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return (
      url.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function validateRecord(group, name, record, now, issues) {
  const prefix = `${group}.${name}`;
  if (!record || typeof record !== 'object') {
    issues.push(`${prefix} is missing`);
    return;
  }
  if (record.passed !== true && record.approved !== true) {
    issues.push(`${prefix} must be explicitly passed or approved`);
  }
  if (!String(record.operator || record.approver || '').trim()) {
    issues.push(`${prefix} must name the responsible person`);
  }
  const timestamp = Date.parse(record.completedAt || record.approvedAt || '');
  if (!Number.isFinite(timestamp)) {
    issues.push(`${prefix} needs a valid completion timestamp`);
  } else if (timestamp > now || now - timestamp > MAX_EVIDENCE_AGE_MS) {
    issues.push(`${prefix} must be completed within the last 30 days`);
  }
  if (!validEvidenceUrl(record.evidenceUrl)) {
    issues.push(`${prefix} needs a non-local HTTPS evidence URL`);
  }
}

export function validateLaunchGateEvidence(payload, expectedSha, now = Date.now()) {
  const issues = [];
  if (!payload || typeof payload !== 'object') {
    return ['launch evidence must be a JSON object'];
  }
  if (!SHA_PATTERN.test(expectedSha)) {
    issues.push('expected release SHA must be a full lowercase commit SHA');
  }
  if (payload.releaseSha !== expectedSha) {
    issues.push('launch evidence releaseSha does not match the promoted SHA');
  }
  const generatedAt = Date.parse(payload.generatedAt || '');
  if (!Number.isFinite(generatedAt)) {
    issues.push('generatedAt must be a valid timestamp');
  } else if (generatedAt > now || now - generatedAt > MAX_EVIDENCE_AGE_MS) {
    issues.push('launch evidence must be generated within the last 30 days');
  }
  if (!validEvidenceUrl(payload.stagingEvidenceUrl)) {
    issues.push('stagingEvidenceUrl must be a non-local HTTPS URL');
  }

  for (const name of exerciseNames) {
    validateRecord('exercises', name, payload.exercises?.[name], now, issues);
  }
  for (const name of approvalNames) {
    validateRecord('approvals', name, payload.approvals?.[name], now, issues);
  }
  return issues;
}

function main() {
  const evidencePath = process.argv[2] || process.env.LAUNCH_GATE_EVIDENCE_PATH;
  const expectedSha = process.argv[3] || process.env.RELEASE_SHA || '';
  if (!evidencePath) throw new Error('launch evidence file path is required');
  const payload = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const issues = validateLaunchGateEvidence(payload, expectedSha);
  console.log(
    JSON.stringify(
      { ok: issues.length === 0, releaseSha: expectedSha, issues },
      null,
      2,
    ),
  );
  if (issues.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
