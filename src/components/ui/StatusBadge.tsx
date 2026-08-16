import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DiveStatus } from '../../app/types/dive';
import { BorderRadius, FontSize, FontWeight, StatusBadgeStyles, Spacing } from '../../app/constants/theme';

interface StatusBadgeProps {
  status: DiveStatus;
  labelDe?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_LABELS: Record<DiveStatus, string> = {
  PLANNED: 'Geplant',
  LEARNING: 'Im Aufbau',
  MASTERED: 'Sicher',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const badgeStyle = StatusBadgeStyles[status];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeStyle.backgroundColor,
          borderColor: badgeStyle.borderColor,
          paddingHorizontal: isSmall ? Spacing.sm : Spacing.md,
          paddingVertical: isSmall ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: badgeStyle.color,
            fontSize: isSmall ? FontSize.xs : FontSize.sm,
          },
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: FontWeight.semiBold,
    letterSpacing: 0.2,
  },
});
