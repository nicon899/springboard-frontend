import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
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
import { AthleteTrainingEntry, DiveHeight, DiveStatus } from '../types/dive';

import {
  api,
  BACKEND_TO_HEIGHT,
  AthleteDiveStatusResponse,
  RoutineResponse,
} from '../../services/api';

const HEIGHTS: DiveHeight[] = ['1m', '3m', '5m', '7.5m', '10m'];

export default function TrainingStatusScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const targetAthleteId = params.athleteId ?? user?.id ?? '';
  const viewingAthlete = params.athleteId && params.athleteId !== user?.id;
  const athleteLabel = params.athleteName ?? t('trainingStatus.myTraining');

  const [entries, setEntries] = useState<AthleteTrainingEntry[]>([]);
  const [routines, setRoutines] = useState<RoutineResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (refresh = false) => {
    if (!targetAthleteId) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [divesRes, routinesRes] = await Promise.all([
        api.getAthleteDives(targetAthleteId).catch(() => [] as AthleteDiveStatusResponse[]),
        api.getRoutinesByUser(targetAthleteId).catch(() => [] as RoutineResponse[]),
      ]);

      setRoutines(routinesRes);

      const mappedEntries: AthleteTrainingEntry[] = divesRes.map((d) => ({
        id: String(d.id),
        athleteId: String(d.athleteId),
        diveCode: d.diveCode,
        execution: d.execution,
        degreeOfDifficulty: d.degreeOfDifficulty,
        diveExecutionId: d.diveExecutionId,
        height: BACKEND_TO_HEIGHT[d.height] || '1m',
        status: d.status,
        learnedAt: d.learnedAt ?? null,
        notes: [],
      }));

      setEntries(mappedEntries);
    } catch (e: any) {
      console.warn('Failed to load training status overview data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetAthleteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set navigation header title
  useEffect(() => {
    navigation.setOptions({
      title: viewingAthlete ? `${athleteLabel} – ${t('trainingStatus.title')}` : t('trainingStatus.title'),
    });
  }, [navigation, viewingAthlete, athleteLabel, t]);

  // Calculations for stats
  const stats = useMemo(() => {
    const mastered = entries.filter((e) => e.status === 'MASTERED').length;
    const learning = entries.filter((e) => e.status === 'LEARNING').length;
    const planned = entries.filter((e) => e.status === 'PLANNED').length;
    const total = entries.length;

    const byHeight: Record<DiveHeight, { total: number; mastered: number; learning: number; planned: number }> = {
      '1m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '3m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '5m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '7.5m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '10m': { total: 0, mastered: 0, learning: 0, planned: 0 },
    };

    entries.forEach((e) => {
      if (byHeight[e.height]) {
        byHeight[e.height].total++;
        if (e.status === 'MASTERED') byHeight[e.height].mastered++;
        else if (e.status === 'LEARNING') byHeight[e.height].learning++;
        else if (e.status === 'PLANNED') byHeight[e.height].planned++;
      }
    });

    return { mastered, learning, planned, total, byHeight };
  }, [entries]);

  const navParams = useMemo(() => {
    return params.athleteId
      ? { athleteId: params.athleteId, athleteName: params.athleteName }
      : {};
  }, [params.athleteId, params.athleteName]);

  const navigateToDives = (height?: DiveHeight) => {
    router.push({
      pathname: '/(drawer)/dives',
      params: navParams,
    } as any);
  };

  const navigateToRoutines = () => {
    router.push({
      pathname: '/(drawer)/routines',
      params: navParams,
    } as any);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} />}
    >
      {/* Athleten-Label (wenn vom Trainer geöffnet) */}
      {viewingAthlete && (
        <View style={styles.athleteBanner}>
          <Text style={styles.athleteBannerText}>👤 {athleteLabel}</Text>
        </View>
      )}

      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          {/* Hauptbereiche Navigation (Cards) */}
          <View style={styles.cardsSection}>
            {/* Sprünge Unterseite Card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={() => navigateToDives()}
              activeOpacity={0.8}
            >
              <View style={styles.navCardHeader}>
                <View style={styles.navCardIconContainer}>
                  <Text style={styles.navCardIcon}>🏊</Text>
                </View>
                <View style={styles.navCardTitleCol}>
                  <Text style={styles.navCardTitle}>{t('trainingStatus.divesBannerTitle', 'Sprünge')}</Text>
                  <Text style={styles.navCardSubtitle}>
                    {t('trainingStatus.divesBannerSub', {
                      total: stats.total,
                      mastered: stats.mastered,
                    })}
                  </Text>
                </View>
                <Text style={styles.navCardArrow}>›</Text>
              </View>

              {/* Status Mini-Badges */}
              <View style={styles.navCardPillsRow}>
                <View style={[styles.miniPill, styles.miniPillMastered]}>
                  <Text style={styles.miniPillText}>
                    🟢 {stats.mastered} {t('trainingStatus.statsMastered', 'Sicher')}
                  </Text>
                </View>
                <View style={[styles.miniPill, styles.miniPillLearning]}>
                  <Text style={styles.miniPillText}>
                    🟡 {stats.learning} {t('trainingStatus.statsLearning', 'Im Aufbau')}
                  </Text>
                </View>
                <View style={[styles.miniPill, styles.miniPillPlanned]}>
                  <Text style={styles.miniPillText}>
                    ⚪ {stats.planned} {t('trainingStatus.statsPlanned', 'Geplant')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Serien / Routinen Unterseite Card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={navigateToRoutines}
              activeOpacity={0.8}
            >
              <View style={styles.navCardHeader}>
                <View style={[styles.navCardIconContainer, styles.navCardIconRoutines]}>
                  <Text style={styles.navCardIcon}>📋</Text>
                </View>
                <View style={styles.navCardTitleCol}>
                  <Text style={styles.navCardTitle}>{t('trainingStatus.routinesBannerTitle', 'Serien')}</Text>
                  <Text style={styles.navCardSubtitle}>
                    {t('trainingStatus.routinesBannerSub', {
                      count: routines.length,
                      defaultValue: `${routines.length} Serien vorhanden`,
                    })}
                  </Text>
                </View>
                <Text style={styles.navCardArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Statistik Übersicht */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              {t('trainingStatus.statsTitle', 'Statistik & Übersicht')}
            </Text>
          </View>

          {/* Stat-Kacheln Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statTile, styles.statTileMastered]}>
              <Text style={styles.statTileValue}>{stats.mastered}</Text>
              <Text style={styles.statTileLabel}>{t('trainingStatus.statsMastered', 'Sicher')}</Text>
            </View>
            <View style={[styles.statTile, styles.statTileLearning]}>
              <Text style={styles.statTileValue}>{stats.learning}</Text>
              <Text style={styles.statTileLabel}>{t('trainingStatus.statsLearning', 'Im Aufbau')}</Text>
            </View>
            <View style={[styles.statTile, styles.statTilePlanned]}>
              <Text style={styles.statTileValue}>{stats.planned}</Text>
              <Text style={styles.statTileLabel}>{t('trainingStatus.statsPlanned', 'Geplant')}</Text>
            </View>
            <View style={[styles.statTile, styles.statTileTotal]}>
              <Text style={styles.statTileValue}>{stats.total}</Text>
              <Text style={styles.statTileLabel}>{t('trainingStatus.statsTotal', 'Gesamt')}</Text>
            </View>
          </View>

          {/* Übersicht nach Höhen */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>
              {t('trainingStatus.heightOverviewTitle', 'Sprünge nach Höhe')}
            </Text>
          </View>

          <View style={styles.heightCardsList}>
            {HEIGHTS.map((h) => {
              const hStats = stats.byHeight[h];
              return (
                <TouchableOpacity
                  key={h}
                  style={styles.heightCard}
                  onPress={() => navigateToDives(h)}
                  activeOpacity={0.7}
                >
                  <View style={styles.heightChip}>
                    <Text style={styles.heightChipText}>{h}</Text>
                  </View>
                  <View style={styles.heightStatsRow}>
                    <Text style={styles.heightMasteredText}>
                      {hStats.mastered} {t('trainingStatus.statsMastered', 'sicher')}
                    </Text>
                    <Text style={styles.heightTotalText}>
                      / {hStats.total} {t('trainingStatus.statsTotal', 'gesamt')}
                    </Text>
                  </View>
                  <Text style={styles.heightCardArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  athleteBanner: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  athleteBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.primaryDark,
  },
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  cardsSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  navCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  navCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardIconRoutines: {
    backgroundColor: Colors.secondaryLight,
  },
  navCardIcon: {
    fontSize: 24,
  },
  navCardTitleCol: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  navCardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  navCardArrow: {
    fontSize: 22,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  navCardPillsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    flexWrap: 'wrap',
  },
  miniPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
  },
  miniPillMastered: {
    backgroundColor: '#E8F5E9',
  },
  miniPillLearning: {
    backgroundColor: '#FFF8E1',
  },
  miniPillPlanned: {
    backgroundColor: Colors.surfaceSecondary,
  },
  miniPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  sectionHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statTileMastered: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.success,
  },
  statTileLearning: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.warning,
  },
  statTilePlanned: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.border,
  },
  statTileTotal: {
    borderBottomWidth: 3,
    borderBottomColor: Colors.primary,
  },
  statTileValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statTileLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  heightCardsList: {
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  heightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  heightChip: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    minWidth: 42,
    alignItems: 'center',
  },
  heightChipText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  heightStatsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.md,
    gap: 4,
  },
  heightMasteredText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.success,
  },
  heightTotalText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  heightCardArrow: {
    fontSize: 18,
    color: Colors.textTertiary,
  },
});
