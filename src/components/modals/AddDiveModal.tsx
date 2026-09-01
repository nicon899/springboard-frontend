import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DiveHeight, DiveStatus } from '../../app/types/dive';
import { DIVE_GROUP_NAMES } from '../../app/constants/diveData';
import { api, DiveExecutionResponse, BACKEND_TO_HEIGHT } from '../../services/api';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
  StatusBadgeStyles,
} from '../../app/constants/theme';

interface AddDiveModalProps {
  visible: boolean;
  height: DiveHeight;
  catalogExecutions?: DiveExecutionResponse[];
  existingExecutionIds?: number[];
  onAdd: (execution: DiveExecutionResponse, status: DiveStatus) => void;
  onAddMultiple?: (executions: DiveExecutionResponse[], status: DiveStatus) => void;
  onClose: () => void;
}

interface GroupedDive {
  code: string;
  groupNumber: number;
  nameDe: string;
  nameEn: string;
  executions: DiveExecutionResponse[];
}

const ALL_STATUSES: DiveStatus[] = ['PLANNED', 'LEARNING', 'MASTERED'];

export default function AddDiveModal({
  visible,
  height,
  catalogExecutions: initialCatalog,
  existingExecutionIds = [],
  onAdd,
  onAddMultiple,
  onClose,
}: AddDiveModalProps) {
  const { t, i18n } = useTranslation();
  const isDE = i18n.language === 'de';

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [multiAdd, setMultiAdd] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<DiveStatus>('PLANNED');
  const [selectedExecutions, setSelectedExecutions] = useState<Map<number, DiveExecutionResponse>>(new Map());
  const [catalog, setCatalog] = useState<DiveExecutionResponse[]>(initialCatalog || []);

  // Immer beim Öffnen des Modals alle Auswahl-Zustände garantiert zurücksetzen
  useEffect(() => {
    if (visible) {
      setMultiAdd(false);
      setSelectedExecutions(new Map());
      setSelectedStatus('PLANNED');
      setQuery('');
      setIsFocused(false);
    }
  }, [visible]);

  // Katalog laden
  useEffect(() => {
    if (initialCatalog && initialCatalog.length > 0) {
      setCatalog(initialCatalog);
      return;
    }
    let isMounted = true;
    async function loadCatalog() {
      try {
        const apiExecutions = await api.getAllDiveExecutions();
        if (isMounted && apiExecutions && apiExecutions.length > 0) {
          setCatalog(apiExecutions);
        }
      } catch (e) {
        console.warn('Failed to load dives from API in AddDiveModal:', e);
      }
    }
    if (visible) {
      loadCatalog();
    }
    return () => {
      isMounted = false;
    };
  }, [visible, initialCatalog]);

  const handleClose = useCallback(() => {
    setMultiAdd(false);
    setSelectedExecutions(new Map());
    setSelectedStatus('PLANNED');
    setQuery('');
    onClose();
  }, [onClose]);

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

  // Executions für die aktuelle Höhe gruppieren
  const groupedDives: GroupedDive[] = useMemo(() => {
    const map = new Map<string, GroupedDive>();

    for (const item of catalog) {
      const itemHeight = BACKEND_TO_HEIGHT[item.height];
      if (itemHeight !== height) continue;

      let group = map.get(item.diveCode);
      if (!group) {
        group = {
          code: item.diveCode,
          groupNumber: item.groupNumber || 1,
          nameDe: item.nameDe || item.diveCode,
          nameEn: item.nameEn || item.diveCode,
          executions: [],
        };
        map.set(item.diveCode, group);
      }
      group.executions.push(item);
    }

    // Positionen nach A, B, C, D sortieren
    for (const group of map.values()) {
      group.executions.sort((a, b) => (a.execution || '').localeCompare(b.execution || ''));
    }

    // Dives nach Code sortieren
    return Array.from(map.values()).sort((a, b) => {
      const numA = parseInt(a.code, 10);
      const numB = parseInt(b.code, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.code.localeCompare(b.code);
    });
  }, [catalog, height]);

  // Suchfilter anwenden
  const filteredDives = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedDives;

    const qClean = q.replace(/\s+/g, '');

    return groupedDives.filter((d) => {
      const matchBaseCode = d.code.toLowerCase().includes(q);
      const matchNameDe = d.nameDe.toLowerCase().includes(q);
      const matchNameEn = d.nameEn.toLowerCase().includes(q);
      const groupName = DIVE_GROUP_NAMES[d.groupNumber];
      const matchGroup =
        groupName?.de.toLowerCase().includes(q) || groupName?.en.toLowerCase().includes(q);

      const matchExecution = d.executions.some((exec) => {
        const fullCode = `${d.code}${exec.execution}`.toLowerCase();
        const posName = getPositionName(exec.execution).toLowerCase();
        return (
          fullCode.includes(qClean) ||
          `${d.code} ${exec.execution}`.toLowerCase().includes(q) ||
          posName.includes(q)
        );
      });

      return matchBaseCode || matchNameDe || matchNameEn || matchGroup || matchExecution;
    });
  }, [groupedDives, query, getPositionName]);

  const handlePressExecution = (exec: DiveExecutionResponse) => {
    if (existingExecutionIds.includes(exec.id)) return;

    if (multiAdd) {
      // Auswahl umschalten (hinzufügen / abwählen)
      setSelectedExecutions((prev) => {
        const next = new Map(prev);
        if (next.has(exec.id)) {
          next.delete(exec.id);
        } else {
          next.set(exec.id, exec);
        }
        return next;
      });
    } else {
      // Direkt einzeln hinzufügen & schließen
      onAdd(exec, selectedStatus);
      handleClose();
    }
  };

  const handleConfirmMultiAdd = () => {
    const list = Array.from(selectedExecutions.values());
    if (list.length === 0) return;

    if (onAddMultiple) {
      onAddMultiple(list, selectedStatus);
    } else {
      list.forEach((exec) => onAdd(exec, selectedStatus));
    }
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t('trainingStatus.addDiveTitle', 'Sprung hinzufügen')}</Text>
              <Text style={styles.subtitle}>
                {t('trainingStatus.heightLabel', 'Höhe')}: {height}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.closeLabel}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Steuerelemente: Status-Wahl & Mehrfachauswahl */}
          <View style={styles.controlsSection}>
            {/* Status-Auswahl */}
            <View style={styles.statusSelectRow}>
              <Text style={styles.sectionMiniLabel}>
                {t('trainingStatus.statusToAdd', 'Status')}:
              </Text>
              <View style={styles.statusChipsContainer}>
                {ALL_STATUSES.map((st) => {
                  const isSelected = selectedStatus === st;
                  const badge = StatusBadgeStyles[st];
                  const labelKey = `trainingStatus.status${st.charAt(0) + st.slice(1).toLowerCase()}`;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusChip,
                        isSelected && {
                          backgroundColor: badge.backgroundColor,
                          borderColor: badge.borderColor,
                        },
                      ]}
                      onPress={() => setSelectedStatus(st)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                      <Text
                        style={[
                          styles.statusChipText,
                          isSelected && { color: badge.color, fontWeight: FontWeight.bold },
                        ]}
                      >
                        {t(labelKey)}
                      </Text>
                      {isSelected && (
                        <Text style={[styles.statusChipCheck, { color: badge.color }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Mehrfachauswahl Toggle */}
            <View style={styles.multiAddBar}>
              <TouchableOpacity
                style={[styles.multiAddToggle, multiAdd && styles.multiAddToggleActive]}
                onPress={() => {
                  if (multiAdd) {
                    setSelectedExecutions(new Map());
                  }
                  setMultiAdd((v) => !v);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, multiAdd && styles.checkboxActive]}>
                  {multiAdd && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={[styles.multiAddLabel, multiAdd && styles.multiAddLabelActive]}>
                  {t('trainingStatus.multiSelect', 'Mehrere auswählen')}
                </Text>
              </TouchableOpacity>
              {multiAdd && (
                <View style={styles.addedCountBadge}>
                  <Text style={styles.addedCountText}>
                    {t('trainingStatus.selectedCount', {
                      count: selectedExecutions.size,
                      defaultValue: `${selectedExecutions.size} ausgewählt`,
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Suche */}
          <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
            <Text style={[styles.searchIcon, isFocused && styles.searchIconFocused]}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('routines.addDiveModal.searchPlaceholder', 'Sprungcode oder Name suchen (z. B. 103B, Auerbach…)')}
              placeholderTextColor={Colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery('')}
                style={styles.clearBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {query.trim().length > 0 && (
            <View style={styles.filterStatusRow}>
              <Text style={styles.filterStatusText}>
                {filteredDives.length === 1
                  ? isDE ? `${filteredDives.length} Sprung gefunden` : `${filteredDives.length} dive found`
                  : isDE ? `${filteredDives.length} Sprünge gefunden` : `${filteredDives.length} dives found`}
              </Text>
            </View>
          )}

          {/* Sprung-Liste */}
          {filteredDives.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t('trainingStatus.noCatalogDives', 'Keine weiteren Sprünge für diese Höhe im Katalog.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredDives}
              keyExtractor={(d) => d.code}
              renderItem={({ item }) => {
                const groupName = DIVE_GROUP_NAMES[item.groupNumber];
                return (
                  <View style={styles.diveCard}>
                    {/* Titel-Zeile */}
                    <View style={styles.diveCardHeader}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{item.code}</Text>
                      </View>
                      <View style={styles.diveInfo}>
                        <Text style={styles.diveName} numberOfLines={1}>
                          {isDE ? item.nameDe : item.nameEn}
                        </Text>
                        <Text style={styles.groupName}>
                          {groupName ? (isDE ? groupName.de : groupName.en) : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Ausführungsarten (A, B, C, D) Buttons */}
                    <View style={styles.executionsRow}>
                      {item.executions.map((exec) => {
                        const isAlreadyInPlan = existingExecutionIds.includes(exec.id);
                        const isSelected = selectedExecutions.has(exec.id);
                        const posName = getPositionName(exec.execution);
                        return (
                          <TouchableOpacity
                            key={exec.id}
                            style={[
                              styles.execButton,
                              isSelected && styles.execButtonSelected,
                              isAlreadyInPlan && styles.execButtonAdded,
                            ]}
                            disabled={isAlreadyInPlan}
                            onPress={() => handlePressExecution(exec)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.execTopRow}>
                              <Text
                                style={[
                                  styles.execCode,
                                  isSelected && styles.execCodeSelected,
                                  isAlreadyInPlan && styles.execCodeAdded,
                                ]}
                              >
                                {item.code}{exec.execution}
                              </Text>
                              {isAlreadyInPlan ? (
                                <Text style={styles.execCheck}>✓</Text>
                              ) : isSelected ? (
                                <Text style={styles.execCheckSelected}>✓</Text>
                              ) : (
                                <Text style={styles.execAdd}>+</Text>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.execPosName,
                                isSelected && styles.execPosNameSelected,
                                isAlreadyInPlan && styles.execPosNameAdded,
                              ]}
                              numberOfLines={1}
                            >
                              {posName}
                            </Text>
                            <View
                              style={[
                                styles.execDdBadge,
                                isSelected && styles.execDdBadgeSelected,
                                isAlreadyInPlan && styles.execDdBadgeAdded,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.execDdText,
                                  isSelected && styles.execDdTextSelected,
                                  isAlreadyInPlan && styles.execDdTextAdded,
                                ]}
                              >
                                {t('common.difficultyBadge', {
                                  dd: exec.degreeOfDifficulty?.toFixed(1),
                                })}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              }}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          )}

          {/* Footer-Button wenn Mehrfachauswahl aktiv */}
          {multiAdd && (
            <View style={styles.footerContainer}>
              <TouchableOpacity
                style={styles.cancelFooterBtn}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelFooterText}>
                  {t('common.cancel', 'Abbrechen')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmAddBtn,
                  selectedExecutions.size === 0 && styles.confirmAddBtnDisabled,
                ]}
                disabled={selectedExecutions.size === 0}
                onPress={handleConfirmMultiAdd}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmAddBtnText}>
                  {selectedExecutions.size > 0
                    ? t('trainingStatus.addSelectedDives', {
                        count: selectedExecutions.size,
                        defaultValue: `${selectedExecutions.size} Sprünge hinzufügen`,
                      })
                    : t('trainingStatus.addDiveTitle', 'Sprung hinzufügen')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '88%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeLabel: {
    fontSize: FontSize.xl,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },

  // ── Steuerelemente (Status & Multi-Select) ──
  controlsSection: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statusSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: 4,
    marginBottom: 4,
  },
  sectionMiniLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  statusChipCheck: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    marginLeft: 3,
  },
  multiAddBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  multiAddToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  multiAddToggleActive: {
    backgroundColor: 'transparent',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
    backgroundColor: Colors.surface,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxCheck: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    lineHeight: 12,
  },
  multiAddLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  multiAddLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  addedCountBadge: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addedCountText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Suchleiste ──
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.xs,
  },
  searchBoxFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
    opacity: 0.6,
  },
  searchIconFocused: {
    opacity: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    height: '100%',
    paddingVertical: 0,
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  clearBtnText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    lineHeight: 11,
  },
  filterStatusRow: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    marginBottom: Spacing.xs,
  },
  filterStatusText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  diveCard: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  diveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  codeBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    minWidth: 44,
    alignItems: 'center',
  },
  codeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  diveInfo: {
    flex: 1,
  },
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
  executionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 2,
  },
  execButton: {
    flex: 1,
    minWidth: 72,
    maxWidth: 110,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
  },
  execButtonSelected: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  execButtonAdded: {
    backgroundColor: Colors.background,
    borderColor: Colors.borderLight,
    opacity: 0.6,
  },
  execTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  execCode: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  execCodeSelected: {
    color: Colors.primaryDark,
  },
  execCodeAdded: {
    color: Colors.textTertiary,
  },
  execCheck: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.success,
  },
  execCheckSelected: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  execAdd: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  execPosName: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
    textAlign: 'center',
  },
  execPosNameSelected: {
    color: Colors.primaryDark,
    fontWeight: FontWeight.semiBold,
  },
  execPosNameAdded: {
    color: Colors.textTertiary,
  },
  execDdBadge: {
    marginTop: 3,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  execDdBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  execDdBadgeAdded: {
    backgroundColor: Colors.borderLight,
  },
  execDdText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  execDdTextSelected: {
    color: Colors.white,
  },
  execDdTextAdded: {
    color: Colors.textTertiary,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // ── Footer-Buttons (Mehrfachauswahl) ──
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelFooterBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelFooterText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  confirmAddBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  confirmAddBtnDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.7,
  },
  confirmAddBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
});
