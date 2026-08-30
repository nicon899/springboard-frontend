import React, { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  RoutineResponse,
  RoutineSpecificationResponse,
} from '../../services/api';

// ────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  ALL: 'Alle',
  MALE: 'Männlich',
  FEMALE: 'Weiblich',
  DIVERSE: 'Divers',
};

function SpecTag({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.specTag}>
      <Text style={styles.specTagLabel}>{label}</Text>
      <Text style={styles.specTagValue}>{value}</Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Haupt-Screen
// ────────────────────────────────────────────────────────────

export default function RoutinesScreen() {
  const router = useRouter();
  const { user, activeClubId, isTrainerOrAdmin } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();

  const canEdit = isTrainerOrAdmin();
  const targetUserId = params.athleteId ?? user?.id ?? '';
  const athleteLabel = params.athleteName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const [routines, setRoutines] = useState<RoutineResponse[]>([]);
  const [specs, setSpecs] = useState<RoutineSpecificationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // ── Daten laden ──
  const loadData = useCallback(async () => {
    if (!targetUserId || !activeClubId) return;
    setIsLoading(true);
    try {
      const [routineData, specData] = await Promise.all([
        api.getRoutinesByUser(targetUserId).catch(() => [] as RoutineResponse[]),
        api.getSpecificationsByClub(activeClubId).catch(() => [] as RoutineSpecificationResponse[]),
      ]);
      setRoutines(routineData);
      setSpecs(specData);
    } catch (e) {
      console.warn('Failed to load routines:', e);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, activeClubId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Routine anlegen ──
  const handleCreate = async () => {
    if (!targetUserId) return;
    setIsSaving(true);
    try {
      await api.createRoutine({
        userId: Number(targetUserId),
        specificationId: selectedSpecId ?? undefined,
        displayName: createDisplayName.trim() || undefined,
      });
      setCreateModalVisible(false);
      setSelectedSpecId(null);
      setCreateDisplayName('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Anlegen fehlgeschlagen');
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
      await api.updateRoutine(editingRoutine.id, {
        specificationId: editSpecId ?? undefined,
        displayName: editDisplayName.trim() || undefined,
      });
      setEditModalVisible(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Bearbeiten fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Routine löschen ──
  const handleDelete = (routine: RoutineResponse) => {
    Alert.alert(
      'Routine löschen',
      `Routine #${routine.index} wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRoutine(routine.id);
              await loadData();
            } catch (e: any) {
              Alert.alert('Fehler', e?.message || 'Löschen fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  // ── Routine-Karte ──
  const renderRoutine = (routine: RoutineResponse) => {
    const spec = routine.template;
    const diveCount = routine.diveExecutions?.length ?? 0;

    return (
      <View key={routine.id} style={styles.routineCard}>
        {/* Kopfzeile */}
        <View style={styles.routineHeader}>
          <View style={styles.routineIndexBadge}>
            <Text style={styles.routineIndexText}>#{routine.index}</Text>
          </View>
          <View style={styles.routineHeaderInfo}>
            <Text style={styles.routineTitle}>
              {routine.displayName || spec?.name || `Routine #${routine.index}`}
            </Text>
            {routine.displayName && spec?.name && (
              <Text style={styles.routineSpecName}>{spec.name}</Text>
            )}
            <Text style={styles.routineSubtitle}>
              {diveCount} {diveCount === 1 ? 'Sprung' : 'Sprünge'}
              {spec ? ` · max. ${spec.numberOfDives ?? '?'} möglich` : ''}
            </Text>
          </View>
          {canEdit && (
            <View style={styles.routineActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => openEdit(routine)}
                activeOpacity={0.7}
              >
                <Text style={styles.iconBtnText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnDanger]}
                onPress={() => handleDelete(routine)}
                activeOpacity={0.7}
              >
                <Text style={styles.iconBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Spezifikations-Details */}
        {spec && (
          <View style={styles.specDetails}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.specTagRow}>
                {spec.numberOfDives != null && (
                  <SpecTag label="Sprünge" value={String(spec.numberOfDives)} />
                )}
                {spec.numberOfGroups != null && (
                  <SpecTag label="Gruppen" value={String(spec.numberOfGroups)} />
                )}
                {spec.maxDifficultyScore != null && (
                  <SpecTag label="Max. DD" value={spec.maxDifficultyScore.toFixed(1)} />
                )}
                {spec.ageCategory && (
                  <SpecTag label="Altersklasse" value={spec.ageCategory.name} />
                )}
                {spec.gender && spec.gender !== 'ALL' && (
                  <SpecTag label="Geschlecht" value={GENDER_LABELS[spec.gender] ?? spec.gender} />
                )}
                {spec.beginner && (
                  <View style={[styles.specTag, styles.specTagHighlight]}>
                    <Text style={styles.specTagHighlightText}>Anfänger</Text>
                  </View>
                )}
                {spec.juniorTableAllowed && (
                  <View style={[styles.specTag, styles.specTagHighlight]}>
                    <Text style={styles.specTagHighlightText}>Juniortabelle</Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Sprung-Executions */}
        {diveCount > 0 && (
          <View style={styles.divesSection}>
            <Text style={styles.divesSectionTitle}>Sprünge in dieser Routine</Text>
            {routine.diveExecutions.map((de) => (
              <View key={de.id} style={styles.diveRow}>
                <View style={styles.diveCodeChip}>
                  <Text style={styles.diveCodeText}>{de.diveCode}</Text>
                </View>
                <View style={styles.diveInfo}>
                  <Text style={styles.diveName} numberOfLines={1}>
                    {de.nameDe}
                  </Text>
                  <Text style={styles.diveMeta}>
                    {de.execution} · DD {de.degreeOfDifficulty}
                  </Text>
                </View>
              </View>
            ))}
          </View>
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
            {selectedSpec ? selectedSpec.name || `Spezifikation #${selectedSpec.id}` : 'Spezifikation wählen…'}
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
                Keine Spezifikation
              </Text>
            </TouchableOpacity>
            {specs.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.dropdownItem, value === s.id && styles.dropdownItemActive]}
                onPress={() => { onSelect(s.id); onToggle(); }}
              >
                <Text style={[styles.dropdownItemText, value === s.id && styles.dropdownItemTextActive]}>
                  {s.name || `Spezifikation #${s.id}`}
                </Text>
                {(s.numberOfDives != null || s.maxDifficultyScore != null) && (
                  <Text style={styles.dropdownItemMeta}>
                    {[
                      s.numberOfDives != null ? `${s.numberOfDives} Sprünge` : null,
                      s.maxDifficultyScore != null ? `DD max. ${s.maxDifficultyScore}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            {/* Link: Neue Spezifikation anlegen */}
            <TouchableOpacity style={styles.createSpecLink} onPress={onCreateNew} activeOpacity={0.7}>
              <Text style={styles.createSpecLinkText}>＋ Neue Spezifikation anlegen</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            {routines.length} {routines.length === 1 ? 'Routine' : 'Routinen'}
          </Text>
          {canEdit && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setSelectedSpecId(null); setCreateModalVisible(true); }}
              activeOpacity={0.8}
            >
              <Text style={styles.addBtnText}>+ Neue Routine</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Lade Routinen…</Text>
          </View>
        ) : routines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Keine Routinen</Text>
            <Text style={styles.emptyText}>
              {canEdit ? 'Lege eine neue Routine an.' : 'Es sind noch keine Routinen vorhanden.'}
            </Text>
          </View>
        ) : (
          routines.map(renderRoutine)
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
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Neue Routine anlegen</Text>

            <Text style={styles.fieldLabel}>Anzeigename (optional)</Text>
            <TextInput
              style={[styles.dropdownBtn, { marginBottom: Spacing.md }]}
              placeholder="z. B. Wettkampf Pflicht 2025"
              placeholderTextColor={Colors.textTertiary}
              value={createDisplayName}
              onChangeText={setCreateDisplayName}
            />

            <Text style={styles.fieldLabel}>Serienspezifikation (optional)</Text>
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
                <Text style={styles.cancelBtnLabel}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleCreate}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnLabel}>{isSaving ? 'Anlegen…' : 'Anlegen'}</Text>
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
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              Routine #{editingRoutine?.index} bearbeiten
            </Text>

            <Text style={styles.fieldLabel}>Anzeigename</Text>
            <TextInput
              style={[styles.dropdownBtn, { marginBottom: Spacing.md }]}
              placeholder="z. B. Wettkampf Pflicht 2025"
              placeholderTextColor={Colors.textTertiary}
              value={editDisplayName}
              onChangeText={setEditDisplayName}
            />

            <Text style={styles.fieldLabel}>Serienspezifikation</Text>
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
                <Text style={styles.cancelBtnLabel}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                onPress={handleEdit}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnLabel}>{isSaving ? 'Speichern…' : 'Speichern'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  routineIndexBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  routineIndexText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  routineHeaderInfo: { flex: 1 },
  routineTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  routineSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
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
  specTagLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  specTagValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
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

  divesSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  divesSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  diveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  diveCodeChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    minWidth: 44,
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
  diveMeta: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
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

  // Modal
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
    marginBottom: Spacing.xl,
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
});
