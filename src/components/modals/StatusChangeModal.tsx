import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DiveStatus } from '../../app/types/dive';
import {
  BorderRadius,
  Colors,
  CommonStyles,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
  StatusBadgeStyles,
} from '../../app/constants/theme';

interface StatusChangeModalProps {
  visible: boolean;
  currentStatus: DiveStatus;
  onSelect: (status: DiveStatus) => void;
  onClose: () => void;
}

const ALL_STATUSES: DiveStatus[] = ['PLANNED', 'LEARNING', 'MASTERED'];

const STATUS_KEYS: Record<DiveStatus, string> = {
  PLANNED: 'trainingStatus.statusPlanned',
  LEARNING: 'trainingStatus.statusLearning',
  MASTERED: 'trainingStatus.statusMastered',
};

export default function StatusChangeModal({
  visible,
  currentStatus,
  onSelect,
  onClose,
}: StatusChangeModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{t('trainingStatus.selectStatus')}</Text>
          <View style={styles.divider} />
          {ALL_STATUSES.map((status) => {
            const badge = StatusBadgeStyles[status];
            const isSelected = status === currentStatus;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => onSelect(status)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: badge.color },
                  ]}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && { color: Colors.primary, fontWeight: FontWeight.semiBold },
                  ]}
                >
                  {t(STATUS_KEYS[status])}
                </Text>
                {isSelected && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...Shadows.lg,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  optionSelected: {
    backgroundColor: Colors.primarySurface,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  optionLabel: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  checkmark: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  cancelBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
