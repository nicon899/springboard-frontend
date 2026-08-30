import React from 'react';
import { Drawer } from 'expo-router/drawer';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '../constants/theme';

// ────────────────────────────────────────────────────────────
// Drawer-Menü-Einträge
// ────────────────────────────────────────────────────────────
interface DrawerItem {
  route: string;
  labelKey: string;
  icon: string;
}

// ────────────────────────────────────────────────────────────
// Custom Drawer Content – kein @react-navigation/drawer Import
// ────────────────────────────────────────────────────────────
function CustomDrawerContent() {
  const { t } = useTranslation();
  const { user, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoggedIn = !!user;
  const trainerOrAdmin = isTrainerOrAdmin();

  const items: (DrawerItem & { visible: boolean })[] = [
    {
      route: '/(drawer)/dive-search',
      labelKey: 'nav.diveSearch',
      icon: '🔍',
      visible: true,
    },
    {
      route: '/(drawer)/auth',
      labelKey: 'nav.auth',
      icon: '🔐',
      visible: !isLoggedIn,
    },
    {
      route: '/(drawer)/trainer',
      labelKey: 'nav.trainer',
      icon: '👨‍🏫',
      visible: isLoggedIn && trainerOrAdmin,
    },
    {
      route: '/(drawer)/training-status',
      labelKey: 'nav.trainingStatus',
      icon: '📋',
      visible: isLoggedIn,
    },
    {
      route: '/(drawer)/club',
      labelKey: 'nav.club',
      icon: '🏆',
      visible: isLoggedIn,
    },
    {
      route: '/(drawer)/profile',
      labelKey: 'nav.profile',
      icon: '👤',
      visible: isLoggedIn,
    },
  ];

  const visibleItems = items.filter((i) => i.visible);

  return (
    <SafeAreaView style={styles.drawerSafe}>
      {/* App-Header */}
      <View style={styles.drawerHeader}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🏊</Text>
        </View>
        <Text style={styles.appName}>Springboard</Text>
        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.firstName} {user.lastName}
            </Text>
            {activeClubMembership && (
              <Text style={styles.clubName} numberOfLines={1}>
                {activeClubMembership.clubName}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Navigations-Items */}
      <ScrollView style={styles.itemsScroll} contentContainerStyle={styles.itemsContent}>
        {visibleItems.map((item) => {
          const isActive = pathname === item.route || pathname.startsWith(item.route + '/');
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.drawerItem, isActive && styles.drawerItemActive]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.drawerItemIcon}>{item.icon}</Text>
              <Text
                style={[styles.drawerItemLabel, isActive && styles.drawerItemLabelActive]}
              >
                {t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.drawerFooter}>
        <Text style={styles.footerText}>Springboard v1.0</Text>
      </View>
    </SafeAreaView>
  );
}

// ────────────────────────────────────────────────────────────
// Drawer Layout
// ────────────────────────────────────────────────────────────
export default function DrawerLayout() {
  const { t } = useTranslation();
  const { user, isTrainerOrAdmin } = useAuth();

  const isLoggedIn = !!user;
  const trainerOrAdmin = isTrainerOrAdmin();

  const commonScreenOptions = {
    headerStyle: { backgroundColor: Colors.primary },
    headerTintColor: Colors.textOnPrimary,
    headerTitleStyle: {
      fontWeight: FontWeight.semiBold as any,
      fontSize: FontSize.lg,
    },
    drawerStyle: { backgroundColor: Colors.drawerBackground, width: 280 },
  };

  return (
    <Drawer
      drawerContent={() => <CustomDrawerContent />}
      screenOptions={commonScreenOptions}
    >
      <Drawer.Screen
        name="dive-search"
        options={{ title: t('nav.diveSearch') }}
      />
      <Drawer.Screen
        name="auth"
        options={{
          title: t('nav.auth'),
          drawerItemStyle: isLoggedIn ? styles.hidden : undefined,
        }}
      />
      <Drawer.Screen
        name="trainer"
        options={{
          title: t('nav.trainer'),
          drawerItemStyle: !isLoggedIn || !trainerOrAdmin ? styles.hidden : undefined,
        }}
      />
      <Drawer.Screen
        name="training-status"
        options={{
          title: t('nav.trainingStatus'),
          drawerItemStyle: !isLoggedIn ? styles.hidden : undefined,
        }}
      />
      <Drawer.Screen
        name="club"
        options={{
          title: t('nav.club'),
          drawerItemStyle: !isLoggedIn ? styles.hidden : undefined,
        }}
      />
      <Drawer.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          drawerItemStyle: !isLoggedIn ? styles.hidden : undefined,
        }}
      />
      <Drawer.Screen
        name="routine-specifications"
        options={{
          title: t('nav.routineSpecifications', 'Serienspezifikationen'),
          drawerItemStyle: styles.hidden,
        }}
      />
      <Drawer.Screen
        name="routines"
        options={{
          title: t('nav.routines', 'Routinen'),
          drawerItemStyle: styles.hidden,
        }}
      />
      <Drawer.Screen
        name="age-categories"
        options={{
          title: t('nav.ageCategories', 'Altersklassen'),
          drawerItemStyle: styles.hidden,
        }}
      />
      <Drawer.Screen
        name="index"
        options={{ drawerItemStyle: styles.hidden, title: '' }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  hidden: { height: 0, overflow: 'hidden', display: 'none' },
  // ── Custom Drawer ──
  drawerSafe: {
    flex: 1,
    backgroundColor: Colors.drawerBackground,
  },
  drawerHeader: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxl,
    alignItems: 'center',
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon: { fontSize: 28 },
  appName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    letterSpacing: -0.5,
  },
  userInfo: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.drawerTextActive,
  },
  clubName: {
    fontSize: FontSize.sm,
    color: Colors.drawerIcon,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.drawerBorder,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  itemsScroll: { flex: 1 },
  itemsContent: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  drawerItemActive: {
    backgroundColor: Colors.drawerActive,
  },
  drawerItemIcon: {
    fontSize: 18,
    marginRight: Spacing.md,
    width: 24,
    textAlign: 'center',
  },
  drawerItemLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.drawerText,
  },
  drawerItemLabelActive: {
    color: Colors.drawerTextActive,
    fontWeight: FontWeight.semiBold,
  },
  drawerFooter: {
    padding: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.drawerIcon,
    textAlign: 'center',
  },
});
