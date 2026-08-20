import type { OnboardingStep } from '@shared/contracts';

// Preview mode represents a workspace that already completed the operational practice route.
// Training completion remains interactive and is stored separately in localStorage.
export const buildOperationalOnboardingSteps = (): OnboardingStep[] => [
  ['depot', 'Confirm primary depot', '/settings'],
  ['drivers', 'Add an active driver', '/drivers'],
  ['vehicles', 'Add a ready vehicle', '/vehicles'],
  ['jobs', 'Import the first route day', '/jobs'],
  ['locations', 'Validate every job location', '/jobs'],
  ['optimize', 'Create a provider-backed route', '/routing'],
  ['dispatch', 'Dispatch the practice route', '/dispatch'],
  ['proof', 'Capture first delivery proof', '/pod'],
].map(([id, label, href]) => ({
  id,
  label,
  owner: id === 'proof' ? 'Pilot driver' : 'Champion',
  complete: true,
  blocked: false,
  action: 'Review',
  href,
  detail: 'Complete in the persisted pilot workspace.',
}));
