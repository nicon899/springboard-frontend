import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import { AuthState, ClubRole, LoginCredentials, RegisterWithInvitePayload, User } from '../app/types/user';
import { ClubMembership } from '../app/types/user';

// ────────────────────────────────────────────────────────────
// SECURE-STORE KEYS
// ────────────────────────────────────────────────────────────
const JWT_KEY = 'springboard_jwt';
const ACTIVE_CLUB_KEY = 'springboard_active_club';

// ────────────────────────────────────────────────────────────
// CONTEXT-TYP
// ────────────────────────────────────────────────────────────
interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  registerWithInvite: (payload: RegisterWithInvitePayload) => Promise<void>;
  logout: () => Promise<void>;
  switchClub: (clubId: string) => Promise<void>;
  // Hilfsfunktionen
  hasClubRole: (...roles: ClubRole[]) => boolean;
  isTrainerOrAdmin: () => boolean;
  canManageInvites: () => boolean;
  activeClubMembership: ClubMembership | null;
}

// ────────────────────────────────────────────────────────────
// REDUCER
// ────────────────────────────────────────────────────────────
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AUTH'; payload: { user: User; token: string; activeClubId: string | null } }
  | { type: 'SET_ACTIVE_CLUB'; payload: string }
  | { type: 'LOGOUT' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_AUTH':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        activeClubId: action.payload.activeClubId,
        isLoading: false,
      };
    case 'SET_ACTIVE_CLUB':
      return { ...state, activeClubId: action.payload };
    case 'LOGOUT':
      return { user: null, token: null, activeClubId: null, isLoading: false };
    default:
      return state;
  }
}

const initialState: AuthState = {
  user: null,
  token: null,
  activeClubId: null,
  isLoading: true,
};

// ────────────────────────────────────────────────────────────
// MOCK-API FUNKTIONEN (TODO: replace with real API calls)
// ────────────────────────────────────────────────────────────
const MOCK_DELAY = 800;

async function mockLogin(email: string, _password: string): Promise<{ user: User; token: string }> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY));

  // Demo-User: Trainer
  if (email.toLowerCase().includes('trainer')) {
    const user: User = {
      id: 'u-trainer-1',
      email,
      firstName: 'Max',
      lastName: 'Mustermann',
      globalRole: 'ROLE_USER',
      memberships: [
        {
          clubId: 'club-1',
          clubName: 'SC Wasserfreunde Berlin',
          clubCity: 'Berlin',
          role: 'TRAINER',
          joinedAt: '2023-01-15T00:00:00Z',
        },
      ],
    };
    return { user, token: 'mock-jwt-trainer-token' };
  }

  // Demo-User: Member
  const user: User = {
    id: 'u-member-1',
    email,
    firstName: 'Anna',
    lastName: 'Musterfrau',
    age: 17,
    gender: 'FEMALE',
    globalRole: 'ROLE_USER',
    memberships: [
      {
        clubId: 'club-1',
        clubName: 'SC Wasserfreunde Berlin',
        clubCity: 'Berlin',
        role: 'MEMBER',
        joinedAt: '2023-03-01T00:00:00Z',
      },
      {
        clubId: 'club-2',
        clubName: 'Berliner SV 1924',
        clubCity: 'Berlin',
        role: 'MEMBER',
        joinedAt: '2024-01-10T00:00:00Z',
      },
    ],
  };
  return { user, token: 'mock-jwt-member-token' };
}

async function mockRegisterWithInvite(payload: RegisterWithInvitePayload): Promise<{ user: User; token: string }> {
  await new Promise((r) => setTimeout(r, MOCK_DELAY));
  const user: User = {
    id: `u-new-${Date.now()}`,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    age: payload.age,
    gender: payload.gender,
    globalRole: 'ROLE_USER',
    memberships: [
      {
        clubId: 'club-1',
        clubName: 'SC Wasserfreunde Berlin',
        clubCity: 'Berlin',
        role: 'MEMBER',
        joinedAt: new Date().toISOString(),
      },
    ],
  };
  return { user, token: `mock-jwt-new-${Date.now()}` };
}

// ────────────────────────────────────────────────────────────
// CONTEXT
// ────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Beim Start: gespeichertes Token laden
  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await SecureStore.getItemAsync(JWT_KEY);
        const activeClubId = await SecureStore.getItemAsync(ACTIVE_CLUB_KEY);
        if (token) {
          // TODO: Hier würde ein /me-Endpoint aufgerufen, um das Profil zu laden
          // Für das Scaffold: Mock-Profil aus Demo-Token
          const isMock = token.startsWith('mock-jwt-');
          if (isMock) {
            const isTrainer = token.includes('trainer');
            const user: User = isTrainer
              ? {
                  id: 'u-trainer-1',
                  email: 'trainer@springboard.app',
                  firstName: 'Max',
                  lastName: 'Mustermann',
                  globalRole: 'ROLE_USER',
                  memberships: [
                    { clubId: 'club-1', clubName: 'SC Wasserfreunde Berlin', clubCity: 'Berlin', role: 'TRAINER', joinedAt: '2023-01-15T00:00:00Z' },
                  ],
                }
              : {
                  id: 'u-member-1',
                  email: 'anna@springboard.app',
                  firstName: 'Anna',
                  lastName: 'Musterfrau',
                  age: 17,
                  gender: 'FEMALE',
                  globalRole: 'ROLE_USER',
                  memberships: [
                    { clubId: 'club-1', clubName: 'SC Wasserfreunde Berlin', clubCity: 'Berlin', role: 'MEMBER', joinedAt: '2023-03-01T00:00:00Z' },
                    { clubId: 'club-2', clubName: 'Berliner SV 1924', clubCity: 'Berlin', role: 'MEMBER', joinedAt: '2024-01-10T00:00:00Z' },
                  ],
                };
            dispatch({
              type: 'SET_AUTH',
              payload: {
                user,
                token,
                activeClubId: activeClubId ?? user.memberships[0]?.clubId ?? null,
              },
            });
            return;
          }
        }
      } catch (e) {
        // SecureStore nicht verfügbar (z.B. Web)
        console.warn('SecureStore unavailable:', e);
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    }
    bootstrap();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { user, token } = await mockLogin(credentials.email, credentials.password);
      const activeClubId = user.memberships[0]?.clubId ?? null;
      await SecureStore.setItemAsync(JWT_KEY, token);
      if (activeClubId) await SecureStore.setItemAsync(ACTIVE_CLUB_KEY, activeClubId);
      dispatch({ type: 'SET_AUTH', payload: { user, token, activeClubId } });
    } catch (e) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw e;
    }
  }, []);

  const registerWithInvite = useCallback(async (payload: RegisterWithInvitePayload) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { user, token } = await mockRegisterWithInvite(payload);
      const activeClubId = user.memberships[0]?.clubId ?? null;
      await SecureStore.setItemAsync(JWT_KEY, token);
      if (activeClubId) await SecureStore.setItemAsync(ACTIVE_CLUB_KEY, activeClubId);
      dispatch({ type: 'SET_AUTH', payload: { user, token, activeClubId } });
    } catch (e) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(JWT_KEY);
      await SecureStore.deleteItemAsync(ACTIVE_CLUB_KEY);
    } catch (e) {
      console.warn('Logout SecureStore error:', e);
    }
    dispatch({ type: 'LOGOUT' });
  }, []);

  const switchClub = useCallback(async (clubId: string) => {
    try {
      await SecureStore.setItemAsync(ACTIVE_CLUB_KEY, clubId);
    } catch (e) {
      console.warn('SwitchClub SecureStore error:', e);
    }
    dispatch({ type: 'SET_ACTIVE_CLUB', payload: clubId });
  }, []);

  // ── Hilfsfunktionen ──
  const activeClubMembership: ClubMembership | null =
    state.user?.memberships.find((m) => m.clubId === state.activeClubId) ?? null;

  const hasClubRole = useCallback(
    (...roles: ClubRole[]) => {
      if (!activeClubMembership) return false;
      return roles.includes(activeClubMembership.role);
    },
    [activeClubMembership]
  );

  const isTrainerOrAdmin = useCallback(
    () => hasClubRole('TRAINER', 'CLUB_ADMIN'),
    [hasClubRole]
  );

  const canManageInvites = useCallback(
    () =>
      state.user?.globalRole === 'ROLE_ADMIN' ||
      hasClubRole('CLUB_ADMIN'),
    [state.user, hasClubRole]
  );

  const value: AuthContextValue = {
    ...state,
    login,
    registerWithInvite,
    logout,
    switchClub,
    hasClubRole,
    isTrainerOrAdmin,
    canManageInvites,
    activeClubMembership,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
