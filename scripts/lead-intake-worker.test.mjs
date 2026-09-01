import assert from 'node:assert/strict';
import test from 'node:test';

import { validateLeadPayload } from '../workers/site.mjs';

const validLead = {
  name: 'Jordan Lee',
  workEmail: 'Jordan@Example.com',
  company: 'Example Logistics',
  fleetSize: '16–35',
  exactFleetSize: 24,
  requestType: 'Book demo',
  notes: 'Interested in assisted-pilot onboarding.',
  source: 'trytrovan.com',
  pagePath: '/pricing',
  website: '',
};

test('Cloudflare lead validation accepts and normalizes a valid request', () => {
  const result = validateLeadPayload(validLead);
  assert.equal(result.ok, true);
  assert.equal(result.lead.workEmail, 'jordan@example.com');
  assert.equal(result.lead.exactFleetSize, 24);
});

test('Cloudflare lead validation rejects unknown request types', () => {
  const result = validateLeadPayload({ ...validLead, requestType: 'Buy now' });
  assert.deepEqual(result, { ok: false, error: 'Select a valid request type.' });
});

test('Cloudflare lead validation rejects malformed email and fleet values', () => {
  assert.equal(validateLeadPayload({ ...validLead, workEmail: 'not-an-email' }).ok, false);
  assert.equal(validateLeadPayload({ ...validLead, exactFleetSize: 0 }).ok, false);
  assert.equal(validateLeadPayload({ ...validLead, fleetSize: 'Unlimited' }).ok, false);
});

test('Cloudflare lead validation preserves the honeypot for silent rejection', () => {
  const result = validateLeadPayload({ ...validLead, website: 'https://spam.example' });
  assert.equal(result.ok, true);
  assert.equal(result.lead.website, 'https://spam.example');
});
