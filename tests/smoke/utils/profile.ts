export const smokeProfile = process.env.SCAFIX_SMOKE_PROFILE === 'quick' ? 'quick' : 'full';

export const isQuickSmokeProfile = smokeProfile === 'quick';

export function getQuickSmokeRepresentatives<T>(
  items: readonly T[],
  predicate?: (item: T) => boolean
): T[] {
  if (!isQuickSmokeProfile) {
    return [];
  }

  const representative = predicate ? items.find(predicate) : undefined;
  const fallback = representative ?? items[0];

  return fallback === undefined ? [] : [fallback];
}

export function getFullSmokeMatrix<T>(items: readonly T[]): T[] {
  return isQuickSmokeProfile ? [] : [...items];
}
