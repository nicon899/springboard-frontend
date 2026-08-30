import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

/**
 * (drawer)/index.tsx leitet basierend auf der Benutzerrolle weiter:
 * - Trainer / Admin -> Trainer-Dashboard
 * - Mitglied -> Trainingsstand
 * - Nicht eingeloggt -> Auth
 */
export default function DrawerIndex() {
  const { user, isTrainerOrAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(drawer)/auth" />;
  }

  if (isTrainerOrAdmin()) {
    return <Redirect href="/(drawer)/trainer" />;
  }

  return <Redirect href="/(drawer)/training-status" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});

