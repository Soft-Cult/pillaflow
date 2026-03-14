import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import useWeightManagerOverview from '../hooks/useWeightManagerOverview';
import {
  formatProgressDateLabel,
  getWeightProgressStorageKey,
  mergeWeightProgressPayload,
  normalizePositiveWeight,
} from '../utils/weightProgress';

const WeightManagerScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    authUser,
    themeColors,
    themeName,
    profile,
    isPremium,
    isPremiumUser,
    weightManagerLogs,
  } = useApp();
  const isDark = themeName === 'dark';
  const {
    weightManagerPlan,
    weightManagerTargetBody,
    weightManagerStartingValue,
    weightManagerCurrentValue,
    weightManagerTargetDisplay,
    weightManagerStartingDisplay,
    weightManagerCurrentDisplay,
    weightManagerUnit,
  } = useWeightManagerOverview();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const isPremiumActive = Boolean(
    isPremiumUser ||
      isPremium ||
      profile?.isPremium ||
      profile?.plan === 'premium' ||
      profile?.plan === 'pro' ||
      profile?.plan === 'paid'
  );

  const summaryTheme = useMemo(
    () => ({
      background: isDark ? themeColors.background : '#F7F5F0',
      gradient: isDark ? ['#4C4AE0', '#6C4FFB'] : ['#6E7BFF', '#7A6BFF'],
      card: isDark ? '#1B1E2F' : '#FFFFFF',
      cardBorder: isDark ? 'rgba(255,255,255,0.08)' : '#EEEAF7',
      softBorder: isDark ? 'rgba(255,255,255,0.12)' : '#EEF0FF',
      muted: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280',
      progressTrack: isDark ? 'rgba(255,255,255,0.12)' : '#E8ECFF',
      progressFill: isDark ? '#A5B4FC' : '#6F7CFF',
      badgeBg: isDark ? '#1F2937' : '#E8F9EF',
      badgeText: isDark ? '#6EE7B7' : '#1E8E5E',
      highlight: isDark ? '#A78BFA' : '#6D78FF',
      macro: {
        protein: '#4A90FF',
        carbs: '#FF8A00',
        fat: '#A855F7',
      },
      tipBg: isDark ? '#26223A' : '#F4ECFF',
      updateGradient: isDark ? ['#6D78FF', '#7C3AED'] : ['#7A7BFF', '#6C63FF'],
    }),
    [isDark, themeColors]
  );

  const targetLabel = weightManagerPlan?.goalFocusLabel || weightManagerTargetBody?.label || 'Target';
  const targetLabelHeading = weightManagerPlan?.goalFocusLabel ? 'Journey Focus' : 'Target Type';
  const targetCalories = Number.isFinite(Number(weightManagerPlan?.targetCalories))
    ? Math.round(Number(weightManagerPlan.targetCalories))
    : Number.isFinite(Number(profile?.weightManagerTargetCalories)) &&
      Number(profile?.weightManagerTargetCalories) > 0
    ? Math.round(Number(profile.weightManagerTargetCalories))
    : null;
  const proteinGoal = Number.isFinite(Number(weightManagerPlan?.proteinGrams))
    ? Math.round(Number(weightManagerPlan.proteinGrams))
    : Number.isFinite(Number(profile?.weightManagerProteinGrams)) &&
      Number(profile?.weightManagerProteinGrams) > 0
    ? Math.round(Number(profile.weightManagerProteinGrams))
    : null;
  const carbsGoal = Number.isFinite(Number(weightManagerPlan?.carbsGrams))
    ? Math.round(Number(weightManagerPlan.carbsGrams))
    : Number.isFinite(Number(profile?.weightManagerCarbsGrams)) &&
      Number(profile?.weightManagerCarbsGrams) > 0
    ? Math.round(Number(profile.weightManagerCarbsGrams))
    : null;
  const fatGoal = Number.isFinite(Number(weightManagerPlan?.fatGrams))
    ? Math.round(Number(weightManagerPlan.fatGrams))
    : Number.isFinite(Number(profile?.weightManagerFatGrams)) &&
      Number(profile?.weightManagerFatGrams) > 0
    ? Math.round(Number(profile.weightManagerFatGrams))
    : null;

  const startingValue = weightManagerStartingValue?.value;
  const currentValue = weightManagerCurrentValue?.value;
  const rawTarget = Number(profile?.weightManagerTargetWeight);
  const fallbackTarget = parseFloat(weightManagerTargetDisplay || '');
  const targetValue = Number.isFinite(rawTarget) ? rawTarget : fallbackTarget;

  const hasProgressData =
    Number.isFinite(startingValue) &&
    Number.isFinite(currentValue) &&
    Number.isFinite(targetValue) &&
    startingValue !== targetValue;
  const totalDelta = hasProgressData ? Math.abs(targetValue - startingValue) : 0;
  const progressed = hasProgressData
    ? Math.min(totalDelta, Math.abs(currentValue - startingValue))
    : 0;
  const progressRatio = totalDelta > 0 ? progressed / totalDelta : 0;
  const remainingValue = hasProgressData ? Math.abs(targetValue - currentValue) : null;

  const recentLogs = (weightManagerLogs || []).slice(0, 7);
  const weekSeries = recentLogs.slice().reverse();
  const weeklyChange =
    recentLogs.length >= 2
      ? Number(recentLogs[0]?.weight) - Number(recentLogs[recentLogs.length - 1]?.weight)
      : null;
  const weeklyChangeText = Number.isFinite(weeklyChange)
    ? `${weeklyChange >= 0 ? '+' : ''}${weeklyChange.toFixed(1)} ${weightManagerUnit}`
    : '--';

  const progressStorageKey = useMemo(
    () =>
      getWeightProgressStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );
  const [progressStartInput, setProgressStartInput] = useState('');
  const [progressCurrentInput, setProgressCurrentInput] = useState('');
  const [progressEntries, setProgressEntries] = useState([]);
  const hydrateProgressCheck = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(progressStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const normalized = mergeWeightProgressPayload({
        payload: parsed,
        logs: weightManagerLogs,
        startingWeight: weightManagerStartingValue?.value,
      });
      setProgressStartInput(
        Number.isFinite(normalized.startingWeight) ? String(normalized.startingWeight) : ''
      );
      setProgressCurrentInput(
        Number.isFinite(normalized.currentWeight) ? String(normalized.currentWeight) : ''
      );
      setProgressEntries(normalized.entries);
    } catch (error) {
      console.log('Error loading weight progress check:', error);
    }
  }, [progressStorageKey, weightManagerLogs, weightManagerStartingValue?.value]);

  useEffect(() => {
    hydrateProgressCheck();
  }, [hydrateProgressCheck]);

  useFocusEffect(
    useCallback(() => {
      hydrateProgressCheck();
      return undefined;
    }, [hydrateProgressCheck])
  );

  const progressStartValue = normalizePositiveWeight(progressStartInput);
  const progressCurrentValue = normalizePositiveWeight(progressCurrentInput);
  const progressDifference =
    Number.isFinite(progressStartValue) && Number.isFinite(progressCurrentValue)
      ? Math.round((progressCurrentValue - progressStartValue) * 10) / 10
      : null;
  const progressDifferenceLabel = Number.isFinite(progressDifference)
    ? `${progressDifference > 0 ? '+' : ''}${progressDifference.toFixed(1)} ${weightManagerUnit}`
    : '--';
  const progressDifferenceHint = Number.isFinite(progressDifference)
    ? progressDifference > 0
      ? 'Gained since start'
      : progressDifference < 0
      ? 'Lost since start'
      : 'No change since start'
    : 'Add starting and current weight to see your change.';
  const latestProgressEntry = progressEntries.length
    ? progressEntries[progressEntries.length - 1]
    : null;

  const handleUnlockWeightJourney = useCallback(() => {
    navigation.navigate('Paywall', { source: 'weight-manager-journey' });
  }, [navigation]);

  const handleUpdatePlan = useCallback(() => {
    if (!isPremiumActive) {
      handleUnlockWeightJourney();
      return;
    }
    navigation.navigate('WeightManagerUpdatePlan');
  }, [handleUnlockWeightJourney, isPremiumActive, navigation]);

  const handleOpenProgressPage = useCallback(() => {
    navigation.navigate('WeightProgress');
  }, [navigation]);

  const formatWeekday = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const label = parsed.toLocaleDateString('en-US', { weekday: 'short' });
    return label.slice(0, 1);
  };

  return (
    <View style={[styles.container, { backgroundColor: summaryTheme.background }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={summaryTheme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: insets.top + spacing.sm }]}
        >
          <View style={styles.heroNav}>
            <View style={styles.heroNavLeft}>
              <TouchableOpacity
                style={styles.heroNavButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.heroNavTitle}>Weight Manager</Text>
            </View>
            <TouchableOpacity
              style={styles.heroNavButton}
              onPress={handleUpdatePlan}
            >
              <Ionicons
                name={isPremiumActive ? 'create-outline' : 'lock-closed'}
                size={20}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroSubtitle}>Track your daily targets and progress.</Text>
        </LinearGradient>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={handleOpenProgressPage}
          style={[styles.sectionCard, { backgroundColor: summaryTheme.card, borderColor: summaryTheme.cardBorder }]}
        >
          <View style={styles.progressCheckHeaderRow}>
            <View style={styles.progressCheckHeaderLeft}>
              <Ionicons name="analytics" size={18} color={summaryTheme.highlight} />
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Weight Progress Check</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={summaryTheme.highlight} />
          </View>

          <Text style={[styles.progressCheckIntro, { color: summaryTheme.muted }]}>
            Keep your weight trend up to date to stay closer to your journey goals.
          </Text>

          <View style={[styles.progressCheckDiffCard, { backgroundColor: summaryTheme.softBorder }]}>
            <Text style={[styles.progressCheckDiffLabel, { color: summaryTheme.muted }]}>Difference</Text>
            <Text style={[styles.progressCheckDiffValue, { color: themeColors.text }]}>
              {progressDifferenceLabel}
            </Text>
            <Text style={[styles.progressCheckDiffHint, { color: summaryTheme.muted }]}>
              {progressDifferenceHint}
            </Text>
            <View style={styles.progressCheckQuickStatsRow}>
              <View style={styles.progressCheckQuickStatBlock}>
                <Text style={[styles.progressCheckQuickStat, { color: summaryTheme.muted }]}>Start</Text>
                <Text style={[styles.progressCheckQuickStatValue, { color: themeColors.text }]}>
                  {Number.isFinite(progressStartValue) ? `${progressStartValue.toFixed(1)} ${weightManagerUnit}` : '--'}
                </Text>
              </View>
              <View style={styles.progressCheckQuickStatBlock}>
                <Text style={[styles.progressCheckQuickStat, { color: summaryTheme.muted }]}>Current</Text>
                <Text style={[styles.progressCheckQuickStatValue, { color: themeColors.text }]}>
                  {Number.isFinite(progressCurrentValue) ? `${progressCurrentValue.toFixed(1)} ${weightManagerUnit}` : '--'}
                </Text>
              </View>
            </View>
            <View style={styles.progressCheckFooterRow}>
              {latestProgressEntry ? (
                <Text style={[styles.progressCheckDiffMeta, { color: summaryTheme.muted }]}>
                  Last check-in {formatProgressDateLabel(latestProgressEntry.dateKey)}
                </Text>
              ) : (
                <Text style={[styles.progressCheckDiffMeta, { color: summaryTheme.muted }]}>
                  Open to add your first progress check
                </Text>
              )}
              <Ionicons name="open-outline" size={15} color={summaryTheme.highlight} />
            </View>
          </View>
        </TouchableOpacity>

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: summaryTheme.card, borderColor: summaryTheme.cardBorder },
            !isPremiumActive && styles.premiumJourneyLockedCard,
          ]}
        >
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTargetType}>
                <View style={styles.summaryIconBubble}>
                  <Ionicons name="body" size={18} color={summaryTheme.highlight} />
                </View>
              <View>
                <Text style={[styles.summaryLabel, { color: summaryTheme.muted }]}>
                  {targetLabelHeading}
                </Text>
                <Text style={[styles.summaryValue, { color: themeColors.text }]}>{targetLabel}</Text>
              </View>
            </View>
            <View style={[styles.summaryDailyTarget, { backgroundColor: summaryTheme.badgeBg }]}
            >
              <Text style={[styles.summaryLabel, { color: summaryTheme.badgeText }]}>Daily Target</Text>
              <Text style={[styles.summaryValue, { color: summaryTheme.badgeText }]}
              >
                {targetCalories ?? '--'}
              </Text>
              <Text style={[styles.summaryMeta, { color: summaryTheme.badgeText }]}>cal/day</Text>
            </View>
          </View>

          <View style={styles.weightRow}>
            <View style={styles.weightItem}>
              <View style={[styles.weightIcon, { backgroundColor: '#DCEBFF' }]}>
                <Ionicons name="flag" size={18} color="#2563EB" />
              </View>
              <Text style={[styles.weightLabel, { color: summaryTheme.muted }]}>Starting</Text>
              <Text style={[styles.weightValue, { color: themeColors.text }]}>
                {weightManagerStartingDisplay || '--'}
              </Text>
            </View>
            <View style={styles.weightConnector} />
            <View style={styles.weightItem}>
              <View style={[styles.weightIcon, { backgroundColor: '#E8F2FF' }]}>
                <Ionicons name="radio-button-on" size={18} color="#2563EB" />
              </View>
              <Text style={[styles.weightLabel, { color: summaryTheme.muted }]}>Current</Text>
              <Text style={[styles.weightValue, { color: themeColors.text }]}>
                {weightManagerCurrentDisplay || '--'}
              </Text>
            </View>
            <View style={styles.weightConnector} />
            <View style={styles.weightItem}>
              <View style={[styles.weightIcon, { backgroundColor: '#F1E6FF' }]}>
                <Ionicons name="ribbon" size={18} color="#7C3AED" />
              </View>
              <Text style={[styles.weightLabel, { color: summaryTheme.muted }]}>Target</Text>
              <Text style={[styles.weightValue, { color: themeColors.text }]}>
                {weightManagerTargetDisplay || '--'}
              </Text>
            </View>
          </View>

          <View style={[styles.progressCard, { backgroundColor: summaryTheme.softBorder }]}
          >
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: themeColors.text }]}>Progress to Goal</Text>
              <Text style={[styles.progressMeta, { color: summaryTheme.highlight }]}
              >
                {Number.isFinite(remainingValue)
                  ? `${remainingValue.toFixed(1)} ${weightManagerUnit} to go`
                  : '--'}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: summaryTheme.progressTrack }]}
            >
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: summaryTheme.progressFill, width: `${Math.round(progressRatio * 100)}%` },
                ]}
              />
            </View>
          </View>
          {!isPremiumActive ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleUnlockWeightJourney}
              style={[
                styles.premiumJourneyLockOverlay,
                { backgroundColor: isDark ? 'rgba(8, 10, 20, 0.82)' : 'rgba(255,255,255,0.86)' },
              ]}
            >
              <View style={[styles.premiumJourneyLockIcon, { backgroundColor: summaryTheme.softBorder }]}>
                <Ionicons name="lock-closed" size={18} color={summaryTheme.highlight} />
              </View>
              <Text style={[styles.premiumJourneyLockTitle, { color: themeColors.text }]}>
                Premium weight-loss journey
              </Text>
              <Text style={[styles.premiumJourneyLockText, { color: summaryTheme.muted }]}>
                Update Plan, daily macro targets, and goal progress are premium features.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: summaryTheme.card, borderColor: summaryTheme.cardBorder },
            !isPremiumActive && styles.premiumJourneyLockedCard,
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={18} color={summaryTheme.highlight} />
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>This Week's Progress</Text>
          </View>
          <View style={styles.weekRow}>
            {weekSeries.length ? (
              weekSeries.map((log, idx) => (
                <View key={log.id || log.logDate || idx} style={styles.weekItem}>
                  <Text style={[styles.weekValue, { color: themeColors.text }]}
                  >
                    {Number.isFinite(log?.weight) ? log.weight.toFixed(1) : '--'}
                  </Text>
                  <Text style={[styles.weekLabel, { color: summaryTheme.muted }]}
                  >
                    {formatWeekday(log?.logDate)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.weekEmpty, { color: summaryTheme.muted }]}>No check-ins yet.</Text>
            )}
          </View>
          <View style={[styles.weekChangeCard, { backgroundColor: summaryTheme.softBorder }]}
          >
            <View>
              <Text style={[styles.weekChangeLabel, { color: summaryTheme.muted }]}>Weekly Change</Text>
              <Text style={[styles.weekChangeValue, { color: themeColors.text }]}
              >
                {weeklyChangeText}
              </Text>
            </View>
            <Ionicons name="trending-up" size={18} color={summaryTheme.highlight} />
          </View>
          {!isPremiumActive ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleUnlockWeightJourney}
              style={[
                styles.premiumJourneyLockOverlay,
                { backgroundColor: isDark ? 'rgba(8, 10, 20, 0.82)' : 'rgba(255,255,255,0.86)' },
              ]}
            >
              <View style={[styles.premiumJourneyLockIcon, { backgroundColor: summaryTheme.softBorder }]}>
                <Ionicons name="lock-closed" size={18} color={summaryTheme.highlight} />
              </View>
              <Text style={[styles.premiumJourneyLockTitle, { color: themeColors.text }]}>
                Premium weight-loss journey
              </Text>
              <Text style={[styles.premiumJourneyLockText, { color: summaryTheme.muted }]}>
                Weekly journey insights unlock with Premium.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={[
            styles.sectionCard,
            { backgroundColor: summaryTheme.card, borderColor: summaryTheme.cardBorder },
            !isPremiumActive && styles.premiumJourneyLockedCard,
          ]}
        >
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Daily Macro Goals</Text>
          <View style={styles.macroRow}>
            <View style={[styles.macroCard, { backgroundColor: summaryTheme.macro.protein }]}
            >
              <Ionicons name="fitness" size={20} color="#FFFFFF" />
              <Text style={styles.macroValue}>{Number.isFinite(proteinGoal) ? `${proteinGoal}g` : '--'}</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={[styles.macroCard, { backgroundColor: summaryTheme.macro.carbs }]}
            >
              <Ionicons name="nutrition" size={20} color="#FFFFFF" />
              <Text style={styles.macroValue}>{Number.isFinite(carbsGoal) ? `${carbsGoal}g` : '--'}</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={[styles.macroCard, { backgroundColor: summaryTheme.macro.fat }]}
            >
              <Ionicons name="leaf" size={20} color="#FFFFFF" />
              <Text style={styles.macroValue}>{Number.isFinite(fatGoal) ? `${fatGoal}g` : '--'}</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
          {!isPremiumActive ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleUnlockWeightJourney}
              style={[
                styles.premiumJourneyLockOverlay,
                { backgroundColor: isDark ? 'rgba(8, 10, 20, 0.82)' : 'rgba(255,255,255,0.86)' },
              ]}
            >
              <View style={[styles.premiumJourneyLockIcon, { backgroundColor: summaryTheme.softBorder }]}>
                <Ionicons name="lock-closed" size={18} color={summaryTheme.highlight} />
              </View>
              <Text style={[styles.premiumJourneyLockTitle, { color: themeColors.text }]}>
                Premium weight-loss journey
              </Text>
              <Text style={[styles.premiumJourneyLockText, { color: summaryTheme.muted }]}>
                Personalized macro goals are available on Premium.
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.updateButtonWrap}
          onPress={handleUpdatePlan}
        >
          <LinearGradient colors={summaryTheme.updateGradient} style={styles.updateButton}
          >
            <Ionicons
              name={isPremiumActive ? 'radio-button-on' : 'lock-closed'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.updateButtonText}>
              {isPremiumActive ? 'Open Weight Loss Journey' : 'Unlock Weight Loss Journey'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={[styles.tipCard, { backgroundColor: summaryTheme.tipBg }]}
        >
          <View style={styles.tipIcon}>
            <Ionicons name="bulb" size={18} color={summaryTheme.highlight} />
          </View>
          <View style={styles.tipContent}>
            <Text style={[styles.tipTitle, { color: themeColors.text }]}>Fitness Tip</Text>
            <Text style={[styles.tipText, { color: summaryTheme.muted }]}>
              Consistency is key. Track your weight at the same time each day for accuracy.
            </Text>
          </View>
        </View>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
      paddingTop: 0,
    },
    heroGradient: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      borderBottomLeftRadius: borderRadius.xxl,
      borderBottomRightRadius: borderRadius.xxl,
    },
    heroNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    heroNavLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    heroNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroNavTitle: {
      ...typography.h3,
      color: '#FFFFFF',
      marginLeft: spacing.sm,
    },
    heroTitle: {
      ...typography.h2,
      color: '#FFFFFF',
    },
    heroSubtitle: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      marginTop: spacing.xs,
    },
    summaryCard: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      ...shadows.medium,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    summaryTargetType: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryIconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EEF2FF',
      marginRight: spacing.sm,
    },
    summaryDailyTarget: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    summaryLabel: {
      ...typography.caption,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summaryValue: {
      ...typography.h3,
      fontWeight: '700',
    },
    summaryMeta: {
      ...typography.caption,
      marginTop: 2,
    },
    weightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    weightItem: {
      flex: 1,
      alignItems: 'center',
    },
    weightIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    weightLabel: {
      ...typography.caption,
      marginBottom: 2,
    },
    weightValue: {
      ...typography.body,
      fontWeight: '600',
    },
    weightConnector: {
      width: 24,
      height: 2,
      backgroundColor: '#DDE1FF',
    },
    progressCard: {
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    progressTitle: {
      ...typography.bodySmall,
      fontWeight: '600',
    },
    progressMeta: {
      ...typography.caption,
      fontWeight: '600',
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    premiumJourneyLockedCard: {
      position: 'relative',
      overflow: 'hidden',
    },
    premiumJourneyLockOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: borderRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    premiumJourneyLockIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    premiumJourneyLockTitle: {
      ...typography.body,
      fontWeight: '700',
      textAlign: 'center',
    },
    premiumJourneyLockText: {
      ...typography.bodySmall,
      textAlign: 'center',
      marginTop: spacing.xs,
      maxWidth: 280,
    },
    sectionCard: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      ...shadows.small,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      marginLeft: spacing.sm,
    },
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    weekItem: {
      alignItems: 'center',
      minWidth: 36,
    },
    weekValue: {
      ...typography.bodySmall,
      fontWeight: '600',
    },
    weekLabel: {
      ...typography.caption,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    weekEmpty: {
      ...typography.bodySmall,
    },
    weekChangeCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
    },
    weekChangeLabel: {
      ...typography.caption,
    },
    weekChangeValue: {
      ...typography.body,
      fontWeight: '700',
      marginTop: 2,
    },
    progressCheckIntro: {
      ...typography.bodySmall,
      marginBottom: spacing.md,
    },
    progressCheckHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressCheckHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    progressCheckDiffCard: {
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    progressCheckDiffLabel: {
      ...typography.caption,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    progressCheckDiffValue: {
      ...typography.h3,
      marginTop: spacing.xs,
    },
    progressCheckDiffHint: {
      ...typography.bodySmall,
      marginTop: spacing.xs,
    },
    progressCheckQuickStatsRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    progressCheckQuickStatBlock: {
      flex: 1,
    },
    progressCheckQuickStat: {
      ...typography.caption,
      flex: 1,
    },
    progressCheckQuickStatValue: {
      ...typography.bodySmall,
      fontWeight: '700',
      marginTop: 2,
    },
    progressCheckFooterRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    progressCheckDiffMeta: {
      ...typography.caption,
      flex: 1,
    },
    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    macroCard: {
      flex: 1,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginHorizontal: spacing.xs,
    },
    macroValue: {
      ...typography.h3,
      color: '#FFFFFF',
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    macroLabel: {
      ...typography.caption,
      color: '#FFFFFF',
      marginTop: spacing.xs,
    },
    updateButtonWrap: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
    },
    updateButton: {
      borderRadius: borderRadius.full,
      paddingVertical: spacing.md,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      ...shadows.medium,
    },
    updateButtonText: {
      ...typography.body,
      color: '#FFFFFF',
      fontWeight: '700',
      marginLeft: spacing.sm,
    },
    tipCard: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.xl,
    },
    tipIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.6)',
      marginRight: spacing.sm,
    },
    tipContent: {
      flex: 1,
    },
    tipTitle: {
      ...typography.body,
      fontWeight: '700',
    },
    tipText: {
      ...typography.bodySmall,
      marginTop: spacing.xs,
    },
    lockedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      backgroundColor: themeColors.background,
    },
    lockedCard: {
      width: '100%',
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.xl,
      alignItems: 'center',
    },
    lockedTitle: {
      ...typography.h3,
      color: themeColors.text,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    lockedText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    lockedButton: {
      marginBottom: spacing.sm,
      alignSelf: 'stretch',
    },
  });

export default WeightManagerScreen;
