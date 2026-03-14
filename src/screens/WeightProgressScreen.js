import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import useWeightManagerOverview from '../hooks/useWeightManagerOverview';
import { computeWeightManagerPlan } from '../utils/weightManager';
import {
  buildWeightProgressPayload,
  DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES,
  formatProgressAxisDate,
  formatProgressDateLabel,
  formatProgressEntryDate,
  getWeightProgressStorageKey,
  mergeWeightProgressPayload,
  normalizePositiveWeight,
  toDateKey,
  withTodayProgressEntry,
} from '../utils/weightProgress';

const MAX_GRAPH_POINTS = 30;
const MAX_STORED_ENTRIES = DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES;
const MAX_VISIBLE_ENTRIES = 25;
const Y_AXIS_TICKS = 4;

const formatRemainingTime = (days) => {
  const parsedDays = Math.round(Number(days) || 0);
  if (!Number.isFinite(parsedDays) || parsedDays <= 0) return 'Target reached';
  if (parsedDays < 7) return `${parsedDays} day${parsedDays === 1 ? '' : 's'}`;
  const weeks = Math.round(parsedDays / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
};

const formatTargetDate = (value) => {
  const parsed = value ? new Date(`${value}T12:00:00`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const buildXAxisTickIndices = (pointCount, maxLabels = 4) => {
  if (!Number.isFinite(pointCount) || pointCount <= 0) return [];
  if (pointCount <= maxLabels) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }

  const lastIndex = pointCount - 1;
  const indices = new Set([0, lastIndex]);

  for (let labelIdx = 1; labelIdx < maxLabels - 1; labelIdx += 1) {
    indices.add(Math.round((labelIdx * lastIndex) / (maxLabels - 1)));
  }

  return Array.from(indices).sort((a, b) => a - b);
};

const WeightProgressScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const {
    authUser,
    themeColors,
    themeName,
    profile,
    weightManagerLogs,
  } = useApp();
  const {
    weightManagerUnit,
    weightManagerPlan,
    weightManagerState,
    weightManagerIsActive,
  } = useWeightManagerOverview();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const isDark = themeName === 'dark';

  const progressTheme = useMemo(
    () => ({
      background: isDark ? themeColors.background : '#F7F5F0',
      gradient: isDark ? ['#4C4AE0', '#6C4FFB'] : ['#6E7BFF', '#7A6BFF'],
      card: isDark ? '#1B1E2F' : '#FFFFFF',
      cardBorder: isDark ? 'rgba(255,255,255,0.08)' : '#EEEAF7',
      softBorder: isDark ? 'rgba(255,255,255,0.12)' : '#EEF0FF',
      muted: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280',
      highlight: isDark ? '#A78BFA' : '#6D78FF',
      chartLine: isDark ? '#A78BFA' : '#5D6DFF',
      chartGrid: isDark ? 'rgba(255,255,255,0.13)' : '#E5E9FF',
      chartDot: isDark ? '#D1C6FF' : '#4F5FFF',
      updateGradient: isDark ? ['#6D78FF', '#7C3AED'] : ['#7A7BFF', '#6C63FF'],
      positive: isDark ? '#6EE7B7' : '#059669',
      negative: isDark ? '#FDBA74' : '#EA580C',
    }),
    [isDark, themeColors]
  );

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
  const [progressSavedMessage, setProgressSavedMessage] = useState('');
  const [showProgressEditor, setShowProgressEditor] = useState(false);

  const hydrateProgress = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(progressStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      const normalized = mergeWeightProgressPayload({
        payload: parsed,
        logs: weightManagerLogs,
        startingWeight: weightManagerState?.startingWeight,
        maxEntries: MAX_STORED_ENTRIES,
      });
      setProgressStartInput(
        Number.isFinite(normalized.startingWeight) ? String(normalized.startingWeight) : ''
      );
      setProgressCurrentInput(
        Number.isFinite(normalized.currentWeight) ? String(normalized.currentWeight) : ''
      );
      setProgressEntries(normalized.entries);
      setProgressSavedMessage('');
    } catch (error) {
      console.log('Error loading weight progress check:', error);
    }
  }, [progressStorageKey, weightManagerLogs, weightManagerState?.startingWeight]);

  useEffect(() => {
    hydrateProgress();
  }, [hydrateProgress]);

  useFocusEffect(
    useCallback(() => {
      hydrateProgress();
      return undefined;
    }, [hydrateProgress])
  );

  const progressStartValue = normalizePositiveWeight(progressStartInput);
  const progressCurrentValue = normalizePositiveWeight(progressCurrentInput);
  const progressDifference =
    Number.isFinite(progressStartValue) && Number.isFinite(progressCurrentValue)
      ? Math.round((progressCurrentValue - progressStartValue) * 10) / 10
      : null;
  const progressChangePercent =
    Number.isFinite(progressDifference) && Number.isFinite(progressStartValue) && progressStartValue > 0
      ? (progressDifference / progressStartValue) * 100
      : null;
  const progressDifferenceLabel = Number.isFinite(progressDifference)
    ? `${progressDifference > 0 ? '+' : ''}${progressDifference.toFixed(1)} ${weightManagerUnit}`
    : '--';
  const progressDifferenceTone = Number.isFinite(progressDifference)
    ? progressDifference > 0
      ? progressTheme.negative
      : progressDifference < 0
      ? progressTheme.positive
      : themeColors.text
    : themeColors.text;

  const latestProgressEntry = progressEntries.length ? progressEntries[progressEntries.length - 1] : null;
  const entriesForList = useMemo(
    () => [...progressEntries].reverse().slice(0, MAX_VISIBLE_ENTRIES),
    [progressEntries]
  );
  const projectedJourneyPlan = useMemo(() => {
    if (!weightManagerIsActive || !weightManagerState) return null;

    const journeyWeeks = Number(weightManagerState?.journeyDurationWeeks);
    const journeyDurationDays =
      weightManagerState?.journeyGoalMode === 'duration' &&
      Number.isFinite(journeyWeeks) &&
      journeyWeeks > 0
        ? Math.round(journeyWeeks * 7)
        : null;
    const journeyEndDate =
      weightManagerState?.journeyGoalMode === 'date' ? weightManagerState?.journeyGoalDate : null;
    const storedCurrentWeight = Number(weightManagerState?.currentWeight);
    const resolvedCurrentWeight = Number.isFinite(progressCurrentValue)
      ? progressCurrentValue
      : Number.isFinite(storedCurrentWeight) && storedCurrentWeight > 0
      ? storedCurrentWeight
      : null;

    if (!Number.isFinite(resolvedCurrentWeight)) {
      return weightManagerPlan || null;
    }

    return (
      computeWeightManagerPlan({
        startingWeight: weightManagerState?.startingWeight,
        currentWeight: resolvedCurrentWeight,
        targetWeight: weightManagerState?.targetWeight,
        unit: weightManagerState?.weightUnit,
        currentBodyTypeKey: weightManagerState?.currentBodyType,
        targetBodyTypeKey: weightManagerState?.targetBodyType,
        goalFocusKey: weightManagerState?.goalFocusKey,
        activityLevelKey: weightManagerState?.activityLevelKey,
        sex: weightManagerState?.sex,
        ageYears: weightManagerState?.ageYears,
        heightCm: weightManagerState?.heightCm,
        journeyDurationDays,
        journeyEndDate,
      }) || weightManagerPlan
    );
  }, [
    progressCurrentValue,
    weightManagerIsActive,
    weightManagerPlan,
    weightManagerState,
  ]);
  const rawJourneyTargetWeight = Number(weightManagerState?.targetWeight);
  const journeyTargetWeight =
    Number.isFinite(rawJourneyTargetWeight) && rawJourneyTargetWeight > 0
      ? rawJourneyTargetWeight
      : null;
  const journeyCountdownLabel = useMemo(() => {
    if (!projectedJourneyPlan) return '';
    if (Number.isFinite(progressCurrentValue) && Number.isFinite(journeyTargetWeight) && progressCurrentValue <= journeyTargetWeight) {
      return 'Target reached';
    }
    return formatRemainingTime(projectedJourneyPlan?.estimatedDays);
  }, [journeyTargetWeight, progressCurrentValue, projectedJourneyPlan]);
  const journeyCountdownDetail = useMemo(() => {
    if (!projectedJourneyPlan) return '';
    if (journeyCountdownLabel === 'Target reached') {
      return 'You are at or below your target from this plan. Keep logging your weight to hold the result.';
    }
    const targetText = Number.isFinite(journeyTargetWeight)
      ? `${journeyTargetWeight} ${weightManagerUnit}`
      : 'your target';
    return `At your current pace, you are about ${journeyCountdownLabel.toLowerCase()} away from ${targetText} and projected to finish by ${formatTargetDate(projectedJourneyPlan.projectedEndDateISO)}.`;
  }, [journeyCountdownLabel, journeyTargetWeight, projectedJourneyPlan, weightManagerUnit]);

  const graphPoints = useMemo(() => {
    const basePoints = [...progressEntries];
    if (!Number.isFinite(progressCurrentValue)) {
      return basePoints.slice(-MAX_GRAPH_POINTS);
    }

    const todayKey = toDateKey(new Date());
    const latest = basePoints.length ? basePoints[basePoints.length - 1] : null;
    if (!latest || latest.dateKey !== todayKey || Math.abs((latest.weight || 0) - progressCurrentValue) > 0.0001) {
      return withTodayProgressEntry({
        entries: basePoints,
        weight: progressCurrentValue,
        maxEntries: MAX_GRAPH_POINTS,
      }).slice(-MAX_GRAPH_POINTS);
    }

    return basePoints.slice(-MAX_GRAPH_POINTS);
  }, [progressCurrentValue, progressEntries]);

  const chartWidth = useMemo(
    () => Math.max(250, Math.min(windowWidth - spacing.xl * 2 - spacing.lg * 2, 420)),
    [windowWidth]
  );
  const chartHeight = 176;
  const yAxisWidth = 44;
  const plotWidth = chartWidth - yAxisWidth;

  const chartGeometry = useMemo(() => {
    if (!graphPoints.length) return null;

    const values = graphPoints.map((point) => point.weight);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const dynamicPadding = rawMax === rawMin ? Math.max(0.6, rawMax * 0.02) : (rawMax - rawMin) * 0.2;
    const minValue = Math.max(0, rawMin - dynamicPadding);
    const maxValue = rawMax + dynamicPadding;
    const span = Math.max(0.2, maxValue - minValue);

    const plotPaddingX = 8;
    const plotPaddingY = 10;
    const innerWidth = Math.max(1, plotWidth - plotPaddingX * 2);
    const innerHeight = Math.max(1, chartHeight - plotPaddingY * 2);

    const mapX = (index) => {
      if (graphPoints.length <= 1) return plotPaddingX + innerWidth / 2;
      return plotPaddingX + (index * innerWidth) / (graphPoints.length - 1);
    };

    const mapY = (value) => plotPaddingY + ((maxValue - value) / span) * innerHeight;

    const points = graphPoints.map((point, index) => ({
      ...point,
      x: mapX(index),
      y: mapY(point.weight),
    }));

    const path =
      points.length > 1
        ? points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
            .join(' ')
        : '';

    const yTicks = Array.from({ length: Y_AXIS_TICKS }, (_, index) => {
      const ratio = index / Math.max(1, Y_AXIS_TICKS - 1);
      const value = maxValue - ratio * span;
      return {
        key: `weight-progress-y-${index}`,
        value,
        y: mapY(value),
      };
    });

    const xTicks = buildXAxisTickIndices(points.length, 4).map((pointIndex) => {
      const point = points[pointIndex];
      return {
        key: `weight-progress-x-${pointIndex}`,
        x: point?.x ?? plotPaddingX,
        label: formatProgressAxisDate(point?.dateKey),
      };
    });

    return {
      points,
      path,
      yTicks,
      xTicks,
    };
  }, [chartHeight, graphPoints, plotWidth]);

  const handleSaveProgressCheck = useCallback(async () => {
    const normalizedStart = normalizePositiveWeight(progressStartInput);
    const normalizedCurrent = normalizePositiveWeight(progressCurrentInput);
    if (!Number.isFinite(normalizedStart) || !Number.isFinite(normalizedCurrent)) {
      Alert.alert(
        'Enter valid weights',
        'Please enter positive values for both starting and current weight.'
      );
      return;
    }

    const nextPayload = buildWeightProgressPayload({
      payload: {
        startingWeight: normalizedStart,
        currentWeight: normalizePositiveWeight(progressCurrentInput),
        entries: progressEntries,
      },
      startingWeight: normalizedStart,
      currentWeight: normalizedCurrent,
      maxEntries: MAX_STORED_ENTRIES,
    });

    setProgressStartInput(
      Number.isFinite(nextPayload.startingWeight) ? String(nextPayload.startingWeight) : ''
    );
    setProgressCurrentInput(
      Number.isFinite(nextPayload.currentWeight) ? String(nextPayload.currentWeight) : ''
    );
    setProgressEntries(nextPayload.entries);
    setProgressSavedMessage(
      weightManagerIsActive
        ? 'Progress check saved. Your target countdown is updated below.'
        : 'Progress check saved.'
    );
    setShowProgressEditor(false);

    try {
      await AsyncStorage.setItem(progressStorageKey, JSON.stringify(nextPayload));
    } catch (error) {
      console.log('Error saving weight progress check:', error);
      Alert.alert('Unable to save progress check', 'Please try again.');
    }
  }, [
    progressCurrentInput,
    progressEntries,
    progressStartInput,
    progressStorageKey,
    weightManagerIsActive,
  ]);

  const performDeleteProgressEntry = useCallback(
    async (entryDateKey) => {
      if (!entryDateKey) return;

      const previousEntries = [...(progressEntries || [])];
      const nextEntries = previousEntries.filter((entry) => entry?.dateKey !== entryDateKey);
      const deletedLatestEntry =
        previousEntries.length > 0 &&
        previousEntries[previousEntries.length - 1]?.dateKey === entryDateKey;

      const nextCurrentWeightValue = deletedLatestEntry
        ? nextEntries[nextEntries.length - 1]?.weight ?? null
        : normalizePositiveWeight(progressCurrentInput);
      const nextCurrentInput = Number.isFinite(nextCurrentWeightValue)
        ? String(nextCurrentWeightValue)
        : '';

      setProgressEntries(nextEntries);
      if (deletedLatestEntry) {
        setProgressCurrentInput(nextCurrentInput);
      }
      setProgressSavedMessage('Progress check deleted.');

      try {
        await AsyncStorage.setItem(
          progressStorageKey,
          JSON.stringify({
            startingWeight: normalizePositiveWeight(progressStartInput),
            currentWeight: normalizePositiveWeight(nextCurrentInput),
            entries: nextEntries,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.log('Error deleting weight progress check:', error);
        Alert.alert('Unable to delete progress check', 'Please try again.');
      }
    },
    [progressCurrentInput, progressEntries, progressStartInput, progressStorageKey]
  );

  const handleDeleteProgressEntry = useCallback(
    (entryDateKey) => {
      Alert.alert(
        'Delete progress check?',
        'This check-in will be removed from your history.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void performDeleteProgressEntry(entryDateKey);
            },
          },
        ]
      );
    },
    [performDeleteProgressEntry]
  );

  return (
    <View style={[styles.container, { backgroundColor: progressTheme.background }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={progressTheme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroGradient, { paddingTop: insets.top + spacing.sm }]}
        >
          <View style={styles.heroNav}>
            <TouchableOpacity style={styles.heroNavButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.heroNavTitle}>Progress</Text>
            <TouchableOpacity
              style={styles.heroNavButton}
              onPress={() => setShowProgressEditor((prev) => !prev)}
            >
              <Ionicons name={showProgressEditor ? 'close' : 'add'} size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroSubtitle}>
            Track your weight trend over time and keep your goal timeline on track.
          </Text>
        </LinearGradient>

        <View style={[styles.sectionCard, { backgroundColor: progressTheme.card, borderColor: progressTheme.cardBorder }]}>
          <View style={styles.metricTopRow}>
            <View style={styles.metricTypeWrap}>
              <Ionicons name="bar-chart-outline" size={16} color={progressTheme.highlight} />
              <Text style={[styles.metricTypeText, { color: themeColors.text }]}>Weight</Text>
            </View>
            <View style={[styles.periodPill, { backgroundColor: progressTheme.softBorder }]}>
              <Ionicons name="calendar-outline" size={14} color={progressTheme.highlight} />
              <Text style={[styles.periodPillText, { color: progressTheme.highlight }]}>1 Month</Text>
            </View>
          </View>

          <View style={styles.metricSummaryRow}>
            <View style={styles.metricSummaryItem}>
              <Text style={[styles.metricSummaryValue, { color: themeColors.text }]}>
                {Number.isFinite(progressStartValue) ? `${progressStartValue.toFixed(1)} ${weightManagerUnit}` : '--'}
              </Text>
              <Text style={[styles.metricSummaryLabel, { color: progressTheme.muted }]}>START</Text>
            </View>
            <View style={styles.metricSummaryItem}>
              <Text style={[styles.metricSummaryValue, { color: themeColors.text }]}>
                {Number.isFinite(progressCurrentValue) ? `${progressCurrentValue.toFixed(1)} ${weightManagerUnit}` : '--'}
              </Text>
              <Text style={[styles.metricSummaryLabel, { color: progressTheme.muted }]}>CURRENT</Text>
            </View>
            <View style={styles.metricSummaryItem}>
              <Text style={[styles.metricSummaryValue, { color: progressDifferenceTone }]}>
                {progressDifferenceLabel}
              </Text>
              <Text style={[styles.metricSummaryLabel, { color: progressTheme.muted }]}>
                {Number.isFinite(progressChangePercent)
                  ? `CHANGE (${progressChangePercent > 0 ? '+' : ''}${progressChangePercent.toFixed(0)}%)`
                  : 'CHANGE'}
              </Text>
            </View>
          </View>

          {projectedJourneyPlan ? (
            <View style={[styles.journeyCountdownCard, { backgroundColor: progressTheme.softBorder }]}>
              <View style={styles.journeyCountdownHeader}>
                <Ionicons name="flag-outline" size={16} color={progressTheme.highlight} />
                <Text style={[styles.journeyCountdownTitle, { color: themeColors.text }]}>
                  Time left to target
                </Text>
              </View>
              <Text style={[styles.journeyCountdownValue, { color: themeColors.text }]}>
                {journeyCountdownLabel}
              </Text>
              <Text style={[styles.journeyCountdownDetail, { color: progressTheme.muted }]}>
                {journeyCountdownDetail}
              </Text>
              <Text style={[styles.journeyCountdownHint, { color: progressTheme.highlight }]}>
                Keep your weight up to date here to stay closer to your goals.
              </Text>
            </View>
          ) : null}

          {showProgressEditor ? (
            <View style={styles.editorPanel}>
              <View style={styles.editorInputsRow}>
                <View style={styles.editorInputItem}>
                  <Text style={[styles.editorInputLabel, { color: progressTheme.muted }]}>
                    Starting ({weightManagerUnit})
                  </Text>
                  <TextInput
                    value={progressStartInput}
                    onChangeText={(value) => {
                      setProgressStartInput(value);
                      if (progressSavedMessage) setProgressSavedMessage('');
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={progressTheme.muted}
                    style={[
                      styles.editorInput,
                      {
                        color: themeColors.text,
                        borderColor: progressTheme.softBorder,
                        backgroundColor: progressTheme.background,
                      },
                    ]}
                  />
                </View>
                <View style={styles.editorInputItem}>
                  <Text style={[styles.editorInputLabel, { color: progressTheme.muted }]}>
                    Current ({weightManagerUnit})
                  </Text>
                  <TextInput
                    value={progressCurrentInput}
                    onChangeText={(value) => {
                      setProgressCurrentInput(value);
                      if (progressSavedMessage) setProgressSavedMessage('');
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={progressTheme.muted}
                    style={[
                      styles.editorInput,
                      {
                        color: themeColors.text,
                        borderColor: progressTheme.softBorder,
                        backgroundColor: progressTheme.background,
                      },
                    ]}
                  />
                </View>
              </View>

              <TouchableOpacity activeOpacity={0.9} style={styles.saveWrap} onPress={handleSaveProgressCheck}>
                <LinearGradient colors={progressTheme.updateGradient} style={styles.saveButton}>
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.saveText}>Save progress check</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : null}

          {progressSavedMessage ? (
            <Text style={[styles.savedMessage, { color: progressTheme.highlight }]}>
              {progressSavedMessage}
            </Text>
          ) : null}

          <View style={[styles.chartCard, { borderColor: progressTheme.softBorder }]}>
            {chartGeometry ? (
              <>
                <View style={styles.chartWrap}>
                  <View style={[styles.yAxisLabels, { height: chartHeight }]}>
                    {chartGeometry.yTicks.map((tick) => (
                      <Text key={tick.key} style={[styles.yAxisLabelText, { color: progressTheme.muted }]}>
                        {tick.value.toFixed(1)}
                      </Text>
                    ))}
                  </View>

                  <View style={{ width: plotWidth }}>
                    <Svg width={plotWidth} height={chartHeight}>
                      {chartGeometry.yTicks.map((tick) => (
                        <Path
                          key={`${tick.key}-line`}
                          d={`M 8 ${tick.y} H ${plotWidth - 8}`}
                          stroke={progressTheme.chartGrid}
                          strokeWidth={1}
                        />
                      ))}
                      {chartGeometry.path ? (
                        <Path
                          d={chartGeometry.path}
                          stroke={progressTheme.chartLine}
                          strokeWidth={2.6}
                          fill="none"
                        />
                      ) : null}
                      {chartGeometry.points.map((point, index) => (
                        <Circle
                          key={`progress-dot-${point.dateKey}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={3.8}
                          fill={progressTheme.chartDot}
                          stroke={progressTheme.card}
                          strokeWidth={2}
                        />
                      ))}
                    </Svg>

                    <View style={styles.xAxisLabelsWrap}>
                      {chartGeometry.xTicks.map((tick) => (
                        <Text
                          key={tick.key}
                          style={[
                            styles.xAxisLabelText,
                            {
                              color: progressTheme.muted,
                              left: Math.min(Math.max(tick.x - 18, 0), plotWidth - 36),
                            },
                          ]}
                        >
                          {tick.label}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>

                {latestProgressEntry ? (
                  <Text style={[styles.latestEntryMeta, { color: progressTheme.muted }]}>
                    Last check-in {formatProgressDateLabel(latestProgressEntry.dateKey)}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.chartEmpty, { color: progressTheme.muted }]}>
                Tap + to add your first weight entry.
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: progressTheme.card, borderColor: progressTheme.cardBorder }]}>
          <View style={styles.entriesHeaderRow}>
            <Text style={[styles.entriesTitle, { color: themeColors.text }]}>Progress checks</Text>
            <Text style={[styles.entriesMeta, { color: progressTheme.muted }]}>
              {progressEntries.length} total
            </Text>
          </View>

          {entriesForList.length ? (
            entriesForList.map((entry, index) => (
              <View
                key={`weight-progress-entry-${entry.dateKey}-${index}`}
                style={[
                  styles.entryRow,
                  {
                    borderBottomColor: progressTheme.softBorder,
                    borderBottomWidth: index === entriesForList.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.entryValue, { color: themeColors.text }]}>
                    {entry.weight.toFixed(1)} {weightManagerUnit}
                  </Text>
                  <Text style={[styles.entryDate, { color: progressTheme.muted }]}>
                    {formatProgressEntryDate(entry.dateKey)}
                  </Text>
                </View>
                <View style={styles.entryActions}>
                  <Ionicons name="analytics-outline" size={18} color={progressTheme.highlight} />
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleDeleteProgressEntry(entry.dateKey)}
                    style={[styles.entryDeleteButton, { borderColor: progressTheme.softBorder }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete progress check for ${formatProgressEntryDate(entry.dateKey)}`}
                  >
                    <Ionicons name="close" size={14} color={progressTheme.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.entriesEmpty, { color: progressTheme.muted }]}>
              No progress checks yet. Use + to add your first check.
            </Text>
          )}
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
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    heroNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroNavTitle: {
      ...typography.h3,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    heroSubtitle: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.9)',
      marginTop: spacing.xs,
    },
    sectionCard: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      ...shadows.small,
    },
    metricTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    metricTypeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    metricTypeText: {
      ...typography.body,
      marginLeft: spacing.xs,
      fontWeight: '700',
    },
    periodPill: {
      borderRadius: borderRadius.full,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    periodPillText: {
      ...typography.caption,
      fontWeight: '700',
    },
    metricSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    metricSummaryItem: {
      flex: 1,
    },
    journeyCountdownCard: {
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    journeyCountdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    journeyCountdownTitle: {
      ...typography.bodySmall,
      fontWeight: '700',
      marginLeft: spacing.xs,
    },
    journeyCountdownValue: {
      ...typography.h3,
      marginTop: 2,
    },
    journeyCountdownDetail: {
      ...typography.bodySmall,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    journeyCountdownHint: {
      ...typography.caption,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    metricSummaryValue: {
      ...typography.body,
      fontWeight: '700',
      fontSize: 18,
    },
    metricSummaryLabel: {
      ...typography.caption,
      marginTop: 2,
      letterSpacing: 0.3,
    },
    editorPanel: {
      marginTop: spacing.md,
    },
    editorInputsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    editorInputItem: {
      flex: 1,
    },
    editorInputLabel: {
      ...typography.caption,
      marginBottom: spacing.xs,
    },
    editorInput: {
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.bodySmall,
    },
    saveWrap: {
      marginTop: spacing.md,
    },
    saveButton: {
      borderRadius: borderRadius.full,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      ...typography.bodySmall,
      color: '#FFFFFF',
      fontWeight: '700',
      marginLeft: spacing.xs,
    },
    savedMessage: {
      ...typography.caption,
      marginTop: spacing.sm,
      fontWeight: '600',
      textAlign: 'center',
    },
    chartCard: {
      marginTop: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    chartWrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    yAxisLabels: {
      width: 44,
      justifyContent: 'space-between',
      paddingRight: spacing.xs,
    },
    yAxisLabelText: {
      ...typography.caption,
      textAlign: 'right',
    },
    xAxisLabelsWrap: {
      position: 'relative',
      height: 20,
      marginTop: spacing.xs,
    },
    xAxisLabelText: {
      ...typography.caption,
      position: 'absolute',
      width: 36,
      textAlign: 'center',
    },
    chartEmpty: {
      ...typography.bodySmall,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    latestEntryMeta: {
      ...typography.caption,
      marginTop: spacing.xs,
      textAlign: 'right',
    },
    entriesHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    entriesTitle: {
      ...typography.h3,
    },
    entriesMeta: {
      ...typography.caption,
      fontWeight: '600',
    },
    entryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    entryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    entryDeleteButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryValue: {
      ...typography.body,
      fontWeight: '700',
    },
    entryDate: {
      ...typography.bodySmall,
      marginTop: 2,
    },
    entriesEmpty: {
      ...typography.bodySmall,
      paddingVertical: spacing.sm,
    },
  });

export default WeightProgressScreen;
