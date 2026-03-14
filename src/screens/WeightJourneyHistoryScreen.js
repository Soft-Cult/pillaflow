import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import {
  DEFAULT_WEIGHT_MANAGER_UNIT,
  WEIGHT_MANAGER_BODY_TYPE_MAP,
} from '../utils/weightManager';
import {
  buildCurrentJourneyEntry,
  getWeightJourneyHistoryStorageKey,
  getWeightManagerStateStorageKey,
  isJourneyPlanActive,
  normalizeWeightManagerState,
  parseWeightJourneyHistoryPayload,
  WEIGHT_MANAGER_PLAN_STATUS_ACTIVE,
} from '../utils/weightJourneyHistory';

const formatDateLabel = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatWeightLabel = (value, unit) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '--';
  return `${parsed.toFixed(1)} ${unit || DEFAULT_WEIGHT_MANAGER_UNIT}`;
};

const WeightJourneyHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    profile,
    authUser,
    weightManagerLogs,
    ensureWeightManagerLogsLoaded,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const [journeyHistory, setJourneyHistory] = useState([]);
  const [activeJourney, setActiveJourney] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const stateStorageKey = useMemo(
    () =>
      getWeightManagerStateStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );
  const historyStorageKey = useMemo(
    () =>
      getWeightJourneyHistoryStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureWeightManagerLogsLoaded();

      let nextHistory = [];
      const historyRaw = await AsyncStorage.getItem(historyStorageKey);
      if (historyRaw) {
        try {
          nextHistory = parseWeightJourneyHistoryPayload(JSON.parse(historyRaw));
        } catch (err) {
          console.log('Error parsing weight journey history:', err);
        }
      }

      let nextActiveJourney = null;
      const stateRaw = await AsyncStorage.getItem(stateStorageKey);
      if (stateRaw) {
        try {
          const parsedState = normalizeWeightManagerState(JSON.parse(stateRaw));
          if (isJourneyPlanActive(parsedState) || Number(profile?.weightManagerTargetCalories) > 0) {
            nextActiveJourney = buildCurrentJourneyEntry({
              state: {
                ...parsedState,
                planStatus: WEIGHT_MANAGER_PLAN_STATUS_ACTIVE,
              },
              logs: weightManagerLogs,
            });
          }
        } catch (err) {
          console.log('Error parsing active weight journey state:', err);
        }
      }

      setJourneyHistory(nextHistory);
      setActiveJourney(nextActiveJourney);
    } catch (err) {
      console.log('Error loading weight journey history:', err);
      setJourneyHistory([]);
      setActiveJourney(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    ensureWeightManagerLogsLoaded,
    historyStorageKey,
    profile?.weightManagerTargetCalories,
    stateStorageKey,
    weightManagerLogs,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      return undefined;
    }, [loadHistory])
  );

  const listEntries = useMemo(
    () => (activeJourney ? [activeJourney, ...journeyHistory] : journeyHistory),
    [activeJourney, journeyHistory]
  );

  const openJourney = (journey) => {
    navigation.navigate('WeightJourneyHistoryDetail', { journey });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Weight Loss History</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>
          Review current and past journeys. Tap a journey to see its full details.
        </Text>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeJourney ? 1 : 0}</Text>
              <Text style={styles.summaryLabel}>Current</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{journeyHistory.length}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{listEntries.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </Card>

        <Card style={styles.listCard}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Journeys</Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={themeColors.primary} />
            </View>
          ) : listEntries.length ? (
            listEntries.map((journey, index) => {
              const isActive = journey.status === 'active';
              const metaDate = isActive
                ? `Started ${formatDateLabel(journey.createdAt)}`
                : `Completed ${formatDateLabel(journey.completedAt || journey.createdAt)}`;
              const unit = journey.unit || DEFAULT_WEIGHT_MANAGER_UNIT;
              const targetBody = WEIGHT_MANAGER_BODY_TYPE_MAP[journey.targetBodyType]?.label || 'Body goal';
              return (
                <TouchableOpacity
                  key={`${journey.id}-${journey.status}`}
                  activeOpacity={0.9}
                  style={[
                    styles.journeyRow,
                    index === listEntries.length - 1 && styles.journeyRowLast,
                  ]}
                  onPress={() => openJourney(journey)}
                >
                  <View style={styles.journeyIconWrap}>
                    <Ionicons
                      name={isActive ? 'walk' : 'checkmark-circle'}
                      size={16}
                      color={isActive ? themeColors.primary : themeColors.success || '#16A34A'}
                    />
                  </View>
                  <View style={styles.journeyContent}>
                    <View style={styles.journeyTitleRow}>
                      <Text style={styles.journeyTitle}>
                        {isActive ? 'Current Journey' : 'Completed Journey'}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isActive ? styles.statusBadgeActive : styles.statusBadgeCompleted,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            isActive ? styles.statusTextActive : styles.statusTextCompleted,
                          ]}
                        >
                          {isActive ? 'Current' : 'Completed'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.journeyMeta}>{metaDate}</Text>
                    <Text style={styles.journeyWeights}>
                      {`${formatWeightLabel(journey.startingWeight, unit)} -> ${formatWeightLabel(
                        journey.targetWeight,
                        unit
                      )}`}
                    </Text>
                    <Text style={styles.journeyMetaSecondary}>
                      {targetBody} | {Number.isFinite(journey.targetCalories) ? `${journey.targetCalories} cal` : '--'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              No journeys yet. Complete your first weight loss journey to build history.
            </Text>
          )}
        </Card>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
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
      marginBottom: spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    title: {
      ...typography.h2,
      color: themeColors.text,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.sm,
    },
    subtitle: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      marginBottom: spacing.lg,
    },
    summaryCard: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryValue: {
      ...typography.h2,
      color: themeColors.text,
      fontWeight: '700',
    },
    summaryLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summaryDivider: {
      width: 1,
      height: 28,
      backgroundColor: themeColors.border,
      marginHorizontal: spacing.sm,
    },
    listCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
      ...shadows.small,
    },
    listHeader: {
      marginBottom: spacing.sm,
    },
    listTitle: {
      ...typography.h3,
      color: themeColors.text,
    },
    loadingWrap: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    journeyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      paddingVertical: spacing.md,
    },
    journeyRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    journeyIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.primaryLight,
      marginRight: spacing.sm,
    },
    journeyContent: {
      flex: 1,
    },
    journeyTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    journeyTitle: {
      ...typography.body,
      color: themeColors.text,
      fontWeight: '700',
      marginRight: spacing.sm,
    },
    statusBadge: {
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    statusBadgeActive: {
      backgroundColor: themeColors.primaryLight,
    },
    statusBadgeCompleted: {
      backgroundColor: 'rgba(22, 163, 74, 0.14)',
    },
    statusText: {
      ...typography.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    statusTextActive: {
      color: themeColors.primary,
    },
    statusTextCompleted: {
      color: themeColors.success || '#16A34A',
    },
    journeyMeta: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    journeyWeights: {
      ...typography.bodySmall,
      color: themeColors.text,
      marginTop: spacing.xs,
      fontWeight: '600',
    },
    journeyMetaSecondary: {
      ...typography.caption,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    emptyText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
      paddingVertical: spacing.md,
    },
  });

export default WeightJourneyHistoryScreen;
