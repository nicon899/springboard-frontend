export type DiveGroup = 1 | 2 | 3 | 4 | 5 | 6; // 1: Vorwärts, 2: Rückwärts, 3: Auerbach, 4: Delphin, 5: Schrauben, 6: Handstand

export type ExecutionPosition = 'A' | 'B' | 'C' | 'D'; // A: Gestreckt, B: Gehechtet, C: Gehockt, D: Frei

export type DiveHeight = '1m' | '3m' | '5m' | '7.5m' | '10m';

export type DiveStatus = 'PLANNED' | 'LEARNING' | 'MASTERED';

export interface DiveDifficultyMatrix {
    // DD pro Position und Höhe: matrix[position][height] = DD | null
    [position: string]: {
        [height in DiveHeight]?: number | null;
    };
}

export interface DiveDefinition {
    code: string; // z.B. "101", "403", "5231"
    groupNumber: DiveGroup;
    nameDe: string;
    nameEn: string;
    difficulties: DiveDifficultyMatrix;
}

// ────────────────────────────────────────────────────────────
// Trainer-Notiz zu einem Sprung im Trainingsplan
// ────────────────────────────────────────────────────────────
export interface TrainerNote {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: string; // ISO 8601
    sharedWithAthlete: boolean; // DSGVO: false = nur für Trainer sichtbar
}

// ────────────────────────────────────────────────────────────
// Ein Sprung im Trainingsplan eines Athleten
// ────────────────────────────────────────────────────────────
export interface AthleteTrainingEntry {
    id: string;
    athleteId: string;
    diveCode: string;
    execution?: ExecutionPosition;
    degreeOfDifficulty?: number;
    diveExecutionId?: number;
    height: DiveHeight;
    status: DiveStatus;
    learnedAt?: string | null;
    notes: TrainerNote[];
    addedAt: string; // ISO 8601
    updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// Status-Änderungs-Event (für Audit-Log / API)
// ────────────────────────────────────────────────────────────
export interface DiveStatusChange {
    entryId: string;
    previousStatus: DiveStatus;
    newStatus: DiveStatus;
    changedBy: string; // userId
    changedAt: string; // ISO 8601
}