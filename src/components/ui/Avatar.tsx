import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, FontWeight, BorderRadius } from '../../app/constants/theme';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: number;
  color?: string;
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % Colors.avatarColors.length;
  return Colors.avatarColors[index];
}

export default function Avatar({ firstName, lastName, size = 40, color }: AvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const bgColor = useMemo(
    () => color ?? hashColor(`${firstName}${lastName}`),
    [firstName, lastName, color]
  );
  const fontSize = size * 0.38;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
});
