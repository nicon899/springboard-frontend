import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n, { LanguageCode, LANGUAGES } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/ui/Avatar';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout, activeClubMembership } = useAuth();

  if (!user) {
    return (
      <View style={styles.noUserContainer}>
        <Text style={styles.noUserText}>{t('auth.login')}</Text>
        <TouchableOpacity
          style={styles.goLoginBtn}
          onPress={() => router.push('/(drawer)/auth')}
        >
          <Text style={styles.goLoginBtnLabel}>{t('auth.loginButton')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleLanguageChange = (lang: LanguageCode) => {
    i18n.changeLanguage(lang);
  };

  const handleLogout = () => {
    Alert.alert(
      t('auth.logout'),
      t('auth.logoutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Navigation zu /auth erfolgt automatisch über AppGate in _layout.tsx
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profil-Header */}
      <View style={styles.profileHeader}>
        <Avatar firstName={user.firstName} lastName={user.lastName} size={80} />
        <Text style={styles.profileName}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.profileEmail}>{user.email}</Text>
        <View style={styles.globalRoleBadge}>
          <Text style={styles.globalRoleBadgeText}>
            {t(`profile.roles.${user.globalRole}`)}
          </Text>
        </View>
      </View>

      {/* Persönliche Daten */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.personalData')}</Text>
        <View style={styles.card}>
          <ProfileRow label={t('profile.name')} value={`${user.firstName} ${user.lastName}`} />
          <View style={styles.rowDivider} />
          <ProfileRow label={t('profile.email')} value={user.email} />
          {user.age && (
            <>
              <View style={styles.rowDivider} />
              <ProfileRow label={t('auth.age')} value={`${user.age} Jahre`} />
            </>
          )}
        </View>
      </View>

      {/* Vereinszugehörigkeiten */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.memberships')}</Text>
        {user.memberships.map((m) => (
          <View key={m.clubId} style={[styles.card, styles.membershipCard]}>
            <View style={styles.membershipLeft}>
              <Text style={styles.membershipClubName}>{m.clubName}</Text>
              <Text style={styles.membershipCity}>📍 {m.clubCity}</Text>
            </View>
            <View
              style={[
                styles.membershipRoleBadge,
                m.role === 'TRAINER' && styles.roleTrainer,
              ]}
            >
              <Text style={styles.membershipRoleText}>{t(`club.roles.${m.role}`)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Verknüpfte Athleten (für Eltern) */}
      {user.linkedAthleteIds && user.linkedAthleteIds.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.linkedAthletes')}</Text>
          {user.linkedAthleteIds.map((id) => (
            <TouchableOpacity
              key={id}
              style={[styles.card, styles.athleteLink]}
              onPress={() =>
                router.push({ pathname: '/(drawer)/training-status', params: { athleteId: id } })
              }
            >
              <Text style={styles.athleteLinkText}>{t('profile.viewTrainingStatus')}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sprachumschalter */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.languageLabel')}</Text>
        <View style={styles.languageRow}>
          {(Object.keys(LANGUAGES) as LanguageCode[]).map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageChip,
                i18n.language === lang && styles.languageChipActive,
              ]}
              onPress={() => handleLanguageChange(lang)}
            >
              <Text
                style={[
                  styles.languageChipLabel,
                  i18n.language === lang && styles.languageChipLabelActive,
                ]}
              >
                {LANGUAGES[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Abmelden */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnLabel}>🚪 {t('auth.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  noUserContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  noUserText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  goLoginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  goLoginBtnLabel: {
    color: Colors.white,
    fontWeight: FontWeight.semiBold,
    fontSize: FontSize.md,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  profileName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  profileEmail: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  globalRoleBadge: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  globalRoleBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  profileRowLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    width: 90,
  },
  profileRowValue: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  membershipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  membershipLeft: { flex: 1 },
  membershipClubName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
  },
  membershipCity: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  membershipRoleBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  roleTrainer: { backgroundColor: Colors.infoBg },
  roleAdmin: { backgroundColor: Colors.warningBg },
  membershipRoleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  athleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  athleteLinkText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  chevron: {
    fontSize: FontSize.xl,
    color: Colors.textTertiary,
  },
  languageRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  languageChip: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  languageChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  languageChipLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  languageChipLabelActive: { color: Colors.white },
  logoutBtn: {
    backgroundColor: Colors.errorBg,
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: BorderRadius.sm,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  logoutBtnLabel: {
    color: Colors.error,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
});
