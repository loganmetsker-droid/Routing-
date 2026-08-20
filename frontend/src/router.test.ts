import { describe, expect, it } from 'vitest';
import { destinationHref, matchPath, type RouterLocation } from './router';

const currentLocation: RouterLocation = {
  pathname: '/jobs',
  search: '?status=open',
  hash: '',
  state: null,
};

describe('browser router helpers', () => {
  it('matches exact and parameterized application routes', () => {
    expect(matchPath('/route-runs/:id', '/route-runs/run%201')).toEqual({ id: 'run 1' });
    expect(matchPath('/route-runs/:id', '/route-runs')).toBeNull();
    expect(matchPath('/route-runs/:id', '/route-runs/one/stops')).toBeNull();
  });

  it('matches wildcard route descendants', () => {
    expect(matchPath('/pod/*', '/pod')).toEqual({});
    expect(matchPath('/pod/*', '/pod/archive/2026')).toEqual({});
    expect(matchPath('/pod/*', '/jobs')).toBeNull();
  });

  it('builds object destinations without dropping the current path', () => {
    expect(destinationHref({ search: 'status=closed' }, currentLocation)).toBe('/jobs?status=closed');
    expect(destinationHref({ pathname: '/routing', search: '' }, currentLocation)).toBe('/routing');
  });
});
