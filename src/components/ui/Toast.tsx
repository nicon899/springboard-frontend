import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BorderRadius, Colors, FontSize, FontWeight, Shadows, Spacing } from '../../app/constants/theme';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export interface ToastMessage {
  id?: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ toast, onDismiss, duration = 4000 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          speed: 14,
          bounciness: 4,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
      translateY.setValue(-20);
    }
  }, [toast]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  if (!toast) return null;

  const getStyleForType = () => {
    switch (toast.type) {
      case 'error':
        return {
          bg: '#FDEDED',
          border: '#F5C2C7',
          icon: '⚠️',
          textColor: '#842029',
          iconColor: Colors.error,
        };
      case 'success':
        return {
          bg: '#E8F5E9',
          border: '#C3E6CB',
          icon: '✓',
          textColor: '#0F5132',
          iconColor: Colors.success,
        };
      case 'warning':
        return {
          bg: '#FFF3CD',
          border: '#FFEEBA',
          icon: '⚡',
          textColor: '#664D03',
          iconColor: Colors.warning,
        };
      case 'info':
      default:
        return {
          bg: Colors.primarySurface,
          border: Colors.border,
          icon: 'ℹ️',
          textColor: Colors.textPrimary,
          iconColor: Colors.primary,
        };
    }
  };

  const styleConfig = getStyleForType();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{styleConfig.icon}</Text>
        <Text style={[styles.message, { color: styleConfig.textColor }]} numberOfLines={3}>
          {toast.message}
        </Text>
      </View>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} activeOpacity={0.7}>
        <Text style={[styles.closeText, { color: styleConfig.textColor }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    ...Shadows.md,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginRight: Spacing.sm,
  },
  icon: {
    fontSize: 16,
  },
  message: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    lineHeight: 18,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
