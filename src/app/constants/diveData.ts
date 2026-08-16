import { DiveDefinition } from '../types/dive';

// ────────────────────────────────────────────────────────────
// FINA-SPRUNGKATALOG (Auswahl, erweiterbar)
// ────────────────────────────────────────────────────────────
export const SAMPLE_DIVES: DiveDefinition[] = [
    // GRUPPE 1 – Vorwärts
    {
        code: '101',
        groupNumber: 1,
        nameDe: 'Kopfsprung vorwärts',
        nameEn: 'Forward Dive',
        difficulties: {
            A: { '1m': 1.4, '3m': 1.6, '5m': 1.4, '7.5m': 1.6, '10m': 1.6 },
            B: { '1m': 1.3, '3m': 1.5, '5m': 1.3, '7.5m': 1.5, '10m': 1.5 },
            C: { '1m': 1.2, '3m': 1.4, '5m': 1.2, '7.5m': 1.4, '10m': 1.4 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    {
        code: '103',
        groupNumber: 1,
        nameDe: '1½ Salto vorwärts',
        nameEn: 'Forward 1½ Somersaults',
        difficulties: {
            A: { '1m': 2.0, '3m': 2.2, '5m': 1.7, '7.5m': 1.9, '10m': 1.9 },
            B: { '1m': 1.7, '3m': 1.9, '5m': 1.6, '7.5m': 1.8, '10m': 1.8 },
            C: { '1m': 1.6, '3m': 1.8, '5m': 1.5, '7.5m': 1.7, '10m': 1.7 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    {
        code: '105',
        groupNumber: 1,
        nameDe: '2½ Salto vorwärts',
        nameEn: 'Forward 2½ Somersaults',
        difficulties: {
            A: { '1m': null, '3m': 2.4, '5m': 2.4, '7.5m': 2.4, '10m': 2.4 },
            B: { '1m': 2.4, '3m': 2.6, '5m': 2.4, '7.5m': 2.6, '10m': 2.6 },
            C: { '1m': 2.2, '3m': 2.4, '5m': 2.2, '7.5m': 2.4, '10m': 2.4 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    // GRUPPE 2 – Rückwärts
    {
        code: '201',
        groupNumber: 2,
        nameDe: 'Kopfsprung rückwärts',
        nameEn: 'Back Dive',
        difficulties: {
            A: { '1m': 1.7, '3m': 1.9, '5m': 1.7, '7.5m': 1.9, '10m': 1.9 },
            B: { '1m': 1.6, '3m': 1.8, '5m': 1.6, '7.5m': 1.8, '10m': 1.8 },
            C: { '1m': 1.4, '3m': 1.6, '5m': null, '7.5m': null, '10m': null },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    {
        code: '203',
        groupNumber: 2,
        nameDe: '1½ Salto rückwärts',
        nameEn: 'Back 1½ Somersaults',
        difficulties: {
            A: { '1m': null, '3m': 2.0, '5m': 1.7, '7.5m': 1.9, '10m': 1.9 },
            B: { '1m': 1.7, '3m': 1.9, '5m': 1.6, '7.5m': 1.8, '10m': 1.8 },
            C: { '1m': 1.5, '3m': 1.7, '5m': 1.5, '7.5m': 1.7, '10m': 1.7 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    // GRUPPE 3 – Auerbach
    {
        code: '301',
        groupNumber: 3,
        nameDe: 'Kopfsprung Auerbach',
        nameEn: 'Reverse Dive',
        difficulties: {
            A: { '1m': 1.8, '3m': 2.0, '5m': 1.7, '7.5m': 1.9, '10m': 1.9 },
            B: { '1m': 1.7, '3m': 1.9, '5m': 1.6, '7.5m': 1.8, '10m': 1.8 },
            C: { '1m': 1.5, '3m': 1.7, '5m': null, '7.5m': null, '10m': null },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    // GRUPPE 4 – Delphin
    {
        code: '401',
        groupNumber: 4,
        nameDe: 'Kopfsprung Delphin',
        nameEn: 'Inward Dive',
        difficulties: {
            A: { '1m': 1.9, '3m': 2.1, '5m': 1.9, '7.5m': 2.1, '10m': 2.1 },
            B: { '1m': 1.7, '3m': 1.9, '5m': 1.7, '7.5m': 1.9, '10m': 1.9 },
            C: { '1m': 1.5, '3m': 1.7, '5m': 1.5, '7.5m': 1.7, '10m': 1.7 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    {
        code: '403',
        groupNumber: 4,
        nameDe: '1½ Salto Delphin',
        nameEn: 'Inward 1½ Somersaults',
        difficulties: {
            A: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
            B: { '1m': 2.4, '3m': 2.6, '5m': 2.1, '7.5m': 2.3, '10m': 2.3 },
            C: { '1m': 2.2, '3m': 2.4, '5m': 1.9, '7.5m': 2.1, '10m': 2.1 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
    // GRUPPE 5 – Schrauben
    {
        code: '5132',
        groupNumber: 5,
        nameDe: '1½ Salto vorwärts mit 1 Schraube',
        nameEn: 'Forward 1½ Somersaults, 1 Twist',
        difficulties: {
            A: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
            B: { '1m': 2.2, '3m': 2.4, '5m': 2.2, '7.5m': 2.4, '10m': 2.4 },
            C: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
            D: { '1m': 2.1, '3m': 2.3, '5m': 2.1, '7.5m': 2.3, '10m': 2.3 },
        },
    },
    {
        code: '5231',
        groupNumber: 5,
        nameDe: '1½ Salto rückwärts mit ½ Schraube',
        nameEn: 'Back 1½ Somersaults, ½ Twist',
        difficulties: {
            A: { '1m': 2.1, '3m': 2.3, '5m': 2.0, '7.5m': 2.2, '10m': 2.2 },
            B: { '1m': 2.0, '3m': 2.2, '5m': 1.9, '7.5m': 2.1, '10m': 2.1 },
            C: { '1m': 1.9, '3m': 2.1, '5m': 1.8, '7.5m': 2.0, '10m': 2.0 },
            D: { '1m': 2.0, '3m': 2.2, '5m': 1.9, '7.5m': 2.1, '10m': 2.1 },
        },
    },
    {
        code: '5335',
        groupNumber: 5,
        nameDe: '2½ Salto Auerbach mit 2½ Schrauben',
        nameEn: 'Reverse 2½ Somersaults, 2½ Twists',
        difficulties: {
            A: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
            B: { '1m': null, '3m': null, '5m': 3.8, '7.5m': 3.8, '10m': 3.8 },
            C: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
            D: { '1m': null, '3m': null, '5m': 3.5, '7.5m': 3.5, '10m': 3.5 },
        },
    },
    // GRUPPE 6 – Handstand
    {
        code: '612',
        groupNumber: 6,
        nameDe: '1 Salto vorwärts vom Handstand',
        nameEn: 'Armstand 1 Somersault Forward',
        difficulties: {
            A: { '1m': null, '3m': null, '5m': 2.2, '7.5m': 2.4, '10m': 2.4 },
            B: { '1m': null, '3m': null, '5m': 2.0, '7.5m': 2.2, '10m': 2.2 },
            C: { '1m': null, '3m': null, '5m': 1.9, '7.5m': 2.1, '10m': 2.1 },
            D: { '1m': null, '3m': null, '5m': null, '7.5m': null, '10m': null },
        },
    },
];

// ────────────────────────────────────────────────────────────
// GRUPPE-NAMEN (Deutsch & Englisch)
// ────────────────────────────────────────────────────────────
export const DIVE_GROUP_NAMES: Record<number, { de: string; en: string }> = {
    1: { de: 'Vorwärts', en: 'Forward' },
    2: { de: 'Rückwärts', en: 'Back' },
    3: { de: 'Auerbach', en: 'Reverse' },
    4: { de: 'Delphin', en: 'Inward' },
    5: { de: 'Schrauben', en: 'Twisting' },
    6: { de: 'Handstand', en: 'Armstand' },
};

// ────────────────────────────────────────────────────────────
// SUCHFUNKTION: Liefert exakt die Treffer (Strikte Ein-Treffer-Logik)
// ────────────────────────────────────────────────────────────
export function searchDives(query: string): DiveDefinition[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SAMPLE_DIVES.filter(
        (d) =>
            d.code.toLowerCase() === q ||
            d.nameDe.toLowerCase().includes(q) ||
            d.nameEn.toLowerCase().includes(q)
    );
}