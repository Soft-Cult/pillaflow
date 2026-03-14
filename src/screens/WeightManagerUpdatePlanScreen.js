import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { Button, Input, PlatformScrollView } from '../components';
import { borderRadius, spacing, typography, shadows } from '../utils/theme';
import {
  computeWeightManagerPlan,
  DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
  DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  DEFAULT_WEIGHT_MANAGER_GOAL,
  DEFAULT_WEIGHT_MANAGER_UNIT,
  WEIGHT_MANAGER_ACTIVITY_LEVELS,
  WEIGHT_MANAGER_BODY_TYPES,
  WEIGHT_MANAGER_GOAL_OPTIONS,
  WEIGHT_MANAGER_SEX_OPTIONS,
  WEIGHT_MANAGER_WEIGHT_UNITS,
} from '../utils/weightManager';
import {
  appendJourneyHistoryEntry,
  createCompletedJourneyEntry,
  getWeightJourneyHistoryStorageKey,
  getWeightManagerStateStorageKey,
  hasJourneyState,
  isJourneyPlanActive,
  normalizeWeightManagerState,
  parseWeightJourneyHistoryPayload,
  WEIGHT_MANAGER_PLAN_STATUS_ACTIVE,
  WEIGHT_MANAGER_PLAN_STATUS_DRAFT,
} from '../utils/weightJourneyHistory';
import {
  buildWeightProgressPayload,
  DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES,
  getWeightProgressStorageKey,
} from '../utils/weightProgress';

const MIN_WEEKS = 4;
const MAX_WEEKS = 24;
const WEEK_PRESETS = [6, 8, 12, 16, 20];
const STEPS = [
  { key: 'goal', title: "What's Your Focus?", subtitle: 'Pick what you want the plan to optimize for.', icon: 'sparkles', accent: ['#FF8A3D', '#FF4D6D'] },
  { key: 'timeline', title: 'Timeline', subtitle: 'Choose how many weeks you want to take.', icon: 'calendar-outline', accent: ['#6D7CFF', '#4F46E5'] },
  { key: 'activity', title: 'Activity Level', subtitle: 'Tell us how active you are most weeks.', icon: 'pulse', accent: ['#1BCF8C', '#109F67'] },
  { key: 'body', title: 'Body Type', subtitle: 'Set your current frame and target look.', icon: 'body-outline', accent: ['#46A4FF', '#2563EB'] },
  { key: 'personal', title: 'Personal Info', subtitle: 'We use this to calculate calories and macros.', icon: 'options-outline', accent: ['#FF5D8F', '#FF2D6F'] },
];

const clampWeeks = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 12;
  return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.round(parsed)));
};

const sanitizeWhole = (value) => String(value || '').replace(/[^0-9]/g, '');
const sanitizeDecimal = (value) => {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('')}`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTextValue = (value) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
};

const formatDate = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const addDays = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Math.round(days || 0));
  return date.toISOString().slice(0, 10);
};

const formatCaloriesDelta = (value) => {
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

const getLabel = (options, key) =>
  (Array.isArray(options) ? options : []).find((item) => item.key === key)?.label || '--';

const getStepError = (stepKey, state) => {
  if (stepKey === 'timeline') {
    const weeks = Number(state?.journeyDurationWeeks);
    return Number.isFinite(weeks) && weeks >= MIN_WEEKS && weeks <= MAX_WEEKS
      ? ''
      : `Choose a timeline between ${MIN_WEEKS} and ${MAX_WEEKS} weeks.`;
  }
  if (stepKey === 'personal') {
    const age = Number(state?.ageYears);
    const height = Number(state?.heightCm);
    const currentWeight = Number(state?.currentWeight);
    const targetWeight = Number(state?.targetWeight);
    if (!state?.sex) return 'Choose your gender.';
    if (!Number.isFinite(age) || age < 13 || age > 100) return 'Enter a valid age.';
    if (!Number.isFinite(height) || height < 120 || height > 230) return 'Enter a valid height in cm.';
    if (!Number.isFinite(currentWeight) || currentWeight <= 0) return 'Enter your current weight.';
    if (!Number.isFinite(targetWeight) || targetWeight <= 0) return 'Enter your goal weight.';
    if (targetWeight >= currentWeight) return 'For a weight-loss journey, your goal weight should be lower than your current weight.';
    return '';
  }
  if (stepKey === 'goal') return state?.goalFocusKey ? '' : 'Choose a journey focus.';
  if (stepKey === 'activity') return state?.activityLevelKey ? '' : 'Choose your activity level.';
  if (stepKey === 'body') return state?.currentBodyType && state?.targetBodyType ? '' : 'Choose both a current and target body type.';
  return '';
};

const isStepValid = (stepKey, state) => !getStepError(stepKey, state);

const getFirstIncompleteStep = (state) => {
  const firstInvalid = STEPS.findIndex((step) => !isStepValid(step.key, state));
  return firstInvalid >= 0 ? firstInvalid : STEPS.length - 1;
};

const WeightManagerUpdatePlanScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    themeName,
    profile,
    authUser,
    isPremium,
    isPremiumUser,
    updateProfile,
    updateTodayHealth,
    weightManagerLogs,
    ensureWeightManagerLogsLoaded,
    addWeightManagerLog,
    clearWeightManagerLogs,
    todayHealth,
    healthData,
    ensureHealthLoaded,
  } = useApp();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const isDark = themeName === 'dark';
  const loadedRef = useRef(false);
  const storageKey = useMemo(
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
  const progressStorageKey = useMemo(
    () =>
      getWeightProgressStorageKey({
        authUserId: authUser?.id,
        profileId: profile?.id,
        profileUserId: profile?.user_id,
      }),
    [authUser?.id, profile?.id, profile?.user_id]
  );
  const latestWeightLog = useMemo(
    () => (Array.isArray(weightManagerLogs) && weightManagerLogs.length ? weightManagerLogs[0] : null),
    [weightManagerLogs]
  );
  const isPremiumActive = Boolean(
    isPremiumUser ||
      isPremium ||
      profile?.isPremium ||
      profile?.plan === 'premium' ||
      profile?.plan === 'pro' ||
      profile?.plan === 'paid'
  );

  const buildBaseDraft = () =>
    normalizeWeightManagerState({
      weightUnit: profile?.weightManagerUnit || DEFAULT_WEIGHT_MANAGER_UNIT,
      startingWeight: latestWeightLog?.weight ?? profile?.weightManagerCurrentWeight ?? null,
      currentWeight: latestWeightLog?.weight ?? profile?.weightManagerCurrentWeight ?? null,
      targetWeight: profile?.weightManagerTargetWeight ?? null,
      currentBodyType: profile?.weightManagerCurrentBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
      targetBodyType: profile?.weightManagerTargetBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
      goalFocusKey: DEFAULT_WEIGHT_MANAGER_GOAL,
      activityLevelKey: DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
      journeyGoalMode: 'duration',
      journeyDurationWeeks: 12,
      journeyGoalDate: addDays(84),
      planStatus: WEIGHT_MANAGER_PLAN_STATUS_DRAFT,
      savedAt: new Date().toISOString(),
    });

  const [draft, setDraft] = useState(buildBaseDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [screenMode, setScreenMode] = useState('wizard');
  const [dailyWeight, setDailyWeight] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [logMessage, setLogMessage] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isCompletingJourney, setIsCompletingJourney] = useState(false);

  const hasActiveProfileJourney = useMemo(() => Number(profile?.weightManagerTargetCalories) > 0, [
    profile?.weightManagerTargetCalories,
  ]);

  useEffect(() => {
    ensureWeightManagerLogsLoaded();
    ensureHealthLoaded();
  }, [ensureHealthLoaded, ensureWeightManagerLogsLoaded]);

  useEffect(() => {
    let mounted = true;
    const loadState = async () => {
      try {
        const base = buildBaseDraft();
        const stored = await AsyncStorage.getItem(storageKey);
        const parsed = stored ? JSON.parse(stored) : null;
        const nextDraft = normalizeWeightManagerState(parsed || {}, base);
        if (!mounted) return;
        setDraft(nextDraft);
        setStepIndex(getFirstIncompleteStep(nextDraft));
        setScreenMode(hasJourneyState(nextDraft) ? 'preview' : 'wizard');
        setDailyWeight('');
      } catch (err) {
        console.log('Error loading weight journey state:', err);
      } finally {
        if (mounted) loadedRef.current = true;
      }
    };
    loadState();
    return () => {
      mounted = false;
    };
  }, [latestWeightLog?.weight, profile?.weightManagerCurrentWeight, profile?.weightManagerTargetWeight, profile?.weightManagerCurrentBodyType, profile?.weightManagerTargetBodyType, profile?.weightManagerUnit, storageKey]);

  useEffect(() => {
    if (!loadedRef.current) return;
    if (hasActiveProfileJourney && draft.planStatus === WEIGHT_MANAGER_PLAN_STATUS_DRAFT) {
      return;
    }
    AsyncStorage.setItem(storageKey, JSON.stringify(draft)).catch((err) => {
      console.log('Error saving weight journey draft:', err);
    });
  }, [draft, hasActiveProfileJourney, storageKey]);

  const isJourneyActive = hasActiveProfileJourney || isJourneyPlanActive(draft);
  const currentWeightValue =
    isJourneyActive && Number(latestWeightLog?.weight) > 0
      ? Number(latestWeightLog.weight)
      : toNumber(draft?.currentWeight);
  const previewState = useMemo(
    () =>
      normalizeWeightManagerState({
        ...draft,
        startingWeight: toNumber(draft?.startingWeight) ?? toNumber(draft?.currentWeight),
        currentWeight: currentWeightValue,
      }),
    [currentWeightValue, draft]
  );
  const plan = useMemo(
    () =>
      computeWeightManagerPlan({
        startingWeight: previewState?.startingWeight,
        currentWeight: previewState?.currentWeight,
        targetWeight: previewState?.targetWeight,
        unit: previewState?.weightUnit,
        currentBodyTypeKey: previewState?.currentBodyType,
        targetBodyTypeKey: previewState?.targetBodyType,
        goalFocusKey: previewState?.goalFocusKey,
        activityLevelKey: previewState?.activityLevelKey,
        sex: previewState?.sex,
        ageYears: previewState?.ageYears,
        heightCm: previewState?.heightCm,
        journeyDurationDays: clampWeeks(previewState?.journeyDurationWeeks) * 7,
      }),
    [previewState]
  );

  const preferredHealthCalories = useMemo(() => {
    let latestDate = '';
    let latestGoal = null;
    Object.entries(healthData || {}).forEach(([dateKey, day]) => {
      const goalValue = Number(day?.calorieGoal);
      if (!Number.isFinite(goalValue) || goalValue <= 0) return;
      if (!latestDate || dateKey > latestDate) {
        latestDate = dateKey;
        latestGoal = goalValue;
      }
    });
    return latestGoal;
  }, [healthData]);

  const updateDraft = (updates) => {
    setDraft((prev) => normalizeWeightManagerState({ ...prev, ...updates }));
    setSaveMessage('');
  };

  const fallbackCalories = () => {
    const preferred = Number(profile?.preferredDailyCalorieGoal);
    if (Number.isFinite(preferred) && preferred > 0) return preferred;
    const current = Number(profile?.dailyCalorieGoal);
    if (Number.isFinite(current) && current > 0 && current !== Number(profile?.weightManagerTargetCalories)) return current;
    const todayGoal = Number(todayHealth?.calorieGoal);
    if (Number.isFinite(todayGoal) && todayGoal > 0 && todayGoal !== Number(profile?.weightManagerTargetCalories)) return todayGoal;
    const healthGoal = Number(preferredHealthCalories);
    if (Number.isFinite(healthGoal) && healthGoal > 0 && healthGoal !== Number(profile?.weightManagerTargetCalories)) return healthGoal;
    return 2000;
  };

  const syncPlanTargets = async (nextState, nextPlan) => {
    const result = await updateProfile({
      weightManagerUnit: nextState.weightUnit,
      weightManagerCurrentWeight: nextState.currentWeight,
      weightManagerTargetWeight: nextState.targetWeight,
      weightManagerCurrentBodyType: nextState.currentBodyType,
      weightManagerTargetBodyType: nextState.targetBodyType,
      weightManagerTargetCalories: nextPlan.targetCalories,
      weightManagerProteinGrams: nextPlan.proteinGrams,
      weightManagerCarbsGrams: nextPlan.carbsGrams,
      weightManagerFatGrams: nextPlan.fatGrams,
    });
    if (!result) throw new Error('Unable to save profile targets.');
    await updateTodayHealth({
      calorieGoal: nextPlan.targetCalories,
      proteinGoal: nextPlan.proteinGrams,
      carbsGoal: nextPlan.carbsGrams,
      fatGoal: nextPlan.fatGrams,
    });
  };

  const syncProgressCheckFromJourney = async (weightValue, startingWeightValue, logDateValue) => {
    let parsed = null;
    try {
      const stored = await AsyncStorage.getItem(progressStorageKey);
      parsed = stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.log('Error reading weight progress payload during journey sync:', error);
    }

    try {
      const nextPayload = buildWeightProgressPayload({
        payload: parsed,
        startingWeight: parsed?.startingWeight ?? startingWeightValue,
        currentWeight: weightValue,
        maxEntries: DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES,
        date: logDateValue || new Date(),
      });
      await AsyncStorage.setItem(progressStorageKey, JSON.stringify(nextPayload));
      return true;
    } catch (error) {
      console.log('Error syncing Weight Progress Check from journey:', error);
      return false;
    }
  };

  const resetLocalDraft = async (clearWeights = false) => {
    const nextDraft = clearWeights
      ? normalizeWeightManagerState({
          weightUnit: DEFAULT_WEIGHT_MANAGER_UNIT,
          startingWeight: null,
          currentWeight: null,
          targetWeight: null,
          currentBodyType: DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
          targetBodyType: DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
          goalFocusKey: DEFAULT_WEIGHT_MANAGER_GOAL,
          activityLevelKey: DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
          journeyGoalMode: 'duration',
          journeyDurationWeeks: 12,
          journeyGoalDate: addDays(84),
          planStatus: WEIGHT_MANAGER_PLAN_STATUS_DRAFT,
          savedAt: new Date().toISOString(),
        })
      : buildBaseDraft();
    setDraft(nextDraft);
    setStepIndex(getFirstIncompleteStep(nextDraft));
    setScreenMode('wizard');
    setDailyWeight('');
    setSaveMessage('');
    setLogMessage('');
  };

  const clearActiveJourney = async () => {
    const nextCalories = fallbackCalories();
    const result = await updateProfile({
      dailyCalorieGoal: nextCalories,
      weightManagerUnit: DEFAULT_WEIGHT_MANAGER_UNIT,
      weightManagerCurrentWeight: null,
      weightManagerTargetWeight: null,
      weightManagerCurrentBodyType: DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
      weightManagerTargetBodyType: DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
      weightManagerTargetCalories: null,
      weightManagerProteinGrams: null,
      weightManagerCarbsGrams: null,
      weightManagerFatGrams: null,
    });
    if (!result) throw new Error('Unable to clear active journey.');
    await updateTodayHealth({
      calorieGoal: nextCalories,
      proteinGoal: null,
      carbsGoal: null,
      fatGoal: null,
    });
    await clearWeightManagerLogs();
    await AsyncStorage.removeItem(storageKey);
    await resetLocalDraft(true);
  };

  const savePlan = async () => {
    if (!plan) {
      Alert.alert('Complete the setup', 'Answer all questions before generating a plan.');
      return;
    }
    try {
      setIsSavingPlan(true);
      const nextState = normalizeWeightManagerState({
        ...previewState,
        planStatus: WEIGHT_MANAGER_PLAN_STATUS_ACTIVE,
        activatedAt: previewState?.activatedAt || new Date().toISOString(),
        savedAt: new Date().toISOString(),
      });
      await syncPlanTargets(nextState, plan);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextState));
      setDraft(nextState);
      setScreenMode('preview');
      setSaveMessage('Journey plan active. Daily calorie and macro targets are now synced to the tracker.');
    } catch (err) {
      console.log('Error saving weight journey:', err);
      Alert.alert('Unable to save plan', 'Please try again.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const saveDailyCheckIn = async () => {
    const parsedWeight = Number(dailyWeight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('Enter weight', 'Please enter a valid weight for today.');
      return;
    }
    if (!isJourneyActive) {
      Alert.alert('No active journey', 'Save a journey plan before using daily check-ins.');
      return;
    }
    try {
      setIsSavingLog(true);
      const checkInDate = new Date().toISOString();
      const nextState = normalizeWeightManagerState({
        ...previewState,
        currentWeight: parsedWeight,
        planStatus: WEIGHT_MANAGER_PLAN_STATUS_ACTIVE,
        activatedAt: previewState?.activatedAt || new Date().toISOString(),
        savedAt: new Date().toISOString(),
      });
      const nextPlan = computeWeightManagerPlan({
        startingWeight: nextState.startingWeight,
        currentWeight: nextState.currentWeight,
        targetWeight: nextState.targetWeight,
        unit: nextState.weightUnit,
        currentBodyTypeKey: nextState.currentBodyType,
        targetBodyTypeKey: nextState.targetBodyType,
        goalFocusKey: nextState.goalFocusKey,
        activityLevelKey: nextState.activityLevelKey,
        sex: nextState.sex,
        ageYears: nextState.ageYears,
        heightCm: nextState.heightCm,
        journeyDurationDays: clampWeeks(nextState.journeyDurationWeeks) * 7,
      });
      await syncProgressCheckFromJourney(parsedWeight, nextState.startingWeight, checkInDate);
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextState));
      setDraft(nextState);
      setDailyWeight('');
      setLogMessage('Check-in saved. Syncing your journey targets...');

      void (async () => {
        let progressSynced = true;
        let targetsSynced = true;

        try {
          const savedWeightLog = await addWeightManagerLog({
            weight: parsedWeight,
            unit: previewState.weightUnit,
            logDate: checkInDate,
          });
          progressSynced = await syncProgressCheckFromJourney(
            parsedWeight,
            nextState.startingWeight,
            savedWeightLog?.logDate || checkInDate
          );
        } catch (error) {
          console.log('Error syncing daily check-in weight log:', error);
          progressSynced = false;
        }

        if (nextPlan) {
          try {
            await syncPlanTargets(nextState, nextPlan);
          } catch (error) {
            console.log('Error syncing daily check-in targets:', error);
            targetsSynced = false;
          }
        }

        setLogMessage(
          targetsSynced
            ? progressSynced
              ? 'Check-in saved. Daily targets refreshed and Weight Progress Check updated.'
              : 'Check-in saved. Daily targets refreshed. Weight Progress Check will use your local check-in.'
            : 'Check-in saved. Your latest weight is stored, and targets are still syncing.'
        );
      })();
    } catch (err) {
      console.log('Error saving weight check-in:', err);
      Alert.alert('Unable to save check-in', 'Please try again.');
    } finally {
      setIsSavingLog(false);
    }
  };

  const completeJourney = async () => {
    if (!plan || !isJourneyActive) return;
    Alert.alert('Complete this journey?', 'This will archive the current journey and clear the active targets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete Journey',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsCompletingJourney(true);
            const raw = await AsyncStorage.getItem(historyStorageKey);
            const currentHistory = raw ? parseWeightJourneyHistoryPayload(JSON.parse(raw)) : [];
            const completed = createCompletedJourneyEntry({
              state: { ...previewState, planStatus: WEIGHT_MANAGER_PLAN_STATUS_ACTIVE },
              plan,
              logs: weightManagerLogs,
            });
            if (!completed) throw new Error('Unable to create journey history entry.');
            const nextHistory = appendJourneyHistoryEntry(currentHistory, completed);
            await AsyncStorage.setItem(historyStorageKey, JSON.stringify({ journeys: nextHistory }));
            await clearActiveJourney();
            Alert.alert('Journey completed', 'Your journey has been saved in Weight Loss History.');
          } catch (err) {
            console.log('Error completing journey:', err);
            Alert.alert('Unable to complete journey', 'Please try again.');
          } finally {
            setIsCompletingJourney(false);
          }
        },
      },
    ]);
  };

  const discardOrReset = () => {
    const title = isJourneyActive ? 'Reset active journey?' : 'Discard draft plan?';
    const message = isJourneyActive
      ? 'This clears the active journey and removes the synced tracker targets.'
      : 'This removes your draft journey and returns you to an empty setup.';
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isJourneyActive ? 'Reset Journey' : 'Discard Draft',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isJourneyActive) {
              await clearActiveJourney();
            } else {
              await AsyncStorage.removeItem(storageKey);
              await resetLocalDraft();
            }
          } catch (err) {
            console.log('Error resetting weight journey:', err);
            Alert.alert('Unable to reset', 'Please try again.');
          }
        },
      },
    ]);
  };

  const goBack = () => {
    if (screenMode === 'wizard' && stepIndex > 0) {
      setStepIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    navigation.goBack();
  };

  const continueWizard = () => {
    const error = getStepError(STEPS[stepIndex]?.key, draft);
    if (error) {
      Alert.alert('Complete this step', error);
      return;
    }
    if (stepIndex === STEPS.length - 1) {
      setScreenMode('preview');
      return;
    }
    setStepIndex((prev) => Math.min(STEPS.length - 1, prev + 1));
  };

  const activeStep = STEPS[stepIndex];
  const progressPercent = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  if (!isPremiumActive) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed" size={24} color={themeColors.primary} />
          <Text style={styles.lockedTitle}>Premium Weight Journey</Text>
          <Text style={styles.lockedText}>
            Upgrade to access the interactive journey builder and adaptive calorie targets.
          </Text>
          <Button title="Unlock Premium" onPress={() => navigation.navigate('Paywall', { source: 'weight-manager-update-plan' })} style={styles.fullButton} />
          <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={goBack}>
            <Ionicons name="chevron-back" size={20} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {screenMode === 'preview' ? 'Weight Loss Journey' : 'Create Your Journey'}
          </Text>
          <View style={styles.headerDot} />
        </View>

        <TouchableOpacity style={styles.historyRow} onPress={() => navigation.navigate('WeightJourneyHistory')}>
          <Ionicons name="time-outline" size={14} color={themeColors.textSecondary} />
          <Text style={styles.historyText}>View history</Text>
        </TouchableOpacity>

        {screenMode === 'wizard' ? (
          <>
            <View style={styles.progressMeta}>
              <Text style={styles.progressText}>Step {stepIndex + 1} of {STEPS.length}</Text>
              <Text style={styles.progressText}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient colors={['#FF8A3D', '#FF4D6D', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.progressFill, { width: `${progressPercent}%` }]} />
            </View>

            <View style={styles.stepHeader}>
              <LinearGradient colors={activeStep.accent} style={styles.stepIcon}>
                <Ionicons name={activeStep.icon} size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.stepHeaderCopy}>
                <Text style={styles.stepTitle}>{activeStep.title}</Text>
                <Text style={styles.stepSubtitle}>{activeStep.subtitle}</Text>
              </View>
            </View>

            <View style={styles.card}>
              {activeStep.key === 'goal' &&
                WEIGHT_MANAGER_GOAL_OPTIONS.map((option) => (
                  <TouchableOpacity key={option.key} style={[styles.optionCard, draft.goalFocusKey === option.key && styles.optionCardActive]} onPress={() => updateDraft({ goalFocusKey: option.key })}>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{option.label}</Text>
                      <Text style={styles.optionSubtitle}>{option.description}</Text>
                    </View>
                    <Ionicons name={draft.goalFocusKey === option.key ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={draft.goalFocusKey === option.key ? '#FF4D6D' : themeColors.textSecondary} />
                  </TouchableOpacity>
                ))}

              {activeStep.key === 'timeline' && (
                <View>
                  <View style={styles.timelineCard}>
                    <Text style={styles.timelineValue}>{clampWeeks(draft.journeyDurationWeeks)}</Text>
                    <Text style={styles.timelineLabel}>weeks</Text>
                  </View>
                  <View style={styles.timelineAdjust}>
                    <TouchableOpacity style={styles.timelineButton} onPress={() => updateDraft({ journeyDurationWeeks: clampWeeks(draft.journeyDurationWeeks - 1) })}>
                      <Ionicons name="remove" size={18} color={themeColors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timelineButton} onPress={() => updateDraft({ journeyDurationWeeks: clampWeeks(draft.journeyDurationWeeks + 1) })}>
                      <Ionicons name="add" size={18} color={themeColors.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.presetRow}>
                    {WEEK_PRESETS.map((preset) => (
                      <TouchableOpacity key={preset} style={[styles.presetChip, clampWeeks(draft.journeyDurationWeeks) === preset && styles.presetChipActive]} onPress={() => updateDraft({ journeyDurationWeeks: preset })}>
                        <Text style={[styles.presetText, clampWeeks(draft.journeyDurationWeeks) === preset && styles.presetTextActive]}>{preset}w</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {activeStep.key === 'activity' &&
                WEIGHT_MANAGER_ACTIVITY_LEVELS.map((option) => (
                  <TouchableOpacity key={option.key} style={[styles.optionCard, draft.activityLevelKey === option.key && styles.optionCardActive]} onPress={() => updateDraft({ activityLevelKey: option.key })}>
                    <View style={styles.optionCopy}>
                      <Text style={styles.optionTitle}>{option.label}</Text>
                      <Text style={styles.optionSubtitle}>{option.description}</Text>
                    </View>
                    <Ionicons name={draft.activityLevelKey === option.key ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={draft.activityLevelKey === option.key ? '#10B981' : themeColors.textSecondary} />
                  </TouchableOpacity>
                ))}

              {activeStep.key === 'body' && (
                <>
                  <Text style={styles.sectionLabel}>Current</Text>
                  <View style={styles.bodyRow}>
                    {WEIGHT_MANAGER_BODY_TYPES.map((type) => (
                      <TouchableOpacity key={`current-${type.key}`} style={[styles.bodyCard, draft.currentBodyType === type.key && styles.bodyCardActive]} onPress={() => updateDraft({ currentBodyType: type.key })}>
                        <Text style={styles.bodyText}>{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.sectionLabel}>Target</Text>
                  <View style={styles.bodyRow}>
                    {WEIGHT_MANAGER_BODY_TYPES.map((type) => (
                      <TouchableOpacity key={`target-${type.key}`} style={[styles.bodyCard, draft.targetBodyType === type.key && styles.bodyCardActive]} onPress={() => updateDraft({ targetBodyType: type.key })}>
                        <Text style={styles.bodyText}>{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {activeStep.key === 'personal' && (
                <>
                  <View style={styles.segmented}>
                    {WEIGHT_MANAGER_WEIGHT_UNITS.map((unit) => (
                      <TouchableOpacity key={unit.key} style={[styles.segmentedItem, draft.weightUnit === unit.key && styles.segmentedItemActive]} onPress={() => updateDraft({ weightUnit: unit.key })}>
                        <Text style={[styles.segmentedText, draft.weightUnit === unit.key && styles.segmentedTextActive]}>{unit.label.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.segmented}>
                    {WEIGHT_MANAGER_SEX_OPTIONS.map((option) => (
                      <TouchableOpacity key={option.key} style={[styles.segmentedItem, draft.sex === option.key && styles.segmentedItemActive]} onPress={() => updateDraft({ sex: option.key })}>
                        <Text style={[styles.segmentedText, draft.sex === option.key && styles.segmentedTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.inputRow}>
                    <Input label="Age" value={toTextValue(draft.ageYears)} onChangeText={(value) => updateDraft({ ageYears: sanitizeWhole(value) })} keyboardType="numeric" containerStyle={[styles.halfInput, styles.halfLeft]} />
                    <Input label="Height (cm)" value={toTextValue(draft.heightCm)} onChangeText={(value) => updateDraft({ heightCm: sanitizeWhole(value) })} keyboardType="numeric" containerStyle={styles.halfInput} />
                  </View>
                  <View style={styles.inputRow}>
                    <Input label={`Current (${draft.weightUnit})`} value={toTextValue(draft.currentWeight)} onChangeText={(value) => updateDraft({ currentWeight: sanitizeDecimal(value) })} keyboardType="decimal-pad" containerStyle={[styles.halfInput, styles.halfLeft]} />
                    <Input label={`Goal (${draft.weightUnit})`} value={toTextValue(draft.targetWeight)} onChangeText={(value) => updateDraft({ targetWeight: sanitizeDecimal(value) })} keyboardType="decimal-pad" containerStyle={styles.halfInput} />
                  </View>
                </>
              )}
            </View>

            <Button title={stepIndex === STEPS.length - 1 ? 'Generate Plan' : 'Continue'} onPress={continueWizard} disabled={!isStepValid(activeStep.key, draft)} style={styles.fullButton} />
            {stepIndex > 0 ? <Button title="Back" variant="secondary" onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))} /> : null}
          </>
        ) : (
          <>
            <Text style={styles.previewIntro}>Build a timeline-based journey with adaptive calories, macros, and daily check-ins.</Text>
            <LinearGradient colors={isDark ? ['#0A8A55', '#0A6D5D'] : ['#11C46E', '#0FAF72']} style={styles.hero}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroTitle}>Journey Plan</Text>
                  <Text style={styles.heroCaption}>{getLabel(WEIGHT_MANAGER_GOAL_OPTIONS, previewState.goalFocusKey)}</Text>
                </View>
                <Text style={styles.heroBadge}>
                  {isJourneyActive && draft.planStatus === WEIGHT_MANAGER_PLAN_STATUS_DRAFT
                    ? 'Draft changes'
                    : isJourneyActive
                    ? 'Active journey'
                    : 'Draft plan'}
                </Text>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Daily intake</Text>
                  <Text style={styles.heroStatValue}>{plan ? `${plan.targetCalories} cal` : '--'}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Daily change</Text>
                  <Text style={styles.heroStatValue}>{plan ? formatCaloriesDelta(plan.dailyCalorieDelta) : '--'}</Text>
                </View>
              </View>
              <View style={styles.heroMacroRow}>
                <Text style={styles.heroMacro}>Protein {plan?.proteinGrams ?? '--'}g</Text>
                <Text style={styles.heroMacro}>Carbs {plan?.carbsGrams ?? '--'}g</Text>
                <Text style={styles.heroMacro}>Fat {plan?.fatGrams ?? '--'}g</Text>
              </View>
              <Text style={styles.heroHint}>
                {isJourneyActive && draft.planStatus === WEIGHT_MANAGER_PLAN_STATUS_DRAFT
                  ? 'Your current tracker targets stay live until you save these changes.'
                  : isJourneyActive
                  ? 'Calories and macros stay synced to the tracker while this journey is active.'
                  : 'Save this plan to activate calorie and macro targets in the tracker.'}
              </Text>
              <Button title={isJourneyActive ? 'Save Journey Plan' : 'Activate Journey Plan'} onPress={savePlan} loading={isSavingPlan} disabled={!plan || isSavingPlan} style={styles.fullButton} />
              <Button title="Edit Journey" variant="outline" onPress={() => { updateDraft({ planStatus: WEIGHT_MANAGER_PLAN_STATUS_DRAFT }); setStepIndex(0); setScreenMode('wizard'); }} style={styles.heroSecondaryButton} textStyle={styles.heroSecondaryButtonText} />
              {isJourneyActive ? <Button title="Complete Journey" variant="ghost" onPress={completeJourney} loading={isCompletingJourney} textStyle={styles.heroGhostText} /> : null}
              {!!saveMessage ? <Text style={styles.heroMessage}>{saveMessage}</Text> : null}
            </LinearGradient>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Journey Details</Text>
              <View style={styles.metric}><Text style={styles.metricLabel}>Timeline</Text><Text style={styles.metricValue}>{clampWeeks(previewState.journeyDurationWeeks)} weeks</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Estimated finish</Text><Text style={styles.metricValue}>{plan ? formatDate(plan.projectedEndDateISO) : '--'}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Weekly trend</Text><Text style={styles.metricValue}>{plan ? formatWeeklyTrend(plan.weeklyWeightChangeKg) : '--'}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Starting weight</Text><Text style={styles.metricValue}>{Number.isFinite(Number(previewState.startingWeight)) ? `${Number(previewState.startingWeight)} ${previewState.weightUnit}` : '--'}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Goal weight</Text><Text style={styles.metricValue}>{previewState.targetWeight ? `${previewState.targetWeight} ${previewState.weightUnit}` : '--'}</Text></View>
              <View style={[styles.metric, styles.metricLast]}><Text style={styles.metricLabel}>Activity</Text><Text style={styles.metricValue}>{getLabel(WEIGHT_MANAGER_ACTIVITY_LEVELS, previewState.activityLevelKey)}</Text></View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Body Transformation</Text>
              <View style={styles.metric}><Text style={styles.metricLabel}>Current</Text><Text style={styles.metricValue}>{getLabel(WEIGHT_MANAGER_BODY_TYPES, previewState.currentBodyType)}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Target</Text><Text style={styles.metricValue}>{getLabel(WEIGHT_MANAGER_BODY_TYPES, previewState.targetBodyType)}</Text></View>
              <View style={[styles.metric, styles.metricLast]}><Text style={styles.metricLabel}>Focus</Text><Text style={styles.metricValue}>{getLabel(WEIGHT_MANAGER_GOAL_OPTIONS, previewState.goalFocusKey)}</Text></View>
            </View>

            {isJourneyActive ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Daily Check-In</Text>
                <Text style={styles.cardNote}>
                  Log today&apos;s weight to keep your targets adaptive. Then check Weight Progress Check to review your trend and countdown to goal.
                </Text>
                <Input label={`Today's weight (${previewState.weightUnit})`} value={dailyWeight} onChangeText={setDailyWeight} keyboardType="decimal-pad" />
                <Button title="Save" onPress={saveDailyCheckIn} loading={isSavingLog} disabled={isSavingLog} style={styles.fullButton} />
                <TouchableOpacity style={styles.progressPromptRow} onPress={() => navigation.navigate('WeightProgress')}>
                  <Ionicons name="analytics-outline" size={16} color={themeColors.primary} />
                  <Text style={styles.progressPromptText}>Check Weight Progress Check</Text>
                </TouchableOpacity>
                {!!logMessage ? <Text style={styles.logText}>{logMessage}</Text> : null}
              </View>
            ) : null}

            <View style={styles.resetRow}>
              <View style={styles.resetCopy}>
                <Text style={styles.resetTitle}>{isJourneyActive ? 'Reset active journey' : 'Discard journey draft'}</Text>
                <Text style={styles.resetNote}>{isJourneyActive ? 'Remove the active plan and return to your normal calorie goal.' : 'Clear this draft and start again.'}</Text>
              </View>
              <Button title={isJourneyActive ? 'Reset Journey' : 'Discard Draft'} variant="danger" onPress={discardOrReset} fullWidth={false} />
            </View>
          </>
        )}
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: themeColors.background },
    lockedCard: { width: '100%', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.card, padding: spacing.xl, alignItems: 'center' },
    lockedTitle: { ...typography.h3, color: themeColors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
    lockedText: { ...typography.bodySmall, color: themeColors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    headerButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border },
    headerTitle: { ...typography.h2, color: themeColors.text, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
    headerDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF9800' },
    historyRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.lg },
    historyText: { ...typography.caption, color: themeColors.textSecondary, marginLeft: spacing.xs },
    progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
    progressText: { ...typography.caption, color: themeColors.textSecondary, fontWeight: '700' },
    progressTrack: { height: 8, borderRadius: 999, backgroundColor: themeColors.border, overflow: 'hidden', marginBottom: spacing.xl },
    progressFill: { height: '100%', borderRadius: 999 },
    stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    stepIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, ...shadows.small },
    stepHeaderCopy: { flex: 1 },
    stepTitle: { ...typography.h2, color: themeColors.text },
    stepSubtitle: { ...typography.bodySmall, color: themeColors.textSecondary, marginTop: 2 },
    card: { borderRadius: borderRadius.xl, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.card, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.small },
    cardTitle: { ...typography.h3, color: themeColors.text, marginBottom: spacing.md },
    cardNote: { ...typography.bodySmall, color: themeColors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
    progressPromptRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: spacing.md },
    progressPromptText: { ...typography.bodySmall, color: themeColors.primary, fontWeight: '700', marginLeft: spacing.xs },
    optionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: themeColors.border, padding: spacing.md, marginBottom: spacing.md, backgroundColor: themeColors.card },
    optionCardActive: { borderColor: themeColors.primary, backgroundColor: themeColors.primaryLight },
    optionCopy: { flex: 1, marginRight: spacing.md },
    optionTitle: { ...typography.body, color: themeColors.text, fontWeight: '700', marginBottom: 2 },
    optionSubtitle: { ...typography.caption, color: themeColors.textSecondary },
    timelineCard: { alignItems: 'center', borderRadius: borderRadius.xl, backgroundColor: '#FCFBFF', borderWidth: 1, borderColor: themeColors.border, paddingVertical: spacing.xxl, marginBottom: spacing.md },
    timelineValue: { fontSize: 52, lineHeight: 56, fontWeight: '700', color: '#7C3AED' },
    timelineLabel: { ...typography.bodySmall, color: themeColors.textSecondary, marginTop: spacing.xs },
    timelineAdjust: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md },
    timelineButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.inputBackground, borderWidth: 1, borderColor: themeColors.border, marginHorizontal: spacing.sm },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap' },
    presetChip: { minWidth: 74, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: themeColors.border, backgroundColor: '#FFF8FB', marginRight: spacing.sm, marginBottom: spacing.sm },
    presetChipActive: { backgroundColor: '#6A5BFF', borderColor: '#6A5BFF' },
    presetText: { ...typography.bodySmall, color: themeColors.textSecondary, fontWeight: '700' },
    presetTextActive: { color: '#FFFFFF' },
    sectionLabel: { ...typography.caption, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, fontWeight: '700' },
    bodyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
    bodyCard: { width: '31%', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: themeColors.border, paddingVertical: spacing.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.card },
    bodyCardActive: { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
    bodyText: { ...typography.bodySmall, color: themeColors.text, fontWeight: '700' },
    segmented: { flexDirection: 'row', backgroundColor: themeColors.inputBackground, borderRadius: borderRadius.xl, padding: spacing.xs, marginBottom: spacing.md },
    segmentedItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.lg, paddingVertical: spacing.md },
    segmentedItemActive: { backgroundColor: '#FF2D6F' },
    segmentedText: { ...typography.bodySmall, color: themeColors.text, fontWeight: '700' },
    segmentedTextActive: { color: '#FFFFFF' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-start' },
    halfInput: { flex: 1 },
    halfLeft: { marginRight: spacing.md },
    previewIntro: { ...typography.bodySmall, color: themeColors.textSecondary, marginBottom: spacing.lg },
    hero: { borderRadius: borderRadius.xxl, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.medium },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    heroTitle: { ...typography.h3, color: '#FFFFFF', fontWeight: '700' },
    heroCaption: { ...typography.bodySmall, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
    heroBadge: { ...typography.caption, color: '#FFFFFF', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full, overflow: 'hidden' },
    heroStats: { flexDirection: 'row', marginBottom: spacing.md },
    heroStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: borderRadius.lg, padding: spacing.md, marginRight: spacing.sm },
    heroStatLabel: { ...typography.caption, color: 'rgba(255,255,255,0.76)', marginBottom: spacing.xs },
    heroStatValue: { ...typography.h3, color: '#FFFFFF', fontWeight: '700' },
    heroMacroRow: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, marginBottom: spacing.md },
    heroMacro: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700', marginBottom: 2 },
    heroHint: { ...typography.caption, color: 'rgba(255,255,255,0.84)', marginBottom: spacing.md },
    heroMessage: { ...typography.caption, color: '#FFFFFF', marginTop: spacing.sm },
    heroSecondaryButton: { borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'transparent' },
    heroSecondaryButtonText: { color: '#FFFFFF' },
    heroGhostText: { color: '#FFFFFF', fontWeight: '700' },
    metric: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    metricLast: { borderBottomWidth: 0 },
    metricLabel: { ...typography.caption, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    metricValue: { ...typography.bodySmall, color: themeColors.text, fontWeight: '700', textAlign: 'right' },
    logText: { ...typography.caption, color: themeColors.primary, marginTop: spacing.sm },
    resetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.card, padding: spacing.lg, marginBottom: spacing.xl },
    resetCopy: { flex: 1, marginRight: spacing.md },
    resetTitle: { ...typography.h3, color: themeColors.text, marginBottom: spacing.xs },
    resetNote: { ...typography.caption, color: themeColors.textSecondary },
    fullButton: { marginBottom: spacing.sm },
  });

export default WeightManagerUpdatePlanScreen;
