import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AthleteTrainingEntry, DiveHeight } from '../../app/types/dive';
import { DIVE_GROUP_NAMES } from '../../app/constants/diveData';
import {
  api,
  BACKEND_TO_HEIGHT,
  DiveExecutionResponse,
} from '../../services/api';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../../app/constants/theme';

interface AddCommentModalProps {
  visible: boolean;
  athleteId: string | number;
  athleteDives: AthleteTrainingEntry[];
  catalogExecutions?: DiveExecutionResponse[];
  initialDiveId?: string | number | null;
  onSave: (data: {
    content: string;
    sharedWithAthlete: boolean;
    athleteDiveStatusId?: number;
  }) => Promise<void>;
  onClose: () => void;
}

const HEIGHT_FILTERS: Array<DiveHeight | 'ALL'> = ['ALL', '1m', '3m', '5m', '7.5m', '10m'];

export default function AddCommentModal({
  visible,
  athleteId,
  athleteDives,
  catalogExecutions: initialCatalog,
  initialDiveId,
  onSave,
  onClose,
}: AddCommentModalProps) {
  const { t, i18n } = useTranslation();
  const isDE = i18n.language === 'de';

  const [content, setContent] = useState('');
  const [sharedWithAthlete, setSharedWithAthlete] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dive selection state
  const [selectedDiveStatusId, setSelectedDiveStatusId] = useState<string | null>(null);
  const [selectedCatalogExecution, setSelectedCatalogExecution] = useState<DiveExecutionResponse | null>(null);

  // Search & filter states
  const [diveSearchQuery, setDiveSearchQuery] = useState('');
  const [selectedHeightFilter, setSelectedHeightFilter] = useState<DiveHeight | 'ALL'>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<number | null>(null);
  const [onlyAthleteDivesFilter, setOnlyAthleteDivesFilter] = useState(false);
  const [showDivePicker, setShowDivePicker] = useState(false);

  const [catalog, setCatalog] = useState<DiveExecutionResponse[]>(initialCatalog || []);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // Load catalog executions if not provided
  useEffect(() => {
    if (initialCatalog && initialCatalog.length > 0) {
      setCatalog(initialCatalog);
      return;
    }
    if (visible && catalog.length === 0) {
      setIsCatalogLoading(true);
      api
        .getAllDiveExecutions()
        .then((res) => {
          if (res && res.length > 0) {
            setCatalog(res);
          }
        })
        .catch((e) => console.warn('Failed to load dive catalog:', e))
        .finally(() => setIsCatalogLoading(false));
    }
  }, [visible, initialCatalog, catalog.length]);

  // Set initial states when modal opens
  useEffect(() => {
    if (visible) {
      setContent('');
      setSharedWithAthlete(true);
      setDiveSearchQuery('');
      setSelectedHeightFilter('ALL');
      setSelectedGroupFilter(null);
      setOnlyAthleteDivesFilter(athleteDives.length > 0);
      setShowDivePicker(false);

      if (initialDiveId) {
        const found = athleteDives.find((d) => d.id === String(initialDiveId));
        if (found) {
          setSelectedDiveStatusId(found.id);
          setSelectedCatalogExecution(null);
        } else {
          setSelectedDiveStatusId(null);
          setSelectedCatalogExecution(null);
        }
      } else {
        setSelectedDiveStatusId(null);
        setSelectedCatalogExecution(null);
      }
    }
  }, [visible, initialDiveId, athleteDives]);

  // Map of athlete dive execution IDs to AthleteTrainingEntry
  const athleteExecutionMap = useMemo(() => {
    const map = new Map<number, AthleteTrainingEntry>();
    athleteDives.forEach((d) => {
      if (d.diveExecutionId) {
        map.set(d.diveExecutionId, d);
      }
    });
    return map;
  }, [athleteDives]);

  const athleteDiveExecutionIds = useMemo(() => {
    return new Set<number>(athleteDives.map((d) => d.diveExecutionId).filter((id): id is number => id != null));
  }, [athleteDives]);

  const getPositionName = useCallback((pos: string) => {
    switch (pos) {
      case 'A': return t('routines.positions.A', 'Gestreckt');
      case 'B': return t('routines.positions.B', 'Gehechtet');
      case 'C': return t('routines.positions.C', 'Gehockt');
      case 'D': return t('routines.positions.D', 'Frei');
      default: return pos;
    }
  }, [t]);

  const getGroupName = useCallback((grp?: number) => {
    if (!grp || !DIVE_GROUP_NAMES[grp]) return '';
    return isDE ? DIVE_GROUP_NAMES[grp].de : DIVE_GROUP_NAMES[grp].en;
  }, [isDE]);

  // Filtered catalog executions matching search, height, group, and athlete filter
  const filteredCatalogExecutions = useMemo(() => {
    const q = diveSearchQuery.trim().toLowerCase();
    const qClean = q.replace(/\s+/g, '');

    return catalog.filter((item) => {
      if (selectedHeightFilter !== 'ALL') {
        const itemHeight = BACKEND_TO_HEIGHT[item.height] ?? item.height;
        if (itemHeight !== selectedHeightFilter) return false;
      }

      if (selectedGroupFilter !== null && item.groupNumber !== selectedGroupFilter) {
        return false;
      }

      if (onlyAthleteDivesFilter && !athleteDiveExecutionIds.has(item.id)) {
        return false;
      }

      if (q) {
        const matchCode = item.diveCode.toLowerCase().includes(q);
        const fullCode = `${item.diveCode}${item.execution}`.toLowerCase();
        const matchFull = fullCode.includes(qClean) || `${item.diveCode} ${item.execution}`.toLowerCase().includes(q);
        const matchNameDe = (item.nameDe || '').toLowerCase().includes(q);
        const matchNameEn = (item.nameEn || '').toLowerCase().includes(q);
        const groupName = getGroupName(item.groupNumber).toLowerCase();
        const posName = getPositionName(item.execution).toLowerCase();

        return (
          matchCode ||
          matchFull ||
          matchNameDe ||
          matchNameEn ||
          groupName.includes(q) ||
          posName.includes(q)
        );
      }

      return true;
    });
  }, [
    catalog,
    diveSearchQuery,
    selectedHeightFilter,
    selectedGroupFilter,
    onlyAthleteDivesFilter,
    athleteDiveExecutionIds,
    getGroupName,
    getPositionName,
  ]);

  // Currently selected dive display data
  const currentSelectedDiveInfo = useMemo(() => {
    if (selectedDiveStatusId) {
      const entry = athleteDives.find((d) => d.id === selectedDiveStatusId);
      if (entry) {
        const posName = getPositionName(entry.execution);
        return {
          code: `${entry.diveCode}${entry.execution}`,
          height: entry.height,
          name: `${posName} · ${entry.height}`,
          dd: entry.degreeOfDifficulty ? `DD ${entry.degreeOfDifficulty.toFixed(1)}` : '',
          isAthleteDive: true,
        };
      }
    }
    if (selectedCatalogExecution) {
      const uiHeight = BACKEND_TO_HEIGHT[selectedCatalogExecution.height] ?? selectedCatalogExecution.height;
      const posName = getPositionName(selectedCatalogExecution.execution);
      const title = (isDE ? selectedCatalogExecution.nameDe : selectedCatalogExecution.nameEn) || selectedCatalogExecution.diveCode;
      return {
        code: `${selectedCatalogExecution.diveCode}${selectedCatalogExecution.execution}`,
        height: uiHeight,
        name: title,
        dd: selectedCatalogExecution.degreeOfDifficulty ? `DD ${selectedCatalogExecution.degreeOfDifficulty.toFixed(1)}` : '',
        isAthleteDive: athleteDiveExecutionIds.has(selectedCatalogExecution.id),
      };
    }
    return null;
  }, [
    selectedDiveStatusId,
    selectedCatalogExecution,
    athleteDives,
    isDE,
    getPositionName,
    athleteDiveExecutionIds,
  ]);

  const handleSelectExecution = (item: DiveExecutionResponse) => {
    const existingEntry = athleteExecutionMap.get(item.id);
    if (existingEntry) {
      setSelectedDiveStatusId(existingEntry.id);
      setSelectedCatalogExecution(null);
    } else {
      setSelectedDiveStatusId(null);
      setSelectedCatalogExecution(item);
    }
    setShowDivePicker(false);
  };

  const handleClearSelectedDive = () => {
    setSelectedDiveStatusId(null);
    setSelectedCatalogExecution(null);
    setShowDivePicker(false);
  };

  const handleSave = async () => {
    if (!content.trim() || isSaving) return;
    setIsSaving(true);
    try {
      let statusIdToUse: number | undefined = undefined;

      if (selectedDiveStatusId) {
        statusIdToUse = Number(selectedDiveStatusId);
      } else if (selectedCatalogExecution) {
        const statusRes = await api.updateAthleteDive(athleteId, {
          diveExecutionId: selectedCatalogExecution.id,
          status: 'PLANNED',
        });
        statusIdToUse = statusRes.id;
      }

      await onSave({
        content: content.trim(),
        sharedWithAthlete,
        athleteDiveStatusId: statusIdToUse,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ── HEADER ── */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              {showDivePicker ? (
                <TouchableOpacity
                  style={styles.pickerBackBtn}
                  onPress={() => setShowDivePicker(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerBackArrow}>‹</Text>
                  <Text style={styles.title}>
                    {t('routines.addDiveModal.title', 'Sprung auswählen')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.title}>
                    {t('trainingStatus.addCommentModalTitle', 'Neuer Kommentar')}
                  </Text>
                  <Text style={styles.subtitle}>
                    {currentSelectedDiveInfo
                      ? `${t('trainingStatus.diveSpecific', 'Sprungbezogen')}: ${currentSelectedDiveInfo.code} (${currentSelectedDiveInfo.height})`
                      : t('trainingStatus.generalCommentOption', 'Allgemeiner Kommentar')}
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeLabel}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── CONTENT SWITCHER ── */}
          {showDivePicker ? (
            /* ══════════════════════════════════════════════════════
               VIEW 2: SPRUNG AUSWÄHLEN (ROUTINEN STYLE)
               ══════════════════════════════════════════════════════ */
            <View style={styles.pickerContainer}>
              {/* Option: Allgemein setzen */}
              <TouchableOpacity
                style={styles.generalOptionRow}
                onPress={handleClearSelectedDive}
                activeOpacity={0.7}
              >
                <Text style={styles.generalOptionIcon}>💬</Text>
                <View style={styles.generalOptionTextCol}>
                  <Text style={styles.generalOptionTitle}>
                    {t('trainingStatus.generalCommentOption', 'Allgemeiner Kommentar (kein Sprung)')}
                  </Text>
                  <Text style={styles.generalOptionSub}>
                    {t('trainingStatus.noDiveSub', 'Nicht an einen spezifischen Sprung gebunden')}
                  </Text>
                </View>
                {!currentSelectedDiveInfo && (
                  <View style={styles.selectedCheckCircle}>
                    <Text style={styles.selectedCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Suchleiste */}
              <View style={styles.diveSearchBox}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.diveSearchInput}
                  placeholder={t(
                    'routines.addDiveModal.searchPlaceholder',
                    'Sprungcode oder Name suchen (z. B. 103B, Auerbach…)'
                  )}
                  placeholderTextColor={Colors.textTertiary}
                  value={diveSearchQuery}
                  onChangeText={setDiveSearchQuery}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {diveSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setDiveSearchQuery('')}
                    style={styles.searchClearBtn}
                  >
                    <Text style={styles.searchClearText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Höhen-Filter Chips */}
              <View style={styles.filterScrollWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipsRow}
                >
                  {HEIGHT_FILTERS.map((h) => {
                    const isActive = selectedHeightFilter === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                        onPress={() => setSelectedHeightFilter(h)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {h === 'ALL'
                            ? t('routines.addDiveModal.allHeights', 'Alle Höhen')
                            : h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Gruppen-Filter Chips */}
              <View style={styles.filterScrollWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipsRow}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      selectedGroupFilter === null && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedGroupFilter(null)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedGroupFilter === null && styles.filterChipTextActive,
                      ]}
                    >
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
                        <Text
                          style={[
                            styles.filterChipText,
                            isActive && styles.filterChipTextActive,
                          ]}
                        >
                          {grp}. {grpName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Sportler-Sprünge Toggle */}
              <View style={styles.validFilterSection}>
                <TouchableOpacity
                  style={[
                    styles.validFilterChip,
                    onlyAthleteDivesFilter && styles.athleteFilterChipActive,
                  ]}
                  onPress={() => setOnlyAthleteDivesFilter((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.validFilterChipIcon,
                      onlyAthleteDivesFilter && styles.athleteFilterChipIconActive,
                    ]}
                  >
                    👤
                  </Text>
                  <Text
                    style={[
                      styles.validFilterChipText,
                      onlyAthleteDivesFilter && styles.athleteFilterChipTextActive,
                    ]}
                  >
                    {t('routines.addDiveModal.onlyAthleteDivesFilter', 'Sportler-Sprünge')}
                  </Text>
                  <View
                    style={[
                      styles.validCountPill,
                      onlyAthleteDivesFilter && styles.athleteCountPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.validCountPillText,
                        onlyAthleteDivesFilter && styles.athleteCountPillTextActive,
                      ]}
                    >
                      {athleteDives.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Sprungliste */}
              {isCatalogLoading ? (
                <View style={styles.loadingCatalogBox}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.loadingCatalogText}>
                    {t('routines.addDiveModal.loadingCatalog', 'Lade Sprungkatalog…')}
                  </Text>
                </View>
              ) : filteredCatalogExecutions.length === 0 ? (
                <View style={styles.emptyCatalogBox}>
                  <Text style={styles.emptyCatalogText}>
                    {onlyAthleteDivesFilter
                      ? t(
                          'routines.addDiveModal.noAthleteDivesFound',
                          'Keine Sprünge des Sportlers für diese Filter gefunden.'
                        )
                      : t('routines.addDiveModal.noDivesFound', 'Keine passenden Sprünge gefunden.')}
                  </Text>
                  {onlyAthleteDivesFilter && (
                    <TouchableOpacity
                      style={styles.showAllCatalogBtn}
                      onPress={() => setOnlyAthleteDivesFilter(false)}
                    >
                      <Text style={styles.showAllCatalogBtnText}>
                        {t('routines.addDiveModal.showAllBtn', 'Alle Sprünge anzeigen')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <ScrollView
                  style={styles.pickerScrollList}
                  contentContainerStyle={styles.pickerScrollListContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredCatalogExecutions.map((item) => {
                    const uiHeight = BACKEND_TO_HEIGHT[item.height] ?? item.height;
                    const posName = getPositionName(item.execution);
                    const diveTitle =
                      (isDE ? item.nameDe : item.nameEn) || item.diveCode;
                    const isAthleteDive = athleteDiveExecutionIds.has(item.id);

                    const isSelected =
                      (selectedCatalogExecution && selectedCatalogExecution.id === item.id) ||
                      (selectedDiveStatusId && athleteExecutionMap.get(item.id)?.id === selectedDiveStatusId);

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.catalogItemRow,
                          isSelected && styles.catalogItemRowSelected,
                        ]}
                        onPress={() => handleSelectExecution(item)}
                        activeOpacity={0.7}
                      >
                        {/* Sprung-Code Chip im Original Dives/Routines Style */}
                        <View
                          style={[
                            styles.codeChip,
                            isSelected && styles.codeChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.codeText,
                              isSelected && styles.codeTextSelected,
                            ]}
                          >
                            {item.diveCode}{item.execution}
                          </Text>
                        </View>

                        <View style={styles.catalogInfo}>
                          <Text style={styles.catalogName} numberOfLines={1}>
                            {diveTitle}
                          </Text>
                          <View style={styles.catalogMetaRow}>
                            <Text style={styles.catalogMetaBadge}>{uiHeight}</Text>
                            <Text style={styles.catalogMetaBadge}>{posName}</Text>
                            <Text style={styles.catalogMetaBadge}>
                              DD {item.degreeOfDifficulty.toFixed(1)}
                            </Text>
                            <Text style={styles.catalogMetaGroup}>
                              {getGroupName(item.groupNumber)}
                            </Text>
                            {isAthleteDive && (
                              <View style={styles.athleteDiveBadge}>
                                <Text style={styles.athleteDiveBadgeText}>
                                  👤 Sportler
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <View style={styles.selectActionBox}>
                          {isSelected ? (
                            <View style={styles.selectedCheckCircle}>
                              <Text style={styles.selectedCheckText}>✓</Text>
                            </View>
                          ) : (
                            <Text style={styles.selectChevron}>›</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ══════════════════════════════════════════════════════
               VIEW 1: KOMMENTAR VERFASSEN (MAIN FORM)
               ══════════════════════════════════════════════════════ */
            <>
              <ScrollView
                style={styles.mainFormScroll}
                contentContainerStyle={styles.mainFormScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* ── Sprung-Zuordnung ── */}
                <Text style={styles.fieldLabel}>
                  {t('trainingStatus.selectDiveLabel', 'Sprung-Zuordnung')}
                </Text>

                {currentSelectedDiveInfo ? (
                  <View style={styles.selectedDiveCard}>
                    <View style={styles.selectedDiveLeft}>
                      {/* Sprungnummernbadge im einheitlichen Stil */}
                      <View style={styles.codeChip}>
                        <Text style={styles.codeText}>
                          {currentSelectedDiveInfo.code}
                        </Text>
                      </View>

                      <View style={styles.selectedDiveDetails}>
                        <Text style={styles.selectedDiveTitle} numberOfLines={1}>
                          {currentSelectedDiveInfo.name}
                        </Text>
                        <View style={styles.selectedDiveMetaRow}>
                          <Text style={styles.catalogMetaBadge}>{currentSelectedDiveInfo.height}</Text>
                          {!!currentSelectedDiveInfo.dd && (
                            <Text style={styles.catalogMetaBadge}>{currentSelectedDiveInfo.dd}</Text>
                          )}
                          {currentSelectedDiveInfo.isAthleteDive && (
                            <View style={styles.athleteDiveBadge}>
                              <Text style={styles.athleteDiveBadgeText}>👤 Sportler</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={styles.selectedDiveActions}>
                      <TouchableOpacity
                        style={styles.changeDiveBtn}
                        onPress={() => setShowDivePicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.changeDiveBtnText}>🔄 Ändern</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeDiveBtn}
                        onPress={handleClearSelectedDive}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeDiveBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noDiveCard}>
                    <View style={styles.noDiveLeft}>
                      <Text style={styles.noDiveIcon}>💬</Text>
                      <View style={styles.noDiveTextCol}>
                        <Text style={styles.noDiveTitle}>
                          {t('trainingStatus.generalCommentOption', 'Allgemeiner Kommentar')}
                        </Text>
                        <Text style={styles.noDiveSub}>
                          {t('trainingStatus.noDiveSub', 'Nicht an einen spezifischen Sprung gebunden')}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.pickDiveBtn}
                      onPress={() => setShowDivePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pickDiveBtnText}>+ Sprung wählen</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── Kommentar / Trainer-Notiz Textfeld ── */}
                <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>
                  {t('trainingStatus.notes', 'Trainer-Notiz')}
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={t(
                    'trainingStatus.commentContentPlaceholder',
                    'Kommentar oder Notiz eingeben...'
                  )}
                  placeholderTextColor={Colors.textTertiary}
                  value={content}
                  onChangeText={setContent}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {/* ── Sichtbarkeits-Toggle ("Für Sportler sichtbar") ── */}
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setSharedWithAthlete((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.toggle, sharedWithAthlete && styles.toggleOn]}>
                    <View
                      style={[
                        styles.toggleThumb,
                        sharedWithAthlete && styles.toggleThumbOn,
                      ]}
                    />
                  </View>
                  <View style={styles.toggleTextContainer}>
                    <Text style={styles.toggleTitle}>
                      {t('trainingStatus.sharedWithAthlete', 'Für Sportler sichtbar')}
                    </Text>
                    <Text style={styles.toggleSubtitle}>
                      {sharedWithAthlete
                        ? t('trainingStatus.sharedDesc', 'Der Sportler kann diesen Kommentar sehen')
                        : t('trainingStatus.privateDesc', 'Nur für Trainer und Administratoren sichtbar')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>

              {/* ── Footer Buttons ── */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={isSaving}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel', 'Abbrechen')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    (!content.trim() || isSaving) && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!content.trim() || isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('common.save', 'Speichern')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '92%',
    height: '85%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitleCol: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pickerBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pickerBackArrow: {
    fontSize: 26,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    lineHeight: 28,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeLabel: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },

  /* ── Main Form Scroll ── */
  mainFormScroll: {
    flex: 1,
  },
  mainFormScrollContent: {
    paddingBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },

  /* ── Dive Code Chip (Unified style matching Dives & Routines) ── */
  codeChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  codeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  codeTextSelected: {
    color: Colors.white,
  },

  /* ── Selected Dive Card ── */
  selectedDiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  selectedDiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  selectedDiveDetails: {
    flex: 1,
  },
  selectedDiveTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  selectedDiveMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  selectedDiveActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  changeDiveBtn: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  changeDiveBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  removeDiveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeDiveBtnText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },

  /* ── No Dive Card ── */
  noDiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  noDiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  noDiveIcon: {
    fontSize: 24,
  },
  noDiveTextCol: {
    flex: 1,
  },
  noDiveTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  noDiveSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pickDiveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  pickDiveBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },

  /* ── Comment Text Input ── */
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 90,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    backgroundColor: Colors.surfaceSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
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
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary,
  },
  cancelBtnText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  saveBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },

  /* ══════════════════════════════════════════════════════
     PICKER VIEW STYLES (MATCHING ROUTINES)
     ══════════════════════════════════════════════════════ */
  pickerContainer: {
    flex: 1,
  },
  generalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  generalOptionIcon: {
    fontSize: 20,
  },
  generalOptionTextCol: {
    flex: 1,
  },
  generalOptionTitle: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  generalOptionSub: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  diveSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  diveSearchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: Spacing.xs,
  },
  searchClearText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  filterScrollWrapper: {
    marginBottom: 4,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingBottom: 2,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  validFilterSection: {
    flexDirection: 'row',
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  validFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  athleteFilterChipActive: {
    backgroundColor: Colors.secondaryLight,
    borderColor: Colors.secondary,
  },
  validFilterChipIcon: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  athleteFilterChipIconActive: {
    color: Colors.secondaryDark,
  },
  validFilterChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  athleteFilterChipTextActive: {
    color: Colors.secondaryDark,
    fontWeight: FontWeight.bold,
  },
  validCountPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  athleteCountPillActive: {
    backgroundColor: Colors.surface,
  },
  validCountPillText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semiBold,
  },
  athleteCountPillTextActive: {
    color: Colors.secondaryDark,
  },

  loadingCatalogBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  loadingCatalogText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  emptyCatalogBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  emptyCatalogText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  showAllCatalogBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  showAllCatalogBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },

  pickerScrollList: {
    flex: 1,
  },
  pickerScrollListContent: {
    gap: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  catalogItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  catalogItemRowSelected: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  catalogInfo: {
    flex: 1,
  },
  catalogName: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  catalogMetaBadge: {
    fontSize: 10,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  catalogMetaGroup: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  athleteDiveBadge: {
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  athleteDiveBadgeText: {
    fontSize: 10,
    color: Colors.secondaryDark,
    fontWeight: FontWeight.medium,
  },
  selectActionBox: {
    paddingLeft: Spacing.xs,
  },
  selectedCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  selectChevron: {
    fontSize: 18,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
});
