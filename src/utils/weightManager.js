export const WEIGHT_MANAGER_GOAL_OPTIONS = [
  {
    key: 'lose_weight',
    label: 'Lose Weight',
    description: 'Create a stronger calorie deficit and faster scale progress.',
    icon: 'trending-down',
    deficitBias: 1.05,
    proteinBoost: 0.16,
    minimumCalories: 1350,
  },
  {
    key: 'get_fit_toned',
    label: 'Get Fit & Toned',
    description: 'Balance fat loss with muscle retention and higher protein.',
    icon: 'flash',
    deficitBias: 0.9,
    proteinBoost: 0.22,
    minimumCalories: 1400,
  },
  {
    key: 'move_more',
    label: 'Move More',
    description: 'Aim for sustainable weight loss while building daily activity.',
    icon: 'walk',
    deficitBias: 0.82,
    proteinBoost: 0.12,
    minimumCalories: 1450,
  },
  {
    key: 'live_healthier',
    label: 'Live Healthier',
    description: 'Use a gentler pace that is easier to sustain long term.',
    icon: 'leaf',
    deficitBias: 0.72,
    proteinBoost: 0.08,
    minimumCalories: 1500,
  },
];

export const WEIGHT_MANAGER_GOAL_MAP = WEIGHT_MANAGER_GOAL_OPTIONS.reduce((acc, option) => {
  acc[option.key] = option;
  return acc;
}, {});

export const WEIGHT_MANAGER_ACTIVITY_LEVELS = [
  {
    key: 'sedentary',
    label: 'Sedentary',
    description: 'Little to no exercise',
    multiplier: 1.2,
  },
  {
    key: 'lightly_active',
    label: 'Lightly Active',
    description: '1-3 days per week',
    multiplier: 1.375,
  },
  {
    key: 'moderately_active',
    label: 'Moderately Active',
    description: '3-5 days per week',
    multiplier: 1.55,
  },
  {
    key: 'very_active',
    label: 'Very Active',
    description: '6-7 days per week',
    multiplier: 1.725,
  },
  {
    key: 'extremely_active',
    label: 'Extremely Active',
    description: 'Physical job + exercise',
    multiplier: 1.9,
  },
];

export const WEIGHT_MANAGER_ACTIVITY_LEVEL_MAP = WEIGHT_MANAGER_ACTIVITY_LEVELS.reduce(
  (acc, option) => {
    acc[option.key] = option;
    return acc;
  },
  {}
);

export const WEIGHT_MANAGER_SEX_OPTIONS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

export const WEIGHT_MANAGER_BODY_TYPES = [
  {
    key: 'slim',
    label: 'Slim',
    maintenanceBias: -60,
    proteinBase: 1.9,
    fatBase: 0.72,
    silhouette: { shoulders: 38, torso: 30, waist: 24 },
  },
  {
    key: 'athletic',
    label: 'Athletic',
    maintenanceBias: 0,
    proteinBase: 2.05,
    fatBase: 0.8,
    silhouette: { shoulders: 46, torso: 38, waist: 28 },
  },
  {
    key: 'sturdy',
    label: 'Sturdy',
    maintenanceBias: 85,
    proteinBase: 1.85,
    fatBase: 0.88,
    silhouette: { shoulders: 52, torso: 44, waist: 38 },
  },
];

const BODY_TYPE_ALIASES = {
  lean: 'slim',
  ectomorph: 'slim',
  muscular: 'athletic',
  mesomorph: 'athletic',
  bulky: 'sturdy',
  endomorph: 'sturdy',
};

export const WEIGHT_MANAGER_BODY_TYPE_MAP = WEIGHT_MANAGER_BODY_TYPES.reduce((acc, bodyType) => {
  acc[bodyType.key] = bodyType;
  return acc;
}, {});

Object.entries(BODY_TYPE_ALIASES).forEach(([legacyKey, nextKey]) => {
  WEIGHT_MANAGER_BODY_TYPE_MAP[legacyKey] = WEIGHT_MANAGER_BODY_TYPE_MAP[nextKey];
});

export const WEIGHT_MANAGER_WEIGHT_UNITS = [
  { key: 'kg', label: 'kg' },
  { key: 'lb', label: 'lb' },
];

export const DEFAULT_WEIGHT_MANAGER_GOAL = WEIGHT_MANAGER_GOAL_OPTIONS[0].key;
export const DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL = WEIGHT_MANAGER_ACTIVITY_LEVELS[2].key;
export const DEFAULT_WEIGHT_MANAGER_BODY_TYPE = WEIGHT_MANAGER_BODY_TYPES[1].key;
export const DEFAULT_WEIGHT_MANAGER_UNIT = 'kg';

const KCAL_PER_KG = 7700;
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const toWholeNumberOrNull = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  const parsed =
    value instanceof Date
      ? value
      : new Date(typeof value === 'string' ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toDateKey = (value) => {
  const date = normalizeDateValue(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
};

export const normalizeWeightManagerBodyTypeKey = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return DEFAULT_WEIGHT_MANAGER_BODY_TYPE;
  if (BODY_TYPE_ALIASES[normalized]) return BODY_TYPE_ALIASES[normalized];
  return WEIGHT_MANAGER_BODY_TYPE_MAP[normalized]
    ? normalized
    : DEFAULT_WEIGHT_MANAGER_BODY_TYPE;
};

export const normalizeWeightManagerGoalKey = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return WEIGHT_MANAGER_GOAL_MAP[normalized] ? normalized : DEFAULT_WEIGHT_MANAGER_GOAL;
};

export const normalizeWeightManagerActivityLevelKey = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return WEIGHT_MANAGER_ACTIVITY_LEVEL_MAP[normalized]
    ? normalized
    : DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL;
};

export const normalizeWeightManagerSex = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'female') return normalized;
  return null;
};

export const toWeightManagerKg = (value, unit = DEFAULT_WEIGHT_MANAGER_UNIT) => {
  if (!Number.isFinite(value)) return null;
  return unit === 'kg' ? value : value / 2.20462;
};

const roundMacro = (value) => Math.max(0, Math.round((value || 0) * 10) / 10);

const computeBmrCalories = ({ currentKg, heightCm, ageYears, sex }) => {
  const parsedHeight = toPositiveNumber(heightCm);
  const parsedAge = toWholeNumberOrNull(ageYears);
  const normalizedSex = normalizeWeightManagerSex(sex);

  if (!Number.isFinite(currentKg) || !parsedHeight || !parsedAge || !normalizedSex) {
    return Math.round(currentKg * 22 * 1.45);
  }

  const sexOffset = normalizedSex === 'male' ? 5 : -161;
  return Math.round(10 * currentKg + 6.25 * parsedHeight - 5 * parsedAge + sexOffset);
};

const buildAdaptiveDailyDelta = ({
  direction,
  remainingAbsKg,
  maintenanceCalories,
  goalFocus,
  activityLevel,
  progressRatio,
}) => {
  if (!direction || remainingAbsKg < 0.05) return 0;

  if (direction < 0) {
    const adaptiveWeeklyRateKg = clamp(
      0.28 +
        remainingAbsKg * 0.07 +
        (1 - progressRatio) * 0.06 +
        (goalFocus.deficitBias - 0.75) * 0.18 +
        (activityLevel.multiplier - 1.2) * 0.12,
      0.22,
      0.95
    );
    const adaptiveDelta = (adaptiveWeeklyRateKg * KCAL_PER_KG) / 7;
    return -clamp(adaptiveDelta, 180, Math.max(320, maintenanceCalories * 0.34));
  }

  const adaptiveWeeklyRateKg = clamp(0.12 + remainingAbsKg * 0.05, 0.1, 0.38);
  const adaptiveDelta = (adaptiveWeeklyRateKg * KCAL_PER_KG) / 7;
  return clamp(adaptiveDelta, 90, Math.max(140, maintenanceCalories * 0.16));
};

export const computeWeightManagerPlan = ({
  startingWeight,
  currentWeight,
  targetWeight,
  unit = DEFAULT_WEIGHT_MANAGER_UNIT,
  currentBodyTypeKey = DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  targetBodyTypeKey = DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  goalFocusKey = DEFAULT_WEIGHT_MANAGER_GOAL,
  activityLevelKey = DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
  sex = null,
  ageYears = null,
  heightCm = null,
  journeyDurationDays,
  journeyEndDate,
  now = new Date(),
}) => {
  const parsedCurrent = toPositiveNumber(currentWeight);
  const parsedTarget = toPositiveNumber(targetWeight);
  if (!Number.isFinite(parsedCurrent) || !Number.isFinite(parsedTarget)) {
    return null;
  }

  const parsedStarting = toPositiveNumber(startingWeight) ?? parsedCurrent;

  const currentKg = toWeightManagerKg(parsedCurrent, unit);
  const targetKg = toWeightManagerKg(parsedTarget, unit);
  const startingKg = toWeightManagerKg(parsedStarting, unit);
  if (!Number.isFinite(currentKg) || !Number.isFinite(targetKg) || !Number.isFinite(startingKg)) {
    return null;
  }

  const currentBodyType =
    WEIGHT_MANAGER_BODY_TYPE_MAP[normalizeWeightManagerBodyTypeKey(currentBodyTypeKey)];
  const targetBodyType =
    WEIGHT_MANAGER_BODY_TYPE_MAP[normalizeWeightManagerBodyTypeKey(targetBodyTypeKey)];
  const goalFocus = WEIGHT_MANAGER_GOAL_MAP[normalizeWeightManagerGoalKey(goalFocusKey)];
  const activityLevel =
    WEIGHT_MANAGER_ACTIVITY_LEVEL_MAP[
      normalizeWeightManagerActivityLevelKey(activityLevelKey)
    ];
  const normalizedSex = normalizeWeightManagerSex(sex);
  const parsedAgeYears = toWholeNumberOrNull(ageYears);
  const parsedHeightCm = toPositiveNumber(heightCm);

  const bmrCalories = computeBmrCalories({
    currentKg,
    heightCm: parsedHeightCm,
    ageYears: parsedAgeYears,
    sex: normalizedSex,
  });

  const currentMaintenance =
    bmrCalories * activityLevel.multiplier + currentBodyType.maintenanceBias;
  const targetBmrCalories = computeBmrCalories({
    currentKg: targetKg,
    heightCm: parsedHeightCm,
    ageYears: parsedAgeYears,
    sex: normalizedSex,
  });
  const targetMaintenance =
    targetBmrCalories * activityLevel.multiplier + targetBodyType.maintenanceBias;
  const maintenanceCalories = Math.round(currentMaintenance * 0.78 + targetMaintenance * 0.22);

  const remainingKg = targetKg - currentKg;
  const remainingAbsKg = Math.abs(remainingKg);
  const totalJourneyKg = Math.abs(targetKg - startingKg);
  const completedJourneyKg = Math.min(totalJourneyKg, Math.abs(currentKg - startingKg));
  const progressRatio = totalJourneyKg > 0 ? clamp(completedJourneyKg / totalJourneyKg, 0, 1) : 1;
  const direction = remainingKg > 0 ? 1 : remainingKg < 0 ? -1 : 0;

  const today = normalizeDateValue(now) || new Date();
  const targetDate = normalizeDateValue(journeyEndDate);
  const providedDurationDays = toPositiveNumber(journeyDurationDays);
  const derivedDurationDays =
    targetDate && targetDate > today
      ? Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / DAY_MS))
      : null;
  const timelineTargetDays = Number.isFinite(providedDurationDays)
    ? Math.max(1, Math.round(providedDurationDays))
    : derivedDurationDays;

  let requestedDailyDelta = null;
  if (timelineTargetDays && direction !== 0) {
    requestedDailyDelta = (remainingKg * KCAL_PER_KG) / timelineTargetDays;
  }

  let appliedDailyDelta = 0;
  if (direction === 0 || remainingAbsKg < 0.05) {
    appliedDailyDelta = 0;
  } else if (Number.isFinite(requestedDailyDelta)) {
    if (direction < 0) {
      const maxDeficit = Math.max(280, maintenanceCalories * 0.34 * goalFocus.deficitBias);
      const minDeficit = Math.max(120, 180 * goalFocus.deficitBias);
      appliedDailyDelta = -clamp(Math.abs(requestedDailyDelta), minDeficit, maxDeficit);
    } else {
      const maxSurplus = Math.max(120, maintenanceCalories * 0.16);
      appliedDailyDelta = clamp(Math.abs(requestedDailyDelta), 90, maxSurplus);
    }
  } else {
    appliedDailyDelta = buildAdaptiveDailyDelta({
      direction,
      remainingAbsKg,
      maintenanceCalories,
      goalFocus,
      activityLevel,
      progressRatio,
    });
  }

  const unclampedTargetCalories = maintenanceCalories + appliedDailyDelta;
  const minimumCalories = Math.max(
    goalFocus.minimumCalories,
    normalizedSex === 'male' ? 1500 : 1200
  );
  const targetCalories = Math.round(clamp(unclampedTargetCalories, minimumCalories, 5000));
  const dailyDelta = targetCalories - maintenanceCalories;

  const isCut = dailyDelta < -10;
  const isBulk = dailyDelta > 10;
  const proteinPerKg = clamp(
    currentBodyType.proteinBase + goalFocus.proteinBoost + (isCut ? 0.12 : 0),
    1.7,
    2.4
  );
  const fatPerKg = clamp(
    currentBodyType.fatBase + (normalizedSex === 'female' ? 0.06 : 0) + (isBulk ? 0.05 : 0),
    0.6,
    1.05
  );

  let proteinGrams = Math.round(currentKg * proteinPerKg);
  let fatGrams = Math.round(currentKg * fatPerKg);

  const minimumProteinGrams = Math.round(currentKg * (isCut ? 1.8 : 1.65));
  const minimumFatGrams = Math.round(currentKg * 0.6);
  proteinGrams = Math.max(minimumProteinGrams, proteinGrams);
  fatGrams = Math.max(minimumFatGrams, fatGrams);

  const proteinCalories = proteinGrams * 4;
  let fatCalories = fatGrams * 9;
  let carbCalories = targetCalories - proteinCalories - fatCalories;

  if (carbCalories < 0) {
    fatGrams = Math.max(minimumFatGrams, Math.round((targetCalories - proteinCalories) / 9));
    fatCalories = fatGrams * 9;
    carbCalories = targetCalories - proteinCalories - fatCalories;
  }

  if (carbCalories < 0) {
    proteinGrams = Math.max(
      minimumProteinGrams,
      Math.round((targetCalories - fatCalories) / 4)
    );
    carbCalories = targetCalories - proteinGrams * 4 - fatCalories;
  }

  const carbsGrams = Math.max(0, Math.round(carbCalories / 4));
  const totalMacroCalories = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;
  const safeMacroCalories = totalMacroCalories > 0 ? totalMacroCalories : targetCalories;

  let estimatedDays = 0;
  if (direction !== 0 && Math.abs(dailyDelta) >= 1) {
    estimatedDays = Math.max(
      1,
      Math.round((remainingAbsKg * KCAL_PER_KG) / Math.abs(dailyDelta))
    );
  }

  const projectedEndDate = estimatedDays
    ? new Date(today.getTime() + estimatedDays * DAY_MS)
    : today;

  const timelineGoalMet = timelineTargetDays ? estimatedDays <= timelineTargetDays : true;
  const weeklyWeightChangeKg =
    dailyDelta === 0
      ? 0
      : ((Math.abs(dailyDelta) * 7) / KCAL_PER_KG) * (dailyDelta < 0 ? -1 : 1);

  return {
    goalFocusKey: goalFocus.key,
    goalFocusLabel: goalFocus.label,
    activityLevelKey: activityLevel.key,
    activityLevelLabel: activityLevel.label,
    currentBodyTypeKey: currentBodyType.key,
    currentBodyTypeLabel: currentBodyType.label,
    targetBodyTypeKey: targetBodyType.key,
    targetBodyTypeLabel: targetBodyType.label,
    sex: normalizedSex,
    ageYears: parsedAgeYears,
    heightCm: parsedHeightCm,
    bmrCalories,
    maintenanceCalories,
    targetCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    macroPercentages: {
      protein: roundMacro((proteinGrams * 4 * 100) / safeMacroCalories),
      carbs: roundMacro((carbsGrams * 4 * 100) / safeMacroCalories),
      fat: roundMacro((fatGrams * 9 * 100) / safeMacroCalories),
    },
    startingKg,
    currentKg,
    targetKg,
    estimatedDays,
    timelineTargetDays: timelineTargetDays || null,
    timelineGoalMet,
    journeyEndDateISO: targetDate ? toDateKey(targetDate) : '',
    projectedEndDateISO: toDateKey(projectedEndDate),
    dailyCalorieDelta: Math.round(dailyDelta),
    requestedDailyCalorieDelta: Number.isFinite(requestedDailyDelta)
      ? Math.round(requestedDailyDelta)
      : null,
    weeklyWeightChangeKg,
    journeyTotalKg: totalJourneyKg,
    journeyCompletedKg: completedJourneyKg,
    journeyRemainingKg: remainingAbsKg,
    journeyProgressPercent: Math.round(progressRatio * 100),
  };
};

export const getWeightManagerOverview = ({
  state,
  logs,
  unitFallback = DEFAULT_WEIGHT_MANAGER_UNIT,
} = {}) => {
  const normalizedState = state && typeof state === 'object' ? state : null;
  const weightManagerUnit =
    normalizedState?.weightUnit === 'lb' || normalizedState?.weightUnit === 'kg'
      ? normalizedState.weightUnit
      : unitFallback;
  const latestWeightLog = logs?.length ? logs[0] : null;
  const earliestWeightLog = logs?.length ? logs[logs.length - 1] : null;
  const parsedJourneyWeeks = toPositiveNumber(normalizedState?.journeyDurationWeeks);
  const journeyDurationDays =
    normalizedState?.journeyGoalMode === 'duration' && Number.isFinite(parsedJourneyWeeks)
      ? Math.round(parsedJourneyWeeks * 7)
      : null;
  const journeyEndDate =
    normalizedState?.journeyGoalMode === 'date' &&
    typeof normalizedState?.journeyGoalDate === 'string'
      ? normalizedState.journeyGoalDate
      : null;
  const resolvedCurrentWeight = Number.isFinite(Number(latestWeightLog?.weight))
    ? Number(latestWeightLog.weight)
    : normalizedState?.currentWeight;

  const weightManagerPlan = computeWeightManagerPlan({
    startingWeight: normalizedState?.startingWeight,
    currentWeight: resolvedCurrentWeight,
    targetWeight: normalizedState?.targetWeight,
    unit: weightManagerUnit,
    currentBodyTypeKey: normalizedState?.currentBodyType,
    targetBodyTypeKey: normalizedState?.targetBodyType,
    goalFocusKey: normalizedState?.goalFocusKey,
    activityLevelKey: normalizedState?.activityLevelKey,
    sex: normalizedState?.sex,
    ageYears: normalizedState?.ageYears,
    heightCm: normalizedState?.heightCm,
    journeyDurationDays,
    journeyEndDate,
  });
  const weightManagerTargetBody = normalizedState
    ? WEIGHT_MANAGER_BODY_TYPE_MAP[
        normalizeWeightManagerBodyTypeKey(normalizedState?.targetBodyType)
      ]
    : null;
  const weightManagerGoalFocus = normalizedState
    ? WEIGHT_MANAGER_GOAL_MAP[normalizeWeightManagerGoalKey(normalizedState?.goalFocusKey)]
    : null;
  const weightManagerActivityLevel = normalizedState
    ? WEIGHT_MANAGER_ACTIVITY_LEVEL_MAP[
        normalizeWeightManagerActivityLevelKey(normalizedState?.activityLevelKey)
      ]
    : null;
  const startingWeightValue = Number(normalizedState?.startingWeight);
  const weightManagerStartingValue = Number.isFinite(startingWeightValue)
    ? { value: startingWeightValue, unit: weightManagerUnit }
    : Number.isFinite(Number(earliestWeightLog?.weight))
    ? {
        value: Number(earliestWeightLog.weight),
        unit: earliestWeightLog.unit || weightManagerUnit,
      }
    : null;
  const weightManagerCurrentValue = Number.isFinite(Number(latestWeightLog?.weight))
    ? {
        value: Number(latestWeightLog.weight),
        unit: latestWeightLog.unit || weightManagerUnit,
      }
    : Number.isFinite(Number(resolvedCurrentWeight))
    ? {
        value: Number(resolvedCurrentWeight),
        unit: weightManagerUnit,
      }
    : weightManagerStartingValue;
  const weightManagerStartingDisplay = weightManagerStartingValue
    ? `${weightManagerStartingValue.value} ${weightManagerStartingValue.unit}`
    : '--';
  const weightManagerCurrentDisplay = weightManagerCurrentValue
    ? `${weightManagerCurrentValue.value} ${weightManagerCurrentValue.unit}`
    : '--';
  const weightManagerTargetDisplay = Number.isFinite(Number(normalizedState?.targetWeight))
    ? `${Number(normalizedState.targetWeight)} ${weightManagerUnit}`
    : '--';

  return {
    weightManagerUnit,
    weightManagerPlan,
    weightManagerTargetBody,
    weightManagerGoalFocus,
    weightManagerActivityLevel,
    weightManagerLatestLog: latestWeightLog,
    weightManagerEarliestLog: earliestWeightLog,
    weightManagerStartingValue,
    weightManagerCurrentValue,
    weightManagerStartingDisplay,
    weightManagerCurrentDisplay,
    weightManagerTargetDisplay,
  };
};
