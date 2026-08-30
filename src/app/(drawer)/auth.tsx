import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Shadows,
} from '../constants/theme';

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const { t } = useTranslation();
  const { login, registerWithInvite, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('login');

  // Login-Felder
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Registrierungs-Felder
  const [inviteToken, setInviteToken] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'>('PREFER_NOT_TO_SAY');

  const [error, setError] = useState('');

  const genderOptions: { value: typeof gender; labelKey: string }[] = [
    { value: 'MALE', labelKey: 'auth.genderMale' },
    { value: 'FEMALE', labelKey: 'auth.genderFemale' },
    { value: 'OTHER', labelKey: 'auth.genderOther' },
    { value: 'PREFER_NOT_TO_SAY', labelKey: 'auth.genderPreferNot' },
  ];

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError(t('auth.errors.emailRequired')); return; }
    if (!password) { setError(t('auth.errors.passwordRequired')); return; }
    try {
      await login({ email: email.trim(), password });
      // Navigation erfolgt automatisch über AppGate in _layout.tsx
    } catch (e: any) {
      setError(e?.message || t('auth.errors.loginFailed'));
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!inviteToken.trim()) { setError(t('auth.errors.tokenRequired')); return; }
    if (!email.trim()) { setError(t('auth.errors.emailRequired')); return; }
    if (!firstName.trim()) { setError(t('auth.errors.firstNameRequired')); return; }
    if (!lastName.trim()) { setError(t('auth.errors.lastNameRequired')); return; }
    if (!password || password.length < 8) { setError(t('auth.errors.passwordTooShort')); return; }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 5 || ageNum > 100) { setError(t('auth.errors.ageInvalid')); return; }
    try {
      await registerWithInvite({
        inviteToken: inviteToken.trim(),
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        age: ageNum,
        gender,
      });
      // Navigation erfolgt automatisch über AppGate in _layout.tsx
    } catch (e: any) {
      setError(e?.message || t('auth.errors.registerFailed'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🏊</Text>
          </View>
          <Text style={styles.appTitle}>Springboard</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Segmented Control */}
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[styles.segment, tab === 'login' && styles.segmentActive]}
              onPress={() => { setTab('login'); setError(''); }}
            >
              <Text style={[styles.segmentLabel, tab === 'login' && styles.segmentLabelActive]}>
                {t('auth.loginTab')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segment, tab === 'register' && styles.segmentActive]}
              onPress={() => { setTab('register'); setError(''); }}
            >
              <Text style={[styles.segmentLabel, tab === 'register' && styles.segmentLabelActive]}>
                {t('auth.registerTab')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fehler-Anzeige */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {tab === 'login' ? (
            /* ── LOGIN FORMULAR ── */
            <>
              <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t('auth.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnLabel}>{t('auth.loginButton')}</Text>
                )}
              </TouchableOpacity>

              {/* Demo-Hinweis */}
              <View style={styles.demoHint}>
                <Text style={styles.demoText}>Demo: trainer@test.de / member@test.de</Text>
              </View>
            </>
          ) : (
            /* ── REGISTRIERUNGS-FORMULAR ── */
            <>
              <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>

              <Text style={styles.fieldLabel}>{t('auth.inviteToken')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.inviteTokenPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={inviteToken}
                onChangeText={setInviteToken}
                autoCapitalize="characters"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t('auth.email')}</Text>
              <TextInput
                style={[styles.input, styles.inputReadOnly]}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.nameRow}>
                <View style={styles.nameField}>
                  <Text style={styles.fieldLabel}>{t('auth.firstName')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Max"
                    placeholderTextColor={Colors.textTertiary}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={[styles.nameField, { marginLeft: Spacing.sm }]}>
                  <Text style={styles.fieldLabel}>{t('auth.lastName')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Muster"
                    placeholderTextColor={Colors.textTertiary}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t('auth.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t('auth.age')}</Text>
              <TextInput
                style={styles.input}
                placeholder="17"
                placeholderTextColor={Colors.textTertiary}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t('auth.gender')}</Text>
              <View style={styles.genderRow}>
                {genderOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.genderChip, gender === opt.value && styles.genderChipSelected]}
                    onPress={() => setGender(opt.value)}
                  >
                    <Text style={[styles.genderChipLabel, gender === opt.value && styles.genderChipLabelSelected]}>
                      {t(opt.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, isLoading && styles.btnDisabled, { marginTop: Spacing.xl }]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.primaryBtnLabel}>{t('auth.registerButton')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Sprungsuche für Gäste */}
        <TouchableOpacity
          style={styles.guestSearchBtn}
          onPress={() => router.push('/(drawer)/dive-search')}
          activeOpacity={0.7}
        >
          <Text style={styles.guestSearchText}>
            🔍 {t('nav.diveSearch', 'Sprungsuche')} {t('auth.useWithoutLogin', 'ohne Anmeldung nutzen')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  logoEmoji: { fontSize: 36 },
  appTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.md,
  },
  guestSearchBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  guestSearchText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.primary,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    padding: 3,
    marginBottom: Spacing.xl,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.xs,
  },
  segmentActive: {
    backgroundColor: Colors.white,
    ...Shadows.sm,
  },
  segmentLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  segmentLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semiBold,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
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
  inputReadOnly: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
  },
  nameRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  nameField: { flex: 1 },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  genderChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  genderChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderChipLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  genderChipLabelSelected: {
    color: Colors.white,
    fontWeight: FontWeight.semiBold,
  },
  primaryBtn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnLabel: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
  },
  demoHint: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  demoText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});
