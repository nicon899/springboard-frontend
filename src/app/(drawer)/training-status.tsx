import React, { useState, useMemo, useCallback } from 'react';
import {
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
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import StatusChangeModal from '../../components/modals/StatusChangeModal';
import AddDiveModal from '../../components/modals/AddDiveModal';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import { AthleteTrainingEntry, DiveHeight, DiveStatus, TrainerNote } from '../types/dive';
import { DIVE_GROUP_NAMES } from '../constants/diveData';

import {
  api,
  BACKEND_TO_HEIGHT,
  HEIGHT_TO_BACKEND,
  AthleteDiveStatusResponse,
  CommentResponse,
  DiveExecutionResponse,
  RoutineResponse,
} from '../../services/api';

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

export default function TrainingStatusScreen() {
  const { t, i18n } = useTranslation();
  const { user, isTrainerOrAdmin } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const isTrainer = isTrainerOrAdmin();
  const targetAthleteId = params.athleteId ?? user?.id ?? '';
  const viewingAthlete = params.athleteId && params.athleteId !== user?.id;
  const athleteLabel = params.athleteName ?? t('trainingStatus.myTraining');

  const [selectedHeight, setSelectedHeight] = useState<DiveHeight>('1m');
  const [entries, setEntries] = useState<AthleteTrainingEntry[]>([]);
  const [catalogExecutions, setCatalogExecutions] = useState<DiveExecutionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [routines, setRoutines] = useState<RoutineResponse[]>([]);

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
  const [noteModal, setNoteModal] = useState<{ visible: boolean; entryId: string }>({ visible: false, entryId: '' });
  const [noteText, setNoteText] = useState('');
  const [noteShared, setNoteShared] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

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

  // Load catalog executions & athlete dives from API
  const loadData = useCallback(async () => {
    if (!targetAthleteId) return;
    setIsLoading(true);
    try {
      const [divesRes, commentsRes, catalogRes, routinesRes] = await Promise.all([
        api.getAthleteDives(targetAthleteId).catch(() => [] as AthleteDiveStatusResponse[]),
        api.getAthleteComments(targetAthleteId).catch(() => [] as CommentResponse[]),
        api.getAllDiveExecutions().catch(() => [] as DiveExecutionResponse[]),
        api.getRoutinesByUser(targetAthleteId).catch(() => [] as RoutineResponse[]),
      ]);

      setCatalogExecutions(catalogRes);
      setRoutines(routinesRes);

      const mappedEntries: AthleteTrainingEntry[] = divesRes.map((d) => {
        const diveNotes: TrainerNote[] = commentsRes
          .filter((c) => c.athleteDiveStatusId === d.id || (!c.athleteDiveStatusId && String(c.athleteId) === String(targetAthleteId)))
          .map((c) => ({
            id: String(c.id),
            text: c.content,
            authorId: String(c.authorId),
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
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      setEntries(mappedEntries);
    } catch (e) {
      console.warn('Failed to load training status:', e);
    } finally {
      setIsLoading(false);
    }
  }, [targetAthleteId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const getPositionName = useCallback((pos?: string) => {
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
        return pos || '';
    }
  }, [t]);

  // Gefilterte Einträge für aktuelle Höhe
  const currentEntries = useMemo(
    () => entries.filter((e) => e.height === selectedHeight),
    [entries, selectedHeight]
  );

  const getDiveDefinition = useCallback(
    (code: string): DiveExecutionResponse | undefined => catalogExecutions.find((d) => d.diveCode === code),
    [catalogExecutions]
  );

  // Gruppiert nach Status und fasst gleiche Sprungnummern zusammen
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
      let group = statusMaps[entry.status].get(entry.diveCode);
      if (!group) {
        group = {
          key: `${entry.status}_${entry.diveCode}`,
          diveCode: entry.diveCode,
          groupNumber: diveDef?.groupNumber || 1,
          nameDe: diveDef?.nameDe || entry.diveCode,
          nameEn: diveDef?.nameEn || entry.diveCode,
          status: entry.status,
          entries: [],
        };
        statusMaps[entry.status].set(entry.diveCode, group);
        result[entry.status].push(group);
      }
      group.entries.push(entry);
    });

    // Ausführungen innerhalb der Gruppe nach Position sortieren: A, B, C, D
    for (const st of STATUSES) {
      result[st].forEach((group) => {
        group.entries.sort((a, b) => (a.execution || '').localeCompare(b.execution || ''));
      });
    }

    return result;
  }, [currentEntries, getDiveDefinition]);

  const handleStatusChange = async (status: DiveStatus, learnedAt?: string | null) => {
    const targetEntry = entries.find((e) => e.id === statusModal.entryId);
    if (!targetEntry || !targetAthleteId) return;

    setStatusModal((s) => ({ ...s, visible: false }));

    // Use the diveExecutionId stored on the entry (from AthleteDiveStatusResponse)
    const diveExecutionId = (targetEntry as any).diveExecutionId ?? statusModal.diveExecutionId;
    if (!diveExecutionId) {
      Alert.alert(t('common.error'), 'Could not find dive execution ID');
      return;
    }

    try {
      await api.updateAthleteDive(targetAthleteId, {
        diveExecutionId,
        status,
        learnedAt: status === 'MASTERED' ? learnedAt : null,
      });
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to update dive status');
    }
  };

  const handleAddDive = async (execution: DiveExecutionResponse, status: DiveStatus = 'PLANNED') => {
    if (!targetAthleteId) return;
    try {
      const learnedAt = status === 'MASTERED' ? new Date().toISOString().split('T')[0] : null;
      await api.updateAthleteDive(targetAthleteId, {
        diveExecutionId: execution.id,
        status,
        learnedAt,
      });
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to add dive to training plan');
    }
  };

  const handleAddMultipleDives = async (executions: DiveExecutionResponse[], status: DiveStatus = 'PLANNED') => {
    if (!targetAthleteId || executions.length === 0) return;
    try {
      const learnedAt = status === 'MASTERED' ? new Date().toISOString().split('T')[0] : null;
      await Promise.all(
        executions.map((execution) =>
          api.updateAthleteDive(targetAthleteId, {
            diveExecutionId: execution.id,
            status,
            learnedAt,
          })
        )
      );
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to add dives to training plan');
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !targetAthleteId) return;
    try {
      const statusIdNum = noteModal.entryId ? Number(noteModal.entryId) : undefined;
      await api.createComment(targetAthleteId, {
        athleteId: Number(targetAthleteId),
        content: noteText.trim(),
        sharedWithAthlete: noteShared,
        athleteDiveStatusId: isNaN(statusIdNum as number) ? undefined : statusIdNum,
      });
      setNoteText('');
      setNoteModal({ visible: false, entryId: '' });
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || 'Failed to add note');
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
            {sortedNotes.map((note) => (
              <View key={note.id} style={styles.noteItem}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteAuthor}>{t('trainingStatus.noteBy', { author: note.authorName })}</Text>
                  <Text style={styles.noteDate}>
                    {new Date(note.createdAt).toLocaleDateString(isDE ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                  {!note.sharedWithAthlete && (
                    <View style={styles.privateChip}>
                      <Text style={styles.privateChipText}>🔒</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.noteText}>{note.text}</Text>
              </View>
            ))}

            {/* Trainer: Notiz hinzufügen Button nur wenn ausgeklappt */}
            {isTrainer && (
              <TouchableOpacity
                style={styles.addNoteBtn}
                onPress={() => setNoteModal({ visible: true, entryId: entry.id })}
              >
                <Text style={styles.addNoteBtnText}>+ {t('trainingStatus.addNote')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderSingleEntry = (entry: AthleteTrainingEntry) => {
    const dive = getDiveDefinition(entry.diveCode);
    return (
      <View key={entry.id} style={styles.entryCard}>
        {/* Sprung-Header */}
        <View style={styles.entryHeader}>
          <View style={styles.codeChip}>
            <Text style={styles.codeText}>
              {entry.diveCode}{entry.execution || ''}
            </Text>
          </View>
          <View style={styles.entryTitle}>
            <Text style={styles.diveName} numberOfLines={1}>
              {dive ? (isDE ? dive.nameDe : dive.nameEn) : entry.diveCode}
            </Text>
            <View style={styles.entrySubtitleRow}>
              {dive && (
                <Text style={styles.groupName}>
                  {DIVE_GROUP_NAMES[dive.groupNumber]?.[isDE ? 'de' : 'en']}
                </Text>
              )}
              {entry.execution ? (
                <>
                  {dive && <Text style={styles.subtitleSeparator}>•</Text>}
                  <Text style={styles.posMetaText}>
                    {getPositionName(entry.execution)}
                  </Text>
                </>
              ) : null}
              {entry.degreeOfDifficulty != null ? (
                <>
                  <Text style={styles.subtitleSeparator}>•</Text>
                  <Text style={styles.ddMetaText}>
                    DD {entry.degreeOfDifficulty.toFixed(1)}
                  </Text>
                </>
              ) : null}
              {entry.status === 'MASTERED' && entry.learnedAt ? (
                <>
                  <Text style={styles.subtitleSeparator}>•</Text>
                  <Text style={styles.learnedDateSmall}>
                    {t('trainingStatus.learnedAt', {
                      date: formatLearnedDate(entry.learnedAt),
                      defaultValue: `Gelernt am ${formatLearnedDate(entry.learnedAt)}`,
                    })}
                  </Text>
                </>
              ) : null}
              {!hideNotes && isTrainer && (
                <TouchableOpacity
                  onPress={() => setNoteModal({ visible: true, entryId: entry.id })}
                  style={styles.inlineAddNoteBtn}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.inlineAddNoteIcon}>📝</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          {isTrainer ? (
            <TouchableOpacity
              onPress={() =>
                setStatusModal({
                  visible: true,
                  entryId: entry.id,
                  current: entry.status,
                  diveExecutionId: entry.diveExecutionId,
                  learnedAt: entry.learnedAt,
                })
              }
              activeOpacity={0.7}
            >
              <StatusBadge status={entry.status} />
            </TouchableOpacity>
          ) : (
            <StatusBadge status={entry.status} />
          )}
        </View>

        {!hideNotes && renderNotes(entry)}
      </View>
    );
  };

  const renderGroupedDive = (group: GroupedStatusDive) => {
    if (group.entries.length === 1) {
      return renderSingleEntry(group.entries[0]);
    }

    const dive = getDiveDefinition(group.diveCode);
    const groupName = DIVE_GROUP_NAMES[group.groupNumber]?.[isDE ? 'de' : 'en'];

    return (
      <View key={group.key} style={styles.entryCard}>
        {/* Zusammengefasster Header für gleiche Sprungnummer */}
        <View style={styles.multiGroupHeader}>
          <View style={styles.codeChip}>
            <Text style={styles.codeText}>{group.diveCode}</Text>
          </View>
          <View style={styles.entryTitle}>
            <Text style={styles.diveName} numberOfLines={1}>
              {dive ? (isDE ? dive.nameDe : dive.nameEn) : (isDE ? group.nameDe : group.nameEn)}
            </Text>
            <Text style={styles.groupName}>
              {groupName ? `${groupName} • ` : ''}
              {group.entries.length} {isDE ? 'Ausführungen' : 'executions'}
            </Text>
          </View>
        </View>

        {/* Einzelne Ausführungen dieses Sprungs */}
        <View style={styles.groupedExecutionsWrapper}>
          {group.entries.map((entry, idx) => {
            const isLast = idx === group.entries.length - 1;

            return (
              <View
                key={entry.id}
                style={[
                  styles.groupedExecRow,
                  !isLast && styles.groupedExecRowBorder,
                ]}
              >
                <View style={styles.groupedExecHeader}>
                  <View style={styles.groupedExecLeft}>
                    <View style={styles.posCodeBadge}>
                      <Text style={styles.posCodeBadgeText}>
                        {entry.execution || ''}
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
                              DD {entry.degreeOfDifficulty.toFixed(1)}
                            </Text>
                          </>
                        )}
                        {!hideNotes && isTrainer && (
                          <TouchableOpacity
                            onPress={() => setNoteModal({ visible: true, entryId: entry.id })}
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

                  {isTrainer ? (
                    <TouchableOpacity
                      onPress={() =>
                        setStatusModal({
                          visible: true,
                          entryId: entry.id,
                          current: entry.status,
                          diveExecutionId: entry.diveExecutionId,
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

                {!hideNotes && renderNotes(entry)}
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

      {/* Routinen-Übersicht */}
      <TouchableOpacity
        style={styles.routinesBanner}
        onPress={() =>
          router.push({
            pathname: '/(drawer)/routines',
            params: params.athleteId
              ? { athleteId: params.athleteId, athleteName: params.athleteName }
              : {},
          } as any)
        }
        activeOpacity={0.8}
      >
        <View style={styles.routinesBannerLeft}>
          <Text style={styles.routinesBannerEmoji}>📋</Text>
          <View>
            <Text style={styles.routinesBannerTitle}>
              {t('trainingStatus.routinesBannerTitle', 'Routinen (Serien)')}
            </Text>
            <Text style={styles.routinesBannerSub}>
              {t('trainingStatus.routinesBannerSub', {
                count: routines.length,
                defaultValue: `${routines.length} Routinen vorhanden`,
              })}
            </Text>
          </View>
        </View>
        <Text style={styles.routinesBannerArrow}>›</Text>
      </TouchableOpacity>

      {/* Höhen-Auswahl & Notizen-Sichtbarkeit */}
      <View style={styles.heightFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.heightRow}
          style={styles.heightScrollView}
        >
          {HEIGHTS.map((h) => (
            <TouchableOpacity
              key={h}
              style={[styles.heightChip, selectedHeight === h && styles.heightChipActive]}
              onPress={() => setSelectedHeight(h)}
            >
              <Text style={[styles.heightChipLabel, selectedHeight === h && styles.heightChipLabelActive]}>
                {h}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
            <Text style={styles.emptyText}>{t('trainingStatus.noDivesForHeight')}</Text>
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
        onRequestClose={() => setNoteModal({ visible: false, entryId: '' })}
      >
        <View style={styles.noteOverlay}>
          <View style={styles.noteSheet}>
            <Text style={styles.noteSheetTitle}>{t('trainingStatus.addNote')}</Text>
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
              <Text style={styles.shareToggleLabel}>{t('trainingStatus.sharedWithAthlete')}</Text>
            </TouchableOpacity>
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={styles.noteCancelBtn}
                onPress={() => { setNoteModal({ visible: false, entryId: '' }); setNoteText(''); }}
              >
                <Text style={styles.noteCancelLabel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noteSaveBtn} onPress={handleAddNote}>
                <Text style={styles.noteSaveLabel}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  routinesBanner: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  routinesBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  routinesBannerEmoji: { fontSize: 24 },
  routinesBannerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  routinesBannerSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  routinesBannerArrow: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
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
  heightFilterContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  heightScrollView: {
    flexGrow: 0,
  },
  heightRow: {
    paddingVertical: 2,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heightChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  heightChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  heightChipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  heightChipLabelActive: { color: Colors.white },
  notesVisibilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
  },
  notesVisibilityBtnActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  notesVisibilityIcon: {
    fontSize: 12,
  },
  notesVisibilityText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  notesVisibilityTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  scrollContent: { padding: Spacing.lg, paddingTop: Spacing.sm },
  sectionHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  entryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.md,
    minWidth: 44,
    alignItems: 'center',
  },
  codeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  entryTitle: { flex: 1 },
  diveName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  entrySubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
    gap: 4,
  },
  groupName: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  posMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  ddMetaText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  subtitleSeparator: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  learnedDateSmall: {
    fontSize: FontSize.xs,
    color: Colors.statusMastered,
    fontWeight: FontWeight.medium,
  },
  notesSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  notesToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  notesToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notesSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  notesBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  notesToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notesLatestDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  notesToggleChevron: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginLeft: 2,
  },
  notesList: {
    marginTop: Spacing.xs,
  },
  noteItem: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: Spacing.sm,
  },
  noteAuthor: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
    flex: 1,
  },
  noteDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  privateChip: {
    backgroundColor: Colors.warningBg,
    borderRadius: BorderRadius.xs,
    padding: 2,
  },
  privateChipText: { fontSize: 10 },
  noteText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  addNoteBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  addNoteBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  addDiveBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addDiveBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  emptyContainer: {
    paddingTop: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  // Notiz-Modal
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
    paddingBottom: Spacing.xxxl,
    ...Shadows.lg,
  },
  noteSheetTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 100,
  },
  shareToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  shareToggleLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  noteActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  noteCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCancelLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  noteSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSaveLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.white,
  },

  // ── Zusammengefasste Sprünge (gleiche Nummer, mehrere Ausführungen) ──
  multiGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  groupedExecutionsWrapper: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 2,
  },
  groupedExecRow: {
    paddingVertical: Spacing.sm,
  },
  groupedExecRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  groupedExecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupedExecLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  posCodeBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posCodeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  groupedExecMetaCol: {
    flex: 1,
  },
  groupedExecMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  groupedExecPosName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  inlineAddNoteBtn: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAddNoteIcon: {
    fontSize: 12,
  },
});
