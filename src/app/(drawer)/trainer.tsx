import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
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
import ConfirmModal from '../../components/modals/ConfirmModal';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import { AthleteListItem } from '../types/user';
import { AthleteGroupResponse } from '../../services/api';
import { useClubMembers, useClubAthleteGroups } from '../../hooks/useDataStore';
import { dataStore } from '../../services/dataStore';

export default function TrainerScreen() {
  const { t } = useTranslation();
  const { user, activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const router = useRouter();

  const clubId = activeClubId || activeClubMembership?.clubId;
  const clubIdNum = clubId ? Number(clubId) : 0;

  const { members, unreadCounts, isLoading: isMembersLoading, refresh: refreshMembers } = useClubMembers(clubId);
  const {
    groups,
    isLoading: isGroupsLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    refresh: refreshGroups,
  } = useClubAthleteGroups(clubIdNum);

  const [athletes, setAthletes] = useState<AthleteListItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Trainer Group Management Modal State
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [editGroupModalVisible, setEditGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AthleteGroupResponse | null>(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<number[]>([]);
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Group State
  const [groupToDelete, setGroupToDelete] = useState<AthleteGroupResponse | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  useEffect(() => {
    if (user && !isTrainerOrAdmin()) {
      router.replace('/(drawer)/training-status');
      return;
    }
  }, [user, isTrainerOrAdmin]);

  // Trainer groups created by current user
  const myTrainerGroups = useMemo(() => {
    return groups.filter((g) => g.scope === 'TRAINER');
  }, [groups]);

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
        refreshGroups();
      }
    }, [clubId, refreshMembers, refreshGroups])
  );

  // Filter athletes by group and search query
  const filteredAthletes = useMemo(() => {
    let list = athletes;

    if (activeFilter !== 'ALL') {
      const targetGroup = groups.find((g) => String(g.id) === activeFilter);
      if (targetGroup) {
        list = list.filter((a) => targetGroup.athleteIds.includes(Number(a.id)));
      }
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
  }, [athletes, searchQuery, activeFilter, groups]);

  // Dynamic filter chips: "Alle" + each group
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [
      { key: 'ALL', label: t('common.all', 'Alle') },
    ];

    groups.forEach((g) => {
      const prefix = g.scope === 'CLUB_WIDE' ? '🏆 ' : '👤 ';
      chips.push({
        key: String(g.id),
        label: `${prefix}${g.name} (${g.memberCount})`,
      });
    });

    return chips;
  }, [groups, t]);

  // Open Create Trainer Group Modal
  const openCreateTrainerGroup = () => {
    setEditingGroup(null);
    setGroupFormName('');
    setSelectedAthleteIds([]);
    setAthleteSearchQuery('');
    setFormError(null);
    setEditGroupModalVisible(true);
  };

  // Open Edit Trainer Group Modal
  const openEditTrainerGroup = (group: AthleteGroupResponse) => {
    setEditingGroup(group);
    setGroupFormName(group.name);
    setSelectedAthleteIds([...group.athleteIds]);
    setAthleteSearchQuery('');
    setFormError(null);
    setEditGroupModalVisible(true);
  };

  // Toggle Athlete Selection in Modal
  const toggleAthlete = (userId: number) => {
    setSelectedAthleteIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Filtered members for modal selector
  const filteredMembersForModal = useMemo(() => {
    if (!athleteSearchQuery.trim()) return members;
    const q = athleteSearchQuery.toLowerCase();
    return members.filter((m) =>
      m.userFullName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q)
    );
  }, [members, athleteSearchQuery]);

  // Save Trainer Group
  const handleSaveGroup = async () => {
    if (!groupFormName.trim()) {
      setFormError(t('groups.errorNameRequired', 'Gruppenname ist erforderlich'));
      return;
    }

    setIsSavingGroup(true);
    setFormError(null);
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, {
          name: groupFormName.trim(),
          athleteIds: selectedAthleteIds,
        });
      } else {
        await createGroup({
          name: groupFormName.trim(),
          scope: 'TRAINER',
          athleteIds: selectedAthleteIds,
        });
      }
      setEditGroupModalVisible(false);
    } catch (e: any) {
      setFormError(e?.message || t('common.error', 'Fehler beim Speichern'));
    } finally {
      setIsSavingGroup(false);
    }
  };

  // Delete Trainer Group
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    setIsDeletingGroup(true);
    try {
      await deleteGroup(groupToDelete.id);
      if (activeFilter === String(groupToDelete.id)) {
        setActiveFilter('ALL');
      }
      setGroupToDelete(null);
    } catch (e: any) {
      console.warn('Failed to delete group:', e);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const handleAthletePress = (athlete: AthleteListItem) => {
    router.push({
      pathname: '/(drawer)/training-status',
      params: { athleteId: athlete.id, athleteName: `${athlete.firstName} ${athlete.lastName}` },
    });
  };

  const renderAthlete = ({ item }: { item: AthleteListItem }) => {
    const hasUnread = (item.unreadCommentCount ?? 0) > 0;
    const athleteIdNum = Number(item.id);
    const athleteGroups = groups.filter((g) => g.athleteIds.includes(athleteIdNum));

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

          {/* Group Badges */}
          {athleteGroups.length > 0 && (
            <View style={styles.athleteGroupChipsRow}>
              {athleteGroups.map((g) => (
                <View
                  key={g.id}
                  style={[
                    styles.groupBadge,
                    g.scope === 'CLUB_WIDE' ? styles.groupBadgeClub : styles.groupBadgeTrainer,
                  ]}
                >
                  <Text
                    style={[
                      styles.groupBadgeText,
                      g.scope === 'CLUB_WIDE' ? styles.groupBadgeTextClub : styles.groupBadgeTextTrainer,
                    ]}
                    numberOfLines={1}
                  >
                    {g.scope === 'CLUB_WIDE' ? '🏆 ' : '👤 '}{g.name}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Right Badges */}
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

      {/* Top Action Bar: Search & "Meine Gruppen" Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('trainer.searchPlaceholder', 'Sportler suchen...')}
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

        <TouchableOpacity
          style={styles.manageGroupsBtn}
          onPress={() => setManageModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.manageGroupsBtnIcon}>👤</Text>
          <Text style={styles.manageGroupsBtnText}>
            {t('groups.myGroupsBtn', 'Meine Gruppen')}
            {myTrainerGroups.length > 0 ? ` (${myTrainerGroups.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Group Filter Chips (Horizontal Scroll) */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {filterChips.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              selected={activeFilter === f.key}
              onPress={() => setActiveFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Athleten-Liste */}
      <FlatList
        data={filteredAthletes}
        keyExtractor={(a) => a.id}
        renderItem={renderAthlete}
        contentContainerStyle={styles.listContent}
        refreshing={isMembersLoading}
        onRefresh={() => {
          refreshMembers();
          refreshGroups();
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery.trim() || activeFilter !== 'ALL'
                ? t('trainer.noMatchingAthletes', 'Keine passenden Sportler in dieser Gruppe gefunden.')
                : t('trainer.noAthletes', 'Keine Sportler vorhanden')}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Modal 1: Trainer Groups List Modal ("Meine Gruppen") */}
      <Modal
        visible={manageModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setManageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('groups.myTrainerGroups', 'Meine Trainergruppen')}</Text>
                <Text style={styles.modalSubtitle}>
                  {t('groups.trainerScopeHint', 'Nur für dich im Trainer-Dashboard sichtbar')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setManageModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {myTrainerGroups.length === 0 ? (
              <View style={styles.emptyTrainerGroupsBox}>
                <Text style={styles.emptyTrainerGroupsIcon}>👤</Text>
                <Text style={styles.emptyTrainerGroupsTitle}>
                  {t('groups.noTrainerGroupsYet', 'Noch keine Trainergruppen')}
                </Text>
                <Text style={styles.emptyTrainerGroupsText}>
                  {t(
                    'groups.createTrainerGroupHint',
                    'Erstelle persönliche Gruppen, um deine Trainingsgruppen schnell zu filtern.'
                  )}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.trainerGroupsList}>
                {myTrainerGroups.map((group) => (
                  <View key={group.id} style={styles.trainerGroupCard}>
                    <View style={styles.trainerGroupInfo}>
                      <Text style={styles.trainerGroupName}>{group.name}</Text>
                      <Text style={styles.trainerGroupMeta}>
                        {group.memberCount} {group.memberCount === 1 ? t('groups.athleteSingle', 'Sportler') : t('groups.athletePlural', 'Sportler')}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => openEditTrainerGroup(group)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.iconBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => setGroupToDelete(group)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.iconBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                style={styles.createTrainerGroupBtn}
                onPress={openCreateTrainerGroup}
                activeOpacity={0.8}
              >
                <Text style={styles.createTrainerGroupBtnText}>
                  + {t('groups.newTrainerGroup', 'Neue Trainergruppe erstellen')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Create / Edit Trainer Group */}
      <Modal
        visible={editGroupModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGroup
                  ? t('groups.editTrainerGroup', 'Trainergruppe bearbeiten')
                  : t('groups.createTrainerGroup', 'Neue Trainergruppe')}
              </Text>
              <TouchableOpacity onPress={() => setEditGroupModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            )}

            {/* Group Name Input */}
            <Text style={styles.inputLabel}>{t('groups.nameLabel', 'Gruppenname')}</Text>
            <TextInput
              style={styles.textInput}
              value={groupFormName}
              onChangeText={setGroupFormName}
              placeholder={t('groups.trainerNamePlaceholder', 'z.B. Meine Trainingsgruppe A...')}
              placeholderTextColor={Colors.textTertiary}
              autoFocus={!editingGroup}
            />

            {/* Athletes Selector Header */}
            <View style={styles.selectorHeader}>
              <Text style={styles.inputLabel}>
                {t('groups.assignAthletes', 'Sportler zuordnen')} ({selectedAthleteIds.length})
              </Text>
              <View style={styles.quickSelectRow}>
                <TouchableOpacity
                  onPress={() => setSelectedAthleteIds(members.map((m) => m.userId))}
                  style={styles.quickSelectBtn}
                >
                  <Text style={styles.quickSelectText}>{t('groups.selectAll', 'Alle')}</Text>
                </TouchableOpacity>
                <Text style={styles.quickSelectDivider}>·</Text>
                <TouchableOpacity
                  onPress={() => setSelectedAthleteIds([])}
                  style={styles.quickSelectBtn}
                >
                  <Text style={styles.quickSelectText}>{t('groups.deselectAll', 'Keine')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search within athletes */}
            <View style={styles.athleteSearchWrap}>
              <TextInput
                style={styles.athleteSearchInput}
                value={athleteSearchQuery}
                onChangeText={setAthleteSearchQuery}
                placeholder={t('groups.searchAthletes', 'Sportler suchen...')}
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            {/* Athlete Checklist */}
            <ScrollView style={styles.athletesScrollView}>
              {filteredMembersForModal.map((member) => {
                const isSelected = selectedAthleteIds.includes(member.userId);
                return (
                  <TouchableOpacity
                    key={member.userId}
                    style={[styles.memberItem, isSelected && styles.memberItemSelected]}
                    onPress={() => toggleAthlete(member.userId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkbox}>
                      {isSelected && <View style={styles.checkboxInner} />}
                    </View>
                    <Avatar
                      firstName={member.userFullName.split(' ')[0]}
                      lastName={member.userFullName.split(' ')[1] || ''}
                      size={36}
                    />
                    <View style={styles.memberItemInfo}>
                      <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>
                        {member.userFullName}
                      </Text>
                      <Text style={styles.memberRole}>{t(`club.roles.${member.clubRole}`)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditGroupModalVisible(false)}
                disabled={isSavingGroup}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSavingGroup && styles.btnDisabled]}
                onPress={handleSaveGroup}
                disabled={isSavingGroup}
              >
                {isSavingGroup ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.save', 'Speichern')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Group Confirm Modal */}
      <ConfirmModal
        visible={!!groupToDelete}
        title={t('groups.deleteTitle', 'Gruppe löschen')}
        message={t(
          'groups.deleteMessage',
          'Möchtest du die Gruppe „{{name}}“ wirklich löschen? Die Sportler bleiben im Verein erhalten.',
          { name: groupToDelete?.name || '' }
        )}
        confirmText={t('common.delete', 'Löschen')}
        cancelText={t('common.cancel', 'Abbrechen')}
        isLoading={isDeletingGroup}
        onConfirm={handleDeleteGroup}
        onCancel={() => setGroupToDelete(null)}
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
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    height: 44,
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
  manageGroupsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  manageGroupsBtnIcon: {
    fontSize: 16,
  },
  manageGroupsBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  filterSection: {
    paddingVertical: Spacing.sm,
  },
  filterScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xs,
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
  athleteGroupChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  groupBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupBadgeClub: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  groupBadgeTrainer: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  groupBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  groupBadgeTextClub: {
    color: Colors.primary,
  },
  groupBadgeTextTrainer: {
    color: '#7E22CE',
  },
  badgesContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    marginRight: Spacing.xs,
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
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    padding: Spacing.xs,
  },
  emptyTrainerGroupsBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTrainerGroupsIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  emptyTrainerGroupsTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyTrainerGroupsText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  trainerGroupsList: {
    maxHeight: 280,
    marginBottom: Spacing.md,
  },
  trainerGroupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  trainerGroupInfo: {
    flex: 1,
  },
  trainerGroupName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  trainerGroupMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    padding: Spacing.xs,
  },
  iconBtnText: {
    fontSize: 18,
  },
  modalFooterActions: {
    marginTop: Spacing.sm,
  },
  createTrainerGroupBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  createTrainerGroupBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: '#DC2626',
    fontSize: FontSize.xs,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickSelectBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  quickSelectText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  quickSelectDivider: {
    color: Colors.textTertiary,
  },
  athleteSearchWrap: {
    marginBottom: Spacing.sm,
  },
  athleteSearchInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  athletesScrollView: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  memberItemSelected: {
    backgroundColor: Colors.primarySurface,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  memberItemInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  memberNameSelected: {
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  memberRole: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
