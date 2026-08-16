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
import { useLocalSearchParams, useNavigation } from 'expo-router';
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
import { DiveDefinition } from '../types/dive';
import { SAMPLE_DIVES, DIVE_GROUP_NAMES } from '../constants/diveData';

// ────────────────────────────────────────────────────────────
// MOCK-DATEN (TODO: replace with real API call)
// ────────────────────────────────────────────────────────────
const INITIAL_ENTRIES: AthleteTrainingEntry[] = [
  {
    id: 'e1', athleteId: 'me', diveCode: '101', height: '1m', status: 'MASTERED',
    notes: [{ id: 'n1', text: 'Sehr sauber ausgeführt!', authorId: 'trainer-1', authorName: 'Max M.', createdAt: '2024-02-01T10:00:00Z', sharedWithAthlete: true }],
    addedAt: '2024-01-10T00:00:00Z', updatedAt: '2024-02-01T10:00:00Z',
  },
  {
    id: 'e2', athleteId: 'me', diveCode: '103', height: '1m', status: 'LEARNING',
    notes: [{ id: 'n2', text: 'Anlauf noch verbessern.', authorId: 'trainer-1', authorName: 'Max M.', createdAt: '2024-02-05T09:00:00Z', sharedWithAthlete: false }],
    addedAt: '2024-01-15T00:00:00Z', updatedAt: '2024-02-05T09:00:00Z',
  },
  {
    id: 'e3', athleteId: 'me', diveCode: '403', height: '3m', status: 'PLANNED',
    notes: [],
    addedAt: '2024-02-10T00:00:00Z', updatedAt: '2024-02-10T00:00:00Z',
  },
];

const HEIGHTS: DiveHeight[] = ['1m', '3m', '5m', '7.5m', '10m'];
const STATUSES: DiveStatus[] = ['PLANNED', 'LEARNING', 'MASTERED'];

export default function TrainingStatusScreen() {
  const { t, i18n } = useTranslation();
  const { user, isTrainerOrAdmin } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const navigation = useNavigation();

  const isTrainer = isTrainerOrAdmin();
  const viewingAthlete = params.athleteId && params.athleteId !== user?.id;
  const athleteLabel = params.athleteName ?? t('trainingStatus.myTraining');

  const [selectedHeight, setSelectedHeight] = useState<DiveHeight>('1m');
  const [entries, setEntries] = useState<AthleteTrainingEntry[]>(INITIAL_ENTRIES);

  // Modals
  const [statusModal, setStatusModal] = useState<{ visible: boolean; entryId: string; current: DiveStatus }>({
    visible: false, entryId: '', current: 'PLANNED',
  });
  const [addDiveModal, setAddDiveModal] = useState(false);
  const [noteModal, setNoteModal] = useState<{ visible: boolean; entryId: string }>({ visible: false, entryId: '' });
  const [noteText, setNoteText] = useState('');
  const [noteShared, setNoteShared] = useState(true);

  const isDE = i18n.language === 'de';

  // Gefilterte Einträge für aktuelle Höhe
  const currentEntries = useMemo(
    () => entries.filter((e) => e.height === selectedHeight),
    [entries, selectedHeight]
  );

  // Gruppiert nach Status
  const grouped = useMemo(() => {
    const groups: Record<DiveStatus, AthleteTrainingEntry[]> = { PLANNED: [], LEARNING: [], MASTERED: [] };
    currentEntries.forEach((e) => groups[e.status].push(e));
    return groups;
  }, [currentEntries]);

  const getDiveDefinition = useCallback(
    (code: string): DiveDefinition | undefined => SAMPLE_DIVES.find((d) => d.code === code),
    []
  );

  const handleStatusChange = (status: DiveStatus) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === statusModal.entryId ? { ...e, status, updatedAt: new Date().toISOString() } : e
      )
    );
    setStatusModal((s) => ({ ...s, visible: false }));
  };

  const handleAddDive = (dive: DiveDefinition) => {
    const newEntry: AthleteTrainingEntry = {
      id: `e-${Date.now()}`,
      athleteId: params.athleteId ?? user?.id ?? 'me',
      diveCode: dive.code,
      height: selectedHeight,
      status: 'PLANNED',
      notes: [],
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const note: TrainerNote = {
      id: `note-${Date.now()}`,
      text: noteText.trim(),
      authorId: user?.id ?? 'trainer',
      authorName: `${user?.firstName} ${user?.lastName}`,
      createdAt: new Date().toISOString(),
      sharedWithAthlete: noteShared,
    };
    setEntries((prev) =>
      prev.map((e) =>
        e.id === noteModal.entryId ? { ...e, notes: [...e.notes, note] } : e
      )
    );
    setNoteText('');
    setNoteModal({ visible: false, entryId: '' });
  };

  const existingCodes = entries
    .filter((e) => e.height === selectedHeight)
    .map((e) => e.diveCode);

  const renderEntry = (entry: AthleteTrainingEntry) => {
    const dive = getDiveDefinition(entry.diveCode);
    // DSGVO: Private Notizen für nicht-Trainer ausblenden
    const visibleNotes = isTrainer
      ? entry.notes
      : entry.notes.filter((n) => n.sharedWithAthlete);

    return (
      <View key={entry.id} style={styles.entryCard}>
        {/* Sprung-Header */}
        <View style={styles.entryHeader}>
          <View style={styles.codeChip}>
            <Text style={styles.codeText}>{entry.diveCode}</Text>
          </View>
          <View style={styles.entryTitle}>
            <Text style={styles.diveName} numberOfLines={1}>
              {dive ? (isDE ? dive.nameDe : dive.nameEn) : entry.diveCode}
            </Text>
            {dive && (
              <Text style={styles.groupName}>
                {DIVE_GROUP_NAMES[dive.groupNumber]?.[isDE ? 'de' : 'en']}
              </Text>
            )}
          </View>
          {isTrainer ? (
            <TouchableOpacity
              onPress={() => setStatusModal({ visible: true, entryId: entry.id, current: entry.status })}
              activeOpacity={0.7}
            >
              <StatusBadge status={entry.status} />
            </TouchableOpacity>
          ) : (
            <StatusBadge status={entry.status} />
          )}
        </View>

        {/* Notizen */}
        {visibleNotes.length > 0 && (
          <View style={styles.notesSection}>
            <Text style={styles.notesSectionTitle}>{t('trainingStatus.notes')}</Text>
            {visibleNotes.map((note) => (
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
          </View>
        )}

        {/* Trainer: Notiz hinzufügen Button */}
        {isTrainer && (
          <TouchableOpacity
            style={styles.addNoteBtn}
            onPress={() => setNoteModal({ visible: true, entryId: entry.id })}
          >
            <Text style={styles.addNoteBtnText}>+ {t('trainingStatus.addNote')}</Text>
          </TouchableOpacity>
        )}
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

      {/* Höhen-Auswahl */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.heightRow}
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

      {/* Sprung-Listen (nach Status gruppiert) */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {STATUSES.map((status) => {
          const group = grouped[status];
          if (group.length === 0) return null;
          const statusLabelKey = `trainingStatus.status${status.charAt(0) + status.slice(1).toLowerCase()}` as any;
          return (
            <View key={status}>
              <Text style={styles.sectionHeader}>{t(statusLabelKey)}</Text>
              {group.map(renderEntry)}
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
        onSelect={handleStatusChange}
        onClose={() => setStatusModal((s) => ({ ...s, visible: false }))}
      />

      <AddDiveModal
        visible={addDiveModal}
        height={selectedHeight}
        existingCodes={existingCodes}
        onAdd={handleAddDive}
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
  heightRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heightChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  heightChipLabelActive: { color: Colors.white },
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
  groupName: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  notesSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  notesSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
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
});
