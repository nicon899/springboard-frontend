import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  RoutineSpecificationResponse,
  CreateRoutineSpecificationRequest,
  AgeCategoryResponse,
} from '../../services/api';

// ────────────────────────────────────────────────────────────
// Konstanten
// ────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  ALL: 'Alle',
  MALE: 'Männlich',
  FEMALE: 'Weiblich',
  DIVERSE: 'Divers',
};

const GENDER_OPTIONS: Array<'ALL' | 'MALE' | 'FEMALE' | 'DIVERSE'> = [
  'ALL',
  'MALE',
  'FEMALE',
  'DIVERSE',
];

// ────────────────────────────────────────────────────────────
// Form State
// ────────────────────────────────────────────────────────────

interface SpecFormData {
  name: string;
  numberOfDives: string;
  numberOfGroups: string;
  maxDifficultyScore: string;
  ageCategoryId: number | null;
  gender: 'ALL' | 'MALE' | 'FEMALE' | 'DIVERSE';
  juniorTableAllowed: boolean;
  beginner: boolean;
}

const EMPTY_FORM: SpecFormData = {
  name: '',
  numberOfDives: '',
  numberOfGroups: '',
  maxDifficultyScore: '',
  ageCategoryId: null,
  gender: 'ALL',
  juniorTableAllowed: false,
  beginner: false,
};

function specToForm(spec: RoutineSpecificationResponse): SpecFormData {
  return {
    name: spec.name ?? '',
    numberOfDives: spec.numberOfDives != null ? String(spec.numberOfDives) : '',
    numberOfGroups: spec.numberOfGroups != null ? String(spec.numberOfGroups) : '',
    maxDifficultyScore: spec.maxDifficultyScore != null ? String(spec.maxDifficultyScore) : '',
    ageCategoryId: spec.ageCategory?.id ?? null,
    gender: (spec.gender as any) ?? 'ALL',
    juniorTableAllowed: !!spec.juniorTableAllowed,
    beginner: !!spec.beginner,
  };
}

// ────────────────────────────────────────────────────────────
// Haupt-Screen
// ────────────────────────────────────────────────────────────

export default function RoutineSpecificationsScreen() {
  const router = useRouter();
  const { activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();

  const canEdit = isTrainerOrAdmin();
  const clubId = activeClubId;

  const [specs, setSpecs] = useState<RoutineSpecificationResponse[]>([]);
  const [ageCategories, setAgeCategories] = useState<AgeCategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSpec, setEditingSpec] = useState<RoutineSpecificationResponse | null>(null);
  const [form, setForm] = useState<SpecFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [ageCatDropdownOpen, setAgeCatDropdownOpen] = useState(false);

  // ── Daten laden ──
  const loadData = useCallback(async () => {
    if (!clubId) return;
    setIsLoading(true);
    try {
      const [specData, catData] = await Promise.all([
        api.getSpecificationsByClub(clubId).catch(() => [] as RoutineSpecificationResponse[]),
        api.getAgeCategoriesByClub(clubId).catch(() => [] as AgeCategoryResponse[]),
      ]);
      setSpecs(specData);
      setAgeCategories(catData);
    } catch (e: any) {
      console.warn('Failed to load specs:', e);
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Modal öffnen ──
  const openCreate = () => {
    setEditingSpec(null);
    setForm(EMPTY_FORM);
    setAgeCatDropdownOpen(false);
    setModalVisible(true);
  };

  const openEdit = (spec: RoutineSpecificationResponse) => {
    setEditingSpec(spec);
    setForm(specToForm(spec));
    setAgeCatDropdownOpen(false);
    setModalVisible(true);
  };

  // ── Speichern ──
  const handleSave = async () => {
    if (!clubId) return;
    setIsSaving(true);
    try {
      const payload: CreateRoutineSpecificationRequest = {
        clubId: Number(clubId),
        name: form.name || undefined,
        numberOfDives: form.numberOfDives ? Number(form.numberOfDives) : undefined,
        numberOfGroups: form.numberOfGroups ? Number(form.numberOfGroups) : undefined,
        maxDifficultyScore: form.maxDifficultyScore ? Number(form.maxDifficultyScore) : undefined,
        ageCategoryId: form.ageCategoryId ?? undefined,
        gender: form.gender,
        juniorTableAllowed: form.juniorTableAllowed,
        beginner: form.beginner,
      };

      if (editingSpec) {
        await api.updateRoutineSpecification(editingSpec.id, {
          name: payload.name,
          numberOfDives: payload.numberOfDives,
          numberOfGroups: payload.numberOfGroups,
          maxDifficultyScore: payload.maxDifficultyScore,
          ageCategoryId: payload.ageCategoryId,
          gender: payload.gender,
          juniorTableAllowed: payload.juniorTableAllowed,
          beginner: payload.beginner,
        });
      } else {
        await api.createRoutineSpecification(payload);
      }

      setModalVisible(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Löschen ──
  const handleDelete = (spec: RoutineSpecificationResponse) => {
    Alert.alert(
      'Serienspezifikation löschen',
      `„${spec.name || `Spezifikation #${spec.id}`}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteRoutineSpecification(spec.id);
              await loadData();
            } catch (e: any) {
              Alert.alert('Fehler', e?.message || 'Löschen fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  // ── Spec-Karte ──
  const renderSpec = (spec: RoutineSpecificationResponse) => (
    <View key={spec.id} style={styles.specCard}>
      <View style={styles.specHeader}>
        <View style={styles.specTitleRow}>
          <Text style={styles.specName}>{spec.name || `Spezifikation #${spec.id}`}</Text>
          {spec.beginner && (
            <View style={styles.beginnerBadge}>
              <Text style={styles.beginnerBadgeText}>Anfänger</Text>
            </View>
          )}
        </View>
        {canEdit && (
          <View style={styles.specActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => openEdit(spec)}
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, styles.iconBtnDanger]}
              onPress={() => handleDelete(spec)}
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.specMeta}>
        {spec.numberOfDives != null && (
          <MetaChip label="Sprünge" value={String(spec.numberOfDives)} />
        )}
        {spec.numberOfGroups != null && (
          <MetaChip label="Gruppen" value={String(spec.numberOfGroups)} />
        )}
        {spec.maxDifficultyScore != null && (
          <MetaChip label="Max. DD" value={spec.maxDifficultyScore.toFixed(1)} />
        )}
        {spec.gender && spec.gender !== 'ALL' && (
          <MetaChip label="Geschlecht" value={GENDER_LABELS[spec.gender] ?? spec.gender} />
        )}
        {spec.ageCategory && (
          <MetaChip label="Altersklasse" value={spec.ageCategory.name} highlight />
        )}
        {spec.juniorTableAllowed && (
          <View style={[styles.metaChip, styles.metaChipHighlight]}>
            <Text style={styles.metaChipHighlightText}>Juniortabelle</Text>
          </View>
        )}
      </View>
    </View>
  );

  // ── Altersklassen-Dropdown ──
  const selectedCat = ageCategories.find((c) => c.id === form.ageCategoryId);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Club-Banner */}
        <View style={styles.clubBanner}>
          <Text style={styles.clubBannerLabel}>Verein</Text>
          <Text style={styles.clubBannerName}>
            {activeClubMembership?.clubName ?? `Club #${clubId}`}
          </Text>
        </View>

        {/* Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {specs.length} {specs.length === 1 ? 'Spezifikation' : 'Spezifikationen'}
          </Text>
          {canEdit && (
            <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>+ Neu</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Lade Spezifikationen…</Text>
          </View>
        ) : specs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Keine Spezifikationen</Text>
            <Text style={styles.emptyText}>
              {canEdit
                ? 'Lege eine neue Serienspezifikation an.'
                : 'Es sind noch keine Spezifikationen vorhanden.'}
            </Text>
          </View>
        ) : (
          specs.map(renderSpec)
        )}
      </ScrollView>

      {/* ── Formular-Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {editingSpec ? 'Spezifikation bearbeiten' : 'Neue Serienspezifikation'}
              </Text>

              {/* Name */}
              <FormField label="Name">
                <TextInput
                  style={styles.input}
                  placeholder="z. B. Pflicht 2025 U14"
                  placeholderTextColor={Colors.textTertiary}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                />
              </FormField>

              {/* Sprünge & Gruppen */}
              <View style={styles.row2}>
                <FormField label="Anzahl Sprünge" style={styles.halfField}>
                  <TextInput
                    style={styles.input}
                    placeholder="z. B. 5"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    value={form.numberOfDives}
                    onChangeText={(v) => setForm((f) => ({ ...f, numberOfDives: v }))}
                  />
                </FormField>
                <FormField label="Anzahl Gruppen" style={styles.halfField}>
                  <TextInput
                    style={styles.input}
                    placeholder="z. B. 3"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="number-pad"
                    value={form.numberOfGroups}
                    onChangeText={(v) => setForm((f) => ({ ...f, numberOfGroups: v }))}
                  />
                </FormField>
              </View>

              {/* Max DD */}
              <FormField label="Max. Schwierigkeitsgrad (DD)">
                <TextInput
                  style={styles.input}
                  placeholder="z. B. 7.5"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={form.maxDifficultyScore}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxDifficultyScore: v }))}
                />
              </FormField>

              {/* Altersklasse-Dropdown */}
              <FormField label="Altersklasse">
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setAgeCatDropdownOpen((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownBtnText, !selectedCat && styles.dropdownPlaceholder]}>
                    {selectedCat ? selectedCat.name : 'Altersklasse wählen…'}
                  </Text>
                  <Text style={styles.dropdownChevron}>{ageCatDropdownOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {ageCatDropdownOpen && (
                  <View style={styles.dropdownList}>
                    <TouchableOpacity
                      style={[styles.dropdownItem, form.ageCategoryId === null && styles.dropdownItemActive]}
                      onPress={() => { setForm((f) => ({ ...f, ageCategoryId: null })); setAgeCatDropdownOpen(false); }}
                    >
                      <Text style={[styles.dropdownItemText, form.ageCategoryId === null && styles.dropdownItemTextActive]}>
                        Keine Altersklasse
                      </Text>
                    </TouchableOpacity>
                    {ageCategories.map((cat) => {
                      const currentYear = new Date().getFullYear();
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.dropdownItem, form.ageCategoryId === cat.id && styles.dropdownItemActive]}
                          onPress={() => { setForm((f) => ({ ...f, ageCategoryId: cat.id })); setAgeCatDropdownOpen(false); }}
                        >
                          <Text style={[styles.dropdownItemText, form.ageCategoryId === cat.id && styles.dropdownItemTextActive]}>
                            {cat.name}
                          </Text>
                          <Text style={styles.dropdownItemMeta}>
                            Jg. {currentYear - cat.fromYearOffset} – {currentYear - cat.toYearOffset}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {/* Link: Neue Altersklasse anlegen */}
                    <TouchableOpacity
                      style={styles.createLink}
                      onPress={() => {
                        setModalVisible(false);
                        router.push('/(drawer)/age-categories' as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.createLinkText}>＋ Neue Altersklasse anlegen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </FormField>

              {/* Geschlecht */}
              <FormField label="Geschlecht">
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderChip, form.gender === g && styles.genderChipActive]}
                      onPress={() => setForm((f) => ({ ...f, gender: g }))}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.genderChipLabel, form.gender === g && styles.genderChipLabelActive]}
                      >
                        {GENDER_LABELS[g]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormField>

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>Juniortabelle erlaubt</Text>
                  <Switch
                    value={form.juniorTableAllowed}
                    onValueChange={(v) => setForm((f) => ({ ...f, juniorTableAllowed: v }))}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
                <View style={styles.toggleItem}>
                  <Text style={styles.toggleLabel}>Anfänger</Text>
                  <Switch
                    value={form.beginner}
                    onValueChange={(v) => setForm((f) => ({ ...f, beginner: v }))}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnLabel}>Abbrechen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnLabel}>{isSaving ? 'Speichern…' : 'Speichern'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Kleine Hilfskomponenten
// ────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[{ marginBottom: Spacing.md }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function MetaChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return highlight ? (
    <View style={[styles.metaChip, styles.metaChipHighlight, { paddingVertical: Spacing.xs }]}>
      <Text style={styles.metaChipHighlightText}>🎂 {value}</Text>
    </View>
  ) : (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipLabel}>{label}</Text>
      <Text style={styles.metaChipValue}>{value}</Text>
    </View>
  );
}

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },

  clubBanner: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  clubBannerLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: FontWeight.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clubBannerName: {
    fontSize: FontSize.md,
    color: Colors.white,
    fontWeight: FontWeight.bold,
    flex: 1,
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

  specCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  specHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  specTitleRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  specName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  beginnerBadge: {
    backgroundColor: Colors.infoBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  beginnerBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.info,
    fontWeight: FontWeight.semiBold,
  },
  specActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
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

  specMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metaChip: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
  },
  metaChipLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaChipValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  metaChipHighlight: {
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
  },
  metaChipHighlightText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
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
    maxHeight: '92%',
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
    marginBottom: Spacing.xs,
  },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  row2: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfField: { flex: 1 },

  // Dropdown
  dropdownBtn: {
    height: 46,
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
  dropdownChevron: { fontSize: 12, color: Colors.textTertiary },
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
  dropdownItemActive: { backgroundColor: Colors.primarySurface },
  dropdownItemText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: FontWeight.semiBold },
  dropdownItemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  createLink: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  createLinkText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  genderChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  genderChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderChipLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  genderChipLabelActive: { color: Colors.white, fontWeight: FontWeight.semiBold },

  // Toggles
  toggleRow: {
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },

  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
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
  cancelBtnLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
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
