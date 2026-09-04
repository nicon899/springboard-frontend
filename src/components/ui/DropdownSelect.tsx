import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../../app/constants/theme';

export interface DropdownOption {
  key: string;
  label: string;
  sublabel?: string;
  count?: number;
}

interface DropdownSelectProps {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  /** Currently selected keys (multi-select) */
  selectedKeys: string[];
  /** Called when the selection changes */
  onSelectKeys: (keys: string[]) => void;
  open: boolean;
  onToggle: () => void;
  /** Show a "Alle" / reset option at the top. Defaults to true. */
  showAllOption?: boolean;
  allOptionLabel?: string;
}

export default function DropdownSelect({
  label,
  placeholder,
  options,
  selectedKeys,
  onSelectKeys,
  open,
  onToggle,
  showAllOption = true,
  allOptionLabel = 'Alle',
}: DropdownSelectProps) {
  const isFiltered = selectedKeys.length > 0;

  const toggleKey = (key: string) => {
    if (selectedKeys.includes(key)) {
      onSelectKeys(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectKeys([...selectedKeys, key]);
    }
  };

  const clearAll = () => {
    onSelectKeys([]);
  };

  // Build button label
  let btnLabel: string;
  if (!isFiltered) {
    btnLabel = placeholder;
  } else if (selectedKeys.length === 1) {
    btnLabel = options.find((o) => o.key === selectedKeys[0])?.label ?? placeholder;
  } else {
    btnLabel = `${selectedKeys.length} ausgewählt`;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.btn, open && styles.btnOpen, isFiltered && styles.btnFiltered]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        <Text
          style={[styles.btnText, !isFiltered && styles.btnPlaceholder, isFiltered && styles.btnTextFiltered]}
          numberOfLines={1}
        >
          {btnLabel}
        </Text>
        {isFiltered && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={clearAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
        {!isFiltered && (
          <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
        )}
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {/* "Alle" / Reset Row */}
            {showAllOption && (
              <TouchableOpacity
                style={[styles.option, !isFiltered && styles.optionActive]}
                onPress={() => { clearAll(); onToggle(); }}
              >
                <Text style={[styles.optionText, !isFiltered && styles.optionTextActive]}>
                  {allOptionLabel}
                </Text>
                <View style={[styles.checkbox, !isFiltered && styles.checkboxActive]}>
                  {!isFiltered && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
              </TouchableOpacity>
            )}

            {options.map((opt) => {
              const isActive = selectedKeys.includes(opt.key);
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.option, isActive && styles.optionActive]}
                  onPress={() => toggleKey(opt.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionText, isActive && styles.optionTextActive]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                    {opt.sublabel && (
                      <Text style={[styles.optionSublabel, isActive && styles.optionSublabelActive]} numberOfLines={1}>
                        {opt.sublabel}
                      </Text>
                    )}
                  </View>
                  <View style={styles.optionRight}>
                    {opt.count != null && (
                      <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
                        <Text style={[styles.countBadgeText, isActive && styles.countBadgeTextActive]}>
                          {opt.count}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.checkbox, isActive && styles.checkboxActive]}>
                      {isActive && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Fertig-Button schließt das Dropdown */}
          <TouchableOpacity style={styles.doneBtn} onPress={onToggle}>
            <Text style={styles.doneBtnText}>
              {isFiltered ? `${selectedKeys.length} gewählt · Fertig` : 'Schließen'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  btnOpen: {
    borderColor: Colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  btnFiltered: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  btnText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  btnPlaceholder: {
    color: Colors.textTertiary,
  },
  btnTextFiltered: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  chevron: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  clearBtn: {
    padding: 2,
  },
  clearBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: Colors.primary,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    ...Shadows.md,
    zIndex: 100,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  optionActive: {
    backgroundColor: Colors.primarySurface,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  optionTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  optionSublabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  optionSublabelActive: {
    color: Colors.accent,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countBadge: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: Colors.primary,
  },
  countBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  countBadgeTextActive: {
    color: Colors.white,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkboxTick: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: FontWeight.bold,
    lineHeight: 14,
  },
  doneBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
  },
  doneBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
});
