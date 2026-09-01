import { useSyncExternalStore, useCallback, useEffect } from 'react';
import { dataStore, toNum, EMPTY_ARRAY_ENTRY, EMPTY_OBJECT_ENTRY } from '../services/dataStore';
import {
  AthleteDiveStatusResponse,
  DiveExecutionResponse,
  RoutineResponse,
  CommentResponse,
  MembershipResponse,
  RoutineSpecificationResponse,
  AgeCategoryResponse,
  CreateCommentRequest,
  UpdateCommentRequest,
  CreateRoutineRequest,
  UpdateRoutineRequest,
  CreateRoutineSpecificationRequest,
  UpdateRoutineSpecificationRequest,
  CreateAgeCategoryRequest,
  UpdateAgeCategoryRequest,
} from '../services/api';

/**
 * 1. Static Hook: Dive Catalog & Executions
 */
export function useDiveCatalog() {
  const getSnapshot = useCallback(() => dataStore.getDiveExecutionsSnapshot(), []);
  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (entry.data.length === 0) {
      dataStore.fetchDiveExecutionsAsync();
    }
  }, [entry.data.length]);

  const refresh = useCallback((force = true) => {
    return dataStore.fetchDiveExecutionsAsync(force);
  }, []);

  return {
    executions: entry.data,
    isLoading: entry.data.length === 0,
    refresh,
  };
}

/**
 * 2. Dynamic Hook: Athlete Dives Status
 */
export function useAthleteDives(athleteId?: number | string | null) {
  const numId = toNum(athleteId);

  const getSnapshot = useCallback(() => {
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return dataStore.getAthleteDivesSnapshot(numId);
  }, [numId]);

  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchAthleteDivesAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return [];
    return dataStore.fetchAthleteDivesAsync(numId, true);
  }, [numId]);

  const updateStatus = useCallback(
    async (
      diveExecutionId: number,
      status: 'PLANNED' | 'LEARNING' | 'MASTERED',
      learnedAt?: string | null
    ) => {
      if (!numId) throw new Error('No athlete ID provided');
      return dataStore.updateAthleteDiveStatus(numId, diveExecutionId, status, learnedAt);
    },
    [numId]
  );

  return {
    dives: entry.data,
    isLoading: entry.isLoading,
    lastUpdated: entry.lastUpdated,
    refresh,
    updateStatus,
  };
}

/**
 * 3. Dynamic Hook: Athlete Comments
 */
export function useAthleteComments(athleteId?: number | string | null, clubId?: number | string | null) {
  const numId = toNum(athleteId);
  const numClubId = toNum(clubId);

  const getSnapshot = useCallback(() => {
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return dataStore.getAthleteCommentsSnapshot(numId);
  }, [numId]);

  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchAthleteCommentsAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return [];
    return dataStore.fetchAthleteCommentsAsync(numId, true);
  }, [numId]);

  const createComment = useCallback(
    async (commentData: CreateCommentRequest) => {
      if (!numId) throw new Error('No athlete ID provided');
      return dataStore.createComment(numId, commentData, numClubId);
    },
    [numId, numClubId]
  );

  const updateComment = useCallback(
    async (commentId: number, commentData: UpdateCommentRequest) => {
      if (!numId) throw new Error('No athlete ID provided');
      return dataStore.updateComment(numId, commentId, commentData);
    },
    [numId]
  );

  const deleteComment = useCallback(
    async (commentId: number) => {
      if (!numId) throw new Error('No athlete ID provided');
      return dataStore.deleteComment(numId, commentId, numClubId);
    },
    [numId, numClubId]
  );

  const markAsRead = useCallback(async () => {
    if (!numId) return;
    return dataStore.markCommentsAsRead(numId, numClubId);
  }, [numId, numClubId]);

  return {
    comments: entry.data,
    isLoading: entry.isLoading,
    lastUpdated: entry.lastUpdated,
    refresh,
    createComment,
    updateComment,
    deleteComment,
    markAsRead,
  };
}

/**
 * 4. Dynamic Hook: User Routines
 */
export function useUserRoutines(userId?: number | string | null) {
  const numId = toNum(userId);

  const getSnapshot = useCallback(() => {
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return dataStore.getUserRoutinesSnapshot(numId);
  }, [numId]);

  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchUserRoutinesAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return [];
    return dataStore.fetchUserRoutinesAsync(numId, true);
  }, [numId]);

  const createRoutine = useCallback(
    async (payload: CreateRoutineRequest) => {
      if (!numId) throw new Error('No user ID provided');
      return dataStore.createRoutine(numId, payload);
    },
    [numId]
  );

  const updateRoutine = useCallback(
    async (routineId: number, payload: UpdateRoutineRequest) => {
      if (!numId) throw new Error('No user ID provided');
      return dataStore.updateRoutine(numId, routineId, payload);
    },
    [numId]
  );

  const deleteRoutine = useCallback(
    async (routineId: number) => {
      if (!numId) throw new Error('No user ID provided');
      return dataStore.deleteRoutine(numId, routineId);
    },
    [numId]
  );

  const duplicateRoutine = useCallback(
    async (sourceRoutineId: number, targetUserId: number | string, displayName?: string) => {
      return dataStore.duplicateRoutine(sourceRoutineId, targetUserId, displayName);
    },
    []
  );

  const setRoutines = useCallback(
    (routines: RoutineResponse[]) => {
      if (!numId) return;
      dataStore.setRoutinesCache(numId, routines);
    },
    [numId]
  );

  return {
    routines: entry.data,
    isLoading: entry.isLoading,
    lastUpdated: entry.lastUpdated,
    refresh,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    duplicateRoutine,
    setRoutines,
  };
}

/**
 * 5. Dynamic Hook: Club Routine Specifications
 */
export function useClubSpecifications(clubId?: number | string | null) {
  const numId = toNum(clubId);

  const getSnapshot = useCallback(() => {
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return dataStore.getClubSpecificationsSnapshot(numId);
  }, [numId]);

  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchClubSpecificationsAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return [];
    return dataStore.fetchClubSpecificationsAsync(numId, true);
  }, [numId]);

  const createSpecification = useCallback(
    async (payload: CreateRoutineSpecificationRequest) => {
      if (!numId) throw new Error('No club ID provided');
      return dataStore.createRoutineSpecification(numId, payload);
    },
    [numId]
  );

  const updateSpecification = useCallback(
    async (specId: number, payload: UpdateRoutineSpecificationRequest) => {
      if (!numId) throw new Error('No club ID provided');
      return dataStore.updateRoutineSpecification(numId, specId, payload);
    },
    [numId]
  );

  const deleteSpecification = useCallback(
    async (specId: number) => {
      if (!numId) throw new Error('No club ID provided');
      return dataStore.deleteRoutineSpecification(numId, specId);
    },
    [numId]
  );

  return {
    specifications: entry.data,
    isLoading: entry.isLoading,
    lastUpdated: entry.lastUpdated,
    refresh,
    createSpecification,
    updateSpecification,
    deleteSpecification,
  };
}

/**
 * 6. Dynamic Hook: Club Age Categories
 */
export function useClubAgeCategories(clubId?: number | string | null) {
  const numId = toNum(clubId);

  const getSnapshot = useCallback(() => {
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return dataStore.getClubAgeCategoriesSnapshot(numId);
  }, [numId]);

  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchClubAgeCategoriesAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return [];
    return dataStore.fetchClubAgeCategoriesAsync(numId, true);
  }, [numId]);

  const createCategory = useCallback(
    async (payload: CreateAgeCategoryRequest) => {
      if (!numId) throw new Error('No club ID provided');
      return dataStore.createAgeCategory(numId, payload);
    },
    [numId]
  );

  const updateCategory = useCallback(
    async (catId: number, payload: UpdateAgeCategoryRequest) => {
      if (!numId) throw new Error('No club ID provided');
      return dataStore.updateAgeCategory(numId, catId, payload);
    },
    [numId]
  );

  const deleteCategory = useCallback(
    async (catId: number) => {
      if (!numId) throw new Error('No club ID provided');
      return dataStore.deleteAgeCategory(numId, catId);
    },
    [numId]
  );

  return {
    categories: entry.data,
    isLoading: entry.isLoading,
    lastUpdated: entry.lastUpdated,
    refresh,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}

/**
 * 7. Dynamic Hook: Club Members & Unread Comment Counts
 */
export function useClubMembers(clubId?: number | string | null) {
  const numId = toNum(clubId);

  const getMembersSnapshot = useCallback(() => {
    if (!numId) return EMPTY_ARRAY_ENTRY;
    return dataStore.getClubMembersSnapshot(numId);
  }, [numId]);

  const getUnreadSnapshot = useCallback(() => {
    if (!numId) return EMPTY_OBJECT_ENTRY;
    return dataStore.getClubUnreadCountsSnapshot(numId);
  }, [numId]);

  const membersEntry = useSyncExternalStore(dataStore.subscribe, getMembersSnapshot, getMembersSnapshot);
  const unreadEntry = useSyncExternalStore(dataStore.subscribe, getUnreadSnapshot, getUnreadSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchClubMembersAsync(numId);
      dataStore.fetchClubUnreadCountsAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return [];
    dataStore.fetchClubUnreadCountsAsync(numId, true);
    return dataStore.fetchClubMembersAsync(numId, true);
  }, [numId]);

  return {
    members: membersEntry.data,
    unreadCounts: unreadEntry.data,
    isLoading: membersEntry.isLoading,
    refresh,
  };
}

/**
 * 8. Dynamic Hook: Club Unread Counts with Live Polling
 */
export function useUnreadCommentCounts(clubId?: number | string | null) {
  const numId = toNum(clubId);

  const getSnapshot = useCallback(() => {
    if (!numId) return EMPTY_OBJECT_ENTRY;
    return dataStore.getClubUnreadCountsSnapshot(numId);
  }, [numId]);

  const entry = useSyncExternalStore(dataStore.subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (numId) {
      dataStore.fetchClubUnreadCountsAsync(numId);
    }
  }, [numId]);

  const refresh = useCallback(async () => {
    if (!numId) return {};
    return dataStore.fetchClubUnreadCountsAsync(numId, true);
  }, [numId]);

  return {
    unreadCounts: entry.data,
    isLoading: entry.isLoading,
    refresh,
  };
}
