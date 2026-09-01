import {
  api,
  AthleteDiveStatusResponse,
  DiveExecutionResponse,
  RoutineResponse,
  CommentResponse,
  MembershipResponse,
  RoutineSpecificationResponse,
  AgeCategoryResponse,
  UserProfileResponse,
  CreateCommentRequest,
  UpdateCommentRequest,
  CreateRoutineRequest,
  UpdateRoutineRequest,
  CreateRoutineSpecificationRequest,
  UpdateRoutineSpecificationRequest,
  CreateAgeCategoryRequest,
  UpdateAgeCategoryRequest,
} from './api';

// ────────────────────────────────────────────────────────────
// Types & Static Empty Fallbacks (Immutable references for React)
// ────────────────────────────────────────────────────────────

export interface StoreEntry<T> {
  data: T;
  isLoading: boolean;
  lastUpdated: number;
}

export const EMPTY_ARRAY_ENTRY: StoreEntry<any[]> = Object.freeze({
  data: Object.freeze([]),
  isLoading: false,
  lastUpdated: 0,
});

export const EMPTY_OBJECT_ENTRY: StoreEntry<Record<string, number>> = Object.freeze({
  data: Object.freeze({}),
  isLoading: false,
  lastUpdated: 0,
});

export interface EnrichedAthlete {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  category: 'YOUTH' | 'COMPETITIVE';
  masteredDiveCount: number;
  unreadCommentCount: number;
}

type Listener = () => void;

export function toNum(id?: number | string | null): number | null {
  if (id === undefined || id === null || id === '') return null;
  const n = Number(id);
  return isNaN(n) || n === 0 ? null : n;
}

// ────────────────────────────────────────────────────────────
// Central Data Store Class
// ────────────────────────────────────────────────────────────

class CentralDataStore {
  // Static Reference Data (staleTime = Infinity)
  private diveExecutions: StoreEntry<DiveExecutionResponse[]> = EMPTY_ARRAY_ENTRY;
  private diveExecutionsPromise: Promise<DiveExecutionResponse[]> | null = null;

  // Dynamic Data per Key (Stores Stable StoreEntry<T> instances)
  private athleteDives: Map<number, StoreEntry<AthleteDiveStatusResponse[]>> = new Map();
  private athleteDivesPromises: Map<number, Promise<AthleteDiveStatusResponse[]>> = new Map();

  private athleteComments: Map<number, StoreEntry<CommentResponse[]>> = new Map();
  private athleteCommentsPromises: Map<number, Promise<CommentResponse[]>> = new Map();

  private userRoutines: Map<number, StoreEntry<RoutineResponse[]>> = new Map();
  private userRoutinesPromises: Map<number, Promise<RoutineResponse[]>> = new Map();

  private clubMembers: Map<number, StoreEntry<MembershipResponse[]>> = new Map();
  private clubMembersPromises: Map<number, Promise<MembershipResponse[]>> = new Map();

  private clubSpecifications: Map<number, StoreEntry<RoutineSpecificationResponse[]>> = new Map();
  private clubSpecificationsPromises: Map<number, Promise<RoutineSpecificationResponse[]>> = new Map();

  private clubAgeCategories: Map<number, StoreEntry<AgeCategoryResponse[]>> = new Map();
  private clubAgeCategoriesPromises: Map<number, Promise<AgeCategoryResponse[]>> = new Map();

  private clubUnreadCounts: Map<number, StoreEntry<Record<string, number>>> = new Map();
  private clubUnreadCountsPromises: Map<number, Promise<Record<string, number>>> = new Map();

  private userProfiles: Map<number, StoreEntry<UserProfileResponse | null>> = new Map();
  private userProfilesPromises: Map<number, Promise<UserProfileResponse | null>> = new Map();

  // Listeners for React subscriptions
  private listeners: Set<Listener> = new Set();
  private version: number = 0;

  // Stale Durations (in ms)
  private readonly DYNAMIC_STALE_MS = 30_000;
  private readonly UNREAD_POLL_INTERVAL_MS = 15_000;

  // Background polling intervals
  private unreadPollIntervals: Map<number, any> = new Map();

  // ──────────────────────────────────────────────────────────
  // Subscriptions & Notifications
  // ──────────────────────────────────────────────────────────

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getVersion = (): number => {
    return this.version;
  };

  public notify = () => {
    this.version++;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in DataStore listener:', err);
      }
    }
  };

  public clearAll = () => {
    this.diveExecutions = EMPTY_ARRAY_ENTRY;
    this.athleteDives.clear();
    this.athleteComments.clear();
    this.userRoutines.clear();
    this.clubMembers.clear();
    this.clubSpecifications.clear();
    this.clubAgeCategories.clear();
    this.clubUnreadCounts.clear();
    this.userProfiles.clear();
    this.stopAllPolling();
    this.notify();
  };

  // ──────────────────────────────────────────────────────────
  // 1. Static Catalog: Dive Executions (Cached Forever)
  // ──────────────────────────────────────────────────────────

  public getDiveExecutionsSnapshot = (): StoreEntry<DiveExecutionResponse[]> => {
    return this.diveExecutions;
  };

  public fetchDiveExecutionsAsync = async (forceRefresh = false): Promise<DiveExecutionResponse[]> => {
    if (this.diveExecutions.data.length > 0 && !forceRefresh) {
      return this.diveExecutions.data;
    }
    if (this.diveExecutionsPromise) {
      return this.diveExecutionsPromise;
    }

    this.diveExecutionsPromise = api.getAllDiveExecutions()
      .then((data) => {
        this.diveExecutions = { data, isLoading: false, lastUpdated: Date.now() };
        this.diveExecutionsPromise = null;
        this.notify();
        return data;
      })
      .catch((err) => {
        this.diveExecutionsPromise = null;
        this.diveExecutions = { data: this.diveExecutions.data, isLoading: false, lastUpdated: Date.now() };
        this.notify();
        return this.diveExecutions.data;
      });

    return this.diveExecutionsPromise;
  };

  // ──────────────────────────────────────────────────────────
  // 2. Dynamic: Athlete Dive Statuses
  // ──────────────────────────────────────────────────────────

  public getAthleteDivesSnapshot = (athleteId?: number | string | null): StoreEntry<AthleteDiveStatusResponse[]> => {
    const numId = toNum(athleteId);
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return this.athleteDives.get(numId) || EMPTY_ARRAY_ENTRY;
  };

  public fetchAthleteDivesAsync = async (athleteId?: number | string | null, forceRefresh = false): Promise<AthleteDiveStatusResponse[]> => {
    const numId = toNum(athleteId);
    if (!numId) return [];

    const entry = this.athleteDives.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > this.DYNAMIC_STALE_MS;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.athleteDivesPromises.has(numId)) {
      return this.athleteDivesPromises.get(numId)!;
    }

    const promise = api.getAthleteDives(numId)
      .then((data) => {
        this.athleteDives.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.athleteDivesPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch((err) => {
        this.athleteDivesPromises.delete(numId);
        const fallback = entry?.data || [];
        this.athleteDives.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.athleteDivesPromises.set(numId, promise);
    return promise;
  };

  // ──────────────────────────────────────────────────────────
  // 3. Dynamic: Athlete Comments
  // ──────────────────────────────────────────────────────────

  public getAthleteCommentsSnapshot = (athleteId?: number | string | null): StoreEntry<CommentResponse[]> => {
    const numId = toNum(athleteId);
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return this.athleteComments.get(numId) || EMPTY_ARRAY_ENTRY;
  };

  public fetchAthleteCommentsAsync = async (athleteId?: number | string | null, forceRefresh = false): Promise<CommentResponse[]> => {
    const numId = toNum(athleteId);
    if (!numId) return [];

    const entry = this.athleteComments.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > this.DYNAMIC_STALE_MS;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.athleteCommentsPromises.has(numId)) {
      return this.athleteCommentsPromises.get(numId)!;
    }

    const promise = api.getAthleteComments(numId)
      .then((data) => {
        this.athleteComments.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.athleteCommentsPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch((err) => {
        this.athleteCommentsPromises.delete(numId);
        const fallback = entry?.data || [];
        this.athleteComments.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.athleteCommentsPromises.set(numId, promise);
    return promise;
  };

  // ──────────────────────────────────────────────────────────
  // 4. Dynamic: User Routines
  // ──────────────────────────────────────────────────────────

  public getUserRoutinesSnapshot = (userId?: number | string | null): StoreEntry<RoutineResponse[]> => {
    const numId = toNum(userId);
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return this.userRoutines.get(numId) || EMPTY_ARRAY_ENTRY;
  };

  public fetchUserRoutinesAsync = async (userId?: number | string | null, forceRefresh = false): Promise<RoutineResponse[]> => {
    const numId = toNum(userId);
    if (!numId) return [];

    const entry = this.userRoutines.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > this.DYNAMIC_STALE_MS;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.userRoutinesPromises.has(numId)) {
      return this.userRoutinesPromises.get(numId)!;
    }

    const promise = api.getRoutinesByUser(numId)
      .then((data) => {
        this.userRoutines.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.userRoutinesPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch((err) => {
        this.userRoutinesPromises.delete(numId);
        const fallback = entry?.data || [];
        this.userRoutines.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.userRoutinesPromises.set(numId, promise);
    return promise;
  };

  // ──────────────────────────────────────────────────────────
  // 5. Dynamic: Club Members & Profiles
  // ──────────────────────────────────────────────────────────

  public getClubMembersSnapshot = (clubId?: number | string | null): StoreEntry<MembershipResponse[]> => {
    const numId = toNum(clubId);
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return this.clubMembers.get(numId) || EMPTY_ARRAY_ENTRY;
  };

  public fetchClubMembersAsync = async (clubId?: number | string | null, forceRefresh = false): Promise<MembershipResponse[]> => {
    const numId = toNum(clubId);
    if (!numId) return [];

    const entry = this.clubMembers.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > this.DYNAMIC_STALE_MS;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.clubMembersPromises.has(numId)) {
      return this.clubMembersPromises.get(numId)!;
    }

    const promise = api.getClubMembers(numId)
      .then((data) => {
        this.clubMembers.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.clubMembersPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch((err) => {
        this.clubMembersPromises.delete(numId);
        const fallback = entry?.data || [];
        this.clubMembers.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.clubMembersPromises.set(numId, promise);
    return promise;
  };

  public getUserProfile = (userId?: number | string | null): UserProfileResponse | null => {
    const numId = toNum(userId);
    if (!numId) return null;
    return this.userProfiles.get(numId)?.data || null;
  };

  public fetchUserProfileAsync = async (userId?: number | string | null): Promise<UserProfileResponse | null> => {
    const numId = toNum(userId);
    if (!numId) return null;
    const existing = this.userProfiles.get(numId);
    if (existing && existing.data) return existing.data;
    if (this.userProfilesPromises.has(numId)) {
      return this.userProfilesPromises.get(numId)!;
    }

    const promise = api.getUserById(numId)
      .then((profile) => {
        this.userProfiles.set(numId, { data: profile, isLoading: false, lastUpdated: Date.now() });
        this.userProfilesPromises.delete(numId);
        this.notify();
        return profile;
      })
      .catch(() => {
        this.userProfilesPromises.delete(numId);
        return null;
      });

    this.userProfilesPromises.set(numId, promise);
    return promise;
  };

  // ──────────────────────────────────────────────────────────
  // 6. Dynamic: Routine Specifications & Age Categories
  // ──────────────────────────────────────────────────────────

  public getClubSpecificationsSnapshot = (clubId?: number | string | null): StoreEntry<RoutineSpecificationResponse[]> => {
    const numId = toNum(clubId);
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return this.clubSpecifications.get(numId) || EMPTY_ARRAY_ENTRY;
  };

  public fetchClubSpecificationsAsync = async (clubId?: number | string | null, forceRefresh = false): Promise<RoutineSpecificationResponse[]> => {
    const numId = toNum(clubId);
    if (!numId) return [];

    const entry = this.clubSpecifications.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > this.DYNAMIC_STALE_MS;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.clubSpecificationsPromises.has(numId)) {
      return this.clubSpecificationsPromises.get(numId)!;
    }

    const promise = api.getSpecificationsByClub(numId)
      .then((data) => {
        this.clubSpecifications.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.clubSpecificationsPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch((err) => {
        this.clubSpecificationsPromises.delete(numId);
        const fallback = entry?.data || [];
        this.clubSpecifications.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.clubSpecificationsPromises.set(numId, promise);
    return promise;
  };

  public getClubAgeCategoriesSnapshot = (clubId?: number | string | null): StoreEntry<AgeCategoryResponse[]> => {
    const numId = toNum(clubId);
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return this.clubAgeCategories.get(numId) || EMPTY_ARRAY_ENTRY;
  };

  public fetchClubAgeCategoriesAsync = async (clubId?: number | string | null, forceRefresh = false): Promise<AgeCategoryResponse[]> => {
    const numId = toNum(clubId);
    if (!numId) return [];

    const entry = this.clubAgeCategories.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > this.DYNAMIC_STALE_MS;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.clubAgeCategoriesPromises.has(numId)) {
      return this.clubAgeCategoriesPromises.get(numId)!;
    }

    const promise = api.getAgeCategoriesByClub(numId)
      .then((data) => {
        this.clubAgeCategories.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.clubAgeCategoriesPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch((err) => {
        this.clubAgeCategoriesPromises.delete(numId);
        const fallback = entry?.data || [];
        this.clubAgeCategories.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.clubAgeCategoriesPromises.set(numId, promise);
    return promise;
  };

  // ──────────────────────────────────────────────────────────
  // 7. Dynamic: Unread Comments & Live Polling
  // ──────────────────────────────────────────────────────────

  public getClubUnreadCountsSnapshot = (clubId?: number | string | null): StoreEntry<Record<string, number>> => {
    const numId = toNum(clubId);
    if (!numId) return EMPTY_OBJECT_ENTRY;

    this.startUnreadPolling(numId);
    return this.clubUnreadCounts.get(numId) || EMPTY_OBJECT_ENTRY;
  };

  public fetchClubUnreadCountsAsync = async (clubId?: number | string | null, forceRefresh = false): Promise<Record<string, number>> => {
    const numId = toNum(clubId);
    if (!numId) return {};

    const entry = this.clubUnreadCounts.get(numId);
    const now = Date.now();
    const isStale = !entry || now - entry.lastUpdated > 10_000;

    if (!isStale && !forceRefresh && entry) {
      return entry.data;
    }

    if (this.clubUnreadCountsPromises.has(numId)) {
      return this.clubUnreadCountsPromises.get(numId)!;
    }

    const promise = api.getClubCommentsUnreadCounts(numId)
      .then((data) => {
        this.clubUnreadCounts.set(numId, { data, isLoading: false, lastUpdated: Date.now() });
        this.clubUnreadCountsPromises.delete(numId);
        this.notify();
        return data;
      })
      .catch(() => {
        this.clubUnreadCountsPromises.delete(numId);
        const fallback = entry?.data || {};
        this.clubUnreadCounts.set(numId, { data: fallback, isLoading: false, lastUpdated: Date.now() });
        this.notify();
        return fallback;
      });

    this.clubUnreadCountsPromises.set(numId, promise);
    return promise;
  };

  public startUnreadPolling = (clubId: number | string) => {
    const numId = toNum(clubId);
    if (!numId || this.unreadPollIntervals.has(numId)) return;

    const interval = setInterval(async () => {
      try {
        const counts = await api.getClubCommentsUnreadCounts(numId);
        const current = this.clubUnreadCounts.get(numId);
        const hasChanged = JSON.stringify(current?.data) !== JSON.stringify(counts);
        if (hasChanged) {
          this.clubUnreadCounts.set(numId, { data: counts, isLoading: false, lastUpdated: Date.now() });
          this.notify();
        }
      } catch (e) {
        // Silent catch
      }
    }, this.UNREAD_POLL_INTERVAL_MS);

    this.unreadPollIntervals.set(numId, interval);
  };

  public stopAllPolling = () => {
    for (const interval of this.unreadPollIntervals.values()) {
      clearInterval(interval);
    }
    this.unreadPollIntervals.clear();
  };

  // ──────────────────────────────────────────────────────────
  // 8. Mutations with Instant Cache Updates & Cross-Screen Sync
  // ──────────────────────────────────────────────────────────

  public updateAthleteDiveStatus = async (
    athleteId: number | string,
    diveExecutionId: number,
    status: 'PLANNED' | 'LEARNING' | 'MASTERED',
    learnedAt?: string | null
  ): Promise<AthleteDiveStatusResponse> => {
    const numId = toNum(athleteId);
    if (!numId) throw new Error('Invalid athlete ID');

    const updated = await api.updateAthleteDive(numId, {
      diveExecutionId,
      status,
      learnedAt,
    });

    const existing = this.athleteDives.get(numId);
    if (existing) {
      const idx = existing.data.findIndex((d) => d.diveExecutionId === diveExecutionId);
      let newData: AthleteDiveStatusResponse[];
      if (idx >= 0) {
        newData = [...existing.data];
        newData[idx] = updated;
      } else {
        newData = [...existing.data, updated];
      }
      this.athleteDives.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
    } else {
      this.athleteDives.set(numId, { data: [updated], isLoading: false, lastUpdated: Date.now() });
    }

    this.notify();
    return updated;
  };

  public createComment = async (
    athleteId: number | string,
    data: CreateCommentRequest,
    clubId?: number | string | null
  ): Promise<CommentResponse> => {
    const numId = toNum(athleteId);
    if (!numId) throw new Error('Invalid athlete ID');

    const newComment = await api.createComment(numId, data);

    const existing = this.athleteComments.get(numId);
    if (existing) {
      const filtered = existing.data.filter((c) => c.id !== newComment.id);
      this.athleteComments.set(numId, {
        data: [newComment, ...filtered],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      this.athleteComments.set(numId, {
        data: [newComment],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    }

    const numClubId = toNum(clubId);
    if (numClubId) {
      api.getClubCommentsUnreadCounts(numClubId).then((counts) => {
        this.clubUnreadCounts.set(numClubId, { data: counts, isLoading: false, lastUpdated: Date.now() });
        this.notify();
      }).catch(() => {});
    }

    this.notify();
    return newComment;
  };

  public updateComment = async (
    athleteId: number | string,
    commentId: number,
    data: UpdateCommentRequest
  ): Promise<CommentResponse> => {
    const numId = toNum(athleteId);
    if (!numId) throw new Error('Invalid athlete ID');

    const updated = await api.updateComment(numId, commentId, data);

    const existing = this.athleteComments.get(numId);
    if (existing) {
      const newData = existing.data.map((c) => (c.id === commentId ? updated : c));
      this.athleteComments.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }

    return updated;
  };

  public deleteComment = async (
    athleteId: number | string,
    commentId: number,
    clubId?: number | string | null
  ): Promise<void> => {
    const numId = toNum(athleteId);
    if (!numId) throw new Error('Invalid athlete ID');

    await api.deleteComment(numId, commentId);

    const existing = this.athleteComments.get(numId);
    if (existing) {
      const newData = existing.data.filter((c) => c.id !== commentId);
      this.athleteComments.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }

    const numClubId = toNum(clubId);
    if (numClubId) {
      api.getClubCommentsUnreadCounts(numClubId).then((counts) => {
        this.clubUnreadCounts.set(numClubId, { data: counts, isLoading: false, lastUpdated: Date.now() });
        this.notify();
      }).catch(() => {});
    }
  };

  public markCommentsAsRead = async (athleteId: number | string, clubId?: number | string | null): Promise<void> => {
    const numId = toNum(athleteId);
    if (!numId) return;

    try {
      await api.markCommentsAsRead(numId);

      const existing = this.athleteComments.get(numId);
      if (existing) {
        const newData = existing.data.map((c) => ({ ...c, isRead: true }));
        this.athleteComments.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      }

      const numClubId = toNum(clubId);
      if (numClubId) {
        const unreadEntry = this.clubUnreadCounts.get(numClubId);
        if (unreadEntry) {
          const newCounts = { ...unreadEntry.data, [numId]: 0, [String(numId)]: 0 };
          this.clubUnreadCounts.set(numClubId, { data: newCounts, isLoading: false, lastUpdated: Date.now() });
        }
      }

      this.notify();
    } catch (e) {
      console.warn(`Failed to mark comments as read for athlete ${numId}:`, e);
    }
  };

  public createRoutine = async (userId: number | string, data: CreateRoutineRequest): Promise<RoutineResponse> => {
    const numId = toNum(userId);
    if (!numId) throw new Error('Invalid user ID');

    const newRoutine = await api.createRoutine(data);
    const existing = this.userRoutines.get(numId);
    if (existing) {
      const filtered = existing.data.filter((r) => r.id !== newRoutine.id);
      this.userRoutines.set(numId, {
        data: [...filtered, newRoutine],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      this.userRoutines.set(numId, {
        data: [newRoutine],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    }
    this.notify();
    return newRoutine;
  };

  public updateRoutine = async (
    userId: number | string,
    routineId: number,
    data: UpdateRoutineRequest
  ): Promise<RoutineResponse> => {
    const numId = toNum(userId);
    if (!numId) throw new Error('Invalid user ID');

    const updated = await api.updateRoutine(routineId, data);
    const existing = this.userRoutines.get(numId);
    if (existing) {
      const newData = existing.data.map((r) => (r.id === routineId ? updated : r));
      this.userRoutines.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }
    return updated;
  };

  public deleteRoutine = async (userId: number | string, routineId: number): Promise<void> => {
    const numId = toNum(userId);
    if (!numId) throw new Error('Invalid user ID');

    await api.deleteRoutine(routineId);
    const existing = this.userRoutines.get(numId);
    if (existing) {
      const newData = existing.data.filter((r) => r.id !== routineId);
      this.userRoutines.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }
  };

  public setRoutinesCache = (userId: number | string, routines: RoutineResponse[]) => {
    const numId = toNum(userId);
    if (!numId) return;
    this.userRoutines.set(numId, { data: routines, isLoading: false, lastUpdated: Date.now() });
    this.notify();
  };

  public duplicateRoutine = async (
    sourceRoutineId: number,
    targetUserId: number | string,
    displayName?: string
  ): Promise<RoutineResponse> => {
    const numId = toNum(targetUserId);
    if (!numId) throw new Error('Invalid target user ID');

    const duplicated = await api.duplicateRoutine(sourceRoutineId, { targetUserId: numId, displayName });
    const existing = this.userRoutines.get(numId);
    if (existing) {
      this.userRoutines.set(numId, {
        data: [...existing.data, duplicated],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      this.userRoutines.set(numId, {
        data: [duplicated],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    }
    this.notify();
    return duplicated;
  };

  public createRoutineSpecification = async (
    clubId: number | string,
    payload: CreateRoutineSpecificationRequest
  ): Promise<RoutineSpecificationResponse> => {
    const numId = toNum(clubId);
    if (!numId) throw new Error('Invalid club ID');

    const created = await api.createRoutineSpecification(payload);
    const existing = this.clubSpecifications.get(numId);
    if (existing) {
      this.clubSpecifications.set(numId, {
        data: [...existing.data, created],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      this.clubSpecifications.set(numId, {
        data: [created],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    }
    this.notify();
    return created;
  };

  public updateRoutineSpecification = async (
    clubId: number | string,
    specId: number,
    payload: UpdateRoutineSpecificationRequest
  ): Promise<RoutineSpecificationResponse> => {
    const numId = toNum(clubId);
    if (!numId) throw new Error('Invalid club ID');

    const updated = await api.updateRoutineSpecification(specId, payload);
    const existing = this.clubSpecifications.get(numId);
    if (existing) {
      const newData = existing.data.map((s) => (s.id === specId ? updated : s));
      this.clubSpecifications.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }
    return updated;
  };

  public deleteRoutineSpecification = async (clubId: number | string, specId: number): Promise<void> => {
    const numId = toNum(clubId);
    if (!numId) throw new Error('Invalid club ID');

    await api.deleteRoutineSpecification(specId);
    const existing = this.clubSpecifications.get(numId);
    if (existing) {
      const newData = existing.data.filter((s) => s.id !== specId);
      this.clubSpecifications.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }
  };

  public createAgeCategory = async (
    clubId: number | string,
    payload: CreateAgeCategoryRequest
  ): Promise<AgeCategoryResponse> => {
    const numId = toNum(clubId);
    if (!numId) throw new Error('Invalid club ID');

    const created = await api.createAgeCategory(payload);
    const existing = this.clubAgeCategories.get(numId);
    if (existing) {
      this.clubAgeCategories.set(numId, {
        data: [...existing.data, created],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } else {
      this.clubAgeCategories.set(numId, {
        data: [created],
        isLoading: false,
        lastUpdated: Date.now(),
      });
    }
    this.notify();
    return created;
  };

  public updateAgeCategory = async (
    clubId: number | string,
    catId: number,
    payload: UpdateAgeCategoryRequest
  ): Promise<AgeCategoryResponse> => {
    const numId = toNum(clubId);
    if (!numId) throw new Error('Invalid club ID');

    const updated = await api.updateAgeCategory(catId, payload);
    const existing = this.clubAgeCategories.get(numId);
    if (existing) {
      const newData = existing.data.map((c) => (c.id === catId ? updated : c));
      this.clubAgeCategories.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }
    return updated;
  };

  public deleteAgeCategory = async (clubId: number | string, catId: number): Promise<void> => {
    const numId = toNum(clubId);
    if (!numId) throw new Error('Invalid club ID');

    await api.deleteAgeCategory(catId);
    const existing = this.clubAgeCategories.get(numId);
    if (existing) {
      const newData = existing.data.filter((c) => c.id !== catId);
      this.clubAgeCategories.set(numId, { data: newData, isLoading: false, lastUpdated: Date.now() });
      this.notify();
    }
  };
}

export const dataStore = new CentralDataStore();
