import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';

import { AuthState, ClubMembership, ClubRole, LoginCredentials, RegisterWithInvitePayload, User, GlobalRole } from '../app/types/user';
import { api, JWT_KEY, ACTIVE_CLUB_KEY, setAuthToken, storage, UserProfileResponse } from '../services/api';
import { dataStore } from '../services/dataStore';

// ────────────────────────────────────────────────────────────
// CONTEXT-TYP
// ────────────────────────────────────────────────────────────
interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  registerWithInvite: (payload: RegisterWithInvitePayload) => Promise<void>;
  logout: () => Promise<void>;
  switchClub: (clubId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
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
// USER PROFILE AGGREGATOR
// ────────────────────────────────────────────────────────────
async function buildUserFromProfile(profile: UserProfileResponse): Promise<User> {
  const roles = Array.isArray(profile?.roles)
    ? profile.roles
    : profile?.roles
    ? [profile.roles]
    : (profile as any)?.globalRole
    ? [(profile as any).globalRole]
    : [];

  const globalRole: GlobalRole =
    roles.includes('ROLE_ADMIN') || (profile as any)?.globalRole === 'ROLE_ADMIN'
      ? 'ROLE_ADMIN'
      : 'ROLE_USER';

  const memberships: ClubMembership[] = [];
  const clubIds: number[] = Array.isArray(profile?.clubIds)
    ? profile.clubIds
    : (profile as any)?.clubs
    ? (profile as any).clubs
    : [];

  if (clubIds.length > 0) {
    await Promise.all(
      clubIds.map(async (clubId) => {
        try {
          const club = await api.getClubById(clubId);
          let memberRole: ClubRole = 'MEMBER';
          let joinedAt = new Date().toISOString();

          try {
            const members = await api.getClubMembers(clubId);
            const myMembership = members.find((m) => String(m.userId) === String(profile.id));
            if (myMembership) {
              memberRole = myMembership.clubRole;
              joinedAt = myMembership.joinedAt || joinedAt;
            }
          } catch {
            // Member list may be forbidden for standard members
          }

          memberships.push({
            clubId: String(club.id),
            clubName: club.name,
            clubCity: club.city || '',
            role: memberRole,
            joinedAt,
          });
        } catch (e) {
          console.warn(`Failed to fetch details for club ${clubId}:`, e);
        }
      })
    );
  }

  return {
    id: String(profile.id),
    email: profile.email || '',
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    age: profile.age,
    gender: profile.gender as any,
    globalRole,
    memberships,
  };
}

// ────────────────────────────────────────────────────────────
// CONTEXT
// ────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load profile and memberships helper
  const loadProfile = useCallback(async (token: string, preferredClubId?: string | null) => {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    setAuthToken(cleanToken);
    const profile = await api.getMyProfile();
    const user = await buildUserFromProfile(profile);
    const activeClubId =
      preferredClubId && user.memberships.some((m) => m.clubId === preferredClubId)
        ? preferredClubId
        : user.memberships[0]?.clubId ?? null;

    dispatch({
      type: 'SET_AUTH',
      payload: { user, token: cleanToken, activeClubId },
    });
  }, []);

  // Beim Start: gespeichertes Token laden und /me aufrufen
  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await storage.getItem(JWT_KEY);
        const storedClubId = await storage.getItem(ACTIVE_CLUB_KEY);
        if (token && token.trim()) {
          try {
            await loadProfile(token.trim(), storedClubId);
            return;
          } catch (e) {
            console.warn('Stored token is invalid or expired:', e);
            await storage.deleteItem(JWT_KEY);
            await storage.deleteItem(ACTIVE_CLUB_KEY);
            setAuthToken(null);
          }
        }
      } catch (e) {
        console.warn('Storage bootstrap error:', e);
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    }
    bootstrap();
  }, [loadProfile]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const authRes = await api.login(credentials);
        if (!authRes.token) {
          throw new Error('No authentication token received from server');
        }
        await storage.setItem(JWT_KEY, authRes.token);
        await loadProfile(authRes.token);
      } catch (e) {
        setAuthToken(null);
        await storage.deleteItem(JWT_KEY);
        dispatch({ type: 'SET_LOADING', payload: false });
        throw e;
      }
    },
    [loadProfile]
  );

  const registerWithInvite = useCallback(
    async (payload: RegisterWithInvitePayload) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const authRes = await api.registerWithInvite({
          token: payload.inviteToken,
          password: payload.password,
          firstName: payload.firstName,
          lastName: payload.lastName,
          age: payload.age,
          gender: payload.gender,
        });
        if (!authRes.token) {
          throw new Error('No authentication token received from server');
        }
        await storage.setItem(JWT_KEY, authRes.token);
        await loadProfile(authRes.token);
      } catch (e) {
        setAuthToken(null);
        await storage.deleteItem(JWT_KEY);
        dispatch({ type: 'SET_LOADING', payload: false });
        throw e;
      }
    },
    [loadProfile]
  );

  const logout = useCallback(async () => {
    try {
      setAuthToken(null);
      await storage.deleteItem(JWT_KEY);
      await storage.deleteItem(ACTIVE_CLUB_KEY);
      dataStore.clearAll();
    } catch (e) {
      console.warn('Logout storage error:', e);
    }
    dispatch({ type: 'LOGOUT' });
  }, []);

  const switchClub = useCallback(async (clubId: string) => {
    try {
      await storage.setItem(ACTIVE_CLUB_KEY, clubId);
    } catch (e) {
      console.warn('SwitchClub storage error:', e);
    }
    dispatch({ type: 'SET_ACTIVE_CLUB', payload: clubId });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.token) return;
    await loadProfile(state.token, state.activeClubId);
  }, [state.token, state.activeClubId, loadProfile]);

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
    () => hasClubRole('TRAINER') || state.user?.globalRole === 'ROLE_ADMIN',
    [hasClubRole, state.user]
  );

  const canManageInvites = useCallback(
    () =>
      state.user?.globalRole === 'ROLE_ADMIN' ||
      hasClubRole('TRAINER'),
    [state.user, hasClubRole]
  );

  const value: AuthContextValue = {
    ...state,
    login,
    registerWithInvite,
    logout,
    switchClub,
    refreshProfile,
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
