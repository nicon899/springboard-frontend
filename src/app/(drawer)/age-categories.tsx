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
  AgeCategoryResponse,
  CreateAgeCategoryRequest,
} from '../../services/api';

// ────────────────────────────────────────────────────────────
// Form State
// ────────────────────────────────────────────────────────────

interface AgeCatForm {
  name: string;
  fromYear: string;
  toYear: string;
}

const EMPTY_FORM: AgeCatForm = {
  name: '',
  fromYear: '',
  toYear: '',
};

function catToForm(cat: AgeCategoryResponse): AgeCatForm {
  const currentYear = new Date().getFullYear();
  return {
    name: cat.name,
    fromYear: String(currentYear - cat.fromYearOffset),
    toYear: String(currentYear - cat.toYearOffset),
  };
}

// ────────────────────────────────────────────────────────────
// Haupt-Screen
// ────────────────────────────────────────────────────────────

export default function AgeCategoriesScreen() {
  const { activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();

  const canEdit = isTrainerOrAdmin();
  const clubId = activeClubId;

  const [categories, setCategories] = useState<AgeCategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState<AgeCategoryResponse | null>(null);
  const [form, setForm] = useState<AgeCatForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ── Daten laden ──
  const loadCategories = useCallback(async () => {
    if (!clubId) return;
    setIsLoading(true);
    try {
      const data = await api.getAgeCategoriesByClub(clubId);
      setCategories(data);
    } catch (e: any) {
      console.warn('Failed to load age categories:', e);
    } finally {
      setIsLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // ── Modal öffnen ──
  const openCreate = () => {
    setEditingCat(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (cat: AgeCategoryResponse) => {
    setEditingCat(cat);
    setForm(catToForm(cat));
    setModalVisible(true);
  };

  // ── Validierung ──
  const validate = (): string | null => {
    if (!form.name.trim()) return 'Name ist erforderlich';
    const fromY = Number(form.fromYear);
    const toY = Number(form.toYear);
    if (isNaN(fromY) || fromY < 1900 || fromY > 2100) return '„Von Jahrgang" muss eine gültige 4-stellige Jahreszahl sein (z. B. 2012)';
    if (isNaN(toY) || toY < 1900 || toY > 2100) return '„Bis Jahrgang" muss eine gültige 4-stellige Jahreszahl sein (z. B. 2016)';
    if (fromY > toY) return '„Von Jahrgang" muss kleiner oder gleich „Bis Jahrgang" sein (z. B. 2012 bis 2016)';
    return null;
  };

  // ── Speichern ──
  const handleSave = async () => {
    const error = validate();
    if (error) { Alert.alert('Ungültige Eingabe', error); return; }
    if (!clubId) return;

    setIsSaving(true);
    try {
      const currentYear = new Date().getFullYear();
      const fromY = Number(form.fromYear);
      const toY = Number(form.toYear);

      const fromYearOffset = currentYear - fromY;
      const toYearOffset = currentYear - toY;

      const payload = {
        name: form.name.trim(),
        fromYearOffset,
        toYearOffset,
      };

      if (editingCat) {
        await api.updateAgeCategory(editingCat.id, payload);
      } else {
        const createPayload: CreateAgeCategoryRequest = {
          clubId: Number(clubId),
          ...payload,
        };
        await api.createAgeCategory(createPayload);
      }

      setModalVisible(false);
      await loadCategories();
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Löschen ──
  const handleDelete = (cat: AgeCategoryResponse) => {
    Alert.alert(
      'Altersklasse löschen',
      `„${cat.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAgeCategory(cat.id);
              await loadCategories();
            } catch (e: any) {
              Alert.alert('Fehler', e?.message || 'Löschen fehlgeschlagen');
            }
          },
        },
      ]
    );
  };

  // ── Karte ──
  const renderCategory = (cat: AgeCategoryResponse) => {
    const currentYear = new Date().getFullYear();
    const fromYear = currentYear - cat.fromYearOffset;
    const toYear = currentYear - cat.toYearOffset;

    return (
      <View key={cat.id} style={styles.catCard}>
        <View style={styles.catHeader}>
          <View style={styles.catTitleRow}>
            <Text style={styles.catIcon}>🎂</Text>
            <Text style={styles.catName}>{cat.name}</Text>
          </View>
          {canEdit && (
            <View style={styles.catActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => openEdit(cat)}
                activeOpacity={0.7}
              >
                <Text style={styles.iconBtnText}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, styles.iconBtnDanger]}
                onPress={() => handleDelete(cat)}
                activeOpacity={0.7}
              >
                <Text style={styles.iconBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.catMeta}>
          <View style={styles.yearRange}>
            <View style={styles.yearBadge}>
              <Text style={styles.yearBadgeLabel}>Von Jg.</Text>
              <Text style={styles.yearBadgeValue}>{fromYear}</Text>
            </View>
            <Text style={styles.yearDivider}>–</Text>
            <View style={styles.yearBadge}>
              <Text style={styles.yearBadgeLabel}>Bis Jg.</Text>
              <Text style={styles.yearBadgeValue}>{toYear}</Text>
            </View>
          </View>

          <View style={styles.offsetInfo}>
            <Text style={styles.offsetText}>
              Offset: {cat.fromYearOffset} – {cat.toYearOffset} Jahre
            </Text>
          </View>
        </View>
      </View>
    );
  };

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

        {/* Erklärungsbox */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Altersklassen werden über Geburtsjahrgänge definiert. Das System berechnet die Offsets automatisch relativ zum aktuellen Jahr ({new Date().getFullYear()}).
          </Text>
        </View>

        {/* Header-Zeile */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            {categories.length} {categories.length === 1 ? 'Altersklasse' : 'Altersklassen'}
          </Text>
          {canEdit && (
            <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.8}>
              <Text style={styles.addBtnText}>+ Neu</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Lade Altersklassen…</Text>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎂</Text>
            <Text style={styles.emptyTitle}>Keine Altersklassen</Text>
            <Text style={styles.emptyText}>
              {canEdit
                ? 'Lege eine neue Altersklasse an.'
                : 'Es sind noch keine Altersklassen definiert.'}
            </Text>
          </View>
        ) : (
          categories.map(renderCategory)
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
            <Text style={styles.modalTitle}>
              {editingCat ? 'Altersklasse bearbeiten' : 'Neue Altersklasse'}
            </Text>

            {/* Name */}
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="z. B. U12, Jugend A, Junioren"
              placeholderTextColor={Colors.textTertiary}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            {/* Jahrgang-Felder */}
            <Text style={styles.fieldLabel}>Geburtsjahrgänge (z. B. 2012 bis 2016)</Text>
            <View style={styles.offsetRow}>
              <View style={styles.offsetField}>
                <Text style={styles.offsetFieldLabel}>Von Jahrgang *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="z. B. 2012"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={form.fromYear}
                  onChangeText={(v) => setForm((f) => ({ ...f, fromYear: v }))}
                />
                {form.fromYear && !isNaN(Number(form.fromYear)) && Number(form.fromYear) > 1900 ? (
                  <Text style={styles.yearPreview}>
                    Offset: {new Date().getFullYear() - Number(form.fromYear)} J.
                  </Text>
                ) : null}
              </View>

              <View style={styles.offsetDivider}>
                <Text style={styles.offsetDividerText}>–</Text>
              </View>

              <View style={styles.offsetField}>
                <Text style={styles.offsetFieldLabel}>Bis Jahrgang *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="z. B. 2016"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={form.toYear}
                  onChangeText={(v) => setForm((f) => ({ ...f, toYear: v }))}
                />
                {form.toYear && !isNaN(Number(form.toYear)) && Number(form.toYear) > 1900 ? (
                  <Text style={styles.yearPreview}>
                    Offset: {new Date().getFullYear() - Number(form.toYear)} J.
                  </Text>
                ) : null}
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

  clubBanner: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
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

  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.infoBg,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 16 },
  infoText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.info,
    lineHeight: 17,
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

  catCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  catTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  catIcon: { fontSize: 20 },
  catName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  catActions: {
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

  catMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yearRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  yearBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    minWidth: 72,
  },
  yearBadgeLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  yearBadgeValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  yearDivider: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  offsetInfo: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  offsetText: {
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
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    marginBottom: Spacing.md,
  },

  offsetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  offsetField: { flex: 1 },
  offsetFieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
  },
  offsetDivider: {
    paddingTop: 22,
    alignItems: 'center',
    width: 20,
  },
  offsetDividerText: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  yearPreview: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },

  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
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
