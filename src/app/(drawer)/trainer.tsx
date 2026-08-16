import React, { useState, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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

// ────────────────────────────────────────────────────────────
// MOCK-ATHLETEN-DATEN (TODO: replace with real API call)
// ────────────────────────────────────────────────────────────
const MOCK_ATHLETES: AthleteListItem[] = [
  { id: 'a1', firstName: 'Lena', lastName: 'Berger', age: 14, category: 'YOUTH', masteredDiveCount: 8 },
  { id: 'a2', firstName: 'Jonas', lastName: 'Müller', age: 17, category: 'COMPETITIVE', masteredDiveCount: 15 },
  { id: 'a3', firstName: 'Sophie', lastName: 'Hartmann', age: 12, category: 'YOUTH', masteredDiveCount: 5 },
  { id: 'a4', firstName: 'Felix', lastName: 'Schmidt', age: 19, category: 'COMPETITIVE', masteredDiveCount: 22 },
  { id: 'a5', firstName: 'Mia', lastName: 'Wagner', age: 15, category: 'YOUTH', masteredDiveCount: 11 },
  { id: 'a6', firstName: 'Tim', lastName: 'Fischer', age: 20, category: 'COMPETITIVE', masteredDiveCount: 30 },
];

type FilterCategory = 'ALL' | 'YOUTH' | 'COMPETITIVE';

export default function TrainerScreen() {
  const { t } = useTranslation();
  const { activeClubMembership } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');

  const filteredAthletes = useMemo(() => {
    let list = MOCK_ATHLETES;
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
  }, [searchQuery, activeFilter]);

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

  const renderAthlete = ({ item }: { item: AthleteListItem }) => (
    <TouchableOpacity
      style={styles.athleteCard}
      onPress={() => handleAthletePress(item)}
      activeOpacity={0.8}
    >
      <Avatar firstName={item.firstName} lastName={item.lastName} size={52} />
      <View style={styles.athleteInfo}>
        <Text style={styles.athleteName}>{item.firstName} {item.lastName}</Text>
        <Text style={styles.athleteMeta}>
          {t('trainer.athleteCard.age', { age: item.age })}
          {' · '}
          {t('trainer.athleteCard.masteredCount', { count: item.masteredDiveCount })}
        </Text>
      </View>
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>
          {item.category === 'YOUTH' ? t('trainer.filterYouth') : t('trainer.filterCompetitive')}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

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
  athleteInfo: {
    flex: 1,
    marginLeft: Spacing.md,
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
  categoryBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginRight: Spacing.sm,
  },
  categoryText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
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
