import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { DiveDefinition, DiveHeight } from '../../app/types/dive';
import { DIVE_GROUP_NAMES, mapApiDivesToDefinitions } from '../../app/constants/diveData';
import { api, DiveExecutionResponse } from '../../services/api';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../../app/constants/theme';

interface AddDiveModalProps {
  visible: boolean;
  height: DiveHeight;
  existingCodes: string[];
  onAdd: (dive: DiveDefinition) => void;
  onClose: () => void;
}

export default function AddDiveModal({
  visible,
  height,
  existingCodes,
  onAdd,
  onClose,
}: AddDiveModalProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [dives, setDives] = useState<DiveDefinition[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const apiExecutions: DiveExecutionResponse[] = await api.getAllDiveExecutions();
        if (isMounted && apiExecutions && apiExecutions.length > 0) {
          setDives(mapApiDivesToDefinitions(apiExecutions));
        }
      } catch (e) {
        console.warn('Failed to load dives from API in AddDiveModal:', e);
      }
    }
    if (visible) {
      loadCatalog();
    }
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const availableDives = dives.filter((d) => {
    return !existingCodes.includes(d.code);
  });

  const filteredDives = query.trim()
    ? availableDives.filter(
        (d) =>
          d.code.includes(query.trim()) ||
          d.nameDe.toLowerCase().includes(query.toLowerCase()) ||
          d.nameEn.toLowerCase().includes(query.toLowerCase())
      )
    : availableDives;

  const isDE = i18n.language === 'de';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('trainingStatus.addDiveTitle')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeLabel}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Suche */}
          <TextInput
            style={styles.search}
            placeholder={t('common.search')}
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />

          {/* Sprung-Liste */}
          {filteredDives.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('trainingStatus.noCatalogDives')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredDives}
              keyExtractor={(d) => d.code}
              renderItem={({ item }) => {
                const groupName = DIVE_GROUP_NAMES[item.groupNumber];
                return (
                  <TouchableOpacity
                    style={styles.diveRow}
                    onPress={() => {
                      onAdd(item);
                      setQuery('');
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeText}>{item.code}</Text>
                    </View>
                    <View style={styles.diveInfo}>
                      <Text style={styles.diveName} numberOfLines={1}>
                        {isDE ? item.nameDe : item.nameEn}
                      </Text>
                      <Text style={styles.groupName}>
                        {isDE ? groupName.de : groupName.en}
                      </Text>
                    </View>
                    <Text style={styles.addIcon}>+</Text>
                  </TouchableOpacity>
                );
              }}
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  closeLabel: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  search: {
    height: 44,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  diveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  codeBadge: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.md,
    minWidth: 48,
    alignItems: 'center',
  },
  codeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  diveInfo: {
    flex: 1,
  },
  diveName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  groupName: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  addIcon: {
    fontSize: FontSize.xl,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    paddingLeft: Spacing.sm,
  },
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});
