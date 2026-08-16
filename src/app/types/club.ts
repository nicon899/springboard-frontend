import { ClubRole } from './user';

// ────────────────────────────────────────────────────────────
// Verein (detaillierte Ansicht)
// ────────────────────────────────────────────────────────────
export interface Club {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  foundedYear?: number;
}

// ────────────────────────────────────────────────────────────
// Einladung (generiert von CLUB_ADMIN / ROLE_ADMIN)
// ────────────────────────────────────────────────────────────
export type InvitationRole = ClubRole; // MEMBER | TRAINER | CLUB_ADMIN

export interface Invitation {
  token: string;
  email: string;
  targetRole: InvitationRole;
  clubId: string;
  clubName: string;
  expiresAt: string; // ISO 8601
  createdAt: string;
  usedAt?: string;
}

// ────────────────────────────────────────────────────────────
// Anforderungs-Payload für neue Einladung
// ────────────────────────────────────────────────────────────
export interface CreateInvitationPayload {
  email: string;
  targetRole: InvitationRole;
  clubId: string;
}
