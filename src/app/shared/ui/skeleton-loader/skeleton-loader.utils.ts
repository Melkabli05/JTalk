export type SkeletonVariant = 'text' | 'circle' | 'pill' | 'rect';

const DEFAULT_HEIGHTS: Record<SkeletonVariant, string> = {
  text: '14px',
  circle: '36px',
  pill: '32px',
  rect: '40px',
};

export function resolveSkeletonHeight(
  variant: SkeletonVariant,
  explicitHeight: string | null,
): string {
  return explicitHeight ?? DEFAULT_HEIGHTS[variant];
}

export function computeSkeletonLineWidths(
  lines: number,
  width: string,
): readonly string[] {
  const count = Math.max(1, Math.floor(lines));
  if (count === 1) {
    return [width];
  }
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    result.push(isLast ? '78%' : width);
  }
  return result;
}
