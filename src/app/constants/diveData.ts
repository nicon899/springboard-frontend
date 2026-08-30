import { DiveDefinition, DiveGroup } from '../types/dive';
import { DiveExecutionResponse, BACKEND_TO_HEIGHT } from '../../services/api';

export const DIVE_GROUP_NAMES: Record<number, { de: string; en: string }> = {
  1: { de: 'Vorwärts', en: 'Forward' },
  2: { de: 'Rückwärts', en: 'Back' },
  3: { de: 'Auerbach', en: 'Reverse' },
  4: { de: 'Delphin', en: 'Inward' },
  5: { de: 'Schrauben', en: 'Twisting' },
  6: { de: 'Handstand', en: 'Armstand' },
};

/**
 * Transforms API dive execution responses into DiveDefinition objects.
 * Each DiveExecutionResponse represents one (dive × execution × height) combination.
 */
export function mapApiDivesToDefinitions(apiExecutions: DiveExecutionResponse[]): DiveDefinition[] {
  const mapByCode = new Map<string, DiveDefinition>();

  for (const item of apiExecutions) {
    let existing = mapByCode.get(item.diveCode);
    if (!existing) {
      existing = {
        code: item.diveCode,
        groupNumber: (item.groupNumber || 1) as DiveGroup,
        nameDe: item.nameDe || item.diveCode,
        nameEn: item.nameEn || item.diveCode,
        difficulties: {
          A: {},
          B: {},
          C: {},
          D: {},
        },
      };
      mapByCode.set(item.diveCode, existing);
    }

    if (item.nameDe) existing.nameDe = item.nameDe;
    if (item.nameEn) existing.nameEn = item.nameEn;
    if (item.groupNumber) existing.groupNumber = item.groupNumber as DiveGroup;

    if (item.execution && item.degreeOfDifficulty != null) {
      if (!existing.difficulties[item.execution]) {
        existing.difficulties[item.execution] = {};
      }
      const uiHeight = BACKEND_TO_HEIGHT[item.height];
      if (uiHeight) {
        existing.difficulties[item.execution][uiHeight] = item.degreeOfDifficulty;
      }
    }
  }

  return Array.from(mapByCode.values());
}

export function searchDives(query: string, diveList: DiveDefinition[] = []): DiveDefinition[] {
  const q = query.trim().toLowerCase();
  const qClean = q.replace(/\s+/g, '');
  if (!q) return [];
  return diveList.filter((d) => {
    const matchBaseCode = d.code.toLowerCase().includes(q);
    const matchFullCode = Object.keys(d.difficulties || {}).some(
      (pos) => `${d.code}${pos}`.toLowerCase().includes(qClean) || `${d.code} ${pos}`.toLowerCase().includes(q)
    );
    const matchNameDe = d.nameDe?.toLowerCase().includes(q);
    const matchNameEn = d.nameEn?.toLowerCase().includes(q);

    return matchBaseCode || matchFullCode || matchNameDe || matchNameEn;
  });
}
