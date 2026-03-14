import {
  computeWeightManagerPlan,
  DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
  DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  DEFAULT_WEIGHT_MANAGER_GOAL,
  DEFAULT_WEIGHT_MANAGER_UNIT,
  normalizeWeightManagerActivityLevelKey,
  normalizeWeightManagerBodyTypeKey,
  normalizeWeightManagerGoalKey,
  normalizeWeightManagerSex,
} from './weightManager';

const HISTORY_STORAGE_PREFIX = 'weight_manager_journey_history';
const STATE_STORAGE_PREFIX = 'weight_manager_state';

export const WEIGHT_MANAGER_PLAN_STATUS_DRAFT = 'draft';
export const WEIGHT_MANAGER_PLAN_STATUS_ACTIVE = 'active';

const normalizeWeightValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10) / 10;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  const raw = String(value);
  const parsed =
    value instanceof Date
      ? value
      : raw.includes('T')
      ? new Date(raw)
      : new Date(`${raw}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const toIsoTimestamp = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const normalizeUnit = (value) => (value === 'lb' ? 'lb' : DEFAULT_WEIGHT_MANAGER_UNIT);

const normalizeGoalMode = (value) => (value === 'date' ? 'date' : 'duration');

export const normalizeJourneyPlanStatus = (value) =>
  value === WEIGHT_MANAGER_PLAN_STATUS_ACTIVE
    ? WEIGHT_MANAGER_PLAN_STATUS_ACTIVE
    : WEIGHT_MANAGER_PLAN_STATUS_DRAFT;

const resolveUserId = ({ authUserId, profileId, profileUserId } = {}) =>
  authUserId || profileId || profileUserId || 'default';

const normalizeCheckIns = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const loggedAt = toIsoTimestamp(entry?.loggedAt || entry?.logDate || entry?.created_at);
      const weight = normalizeWeightValue(entry?.weight);
      if (!Number.isFinite(weight)) return null;
      return {
        loggedAt,
        dateKey: normalizeDateKey(loggedAt),
        weight,
        unit: normalizeUnit(entry?.unit),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));

const toFiniteOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

export const getWeightManagerStateStorageKey = ({ authUserId, profileId, profileUserId } = {}) => {
  const userId = resolveUserId({ authUserId, profileId, profileUserId });
  return `${STATE_STORAGE_PREFIX}:${userId}`;
};

export const getWeightJourneyHistoryStorageKey = ({
  authUserId,
  profileId,
  profileUserId,
} = {}) => {
  const userId = resolveUserId({ authUserId, profileId, profileUserId });
  return `${HISTORY_STORAGE_PREFIX}:${userId}`;
};

export const hasJourneyState = (state = {}) => {
  const currentWeight = normalizeWeightValue(state?.currentWeight);
  const targetWeight = normalizeWeightValue(state?.targetWeight);
  return Number.isFinite(currentWeight) && Number.isFinite(targetWeight);
};

export const isJourneyPlanActive = (state = {}) =>
  normalizeJourneyPlanStatus(state?.planStatus) === WEIGHT_MANAGER_PLAN_STATUS_ACTIVE &&
  hasJourneyState(state);

export const normalizeWeightManagerState = (state = {}, fallback = {}) => {
  const merged = { ...(fallback || {}), ...(state || {}) };
  const currentWeight = normalizeWeightValue(merged?.currentWeight);
  const startingWeight =
    normalizeWeightValue(merged?.startingWeight) ?? currentWeight ?? normalizeWeightValue(fallback?.startingWeight);

  return {
    weightUnit: normalizeUnit(merged?.weightUnit),
    startingWeight,
    currentWeight,
    targetWeight: normalizeWeightValue(merged?.targetWeight),
    currentBodyType: normalizeWeightManagerBodyTypeKey(merged?.currentBodyType),
    targetBodyType: normalizeWeightManagerBodyTypeKey(merged?.targetBodyType),
    goalFocusKey: normalizeWeightManagerGoalKey(merged?.goalFocusKey),
    activityLevelKey: normalizeWeightManagerActivityLevelKey(merged?.activityLevelKey),
    sex: normalizeWeightManagerSex(merged?.sex),
    ageYears: toFiniteOrNull(merged?.ageYears),
    heightCm: toFiniteOrNull(merged?.heightCm),
    journeyGoalMode: normalizeGoalMode(merged?.journeyGoalMode),
    journeyDurationWeeks: toFiniteOrNull(merged?.journeyDurationWeeks),
    journeyGoalDate: normalizeDateKey(merged?.journeyGoalDate),
    planStatus: normalizeJourneyPlanStatus(merged?.planStatus),
    savedAt: toIsoTimestamp(merged?.savedAt || fallback?.savedAt || new Date()),
    activatedAt: merged?.activatedAt ? toIsoTimestamp(merged.activatedAt) : null,
  };
};

export const normalizeJourneyEntry = (entry = {}) => {
  const id = String(entry?.id || '').trim();
  if (!id) return null;

  const createdAt = toIsoTimestamp(entry?.createdAt || entry?.completedAt || new Date());
  const completedAt = entry?.completedAt ? toIsoTimestamp(entry.completedAt) : null;

  return {
    id,
    status:
      normalizeJourneyPlanStatus(entry?.status) === WEIGHT_MANAGER_PLAN_STATUS_ACTIVE
        ? WEIGHT_MANAGER_PLAN_STATUS_ACTIVE
        : 'completed',
    completedReason: entry?.completedReason || null,
    createdAt,
    completedAt,
    unit: normalizeUnit(entry?.unit),
    startingWeight: normalizeWeightValue(entry?.startingWeight),
    currentWeight: normalizeWeightValue(entry?.currentWeight),
    targetWeight: normalizeWeightValue(entry?.targetWeight),
    currentBodyType: normalizeWeightManagerBodyTypeKey(entry?.currentBodyType),
    targetBodyType: normalizeWeightManagerBodyTypeKey(entry?.targetBodyType),
    goalFocusKey: normalizeWeightManagerGoalKey(entry?.goalFocusKey),
    activityLevelKey: normalizeWeightManagerActivityLevelKey(entry?.activityLevelKey),
    sex: normalizeWeightManagerSex(entry?.sex),
    ageYears: toFiniteOrNull(entry?.ageYears),
    heightCm: toFiniteOrNull(entry?.heightCm),
    journeyGoalMode: normalizeGoalMode(entry?.journeyGoalMode),
    journeyDurationWeeks: normalizeNumber(entry?.journeyDurationWeeks),
    journeyGoalDate: normalizeDateKey(entry?.journeyGoalDate),
    timelineTargetDays: toFiniteOrNull(entry?.timelineTargetDays),
    estimatedDays: toFiniteOrNull(entry?.estimatedDays),
    projectedEndDateISO: normalizeDateKey(entry?.projectedEndDateISO),
    targetCalories: toFiniteOrNull(entry?.targetCalories),
    maintenanceCalories: toFiniteOrNull(entry?.maintenanceCalories),
    proteinGrams: toFiniteOrNull(entry?.proteinGrams),
    carbsGrams: toFiniteOrNull(entry?.carbsGrams),
    fatGrams: toFiniteOrNull(entry?.fatGrams),
    dailyCalorieDelta: toFiniteOrNull(entry?.dailyCalorieDelta),
    weeklyWeightChangeKg: toFiniteOrNull(entry?.weeklyWeightChangeKg),
    timelineGoalMet:
      typeof entry?.timelineGoalMet === 'boolean' ? entry.timelineGoalMet : null,
    checkIns: normalizeCheckIns(entry?.checkIns),
  };
};

export const normalizeJourneyHistoryEntries = (entries = []) => {
  const byId = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const normalized = normalizeJourneyEntry(entry);
    if (!normalized) return;
    byId.set(normalized.id, normalized);
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aDate = a.completedAt || a.createdAt;
    const bDate = b.completedAt || b.createdAt;
    return bDate.localeCompare(aDate);
  });
};

export const parseWeightJourneyHistoryPayload = (payload) => {
  if (Array.isArray(payload)) return normalizeJourneyHistoryEntries(payload);
  if (payload && Array.isArray(payload.journeys)) {
    return normalizeJourneyHistoryEntries(payload.journeys);
  }
  return [];
};

export const appendJourneyHistoryEntry = (entries = [], nextEntry) =>
  normalizeJourneyHistoryEntries([...(Array.isArray(entries) ? entries : []), nextEntry]);

const buildPlanForState = (state = {}) => {
  const normalizedState = normalizeWeightManagerState(state);
  if (!hasJourneyState(normalizedState)) return null;
  const journeyWeeks = normalizeNumber(normalizedState?.journeyDurationWeeks);
  const journeyDurationDays =
    normalizeGoalMode(normalizedState?.journeyGoalMode) === 'duration' &&
    Number.isFinite(journeyWeeks)
      ? Math.max(1, Math.round(journeyWeeks * 7))
      : null;
  const journeyEndDate =
    normalizeGoalMode(normalizedState?.journeyGoalMode) === 'date'
      ? normalizeDateKey(normalizedState?.journeyGoalDate)
      : '';
  return computeWeightManagerPlan({
    startingWeight: normalizedState?.startingWeight,
    currentWeight: normalizedState?.currentWeight,
    targetWeight: normalizedState?.targetWeight,
    unit: normalizedState?.weightUnit,
    currentBodyTypeKey: normalizedState?.currentBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    targetBodyTypeKey: normalizedState?.targetBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    goalFocusKey: normalizedState?.goalFocusKey || DEFAULT_WEIGHT_MANAGER_GOAL,
    activityLevelKey:
      normalizedState?.activityLevelKey || DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
    sex: normalizedState?.sex,
    ageYears: normalizedState?.ageYears,
    heightCm: normalizedState?.heightCm,
    journeyDurationDays,
    journeyEndDate: journeyEndDate || null,
  });
};

const buildBaseJourneyEntry = ({ id, status, state = {}, plan = null, createdAt = null }) => {
  const normalizedState = normalizeWeightManagerState(state);
  const resolvedPlan = plan || buildPlanForState(normalizedState);
  const normalizedGoalMode = normalizeGoalMode(normalizedState?.journeyGoalMode);

  return {
    id,
    status,
    createdAt: toIsoTimestamp(createdAt || new Date()),
    unit: normalizedState?.weightUnit,
    startingWeight: normalizeWeightValue(normalizedState?.startingWeight),
    currentWeight: normalizeWeightValue(normalizedState?.currentWeight),
    targetWeight: normalizeWeightValue(normalizedState?.targetWeight),
    currentBodyType: normalizedState?.currentBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    targetBodyType: normalizedState?.targetBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    goalFocusKey: normalizedState?.goalFocusKey || DEFAULT_WEIGHT_MANAGER_GOAL,
    activityLevelKey:
      normalizedState?.activityLevelKey || DEFAULT_WEIGHT_MANAGER_ACTIVITY_LEVEL,
    sex: normalizedState?.sex,
    ageYears: normalizedState?.ageYears,
    heightCm: normalizedState?.heightCm,
    journeyGoalMode: normalizedGoalMode,
    journeyDurationWeeks:
      normalizedGoalMode === 'duration' ? normalizeNumber(normalizedState?.journeyDurationWeeks) : null,
    journeyGoalDate:
      normalizedGoalMode === 'date' ? normalizeDateKey(normalizedState?.journeyGoalDate) : '',
    timelineTargetDays: toFiniteOrNull(resolvedPlan?.timelineTargetDays),
    estimatedDays: toFiniteOrNull(resolvedPlan?.estimatedDays),
    projectedEndDateISO: normalizeDateKey(resolvedPlan?.projectedEndDateISO),
    targetCalories: toFiniteOrNull(resolvedPlan?.targetCalories),
    maintenanceCalories: toFiniteOrNull(resolvedPlan?.maintenanceCalories),
    proteinGrams: toFiniteOrNull(resolvedPlan?.proteinGrams),
    carbsGrams: toFiniteOrNull(resolvedPlan?.carbsGrams),
    fatGrams: toFiniteOrNull(resolvedPlan?.fatGrams),
    dailyCalorieDelta: toFiniteOrNull(resolvedPlan?.dailyCalorieDelta),
    weeklyWeightChangeKg: toFiniteOrNull(resolvedPlan?.weeklyWeightChangeKg),
    timelineGoalMet:
      typeof resolvedPlan?.timelineGoalMet === 'boolean' ? resolvedPlan.timelineGoalMet : null,
  };
};

export const buildCurrentJourneyEntry = ({ state = {}, plan = null, logs = [] } = {}) => {
  const normalizedState = normalizeWeightManagerState(state);
  if (!isJourneyPlanActive(normalizedState)) return null;
  const createdAt = toIsoTimestamp(
    normalizedState?.activatedAt || normalizedState?.savedAt || new Date()
  );
  return normalizeJourneyEntry({
    ...buildBaseJourneyEntry({
      id: 'current-journey',
      status: WEIGHT_MANAGER_PLAN_STATUS_ACTIVE,
      state: normalizedState,
      plan,
      createdAt,
    }),
    checkIns: normalizeCheckIns(logs),
  });
};

export const createCompletedJourneyEntry = ({
  state = {},
  plan = null,
  logs = [],
  completedAt = new Date(),
  completedReason = 'goal_achieved',
} = {}) => {
  const normalizedState = normalizeWeightManagerState(state);
  if (!hasJourneyState(normalizedState)) return null;
  const completionTimestamp = toIsoTimestamp(completedAt);
  const id = `journey-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return normalizeJourneyEntry({
    ...buildBaseJourneyEntry({
      id,
      status: 'completed',
      state: normalizedState,
      plan,
      createdAt:
        normalizedState?.activatedAt || normalizedState?.savedAt || completionTimestamp,
    }),
    completedAt: completionTimestamp,
    completedReason,
    checkIns: normalizeCheckIns(logs),
  });
};
