import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const JWT_KEY = 'springboard_jwt';
export const ACTIVE_CLUB_KEY = 'springboard_active_club';

// Configure base API URL (supports web, android emulator, and external config)
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:9000' : 'http://localhost:9000');

// ────────────────────────────────────────────────────────────
// Backend DTOs & Models
// ────────────────────────────────────────────────────────────

export type BackendHeight = 'ONE_METER' | 'THREE_METER' | 'FIVE_METER' | 'SEVEN_HALF_METER' | 'TEN_METER';
export type UIHeight = '1m' | '3m' | '5m' | '7.5m' | '10m';

export const HEIGHT_TO_BACKEND: Record<UIHeight, BackendHeight> = {
  '1m': 'ONE_METER',
  '3m': 'THREE_METER',
  '5m': 'FIVE_METER',
  '7.5m': 'SEVEN_HALF_METER',
  '10m': 'TEN_METER',
};

export const BACKEND_TO_HEIGHT: Record<BackendHeight, UIHeight> = {
  ONE_METER: '1m',
  THREE_METER: '3m',
  FIVE_METER: '5m',
  SEVEN_HALF_METER: '7.5m',
  TEN_METER: '10m',
};

export interface UserProfileResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  age?: number;
  gender?: string;
  roles: ('ROLE_ADMIN' | 'ROLE_USER')[];
  clubIds: number[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
}

export interface ClubResponse {
  id: number;
  name: string;
  city?: string;
}

export interface CreateClubRequest {
  name: string;
  city?: string;
}

export interface UpdateClubRequest {
  name: string;
  city?: string;
}

export interface MembershipResponse {
  id: number;
  userId: number;
  userFullName: string;
  userEmail: string;
  clubId: number;
  clubName: string;
  clubRole: 'CLUB_ADMIN' | 'TRAINER' | 'MEMBER';
  joinedAt: string;
}

export interface AddMemberRequest {
  userId: number;
  clubRole: 'CLUB_ADMIN' | 'TRAINER' | 'MEMBER';
}

export interface UpdateMemberRoleRequest {
  clubRole: 'CLUB_ADMIN' | 'TRAINER' | 'MEMBER';
}

export interface CreateInvitationRequest {
  email: string;
  clubId: number;
  role: 'CLUB_ADMIN' | 'TRAINER' | 'MEMBER';
}

export interface InvitationResponse {
  token: string;
  email: string;
  clubId: number;
  clubName: string;
  targetRole: 'CLUB_ADMIN' | 'TRAINER' | 'MEMBER';
  expiresAt: string;
}

export interface DiveResponse {
  id: number;
  code: string;
  execution: 'A' | 'B' | 'C' | 'D';
  nameDe: string;
  nameEn: string;
  groupNumber: number;
  degreeOfDifficulty: number;
}

export interface CreateDiveRequest {
  code: string;
  execution: 'A' | 'B' | 'C' | 'D';
  nameDe: string;
  nameEn: string;
  groupNumber: number;
  degreeOfDifficulty: number;
}

export interface UpdateDiveRequest {
  code: string;
  execution: 'A' | 'B' | 'C' | 'D';
  nameDe: string;
  nameEn: string;
  groupNumber: number;
  degreeOfDifficulty: number;
}

export interface AthleteDiveStatusResponse {
  id: number;
  athleteId: number;
  diveId: number;
  diveCode: string;
  execution: 'A' | 'B' | 'C' | 'D';
  diveName: string;
  groupNumber: number;
  degreeOfDifficulty: number;
  height: BackendHeight;
  status: 'PLANNED' | 'LEARNING' | 'MASTERED';
}

export interface UpdateDiveStatusRequest {
  diveId: number;
  execution: 'A' | 'B' | 'C' | 'D';
  height: BackendHeight;
  status: 'PLANNED' | 'LEARNING' | 'MASTERED';
}

export interface CommentResponse {
  id: number;
  content: string;
  sharedWithAthlete: boolean;
  authorId: number;
  authorName: string;
  athleteId: number;
  athleteDiveStatusId?: number;
  createdAt: string;
}

export interface CreateCommentRequest {
  athleteId: number;
  content: string;
  sharedWithAthlete: boolean;
  athleteDiveStatusId?: number;
}

export interface UpdateCommentRequest {
  content: string;
  sharedWithAthlete: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterWithInviteRequest {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
  age?: number;
  gender?: string;
}

export interface AuthResponse {
  token: string;
}

// ────────────────────────────────────────────────────────────
// HTTP Client Helper
// ────────────────────────────────────────────────────────────

let inMemoryToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  inMemoryToken = token;
};

export const getAuthToken = async (): Promise<string | null> => {
  if (inMemoryToken) return inMemoryToken;
  try {
    const token = await SecureStore.getItemAsync(JWT_KEY);
    if (token) inMemoryToken = token;
    return token;
  } catch {
    return inMemoryToken;
  }
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new ApiError(errorDetail || `Request failed with status ${res.status}`, res.status);
  }

  // If 204 No Content or empty body
  if (res.status === 204) {
    return {} as T;
  }

  const text = await res.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ────────────────────────────────────────────────────────────
// API Service Methods
// ────────────────────────────────────────────────────────────

export const api = {
  // ── Authentication ──
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    return res;
  },

  async registerWithInvite(payload: RegisterWithInviteRequest): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/v1/auth/register-invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    return res;
  },

  // ── Users ──
  async getMyProfile(): Promise<UserProfileResponse> {
    return request<UserProfileResponse>('/api/v1/users/me');
  },

  async updateMyProfile(payload: UpdateUserRequest): Promise<UserProfileResponse> {
    return request<UserProfileResponse>('/api/v1/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getUserById(id: number | string): Promise<UserProfileResponse> {
    return request<UserProfileResponse>(`/api/v1/users/${id}`);
  },

  async getAllUsers(): Promise<UserProfileResponse[]> {
    return request<UserProfileResponse[]>('/api/v1/users');
  },

  async deleteUser(id: number | string): Promise<void> {
    return request<void>(`/api/v1/users/${id}`, { method: 'DELETE' });
  },

  // ── Clubs ──
  async getAllClubs(): Promise<ClubResponse[]> {
    return request<ClubResponse[]>('/api/v1/clubs');
  },

  async getClubById(id: number | string): Promise<ClubResponse> {
    return request<ClubResponse>(`/api/v1/clubs/${id}`);
  },

  async createClub(payload: CreateClubRequest): Promise<ClubResponse> {
    return request<ClubResponse>('/api/v1/clubs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateClub(id: number | string, payload: UpdateClubRequest): Promise<ClubResponse> {
    return request<ClubResponse>(`/api/v1/clubs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteClub(id: number | string): Promise<void> {
    return request<void>(`/api/v1/clubs/${id}`, { method: 'DELETE' });
  },

  // ── Club Memberships ──
  async getClubMembers(clubId: number | string): Promise<MembershipResponse[]> {
    return request<MembershipResponse[]>(`/api/v1/clubs/${clubId}/members`);
  },

  async addMember(clubId: number | string, payload: AddMemberRequest): Promise<MembershipResponse> {
    return request<MembershipResponse>(`/api/v1/clubs/${clubId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMembershipById(clubId: number | string, membershipId: number | string): Promise<MembershipResponse> {
    return request<MembershipResponse>(`/api/v1/clubs/${clubId}/members/${membershipId}`);
  },

  async updateMemberRole(clubId: number | string, membershipId: number | string, payload: UpdateMemberRoleRequest): Promise<MembershipResponse> {
    return request<MembershipResponse>(`/api/v1/clubs/${clubId}/members/${membershipId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async removeMember(clubId: number | string, membershipId: number | string): Promise<void> {
    return request<void>(`/api/v1/clubs/${clubId}/members/${membershipId}`, { method: 'DELETE' });
  },

  // ── Invitations ──
  async createInvitation(payload: CreateInvitationRequest): Promise<InvitationResponse> {
    return request<InvitationResponse>('/api/v1/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ── Dives (Global Catalog) ──
  async getAllDives(): Promise<DiveResponse[]> {
    return request<DiveResponse[]>('/api/v1/dives');
  },

  async getDiveById(id: number | string): Promise<DiveResponse> {
    return request<DiveResponse>(`/api/v1/dives/${id}`);
  },

  async createDive(payload: CreateDiveRequest): Promise<DiveResponse> {
    return request<DiveResponse>('/api/v1/dives', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateDive(id: number | string, payload: UpdateDiveRequest): Promise<DiveResponse> {
    return request<DiveResponse>(`/api/v1/dives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteDive(id: number | string): Promise<void> {
    return request<void>(`/api/v1/dives/${id}`, { method: 'DELETE' });
  },

  // ── Athlete Dives ──
  async getAthleteDives(athleteId: number | string): Promise<AthleteDiveStatusResponse[]> {
    return request<AthleteDiveStatusResponse[]>(`/api/v1/athletes/${athleteId}/dives`);
  },

  async updateAthleteDive(athleteId: number | string, payload: UpdateDiveStatusRequest): Promise<AthleteDiveStatusResponse> {
    return request<AthleteDiveStatusResponse>(`/api/v1/athletes/${athleteId}/dives`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteAthleteDive(athleteId: number | string, statusId: number | string): Promise<void> {
    return request<void>(`/api/v1/athletes/${athleteId}/dives/${statusId}`, { method: 'DELETE' });
  },

  // ── Comments & Notes ──
  async getAthleteComments(athleteId: number | string): Promise<CommentResponse[]> {
    return request<CommentResponse[]>(`/api/v1/athletes/${athleteId}/comments`);
  },

  async createComment(athleteId: number | string, payload: CreateCommentRequest): Promise<CommentResponse> {
    return request<CommentResponse>(`/api/v1/athletes/${athleteId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateComment(athleteId: number | string, commentId: number | string, payload: UpdateCommentRequest): Promise<CommentResponse> {
    return request<CommentResponse>(`/api/v1/athletes/${athleteId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteComment(athleteId: number | string, commentId: number | string): Promise<void> {
    return request<void>(`/api/v1/athletes/${athleteId}/comments/${commentId}`, { method: 'DELETE' });
  },
};
