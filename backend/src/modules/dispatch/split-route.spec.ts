import { assertSplitRouteConsistency, splitRouteJobIds } from './split-route';

describe('split route helper', () => {
  it('splits route job ids into parent/child segments', () => {
    const result = splitRouteJobIds(['j1', 'j2', 'j3', 'j4'], 2);
    expect(result.parentJobIds).toEqual(['j1', 'j2']);
    expect(result.childJobIds).toEqual(['j3', 'j4']);
    expect(() =>
      assertSplitRouteConsistency(
        ['j1', 'j2', 'j3', 'j4'],
        result.parentJobIds,
        result.childJobIds,
      ),
    ).not.toThrow();
  });

  it('rejects invalid split index', () => {
    expect(() => splitRouteJobIds(['j1', 'j2'], 0)).toThrow();
    expect(() => splitRouteJobIds(['j1', 'j2'], 2)).toThrow();
  });

  it('rejects inconsistent split output', () => {
    expect(() =>
      assertSplitRouteConsistency(['j1', 'j2', 'j3'], ['j1', 'j1'], ['j3']),
    ).toThrow();
  });
});
