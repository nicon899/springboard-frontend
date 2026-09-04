import { AgeCategoryResponse } from './api';

/**
 * Returns the min and max age from an AgeCategoryResponse.
 * fromYearOffset and toYearOffset store age offsets (years).
 */
export function getAgeCategoryMinMax(cat: AgeCategoryResponse): { minAge: number; maxAge: number } {
  const minAge = Math.min(cat.fromYearOffset, cat.toYearOffset);
  const maxAge = Math.max(cat.fromYearOffset, cat.toYearOffset);
  return { minAge, maxAge };
}

/**
 * Returns a readable age range string like "12–15 J."
 */
export function formatAgeCategoryRange(cat: AgeCategoryResponse): string {
  const { minAge, maxAge } = getAgeCategoryMinMax(cat);
  if (minAge === maxAge) return `${minAge} J.`;
  return `${minAge}–${maxAge} J.`;
}

/**
 * Returns a full label for the age category including name and range.
 * e.g. "Jugend C (12–15 J.)"
 */
export function formatAgeCategoryLabel(cat: AgeCategoryResponse): string {
  return `${cat.name} (${formatAgeCategoryRange(cat)})`;
}

/**
 * Checks whether a given age falls within the age category range.
 */
export function matchesAgeCategory(age: number, cat: AgeCategoryResponse): boolean {
  const { minAge, maxAge } = getAgeCategoryMinMax(cat);
  return age >= minAge && age <= maxAge;
}
