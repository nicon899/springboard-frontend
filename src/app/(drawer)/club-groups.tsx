import React, { useState, useMemo } from 'react';
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
import { AthleteGroupResponse } from '../../services/api';
import { useClubAthleteGroups, useClubMembers, useClubAgeCategories } from '../../hooks/useDataStore';
import Avatar from '../../components/ui/Avatar';
import DropdownSelect, { DropdownOption } from '../../components/ui/DropdownSelect';
import ConfirmModal from '../../components/modals/ConfirmModal';
import { formatAgeCategoryRange } from '../../services/ageCategoryUtils';


export default function ClubGroupsScreen() {
  const { t } = useTranslation();
  const { activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const canManage = isTrainerOrAdmin();

  const clubIdNum = activeClubId ? Number(activeClubId) : (activeClubMembership?.clubId ? Number(activeClubMembership.clubId) : 0);
  const { groups, isLoading, createGroup, updateGroup, deleteGroup } = useClubAthleteGroups(clubIdNum);
  const { members } = useClubMembers(clubIdNum);
  const { categories: ageCategories } = useClubAgeCategories(clubIdNum);

  // Filter only CLUB_WIDE groups for this screen
  const clubWideGroups = useMemo(() => {
    return groups.filter((g) => g.scope === 'CLUB_WIDE');
  }, [groups]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AthleteGroupResponse | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<number[]>([]);
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal age/age-category filter state (multi-select)
  const [modalAgeCategoryFilter, setModalAgeCategoryFilter] = useState<string[]>([]);
  const [modalAgeFilter, setModalAgeFilter] = useState<string[]>([]);
  const [modalAgeCategoryDropdownOpen, setModalAgeCategoryDropdownOpen] = useState(false);
  const [modalAgeDropdownOpen, setModalAgeDropdownOpen] = useState(false);

  // Delete State
  const [groupToDelete, setGroupToDelete] = useState<AthleteGroupResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Open Create
  const openCreateModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setSelectedAthleteIds([]);
    setAthleteSearchQuery('');
    setModalAgeCategoryFilter([]);
    setModalAgeFilter([]);
    setErrorMessage(null);
    setModalVisible(true);
  };

  // Open Edit
  const openEditModal = (group: AthleteGroupResponse) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedAthleteIds([...group.athleteIds]);
    setAthleteSearchQuery('');
    setModalAgeCategoryFilter([]);
    setModalAgeFilter([]);
    setErrorMessage(null);
    setModalVisible(true);
  };

  // Toggle Athlete
  const toggleAthlete = (userId: number) => {
    setSelectedAthleteIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Age category options for modal
  const modalAgeCategoryOptions = useMemo((): DropdownOption[] => {
    return ageCategories.map((cat) => ({
      key: String(cat.id),
      label: cat.name,
      sublabel: formatAgeCategoryRange(cat),
    }));
  }, [ageCategories]);

  // Unique ages from members (via athleteIds group check won't work, use a rough set)
  // We'll build age options from members' profile ages stored in ageCategories ranges
  const modalAgeOptions = useMemo((): DropdownOption[] => {
    // Collect unique ages across all age categories min-max ranges
    const rangeAges: number[] = [];
    ageCategories.forEach((cat) => {
      const min = Math.min(cat.fromYearOffset, cat.toYearOffset);
      const max = Math.max(cat.fromYearOffset, cat.toYearOffset);
      for (let a = min; a <= max; a++) rangeAges.push(a);
    });
    const uniqueAges = [...new Set(rangeAges)].sort((a, b) => a - b);
    return uniqueAges.map((age) => ({
      key: String(age),
      label: `${age} Jahre`,
    }));
  }, [ageCategories]);

  // Filtered members for modal selector
  const filteredMembers = useMemo(() => {
    let list = members;

    // Text search
    if (athleteSearchQuery.trim()) {
      const q = athleteSearchQuery.toLowerCase();
      list = list.filter((m) =>
        m.userFullName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q)
      );
    }

    // Age category filter – we need athlete age data. Since club-groups doesn't have
    // an athletes array, we filter by matching each member against the group's member list
    // and their cached profile. For now, we pass through if no athlete data is available.
    // The filter by category name is still shown as a UX aid.
    // TODO: once member profiles are available here, filter by matchesAgeCategory.

    return list;
  }, [members, athleteSearchQuery]);

  // Select all / Deselect all
  const selectAll = () => {
    const allIds = members.map((m) => m.userId);
    setSelectedAthleteIds(allIds);
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredMembers.map((m) => m.userId);
    setSelectedAthleteIds((prev) => {
      const combined = new Set([...prev, ...filteredIds]);
      return Array.from(combined);
    });
  };

  const deselectAll = () => {
    setSelectedAthleteIds([]);
  };

  // Save Group
  const handleSave = async () => {
    if (!groupName.trim()) {
      setErrorMessage(t('groups.errorNameRequired', 'Gruppenname ist erforderlich'));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, {
          name: groupName.trim(),
          athleteIds: selectedAthleteIds,
        });
      } else {
        await createGroup({
          name: groupName.trim(),
          scope: 'CLUB_WIDE',
          athleteIds: selectedAthleteIds,
        });
      }
      setModalVisible(false);
    } catch (e: any) {
      setErrorMessage(e?.message || t('common.error', 'Fehler beim Speichern'));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Group
  const handleDelete = async () => {
    if (!groupToDelete) return;
    setIsDeleting(true);
    try {
      await deleteGroup(groupToDelete.id);
      setGroupToDelete(null);
    } catch (e: any) {
      console.warn('Failed to delete group:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Map member map for fast lookup
  const memberMap = useMemo(() => {
    const map = new Map<number, { name: string }>();
    members.forEach((m) => map.set(m.userId, { name: m.userFullName }));
    return map;
  }, [members]);


  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>{t('groups.clubWideTitle', 'Vereinsweite Gruppen')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('groups.clubWideSubtitle', 'Für alle Mitglieder im Verein sichtbar')}
          </Text>
        </View>
        {canManage && (
          <TouchableOpacity style={styles.createBtn} onPress={openCreateModal} activeOpacity={0.8}>
            <Text style={styles.createBtnText}>+ {t('groups.newGroup', 'Neue Gruppe')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Group List */}
      {isLoading && clubWideGroups.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : clubWideGroups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>{t('groups.noClubGroups', 'Keine vereinsweiten Gruppen')}</Text>
          <Text style={styles.emptyText}>
            {canManage
              ? t('groups.createFirstClubGroup', 'Erstelle die erste vereinsweite Gruppe für deinen Verein.')
              : t('groups.noClubGroupsText', 'In diesem Verein wurden noch keine Gruppen angelegt.')}
          </Text>
          {canManage && (
            <TouchableOpacity style={styles.emptyActionBtn} onPress={openCreateModal} activeOpacity={0.8}>
              <Text style={styles.emptyActionBtnText}>{t('groups.newGroup', 'Neue Gruppe anlegen')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={clubWideGroups}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const assignedMembers = item.athleteIds
              .map((id) => memberMap.get(id)?.name)
              .filter(Boolean) as string[];

            return (
              <View style={styles.groupCard}>
                <View style={styles.groupCardHeader}>
                  <View style={styles.groupTitleRow}>
                    <View style={styles.groupIconContainer}>
                      <Text style={styles.groupIconText}>🏆</Text>
                    </View>
                    <View style={styles.groupTitleInfo}>
                      <Text style={styles.groupName}>{item.name}</Text>
                      <Text style={styles.groupScopeBadge}>
                        {t('groups.scopeClubWide', 'Vereinsweit')} · {item.memberCount}{' '}
                        {item.memberCount === 1 ? t('groups.athleteSingle', 'Sportler') : t('groups.athletePlural', 'Sportler')}
                      </Text>
                    </View>
                  </View>

                  {canManage && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => openEditModal(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.iconBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => setGroupToDelete(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.iconBtnText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Assigned Athletes List */}
                <View style={styles.athletesBox}>
                  {assignedMembers.length > 0 ? (
                    <View style={styles.athleteChipsWrap}>
                      {assignedMembers.map((name, index) => (
                        <View key={index} style={styles.athleteChip}>
                          <Text style={styles.athleteChipText}>{name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noAthletesInGroup}>
                      {t('groups.noAthletesAssigned', 'Keine Sportler zugeordnet')}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Modal Create/Edit */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGroup
                  ? t('groups.editGroup', 'Gruppe bearbeiten')
                  : t('groups.createClubGroup', 'Neue vereinsweite Gruppe')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Name Input */}
            <Text style={styles.inputLabel}>{t('groups.nameLabel', 'Gruppenname')}</Text>
            <TextInput
              style={styles.textInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder={t('groups.namePlaceholder', 'z.B. Wettkampfteam A, Nachwuchs...')}
              placeholderTextColor={Colors.textTertiary}
              autoFocus={!editingGroup}
            />

            {/* Athletes Selector Header */}
            <View style={styles.selectorHeader}>
              <Text style={styles.inputLabel}>
                {t('groups.assignAthletes', 'Sportler zuordnen')} ({selectedAthleteIds.length})
              </Text>
              <View style={styles.quickSelectRow}>
                <TouchableOpacity onPress={selectAll} style={styles.quickSelectBtn}>
                  <Text style={styles.quickSelectText}>{t('groups.selectAll', 'Alle')}</Text>
                </TouchableOpacity>
                <Text style={styles.quickSelectDivider}>·</Text>
                <TouchableOpacity onPress={deselectAll} style={styles.quickSelectBtn}>
                  <Text style={styles.quickSelectText}>{t('groups.deselectAll', 'Keine')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Modal Filter Dropdowns: Altersklasse & Alter (Multi-Select) */}
            {ageCategories.length > 0 && (
              <View style={styles.modalFilterRow}>
                <DropdownSelect
                  label={t('groups.filterByAgeCategoryModal', 'Altersklasse')}
                  placeholder={t('groups.filterByAgeCategoryModalPlaceholder', 'Alle Altersklassen')}
                  options={modalAgeCategoryOptions}
                  selectedKeys={modalAgeCategoryFilter}
                  onSelectKeys={setModalAgeCategoryFilter}
                  open={modalAgeCategoryDropdownOpen}
                  onToggle={() => {
                    setModalAgeCategoryDropdownOpen((prev) => !prev);
                    setModalAgeDropdownOpen(false);
                  }}
                  allOptionLabel={t('common.all', 'Alle')}
                />
                <DropdownSelect
                  label={t('groups.filterByAgeModal', 'Alter')}
                  placeholder={t('groups.filterByAgeModalPlaceholder', 'Alle Alter')}
                  options={modalAgeOptions}
                  selectedKeys={modalAgeFilter}
                  onSelectKeys={setModalAgeFilter}
                  open={modalAgeDropdownOpen}
                  onToggle={() => {
                    setModalAgeDropdownOpen((prev) => !prev);
                    setModalAgeCategoryDropdownOpen(false);
                  }}
                  allOptionLabel={t('common.all', 'Alle')}
                />
              </View>
            )}

            {/* Athlete Search */}
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
              {filteredMembers.map((member) => {
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
                    <Avatar firstName={member.userFullName.split(' ')[0]} lastName={member.userFullName.split(' ')[1] || ''} size={36} />
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
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Abbrechen')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isSaving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.save', 'Speichern')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
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
        isLoading={isDeleting}
        onConfirm={handleDelete}
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
  headerBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  createBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.sm,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
  },
  separator: {
    height: Spacing.md,
  },
  groupCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  groupIconText: {
    fontSize: 20,
  },
  groupTitleInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  groupScopeBadge: {
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
  athletesBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  athleteChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  athleteChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  athleteChipText: {
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  noAthletesInGroup: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 300,
  },
  emptyActionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  emptyActionBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
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
  modalClose: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    padding: Spacing.xs,
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
    maxHeight: 260,
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
  modalFilterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    zIndex: 50,
  },
});
