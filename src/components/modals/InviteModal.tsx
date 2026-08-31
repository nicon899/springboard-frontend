import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { InvitationRole } from '../../app/types/club';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../../app/constants/theme';

import { api } from '../../services/api';

interface InviteModalProps {
  visible: boolean;
  clubId: string;
  onClose: () => void;
}

const ROLES: InvitationRole[] = ['MEMBER', 'TRAINER'];

export default function InviteModal({ visible, clubId, onClose }: InviteModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<InvitationRole>('MEMBER');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const ROLE_LABELS: Record<InvitationRole, string> = {
    MEMBER: t('club.inviteModal.roleMember'),
    TRAINER: t('club.inviteModal.roleTrainer'),
  };

  const handleGenerate = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const response = await api.createInvitation({
        clubId: Number(clubId),
        email: email.trim(),
        role: selectedRole,
      });
      setGeneratedToken(response.token);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('club.inviteModal.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedToken) return;
    await Clipboard.setStringAsync(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (!generatedToken) return;
    await Share.share({
      message: `Dein Springboard-Einladungs-Code: ${generatedToken}`,
      title: 'Springboard Einladung',
    });
  };

  const handleClose = () => {
    setEmail('');
    setSelectedRole('MEMBER');
    setGeneratedToken(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('club.inviteModal.title')}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeLabel}>✕</Text>
            </TouchableOpacity>
          </View>

          {generatedToken ? (
            /* ── TOKEN ANZEIGEN ── */
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenTitle}>{t('club.inviteModal.tokenTitle')}</Text>
              <Text style={styles.tokenHelp}>{t('club.inviteModal.tokenHelp')}</Text>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenText} selectable>
                  {generatedToken}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, styles.copyBtn]}
                onPress={handleCopy}
              >
                <Text style={styles.copyBtnLabel}>
                  {copied ? t('common.copied') : t('club.inviteModal.copyToken')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn]}
                onPress={handleShare}
              >
                <Text style={styles.shareBtnLabel}>{t('club.inviteModal.shareToken')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── FORMULAR ── */
            <>
              <Text style={styles.fieldLabel}>{t('club.inviteModal.emailLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('club.inviteModal.emailPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>
                {t('club.inviteModal.roleLabel')}
              </Text>
              <View style={styles.roleRow}>
                {ROLES.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      selectedRole === role && styles.roleChipSelected,
                    ]}
                    onPress={() => setSelectedRole(role)}
                  >
                    <Text
                      style={[
                        styles.roleChipLabel,
                        selectedRole === role && styles.roleChipLabelSelected,
                      ]}
                    >
                      {ROLE_LABELS[role]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  (!email.trim() || isLoading) && styles.generateBtnDisabled,
                ]}
                onPress={handleGenerate}
                disabled={!email.trim() || isLoading}
              >
                <Text style={styles.generateBtnLabel}>
                  {isLoading ? t('common.loading') : t('club.inviteModal.generate')}
                </Text>
              </TouchableOpacity>
            </>
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
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  closeBtn: { padding: Spacing.sm },
  closeLabel: { fontSize: FontSize.lg, color: Colors.textSecondary },
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
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  roleChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  roleChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleChipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  roleChipLabelSelected: {
    color: Colors.white,
    fontWeight: FontWeight.semiBold,
  },
  generateBtn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnLabel: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  // Token-Ansicht
  tokenContainer: { alignItems: 'center', paddingVertical: Spacing.md },
  tokenTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  tokenHelp: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  tokenBox: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  tokenText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 2,
  },
  actionBtn: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  copyBtn: {
    backgroundColor: Colors.primary,
  },
  copyBtnLabel: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
  shareBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  shareBtnLabel: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
  },
});
