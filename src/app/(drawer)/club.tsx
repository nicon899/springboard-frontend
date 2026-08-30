import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import InviteModal from '../../components/modals/InviteModal';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import { ClubRole } from '../types/user';

import { api, ClubResponse } from '../../services/api';

const ROLE_COLORS: Record<ClubRole, string> = {
  CLUB_ADMIN: Colors.statusLearning,
  TRAINER: Colors.primary,
  MEMBER: Colors.textSecondary,
};

export default function ClubScreen() {
  const { t } = useTranslation();
  const { user, activeClubId, activeClubMembership, switchClub, canManageInvites, isTrainerOrAdmin } = useAuth();
  const router = useRouter();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [clubDetails, setClubDetails] = useState<ClubResponse | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const canManageSpecs = isTrainerOrAdmin();

  React.useEffect(() => {
    if (!activeClubId) return;
    let isMounted = true;

    async function loadClubData() {
      try {
        const club = await api.getClubById(activeClubId);
        if (isMounted) setClubDetails(club);
      } catch (e) {
        console.warn('Failed to load club details:', e);
      }

      try {
        const members = await api.getClubMembers(activeClubId);
        if (isMounted) setMemberCount(members.length);
      } catch (e) {
        // Permissions might restrict full member list for basic members
        if (isMounted) setMemberCount(null);
      }
    }

    loadClubData();
    return () => {
      isMounted = false;
    };
  }, [activeClubId]);

  if (!user || !activeClubId) {
    return (
      <View style={styles.noClubContainer}>
        <Text style={styles.noClubText}>{t('club.noClub')}</Text>
      </View>
    );
  }

  const canInvite = canManageInvites();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Vereins-Header-Karte */}
      <View style={styles.clubCard}>
        <View style={styles.clubIconWrapper}>
          <Text style={styles.clubIcon}>🏆</Text>
        </View>
        <View style={styles.clubInfo}>
          <Text style={styles.clubName}>{clubDetails?.name ?? activeClubMembership?.clubName}</Text>
          <Text style={styles.clubCity}>📍 {clubDetails?.city ?? activeClubMembership?.clubCity}</Text>
        </View>
      </View>

      {/* Stats-Zeile */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{memberCount != null ? memberCount : '—'}</Text>
          <Text style={styles.statLabel}>{t('club.members')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: ROLE_COLORS[activeClubMembership?.role ?? 'MEMBER'] }]}>
            {t(`club.roles.${activeClubMembership?.role ?? 'MEMBER'}`)}
          </Text>
          <Text style={styles.statLabel}>{t('club.yourRole')}</Text>
        </View>
      </View>

      {/* Vereinswechsler (wenn > 1 Verein) */}
      {user.memberships.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('club.switchClub')}</Text>
          {user.memberships.map((m) => (
            <TouchableOpacity
              key={m.clubId}
              style={[styles.clubSwitchItem, activeClubId === m.clubId && styles.clubSwitchItemActive]}
              onPress={() => switchClub(m.clubId)}
              activeOpacity={0.7}
            >
              <View style={styles.clubSwitchDot}>
                {activeClubId === m.clubId && <View style={styles.clubSwitchDotFill} />}
              </View>
              <View style={styles.clubSwitchInfo}>
                <Text style={[styles.clubSwitchName, activeClubId === m.clubId && styles.clubSwitchNameActive]}>
                  {m.clubName}
                </Text>
                <Text style={styles.clubSwitchRole}>{t(`club.roles.${m.role}`)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Serienspezifikationen (für Trainer & Admins) */}
      {canManageSpecs && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serienspezifikationen</Text>
          <TouchableOpacity
            style={styles.specsBtn}
            onPress={() => router.push('/(drawer)/routine-specifications' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.specsBtnIcon}>📋</Text>
            <View style={styles.specsBtnInfo}>
              <Text style={styles.specsBtnLabel}>Serienspezifikationen verwalten</Text>
              <Text style={styles.specsBtnSub}>Rahmenbedingungen für Routinen festlegen</Text>
            </View>
            <Text style={styles.specsBtnArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.specsBtn, { marginTop: Spacing.sm }]}
            onPress={() => router.push('/(drawer)/age-categories' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.specsBtnIcon}>🎂</Text>
            <View style={styles.specsBtnInfo}>
              <Text style={styles.specsBtnLabel}>Altersklassen verwalten</Text>
              <Text style={styles.specsBtnSub}>Jahrgangsbereiche für Spezifikationen</Text>
            </View>
            <Text style={styles.specsBtnArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Einladungs-Management */}
      {canInvite && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('club.inviteMember')}</Text>
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => setInviteModalVisible(true)}
          >
            <Text style={styles.inviteBtnIcon}>✉️</Text>
            <Text style={styles.inviteBtnLabel}>{t('club.inviteMember')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mitgliedschaft-Details */}
      {activeClubMembership && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('club.yourRole')}</Text>
          <View style={styles.membershipCard}>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: ROLE_COLORS[activeClubMembership.role] + '22' },
              ]}
            >
              <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[activeClubMembership.role] }]}>
                {t(`club.roles.${activeClubMembership.role}`)}
              </Text>
            </View>
            <Text style={styles.memberSince}>
              Mitglied seit {new Date(activeClubMembership.joinedAt).toLocaleDateString('de-DE', {
                year: 'numeric', month: 'long',
              })}
            </Text>
          </View>
        </View>
      )}

      {/* Einladungs-Modal */}
      <InviteModal
        visible={inviteModalVisible}
        clubId={activeClubId}
        onClose={() => setInviteModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  noClubContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  noClubText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
  clubCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  clubIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  clubIcon: { fontSize: 28 },
  clubInfo: { flex: 1 },
  clubName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  clubCity: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: { marginBottom: Spacing.xl },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  clubSwitchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  clubSwitchItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  clubSwitchDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  clubSwitchDotFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  clubSwitchInfo: { flex: 1 },
  clubSwitchName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  clubSwitchNameActive: { color: Colors.primary },
  clubSwitchRole: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  inviteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  inviteBtnIcon: { fontSize: 18 },
  inviteBtnLabel: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  membershipCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  roleBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  memberSince: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  specsBtn: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  specsBtnIcon: { fontSize: 22, marginRight: Spacing.md },
  specsBtnInfo: { flex: 1 },
  specsBtnLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  specsBtnSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  specsBtnArrow: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
});
