import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLaunchGateEvidence } from './validate-launch-gate-evidence.mjs';

const now = Date.parse('2026-08-06T15:00:00.000Z');
const sha = 'a'.repeat(40);
const evidenceUrl = 'https://evidence.example.test/runs/123';
const completed = {
  passed: true,
  operator: 'Launch Owner',
  completedAt: '2026-08-06T14:00:00.000Z',
  evidenceUrl,
};
const approved = {
  approved: true,
  approver: 'Named Approver',
  approvedAt: '2026-08-06T14:00:00.000Z',
  evidenceUrl,
};

function validPayload() {
  return {
    releaseSha: sha,
    generatedAt: '2026-08-06T14:30:00.000Z',
    stagingEvidenceUrl: evidenceUrl,
    exercises: {
      postgresRestore: completed,
      r2Recovery: completed,
      rollback: completed,
      alertAcknowledgement: completed,
      incident: completed,
      stripeBilling: completed,
      postmarkDeliveryBounce: completed,
    },
    approvals: {
      repositorySecurity: approved,
      privacyRetention: approved,
      subprocessors: approved,
      pilotAgreement: approved,
      launchOwner: approved,
    },
  };
}

test('accepts complete, recent evidence for the exact release SHA', () => {
  assert.deepEqual(validateLaunchGateEvidence(validPayload(), sha, now), []);
});

test('rejects stale, local, incomplete, or mismatched evidence', () => {
  const payload = validPayload();
  payload.releaseSha = 'b'.repeat(40);
  payload.generatedAt = '2026-01-01T00:00:00.000Z';
  payload.stagingEvidenceUrl = 'http://127.0.0.1/evidence';
  delete payload.exercises.rollback;
  payload.approvals.launchOwner.approved = false;
  assert.ok(validateLaunchGateEvidence(payload, sha, now).length >= 5);
});
