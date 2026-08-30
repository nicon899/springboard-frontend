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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  BACKEND_TO_HEIGHT,
  DiveExecutionResponse,
  RoutineResponse,
  RoutineSpecificationResponse,
} from '../../services/api';
import { DIVE_GROUP_NAMES } from '../constants/diveData';
import Toast, { ToastMessage, ToastType } from '../../components/ui/Toast';

// ────────────────────────────────────────────────────────────
// Hilfsfunktionen & Konstanten
// ────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  ALL: 'Alle',
  MALE: 'Männlich',
  FEMALE: 'Weiblich',
  DIVERSE: 'Divers',
};

const POSITION_NAMES: Record<string, string> = {
  A: 'Gestreckt',
  B: 'Gehechtet',
  C: 'Gehockt',
  D: 'Frei',
};

const HEIGHT_FILTERS = ['ALL', '1m', '3m', '5m', '7.5m', '10m'] as const;

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
  const { t } = useTranslation();
  const { user, activeClubId, isTrainerOrAdmin } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();

  const canEdit = isTrainerOrAdmin();
  const targetUserId = params.athleteId ?? user?.id ?? '';
  const athleteLabel = params.athleteName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

  const getErrorMessage = useCallback((e: any) => parseErrorMessage(e, t), [t]);

  const [routines, setRoutines] = useState<RoutineResponse[]>([]);
  const [specs, setSpecs] = useState<RoutineSpecificationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastType = 'error') => {
    setToast({ message, type });
  };

  // Catalog executions for adding dives
  const [catalogExecutions, setCatalogExecutions] = useState<DiveExecutionResponse[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

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
  const [diveSearchQuery, setDiveSearchQuery] = useState('');
  const [selectedHeightFilter, setSelectedHeightFilter] = useState<string>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<number | null>(null);
  const [isAddingDiveId, setIsAddingDiveId] = useState<number | null>(null);

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
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, activeClubId, getErrorMessage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load catalog dives executions
  const loadCatalog = useCallback(async () => {
    if (catalogExecutions.length > 0) return;
    setIsCatalogLoading(true);
    try {
      const execs = await api.getAllDiveExecutions();
      setCatalogExecutions(execs || []);
    } catch (e) {
      console.warn('Failed to load dive catalog:', e);
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsCatalogLoading(false);
    }
  }, [catalogExecutions.length, getErrorMessage]);

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
      showToast('Routine erfolgreich angelegt', 'success');
      await loadData();
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
      await api.updateRoutine(editingRoutine.id, {
        specificationId: editSpecId ?? undefined,
        displayName: editDisplayName.trim() || undefined,
      });
      setEditModalVisible(false);
      showToast('Routine aktualisiert', 'success');
      await loadData();
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
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
              showToast(`Routine #${routine.index} gelöscht`, 'info');
              await loadData();
            } catch (e: any) {
              showToast(getErrorMessage(e), 'error');
            }
          },
        },
      ]
    );
  };

  // ── Sprung zu Routine hinzufügen ──
  const openAddDiveModal = (routine: RoutineResponse) => {
    setTargetRoutineForAdd(routine);
    setDiveSearchQuery('');
    // selectedHeightFilter bleibt erhalten (temporär für die Session)
    setSelectedGroupFilter(null);
    setAddDiveModalVisible(true);
    loadCatalog();
  };

  const handleAddDive = async (execution: DiveExecutionResponse) => {
    if (!targetRoutineForAdd) return;
    setIsAddingDiveId(execution.id);
    try {
      const updatedRoutine = await api.addDiveToRoutine(targetRoutineForAdd.id, {
        diveExecutionId: execution.id,
      });
      setRoutines((prev) =>
        prev.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r))
      );
      setTargetRoutineForAdd(updatedRoutine);
      setAddDiveModalVisible(false);
      showToast(`Sprung ${execution.diveCode}${execution.execution} hinzugefügt`, 'success');
    } catch (e: any) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setIsAddingDiveId(null);
    }
  };

  // ── Sprung aus Routine entfernen ──
  const handleRemoveDive = (routine: RoutineResponse, diveExecutionId: number, diveName: string) => {
    Alert.alert(
      'Sprung entfernen',
      `Möchtest du „${diveName}“ aus Routine #${routine.index} entfernen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedRoutine = await api.removeDiveFromRoutine(routine.id, diveExecutionId);
              setRoutines((prev) =>
                prev.map((r) => (r.id === updatedRoutine.id ? updatedRoutine : r))
              );
              showToast('Sprung entfernt', 'info');
            } catch (e: any) {
              showToast(getErrorMessage(e), 'error');
            }
          },
        },
      ]
    );
  };

  // ── Gefilterte Sprungvarianten für Modal ──
  const filteredCatalogExecutions = useMemo(() => {
    const q = diveSearchQuery.trim().toLowerCase();
    const qClean = q.replace(/\s+/g, '');
    return catalogExecutions.filter((item) => {
      // Suchbegriff
      if (q) {
        const fullCode = `${item.diveCode}${item.execution || ''}`.toLowerCase();
        const fullCodeWithSpace = `${item.diveCode} ${item.execution || ''}`.toLowerCase();
        const posName = POSITION_NAMES[item.execution]?.toLowerCase() || '';

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

      return true;
    });
  }, [catalogExecutions, diveSearchQuery, selectedHeightFilter, selectedGroupFilter]);

  // ── Routine-Karte ──
  const renderRoutine = (routine: RoutineResponse) => {
    const spec = routine.template;
    const diveCount = routine.diveExecutions?.length ?? 0;
    const totalDD = routine.diveExecutions?.reduce((sum, de) => sum + (de.degreeOfDifficulty || 0), 0) ?? 0;
    const distinctGroups = new Set(routine.diveExecutions?.map((de) => de.groupNumber)).size;

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
              {spec ? ` · max. ${spec.numberOfDives ?? '∞'} erlaubt` : ''}
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

        {/* Kennzahlen-Leiste */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Gesamt-DD</Text>
            <Text style={styles.statValue}>
              {totalDD.toFixed(1)}
              {spec?.maxDifficultyScore != null ? (
                <Text style={styles.statTarget}> / {spec.maxDifficultyScore.toFixed(1)}</Text>
              ) : null}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Gruppen</Text>
            <Text style={styles.statValue}>
              {distinctGroups}
              {spec?.numberOfGroups != null ? (
                <Text style={styles.statTarget}> / min. {spec.numberOfGroups}</Text>
              ) : null}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sprung-Anzahl</Text>
            <Text style={styles.statValue}>
              {diveCount}
              {spec?.numberOfDives != null ? (
                <Text style={styles.statTarget}> / {spec.numberOfDives}</Text>
              ) : null}
            </Text>
          </View>
        </View>

        {/* Sprünge in der Routine */}
        <View style={styles.divesSection}>
          <View style={styles.divesSectionHeader}>
            <Text style={styles.divesSectionTitle}>Sprünge in dieser Routine</Text>
            {canEdit && (
              <TouchableOpacity
                style={styles.addDiveInlineBtn}
                onPress={() => openAddDiveModal(routine)}
                activeOpacity={0.8}
              >
                <Text style={styles.addDiveInlineText}>+ Sprung hinzufügen</Text>
              </TouchableOpacity>
            )}
          </View>

          {diveCount === 0 ? (
            <View style={styles.emptyDivesContainer}>
              <Text style={styles.emptyDivesText}>Noch keine Sprünge in dieser Routine.</Text>
              {canEdit && (
                <TouchableOpacity
                  style={styles.addFirstDiveBtn}
                  onPress={() => openAddDiveModal(routine)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addFirstDiveBtnText}>+ Ersten Sprung hinzufügen</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            routine.diveExecutions.map((de, idx) => {
              const heightText = BACKEND_TO_HEIGHT[de.height] ?? de.height;
              const posLabel = POSITION_NAMES[de.execution] ?? de.execution;
              const groupName = DIVE_GROUP_NAMES[de.groupNumber]?.de ?? `Gr. ${de.groupNumber}`;

              return (
                <View key={`${de.id}-${idx}`} style={styles.diveRow}>
                  <View style={styles.diveIndexCircle}>
                    <Text style={styles.diveIndexText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.diveCodeChip}>
                    <Text style={styles.diveCodeText}>{de.diveCode}{de.execution}</Text>
                  </View>
                  <View style={styles.diveInfo}>
                    <Text style={styles.diveName} numberOfLines={1}>
                      {de.nameDe || de.nameEn || de.diveCode}
                    </Text>
                    <View style={styles.diveMetaRow}>
                      <Text style={styles.diveMetaBadge}>{heightText}</Text>
                      <Text style={styles.diveMetaBadge}>{posLabel}</Text>
                      <Text style={styles.diveMetaBadge}>DD {de.degreeOfDifficulty.toFixed(1)}</Text>
                      <Text style={styles.diveMetaText}>{groupName}</Text>
                    </View>
                  </View>
                  {canEdit && (
                    <TouchableOpacity
                      style={styles.removeDiveBtn}
                      onPress={() => handleRemoveDive(routine, de.id, `${de.diveCode}${de.execution} (${de.nameDe || ''})`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.removeDiveBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
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
            <TouchableOpacity style={styles.createSpecLink} onPress={onCreateNew} activeOpacity={0.7}>
              <Text style={styles.createSpecLinkText}>＋ Neue Spezifikation anlegen</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const isAnyModalOpen = createModalVisible || editModalVisible || addDiveModalVisible;

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
            <ActivityIndicator size="large" color={Colors.primary} />
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
          <Toast toast={toast} onDismiss={() => setToast(null)} />
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
          <Toast toast={toast} onDismiss={() => setToast(null)} />
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
                <Text style={styles.modalTitle}>Sprung hinzufügen</Text>
                <Text style={styles.addDiveSub}>
                  zu Routine #{targetRoutineForAdd?.index} {targetRoutineForAdd?.displayName ? `(${targetRoutineForAdd.displayName})` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setAddDiveModalVisible(false)}
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
                placeholder="Sprungcode oder Name suchen (z. B. 103B, Auerbach…)"
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
                        {h === 'ALL' ? 'Alle Höhen' : h}
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
                    Alle Gruppen
                  </Text>
                </TouchableOpacity>
                {[1, 2, 3, 4, 5, 6].map((grp) => {
                  const isActive = selectedGroupFilter === grp;
                  const grpName = DIVE_GROUP_NAMES[grp]?.de ?? `Gr. ${grp}`;
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

            {/* Trefferliste */}
            {isCatalogLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.emptyText}>Lade Sprungkatalog…</Text>
              </View>
            ) : filteredCatalogExecutions.length === 0 ? (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.emptyText}>Keine passenden Sprünge gefunden.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCatalogExecutions}
                keyExtractor={(item) => String(item.id)}
                style={styles.catalogList}
                contentContainerStyle={styles.catalogListContent}
                renderItem={({ item }) => {
                  const uiHeight = BACKEND_TO_HEIGHT[item.height] ?? item.height;
                  const posName = POSITION_NAMES[item.execution] ?? item.execution;
                  const isBeingAdded = isAddingDiveId === item.id;

                  return (
                    <TouchableOpacity
                      style={styles.catalogItemRow}
                      onPress={() => handleAddDive(item)}
                      disabled={isBeingAdded}
                      activeOpacity={0.7}
                    >
                      <View style={styles.catalogCodeBadge}>
                        <Text style={styles.catalogCodeText}>{item.diveCode}{item.execution}</Text>
                      </View>
                      <View style={styles.catalogInfo}>
                        <Text style={styles.catalogName} numberOfLines={1}>
                          {item.nameDe || item.nameEn || item.diveCode}
                        </Text>
                        <View style={styles.catalogMetaRow}>
                          <Text style={styles.catalogMetaBadge}>{uiHeight}</Text>
                          <Text style={styles.catalogMetaBadge}>{posName}</Text>
                          <Text style={styles.catalogMetaBadge}>DD {item.degreeOfDifficulty.toFixed(1)}</Text>
                          <Text style={styles.catalogMetaGroup}>
                            {DIVE_GROUP_NAMES[item.groupNumber]?.de ?? `Gr. ${item.groupNumber}`}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.catalogAddBtn}>
                        {isBeingAdded ? (
                          <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                          <Text style={styles.catalogAddBtnText}>＋</Text>
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
    marginBottom: Spacing.lg,
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
  statTarget: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.normal,
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
  catalogAddBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
});
