// ────────────────────────────────────────────────────────────
// Globale Rollen (systemweit)
// ────────────────────────────────────────────────────────────
export type GlobalRole = 'ROLE_ADMIN' | 'ROLE_USER';

// ────────────────────────────────────────────────────────────
// Vereinsbezogene Rollen (pro Club-Mitgliedschaft)
// ────────────────────────────────────────────────────────────
export type ClubRole = 'TRAINER' | 'MEMBER';

// ────────────────────────────────────────────────────────────
// Mitgliedschaft eines Users in einem Verein
// ────────────────────────────────────────────────────────────
export interface ClubMembership {
  clubId: string;
  clubName: string;
  clubCity: string;
  role: ClubRole;
  joinedAt: string; // ISO 8601
}

// ────────────────────────────────────────────────────────────
// User-Profil (aus JWT / Profil-Endpoint)
// ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  globalRole: GlobalRole;
  memberships: ClubMembership[];
  // Verknüpfte Kinder (für Eltern-Accounts)
  linkedAthleteIds?: string[];
}

// ────────────────────────────────────────────────────────────
// Auth-State im Context
// ────────────────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  token: string | null;
  activeClubId: string | null;
  isLoading: boolean;
}

// ────────────────────────────────────────────────────────────
// Eingabe-Typen für Auth-Operationen
// ────────────────────────────────────────────────────────────
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterWithInvitePayload {
  inviteToken: string;
  email: string; // Read-only aus Token
  firstName: string;
  lastName: string;
  password: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
}

// ────────────────────────────────────────────────────────────
// Athlet (vereinfachte Darstellung für Trainer-Dashboard)
// ────────────────────────────────────────────────────────────
export interface AthleteListItem {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  category: 'YOUTH' | 'COMPETITIVE' | 'OTHER';
  masteredDiveCount: number;
  avatarColor?: string; // Für initialen-Avatar
}
