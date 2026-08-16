import { StyleSheet } from 'react-native';

// ────────────────────────────────────────────────────────────
// FARBEN
// ────────────────────────────────────────────────────────────
export const Colors = {
  // Primärfarben (Aqua/Teal – passend zum Wassersport-Thema)
  primary: '#0077B6',        // Ozean-Blau
  primaryDark: '#005F8E',
  primaryLight: '#48CAE4',
  primarySurface: '#E8F4FD',

  // Akzentfarben
  accent: '#00B4D8',
  accentLight: '#90E0EF',

  // Neutraltöne
  white: '#FFFFFF',
  background: '#F0F7FF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#D0E8F8',
  borderLight: '#E8F4FD',

  // Texte
  textPrimary: '#0A1929',
  textSecondary: '#4A6580',
  textTertiary: '#7A9AB5',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  // Status-Farben (für Sprung-Badges)
  statusPlanned: '#8B8B8B',
  statusPlannedBg: '#F0F0F0',
  statusLearning: '#E07A00',
  statusLearningBg: '#FFF3E0',
  statusMastered: '#1B7E3B',
  statusMasteredBg: '#E8F5E9',

  // UI-Zustände
  error: '#D32F2F',
  errorBg: '#FFEBEE',
  success: '#2E7D32',
  successBg: '#E8F5E9',
  warning: '#E65100',
  warningBg: '#FFF3E0',
  info: '#0277BD',
  infoBg: '#E1F5FE',

  // Drawer
  drawerBackground: '#0A2540',
  drawerActive: 'rgba(72, 202, 228, 0.18)',
  drawerText: '#CAE0F5',
  drawerTextActive: '#FFFFFF',
  drawerIcon: '#90BFDF',
  drawerIconActive: '#48CAE4',
  drawerBorder: 'rgba(255,255,255,0.08)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.45)',
  overlayLight: 'rgba(0, 0, 0, 0.15)',

  // Athleten-Avatar-Farben (für Initials-Avatar)
  avatarColors: [
    '#0077B6', '#00B4D8', '#48CAE4', '#1B7E3B',
    '#7B2D8B', '#C62828', '#E07A00', '#2962FF',
  ],
} as const;

// ────────────────────────────────────────────────────────────
// SPACING
// ────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ────────────────────────────────────────────────────────────
// FONT SIZES
// ────────────────────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
} as const;

// ────────────────────────────────────────────────────────────
// FONT WEIGHTS
// ────────────────────────────────────────────────────────────
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

// ────────────────────────────────────────────────────────────
// BORDER RADIUS
// ────────────────────────────────────────────────────────────
export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

// ────────────────────────────────────────────────────────────
// SHADOWS
// ────────────────────────────────────────────────────────────
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

// ────────────────────────────────────────────────────────────
// STATUS-BADGE-STYLES (zentral definiert)
// ────────────────────────────────────────────────────────────
export const StatusBadgeStyles = {
  PLANNED: {
    backgroundColor: Colors.statusPlannedBg,
    color: Colors.statusPlanned,
    borderColor: Colors.statusPlanned,
  },
  LEARNING: {
    backgroundColor: Colors.statusLearningBg,
    color: Colors.statusLearning,
    borderColor: Colors.statusLearning,
  },
  MASTERED: {
    backgroundColor: Colors.statusMasteredBg,
    color: Colors.statusMastered,
    borderColor: Colors.statusMastered,
  },
} as const;

// ────────────────────────────────────────────────────────────
// GLOBALE COMMON STYLES
// ────────────────────────────────────────────────────────────
export const CommonStyles = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
});
