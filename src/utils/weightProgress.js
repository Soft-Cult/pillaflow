const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES = 60;

export const getWeightProgressStorageKey = ({
  authUserId,
  profileId,
  profileUserId,
} = {}) => {
  const userId = authUserId || profileId || profileUserId || 'default';
  return `weight_progress_check:${userId}`;
};

export const toDateKey = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

export const fromDateKey = (dateKey = '') => {
  if (!dateKey || typeof dateKey !== 'string') return null;
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const normalizePositiveWeight = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10) / 10;
};

export const normalizeProgressEntries = (entries = []) => {
  const byDate = new Map();
  (entries || []).forEach((entry) => {
    const dateKey = toDateKey(entry?.dateKey || entry?.date || entry?.loggedAt);
    const weight = normalizePositiveWeight(entry?.weight);
    if (!dateKey || !Number.isFinite(weight)) return;
    byDate.set(dateKey, { dateKey, weight });
  });

  return Array.from(byDate.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

export const parseWeightProgressPayload = (payload) => ({
  startingWeight: normalizePositiveWeight(payload?.startingWeight),
  currentWeight: normalizePositiveWeight(payload?.currentWeight),
  entries: normalizeProgressEntries(payload?.entries || []),
});

export const formatProgressDateLabel = (dateKey = '') => {
  const date = fromDateKey(dateKey);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatProgressAxisDate = (dateKey = '') => {
  const date = fromDateKey(dateKey);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
  });
};

export const formatProgressEntryDate = (dateKey = '') => {
  const date = fromDateKey(dateKey);
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const withTodayProgressEntry = ({
  entries = [],
  weight,
  maxEntries = DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES,
  date = new Date(),
} = {}) => {
  const dateKey = toDateKey(date);
  const normalizedWeight = normalizePositiveWeight(weight);
  if (!dateKey || !Number.isFinite(normalizedWeight)) return normalizeProgressEntries(entries);

  const nextEntries = normalizeProgressEntries([
    ...(entries || []).filter((entry) => toDateKey(entry?.dateKey) !== dateKey),
    { dateKey, weight: normalizedWeight },
  ]);

  if (!Number.isFinite(maxEntries) || maxEntries <= 0 || nextEntries.length <= maxEntries) {
    return nextEntries;
  }
  return nextEntries.slice(nextEntries.length - maxEntries);
};

export const buildWeightProgressPayload = ({
  payload,
  startingWeight,
  currentWeight,
  maxEntries = DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES,
  date = new Date(),
} = {}) => {
  const normalizedPayload = parseWeightProgressPayload(payload);
  const normalizedCurrentWeight = normalizePositiveWeight(currentWeight);
  const normalizedStartingWeight =
    normalizePositiveWeight(startingWeight) ??
    normalizedPayload.startingWeight ??
    normalizedCurrentWeight;

  const nextEntries = Number.isFinite(normalizedCurrentWeight)
    ? withTodayProgressEntry({
        entries: normalizedPayload.entries,
        weight: normalizedCurrentWeight,
        maxEntries,
        date,
      })
    : normalizedPayload.entries;

  const updatedAt =
    date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : new Date().toISOString();

  return {
    startingWeight: normalizedStartingWeight,
    currentWeight: normalizedCurrentWeight ?? normalizedPayload.currentWeight,
    entries: nextEntries,
    updatedAt,
  };
};

export const mergeWeightProgressPayload = ({
  payload,
  logs = [],
  startingWeight = null,
  currentWeight = null,
  maxEntries = DEFAULT_WEIGHT_PROGRESS_MAX_ENTRIES,
} = {}) => {
  const normalizedPayload = parseWeightProgressPayload(payload);
  const logEntries = normalizeProgressEntries(
    (Array.isArray(logs) ? logs : []).map((entry) => ({
      dateKey: entry?.dateKey || entry?.logDate || entry?.date || entry?.loggedAt,
      weight: entry?.weight,
    }))
  );
  const mergedEntries = normalizeProgressEntries([
    ...normalizedPayload.entries,
    ...logEntries,
  ]);
  const trimmedEntries =
    Number.isFinite(maxEntries) && maxEntries > 0 && mergedEntries.length > maxEntries
      ? mergedEntries.slice(mergedEntries.length - maxEntries)
      : mergedEntries;
  const latestEntry = trimmedEntries.length ? trimmedEntries[trimmedEntries.length - 1] : null;
  const earliestEntry = trimmedEntries.length ? trimmedEntries[0] : null;
  const resolvedCurrentWeight =
    normalizePositiveWeight(currentWeight) ??
    normalizedPayload.currentWeight ??
    normalizePositiveWeight(latestEntry?.weight);
  const resolvedStartingWeight =
    normalizePositiveWeight(startingWeight) ??
    normalizedPayload.startingWeight ??
    normalizePositiveWeight(earliestEntry?.weight) ??
    resolvedCurrentWeight;

  return {
    startingWeight: resolvedStartingWeight,
    currentWeight: resolvedCurrentWeight,
    entries: trimmedEntries,
  };
};

export const toUtcDayNumberFromDateKey = (dateKey = '') => {
  const date = fromDateKey(dateKey);
  if (!date) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
};
