import {
  computeSkeletonLineWidths,
  resolveSkeletonHeight,
} from './skeleton-loader.utils';

describe('skeleton-loader.utils', () => {
  it('resolves variant default heights and respects explicit height overrides', () => {
    expect(resolveSkeletonHeight('text', null)).toBe('14px');
    expect(resolveSkeletonHeight('circle', null)).toBe('36px');
    expect(resolveSkeletonHeight('pill', null)).toBe('32px');
    expect(resolveSkeletonHeight('rect', null)).toBe('40px');
    expect(resolveSkeletonHeight('text', '24px')).toBe('24px');
  });

  it('returns single line width or tapers final line for multi-line text skeletons', () => {
    expect(computeSkeletonLineWidths(1, '64%')).toEqual(['64%']);
    expect(computeSkeletonLineWidths(0, '100%')).toEqual(['100%']);
    expect(computeSkeletonLineWidths(2, '100%')).toEqual(['100%', '78%']);
    expect(computeSkeletonLineWidths(3, '96%')).toEqual(['96%', '96%', '78%']);
  });
});
