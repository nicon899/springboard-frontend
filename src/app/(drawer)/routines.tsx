import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import {
  api,
  AthleteDiveStatusResponse,
  BACKEND_TO_HEIGHT,
  DiveExecutionResponse,
  MembershipResponse,
  RoutineResponse,
  RoutineSpecificationResponse,
} from '../../services/api';
import {
  useUserRoutines,
  useClubSpecifications,
  useAthleteDives,
  useDiveCatalog,
  useClubMembers,
} from '../../hooks/useDataStore';
import { DIVE_GROUP_NAMES } from '../constants/diveData';
import Toast, { ToastMessage, ToastType } from '../../components/ui/Toast';
import ConfirmModal from '../../components/modals/ConfirmModal';

// ────────────────────────────────────────────────────────────
// Hilfsfunktionen & Konstanten
// ────────────────────────────────────────────────────────────

const HEIGHT_FILTERS = ['ALL', '1m', '3m', '5m', '7.5m', '10m'] as const;

export const JUNIOR_TABLE_CODES = new Set([
  '100', '200', '010', '020',
  '5101', '5102', '5201', '5021',
]);

export interface DiveValidationResult {
  isValid: boolean;
  reasonKey?:
    | 'ROUTINE_DUPLICATE_DIVE_NUMBER'
    | 'ROUTINE_MAX_DIVES_EXCEEDED'
    | 'ROUTINE_JUNIOR_TABLE_NOT_ALLOWED'
    | 'ROUTINE_MAX_DIFFICULTY_EXCEEDED'
    | 'ROUTINE_MIN_GROUPS_NOT_REACHABLE';
  params?: Record<string, any>;
}

export function validateDiveForRoutine(
  routine: RoutineResponse | null | undefined,
  candidate: DiveExecutionResponse,
  replaceDiveExecutionId?: number | null
): DiveValidationResult {
  if (!routine) return { isValid: true };

  const allExisting = routine.diveExecutions || [];
  const existing = replaceDiveExecutionId
    ? allExisting.filter((de) => de.id !== replaceDiveExecutionId)
    : allExisting;

  // If candidate is the exact same dive execution currently placed at this position
  if (
    replaceDiveExecutionId &&
    allExisting.some((de) => de.id === replaceDiveExecutionId && de.id === candidate.id)
  ) {
    return {
      isValid: false,
      reasonKey: 'ROUTINE_DUPLICATE_DIVE_NUMBER',
      params: { diveCode: candidate.diveCode },
    };
  }

  // 1. Duplicate dive number (irrespective of execution/position) among remaining dives
  const isDuplicate = existing.some(
    (de) => de.diveCode.toLowerCase() === candidate.diveCode.toLowerCase()
  );
  if (isDuplicate) {
    return {
      isValid: false,
      reasonKey: 'ROUTINE_DUPLICATE_DIVE_NUMBER',
      params: { diveCode: candidate.diveCode },
    };
  }

  const spec = routine.template;
  if (!spec) return { isValid: true };

  // 2. Max number of dives
  if (spec.numberOfDives != null && existing.length >= spec.numberOfDives) {
    return {
      isValid: false,
      reasonKey: 'ROUTINE_MAX_DIVES_EXCEEDED',
      params: { numberOfDives: spec.numberOfDives },
    };
  }

  // 3. Junior table (Nachwuchstabelle)
  if (spec.juniorTableAllowed === false && JUNIOR_TABLE_CODES.has(candidate.diveCode)) {
    return {
      isValid: false,
      reasonKey: 'ROUTINE_JUNIOR_TABLE_NOT_ALLOWED',
      params: { diveCode: candidate.diveCode },
    };
  }

  // 4. Max difficulty score (SKG)
  if (spec.maxDifficultyScore != null) {
    const currentSum = existing.reduce((sum, de) => sum + (de.degreeOfDifficulty || 0), 0);
    const newTotal = currentSum + (candidate.degreeOfDifficulty || 0);
    if (newTotal > spec.maxDifficultyScore + 0.0001) {
      return {
        isValid: false,
        reasonKey: 'ROUTINE_MAX_DIFFICULTY_EXCEEDED',
        params: {
          maxDifficulty: spec.maxDifficultyScore,
          currentDifficulty: Math.round(currentSum * 10) / 10,
          newDifficulty: Math.round(newTotal * 10) / 10,
        },
      };
    }
  }

  // 5. Min number of groups reachable
  if (spec.numberOfGroups != null && spec.numberOfDives != null) {
    const groupsAfterAdd = new Set(existing.map((de) => de.groupNumber));
    groupsAfterAdd.add(candidate.groupNumber);
    const distinctGroups = groupsAfterAdd.size;
    const missingGroups = spec.numberOfGroups - distinctGroups;

    if (missingGroups > 0) {
      const slotsAfterAdd = spec.numberOfDives - existing.length - 1;
      if (missingGroups > slotsAfterAdd) {
        return {
          isValid: false,
          reasonKey: 'ROUTINE_MIN_GROUPS_NOT_REACHABLE',
          params: {
            numberOfGroups: spec.numberOfGroups,
            missingGroups,
            slotsRemaining: slotsAfterAdd,
          },
        };
      }
    }
  }

  return { isValid: true };
}

function parseErrorMessage(e: any, t?: (key: string, options?: any) => string): string {
  if (!e) {
    return t ? t('routines.errors.unknown', 'Ein unbekannter Fehler ist aufgetreten.') : 'Ein unbekannter Fehler ist aufgetreten.';
  }

  let errorCode: string | undefined = e?.errorCode;
  let params: Record<string, any> = { ...(e?.messageParameters || e?.parameters || {}) };
  let fallbackMessage: string = '';

  if (typeof e === 'string') {
    try {
      const parsed = JSON.parse(e);
      errorCode = errorCode || parsed.errorCode;
      params = { ...params, ...(parsed.messageParameters || parsed.parameters || {}) };
      fallbackMessage = parsed.message || parsed.error || e;
    } catch {
      fallbackMessage = e;
    }
  } else if (e.message) {
    try {
      const parsed = JSON.parse(e.message);
      errorCode = errorCode || parsed.errorCode;
      params = { ...params, ...(parsed.messageParameters || parsed.parameters || {}) };
      fallbackMessage = parsed.message || parsed.error || e.message;
    } catch {
      fallbackMessage = e.message;
    }
  }

  if (e.raw && typeof e.raw === 'object') {
    errorCode = errorCode || e.raw.errorCode;
    params = { ...params, ...(e.raw.messageParameters || e.raw.parameters || {}) };
    fallbackMessage = fallbackMessage || e.raw.message || e.raw.error;
  }

  if (errorCode && t) {
    const key = `routines.errors.${errorCode}`;
    const translated = t(key, { ...params, defaultValue: fallbackMessage || '' });
    if (translated && translated !== key) {
      return translated;
    }
  }

  return fallbackMessage || String(e);
}

function SpecTag({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <View style={[styles.specTag, warning && styles.specTagWarning]}>
      <Text style={[styles.specTagLabel, warning && styles.specTagLabelWarning]}>{label}</Text>
      <Text style={[styles.specTagValue, warning && styles.specTagValueWarning]}>
        {warning ? `⚠️ ${value}` : value}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Haupt-Screen
// ────────────────────────────────────────────────────────────

export default function RoutinesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isDE = i18n.language === 'de';
  const { user, activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();

  const canEdit = isTrainerOrAdmin();
  const targetUserId = params.athleteId ?? user?.id ?? '';
  const athleteLabel = params.athleteName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const getErrorMessage = useCallback((e: any) => parseErrorMessage(e, t), [t]);

  const getGenderLabel = useCallback((g: string) => {
    switch (g) {
      case 'ALL':
        return t('routines.genderAll', 'Alle');
      case 'MALE':
        return t('routines.genderMale', 'Männlich');
      case 'FEMALE':
        return t('routines.genderFemale', 'Weiblich');
      case 'DIVERSE':
        return t('routines.genderDiverse', 'Divers');
      default:
        return g;
    }
  }, [t]);

  const getPositionName = useCallback((pos: string) => {
    switch (pos) {
      case 'A':
        return t('routines.positions.A', 'Gestreckt');
      case 'B':
        return t('routines.positions.B', 'Gehechtet');
      case 'C':
        return t('routines.positions.C', 'Gehockt');
      case 'D':
        return t('routines.positions.D', 'Frei');
      default:
        return pos;
    }
  }, [t]);

  const getGroupName = useCallback((grpNumber: number) => {
    const grp = DIVE_GROUP_NAMES[grpNumber];
    if (!grp) return `Gr. ${grpNumber}`;
    return i18n.language === 'en' ? grp.en : grp.de;
  }, [i18n.language]);

  const getRoutineTitle = useCallback(
    (r?: RoutineResponse | null) => {
      if (!r) return '';
      return r.displayName || r.template?.name || t('routines.defaultRoutineTitle', 'Routine');
    },
    [t]
  );

  const targetUserIdNum = params.athleteId ? Number(params.athleteId) : (user?.id ? Number(user.id) : 0);
  const activeClubIdNum = activeClubId ? Number(activeClubId) : (activeClubMembership?.clubId ? Number(activeClubMembership.clubId) : 0);

  // Centralized Hooks
  const {
    routines,
    isLoading: isRoutinesLoading,
    refresh: refreshRoutines,
    createRoutine: createRoutineInStore,
    updateRoutine: updateRoutineInStore,
    deleteRoutine: deleteRoutineInStore,
    duplicateRoutine: duplicateRoutineInStore,
    setRoutines,
  } = useUserRoutines(targetUserIdNum);

  const { specifications: specs, refresh: refreshSpecs } = useClubSpecifications(activeClubIdNum);
  const { dives: athleteDivesData, refresh: refreshAthleteDives } = useAthleteDives(targetUserIdNum);
  const { executions: catalogExecutions } = useDiveCatalog();
  const { members: clubMembers } = useClubMembers(activeClubIdNum);

  const [athleteProfile, setAthleteProfile] = useState<UserProfileResponse | null>(null);
  const isLoading = isRoutinesLoading && routines.length === 0;

  const { athleteDivesMap, athleteDiveExecutionIds } = useMemo(() => {
    const map = new Map<number, AthleteDiveStatusResponse>();
    const set = new Set<number>();
    athleteDivesData.forEach((d) => {
      if (d.diveExecutionId) {
        map.set(d.diveExecutionId, d);
        set.add(d.diveExecutionId);
      }
    });
    return { athleteDivesMap: map, athleteDiveExecutionIds: set };
  }, [athleteDivesData]);

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastType = 'error') => {
    setToast({ message, type });
  };

  const isCatalogLoading = false;

  // Create modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineResponse | null>(null);
  const [editSpecId, setEditSpecId] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDropdownOpen, setEditDropdownOpen] = useState(false);

  // Add dive modal state
  const [addDiveModalVisible, setAddDiveModalVisible] = useState(false);
  const [targetRoutineForAdd, setTargetRoutineForAdd] = useState<RoutineResponse | null>(null);
  const [replaceTargetDive, setReplaceTargetDive] = useState<{
    diveExecutionId: number;
    diveName: string;
    index: number;
  } | null>(null);
  const [diveSearchQuery, setDiveSearchQuery] = useState('');
  const [selectedHeightFilter, setSelectedHeightFilter] = useState<string>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<number | null>(null);
  const [onlyValidFilter, setOnlyValidFilter] = useState(false);
  const [onlyAthleteDivesFilter, setOnlyAthleteDivesFilter] = useState(false);
  const [isAddingDiveId, setIsAddingDiveId] = useState<number | null>(null);

  // Delete confirmation states
  const [routineToDelete, setRoutineToDelete] = useState<RoutineResponse | null>(null);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);
  const [diveToRemove, setDiveToRemove] = useState<{
    routine: RoutineResponse;
    diveExecutionId: number;
    diveName: string;
  } | null>(null);
  const [isRemovingDive, setIsRemovingDive] = useState(false);

  // Sort / Reorder states (Dives & Routinen)
  const [isReorderingRoutineId, setIsReorderingRoutineId] = useState<number | null>(null);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortModalRoutine, setSortModalRoutine] = useState<RoutineResponse | null>(null);
  const [sortModalDives, setSortModalDives] = useState<DiveExecutionResponse[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const [isReorderingRoutines, setIsReorderingRoutines] = useState(false);
  const [sortRoutinesModalVisible, setSortRoutinesModalVisible] = useState(false);
  const [sortRoutinesModalList, setSortRoutinesModalList] = useState<RoutineResponse[]>([]);
  const [isSavingRoutinesOrder, setIsSavingRoutinesOrder] = useState(false);

  // Duplicate Routine states
  const [duplicateRoutineTarget, setDuplicateRoutineTarget] = useState<RoutineResponse | null>(null);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [duplicateTargetMode, setDuplicateTargetMode] = useState<'SAME' | 'OTHER'>('SAME');
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<number | null>(null);
  const [duplicateDisplayName, setDuplicateDisplayName] = useState('');
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [athletePickerOpen, setAthletePickerOpen] = useState(false);

  // Expanded state per routine ID (default: false / collapsed)
  const [expandedRoutines, setExpandedRoutines] = useState<Record<number, boolean>>({});

  const toggleRoutineExpand = (routineId: number) => {
    setExpandedRoutines((prev) => ({
      ...prev,
      [routineId]: !prev[routineId],
    }));
  };

  // Load user profile if needed
  useEffect(() => {
    if (!targetUserIdNum) return;
    if (targetUserIdNum === user?.id) {
      setAthleteProfile(user as any);
    } else {
      api.getUserById(targetUserIdNum).then(setAthleteProfile).catch(() => null);
    }
  }, [targetUserIdNum, user]);

  const loadData = useCallback(async () => {
    if (!targetUserIdNum) return;
    await Promise.all([
      refreshRoutines(),
      refreshSpecs(),
      refreshAthleteDives(),
    ]);
  }, [targetUserIdNum, refreshRoutines, refreshSpecs, refreshAthleteDives]);

  useFocusEffect(
    useCallback(() => {
      if (targetUserIdNum) {
        refreshRoutines();
        refreshAthleteDives();
      }
      if (activeClubIdNum) {
        refreshSpecs();
      }
    }, [targetUserIdNum, activeClubIdNum, refreshRoutines, refreshAthleteDives, refreshSpecs])
  );

  const loadCatalog = useCallback(async () => {
    // No-op: dive executions are automatically loaded and cached by useDiveCatalog
  }, []);

  // ── Routine anlegen ──
  const handleCreate = async () => {
    if (!targetUserIdNum) return;
    setIsSaving(true);
    try {
      await createRoutineInStore({
        userId: targetUserIdNum,
        specificationId: selectedSpecId ?? undefined,
        displayName: createDisplayName.trim() || undefined,
      });
      setCreateModalVisible(false);
      setSelectedSpecId(null);
      setCreateDisplayName('');
      showToast(t('routines.toasts.createSuccess', 'Routine erfolgreich angelegt'), 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Routine bearbeiten ──
  const openEdit = (routine: RoutineResponse) => {
    setEditingRoutine(routine);
    setEditSpecId(routine.template?.id ?? null);
    setEditDisplayName(routine.displayName ?? '');
    setEditModalVisible(true);
  };

  const handleEdit = async () => {
    if (!editingRoutine) return;
    setIsSaving(true);
    try {
      await updateRoutineInStore(editingRoutine.id, {
        specificationId: editSpecId ?? undefined,
        displayName: editDisplayName.trim() || undefined,
      });
      setEditModalVisible(false);
      showToast(t('routines.toasts.updateSuccess', 'Routine aktualisiert'), 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Routine duplizieren ──
  const openDuplicate = (routine: RoutineResponse) => {
    setDuplicateRoutineTarget(routine);
    setDuplicateTargetMode('SAME');
    setSelectedTargetUserId(null);
    const baseName = routine.displayName || getRoutineTitle(routine);
    setDuplicateDisplayName(`${baseName} (Kopie)`);
    setAthletePickerOpen(false);
    setDuplicateModalVisible(true);
  };

  const handleDuplicate = async () => {
    if (!duplicateRoutineTarget || !targetUserIdNum) return;
    const resolvedTargetUserId = duplicateTargetMode === 'SAME' ? targetUserIdNum : selectedTargetUserId;
    if (!resolvedTargetUserId) return;

    setIsDuplicating(true);
    try {
      const res = await duplicateRoutineInStore(
        duplicateRoutineTarget.id,
        Number(resolvedTargetUserId),
        duplicateDisplayName.trim() || undefined
      );

      setDuplicateModalVisible(false);

      if (Number(resolvedTargetUserId) === targetUserIdNum) {
        showToast(
          t('routines.toasts.duplicateSuccess', {
            name: res.displayName || getRoutineTitle(res),
            defaultValue: `Routine „${res.displayName || getRoutineTitle(res)}“ erfolgreich dupliziert`,
          }),
          'success'
        );
      } else {
        const targetMember = clubMembers.find((m) => m.userId === Number(resolvedTargetUserId));
        const targetName = targetMember?.userFullName || `#${resolvedTargetUserId}`;
        showToast(
          t('routines.toasts.duplicateSuccessOther', {
            name: res.displayName || getRoutineTitle(res),
            athlete: targetName,
            defaultValue: `Routine „${res.displayName || getRoutineTitle(res)}“ für ${targetName} kopiert`,
          }),
          'success'
        );
      }
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsDuplicating(false);
    }
  };

  // ── Routine löschen ──
  const promptDeleteRoutine = (routine: RoutineResponse) => {
    setRoutineToDelete(routine);
  };

  const confirmDeleteRoutine = async () => {
    if (!routineToDelete || !targetUserIdNum) return;
    const routineTitle = getRoutineTitle(routineToDelete);
    setIsDeletingRoutine(true);
    try {
      await deleteRoutineInStore(routineToDelete.id);
      showToast(
        t('routines.toasts.deleteSuccess', {
          name: routineTitle,
          defaultValue: `Routine „${routineTitle}“ gelöscht`,
        }),
        'info'
      );
      setRoutineToDelete(null);
      await loadData();
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  // ── Sprung zu Routine hinzufügen ──
  const openAddDiveModal = (routine: RoutineResponse) => {
    setTargetRoutineForAdd(routine);
    setReplaceTargetDive(null);
    setDiveSearchQuery('');
    setSelectedGroupFilter(null);
    setAddDiveModalVisible(true);
    loadCatalog();
  };

  // ── Sprung in Routine ersetzen ──
  const openReplaceDiveModal = (
    routine: RoutineResponse,
    diveExecutionId: number,
    diveName: string,
    index: number
  ) => {
    setTargetRoutineForAdd(routine);
    setReplaceTargetDive({ diveExecutionId, diveName, index });
    setDiveSearchQuery('');
    setSelectedGroupFilter(null);
    setAddDiveModalVisible(true);
    loadCatalog();
  };

  const handleAddDive = async (execution: DiveExecutionResponse) => {
    if (!targetRoutineForAdd) return;

    // Validate dive against all routine and spec constraints (taking replace into account)
    const validation = validateDiveForRoutine(
      targetRoutineForAdd,
      execution,
      replaceTargetDive?.diveExecutionId
    );
    if (!validation.isValid) {
      const errorMsg = validation.reasonKey
        ? t(`routines.errors.${validation.reasonKey}`, {
            ...validation.params,
            defaultValue: 'Sprung ist für diese Routine nicht zulässig.',
          })
        : 'Sprung ist für diese Routine nicht zulässig.';
      showToast(errorMsg, 'error');
      return;
    }

    setIsAddingDiveId(execution.id);
    try {
      if (replaceTargetDive) {
        // REPLACE FLOW
        const currentExecutionIds = targetRoutineForAdd.diveExecutions.map((de) => de.id);
        const replaceIdx = replaceTargetDive.index;

        // 1. Remove old dive
        await api.removeDiveFromRoutine(targetRoutineForAdd.id, replaceTargetDive.diveExecutionId);
        // 2. Add new dive
        const afterAdd = await api.addDiveToRoutine(targetRoutineForAdd.id, {
          diveExecutionId: execution.id,
        });

        // 3. Reorder if replaced dive was not the last element
        const newIdsWithoutOld = currentExecutionIds.filter(
          (id) => id !== replaceTargetDive.diveExecutionId
        );
        newIdsWithoutOld.splice(replaceIdx, 0, execution.id);

        let finalRoutine = afterAdd;
        const afterAddIds = afterAdd.diveExecutions.map((de) => de.id);
        const isOrderSame =
          afterAddIds.length === newIdsWithoutOld.length &&
          afterAddIds.every((id, idx) => id === newIdsWithoutOld[idx]);

        if (!isOrderSame) {
          finalRoutine = await api.reorderDivesInRoutine(targetRoutineForAdd.id, newIdsWithoutOld);
        }

        setRoutines((prev) =>
          prev.map((r) => (r.id === finalRoutine.id ? finalRoutine : r))
        );
        setTargetRoutineForAdd(finalRoutine);
        setAddDiveModalVisible(false);
        const oldName = replaceTargetDive.diveName;
        setReplaceTargetDive(null);
        showToast(
          t('routines.toasts.replaceDiveSuccess', {
            dive: `${execution.diveCode}${execution.execution}`,
            oldDive: oldName,
            defaultValue: `Sprung ${oldName} durch ${execution.diveCode}${execution.execution} ersetzt`,
          }),
          'success'
        );
      } else {
        // ADD FLOW
        const updatedRoutine = await api.addDiveToRoutine(targetRoutineForAdd.id, {
          diveExecutionId: execution.id,
        });
        setRoutines((prev) =>
          prev.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r))
        );
        setTargetRoutineForAdd(updatedRoutine);
        setAddDiveModalVisible(false);
        showToast(
          t('routines.toasts.addDiveSuccess', {
            dive: `${execution.diveCode}${execution.execution}`,
            defaultValue: `Sprung ${execution.diveCode}${execution.execution} hinzugefügt`,
          }),
          'success'
        );
      }
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsAddingDiveId(null);
    }
  };

  // ── Sprung aus Routine entfernen ──
  const promptRemoveDive = (routine: RoutineResponse, diveExecutionId: number, diveName: string) => {
    setDiveToRemove({ routine, diveExecutionId, diveName });
  };

  const confirmRemoveDive = async () => {
    if (!diveToRemove) return;
    setIsRemovingDive(true);
    try {
      const updatedRoutine = await api.removeDiveFromRoutine(
        diveToRemove.routine.id,
        diveToRemove.diveExecutionId
      );
      setRoutines((prev) =>
        prev.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r))
      );
      showToast(t('routines.toasts.removeDiveSuccess', 'Sprung entfernt'), 'info');
      setDiveToRemove(null);
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsRemovingDive(false);
    }
  };

  // ── Sprung-Reihenfolge inline verschieben (Hoch/Runter) ──
  const handleMoveDive = async (
    routine: RoutineResponse,
    currentIndex: number,
    direction: -1 | 1
  ) => {
    const newIndex = currentIndex + direction;
    if (!routine.diveExecutions || newIndex < 0 || newIndex >= routine.diveExecutions.length) return;

    const newDives = [...routine.diveExecutions];
    const [moved] = newDives.splice(currentIndex, 1);
    newDives.splice(newIndex, 0, moved);

    const prevRoutines = routines;
    setRoutines((prev) =>
      prev.map((r) => (r.id === routine.id ? { ...r, diveExecutions: newDives } : r))
    );

    setIsReorderingRoutineId(routine.id);
    try {
      const updated = await api.reorderDivesInRoutine(
        routine.id,
        newDives.map((d) => d.id)
      );
      if (updated && updated.diveExecutions) {
        setRoutines((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      }
    } catch (e: any) {
      setRoutines(prevRoutines);
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsReorderingRoutineId(null);
    }
  };

  // ── Sortier-Modal öffnen & steuern ──
  const openSortModal = (routine: RoutineResponse) => {
    setSortModalRoutine(routine);
    setSortModalDives([...(routine.diveExecutions || [])]);
    setSortModalVisible(true);
  };

  const handleModalMoveItem = (currentIndex: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= sortModalDives.length) return;
    const newDives = [...sortModalDives];
    const [moved] = newDives.splice(currentIndex, 1);
    newDives.splice(targetIndex, 0, moved);
    setSortModalDives(newDives);
  };

  const handlePresetSort = (type: 'group' | 'ddAsc' | 'ddDesc' | 'code') => {
    const list = [...sortModalDives];
    if (type === 'group') {
      list.sort((a, b) => a.groupNumber - b.groupNumber || a.diveCode.localeCompare(b.diveCode));
    } else if (type === 'ddAsc') {
      list.sort((a, b) => a.degreeOfDifficulty - b.degreeOfDifficulty);
    } else if (type === 'ddDesc') {
      list.sort((a, b) => b.degreeOfDifficulty - a.degreeOfDifficulty);
    } else if (type === 'code') {
      list.sort((a, b) => a.diveCode.localeCompare(b.diveCode, undefined, { numeric: true }));
    }
    setSortModalDives(list);
  };

  const handleSaveModalOrder = async () => {
    if (!sortModalRoutine) return;
    setIsSavingOrder(true);
    try {
      const updated = await api.reorderDivesInRoutine(
        sortModalRoutine.id,
        sortModalDives.map((d) => d.id)
      );
      if (updated && updated.diveExecutions) {
        setRoutines((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      }
      setSortModalVisible(false);
      showToast(t('routines.toasts.reorderSuccess', 'Reihenfolge erfolgreich gespeichert'), 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsSavingOrder(false);
    }
  };

  // ── Routinen-Reihenfolge inline verschieben (Hoch/Runter) ──
  const handleMoveRoutine = async (currentIndex: number, direction: -1 | 1) => {
    if (!targetUserId) return;
    const newIndex = currentIndex + direction;
    if (newIndex < 0 || newIndex >= routines.length) return;

    const newRoutines = [...routines];
    const [moved] = newRoutines.splice(currentIndex, 1);
    newRoutines.splice(newIndex, 0, moved);

    const prevRoutines = routines;
    setRoutines(newRoutines);
    setIsReorderingRoutines(true);

    try {
      const updated = await api.reorderRoutines(
        targetUserId,
        newRoutines.map((r) => r.id)
      );
      if (updated && updated.length > 0) {
        setRoutines(updated);
      }
    } catch (e: any) {
      setRoutines(prevRoutines);
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsReorderingRoutines(false);
    }
  };

  // ── Routinen Sortier-Modal öffnen & steuern ──
  const openSortRoutinesModal = () => {
    setSortRoutinesModalList([...routines]);
    setSortRoutinesModalVisible(true);
  };

  const handleModalMoveRoutine = (currentIndex: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= sortRoutinesModalList.length) return;
    const list = [...sortRoutinesModalList];
    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);
    setSortRoutinesModalList(list);
  };

  const handlePresetSortRoutines = (
    type:
      | 'createdDesc'
      | 'createdAsc'
      | 'updatedDesc'
      | 'nameAsc'
      | 'nameDesc'
      | 'divesDesc'
      | 'divesAsc'
      | 'ddDesc'
      | 'ddAsc'
  ) => {
    const list = [...sortRoutinesModalList];
    if (type === 'createdDesc') {
      list.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return (b.index ?? b.id) - (a.index ?? a.id);
      });
    } else if (type === 'createdAsc') {
      list.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return (a.index ?? a.id) - (b.index ?? b.id);
      });
    } else if (type === 'updatedDesc') {
      list.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA || (b.index ?? b.id) - (a.index ?? a.id);
      });
    } else if (type === 'nameAsc') {
      list.sort((a, b) => getRoutineTitle(a).localeCompare(getRoutineTitle(b), undefined, { numeric: true }));
    } else if (type === 'nameDesc') {
      list.sort((a, b) => getRoutineTitle(b).localeCompare(getRoutineTitle(a), undefined, { numeric: true }));
    } else if (type === 'divesDesc') {
      list.sort((a, b) => (b.diveExecutions?.length ?? 0) - (a.diveExecutions?.length ?? 0));
    } else if (type === 'divesAsc') {
      list.sort((a, b) => (a.diveExecutions?.length ?? 0) - (b.diveExecutions?.length ?? 0));
    } else if (type === 'ddDesc') {
      list.sort((a, b) => {
        const ddA = a.diveExecutions?.reduce((s, d) => s + (d.degreeOfDifficulty || 0), 0) ?? 0;
        const ddB = b.diveExecutions?.reduce((s, d) => s + (d.degreeOfDifficulty || 0), 0) ?? 0;
        return ddB - ddA;
      });
    } else if (type === 'ddAsc') {
      list.sort((a, b) => {
        const ddA = a.diveExecutions?.reduce((s, d) => s + (d.degreeOfDifficulty || 0), 0) ?? 0;
        const ddB = b.diveExecutions?.reduce((s, d) => s + (d.degreeOfDifficulty || 0), 0) ?? 0;
        return ddA - ddB;
      });
    }
    setSortRoutinesModalList(list);
  };

  const handleSaveRoutinesModalOrder = async () => {
    if (!targetUserId) return;
    setIsSavingRoutinesOrder(true);
    try {
      const updated = await api.reorderRoutines(
        targetUserId,
        sortRoutinesModalList.map((r) => r.id)
      );
      if (updated && updated.length > 0) {
        setRoutines(updated);
      }
      setSortRoutinesModalVisible(false);
      showToast(t('routines.toasts.reorderRoutinesSuccess', 'Reihenfolge der Routinen erfolgreich gespeichert'), 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsSavingRoutinesOrder(false);
    }
  };

  // ── Match Counts (Valide vs. Gesamt für aktuelle Filter) ──
  const { validCount, totalMatchingCount, athleteMatchingCount } = useMemo(() => {
    let valid = 0;
    let total = 0;
    let athlete = 0;
    const q = diveSearchQuery.trim().toLowerCase();
    const qClean = q.replace(/\s+/g, '');

    for (const item of catalogExecutions) {
      if (q) {
        const fullCode = `${item.diveCode}${item.execution || ''}`.toLowerCase();
        const fullCodeWithSpace = `${item.diveCode} ${item.execution || ''}`.toLowerCase();
        const posName = getPositionName(item.execution).toLowerCase();

        const matchCode =
          item.diveCode.toLowerCase().includes(q) ||
          fullCode.includes(qClean) ||
          fullCodeWithSpace.includes(q);

        const matchNameDe = item.nameDe?.toLowerCase().includes(q);
        const matchNameEn = item.nameEn?.toLowerCase().includes(q);
        const matchPos = posName.includes(q);

        if (!matchCode && !matchNameDe && !matchNameEn && !matchPos) continue;
      }

      if (selectedHeightFilter !== 'ALL') {
        const itemUiHeight = BACKEND_TO_HEIGHT[item.height];
        if (itemUiHeight !== selectedHeightFilter) continue;
      }

      if (selectedGroupFilter !== null) {
        if (item.groupNumber !== selectedGroupFilter) continue;
      }

      if (athleteDiveExecutionIds.has(item.id)) {
        athlete++;
      }

      if (onlyAthleteDivesFilter && !athleteDiveExecutionIds.has(item.id)) {
        continue;
      }

      total++;
      if (validateDiveForRoutine(targetRoutineForAdd, item, replaceTargetDive?.diveExecutionId).isValid) {
        valid++;
      }
    }

    return { validCount: valid, totalMatchingCount: total, athleteMatchingCount: athlete };
  }, [
    catalogExecutions,
    diveSearchQuery,
    selectedHeightFilter,
    selectedGroupFilter,
    onlyAthleteDivesFilter,
    athleteDiveExecutionIds,
    targetRoutineForAdd,
    replaceTargetDive,
    getPositionName,
  ]);

  // ── Gefilterte Sprungvarianten für Modal ──
  const filteredCatalogExecutions = useMemo(() => {
    const q = diveSearchQuery.trim().toLowerCase();
    const qClean = q.replace(/\s+/g, '');
    return catalogExecutions.filter((item) => {
      // Suchbegriff
      if (q) {
        const fullCode = `${item.diveCode}${item.execution || ''}`.toLowerCase();
        const fullCodeWithSpace = `${item.diveCode} ${item.execution || ''}`.toLowerCase();
        const posName = getPositionName(item.execution).toLowerCase();

        const matchCode =
          item.diveCode.toLowerCase().includes(q) ||
          fullCode.includes(qClean) ||
          fullCodeWithSpace.includes(q);

        const matchNameDe = item.nameDe?.toLowerCase().includes(q);
        const matchNameEn = item.nameEn?.toLowerCase().includes(q);
        const matchPos = posName.includes(q);

        if (!matchCode && !matchNameDe && !matchNameEn && !matchPos) return false;
      }

      // Höhenfilter
      if (selectedHeightFilter !== 'ALL') {
        const itemUiHeight = BACKEND_TO_HEIGHT[item.height];
        if (itemUiHeight !== selectedHeightFilter) return false;
      }

      // Gruppenfilter
      if (selectedGroupFilter !== null) {
        if (item.groupNumber !== selectedGroupFilter) return false;
      }

      // Sportler-Sprünge Filter (Status wird ignoriert)
      if (onlyAthleteDivesFilter) {
        if (!athleteDiveExecutionIds.has(item.id)) return false;
      }

      // Valide-Filter
      if (onlyValidFilter) {
        const validation = validateDiveForRoutine(
          targetRoutineForAdd,
          item,
          replaceTargetDive?.diveExecutionId
        );
        if (!validation.isValid) return false;
      }

      return true;
    });
  }, [
    catalogExecutions,
    diveSearchQuery,
    selectedHeightFilter,
    selectedGroupFilter,
    onlyValidFilter,
    onlyAthleteDivesFilter,
    athleteDiveExecutionIds,
    targetRoutineForAdd,
    replaceTargetDive,
    getPositionName,
  ]);

  // ── Routine-Karte ──
  const renderRoutine = (routine: RoutineResponse, routineIdx: number) => {
    const spec = routine.template;
    const diveCount = routine.diveExecutions?.length ?? 0;
    const totalDD = routine.diveExecutions?.reduce((sum, de) => sum + (de.degreeOfDifficulty || 0), 0) ?? 0;
    const distinctGroups = new Set(routine.diveExecutions?.map((de) => de.groupNumber)).size;
    const isExpanded = expandedRoutines[routine.id] === true;
    const isIncomplete = spec?.numberOfDives != null && diveCount < spec.numberOfDives;
    const missingDives = spec?.numberOfDives != null ? spec.numberOfDives - diveCount : 0;
    const isRoutineFirst = routineIdx === 0;
    const isRoutineLast = routineIdx === routines.length - 1;

    const athleteAge = athleteProfile?.age ?? (targetUserId === user?.id ? user?.age : undefined);
    const ageCat = spec?.ageCategory;
    let isAgeMismatch = false;
    let ageCatRangeText = '';
    if (ageCat && athleteAge != null) {
      const minAge = Math.min(ageCat.fromYearOffset, ageCat.toYearOffset);
      const maxAge = Math.max(ageCat.fromYearOffset, ageCat.toYearOffset);
      isAgeMismatch = athleteAge < minAge || athleteAge > maxAge;
      ageCatRangeText = minAge === maxAge ? `${minAge} J.` : `${minAge}–${maxAge} J.`;
    }

    return (
      <View key={routine.id} style={styles.routineCard}>
        {/* Kopfzeile */}
        <View style={[styles.routineHeader, !spec && !isExpanded && styles.routineHeaderCollapsed]}>
          <TouchableOpacity
            style={styles.routineHeaderTouchable}
            onPress={() => toggleRoutineExpand(routine.id)}
            activeOpacity={0.7}
          >
            <View style={styles.routineHeaderInfo}>
              <View style={styles.routineTitleRow}>
                <Text style={styles.routineTitle}>
                  {getRoutineTitle(routine)}
                </Text>
                {isIncomplete && (
                  <View style={styles.incompleteBadge}>
                    <Text style={styles.incompleteBadgeText}>
                      ⚠️ {t('routines.incompleteWarning', {
                        current: diveCount,
                        required: spec.numberOfDives,
                        defaultValue: `Unvollständig (${diveCount}/${spec.numberOfDives})`,
                      })}
                    </Text>
                  </View>
                )}
                {isAgeMismatch && (
                  <View style={styles.incompleteBadge}>
                    <Text style={styles.incompleteBadgeText}>
                      ⚠️ {t('routines.ageCategoryMismatchBadge', {
                        category: spec?.ageCategory?.name,
                        defaultValue: `AK unpassend (${spec?.ageCategory?.name})`,
                      })}
                    </Text>
                  </View>
                )}
              </View>
              {routine.displayName && spec?.name && (
                <Text style={styles.routineSpecName}>{spec.name}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.routineHeaderRight}>
            {canEdit && routines.length > 1 && (
              <View style={styles.reorderBtnCol}>
                <TouchableOpacity
                  style={[styles.reorderArrowBtn, isRoutineFirst && styles.reorderArrowBtnDisabled]}
                  onPress={() => handleMoveRoutine(routineIdx, -1)}
                  disabled={isRoutineFirst || isReorderingRoutines}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.reorderArrowText, isRoutineFirst && styles.reorderArrowTextDisabled]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reorderArrowBtn, isRoutineLast && styles.reorderArrowBtnDisabled]}
                  onPress={() => handleMoveRoutine(routineIdx, 1)}
                  disabled={isRoutineLast || isReorderingRoutines}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.reorderArrowText, isRoutineLast && styles.reorderArrowTextDisabled]}>▼</Text>
                </TouchableOpacity>
              </View>
            )}
            {canEdit && (
              <View style={styles.routineActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openDuplicate(routine)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconBtnText}>📑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => openEdit(routine)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconBtnText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnDanger]}
                  onPress={() => promptDeleteRoutine(routine)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={() => toggleRoutineExpand(routine.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.collapseChevron}>{isExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spezifikations-Details (immer sichtbar) */}
        {spec && (
          <View style={[styles.specDetails, !isExpanded && styles.specDetailsCollapsed]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.specTagRow}>
                {spec.numberOfDives != null && (
                  <SpecTag label={t('routines.tags.dives', 'Sprünge')} value={String(spec.numberOfDives)} />
                )}
                {spec.numberOfGroups != null && (
                  <SpecTag label={t('routines.tags.groups', 'Gruppen')} value={String(spec.numberOfGroups)} />
                )}
                {spec.maxDifficultyScore != null && (
                  <SpecTag label={t('routines.tags.maxDifficulty')} value={spec.maxDifficultyScore.toFixed(1)} />
                )}
                {spec.ageCategory && (
                  <SpecTag
                    label={t('routines.tags.ageCategory', 'Altersklasse')}
                    value={spec.ageCategory.name}
                    warning={isAgeMismatch}
                  />
                )}
                {spec.gender && spec.gender !== 'ALL' && (
                  <SpecTag label={t('routines.tags.gender', 'Geschlecht')} value={getGenderLabel(spec.gender)} />
                )}
                {spec.beginner && (
                  <View style={[styles.specTag, styles.specTagHighlight]}>
                    <Text style={styles.specTagHighlightText}>{t('routines.tags.beginner', 'Anfänger')}</Text>
                  </View>
                )}
                {spec.juniorTableAllowed && (
                  <View style={[styles.specTag, styles.specTagHighlight]}>
                    <Text style={styles.specTagHighlightText}>{t('routines.tags.juniorTable', 'Juniortabelle')}</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {isExpanded && (
          <>
            {/* Kennzahlen-Leiste */}
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('routines.stats.totalDifficulty')}</Text>
                <Text style={styles.statValue}>
                  {totalDD.toFixed(1)}
                  {spec?.maxDifficultyScore != null ? (
                    <Text style={styles.statTarget}> / {spec.maxDifficultyScore.toFixed(1)}</Text>
                  ) : null}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('routines.stats.groups', 'Gruppen')}</Text>
                <Text style={styles.statValue}>
                  {distinctGroups}
                  {spec?.numberOfGroups != null ? (
                    <Text style={styles.statTarget}>
                      {t('routines.stats.minGroups', { min: spec.numberOfGroups, defaultValue: ` / min. ${spec.numberOfGroups}` })}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('routines.stats.diveCount', 'Sprung-Anzahl')}</Text>
                <Text style={[styles.statValue, isIncomplete && styles.statValueWarning]}>
                  {diveCount}
                  {spec?.numberOfDives != null ? (
                    <Text style={styles.statTarget}> / {spec.numberOfDives}</Text>
                  ) : null}
                </Text>
              </View>
            </View>

            {/* Sprünge in der Routine */}
            <View style={styles.divesSection}>
              {isIncomplete && (
                <View style={styles.incompleteBanner}>
                  <Text style={styles.incompleteBannerText}>
                    ⚠️ {t('routines.incompleteBannerText', {
                      count: missingDives,
                      current: diveCount,
                      required: spec.numberOfDives,
                      defaultValue: `Serie unvollständig: Noch ${missingDives} ${missingDives === 1 ? 'Sprung' : 'Sprünge'} erforderlich (${diveCount}/${spec.numberOfDives} vorhanden).`,
                    })}
                  </Text>
                </View>
              )}
              {isAgeMismatch && (
                <View style={styles.incompleteBanner}>
                  <Text style={styles.incompleteBannerText}>
                    ⚠️ {t('routines.ageCategoryMismatchBanner', {
                      category: spec?.ageCategory?.name,
                      athleteAge,
                      range: ageCatRangeText,
                      defaultValue: `Altersklasse unpassend: „${spec?.ageCategory?.name}“ (${ageCatRangeText}) passt nicht zum Alter des Sportlers (${athleteAge} Jahre).`,
                    })}
                  </Text>
                </View>
              )}
              <View style={styles.divesSectionHeader}>
                <Text style={styles.divesSectionTitle}>{t('routines.divesSectionTitle', 'Sprünge in dieser Routine')}</Text>
                <View style={styles.divesHeaderActions}>
                  {canEdit && diveCount > 1 && (
                    <TouchableOpacity
                      style={styles.sortInlineBtn}
                      onPress={() => openSortModal(routine)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.sortInlineBtnText}>{t('routines.sortBtn', '⇅ Sortieren')}</Text>
                    </TouchableOpacity>
                  )}
                  {canEdit && (
                    <TouchableOpacity
                      style={styles.addDiveInlineBtn}
                      onPress={() => openAddDiveModal(routine)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addDiveInlineText}>{t('routines.addDiveBtn', '+ Sprung hinzufügen')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {diveCount === 0 ? (
                <View style={styles.emptyDivesContainer}>
                  <Text style={styles.emptyDivesText}>{t('routines.noDivesText', 'Noch keine Sprünge in dieser Routine.')}</Text>
                  {canEdit && (
                    <TouchableOpacity
                      style={styles.addFirstDiveBtn}
                      onPress={() => openAddDiveModal(routine)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addFirstDiveBtnText}>{t('routines.addFirstDiveBtn', '+ Ersten Sprung hinzufügen')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                routine.diveExecutions.map((de, idx) => {
                  const heightText = BACKEND_TO_HEIGHT[de.height] ?? de.height;
                  const posLabel = getPositionName(de.execution);
                  const groupName = getGroupName(de.groupNumber);
                  const diveTitle = (i18n.language === 'en' ? (de.nameEn || de.nameDe) : (de.nameDe || de.nameEn)) || de.diveCode;
                  const isFirst = idx === 0;
                  const isLast = idx === routine.diveExecutions.length - 1;
                  const isReorderingThis = isReorderingRoutineId === routine.id;

                  return (
                    <View key={`${de.id}-${idx}`} style={styles.diveRow}>
                      {canEdit && routine.diveExecutions.length > 1 && (
                        <View style={styles.reorderBtnCol}>
                          <TouchableOpacity
                            style={[styles.reorderArrowBtn, isFirst && styles.reorderArrowBtnDisabled]}
                            onPress={() => handleMoveDive(routine, idx, -1)}
                            disabled={isFirst || isReorderingThis}
                            activeOpacity={0.6}
                          >
                            <Text style={[styles.reorderArrowText, isFirst && styles.reorderArrowTextDisabled]}>▲</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.reorderArrowBtn,
                              isLast && styles.reorderArrowBtnDisabled,
                            ]}
                            onPress={() => handleMoveDive(routine, idx, 1)}
                            disabled={isLast || isReorderingThis}
                            activeOpacity={0.6}
                          >
                            <Text
                              style={[
                                styles.reorderArrowText,
                                isLast && styles.reorderArrowTextDisabled,
                              ]}
                            >
                              ▼
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      <View style={styles.diveIndexCircle}>
                        <Text style={styles.diveIndexText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.diveCodeChip}>
                        <Text style={styles.diveCodeText}>{de.diveCode}{de.execution}</Text>
                      </View>
                      <View style={styles.diveInfo}>
                        <Text style={styles.diveName} numberOfLines={1}>
                          {diveTitle}
                        </Text>
                        <View style={styles.diveMetaRow}>
                          <Text style={styles.diveMetaBadge}>{heightText}</Text>
                          <Text style={styles.diveMetaBadge}>{posLabel}</Text>
                          <Text style={styles.diveMetaBadge}>
                            {t('common.difficultyBadge', {
                              dd: de.degreeOfDifficulty.toFixed(1),
                            })}
                          </Text>
                          <Text style={styles.diveMetaText}>{groupName}</Text>
                        </View>
                      </View>
                      {canEdit && (
                        <View style={styles.diveRowActions}>
                          <TouchableOpacity
                            style={styles.replaceDiveBtn}
                            onPress={() =>
                              openReplaceDiveModal(
                                routine,
                                de.id,
                                `${de.diveCode}${de.execution}${diveTitle !== de.diveCode ? ` (${diveTitle})` : ''}`,
                                idx
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Text style={styles.replaceDiveBtnText}>🔄</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.removeDiveBtn}
                            onPress={() =>
                              promptRemoveDive(
                                routine,
                                de.id,
                                `${de.diveCode}${de.execution}${diveTitle !== de.diveCode ? ` (${diveTitle})` : ''}`
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <Text style={styles.removeDiveBtnText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  // ── Dropdown-Komponente (wiederverwendet in beiden Modals) ──
  function SpecDropdown({
    value,
    open,
    onToggle,
    onSelect,
    onCreateNew,
  }: {
    value: number | null;
    open: boolean;
    onToggle: () => void;
    onSelect: (id: number | null) => void;
    onCreateNew: () => void;
  }) {
    const selectedSpec = specs.find((s) => s.id === value);
    return (
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={onToggle}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownBtnText, !selectedSpec && styles.dropdownPlaceholder]}>
            {selectedSpec
              ? selectedSpec.name ||
                t('routineSpecifications.defaultSpecName', {
                  id: selectedSpec.id,
                  defaultValue: `Spezifikation #${selectedSpec.id}`,
                })
              : t('routines.dropdown.selectSpec', 'Spezifikation wählen…')}
          </Text>
          <Text style={styles.dropdownChevron}>{open ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {open && (
          <View style={styles.dropdownList}>
            <TouchableOpacity
              style={[styles.dropdownItem, value === null && styles.dropdownItemActive]}
              onPress={() => { onSelect(null); onToggle(); }}
            >
              <Text style={[styles.dropdownItemText, value === null && styles.dropdownItemTextActive]}>
                {t('routines.dropdown.noSpec', 'Keine Spezifikation')}
              </Text>
            </TouchableOpacity>
            {specs.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.dropdownItem, value === s.id && styles.dropdownItemActive]}
                onPress={() => { onSelect(s.id); onToggle(); }}
              >
                <Text style={[styles.dropdownItemText, value === s.id && styles.dropdownItemTextActive]}>
                  {s.name ||
                    t('routineSpecifications.defaultSpecName', {
                      id: s.id,
                      defaultValue: `Spezifikation #${s.id}`,
                    })}
                </Text>
                {(s.numberOfDives != null || s.maxDifficultyScore != null) && (
                  <Text style={styles.dropdownItemMeta}>
                    {[
                      s.numberOfDives != null
                        ? t('routines.diveCount', { count: s.numberOfDives })
                        : null,
                      s.maxDifficultyScore != null
                        ? t('routines.dropdown.maxDifficultyShort', {
                            max: s.maxDifficultyScore,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.createSpecLink} onPress={onCreateNew} activeOpacity={0.7}>
              <Text style={styles.createSpecLinkText}>{t('routines.dropdown.createSpecLink', '＋ Neue Spezifikation anlegen')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const isAnyModalOpen =
    createModalVisible ||
    editModalVisible ||
    duplicateModalVisible ||
    addDiveModalVisible ||
    sortModalVisible ||
    sortRoutinesModalVisible ||
    !!routineToDelete ||
    !!diveToRemove;

  return (
    <View style={styles.container}>
      {!isAnyModalOpen && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      {/* Athleten-Banner */}
      {params.athleteId && params.athleteId !== user?.id && (
        <View style={styles.athleteBanner}>
          <Text style={styles.athleteBannerText}>👤 {athleteLabel}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {t('routines.routineCount', { count: routines.length })}
          </Text>
          <View style={styles.listHeaderActions}>
            {canEdit && routines.length > 1 && (
              <TouchableOpacity
                style={styles.sortRoutinesBtn}
                onPress={openSortRoutinesModal}
                activeOpacity={0.8}
              >
                <Text style={styles.sortRoutinesBtnText}>
                  {t('routines.sortRoutinesBtn', '⇅ Routinen sortieren')}
                </Text>
              </TouchableOpacity>
            )}
            {canEdit && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => { setSelectedSpecId(null); setCreateModalVisible(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.addBtnText}>{t('routines.newRoutineBtn', '+ Neue Routine')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.emptyText}>{t('routines.loading', 'Lade Routinen…')}</Text>
          </View>
        ) : routines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>{t('routines.noRoutinesTitle', 'Keine Routinen')}</Text>
            <Text style={styles.emptyText}>
              {canEdit
                ? t('routines.emptyTextCanEdit', 'Lege eine neue Routine an.')
                : t('routines.emptyText', 'Es sind noch keine Routinen vorhanden.')}
            </Text>
          </View>
        ) : (
          routines.map((routine, idx) => renderRoutine(routine, idx))
        )}
      </ScrollView>

      {/* ── Anlegen-Modal ── */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Toast toast={toast} onDismiss={() => setToast(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('routines.createModal.title', 'Neue Routine anlegen')}</Text>

            <Text style={styles.fieldLabel}>{t('routines.createModal.displayNameLabel', 'Anzeigename (optional)')}</Text>
            <TextInput
              style={[styles.dropdownBtn, { marginBottom: Spacing.md }]}
              placeholder={t('routines.createModal.displayNamePlaceholder', 'z. B. Wettkampf Pflicht 2025')}
              placeholderTextColor={Colors.textTertiary}
              value={createDisplayName}
              onChangeText={setCreateDisplayName}
            />

            <Text style={styles.fieldLabel}>{t('routines.createModal.specLabel', 'Serienspezifikation (optional)')}</Text>
            <SpecDropdown
              value={selectedSpecId}
              open={specDropdownOpen}
              onToggle={() => setSpecDropdownOpen((v) => !v)}
              onSelect={(id) => setSelectedSpecId(id)}
              onCreateNew={() => {
                setCreateModalVisible(false);
                router.push('/(drawer)/routine-specifications' as any);
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnLabel}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleCreate}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnLabel}>
                  {isSaving ? t('routines.createModal.creating', 'Anlegen…') : t('routines.createModal.create', 'Anlegen')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Bearbeiten-Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Toast toast={toast} onDismiss={() => setToast(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t('routines.editModal.title', 'Routine bearbeiten')}
            </Text>

            <Text style={styles.fieldLabel}>{t('routines.editModal.displayNameLabel', 'Anzeigename')}</Text>
            <TextInput
              style={[styles.dropdownBtn, { marginBottom: Spacing.md }]}
              placeholder={t('routines.editModal.displayNamePlaceholder', 'z. B. Wettkampf Pflicht 2025')}
              placeholderTextColor={Colors.textTertiary}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
            />

            <Text style={styles.fieldLabel}>{t('routines.editModal.specLabel', 'Serienspezifikation')}</Text>
            <SpecDropdown
              value={editSpecId}
              open={editDropdownOpen}
              onToggle={() => setEditDropdownOpen((v) => !v)}
              onSelect={(id) => setEditSpecId(id)}
              onCreateNew={() => {
                setEditModalVisible(false);
                router.push('/(drawer)/routine-specifications' as any);
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnLabel}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleEdit}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnLabel}>
                  {isSaving ? t('routines.editModal.saving', 'Speichern…') : t('routines.editModal.save', 'Speichern')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Duplizieren-Modal ── */}
      <Modal
        visible={duplicateModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDuplicateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Toast toast={toast} onDismiss={() => setToast(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.duplicateModalHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.modalTitle}>{t('routines.duplicateModal.title', 'Routine duplizieren')}</Text>
                {duplicateRoutineTarget && (
                  <Text style={styles.duplicateModalSub}>
                    {t('routines.duplicateModal.subtitle', {
                      name: getRoutineTitle(duplicateRoutineTarget),
                      defaultValue: `Kopie von „${getRoutineTitle(duplicateRoutineTarget)}“ erstellen`,
                    })}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setDuplicateModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>{t('routines.duplicateModal.targetOptionLabel', 'Ziel-Sportler')}</Text>
            
            {/* Option 1: Für diesen Sportler kopieren */}
            <TouchableOpacity
              style={[
                styles.duplicateOptionCard,
                duplicateTargetMode === 'SAME' && styles.duplicateOptionCardActive,
              ]}
              onPress={() => {
                setDuplicateTargetMode('SAME');
                setAthletePickerOpen(false);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, duplicateTargetMode === 'SAME' && styles.radioCircleActive]}>
                {duplicateTargetMode === 'SAME' && <View style={styles.radioInnerCircle} />}
              </View>
              <View style={styles.duplicateOptionContent}>
                <Text style={[styles.duplicateOptionTitle, duplicateTargetMode === 'SAME' && styles.duplicateOptionTitleActive]}>
                  {t('routines.duplicateModal.targetSameAthlete', {
                    name: athleteLabel,
                    defaultValue: `Für diesen Sportler kopieren (${athleteLabel})`,
                  })}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Für anderen Sportler kopieren */}
            <TouchableOpacity
              style={[
                styles.duplicateOptionCard,
                duplicateTargetMode === 'OTHER' && styles.duplicateOptionCardActive,
              ]}
              onPress={() => setDuplicateTargetMode('OTHER')}
              activeOpacity={0.7}
            >
              <View style={[styles.radioCircle, duplicateTargetMode === 'OTHER' && styles.radioCircleActive]}>
                {duplicateTargetMode === 'OTHER' && <View style={styles.radioInnerCircle} />}
              </View>
              <View style={styles.duplicateOptionContent}>
                <Text style={[styles.duplicateOptionTitle, duplicateTargetMode === 'OTHER' && styles.duplicateOptionTitleActive]}>
                  {t('routines.duplicateModal.targetOtherAthlete', 'Für anderen Sportler kopieren')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Sportler-Auswahl (wenn Option 2 aktiv) */}
            {duplicateTargetMode === 'OTHER' && (
              <View style={styles.athleteSelectSection}>
                <Text style={styles.subFieldLabel}>{t('routines.duplicateModal.selectAthleteLabel', 'Sportler auswählen')}</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, { marginBottom: athletePickerOpen ? 0 : Spacing.md }]}
                  onPress={() => setAthletePickerOpen((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={
                      selectedTargetUserId
                        ? styles.dropdownBtnText
                        : styles.dropdownBtnPlaceholder
                    }
                  >
                    {selectedTargetUserId
                      ? clubMembers.find((m) => m.userId === selectedTargetUserId)?.userFullName || `#${selectedTargetUserId}`
                      : t('routines.duplicateModal.selectAthletePlaceholder', 'Sportler wählen…')}
                  </Text>
                  <Text style={styles.dropdownChevron}>{athletePickerOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {athletePickerOpen && (
                  <View style={[styles.dropdownList, { maxHeight: 180, marginBottom: Spacing.md }]}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                      {clubMembers
                        .filter((m) => m.userId !== Number(targetUserId))
                        .map((m) => (
                          <TouchableOpacity
                            key={m.userId}
                            style={[
                              styles.dropdownItem,
                              selectedTargetUserId === m.userId && styles.dropdownItemActive,
                            ]}
                            onPress={() => {
                              setSelectedTargetUserId(m.userId);
                              setAthletePickerOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                selectedTargetUserId === m.userId && styles.dropdownItemTextActive,
                              ]}
                            >
                              👤 {m.userFullName || m.userEmail}
                            </Text>
                            {m.clubRole && (
                              <Text style={styles.dropdownItemMeta}>{m.clubRole}</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Anzeigename Eingabefeld */}
            <Text style={styles.fieldLabel}>{t('routines.duplicateModal.displayNameLabel', 'Anzeigename der neuen Routine')}</Text>
            <TextInput
              style={[styles.dropdownBtn, { marginBottom: Spacing.md }]}
              placeholder={t('routines.duplicateModal.displayNamePlaceholder', 'z. B. Wettkampf Pflicht 2025 (Kopie)')}
              placeholderTextColor={Colors.textTertiary}
              value={duplicateDisplayName}
              onChangeText={setDuplicateDisplayName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDuplicateModalVisible(false)}
                disabled={isDuplicating}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnLabel}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (isDuplicating || (duplicateTargetMode === 'OTHER' && !selectedTargetUserId)) && styles.saveBtnDisabled,
                ]}
                onPress={handleDuplicate}
                disabled={isDuplicating || (duplicateTargetMode === 'OTHER' && !selectedTargetUserId)}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnLabel}>
                  {isDuplicating
                    ? t('routines.duplicateModal.duplicatingBtn', 'Dupliziere…')
                    : t('routines.duplicateModal.duplicateBtn', 'Duplizieren')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sprung hinzufügen Modal ── */}
      <Modal
        visible={addDiveModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddDiveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Toast toast={toast} onDismiss={() => setToast(null)} />
          <View style={[styles.modalSheet, styles.addDiveSheet]}>
            {/* Header */}
            <View style={styles.addDiveModalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {replaceTargetDive
                    ? t('routines.replaceDiveModal.title', 'Sprung ersetzen')
                    : t('routines.addDiveModal.title', 'Sprung hinzufügen')}
                </Text>
                <Text style={styles.addDiveSub}>
                  {replaceTargetDive
                    ? t('routines.replaceDiveModal.subtitle', {
                        oldDive: replaceTargetDive.diveName,
                        name: getRoutineTitle(targetRoutineForAdd),
                        defaultValue: `Ersetzt „${replaceTargetDive.diveName}“ in ${getRoutineTitle(targetRoutineForAdd)}`,
                      })
                    : t('routines.addDiveModal.subtitle', {
                        name: getRoutineTitle(targetRoutineForAdd),
                        defaultValue: `zu ${getRoutineTitle(targetRoutineForAdd)}`,
                      })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => {
                  setAddDiveModalVisible(false);
                  setReplaceTargetDive(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Suche */}
            <View style={styles.diveSearchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.diveSearchInput}
                placeholder={t('routines.addDiveModal.searchPlaceholder', 'Sprungcode oder Name suchen (z. B. 103B, Auerbach…)')}
                placeholderTextColor={Colors.textTertiary}
                value={diveSearchQuery}
                onChangeText={setDiveSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {diveSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDiveSearchQuery('')} style={styles.searchClearBtn}>
                  <Text style={styles.searchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Höhen-Filter Chips */}
            <View style={styles.filterSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                {HEIGHT_FILTERS.map((h) => {
                  const isActive = selectedHeightFilter === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setSelectedHeightFilter(h)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {h === 'ALL' ? t('routines.addDiveModal.allHeights', 'Alle Höhen') : h}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Gruppen-Filter Chips */}
            <View style={styles.filterSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedGroupFilter === null && styles.filterChipActive]}
                  onPress={() => setSelectedGroupFilter(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, selectedGroupFilter === null && styles.filterChipTextActive]}>
                    {t('routines.addDiveModal.allGroups', 'Alle Gruppen')}
                  </Text>
                </TouchableOpacity>
                {[1, 2, 3, 4, 5, 6].map((grp) => {
                  const isActive = selectedGroupFilter === grp;
                  const grpName = getGroupName(grp);
                  return (
                    <TouchableOpacity
                      key={grp}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setSelectedGroupFilter(grp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {grp}. {grpName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Filter-Toggles (Valide & Sportler-Sprünge) */}
            <View style={styles.validFilterSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTogglesRow}>
                <TouchableOpacity
                  style={[styles.validFilterChip, onlyValidFilter && styles.validFilterChipActive]}
                  onPress={() => setOnlyValidFilter((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.validFilterChipIcon, onlyValidFilter && styles.validFilterChipIconActive]}>
                    {onlyValidFilter ? '✓' : '⚡'}
                  </Text>
                  <Text style={[styles.validFilterChipText, onlyValidFilter && styles.validFilterChipTextActive]}>
                    {t('routines.addDiveModal.onlyValidFilter', 'Nur valide Sprünge')}
                  </Text>
                  <View style={[styles.validCountPill, onlyValidFilter && styles.validCountPillActive]}>
                    <Text style={[styles.validCountPillText, onlyValidFilter && styles.validCountPillTextActive]}>
                      {validCount} / {totalMatchingCount}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.validFilterChip, onlyAthleteDivesFilter && styles.athleteFilterChipActive]}
                  onPress={() => setOnlyAthleteDivesFilter((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.validFilterChipIcon, onlyAthleteDivesFilter && styles.athleteFilterChipIconActive]}>
                    👤
                  </Text>
                  <Text style={[styles.validFilterChipText, onlyAthleteDivesFilter && styles.athleteFilterChipTextActive]}>
                    {t('routines.addDiveModal.onlyAthleteDivesFilter', 'Sportler-Sprünge')}
                  </Text>
                  <View style={[styles.validCountPill, onlyAthleteDivesFilter && styles.athleteCountPillActive]}>
                    <Text style={[styles.validCountPillText, onlyAthleteDivesFilter && styles.athleteCountPillTextActive]}>
                      {athleteMatchingCount}
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Trefferliste */}
            {isCatalogLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.emptyText}>{t('routines.addDiveModal.loadingCatalog', 'Lade Sprungkatalog…')}</Text>
              </View>
            ) : filteredCatalogExecutions.length === 0 ? (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.emptyText}>
                  {onlyValidFilter && totalMatchingCount > 0
                    ? t('routines.addDiveModal.noValidDivesFound', 'Keine validen Sprünge für diese Filter gefunden. Deaktiviere „Nur valide Sprünge“, um alle zu sehen.')
                    : onlyAthleteDivesFilter
                    ? t('routines.addDiveModal.noAthleteDivesFound', 'Keine Sprünge des Sportlers für diese Filter gefunden.')
                    : t('routines.addDiveModal.noDivesFound', 'Keine passenden Sprünge gefunden.')}
                </Text>
                {onlyValidFilter && totalMatchingCount > 0 && (
                  <TouchableOpacity
                    style={styles.showAllDivesBtn}
                    onPress={() => setOnlyValidFilter(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showAllDivesBtnText}>
                      {t('routines.addDiveModal.showAllBtn', 'Alle Sprünge anzeigen')}
                    </Text>
                  </TouchableOpacity>
                )}
                {onlyAthleteDivesFilter && (
                  <TouchableOpacity
                    style={styles.showAllDivesBtn}
                    onPress={() => setOnlyAthleteDivesFilter(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showAllDivesBtnText}>
                      {t('routines.addDiveModal.showAllBtn', 'Alle Sprünge anzeigen')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredCatalogExecutions}
                keyExtractor={(item) => String(item.id)}
                style={styles.catalogList}
                contentContainerStyle={styles.catalogListContent}
                renderItem={({ item }) => {
                  const uiHeight = BACKEND_TO_HEIGHT[item.height] ?? item.height;
                  const posName = getPositionName(item.execution);
                  const isBeingAdded = isAddingDiveId === item.id;
                  const diveTitle = (i18n.language === 'en' ? (item.nameEn || item.nameDe) : (item.nameDe || item.nameEn)) || item.diveCode;
                  const athleteDive = athleteDivesMap.get(item.id);

                  const validation = validateDiveForRoutine(
                    targetRoutineForAdd,
                    item,
                    replaceTargetDive?.diveExecutionId
                  );
                  const isInvalid = !validation.isValid;
                  const reasonBadge = validation.reasonKey
                    ? t(`routines.validationBadges.${validation.reasonKey}`, validation.reasonKey)
                    : null;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.catalogItemRow,
                        isInvalid && styles.catalogItemRowDisabled,
                      ]}
                      onPress={() => handleAddDive(item)}
                      disabled={isBeingAdded || isInvalid}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.catalogCodeBadge,
                          isInvalid && styles.catalogCodeBadgeDisabled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.catalogCodeText,
                            isInvalid && styles.catalogCodeTextDisabled,
                          ]}
                        >
                          {item.diveCode}{item.execution}
                        </Text>
                      </View>
                      <View style={styles.catalogInfo}>
                        <Text
                          style={[
                            styles.catalogName,
                            isInvalid && styles.catalogNameDisabled,
                          ]}
                          numberOfLines={1}
                        >
                          {diveTitle}
                        </Text>
                        <View style={styles.catalogMetaRow}>
                          <Text style={styles.catalogMetaBadge}>{uiHeight}</Text>
                          <Text style={styles.catalogMetaBadge}>{posName}</Text>
                          <Text style={styles.catalogMetaBadge}>
                            {t('common.difficultyBadge', {
                              dd: item.degreeOfDifficulty.toFixed(1),
                            })}
                          </Text>
                          <Text style={styles.catalogMetaGroup}>
                            {getGroupName(item.groupNumber)}
                          </Text>
                          {/* Status-Badge statt "Sportler"-Badge */}
                          {athleteDive && (
                            <View
                              style={[
                                styles.diveStatusPill,
                                athleteDive.status === 'MASTERED' && styles.diveStatusPillMastered,
                                athleteDive.status === 'LEARNING' && styles.diveStatusPillLearning,
                                athleteDive.status === 'PLANNED' && styles.diveStatusPillPlanned,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.diveStatusPillText,
                                  athleteDive.status === 'MASTERED' && styles.diveStatusPillTextMastered,
                                  athleteDive.status === 'LEARNING' && styles.diveStatusPillTextLearning,
                                  athleteDive.status === 'PLANNED' && styles.diveStatusPillTextPlanned,
                                ]}
                              >
                                {athleteDive.status === 'MASTERED'
                                  ? `🟢 ${t('trainingStatus.statusMastered', 'Sicher')}`
                                  : athleteDive.status === 'LEARNING'
                                  ? `🟡 ${t('trainingStatus.statusLearning', 'Im Aufbau')}`
                                  : `⚪ ${t('trainingStatus.statusPlanned', 'Geplant')}`}
                              </Text>
                            </View>
                          )}
                          {isInvalid && reasonBadge && (
                            <View
                              style={[
                                styles.invalidReasonTag,
                                validation.reasonKey === 'ROUTINE_DUPLICATE_DIVE_NUMBER'
                                  ? styles.invalidReasonTagDuplicate
                                  : styles.invalidReasonTagConstraint,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.invalidReasonTagText,
                                  validation.reasonKey === 'ROUTINE_DUPLICATE_DIVE_NUMBER'
                                    ? styles.invalidReasonTagTextDuplicate
                                    : styles.invalidReasonTagTextConstraint,
                                ]}
                              >
                                {reasonBadge}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.catalogAddBtn,
                          isInvalid && styles.catalogAddBtnDisabled,
                        ]}
                      >
                        {isBeingAdded ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : isInvalid ? (
                          <Text style={styles.catalogAddBtnTextDisabled}>
                            {validation.reasonKey === 'ROUTINE_DUPLICATE_DIVE_NUMBER' ? '✓' : '✕'}
                          </Text>
                        ) : (
                          <Text style={styles.catalogAddBtnText}>
                            {replaceTargetDive ? '⇄' : '＋'}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Sortier-Modal ── */}
      <Modal
        visible={sortModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Toast toast={toast} onDismiss={() => setToast(null)} />
          <View style={[styles.modalSheet, styles.sortModalSheet]}>
            <View style={styles.sortModalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('routines.sortModal.title', 'Sprünge sortieren')}</Text>
                <Text style={styles.sortModalSub}>
                  {t('routines.sortModal.subtitle', {
                    name: getRoutineTitle(sortModalRoutine),
                    defaultValue: getRoutineTitle(sortModalRoutine),
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSortModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sortSectionLabel}>{t('routines.sortModal.quickSort', 'Schnell-Sortierung')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSort('group')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortModal.presetGroup', '🏷️ Nach Gruppe')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSort('ddAsc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortModal.presetDdAsc')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSort('ddDesc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortModal.presetDdDesc')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSort('code')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortModal.presetCode', '🔢 Nach Nummer')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <Text style={styles.sortSectionLabel}>
              {t('routines.sortModal.customOrder', {
                count: sortModalDives.length,
                defaultValue: `Reihenfolge anpassen (${sortModalDives.length} Sprünge)`,
              })}
            </Text>
            <ScrollView style={styles.sortModalList} showsVerticalScrollIndicator={true}>
              {sortModalDives.map((de, idx) => {
                const heightText = BACKEND_TO_HEIGHT[de.height] ?? de.height;
                const posLabel = getPositionName(de.execution);
                const groupName = getGroupName(de.groupNumber);
                const diveTitle = (i18n.language === 'en' ? (de.nameEn || de.nameDe) : (de.nameDe || de.nameEn)) || de.diveCode;
                const ddBadge = t('common.difficultyBadge', {
                  dd: de.degreeOfDifficulty.toFixed(1),
                });
                const isFirst = idx === 0;
                const isLast = idx === sortModalDives.length - 1;

                return (
                  <View key={`${de.id}-${idx}`} style={styles.sortModalItem}>
                    <View style={styles.sortModalItemIndex}>
                      <Text style={styles.sortModalItemIndexText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.sortModalItemCode}>
                      <Text style={styles.sortModalItemCodeText}>{de.diveCode}{de.execution}</Text>
                    </View>
                    <View style={styles.sortModalItemInfo}>
                      <Text style={styles.sortModalItemName} numberOfLines={1}>
                        {diveTitle}
                      </Text>
                      <Text style={styles.sortModalItemMeta}>
                        {heightText} · {posLabel} · {ddBadge} · {groupName}
                      </Text>
                    </View>
                    <View style={styles.sortModalItemActions}>
                      <TouchableOpacity
                        style={[styles.sortActionBtn, isFirst && styles.sortActionBtnDisabled]}
                        onPress={() => handleModalMoveItem(idx, idx - 1)}
                        disabled={isFirst}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.sortActionBtnText}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sortActionBtn, isLast && styles.sortActionBtnDisabled]}
                        onPress={() => handleModalMoveItem(idx, idx + 1)}
                        disabled={isLast}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.sortActionBtnText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSortModalVisible(false)}
                disabled={isSavingOrder}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnLabel}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSavingOrder && styles.saveBtnDisabled]}
                onPress={handleSaveModalOrder}
                disabled={isSavingOrder}
                activeOpacity={0.8}
              >
                {isSavingOrder ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnLabel}>{t('routines.sortModal.saveOrder', 'Reihenfolge speichern')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Routinen-Sortier-Modal ── */}
      <Modal
        visible={sortRoutinesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSortRoutinesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Toast toast={toast} onDismiss={() => setToast(null)} />
          <View style={[styles.modalSheet, styles.sortModalSheet]}>
            <View style={styles.sortModalHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <Text style={styles.modalTitle}>{t('routines.sortRoutinesModal.title', 'Routinen sortieren')}</Text>
                <Text style={styles.sortModalSub}>
                  {t('routines.sortRoutinesModal.subtitle', {
                    name: athleteLabel,
                    defaultValue: `Reihenfolge der Routinen von ${athleteLabel}`,
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSortRoutinesModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sortSectionLabel}>{t('routines.sortRoutinesModal.quickSort', 'Schnell-Sortierung')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('createdDesc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetCreatedDesc', '🕒 Erstellung (neueste)')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('createdAsc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetCreatedAsc', '🕒 Erstellung (älteste)')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('updatedDesc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetUpdatedDesc', '🔄 Zuletzt aktualisiert')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('nameAsc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetNameAsc', '🔤 Name (A–Z)')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('nameDesc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetNameDesc', '🔤 Name (Z–A)')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('divesDesc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetDivesDesc', '🔢 Meiste Sprünge')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('divesAsc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetDivesAsc', '🔢 Wenigste Sprünge')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('ddDesc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetDdDesc')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handlePresetSortRoutines('ddAsc')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.presetChipText}>{t('routines.sortRoutinesModal.presetDdAsc')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <Text style={styles.sortSectionLabel}>
              {t('routines.sortRoutinesModal.customOrder', {
                count: sortRoutinesModalList.length,
                defaultValue: `Reihenfolge anpassen (${sortRoutinesModalList.length} Routinen)`,
              })}
            </Text>
            <ScrollView style={styles.sortModalList} showsVerticalScrollIndicator={true}>
              {sortRoutinesModalList.map((r, idx) => {
                const title = getRoutineTitle(r);
                const count = r.diveExecutions?.length ?? 0;
                const totalDD = r.diveExecutions?.reduce((sum, de) => sum + (de.degreeOfDifficulty || 0), 0) ?? 0;
                const isFirst = idx === 0;
                const isLast = idx === sortRoutinesModalList.length - 1;

                let metaParts: string[] = [];
                if (r.template?.name && r.displayName) {
                  metaParts.push(r.template.name);
                }
                metaParts.push(t('routines.diveCount', { count }));
                metaParts.push(t('common.difficultyBadge', {
                  dd: totalDD.toFixed(1),
                }));
                if (r.updatedAt) {
                  const d = new Date(r.updatedAt);
                  metaParts.push(`Aktualisiert: ${d.toLocaleDateString()}`);
                } else if (r.createdAt) {
                  const d = new Date(r.createdAt);
                  metaParts.push(`Erstellt: ${d.toLocaleDateString()}`);
                }

                return (
                  <View key={`${r.id}-${idx}`} style={styles.sortModalItem}>
                    <View style={styles.sortModalItemIndex}>
                      <Text style={styles.sortModalItemIndexText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.sortModalItemInfo}>
                      <Text style={styles.sortModalItemName} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={styles.sortModalItemMeta} numberOfLines={1}>
                        {metaParts.join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.sortModalItemActions}>
                      <TouchableOpacity
                        style={[styles.sortActionBtn, isFirst && styles.sortActionBtnDisabled]}
                        onPress={() => handleModalMoveRoutine(idx, idx - 1)}
                        disabled={isFirst}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.sortActionBtnText}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sortActionBtn, isLast && styles.sortActionBtnDisabled]}
                        onPress={() => handleModalMoveRoutine(idx, idx + 1)}
                        disabled={isLast}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.sortActionBtnText}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSortRoutinesModalVisible(false)}
                disabled={isSavingRoutinesOrder}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnLabel}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSavingRoutinesOrder && styles.saveBtnDisabled]}
                onPress={handleSaveRoutinesModalOrder}
                disabled={isSavingRoutinesOrder}
                activeOpacity={0.8}
              >
                {isSavingRoutinesOrder ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnLabel}>{t('routines.sortRoutinesModal.saveOrder', 'Reihenfolge speichern')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Confirm Delete Routine Modal ── */}
      <ConfirmModal
        visible={!!routineToDelete}
        title={t('routines.deleteModal.title', 'Routine löschen')}
        message={
          routineToDelete
            ? t('routines.deleteModal.message', {
                name: getRoutineTitle(routineToDelete),
                defaultValue: `Möchtest du die Routine „${getRoutineTitle(routineToDelete)}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
              })
            : ''
        }
        confirmText={t('common.delete', 'Löschen')}
        cancelText={t('common.cancel', 'Abbrechen')}
        variant="danger"
        isLoading={isDeletingRoutine}
        onConfirm={confirmDeleteRoutine}
        onCancel={() => !isDeletingRoutine && setRoutineToDelete(null)}
      />

      {/* ── Confirm Remove Dive Modal ── */}
      <ConfirmModal
        visible={!!diveToRemove}
        title={t('routines.removeDiveModal.title', 'Sprung entfernen')}
        message={
          diveToRemove
            ? t('routines.removeDiveModal.message', {
                diveName: diveToRemove.diveName,
                routineName: getRoutineTitle(diveToRemove.routine),
                defaultValue: `Möchtest du „${diveToRemove.diveName}“ wirklich aus „${getRoutineTitle(diveToRemove.routine)}“ entfernen?`,
              })
            : ''
        }
        confirmText={t('routines.removeDiveModal.confirmBtn', 'Entfernen')}
        cancelText={t('common.cancel', 'Abbrechen')}
        variant="danger"
        isLoading={isRemovingDive}
        onConfirm={confirmRemoveDive}
        onCancel={() => !isRemovingDive && setDiveToRemove(null)}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  athleteBanner: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  athleteBannerText: {
    color: Colors.white,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.md,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  listTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  listHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sortRoutinesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Shadows.sm,
  },
  sortRoutinesBtnText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    ...Shadows.sm,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
  },

  routineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  routineHeaderCollapsed: {
    marginBottom: 0,
  },
  routineHeaderTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  routineHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  collapseToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseChevron: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
  routineHeaderInfo: { flex: 1 },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  routineTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  incompleteBadge: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warning,
    borderWidth: 1,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  incompleteBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.warning,
  },
  routineSpecName: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  routineActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: { backgroundColor: Colors.errorBg },
  iconBtnText: { fontSize: 16 },

  specDetails: {
    marginBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  specDetailsCollapsed: {
    marginBottom: 0,
  },
  specTagRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  specTag: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  specTagWarning: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warning,
    borderWidth: 1,
  },
  specTagLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  specTagLabelWarning: {
    color: Colors.warning,
  },
  specTagValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  specTagValueWarning: {
    color: Colors.warning,
  },
  specTagHighlight: {
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  specTagHighlightText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: FontWeight.medium,
  },
  statValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  statValueWarning: {
    color: Colors.warning,
  },
  statTarget: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.normal,
  },

  // Incomplete Banner
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningBg,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  incompleteBannerText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.medium,
  },

  // Dives Section
  divesSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  divesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  divesSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addDiveInlineBtn: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  addDiveInlineText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },

  emptyDivesContainer: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  emptyDivesText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  addFirstDiveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  addFirstDiveBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  diveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  diveIndexCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  diveIndexText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
  },
  diveCodeChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    minWidth: 48,
    alignItems: 'center',
  },
  diveCodeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  diveInfo: { flex: 1 },
  diveName: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  diveMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  diveMetaBadge: {
    fontSize: 10,
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontWeight: FontWeight.medium,
  },
  diveMetaText: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  diveRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  replaceDiveBtn: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceDiveBtnText: {
    fontSize: 14,
  },
  removeDiveBtn: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeDiveBtnText: {
    fontSize: 14,
  },

  emptyContainer: {
    paddingTop: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Modal allgemeine Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    ...Shadows.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },

  // Dropdown
  dropdownWrapper: { marginBottom: Spacing.lg },
  dropdownBtn: {
    height: 50,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  dropdownBtnText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  dropdownPlaceholder: { color: Colors.textTertiary },
  dropdownChevron: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    ...Shadows.md,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: {
    backgroundColor: Colors.primarySurface,
  },
  dropdownItemText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  dropdownItemTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  dropdownItemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  createSpecLink: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  createSpecLinkText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },

  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.white,
  },

  // Add Dive Modal
  addDiveSheet: {
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  addDiveModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  addDiveSub: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtnText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },

  diveSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  diveSearchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    height: '100%',
  },
  searchClearBtn: {
    padding: Spacing.xs,
  },
  searchClearText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },

  filterSection: {
    marginBottom: Spacing.xs,
  },
  filterChipsRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },

  modalLoadingContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalEmptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },

  catalogList: {
    marginTop: Spacing.xs,
  },
  catalogListContent: {
    paddingBottom: Spacing.md,
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  catalogCodeBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 52,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  catalogCodeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  catalogInfo: {
    flex: 1,
  },
  catalogName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  catalogMetaBadge: {
    fontSize: 10,
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontWeight: FontWeight.medium,
  },
  catalogMetaGroup: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  catalogItemRowDisabled: {
    opacity: 0.58,
  },
  catalogCodeBadgeDisabled: {
    backgroundColor: Colors.borderLight,
  },
  catalogCodeTextDisabled: {
    color: Colors.textTertiary,
  },
  catalogNameDisabled: {
    color: Colors.textSecondary,
  },

  // Valid Filter Toggle Bar
  validFilterSection: {
    paddingVertical: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  validFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  validFilterChipActive: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.success,
  },
  validFilterChipIcon: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
  validFilterChipIconActive: {
    color: Colors.success,
  },
  validFilterChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  validFilterChipTextActive: {
    color: Colors.success,
    fontWeight: FontWeight.bold,
  },
  validCountPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  validCountPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.success,
  },
  validCountPillText: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semiBold,
  },
  validCountPillTextActive: {
    color: Colors.success,
    fontWeight: FontWeight.bold,
  },
  filterTogglesRow: {
    gap: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  athleteFilterChipActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  athleteFilterChipIconActive: {
    color: Colors.primary,
  },
  athleteCountPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
  },
  athleteCountPillTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  diveStatusPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diveStatusPillMastered: {
    backgroundColor: Colors.statusMasteredBg,
    borderColor: Colors.statusMastered + '40',
  },
  diveStatusPillLearning: {
    backgroundColor: Colors.statusLearningBg,
    borderColor: Colors.statusLearning + '40',
  },
  diveStatusPillPlanned: {
    backgroundColor: Colors.statusPlannedBg,
    borderColor: Colors.statusPlanned + '40',
  },
  diveStatusPillText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  diveStatusPillTextMastered: {
    color: Colors.statusMastered,
  },
  diveStatusPillTextLearning: {
    color: Colors.statusLearning,
  },
  diveStatusPillTextPlanned: {
    color: Colors.statusPlanned,
  },

  // Reason Badges on Catalog Items
  invalidReasonTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  invalidReasonTagDuplicate: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warning,
  },
  invalidReasonTagConstraint: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.error,
  },
  invalidReasonTagText: {
    fontSize: 10,
    fontWeight: FontWeight.semiBold,
  },
  invalidReasonTagTextDuplicate: {
    color: Colors.warning,
  },
  invalidReasonTagTextConstraint: {
    color: Colors.error,
  },

  showAllDivesBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  showAllDivesBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },

  catalogAddBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
    ...Shadows.sm,
  },
  catalogAddBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  catalogAddBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
  catalogAddBtnTextDisabled: {
    color: Colors.textTertiary,
    fontSize: 14,
    fontWeight: FontWeight.bold,
  },

  // Dive Reordering & Sort Styles
  divesHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sortInlineBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  sortInlineBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  reorderBtnCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    gap: 1,
  },
  reorderArrowBtn: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: Colors.background,
  },
  reorderArrowBtnDisabled: {
    opacity: 0.2,
  },
  reorderArrowText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  reorderArrowTextDisabled: {
    color: Colors.textTertiary,
  },
  sortModalSheet: {
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  sortModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sortModalSub: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  sortSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  presetScroll: {
    marginBottom: Spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  presetChip: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  presetChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  sortModalList: {
    maxHeight: 340,
    marginBottom: Spacing.sm,
  },
  sortModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sortModalItemIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  sortModalItemIndexText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  sortModalItemCode: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortModalItemCodeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  sortModalItemInfo: {
    flex: 1,
  },
  sortModalItemName: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  sortModalItemMeta: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  sortModalItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: Spacing.xs,
  },
  sortActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortActionBtnDisabled: {
    opacity: 0.3,
  },
  sortActionBtnText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  // Duplicate Modal Styles
  duplicateModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  duplicateModalSub: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  duplicateOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  duplicateOptionCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  radioCircleActive: {
    borderColor: Colors.primary,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  duplicateOptionContent: {
    flex: 1,
  },
  duplicateOptionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  duplicateOptionTitleActive: {
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  athleteSelectSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  subFieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
});
