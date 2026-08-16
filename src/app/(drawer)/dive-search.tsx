import React, { useState, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { searchDives, DIVE_GROUP_NAMES } from '../constants/diveData';
import { DiveDefinition, DiveHeight, ExecutionPosition } from '../types/dive';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';

const HEIGHTS: DiveHeight[] = ['1m', '3m', '5m', '7.5m', '10m'];
const POSITIONS: ExecutionPosition[] = ['A', 'B', 'C', 'D'];

const POSITION_LABELS: Record<ExecutionPosition, { de: string; en: string }> = {
  A: { de: 'A – Gestreckt', en: 'A – Straight' },
  B: { de: 'B – Gehechtet', en: 'B – Pike' },
  C: { de: 'C – Gehockt', en: 'C – Tuck' },
  D: { de: 'D – Frei', en: 'D – Free' },
};

export default function DiveSearchScreen() {
  const { t, i18n } = useTranslation();
  const { user, isTrainerOrAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const isDE = i18n.language === 'de';
  const isTrainer = isTrainerOrAdmin();

  const results = useMemo(() => searchDives(query), [query]);
  const exactMatch: DiveDefinition | null = results.length === 1 ? results[0] : null;

  const statusMessage = useMemo(() => {
    if (!query.trim()) return t('diveSearch.waitingForInput');
    if (results.length === 0) return t('diveSearch.noResults');
    if (results.length > 1) return t('diveSearch.multipleResults');
    return null;
  }, [query, results.length, t]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Titel */}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{t('diveSearch.title')}</Text>
        <Text style={styles.subtitle}>{t('diveSearch.subtitle')}</Text>
      </View>

      {/* Suchfeld */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('diveSearch.searchPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status-Nachricht (kein / kein eindeutiger Treffer) */}
      {statusMessage && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      )}

      {/* Genau 1 Treffer: Detailansicht */}
      {exactMatch && (
        <View style={styles.resultCard}>
          {/* Sprung-Header */}
          <View style={styles.resultHeader}>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>{exactMatch.code}</Text>
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultName}>{isDE ? exactMatch.nameDe : exactMatch.nameEn}</Text>
              <Text style={styles.resultGroup}>
                {t('diveSearch.group')}: {DIVE_GROUP_NAMES[exactMatch.groupNumber]?.[isDE ? 'de' : 'en']}
              </Text>
            </View>
          </View>

          {/* DD-Matrix-Tabelle */}
          <View style={styles.matrixSection}>
            <Text style={styles.matrixTitle}>{t('diveSearch.difficultyMatrix')}</Text>
            <View style={styles.matrixTable}>
              {/* Kopfzeile */}
              <View style={styles.matrixRow}>
                <View style={[styles.matrixCell, styles.matrixHeaderCell, styles.positionCell]}>
                  <Text style={styles.matrixHeaderText}>{t('diveSearch.position')}</Text>
                </View>
                {HEIGHTS.map((h) => (
                  <View key={h} style={[styles.matrixCell, styles.matrixHeaderCell]}>
                    <Text style={styles.matrixHeaderText}>{h}</Text>
                  </View>
                ))}
              </View>
              {/* Daten-Zeilen */}
              {POSITIONS.map((pos, rowIdx) => {
                const posRow = exactMatch.difficulties[pos];
                const hasAnyValue = posRow && HEIGHTS.some((h) => posRow[h] != null);
                if (!hasAnyValue) return null;
                return (
                  <View key={pos} style={[styles.matrixRow, rowIdx % 2 === 0 && styles.matrixRowEven]}>
                    <View style={[styles.matrixCell, styles.positionCell]}>
                      <Text style={styles.positionLabel}>
                        {isDE ? POSITION_LABELS[pos].de : POSITION_LABELS[pos].en}
                      </Text>
                    </View>
                    {HEIGHTS.map((h) => {
                      const dd = posRow?.[h];
                      return (
                        <View key={h} style={styles.matrixCell}>
                          <Text
                            style={[styles.ddValue, dd == null && styles.ddEmpty]}
                          >
                            {dd != null ? dd.toFixed(1) : t('diveSearch.notAvailable')}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Trainer: Zum Trainingsplan hinzufügen */}
          {isTrainer && (
            <TouchableOpacity style={styles.addToplanBtn}>
              <Text style={styles.addToPlanLabel}>{t('diveSearch.addToTrainingPlan')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  titleBlock: { marginBottom: Spacing.lg },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    height: 52,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  clearBtn: { padding: Spacing.sm },
  clearBtnText: { fontSize: FontSize.sm, color: Colors.textTertiary },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  statusText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  codeBlock: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.md,
    minWidth: 56,
    alignItems: 'center',
  },
  codeText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  resultInfo: { flex: 1 },
  resultName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  resultGroup: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // Matrix
  matrixSection: { marginTop: Spacing.sm },
  matrixTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matrixTable: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  matrixRow: {
    flexDirection: 'row',
  },
  matrixRowEven: { backgroundColor: Colors.primarySurface },
  matrixCell: {
    flex: 1,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
    minHeight: 38,
  },
  matrixHeaderCell: {
    backgroundColor: Colors.primary,
  },
  positionCell: {
    flex: 1.8,
    alignItems: 'flex-start',
    paddingLeft: Spacing.sm,
  },
  matrixHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
  },
  positionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  ddValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  ddEmpty: {
    color: Colors.textTertiary,
    fontWeight: FontWeight.regular,
  },
  // CTA für Trainer
  addToplanBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.sm,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  addToPlanLabel: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
});
