import '../i18n'; // i18n-Initialisierung vor allem anderen
import React, { useEffect } from 'react';
import { Slot, SplashScreen, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from './constants/theme';

// Splash-Screen so lange anzeigen, bis Auth geladen ist
SplashScreen.preventAutoHideAsync();

/**
 * AppGate:
 * 1. Hält Splash-Screen bis Auth-State geladen ist.
 * 2. Navigiert nach Login/Logout automatisch zur richtigen Route.
 */
function AppGate() {
  const { isLoading, user, isTrainerOrAdmin } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync();

    const inDrawer = segments[0] === '(drawer)';
    const currentScreen = segments[1] as string | undefined;

    if (!user) {
      // Nicht eingeloggt → Auth-Screen
      if (currentScreen !== 'auth') {
        router.replace('/(drawer)/auth');
      }
      return;
    }

    // Eingeloggt und noch auf Auth-Screen oder Index → weiterleiten
    if (currentScreen === 'auth' || !inDrawer || !currentScreen || currentScreen === 'index') {
      if (isTrainerOrAdmin()) {
        router.replace('/(drawer)/trainer');
      } else {
        router.replace('/(drawer)/training-status');
      }
    }
  }, [isLoading, user, isTrainerOrAdmin, segments]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppGate />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
