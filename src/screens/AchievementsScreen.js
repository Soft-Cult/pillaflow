import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { AchievementBadge, ProfileBadgeSlots } from '../components';
import {
  buildAchievementSections,
  computeAchievementMetrics,
  getBadgeDetails,
} from '../utils/achievements';
import {
  colors,
  borderRadius,
  spacing,
  typography,
  shadows,
} from '../utils/theme';

const AchievementsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    profile,
    habits,
    authUser,
    getCurrentStreak,
    achievementBadgeCatalog,
    achievementUnlockedBadgeIds,
    achievementUnlockList,
    setProfileBadgeSlot,
    themeColors,
    themeName,
  } = useApp();

  const isDark = themeName === 'dark';
  const styles = React.useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const currentStreak = getCurrentStreak ? getCurrentStreak() : 0;

  const achievementMetrics = React.useMemo(
    () =>
      computeAchievementMetrics({
        habits,
        currentStreak,
        profileCreatedAt: profile?.createdAt,
        authCreatedAt: authUser?.created_at,
      }),
    [authUser?.created_at, currentStreak, habits, profile?.createdAt]
  );

  const achievementSections = React.useMemo(
    () => {
      const sections = buildAchievementSections({
        metrics: achievementMetrics,
        badgeSlots: profile?.badgeSlots,
        unlockedBadgeIds: achievementUnlockedBadgeIds,
      });
      return sections.map((section) => ({
        ...section,
        badges: section.badges.map((badge) => {
          const dbBadge = achievementBadgeCatalog?.[badge.badgeId];
          return dbBadge
            ? {
                ...badge,
                imageUri: dbBadge.imageUri || badge.imageUri,
                milestoneLabel: dbBadge.milestoneLabel || badge.milestoneLabel,
              }
            : badge;
        }),
      }));
    },
    [achievementBadgeCatalog, achievementMetrics, achievementUnlockedBadgeIds, profile?.badgeSlots]
  );

  const unlockedBadgeCount = React.useMemo(
    () =>
      achievementSections.reduce(
        (count, section) => count + section.badges.filter((badge) => badge.unlocked).length,
        0
      ),
    [achievementSections]
  );
  const unlockedBadgeHistory = React.useMemo(
    () =>
      (achievementUnlockList || [])
        .map((entry) => {
          const details = getBadgeDetails(entry?.badgeId);
          if (!details) return null;
          const unlockedDateMs = entry?.unlockedAt ? new Date(entry.unlockedAt).getTime() : NaN;
          return {
            ...entry,
            ...details,
            unlockedDateLabel: Number.isFinite(unlockedDateMs)
              ? new Date(unlockedDateMs).toLocaleDateString()
              : 'Saved',
          };
        })
        .filter(Boolean),
    [achievementUnlockList]
  );

  const handleAssignBadge = React.useCallback(
    (badge) => {
      if (!badge?.unlocked) {
        Alert.alert('Achievement locked', `Reach ${badge?.milestoneLabel || 'this milestone'} to unlock.`);
        return;
      }

      Alert.alert(
        'Display badge',
        `${badge.milestoneLabel} - ${badge.title}`,
        [
          { text: 'Slot 1', onPress: () => setProfileBadgeSlot?.(0, badge.badgeId) },
          { text: 'Slot 2', onPress: () => setProfileBadgeSlot?.(1, badge.badgeId) },
          { text: 'Slot 3', onPress: () => setProfileBadgeSlot?.(2, badge.badgeId) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    },
    [setProfileBadgeSlot]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Unlocked</Text>
          <Text style={styles.summaryValue}>{unlockedBadgeCount}</Text>
          <Text style={styles.summarySubtitle}>Tap any unlocked achievement to equip it to slot 1, 2, or 3.</Text>
        </View>

        {unlockedBadgeHistory.length ? (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Unlocked history</Text>
            {unlockedBadgeHistory.map((entry) => (
              <View key={entry.badgeId} style={styles.historyRow}>
                <Text style={styles.historyLabel} numberOfLines={1}>
                  {entry.title}: {entry.milestoneLabel}
                </Text>
                <Text style={styles.historyDate}>{entry.unlockedDateLabel}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <ProfileBadgeSlots
          badgeSlots={profile?.badgeSlots}
          badgeCatalog={achievementBadgeCatalog}
          textColor={themeColors?.text || colors.text}
          mutedColor={themeColors?.textSecondary || colors.textSecondary}
          cardColor={isDark ? 'rgba(15,23,42,0.5)' : '#F8FAFC'}
          borderColor={isDark ? 'rgba(148,163,184,0.3)' : '#E2E8F0'}
        />

        {achievementSections.map((section) => (
          <View key={section.id} style={styles.achievementSection}>
            <Text style={styles.achievementSectionTitle}>{section.title}</Text>
            <View style={styles.achievementGrid}>
              {section.badges.map((badge) => (
                <AchievementBadge
                  key={badge.id}
                  badge={badge}
                  onPress={() => handleAssignBadge(badge)}
                  style={styles.achievementTile}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColorsParam = colors, isDark = false) => {
  const baseText = themeColorsParam?.text || colors.text;
  const mutedText = themeColorsParam?.textSecondary || colors.textSecondary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColorsParam?.background || colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColorsParam?.inputBackground || colors.inputBackground,
      borderWidth: 1,
      borderColor: themeColorsParam?.border || colors.border,
    },
    headerTitle: {
      ...typography.h2,
      color: baseText,
    },
    headerSpacer: {
      width: 40,
    },
    summaryCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: isDark ? '#1E293B' : '#DBEAFE',
      backgroundColor: isDark ? '#0F1E46' : '#EFF6FF',
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadows.small,
    },
    summaryTitle: {
      ...typography.caption,
      color: mutedText,
      fontWeight: '700',
      marginBottom: 2,
    },
    summaryValue: {
      ...typography.h1,
      color: baseText,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    summarySubtitle: {
      ...typography.bodySmall,
      color: mutedText,
    },
    historyCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: isDark ? '#1E293B' : '#E2E8F0',
      backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : '#FFFFFF',
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    historyTitle: {
      ...typography.body,
      color: baseText,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(148,163,184,0.18)' : '#F1F5F9',
    },
    historyLabel: {
      ...typography.bodySmall,
      color: baseText,
      flex: 1,
    },
    historyDate: {
      ...typography.caption,
      color: mutedText,
      fontWeight: '600',
    },
    achievementSection: {
      marginTop: spacing.lg,
    },
    achievementSectionTitle: {
      ...typography.h3,
      color: baseText,
      marginBottom: spacing.sm,
    },
    achievementGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    achievementTile: {
      width: '31.5%',
    },
  });
};

export default AchievementsScreen;
