import { describe, expect, it } from 'vitest';
import {
  cookiePreferenceDefaults,
  legalPages,
  publicMarketingRoutes,
  resourceCards,
  securityControlCopy,
  testimonialProofItems,
} from './publicSiteData';

const requiredRoutes = [
  '/',
  '/platform',
  '/platform/plan',
  '/platform/dispatch',
  '/platform/drive',
  '/platform/track',
  '/platform/proof',
  '/demo',
  '/pricing',
  '/testimonials',
  '/security',
  '/resources',
  '/support',
  '/company',
  '/mission',
  '/careers',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cookies',
  '/legal/exercise-rights',
  '/resources/downloads',
];

describe('public site content guardrails', () => {
  it('declares the enterprise public marketing routes without taking /customers from the app', () => {
    expect(publicMarketingRoutes.map((route) => route.path)).toEqual(requiredRoutes);
    expect(publicMarketingRoutes.some((route) => route.path === '/customers')).toBe(false);
  });

  it('keeps security copy to verified controls instead of certification claims', () => {
    const securityText = securityControlCopy.join(' ');

    expect(securityText).toMatch(/role-based|RBAC|audit|request IDs|redaction|rate limiting/i);
    expect(securityText).not.toMatch(/SOC\s*2|HIPAA|ISO\s*27001|certified|certification/i);
  });

  it('uses scenario proof instead of fake named customer testimonials', () => {
    const proofText = testimonialProofItems.map((item) => `${item.title} ${item.body}`).join(' ');

    expect(proofText).toMatch(/scenario|operator|delivery|distribution|dispatcher/i);
    expect(proofText).not.toMatch(/Acme|Globex|Initech|customer quote|five stars/i);
  });

  it('keeps analytics and marketing cookie preferences disabled until configured', () => {
    expect(cookiePreferenceDefaults).toEqual({
      essential: true,
      analytics: false,
      marketing: false,
    });
  });

  it('does not publish draft legal or resource copy', () => {
    const legalText = Object.values(legalPages)
      .map((page) => [
        page.heading,
        page.body,
        ...page.sections.flatMap(([title, body]) => [title, body]),
      ].join(' '))
      .join(' ');
    const resourceText = resourceCards.map((card) => `${card.title} ${card.body}`).join(' ');

    expect(`${legalText} ${resourceText}`).not.toMatch(/draft|should be reviewed|formal legal publication|launch review/i);
  });
});
