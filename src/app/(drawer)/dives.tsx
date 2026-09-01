import { useLocalSearchParams, useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AddDiveModal from '../../components/modals/AddDiveModal';
import ConfirmModal from '../../components/modals/ConfirmModal';
import StatusChangeModal from '../../components/modals/StatusChangeModal';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { DIVE_GROUP_NAMES } from '../constants/diveData';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import { AthleteTrainingEntry, DiveHeight, DiveStatus, TrainerNote } from '../types/dive';

import {
  api,
  AthleteDiveStatusResponse,
  BACKEND_TO_HEIGHT,
  CommentResponse,
  DiveExecutionResponse,
} from '../../services/api';
import { isSystemComment } from '../../services/commentUtils';

const HEIGHTS: DiveHeight[] = ['1m', '3m', '5m', '7.5m', '10m'];
const STATUSES: DiveStatus[] = ['PLANNED', 'LEARNING', 'MASTERED'];

interface GroupedStatusDive {
  key: string;
  diveCode: string;
  groupNumber: number;
  nameDe: string;
  nameEn: string;
  status: DiveStatus;
  entries: AthleteTrainingEntry[];
}

import {
  useDiveCatalog,
  useAthleteDives,
  useAthleteComments,
} from '../../hooks/useDataStore';

export default function AthleteDivesScreen() {
  const { t, i18n } = useTranslation();
  const { user, activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string; height?: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const isTrainer = isTrainerOrAdmin();
  const targetAthleteIdNum = params.athleteId ? Number(params.athleteId) : (user?.id ? Number(user.id) : 0);
  const targetAthleteId = targetAthleteIdNum ? String(targetAthleteIdNum) : '';
  const viewingAthlete = params.athleteId && String(params.athleteId) !== String(user?.id);
  const athleteLabel = params.athleteName ?? t('trainingStatus.myTraining');
  const clubId = activeClubId || activeClubMembership?.clubId;

  const { executions: catalogExecutions } = useDiveCatalog();
  const {
    dives: rawAthleteDives,
    isLoading: isDivesLoading,
    refresh: refreshDives,
    updateStatus,
  } = useAthleteDives(targetAthleteIdNum);
  const {
    comments: rawComments,
    refresh: refreshComments,
    createComment,
    updateComment,
    deleteComment,
  } = useAthleteComments(targetAthleteIdNum, clubId);

  const [selectedHeight, setSelectedHeight] = useState<DiveHeight>((params.height as DiveHeight) || '1m');
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [heightDropdownOpen, setHeightDropdownOpen] = useState(false);
  const isLoading = isDivesLoading && rawAthleteDives.length === 0;

  // Modals
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    entryId: string;
    diveExecutionId?: number;
    current: DiveStatus;
    learnedAt?: string | null;
  }>({
    visible: false,
    entryId: '',
    current: 'PLANNED',
    learnedAt: null,
  });
  const [addDiveModal, setAddDiveModal] = useState(false);
  const [hideNotes, setHideNotes] = useState(false);
  const [noteModal, setNoteModal] = useState<{ visible: boolean; entryId: string; noteId?: string }>({ visible: false, entryId: '' });
  const [noteText, setNoteText] = useState('');
  const [noteShared, setNoteShared] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [deleteNoteModal, setDeleteNoteModal] = useState<{
    visible: boolean;
    noteId?: string;
    isDeleting?: boolean;
  }>({ visible: false });
  const [deleteDiveModal, setDeleteDiveModal] = useState<{
    visible: boolean;
    entryId?: string;
    isDeleting?: boolean;
  }>({ visible: false });

  const toggleNotes = (entryId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  const isDE = i18n.language === 'de';

  const formatLearnedDate = (isoDate: string) => {
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return isDE ? `${day}.${month}.${year}` : `${year}-${month}-${day}`;
      }
      return new Date(isoDate).toLocaleDateString(isDE ? 'de-DE' : 'en-US');
    } catch {
      return isoDate;
    }
  };

  // Map raw athlete dives and comments into UI entries
  const entries: AthleteTrainingEntry[] = useMemo(() => {
    return rawAthleteDives.map((d) => {
      const diveNotes: TrainerNote[] = rawComments
        .filter(
          (c) =>
            !isSystemComment(c) &&
            c.athleteDiveStatusId != null &&
            Number(c.athleteDiveStatusId) === Number(d.id)
        )
        .map((c) => ({
          id: String(c.id),
          text: c.content,
          authorId: String(c.authorId ?? ''),
          authorName: c.authorName || 'Trainer',
          createdAt: c.createdAt,
          sharedWithAthlete: c.sharedWithAthlete,
        }));

      return {
        id: String(d.id),
        athleteId: String(d.athleteId),
        diveCode: d.diveCode,
        execution: d.execution,
        degreeOfDifficulty: d.degreeOfDifficulty,
        diveExecutionId: d.diveExecutionId,
        height: BACKEND_TO_HEIGHT[d.height] || '1m',
        status: d.status,
        learnedAt: d.learnedAt ?? null,
        notes: diveNotes,
      };
    });
  }, [rawAthleteDives, rawComments]);

  useFocusEffect(
    useCallback(() => {
      if (targetAthleteIdNum) {
        refreshDives();
        refreshComments();
      }
    }, [targetAthleteIdNum, refreshDives, refreshComments])
  );

  // Set navigation header title
  useEffect(() => {
    navigation.setOptions({
      title: viewingAthlete ? `${athleteLabel} – ${t('nav.dives', 'Sprünge')}` : t('nav.dives', 'Sprünge'),
    });
  }, [navigation, viewingAthlete, athleteLabel, t]);

  const getPositionName = useCallback((pos?: string) => {
    if (!pos) return '';
    switch (pos) {
      case 'A': return t('routines.positions.A');
      case 'B': return t('routines.positions.B');
      case 'C': return t('routines.positions.C');
      case 'D': return t('routines.positions.D');
      default: return pos;
    }
  }, [t]);

  const getDiveDefinition = useCallback((code: string) => {
    const exec = catalogExecutions.find((c) => c.diveCode === code);
    if (!exec) return null;
    return {
      code: exec.diveCode,
      nameDe: exec.nameDe,
      nameEn: exec.nameEn,
      groupNumber: exec.groupNumber,
    };
  }, [catalogExecutions]);

  const currentEntries = useMemo(() => {
    return entries.filter((e) => {
      if (e.height !== selectedHeight) return false;
      if (selectedGroup !== null) {
        const diveDef = getDiveDefinition(e.diveCode);
        const groupNum = diveDef?.groupNumber || (parseInt(e.diveCode?.charAt(0), 10) || 1);
        if (groupNum !== selectedGroup) return false;
      }
      return true;
    });
  }, [entries, selectedHeight, selectedGroup, getDiveDefinition]);

  const groupedByStatus = useMemo(() => {
    const result: Record<DiveStatus, GroupedStatusDive[]> = {
      PLANNED: [],
      LEARNING: [],
      MASTERED: [],
    };

    const statusMaps: Record<DiveStatus, Map<string, GroupedStatusDive>> = {
      PLANNED: new Map(),
      LEARNING: new Map(),
      MASTERED: new Map(),
    };

    currentEntries.forEach((entry) => {
      const diveDef = getDiveDefinition(entry.diveCode);
      const rawStatus = (entry.status || 'PLANNED').toUpperCase();
      const statusKey: DiveStatus =
        rawStatus === 'MASTERED'
          ? 'MASTERED'
          : rawStatus === 'LEARNING' || rawStatus === 'LEARNED'
          ? 'LEARNING'
          : 'PLANNED';

      let group = statusMaps[statusKey]?.get(entry.diveCode);
      if (!group) {
        group = {
          key: `${statusKey}_${entry.diveCode}`,
          diveCode: entry.diveCode,
          groupNumber: diveDef?.groupNumber || (parseInt(entry.diveCode?.charAt(0), 10) || 1),
          nameDe: diveDef?.nameDe || entry.diveCode,
          nameEn: diveDef?.nameEn || entry.diveCode,
          status: statusKey,
          entries: [],
        };
        statusMaps[statusKey]?.set(entry.diveCode, group);
        result[statusKey]?.push(group);
      }
      group.entries.push(entry);
    });

    for (const st of STATUSES) {
      result[st].forEach((group) => {
        group.entries.sort((a, b) => (a.execution || '').localeCompare(b.execution || ''));
      });
    }

    return result;
  }, [currentEntries, getDiveDefinition]);

  const handleStatusChange = async (status: DiveStatus, learnedAt?: string | null) => {
    const targetEntry = entries.find((e) => e.id === statusModal.entryId);
    if (!targetEntry || !targetAthleteIdNum) return;

    setStatusModal((s) => ({ ...s, visible: false }));

    const diveExecutionId = (targetEntry as any).diveExecutionId ?? statusModal.diveExecutionId;
    if (!diveExecutionId) {
      Alert.alert(t('common.error'), 'Could not find dive execution ID');
      return;
    }

    try {
      await updateStatus(diveExecutionId, status, status === 'MASTERED' ? learnedAt : null);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to update dive status');
    }
  };

  const handleAddDive = async (execution: DiveExecutionResponse, status: DiveStatus = 'PLANNED') => {
    if (!targetAthleteIdNum) return;
    try {
      const learnedAt = status === 'MASTERED' ? new Date().toISOString().split('T')[0] : null;
      await updateStatus(execution.id, status, learnedAt);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to add dive to training plan');
    }
  };

  const handleAddMultipleDives = async (executions: DiveExecutionResponse[], status: DiveStatus = 'PLANNED') => {
    if (!targetAthleteIdNum || executions.length === 0) return;
    try {
      const learnedAt = status === 'MASTERED' ? new Date().toISOString().split('T')[0] : null;
      await Promise.all(
        executions.map((execution) =>
          updateStatus(execution.id, status, learnedAt)
        )
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to add dives to training plan');
    }
  };

  const handleDeleteDive = (entryId: string) => {
    setStatusModal((s) => ({ ...s, visible: false }));
    setDeleteDiveModal({ visible: true, entryId });
  };

  const handleConfirmDeleteDive = async () => {
    if (!deleteDiveModal.entryId || !targetAthleteId) return;
    setDeleteDiveModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      await api.deleteAthleteDive(targetAthleteId, deleteDiveModal.entryId);
      setDeleteDiveModal({ visible: false, isDeleting: false });
      await refreshDives();
    } catch (e: any) {
      setDeleteDiveModal((prev) => ({ ...prev, isDeleting: false }));
      Alert.alert(t('common.error', 'Fehler'), e?.message || 'Status konnte nicht gelöscht werden');
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !noteModal.entryId || !targetAthleteIdNum) return;
    try {
      if (noteModal.noteId) {
        await updateComment(Number(noteModal.noteId), {
          content: noteText.trim(),
          sharedWithAthlete: noteShared,
        });
      } else {
        const statusIdNum = Number(noteModal.entryId);
        await createComment({
          athleteId: targetAthleteIdNum,
          content: noteText.trim(),
          sharedWithAthlete: noteShared,
          athleteDiveStatusId: isNaN(statusIdNum as number) ? undefined : statusIdNum,
        });
      }
      setNoteText('');
      setNoteModal({ visible: false, entryId: '', noteId: undefined });
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to save note');
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setDeleteNoteModal({ visible: true, noteId });
  };

  const handleConfirmDeleteNote = async () => {
    if (!deleteNoteModal.noteId) return;
    setDeleteNoteModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      await deleteComment(Number(deleteNoteModal.noteId));
      setDeleteNoteModal({ visible: false, isDeleting: false });
    } catch (e: any) {
      setDeleteNoteModal((prev) => ({ ...prev, isDeleting: false }));
      Alert.alert(t('common.error', 'Fehler'), e?.message || 'Notiz konnte nicht gelöscht werden');
    }
  };

  const existingExecutionIds = entries
    .filter((e) => e.height === selectedHeight && e.diveExecutionId != null)
    .map((e) => e.diveExecutionId as number);

  const renderNotes = (entry: AthleteTrainingEntry) => {
    if (hideNotes) {
      return null;
    }

    const visibleNotes = isTrainer
      ? entry.notes
      : entry.notes.filter((n) => n.sharedWithAthlete);
    const hasNotes = visibleNotes.length > 0;
    const isExpanded = !!expandedNotes[entry.id];

    if (!hasNotes) {
      return null;
    }

    const sortedNotes = [...visibleNotes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestNote = sortedNotes[0];
    const latestDateFormatted = latestNote?.createdAt
      ? new Date(latestNote.createdAt).toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
        day: 'numeric',
        month: 'short',
      })
      : '';

    return (
      <View style={styles.notesSection}>
        <TouchableOpacity
          style={styles.notesToggleHeader}
          onPress={() => toggleNotes(entry.id)}
          activeOpacity={0.7}
        >
          <View style={styles.notesToggleLeft}>
            <Text style={styles.notesSectionTitle}>{t('trainingStatus.notes')}</Text>
            <View style={styles.notesBadge}>
              <Text style={styles.notesBadgeText}>{visibleNotes.length}</Text>
            </View>
          </View>

          <View style={styles.notesToggleRight}>
            {!isExpanded && latestDateFormatted ? (
              <Text style={styles.notesLatestDate}>
                {t('trainingStatus.latestNote', { date: latestDateFormatted })}
              </Text>
            ) : null}
            <Text style={styles.notesToggleChevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.notesList}>
            {sortedNotes.map((note) => {
              const isPrivate = !note.sharedWithAthlete;
              const isAuthor = String(note.authorId) === String(user?.id);
              const isGlobalAdmin = user?.globalRole === 'ROLE_ADMIN';
              const canEdit = isAuthor || isGlobalAdmin;
              const canDelete = isAuthor || isTrainer || isGlobalAdmin;

              return (
                <View
                  key={note.id}
                  style={[styles.noteItem, isPrivate && styles.noteItemPrivate]}
                >
                  <View style={styles.noteHeader}>
                    <View style={styles.noteAuthorCol}>
                      <Text style={[styles.noteAuthor, isPrivate && styles.noteAuthorPrivate]}>
                        {t('trainingStatus.noteBy', { author: note.authorName })}
                      </Text>
                      <Text style={styles.noteDate}>
                        {new Date(note.createdAt).toLocaleDateString(isDE ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <View style={styles.noteHeaderRight}>
                      {isPrivate && (
                        <View style={styles.privateChip}>
                          <Text style={styles.privateChipText}>🔒</Text>
                        </View>
                      )}

                      {(canEdit || canDelete) && (
                        <View style={styles.noteActionsGroup}>
                          {canEdit && (
                            <TouchableOpacity
                              style={styles.noteActionBtn}
                              onPress={() => {
                                setNoteText(note.text);
                                setNoteShared(note.sharedWithAthlete);
                                setNoteModal({ visible: true, entryId: entry.id, noteId: note.id });
                              }}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel={t('trainingStatus.editComment', 'Bearbeiten')}
                            >
                              <Text style={styles.noteActionIcon}>✏️</Text>
                            </TouchableOpacity>
                          )}

                          {canDelete && (
                            <TouchableOpacity
                              style={styles.noteActionBtn}
                              onPress={() => handleDeleteNote(note.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel={t('trainingStatus.deleteComment', 'Löschen')}
                            >
                              <Text style={styles.noteDeleteIcon}>✕</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.noteText, isPrivate && styles.noteTextPrivate]}>{note.text}</Text>
                </View>
              );
            })}

            {isTrainer && (
              <TouchableOpacity
                style={styles.addNoteBtn}
                onPress={() => {
                  setNoteText('');
                  setNoteShared(true);
                  setNoteModal({ visible: true, entryId: entry.id, noteId: undefined });
                }}
              >
                <Text style={styles.addNoteBtnText}>+ {t('trainingStatus.addNote')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderGroupedDive = (group: GroupedStatusDive) => {
    return (
      <View key={group.key} style={styles.groupedCard}>
        {/* Sprung-Header */}
        <View style={styles.groupedHeader}>
          <View style={styles.codeChip}>
            <Text style={styles.codeText}>{group.diveCode}</Text>
          </View>
          <View style={styles.groupedTitle}>
            <Text style={styles.diveName} numberOfLines={1}>
              {isDE ? group.nameDe : group.nameEn}
            </Text>
            <Text style={styles.groupName}>
              {DIVE_GROUP_NAMES[group.groupNumber]?.[isDE ? 'de' : 'en']}
            </Text>
          </View>
        </View>

        {/* Ausführungs-Zeilen */}
        <View style={styles.groupedExecList}>
          {group.entries.map((entry, idx) => {
            const isLast = idx === group.entries.length - 1;
            return (
              <View key={entry.id} style={[styles.groupedExecItem, !isLast && styles.groupedExecItemBorder]}>
                <View style={styles.groupedExecRow}>
                  <View style={styles.groupedExecLeft}>
                    <View style={styles.groupedExecPosBadge}>
                      <Text style={styles.groupedExecPosBadgeText}>
                        {entry.execution || '—'}
                      </Text>
                    </View>
                    <View style={styles.groupedExecMetaCol}>
                      <View style={styles.groupedExecMetaRow}>
                        <Text style={styles.groupedExecPosName}>
                          {getPositionName(entry.execution)}
                        </Text>
                        {entry.degreeOfDifficulty != null && (
                          <>
                            <Text style={styles.subtitleSeparator}>•</Text>
                            <Text style={styles.ddMetaText}>
                              {t('common.difficultyBadge', {
                                dd: entry.degreeOfDifficulty.toFixed(1),
                              })}
                            </Text>
                          </>
                        )}
                        {!hideNotes && isTrainer && (
                          <TouchableOpacity
                            onPress={() => {
                              setNoteText('');
                              setNoteShared(true);
                              setNoteModal({ visible: true, entryId: entry.id, noteId: undefined });
                            }}
                            style={styles.inlineAddNoteBtn}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.inlineAddNoteIcon}>📝</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {entry.status === 'MASTERED' && entry.learnedAt ? (
                        <Text style={styles.learnedDateSmall}>
                          {t('trainingStatus.learnedAt', {
                            date: formatLearnedDate(entry.learnedAt),
                            defaultValue: `Gelernt am ${formatLearnedDate(entry.learnedAt)}`,
                          })}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.groupedExecRight}>
                    {isTrainer ? (
                      <TouchableOpacity
                        onPress={() =>
                          setStatusModal({
                            visible: true,
                            entryId: entry.id,
                            diveExecutionId: entry.diveExecutionId,
                            current: entry.status,
                            learnedAt: entry.learnedAt,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <StatusBadge status={entry.status} size="sm" />
                      </TouchableOpacity>
                    ) : (
                      <StatusBadge status={entry.status} size="sm" />
                    )}
                  </View>
                </View>

                {/* Notizen */}
                {renderNotes(entry)}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Athleten-Label (wenn vom Trainer geöffnet) */}
      {viewingAthlete && (
        <View style={styles.athleteBanner}>
          <Text style={styles.athleteBannerText}>👤 {athleteLabel}</Text>
        </View>
      )}

      {/* Höhen-Auswahl (Dropdown) & Notizen-Sichtbarkeit */}
      <View style={styles.filterSection}>
        <View style={styles.filterTopRow}>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdownBtn, heightDropdownOpen && styles.dropdownBtnOpen]}
              onPress={() => setHeightDropdownOpen((prev) => !prev)}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownBtnContent}>
                <Text style={styles.dropdownLabel}>{t('trainingStatus.heightLabel', 'Höhe')}:</Text>
                <View style={styles.selectedHeightBadge}>
                  <Text style={styles.selectedHeightText}>{selectedHeight}</Text>
                </View>
              </View>
              <Text style={styles.dropdownChevron}>{heightDropdownOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {heightDropdownOpen && (
              <View style={styles.dropdownList}>
                {HEIGHTS.map((h) => {
                  const isSelected = selectedHeight === h;
                  const countAtHeight = entries.filter((e) => e.height === h).length;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                      onPress={() => {
                        setSelectedHeight(h);
                        setHeightDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <View style={[styles.dropdownItemBadge, isSelected && styles.dropdownItemBadgeActive]}>
                          <Text style={[styles.dropdownItemBadgeText, isSelected && styles.dropdownItemBadgeTextActive]}>
                            {h}
                          </Text>
                        </View>
                        <Text style={[styles.dropdownItemCount, isSelected && styles.dropdownItemCountActive]}>
                          {t('routines.diveCount', { count: countAtHeight })}
                        </Text>
                      </View>
                      {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.notesVisibilityBtn, hideNotes && styles.notesVisibilityBtnActive]}
            onPress={() => setHideNotes((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.notesVisibilityIcon}>{hideNotes ? '🙈' : '📝'}</Text>
            <Text style={[styles.notesVisibilityText, hideNotes && styles.notesVisibilityTextActive]}>
              {hideNotes
                ? t('trainingStatus.notesHidden', 'Notizen ausgeblendet')
                : t('trainingStatus.hideNotes', 'Notizen ausblenden')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Gruppen-Filter Chips */}
        <View style={styles.groupFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupFilterRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, selectedGroup === null && styles.filterChipActive]}
              onPress={() => setSelectedGroup(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, selectedGroup === null && styles.filterChipTextActive]}>
                {t('routines.addDiveModal.allGroups', 'Alle Gruppen')}
              </Text>
            </TouchableOpacity>
            {[1, 2, 3, 4, 5, 6].map((grp) => {
              const isActive = selectedGroup === grp;
              const grpName = DIVE_GROUP_NAMES[grp]?.[isDE ? 'de' : 'en'] || '';
              return (
                <TouchableOpacity
                  key={grp}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedGroup(grp)}
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
      </View>

      {/* Sprung-Listen (nach Status gruppiert) */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {STATUSES.map((status) => {
          const groupList = groupedByStatus[status];
          if (groupList.length === 0) return null;
          const statusLabelKey = `trainingStatus.status${status.charAt(0) + status.slice(1).toLowerCase()}` as any;
          return (
            <View key={status}>
              <Text style={styles.sectionHeader}>{t(statusLabelKey)}</Text>
              {groupList.map(renderGroupedDive)}
            </View>
          );
        })}

        {currentEntries.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedGroup !== null
                ? t('trainingStatus.noDivesForGroup', 'Keine Sprünge für diese Gruppe vorhanden.')
                : t('trainingStatus.noDivesForHeight')}
            </Text>
          </View>
        )}

        {/* Sprung hinzufügen Button (nur Trainer) */}
        {isTrainer && (
          <TouchableOpacity
            style={styles.addDiveBtn}
            onPress={() => setAddDiveModal(true)}
          >
            <Text style={styles.addDiveBtnText}>+ {t('trainingStatus.addDive')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modals */}
      <StatusChangeModal
        visible={statusModal.visible}
        currentStatus={statusModal.current}
        currentLearnedAt={statusModal.learnedAt}
        onSelect={handleStatusChange}
        onDelete={isTrainer && statusModal.entryId ? () => handleDeleteDive(statusModal.entryId) : undefined}
        onClose={() => setStatusModal((s) => ({ ...s, visible: false }))}
      />

      <AddDiveModal
        visible={addDiveModal}
        height={selectedHeight}
        catalogExecutions={catalogExecutions}
        existingExecutionIds={existingExecutionIds}
        onAdd={handleAddDive}
        onAddMultiple={handleAddMultipleDives}
        onClose={() => setAddDiveModal(false)}
      />

      {/* Notiz-Modal */}
      <Modal
        visible={noteModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteModal({ visible: false, entryId: '', noteId: undefined })}
      >
        <View style={styles.noteOverlay}>
          <View style={styles.noteSheet}>
            <Text style={styles.noteSheetTitle}>
              {noteModal.noteId
                ? t('trainingStatus.editNoteModalTitle', 'Notiz bearbeiten')
                : t('trainingStatus.addNote', 'Trainer-Notiz')}
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder={t('trainingStatus.notePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {/* Toggle: Für Sportler sichtbar */}
            <TouchableOpacity
              style={styles.shareToggle}
              onPress={() => setNoteShared((v) => !v)}
            >
              <View style={[styles.toggle, noteShared && styles.toggleOn]}>
                <View style={[styles.toggleThumb, noteShared && styles.toggleThumbOn]} />
              </View>
              <Text style={styles.shareToggleLabel}>
                {t('trainingStatus.sharedWithAthlete')}
              </Text>
            </TouchableOpacity>

            <View style={styles.noteActions}>
              <TouchableOpacity
                style={styles.noteCancelBtn}
                onPress={() => {
                  setNoteText('');
                  setNoteModal({ visible: false, entryId: '', noteId: undefined });
                }}
              >
                <Text style={styles.noteCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteSaveBtn, !noteText.trim() && styles.noteSaveBtnDisabled]}
                onPress={handleSaveNote}
                disabled={!noteText.trim()}
              >
                <Text style={styles.noteSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Delete Note Modal */}
      <ConfirmModal
        visible={deleteNoteModal.visible}
        title={t('trainingStatus.deleteNoteConfirmTitle', 'Notiz löschen')}
        message={t('trainingStatus.deleteNoteConfirmMsg', 'Möchtest du diese Notiz wirklich löschen?')}
        confirmText={t('common.delete', 'Löschen')}
        cancelText={t('common.cancel', 'Abbrechen')}
        isLoading={deleteNoteModal.isDeleting}
        onConfirm={handleConfirmDeleteNote}
        onCancel={() => setDeleteNoteModal({ visible: false })}
      />

      {/* Confirm Delete Dive Modal */}
      <ConfirmModal
        visible={deleteDiveModal.visible}
        title={t('trainingStatus.deleteDiveConfirmTitle', 'Sprung entfernen')}
        message={t('trainingStatus.deleteDiveConfirmMsg', 'Möchtest du diesen Sprung wirklich aus dem Trainingsplan entfernen?')}
        confirmText={t('common.delete', 'Löschen')}
        cancelText={t('common.cancel', 'Abbrechen')}
        isLoading={deleteDiveModal.isDeleting}
        onConfirm={handleConfirmDeleteDive}
        onCancel={() => setDeleteDiveModal({ visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  athleteBanner: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary,
  },
  athleteBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.primaryDark,
  },
  filterSection: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  filterTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  dropdownContainer: {
    flex: 1,
  },
  dropdownBtn: {
    height: 40,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
  },
  dropdownBtnOpen: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  dropdownBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dropdownLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  selectedHeightBadge: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  selectedHeightText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  dropdownChevron: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  dropdownList: {
    marginTop: Spacing.xs,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Shadows.md,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  dropdownItemActive: {
    backgroundColor: Colors.primarySurface,
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dropdownItemBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    minWidth: 36,
    alignItems: 'center',
  },
  dropdownItemBadgeActive: {
    backgroundColor: Colors.primary,
  },
  dropdownItemBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  dropdownItemBadgeTextActive: {
    color: Colors.textOnPrimary,
  },
  dropdownItemCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  dropdownItemCountActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  dropdownCheckmark: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  notesVisibilityBtn: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  notesVisibilityBtnActive: {
    backgroundColor: Colors.borderLight,
  },
  notesVisibilityIcon: {
    fontSize: 14,
  },
  notesVisibilityText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  notesVisibilityTextActive: {
    color: Colors.textTertiary,
  },
  groupFilterContainer: {
    marginTop: Spacing.sm,
  },
  groupFilterRow: {
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
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
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  sectionHeader: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  groupedCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  groupedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderLeftWidth: 3.5,
    borderLeftColor: Colors.primary,
    gap: Spacing.md,
  },
  codeChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  groupedTitle: {
    flex: 1,
  },
  diveName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  groupName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  groupedExecList: {
    paddingHorizontal: Spacing.md,
  },
  groupedExecItem: {
    paddingVertical: Spacing.sm,
  },
  groupedExecItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  groupedExecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupedExecLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  groupedExecPosBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedExecPosBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  groupedExecMetaCol: {
    flex: 1,
  },
  groupedExecMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  groupedExecPosName: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  subtitleSeparator: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  ddMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  learnedDateSmall: {
    fontSize: 11,
    color: Colors.success,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  groupedExecRight: {
    marginLeft: Spacing.sm,
  },
  inlineAddNoteBtn: {
    padding: 2,
    marginLeft: 2,
  },
  inlineAddNoteIcon: {
    fontSize: 13,
  },
  notesSection: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  notesToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  notesToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notesSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  notesBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  notesBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  notesToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notesLatestDate: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  notesToggleChevron: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  notesList: {
    marginTop: Spacing.xs,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    gap: Spacing.xs,
  },
  noteItem: {
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  noteItemPrivate: {
    backgroundColor: '#FFF8E6',
    borderColor: '#FFE082',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  noteAuthorCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  noteAuthor: {
    fontSize: 11,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  noteAuthorPrivate: {
    color: '#8D4F00',
  },
  noteDate: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  noteHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  privateChip: {
    backgroundColor: '#FFE082',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  privateChipText: {
    fontSize: 9,
  },
  noteActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  noteActionBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteActionIcon: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
  noteDeleteIcon: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  noteText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  noteTextPrivate: {
    color: '#3E2723',
  },
  addNoteBtn: {
    paddingVertical: 3,
  },
  addNoteBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  addDiveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  addDiveBtnText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  noteOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  noteSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  noteSheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 100,
    backgroundColor: Colors.surfaceSecondary,
  },
  shareToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  shareToggleLabel: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  noteActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  noteCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  noteCancelText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  noteSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  noteSaveBtnDisabled: {
    opacity: 0.5,
  },
  noteSaveText: {
    fontSize: FontSize.md,
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.bold,
  },
});
