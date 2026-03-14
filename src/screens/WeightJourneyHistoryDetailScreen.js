import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { Card, PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import {
  DEFAULT_WEIGHT_MANAGER_UNIT,
  WEIGHT_MANAGER_ACTIVITY_LEVEL_MAP,
  WEIGHT_MANAGER_BODY_TYPE_MAP,
  WEIGHT_MANAGER_GOAL_MAP,
} from '../utils/weightManager';

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value);
  const parsed = raw.includes('T') ? new Date(raw) : new Date(`${raw}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return '--';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return '--';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatWeight = (value, unit) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '--';
  return `${parsed.toFixed(1)} ${unit || DEFAULT_WEIGHT_MANAGER_UNIT}`;
};

const formatSignedCalories = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '--';
  if (parsed > 0) return `+${Math.round(parsed)} cal`;
  if (parsed < 0) return `${Math.round(parsed)} cal`;
  return '0 cal';
};

const formatWeeklyTrend = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '--';
  const sign = parsed > 0 ? '+' : parsed < 0 ? '-' : '';
  return `${sign}${Math.abs(parsed).toFixed(2)} kg/week`;
};

const WeightJourneyHistoryDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { themeColors } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const journey = route?.params?.journey || null;
  const unit = journey?.unit || DEFAULT_WEIGHT_MANAGER_UNIT;
  const checkIns = Array.isArray(journey?.checkIns) ? journey.checkIns : [];
  const visibleCheckIns = checkIns.slice(0, 40);
  const isActiveJourney = journey?.status === 'active';
  const currentBodyLabel =
    WEIGHT_MANAGER_BODY_TYPE_MAP[journey?.currentBodyType]?.label || 'Current';
  const targetBodyLabel =
    WEIGHT_MANAGER_BODY_TYPE_MAP[journey?.targetBodyType]?.label || 'Target';
  const goalFocusLabel =
    WEIGHT_MANAGER_GOAL_MAP[journey?.goalFocusKey]?.label || '--';
  const activityLevelLabel =
    WEIGHT_MANAGER_ACTIVITY_LEVEL_MAP[journey?.activityLevelKey]?.label || '--';

  const timelineLabel =
    journey?.journeyGoalMode === 'date'
      ? `End date ${formatDate(journey?.journeyGoalDate)}`
      : Number.isFinite(Number(journey?.journeyDurationWeeks))
      ? `${Math.round(Number(journey.journeyDurationWeeks))} weeks`
      : '--';

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
          <Text style={styles.title}>Journey Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        {!journey ? (
          <Card style={styles.card}>
            <Text style={styles.emptyText}>Journey details are unavailable.</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Overview</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isActiveJourney ? styles.statusBadgeActive : styles.statusBadgeCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isActiveJourney ? styles.statusTextActive : styles.statusTextCompleted,
                    ]}
                  >
                    {isActiveJourney ? 'Current' : 'Completed'}
                  </Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Started</Text>
                <Text style={styles.metricValue}>{formatDateTime(journey.createdAt)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Completed</Text>
                <Text style={styles.metricValue}>
                  {isActiveJourney ? 'In progress' : formatDateTime(journey.completedAt)}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Reason</Text>
                <Text style={styles.metricValue}>
                  {journey.completedReason ? String(journey.completedReason).replace(/_/g, ' ') : '--'}
                </Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Weight Targets</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Starting weight</Text>
                <Text style={styles.metricValue}>{formatWeight(journey.startingWeight, unit)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Current weight</Text>
                <Text style={styles.metricValue}>{formatWeight(journey.currentWeight, unit)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Goal weight</Text>
                <Text style={styles.metricValue}>{formatWeight(journey.targetWeight, unit)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Current body type</Text>
                <Text style={styles.metricValue}>{currentBodyLabel}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Target body type</Text>
                <Text style={styles.metricValue}>{targetBodyLabel}</Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Timeline</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Goal window</Text>
                <Text style={styles.metricValue}>{timelineLabel}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Projected finish</Text>
                <Text style={styles.metricValue}>{formatDate(journey.projectedEndDateISO)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Timeline target days</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey.timelineTargetDays))
                    ? `${Math.round(Number(journey.timelineTargetDays))} days`
                    : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Timeline met</Text>
                <Text style={styles.metricValue}>
                  {typeof journey.timelineGoalMet === 'boolean'
                    ? journey.timelineGoalMet
                      ? 'Yes'
                      : 'No'
                    : '--'}
                </Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Plan Profile</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Journey focus</Text>
                <Text style={styles.metricValue}>{goalFocusLabel}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Activity level</Text>
                <Text style={styles.metricValue}>{activityLevelLabel}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Gender</Text>
                <Text style={styles.metricValue}>
                  {journey?.sex ? String(journey.sex).replace(/^./, (char) => char.toUpperCase()) : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Age</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey?.ageYears)) ? `${Math.round(Number(journey.ageYears))}` : '--'}
                </Text>
              </View>
              <View style={[styles.metricRow, styles.metricRowLast]}>
                <Text style={styles.metricLabel}>Height</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey?.heightCm)) ? `${Math.round(Number(journey.heightCm))} cm` : '--'}
                </Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Calories & Macros</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Maintenance</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey.maintenanceCalories))
                    ? `${Math.round(Number(journey.maintenanceCalories))} cal`
                    : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Target calories</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey.targetCalories))
                    ? `${Math.round(Number(journey.targetCalories))} cal`
                    : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Daily delta</Text>
                <Text style={styles.metricValue}>{formatSignedCalories(journey.dailyCalorieDelta)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Weekly trend</Text>
                <Text style={styles.metricValue}>{formatWeeklyTrend(journey.weeklyWeightChangeKg)}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Protein</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey.proteinGrams))
                    ? `${Math.round(Number(journey.proteinGrams))} g`
                    : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Carbs</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey.carbsGrams))
                    ? `${Math.round(Number(journey.carbsGrams))} g`
                    : '--'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Fat</Text>
                <Text style={styles.metricValue}>
                  {Number.isFinite(Number(journey.fatGrams))
                    ? `${Math.round(Number(journey.fatGrams))} g`
                    : '--'}
                </Text>
              </View>
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Check-ins</Text>
              {visibleCheckIns.length ? (
                visibleCheckIns.map((entry, index) => (
                  <View
                    key={`${entry.dateKey || entry.loggedAt}-${index}`}
                    style={[
                      styles.checkInRow,
                      index === visibleCheckIns.length - 1 && styles.checkInRowLast,
                    ]}
                  >
                    <Text style={styles.checkInValue}>{formatWeight(entry.weight, entry.unit || unit)}</Text>
                    <Text style={styles.checkInDate}>{formatDate(entry.loggedAt || entry.dateKey)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No check-ins were saved for this journey.</Text>
              )}
            </Card>
          </>
        )}
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
    card: {
      marginBottom: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: themeColors.border,
      backgroundColor: themeColors.card,
      padding: spacing.lg,
      ...shadows.small,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      ...typography.h3,
      color: themeColors.text,
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
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    metricRowLast: {
      borderBottomWidth: 0,
    },
    metricLabel: {
      ...typography.caption,
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginRight: spacing.md,
      flex: 1,
    },
    metricValue: {
      ...typography.bodySmall,
      color: themeColors.text,
      fontWeight: '600',
      textAlign: 'right',
      flexShrink: 1,
    },
    checkInRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    checkInRowLast: {
      borderBottomWidth: 0,
    },
    checkInValue: {
      ...typography.bodySmall,
      color: themeColors.text,
      fontWeight: '600',
    },
    checkInDate: {
      ...typography.caption,
      color: themeColors.textSecondary,
    },
    emptyText: {
      ...typography.bodySmall,
      color: themeColors.textSecondary,
    },
  });

export default WeightJourneyHistoryDetailScreen;
