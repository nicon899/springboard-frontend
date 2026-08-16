import { DiveDefinition, DiveGroup } from '../types/dive';
import { DiveResponse } from '../../services/api';

export const DIVE_GROUP_NAMES: Record<number, { de: string; en: string }> = {
  1: { de: 'Vorwärts', en: 'Forward' },
  2: { de: 'Rückwärts', en: 'Back' },
  3: { de: 'Auerbach', en: 'Reverse' },
  4: { de: 'Delphin', en: 'Inward' },
  5: { de: 'Schrauben', en: 'Twisting' },
  6: { de: 'Handstand', en: 'Armstand' },
};

/**
 * Transforms API dive responses into DiveDefinition objects purely from backend data.
 */
export function mapApiDivesToDefinitions(apiDives: DiveResponse[]): DiveDefinition[] {
  const mapByCode = new Map<string, DiveDefinition>();

  for (const item of apiDives) {
    let existing = mapByCode.get(item.code);
    if (!existing) {
      existing = {
        code: item.code,
        groupNumber: (item.groupNumber || 1) as DiveGroup,
        nameDe: item.nameDe || item.code,
        nameEn: item.nameEn || item.code,
        difficulties: {
          A: {},
          B: {},
          C: {},
          D: {},
        },
      };
      mapByCode.set(item.code, existing);
    }

    if (item.nameDe) existing.nameDe = item.nameDe;
    if (item.nameEn) existing.nameEn = item.nameEn;
    if (item.groupNumber) existing.groupNumber = item.groupNumber as DiveGroup;

    if (item.execution && item.degreeOfDifficulty != null) {
      if (!existing.difficulties[item.execution]) {
        existing.difficulties[item.execution] = {};
      }
      // Populate difficulty (default across heights or 1m/3m if specified)
      existing.difficulties[item.execution]['1m'] = item.degreeOfDifficulty;
    }
  }

  return Array.from(mapByCode.values());
}

export function searchDives(query: string, diveList: DiveDefinition[] = []): DiveDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return diveList.filter(
    (d) =>
      d.code.toLowerCase().includes(q) ||
      d.nameDe.toLowerCase().includes(q) ||
      d.nameEn.toLowerCase().includes(q)
  );
}
