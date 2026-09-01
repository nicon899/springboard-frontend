import React, { useState, useEffect } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DiveStatus } from '../../app/types/dive';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
  StatusBadgeStyles,
} from '../../app/constants/theme';

interface StatusChangeModalProps {
  visible: boolean;
  currentStatus: DiveStatus;
  currentLearnedAt?: string | null;
  onSelect: (status: DiveStatus, learnedAt?: string | null) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const ALL_STATUSES: DiveStatus[] = ['PLANNED', 'LEARNING', 'MASTERED'];

const STATUS_KEYS: Record<DiveStatus, string> = {
  PLANNED: 'trainingStatus.statusPlanned',
  LEARNING: 'trainingStatus.statusLearning',
  MASTERED: 'trainingStatus.statusMastered',
};

function getTodayIsoString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Konvertiert YYYY-MM-DD nach DD.MM.YYYY (für DE) bzw. belässt es bei ISO */
function isoToLocal(isoDate: string | null | undefined, isDE: boolean): string {
  if (!isoDate) return '';
  const clean = isoDate.trim();
  const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    const padD = d.padStart(2, '0');
    const padM = m.padStart(2, '0');
    return isDE ? `${padD}.${padM}.${y}` : `${y}-${padM}-${padD}`;
  }
  return clean;
}

/** Konvertiert lokales Datumsformat (z. B. DD.MM.YYYY) in valides ISO YYYY-MM-DD */
function localToIso(localDate: string, isDE: boolean): string {
  const clean = localDate.trim();
  if (!clean) return getTodayIsoString();

  // Bereits YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD.MM.YYYY oder DD/MM/YYYY oder DD-MM-YYYY
  const parts = clean.split(/[./-]/);
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (d.length === 4) {
      [y, m, d] = [d, m, parts[2]];
    }
    if (y.length === 2) {
      y = '20' + y;
    }
    if (y.length === 4 && d && m) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return getTodayIsoString();
}

export default function StatusChangeModal({
  visible,
  currentStatus,
  currentLearnedAt,
  onSelect,
  onDelete,
  onClose,
}: StatusChangeModalProps) {
  const { t, i18n } = useTranslation();
  const isDE = i18n.language === 'de';

  const [selectedStatus, setSelectedStatus] = useState<DiveStatus>(currentStatus);
  const [displayDate, setDisplayDate] = useState<string>(
    isoToLocal(currentLearnedAt || getTodayIsoString(), isDE)
  );

  useEffect(() => {
    if (visible) {
      setSelectedStatus(currentStatus);
      setDisplayDate(isoToLocal(currentLearnedAt || getTodayIsoString(), isDE));
    }
  }, [visible, currentStatus, currentLearnedAt, isDE]);

  const handleSave = () => {
    if (selectedStatus === 'MASTERED') {
      const finalIsoDate = localToIso(displayDate, isDE);
      onSelect('MASTERED', finalIsoDate);
    } else {
      onSelect(selectedStatus, null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Separater Backdrop-Klickbereich – klickt außerhalb schließt, aber Klicks auf der Karte triggern nichts */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.card}>
          <Text style={styles.title}>{t('trainingStatus.selectStatus')}</Text>
          <View style={styles.divider} />

          {ALL_STATUSES.map((status) => {
            const badge = StatusBadgeStyles[status];
            const isSelected = status === selectedStatus;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => setSelectedStatus(status)}
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

          {/* Datumseingabe für MASTERED */}
          {selectedStatus === 'MASTERED' && (
            <View style={styles.dateSection}>
              <View style={styles.dateLabelRow}>
                <Text style={styles.dateLabel}>
                  {t('trainingStatus.learnedDate', 'Datum (Gelernt am)')}
                </Text>
                <TouchableOpacity
                  onPress={() => setDisplayDate(isoToLocal(getTodayIsoString(), isDE))}
                  style={styles.todayButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.todayButtonText}>
                    {t('trainingStatus.today', 'Heute')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.dateInput}
                  value={displayDate}
                  onChangeText={setDisplayDate}
                  placeholder={isDE ? 'TT.MM.JJJJ' : 'YYYY-MM-DD'}
                  placeholderTextColor={Colors.textTertiary}
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />

                {Platform.OS === 'web' ? (
                  <label
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 6px',
                      position: 'relative',
                      userSelect: 'none',
                    }}
                    title={isDE ? 'Kalender öffnen' : 'Open calendar'}
                  >
                    <Text style={styles.calendarIcon}>📅</Text>
                    <input
                      type="date"
                      value={localToIso(displayDate, isDE)}
                      onChange={(e: any) => {
                        if (e.target.value) {
                          setDisplayDate(isoToLocal(e.target.value, isDE));
                        }
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                      }}
                    />
                  </label>
                ) : (
                  <Text style={styles.calendarIcon}>📅</Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
              <Text style={styles.saveLabel}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>

          {onDelete && (
            <View style={styles.deleteSection}>
              <TouchableOpacity
                style={styles.deleteDiveBtn}
                onPress={onDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteDiveLabel}>
                  🗑️ {t('trainingStatus.removeDive', 'Aus Trainingsplan entfernen')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...Shadows.lg,
    zIndex: 1,
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
  dateSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  dateLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  dateLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
  },
  todayButton: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
  },
  todayButtonText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  calendarIcon: {
    fontSize: FontSize.md,
    marginLeft: Spacing.xs,
  },
  dateInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  saveLabel: {
    fontSize: FontSize.md,
    color: Colors.surface,
    fontWeight: FontWeight.bold,
  },
  deleteSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    alignItems: 'center',
  },
  deleteDiveBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  deleteDiveLabel: {
    fontSize: FontSize.sm,
    color: '#D32F2F',
    fontWeight: FontWeight.medium,
  },
});
