import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/ui/Avatar';
import FilterChip from '../../components/ui/FilterChip';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import { AthleteListItem } from '../types/user';

import { useClubMembers } from '../../hooks/useDataStore';
import { dataStore } from '../../services/dataStore';

type FilterCategory = 'ALL' | 'YOUTH' | 'COMPETITIVE';

export default function TrainerScreen() {
  const { t } = useTranslation();
  const { user, activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const router = useRouter();

  const clubId = activeClubId || activeClubMembership?.clubId;
  const { members, unreadCounts, isLoading: isMembersLoading, refresh: refreshMembers } = useClubMembers(clubId);

  const [athletes, setAthletes] = useState<AthleteListItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  useEffect(() => {
    if (user && !isTrainerOrAdmin()) {
      router.replace('/(drawer)/training-status');
      return;
    }
  }, [user, isTrainerOrAdmin]);

  const syncAthletesFromMembers = useCallback(async () => {
    if (!members || members.length === 0) {
      setAthletes([]);
      return;
    }

    setIsProcessing(true);
    try {
      const athleteItems: AthleteListItem[] = await Promise.all(
        members.map(async (m) => {
          let age = 18;
          let firstName = m.userFullName?.split(' ')[0] || 'Athlete';
          let lastName = m.userFullName?.split(' ').slice(1).join(' ') || '';
          let masteredDiveCount = 0;

          // Try cached profile or fetch async
          let profile = dataStore.getUserProfile(m.userId);
          if (!profile) {
            profile = await dataStore.fetchUserProfileAsync(m.userId);
          }
          if (profile) {
            if (profile.firstName) firstName = profile.firstName;
            if (profile.lastName) lastName = profile.lastName;
            if (profile.age != null) age = profile.age;
          }

          // Get cached dive stats or fetch async
          const divesResult = dataStore.getAthleteDivesSnapshot(m.userId);
          if (divesResult.data.length > 0) {
            masteredDiveCount = divesResult.data.filter((d) => d.status === 'MASTERED').length;
          } else {
            const fetchedDives = await dataStore.fetchAthleteDivesAsync(m.userId);
            masteredDiveCount = fetchedDives.filter((d) => d.status === 'MASTERED').length;
          }

          const category: 'YOUTH' | 'COMPETITIVE' = age < 16 ? 'YOUTH' : 'COMPETITIVE';
          const unreadCount = Number(unreadCounts[m.userId] ?? unreadCounts[String(m.userId)] ?? 0);

          return {
            id: String(m.userId),
            firstName,
            lastName,
            age,
            category,
            masteredDiveCount,
            unreadCommentCount: unreadCount,
          };
        })
      );

      setAthletes(athleteItems);
    } catch (e) {
      console.warn('Failed to sync athletes from members:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [members, unreadCounts]);

  useEffect(() => {
    syncAthletesFromMembers();
  }, [syncAthletesFromMembers]);

  useFocusEffect(
    useCallback(() => {
      if (clubId) {
        refreshMembers();
      }
    }, [clubId, refreshMembers])
  );

  const isLoading = (isMembersLoading || isProcessing) && athletes.length === 0;

  const filteredAthletes = useMemo(() => {
    let list = athletes;
    if (activeFilter !== 'ALL') {
      list = list.filter((a) => a.category === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [athletes, searchQuery, activeFilter]);

  const filters: { key: FilterCategory; labelKey: string }[] = [
    { key: 'ALL', labelKey: 'trainer.filterAll' },
    { key: 'YOUTH', labelKey: 'trainer.filterYouth' },
    { key: 'COMPETITIVE', labelKey: 'trainer.filterCompetitive' },
  ];

  const handleAthletePress = (athlete: AthleteListItem) => {
    router.push({
      pathname: '/(drawer)/training-status',
      params: { athleteId: athlete.id, athleteName: `${athlete.firstName} ${athlete.lastName}` },
    });
  };

  const renderAthlete = ({ item }: { item: AthleteListItem }) => {
    const hasUnread = (item.unreadCommentCount ?? 0) > 0;

    return (
      <TouchableOpacity
        style={[styles.athleteCard, hasUnread && styles.athleteCardHighlight]}
        onPress={() => handleAthletePress(item)}
        activeOpacity={0.8}
      >
        <Avatar firstName={item.firstName} lastName={item.lastName} size={52} />
        <View style={styles.athleteInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.athleteName}>{item.firstName} {item.lastName}</Text>
          </View>
          <Text style={styles.athleteMeta}>
            {t('trainer.athleteCard.age', { age: item.age })}
            {' · '}
            {t('trainer.athleteCard.masteredCount', { count: item.masteredDiveCount })}
          </Text>
        </View>

        {/* Badges */}
        <View style={styles.badgesContainer}>
          {hasUnread && (
            <View style={styles.unreadCommentBadge}>
              <Text style={styles.unreadCommentIcon}>💬</Text>
              <Text style={styles.unreadCommentText}>
                {item.unreadCommentCount === 1
                  ? t('trainer.athleteCard.unreadCommentsSingle', '1 neu')
                  : t('trainer.athleteCard.unreadComments', { count: item.unreadCommentCount })}
              </Text>
            </View>
          )}

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {item.category === 'YOUTH' ? t('trainer.filterYouth') : t('trainer.filterCompetitive')}
            </Text>
          </View>
        </View>

        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Vereins-Header-Banner */}
      {activeClubMembership && (
        <View style={styles.clubBanner}>
          <Text style={styles.clubBannerLabel}>🏆</Text>
          <Text style={styles.clubBannerName}>{activeClubMembership.clubName}</Text>
        </View>
      )}

      {/* Suchleiste */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('trainer.searchPlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter-Chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <FilterChip
            key={f.key}
            label={t(f.labelKey)}
            selected={activeFilter === f.key}
            onPress={() => setActiveFilter(f.key)}
          />
        ))}
      </View>

      {/* Athleten-Liste */}
      <FlatList
        data={filteredAthletes}
        keyExtractor={(a) => a.id}
        renderItem={renderAthlete}
        contentContainerStyle={styles.listContent}
        refreshing={isMembersLoading}
        onRefresh={refreshMembers}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('trainer.noAthletes')}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  clubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  clubBannerLabel: { fontSize: FontSize.md },
  clubBannerName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  searchIcon: { fontSize: 16, marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  clearBtn: {
    padding: Spacing.sm,
  },
  clearBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  athleteCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.sm,
  },
  athleteCardHighlight: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#F59E0B',
  },
  athleteInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  athleteName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  athleteMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgesContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    marginRight: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  unreadCommentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    gap: 3,
  },
  unreadCommentIcon: {
    fontSize: 10,
  },
  unreadCommentText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#B45309',
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
  },
  separator: { height: Spacing.sm },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
});

