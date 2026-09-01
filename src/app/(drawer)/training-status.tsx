import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AddCommentModal from '../../components/modals/AddCommentModal';
import ConfirmModal from '../../components/modals/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Shadows,
  Spacing,
} from '../constants/theme';
import { AthleteTrainingEntry, DiveHeight } from '../types/dive';
import {
  BACKEND_TO_HEIGHT,
  CommentResponse,
} from '../../services/api';
import {
  useAthleteDives,
  useAthleteComments,
  useUserRoutines,
  useDiveCatalog,
} from '../../hooks/useDataStore';

type CommentFilterType = 'ALL' | 'GENERAL' | 'DIVE';

export default function TrainingStatusScreen() {
  const { t, i18n } = useTranslation();
  const isDE = i18n.language === 'de';
  const { user, activeClubId, activeClubMembership, isTrainerOrAdmin } = useAuth();
  const isTrainer = isTrainerOrAdmin();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const targetAthleteId = params.athleteId ? Number(params.athleteId) : (user?.id ? Number(user.id) : 0);
  const viewingAthlete = params.athleteId && String(params.athleteId) !== String(user?.id);
  const athleteLabel = params.athleteName ?? t('trainingStatus.myTraining');
  const clubId = activeClubId || activeClubMembership?.clubId;

  // Centralized Data Layer Hooks
  const { dives: rawAthleteDives, isLoading: isDivesLoading, refresh: refreshDives } = useAthleteDives(targetAthleteId);
  const {
    comments,
    isLoading: isCommentsLoading,
    refresh: refreshComments,
    createComment,
    updateComment,
    deleteComment,
    markAsRead,
  } = useAthleteComments(targetAthleteId, clubId);
  const { routines, isLoading: isRoutinesLoading, refresh: refreshRoutines } = useUserRoutines(targetAthleteId);
  const { executions: catalogExecutions } = useDiveCatalog();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddCommentModalVisible, setIsAddCommentModalVisible] = useState(false);
  const [editingComment, setEditingComment] = useState<CommentResponse | null>(null);
  const [deleteCommentModal, setDeleteCommentModal] = useState<{
    visible: boolean;
    comment?: CommentResponse;
    isDeleting?: boolean;
  }>({ visible: false });
  const [commentFilter, setCommentFilter] = useState<CommentFilterType>('ALL');

  const isLoading = isDivesLoading && isCommentsLoading && isRoutinesLoading && rawAthleteDives.length === 0;

  const loadData = useCallback(async (refresh = false) => {
    if (!targetAthleteId) return;
    if (refresh) setIsRefreshing(true);

    try {
      await Promise.all([
        refreshDives(),
        refreshComments(),
        refreshRoutines(),
      ]);
    } catch (e: any) {
      console.warn('Failed to refresh training status data:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [targetAthleteId, refreshDives, refreshComments, refreshRoutines]);

  useFocusEffect(
    useCallback(() => {
      if (targetAthleteId) {
        refreshComments();
        refreshDives();
      }
    }, [targetAthleteId, refreshComments, refreshDives])
  );

  // Mark unread comments as read if needed
  useEffect(() => {
    if (!targetAthleteId || !comments.length) return;
    const hasUnreadComments = comments.some(
      (c) => c.isRead === false && String(c.authorId) !== String(user?.id)
    );
    if (hasUnreadComments) {
      markAsRead();
    }
  }, [targetAthleteId, comments, user?.id, markAsRead]);

  const entries: AthleteTrainingEntry[] = useMemo(() => {
    return rawAthleteDives.map((d) => ({
      id: String(d.id),
      athleteId: String(d.athleteId),
      diveCode: d.diveCode,
      execution: d.execution,
      degreeOfDifficulty: d.degreeOfDifficulty,
      diveExecutionId: d.diveExecutionId,
      height: BACKEND_TO_HEIGHT[d.height] || '1m',
      status: d.status,
      learnedAt: d.learnedAt ?? null,
      notes: [],
    }));
  }, [rawAthleteDives]);

  // Set navigation header title
  useEffect(() => {
    navigation.setOptions({
      title: viewingAthlete ? `${athleteLabel} – ${t('trainingStatus.title')}` : t('trainingStatus.title'),
    });
  }, [navigation, viewingAthlete, athleteLabel, t]);

  // Map athleteDiveStatusId to dive info for quick badge lookup
  const athleteDiveStatusMap = useMemo(() => {
    const map = new Map<number, { diveCode: string; execution: string; height: string }>();
    rawAthleteDives.forEach((d) => {
      map.set(d.id, {
        diveCode: d.diveCode,
        execution: d.execution,
        height: BACKEND_TO_HEIGHT[d.height] || '1m',
      });
    });
    return map;
  }, [rawAthleteDives]);

  const stats = useMemo(() => {
    const isMastered = (s?: string) => s === 'MASTERED';
    const isLearning = (s?: string) => s === 'LEARNING' || s === 'LEARNED';
    const isPlanned = (s?: string) => s === 'PLANNED';

    const mastered = entries.filter((e) => isMastered(e.status)).length;
    const learning = entries.filter((e) => isLearning(e.status)).length;
    const planned = entries.filter((e) => isPlanned(e.status)).length;
    const total = entries.length;

    const byHeight: Record<DiveHeight, { total: number; mastered: number; learning: number; planned: number }> = {
      '1m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '3m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '5m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '7.5m': { total: 0, mastered: 0, learning: 0, planned: 0 },
      '10m': { total: 0, mastered: 0, learning: 0, planned: 0 },
    };

    entries.forEach((e) => {
      if (byHeight[e.height]) {
        byHeight[e.height].total++;
        if (isMastered(e.status)) byHeight[e.height].mastered++;
        else if (isLearning(e.status)) byHeight[e.height].learning++;
        else if (isPlanned(e.status)) byHeight[e.height].planned++;
      }
    });

    return { mastered, learning, planned, total, byHeight };
  }, [entries]);

  // Visible & filtered comments
  const visibleComments = useMemo(() => {
    const baseList = isTrainer ? comments : comments.filter((c) => c.sharedWithAthlete);
    let list = baseList;
    if (commentFilter === 'GENERAL') {
      list = list.filter((c) => !c.athleteDiveStatusId);
    } else if (commentFilter === 'DIVE') {
      list = list.filter((c) => !!c.athleteDiveStatusId);
    }

    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [comments, isTrainer, commentFilter]);

  const generalCommentsCount = useMemo(() => {
    const base = isTrainer ? comments : comments.filter((c) => c.sharedWithAthlete);
    return base.filter((c) => !c.athleteDiveStatusId).length;
  }, [comments, isTrainer]);

  const diveCommentsCount = useMemo(() => {
    const base = isTrainer ? comments : comments.filter((c) => c.sharedWithAthlete);
    return base.filter((c) => !!c.athleteDiveStatusId).length;
  }, [comments, isTrainer]);

  const totalVisibleCommentsCount = useMemo(() => {
    const base = isTrainer ? comments : comments.filter((c) => c.sharedWithAthlete);
    return base.length;
  }, [comments, isTrainer]);

  const handleCreateComment = async (data: {
    content: string;
    sharedWithAthlete: boolean;
    athleteDiveStatusId?: number;
  }) => {
    if (!targetAthleteId) return;
    try {
      await createComment({
        athleteId: Number(targetAthleteId),
        content: data.content,
        sharedWithAthlete: data.sharedWithAthlete,
        athleteDiveStatusId: data.athleteDiveStatusId,
      });
    } catch (e: any) {
      Alert.alert(t('common.error', 'Fehler'), e?.message || 'Failed to save comment');
      throw e;
    }
  };

  const handleUpdateComment = async (
    commentId: number,
    data: { content: string; sharedWithAthlete: boolean; athleteDiveStatusId?: number | null }
  ) => {
    if (!targetAthleteId) return;
    try {
      await updateComment(commentId, {
        content: data.content,
        sharedWithAthlete: data.sharedWithAthlete,
        athleteDiveStatusId: data.athleteDiveStatusId !== undefined ? data.athleteDiveStatusId : undefined,
      });
    } catch (e: any) {
      Alert.alert(t('common.error', 'Fehler'), e?.message || 'Failed to update comment');
      throw e;
    }
  };

  const handleDeleteComment = (comment: CommentResponse) => {
    setDeleteCommentModal({ visible: true, comment });
  };

  const handleConfirmDeleteComment = async () => {
    if (!deleteCommentModal.comment || !targetAthleteId) return;
    setDeleteCommentModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      await deleteComment(deleteCommentModal.comment.id);
      setDeleteCommentModal({ visible: false, isDeleting: false });
    } catch (e: any) {
      setDeleteCommentModal((prev) => ({ ...prev, isDeleting: false }));
      Alert.alert(t('common.error', 'Fehler'), e?.message || 'Failed to delete comment');
    }
  };

  const navParams = useMemo(() => {
    return params.athleteId
      ? { athleteId: params.athleteId, athleteName: params.athleteName }
      : {};
  }, [params.athleteId, params.athleteName]);

  const navigateToDives = () => {
    router.push({
      pathname: '/(drawer)/dives',
      params: navParams,
    } as any);
  };

  const navigateToRoutines = () => {
    router.push({
      pathname: '/(drawer)/routines',
      params: navParams,
    } as any);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} />}
    >
      {/* Athleten-Label (wenn vom Trainer geöffnet) */}
      {viewingAthlete && (
        <View style={styles.athleteBanner}>
          <Text style={styles.athleteBannerText}>👤 {athleteLabel}</Text>
        </View>
      )}

      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          {/* Hauptbereiche Navigation (Cards) */}
          <View style={styles.cardsSection}>
            {/* Sprünge Unterseite Card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={() => navigateToDives()}
              activeOpacity={0.8}
            >
              <View style={styles.navCardHeader}>
                <View style={styles.navCardIconContainer}>
                  <Text style={styles.navCardIcon}>🏊</Text>
                </View>
                <View style={styles.navCardTitleCol}>
                  <Text style={styles.navCardTitle}>{t('trainingStatus.divesBannerTitle', 'Sprünge')}</Text>
                  <Text style={styles.navCardSubtitle}>
                    {t('trainingStatus.divesBannerSub', {
                      total: stats.total,
                      mastered: stats.mastered,
                    })}
                  </Text>
                </View>
                <Text style={styles.navCardArrow}>›</Text>
              </View>

              {/* Status Mini-Badges */}
              <View style={styles.navCardPillsRow}>
                <View style={[styles.miniPill, styles.miniPillMastered]}>
                  <Text style={styles.miniPillText}>
                    🟢 {stats.mastered} {t('trainingStatus.statsMastered', 'Sicher')}
                  </Text>
                </View>
                <View style={[styles.miniPill, styles.miniPillLearning]}>
                  <Text style={styles.miniPillText}>
                    🟡 {stats.learning} {t('trainingStatus.statsLearning', 'Im Aufbau')}
                  </Text>
                </View>
                <View style={[styles.miniPill, styles.miniPillPlanned]}>
                  <Text style={styles.miniPillText}>
                    ⚪ {stats.planned} {t('trainingStatus.statsPlanned', 'Geplant')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Serien / Routinen Unterseite Card */}
            <TouchableOpacity
              style={styles.navCard}
              onPress={navigateToRoutines}
              activeOpacity={0.8}
            >
              <View style={styles.navCardHeader}>
                <View style={[styles.navCardIconContainer, styles.navCardIconRoutines]}>
                  <Text style={styles.navCardIcon}>📋</Text>
                </View>
                <View style={styles.navCardTitleCol}>
                  <Text style={styles.navCardTitle}>{t('trainingStatus.routinesBannerTitle', 'Serien')}</Text>
                  <Text style={styles.navCardSubtitle}>
                    {t('trainingStatus.routinesBannerSub', {
                      count: routines.length,
                      defaultValue: `${routines.length} Serien vorhanden`,
                    })}
                  </Text>
                </View>
                <Text style={styles.navCardArrow}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Kommentare & Notizen Bereich ── */}
          <View style={styles.commentsSection}>
            {/* Header mit Titel, Zähler und Hinzufügen-Button */}
            <View style={styles.commentsHeader}>
              <View style={styles.commentsHeaderLeft}>
                <Text style={styles.commentsTitle}>
                  {t('trainingStatus.commentsSectionTitle', 'Kommentare & Notizen')}
                </Text>
                <View style={styles.commentsBadge}>
                  <Text style={styles.commentsBadgeText}>{totalVisibleCommentsCount}</Text>
                </View>
              </View>

              {isTrainer && (
                <TouchableOpacity
                  style={styles.addCommentBtn}
                  onPress={() => setIsAddCommentModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addCommentBtnText}>
                    + {t('trainingStatus.addCommentBtn', 'Kommentar hinzufügen')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filter-Chips (Alle, Allgemein, Sprungbezogen) */}
            {totalVisibleCommentsCount > 0 && (
              <View style={styles.filterChipsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    commentFilter === 'ALL' && styles.filterChipActive,
                  ]}
                  onPress={() => setCommentFilter('ALL')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      commentFilter === 'ALL' && styles.filterChipTextActive,
                    ]}
                  >
                    {t('trainingStatus.filterAll', 'Alle')} ({totalVisibleCommentsCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    commentFilter === 'GENERAL' && styles.filterChipActive,
                  ]}
                  onPress={() => setCommentFilter('GENERAL')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      commentFilter === 'GENERAL' && styles.filterChipTextActive,
                    ]}
                  >
                    💬 {t('trainingStatus.filterGeneral', 'Allgemein')} ({generalCommentsCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    commentFilter === 'DIVE' && styles.filterChipActive,
                  ]}
                  onPress={() => setCommentFilter('DIVE')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      commentFilter === 'DIVE' && styles.filterChipTextActive,
                    ]}
                  >
                    🏊 {t('trainingStatus.filterDive', 'Sprungbezogen')} ({diveCommentsCount})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Liste der Kommentare */}
            {visibleComments.length === 0 ? (
              <View style={styles.emptyCommentsCard}>
                <Text style={styles.emptyCommentsIcon}>💬</Text>
                <Text style={styles.emptyCommentsTitle}>
                  {t('trainingStatus.noComments', 'Keine Kommentare vorhanden.')}
                </Text>
                <Text style={styles.emptyCommentsSub}>
                  {t(
                    'trainingStatus.noCommentsSub',
                    'Füge Notizen oder Feedback zum Sportler hinzu.'
                  )}
                </Text>
                {isTrainer && (
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => setIsAddCommentModalVisible(true)}
                  >
                    <Text style={styles.emptyAddBtnText}>
                      + {t('trainingStatus.addCommentBtn', 'Kommentar hinzufügen')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.commentsList}>
                {visibleComments.map((comment) => {
                  const diveInfo = comment.athleteDiveStatusId
                    ? athleteDiveStatusMap.get(comment.athleteDiveStatusId)
                    : undefined;
                  const isPrivate = !comment.sharedWithAthlete;
                  const isAuthor = String(comment.authorId) === String(user?.id);
                  const isUnread = !isAuthor && comment.isRead === false;
                  const isGlobalAdmin = user?.globalRole === 'ROLE_ADMIN';
                  const canEdit = isAuthor || isGlobalAdmin;
                  const canDelete = isAuthor || isTrainer || isGlobalAdmin;

                  const dateFormatted = new Date(comment.createdAt).toLocaleDateString(
                    isDE ? 'de-DE' : 'en-US',
                    {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  return (
                    <View
                      key={comment.id}
                      style={[
                        styles.commentCard,
                        isPrivate && styles.commentCardPrivate,
                        isUnread && styles.commentCardUnread,
                      ]}
                    >
                      {/* Kommentar Card Header */}
                      <View style={styles.commentCardHeader}>
                        <View style={styles.commentAuthorCol}>
                          <Text style={styles.commentAuthor}>
                            👤 {comment.authorName || 'Trainer'}
                          </Text>
                          <Text style={styles.commentDate}>{dateFormatted}</Text>
                        </View>

                        {/* Badges & Actions */}
                        <View style={styles.commentBadgesRow}>
                          {/* Neu / Ungelesen Badge */}
                          {isUnread && (
                            <View style={styles.unreadCommentBadge}>
                              <Text style={styles.unreadCommentBadgeText}>
                                ✨ {t('trainingStatus.newCommentBadge', 'Neu')}
                              </Text>
                            </View>
                          )}

                          {/* Sprung-Badge (z. B. 103B) im einheitlichen Routinen/Sprünge Stil */}
                          {diveInfo ? (
                            <View style={styles.diveBadgeContainer}>
                              <View style={styles.codeChip}>
                                <Text style={styles.codeText}>
                                  {diveInfo.diveCode}{diveInfo.execution}
                                </Text>
                              </View>
                              <Text style={styles.diveHeightText}>{diveInfo.height}</Text>
                            </View>
                          ) : comment.athleteDiveStatusId ? (
                            <View style={styles.codeChip}>
                              <Text style={styles.codeText}>
                                #{comment.athleteDiveStatusId}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.generalCommentBadge}>
                              <Text style={styles.generalCommentBadgeText}>
                                💬 {t('trainingStatus.generalComment', 'Allgemein')}
                              </Text>
                            </View>
                          )}

                          {/* Privat-Badge */}
                          {isPrivate && (isTrainer || isAuthor) && (
                            <View style={styles.privateBadge}>
                              <Text style={styles.privateBadgeText}>
                                🔒 {t('trainingStatus.onlyTrainer', 'Nur Trainer')}
                              </Text>
                            </View>
                          )}

                          {/* Aktionen (Bearbeiten / Löschen) */}
                          {(canEdit || canDelete) && (
                            <View style={styles.commentActionsGroup}>
                              {canEdit && (
                                <TouchableOpacity
                                  style={styles.editCommentBtn}
                                  onPress={() => {
                                    setEditingComment(comment);
                                    setIsAddCommentModalVisible(true);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  accessibilityLabel={t('trainingStatus.editComment', 'Bearbeiten')}
                                >
                                  <Text style={styles.editCommentIcon}>✏️</Text>
                                </TouchableOpacity>
                              )}

                              {canDelete && (
                                <TouchableOpacity
                                  style={styles.deleteCommentBtn}
                                  onPress={() => handleDeleteComment(comment)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  accessibilityLabel={t('trainingStatus.deleteComment', 'Löschen')}
                                >
                                  <Text style={styles.deleteCommentIcon}>✕</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Kommentar Inhalt */}
                      <Text style={[styles.commentContent, isPrivate && styles.commentContentPrivate]}>
                        {comment.content}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* Modal zum Hinzufügen / Bearbeiten eines Kommentars */}
      <AddCommentModal
        visible={isAddCommentModalVisible}
        athleteId={targetAthleteId}
        athleteDives={entries}
        catalogExecutions={catalogExecutions}
        commentToEdit={editingComment}
        onSave={handleCreateComment}
        onUpdate={handleUpdateComment}
        onClose={() => {
          setIsAddCommentModalVisible(false);
          setEditingComment(null);
        }}
      />

      {/* Confirm Delete Comment Modal */}
      <ConfirmModal
        visible={deleteCommentModal.visible}
        title={t('trainingStatus.deleteCommentConfirmTitle', 'Kommentar löschen')}
        message={t('trainingStatus.deleteCommentConfirmMsg', 'Möchtest du diesen Kommentar wirklich löschen?')}
        confirmText={t('common.delete', 'Löschen')}
        cancelText={t('common.cancel', 'Abbrechen')}
        isLoading={deleteCommentModal.isDeleting}
        onConfirm={handleConfirmDeleteComment}
        onCancel={() => setDeleteCommentModal({ visible: false })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  athleteBanner: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  athleteBannerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.primaryDark,
  },
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  cardsSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  navCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  navCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  navCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardIconRoutines: {
    backgroundColor: Colors.secondaryLight,
  },
  navCardIcon: {
    fontSize: 24,
  },
  navCardTitleCol: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  navCardSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  navCardArrow: {
    fontSize: 22,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  navCardPillsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    flexWrap: 'wrap',
  },
  miniPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
  },
  miniPillMastered: {
    backgroundColor: '#E8F5E9',
  },
  miniPillLearning: {
    backgroundColor: '#FFF8E1',
  },
  miniPillPlanned: {
    backgroundColor: Colors.surfaceSecondary,
  },
  miniPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },

  /* ── Kommentare & Notizen Styles ── */
  commentsSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  commentsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  commentsTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commentsBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  commentsBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  addCommentBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  addCommentBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primarySurface,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  filterChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  emptyCommentsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  emptyCommentsIcon: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  emptyCommentsTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyCommentsSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptyAddBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyAddBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  commentsList: {
    gap: Spacing.md,
  },
  commentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  commentCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
  },
  unreadCommentBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  unreadCommentBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#B45309',
  },
  commentCardPrivate: {
    backgroundColor: '#FFFDF0',
    borderColor: '#FFE082',
  },
  commentCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  commentAuthorCol: {
    flex: 1,
    minWidth: 120,
  },
  commentAuthor: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  commentDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  commentBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  diveBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  codeChip: {
    backgroundColor: Colors.primarySurface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeText: {
    fontSize: FontSize.xs + 1,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  diveHeightText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  generalCommentBadge: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generalCommentBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  privateBadge: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  privateBadgeText: {
    fontSize: FontSize.xs,
    color: '#B78103',
    fontWeight: FontWeight.medium,
  },
  commentActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: 4,
  },
  editCommentBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCommentIcon: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  deleteCommentBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCommentIcon: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: FontWeight.bold,
  },
  commentContent: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  commentContentPrivate: {
    color: Colors.textPrimary,
  },
});
